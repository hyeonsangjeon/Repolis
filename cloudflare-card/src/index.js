/* cloudflare-card/src/index.js — the repolis-card Worker entry (wrangler.toml `main`).
 *
 * It only wires the bundled pieces into src/worker.js: the resvg WebAssembly renderer (@resvg/resvg-wasm), the glyph
 * outlines, the pre-rendered generic card and the site's README banner. wrangler bundles the imports below; the
 * .wasm file loads as a compiled module and the [[rules]] in wrangler.toml load the PNG as bytes and the SVG as text.
 */
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import GLYPHS from './glyphs/noto-sans-kr.json';
import GENERIC_CARD_PNG from './generic-card.png';
import BANNER_SVG from '../../assets/banner.svg';
import { createCardWorker } from './worker.js';

let ready = null;

/* One resvg instance per render; the WebAssembly module is instantiated once per isolate. Card text is already
 * glyph paths, so no font is loaded. */
async function renderPng(svg) {
  if (!ready) ready = initWasm(resvgWasm).catch(error => { ready = null; throw error; });
  await ready;
  const resvg = new Resvg(svg, { fitTo: { mode: 'original' }, font: { loadSystemFonts: false } });
  try {
    const image = resvg.render();
    try { return image.asPng(); } finally { image.free(); }
  } finally {
    resvg.free();
  }
}

export default createCardWorker({ renderPng, glyphs: GLYPHS, bannerSvg: BANNER_SVG, genericPng: GENERIC_CARD_PNG });
