export const CONTRIBUTION_QUEST_LIMITS = Object.freeze({
  maxItems: 50,
  maxQuests: 3,
  maxPerRepo: 2,
  maxTitleLength: 180,
  maxLabelLength: 50,
  maxLabels: 8
});

const LOGIN_RE = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;

function text(value, limit) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);
}

function timestamp(value) {
  const result = Date.parse(String(value || ''));
  return Number.isFinite(result) ? result : 0;
}

function nonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function repositoryIdentity(value) {
  try {
    const url = new URL(String(value || ''));
    const parts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
    if (url.protocol !== 'https:' || url.hostname !== 'api.github.com' || parts.length !== 3 || parts[0] !== 'repos') return null;
    if (!LOGIN_RE.test(parts[1]) || !REPO_RE.test(parts[2])) return null;
    return Object.freeze({ owner: parts[1], repo: parts[2] });
  } catch (error) {
    return null;
  }
}

function labelNames(value) {
  const seen = new Set();
  const labels = [];
  for (const item of Array.isArray(value) ? value : []) {
    const label = text(typeof item === 'string' ? item : item?.name, CONTRIBUTION_QUEST_LIMITS.maxLabelLength);
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length === CONTRIBUTION_QUEST_LIMITS.maxLabels) break;
  }
  return Object.freeze(labels);
}

function questTier(labels) {
  const keys = new Set(labels.map(label => label.toLowerCase()));
  if (keys.has('good first issue')) return 'good-first';
  if (keys.has('help wanted')) return 'help-wanted';
  return 'open';
}

export function createContributionQuestSearchUrl(owner) {
  const login = text(owner, 39).replace(/^@+/, '');
  if (!LOGIN_RE.test(login)) throw new TypeError('Contribution quests require a valid GitHub username.');
  const url = new URL('https://api.github.com/search/issues');
  url.searchParams.set('q', `user:${login} is:issue is:open`);
  url.searchParams.set('per_page', String(CONTRIBUTION_QUEST_LIMITS.maxItems));
  url.searchParams.set('sort', 'updated');
  url.searchParams.set('order', 'desc');
  return url.toString();
}

export function projectContributionQuest(raw, owner, catalog = []) {
  const login = text(owner, 39).replace(/^@+/, '');
  if (!LOGIN_RE.test(login) || raw?.pull_request || raw?.state !== 'open') return null;
  const available = new Map();
  for (const value of Array.isArray(catalog) ? catalog : []) {
    const name = text(typeof value === 'string' ? value : value?.repo, 100);
    if (REPO_RE.test(name) && !available.has(name.toLowerCase())) available.set(name.toLowerCase(), name);
  }
  const identity = repositoryIdentity(raw?.repository_url);
  const repo = identity && identity.owner.toLowerCase() === login.toLowerCase()
    ? available.get(identity.repo.toLowerCase())
    : '';
  const number = Number(raw?.number);
  const title = text(raw?.title, CONTRIBUTION_QUEST_LIMITS.maxTitleLength);
  const updatedAt = timestamp(raw?.updated_at);
  if (!repo || !Number.isSafeInteger(number) || number < 1 || !title || !updatedAt) return null;
  const labels = labelNames(raw.labels);
  return Object.freeze({
    owner: login,
    repo,
    number,
    title,
    url: `https://github.com/${encodeURIComponent(login)}/${encodeURIComponent(repo)}/issues/${number}`,
    labels,
    tier: questTier(labels),
    comments: nonNegative(raw.comments),
    assigned: !!raw.assignee,
    createdAt: timestamp(raw.created_at),
    updatedAt
  });
}

export function selectContributionQuests(rawItems, owner, catalog = []) {
  const priorities = Object.freeze({ 'good-first': 3, 'help-wanted': 2, open: 1 });
  const projected = (Array.isArray(rawItems) ? rawItems : [])
    .slice(0, CONTRIBUTION_QUEST_LIMITS.maxItems)
    .map(item => projectContributionQuest(item, owner, catalog))
    .filter(Boolean)
    .sort((a, b) => priorities[b.tier] - priorities[a.tier]
      || Number(a.assigned) - Number(b.assigned)
      || b.updatedAt - a.updatedAt
      || a.repo.localeCompare(b.repo)
      || a.number - b.number);
  const counts = new Map();
  const quests = [];
  for (const quest of projected) {
    const key = quest.repo.toLowerCase();
    if ((counts.get(key) || 0) >= CONTRIBUTION_QUEST_LIMITS.maxPerRepo) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
    quests.push(quest);
    if (quests.length === CONTRIBUTION_QUEST_LIMITS.maxQuests) break;
  }
  return Object.freeze(quests);
}
