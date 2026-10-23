/* Hermetic fixtures for assets/journey.js — the v1.98 Passport Journey rules.
 * No network, clock, storage or random source: every case builds its own in-memory journey. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JOURNEY_COPY_KEYS, JOURNEY_LIMITS, JOURNEY_PATHS, createJourney, recordJourneyHouse, recordJourneyPath, recordJourneyTrace, summarizeJourney,
} from '../assets/journey.js';

let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
const SRC = readFileSync(new URL('../assets/journey.js', import.meta.url), 'utf8');
const house = (repo, o = {}) => ({ repo, label: o.label ?? repo, zone: o.zone ?? 'web', archived: !!o.archived, first: o.first ?? true });
const houses = (journey, list) => list.reduce((state, item) => recordJourneyHouse(state, typeof item === 'string' ? house(item) : item), journey);
const OWNER_TOWN = ['Repolis', 'gtm-tracker', 'youtube-dl-nas', 'old-notes'];

check(!/\bwindow\b|\bdocument\b|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|Date\.now|new Date|Math\.random|performance\./.test(SRC),
  'the rules module never reads the DOM, network, storage, wall clock or a random source');
check(Object.isFrozen(JOURNEY_LIMITS) && JOURNEY_LIMITS.houses === 24 && JOURNEY_LIMITS.traces === 12 && JOURNEY_LIMITS.nameChars === 60
  && JOURNEY_LIMITS.routeStops === 3 && JOURNEY_PATHS.join() === 'explore,understand,contribute' && Object.isFrozen(JOURNEY_PATHS),
  'the published caps are 24 houses, 12 traces, 60-character names and the three existing paths');

/* ---- empty session ---- */
const blank = createJourney();
const emptySummary = summarizeJourney(blank, { login: 'hyeonsangjeon', townRepos: OWNER_TOWN, passportRepos: [], stamps: 0, stampTotal: 17, shareOpen: false, shareAt: 2 });
check(emptySummary.empty && emptySummary.houseCount === 0 && emptySummary.houses.length === 0 && emptySummary.paths.length === 0
  && emptySummary.traces.length === 0, 'a new page visit starts with an empty journey');
check(emptySummary.copy.headline.key === 'journeyEmpty' && emptySummary.copy.headline.params.login === 'hyeonsangjeon'
  && emptySummary.copy.housesEmpty.key === 'journeyHousesEmpty' && emptySummary.copy.pathsEmpty.key === 'journeyPathsEmpty'
  && emptySummary.copy.tracesEmpty.key === 'journeyTracesEmptyLocked' && emptySummary.copy.tracesEmpty.params.count === 2
  && emptySummary.copy.first === null && emptySummary.copy.last === null && emptySummary.copy.pathsNotYet === null,
  'the empty journey picks the empty headline and one hint per section');
check(emptySummary.unwalked.map(path => path.intent).join() === 'explore,understand,contribute'
  && emptySummary.unwalked.every(path => /^journeyPath(Explore|Understand|Contribute)$/.test(path.key)), 'every path is still unwalked');
check(summarizeJourney(blank, { shareOpen: true }).copy.tracesEmpty.key === 'journeyTracesEmptyOpen',
  'once Share is open the empty trace hint points at it instead of the unlock count');
check(summarizeJourney(undefined).empty && summarizeJourney({ houses: 'nope' }).empty && recordJourneyHouse(null, house('a')).houses.length === 1,
  'malformed or missing journeys fall back to an empty one');

/* ---- order and same-house revisit ---- */
let journey = houses(blank, [house('Repolis', { zone: 'web' }), house('gtm-tracker', { zone: 'data', first: false }), 'Repolis', 'REPOLIS']);
check(journey.houses.map(item => item.repo).join() === 'Repolis,gtm-tracker', 'houses keep the order they were first opened in');
check(journey.houses[0].visits === 3 && journey.houses[1].visits === 1 && journey.houses[0].order === 1 && journey.houses[1].order === 2,
  'opening the same house again (any case) only raises its visit count');
check(journey.houses[0].first === true && journey.houses[1].first === false && journey.firstHouses === 1,
  'the first opening decides whether a house was new to the Passport');
let summary = summarizeJourney(journey, { login: 'hyeonsangjeon', townRepos: OWNER_TOWN });
check(summary.copy.headline.key === 'journeyHeadMany' && summary.copy.headline.params.count === 2 && summary.copy.last.params.repo === 'Repolis'
  && summary.copy.first.key === 'journeyNewSome' && summary.copy.first.params.count === 1, 'two houses with one revisit name the last stop and one new house');
check(houses(blank, ['Repolis', 'gtm-tracker']).last.key === 'gtm-tracker' && journey.last.key === 'repolis' && summary.copy.last.key === 'journeyLast',
  'the last stop follows the most recent opening, including a reopened house');
const one = summarizeJourney(recordJourneyHouse(blank, house('solo')), { login: 'octo' });
check(one.copy.headline.key === 'journeyHeadOne' && one.copy.last === null && one.copy.first.key === 'journeyNewAll',
  'a single house uses the one-house headline and no last-stop line');
const returning = summarizeJourney(houses(blank, [house('a', { first: false }), house('b', { first: false })]), { login: 'octo' });
check(returning.copy.first.key === 'journeyNewNone', 'a journey through houses already in the Passport says so');
check(recordJourneyHouse(blank, { repo: '   ' }) === blank && recordJourneyHouse(blank, {}) === blank && recordJourneyHouse(blank, null) === blank,
  'nameless houses are ignored without changing the journey');

/* ---- over the cap ---- */
const thirty = Array.from({ length: 30 }, (_, i) => `repo-${String(i).padStart(2, '0')}`);
let big = houses(blank, thirty);
check(big.houses.length === JOURNEY_LIMITS.houses && big.houses.at(-1).repo === 'repo-23' && big.moreHouses === 6,
  'the first 24 distinct houses are listed and the rest are counted');
big = houses(big, ['repo-27', 'repo-27', 'repo-03']);
check(big.moreHouses === 6 && big.houses[3].visits === 2 && big.last.key === 'repo-03',
  'reopening a counted house never counts it twice; reopening a listed one raises its visits');
summary = summarizeJourney(big, { login: 'octo' });
check(summary.houseCount === 30 && summary.copy.headline.params.count === 30 && summary.copy.moreHouses.key === 'journeyMoreHouses'
  && summary.copy.moreHouses.params.count === 6 && summary.houses.length === 24, 'the headline counts every distinct house while only 24 are listed');
let wide = blank;
for (let i = 0; i < JOURNEY_LIMITS.houses + JOURNEY_LIMITS.overflowKeys + 5; i++) wide = recordJourneyHouse(wide, house(`h${i}`));
check(wide.overflow.length === JOURNEY_LIMITS.overflowKeys && wide.moreHouses === JOURNEY_LIMITS.overflowKeys + 5,
  'the overflow memory used for de-duplication is itself bounded');
let traceFlood = blank;
for (let i = 0; i < 20; i++) traceFlood = recordJourneyTrace(traceFlood, { channel: 'quest_issue', repo: 'repo', number: i + 1 });
traceFlood = recordJourneyTrace(traceFlood, { channel: 'quest_issue', repo: 'repo', number: 15 });
check(traceFlood.traces.length === JOURNEY_LIMITS.traces && traceFlood.moreTraces === 8
  && summarizeJourney(traceFlood).copy.moreTraces.params.count === 8, 'traces stop listing at 12 and count the rest once');

/* ---- public town: cumulative Passport numbers stay inside the current catalog ---- */
const publicTown = ['Hello-World', 'Spoon-Knife', 'linguist'];
const passportRepos = ['Repolis', 'gtm-tracker', 'Hello-World', 'Hello-World', 'linguist', 'not-here'];
const publicJourney = houses(blank, [house('Hello-World', { zone: 'web', first: false }), house('Spoon-Knife', { zone: 'data' })]);
const publicSummary = summarizeJourney(publicJourney, { login: 'octocat', townRepos: publicTown, passportRepos, stamps: 3, stampTotal: 17, shareOpen: true });
check(publicSummary.totals.visited === 2 && publicSummary.totals.total === 3 && publicSummary.totals.stamps === 3 && publicSummary.totals.stampTotal === 17
  && publicSummary.copy.totals.key === 'journeyTotals', "another town's houses in the shared Passport never inflate this town's count");
check(publicSummary.copy.headline.params.login === 'octocat' && publicSummary.copy.headline.key === 'journeyHeadMany',
  'a public town names its own login in the headline');
check(summarizeJourney(blank, { login: '<img src=x onerror=alert(1)>' }).login === 'imgsrcxonerroralert1'
  && summarizeJourney(blank, { login: '' }).login === 'repolis', 'logins are reduced to GitHub-safe characters before reaching copy');
check(summarizeJourney(blank, { stamps: 40, stampTotal: 17 }).totals.stamps === 17 && summarizeJourney(blank, { stamps: -1 }).totals.stamps === 0,
  'stamp totals are clamped to what exists');

/* ---- archived houses ---- */
const archived = summarizeJourney(houses(blank, [house('old-notes', { zone: 'ruins', archived: true }), house('Repolis')]), { login: 'hyeonsangjeon' });
check(archived.houses[0].archived === true && archived.houses[0].zone === 'ruins' && archived.houses[1].archived === false && archived.houseCount === 2,
  'archived houses are listed like any other, carrying only their archive flag');
check(recordJourneyHouse(blank, { repo: 'x', archived: 'yes', first: 'true' }).houses[0].archived === false
  && recordJourneyHouse(blank, { repo: 'x', archived: 'yes', first: 'true' }).houses[0].first === false, 'only real booleans set the archive and new flags');

/* ---- Korean and long names ---- */
const longName = '아주-긴-한글-레포-이름-'.repeat(8);
const korean = recordJourneyHouse(blank, { repo: 'hangul-notes', label: '  한글\n노트\t저장소  ', zone: 'Library' });
check(korean.houses[0].label === '한글 노트 저장소' && korean.houses[0].zone === 'library', 'Korean labels keep their text while control characters collapse');
const clipped = recordJourneyHouse(blank, { repo: 'long', label: longName }).houses[0].label;
check(Array.from(clipped).length === JOURNEY_LIMITS.nameChars && clipped.endsWith('…') && clipped.startsWith('아주-긴-한글'),
  'long names are cut to 60 characters with an ellipsis');
const emoji = recordJourneyHouse(blank, { repo: 'emoji', label: '🏠'.repeat(80) }).houses[0].label;
check(Array.from(emoji).length === JOURNEY_LIMITS.nameChars && !/[\ud800-\udbff](?![\udc00-\udfff])/.test(emoji),
  'the cut never splits a surrogate pair');
check(summarizeJourney(korean, { login: 'hangul' }).copy.headline.key === 'journeyHeadOne' && summarizeJourney(korean).copy.last === null,
  'one Korean house still reads as a one-house journey');

/* ---- paths ---- */
let walked = recordJourneyPath(blank, 'explore', 'card');
walked = recordJourneyPath(walked, 'EXPLORE', 'toast');
walked = recordJourneyPath(walked, 'contribute', 'panel');
walked = recordJourneyPath(walked, 'teleport', 'panel');
walked = recordJourneyPath(walked, '', 'panel');
const walkedSummary = summarizeJourney(walked, { login: 'octo' });
check(walkedSummary.paths.map(path => `${path.intent}:${path.count}`).join() === 'explore:2,contribute:1' && walked.paths[0].entry === 'card',
  'paths keep the order first chosen, count repeats and remember where the first choice came from');
check(walkedSummary.paths[0].key === 'intentExplore' && walkedSummary.paths[1].key === 'intentContribute'
  && walkedSummary.unwalked.map(path => path.intent).join() === 'understand' && walkedSummary.copy.pathsNotYet.key === 'journeyPathsNotYet',
  'chosen paths reuse the existing intent copy and the unwalked one is listed');
check(walkedSummary.copy.headline.key === 'journeyHeadNoHouse' && !walkedSummary.empty, 'a path without an opened house is not an empty journey');
const allPaths = JOURNEY_PATHS.reduce((state, intent) => recordJourneyPath(state, intent), blank);
check(summarizeJourney(allPaths).copy.pathsNotYet === null && summarizeJourney(allPaths).unwalked.length === 0, 'walking all three paths leaves nothing unwalked');

/* ---- traces ---- */
let traced = recordJourneyTrace(blank, { channel: 'repo_route', stops: ['Repolis', 'gtm tracker', 'Youtube Dl Nas', 'extra'] });
traced = recordJourneyTrace(traced, { channel: 'quest_issue', repo: 'Repolis', number: 42 });
traced = recordJourneyTrace(traced, { channel: 'station' });
traced = recordJourneyTrace(traced, { channel: 'creator_hall' });
traced = recordJourneyTrace(traced, { channel: 'postcard_download' });
traced = recordJourneyTrace(traced, { channel: 'something_new' });
traced = recordJourneyTrace(traced, { channel: '' });
const tracedSummary = summarizeJourney(traced, { login: 'octo' });
check(tracedSummary.traces.map(trace => trace.kind).join() === 'route,issue,townLink,postcardSave,share',
  'channels map to what was left, the same kind of link merges, and unknown channels stay generic shares');
check(tracedSummary.traces[0].detail === 'Repolis → gtm tracker → Youtube Dl Nas' && tracedSummary.traces[0].key === 'journeyTraceRoute',
  'a Repo Route trace keeps at most three stop names');
check(tracedSummary.traces[1].detail === 'Repolis #42' && tracedSummary.traces[1].key === 'journeyTraceIssue' && tracedSummary.traces[2].times === 2,
  'an issue trace names its house and number; repeated town links count up');
check(recordJourneyTrace(blank, { channel: 'quest_issue', repo: 'r', number: -4 }).traces[0].detail === 'r'
  && recordJourneyTrace(blank, { channel: 'repo_route', stops: 'not-a-list' }).traces[0].detail === '', 'malformed trace details are dropped, not invented');
check(tracedSummary.traces.every(trace => /^journeyTrace[A-Z]/.test(trace.key) && trace.icon && !/https?:|github\.com/.test(trace.detail)),
  'every trace row has a copy key and an icon, and no detail carries a URL');

/* ---- every key handed to the runtime is a published dictionary key ---- */
const handed = [emptySummary, summary, publicSummary, walkedSummary, tracedSummary, returning, one, summarizeJourney(traceFlood), summarizeJourney(big)]
  .flatMap(view => [...Object.values(view.copy).filter(Boolean).map(line => line.key), ...view.paths.map(path => path.key),
    ...view.unwalked.map(path => path.key), ...view.traces.map(trace => trace.key)]);
check(handed.length > 30 && handed.every(key => JOURNEY_COPY_KEYS.includes(key)) && Object.isFrozen(JOURNEY_COPY_KEYS)
  && new Set(JOURNEY_COPY_KEYS).size === JOURNEY_COPY_KEYS.length, 'every copy key the rules hand back is listed once in JOURNEY_COPY_KEYS');

/* ---- immutability ---- */
const before = houses(blank, ['a', 'b']);
const after = recordJourneyHouse(before, house('c'));
check(before.houses.length === 2 && after.houses.length === 3 && Object.isFrozen(after) && Object.isFrozen(after.houses)
  && after.houses.every(Object.isFrozen) && Object.isFrozen(tracedSummary) && Object.isFrozen(tracedSummary.copy),
  'every record returns a new frozen journey and leaves the previous one untouched');
check(after.seq === 3 && recordJourneyPath(after, 'understand').seq === 4 && recordJourneyTrace(after, { channel: 'station' }).seq === 4,
  'one sequence orders houses, paths and traces of the same visit');

console.log(`Journey: ${checks} rule, fixture and purity checks passed`);
