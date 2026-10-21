/* cloudflare-card/src/worker.js — the routes of the repolis-card Worker.
 *
 *   GET /u/<login>          200 HTML: the city card as Open Graph tags, then on to <SITE_URL>?user=<login>&ref=card
 *   GET /card/<login>.png   1200×630 PNG city card, kept 24 h in the Cache API; the only query read is d=YYYYMMDD
 *   GET /card/<login>.svg   600×300 SVG city card for profile READMEs; assets/banner.svg on any failure
 *   anything else           404 HTML with the plain Repolis preview
 *
 * `lang=ko` on any of the three asks for the Korean card. A login must match the town's GitHub login rule. GitHub is
 * asked at most once per login a day: KV keeps the card summary (card:v1:<login>) for 24 h, and an empty summary for
 * an unknown login, an empty town or a GitHub failure for 1 h; the raw response is never stored. New renders are rate
 * limited per address, log lines carry neither a login nor an address, and a GitHub, KV, rate-limit or renderer failure
 * still answers 200 with the plain card. This module imports no npm package: src/index.js supplies the PNG renderer
 * and the bundled files, so scripts/test-city-card-worker.mjs runs it on Node alone.
 */
import { cityCardSvg, cityCardTextRuns } from '../../assets/city-card.js';
import { createGlyphText } from './glyph-text.js';
import { allowRender, createWindowLimiter } from './rate-limit.js';
import { notFoundPage, sharePage, siteUrl } from './share-page.js';
import {
  EMPTY_CARD_SUMMARY, cardCityName, cardDay, fetchTownCard, isTownSummary, normalizeCardDay, validLogin,
} from './town-card.js';

/* Seconds: a card (KV summary, PNG, SVG), an empty or failed town, and a share page. */
export const CARD_TTL = Object.freeze({ card: 86400, empty: 3600, page: 300 });

const ROUTE = /^\/(?:u\/([^/]+)|card\/([^/]+)\.(png|svg))$/;
/* Plain answers that may change on the next request are not cacheable; the others last as long as KV's empty summary. */
const TRANSIENT = new Set(['limited', 'kv', 'render', 'error']);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BASE_HEADERS = Object.freeze({ 'x-content-type-options': 'nosniff' });
const HTML_HEADERS = Object.freeze({
  ...BASE_HEADERS,
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; "
    + "form-action 'none'; frame-ancestors 'none'",
});
const PNG_HEADERS = Object.freeze({ ...BASE_HEADERS, 'content-type': 'image/png', 'access-control-allow-origin': '*' });
const SVG_HEADERS = Object.freeze({
  ...BASE_HEADERS,
  'content-type': 'image/svg+xml; charset=utf-8',
  'access-control-allow-origin': '*',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
});

export function cardKvKey(login) {
  return `card:v1:${login.toLowerCase()}`;
}

/* { kind: 'share' | 'png' | 'svg', login } for the three routes, otherwise null. The login is not validated here. */
export function parseCardRoute(pathname) {
  const match = ROUTE.exec(pathname);
  if (!match) return null;
  return match[1] !== undefined ? { kind: 'share', login: match[1] } : { kind: match[3], login: match[2] };
}

function toBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

function isPng(bytes) {
  return bytes instanceof Uint8Array && bytes.byteLength > PNG_SIGNATURE.length && PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function respond(body, status, headers, method) {
  return new Response(method === 'HEAD' ? null : body, { status, headers });
}

export function createCardWorker({
  renderPng,
  glyphs,
  bannerSvg,
  genericPng,
  fetchImpl = (input, init) => fetch(input, init),
  cache,
  now = () => Date.now(),
  log = entry => console.log(JSON.stringify(entry)),
} = {}) {
  const plainPng = toBytes(genericPng);
  if (!isPng(plainPng)) throw new TypeError('createCardWorker needs the generic card PNG');
  if (typeof bannerSvg !== 'string' || !bannerSvg.includes('<svg')) throw new TypeError('createCardWorker needs assets/banner.svg');
  let glyphText = null;
  try { glyphText = createGlyphText(glyphs); } catch (error) { glyphText = null; }
  const limiter = createWindowLimiter();
  const cacheStore = () => (cache !== undefined ? cache : (globalThis.caches && globalThis.caches.default) || null);

  /* One aggregate line per request: route, result and why. Never a login, an address or a URL. */
  function note(route, result, reason) {
    try { log(reason ? { evt: 'card', route, result, reason } : { evt: 'card', route, result }); } catch (error) { /* logging is optional */ }
  }

  function later(ctx, promise) {
    try { ctx.waitUntil(promise); } catch (error) { /* the response does not depend on it */ }
  }

  /* What KV knows: { state: 'ready', summary } | { state: 'none', reason } | { state: 'miss' } | { state: 'error', reason }. */
  async function readTown(login, env) {
    const kv = env.CARD_KV;
    if (!kv || typeof kv.get !== 'function') return { state: 'error', reason: 'kv' };
    let text;
    try { text = await kv.get(cardKvKey(login)); } catch (error) { return { state: 'error', reason: 'kv' }; }
    if (text === null || text === undefined) return { state: 'miss' };
    let stored;
    try { stored = JSON.parse(text); } catch (error) { return { state: 'miss' }; }
    return isTownSummary(stored) ? { state: 'ready', summary: stored } : { state: 'none', reason: 'empty-cached' };
  }

  /* One GitHub request; KV keeps only the card summary (an empty one for a failure) for 24 h or 1 h. */
  async function fetchTown(login, env, ctx) {
    const result = await fetchTownCard(login, { token: env.GITHUB_TOKEN, fetchImpl });
    if (result.tokenRejected) note('github', 'token-rejected');
    const ready = isTownSummary(result.summary);
    const summary = ready ? result.summary : EMPTY_CARD_SUMMARY;
    try {
      const write = Promise.resolve(env.CARD_KV.put(cardKvKey(login), JSON.stringify(summary),
        { expirationTtl: ready ? CARD_TTL.card : CARD_TTL.empty })).catch(() => note('kv', 'write-failed'));
      later(ctx, write);
    } catch (error) {
      note('kv', 'write-failed');
    }
    return ready ? { state: 'ready', summary } : { state: 'none', reason: result.failure || 'empty' };
  }

  /* KV first; a login KV has never seen costs one render from the address's per-minute allowance. */
  async function loadTown(login, env, ctx, address) {
    const town = await readTown(login, env);
    if (town.state !== 'miss') return town;
    if (!(await allowRender(env, address, limiter, now()))) return { state: 'limited', reason: 'limited' };
    return fetchTown(login, env, ctx);
  }

  /* The OG card SVG with glyph-path text. A Korean card whose text leaves the glyph vocabulary is drawn in English. */
  function cardPngSvg(summary, login, lang) {
    const names = cardCityName(summary, login);
    const ko = lang === 'ko' && glyphText.covers(cityCardTextRuns(summary, names.ko, { size: 'og', lang: 'ko' }));
    return cityCardSvg(summary, ko ? names.ko : names.en, { size: 'og', lang: ko ? 'ko' : 'en', drawText: glyphText.drawText });
  }

  function plainPngResponse(method, reason) {
    note('png', 'plain', reason);
    return respond(plainPng, 200, { ...PNG_HEADERS, 'cache-control': TRANSIENT.has(reason) ? 'no-store' : `public, max-age=${CARD_TTL.empty}` }, method);
  }

  function bannerResponse(method, reason) {
    note('svg', 'plain', reason);
    return respond(bannerSvg, 200, { ...SVG_HEADERS, 'cache-control': TRANSIENT.has(reason) ? 'no-store' : `max-age=${CARD_TTL.empty}` }, method);
  }

  function plainSharePage(method, { url, login, lang, site }, reason) {
    note('share', 'plain', reason);
    let body;
    try { body = sharePage({ origin: url.origin, login, lang, site, card: null }); } catch (error) { body = notFoundPage({ site, lang }); }
    return respond(body, 200, { ...HTML_HEADERS, 'cache-control': TRANSIENT.has(reason) ? 'no-store' : `public, max-age=${CARD_TTL.page}` }, method);
  }

  async function share(request, page, env, ctx, address) {
    const town = await loadTown(page.login, env, ctx, address);
    if (town.state !== 'ready') return plainSharePage(request.method, page, town.reason);
    const names = cardCityName(town.summary, page.login);
    const name = page.lang === 'ko' ? names.ko : names.en;
    const stats = cityCardTextRuns(town.summary, name, { size: 'og', lang: page.lang }).find(run => run.role === 'stats');
    const image = `${page.url.origin}/card/${page.login}.png?d=${cardDay(now())}${page.lang === 'ko' ? '&lang=ko' : ''}`;
    const body = sharePage({ origin: page.url.origin, login: page.login, lang: page.lang, site: page.site,
      card: { name, stats: stats ? stats.text : '', image } });
    note('share', 'card');
    return respond(body, 200, { ...HTML_HEADERS, 'cache-control': `public, max-age=${CARD_TTL.page}` }, request.method);
  }

  async function png(request, page, env, ctx, address) {
    const day = normalizeCardDay(page.url.searchParams.get('d'), now());
    const key = new Request(`${page.url.origin}/card/${page.login}.png?d=${day}${page.lang === 'ko' ? '&lang=ko' : ''}`);
    const store = cacheStore();
    if (store) {
      try {
        const hit = await store.match(key);
        if (hit) {
          note('png', 'cache');
          return request.method === 'HEAD' ? new Response(null, { status: hit.status, headers: hit.headers }) : hit;
        }
      } catch (error) { /* treated as a miss */ }
    }
    let town = await readTown(page.login, env);
    if (town.state === 'none' || town.state === 'error') return plainPngResponse(request.method, town.reason);
    if (!(await allowRender(env, address, limiter, now()))) return plainPngResponse(request.method, 'limited');
    if (town.state === 'miss') town = await fetchTown(page.login, env, ctx);
    if (town.state !== 'ready') return plainPngResponse(request.method, town.reason);
    if (!glyphText || typeof renderPng !== 'function') return plainPngResponse(request.method, 'render');
    let bytes;
    try { bytes = toBytes(await renderPng(cardPngSvg(town.summary, page.login, page.lang))); } catch (error) { bytes = null; }
    if (!isPng(bytes)) return plainPngResponse(request.method, 'render');
    const response = new Response(bytes, { status: 200,
      headers: { ...PNG_HEADERS, 'cache-control': `public, max-age=${CARD_TTL.card}, s-maxage=${CARD_TTL.card}` } });
    if (store) {
      try { later(ctx, Promise.resolve(store.put(key, response.clone())).catch(() => {})); } catch (error) { /* uncached */ }
    }
    note('png', 'card');
    return request.method === 'HEAD' ? new Response(null, { status: 200, headers: response.headers }) : response;
  }

  async function svg(request, page, env, ctx, address) {
    const town = await loadTown(page.login, env, ctx, address);
    if (town.state !== 'ready') return bannerResponse(request.method, town.reason);
    const names = cardCityName(town.summary, page.login);
    const body = cityCardSvg(town.summary, page.lang === 'ko' ? names.ko : names.en, { size: 'readme', lang: page.lang });
    note('svg', 'card');
    return respond(body, 200, { ...SVG_HEADERS, 'cache-control': `max-age=${CARD_TTL.card}` }, request.method);
  }

  async function handle(request, env, ctx) {
    const url = new URL(request.url);
    const route = parseCardRoute(url.pathname);
    const site = siteUrl(env.SITE_URL);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      note(route ? route.kind : 'other', 'method');
      return new Response('Method Not Allowed', { status: 405,
        headers: { ...BASE_HEADERS, allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' } });
    }
    const lang = url.searchParams.get('lang') === 'ko' ? 'ko' : 'en';
    if (!route || !validLogin(route.login)) {
      note(route ? route.kind : 'other', 'not-found');
      return respond(notFoundPage({ site, lang }), 404, { ...HTML_HEADERS, 'cache-control': `public, max-age=${CARD_TTL.empty}` },
        request.method);
    }
    const page = { url, login: route.login, lang, site };
    const address = `ip:${request.headers.get('cf-connecting-ip') || 'unknown'}`;
    try {
      if (route.kind === 'share') return await share(request, page, env, ctx, address);
      if (route.kind === 'png') return await png(request, page, env, ctx, address);
      return await svg(request, page, env, ctx, address);
    } catch (error) {
      if (route.kind === 'share') return plainSharePage(request.method, page, 'error');
      if (route.kind === 'png') return plainPngResponse(request.method, 'error');
      return bannerResponse(request.method, 'error');
    }
  }

  return Object.freeze({
    fetch(request, env, ctx) {
      return handle(request, env || {}, ctx && typeof ctx.waitUntil === 'function' ? ctx : { waitUntil() {} });
    },
  });
}
