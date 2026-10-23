/* cloudflare-card/src/generic-card.js — the plain Repolis card, used whenever a town card cannot be drawn.
 *
 * It carries no user data. scripts/build-generic-card.mjs renders it once to src/generic-card.png, and the Worker
 * returns those bytes for an unknown login, an empty town, a GitHub, KV or render failure and a rate-limited request,
 * so a fallback never costs a render. The tones match the city card in assets/city-card.js.
 */
import { CITY_CARD_ZONE_COLORS } from '../../assets/city-card.js';

const INK = Object.freeze({ skyTop: '#0f1b29', skyLow: '#233a52', ground: '#0b131c', accent: '#f2b84b', name: '#fff6e3', text: '#ddd2bd', lamp: '#ffd98a' });

const run = fields => Object.freeze({ anchor: 'start', spacing: 0, opacity: 1, maxWidth: 1072, ...fields });

/* The generic card's text, placed on the same 1200×630 frame as the city card. */
export const GENERIC_CARD_RUNS = Object.freeze([
  run({ role: 'kicker', text: 'REPOLIS', x: 64, y: 92, size: 24, weight: 700, fill: INK.accent, spacing: 4 }),
  run({ role: 'name', text: 'The City of Repos', x: 64, y: 168, size: 60, weight: 800, fill: INK.name }),
  run({ role: 'stats', text: 'Public GitHub repositories become a town you can walk.', x: 64, y: 220, size: 28, weight: 500, fill: INK.text }),
]);

const num = value => String(Math.round(value * 10) / 10);

/* A fixed skyline: 49 houses in seven district tones, heights from a fixed sequence. */
function skyline() {
  const zones = Object.keys(CITY_CARD_ZONE_COLORS);
  const base = 578, width = 16, gap = 4, zoneGap = 14, perZone = 7;
  const span = zones.length * perZone * (width + gap) - gap * zones.length + zoneGap * (zones.length - 1);
  let x = (1200 - span) / 2;
  const paths = [], windows = [];
  zones.forEach((zone, z) => {
    const houses = [];
    for (let i = 0; i < perZone; i++) {
      const n = z * perZone + i;
      const height = 30 + ((n * 53 + 17) % 97);
      const top = base - height, roof = width * 0.5, eave = width * 0.08;
      houses.push(`M${num(x)} ${base}V${num(top)}H${num(x - eave)}L${num(x + width / 2)} ${num(top - roof)}L${num(x + width + eave)} ${num(top)}`
        + `H${num(x + width)}V${base}Z`);
      windows.push(`M${num(x + width * 0.32)} ${num(top + height * 0.22)}h${num(width * 0.36)}v${num(Math.min(width * 0.42, height * 0.3))}`
        + `h${num(-width * 0.36)}Z`);
      x += width + gap;
    }
    x += zoneGap - gap;
    paths.push(`<path d="${houses.join('')}" fill="${CITY_CARD_ZONE_COLORS[zone]}"/>`);
  });
  return paths.join('') + `<path d="${windows.join('')}" fill="${INK.lamp}" opacity="0.9"/>`;
}

/* The generic card as a 1200×630 SVG document; `drawText` turns GENERIC_CARD_RUNS into markup. */
export function genericCardSvg(drawText) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" '
    + 'aria-label="Repolis — the City of Repos"><title>Repolis — the City of Repos</title>'
    + `<defs><linearGradient id="generic-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${INK.skyTop}"/>`
    + `<stop offset="1" stop-color="${INK.skyLow}"/></linearGradient></defs>`
    + '<rect width="1200" height="630" fill="url(#generic-sky)"/>'
    + `<rect y="578" width="1200" height="52" fill="${INK.ground}"/>`
    + skyline()
    + `<rect x="20" y="20" width="1160" height="590" rx="22" fill="none" stroke="${INK.accent}" stroke-opacity="0.35" stroke-width="2"/>`
    + drawText(GENERIC_CARD_RUNS)
    + '</svg>';
}
