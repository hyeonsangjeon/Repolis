/* scripts/test-public-town-cache.mjs — bounded public-town (?user=) data cache (hermetic, zero deps)
 *
 * Pure fixtures for the allowlisted cache entry in assets/repo-portal.js, plus a replay of the exact
 * inline /*PUBLIC_TOWN_CACHE*\/ block from index.html against an in-memory, quota-limited storage and a
 * fixture GitHub endpoint: zero network, zero wall clock, zero LLM.
 *
 *   node scripts/test-public-town-cache.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import {
  PUBLIC_TOWN_CACHE_FIELDS,
  PUBLIC_TOWN_CACHE_INDEX_KEY,
  PUBLIC_TOWN_CACHE_LIMITS,
  compactPublicTown,
  parsePublicTownCacheKey,
  planPublicTownCache,
  projectPublicRepo,
  projectPublicRepos,
  publicProjectionReference,
  publicTownCacheKey,
  readPublicTownCache,
} from '../assets/repo-portal.js';
import { PORTABLE_TOWN_LIMITS } from '../assets/world-tree/world-tree-state.js';

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const block = name => (HTML.match(new RegExp(`/\\*${name}:START\\*/([\\s\\S]*?)/\\*${name}:END\\*/`)) || [])[1] || '';
const CHROME_QUOTA_CHARS = 5 * 1024 * 1024;   // ~5.24M UTF-16 code units per origin, measured in Chrome 155 and 156
const T0 = Date.parse('2026-10-21T00:00:00Z');
const HOUR = 3600 * 1000;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// One deterministic row in GitHub's full /users/{login}/repos shape (81 keys, ~5K characters).
function githubRepo(owner, name, index, options = {}) {
  const api = `https://api.github.com/repos/${owner}/${name}`, user = `https://api.github.com/users/${owner}`;
  const day = String(1 + (index % 28)).padStart(2, '0'), month = String(1 + (index % 9)).padStart(2, '0');
  const row = {
    id: 1000000 + index, node_id: `R_kgDOFixture${index}`, name, full_name: `${owner}/${name}`, private: false,
    owner: {
      login: owner, id: 4242, node_id: 'MDQ6VXNlcjQyNDI=', avatar_url: 'https://avatars.githubusercontent.com/u/4242?v=4',
      gravatar_id: '', url: user, html_url: `https://github.com/${owner}`, followers_url: `${user}/followers`,
      following_url: `${user}/following{/other_user}`, gists_url: `${user}/gists{/gist_id}`,
      starred_url: `${user}/starred{/owner}{/repo}`, subscriptions_url: `${user}/subscriptions`,
      organizations_url: `${user}/orgs`, repos_url: `${user}/repos`, events_url: `${user}/events{/privacy}`,
      received_events_url: `${user}/received_events`, type: 'User', user_view_type: 'public', site_admin: false,
    },
    html_url: `https://github.com/${owner}/${name}`,
    description: index % 7 === 3 ? null : `Fixture ${name}: 공개 저장소 설명 ${'· a reasonably detailed public summary '.repeat(1 + (index % 4))}`.trim(),
    fork: index % 11 === 5, url: api,
    forks_url: `${api}/forks`, keys_url: `${api}/keys{/key_id}`, collaborators_url: `${api}/collaborators{/collaborator}`,
    teams_url: `${api}/teams`, hooks_url: `${api}/hooks`, issue_events_url: `${api}/issues/events{/number}`,
    events_url: `${api}/events`, assignees_url: `${api}/assignees{/user}`, branches_url: `${api}/branches{/branch}`,
    tags_url: `${api}/tags`, blobs_url: `${api}/git/blobs{/sha}`, git_tags_url: `${api}/git/tags{/sha}`,
    git_refs_url: `${api}/git/refs{/sha}`, trees_url: `${api}/git/trees{/sha}`, statuses_url: `${api}/statuses/{sha}`,
    languages_url: `${api}/languages`, stargazers_url: `${api}/stargazers`, contributors_url: `${api}/contributors`,
    subscribers_url: `${api}/subscribers`, subscription_url: `${api}/subscription`, commits_url: `${api}/commits{/sha}`,
    git_commits_url: `${api}/git/commits{/sha}`, comments_url: `${api}/comments{/number}`,
    issue_comment_url: `${api}/issues/comments{/number}`, contents_url: `${api}/contents/{+path}`,
    compare_url: `${api}/compare/{base}...{head}`, merges_url: `${api}/merges`, archive_url: `${api}/{archive_format}{/ref}`,
    downloads_url: `${api}/downloads`, issues_url: `${api}/issues{/number}`, pulls_url: `${api}/pulls{/number}`,
    milestones_url: `${api}/milestones{/number}`, notifications_url: `${api}/notifications{?since,all,participating}`,
    labels_url: `${api}/labels{/name}`, releases_url: `${api}/releases{/id}`, deployments_url: `${api}/deployments`,
    created_at: `20${16 + (index % 9)}-${month}-${day}T08:00:00Z`,
    updated_at: `2026-${month}-${day}T09:30:00Z`,
    pushed_at: index % 13 === 7 ? null : `2026-${month}-${day}T09:00:00Z`,
    git_url: `git://github.com/${owner}/${name}.git`, ssh_url: `git@github.com:${owner}/${name}.git`,
    clone_url: `https://github.com/${owner}/${name}.git`, svn_url: `https://github.com/${owner}/${name}`,
    homepage: index % 5 === 0 ? `https://${owner}.github.io/${name}/` : (index % 5 === 1 ? '' : null),
    size: 100 + index * 37, stargazers_count: (index * 7919) % 600, watchers_count: (index * 7919) % 600,
    language: ['JavaScript', 'Python', 'TypeScript', 'Go', null, 'Jupyter Notebook'][index % 6],
    has_issues: true, has_projects: true, has_downloads: true, has_wiki: true, has_pages: index % 5 === 0,
    has_discussions: false, forks_count: (index * 31) % 90, mirror_url: null, archived: index % 17 === 9,
    disabled: false, open_issues_count: index % 12,
    license: index % 4 === 2 ? null : { key: 'mit', name: 'MIT License', spdx_id: index % 9 === 4 ? 'NOASSERTION' : 'MIT',
      url: 'https://api.github.com/licenses/mit', node_id: 'MDc6TGljZW5zZTEz' },
    allow_forking: true, is_template: false, web_commit_signoff_required: false, has_pull_requests: true,
    pull_request_creation_policy: 'all',
    topics: Array.from({ length: index % 9 }, (_, item) => ['three-js', 'llm', 'data', 'webgl', 'agents', 'cli', 'docs', 'ml', 'graph'][(index + item) % 9]),
    visibility: 'public', forks: (index * 31) % 90, open_issues: index % 12, watchers: (index * 7919) % 600,
    default_branch: index % 10 === 6 ? 'master' : 'main',
  };
  return Object.assign(row, options);
}

function githubPage(owner, count, prefix = 'repo') {
  return Array.from({ length: count }, (_, index) => githubRepo(owner, `${prefix}-${index + 1}`, index));
}

// Rows the projection either normalizes in unusual ways or rejects outright.
function adversarialPage(owner) {
  const base = (name, extra) => githubRepo(owner, name, 3, extra);
  return [
    base('ctrl-name', { name: 'ctrl\x07-na\x00me', full_name: null, description: '  \tpadded\n description  ' }),
    base('tool', { name: 'tool.git', full_name: `${owner}/tool` }),
    base('long-desc', { description: `${'a'.repeat(499)} ${'b'.repeat(120)}` }),
    base('no-owner', { owner: undefined }),
    base('upper-owner', { owner: { login: owner.toUpperCase() }, full_name: `${owner.toUpperCase()}/upper-owner` }),
    base('licenses', { license: { spdx_id: ' NOASSERTION' } }),
    base('license-shape', { license: { key: 'other' } }),
    base('topics', { topics: ['', '   ', 'ok', 'x'.repeat(60), 42, null, 'trail ', ...Array.from({ length: 30 }, (_, i) => `t${i}`)] }),
    base('topics-shape', { topics: 'not-an-array' }),
    base('home-js', { homepage: 'javascript:alert(1)' }),
    base('home-credentials', { homepage: 'https://user:pass@example.com/' }),
    base('home-normalized', { homepage: 'HTTPS://Example.COM/a b?x=1#y' }),
    base('home-relative', { homepage: 'example.com' }),
    base('counts', { stargazers_count: '12', forks_count: -3, size: 2.7, open_issues_count: 'many' }),
    base('dates', { created_at: '2026-02-30T00:00:00Z', pushed_at: ' 2026-08-20T00:00:00Z ', updated_at: '2026-08-20' }),
    base('dateless', { created_at: null, pushed_at: undefined, updated_at: '' }),
    base('flags', { fork: 'true', archived: 1, default_branch: '' }),
    base('language-shape', { language: { name: 'object' } }),
    base('twin', { stargazers_count: 4 }),
    base('twin', { stargazers_count: 4, description: 'duplicate name, identical score' }),
    base('secret-private', { private: true, pushed_at: '2026-10-20T23:59:59Z', updated_at: '2026-10-20T23:59:59Z' }),
    base('secret-disabled', { disabled: true }),
    base('foreign-owner', { owner: { login: 'someone-else' } }),
    base('foreign-full-name', { full_name: 'someone-else/foreign-full-name' }),
    base('bad name', { full_name: null }),
    base('..', { full_name: null }),
    null,
    'not-a-repo',
    42,
    [],
  ];
}

// Records every property path the projection reads from one raw row.
function projectionReads(raw) {
  const paths = new Set();
  const wrap = (value, prefix) => new Proxy(value, {
    get(target, prop, receiver) {
      const result = Reflect.get(target, prop, receiver);
      if (typeof prop !== 'string') return result;
      paths.add(prefix + prop);
      return !prefix && (prop === 'owner' || prop === 'license') && result && typeof result === 'object'
        ? wrap(result, `${prop}.`) : result;
    },
  });
  const proxy = wrap(raw, '');
  projectPublicRepo(proxy, raw.owner.login);
  publicProjectionReference([proxy]);
  return paths;
}

const roundTrip = value => JSON.parse(JSON.stringify(value));
const cachedTown = (raw, owner, reader = owner) => readPublicTownCache(roundTrip(compactPublicTown(raw, owner, T0)), reader);

class FixtureStorage {
  constructor(quota = CHROME_QUOTA_CHARS) { this.items = new Map(); this.quota = quota; }
  get length() { return this.items.size; }
  key(index) { return [...this.items.keys()][index] ?? null; }
  getItem(key) { return this.items.has(String(key)) ? this.items.get(String(key)) : null; }
  setItem(key, value) {
    key = String(key); value = String(value);
    const previous = this.items.has(key) ? key.length + this.items.get(key).length : 0;
    if (this.used() - previous + key.length + value.length > this.quota) {
      const error = new Error(`Setting the value of '${key}' exceeded the quota.`);
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.items.set(key, value);
  }
  removeItem(key) { this.items.delete(String(key)); }
  used() { let total = 0; for (const [key, value] of this.items) total += key.length + value.length; return total; }
  townLogins() { return [...this.items.keys()].map(parsePublicTownCacheKey).filter(key => key && key.version === 2).map(key => key.login).sort(); }
  order() { try { return JSON.parse(this.getItem(PUBLIC_TOWN_CACHE_INDEX_KEY)).order; } catch (_) { return null; } }
}

// api.github.com/users/{login}/repos answered from fixtures; `offline` makes every request fail like a dropped network.
function fixtureGitHub(pages) {
  const network = { requests: [], offline: false };
  network.fetch = async url => {
    network.requests.push(String(url));
    if (network.offline) throw new TypeError('Failed to fetch');
    const match = /^https:\/\/api\.github\.com\/users\/([^/]+)\/repos\?per_page=100&sort=pushed$/.exec(String(url));
    const page = match && pages.get(decodeURIComponent(match[1]).toLowerCase());
    if (!page) return new Response('{"message":"Not Found"}', { status: 404 });
    return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return network;
}

// One page boot: evaluates the exact ARRIVAL_DATA + PUBLIC_TOWN_CACHE blocks against shared storage.
function boot({ storage, network, clock }) {
  const events = [];
  class FixtureDate extends Date { static now() { return clock.now; } }
  const context = {
    AbortController, Response, TextDecoder, SyntaxError, setTimeout, clearTimeout, Date: FixtureDate,
    localStorage: storage, fetch: network.fetch, track: (name, payload) => events.push({ name, ...payload }),
    PORTABLE_TOWN_LIMITS, PUBLIC_TOWN_CACHE_INDEX_KEY, PUBLIC_TOWN_CACHE_LIMITS, compactPublicTown,
    parsePublicTownCacheKey, planPublicTownCache, projectPublicRepos, publicTownCacheKey, readPublicTownCache,
  };
  runInNewContext(`${block('ARRIVAL_DATA')}\n${block('PUBLIC_TOWN_CACHE')}\nglobalThis.api={_loadPublicCity};`, context);
  return { load: context.api._loadPublicCity, events };
}

export async function runPublicTownCacheTests(check) {
  const owner = 'Visitor';
  const page = githubPage(owner, 100);
  const pageText = JSON.stringify(page);
  const entry = compactPublicTown(page, owner, T0);
  const entryText = JSON.stringify(entry);

  check(PUBLIC_TOWN_CACHE_LIMITS.version === 2 && PUBLIC_TOWN_CACHE_LIMITS.freshTtlMs === 6 * HOUR
    && PUBLIC_TOWN_CACHE_LIMITS.maxTowns === 8 && PUBLIC_TOWN_CACHE_LIMITS.maxTownChars === 128 * 1024
    && PUBLIC_TOWN_CACHE_LIMITS.maxTowns * PUBLIC_TOWN_CACHE_LIMITS.maxTownChars <= CHROME_QUOTA_CHARS / 5,
  'public-town cache keeps the 6-hour window, at most 8 towns of 128K characters, under a fifth of the origin quota');

  check(publicTownCacheKey('Visitor') === 'repolis:public-user:visitor:v2'
    && same(parsePublicTownCacheKey('repolis:public-user:visitor:v1'), { login: 'visitor', version: 1 })
    && same(parsePublicTownCacheKey(publicTownCacheKey('octo-cat')), { login: 'octo-cat', version: 2 })
    && PUBLIC_TOWN_CACHE_INDEX_KEY === 'repolis:public-user-index:v2'
    && [PUBLIC_TOWN_CACHE_INDEX_KEY, 'repolis:repo-portal-cache:v1', 'repolis:town-creator:visitor:v1', 'repolisPassport',
      'repolisFreshness:v1', 'repolis:public-user:visitor:v2:extra', 'xrepolis:public-user:visitor:v1']
      .every(key => parsePublicTownCacheKey(key) === null),
  'versioned per-login keys parse strictly, and the LRU index or other stores never look like a cached town');

  {
    const reads = projectionReads(githubRepo(owner, 'fully-populated', 1, { homepage: 'https://example.com/' }));
    const allowed = new Set([...PUBLIC_TOWN_CACHE_FIELDS, 'owner', 'owner.login', 'license', 'license.spdx_id']);
    check([...reads].every(path => allowed.has(path)) && [...allowed].every(path => reads.has(path)),
    'the cache allowlist is exactly the set of raw fields the public projection reads');
  }

  check(same(cachedTown(page, owner).repos, projectPublicRepos(page, owner))
    && projectPublicRepos(page, owner).length === 100,
  'a cached realistic 100-repo page projects byte-identically to the live page');

  {
    const raw = adversarialPage('visitor');
    const readers = ['visitor', 'VISITOR', 'Visitor'];
    check(readers.every(reader => same(cachedTown(raw, 'visitor', reader).repos, projectPublicRepos(raw, reader)))
      && projectPublicRepos(raw, 'visitor').length === 20,
    'control characters, .git names, cut descriptions, odd licenses, topics, homepages, counts, dates, and owner case project identically');
    const stored = JSON.stringify(compactPublicTown(raw, 'visitor', T0));
    check(!/secret-private|secret-disabled|foreign-owner|someone-else|bad name/.test(stored)
      && compactPublicTown(raw, 'visitor', T0).pageLength === raw.length
      && compactPublicTown(raw, 'visitor', T0).repos.length === 20,
    'rows the projection rejects are never written, while the page length still drives partial coverage');
    check(compactPublicTown(raw, 'visitor', T0).referenceMs === Date.parse('2026-10-20T23:59:59Z')
      && same(cachedTown(raw, 'visitor').repos, projectPublicRepos(raw, 'visitor')),
    'the projection reference from a rejected newest row is kept, so recency and rank do not drift');
  }

  {
    const row = entry.repos[0];
    const keys = new Set(entry.repos.flatMap(item => Object.keys(item)));
    check(Object.keys(entry).join(',') === 'fetchedAt,pageLength,referenceMs,repos'
      && [...keys].every(key => PUBLIC_TOWN_CACHE_FIELDS.includes(key) || key === 'owner' || key === 'license')
      && entry.repos.every(item => (!item.owner || same(Object.keys(item.owner), ['login']))
        && (!item.license || same(Object.keys(item.license), ['spdx_id'])))
      && !/_url"|avatar|node_id|watchers|visibility|permissions|"private"|"disabled"/.test(entryText)
      && row.name === 'repo-1' && row.full_name === 'Visitor/repo-1',
    'entries keep only allowlisted fields verbatim: no URL templates, owner profile, counters, or false flags');
  }

  check(pageText.length > 500000 && entryText.length * 8 < pageText.length
    && entryText.length <= PUBLIC_TOWN_CACHE_LIMITS.maxTownChars / 2,
  `a realistic 100-repo page shrinks from ${pageText.length} to ${entryText.length} characters`);

  {
    const dense = Array.from({ length: 100 }, (_, index) => githubRepo(owner, `dense-repo-${'x'.repeat(18)}-${index}`, index, {
      description: 'd'.repeat(300), homepage: `https://example.com/${'h'.repeat(40)}`, license: { spdx_id: 'Apache-2.0' },
      topics: Array.from({ length: 12 }, (_, item) => `topic-${item}-${'z'.repeat(12)}`),
    }));
    const extreme = Array.from({ length: 100 }, (_, index) => githubRepo(owner, `${'n'.repeat(96)}${index}`, index, {
      description: 'd'.repeat(350), homepage: `https://example.com/${'h'.repeat(235)}`,
      topics: Array.from({ length: 20 }, (_, item) => `t${item}`.padEnd(50, 'z')),
    }));
    const denseChars = JSON.stringify(compactPublicTown(dense, owner, T0)).length;
    const extremeChars = JSON.stringify(compactPublicTown(extreme, owner, T0)).length;
    check(denseChars <= PUBLIC_TOWN_CACHE_LIMITS.maxTownChars && extremeChars > PUBLIC_TOWN_CACHE_LIMITS.maxTownChars,
    `size bound per town: dense 100-repo metadata fits (${denseChars}); GitHub-maximum fields exceed it (${extremeChars}) and are not cached`);
  }

  check(readPublicTownCache(null, owner) === null
    && readPublicTownCache({ ...entry, repos: 'nope' }, owner) === null
    && readPublicTownCache({ ...entry, fetchedAt: '1' }, owner) === null
    && readPublicTownCache({ ...entry, referenceMs: null }, owner) === null
    && readPublicTownCache({ ...entry, pageLength: 2 }, owner) === null
    && readPublicTownCache({ username: owner, fetchedAt: T0, repos: page, source: 'github-public' }, owner) === null,
  'malformed or legacy-shaped entries read as a miss instead of a town');

  {
    const full = planPublicTownCache(['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'], ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 'i');
    const touched = planPublicTownCache(full.order, ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], 'b');
    const next = planPublicTownCache(touched.order, ['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], 'j');
    const orphan = planPublicTownCache(['a', 'b'], ['a', 'b', 'x', 'w'], 'c', 3);
    const missing = planPublicTownCache(['gone', 'a', 'a'], ['a'], 'b');
    check(full.order.join('') === 'ihgfedcb' && full.evict.join('') === 'a'
      && touched.order.join('') === 'bihgfedc' && touched.evict.length === 0
      && next.order.join('') === 'jbihgfed' && next.evict.join('') === 'c'
      && orphan.order.join('') === 'cab' && orphan.evict.join('') === 'wx'
      && missing.order.join('') === 'ba' && missing.evict.length === 0,
    'LRU plan: newest first, a touched town survives, unindexed stored towns go first, missing ones drop out');
  }

  // ---- the exact inline block, page boot by page boot ----
  {
    const storage = new FixtureStorage(), clock = { now: T0 };
    const pages = new Map([['visitor', page]]);
    const network = fixtureGitHub(pages);
    const live = await boot({ storage, network, clock }).load(owner);
    const stored = storage.getItem('repolis:public-user:visitor:v2');
    check(network.requests.length === 1 && live.source === 'github-public'
      && same(live.repos, projectPublicRepos(page, owner)) && same(live.coverage, { partial: true, error: null })
      && stored && stored.length <= PUBLIC_TOWN_CACHE_LIMITS.maxTownChars && stored.length * 8 < pageText.length
      && same(storage.order(), ['visitor']),
    '?user= first visit: one request, the live projection, and one compact entry indexed as most recent');

    clock.now = T0 + 5 * HOUR;
    const reload = boot({ storage, network, clock });
    const hit = await reload.load('visitor');
    check(network.requests.length === 1 && hit.source === 'cache' && same(hit.coverage, live.coverage)
      && same(hit.repos, projectPublicRepos(page, 'visitor')) && reload.events.length === 0,
    'cache hit within six hours: no request, no event, and the identical projected town');

    clock.now = T0 + 7 * HOUR;
    network.offline = true;
    const staleBoot = boot({ storage, network, clock });
    const stale = await staleBoot.load(owner);
    check(network.requests.length === 2 && stale.source === 'stale-cache'
      && same(stale.coverage, { partial: true, error: 'network' }) && same(stale.repos, live.repos)
      && staleBoot.events.length === 1 && staleBoot.events[0].name === 'city_data_load_start',
    'after six hours a failed request falls back to the labelled stale town with partial coverage intact');

    network.offline = false;
    const refreshed = await boot({ storage, network, clock }).load(owner);
    check(network.requests.length === 3 && refreshed.source === 'github-public'
      && JSON.parse(storage.getItem('repolis:public-user:visitor:v2')).fetchedAt === T0 + 7 * HOUR,
    'an expired entry is refreshed by exactly one request');

    const missing = await boot({ storage, network, clock }).load('nobody-here');
    check(missing.repos.length === 0 && missing.error.reason === 'not_found' && missing.source === 'github-public'
      && storage.getItem('repolis:public-user:nobody-here:v2') === null && same(storage.order(), ['visitor']),
    'an unknown user renders the existing not-found state and caches nothing');
  }

  {
    const storage = new FixtureStorage(), clock = { now: T0 };
    const logins = Array.from({ length: 10 }, (_, index) => `town-${index + 1}`);
    const pages = new Map(logins.map(login => [login, githubPage(login, 3)]));
    const network = fixtureGitHub(pages);
    for (const login of logins.slice(0, 8)) { clock.now += 1000; await boot({ storage, network, clock }).load(login); }
    clock.now += 1000;
    const touched = await boot({ storage, network, clock }).load('town-1');
    for (const login of logins.slice(8)) { clock.now += 1000; await boot({ storage, network, clock }).load(login); }
    check(touched.source === 'cache' && network.requests.length === 10
      && same(storage.townLogins(), ['town-1', 'town-10', 'town-4', 'town-5', 'town-6', 'town-7', 'town-8', 'town-9'])
      && same(storage.order(), ['town-10', 'town-9', 'town-1', 'town-8', 'town-7', 'town-6', 'town-5', 'town-4']),
    'eviction order: a ninth and tenth town drop the two least recently used, and a cache hit keeps town-1');

    storage.setItem('repolis:public-user:other-tab:v2', JSON.stringify(compactPublicTown(githubPage('other-tab', 2), 'other-tab', clock.now)));
    clock.now += 1000;
    await boot({ storage, network, clock }).load('town-2');
    check(storage.townLogins().length === 8 && !storage.townLogins().includes('other-tab')
      && !storage.townLogins().includes('town-4') && storage.order()[0] === 'town-2',
    'a town written by another tab without an index entry is evicted first; the cap still holds');
  }

  {
    const storage = new FixtureStorage(), clock = { now: T0 };
    const keep = {
      repolisPassport: '{"stamps":["tree"],"repos":["alpha"]}',
      'repolisFreshness:v1': '{"v":1,"towns":{},"order":[]}',
      'repolis:repo-portal-cache:v1': '{"v":1,"order":[],"entries":{}}',
      'repolis:town-creator:alpha:v1': '{"fetchedAt":1,"profile":{}}',
      repolisLang: 'ko',
    };
    for (const [key, value] of Object.entries(keep)) storage.setItem(key, value);
    for (const login of ['alpha', 'beta', 'gamma']) {
      storage.setItem(`repolis:public-user:${login}:v1`, JSON.stringify({ username: login, fetchedAt: T0, repos: githubPage(login, 100), source: 'github-public' }));
    }
    const before = storage.used(), network = fixtureGitHub(new Map());
    boot({ storage, network, clock });
    check(before > 1000000 && storage.used() < 1000 && network.requests.length === 0
      && Object.entries(keep).every(([key, value]) => storage.getItem(key) === value)
      && ![...storage.items.keys()].some(key => /:v1$/.test(key) && key.startsWith('repolis:public-user:')),
    'first boot removes every legacy v1 raw page without a request and leaves Passport, Gazette, Portal, and Creator data intact');
  }

  {
    // Before v2 every visited town's raw page stayed until the origin quota was full.
    const storage = new FixtureStorage(), clock = { now: T0 };
    for (let index = 0, rows = 100; index < 400; index += 1) {
      const login = `legacy-${index}`;
      try { storage.setItem(`repolis:public-user:${login}:v1`, JSON.stringify({ username: login, fetchedAt: T0, repos: githubPage(login, rows), source: 'github-public' })); }
      catch (_) { if (rows === 1) break; rows = 1; }
    }
    const passport = JSON.stringify({ stamps: Array(24).fill('world-tree'), repos: Array.from({ length: 220 }, (_, i) => `visited-repo-${i}`) });
    let blocked = false;
    try { storage.setItem('repolisPassport', passport); } catch (_) { blocked = true; }
    const logins = Array.from({ length: 12 }, (_, index) => `heavy-${index + 1}`);
    const network = fixtureGitHub(new Map(logins.map(login => [login, githubPage(login, 100)])));
    for (const login of logins) { clock.now += 1000; await boot({ storage, network, clock }).load(login); }
    let writable = true;
    try { storage.setItem('repolisPassport', passport); storage.setItem('repolisFreshness:v1', 'g'.repeat(5 * 14200)); } catch (_) { writable = false; }
    const cacheChars = [...storage.items].filter(([key]) => key.startsWith('repolis:public-user')).reduce((sum, [key, value]) => sum + key.length + value.length, 0);
    check(blocked && writable && storage.townLogins().length === 8 && network.requests.length === 12
      && cacheChars <= PUBLIC_TOWN_CACHE_LIMITS.maxTowns * PUBLIC_TOWN_CACHE_LIMITS.maxTownChars,
    `legacy pages that blocked a ${passport.length}-character Passport write are purged; 12 more full towns keep ${cacheChars} cached characters`);
  }

  {
    const clock = { now: T0 };
    const tiny = new FixtureStorage(600);
    const network = fixtureGitHub(new Map([['visitor', githubPage('visitor', 5)]]));
    let threw = false, quotaLoad = null;
    try { quotaLoad = await boot({ storage: tiny, network, clock }).load('visitor'); } catch (_) { threw = true; }
    check(!threw && quotaLoad.source === 'github-public' && quotaLoad.repos.length === 5
      && tiny.getItem('repolis:public-user:visitor:v2') === null,
    'a full storage quota never breaks the live town; the entry is simply not cached');

    const storage = new FixtureStorage();
    const extreme = Array.from({ length: 100 }, (_, index) => githubRepo('huge', `${'n'.repeat(96)}${index}`, index, {
      description: 'd'.repeat(350), topics: Array.from({ length: 20 }, (_, item) => `t${item}`.padEnd(50, 'z')),
    }));
    const hugeNetwork = fixtureGitHub(new Map([['huge', extreme]]));
    const oversized = await boot({ storage, network: hugeNetwork, clock }).load('huge');
    check(oversized.source === 'github-public' && same(oversized.repos, projectPublicRepos(extreme, 'huge'))
      && storage.getItem('repolis:public-user:huge:v2') === null && storage.order() === null,
    'a town over the per-town bound renders live and is neither cached nor indexed');

    storage.setItem('repolis:public-user:visitor:v2', '{"repos":"not-a-town"');
    const corrupt = await boot({ storage, network, clock }).load('visitor');
    check(corrupt.source === 'github-public' && network.requests.length === 2
      && readPublicTownCache(JSON.parse(storage.getItem('repolis:public-user:visitor:v2')), 'visitor') !== null,
    'a corrupt entry is a miss that the next live load replaces');
  }

  {
    const storage = new FixtureStorage(), clock = { now: T0 };
    const network = fixtureGitHub(new Map([['left', githubPage('left', 4)], ['right', githubPage('right', 6)]]));
    const page1 = boot({ storage, network, clock });
    const [left, right] = await Promise.all([page1.load('left'), page1.load('right')]);
    check(left.repos.length === 4 && right.repos.length === 6 && network.requests.length === 2
      && same(storage.townLogins(), ['left', 'right']) && storage.order().length === 2
      && page1.events.filter(event => event.name === 'city_data_load_start').length === 2,
    'Twin Towns loads in parallel cache both towns without losing an index update or adding events');
  }

  {
    const cacheBlock = block('PUBLIC_TOWN_CACHE');
    check(cacheBlock.length > 0
      && (cacheBlock.match(/fetchArrivalResponse\(/g) || []).length === 1
      && !/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|indexedDB|sessionStorage|setTimeout|setInterval/.test(cacheBlock)
      && (cacheBlock.match(/\btrack\(/g) || []).length === 1 && /track\('city_data_load_start'/.test(cacheBlock)
      && /JSON\.stringify\(compactPublicTown\(raw,user,Date\.now\(\)\)\)/.test(cacheBlock)
      && !/setItem\([^;]*\braw\b/.test(cacheBlock.replace(/JSON\.stringify\(compactPublicTown\(raw,user,Date\.now\(\)\)\)/, '')),
    'the cache block adds no request, dependency, timer, or event and never stores the raw GitHub page');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let passed = 0;
  const failures = [];
  await runPublicTownCacheTests((condition, message) => {
    if (condition) { passed += 1; console.log(`  ok - ${message}`); }
    else { failures.push(message); console.error(`  not ok - ${message}`); }
  });
  if (failures.length) process.exitCode = 1;
  else console.log(`public-town cache: ${passed} checks passed`);
}
