import { validateRepositoryBlueprintTarget } from './repository-blueprint.js?v=repository-blueprint-v2';

export const REPOSITORY_EXHIBIT_LIMITS = Object.freeze({
  timeoutMs: 8000, responseBytes: 128 * 1024, documentBytes: 64 * 1024,
  excerptBytes: 24 * 1024, sectionBytes: 12 * 1024, codeBytes: 8 * 1024,
  sections: 6, codeBlocks: 12, blocks: 96, lines: 4096,
  requestsPerVisit: 1, retries: 0, mediaBytes: 0,
});
const encoder = new TextEncoder();
const byteLength = value => encoder.encode(value).byteLength;
const startHeading = /\b(quick\s*start|get(?:ting)?\s*started|start\s*here|install(?:ation|ing)?|setup|set[- ]?up|run(?:ning)?(?:\s+(?:locally|in|the|this|on|with))?|local\s+development|prerequisites?|requirements?|before\s+you|deploy(?:ment)?|docker\s+options)\b|시작|설치|실행|요구.?사항|사전.?준비|개발.?환경/i;
const lineText = line => line.replace(/\r?\n$/, '');
const openingFence = line => /^ {0,3}(`{3,}|~{3,})([^`]*)$/.exec(line);
const closingFence = (line, fence) => {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
  return !!match && match[1][0] === fence[1][0] && match[1].length >= fence[1].length;
};
const headingAt = (lines, index) => {
  const line = lineText(lines[index]), atx = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
  if (atx) return { level: atx[1].length, heading: atx[2], start: index, body: index + 1 };
  if (line.trim() && !/^(?: {4}|\t|[<>])/.test(line) && index + 1 < lines.length) {
    const underline = /^ {0,3}(=+|-+)[ \t]*$/.exec(lineText(lines[index + 1]));
    if (underline) return { level: underline[1][0] === '=' ? 1 : 2, heading: line.trim(), start: index, body: index + 2 };
  }
  return null;
};

export function repositoryExhibitLink(value, base) {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return '';
  try {
    const url = new URL(value, base);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || !url.hostname.includes('.') || /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(url.hostname)
      || /\.(?:localhost|local|internal)$/i.test(url.hostname)) return '';
    return url.href;
  } catch {
    return '';
  }
}

export function projectRepositoryExhibit(value) {
  const target = validateRepositoryBlueprintTarget(value);
  return Object.freeze({
    target: target.ok ? target : null,
    repoName: target.ok ? target.repoName : '',
    description: typeof value?.description === 'string' ? value.description.trim().slice(0, 2048) : '',
    homepage: repositoryExhibitLink(value?.homepage),
    archived: value?.archived === true,
  });
}

function outline(lines) {
  const headings = [], stack = [];
  let fence = null, htmlEnd = null;
  for (let index = 0; index < lines.length; index++) {
    const line = lineText(lines[index]);
    if (fence) { if (closingFence(line, fence)) fence = null; continue; }
    if (htmlEnd) { if (htmlEnd.test(line)) htmlEnd = null; continue; }
    if (/^\s*<!--/.test(line)) { if (!/-->/.test(line)) htmlEnd = /-->/; continue; }
    const html = /^ {0,3}<(script|style|pre|iframe)(?:\s|>)/i.exec(line);
    if (html) { const end = new RegExp(`</${html[1]}\\s*>`, 'i'); if (!end.test(line)) htmlEnd = end; continue; }
    fence = openingFence(line);
    if (fence) continue;
    const heading = headingAt(lines, index);
    if (!heading) continue;
    while (stack.length && stack.at(-1).level >= heading.level) stack.pop().end = index;
    heading.parent = stack.at(-1) || null; heading.end = lines.length;
    headings.push(heading); stack.push(heading); index = heading.body - 1;
  }
  return headings;
}

function sectionBlocks(lines, section) {
  const blocks = [];
  let paragraph = '';
  const flush = () => { if (paragraph.trim()) blocks.push({ type: 'text', text: paragraph.trimEnd() }); paragraph = ''; };
  for (let index = section.body; index < section.end; index++) {
    const raw = lines[index], line = lineText(raw), fence = openingFence(line);
    if (fence) {
      flush(); let code = '', closed = false;
      for (++index; index < section.end; index++) {
        if (closingFence(lineText(lines[index]), fence)) { closed = true; break; }
        code += lines[index];
      }
      if (!closed || byteLength(code) > REPOSITORY_EXHIBIT_LIMITS.codeBytes) return null;
      blocks.push({ type: 'code', language: fence[2].trim().slice(0, 48), text: code }); continue;
    }
    const heading = headingAt(lines, index);
    if (heading) { flush(); blocks.push({ type: 'heading', text: heading.heading }); index = heading.body - 1; continue; }
    if (/^(?: {4}|\t)/.test(line) && !paragraph) {
      let code = raw.replace(/^(?: {4}|\t)/, '');
      while (index + 1 < section.end) {
        if (/^(?: {4}|\t)/.test(lines[index + 1])) { code += lines[++index].replace(/^(?: {4}|\t)/, ''); continue; }
        let next = index + 1;
        while (next < section.end && !lineText(lines[next]).trim()) next++;
        if (next === index + 1 || next >= section.end || !/^(?: {4}|\t)/.test(lines[next])) break;
        while (index + 1 < next) code += lines[++index];
      }
      if (byteLength(code) > REPOSITORY_EXHIBIT_LIMITS.codeBytes) return null;
      blocks.push({ type: 'code', language: '', text: code }); continue;
    }
    if (!line.trim()) flush(); else paragraph += raw;
    if (blocks.length > REPOSITORY_EXHIBIT_LIMITS.blocks) return null;
  }
  flush();
  return blocks;
}

export function selectRepositoryGettingStarted(text) {
  if (typeof text !== 'string' || byteLength(text) > REPOSITORY_EXHIBIT_LIMITS.documentBytes) throw new Error('document_size');
  const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
  if (lines.length > REPOSITORY_EXHIBIT_LIMITS.lines) return { sections: [], limited: true, matched: 0, codeBlocks: 0, excerptBytes: 0 };
  const headings = outline(lines), candidates = [], seen = new Set();
  for (const heading of headings) {
    if (!startHeading.test(heading.heading)) continue;
    let candidate = heading;
    // Include the containing platform/condition section, not a decontextualized nested command.
    while (candidate.parent && candidate.parent.level > 1) candidate = candidate.parent;
    if (!seen.has(candidate)) { candidates.push(candidate); seen.add(candidate); }
  }
  const selected = [];
  for (const candidate of candidates) if (!selected.length || selected.at(-1).end <= candidate.start) selected.push(candidate);
  const sections = [];
  let excerptBytes = 0, codeBlocks = 0, blockCount = 0, limited = false;
  for (const section of selected) {
    const source = lines.slice(section.start, section.end).join(''), bytes = byteLength(source);
    const blocks = sectionBlocks(lines, section), codes = blocks?.filter(block => block.type === 'code').length || 0;
    if (!blocks || !blocks.length || section.heading.length > 240 || bytes > REPOSITORY_EXHIBIT_LIMITS.sectionBytes
      || excerptBytes + bytes > REPOSITORY_EXHIBIT_LIMITS.excerptBytes || sections.length >= REPOSITORY_EXHIBIT_LIMITS.sections
      || codeBlocks + codes > REPOSITORY_EXHIBIT_LIMITS.codeBlocks || blockCount + blocks.length > REPOSITORY_EXHIBIT_LIMITS.blocks) {
      limited = true; continue;
    }
    sections.push({ heading: section.heading, startLine: section.start + 1, endLine: section.end, blocks });
    excerptBytes += bytes; codeBlocks += codes; blockCount += blocks.length;
  }
  return { sections, limited, matched: selected.length, codeBlocks, excerptBytes };
}

function readmePath(value) {
  return typeof value === 'string' && byteLength(value) <= 512 && !/[\u0000-\u001f\u007f\\?#%]/.test(value)
    && value.split('/').every(part => part && part !== '.' && part !== '..') && /^readme(?:[._-][a-z0-9_-]+)*$/i.test(value.split('/').at(-1));
}
function documentFromResponse(raw, target, readAt) {
  if (!raw || Array.isArray(raw) || raw.type !== 'file' || raw.encoding !== 'base64' || !readmePath(raw.path)
    || typeof raw.content !== 'string' || !Number.isInteger(raw.size) || raw.size < 0
    || !/^[a-f0-9]{40}$/i.test(raw.sha || '')) throw new Error('malformed');
  if (raw.size > REPOSITORY_EXHIBIT_LIMITS.documentBytes) throw new Error('oversized');
  const sourceUrl = `https://github.com/${target.owner}/${target.repo}/blob/${encodeURIComponent(target.defaultBranch)}/${raw.path.split('/').map(encodeURIComponent).join('/')}`;
  let returned;
  try { returned = new URL(raw.html_url); } catch { throw new Error('scope_mismatch'); }
  if (returned.origin !== 'https://github.com' || returned.username || returned.password || returned.search || returned.hash
    || decodeURIComponent(returned.pathname) !== decodeURIComponent(new URL(sourceUrl).pathname)) throw new Error('scope_mismatch');
  const base64 = raw.content.replace(/[\r\n]/g, '');
  if (base64.length > Math.ceil(REPOSITORY_EXHIBIT_LIMITS.documentBytes / 3) * 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('malformed');
  let bytes, text;
  try {
    bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch { throw new Error('malformed'); }
  if (bytes.byteLength !== raw.size || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error('malformed');
  return { ...selectRepositoryGettingStarted(text), source: { repoName: target.repoName, path: raw.path,
    ref: target.defaultBranch, blobSha: raw.sha.toLowerCase(), url: sourceUrl, readAt }, documentBytes: bytes.byteLength };
}

export async function readRepositoryExhibit(value, options = {}) {
  const target = validateRepositoryBlueprintTarget(value);
  const result = (status, extra = {}) => ({ ok: status === 'ready', status, requestsStarted: 1, retries: 0, ...extra });
  if (!target.ok) return { ...result(target.reason), requestsStarted: 0 };
  if (options.signal?.aborted) return { ...result('cancelled'), requestsStarted: 0 };
  const requestUrl = `https://api.github.com/repos/${target.owner}/${target.repo}/readme?ref=${encodeURIComponent(target.defaultBranch)}`;
  const controller = new AbortController(), fetchImpl = options.fetchImpl || globalThis.fetch;
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REPOSITORY_EXHIBIT_LIMITS.timeoutMs);
  try {
    const response = await fetchImpl(requestUrl, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: controller.signal });
    if (response.redirected || (response.url && response.url !== requestUrl)) return result('scope_mismatch');
    if (response.status === 404) return result('not_found');
    if (response.status === 429 || (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) return result('rate_limited');
    if (response.status === 403) return result('forbidden');
    if (response.status >= 300 && response.status < 400) return result('redirect');
    if (response.status !== 200) return result('unavailable');
    if (!/^application\/(?:[a-z.+-]*\+)?json(?:;|$)/i.test(response.headers.get('content-type') || '')) return result('malformed');
    if (Number(response.headers.get('content-length')) > REPOSITORY_EXHIBIT_LIMITS.responseBytes) {
      await response.body?.cancel(); return result('oversized');
    }
    if (!response.body?.getReader) return result('malformed');
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    for (;;) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > REPOSITORY_EXHIBIT_LIMITS.responseBytes) { await reader.cancel(); return result('oversized'); }
      chunks.push(chunk);
    }
    if (controller.signal.aborted) return result(timedOut ? 'timeout' : 'cancelled');
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let raw, document;
    try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { return result('malformed'); }
    try { document = documentFromResponse(raw, target, new Date(options.now?.() ?? Date.now()).toISOString()); }
    catch (error) { return result(['malformed', 'oversized', 'scope_mismatch'].includes(error.message) ? error.message : 'malformed'); }
    return result('ready', { document, responseBytes: size });
  } catch {
    return result(timedOut ? 'timeout' : options.signal?.aborted ? 'cancelled' : 'network');
  } finally {
    controller.abort(); clearTimeout(timer); options.signal?.removeEventListener('abort', abort);
  }
}

export function createRepositoryExhibitVisit(value) {
  const target = validateRepositoryBlueprintTarget(value);
  return { target: target.ok ? target : null, status: target.ok ? 'idle' : target.reason,
    requestsStarted: 0, result: null, controller: null, cancelled: false, panelOpen: false, previousFocus: null };
}
export async function loadRepositoryExhibitVisit(visit, options = {}) {
  if (visit.cancelled || !visit.target || visit.requestsStarted) return visit.result;
  const controller = new AbortController();
  visit.controller = controller; visit.requestsStarted = 1; visit.status = 'loading';
  const result = await readRepositoryExhibit(visit.target, { ...options, signal: controller.signal });
  if (visit.cancelled) return null;
  visit.controller = null; visit.result = result; visit.status = result.status;
  return result;
}
export function cancelRepositoryExhibitVisit(visit) {
  if (!visit) return;
  visit.cancelled = true; visit.controller?.abort(); visit.controller = null; visit.result = null;
}
