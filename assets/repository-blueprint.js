export const REPOSITORY_BLUEPRINT_LIMITS = Object.freeze({
  timeoutMs: 8000,
  maxDecodedBytes: 2 * 1024 * 1024,
  maxDepth: 4,
  desktopNodes: 220,
  compactNodes: 96,
  desktopEdges: 160,
  compactEdges: 64,
  maxRequestsPerScan: 1,
  retries: 0,
  cacheEntries: 1,
  instancedBatches: 2,
  lineSegments: 1,
  additionalDrawCalls: 3,
  canvasAtlases: 1,
});

const LOGIN_RE = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const REPO_RE = /^(?!\.{1,2}$)[A-Za-z0-9_.-]{1,100}$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const SHA_RE = /^[a-f0-9]{40}$/i;
const SOURCE_ROOTS = new Set(['app', 'apps', 'assets', 'backend', 'bin', 'client', 'cmd', 'core', 'frontend', 'lib', 'libs', 'packages', 'scripts', 'server', 'src', 'web']);
const TEST_ROOTS = new Set(['__tests__', 'e2e', 'spec', 'specs', 'test', 'tests']);
const DOC_ROOTS = new Set(['doc', 'docs']);
const SOURCE_EXTENSIONS = new Set([
  'c', 'cc', 'cpp', 'cs', 'css', 'go', 'h', 'hpp', 'html', 'java', 'js', 'jsx', 'kt', 'kts',
  'mjs', 'php', 'py', 'rb', 'rs', 'scala', 'scss', 'sh', 'sql', 'swift', 'ts', 'tsx', 'vue',
]);
const DOCUMENT_EXTENSIONS = new Set(['adoc', 'md', 'mdx', 'rst', 'txt']);
const AUTOMATION_EXTENSIONS = new Set(['json', 'toml', 'yaml', 'yml']);
const MANIFEST_NAMES = new Set([
  '.editorconfig', '.gitattributes', '.gitignore', '.npmrc', '.nvmrc', '.prettierrc',
  'cargo.toml', 'cmakelists.txt', 'composer.json', 'deno.json', 'deno.jsonc', 'dockerfile',
  'docker-compose.yaml', 'docker-compose.yml', 'gemfile', 'go.mod', 'go.sum', 'makefile',
  'package-lock.json', 'package.json', 'pnpm-lock.yaml', 'poetry.lock', 'pom.xml',
  'pyproject.toml', 'requirements.txt', 'settings.gradle', 'settings.gradle.kts',
  'tsconfig.json', 'uv.lock', 'vite.config.js', 'vite.config.ts', 'wrangler.toml', 'yarn.lock',
]);

function immutable(value) {
  if (Array.isArray(value)) value.forEach(immutable);
  else if (value && typeof value === 'object') Object.values(value).forEach(immutable);
  return Object.freeze(value);
}

function invalidTarget(reason) {
  return Object.freeze({ ok: false, reason });
}

function compareText(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function validBranch(value) {
  const branch = String(value || '');
  if (!branch || branch.length > 255 || CONTROL_RE.test(branch) || /[ ~^:?*[\]\\]/.test(branch)
    || branch.startsWith('/') || branch.endsWith('/') || branch.includes('//') || branch.includes('..')
    || branch.includes('@{')) return false;
  return branch.split('/').every(segment => segment && segment !== '.' && segment !== '..'
    && !segment.startsWith('.') && !segment.endsWith('.') && !segment.endsWith('.lock'));
}

export function validateRepositoryBlueprintTarget(value) {
  if (!value || typeof value !== 'object') return invalidTarget('target');
  if (value.private === true) return invalidTarget('private');
  if (value.deleted === true) return invalidTarget('deleted');
  const repoName = String(value.repoName || '');
  if (!repoName || CONTROL_RE.test(repoName) || repoName.trim() !== repoName) return invalidTarget('repository');
  const parts = repoName.split('/');
  if (parts.length !== 2 || !LOGIN_RE.test(parts[0]) || !REPO_RE.test(parts[1])) return invalidTarget('repository');
  const defaultBranch = String(value.defaultBranch || '');
  if (!validBranch(defaultBranch)) return invalidTarget('branch');
  const owner = parts[0], repo = parts[1];
  return Object.freeze({
    ok: true,
    owner,
    repo,
    repoName: `${owner}/${repo}`,
    defaultBranch,
    key: `${owner}/${repo}@${defaultBranch}`.toLowerCase(),
  });
}

function requireTarget(value) {
  const target = validateRepositoryBlueprintTarget(value?.ok === true
    ? { repoName: value.repoName, defaultBranch: value.defaultBranch, private: value.private, deleted: value.deleted }
    : value);
  if (!target.ok) {
    const error = new TypeError(`Invalid Repository Blueprint target: ${target.reason}`);
    error.code = target.reason;
    throw error;
  }
  return target;
}

export function createRepositoryBlueprintTreeUrl(value) {
  const target = requireTarget(value);
  return `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/git/trees/${encodeURIComponent(target.defaultBranch)}?recursive=1`;
}

function validPath(path) {
  if (typeof path !== 'string' || !path || path.length > 1024 || CONTROL_RE.test(path)
    || path.startsWith('/') || path.endsWith('/') || path.includes('//') || path.includes('\\')) return false;
  const segments = path.split('/');
  return segments.every(segment => segment && segment !== '.' && segment !== '..');
}

export function createRepositoryBlueprintPathUrl(value, node) {
  const target = requireTarget(value);
  if (!node || !validPath(node.path) || (node.type !== 'folder' && node.type !== 'file')) {
    throw new TypeError('A valid projected Blueprint node is required');
  }
  const route = node.type === 'folder' ? 'tree' : 'blob';
  const path = node.path.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/${route}/${encodeURIComponent(target.defaultBranch)}/${path}`;
}

export function resolveRepositoryBlueprintFocus(projection, value, path) {
  const target = validateRepositoryBlueprintTarget(value);
  if (!target.ok) return invalidTarget(target.reason);
  if (!projection || !Array.isArray(projection.nodes) || !projection.target) return invalidTarget('projection');
  const projectionTarget = validateRepositoryBlueprintTarget(projection.target);
  if (!projectionTarget.ok || projectionTarget.key !== target.key) return invalidTarget('scope_mismatch');
  if (!validPath(path)) return invalidTarget('path');
  const index = projection.nodes.findIndex(node => node.path === path);
  if (index < 0) return Object.freeze({ ok: false, reason: 'missing', index: -1, node: null });
  return Object.freeze({ ok: true, index, node: projection.nodes[index] });
}

function apiRepositoryScope(value, target, expectedKind = null) {
  try {
    const url = new URL(String(value || ''));
    const parts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
    if (url.protocol !== 'https:' || url.hostname !== 'api.github.com' || parts.length < 6
      || parts[0] !== 'repos' || parts[3] !== 'git') return false;
    if (parts[1].toLowerCase() !== target.owner.toLowerCase()
      || parts[2].toLowerCase() !== target.repo.toLowerCase()) return false;
    return !expectedKind || parts[4] === expectedKind;
  } catch (_) {
    return false;
  }
}

function validationError(code) {
  const error = new TypeError(`Invalid Repository Blueprint response: ${code}`);
  error.code = code;
  return error;
}

function extension(path) {
  const base = path.split('/').at(-1) || '';
  const index = base.lastIndexOf('.');
  return index > 0 ? base.slice(index + 1).toLowerCase() : '';
}

function fileCategory(path) {
  const segments = path.split('/'), base = segments.at(-1).toLowerCase(), first = segments[0].toLowerCase(),
    parents = segments.slice(0, -1).map(segment => segment.toLowerCase());
  if (/^readme(?:\.[a-z0-9]+)?$/i.test(base)) return 'readme';
  if (/^(?:license|licence|copying|notice)(?:\.[a-z0-9]+)?$/i.test(base)) return 'license';
  if (base === 'agents.md') return 'agents';
  if (MANIFEST_NAMES.has(base)) return 'manifest';
  if (segments.length === 1 && /(?:^|\.)(?:config|manifest)\.(?:cjs|js|json|mjs|toml|ts|yaml|yml)$/.test(base)) return 'manifest';
  if (first === '.github' && AUTOMATION_EXTENSIONS.has(extension(path))) return 'automation';
  if (segments.length === 1 && SOURCE_EXTENSIONS.has(extension(path))) return 'source';
  if (segments.length === 1 && DOCUMENT_EXTENSIONS.has(extension(path))) return 'document';
  if (parents.some(parent => DOC_ROOTS.has(parent)) && DOCUMENT_EXTENSIONS.has(extension(path))) return 'document';
  if (parents.some(parent => SOURCE_ROOTS.has(parent) || TEST_ROOTS.has(parent)) && SOURCE_EXTENSIONS.has(extension(path))) return 'source';
  return null;
}

function selectionPriority(entry) {
  if (entry.type === 'folder' && entry.depth === 1) return 0;
  if (entry.type === 'file' && ['readme', 'license', 'agents', 'manifest'].includes(entry.category)) return 1;
  if (entry.type === 'folder' && (SOURCE_ROOTS.has(entry.group) || TEST_ROOTS.has(entry.group)
    || DOC_ROOTS.has(entry.group) || entry.group === '.github')) return 2;
  if (entry.type === 'folder') return 3;
  return 4;
}

function normalizeTree(raw, target) {
  if (!raw || typeof raw !== 'object' || raw.private === true || raw.deleted === true) throw validationError('unavailable');
  if (!SHA_RE.test(String(raw.sha || '')) || typeof raw.truncated !== 'boolean' || !Array.isArray(raw.tree)) {
    throw validationError('malformed');
  }
  if (!apiRepositoryScope(raw.url, target, 'trees')) throw validationError('scope_mismatch');
  const paths = new Set(), entries = [];
  for (const item of raw.tree) {
    if (!item || typeof item !== 'object' || !validPath(item.path)) throw validationError('malformed_path');
    if (paths.has(item.path)) throw validationError('duplicate_path');
    paths.add(item.path);
    if (!['tree', 'blob', 'commit'].includes(item.type)) throw validationError('malformed_type');
    const expectedKind = item.type === 'tree' ? 'trees' : item.type === 'blob' ? 'blobs' : 'commits';
    if (!SHA_RE.test(String(item.sha || '')) || !apiRepositoryScope(item.url, target, expectedKind)) {
      throw validationError('scope_mismatch');
    }
    if (item.type === 'commit') continue;
    const segments = item.path.split('/'), depth = segments.length;
    if (depth > REPOSITORY_BLUEPRINT_LIMITS.maxDepth) continue;
    const type = item.type === 'tree' ? 'folder' : 'file';
    const category = type === 'folder' ? 'folder' : fileCategory(item.path);
    if (type === 'file' && !category) continue;
    entries.push({
      id: `${type}:${item.path}`,
      path: item.path,
      label: segments.at(-1),
      parent: segments.length > 1 ? segments.slice(0, -1).join('/') : null,
      group: segments.length > 1 ? segments[0].toLowerCase() : '',
      type,
      category,
      depth,
    });
  }
  return entries;
}

function layoutNodes(nodes) {
  const grouped = new Map();
  for (const node of nodes) {
    const key = node.group;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(node);
  }
  const groups = [...grouped.entries()].sort((a, b) => compareText(a[0], b[0]));
  const columns = Math.max(1, Math.ceil(Math.sqrt(groups.length * 1.45)));
  const rows = Math.max(1, Math.ceil(groups.length / columns));
  const cellWidth = 2 / columns, cellDepth = 2 / rows;
  const laidOut = [];
  groups.forEach(([name, items], groupIndex) => {
    items.sort((a, b) => a.depth - b.depth || (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1)
      || compareText(a.path, b.path));
    const innerColumns = Math.max(1, Math.ceil(Math.sqrt(items.length * 1.35)));
    const innerRows = Math.max(1, Math.ceil(items.length / innerColumns));
    const groupColumn = groupIndex % columns, groupRow = Math.floor(groupIndex / columns);
    const stepX = cellWidth / innerColumns, stepZ = cellDepth / innerRows;
    const size = Math.min(stepX, stepZ);
    items.forEach((node, index) => {
      const column = index % innerColumns, row = Math.floor(index / innerColumns);
      laidOut.push(Object.freeze({
        ...node,
        layout: Object.freeze({
          x: -1 + groupColumn * cellWidth + (column + 0.5) * stepX,
          z: -1 + groupRow * cellDepth + (row + 0.5) * stepZ,
          size: Math.max(0.018, size * (node.type === 'folder' ? (node.depth === 1 ? 0.7 : 0.54) : 0.34)),
        }),
      }));
    });
  });
  return {
    nodes: laidOut.sort((a, b) => compareText(a.group, b.group) || a.depth - b.depth
      || (a.type === b.type ? 0 : a.type === 'folder' ? -1 : 1) || compareText(a.path, b.path)),
    groups: groups.map(([name, items]) => Object.freeze({ name, count: items.length })),
  };
}

export function projectRepositoryBlueprint(raw, value, options = {}) {
  const target = requireTarget(value);
  const compact = options.compact === true;
  const nodeLimit = compact ? REPOSITORY_BLUEPRINT_LIMITS.compactNodes : REPOSITORY_BLUEPRINT_LIMITS.desktopNodes;
  const edgeLimit = compact ? REPOSITORY_BLUEPRINT_LIMITS.compactEdges : REPOSITORY_BLUEPRINT_LIMITS.desktopEdges;
  const entries = normalizeTree(raw, target);
  entries.sort((a, b) => selectionPriority(a) - selectionPriority(b) || a.depth - b.depth || compareText(a.path, b.path));
  const selected = entries.slice(0, nodeLimit);
  const layout = layoutNodes(selected), byPath = new Map(layout.nodes.map(node => [node.path, node]));
  const edges = [];
  for (const node of layout.nodes) {
    if (!node.parent || !byPath.has(node.parent) || edges.length >= edgeLimit) continue;
    edges.push(Object.freeze({ from: node.parent, to: node.path }));
  }
  const decodedBytes = Number.isFinite(options.decodedBytes) ? Math.max(0, Math.floor(options.decodedBytes)) : 0;
  return immutable({
    target,
    status: raw.truncated ? 'truncated' : options.partial === true ? 'partial' : 'ready',
    truncated: raw.truncated,
    partial: options.partial === true,
    nodes: layout.nodes,
    edges,
    groups: layout.groups,
    counts: {
      sourceEntries: raw.tree.length,
      eligibleNodes: entries.length,
      nodes: layout.nodes.length,
      edges: edges.length,
      omittedNodes: Math.max(0, entries.length - layout.nodes.length),
      maxDepth: layout.nodes.reduce((maximum, node) => Math.max(maximum, node.depth), 0),
      decodedBytes,
    },
    limits: {
      nodes: nodeLimit,
      edges: edgeLimit,
      depth: REPOSITORY_BLUEPRINT_LIMITS.maxDepth,
      decodedBytes: REPOSITORY_BLUEPRINT_LIMITS.maxDecodedBytes,
    },
  });
}

async function readDecodedResponse(response, maxBytes) {
  const header = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(header) && header > maxBytes) {
    try { await response.body?.cancel?.(); } catch (_) {}
    return { ok: false, reason: 'oversized', bytes: header };
  }
  if (response.body?.getReader) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let text = '', bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        try { await reader.cancel(); } catch (_) {}
        return { ok: false, reason: 'oversized', bytes };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, text, bytes };
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) return { ok: false, reason: 'oversized', bytes: buffer.byteLength };
  return { ok: true, text: new TextDecoder().decode(buffer), bytes: buffer.byteLength };
}

function scanResult(status, requestsStarted, extra = {}) {
  return immutable({
    ok: status === 'ready' || status === 'truncated' || status === 'partial',
    status,
    requestsStarted,
    retries: REPOSITORY_BLUEPRINT_LIMITS.retries,
    ...extra,
  });
}

export async function scanRepositoryBlueprint(value, options = {}) {
  const target = validateRepositoryBlueprintTarget(value);
  if (!target.ok) return scanResult(target.reason, 0, { target: null });
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') return scanResult('unavailable', 0, { target });
  const requestUrl = createRepositoryBlueprintTreeUrl(target);
  const controller = new AbortController();
  const timeoutMs = Math.min(REPOSITORY_BLUEPRINT_LIMITS.timeoutMs,
    Math.max(1, Number(options.timeoutMs) || REPOSITORY_BLUEPRINT_LIMITS.timeoutMs));
  let timedOut = false, externallyAborted = false;
  const onAbort = () => { externallyAborted = true; controller.abort(); };
  if (options.signal) {
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener('abort', onAbort, { once: true });
  }
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetchImpl(requestUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.url && !apiRepositoryScope(response.url, target, 'trees')) {
      return scanResult('scope_mismatch', 1, { target, requestUrl });
    }
    if (response.status === 404) return scanResult('not_found', 1, { target, requestUrl });
    if (response.status === 429 || (response.status === 403 && response.headers?.get?.('x-ratelimit-remaining') === '0')) {
      return scanResult('rate_limited', 1, { target, requestUrl });
    }
    if (response.status === 403) return scanResult('forbidden', 1, { target, requestUrl });
    if (!response.ok && response.status !== 206) return scanResult('unavailable', 1, { target, requestUrl });
    const decoded = await readDecodedResponse(response, REPOSITORY_BLUEPRINT_LIMITS.maxDecodedBytes);
    if (!decoded.ok) return scanResult(decoded.reason, 1, { target, requestUrl, decodedBytes: decoded.bytes });
    let raw;
    try { raw = JSON.parse(decoded.text); } catch (_) {
      return scanResult('malformed', 1, { target, requestUrl, decodedBytes: decoded.bytes });
    }
    try {
      const projection = projectRepositoryBlueprint(raw, target, {
        compact: options.compact === true,
        decodedBytes: decoded.bytes,
        partial: response.status === 206,
      });
      return scanResult(projection.status, 1, { target, requestUrl, projection, decodedBytes: decoded.bytes });
    } catch (error) {
      return scanResult(error?.code || 'malformed', 1, { target, requestUrl, decodedBytes: decoded.bytes });
    }
  } catch (error) {
    if (timedOut) return scanResult('timeout', 1, { target, requestUrl });
    if (externallyAborted) return scanResult('cancelled', 1, { target, requestUrl });
    return scanResult('network', 1, { target, requestUrl });
  } finally {
    clearTimeout(timeout);
    if (options.signal) options.signal.removeEventListener?.('abort', onAbort);
  }
}

export function createRepositoryBlueprintMemoryCache() {
  let entry = null;
  return Object.freeze({
    get(value) {
      const target = validateRepositoryBlueprintTarget(value);
      return target.ok && entry?.key === target.key ? entry.result : null;
    },
    set(value, result) {
      const target = requireTarget(value);
      entry = Object.freeze({ key: target.key, result });
      return result;
    },
    clear() {
      entry = null;
    },
    snapshot() {
      return Object.freeze({ entries: entry ? 1 : 0, key: entry?.key || null });
    },
  });
}
