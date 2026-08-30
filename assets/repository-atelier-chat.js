export const REPOSITORY_ATELIER_CHAT_LIMIT = 5;

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
  return { sequence: visit.sequence, call: visit.calls };
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
  };
}
