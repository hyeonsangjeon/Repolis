/* Hermetic fixtures for assets/homecoming.js — the v1.97 first-ten-minutes rules.
 * No network, clock, storage or random source: every case passes its own reference timestamp. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HOMECOMING_LIMITS, homecomingCityName, homecomingCityType, homecomingPool, homecomingPrimaryLanguage,
  homecomingStopCopy, homecomingTimelapsePlan, homecomingUnlocks, rememberHomecomingKey, selectHomecomingStops,
} from '../assets/homecoming.js';

let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
const SRC = readFileSync(new URL('../assets/homecoming.js', import.meta.url), 'utf8');
const REF = Date.parse('2026-10-19T00:00:00Z');
const day = n => new Date(REF - n * 86400000).toISOString();

check(!/\bwindow\b|\bdocument\b|fetch\(|localStorage|sessionStorage|Date\.now|Math\.random|performance\./.test(SRC),
  'the rules module never reads the DOM, network, storage, wall clock or a random source');
check(Object.isFrozen(HOMECOMING_LIMITS) && HOMECOMING_LIMITS.timelapseMinMs === 8000 && HOMECOMING_LIMITS.timelapseMaxMs === 24000
  && HOMECOMING_LIMITS.timelapsePerYearMs === 2000 && HOMECOMING_LIMITS.plaqueMs === 2500 && HOMECOMING_LIMITS.surpriseRecentDays === 90
  && HOMECOMING_LIMITS.unlockLook === 1 && HOMECOMING_LIMITS.unlockShare === 2 && HOMECOMING_LIMITS.maxStops === 3,
  'the published limits match the agreed timelapse, plaque, surprise and unlock contract');

/* ---- timelapse plan: min(24 s, years × 2 s), at least 8 s; reduced motion and one-year towns stay still ---- */
const ten = homecomingTimelapsePlan(10), three = homecomingTimelapsePlan(3), twenty = homecomingTimelapsePlan(20);
check(ten.mode === 'animate' && ten.totalMs === 20000 && ten.stepMs === Math.round(20000 / 9), 'ten birth years play for 20 s');
check(three.totalMs === 8000 && three.stepMs === 4000, 'short histories are stretched to the 8 s minimum');
check(twenty.totalMs === 24000 && twenty.stepMs === Math.round(24000 / 19), 'long histories are capped at 24 s');
check(homecomingTimelapsePlan(10, { reducedMotion: true }).mode === 'still' && homecomingTimelapsePlan(1).mode === 'still'
  && homecomingTimelapsePlan(1).totalMs === 0, 'reduced motion and single-year towns show only the present frame');
check(homecomingTimelapsePlan(0).mode === 'none' && homecomingTimelapsePlan(-2).mode === 'none' && homecomingTimelapsePlan(2.5).mode === 'none',
  'missing or invalid histories never start a timelapse');
check([2, 4, 7, 12, 30].every(n => { const plan = homecomingTimelapsePlan(n); return plan.totalMs >= 8000 && plan.totalMs <= 24000
  && Math.abs(plan.stepMs * (n - 1) - plan.totalMs) < n; }), 'every animated plan spends its whole budget across the year transitions');

/* ---- city name: language with most repos + district type with ≥35 % share ---- */
const ownerLike = [
  ...Array.from({ length: 12 }, (_, i) => ({ repo: `ai-${i}`, lang: 'Python', zone: 'ai' })),
  ...Array.from({ length: 6 }, (_, i) => ({ repo: `infra-${i}`, lang: 'Shell', zone: 'infra' })),
  ...Array.from({ length: 10 }, (_, i) => ({ repo: `doc-${i}`, lang: i < 4 ? 'Python' : 'Jupyter Notebook', zone: 'library' })),
];
const ownerName = homecomingCityName(ownerLike, 'hyeonsangjeon');
check(ownerName.en === 'Python Lab City of hyeonsangjeon' && ownerName.ko === 'hyeonsangjeon의 파이썬 연구소 도시'
  && ownerName.type === 'lab' && ownerName.language === 'Python', 'an AI-heavy Python town is a Python Lab City');
check(homecomingCityName([{ repo: 'a', lang: 'Go', zone: 'infra' }, { repo: 'b', lang: 'Go', zone: 'web' }], 'octo').en === 'Go Port of octo',
  'a 50/50 infra/web tie resolves in the fixed Port → Lab City → Boulevard → Workshop order');
check(homecomingCityType([{ repo: 'a', zone: 'web' }, { repo: 'b', zone: 'web' }, { repo: 'c', zone: 'data' },
  { repo: 'd', zone: 'data' }, { repo: 'e', zone: 'data' }]).type === 'workshop', 'the larger qualifying district wins');
check(homecomingCityName([{ repo: 'a', lang: 'Rust', zone: 'library' }, { repo: 'b', lang: 'Rust', zone: 'commons' }], 'octo').en === 'Rust Town of octo',
  'no district reaching 35 % stays a Town');
check(homecomingCityName([{ repo: 'a', lang: null }, { repo: 'b', lang: '—' }], 'ghost').en === 'Town of ghost'
  && homecomingCityName([{ repo: 'a', lang: null }], 'ghost').ko === 'ghost의 마을', 'a town without a known language drops the modifier');
check(homecomingPrimaryLanguage([{ repo: 'a', lang: 'TypeScript' }, { repo: 'b', lang: 'Go' }]).lang === 'Go',
  'language ties break alphabetically, never by input order');
check(homecomingCityName([{ repo: 'a', lang: 'Elm', zone: 'web' }], 'x').ko === 'x의 Elm 거리', 'unknown languages keep their GitHub name in Korean');
check(homecomingCityName([], '<script>alert(1)</script>').en === 'Town of scriptalert1script', 'the login is reduced to GitHub-safe characters');

/* ---- three stops: owner-like town with known traffic ---- */
const owner = [
  { repo: 'popular', visitors: 2113, stars: 201, created: '2019-03-01T00:00:00Z', pushed: day(20), topics: ['a'], zone: 'infra' },
  { repo: 'elder', visitors: 40, stars: 3, created: '2017-01-23T00:00:00Z', pushed: '2018-06-12T00:00:00Z', topics: [], zone: 'ai' },
  { repo: 'fresh', visitors: 5, stars: 0, created: '2026-08-01T00:00:00Z', pushed: day(4), topics: ['x', 'y'], zone: 'ai' },
  { repo: 'fork', visitors: 9, stars: 2, created: '2020-01-01T00:00:00Z', pushed: day(400), lineage: { source: 'upstream/fork' }, zone: 'web' },
  { repo: 'POPULAR', visitors: 9999, stars: 999, created: '2016-01-01T00:00:00Z', zone: 'infra' },
];
const ownerStops = selectHomecomingStops(owner, { referenceTimestamp: REF });
check(ownerStops.map(stop => stop.repo).join(',') === 'popular,elder,fresh', 'owner stops are the tallest, the oldest and a tended unstarred house');
check(ownerStops[0].reason === 'visitors' && ownerStops[0].value === 2113, 'the tallest house cites its real unique visitor count');
check(ownerStops[1].kind === 'oldest' && ownerStops[1].value.created === 2017 && ownerStops[1].value.pushed === 2018,
  'the oldest house carries its creation and last-push years only');
check(ownerStops[2].reason === 'recent-unstarred' && ownerStops[2].value === 4, 'the surprise stop prefers an unstarred house pushed within 90 days');
check(homecomingPool(owner).length === 4 && !ownerStops.some(stop => stop.repo === 'POPULAR'),
  'duplicate names collapse to the first catalog entry case-insensitively');

/* ---- public API town: traffic unknown → stars; oldest equals tallest → quietest ---- */
const publicTown = [
  { repo: 'star', trafficKnown: false, visitors: null, stars: 90, created: '2015-01-01T00:00:00Z', pushed: day(2), zone: 'web' },
  { repo: 'mid', trafficKnown: false, visitors: null, stars: 4, created: '2018-01-01T00:00:00Z', pushed: day(800), zone: 'web' },
  { repo: 'quiet', trafficKnown: false, visitors: null, stars: 1, created: '2019-01-01T00:00:00Z', pushed: day(1500), zone: 'library', archived: true },
  { repo: 'nap', trafficKnown: false, visitors: null, stars: 1, created: '2019-01-01T00:00:00Z', pushed: day(1200), zone: 'data' },
];
const publicStops = selectHomecomingStops(publicTown, { referenceTimestamp: REF });
check(publicStops[0].repo === 'star' && publicStops[0].reason === 'stars' && publicStops[0].value === 90,
  'public API towns never invent traffic: the first stop is the most-starred house');
check(publicStops[1].repo === 'nap' && publicStops[1].kind === 'quietest' && publicStops[1].value === day(1200).slice(0, 10),
  'when the oldest is already stop 1 the quietest unarchived house replaces it');
check(publicStops.length === 3 && publicStops[2].reason === 'rare-zone' && publicStops[2].repo === 'quiet'
  && publicStops[2].value.zone === 'library' && publicStops[2].value.count === 1,
  'a house from a district of one or two is the surprise when nothing is tended or forked');
check(selectHomecomingStops(publicTown.map(repo => repo.repo === 'quiet' ? { ...repo, zone: 'web' } : repo), { referenceTimestamp: REF }).length === 2,
  'without a tended, forked, rare-district or tagged house the tour honestly stops at two');

/* ---- surprise priority: fork beats rare district and topics; topics close the list ---- */
const forkTown = [
  { repo: 'a', visitors: 9, stars: 5, created: '2018-01-01T00:00:00Z', zone: 'ai', topics: ['t'] },
  { repo: 'b', visitors: 1, stars: 2, created: '2017-01-01T00:00:00Z', zone: 'ai' },
  { repo: 'c', visitors: 1, stars: 2, created: '2020-01-01T00:00:00Z', zone: 'ai', topics: ['1', '2', '3'] },
  { repo: 'd', visitors: 1, stars: 2, created: '2021-01-01T00:00:00Z', zone: 'web', lineage: { source: 'origin/d' } },
];
const forkStop = selectHomecomingStops(forkTown, { referenceTimestamp: REF })[2];
check(forkStop.repo === 'd' && forkStop.reason === 'fork' && forkStop.value === 'origin/d', 'a public fork with a known source is the next surprise');
const tagged = selectHomecomingStops(forkTown.slice(0, 3), { referenceTimestamp: REF })[2];
check(tagged.repo === 'c' && tagged.reason === 'topics' && tagged.value === 3, 'the most-tagged house closes the surprise rules');
check(selectHomecomingStops(forkTown.slice(0, 2).map(repo => ({ ...repo, topics: [] })), { referenceTimestamp: REF }).length === 2,
  'no surprise is invented when no rule matches');
check(selectHomecomingStops([{ repo: 'z', stars: 0, pushed: day(10), created: '2020-01-01T00:00:00Z', zone: 'ai' },
  { repo: 'y', stars: 3, visitors: 7, created: '2019-01-01T00:00:00Z', zone: 'ai' }, { repo: 'w', stars: 0, pushed: day(10), zone: 'ai' }],
  { referenceTimestamp: null })[2]?.reason !== 'recent-unstarred', 'without a reference date the recency rule cannot fire');

/* ---- one-house, archive-only and empty towns ---- */
const one = selectHomecomingStops([{ repo: 'solo', stars: 0, created: '2024-01-01T00:00:00Z' }], { referenceTimestamp: REF });
check(one.length === 1 && one[0].repo === 'solo' && one[0].reason === 'first', 'a one-house town tours exactly one house');
const archive = [
  { repo: 'r1', archived: true, stars: 3, created: '2014-01-01T00:00:00Z', pushed: day(3000), zone: 'ruins', topics: ['old'] },
  { repo: 'r2', archived: true, stars: 8, created: '2016-01-01T00:00:00Z', pushed: day(2000), zone: 'ruins' },
  { repo: 'r3', archived: true, stars: 0, created: '2015-01-01T00:00:00Z', pushed: day(10), zone: 'ruins', topics: ['a', 'b'] },
];
const archiveStops = selectHomecomingStops(archive, { referenceTimestamp: REF });
check(archiveStops.map(stop => stop.repo).join(',') === 'r2,r1,r3' && archiveStops[2].reason === 'topics',
  'archive-only towns still tour real houses but never call an archived house recently tended');
check(selectHomecomingStops([], { referenceTimestamp: REF }).length === 0 && selectHomecomingStops(null).length === 0
  && selectHomecomingStops([{ repo: '' }, null, { landmark: true, repo: 'library' }]).length === 0,
  'empty, nameless and landmark-only catalogs produce no stops');
check(new Set(ownerStops.map(stop => stop.repo.toLowerCase())).size === ownerStops.length && Object.isFrozen(ownerStops)
  && ownerStops.every(Object.isFrozen), 'stops are unique and immutable');

/* ---- copy: exact catalog numbers, localized, no estimates ---- */
const ko = homecomingStopCopy(ownerStops[0], 'ko'), en = homecomingStopCopy(ownerStops[0], 'en');
check(ko.title === '가장 높은 집' && ko.line === '순방문자 2,113명이 이 집을 마을에서 가장 높게 세웠어요.'
  && en.line === '2,113 unique visitors raised this house the highest in town.', 'the tallest line quotes the formatted visitor count');
check(homecomingStopCopy(ownerStops[1], 'ko').line === '2017년부터 여기 살았어요. 마지막 불빛은 2018년.'
  && homecomingStopCopy(ownerStops[1], 'en').line === 'Living here since 2017. The last light was in 2018.', 'the oldest line names years only');
check(homecomingStopCopy(publicStops[0], 'ko').title === '별이 가장 많은 집' && homecomingStopCopy(publicStops[0], 'en').line.startsWith('90 stars'),
  'public towns say stars, never visitors');
check(homecomingStopCopy({ kind: 'surprise', reason: 'rare-zone', value: { zone: 'web', count: 1 } }, 'ko', { zoneName: '웹·프론트 거리' }).line
  === '웹·프론트 거리에 단 한 채뿐인 집이에요.', 'a one-house district is named with the localized district');
check(homecomingStopCopy({ kind: 'surprise', reason: 'recent-unstarred', value: 0 }, 'en').line === 'No stars yet, but tended today.',
  'a same-day push reads as today');
check(homecomingStopCopy(null, 'en') === null, 'missing stops have no copy');

/* ---- unlocks and bounded session keys ---- */
check(!homecomingUnlocks(0).look && homecomingUnlocks(1).look && !homecomingUnlocks(1).share && homecomingUnlocks(2).share
  && homecomingUnlocks('7').share && !homecomingUnlocks(-3).look, 'Look opens after one house and Share after two');
let keys = [];
for (let i = 0; i < 30; i++) keys = rememberHomecomingKey(keys, `public:user-${i}`);
keys = rememberHomecomingKey(keys, 'PUBLIC:USER-29');
check(keys.length === HOMECOMING_LIMITS.sessionKeys && keys.at(-1) === 'public:user-29' && keys.filter(k => k === 'public:user-29').length === 1,
  'the session memory deduplicates case-insensitively and keeps only the newest 24 towns');
check(rememberHomecomingKey(['a'], '').join() === 'a' && Object.isFrozen(keys), 'an empty key never erases the list');

console.log(`Homecoming: ${checks} rule, fixture and purity checks passed`);
