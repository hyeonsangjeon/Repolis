import {
  REPOSITORY_BLUEPRINT_LIMITS,
  createRepositoryBlueprintMemoryCache,
  createRepositoryBlueprintPathUrl,
  createRepositoryBlueprintTreeUrl,
  projectRepositoryBlueprint,
  resolveRepositoryBlueprintFocus,
  scanRepositoryBlueprint,
  validateRepositoryBlueprintTarget,
} from '../assets/repository-blueprint.js';
import {
  BLUEPRINT_DEEP_LINK_LIMITS,
  createRepositoryBlueprintDeepLink,
  resolveRepositoryBlueprintDeepLink,
} from '../assets/repo-portal.js';

const TARGET = Object.freeze({
  repoName: 'hyeonsangjeon/Dataplatformfrm',
  defaultBranch: 'main',
});
const TARGET_API = 'https://api.github.com/repos/hyeonsangjeon/Dataplatformfrm';
const SHA = '0123456789abcdef0123456789abcdef01234567';

function item(path, type = 'blob') {
  const kind = type === 'tree' ? 'trees' : 'blobs';
  return {
    path,
    mode: type === 'tree' ? '040000' : '100644',
    type,
    sha: SHA,
    url: `${TARGET_API}/git/${kind}/${SHA}`,
  };
}

function fixture(tree, truncated = false) {
  return {
    sha: SHA,
    url: `${TARGET_API}/git/trees/${SHA}`,
    tree,
    truncated,
  };
}

function response(body, options = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const value = new Response(text, {
    status: options.status || 200,
    headers: options.headers || { 'content-type': 'application/json' },
  });
  Object.defineProperty(value, 'url', {
    configurable: true,
    value: options.url === undefined ? createRepositoryBlueprintTreeUrl(TARGET) : options.url,
  });
  return value;
}

function stableView(projection) {
  return {
    nodes: projection.nodes.map(node => [node.path, node.type, node.category, node.depth, node.group]),
    edges: projection.edges.map(edge => [edge.from, edge.to]),
    groups: projection.groups,
  };
}

export async function runRepositoryBlueprintTests(check) {
  const target = validateRepositoryBlueprintTarget(TARGET);
  check(target.ok
    && createRepositoryBlueprintTreeUrl(target) === `${TARGET_API}/git/trees/main?recursive=1`
    && createRepositoryBlueprintPathUrl(target, { path: 'src/main.py', type: 'file' })
      === 'https://github.com/hyeonsangjeon/Dataplatformfrm/blob/main/src/main.py',
  'Blueprint targets one exact public owner/repo and its known default branch');

  const blueprintLink = createRepositoryBlueprintDeepLink(
    TARGET.repoName,
    'src/agents',
    'https://example.test/Repolis/?old=1#repo=x',
  );
  const normalizedBlueprintLink = createRepositoryBlueprintDeepLink(
    'https://github.com/hyeonsangjeon/Dataplatformfrm.git/',
    'src/agents',
    'https://example.test/Repolis/',
  );
  const resolvedBlueprintLink = resolveRepositoryBlueprintDeepLink(new URL(blueprintLink).search);
  check(blueprintLink === 'https://example.test/Repolis/?repo=hyeonsangjeon/Dataplatformfrm&view=blueprint&path=src%2Fagents&ref=blueprint'
    && normalizedBlueprintLink === blueprintLink
    && resolvedBlueprintLink.ok
    && resolvedBlueprintLink.target.slug === TARGET.repoName
    && resolvedBlueprintLink.path === 'src/agents',
  'Blueprint Deep Links are canonical, deterministic, and preserve exact public owner/repo plus path');

  const blueprintQuery = path => `?repo=${TARGET.repoName}&view=blueprint&path=${path}&ref=blueprint`;
  const rejectedBlueprintLinks = [
    blueprintQuery('src%2F..%2Fsecret'),
    blueprintQuery('src%252F..%252Fsecret'),
    blueprintQuery('%2Fsrc%2Fagents'),
    blueprintQuery('src%2F%00agents'),
    blueprintQuery('%E0%A4%A'),
    blueprintQuery(encodeURIComponent('a'.repeat(BLUEPRINT_DEEP_LINK_LIMITS.maxDecodedPathBytes + 1))),
    blueprintQuery('src%2F%2Fagents'),
    `${blueprintQuery('src%2Fagents')}&user=another`,
    `${blueprintQuery('src%2Fagents')}&path=tests`,
  ].map(resolveRepositoryBlueprintDeepLink);
  check(rejectedBlueprintLinks.every(result => result.requested && !result.ok)
    && !resolveRepositoryBlueprintDeepLink(blueprintQuery('src%2Fagents'), '#repo=other').ok
    && resolveRepositoryBlueprintDeepLink('?repo=hyeonsangjeon/Repolis&ref=repo-portal').requested === false,
  'Blueprint Deep Links reject traversal, encoded, absolute, control, malformed, over-cap, empty, extra, and duplicate input');

  const tree = [
    item('src', 'tree'), item('src/main.py'), item('src/internal', 'tree'), item('src/internal/load.py'),
    item('tests', 'tree'), item('tests/test_main.py'), item('docs', 'tree'), item('docs/guide.md'),
    item('.github', 'tree'), item('.github/workflows', 'tree'), item('.github/workflows/ci.yml'),
    item('assets', 'tree'), item('assets/module.js'), item('index.html'), item('README.md'), item('LICENSE'), item('AGENTS.md'), item('pyproject.toml'), item('image.png'),
    item('src/internal/deep', 'tree'), item('src/internal/deep/ignored', 'tree'), item('src/internal/deep/ignored/file.py'),
  ];
  const projected = projectRepositoryBlueprint(fixture(tree), target, { decodedBytes: 16384 });
  const reordered = projectRepositoryBlueprint(fixture([...tree].reverse()), target, { decodedBytes: 16384 });
  const paths = new Set(projected.nodes.map(node => node.path));
  check(JSON.stringify(stableView(projected)) === JSON.stringify(stableView(reordered))
    && ['src', 'tests', 'docs', '.github', 'assets/module.js', 'index.html', 'README.md', 'LICENSE', 'AGENTS.md', 'pyproject.toml']
      .every(path => paths.has(path))
    && !paths.has('image.png')
    && paths.has('src/internal/deep/ignored')
    && !paths.has('src/internal/deep/ignored/file.py')
    && projected.counts.maxDepth === REPOSITORY_BLUEPRINT_LIMITS.maxDepth,
  'successful fixtures project stable folders, landmarks, grouping, ordering, and depth');

  const exactFocus = resolveRepositoryBlueprintFocus(projected, target, 'src/internal');
  const missingFocus = resolveRepositoryBlueprintFocus(projected, target, 'src/agents');
  const crossRepoFocus = resolveRepositoryBlueprintFocus(projected, {
    repoName: 'another/Dataplatformfrm',
    defaultBranch: 'main',
  }, 'src/internal');
  check(exactFocus.ok && exactFocus.node.path === 'src/internal'
    && missingFocus.reason === 'missing' && missingFocus.index === -1 && missingFocus.node === null
    && crossRepoFocus.reason === 'scope_mismatch',
  'deep-link focus restores only an exact bounded node and never guesses or crosses repositories');

  const largeTree = [];
  for (let index = 0; index < 260; index += 1) {
    const folder = `src/part-${String(index).padStart(3, '0')}`;
    largeTree.push(item(folder, 'tree'), item(`${folder}/module-${index}.js`));
  }
  const desktop = projectRepositoryBlueprint(fixture(largeTree), target);
  const compact = projectRepositoryBlueprint(fixture(largeTree), target, { compact: true });
  check(desktop.nodes.length === REPOSITORY_BLUEPRINT_LIMITS.desktopNodes
    && desktop.edges.length <= REPOSITORY_BLUEPRINT_LIMITS.desktopEdges
    && compact.nodes.length === REPOSITORY_BLUEPRINT_LIMITS.compactNodes
    && compact.edges.length <= REPOSITORY_BLUEPRINT_LIMITS.compactEdges
    && REPOSITORY_BLUEPRINT_LIMITS.additionalDrawCalls === 3
    && REPOSITORY_BLUEPRINT_LIMITS.instancedBatches === 2
    && REPOSITORY_BLUEPRINT_LIMITS.lineSegments === 1
    && REPOSITORY_BLUEPRINT_LIMITS.canvasAtlases === 1,
  'desktop and compact node, edge, depth, draw, batch, line, and atlas budgets are fixed');

  const invalidTargets = [
    { ...TARGET, repoName: 'another/repo/extra' },
    { ...TARGET, repoName: 'another/../repo' },
    { ...TARGET, repoName: 'another/repo\u0000' },
    { ...TARGET, defaultBranch: '../main' },
    { ...TARGET, private: true },
    { ...TARGET, deleted: true },
  ];
  let invalidPath = false, controlPath = false, crossRepository = false;
  let forgedTarget = false;
  try {
    createRepositoryBlueprintTreeUrl({ ok: true, owner: 'another', repo: 'repo', repoName: '../repo', defaultBranch: 'main' });
  } catch (error) { forgedTarget = error.code === 'repository'; }
  try { projectRepositoryBlueprint(fixture([item('../secret.js')]), target); } catch (error) { invalidPath = error.code === 'malformed_path'; }
  try { projectRepositoryBlueprint(fixture([item('src/\u0000.js')]), target); } catch (error) { controlPath = error.code === 'malformed_path'; }
  try {
    projectRepositoryBlueprint({
      ...fixture([item('src', 'tree')]),
      url: 'https://api.github.com/repos/another/repo/git/trees/0123456789abcdef0123456789abcdef01234567',
    }, target);
  } catch (error) { crossRepository = error.code === 'scope_mismatch'; }
  check(invalidTargets.every(value => !validateRepositoryBlueprintTarget(value).ok)
    && forgedTarget && invalidPath && controlPath && crossRepository,
  'cross-repository, traversal, malformed, control-character, private, and deleted inputs fail factually');

  let started = 0, requestContract = false;
  const ready = await scanRepositoryBlueprint(TARGET, {
    fetchImpl: async (url, options) => {
      started += 1;
      requestContract = url === `${TARGET_API}/git/trees/main?recursive=1`
        && options.method === 'GET'
        && options.cache === 'no-store'
        && options.credentials === 'omit'
        && options.redirect === 'error'
        && options.headers.Accept === 'application/vnd.github+json'
        && options.headers['X-GitHub-Api-Version'] === '2022-11-28'
        && options.signal instanceof AbortSignal;
      return response(fixture(tree));
    },
  });
  check(ready.ok && ready.status === 'ready' && started === 1 && requestContract
    && ready.requestsStarted === REPOSITORY_BLUEPRINT_LIMITS.maxRequestsPerScan
    && ready.retries === 0
    && ready.decodedBytes > 0
    && ready.decodedBytes <= REPOSITORY_BLUEPRINT_LIMITS.maxDecodedBytes,
  'one explicit scan starts one official GitHub Tree request with zero retries and a decoded-size measurement');

  const statuses = [
    ['forbidden', 403, {}],
    ['not_found', 404, {}],
    ['rate_limited', 429, {}],
    ['rate_limited', 403, { 'x-ratelimit-remaining': '0' }],
  ];
  let boundedFailures = true;
  for (const [expected, status, headers] of statuses) {
    let calls = 0;
    const result = await scanRepositoryBlueprint(TARGET, {
      fetchImpl: async () => { calls += 1; return response('{}', { status, headers }); },
    });
    boundedFailures &&= result.status === expected && calls === 1 && result.requestsStarted === 1;
  }
  const truncated = await scanRepositoryBlueprint(TARGET, {
    fetchImpl: async () => response(fixture(tree, true)),
  });
  const partial = await scanRepositoryBlueprint(TARGET, {
    fetchImpl: async () => response(fixture(tree), { status: 206 }),
  });
  check(boundedFailures
    && truncated.ok && truncated.status === 'truncated' && truncated.projection.nodes.length > 0
    && partial.ok && partial.status === 'partial' && partial.projection.nodes.length > 0,
  '403, 404, 429, truncated, and partial fixtures make no subtree follow-up and fail or label truthfully');

  const oversizedText = 'x'.repeat(REPOSITORY_BLUEPRINT_LIMITS.maxDecodedBytes + 1);
  let oversizedCalls = 0;
  const oversized = await scanRepositoryBlueprint(TARGET, {
    fetchImpl: async () => { oversizedCalls += 1; return response(oversizedText); },
  });
  let timeoutCalls = 0;
  const timedOut = await scanRepositoryBlueprint(TARGET, {
    timeoutMs: 5,
    fetchImpl: async (_url, options) => {
      timeoutCalls += 1;
      return new Promise((resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      });
    },
  });
  check(oversized.status === 'oversized' && oversizedCalls === 1
    && oversized.decodedBytes > REPOSITORY_BLUEPRINT_LIMITS.maxDecodedBytes
    && timedOut.status === 'timeout' && timeoutCalls === 1,
  'decoded responses stop above 2 MiB and requests time out once without retry or subtree follow-up');

  const malformed = await scanRepositoryBlueprint(TARGET, {
    fetchImpl: async () => response('{"tree":'),
  });
  const mismatched = await scanRepositoryBlueprint(TARGET, {
    fetchImpl: async () => response(fixture(tree), {
      url: 'https://api.github.com/repos/another/repo/git/trees/main?recursive=1',
    }),
  });
  check(malformed.status === 'malformed' && mismatched.status === 'scope_mismatch',
    'malformed and redirected cross-repository responses never become a source map');

  const cache = createRepositoryBlueprintMemoryCache();
  cache.set(TARGET, ready);
  const firstKey = cache.snapshot().key;
  cache.set({ repoName: 'hyeonsangjeon/Repolis', defaultBranch: 'main' }, { ok: true });
  check(firstKey === 'hyeonsangjeon/dataplatformfrm@main'
    && cache.get(TARGET) === null
    && cache.snapshot().entries === REPOSITORY_BLUEPRINT_LIMITS.cacheEntries,
  'the in-memory cache retains only the current Atelier repository and has no persistence surface');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let failed = 0;
  await runRepositoryBlueprintTests((condition, name) => {
    if (condition) console.log(`  ok - ${name}`);
    else {
      failed += 1;
      console.error(`  not ok - ${name}`);
    }
  });
  if (failed) process.exit(1);
  console.log('Repository Blueprint tests passed');
}
