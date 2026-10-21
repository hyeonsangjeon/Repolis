/* assets/homecoming.js — pure rules for the v1.97 "Homecoming" first ten minutes.
 *
 * Every function here is deterministic and works only on the public catalog fields the caller
 * passes in. Nothing reads the DOM, storage, network, the wall clock or a random source, so the
 * same town always gets the same city name, the same three tour stops and the same timelapse plan.
 */

export const HOMECOMING_LIMITS = Object.freeze({
  timelapseMinMs: 8000,
  timelapseMaxMs: 24000,
  timelapsePerYearMs: 2000,
  plaqueMs: 2500,
  surpriseRecentDays: 90,
  typeShare: 0.35,
  sessionKeys: 24,
  unlockLook: 1,
  unlockShare: 2,
  maxStops: 3,
});

const DAY_MS = 86400000;

/* zone → city type, in tie-break order */
const TYPE_BY_ZONE = Object.freeze([
  ['infra', 'port'],
  ['ai', 'lab'],
  ['web', 'boulevard'],
  ['data', 'workshop'],
]);

const TYPE_COPY = Object.freeze({
  port: Object.freeze({ en: 'Port', ko: '항구 도시' }),
  lab: Object.freeze({ en: 'Lab City', ko: '연구소 도시' }),
  boulevard: Object.freeze({ en: 'Boulevard', ko: '거리' }),
  workshop: Object.freeze({ en: 'Workshop', ko: '공방' }),
  town: Object.freeze({ en: 'Town', ko: '마을' }),
});

const LANGUAGE_KO = Object.freeze({
  Python: '파이썬', JavaScript: '자바스크립트', TypeScript: '타입스크립트', Java: '자바', Kotlin: '코틀린',
  Swift: '스위프트', Rust: '러스트', Ruby: '루비', Dart: '다트', Scala: '스칼라', Shell: '셸',
  PowerShell: '파워셸', 'Jupyter Notebook': '주피터 노트북', Dockerfile: '도커파일', Lua: '루아',
  Haskell: '하스켈', Elixir: '엘릭서', Julia: '줄리아', Perl: '펄', Clojure: '클로저', Groovy: '그루비',
  'Objective-C': '오브젝티브-C',
});

const STOP_TITLES = Object.freeze({
  visitors: Object.freeze({ ko: '가장 높은 집', en: 'the tallest house' }),
  stars: Object.freeze({ ko: '별이 가장 많은 집', en: 'the most-starred house' }),
  height: Object.freeze({ ko: '가장 높은 집', en: 'the tallest house' }),
  first: Object.freeze({ ko: '가장 앞에 선 집', en: 'the first house' }),
  oldest: Object.freeze({ ko: '가장 오래된 집', en: 'the oldest house' }),
  quietest: Object.freeze({ ko: '가장 조용한 집', en: 'the quietest house' }),
  surprise: Object.freeze({ ko: '의외의 집', en: 'a surprising house' }),
});

function text(value, max = 120) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function missingLanguage(value) {
  const s = text(value, 40);
  return !s || s === '—' || s === '-' || s.toLowerCase() === 'null' || s.toLowerCase() === 'other';
}

function count(value) {
  const n = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function timestamp(value) {
  if (typeof value !== 'string' || !value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function key(repo) {
  return text(repo && repo.repo, 100).toLowerCase();
}

function safeLogin(login) {
  return text(login, 39).replace(/[^A-Za-z0-9-]/g, '') || 'repolis';
}

/* Unique, named, non-landmark catalog entries in the caller's order (the town's own rank order). */
export function homecomingPool(repositories = []) {
  const seen = new Set();
  const pool = [];
  for (const repo of Array.isArray(repositories) ? repositories : []) {
    if (!repo || typeof repo !== 'object' || repo.landmark) continue;
    const id = key(repo);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    pool.push(repo);
  }
  return pool;
}

export function homecomingPrimaryLanguage(repositories = []) {
  const counts = new Map();
  for (const repo of homecomingPool(repositories)) {
    if (missingLanguage(repo.lang)) continue;
    const lang = text(repo.lang, 40);
    counts.set(lang, (counts.get(lang) || 0) + 1);
  }
  let best = null;
  for (const [lang, n] of counts) {
    if (!best || n > best.count || (n === best.count && lang.localeCompare(best.lang, 'en') < 0)) best = { lang, count: n };
  }
  return best;
}

export function homecomingCityType(repositories = []) {
  const pool = homecomingPool(repositories);
  if (!pool.length) return { type: 'town', zone: null, share: 0 };
  const counts = new Map();
  for (const repo of pool) {
    const zone = text(repo.zone, 24);
    if (zone) counts.set(zone, (counts.get(zone) || 0) + 1);
  }
  let best = null;
  for (const [zone, type] of TYPE_BY_ZONE) {
    const share = (counts.get(zone) || 0) / pool.length;
    if (share >= HOMECOMING_LIMITS.typeShare && (!best || share > best.share)) best = { type, zone, share };
  }
  return best || { type: 'town', zone: null, share: 0 };
}

/* "{language} {type} of {login}" / "{login}의 {언어} {유형}" — the plaque that ends the timelapse. */
export function homecomingCityName(repositories = [], login = '') {
  const user = safeLogin(login);
  const language = homecomingPrimaryLanguage(repositories);
  const { type, zone, share } = homecomingCityType(repositories);
  const copy = TYPE_COPY[type];
  const lang = language ? language.lang : null;
  const langKo = lang ? (LANGUAGE_KO[lang] || lang) : null;
  return Object.freeze({
    en: lang ? `${lang} ${copy.en} of ${user}` : `${copy.en} of ${user}`,
    ko: langKo ? `${user}의 ${langKo} ${copy.ko}` : `${user}의 ${copy.ko}`,
    type,
    zone,
    share,
    language: lang,
  });
}

/* min(24 s, years × 2 s), at least 8 s, spread over the transitions between birth years. */
export function homecomingTimelapsePlan(stepCount, { reducedMotion = false } = {}) {
  const steps = Number.isInteger(stepCount) && stepCount > 0 ? stepCount : 0;
  const plaqueMs = HOMECOMING_LIMITS.plaqueMs;
  if (!steps) return Object.freeze({ mode: 'none', steps: 0, totalMs: 0, stepMs: 0, plaqueMs });
  if (reducedMotion || steps === 1) return Object.freeze({ mode: 'still', steps, totalMs: 0, stepMs: 0, plaqueMs });
  const totalMs = Math.min(HOMECOMING_LIMITS.timelapseMaxMs,
    Math.max(HOMECOMING_LIMITS.timelapseMinMs, steps * HOMECOMING_LIMITS.timelapsePerYearMs));
  return Object.freeze({ mode: 'animate', steps, totalMs, stepMs: Math.round(totalMs / (steps - 1)), plaqueMs });
}

function pickMax(list, score, tieBreak) {
  let best = null;
  for (const repo of list) {
    const value = score(repo);
    if (value === null) continue;
    if (!best || value > best.value || (value === best.value && tieBreak(repo, best.repo) < 0)) best = { repo, value };
  }
  return best;
}

function pickMin(list, score) {
  let best = null;
  for (const repo of list) {
    const value = score(repo);
    if (value === null) continue;
    if (!best || value < best.value) best = { repo, value };
  }
  return best;
}

const byStarsThenOrder = order => (a, b) => (count(b.stars) || 0) - (count(a.stars) || 0) || order.get(key(a)) - order.get(key(b));
const byOrder = order => (a, b) => order.get(key(a)) - order.get(key(b));

/* The exploring path: three distinct houses chosen only from the current catalog.
 * 1 tallest (unique visitors; public API towns use stars), 2 oldest (or, when that is stop 1, the
 * quietest unarchived house), 3 a surprising one: recently tended but unstarred → a public fork with a
 * known source → a house from a district of only one or two → the most-tagged house. */
export function selectHomecomingStops(repositories = [], { referenceTimestamp = null } = {}) {
  const pool = homecomingPool(repositories);
  const order = new Map(pool.map((repo, index) => [key(repo), index]));
  const used = new Set();
  const stops = [];
  const take = (repo, kind, reason, value) => { used.add(key(repo)); stops.push(Object.freeze({ repo: repo.repo, kind, reason, value })); };
  const free = list => list.filter(repo => !used.has(key(repo)));
  if (!pool.length) return Object.freeze([]);

  const traffic = pool.filter(repo => repo.trafficKnown !== false && (count(repo.visitors) || 0) > 0);
  const tallestByVisitors = pickMax(traffic, repo => count(repo.visitors), byStarsThenOrder(order));
  const tallestByStars = pickMax(pool, repo => { const n = count(repo.stars); return n > 0 ? n : null; }, byOrder(order));
  const tallestByHeight = pickMax(pool, repo => { const h = Number(repo.height); return Number.isFinite(h) && h > 0 ? h : null; }, byOrder(order));
  if (tallestByVisitors) take(tallestByVisitors.repo, 'tallest', 'visitors', tallestByVisitors.value);
  else if (tallestByStars) take(tallestByStars.repo, 'tallest', 'stars', tallestByStars.value);
  else if (tallestByHeight) take(tallestByHeight.repo, 'tallest', 'height', null);
  else take(pool[0], 'tallest', 'first', null);

  const oldestAll = pickMin(pool, repo => timestamp(repo.created));
  const quietest = () => pickMin(free(pool).filter(repo => !repo.archived), repo => timestamp(repo.pushed));
  if (oldestAll && !used.has(key(oldestAll.repo))) {
    take(oldestAll.repo, 'oldest', 'created', Object.freeze({
      created: new Date(oldestAll.value).getUTCFullYear(),
      pushed: timestamp(oldestAll.repo.pushed) === null ? null : new Date(timestamp(oldestAll.repo.pushed)).getUTCFullYear(),
    }));
  } else {
    const quiet = quietest();
    if (quiet) take(quiet.repo, 'quietest', 'pushed', new Date(quiet.value).toISOString().slice(0, 10));
    else {
      const nextOldest = pickMin(free(pool), repo => timestamp(repo.created));
      if (nextOldest) take(nextOldest.repo, 'oldest', 'created', Object.freeze({
        created: new Date(nextOldest.value).getUTCFullYear(),
        pushed: timestamp(nextOldest.repo.pushed) === null ? null : new Date(timestamp(nextOldest.repo.pushed)).getUTCFullYear(),
      }));
    }
  }

  const reference = Number.isFinite(referenceTimestamp) ? referenceTimestamp : null;
  const remaining = free(pool);
  if (remaining.length) {
    let surprise = null;
    if (reference !== null) {
      const recent = pickMax(remaining.filter(repo => count(repo.stars) === 0 && !repo.archived), repo => {
        const pushed = timestamp(repo.pushed);
        if (pushed === null) return null;
        const days = Math.floor((reference - pushed) / DAY_MS);
        return days >= 0 && days <= HOMECOMING_LIMITS.surpriseRecentDays ? pushed : null;
      }, byOrder(order));
      if (recent) surprise = [recent.repo, 'recent-unstarred', Math.max(0, Math.floor((reference - recent.value) / DAY_MS))];
    }
    if (!surprise) {
      const fork = remaining.find(repo => repo.lineage && typeof repo.lineage.source === 'string' && text(repo.lineage.source, 140));
      if (fork) surprise = [fork, 'fork', text(fork.lineage.source, 140)];
    }
    if (!surprise) {
      const zoneCounts = new Map();
      for (const repo of pool) { const zone = text(repo.zone, 24); if (zone) zoneCounts.set(zone, (zoneCounts.get(zone) || 0) + 1); }
      let rare = null;
      for (const repo of remaining) {
        const zone = text(repo.zone, 24), n = zone ? zoneCounts.get(zone) : 0;
        if (n >= 1 && n <= 2 && (!rare || n < rare.n)) rare = { repo, zone, n };
      }
      if (rare) surprise = [rare.repo, 'rare-zone', Object.freeze({ zone: rare.zone, count: rare.n })];
    }
    if (!surprise) {
      const tagged = pickMax(remaining, repo => {
        const n = Array.isArray(repo.topics) ? repo.topics.filter(topic => text(topic, 50)).length : 0;
        return n > 0 ? n : null;
      }, byOrder(order));
      if (tagged) surprise = [tagged.repo, 'topics', tagged.value];
    }
    if (surprise) take(surprise[0], 'surprise', surprise[1], surprise[2]);
  }
  return Object.freeze(stops.slice(0, HOMECOMING_LIMITS.maxStops));
}

function formatNumber(value, lang) {
  try { return new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US').format(value); } catch (error) { return String(value); }
}

/* One plain-text title and line per stop. Numbers come straight from the catalog; nothing is estimated.
 * The caller escapes both strings and supplies the localized district name. */
export function homecomingStopCopy(stop, lang = 'en', { zoneName = '' } = {}) {
  const ko = lang === 'ko';
  if (!stop || typeof stop !== 'object') return null;
  const titleKey = stop.kind === 'tallest' ? stop.reason : stop.kind;
  const title = (STOP_TITLES[titleKey] || STOP_TITLES.surprise)[ko ? 'ko' : 'en'];
  const n = value => formatNumber(value, lang);
  const zone = text(zoneName, 40);
  let line = '';
  if (stop.kind === 'tallest') {
    if (stop.reason === 'visitors') line = ko ? `순방문자 ${n(stop.value)}명이 이 집을 마을에서 가장 높게 세웠어요.` : `${n(stop.value)} unique visitors raised this house the highest in town.`;
    else if (stop.reason === 'stars') line = ko ? `별 ${n(stop.value)}개 — 이 마을에서 별이 가장 많은 집이에요.` : `${n(stop.value)} stars — the most-starred house in this town.`;
    else if (stop.reason === 'height') line = ko ? '이 마을에서 가장 높이 솟은 집이에요.' : 'It stands tallest in this town.';
    else line = ko ? '이 마을 목록의 맨 앞에 선 집이에요.' : 'The first house in this town’s list.';
  } else if (stop.kind === 'oldest') {
    const created = stop.value && stop.value.created, pushed = stop.value && stop.value.pushed;
    line = ko ? `${created}년부터 여기 살았어요.${pushed ? ` 마지막 불빛은 ${pushed}년.` : ''}`
      : `Living here since ${created}.${pushed ? ` The last light was in ${pushed}.` : ''}`;
  } else if (stop.kind === 'quietest') {
    line = ko ? `마지막 공개 push는 ${stop.value} — 이 마을에서 가장 오래 조용한 집이에요.` : `Last public push ${stop.value} — the quietest house in town.`;
  } else if (stop.reason === 'recent-unstarred') {
    const when = stop.value === 0 ? (ko ? '오늘' : 'today') : (ko ? `${n(stop.value)}일 전` : `${n(stop.value)} days ago`);
    line = ko ? `아직 별은 없지만 ${when}에도 손본 집이에요.` : `No stars yet, but tended ${when}.`;
  } else if (stop.reason === 'fork') {
    line = ko ? `${text(stop.value, 140)}에서 갈라져 나온 집이에요.` : `Forked from ${text(stop.value, 140)}.`;
  } else if (stop.reason === 'rare-zone') {
    const houses = stop.value && stop.value.count;
    line = houses === 1
      ? (ko ? `${zone || '이 구역'}에 단 한 채뿐인 집이에요.` : `The only house in ${zone || 'its district'}.`)
      : (ko ? `${zone || '이 구역'}에 ${n(houses)}채뿐인 집 가운데 하나예요.` : `One of only ${n(houses)} houses in ${zone || 'its district'}.`);
  } else if (stop.reason === 'topics') {
    line = ko ? `토픽 ${n(stop.value)}개 — 이 마을에서 가장 많은 이야기를 달고 있어요.` : `${n(stop.value)} topics — the most-tagged house in town.`;
  }
  return Object.freeze({ title, line });
}

export function homecomingUnlocks(visitedCount) {
  const n = count(visitedCount) || 0;
  return Object.freeze({ look: n >= HOMECOMING_LIMITS.unlockLook, share: n >= HOMECOMING_LIMITS.unlockShare, visited: n });
}

/* A small bounded memory of town keys for one browser session (the caller owns the storage). */
export function rememberHomecomingKey(list, townKey, cap = HOMECOMING_LIMITS.sessionKeys) {
  const id = text(townKey, 80).toLowerCase();
  const previous = Array.isArray(list) ? list.map(item => text(item, 80).toLowerCase()).filter(Boolean) : [];
  if (!id) return Object.freeze(previous.slice(-cap));
  return Object.freeze([...previous.filter(item => item !== id), id].slice(-Math.max(1, cap)));
}
