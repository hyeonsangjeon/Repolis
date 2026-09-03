const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const DAY_MS = 86400000;

function text(value, limit) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function safeAvatar(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' && url.hostname === 'avatars.githubusercontent.com' ? url.href : '';
  } catch (error) {
    return '';
  }
}

function timestamp(value) {
  const result = Date.parse(String(value || ''));
  return Number.isFinite(result) ? result : 0;
}

export function selectTownCreatorFields(raw = {}) {
  const login = text(raw.login, 39);
  if (!LOGIN_RE.test(login)) throw new TypeError('invalid-github-login');
  return Object.freeze({
    login,
    name: text(raw.name, 100),
    bio: text(raw.bio, 280),
    company: text(raw.company, 100),
    location: text(raw.location, 100),
    avatarUrl: safeAvatar(raw.avatarUrl || raw.avatar_url),
    followers: nonNegative(raw.followers),
    following: nonNegative(raw.following),
    publicRepos: nonNegative(raw.publicRepos ?? raw.public_repos),
    createdAt: timestamp(raw.createdAt || raw.created_at) ? new Date(timestamp(raw.createdAt || raw.created_at)).toISOString() : ''
  });
}

export function summarizeTownCreator(profile, repos = [], nowMs = Date.now(), options = {}) {
  const selected = selectTownCreatorFields({
    login: profile?.login,
    name: profile?.name,
    bio: profile?.bio,
    company: profile?.company,
    location: profile?.location,
    avatar_url: profile?.avatarUrl || profile?.avatar_url,
    followers: profile?.followers,
    following: profile?.following,
    public_repos: profile?.publicRepos ?? profile?.public_repos,
    created_at: profile?.createdAt || profile?.created_at
  });
  const list = Array.isArray(repos) ? repos.filter(Boolean) : [];
  const languages = new Map();
  let stars = 0, forks = 0, latestPush = 0;

  for (const repo of list) {
    stars = Math.min(Number.MAX_SAFE_INTEGER, stars + nonNegative(repo.stars));
    forks = Math.min(Number.MAX_SAFE_INTEGER, forks + nonNegative(repo.forks));
    latestPush = Math.max(latestPush, timestamp(repo.pushed || repo.updated || repo.created));
    const language = text(repo.lang, 40);
    if (language && language !== 'Other' && language !== '\u2014') {
      languages.set(language, (languages.get(language) || 0) + 1);
    }
  }
  const requestedPublicStars = Number(options?.publicStars);
  const publicStars = options?.publicStars !== null && options?.publicStars !== undefined
    && options?.publicStars !== '' && Number.isFinite(requestedPublicStars)
    ? Math.max(stars, nonNegative(requestedPublicStars))
    : stars;

  const topLanguages = [...languages.entries()]
    .map(([name, count]) => Object.freeze({ name, count }))
    .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name))
    .slice(0, 4);
  const signatureRepos = list.slice()
    .filter(repo => text(repo.repo, 100))
    .sort((a, b) => nonNegative(b.stars) - nonNegative(a.stars)
      || nonNegative(b.forks) - nonNegative(a.forks)
      || timestamp(b.pushed || b.updated) - timestamp(a.pushed || a.updated)
      || text(a.repo, 100).localeCompare(text(b.repo, 100)))
    .slice(0, 3)
    .map(repo => Object.freeze({
      name: text(repo.repo, 100),
      description: text(repo.desc, 180),
      language: text(repo.lang, 40),
      stars: nonNegative(repo.stars),
      forks: nonNegative(repo.forks),
      url: `https://github.com/${selected.login}/${encodeURIComponent(text(repo.repo, 100))}`
    }));
  const now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const createdAt = timestamp(selected.createdAt);
  const years = createdAt ? Math.max(0, Math.floor((now - createdAt) / (365.2425 * DAY_MS))) : 0;
  const badges = [];
  if (list.length >= 10 || selected.publicRepos >= 10) badges.push('builder');
  if (topLanguages.length >= 4) badges.push('polyglot');
  if (latestPush && now - latestPush <= 90 * DAY_MS) badges.push('maintainer');
  if (publicStars >= 100) badges.push('starred');
  if (years >= 5) badges.push('veteran');

  return Object.freeze({
    ...selected,
    displayName: selected.name || selected.login,
    profileUrl: `https://github.com/${selected.login}`,
    townRepos: list.length,
    townStars: stars,
    publicStars,
    townForks: forks,
    years,
    joinedYear: createdAt ? new Date(createdAt).getUTCFullYear() : null,
    topLanguages: Object.freeze(topLanguages),
    signatureRepos: Object.freeze(signatureRepos),
    badges: Object.freeze(badges.slice(0, 4))
  });
}
