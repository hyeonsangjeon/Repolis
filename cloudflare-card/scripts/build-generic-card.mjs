/* cloudflare-card/scripts/build-generic-card.mjs — renders src/generic-card.png, the plain card every fallback returns.
 *
 * Run after changing src/generic-card.js or the glyphs, then commit the PNG. Needs `npm ci` in cloudflare-card/
 * (the same @resvg/resvg-wasm the Worker bundles). test/render-png.local.mjs pins the result's hash.
 *
 *   cd cloudflare-card && npm run build:generic-card
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { createGlyphText } from '../src/glyph-text.js';
import { genericCardSvg } from '../src/generic-card.js';

const here = path => new URL(path, import.meta.url);

await initWasm(readFileSync(here('../node_modules/@resvg/resvg-wasm/index_bg.wasm')));
const glyphs = createGlyphText(JSON.parse(readFileSync(here('../src/glyphs/noto-sans-kr.json'), 'utf8')));
const resvg = new Resvg(genericCardSvg(glyphs.drawText), { fitTo: { mode: 'original' }, font: { loadSystemFonts: false } });
const image = resvg.render();
const png = image.asPng();
writeFileSync(here('../src/generic-card.png'), png);
console.log(`wrote src/generic-card.png ${image.width}x${image.height}, ${png.length} bytes, sha256 ${createHash('sha256').update(png).digest('hex')}`);
