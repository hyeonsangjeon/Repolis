import { ISSUE_CODE_SCOUT_LIMITS, scoutIssueCodePaths } from '../assets/issue-code-scout.js';

const QUEST = Object.freeze({
  owner: 'hyeonsangjeon',
  repo: 'Repolis',
  number: 112,
  title: 'Blueprint path focus fails in repository panel',
  labels: Object.freeze(['bug', 'repository-blueprint']),
});

function node(path, type = 'file', category = 'source') {
  const segments = path.split('/');
  return Object.freeze({
    path,
    type,
    category: type === 'folder' ? 'folder' : category,
    depth: segments.length,
    group: segments[0],
    label: segments.at(-1),
  });
}

function projection(nodes, repoName = 'hyeonsangjeon/Repolis') {
  return Object.freeze({
    target: Object.freeze({ repoName, defaultBranch: 'main' }),
    nodes: Object.freeze(nodes),
  });
}

export function runIssueCodeScoutTests(check) {
  const nodes = [
    node('assets', 'folder'),
    node('assets/repository-blueprint.js'),
    node('scripts/test-repository-blueprint.mjs'),
    node('src/focus-controller.js'),
    node('src/path-utils.js'),
    node('docs/blueprint-guide.md', 'file', 'document'),
    node('README.md', 'file', 'readme'),
  ];
  const first = scoutIssueCodePaths(QUEST, projection(nodes));
  const reordered = scoutIssueCodePaths(QUEST, projection([...nodes].reverse()));
  check(first.ok && first.reason === 'ready' && first.candidates.length <= ISSUE_CODE_SCOUT_LIMITS.maxCandidates
    && JSON.stringify(first) === JSON.stringify(reordered)
    && first.candidates.every(candidate => nodes.some(value => value.path === candidate.path)),
  'specific title and labels produce only real, deterministic bounded Blueprint paths');

  const duplicate = scoutIssueCodePaths(QUEST, projection([
    node('assets/repository-blueprint.js'),
    node('assets/repository-blueprint.js'),
    ...Array.from({ length: 12 }, (_, index) => node(`src/blueprint-${String(index).padStart(2, '0')}.js`)),
  ]));
  check(duplicate.candidates.length === ISSUE_CODE_SCOUT_LIMITS.maxCandidates
    && new Set(duplicate.candidates.map(candidate => candidate.path)).size === duplicate.candidates.length,
  'duplicate paths collapse before stable scoring and the result never exceeds five candidates');

  const crossRepo = scoutIssueCodePaths(QUEST, projection(nodes, 'another/Repolis'));
  const traversal = scoutIssueCodePaths(QUEST, projection([...nodes, node('../secret.js')]));
  const control = scoutIssueCodePaths(QUEST, projection([...nodes, node('src/\u0000secret.js')]));
  const encoded = scoutIssueCodePaths(QUEST, projection([...nodes, node('src/%2e%2e/secret.js')]));
  check(!crossRepo.ok && crossRepo.reason === 'scope_mismatch'
    && !traversal.ok && traversal.reason === 'unsafe_path'
    && !control.ok && control.reason === 'unsafe_path'
    && !encoded.ok && encoded.reason === 'unsafe_path',
  'cross-repository, traversal, encoded, and control-character paths fail closed before scoring');

  const generic = scoutIssueCodePaths({ ...QUEST, title: 'Fix issue', labels: ['bug', 'good first issue'] }, projection(nodes));
  const emptyLabels = scoutIssueCodePaths({ ...QUEST, title: 'Update project', labels: [] }, projection(nodes));
  const zeroMatch = scoutIssueCodePaths({ ...QUEST, title: 'Database migration transaction', labels: ['database'] }, projection(nodes));
  check(generic.ok && generic.reason === 'no_match' && generic.candidates.length === 0
    && emptyLabels.ok && emptyLabels.reason === 'no_match' && emptyLabels.candidates.length === 0
    && zeroMatch.ok && zeroMatch.reason === 'no_match' && zeroMatch.candidates.length === 0,
  'generic titles, empty labels, and zero lexical overlap end factually without guessing');

  const unsafeQuest = scoutIssueCodePaths({ ...QUEST, title: 'Blueprint\u0000 focus' }, projection(nodes));
  const noProjection = scoutIssueCodePaths(QUEST, null);
  check(!unsafeQuest.ok && unsafeQuest.reason === 'quest'
    && !noProjection.ok && noProjection.reason === 'projection',
  'malformed Quest input and an unloaded Blueprint projection remain unavailable');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let failed = 0;
  runIssueCodeScoutTests((condition, name) => {
    if (condition) console.log(`  ok - ${name}`);
    else {
      failed += 1;
      console.error(`  not ok - ${name}`);
    }
  });
  if (failed) process.exit(1);
  console.log('Issue-to-Code Scout tests passed');
}
