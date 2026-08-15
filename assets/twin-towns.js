const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const DEFAULT_BASE = 'https://hyeonsangjeon.github.io/Repolis/';

function normalizeLogin(value) {
  const login = String(value || '').trim().replace(/^@+/, '');
  if (!GITHUB_LOGIN.test(login)) throw new TypeError('invalid-github-login');
  return login;
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function rankedLabels(repos, field, limit = 6) {
  const labels = new Map();
  for (const repo of repos) {
    const values = field === 'topics' ? repo?.topics : [repo?.lang];
    for (const raw of Array.isArray(values) ? values : []) {
      const label = String(raw || '').trim();
      if (!label || label === 'Other' || label === '\u2014') continue;
      const key = label.toLowerCase();
      const current = labels.get(key) || { key, name: label, count: 0 };
      current.count++;
      if (label.localeCompare(current.name) < 0) current.name = label;
      labels.set(key, current);
    }
  }
  return [...labels.values()]
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(item => Object.freeze(item));
}

function sharedLabels(left, right, limit = 3) {
  const rightByKey = new Map(right.map(item => [item.key, item]));
  return left
    .filter(item => rightByKey.has(item.key))
    .map(item => Object.freeze({
      key: item.key,
      name: item.name,
      count: item.count + rightByKey.get(item.key).count
    }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function summarizeTwinTown(user, repos = []) {
  const login = normalizeLogin(user);
  const list = Array.isArray(repos) ? repos.filter(Boolean) : [];
  const ranked = list.slice().sort((a, b) => nonNegative(b?.stars) - nonNegative(a?.stars)
    || nonNegative(b?.forks) - nonNegative(a?.forks)
    || String(a?.repo || '').localeCompare(String(b?.repo || '')));
  const top = ranked.find(repo => String(repo?.repo || '').trim());
  const languages = rankedLabels(list, 'languages');
  const topics = rankedLabels(list, 'topics');

  return Object.freeze({
    user: login,
    repos: list.length,
    stars: list.reduce((sum, repo) => Math.min(Number.MAX_SAFE_INTEGER, sum + nonNegative(repo?.stars)), 0),
    forks: list.reduce((sum, repo) => Math.min(Number.MAX_SAFE_INTEGER, sum + nonNegative(repo?.forks)), 0),
    languages: Object.freeze(languages),
    topics: Object.freeze(topics),
    topRepo: top ? Object.freeze({
      name: String(top.repo).trim(),
      stars: nonNegative(top.stars),
      forks: nonNegative(top.forks)
    }) : null
  });
}

export function createTwinTownMatch(leftUser, leftRepos, rightUser, rightRepos) {
  const left = summarizeTwinTown(leftUser, leftRepos);
  const right = summarizeTwinTown(rightUser, rightRepos);
  if (left.user.toLowerCase() === right.user.toLowerCase()) throw new TypeError('same-github-login');

  const sharedTopics = sharedLabels(left.topics, right.topics);
  const sharedLanguages = sharedLabels(left.languages, right.languages);
  const bridgeKind = sharedTopics.length ? 'topics' : (sharedLanguages.length ? 'languages' : 'contrast');
  const bridgeItems = bridgeKind === 'topics' ? sharedTopics : (bridgeKind === 'languages' ? sharedLanguages : []);

  return Object.freeze({
    left,
    right,
    bridgeKind,
    bridgeItems: Object.freeze(bridgeItems),
    sharedTopics: Object.freeze(sharedTopics),
    sharedLanguages: Object.freeze(sharedLanguages),
    combinedRepos: left.repos + right.repos,
    combinedStars: Math.min(Number.MAX_SAFE_INTEGER, left.stars + right.stars)
  });
}

export function createTwinTownLink(leftUser, rightUser, baseUrl = DEFAULT_BASE) {
  const left = normalizeLogin(leftUser).toLowerCase();
  const right = normalizeLogin(rightUser).toLowerCase();
  if (left === right) throw new TypeError('same-github-login');

  let url;
  try { url = new URL(String(baseUrl || DEFAULT_BASE)); }
  catch (error) { url = new URL(DEFAULT_BASE); }
  if (!/^https?:$/.test(url.protocol)) url = new URL(DEFAULT_BASE);
  url.search = '';
  url.hash = '';
  if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -10);
  else if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.searchParams.set('user', left);
  url.searchParams.set('twin', right);
  url.searchParams.set('ref', 'twin-town');
  return url.href;
}
