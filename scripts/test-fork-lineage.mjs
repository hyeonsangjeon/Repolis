import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORK_LINEAGE_PALETTE,
  forkLineagePaletteIndex,
  projectForkLineage,
} from '../assets/fork-lineage.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const repositories = JSON.parse(readFileSync(join(ROOT, 'repos.json'), 'utf8'));

const valid = {
  repo: 'child',
  fork: true,
  _owner: 'fork-owner',
  lineage: {
    source: 'source-owner/source-repo',
    url: 'https://github.com/source-owner/source-repo',
  },
};
assert.deepEqual(projectForkLineage(valid), {
  source: 'source-owner/source-repo',
  url: 'https://github.com/source-owner/source-repo',
  paletteIndex: forkLineagePaletteIndex('source-owner/source-repo'),
});
assert.equal(projectForkLineage({ ...valid, fork: false }), null);
assert.equal(projectForkLineage({ ...valid, lineage: null }), null);
assert.equal(projectForkLineage({ ...valid, lineage: { ...valid.lineage, source: 'bad source' } }), null);
assert.equal(projectForkLineage({ ...valid, lineage: { ...valid.lineage, url: 'https://example.com/source-owner/source-repo' } }), null);
assert.equal(projectForkLineage({ ...valid, lineage: { ...valid.lineage, url: 'javascript:alert(1)' } }), null);
assert.equal(projectForkLineage({
  ...valid,
  lineage: { source: 'fork-owner/child', url: 'https://github.com/fork-owner/child' },
}), null);

for (let size = 1; size <= FORK_LINEAGE_PALETTE.length; size += 1) {
  const first = forkLineagePaletteIndex('source-owner/source-repo', size);
  const second = forkLineagePaletteIndex('source-owner/source-repo', size);
  assert.equal(first, second);
  assert.ok(first >= 0 && first < size);
}

const forks = repositories.filter(repo => repo.fork);
assert.ok(forks.length > 0);
assert.ok(forks.every(repo => projectForkLineage({ ...repo, _owner: 'hyeonsangjeon' })));
assert.ok(repositories.filter(repo => !repo.fork).every(repo => !Object.hasOwn(repo, 'lineage')));

console.log('ALL GREEN - fork lineage projection, sanitization, deterministic crest, and current data');
