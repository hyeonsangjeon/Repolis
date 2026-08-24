export const FORK_LINEAGE_PALETTE = Object.freeze([
  0x6f9f86,
  0x7897b8,
  0xa184b5,
  0xb18a62,
  0x8b9c68,
  0xb17b7b,
]);

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

function normalizeRepoName(value) {
  if (typeof value !== 'string' || value.split('/').length !== 2) return null;
  const [owner, repo] = value.trim().split('/');
  return OWNER_RE.test(owner) && REPO_RE.test(repo) ? `${owner}/${repo}` : null;
}

function canonicalGithubUrl(value, expectedName) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.hostname !== 'github.com'
      || url.username || url.password || url.port || url.search || url.hash) return null;
    const pathName = normalizeRepoName(url.pathname.replace(/^\/+|\/+$/g, ''));
    return pathName && pathName.toLowerCase() === expectedName.toLowerCase()
      ? `https://github.com/${expectedName}` : null;
  } catch (_) {
    return null;
  }
}

export function forkLineagePaletteIndex(source, paletteSize = FORK_LINEAGE_PALETTE.length) {
  const size = Number.isInteger(paletteSize) && paletteSize > 0 ? paletteSize : FORK_LINEAGE_PALETTE.length;
  let hash = 2166136261;
  for (const character of String(source || '').toLowerCase()) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % size;
}

export function projectForkLineage(repo) {
  if (!repo || repo.fork !== true || !repo.lineage || typeof repo.lineage !== 'object') return null;
  const source = normalizeRepoName(repo.lineage.source);
  const url = source && canonicalGithubUrl(repo.lineage.url, source);
  const owner = normalizeRepoName(`${repo._owner || ''}/${repo.repo || ''}`);
  if (!source || !url || (owner && source.toLowerCase() === owner.toLowerCase())) return null;
  return Object.freeze({
    source,
    url,
    paletteIndex: forkLineagePaletteIndex(source),
  });
}
