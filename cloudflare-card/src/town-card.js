/* cloudflare-card/src/town-card.js — one public GitHub town, reduced to its city card summary.
 *
 * The Worker asks GitHub for the page the town itself asks for (GET /users/<login>/repos?per_page=100&sort=pushed),
 * projects it with the town's public projection, takes the town's reference day from the portable city state, and
 * keeps only summarizeCityCard's output; the raw response goes out of scope here. The city name comes from the city
 * plaque rule (homecomingCityName), so a card, its link preview and the plaque at the end of the arrival agree.
 */
import { GITHUB_LOGIN_RE, projectPublicRepos } from '../../assets/repo-portal.js';
import { PORTABLE_TOWN_LIMITS, projectPortableTown } from '../../assets/world-tree/world-tree-state.js';
import { cityReferenceTimestamp } from '../../assets/city-time.js';
import { summarizeCityCard } from '../../assets/city-card.js';
import { homecomingCityName } from '../../assets/homecoming.js';

/* The town's own arrival limits for this request (ARRIVAL_DATA_LIMITS in index.html). */
export const TOWN_CARD_LIMITS = Object.freeze({ timeoutMs: 8000, maxBytes: 2 * 1024 * 1024 });
export const GITHUB_USER_AGENT = 'repolis-card (+https://github.com/hyeonsangjeon/Repolis)';
export const EMPTY_CARD_SUMMARY = summarizeCityCard([]);

const DAY_MS = 86400000;

export function validLogin(value) {
  return typeof value === 'string' && GITHUB_LOGIN_RE.test(value);
}

export function townRequestUrl(login) {
  return `https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&sort=pushed`;
}

/* The card summary for a raw /users/<login>/repos page, exactly as the town would build that login's public town. */
export function townCardSummary(raw, login) {
  const page = Array.isArray(raw) ? raw : [];
  const rows = page.filter(row => row && typeof row === 'object' && row.private !== true
    && (row.visibility === undefined || row.visibility === 'public'));
  const repos = projectPublicRepos(rows, login);
  const coverage = { partial: page.length >= PORTABLE_TOWN_LIMITS.publicRepoRequestCap, error: null };
  const town = projectPortableTown({ currentUser: login, repositories: repos, coverage });
  const referenceTimestamp = cityReferenceTimestamp(town.cityState, repos, NaN);
  return summarizeCityCard(repos, { referenceTimestamp, partial: coverage.partial });
}

/* True for a stored summary that can draw a town card (at least one house). */
export function isTownSummary(value) {
  return Boolean(value) && typeof value === 'object' && Number.isInteger(value.repos) && value.repos > 0
    && Array.isArray(value.skyline) && Array.isArray(value.zones) && Array.isArray(value.top);
}

/* The plaque's city name for a town known only by its card summary. The summary keeps one skyline house per
 * repository with its district, plus the plaque's own primary language: the only inputs the plaque rule reads. */
export function cardCityName(summary, login) {
  const houses = summary && Array.isArray(summary.skyline) ? summary.skyline : [];
  const lang = summary && typeof summary.language === 'string' ? summary.language : null;
  return homecomingCityName(houses.map((house, index) => ({ repo: `house-${index}`, zone: house && house.zone, lang })), login);
}

/* Today's UTC day as YYYYMMDD. */
export function cardDay(nowMs) {
  return new Date(Math.floor(nowMs / DAY_MS) * DAY_MS).toISOString().slice(0, 10).replace(/-/g, '');
}

/* The `d=` cache buster: a real YYYYMMDD from yesterday to tomorrow (UTC) is kept; anything else becomes today. */
export function normalizeCardDay(value, nowMs) {
  const today = cardDay(nowMs);
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) return today;
  const ms = Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)));
  if (!Number.isFinite(ms) || cardDay(ms) !== value) return today;
  const start = Math.floor(nowMs / DAY_MS) * DAY_MS;
  return ms >= start - DAY_MS && ms <= start + DAY_MS ? value : today;
}

class Oversized extends Error {}

async function readCapped(response, maxBytes) {
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Oversized();
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => {});
      throw new Oversized();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

/* One GitHub request for `login` (two when the token is refused). Resolves to { summary } for a town with houses,
 * otherwise to { failure } with 'not-found', 'empty', 'github' (any other status), 'malformed', 'oversized' or
 * 'network', plus tokenRejected when GitHub answered 401 to the token. Never rejects. The token, when set, goes only to
 * api.github.com: redirects are not followed. */
export async function fetchTownCard(login, { token = '', fetchImpl, timeoutMs = TOWN_CARD_LIMITS.timeoutMs,
  maxBytes = TOWN_CARD_LIMITS.maxBytes } = {}) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': GITHUB_USER_AGENT, 'x-github-api-version': '2022-11-28' };
  const auth = typeof token === 'string' && token.trim() ? `Bearer ${token.trim()}` : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const ask = withToken => fetchImpl(townRequestUrl(login),
    { headers: withToken ? { ...headers, authorization: auth } : { ...headers }, redirect: 'manual', signal: controller.signal });
  const drop = response => { if (response.body) response.body.cancel().catch(() => {}); };
  let tokenRejected = false;
  const result = outcome => (tokenRejected ? { ...outcome, tokenRejected } : outcome);
  try {
    let response = await ask(Boolean(auth));
    if (response.status === 401 && auth) {
      // An expired or revoked token: this public page needs none, so ask once more without it.
      tokenRejected = true;
      drop(response);
      response = await ask(false);
    }
    if (response.status !== 200) {
      drop(response);
      return result({ failure: response.status === 404 ? 'not-found' : 'github' });
    }
    let raw;
    try { raw = JSON.parse(await readCapped(response, maxBytes)); }
    catch (error) { return result({ failure: error instanceof Oversized ? 'oversized' : controller.signal.aborted ? 'network' : 'malformed' }); }
    if (!Array.isArray(raw)) return result({ failure: 'malformed' });
    let summary;
    try { summary = townCardSummary(raw, login); } catch (error) { return result({ failure: 'malformed' }); }
    return result(summary.repos > 0 ? { summary } : { failure: 'empty' });
  } catch (error) {
    return result({ failure: 'network' });
  } finally {
    clearTimeout(timer);
  }
}
