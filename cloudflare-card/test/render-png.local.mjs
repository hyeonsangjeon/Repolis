/* cloudflare-card/test/render-png.local.mjs — local-only: real PNG renders of fixed cards, pinned by hash.
 *
 * Runs the Worker module with the real @resvg/resvg-wasm renderer and a KV that already holds fixed card summaries, so
 * no network is used, then pins the SHA-256 of each PNG. It also re-renders src/generic-card.png and compares bytes.
 * The hashes hold for the locked @resvg/resvg-wasm and the committed glyph table; update them only for a deliberate
 * card, glyph or renderer change. Needs `npm ci` in cloudflare-card/, so it is not part of scripts/check-hermetic.sh.
 *
 *   cd cloudflare-card && npm run test:local
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { createCardWorker } from '../src/worker.js';
import { createGlyphText } from '../src/glyph-text.js';
import { genericCardSvg } from '../src/generic-card.js';
import { summarizeCityCard } from '../../assets/city-card.js';

const here = path => new URL(path, import.meta.url);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
await initWasm(readFileSync(here('../node_modules/@resvg/resvg-wasm/index_bg.wasm')));
const GLYPHS = JSON.parse(readFileSync(here('../src/glyphs/noto-sans-kr.json'), 'utf8'));
const GENERIC = new Uint8Array(readFileSync(here('../src/generic-card.png')));

function renderPng(svg) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: false } });
  const image = resvg.render();
  try { return image.asPng(); } finally { image.free(); resvg.free(); }
}

const golden = JSON.parse(readFileSync(here('../../scripts/fixtures/zone-classifier-golden.json'), 'utf8'));
const reference = Date.parse(golden.source.reference);
const owner = summarizeCityCard(golden.repos, { referenceTimestamp: reference });
const capped = summarizeCityCard(Array.from({ length: 150 }, (_, index) => ({
  repo: `project-${index}-${'x'.repeat(index % 30)}`, stars: (index * 37) % 500, lang: index % 3 ? 'TypeScript' : 'Go', created: `${2010 + (index % 15)}-01-01`,
  topics: [['llm', 'docker', 'react', 'csv', 'tutorial'][index % 5]], pushed: '2026-09-01', archived: index % 11 === 0,
})), { referenceTimestamp: reference });
const store = new Map([['card:v1:hyeonsangjeon', JSON.stringify(owner)], ['card:v1:wide-town', JSON.stringify(capped)]]);
const env = { CARD_KV: { get: async key => store.get(key) ?? null, put: async () => {} }, SITE_URL: 'https://hyeonsangjeon.github.io/Repolis/' };
const worker = createCardWorker({ renderPng, glyphs: GLYPHS, bannerSvg: '<svg/>', genericPng: GENERIC, cache: null,
  fetchImpl: () => { throw new Error('no network in this test'); }, now: () => Date.parse('2026-10-21T00:00:00Z'), log: () => {} });

const PINNED = {
  '/card/hyeonsangjeon.png': '6a5a3d780182ff8416101b3dd22256980550eb9cb30a9de950205472a7ca92aa',
  '/card/hyeonsangjeon.png?lang=ko': '2b665f2d7d7dca546147ada20c9280c54b2ddbd3ca012998b937d3acd9c4f418',
  '/card/wide-town.png': 'feda9a1ffa535692d17e0b5fe983b6f7ce077a253d7c168435b1017e1a0e109e',
  '/card/wide-town.png?lang=ko': 'a6b1d5c627ad781145f7f3a72abe3863d0f69dc86e693d75e6290ffe471aaee8',
};
const actual = {};
for (const path of Object.keys(PINNED)) {
  const response = await worker.fetch(new Request(`https://repolis-card.example.workers.dev${path}`), env, { waitUntil() {} });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  assert.equal(response.status, 200, path);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=86400, s-maxage=86400', `${path} is a rendered card, not the fallback`);
  assert.ok(view.getUint32(16) === 1200 && view.getUint32(20) === 630, `${path} is 1200×630`);
  actual[path] = sha(bytes);
}
const genericAgain = renderPng(genericCardSvg(createGlyphText(GLYPHS).drawText));
assert.equal(sha(genericAgain), sha(GENERIC), 'src/generic-card.png is what scripts/build-generic-card.mjs renders today');
const changed = Object.keys(PINNED).filter(path => PINNED[path] !== actual[path]);
if (changed.length) {
  console.log(JSON.stringify(actual, null, 2));
  assert.fail(`PNG hashes changed for ${changed.join(', ')}; pin the values above only for a deliberate card, glyph or renderer change`);
}
console.log(`ALL GREEN - ${Object.keys(PINNED).length} pinned card PNGs and the generic card render byte for byte`);
