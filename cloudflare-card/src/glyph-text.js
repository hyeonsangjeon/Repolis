/* cloudflare-card/src/glyph-text.js — city card text drawn as glyph outlines, so the PNG renderer needs no font.
 *
 * The outlines come from src/glyphs/noto-sans-kr.json (Noto Sans KR, SIL OFL 1.1), built once by
 * scripts/build_glyphs.py for a fixed vocabulary at the card's four weights. Glyphs sit side by side at their advance
 * widths: there is no kerning or shaping, which precomposed Hangul and the card's Latin text do without. A character
 * outside the vocabulary is drawn as its ASCII form (accents dropped) or as '-', and a run that real metrics make
 * wider than its slot is scaled down to fit.
 */

const NUMBER = value => {
  const n = Math.round(value * 100) / 100;
  return String(Object.is(n, -0) ? 0 : n);
};
const COLOR = /^#[0-9a-f]{3,8}$/i;

/* Throws unless `data` is a card glyph table with the same characters at every weight. */
function readGlyphs(data) {
  if (!data || data.schema !== 'repolis.card-glyphs' || data.version !== 1) throw new Error('not a card glyph table');
  const upm = Number(data.unitsPerEm);
  const weights = (Array.isArray(data.weights) ? data.weights : []).map(Number).filter(Number.isInteger).sort((a, b) => a - b);
  if (!(upm > 0) || !weights.length) throw new Error('glyph table has no metrics');
  const tables = new Map();
  let chars = null;
  for (const weight of weights) {
    const table = data.glyphs && data.glyphs[String(weight)];
    if (!table || typeof table !== 'object') throw new Error(`glyph table has no weight ${weight}`);
    const keys = Object.keys(table).sort().join('');
    if (chars !== null && keys !== chars) throw new Error('glyph weights cover different characters');
    chars = keys;
    for (const key of Object.keys(table)) {
      const glyph = table[key];
      if (!Array.isArray(glyph) || !Number.isFinite(glyph[0]) || typeof glyph[1] !== 'string' || !/^[mlqcz0-9 -]*$/.test(glyph[1])) {
        throw new Error('malformed glyph');
      }
    }
    tables.set(weight, table);
  }
  return { upm, weights, tables };
}

export function createGlyphText(data) {
  const { upm, weights, tables } = readGlyphs(data);
  const any = tables.get(weights[0]);
  const has = char => Object.prototype.hasOwnProperty.call(any, char);
  const nearest = weight => weights.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), weights[0]);

  /* The characters actually drawn for `text`: each one in the vocabulary, else its accent-free ASCII form, else '-'. */
  function drawable(text) {
    const out = [];
    for (const char of String(text ?? '').normalize('NFC')) {
      if (has(char)) { out.push(char); continue; }
      const plain = char.normalize('NFKD').replace(/\p{M}+/gu, '');
      if (plain && [...plain].every(has)) out.push(...plain);
      else if (out[out.length - 1] !== '-') out.push('-');
    }
    return out;
  }

  /* True when every character of every run is in the vocabulary, so nothing would be replaced. */
  function covers(runs) {
    return (Array.isArray(runs) ? runs : []).every(run => [...String(run.text ?? '').normalize('NFC')].every(has));
  }

  /* SVG markup for the runs: one <defs> of the glyphs used, then one scaled group of <use> per run. */
  function drawText(runs) {
    const defs = new Map();
    const groups = [];
    for (const run of Array.isArray(runs) ? runs : []) {
      const weight = nearest(Number(run.weight) || 400);
      const table = tables.get(weight);
      const chars = drawable(run.text);
      const size = Number(run.size) > 0 ? Number(run.size) : 16;
      const unit = size / upm;
      const spacing = (Number(run.spacing) || 0) / unit;
      let pen = 0;
      const uses = [];
      chars.forEach((char, index) => {
        const [advance, d] = table[char];
        if (d) {
          const id = `g${weight}-${char.codePointAt(0).toString(16)}`;
          defs.set(id, d);
          uses.push(`<use href="#${id}" x="${NUMBER(pen)}"/>`);
        }
        pen += advance + (index < chars.length - 1 ? spacing : 0);
      });
      if (!uses.length) continue;
      let scale = unit, width = pen * unit;
      const maxWidth = Number(run.maxWidth);
      if (maxWidth > 0 && width > maxWidth) { scale = (unit * maxWidth) / width; width = maxWidth; }
      const x = Number(run.x) || 0, y = Number(run.y) || 0;
      const left = run.anchor === 'end' ? x - width : run.anchor === 'middle' ? x - width / 2 : x;
      const opacity = Number(run.opacity);
      groups.push(`<g transform="translate(${NUMBER(left)} ${NUMBER(y)}) scale(${String(Math.round(scale * 1e6) / 1e6)})" `
        + `fill="${COLOR.test(run.fill) ? run.fill : '#ffffff'}"`
        + (Number.isFinite(opacity) && opacity >= 0 && opacity < 1 ? ` opacity="${NUMBER(opacity)}"` : '')
        + `>${uses.join('')}</g>`);
    }
    if (!groups.length) return '';
    return `<defs>${[...defs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('')}</defs>${groups.join('')}`;
  }

  /* The drawn width of `text` in user units, for tests and layout checks. */
  function width(text, size, weight = 400) {
    const table = tables.get(nearest(weight));
    return drawable(text).reduce((sum, char) => sum + table[char][0], 0) * (size / upm);
  }

  return Object.freeze({ covers, drawable, drawText, width, weights: Object.freeze(weights.slice()) });
}
