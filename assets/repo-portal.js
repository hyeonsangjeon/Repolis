export const REPO_PORTAL_LIMITS = Object.freeze({
  cacheVersion: 1,
  cacheTtlMs: 15 * 60 * 1000,
  cacheMaxBytes: 512 * 1024,
  cacheMaxEntries: 30,
});

export const GITHUB_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
export const GITHUB_REPO_RE = /^[A-Za-z0-9_.-]{1,100}$/;

const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const ENCODED_PATH_RE = /%(?:2e|2f|5c)/i;
const TRAVERSAL_RE = /(?:^|\/)\.{1,2}(?:\/|$)/;

function invalid(reason) {
  return Object.freeze({ ok: false, reason });
}

function validLogin(value) {
  return GITHUB_LOGIN_RE.test(value);
}

function validRepo(value) {
  return GITHUB_REPO_RE.test(value) && value !== '.' && value !== '..';
}

function cleanRepo(value) {
  return String(value || '').replace(/\.git$/i, '');
}

function targetResult(owner, repo, source) {
  const slug = `${owner}/${repo}`;
  return Object.freeze({ ok: true, kind: 'repo', owner, repo, slug, source });
}

function userResult(user, source) {
  return Object.freeze({ ok: true, kind: 'user', user, source });
}

function parsePathParts(parts, source) {
  if (parts.length === 1 && validLogin(parts[0])) return userResult(parts[0], source);
  if (parts.length !== 2) return invalid('shape');
  const owner = parts[0], repo = cleanRepo(parts[1]);
  if (!validLogin(owner) || !validRepo(repo)) return invalid('shape');
  return targetResult(owner, repo, source);
}

export function parseRepoPortalInput(value) {
  if (typeof value !== 'string') return invalid('empty');
  let input = value.trim();
  if (!input) return invalid('empty');
  if (input.length > 320 || CONTROL_RE.test(input) || /\s/.test(input)) return invalid('unsafe');

  const looksLikeUrl = /^https?:\/\//i.test(input) || /^(?:www\.)?github\.com\//i.test(input);
  if (looksLikeUrl) {
    const urlInput = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    const pathProbe = urlInput.replace(/^https?:\/\/(?:www\.)?github\.com/i, '').replace(/[?#].*$/, '');
    if (ENCODED_PATH_RE.test(pathProbe) || TRAVERSAL_RE.test(pathProbe) || /\\/.test(pathProbe)) return invalid('unsafe');
    let url;
    try { url = new URL(urlInput); } catch (_) { return invalid('url'); }
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || host !== 'github.com'
      || url.username || url.password || url.port || url.search || url.hash) return invalid('host');
    let path;
    try { path = decodeURIComponent(url.pathname); } catch (_) { return invalid('unsafe'); }
    if (CONTROL_RE.test(path) || /\\/.test(path) || TRAVERSAL_RE.test(path)) return invalid('unsafe');
    const parts = path.split('/').filter(Boolean);
    return parsePathParts(parts, 'url');
  }

  if (input.includes('?') || input.includes('#') || input.includes('\\') || ENCODED_PATH_RE.test(input)
    || TRAVERSAL_RE.test(input)) return invalid('unsafe');
  input = input.replace(/^@+/, '').replace(/\/+$/, '');
  const parts = input.split('/').filter(Boolean);
  return parsePathParts(parts, parts.length === 1 ? 'user' : 'slug');
}

function repoTarget(value) {
  const parsed = typeof value === 'string' ? parseRepoPortalInput(value) : value;
  if (!parsed || parsed.ok !== true || parsed.kind !== 'repo') throw new TypeError('A valid owner/repo target is required');
  return parsed;
}

function cleanBase(baseUrl) {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  return `${url.origin}${url.pathname}`;
}

export function createRepoPortalUrl(value, baseUrl) {
  const target = repoTarget(value);
  return `${cleanBase(baseUrl)}?repo=${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}&ref=repo-portal`;
}

export function createRepoOwnerTownUrl(value, baseUrl, projectOwner = '') {
  const target = repoTarget(value);
  const params = [];
  if (target.owner.toLowerCase() !== String(projectOwner || '').toLowerCase()) {
    params.push(`user=${encodeURIComponent(target.owner)}`);
  }
  params.push(`focus=${encodeURIComponent(target.repo)}`, 'ref=repo-portal');
  return `${cleanBase(baseUrl)}?${params.join('&')}`;
}

export function resolveRepoPortalRequest(search, projectOwner) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  if (params.has('repo')) {
    const target = parseRepoPortalInput(params.get('repo') || '');
    if (!target.ok || target.kind !== 'repo') {
      return Object.freeze({ mode: 'portal', target: null, focus: null, error: target.reason || 'shape', repoWins: true });
    }
    return Object.freeze({ mode: 'portal', target, focus: null, error: null, repoWins: true });
  }

  const requestedUser = String(params.get('user') || '').trim().replace(/^@+/, '');
  const owner = String(projectOwner || '');
  const isPublic = validLogin(requestedUser) && requestedUser.toLowerCase() !== owner.toLowerCase();
  const activeOwner = isPublic ? requestedUser : owner;
  const focusValue = String(params.get('focus') || '').trim();
  const focus = focusValue ? parseRepoPortalInput(`${activeOwner}/${focusValue}`) : null;
  return Object.freeze({
    mode: isPublic ? 'public' : 'owner',
    target: null,
    focus: focus && focus.ok && focus.kind === 'repo' ? focus : null,
    error: null,
    repoWins: false,
  });
}

function cleanText(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function safeHomepage(value) {
  try {
    const url = new URL(String(value || ''));
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : '';
  } catch (_) { return ''; }
}

export function projectPublicRepo(raw, expectedOwner, nowMs = Date.now()) {
  if (!raw || typeof raw !== 'object' || raw.private === true || raw.disabled === true) return null;
  const apiOwner = cleanText(raw.owner && raw.owner.login, 39);
  const owner = cleanText(expectedOwner || apiOwner, 39);
  const repo = cleanRepo(cleanText(raw.name, 100));
  if (!validLogin(owner) || !validRepo(repo)) return null;
  if (apiOwner && apiOwner.toLowerCase() !== owner.toLowerCase()) return null;
  if (raw.full_name && String(raw.full_name).toLowerCase() !== `${owner}/${repo}`.toLowerCase()) return null;

  const pushed = cleanText(raw.pushed_at || raw.updated_at || raw.created_at, 40);
  const pushedMs = Date.parse(pushed);
  const ageDays = Number.isFinite(pushedMs) ? Math.max(0, (nowMs - pushedMs) / 86400000) : 3650;
  const recency = Math.max(0, 1 - Math.min(ageDays, 365) / 365);
  const license = raw.license && raw.license.spdx_id !== 'NOASSERTION'
    ? cleanText(raw.license.spdx_id, 40) : '';
  const stars = count(raw.stargazers_count), forks = count(raw.forks_count);

  return {
    repo,
    desc: cleanText(raw.description, 500),
    lang: cleanText(raw.language, 50) || 'Other',
    topics: Array.isArray(raw.topics) ? raw.topics.map(topic => cleanText(topic, 50)).filter(Boolean).slice(0, 24) : [],
    url: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    home: safeHomepage(raw.homepage),
    stars,
    forks,
    fork: raw.fork === true,
    views: null,
    visitors: null,
    clones: null,
    trafficKnown: false,
    trafficSource: 'unavailable',
    size: count(raw.size),
    open_issues: count(raw.open_issues_count),
    license,
    archived: raw.archived === true,
    default_branch: cleanText(raw.default_branch, 100) || 'main',
    release_tag: '',
    release_date: null,
    created: cleanText(raw.created_at, 40),
    pushed,
    updated: cleanText(raw.updated_at, 40),
    tracked: false,
    first_seen: '',
    social: '',
    social_custom: '',
    score: Math.log1p(stars) * 3 + Math.log1p(forks) * 1.6 + recency * 2.4 + Math.log1p(count(raw.open_issues_count)) * 0.3,
    rank: 0,
    _owner: owner,
    public_mode: true,
    _recency: recency,
  };
}

export function projectPublicRepos(raw, owner, nowMs = Date.now()) {
  const repos = (Array.isArray(raw) ? raw : []).map(repo => projectPublicRepo(repo, owner, nowMs)).filter(Boolean);
  repos.sort((a, b) => (b.score - a.score) || (b.stars - a.stars) || a.repo.localeCompare(b.repo));
  repos.forEach((repo, index) => { repo.rank = index; });
  return repos;
}

export function repoPortalLatencyBucket(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value < 0) return 'unknown';
  if (value < 1000) return 'under-1s';
  if (value < 3000) return '1-3s';
  if (value < 10000) return '3-10s';
  return '10s-plus';
}
