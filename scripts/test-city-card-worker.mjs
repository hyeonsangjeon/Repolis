/* scripts/test-city-card-worker.mjs — hermetic checks for the repolis-card Worker (cloudflare-card/).
 *
 * Runs src/worker.js on Node alone with fake GitHub, KV, Cache API, rate-limit binding, renderer and clock: routing and
 * login rules, d= normalization, HTML and Open Graph escaping, cache and KV keys, KV holding only the card summary,
 * the 1 h negative cache, a 200 on every GitHub, KV, cache, rate-limit and render failure, the per-address render limit,
 * log lines without logins or addresses, the glyph vocabulary, and the deployment contract in wrangler.toml.
 * Zero network, wall clock or randomness; no npm install.
 *
 *   node scripts/test-city-card-worker.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createCardWorker, cardKvKey, parseCardRoute, CARD_TTL } from '../cloudflare-card/src/worker.js';
import {
  EMPTY_CARD_SUMMARY, TOWN_CARD_LIMITS, cardCityName, cardDay, fetchTownCard, isTownSummary, normalizeCardDay, townCardSummary,
  townRequestUrl, validLogin,
} from '../cloudflare-card/src/town-card.js';
import { SITE_PREVIEW, SITE_URL_DEFAULT, escapeHtml, sharePage, siteUrl, townUrl } from '../cloudflare-card/src/share-page.js';
import { RENDER_LIMIT, allowRender, createWindowLimiter } from '../cloudflare-card/src/rate-limit.js';
import { createGlyphText } from '../cloudflare-card/src/glyph-text.js';
import { GENERIC_CARD_RUNS, genericCardSvg } from '../cloudflare-card/src/generic-card.js';
import { cardTexts, cardVocabulary, plaqueLanguages } from '../cloudflare-card/scripts/card-vocabulary.mjs';
import { cityCardSvg, cityCardTextRuns, summarizeCityCard } from '../assets/city-card.js';
import { classifyRepoZone } from '../assets/zone-classifier.js';
import { homecomingCityName } from '../assets/homecoming.js';
import { projectPublicRepos } from '../assets/repo-portal.js';
import { projectPortableTown } from '../assets/world-tree/world-tree-state.js';
import { cityReferenceTimestamp } from '../assets/city-time.js';

const file = path => new URL(`../${path}`, import.meta.url);
const read = path => readFileSync(file(path), 'utf8');
const GLYPHS = JSON.parse(read('cloudflare-card/src/glyphs/noto-sans-kr.json'));
const BANNER = read('assets/banner.svg');
const GENERIC_PNG = new Uint8Array(readFileSync(file('cloudflare-card/src/generic-card.png')));
const RENDERED = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x52, 0x45, 0x4e, 0x44]);
const golden = JSON.parse(read('scripts/fixtures/zone-classifier-golden.json'));
const ORIGIN = 'https://repolis-card.example.workers.dev';
const NOW = Date.parse('2026-10-21T09:30:00Z');
const DAY = 86400000;
const ch = (...codes) => String.fromCodePoint(...codes);
let count = 0;
const check = (condition, message) => { assert(condition, message); count++; };

/* Every login and address used below; none may reach a log line. */
const LOGINS = ['octo-cat', 'Octo-Cat', 'ghost-user', 'empty-town', 'private-only', 'gh-error', 'gh-forbidden', 'net-fail', 'bad-json',
  'not-array', 'too-big', 'moved-user', 'slow-poke', 'kv-down', 'rate-a', 'rate-b', 'rate-c', 'rate-d', 'omega-lang', 'stream-big', 'old-token'];
const ADDRESSES = ['203.0.113.7', '198.51.100.23', '192.0.2.99'];
const consoleLines = [];
const consoleOriginals = {};
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  const original = consoleOriginals[level] = console[level];
  console[level] = (...args) => { consoleLines.push(args.map(String).join(' ')); if (level === 'error') original.apply(console, args); };
}

/* A public GitHub page for `login` in the raw /users/<login>/repos shape, built from the 71-repository fixture. */
const MARKER = 'DESCRIPTION-MARKER-7f3a';
function rawPage(login, rows = golden.repos) {
  return rows.map((repo, index) => ({
    id: 1000 + index, name: repo.repo, full_name: `${login}/${repo.repo}`, private: false, visibility: 'public',
    owner: { login, id: 77, avatar_url: 'https://avatars.githubusercontent.com/u/77?v=4', email: 'octo@example.com', type: 'User' },
    html_url: `https://github.com/${login}/${repo.repo}`, description: `${repo.desc || ''} ${MARKER}`, fork: false,
    homepage: '', language: repo.lang === 'Other' ? null : repo.lang, topics: repo.topics, stargazers_count: repo.stars,
    watchers_count: repo.stars, forks_count: index % 3, size: 100 + index, open_issues_count: index % 4, archived: index % 17 === 0,
    disabled: false, license: index % 2 ? { spdx_id: 'MIT' } : null, default_branch: 'main',
    created_at: `${2017 + (index % 9)}-0${1 + (index % 9)}-1${index % 9}T08:00:00Z`, pushed_at: repo.pushed || null,
    updated_at: repo.pushed || null,
  }));
}
const OCTO_PAGE = [...rawPage('octo-cat'), { ...rawPage('octo-cat', [{ repo: 'hidden-private-repo', stars: 999, pushed: '2026-10-01' }])[0], private: true }];

/* The town's own pipeline for a public login (index.html: projectPublicRepos → portable city state → zoneOf → plaque). */
function townPipeline(raw, login) {
  const repos = projectPublicRepos(raw.filter(row => row.private !== true), login);
  const town = projectPortableTown({ currentUser: login, repositories: repos, coverage: { partial: raw.length >= 100, error: null } });
  const reference = cityReferenceTimestamp(town.cityState, repos, NaN);
  const zoned = repos.map(repo => ({ repo: repo.repo, lang: repo.lang, zone: classifyRepoZone(repo, reference) }));
  return { repos, reference, name: homecomingCityName(zoned, login) };
}

// ── Fakes ───────────────────────────────────────────────────────────────────────
const clock = { now: NOW };
function fakeKv() {
  const store = new Map();
  const kv = {
    store, writes: [], reads: 0, failGet: false, failPut: false,
    async get(key) {
      kv.reads++;
      if (kv.failGet) throw new Error(`kv get failed for ${key}`);
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expires <= clock.now) { store.delete(key); return null; }
      return entry.value;
    },
    async put(key, value, options = {}) {
      if (kv.failPut) throw new Error(`kv put failed for ${key}`);
      kv.writes.push({ key, value, options });
      store.set(key, { value, expires: clock.now + (options.expirationTtl ?? 1e9) * 1000 });
    },
  };
  return kv;
}
function fakeCache() {
  const cache = {
    entries: new Map(), puts: [], matches: [], failMatch: false, failPut: false,
    async match(request) {
      cache.matches.push(request.url);
      if (cache.failMatch) throw new Error('cache down');
      const entry = cache.entries.get(request.url);
      return entry ? new Response(entry.body, { status: entry.status, headers: entry.headers }) : undefined;
    },
    async put(request, response) {
      if (cache.failPut) throw new Error('cache down');
      cache.puts.push(request.url);
      cache.entries.set(request.url, { body: new Uint8Array(await response.arrayBuffer()), status: response.status, headers: [...response.headers] });
    },
  };
  return cache;
}
const json = (body, status = 200, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body),
  { status, headers: { 'content-type': 'application/json', ...headers } });
function fakeGithub() {
  const routes = {
    'octo-cat': () => json(OCTO_PAGE),
    'empty-town': () => json([]),
    'private-only': () => json(rawPage('private-only').map(row => ({ ...row, private: true }))),
    'gh-error': () => json({ message: 'Server Error' }, 500),
    'gh-forbidden': () => json({ message: 'API rate limit exceeded' }, 403),
    'net-fail': () => { throw new TypeError('network connection lost'); },
    'bad-json': () => json('[{"name": "x",'),
    'not-array': () => json({ message: 'hello' }),
    'too-big': () => json('[]', 200, { 'content-length': String(TOWN_CARD_LIMITS.maxBytes + 1) }),
    'stream-big': () => new Response(new ReadableStream({
      start(controller) { for (let i = 0; i < 40; i++) controller.enqueue(new Uint8Array(64 * 1024).fill(0x20)); controller.close(); },
    }), { status: 200 }),
    'moved-user': () => new Response(null, { status: 301, headers: { location: 'https://evil.example/users/x' } }),
    'omega-lang': () => json(rawPage('omega-lang', golden.repos.slice(0, 6).map(repo => ({ ...repo, lang: `${ch(0x3a9)}mega` })))),
    'kv-down': () => json(rawPage('kv-down', golden.repos.slice(0, 5))),
    'old-token': init => (init.headers.authorization ? json({ message: 'Bad credentials' }, 401) : json(rawPage('old-token', golden.repos.slice(0, 5)))),
  };
  for (const login of ['rate-a', 'rate-b', 'rate-c', 'rate-d']) routes[login] = () => json(rawPage(login, golden.repos.slice(0, 4)));
  const calls = [];
  async function impl(url, init) {
    calls.push({ url: String(url), init });
    const login = /\/users\/([^/]+)\/repos/.exec(String(url))[1].toLowerCase();
    return (routes[login] || (() => json({ message: 'Not Found' }, 404)))(init);
  }
  return { impl, calls };
}
function rig({ glyphs = GLYPHS, renderPng, cache = fakeCache(), env = {}, token } = {}) {
  const github = fakeGithub(), kv = fakeKv(), logs = [], svgs = [];
  const render = renderPng === undefined ? async svg => { svgs.push(svg); return RENDERED; } : renderPng;
  const worker = createCardWorker({ renderPng: render, glyphs, bannerSvg: BANNER, genericPng: GENERIC_PNG, fetchImpl: github.impl, cache,
    now: () => clock.now, log: entry => logs.push(entry) });
  const environment = { CARD_KV: kv, SITE_URL: 'https://hyeonsangjeon.github.io/Repolis/', ...(token ? { GITHUB_TOKEN: token } : {}), ...env };
  async function call(path, { method = 'GET', ip = ADDRESSES[0], envOverride, ctx: ctxOverride } = {}) {
    const ctx = { tasks: [], waitUntil(promise) { ctx.tasks.push(promise); } };
    const response = await worker.fetch(new Request(ORIGIN + path, { method, headers: { 'cf-connecting-ip': ip } }),
      envOverride === undefined ? environment : envOverride, ctxOverride === undefined ? ctx : ctxOverride);
    await Promise.all(ctx.tasks);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, bytes, text: new TextDecoder().decode(bytes) };
  }
  return { worker, github, kv, cache, logs, svgs, call, env: environment };
}
const allLogs = [];
const unescape = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function metaTags(html) {
  const tags = {};
  for (const match of html.matchAll(/<meta (property|name)="([^"]+)" content="([^"]*)">/g)) tags[match[2]] = unescape(match[3]);
  return tags;
}
const sameBytes = (a, b) => a.byteLength === b.byteLength && a.every((byte, index) => byte === b[index]);
const isPlainShare = html => metaTags(html)['og:image'] === 'https://hyeonsangjeon.github.io/Repolis/assets/social-preview.png'
  && metaTags(html)['og:title'] === SITE_PREVIEW.title;

// ── 1. Routes and the login rule ────────────────────────────────────────────────
check(JSON.stringify(parseCardRoute('/u/octo-cat')) === '{"kind":"share","login":"octo-cat"}'
  && JSON.stringify(parseCardRoute('/card/octo-cat.png')) === '{"kind":"png","login":"octo-cat"}'
  && JSON.stringify(parseCardRoute('/card/octo-cat.svg')) === '{"kind":"svg","login":"octo-cat"}', 'three routes');
check(['/', '/u', '/u/', '/u/a/b', '/u/octo/', '/card/octo', '/card/octo.gif', '/card/.png', '/card/a/b.png', '/favicon.ico', '/robots.txt']
  .every(pathname => parseCardRoute(pathname) === null || !validLogin(parseCardRoute(pathname).login)), 'other paths are not card routes');
check(['a', 'A1', 'octo-cat', 'a'.repeat(39), 'a--b'].every(validLogin)
  && !['', '-octo', 'octo-', 'a'.repeat(40), 'octo_cat', 'octo.cat', 'oc to', '%41', '..', 'octo/cat', ch(0xff21), null, 42].some(validLogin),
  'the login rule is the town\'s GitHub login rule');
{
  const { call, github, kv, logs } = rig();
  for (const pathname of ['/', '/u/', '/u/-octo', '/u/octo_cat', '/card/octo.cat.png', `/u/${'a'.repeat(40)}`, '/u/%3Cscript%3E', '/favicon.ico', '/card/octo.gif']) {
    const response = await call(pathname);
    check(response.status === 404 && response.headers.get('content-type') === 'text/html; charset=utf-8' && isPlainShare(response.text)
      && /<meta name="robots" content="noindex">/.test(response.text) && !/<script/.test(response.text), `${pathname} → 404 with the plain preview`);
  }
  check(github.calls.length === 0 && kv.reads === 0, 'an invalid login or path never reaches KV or GitHub');
  const post = await call('/u/octo-cat', { method: 'POST' });
  check(post.status === 405 && post.headers.get('allow') === 'GET, HEAD' && github.calls.length === 0, 'only GET and HEAD');
  allLogs.push(...logs);
}

// ── 2. The d= cache buster ──────────────────────────────────────────────────────
check(cardDay(NOW) === '20261021' && cardDay(Date.parse('2026-10-21T23:59:59.999Z')) === '20261021' && cardDay(Date.parse('2024-02-29T00:00:00Z')) === '20240229',
  'the card day is the UTC date');
check(normalizeCardDay('20261021', NOW) === '20261021' && normalizeCardDay('20261020', NOW) === '20261020' && normalizeCardDay('20261022', NOW) === '20261022',
  'today, yesterday and tomorrow (UTC) are kept');
check(['20261019', '20261023', '20251021', '20261399', '20260230', '00000101', '2026102', '202610210', 'abcdefgh', '', null, undefined, ['20261021'], ' 20261021']
  .every(value => normalizeCardDay(value, NOW) === '20261021'), 'any other or malformed d= becomes today');
check(normalizeCardDay('20240229', Date.parse('2024-02-29T12:00:00Z')) === '20240229' && normalizeCardDay('20230229', Date.parse('2023-03-01T00:00:00Z')) === '20230301',
  'a leap day is real only in a leap year');

// ── 3. A town with a card: GitHub once, KV keeps only the summary ───────────────
{
  const { call, github, kv, cache, logs, svgs } = rig({ token: 'test-token-not-real' });
  const town = townPipeline(OCTO_PAGE, 'octo-cat');
  const share = await call('/u/octo-cat');
  const tags = metaTags(share.text);
  check(share.status === 200 && share.headers.get('content-type') === 'text/html; charset=utf-8'
    && share.headers.get('cache-control') === `public, max-age=${CARD_TTL.page}`, '/u/<login> answers 200 HTML, not a redirect');
  check(github.calls.length === 1 && github.calls[0].url === 'https://api.github.com/users/octo-cat/repos?per_page=100&sort=pushed'
    && github.calls[0].url === townRequestUrl('octo-cat'), 'one GitHub request, the same page the town asks for');
  const sent = github.calls[0].init;
  check(sent.redirect === 'manual' && sent.headers.authorization === 'Bearer test-token-not-real' && sent.headers.accept === 'application/vnd.github+json'
    && /^repolis-card/.test(sent.headers['user-agent']) && sent.headers['x-github-api-version'] === '2022-11-28' && sent.signal instanceof AbortSignal,
    'the token goes only to api.github.com, redirects are not followed, the request can time out');
  check(tags['og:title'] === town.name.en && tags['og:title'] === 'Python Lab City of octo-cat' && tags['twitter:title'] === town.name.en,
    'og:title is the city plaque name from homecomingCityName');
  check(tags['og:image'] === `${ORIGIN}/card/octo-cat.png?d=20261021` && tags['twitter:image'] === tags['og:image']
    && tags['og:image:width'] === '1200' && tags['og:image:height'] === '630' && tags['twitter:card'] === 'summary_large_image'
    && tags['og:url'] === `${ORIGIN}/u/octo-cat` && tags['og:type'] === 'website' && tags['og:locale'] === 'en_US',
    'absolute og:image with today\'s UTC d=, summary_large_image, og:url is the share link');
  const target = 'https://hyeonsangjeon.github.io/Repolis/?user=octo-cat&ref=card';
  check(share.text.includes(`<meta http-equiv="refresh" content="0; url=${escapeHtml(target)}">`)
    && share.text.includes(`<script>location.replace("${target}")</script>`) && share.text.includes(`<a href="${escapeHtml(target)}">`),
    'people move on to <SITE_URL>?user=<login>&ref=card by meta refresh and location.replace');
  check(kv.writes.length === 1 && kv.writes[0].key === 'card:v1:octo-cat' && kv.writes[0].options.expirationTtl === 86400 && kv.store.size === 1,
    'KV gets one write: card:v1:<login> for 24 h');
  const stored = JSON.parse(kv.writes[0].value);
  check(Object.keys(stored).join() === 'repos,truncated,stars,archived,language,firstYear,zones,top,skyline'
    && kv.writes[0].value === JSON.stringify(townCardSummary(OCTO_PAGE, 'octo-cat'))
    && kv.writes[0].value === JSON.stringify(summarizeCityCard(town.repos, { referenceTimestamp: town.reference })),
    'the KV value is exactly the city-card summary of the town\'s own projection');
  check(!/DESCRIPTION-MARKER|avatar|example\.com|html_url|hidden-private-repo|"owner"|"login"|octo-cat/.test(kv.writes[0].value) && kv.writes[0].value.length < 8192,
    'no raw field, description, avatar, e-mail, URL, private repository or login is stored');
  check(stored.repos === 71 && stored.truncated === false && stored.stars === golden.repos.reduce((sum, repo) => sum + repo.stars, 0),
    'the private repository is left out of the town');

  const again = await call('/u/Octo-Cat');
  check(github.calls.length === 1 && metaTags(again.text)['og:title'] === 'Python Lab City of Octo-Cat'
    && metaTags(again.text)['og:image'] === `${ORIGIN}/card/Octo-Cat.png?d=20261021`, 'a login in another case reads the same KV entry and keeps its spelling');

  const png = await call('/card/octo-cat.png?d=20261021&utm_source=x&lang=fr');
  check(png.status === 200 && png.headers.get('content-type') === 'image/png' && sameBytes(png.bytes, RENDERED)
    && png.headers.get('cache-control') === 'public, max-age=86400, s-maxage=86400' && png.headers.get('access-control-allow-origin') === '*',
    'PNG card with s-maxage=86400');
  check(cache.puts.length === 1 && cache.puts[0] === `${ORIGIN}/card/octo-cat.png?d=20261021` && svgs.length === 1 && github.calls.length === 1,
    'the Cache API key keeps only d= (other queries dropped); KV served the summary');
  const hit = await call('/card/octo-cat.png?d=bogus');
  check(sameBytes(hit.bytes, RENDERED) && svgs.length === 1 && cache.matches.at(-1) === `${ORIGIN}/card/octo-cat.png?d=20261021`,
    'a malformed d= is today\'s key and a cache hit renders nothing');
  const yesterday = await call('/card/octo-cat.png?d=20261020');
  check(yesterday.status === 200 && cache.puts.at(-1) === `${ORIGIN}/card/octo-cat.png?d=20261020` && svgs.length === 2, 'yesterday is its own key');
  const head = await call('/card/octo-cat.png?d=20261021', { method: 'HEAD' });
  check(head.status === 200 && head.bytes.byteLength === 0 && head.headers.get('content-type') === 'image/png', 'HEAD answers headers only');

  const svgCard = svgs[0];
  check(svgCard.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" ') && !/<text[\s>]/.test(svgCard)
    && /<use href="#g800-/.test(svgCard) && !/hidden-private-repo|DESCRIPTION-MARKER/.test(svgCard),
    'the PNG is drawn from a 1200×630 SVG with glyph paths and no <text>');

  const readme = await call('/card/octo-cat.svg?d=1&x=2');
  check(readme.status === 200 && readme.headers.get('content-type') === 'image/svg+xml; charset=utf-8' && readme.headers.get('cache-control') === 'max-age=86400'
    && readme.text === cityCardSvg(stored, town.name.en, { size: 'readme', lang: 'en' }) && readme.text.includes('width="600" height="300"'),
    'README SVG 600×300 with max-age=86400');
  const ko = await call('/u/octo-cat?lang=ko');
  const koTags = metaTags(ko.text);
  check(koTags['og:title'] === town.name.ko && koTags['og:title'] === 'octo-cat의 파이썬 연구소 도시' && koTags['og:locale'] === 'ko_KR'
    && koTags['og:image'] === `${ORIGIN}/card/octo-cat.png?d=20261021&lang=ko` && /<html lang="ko">/.test(ko.text), 'lang=ko gives the Korean plaque name and card');
  await call('/card/octo-cat.png?lang=ko');
  check(cache.puts.at(-1) === `${ORIGIN}/card/octo-cat.png?d=20261021&lang=ko` && /<use href="#g800-c758"/.test(svgs.at(-1)), 'a Korean card is drawn in Korean glyphs');

  clock.now = NOW + DAY + 1000;
  await call('/u/octo-cat');
  check(github.calls.length === 2 && kv.writes.length === 2, 'after 24 h the login is asked again: once a day per login');
  clock.now = NOW;
  allLogs.push(...logs);
}

// ── 4. The plaque name from a stored summary equals the town's ──────────────────
{
  const towns = {
    port: [{ repo: 'docker-a', lang: 'Shell' }, { repo: 'k8s-b', lang: 'Shell' }, { repo: 'notes', lang: 'Go' }],
    lab: [{ repo: 'llm-a', lang: 'Python' }, { repo: 'rag-b', lang: 'Python' }, { repo: 'misc', lang: 'Go' }],
    boulevard: [{ repo: 'react-a', lang: 'TypeScript' }, { repo: 'vue-b', lang: 'Vue' }, { repo: 'x', lang: 'Vue' }],
    workshop: [{ repo: 'csv-a', lang: 'Rust' }, { repo: 'etl-b', lang: 'Rust' }, { repo: 'misc' }],
    town: [{ repo: 'alpha' }, { repo: 'beta' }, { repo: 'gamma', lang: 'Other' }],
  };
  for (const [type, repos] of Object.entries(towns)) {
    const reference = Date.parse('2026-10-01T00:00:00Z');
    const summary = JSON.parse(JSON.stringify(summarizeCityCard(repos, { referenceTimestamp: reference })));
    const direct = homecomingCityName(repos.map(repo => ({ ...repo, zone: classifyRepoZone(repo, reference) })), 'Some-One');
    const fromCard = cardCityName(summary, 'Some-One');
    check(JSON.stringify(fromCard) === JSON.stringify(direct) && fromCard.type === type, `${type}: the card's city name equals the plaque's (${fromCard.en})`);
  }
  check(cardCityName(EMPTY_CARD_SUMMARY, 'x').en === 'Town of x' && cardCityName(null, 'x').ko === 'x의 마을', 'no houses is a plain town');
  const html = read('index.html');
  check(/return \{ repos:projectPublicRepos\(raw,user\), source:'github-public',/.test(html)
    && /function zoneOf\(repo\)\{ return classifyRepoZone\(repo,_now\); \}/.test(html)
    && /const _now=CITY_STATE\?cityReferenceTimestamp\(CITY_STATE,REPOS,Date\.now\(\)\):Date\.now\(\);/.test(html)
    && /homecomingCityName\(_homecomingTownRepos\(\)\.map\(repo=>\(\{repo:repo\.repo,lang:repo\.lang,zone:repo\._zone\}\)\),currentUser\)/.test(html)
    && /CITY_STATE=TOWN_PROJECTION\.cityState;/.test(html)
    && /'https:\/\/api\.github\.com\/users\/'\+encodeURIComponent\(user\)\+'\/repos\?per_page=100&sort=pushed'/.test(html),
    'the town still builds public towns the way the Worker mirrors (projection, reference day, districts, plaque, request)');
}

// ── 5. Negative cache: unknown, empty and failed towns ──────────────────────────
{
  const { call, github, kv, logs } = rig();
  const failures = { 'ghost-user': 'not-found', 'empty-town': 'empty', 'private-only': 'empty', 'gh-error': 'github', 'gh-forbidden': 'github',
    'net-fail': 'network', 'bad-json': 'malformed', 'not-array': 'malformed', 'too-big': 'oversized', 'stream-big': 'oversized', 'moved-user': 'github' };
  for (const [login, reason] of Object.entries(failures)) {
    const before = github.calls.length;
    const share = await call(`/u/${login}`);
    check(share.status === 200 && isPlainShare(share.text) && share.text.includes(`location.replace("https://hyeonsangjeon.github.io/Repolis/?user=${login}&ref=card")`)
      && metaTags(share.text)['og:image:width'] === '1280' && github.calls.length === before + 1
      && share.headers.get('cache-control') === `public, max-age=${CARD_TTL.page}`, `${login}: 200 plain preview and the move on (${reason})`);
    const write = kv.writes.at(-1);
    check(write.key === cardKvKey(login) && write.value === JSON.stringify(EMPTY_CARD_SUMMARY) && write.options.expirationTtl === 3600,
      `${login}: an empty summary is kept for 1 h`);
    check(logs.at(-1).reason === reason, `${login}: logged as ${reason}`);
    const png = await call(`/card/${login}.png`);
    const svg = await call(`/card/${login}.svg`);
    check(png.status === 200 && sameBytes(png.bytes, GENERIC_PNG) && png.headers.get('cache-control') === 'public, max-age=3600'
      && svg.status === 200 && svg.text === BANNER && svg.headers.get('cache-control') === 'max-age=3600' && github.calls.length === before + 1,
      `${login}: the plain PNG and the banner SVG, without asking GitHub again`);
  }
  check(github.calls.find(entry => entry.url.includes('moved-user')).init.redirect === 'manual' && !github.calls.some(entry => entry.url.includes('evil.example')),
    'a redirect is not followed');
  check(github.calls.every(entry => !('authorization' in entry.init.headers)), 'without GITHUB_TOKEN the Worker asks GitHub anonymously');
  clock.now = NOW + 3600 * 1000 + 1000;
  await call('/u/ghost-user');
  check(github.calls.filter(entry => entry.url.includes('ghost-user')).length === 2, 'after 1 h an unknown login is asked again');
  clock.now = NOW;
  const slow = await fetchTownCard('slow-poke', { timeoutMs: 20, fetchImpl: (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }) });
  check(slow.failure === 'network' && !slow.summary, 'a GitHub request that runs past its deadline is a network failure');
  allLogs.push(...logs);
}

{
  const { call, github, logs } = rig({ token: 'expired-token-not-real' });
  const share = await call('/u/old-token');
  const calls = github.calls.filter(entry => entry.url.includes('old-token'));
  check(calls.length === 2 && calls[0].init.headers.authorization === 'Bearer expired-token-not-real' && !('authorization' in calls[1].init.headers)
    && metaTags(share.text)['og:title'].endsWith(' of old-token') && logs.some(entry => entry.route === 'github' && entry.result === 'token-rejected'),
    'a refused (expired) token: asked once more without it, the card still appears, and the log says so');
  allLogs.push(...logs);
}

// ── 6. Every failure still answers 200 ──────────────────────────────────────────
{
  const kvDown = rig();
  kvDown.kv.failGet = true;
  const share = await kvDown.call('/u/kv-down'), png = await kvDown.call('/card/kv-down.png'), svg = await kvDown.call('/card/kv-down.svg');
  check(share.status === 200 && isPlainShare(share.text) && png.status === 200 && sameBytes(png.bytes, GENERIC_PNG) && svg.status === 200 && svg.text === BANNER
    && kvDown.github.calls.length === 0, 'KV read failure: plain card, and GitHub is not asked (the daily bound needs KV)');
  check([share, png, svg].every(response => response.headers.get('cache-control') === 'no-store'), 'a transient failure answer is not cacheable');
  const noKv = rig({ env: { CARD_KV: undefined } });
  check((await noKv.call('/u/octo-cat')).status === 200 && sameBytes((await noKv.call('/card/octo-cat.png')).bytes, GENERIC_PNG)
    && (await noKv.call('/card/octo-cat.svg')).text === BANNER && noKv.github.calls.length === 0, 'a missing KV binding: plain card');
  const noEnv = rig();
  check((await noEnv.call('/u/octo-cat', { envOverride: null, ctxOverride: null })).status === 200, 'no env or ctx at all: still 200');
  const kvWrite = rig();
  kvWrite.kv.failPut = true;
  const written = await kvWrite.call('/u/octo-cat');
  check(written.status === 200 && metaTags(written.text)['og:title'] === 'Python Lab City of octo-cat'
    && kvWrite.logs.some(entry => entry.route === 'kv' && entry.result === 'write-failed'), 'KV write failure: the card is still served');
  const renderFails = rig({ renderPng: async () => { throw new Error('wasm trap'); } });
  const notPng = rig({ renderPng: async () => new TextEncoder().encode('<svg/>') });
  const noRenderer = rig({ renderPng: null });
  const badGlyphs = rig({ glyphs: { schema: 'nope' } });
  for (const [label, test] of [['render throws', renderFails], ['render returns no PNG', notPng], ['no renderer', noRenderer], ['broken glyph table', badGlyphs]]) {
    const response = await test.call('/card/octo-cat.png');
    check(response.status === 200 && sameBytes(response.bytes, GENERIC_PNG) && test.cache.puts.length === 0 && test.logs.at(-1).reason === 'render'
      && response.headers.get('cache-control') === 'no-store', `${label}: the plain PNG, and nothing is cached`);
  }
  const cacheDown = rig();
  cacheDown.cache.failMatch = true;
  cacheDown.cache.failPut = true;
  const uncached = await cacheDown.call('/card/octo-cat.png');
  check(uncached.status === 200 && sameBytes(uncached.bytes, RENDERED), 'Cache API failure: rendered without the cache');
  const clockFails = createCardWorker({ renderPng: async () => RENDERED, glyphs: GLYPHS, bannerSvg: BANNER, genericPng: GENERIC_PNG,
    fetchImpl: fakeGithub().impl, cache: null, now: () => { throw new Error('clock'); }, log: () => {} });
  const env = { CARD_KV: fakeKv(), SITE_URL: 'https://hyeonsangjeon.github.io/Repolis/' };
  const shareThrows = await clockFails.fetch(new Request(`${ORIGIN}/u/octo-cat`), env, { waitUntil() {} });
  const pngThrows = await clockFails.fetch(new Request(`${ORIGIN}/card/octo-cat.png`), env, { waitUntil() {} });
  check(shareThrows.status === 200 && isPlainShare(await shareThrows.text()) && pngThrows.status === 200
    && sameBytes(new Uint8Array(await pngThrows.arrayBuffer()), GENERIC_PNG), 'an unexpected exception inside a route: the plain answer, 200');
  const loggerThrows = createCardWorker({ renderPng: async () => RENDERED, glyphs: GLYPHS, bannerSvg: BANNER, genericPng: GENERIC_PNG,
    fetchImpl: fakeGithub().impl, cache: null, now: () => NOW, log: () => { throw new Error('log sink down'); } });
  check((await loggerThrows.fetch(new Request(`${ORIGIN}/u/octo-cat`), { CARD_KV: fakeKv() }, { waitUntil() {} })).status === 200,
    'a failing log sink changes nothing');
  check(['genericPng', 'bannerSvg'].every(name => {
    try { createCardWorker({ glyphs: GLYPHS, bannerSvg: BANNER, genericPng: GENERIC_PNG, [name]: undefined }); return false; } catch (error) { return error instanceof TypeError; }
  }), 'the Worker refuses to start without its bundled fallbacks');
  for (const test of [kvDown, noKv, kvWrite, renderFails, notPng, noRenderer, badGlyphs, cacheDown]) allLogs.push(...test.logs);
}

// ── 7. Rate limit on new renders ────────────────────────────────────────────────
{
  const keys = [];
  let used = 0;
  const binding = { async limit({ key }) { keys.push(key); used++; return { success: used <= 2 }; } };
  const limited = rig({ env: { CARD_RATE_LIMIT: binding } });
  await limited.call('/u/rate-a');
  await limited.call('/u/rate-b');
  const third = await limited.call('/u/rate-c');
  check(limited.github.calls.length === 2 && third.status === 200 && isPlainShare(third.text) && third.headers.get('cache-control') === 'no-store'
    && !limited.kv.store.has('card:v1:rate-c') && limited.logs.at(-1).reason === 'limited', 'a limited new login: plain 200, no-store, no GitHub, no KV entry');
  check(keys.every(key => key === `ip:${ADDRESSES[0]}`), 'the limit is per address (CF-Connecting-IP)');
  await limited.call('/u/rate-a');
  check(keys.length === 3, 'a login KV already knows costs nothing from the allowance');
  const pngLimited = await limited.call('/card/rate-a.png');
  check(pngLimited.status === 200 && sameBytes(pngLimited.bytes, GENERIC_PNG) && pngLimited.headers.get('cache-control') === 'no-store'
    && limited.svgs.length === 0 && limited.cache.puts.length === 0, 'a limited PNG render: the plain card, not cached anywhere');
  const throwing = rig({ env: { CARD_RATE_LIMIT: { async limit() { throw new Error('binding down'); } } } });
  check((await throwing.call('/u/rate-a')).status === 200 && throwing.github.calls.length === 1, 'a failing binding falls back to the isolate window');

  const isolate = rig();
  for (let i = 0; i < RENDER_LIMIT.limit; i++) await isolate.call(`/card/octo-cat.png?d=${i % 2 ? '20261020' : '20261022'}`, { ip: ADDRESSES[1] });
  const over = await isolate.call('/card/octo-cat.png?d=20261021', { ip: ADDRESSES[1] });
  check(isolate.svgs.length === 3 && sameBytes(over.bytes, RENDERED), 'cache hits do not count: 31 requests, 3 renders, none refused');
  const fresh = rig();
  const renders = [];
  for (let i = 0; i <= RENDER_LIMIT.limit; i++) {
    fresh.cache.entries.clear();
    renders.push((await fresh.call('/card/octo-cat.png', { ip: ADDRESSES[1] })).headers.get('cache-control'));
  }
  check(renders.slice(0, RENDER_LIMIT.limit).every(value => value === 'public, max-age=86400, s-maxage=86400') && renders.at(-1) === 'no-store'
    && fresh.svgs.length === RENDER_LIMIT.limit, `without the binding: ${RENDER_LIMIT.limit} renders a minute per address, then the plain card`);
  check(sameBytes((await fresh.call('/card/octo-cat.png', { ip: ADDRESSES[2] })).bytes, RENDERED), 'another address has its own allowance');
  clock.now = NOW + 60000;
  check(sameBytes((await fresh.call('/card/octo-cat.png?d=20261022', { ip: ADDRESSES[1] })).bytes, RENDERED), 'the window resets after a minute');
  clock.now = NOW;
  const window = createWindowLimiter({ limit: 1, periodMs: 1000, maxKeys: 3 });
  check(window('a', 0) && !window('a', 1) && window('b', 2) && window('c', 3) && window('d', 4) && window('a', 5) && window('a', 1005) === true,
    'the isolate window is bounded: the oldest key leaves when full');
  check(await allowRender({}, 'k', () => true, 0) && !(await allowRender({ CARD_RATE_LIMIT: { limit: async () => ({ success: false }) } }, 'k', () => true, 0))
    && await allowRender({ CARD_RATE_LIMIT: { limit: async () => ({}) } }, 'k', () => true, 0), 'a malformed binding answer falls back');
  for (const test of [limited, throwing, isolate, fresh]) allLogs.push(...test.logs);
}

// ── 8. HTML and Open Graph escaping ─────────────────────────────────────────────
{
  check(escapeHtml(`<a href="x">'&'</a>`) === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;' && escapeHtml(null) === '', 'escapeHtml');
  const hostile = '</script><script>alert(1)</script> "quoted" & \'single\' <b>';
  const page = sharePage({ origin: ORIGIN, login: 'octo-cat', lang: 'en', site: 'https://example.github.io/Town/?x="><script>bad()</script>#h',
    card: { name: hostile, stats: `3 repos · ★ 9 · ${hostile}`, image: `${ORIGIN}/card/octo-cat.png?d=20261021&x="<y>` } });
  check((page.match(/<script/g) || []).length === 1 && !page.includes('alert(1)</script>') && !page.includes('bad()</script>'),
    'one script element, and no value can open or close another');
  const tags = metaTags(page);
  check(tags['og:title'] === hostile && tags['og:image'] === `${ORIGIN}/card/octo-cat.png?d=20261021&x="<y>` && tags['twitter:description'].includes(hostile),
    'every meta value round-trips through escaping');
  check([...page.matchAll(/content="([^"]*)"/g)].every(match => !/[<>]/.test(match[1])), 'no raw < or > inside an attribute');
  check(page.includes('location.replace("https://example.github.io/Town/?user=octo-cat&ref=card")'), 'the site URL is normalized before use');
  check(siteUrl('javascript:alert(1)') === SITE_URL_DEFAULT && siteUrl('') === SITE_URL_DEFAULT && siteUrl(undefined) === SITE_URL_DEFAULT
    && siteUrl('https://a.example/repolis') === 'https://a.example/repolis/' && townUrl('https://a.example/', 'Octo') === 'https://a.example/?user=Octo&ref=card',
    'SITE_URL must be http(s); the town link carries user and ref=card');
  const scriptSafe = sharePage({ origin: ORIGIN, login: 'x', site: 'https://a.example/</script>/', card: null });
  check(!scriptSafe.replace('</script></body>', '').includes('</script>'), 'a site URL cannot close the script element');
  const html = read('index.html');
  const siteTag = key => unescape((new RegExp(`<meta property="${key}" content="([^"]*)" />`).exec(html) || [])[1] || '');
  check(siteTag('og:title') === SITE_PREVIEW.title && siteTag('og:description') === SITE_PREVIEW.description
    && siteTag('og:image') === `https://hyeonsangjeon.github.io/Repolis/${SITE_PREVIEW.image}` && siteTag('og:image:width') === String(SITE_PREVIEW.width)
    && siteTag('og:image:height') === String(SITE_PREVIEW.height) && siteTag('og:image:alt') === SITE_PREVIEW.alt, 'the plain preview is the town\'s own og: tags');
}

// ── 9. Glyph outlines and the vocabulary ────────────────────────────────────────
{
  const glyphText = createGlyphText(GLYPHS);
  const vocabulary = cardVocabulary();
  const keys = weight => Object.keys(GLYPHS.glyphs[weight]).sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
  check(GLYPHS.schema === 'repolis.card-glyphs' && GLYPHS.unitsPerEm === 1000 && GLYPHS.weights.join() === '500,600,700,800'
    && GLYPHS.weights.every(weight => keys(String(weight)) === vocabulary), 'the glyph table holds exactly the card vocabulary at the four card weights');
  check(GLYPHS.font.family === 'Noto Sans KR' && /Adobe.*Reserved Font Name 'Source'/.test(GLYPHS.font.copyright)
    && GLYPHS.font.sha256 === '194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252' && /google\/fonts\/blob\/[0-9a-f]{40}\//.test(GLYPHS.font.source)
    && /SIL OPEN FONT LICENSE Version 1\.1/.test(read('cloudflare-card/src/glyphs/OFL.txt')) && /Reserved Font Name 'Source'/.test(read('cloudflare-card/src/glyphs/OFL.txt'))
    && !/Source/.test(GLYPHS.font.family), 'OFL font provenance: pinned source, copyright, license text, no reserved name');
  const hangulIn = (source, start, end) => [...source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))].filter(char => /\p{Script=Hangul}/u.test(char));
  const plaque = read('assets/homecoming.js'), card = read('assets/city-card.js');
  const copyChars = [...hangulIn(plaque, 'const TYPE_COPY', 'const STOP_TITLES'), ...hangulIn(plaque, 'export function homecomingCityName', 'export function homecomingTimelapsePlan'),
    ...hangulIn(card, 'const COPY', 'const FRAMES')];
  check(copyChars.length > 80 && copyChars.every(char => vocabulary.includes(char)), 'every Korean character in the plaque and card copy has a glyph');
  check(plaqueLanguages().length >= 22 && plaqueLanguages().includes('Jupyter Notebook') && plaqueLanguages().includes('Objective-C'), 'the plaque languages are read from source');
  check(cardTexts().every(text => glyphText.covers([{ text }])), 'every enumerated card string is drawable without substitution');
  check(glyphText.drawable('Café ①漢').join('') === 'Cafe 1-' && glyphText.drawable(`a${ch(0x1f680)}${ch(0x1f680)}b`).join('') === 'a-b'
    && !glyphText.covers([{ text: '漢' }]) && glyphText.covers([{ text: '깃허브 마을 ★ 1,234 · …' }]), 'outside the vocabulary: ASCII form, else one -');

  const town = summarizeCityCard(golden.repos, { referenceTimestamp: Date.parse(golden.source.reference) });
  const runs = cityCardTextRuns(town, 'hyeonsangjeon의 파이썬 연구소 도시', { lang: 'ko' });
  const markup = glyphText.drawText(runs);
  const ids = new Set([...markup.matchAll(/<path id="([^"]+)" d="[mlqcz0-9 -]*"\/>/g)].map(match => match[1]));
  check(!/<text/.test(markup) && [...markup.matchAll(/<use href="#([^"]+)"/g)].every(match => ids.has(match[1]))
    && (markup.match(/<g transform=/g) || []).length === runs.length && markup.startsWith('<defs>'), 'one group per run, every glyph defined once');
  check(runs.every(run => markup.includes(`fill="${run.fill}"`)) && markup.includes('opacity="0.85"'), 'run colors and opacity carry over');
  const wide = { text: 'W'.repeat(40), x: 100, y: 50, size: 40, weight: 800, fill: '#fff6e3', anchor: 'end', spacing: 0, opacity: 1, maxWidth: 300 };
  const fitted = /<g transform="translate\(([-\d.]+) 50\) scale\(([\d.]+)\)"/.exec(glyphText.drawText([wide]));
  check(fitted && Number(fitted[1]) === 100 - 300 && Math.abs(glyphText.width(wide.text, 40, 800) * Number(fitted[2]) / 0.04 - 300) < 0.5,
    'a run wider than its slot is scaled to fit, right-anchored runs end at x');
  const scaled = [];
  check(['ko', 'en'].every(lang => cityCardTextRuns(town, lang === 'ko' ? 'hyeonsangjeon의 파이썬 연구소 도시' : 'Python Lab City of hyeonsangjeon', { lang }).every(run => {
    const scale = Number((/scale\(([\d.]+)\)/.exec(glyphText.drawText([run])) || [])[1]);
    const unit = run.size / GLYPHS.unitsPerEm;
    const real = glyphText.width(run.text, run.size, run.weight) + (run.spacing || 0) * ([...run.text].length - 1);
    if (real > run.maxWidth) scaled.push(run.role);
    return Math.abs(scale - unit * Math.min(1, run.maxWidth / real)) < 1e-5;
  })), 'every run is drawn at its own size, or scaled just enough to fit its slot');
  check(scaled.length > 0 && scaled.every(role => role === 'top-stars' || role === 'top-name'),
    `real metrics outgrow the estimate only for the top-house rows (${scaled.length} runs, scaled to fit)`);
  check(glyphText.drawText([]) === '' && glyphText.drawText([{ text: '   ', x: 0, y: 0, size: 10, weight: 500 }]) === '', 'blank runs draw nothing');
  check((() => { try { createGlyphText({ ...GLYPHS, glyphs: { ...GLYPHS.glyphs, 500: { ...GLYPHS.glyphs[500], a: [1, 'm0 0"/><script>'] } } }); return false; } catch (error) { return true; } })(),
    'path data is checked before it can reach markup');

  const generic = genericCardSvg(glyphText.drawText);
  check(generic.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"') && !/<text/.test(generic)
    && GENERIC_CARD_RUNS.every(run => glyphText.covers([run])), 'the generic card is a 1200×630 glyph-path SVG');
  const view = new DataView(GENERIC_PNG.buffer, GENERIC_PNG.byteOffset);
  check(GENERIC_PNG.byteLength < 65536 && new TextDecoder().decode(GENERIC_PNG.slice(12, 16)) === 'IHDR' && view.getUint32(16) === 1200 && view.getUint32(20) === 630,
    'src/generic-card.png is a small 1200×630 PNG');

  // A Korean card whose text leaves the vocabulary (here a language name) is drawn in English.
  const { call, svgs, kv, logs } = rig();
  await call('/u/omega-lang');
  check(JSON.parse(kv.writes[0].value).language === `${ch(0x3a9)}mega`, 'a non-ASCII language name is kept in the summary');
  await call('/card/omega-lang.png?lang=ko');
  const drawn = [...svgs.at(-1).matchAll(/<use href="#g\d+-([0-9a-f]+)"/g)].map(match => parseInt(match[1], 16));
  check(drawn.length > 40 && !drawn.some(code => code >= 0xac00 && code <= 0xd7a3) && /<use href="#g700-47"/.test(svgs.at(-1)),
    'the Korean card falls back to English when a glyph is missing');
  allLogs.push(...logs);
}

// ── 10. Logs never carry a login or an address ──────────────────────────────────
{
  const lines = [...allLogs.map(entry => JSON.stringify(entry)), ...consoleLines];
  check(allLogs.length > 60 && allLogs.every(entry => Object.keys(entry).every(key => ['evt', 'route', 'result', 'reason'].includes(key))),
    'every log line is { evt, route, result, reason }');
  const lower = lines.join('\n').toLowerCase();
  check(LOGINS.every(login => !lower.includes(login.toLowerCase())) && ADDRESSES.every(address => !lower.includes(address))
    && !lower.includes('token-not-real'), 'no login, address or token in any log line or console output');
  const sources = ['worker.js', 'town-card.js', 'share-page.js', 'glyph-text.js', 'rate-limit.js', 'generic-card.js']
    .map(name => read(`cloudflare-card/src/${name}`));
  check(sources.every(source => (source.match(/console\./g) || []).length <= 1) && (sources[0].match(/console\./g) || []).length === 1,
    'one console call in the Worker: the default aggregate log');
}

// ── 11. Bundle boundary and deployment contract ─────────────────────────────────
{
  const imports = source => [...source.matchAll(/^import [^;]* from '([^']+)';$/gm)].map(match => match[1]);
  for (const name of ['worker.js', 'town-card.js', 'share-page.js', 'glyph-text.js', 'rate-limit.js', 'generic-card.js']) {
    check(imports(read(`cloudflare-card/src/${name}`)).every(spec => spec.startsWith('./') || spec.startsWith('../../assets/')),
      `src/${name} imports only local and shared town modules (no npm package)`);
  }
  const entry = read('cloudflare-card/src/index.js');
  check(imports(entry).join() === '@resvg/resvg-wasm,@resvg/resvg-wasm/index_bg.wasm,./glyphs/noto-sans-kr.json,./generic-card.png,../../assets/banner.svg,./worker.js',
    'only the entry imports the renderer and the bundled files');
  const toml = read('cloudflare-card/wrangler.toml');
  const code = toml.replace(/#.*$/gm, '');
  check(/^name = "repolis-card"$/m.test(code) && /^main = "src\/index\.js"$/m.test(code) && /^workers_dev = true$/m.test(code) && !/account_id/.test(code),
    'wrangler.toml: repolis-card on workers.dev, no account_id');
  check(/\[\[kv_namespaces\]\]\s+binding = "CARD_KV"\s+id = "REPLACE_WITH_CARD_KV_ID"/.test(code)
    && toml.includes('npx wrangler kv namespace create CARD_KV'), 'KV binding CARD_KV with the placeholder id and how to create it');
  check(/\[vars\]\s+SITE_URL = "https:\/\/hyeonsangjeon\.github\.io\/Repolis\/"/.test(code) && !/GITHUB_TOKEN\s*=/.test(toml)
    && toml.includes('npx wrangler secret put GITHUB_TOKEN'), 'SITE_URL var; GITHUB_TOKEN only as a secret');
  check(new RegExp(`\\[\\[ratelimits\\]\\]\\s+name = "CARD_RATE_LIMIT"\\s+namespace_id = "\\d+"\\s+\\[ratelimits\\.simple\\]\\s+limit = ${RENDER_LIMIT.limit}\\s+period = ${RENDER_LIMIT.periodMs / 1000}`).test(code),
    'rate limit binding CARD_RATE_LIMIT matches the isolate fallback');
  check(/\[observability\]\s+enabled = false/.test(code), 'persisted invocation logs (request URLs, so logins) stay off');
  const pkg = JSON.parse(read('cloudflare-card/package.json'));
  const lock = JSON.parse(read('cloudflare-card/package-lock.json'));
  check(pkg.private === true && Object.keys(pkg.dependencies).join() === '@resvg/resvg-wasm' && /^\d+\.\d+\.\d+$/.test(pkg.dependencies['@resvg/resvg-wasm'])
    && Object.keys(pkg.devDependencies).join() === 'wrangler' && /^\d+\.\d+\.\d+$/.test(pkg.devDependencies.wrangler)
    && lock.packages['node_modules/@resvg/resvg-wasm'].version === pkg.dependencies['@resvg/resvg-wasm'], 'exact dependency pins live only in cloudflare-card/ with a lockfile');
  check(!existsSync(file('package.json')) && !existsSync(file('node_modules')), 'the site keeps no package.json or node_modules at the root');
}

Object.assign(console, consoleOriginals);
console.log(`ALL GREEN - ${count} city card Worker checks: routes, d=, escaping, KV summary, negative cache, failures, rate limit, logs, glyphs, contract`);
