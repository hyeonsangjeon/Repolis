export const REPO_ROUTE_LIMITS = Object.freeze({
  minStops: 2,
  maxStops: 3,
  maxRepoLength: 100
});

const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const LOGIN_RE = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const CONFLICT_KEYS = Object.freeze(['repo', 'focus', 'growth', 'twin']);

function cleanRepoName(value) {
  const name = String(value || '').trim();
  if (!REPO_RE.test(name) || name === '.' || name === '..') return '';
  return name;
}

export function normalizeRepoRouteNames(values, catalog = []) {
  const source = Array.isArray(values) ? values : String(values || '').split(',');
  const requireCatalogMatch = arguments.length > 1;
  const available = new Map();
  for (const value of Array.isArray(catalog) ? catalog : []) {
    const name = cleanRepoName(value);
    if (name && !available.has(name.toLowerCase())) available.set(name.toLowerCase(), name);
  }
  const seen = new Set();
  const route = [];
  for (const value of source) {
    const clean = cleanRepoName(value);
    const canonical = clean && (available.get(clean.toLowerCase()) || (!requireCatalogMatch ? clean : ''));
    const key = canonical.toLowerCase();
    if (!canonical || seen.has(key)) continue;
    seen.add(key);
    route.push(canonical);
    if (route.length === REPO_ROUTE_LIMITS.maxStops) break;
  }
  return Object.freeze(route);
}

export function resolveRepoRouteRequest(search, catalog = []) {
  const params = new URLSearchParams(String(search || '').replace(/^[^?]*\?/, '').split('#')[0]);
  const routeValues = params.getAll('route');
  const requested = routeValues.length > 0;
  const ambiguous = routeValues.length > 1;
  const conflict = CONFLICT_KEYS.find(key => params.has(key)) || '';
  const raw = requested && !ambiguous ? routeValues[0] || '' : '';
  const requestedCount = raw ? raw.split(',').length : 0;
  const repos = conflict || ambiguous ? Object.freeze([]) : normalizeRepoRouteNames(raw, catalog);
  const countValid = requestedCount >= REPO_ROUTE_LIMITS.minStops && requestedCount <= REPO_ROUTE_LIMITS.maxStops;
  const valid = requested && !ambiguous && !conflict && countValid && repos.length === requestedCount;
  const reason = !requested ? 'missing' : ambiguous ? 'ambiguous' : conflict ? 'conflict' :
    requestedCount > REPO_ROUTE_LIMITS.maxStops ? 'overflow' : valid ? 'ready' : 'insufficient';
  return Object.freeze({
    requested,
    valid,
    reason,
    conflict,
    requestedCount,
    repos
  });
}

export function createRepoRouteUrl(user, repos, baseUrl, owner = '') {
  const login = String(user || '').trim().replace(/^@+/, '');
  const townOwner = String(owner || '').trim().replace(/^@+/, '');
  if (!LOGIN_RE.test(login)) throw new TypeError('Repo Route requires a valid GitHub username.');
  const candidates = Array.isArray(repos) ? repos : String(repos || '').split(',');
  const route = normalizeRepoRouteNames(candidates);
  if (route.length < REPO_ROUTE_LIMITS.minStops || route.length !== candidates.length) {
    throw new RangeError(`Repo Route requires ${REPO_ROUTE_LIMITS.minStops}-${REPO_ROUTE_LIMITS.maxStops} repositories.`);
  }
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  if (!townOwner || login.toLowerCase() !== townOwner.toLowerCase()) url.searchParams.set('user', login);
  url.searchParams.set('route', route.join(','));
  url.searchParams.set('ref', 'repo-route');
  return url.toString();
}
