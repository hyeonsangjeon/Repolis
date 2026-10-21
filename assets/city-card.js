/* assets/city-card.js — a shareable card for one public town, drawn as an SVG string.
 *
 * summarizeCityCard turns a public repository array into the few facts a card shows; cityCardSvg draws
 * them with a city name the caller supplies (the city plaque rule names cities, not this file). The same
 * input always gives the same bytes. Nothing here reads the DOM, storage, network, the wall clock or a
 * random source, and private repositories, e-mail addresses and avatars are never read or drawn.
 * Repository names are drawn as GitHub-style ASCII slugs and every caller string is cut to a UTF-8 byte cap.
 */
import { ZONE_IDS, classifyRepoZone } from './zone-classifier.js';
import { homecomingPrimaryLanguage } from './homecoming.js';

export const CITY_CARD_LIMITS = Object.freeze({
  maxRepos: 100,
  topHouses: 3,
  cityNameBytes: 96,
  repoNameBytes: 40,
  languageBytes: 32,
});

export const CITY_CARD_SIZES = Object.freeze({
  og: Object.freeze({ id: 'og', width: 1200, height: 630 }),
  readme: Object.freeze({ id: 'readme', width: 600, height: 300 }),
});

/* The town's district tones (ZONE_CAT in index.html); scripts/smoke.mjs keeps the two in step. */
export const CITY_CARD_ZONE_COLORS = Object.freeze({
  ai: '#6aa6de', infra: '#4fb0a6', web: '#e0a94a', data: '#b072d6', library: '#66c48a', ruins: '#9a8f7e', commons: '#b6a98f',
});

const COPY = Object.freeze({
  en: Object.freeze({
    kicker: 'GITHUB TOWN', top: 'MOST-STARRED HOUSES', tracking: 4, fallbackName: 'A GitHub town', empty: 'No public repositories yet',
    repos: (n, more) => `${n}${more ? '+' : ''} ${n === 1 && !more ? 'repo' : 'repos'}`, since: year => `since ${year}`,
    archived: (n, all) => (all ? 'all archived' : `${n} archived`),
    zones: Object.freeze({ ai: 'AI', infra: 'Infra', web: 'Web', data: 'Data', library: 'Library', ruins: 'Archive', commons: 'Commons' }),
  }),
  ko: Object.freeze({
    kicker: '깃허브 마을', top: '별이 많은 집', tracking: 1, fallbackName: '깃허브 마을', empty: '아직 공개 레포가 없어요',
    repos: (n, more) => (more ? `레포 ${n}개 이상` : `레포 ${n}개`), since: year => `${year}년부터`,
    archived: (n, all) => (all ? '모두 보관됨' : `보관 ${n}개`),
    zones: Object.freeze({ ai: 'AI', infra: '인프라', web: '웹', data: '데이터', library: '학습관', ruins: '실험·기록', commons: '커먼즈' }),
  }),
});

/* Layout in viewBox units; the README card is laid out on 1200×600 and shown at 600×300. */
const FRAMES = Object.freeze({
  og: Object.freeze({
    width: 1200, height: 630, pad: 64,
    kicker: { y: 92, size: 24 }, name: { y: 168, size: 60, min: 34 }, stats: { y: 220, size: 28 },
    bar: { y: 268, width: 556, height: 12 }, legend: { y: 318, size: 22, gap: 36, right: 620, rows: 3 },
    top: { x: 660, y: 278, size: 20, rowY: 322, rowSize: 26, rowGap: 42 },
    sky: { base: 578, min: 30, max: 130, house: 44 }, sign: { y: 612, size: 18 },
  }),
  readme: Object.freeze({
    width: 1200, height: 600, pad: 56,
    kicker: { y: 76, size: 26 }, name: { y: 150, size: 64, min: 36 }, stats: { y: 206, size: 32 },
    bar: { y: 248, width: 544, height: 14 }, legend: { y: 300, size: 26, gap: 40, right: 600, rows: 3 },
    top: { x: 640, y: 260, size: 24, rowY: 306, rowSize: 30, rowGap: 44 },
    sky: { base: 548, min: 28, max: 118, house: 44 }, sign: { y: 584, size: 22 },
  }),
});

const INK = Object.freeze({
  skyTop: '#0f1b29', skyLow: '#233a52', ground: '#0b131c', accent: '#f2b84b',
  name: '#fff6e3', text: '#ddd2bd', lamp: '#ffd98a', track: '#2c4157',
});
const FONT = "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";

function count(value) {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function utf8Bytes(text) {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const INVISIBLE = /[\u061c\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff\ufff9-\ufffb\ufffe\uffff]/;
const DANGLING = /[\s\u200c\u200d\ufe0e\ufe0f\u0300-\u036f]+$/u;

/* Keep whole code points while the UTF-8 length stays within `maxBytes`, ending a cut with '…'. */
function capBytes(text, maxBytes) {
  if (utf8Bytes(text) <= maxBytes) return text;
  let kept = '';
  for (const char of text) {
    if (utf8Bytes(kept + char) > maxBytes - 3) break;
    kept += char;
  }
  return kept.replace(DANGLING, '') + '…';
}

/* A caller label without control, bidi or invisible format characters, lone surrogates or runs of spaces.
 * Only the first maxBytes × 4 code units are read, so a huge string costs no more than a long one. */
function cleanLabel(value, maxBytes) {
  if (typeof value !== 'string') return '';
  let out = '';
  for (const char of value.slice(0, maxBytes * 4).normalize('NFC')) {
    const code = char.charCodeAt(0);
    if (char.length === 1 && code >= 0xd800 && code <= 0xdfff) continue;
    out += CONTROL.test(char) ? ' ' : INVISIBLE.test(char) ? '' : char;
  }
  return capBytes(out.replace(/\s+/g, ' ').trim(), maxBytes);
}

/* GitHub keeps repository names to [A-Za-z0-9._-]; anything else (Hangul, emoji, controls) becomes '-'. */
export function cityCardRepoSlug(value) {
  const slug = (typeof value === 'string' ? value.slice(0, CITY_CARD_LIMITS.repoNameBytes * 4) : '').normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return capBytes(slug || 'repo', CITY_CARD_LIMITS.repoNameBytes);
}

/* A name already in card form (a slug, perhaps cut with '…') is kept, so a cached summary draws the same. */
function cardName(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]+…?$/.test(value) && utf8Bytes(value) <= CITY_CARD_LIMITS.repoNameBytes
    ? value : cityCardRepoSlug(value);
}

function missingLanguage(value) {
  const lang = cleanLabel(value, CITY_CARD_LIMITS.languageBytes);
  return !lang || lang === '—' || lang === '-' || lang.toLowerCase() === 'null' || lang.toLowerCase() === 'other';
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/* Whole-number shares that add up to 100 (largest remainder, ties in catalog order). */
function percents(rows, total) {
  if (!total) return rows.map(() => 0);
  const raw = rows.map(row => (row.count * 100) / total);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((sum, n) => sum + n, 0);
  const order = raw.map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) { if (left <= 0) break; out[index]++; left--; }
  return out;
}

const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/* Card facts for one town from the first `maxRepos` unique, named, non-private, non-landmark repositories in
 * the caller's order. `referenceTimestamp` is the town's reference time for the district rule, and `partial`
 * marks a list the caller knows is incomplete. The primary language comes from the city plaque's own rule
 * (homecomingPrimaryLanguage), so a card never names a different language than the plaque. */
export function summarizeCityCard(repositories = [], { referenceTimestamp = NaN, partial = false } = {}) {
  const seen = new Set();
  const pool = [];
  let more = false;
  for (const repo of Array.isArray(repositories) ? repositories : []) {
    if (!repo || typeof repo !== 'object' || repo.private === true || repo.landmark || repo._landmark || repo._isLibrary) continue;
    const key = typeof repo.repo === 'string' ? repo.repo.trim().toLowerCase() : '';
    if (!key || seen.has(key)) continue;
    if (pool.length === CITY_CARD_LIMITS.maxRepos) { more = true; break; }
    seen.add(key);
    pool.push(repo);
  }

  const zoneCounts = new Map(ZONE_IDS.map(id => [id, 0]));
  const houses = [];
  let stars = 0, archived = 0, first = null;
  for (const repo of pool) {
    const n = count(repo.stars);
    const zone = classifyRepoZone(repo, referenceTimestamp);
    const created = typeof repo.created === 'string' ? Date.parse(repo.created) : NaN;
    stars += n;
    if (repo.archived === true) archived++;
    zoneCounts.set(zone, zoneCounts.get(zone) + 1);
    if (Number.isFinite(created) && (first === null || created < first)) first = created;
    houses.push({ key: repo.repo.trim(), name: cityCardRepoSlug(repo.repo), stars: n, zone, archived: repo.archived === true });
  }

  const primary = homecomingPrimaryLanguage(pool);
  const zoneRows = ZONE_IDS.map(id => ({ id, count: zoneCounts.get(id) })).filter(row => row.count > 0);
  const shares = percents(zoneRows, pool.length);
  const top = houses.slice()
    .sort((a, b) => b.stars - a.stars || byCodePoint(a.key.toLowerCase(), b.key.toLowerCase()) || byCodePoint(a.key, b.key))
    .slice(0, CITY_CARD_LIMITS.topHouses)
    .map(({ name, stars: n, zone }) => ({ name, stars: n, zone }));
  const skyline = houses
    .map(({ zone, stars: n, archived: quiet }) => ({ zone, stars: n, archived: quiet }))
    .sort((a, b) => ZONE_IDS.indexOf(a.zone) - ZONE_IDS.indexOf(b.zone) || b.stars - a.stars || Number(a.archived) - Number(b.archived));

  return deepFreeze({
    repos: pool.length,
    truncated: more || partial === true,
    stars,
    archived,
    language: (primary && cleanLabel(primary.lang, CITY_CARD_LIMITS.languageBytes)) || null,
    firstYear: first === null ? null : new Date(first).getUTCFullYear(),
    zones: zoneRows.map((row, index) => ({ id: row.id, count: row.count, percent: shares[index] })),
    top,
    skyline,
  });
}

/* Re-reads a summary (it may come back from a cache) so drawing never trusts its shape. */
function readSummary(summary) {
  const s = summary && typeof summary === 'object' ? summary : {};
  const zone = id => (ZONE_IDS.includes(id) ? id : 'commons');
  const list = (value, cap) => (Array.isArray(value) ? value.slice(0, cap).filter(item => item && typeof item === 'object') : []);
  const year = Number(s.firstYear);
  return {
    repos: Math.min(count(s.repos), CITY_CARD_LIMITS.maxRepos),
    truncated: s.truncated === true,
    stars: count(s.stars),
    archived: count(s.archived),
    language: missingLanguage(s.language) ? null : cleanLabel(s.language, CITY_CARD_LIMITS.languageBytes),
    firstYear: Number.isInteger(year) && year >= 1970 && year <= 9999 ? year : null,
    zones: list(s.zones, ZONE_IDS.length).map(row => ({ id: zone(row.id), count: count(row.count), percent: Math.min(100, count(row.percent)) })),
    top: list(s.top, CITY_CARD_LIMITS.topHouses).map(row => ({ name: cardName(row.name), stars: count(row.stars), zone: zone(row.zone) })),
    skyline: list(s.skyline, CITY_CARD_LIMITS.maxRepos).map(row => ({ zone: zone(row.zone), stars: count(row.stars), archived: row.archived === true })),
  };
}

function grouped(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/* Approximate advance widths in em for a generic sans face, slightly generous so text never overflows. A glyph
 * layer with real font metrics would replace this estimate. */
export function cityCardTextWidth(text, size, weight = 400) {
  let em = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    if (/[\u0300-\u036f\u200c\u200d\ufe0e\ufe0f]/.test(char)) continue;
    if (char === ' ') em += 0.28;
    else if (/[il|!.,:;'`]/.test(char)) em += 0.27;
    else if (/[fjrtI()[\]{}\-·]/.test(char)) em += 0.36;
    else if (/[mwMW@%★]/.test(char)) em += 0.88;
    else if (/[0-9]/.test(char)) em += 0.58;
    else if (/[a-z]/.test(char)) em += 0.55;
    else if (/[A-Z]/.test(char)) em += 0.68;
    else if (code < 0x2e80) em += 0.62;
    else if (code < 0x10000) em += 1.0;
    else em += 1.25;
  }
  return em * size * (weight >= 700 ? 1.07 : 1);
}

/* Shrink from `size` toward `min`, then end with '…' until the estimated width fits. */
function fitText(text, maxWidth, size, min, weight) {
  let fontSize = size;
  while (fontSize > min && cityCardTextWidth(text, fontSize, weight) > maxWidth) fontSize = Math.max(min, fontSize - 2);
  if (cityCardTextWidth(text, fontSize, weight) <= maxWidth) return { text, size: fontSize };
  const chars = Array.from(text);
  while (chars.length && cityCardTextWidth(chars.join('').replace(DANGLING, '') + '…', fontSize, weight) > maxWidth) chars.pop();
  return { text: chars.join('').replace(DANGLING, '') + '…', size: fontSize };
}

/* Legend items flow left to right and wrap; an item that would open a row past the last one is left out. */
function legendSlots(frame, zones, copy) {
  const { y, size, gap, right, rows } = frame.legend;
  const slots = [];
  let x = frame.pad, row = 0;
  for (const zone of zones) {
    const text = `${copy.zones[zone.id]} ${zone.percent}%`;
    const width = size + 10 + cityCardTextWidth(text, size, 500);
    if (x > frame.pad && x + width > right) { x = frame.pad; row++; }
    if (row >= rows) break;
    slots.push({ zone, text, x, y: y + row * gap, size });
    x += width + 24;
  }
  return slots;
}

function topSlots(frame, top) {
  const { x, rowY, rowSize, rowGap } = frame.top;
  return top.map((house, index) => ({ house, x, y: rowY + index * rowGap, size: rowSize }));
}

/* Every string on the card with its position, size and color. This is the one place that places text; a
 * later glyph-path layer keeps these runs and replaces only textMarkup. */
export function cityCardTextRuns(summary, cityName, { size = 'og', lang = 'en' } = {}) {
  const frame = FRAMES[size] || FRAMES.og;
  const copy = COPY[lang] || COPY.en;
  const s = readSummary(summary);
  const right = frame.width - frame.pad, wide = right - frame.pad;
  const runs = [];
  const add = (run, maxWidth, min = run.size) => {
    const fitted = fitText(run.text, maxWidth, run.size, min, run.weight);
    runs.push(Object.freeze({ anchor: 'start', spacing: 0, opacity: 1, ...run, text: fitted.text, size: fitted.size, maxWidth }));
  };

  add({ role: 'kicker', text: copy.kicker, x: frame.pad, y: frame.kicker.y, size: frame.kicker.size, weight: 700, fill: INK.accent,
    spacing: copy.tracking }, wide);
  const name = cleanLabel(cityName, CITY_CARD_LIMITS.cityNameBytes) || copy.fallbackName;
  add({ role: 'name', text: name, x: frame.pad, y: frame.name.y, size: frame.name.size, weight: 800, fill: INK.name }, wide, frame.name.min);

  const more = s.truncated ? '+' : '';
  const facts = s.repos
    ? [copy.repos(s.repos, s.truncated), `★ ${grouped(s.stars)}${more}`, s.language, s.firstYear && copy.since(s.firstYear),
      s.archived && copy.archived(s.archived, s.archived === s.repos && !s.truncated)].filter(Boolean)
    : [copy.empty];
  add({ role: 'stats', text: facts.join(' · '), x: frame.pad, y: frame.stats.y, size: frame.stats.size, weight: 500, fill: INK.text },
    wide, frame.stats.size - 6);

  for (const slot of legendSlots(frame, s.zones, copy)) {
    add({ role: 'legend', text: slot.text, x: slot.x + slot.size + 10, y: slot.y, size: slot.size, weight: 500, fill: INK.text },
      frame.legend.right - slot.x - slot.size - 10);
  }

  if (s.top.length) {
    const { x, y, size: headSize } = frame.top;
    add({ role: 'top-heading', text: copy.top, x, y, size: headSize, weight: 700, fill: INK.accent, spacing: copy.tracking - 1 }, right - x);
    for (const slot of topSlots(frame, s.top)) {
      const stars = `★ ${grouped(slot.house.stars)}`;
      const starsWidth = cityCardTextWidth(stars, slot.size, 600);
      add({ role: 'top-stars', text: stars, x: right, y: slot.y, size: slot.size, weight: 600, fill: INK.accent, anchor: 'end' }, starsWidth);
      add({ role: 'top-name', text: slot.house.name, x: slot.x + 24, y: slot.y, size: slot.size, weight: 600, fill: INK.name },
        right - starsWidth - 18 - (slot.x + 24));
    }
  }

  add({ role: 'sign', text: 'Repolis', x: right, y: frame.sign.y, size: frame.sign.size, weight: 700, fill: INK.accent, anchor: 'end',
    opacity: 0.85 }, wide);
  return Object.freeze(runs);
}

function esc(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function num(value) {
  const n = Math.round(value * 10) / 10;
  return String(Object.is(n, -0) ? 0 : n);
}

/* The only place text runs become SVG markup. */
function textMarkup(runs) {
  return runs.map(run => `<text x="${num(run.x)}" y="${num(run.y)}" font-size="${num(run.size)}" font-weight="${run.weight}" fill="${run.fill}"`
    + (run.anchor !== 'start' ? ` text-anchor="${run.anchor}"` : '')
    + (run.spacing ? ` letter-spacing="${num(run.spacing)}"` : '')
    + (run.opacity !== 1 ? ` opacity="${num(run.opacity)}"` : '')
    + `>${esc(run.text)}</text>`).join('');
}

/* One house per repository, grouped by district in catalog order. Each district rises toward its middle,
 * heights follow stars on a log scale, and archived houses are drawn faded without a lit window. */
function skylineMarkup(frame, skyline) {
  if (!skyline.length) return '';
  const { base, min, max, house: maxWidth } = frame.sky;
  const span = frame.width - frame.pad * 2;
  const groups = [];
  for (const house of skyline) {
    if (!groups.length || groups[groups.length - 1].zone !== house.zone) groups.push({ zone: house.zone, houses: [] });
    groups[groups.length - 1].houses.push(house);
  }
  const gap = 4, zoneGap = 14, n = skyline.length;
  const gaps = gap * (n - groups.length) + zoneGap * (groups.length - 1);
  const width = Math.min(maxWidth, (span - gaps) / n);
  const peak = Math.max(...skyline.map(house => house.stars));
  const height = stars => min + (peak > 0 ? ((max - min) * Math.log1p(stars)) / Math.log1p(peak) : 0);
  let x = frame.pad + (span - width * n - gaps) / 2;
  const paths = [], windows = [];
  for (const group of groups) {
    const row = [];
    group.houses.forEach((house, index) => (index % 2 ? row.unshift(house) : row.push(house)));
    const lit = [], faded = [];
    for (const house of row) {
      const top = base - height(house.stars), roof = Math.max(3, width * 0.5), eave = width * 0.08;
      (house.archived ? faded : lit).push(`M${num(x)} ${num(base)}V${num(top)}H${num(x - eave)}L${num(x + width / 2)} ${num(top - roof)}`
        + `L${num(x + width + eave)} ${num(top)}H${num(x + width)}V${num(base)}Z`);
      if (!house.archived && width >= 6) {
        const w = width * 0.36, h = Math.min(width * 0.42, (base - top) * 0.3);
        windows.push(`M${num(x + (width - w) / 2)} ${num(top + (base - top) * 0.22)}h${num(w)}v${num(h)}h${num(-w)}Z`);
      }
      x += width + gap;
    }
    x += zoneGap - gap;
    const color = CITY_CARD_ZONE_COLORS[group.zone];
    if (lit.length) paths.push(`<path d="${lit.join('')}" fill="${color}"/>`);
    if (faded.length) paths.push(`<path d="${faded.join('')}" fill="${color}" opacity="0.4"/>`);
  }
  if (windows.length) paths.push(`<path d="${windows.join('')}" fill="${INK.lamp}" opacity="0.9"/>`);
  return paths.join('');
}

/* The card as a standalone SVG document. `size` is 'og' (1200×630) or 'readme' (600×300); `lang` is 'en' or 'ko'.
 * `drawText` turns the placed runs into markup; the default writes <text> elements, and the city-card Worker passes
 * a glyph-path writer so its PNG renderer needs no font. */
export function cityCardSvg(summary, cityName, { size = 'og', lang = 'en', drawText = textMarkup } = {}) {
  const id = CITY_CARD_SIZES[size] ? size : 'og';
  const frame = FRAMES[id], shown = CITY_CARD_SIZES[id];
  const copy = COPY[lang] || COPY.en;
  const s = readSummary(summary);
  const runs = cityCardTextRuns(summary, cityName, { size: id, lang });
  const label = runs.filter(run => run.role === 'name' || run.role === 'stats').map(run => run.text).join(' — ');
  const { y: barY, width: barW, height: barH } = frame.bar;
  let barX = frame.pad;
  const bar = s.zones.map(zone => {
    const w = s.repos ? (barW * zone.count) / s.repos : 0;
    const rect = `<rect x="${num(barX)}" y="${barY}" width="${num(w)}" height="${barH}" fill="${CITY_CARD_ZONE_COLORS[zone.id]}"/>`;
    barX += w;
    return rect;
  }).join('');
  const swatches = legendSlots(frame, s.zones, copy).map(slot => `<rect x="${num(slot.x)}" y="${num(slot.y - slot.size * 0.78)}" `
    + `width="${slot.size}" height="${slot.size}" rx="4" fill="${CITY_CARD_ZONE_COLORS[slot.zone.id]}"/>`).join('');
  const bullets = topSlots(frame, s.top).map(slot => `<circle cx="${num(slot.x + 7)}" cy="${num(slot.y - slot.size * 0.34)}" r="7" `
    + `fill="${CITY_CARD_ZONE_COLORS[slot.house.zone]}"/>`).join('');
  const sky = `card-sky-${id}`, clip = `card-bar-${id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${shown.width}" height="${shown.height}" viewBox="0 0 ${frame.width} ${frame.height}" `
    + `role="img" aria-label="${esc(label)}" font-family="${esc(FONT)}"><title>${esc(label)}</title>`
    + `<defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK.skyTop}"/>`
    + `<stop offset="1" stop-color="${INK.skyLow}"/></linearGradient>`
    + `<clipPath id="${clip}"><rect x="${frame.pad}" y="${barY}" width="${barW}" height="${barH}" rx="${num(barH / 2)}"/></clipPath></defs>`
    + `<rect width="${frame.width}" height="${frame.height}" fill="url(#${sky})"/>`
    + `<rect y="${frame.sky.base}" width="${frame.width}" height="${frame.height - frame.sky.base}" fill="${INK.ground}"/>`
    + skylineMarkup(frame, s.skyline)
    + `<rect x="20" y="20" width="${frame.width - 40}" height="${frame.height - 40}" rx="22" fill="none" stroke="${INK.accent}" `
    + 'stroke-opacity="0.35" stroke-width="2"/>'
    + (s.zones.length ? `<rect x="${frame.pad}" y="${barY}" width="${barW}" height="${barH}" rx="${num(barH / 2)}" fill="${INK.track}"/>`
      + `<g clip-path="url(#${clip})">${bar}</g>` : '')
    + swatches + bullets + drawText(runs)
    + '</svg>';
}
