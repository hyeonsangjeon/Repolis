/* assets/journey.js — pure rules for the v1.98 Passport "Journey" tab.
 *
 * One page visit records three kinds of moments: the houses opened (the markVisited point), the
 * paths chosen (the intent_chosen point) and the traces left (the trace_left point). This module
 * keeps them ordered, deduplicated and bounded, and picks the copy keys that describe them; the
 * caller resolves those keys in its KO/EN dictionaries. Nothing here reads the DOM, storage,
 * network, the wall clock or a random source, and every state is a new frozen object, so the
 * caller owns the only copy (in memory, never persisted).
 */

export const JOURNEY_LIMITS = Object.freeze({
  houses: 24,
  traces: 12,
  nameChars: 60,
  zoneChars: 24,
  detailChars: 80,
  routeStops: 3,
  overflowKeys: 512,
  overflowTraceKeys: 64,
});

export const JOURNEY_PATHS = Object.freeze(['explore', 'understand', 'contribute']);

const PATH_COPY = Object.freeze({
  explore: Object.freeze({ key: 'intentExplore', short: 'journeyPathExplore', icon: '🗺️' }),
  understand: Object.freeze({ key: 'intentUnderstand', short: 'journeyPathUnderstand', icon: '⌕' }),
  contribute: Object.freeze({ key: 'intentContribute', short: 'journeyPathContribute', icon: '🧩' }),
});

/* trace_left channels → what the visitor actually left behind */
const TRACE_KIND_BY_CHANNEL = Object.freeze({
  repo_route: 'route',
  quest_issue: 'issue',
  portal_link: 'portal',
  postcard_share: 'postcard',
  postcard_download: 'postcardSave',
  postcard_copy: 'townLink',
  station: 'townLink',
  creator_hall: 'townLink',
  profile_readme: 'readme',
  intro_profile_readme: 'readme',
  twin_towns_copy: 'twin',
  twin_towns_native: 'twin',
  town_growth: 'growth',
});

const TRACE_COPY = Object.freeze({
  route: Object.freeze({ key: 'journeyTraceRoute', icon: '🧭' }),
  issue: Object.freeze({ key: 'journeyTraceIssue', icon: '🧩' }),
  portal: Object.freeze({ key: 'journeyTracePortal', icon: '🚪' }),
  postcard: Object.freeze({ key: 'journeyTracePostcard', icon: '📸' }),
  postcardSave: Object.freeze({ key: 'journeyTracePostcardSave', icon: '📸' }),
  townLink: Object.freeze({ key: 'journeyTraceTownLink', icon: '🔗' }),
  readme: Object.freeze({ key: 'journeyTraceReadme', icon: '📌' }),
  twin: Object.freeze({ key: 'journeyTraceTwin', icon: '↔' }),
  growth: Object.freeze({ key: 'journeyTraceGrowth', icon: '⏳' }),
  share: Object.freeze({ key: 'journeyTraceShare', icon: '🔗' }),
});

/* Every dictionary key this module can hand back; the runtime keeps each one in both KO and EN. */
export const JOURNEY_COPY_KEYS = Object.freeze([...new Set([
  'journeyEmpty', 'journeyHeadNoHouse', 'journeyHeadOne', 'journeyHeadMany', 'journeyLast', 'journeyNewAll', 'journeyNewSome',
  'journeyNewNone', 'journeyHousesEmpty', 'journeyPathsEmpty', 'journeyPathsNotYet', 'journeyTracesEmptyOpen',
  'journeyTracesEmptyLocked', 'journeyMoreHouses', 'journeyMoreTraces', 'journeyTotals',
  ...Object.values(PATH_COPY).flatMap(copy => [copy.key, copy.short]),
  ...Object.values(TRACE_COPY).map(copy => copy.key),
])]);

/* Control characters become spaces, whitespace collapses, and the cut is made on code points so a
 * long Korean name or an emoji is never split in half. */
function text(value, max = 120) {
  const clean = String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  return chars.length <= max ? clean : chars.slice(0, Math.max(1, max - 1)).join('').trimEnd() + '…';
}

function count(value) {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function houseKey(value) {
  return text(value, 100).toLowerCase();
}

function safeLogin(login) {
  return text(login, 39).replace(/[^A-Za-z0-9-]/g, '') || 'repolis';
}

function remember(list, key, cap) {
  return list.length >= cap ? list : Object.freeze([...list, key]);
}

export function createJourney() {
  return Object.freeze({
    seq: 0,
    houses: Object.freeze([]),
    overflow: Object.freeze([]),
    moreHouses: 0,
    firstHouses: 0,
    last: null,
    paths: Object.freeze([]),
    traces: Object.freeze([]),
    traceOverflow: Object.freeze([]),
    moreTraces: 0,
  });
}

function validJourney(journey) {
  return journey && typeof journey === 'object' && Array.isArray(journey.houses) && Array.isArray(journey.paths)
    && Array.isArray(journey.traces) && Array.isArray(journey.overflow) && Array.isArray(journey.traceOverflow)
    ? journey : createJourney();
}

/* A house joins the journey the first time it opens and keeps that place; opening it again only
 * raises its visit count. `first` says the house was new to the Passport at that moment. After the
 * visible cap, further distinct houses are counted (bounded memory), never listed. */
export function recordJourneyHouse(journey, house = {}) {
  const state = validJourney(journey);
  const key = houseKey(house && house.repo);
  if (!key) return state;
  const seq = state.seq + 1;
  const label = text(house.label || house.repo, JOURNEY_LIMITS.nameChars);
  const last = Object.freeze({ key, label });
  const index = state.houses.findIndex(item => item.key === key);
  if (index >= 0) {
    const listed = state.houses[index];
    const houses = Object.freeze(state.houses.map((item, i) => i === index
      ? Object.freeze({ ...item, visits: item.visits + 1 }) : item));
    return Object.freeze({ ...state, seq, houses, last: Object.freeze({ key, label: listed.label }) });
  }
  if (state.overflow.includes(key)) return Object.freeze({ ...state, seq, last });
  const first = house.first === true;
  const firstHouses = state.firstHouses + (first ? 1 : 0);
  if (state.houses.length < JOURNEY_LIMITS.houses) {
    const entry = Object.freeze({
      key,
      repo: text(house.repo, 100),
      label,
      zone: text(house.zone, JOURNEY_LIMITS.zoneChars).toLowerCase() || null,
      archived: house.archived === true,
      first,
      visits: 1,
      order: state.houses.length + 1,
      seq,
    });
    return Object.freeze({ ...state, seq, houses: Object.freeze([...state.houses, entry]), firstHouses, last });
  }
  return Object.freeze({ ...state, seq, overflow: remember(state.overflow, key, JOURNEY_LIMITS.overflowKeys),
    moreHouses: state.moreHouses + 1, firstHouses, last });
}

/* The three paths are kept in the order first chosen; choosing one again raises its count. */
export function recordJourneyPath(journey, intent, entry = '') {
  const state = validJourney(journey);
  const id = text(intent, 16).toLowerCase();
  if (!JOURNEY_PATHS.includes(id)) return state;
  const seq = state.seq + 1;
  const index = state.paths.findIndex(item => item.intent === id);
  if (index >= 0) {
    const paths = Object.freeze(state.paths.map((item, i) => i === index ? Object.freeze({ ...item, count: item.count + 1 }) : item));
    return Object.freeze({ ...state, seq, paths });
  }
  const path = Object.freeze({ intent: id, entry: text(entry, 16).toLowerCase() || null, count: 1, seq });
  return Object.freeze({ ...state, seq, paths: Object.freeze([...state.paths, path]) });
}

/* Only a route's stop names, an issue's house and number, or a portal's house: never a URL or a login. */
function traceDetail(kind, trace) {
  if (kind === 'route') {
    const stops = (Array.isArray(trace.stops) ? trace.stops : []).map(stop => text(stop, 40)).filter(Boolean).slice(0, JOURNEY_LIMITS.routeStops);
    return text(stops.join(' → '), JOURNEY_LIMITS.detailChars);
  }
  if (kind === 'issue') {
    const repo = text(trace.repo, 60), number = count(trace.number);
    return text([repo, number ? `#${number}` : ''].filter(Boolean).join(' '), JOURNEY_LIMITS.detailChars);
  }
  if (kind === 'portal') return text(trace.repo, 60);
  return '';
}

/* A trace keeps its first place; leaving the same trace again (same kind and detail) raises its
 * count. Unknown channels are still honest shares. After the visible cap, new traces are counted. */
export function recordJourneyTrace(journey, trace = {}) {
  const state = validJourney(journey);
  const channel = text(trace && trace.channel, 32).toLowerCase();
  if (!channel) return state;
  const kind = TRACE_KIND_BY_CHANNEL[channel] || 'share';
  const detail = traceDetail(kind, trace || {});
  const key = `${kind}|${detail.toLowerCase()}`;
  const seq = state.seq + 1;
  const index = state.traces.findIndex(item => item.key === key);
  if (index >= 0) {
    const traces = Object.freeze(state.traces.map((item, i) => i === index ? Object.freeze({ ...item, times: item.times + 1 }) : item));
    return Object.freeze({ ...state, seq, traces });
  }
  if (state.traceOverflow.includes(key)) return Object.freeze({ ...state, seq });
  if (state.traces.length < JOURNEY_LIMITS.traces) {
    const entry = Object.freeze({ key, kind, channel, detail, times: 1, seq });
    return Object.freeze({ ...state, seq, traces: Object.freeze([...state.traces, entry]) });
  }
  return Object.freeze({ ...state, seq, traceOverflow: remember(state.traceOverflow, key, JOURNEY_LIMITS.overflowTraceKeys), moreTraces: state.moreTraces + 1 });
}

/* Everything the Journey tab shows, as rows plus copy keys. Cumulative numbers come only from the
 * caller's read-only Passport lists and are limited to the current town's catalog, so another
 * town's houses never inflate this town's count. */
export function summarizeJourney(journey, context = {}) {
  const state = validJourney(journey);
  const login = safeLogin(context.login);
  const houseCount = state.houses.length + state.moreHouses;
  const empty = !houseCount && !state.paths.length && !state.traces.length;

  const town = new Set((Array.isArray(context.townRepos) ? context.townRepos : []).map(name => text(name, 100)).filter(Boolean));
  const visitedHere = new Set((Array.isArray(context.passportRepos) ? context.passportRepos : [])
    .map(name => text(name, 100)).filter(name => name && town.has(name)));
  const stampTotal = count(context.stampTotal) || 0;
  const totals = Object.freeze({
    visited: visitedHere.size,
    total: town.size,
    stamps: Math.min(count(context.stamps) || 0, stampTotal || Infinity),
    stampTotal,
  });

  const houses = Object.freeze(state.houses.map(item => Object.freeze({
    key: item.key, repo: item.repo, label: item.label, zone: item.zone, archived: item.archived,
    first: item.first, visits: item.visits, order: item.order,
  })));
  const chosen = new Set(state.paths.map(item => item.intent));
  const paths = Object.freeze(state.paths.map(item => Object.freeze({
    intent: item.intent, entry: item.entry, count: item.count, key: PATH_COPY[item.intent].key, icon: PATH_COPY[item.intent].icon,
  })));
  const unwalked = Object.freeze(JOURNEY_PATHS.filter(intent => !chosen.has(intent))
    .map(intent => Object.freeze({ intent, key: PATH_COPY[intent].short })));
  const traces = Object.freeze(state.traces.map(item => Object.freeze({
    kind: item.kind, channel: item.channel, icon: TRACE_COPY[item.kind].icon, key: TRACE_COPY[item.kind].key,
    detail: item.detail, times: item.times,
  })));

  let headline;
  if (empty) headline = { key: 'journeyEmpty', params: { login } };
  else if (!houseCount) headline = { key: 'journeyHeadNoHouse', params: { login } };
  else if (houseCount === 1) headline = { key: 'journeyHeadOne', params: { login } };
  else headline = { key: 'journeyHeadMany', params: { login, count: houseCount } };

  let firstLine = null;
  if (houseCount) {
    if (state.firstHouses >= houseCount) firstLine = { key: 'journeyNewAll', params: { count: houseCount } };
    else if (state.firstHouses > 0) firstLine = { key: 'journeyNewSome', params: { count: state.firstHouses } };
    else firstLine = { key: 'journeyNewNone', params: {} };
  }
  const shareAt = count(context.shareAt) || 2;
  const copy = Object.freeze({
    headline: Object.freeze({ key: headline.key, params: Object.freeze(headline.params) }),
    last: houseCount > 1 && state.last ? Object.freeze({ key: 'journeyLast', params: Object.freeze({ repo: state.last.label }) }) : null,
    first: firstLine ? Object.freeze({ key: firstLine.key, params: Object.freeze(firstLine.params) }) : null,
    housesEmpty: houseCount ? null : Object.freeze({ key: 'journeyHousesEmpty', params: Object.freeze({}) }),
    pathsEmpty: state.paths.length ? null : Object.freeze({ key: 'journeyPathsEmpty', params: Object.freeze({}) }),
    pathsNotYet: state.paths.length && unwalked.length ? Object.freeze({ key: 'journeyPathsNotYet', params: Object.freeze({}) }) : null,
    tracesEmpty: state.traces.length ? null : (context.shareOpen === true
      ? Object.freeze({ key: 'journeyTracesEmptyOpen', params: Object.freeze({}) })
      : Object.freeze({ key: 'journeyTracesEmptyLocked', params: Object.freeze({ count: shareAt }) })),
    moreHouses: state.moreHouses ? Object.freeze({ key: 'journeyMoreHouses', params: Object.freeze({ count: state.moreHouses }) }) : null,
    moreTraces: state.moreTraces ? Object.freeze({ key: 'journeyMoreTraces', params: Object.freeze({ count: state.moreTraces }) }) : null,
    totals: Object.freeze({ key: 'journeyTotals', params: totals }),
  });

  return Object.freeze({
    empty,
    login,
    houseCount,
    firstHouses: state.firstHouses,
    houses,
    moreHouses: state.moreHouses,
    last: state.last,
    paths,
    unwalked,
    traces,
    moreTraces: state.moreTraces,
    totals,
    copy,
  });
}
