/* cloudflare-card/scripts/card-vocabulary.mjs — every character the PNG city card can draw.
 *
 * src/glyphs/noto-sans-kr.json holds outlines for exactly this set: printable ASCII, the card symbols, and every
 * string the city card (assets/city-card.js), the city plaque (assets/homecoming.js) and the generic card can put on
 * a card in English or Korean. scripts/test-city-card-worker.mjs runs the same enumeration, so new Korean copy in
 * either module fails the hermetic gate until the glyphs are rebuilt with scripts/build_glyphs.py.
 *
 *   node cloudflare-card/scripts/card-vocabulary.mjs     # prints {"chars": "...", "count": n}
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ZONE_IDS } from '../../assets/zone-classifier.js';
import { cityCardTextRuns } from '../../assets/city-card.js';
import { homecomingCityName } from '../../assets/homecoming.js';
import { GENERIC_CARD_RUNS } from '../src/generic-card.js';

export const CARD_SYMBOLS = '★·…';
const PLAQUE_ZONES = Object.freeze([null, 'infra', 'ai', 'web', 'data']);

/* The languages the plaque writes in Korean. Its LANGUAGE_KO table is not exported, so its keys are read from source. */
export function plaqueLanguages(source = readFileSync(new URL('../../assets/homecoming.js', import.meta.url), 'utf8')) {
  const block = /const LANGUAGE_KO = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(source);
  if (!block) throw new Error('LANGUAGE_KO table not found in assets/homecoming.js');
  return [...block[1].matchAll(/(?:'([^']+)'|([A-Za-z][A-Za-z0-9+#-]*))\s*:\s*'[^']*'/g)].map(match => match[1] || match[2]);
}

/* Card summaries that reach every branch of the stats line, every district label and the top-house list. */
function sampleSummaries() {
  const house = zone => ({ name: 'repo', stars: 1, zone });
  const full = (zone, extra) => ({ language: 'Python', firstYear: 2016, zones: [{ id: zone, count: 1, percent: 100 }], top: [house(zone)],
    skyline: [{ zone, stars: 1, archived: false }], ...extra });
  return [
    {},
    full('ai', { repos: 1, truncated: false, stars: 1, archived: 1 }),
    full('web', { repos: 100, truncated: true, stars: 12345, archived: 3 }),
    ...ZONE_IDS.map(zone => full(zone, { repos: 2, truncated: false, stars: 2, archived: 0 })),
  ];
}

/* Every string a card can carry. */
export function cardTexts() {
  const texts = [];
  for (const lang of ['en', 'ko']) {
    for (const summary of sampleSummaries()) {
      for (const name of ['', 'octo']) texts.push(...cityCardTextRuns(summary, name, { size: 'og', lang }).map(run => run.text));
    }
  }
  for (const zone of PLAQUE_ZONES) {
    for (const lang of [null, ...plaqueLanguages()]) {
      const name = homecomingCityName([{ repo: 'a', zone: zone || 'library', lang }], 'octo');
      texts.push(name.en, name.ko);
    }
  }
  texts.push(...GENERIC_CARD_RUNS.map(run => run.text));
  return texts;
}

/* The sorted, de-duplicated character set. */
export function cardVocabulary() {
  const chars = new Set();
  for (let code = 0x20; code <= 0x7e; code++) chars.add(String.fromCharCode(code));
  for (const char of CARD_SYMBOLS) chars.add(char);
  for (const text of cardTexts()) for (const char of text.normalize('NFC')) chars.add(char);
  return [...chars].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const chars = cardVocabulary();
  console.log(JSON.stringify({ chars, count: [...chars].length }));
}
