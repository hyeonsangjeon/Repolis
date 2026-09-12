export const REPOSITORY_ATELIER_CHAT_LIMIT = 5;
// The existing Worker fetch budget is 25 seconds; allow transport/body overhead without extending it.
export const REPOSITORY_ATELIER_CHAT_TIMEOUT_MS = 30000;

const REPO_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/;

function cleanText(value, max = 600) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validRepositoryAtelierRepoName(value) {
  const repoName = String(value || '');
  if (!REPO_NAME_RE.test(repoName)) return false;
  const repo = repoName.split('/')[1];
  return repo !== '.' && repo !== '..';
}

export function createRepositoryAtelierChatVisit(repoName) {
  if (!validRepositoryAtelierRepoName(repoName)) throw new TypeError('A valid owner/repo is required');
  return {
    repoName,
    calls: 0,
    history: [],
    panelOpen: false,
    autoStarted: false,
    limitShown: false,
    sequence: 0,
    controller: null,
    cancelled: false,
    lastFailure: null,
  };
}

export function setRepositoryAtelierChatPanel(visit, open) {
  if (!visit) return false;
  visit.panelOpen = open === true;
  return visit.panelOpen;
}

export function beginRepositoryAtelierChatCall(visit) {
  if (!visit || visit.cancelled || visit.calls >= REPOSITORY_ATELIER_CHAT_LIMIT) return null;
  visit.calls += 1;
  visit.sequence += 1;
  visit.lastFailure = null;
  return { sequence: visit.sequence, call: visit.calls };
}

export function repositoryAtelierChatResponseFailure(status, data, repoName) {
  const httpFailure = code => code === 429 ? 'rate_limited'
    : code === 401 || code === 403 ? 'access_denied'
    : code === 408 || code === 504 ? 'timeout' : 'http_error';
  if (!Number.isInteger(status) || status < 100 || status > 599) return 'invalid_response';
  if (status < 200 || status >= 300) return httpFailure(status);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return 'invalid_response';
  if (typeof repoName !== 'string' || !validRepositoryAtelierRepoName(repoName)
    || typeof data.repoName !== 'string' || data.repoName.toLowerCase() !== repoName.toLowerCase()) return 'scope_mismatch';
  if (data.fallback) {
    if (data.reason === 'grounding not configured') return 'unconfigured';
    if (typeof data.reason === 'string' && /^timeout \d+ms$/.test(data.reason)) return 'timeout';
    const kbStatus = typeof data.reason === 'string' && /^kb (\d{3})$/.exec(data.reason);
    return kbStatus ? httpFailure(Number(kbStatus[1])) : 'unavailable';
  }
  if (typeof data.message !== 'string' || !data.message.trim()) return 'invalid_response';
  return null;
}

export function appendRepositoryAtelierChatTurn(visit, role, text) {
  if (!visit || !['user', 'assistant'].includes(role)) return false;
  const cleaned = cleanText(text);
  if (!cleaned) return false;
  visit.history.push({ role, text: cleaned });
  if (visit.history.length > 12) visit.history = visit.history.slice(-12);
  return true;
}

export function repositoryAtelierChatPayload(visit, question, lang) {
  if (!visit || !validRepositoryAtelierRepoName(visit.repoName)) throw new TypeError('An active Atelier visit is required');
  const text = cleanText(question, 2000);
  if (!text) throw new TypeError('A question is required');
  const history = visit.history.slice(-8);
  const last = history.at(-1);
  if (last && last.role === 'user' && last.text === cleanText(text)) history.pop();
  return {
    surface: 'repository_atelier',
    repoName: visit.repoName,
    question: text,
    history,
    lang: String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'ko',
  };
}

export function repositoryAtelierChatSnapshot(visit) {
  if (!visit) return null;
  return {
    repoName: visit.repoName,
    calls: visit.calls,
    limit: REPOSITORY_ATELIER_CHAT_LIMIT,
    historyTurns: visit.history.length,
    panelOpen: visit.panelOpen,
    autoStarted: visit.autoStarted,
    exhausted: visit.calls >= REPOSITORY_ATELIER_CHAT_LIMIT,
    cancelled: visit.cancelled,
    lastFailure: visit.lastFailure,
  };
}
