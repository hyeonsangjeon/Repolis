function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

export function summarizePublicTown(user, repos = []) {
  const login = String(user || '').trim();
  const list = Array.isArray(repos) ? repos.filter(Boolean) : [];
  const languages = new Set();
  let stars = 0;

  for (const repo of list) {
    stars = Math.min(Number.MAX_SAFE_INTEGER, stars + nonNegative(repo.stars));
    const language = String(repo.lang || '').trim();
    if (language && language !== 'Other' && language !== '\u2014') languages.add(language);
  }

  const topRepos = list.slice()
    .filter(repo => String(repo.repo || '').trim())
    .sort((a, b) => nonNegative(b.stars) - nonNegative(a.stars)
      || nonNegative(b.forks) - nonNegative(a.forks)
      || String(a.repo).localeCompare(String(b.repo)))
    .slice(0, 3)
    .map(repo => String(repo.repo).trim());

  return Object.freeze({
    user: login,
    count: list.length,
    stars,
    languages: languages.size,
    topRepos: Object.freeze(topRepos)
  });
}
