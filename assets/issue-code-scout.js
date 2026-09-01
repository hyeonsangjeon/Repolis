export const ISSUE_CODE_SCOUT_LIMITS = Object.freeze({
  maxCandidates: 5,
  maxTitleLength: 180,
  maxLabels: 8,
  maxLabelLength: 50,
  maxPathLength: 1024,
});

const LOGIN_RE = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPO_RE = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;
const ENCODED_PATH_RE = /%(?:2e|2f|5c)/i;
const TOKEN_RE = /[\p{L}\p{N}]+/gu;
const GENERIC_TOKENS = new Set([
  'add', 'app', 'application', 'automation', 'bug', 'change', 'changes', 'code', 'component', 'document',
  'enhancement', 'feature', 'file', 'files', 'first', 'fix', 'folder', 'good', 'help', 'improve', 'issue',
  'manifest', 'module', 'path', 'paths', 'project', 'readme', 'repo', 'repository', 'source', 'support', 'task',
  'update', 'wanted',
]);
const SHORT_TOKENS = new Set(['ai', 'api', 'cli', 'css', 'gpu', 'ios', 'jwt', 'llm', 'mcp', 'rag', 'sdk', 'sql', 'stt', 'ui', 'ux']);

function immutable(value) {
  if (Array.isArray(value)) value.forEach(immutable);
  else if (value && typeof value === 'object') Object.values(value).forEach(immutable);
  return Object.freeze(value);
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function invalid(reason) {
  return immutable({ ok: false, reason, candidates: [], limits: ISSUE_CODE_SCOUT_LIMITS });
}

function validPath(path) {
  if (typeof path !== 'string' || !path || path.length > ISSUE_CODE_SCOUT_LIMITS.maxPathLength
    || CONTROL_RE.test(path) || path.startsWith('/') || path.endsWith('/') || path.includes('//')
    || /^[A-Za-z]:\//.test(path) || path.includes('\\') || ENCODED_PATH_RE.test(path)) return false;
  return path.split('/').every(segment => segment && segment !== '.' && segment !== '..');
}

function tokenize(value) {
  const expanded = String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').normalize('NFKC').toLowerCase();
  const seen = new Set(), tokens = [];
  for (const token of expanded.match(TOKEN_RE) || []) {
    if (GENERIC_TOKENS.has(token) || (token.length < 3 && !SHORT_TOKENS.has(token)) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

function questInput(value) {
  if (!value || typeof value !== 'object') return null;
  const owner = String(value.owner || ''), repo = String(value.repo || ''), title = String(value.title || '');
  const number = Number(value.number);
  if (!LOGIN_RE.test(owner) || !REPO_RE.test(repo) || !Number.isSafeInteger(number) || number < 1
    || !title || title.length > ISSUE_CODE_SCOUT_LIMITS.maxTitleLength || CONTROL_RE.test(title)) return null;
  const labels = [];
  for (const raw of Array.isArray(value.labels) ? value.labels.slice(0, ISSUE_CODE_SCOUT_LIMITS.maxLabels) : []) {
    const label = String(raw || '');
    if (!label || label.length > ISSUE_CODE_SCOUT_LIMITS.maxLabelLength || CONTROL_RE.test(label)) return null;
    labels.push(label);
  }
  return { owner, repo, repoName: `${owner}/${repo}`, number, title, labels };
}

function projectionTarget(value) {
  const repoName = String(value?.target?.repoName || '');
  const parts = repoName.split('/');
  return parts.length === 2 && LOGIN_RE.test(parts[0]) && REPO_RE.test(parts[1])
    ? { owner: parts[0], repo: parts[1], repoName } : null;
}

function normalizedNodes(projection) {
  if (!Array.isArray(projection?.nodes)) return null;
  const sorted = projection.nodes.map(node => {
    if (!node || !validPath(node.path) || (node.type !== 'folder' && node.type !== 'file')) return null;
    const segments = node.path.split('/');
    return {
      path: node.path,
      type: node.type,
      category: String(node.category || ''),
      depth: Number.isInteger(node.depth) && node.depth > 0 ? node.depth : segments.length,
      group: String(node.group || segments[0] || ''),
      label: String(node.label || segments.at(-1) || ''),
    };
  });
  if (sorted.some(node => node === null)) return null;
  sorted.sort((a, b) => compareText(a.path, b.path) || compareText(a.type, b.type)
    || compareText(a.category, b.category) || a.depth - b.depth);
  const unique = new Map();
  for (const node of sorted) if (!unique.has(node.path)) unique.set(node.path, node);
  return [...unique.values()];
}

function issueTokens(quest) {
  const title = tokenize(quest.title).map(token => ({ token, weight: 6, source: 'title' }));
  const titleKeys = new Set(title.map(item => item.token));
  const labels = quest.labels.flatMap(tokenize)
    .filter(token => !titleKeys.has(token))
    .map(token => ({ token, weight: 4, source: 'label' }));
  return [...title, ...labels];
}

function candidate(node, tokens) {
  const all = new Set(tokenize(`${node.path} ${node.label} ${node.group} ${node.category} ${node.type}`));
  const basename = new Set(tokenize(node.label));
  const root = new Set(tokenize(node.path.split('/')[0]));
  const evidence = [];
  let score = 0, titleMatches = 0;
  for (const item of tokens) {
    if (!all.has(item.token)) continue;
    let weight = item.weight;
    if (basename.has(item.token)) weight += 3;
    if (root.has(item.token)) weight += 2;
    score += weight;
    if (item.source === 'title') titleMatches += 1;
    evidence.push(item.token);
  }
  if (!evidence.length || score < 6) return null;
  return { path: node.path, type: node.type, category: node.category, depth: node.depth, score, titleMatches, evidence };
}

export function scoutIssueCodePaths(questValue, projection) {
  const quest = questInput(questValue), target = projectionTarget(projection);
  if (!quest) return invalid('quest');
  if (!target) return invalid('projection');
  if (quest.repoName.toLowerCase() !== target.repoName.toLowerCase()) return invalid('scope_mismatch');
  const nodes = normalizedNodes(projection);
  if (!nodes) return invalid('unsafe_path');
  const tokens = issueTokens(quest);
  if (!tokens.length) return immutable({
    ok: true, reason: 'no_match', repoName: target.repoName, issueNumber: quest.number,
    candidates: [], limits: ISSUE_CODE_SCOUT_LIMITS,
  });
  const candidates = nodes.map(node => candidate(node, tokens)).filter(Boolean)
    .sort((a, b) => b.score - a.score || b.titleMatches - a.titleMatches || a.depth - b.depth
      || (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || compareText(a.path, b.path))
    .slice(0, ISSUE_CODE_SCOUT_LIMITS.maxCandidates)
    .map(({ titleMatches, ...value }) => value);
  return immutable({
    ok: true,
    reason: candidates.length ? 'ready' : 'no_match',
    repoName: target.repoName,
    issueNumber: quest.number,
    candidates,
    limits: ISSUE_CODE_SCOUT_LIMITS,
  });
}
