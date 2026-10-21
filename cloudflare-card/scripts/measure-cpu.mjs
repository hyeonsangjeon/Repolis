/* cloudflare-card/scripts/measure-cpu.mjs — CPU time of a 1200×630 card render, using the Worker's own code and renderer.
 *
 * A PNG cache miss costs one glyph-path SVG build plus one rasterization by the same @resvg/resvg-wasm build that
 * wrangler bundles. This prints the cold WebAssembly start once, then per request the median, p95 and max of process CPU
 * time (user + system) and wall time for the whole Worker path (KV read already warm, no cache), and for the
 * rasterization alone. Workers limits CPU time per request (Free 10 ms; Paid 30 s by default), so this decides the plan.
 * Numbers are from this machine's CPU, not Cloudflare's; compare them with the CPU time Workers reports after deploy.
 * Needs `npm ci` in cloudflare-card/.
 *
 *   cd cloudflare-card && npm run measure:cpu            # 40 measured runs per case
 *   cd cloudflare-card && npm run measure:cpu -- 100     # another run count
 */
import { readFileSync } from 'node:fs';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { createCardWorker } from '../src/worker.js';
import { createGlyphText } from '../src/glyph-text.js';
import { cardCityName } from '../src/town-card.js';
import { cityCardSvg, summarizeCityCard } from '../../assets/city-card.js';

const runs = Math.max(5, Number(process.argv[2]) || 40);
const here = path => new URL(path, import.meta.url);
const cpuMs = start => { const used = process.cpuUsage(start); return (used.user + used.system) / 1000; };
const stats = values => {
  const sorted = values.slice().sort((a, b) => a - b);
  const at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { median: at(0.5), p95: at(0.95), max: sorted[sorted.length - 1] };
};
const fmt = value => value.toFixed(1).padStart(6);

let cpu = process.cpuUsage(), wall = performance.now();
await initWasm(readFileSync(here('../node_modules/@resvg/resvg-wasm/index_bg.wasm')));
console.log(`WebAssembly start (once per isolate): cpu ${cpuMs(cpu).toFixed(1)} ms, wall ${(performance.now() - wall).toFixed(1)} ms`);

const GLYPHS = JSON.parse(readFileSync(here('../src/glyphs/noto-sans-kr.json'), 'utf8'));
const glyphs = createGlyphText(GLYPHS);
function renderPng(svg) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: false } });
  const image = resvg.render();
  try { return image.asPng(); } finally { image.free(); resvg.free(); }
}

const golden = JSON.parse(readFileSync(here('../../scripts/fixtures/zone-classifier-golden.json'), 'utf8'));
const reference = Date.parse(golden.source.reference);
const owner = summarizeCityCard(golden.repos, { referenceTimestamp: reference });
const wide = summarizeCityCard(Array.from({ length: 150 }, (_, index) => ({
  repo: `project-${index}-${'x'.repeat(index % 30)}`, stars: (index * 37) % 500, lang: index % 3 ? 'TypeScript' : 'Go',
  created: `${2010 + (index % 15)}-01-01`, topics: [['llm', 'docker', 'react', 'csv', 'tutorial'][index % 5]], pushed: '2026-09-01',
})), { referenceTimestamp: reference });
const store = new Map([['card:v1:owner-town', JSON.stringify(owner)], ['card:v1:wide-town', JSON.stringify(wide)]]);
// The rate limit would turn renders past 30 a minute into the plain card; measuring needs every request to render.
const env = { CARD_KV: { get: async key => store.get(key) ?? null, put: async () => {} }, CARD_RATE_LIMIT: { limit: async () => ({ success: true }) } };
const worker = createCardWorker({ renderPng, glyphs: GLYPHS, bannerSvg: '<svg/>', genericPng: readFileSync(here('../src/generic-card.png')),
  cache: null, fetchImpl: () => { throw new Error('no network'); }, log: () => {} });

const cases = [
  ['71 houses, English', 'owner-town', '', owner],
  ['71 houses, Korean', 'owner-town', '?lang=ko', owner],
  ['100 houses, English', 'wide-town', '', wide],
  ['100 houses, Korean', 'wide-town', '?lang=ko', wide],
];
console.log(`\n${runs} measured runs per case after 3 warm-up runs (ms)`);
console.log('case                  request cpu: median    p95    max | wall median | raster cpu: median    p95 | PNG bytes');
for (const [label, login, query, summary] of cases) {
  const name = cardCityName(summary, login);
  const svg = cityCardSvg(summary, query ? name.ko : name.en, { size: 'og', lang: query ? 'ko' : 'en', drawText: glyphs.drawText });
  const request = () => worker.fetch(new Request(`https://card.example/card/${login}.png${query}`), env, { waitUntil() {} });
  let bytes = 0;
  for (let i = 0; i < 3; i++) { await (await request()).arrayBuffer(); renderPng(svg); }
  const requestCpu = [], requestWall = [], rasterCpu = [];
  for (let i = 0; i < runs; i++) {
    cpu = process.cpuUsage(); wall = performance.now();
    const response = await request();
    bytes = (await response.arrayBuffer()).byteLength;
    if (!/s-maxage/.test(response.headers.get('cache-control'))) throw new Error(`${label}: got the plain card, not a render`);
    requestCpu.push(cpuMs(cpu)); requestWall.push(performance.now() - wall);
    cpu = process.cpuUsage();
    renderPng(svg);
    rasterCpu.push(cpuMs(cpu));
  }
  const r = stats(requestCpu), w = stats(requestWall), x = stats(rasterCpu);
  console.log(`${label.padEnd(21)} ${fmt(r.median)} ${fmt(r.p95)} ${fmt(r.max)} |      ${fmt(w.median)} |        ${fmt(x.median)} ${fmt(x.p95)} | ${bytes}`);
}
console.log(`\nnode ${process.version}, ${process.platform}/${process.arch}`);
