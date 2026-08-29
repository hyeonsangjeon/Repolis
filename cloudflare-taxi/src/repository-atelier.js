export const REPOSITORY_ATELIER_SURFACE = 'repository_atelier';

const REQUEST_BYTES = 16384;
const QUESTION_CHARS = 2000;
const CONTROL = /[\u0000-\u001f\u007f]/g;
const REPO_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?\/[A-Za-z0-9_.-]{1,100}$/;
const ALLOWED_FIELDS = new Set([
  'question',
  'npc',
  'history',
  'lang',
  'surface',
  'repoName',
  'instanceId',
  'instanceOrigin',
  'cityUser',
  'cityMode',
]);

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function clean(value, max) {
  return String(value || '').replace(CONTROL, ' ').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function requestBytes(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function validRepoName(value) {
  const repoName = String(value || '');
  if (!REPO_NAME_RE.test(repoName)) return false;
  const repo = repoName.split('/')[1];
  return repo !== '.' && repo !== '..';
}

function validScalarFields(input) {
  return (input.npc === undefined || input.npc === 'taxi')
    && (input.lang === undefined || (typeof input.lang === 'string' && input.lang.length <= 16))
    && (input.instanceId === undefined || (typeof input.instanceId === 'string' && input.instanceId.length <= 64))
    && (input.instanceOrigin === undefined || (
      typeof input.instanceOrigin === 'string'
      && ['external', 'clone-local', 'owner-dev', 'remote'].includes(input.instanceOrigin)
    ))
    && (input.cityUser === undefined || (typeof input.cityUser === 'string' && input.cityUser.length <= 39))
    && (input.cityMode === undefined || (typeof input.cityMode === 'string' && input.cityMode.length <= 16));
}

function normalizeHistory(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 8) return null;
  const history = [];
  for (const item of value) {
    if (!object(item)
      || Object.keys(item).some(key => !['role', 'text'].includes(key))
      || !['user', 'assistant'].includes(item.role)
      || typeof item.text !== 'string'
      || item.text.length > 600) return null;
    const text = clean(item.text, 600);
    if (text) history.push({ role: item.role, text });
  }
  return history;
}

export function authorizeRepositoryAtelierRequest(body) {
  const input = object(body);
  if (!input || requestBytes(input) > REQUEST_BYTES) return { ok: false, reason: 'repository_atelier_payload_invalid' };
  if (Object.keys(input).some(field => !ALLOWED_FIELDS.has(field))) {
    return { ok: false, reason: 'repository_atelier_payload_invalid' };
  }
  if (input.surface !== REPOSITORY_ATELIER_SURFACE || !validRepoName(input.repoName)) {
    return { ok: false, reason: 'repository_atelier_repo_invalid' };
  }
  if (!validScalarFields(input)) return { ok: false, reason: 'repository_atelier_payload_invalid' };
  if (typeof input.question !== 'string' || input.question.length > QUESTION_CHARS) {
    return { ok: false, reason: 'repository_atelier_question_invalid' };
  }
  const history = normalizeHistory(input.history);
  if (history === null) return { ok: false, reason: 'repository_atelier_history_invalid' };
  const question = clean(input.question, QUESTION_CHARS);
  if (!question) return { ok: false, reason: 'repository_atelier_question_invalid' };
  return {
    ok: true,
    question,
    history,
    repoName: input.repoName,
    lang: String(input.lang || '').toLowerCase().startsWith('en') ? 'en' : 'ko',
  };
}

function content(text) {
  return [{ type: 'text', text }];
}

function scopeInstruction(repoName) {
  return `MANDATORY REPOSITORY SCOPE: ${repoName}. Use the GitHub repository MCP only for exactly "${repoName}". `
    + 'Do not search, compare, recommend, or answer from another repository. '
    + `If public information for exactly "${repoName}" is unavailable, say that no information was found for this repository.`;
}

export function buildRepositoryAtelierMessages(history, question, repoName) {
  const scope = scopeInstruction(repoName);
  const messages = [{ role: 'user', content: content(scope) }];
  for (const item of Array.isArray(history) ? history.slice(-8) : []) {
    if (!item || !item.text) continue;
    messages.push({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: content(String(item.text).slice(0, 600)),
    });
  }
  messages.push({
    role: 'user',
    content: content(`${scope}\nQuestion about ${repoName} only: ${String(question).slice(0, 500)}`),
  });
  return messages;
}

export function repositoryAtelierKnowledgeSource(configured) {
  return String(configured || 'github-repos-mcp-ks').split(',').map(value => value.trim()).find(Boolean) || 'github-repos-mcp-ks';
}

function referenceObject(reference) {
  const source = reference && reference.sourceData;
  const contentValue = source && typeof source === 'object' ? source.content : source;
  if (typeof contentValue === 'string') {
    try {
      return JSON.parse(contentValue);
    } catch {
      return null;
    }
  }
  return object(contentValue);
}

function fullNameFromUrl(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.hostname.toLowerCase() !== 'github.com') return '';
    const parts = url.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
  } catch {
    return '';
  }
}

export function projectRepositoryAtelierReferences(references, repoName) {
  const target = String(repoName || '').toLowerCase();
  const refs = [];
  let rejected = 0;
  for (const reference of Array.isArray(references) ? references : []) {
    const repo = referenceObject(reference);
    const fullName = String(repo?.full_name || fullNameFromUrl(repo?.html_url)).replace(/\.git$/i, '');
    if (!repo || fullName.toLowerCase() !== target) {
      rejected += 1;
      continue;
    }
    refs.push({
      name: fullName,
      url: repo.html_url || `https://github.com/${fullName}`,
      snippet: clean(repo.description, 600),
      stars: Number.isFinite(Number(repo.stargazers_count)) ? Number(repo.stargazers_count) : null,
      lang: clean(repo.language, 50),
      tool: reference.toolName || '',
    });
  }
  return { refs, rejected, exact: refs.length > 0 && rejected === 0 };
}

export function repositoryAtelierMessage(kind, repoName, lang) {
  const ko = lang !== 'en';
  if (kind === 'invalid') {
    return ko
      ? '올바른 공개 owner/repo가 아니어서 이 전시 레포를 조회할 수 없어요.'
      : 'This exhibit does not have a valid public owner/repo, so it cannot be queried.';
  }
  if (kind === 'unavailable') {
    return ko
      ? `${repoName}의 공개 정보를 지금 불러오지 못했어요. 다른 레포로 대신 답하지 않을게요.`
      : `Public information for ${repoName} is unavailable right now. I will not substitute another repository.`;
  }
  return ko
    ? `${repoName}의 현재 공개 정보를 찾지 못했어요. 비공개이거나 삭제되었거나 GitHub MCP에 근거가 없을 수 있어요.`
    : `I couldn't find current public information for ${repoName}. It may be private, deleted, or unavailable from the GitHub MCP source.`;
}
