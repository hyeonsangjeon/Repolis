import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PORTABLE_TOWN_LIMITS,
  bindPortableResidentSlots,
  projectPortableTown,
  projectWorldTreeChronicle,
} from '../assets/world-tree/world-tree-state.js';
import {
  projectPublicRepo,
  projectPublicRepos,
  resolveRepoPortalRequest,
} from '../assets/repo-portal.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

function repo(name, options = {}) {
  return {
    repo: name,
    desc: options.desc || '',
    lang: options.lang || 'JavaScript',
    topics: options.topics || [],
    stars: options.stars || 0,
    forks: options.forks || 0,
    open_issues: options.openIssues || 0,
    archived: options.archived === true,
    created: options.created || '',
    pushed: options.pushed || '',
    updated: options.updated || '',
    rank: options.rank ?? 0,
    trafficKnown: false,
    visitors: null,
    views: null,
    clones: null,
  };
}

const foreignRepos = [
  repo('alpha', {
    created: '2018-02-01T00:00:00Z',
    pushed: '2024-08-20T00:00:00Z',
    updated: '2024-08-20T00:00:00Z',
    stars: 30,
    forks: 4,
    topics: ['ai', 'agent'],
    rank: 0,
  }),
  repo('beta', {
    created: '2019-03-01T00:00:00Z',
    pushed: '2025-08-20T00:00:00Z',
    updated: '2025-08-20T00:00:00Z',
    openIssues: 9,
    lang: 'Python',
    topics: ['data'],
    rank: 1,
  }),
  repo('missing-push', {
    created: '2020-04-01T00:00:00Z',
    updated: '2026-08-20T00:00:00Z',
    lang: 'Shell',
    topics: ['automation'],
    rank: 2,
  }),
  repo('archive', {
    archived: true,
    created: '2017-01-01T00:00:00Z',
    pushed: '2020-01-01T00:00:00Z',
    updated: '2020-01-01T00:00:00Z',
    desc: 'A completed public archive.',
    rank: 3,
  }),
];

check('canonical owner preserves generated state by identity', () => {
  const ownerState = { sentinel: 'owner-generated-state' };
  const projection = projectPortableTown({
    townOwner: 'Owner',
    currentUser: 'owner',
    repositories: foreignRepos,
    cityState: ownerState,
  });
  assert.equal(projection.kind, 'owner');
  assert.equal(projection.cityState, ownerState);
  assert.equal(projection.residents, null);
});

check('foreign public payload derives era, fallback season, Silence Ledger, and Roots', () => {
  const projection = projectPortableTown({
    townOwner: 'owner',
    currentUser: 'visitor',
    repositories: foreignRepos,
  });
  const state = projection.cityState;
  assert.equal(projection.kind, 'portable');
  assert.equal(state.portable.owner, 'visitor');
  assert.equal(state.era.founded_on, '2017-01-01');
  assert.equal(state.era.oldest_repository, 'archive');
  assert.equal(state.era.as_of, '2026-08-20');
  assert.equal(state.season.value, 'winter');
  assert.equal(state.season.fallback.used, true);
  assert.deepEqual(state.silence.repositories, {
    total: 3,
    with_push_date: 2,
    without_push_date: 1,
  });
  assert.equal(state.silence.quiet.at_least_365_days, 2);
  assert.equal(state.silence.quiet.at_least_730_days, 1);
  assert.equal(state.silence.quiet.longest.repo, 'alpha');
  assert.equal(state.roots.length, 1);
  assert.equal(state.roots[0].repo, 'archive');
  const chronicle = projectWorldTreeChronicle(state, { now: Date.parse('2026-08-20T00:00:00Z') });
  assert.equal(chronicle.available, true);
  assert.equal(chronicle.portable.owner, 'visitor');
  assert.equal(chronicle.lastSapFlow.available, false);
});

check('same normalized payload is byte-stable and order-independent', () => {
  const options = { townOwner: 'owner', currentUser: 'visitor' };
  const first = projectPortableTown({ ...options, repositories: foreignRepos });
  const second = projectPortableTown({ ...options, repositories: [...foreignRepos].reverse() });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

check('username, station destination, and Repo Portal use the same projection contract', () => {
  const publicRoute = resolveRepoPortalRequest('?user=visitor', 'owner');
  const portalRoute = resolveRepoPortalRequest('?repo=visitor/alpha', 'owner');
  assert.equal(publicRoute.mode, 'public');
  assert.equal(portalRoute.mode, 'portal');
  const oneRepo = [foreignRepos[0]];
  const fromUser = projectPortableTown({ townOwner: 'owner', currentUser: 'visitor', repositories: oneRepo });
  const fromPortal = projectPortableTown({ townOwner: 'owner', currentUser: portalRoute.target.owner, repositories: oneRepo });
  assert.equal(JSON.stringify(fromUser), JSON.stringify(fromPortal));
});

check('empty and archive-only payloads fail soft without invented residents', () => {
  const empty = projectPortableTown({ townOwner: 'owner', currentUser: 'empty', repositories: [] });
  assert.equal(empty.cityState.stats.repository_count, 0);
  assert.equal(empty.cityState.silence.repositories.total, 0);
  assert.equal(empty.cityState.roots.length, 0);
  assert.equal(empty.residents.length, 0);
  const archiveOnly = projectPortableTown({
    townOwner: 'owner',
    currentUser: 'archive-only',
    repositories: foreignRepos.filter(item => item.archived),
  });
  assert.equal(archiveOnly.cityState.roots.length, 1);
  assert.equal(archiveOnly.cityState.silence.repositories.total, 0);
  assert.equal(archiveOnly.residents.length, 0);
});

check('missing dates remain missing and use a deterministic epoch fallback', () => {
  const projection = projectPortableTown({
    townOwner: 'owner',
    currentUser: 'dateless',
    repositories: [repo('dateless')],
  });
  assert.equal(projection.cityState.era.as_of, '1970-01-01');
  assert.equal(projection.cityState.era.founded_on, '1970-01-01');
  assert.equal(projection.cityState.silence.repositories.with_push_date, 0);
  assert.equal(projection.cityState.silence.repositories.without_push_date, 1);
  assert.equal(projection.cityState.silence.quiet.longest, null);
  const invalid = projectPortableTown({
    townOwner: 'owner',
    currentUser: 'invalid-date',
    repositories: [repo('invalid-date', { pushed: '2026-02-30T00:00:00Z' })],
  });
  assert.equal(invalid.cityState.silence.repositories.with_push_date, 0);
});

check('partial and rate-limited loads remain explicit and renderable', () => {
  const projection = projectPortableTown({
    townOwner: 'owner',
    currentUser: 'limited',
    repositories: foreignRepos,
    coverage: { partial: true, error: 'rate_limit' },
  });
  assert.deepEqual(projection.cityState.portable.coverage, {
    partial: true,
    error: 'rate_limit',
    request_cap: PORTABLE_TOWN_LIMITS.publicRepoRequestCap,
  });
  assert.equal(projectWorldTreeChronicle(projection.cityState).available, true);
});

check('foreign projection excludes owner state, traffic, Shared memory, and Bound memory', () => {
  const ownerState = { secret: 'OWNER_STATE_SENTINEL' };
  const contaminated = foreignRepos.map(item => ({
    ...item,
    visitors: 987654,
    views: 876543,
    clones: 765432,
    shared: 'OWNER_SHARED_SENTINEL',
    bound_memories: ['OWNER_BOUND_SENTINEL'],
    ownerResident: 'OWNER_RESIDENT_SENTINEL',
  }));
  const projection = projectPortableTown({
    townOwner: 'owner',
    currentUser: 'visitor',
    repositories: contaminated,
    cityState: ownerState,
  });
  const text = JSON.stringify(projection);
  assert.doesNotMatch(text, /OWNER_(?:STATE|SHARED|BOUND|RESIDENT)_SENTINEL/);
  assert.equal(projection.cityState.portable.availability.visitors, false);
  assert.equal(projection.cityState.portable.availability.views, false);
  assert.equal(projection.cityState.portable.availability.clones, false);
  assert.equal(projection.cityState.portable.availability.sharedMemory, false);
  assert.equal(projection.cityState.portable.availability.boundMemory, false);
  assert.equal(projection.cityState.portable.availability.ownerResidents, false);
  assert.ok(projection.residents.every(item => item.profile.bound_memories.length === 0));
});

check('resident identities and home bindings are deterministic and quality-capped', () => {
  const many = Array.from({ length: 9 }, (_, index) => repo(`home-${index + 1}`, {
    created: `202${index % 5}-01-01T00:00:00Z`,
    pushed: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00Z`,
    updated: '2026-08-20T00:00:00Z',
    stars: 20 - index,
    rank: index,
  }));
  const projection = projectPortableTown({ townOwner: 'owner', currentUser: 'resident-town', repositories: many });
  const slots = Array.from({ length: 9 }, (_, index) => ({ id: `slot-${index + 1}` }));
  const desktop = bindPortableResidentSlots(slots, projection, many);
  const lowEnd = bindPortableResidentSlots(slots, projection, many, { lowEnd: true });
  assert.equal(desktop.activeCount, PORTABLE_TOWN_LIMITS.desktopResidents);
  assert.equal(lowEnd.activeCount, PORTABLE_TOWN_LIMITS.lowEndResidents);
  assert.equal(new Set(desktop.residents.map(item => item.bound.repo)).size, desktop.activeCount);
  assert.ok(desktop.residents.every(item => item.bound.portable
    && item.bound.repo === item.bound.repoRecord.repo
    && item._profile.portable
    && item._profile.job.key
    && item._profile.personality.key
    && item.greet.ko
    && item.greet.en));
});

check('public normalization is deterministic and never substitutes updated_at for a missing push', () => {
  const raw = {
    name: 'sample',
    full_name: 'visitor/sample',
    owner: { login: 'visitor' },
    private: false,
    disabled: false,
    stargazers_count: 3,
    forks_count: 1,
    open_issues_count: 2,
    created_at: '2020-01-01T00:00:00Z',
    pushed_at: null,
    updated_at: '2026-08-20T00:00:00Z',
  };
  const projected = projectPublicRepo(raw, 'visitor');
  assert.equal(projected.pushed, '');
  assert.equal(projected.updated, '2026-08-20T00:00:00Z');
  const rows = [
    raw,
    { ...raw, name: 'other', full_name: 'visitor/other', updated_at: '2026-08-19T00:00:00Z' },
  ];
  assert.equal(
    JSON.stringify(projectPublicRepos(rows, 'visitor')),
    JSON.stringify(projectPublicRepos(rows, 'visitor')),
  );
});

check('portable projection performs no request, storage, DOM, clock, or random work', () => {
  const source = readFileSync(new URL('../assets/world-tree/world-tree-state.js', import.meta.url), 'utf8');
  const block = source.match(/\/\*PORTABLE_TOWN_PROJECTION:START\*\/([\s\S]*?)\/\*PORTABLE_TOWN_PROJECTION:END\*\//)?.[1] || '';
  assert.ok(block.length > 0);
  assert.doesNotMatch(block, /\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|document\.|Date\.now|Math\.random/);
  let requests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    requests += 1;
    throw new Error('unexpected request');
  };
  try {
    projectPortableTown({ townOwner: 'owner', currentUser: 'visitor', repositories: foreignRepos });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests, 0);
});

console.log(`portable-town: ${passed} checks passed`);
