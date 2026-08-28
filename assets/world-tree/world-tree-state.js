import { CITY_STATE_SCHEMA, CITY_STATE_VERSION } from '../city-time.js';

const DAY_MS = 86400000;
const CITY_SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);

export const WORLD_TREE_GROWTH_LIMITS = Object.freeze({
  minimumScale: 0.96,
  maximumScale: 1.06,
  starSaturation: 5000,
  repositorySaturation: 160,
});

export const SAP_FLOW_LIMITS = Object.freeze({
  recentHours: 48,
  storedDays: 8,
  travelSeconds: 5.6,
});

export const SILENCE_LEDGER_SCHEMA = 'repolis.silence-ledger';
export const SILENCE_LEDGER_VERSION = 1;
export const SILENCE_LEDGER_THRESHOLDS_DAYS = Object.freeze([365, 730]);
export const SAP_LEDGER_SCHEMA = 'repolis.sap-ledger';
export const SAP_LEDGER_VERSION = 1;
export const SAP_LEDGER_LIMITS = Object.freeze({ entries: 30, bytes: 32768 });
export const PORTABLE_TOWN_SCHEMA = 'repolis.portable-town';
export const PORTABLE_TOWN_VERSION = 1;
export const PORTABLE_TOWN_LIMITS = Object.freeze({
  desktopResidents: 6,
  lowEndResidents: 4,
  publicRepoRequestCap: 100,
});
export const UNDERCROFT_LIMITS = Object.freeze({
  maxRecords: 64,
  desktopDust: 72,
  lowEndDust: 28,
  desktopRootRibs: 14,
  lowEndRootRibs: 8,
  pointLights: 2,
});

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function validCityState(value) {
  return value?.schema === CITY_STATE_SCHEMA && value?.version === CITY_STATE_VERSION;
}

function finiteCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function boundedText(value, maximum = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.slice(0, maximum);
}

function normalizedDate(value) {
  const text = boundedText(value, 32);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const timestamp = Date.parse(`${text}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === text
    ? text : null;
}

function logarithmicSignal(value, saturation) {
  return clamp(Math.log1p(finiteCount(value)) / Math.log1p(saturation));
}

function smoothstep(value) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function normalizeRoot(root) {
  const years = root?.active_years ?? root?.activeYears ?? {};
  const from = Number.isInteger(years.from) ? years.from : null;
  const to = Number.isInteger(years.to) ? years.to : null;
  const count = Number.isInteger(years.count) && years.count > 0 ? years.count : null;
  return Object.freeze({
    repo: boundedText(root?.repo, 160),
    activeYears: Object.freeze({ from, to, count }),
    achievement: boundedText(root?.achievement),
    achievementKo: boundedText(root?.achievement_ko),
    achievementEn: boundedText(root?.achievement_en),
  });
}

/*PORTABLE_TOWN_PROJECTION:START*/
const PORTABLE_NAMES = Object.freeze([
  Object.freeze({ ko: '\uc544\ub9ac', en: 'Ari' }),
  Object.freeze({ ko: '\ubcf4\ub77c', en: 'Bora' }),
  Object.freeze({ ko: '\ub2e4\ubbf8', en: 'Dami' }),
  Object.freeze({ ko: '\uc774\ub85c', en: 'Iro' }),
  Object.freeze({ ko: '\uc8fc\ub178', en: 'Juno' }),
  Object.freeze({ ko: '\ub8e8\ubbf8', en: 'Lumi' }),
  Object.freeze({ ko: '\ub098\ube44', en: 'Navi' }),
  Object.freeze({ ko: '\uc18c\ub77c', en: 'Sora' }),
]);

const PORTABLE_JOBS = Object.freeze({
  model: Object.freeze({
    key: 'model_cartographer',
    labels: Object.freeze({ ko: '\ubaa8\ub378 \uc9c0\ub3c4\uc0ac', en: 'model cartographer' }),
    prop: 'orb',
    color: '#8faef5',
    accent: '#c4d4ff',
  }),
  systems: Object.freeze({
    key: 'systems_keeper',
    labels: Object.freeze({ ko: '\uc2dc\uc2a4\ud15c \uc9c0\uae30', en: 'systems keeper' }),
    prop: 'toolbox',
    color: '#4fbfae',
    accent: '#9be8dc',
  }),
  interface: Object.freeze({
    key: 'interface_gardener',
    labels: Object.freeze({ ko: '\ud654\uba74 \uc815\uc6d0\uc0ac', en: 'interface gardener' }),
    prop: 'sprout',
    color: '#e2a657',
    accent: '#ffdaa0',
  }),
  signals: Object.freeze({
    key: 'signal_reader',
    labels: Object.freeze({ ko: '\uc2e0\ud638 \uad00\uce21\uc790', en: 'signal reader' }),
    prop: 'ledger',
    color: '#aa91df',
    accent: '#dacbff',
  }),
  records: Object.freeze({
    key: 'record_curator',
    labels: Object.freeze({ ko: '\uae30\ub85d \ud050\ub808\uc774\ud130', en: 'record curator' }),
    prop: 'book',
    color: '#62b979',
    accent: '#a8e6b6',
  }),
  worlds: Object.freeze({
    key: 'world_builder',
    labels: Object.freeze({ ko: '\uc138\uacc4 \uc138\uacf5\uc0ac', en: 'world builder' }),
    prop: 'badge',
    color: '#c48e79',
    accent: '#eccbbb',
  }),
  steward: Object.freeze({
    key: 'repo_steward',
    labels: Object.freeze({ ko: '\ub808\ud3ec \uc9c0\uae30', en: 'repo steward' }),
    prop: 'badge',
    color: '#d0a94e',
    accent: '#f4d98e',
  }),
});

const PORTABLE_PERSONALITIES = Object.freeze({
  curious: Object.freeze({ key: 'curious', labels: Object.freeze({ ko: '\ud638\uae30\uc2ec \ub9ce\uc740', en: 'curious' }) }),
  meticulous: Object.freeze({ key: 'meticulous', labels: Object.freeze({ ko: '\uaf3c\uaf3c\ud55c', en: 'meticulous' }) }),
  welcoming: Object.freeze({ key: 'welcoming', labels: Object.freeze({ ko: '\ub2e4\uc815\ud55c', en: 'welcoming' }) }),
  reflective: Object.freeze({ key: 'reflective', labels: Object.freeze({ ko: '\uc0ac\uc0c9\uc801\uc778', en: 'reflective' }) }),
  steady: Object.freeze({ key: 'steady', labels: Object.freeze({ ko: '\ucc28\ubd84\ud55c', en: 'steady' }) }),
});

function timestamp(value) {
  const text = boundedText(value, 40);
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (!dateMatch) return null;
  const calendarProbe = new Date(Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
  )).toISOString().slice(0, 10);
  if (calendarProbe !== `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) return null;
  const parsed = Date.parse(text.length === 10 ? `${text}T00:00:00Z` : text);
  return Number.isFinite(parsed) ? parsed : null;
}

function dayTimestamp(value) {
  const parsed = typeof value === 'number' ? value : timestamp(value);
  if (!Number.isFinite(parsed)) return null;
  const date = new Date(parsed);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayText(value) {
  const parsed = dayTimestamp(value);
  return parsed === null ? null : new Date(parsed).toISOString().slice(0, 10);
}

function compareText(left, right) {
  const a = String(left || ''), b = String(right || '');
  const lowerA = a.toLowerCase(), lowerB = b.toLowerCase();
  if (lowerA !== lowerB) return lowerA < lowerB ? -1 : 1;
  return a === b ? 0 : (a < b ? -1 : 1);
}

function stableHash(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value || '')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function portableSlug(value) {
  return boundedText(value, 100).toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'repo';
}

function portableRepository(repo) {
  if (!repo || typeof repo !== 'object' || repo.private === true) return null;
  const name = boundedText(repo.repo || repo.name, 100);
  if (!name) return null;
  return {
    repo: name,
    desc: boundedText(repo.desc || repo.description, 500),
    lang: boundedText(repo.lang || repo.language, 80) || 'Other',
    topics: Object.freeze((Array.isArray(repo.topics) ? repo.topics : [])
      .map(topic => boundedText(topic, 50)).filter(Boolean).slice(0, 24)),
    stars: finiteCount(repo.stars),
    forks: finiteCount(repo.forks),
    openIssues: finiteCount(repo.open_issues),
    archived: repo.archived === true,
    created: boundedText(repo.created, 40),
    pushed: boundedText(repo.pushed, 40),
    updated: boundedText(repo.updated, 40),
    rank: Number.isInteger(repo.rank) && repo.rank >= 0 ? repo.rank : null,
  };
}

function portableReference(repositories) {
  const candidates = [];
  for (const repo of repositories) {
    const value = timestamp(repo.updated) ?? timestamp(repo.pushed) ?? timestamp(repo.created);
    if (value !== null) candidates.push(value);
  }
  return candidates.length ? Math.max(...candidates) : Date.UTC(1970, 0, 1);
}

function portableSeason(repositories, referenceTimestamp) {
  const referenceDay = dayTimestamp(referenceTimestamp);
  const pushedDays = repositories.map(repo => dayTimestamp(repo.pushed))
    .filter(value => value !== null);
  const windowDays = 30, bucketCount = 6;
  const recentStart = referenceDay - (windowDays - 1) * DAY_MS;
  const recentCount = pushedDays.filter(day => day >= recentStart && day <= referenceDay).length;
  const historicalCounts = Array.from({ length: bucketCount }, (_, bucket) => {
    const end = referenceDay - windowDays * (bucket + 1) * DAY_MS;
    const start = end - (windowDays - 1) * DAY_MS;
    return pushedDays.filter(day => day >= start && day <= end).length;
  });
  const historicalAverage = historicalCounts.reduce((sum, count) => sum + count, 0) / bucketCount;
  const populatedBuckets = historicalCounts.filter(count => count > 0).length;
  const historySufficient = historicalCounts.reduce((sum, count) => sum + count, 0) >= bucketCount
    && populatedBuckets >= 3;
  const ratio = historicalAverage > 0 ? recentCount / historicalAverage : null;
  const activeShare = repositories.length ? recentCount / repositories.length : 0;
  let value;
  if (historySufficient) {
    value = ratio >= 1.35 ? 'spring' : ratio >= 0.85 ? 'summer' : ratio >= 0.45 ? 'autumn' : 'winter';
  } else {
    value = recentCount === 0 ? 'winter'
      : activeShare >= 0.35 ? 'spring'
        : activeShare >= 0.12 ? 'summer' : 'autumn';
  }
  return Object.freeze({
    value,
    inputs: Object.freeze({
      reference_date: dayText(referenceDay),
      activity_signal: 'latest_push_per_repository',
      recent_window_days: windowDays,
      recent_active_repositories: recentCount,
      historical_bucket_days: windowDays,
      historical_bucket_counts: Object.freeze(historicalCounts),
      historical_average: Number(historicalAverage.toFixed(3)),
      recent_to_historical_ratio: ratio === null ? null : Number(ratio.toFixed(3)),
      active_repository_share: activeShare,
      repositories_with_push_date: pushedDays.length,
    }),
    reason: historySufficient
      ? 'Recent latest-push signals are compared with six prior 30-day buckets.'
      : 'Historical latest-push coverage is insufficient; the recent active share is used.',
    fallback: Object.freeze({
      used: !historySufficient,
      rule: 'Sparse histories use recent active share: spring >= .35, summer >= .12, autumn > 0, otherwise winter.',
    }),
  });
}

function portableSilence(repositories, referenceTimestamp) {
  const referenceDay = dayTimestamp(referenceTimestamp);
  const unarchived = repositories.filter(repo => !repo.archived);
  const dated = unarchived.map(repo => {
    const pushed = dayTimestamp(repo.pushed);
    if (pushed === null) return null;
    return {
      repo: repo.repo,
      last_public_push: dayText(pushed),
      elapsed_days: Math.max(0, Math.floor((referenceDay - pushed) / DAY_MS)),
    };
  }).filter(Boolean).sort((left, right) => (
    right.elapsed_days - left.elapsed_days || compareText(left.repo, right.repo)
  ));
  return Object.freeze({
    schema: SILENCE_LEDGER_SCHEMA,
    version: SILENCE_LEDGER_VERSION,
    reference_date: dayText(referenceDay),
    scope: 'unarchived_public_repositories',
    activity_signal: 'latest_public_push',
    thresholds_days: SILENCE_LEDGER_THRESHOLDS_DAYS,
    repositories: Object.freeze({
      total: unarchived.length,
      with_push_date: dated.length,
      without_push_date: unarchived.length - dated.length,
    }),
    quiet: Object.freeze({
      at_least_365_days: dated.filter(item => item.elapsed_days >= SILENCE_LEDGER_THRESHOLDS_DAYS[0]).length,
      at_least_730_days: dated.filter(item => item.elapsed_days >= SILENCE_LEDGER_THRESHOLDS_DAYS[1]).length,
      longest: dated.length ? Object.freeze(dated[0]) : null,
    }),
  });
}

function portableRoot(repo) {
  const created = timestamp(repo.created), pushed = timestamp(repo.pushed);
  const from = created === null ? null : new Date(created).getUTCFullYear();
  const toSource = pushed ?? created;
  const to = toSource === null ? null : new Date(toSource).getUTCFullYear();
  const count = from !== null && to !== null ? Math.max(1, to - from + 1) : null;
  const fallbackEn = `A public ${repo.lang === 'Other' ? '' : `${repo.lang} `}repository preserved in this town's record.`;
  const fallbackKo = `\uc774 \ub9c8\uc744\uc758 \uae30\ub85d\uc5d0 \ub0a8\uc740 \uacf5\uac1c ${repo.lang === 'Other' ? '' : `${repo.lang} `}\ub808\ud3ec\uc785\ub2c8\ub2e4.`;
  const achievement = boundedText(repo.desc, 180);
  return Object.freeze({
    repo: repo.repo,
    active_years: Object.freeze({ from, to, count }),
    achievement: achievement || fallbackEn,
    achievement_ko: achievement || fallbackKo,
    achievement_en: achievement || fallbackEn,
  });
}

function portableJob(repo) {
  const haystack = `${repo.lang} ${repo.topics.join(' ')}`.toLowerCase();
  if (/(^|[\s-])(ai|ml|llm|rag|agent|model|machine-learning)([\s-]|$)/.test(haystack)) return PORTABLE_JOBS.model;
  if (/(docker|shell|devops|infra|server|automation|kubernetes|terraform|go\b|rust\b)/.test(haystack)) return PORTABLE_JOBS.systems;
  if (/(javascript|typescript|html|css|frontend|web|react|vue|svelte|ui\b)/.test(haystack)) return PORTABLE_JOBS.interface;
  if (/(data|analytics|csv|database|jupyter|python|pipeline|scrap)/.test(haystack)) return PORTABLE_JOBS.signals;
  if (/(docs|documentation|readme|tutorial|learn|book|knowledge)/.test(haystack)) return PORTABLE_JOBS.records;
  if (/(three|game|graphics|world|visual|creative)/.test(haystack)) return PORTABLE_JOBS.worlds;
  return PORTABLE_JOBS.steward;
}

function portablePersonality(repo, referenceTimestamp) {
  const pushed = dayTimestamp(repo.pushed);
  const ageDays = pushed === null ? null : Math.max(0, Math.floor((dayTimestamp(referenceTimestamp) - pushed) / DAY_MS));
  if (repo.openIssues >= 8) return PORTABLE_PERSONALITIES.meticulous;
  if (ageDays === null) return PORTABLE_PERSONALITIES.reflective;
  if (ageDays <= 30) return PORTABLE_PERSONALITIES.curious;
  if (repo.stars >= 20) return PORTABLE_PERSONALITIES.welcoming;
  return stableHash(repo.repo) % 2 ? PORTABLE_PERSONALITIES.steady : PORTABLE_PERSONALITIES.reflective;
}

function portableResidents(owner, repositories, referenceTimestamp) {
  const ranked = repositories.filter(repo => !repo.archived).slice().sort((left, right) => {
    const leftRank = left.rank === null ? Number.MAX_SAFE_INTEGER : left.rank;
    const rightRank = right.rank === null ? Number.MAX_SAFE_INTEGER : right.rank;
    return leftRank - rightRank || right.stars - left.stars || right.forks - left.forks
      || (timestamp(right.pushed) || 0) - (timestamp(left.pushed) || 0)
      || compareText(left.repo, right.repo);
  }).slice(0, PORTABLE_TOWN_LIMITS.desktopResidents);
  const usedNames = new Set();
  return Object.freeze(ranked.map((repo, index) => {
    const job = portableJob(repo), personality = portablePersonality(repo, referenceTimestamp);
    let nameIndex = stableHash(`${owner}|${repo.repo}|name`) % PORTABLE_NAMES.length;
    while (usedNames.has(nameIndex)) nameIndex = (nameIndex + 1) % PORTABLE_NAMES.length;
    usedNames.add(nameIndex);
    const name = PORTABLE_NAMES[nameIndex], slug = portableSlug(repo.repo);
    const created = dayTimestamp(repo.created);
    const ageDays = created === null ? null
      : Math.max(0, Math.floor((dayTimestamp(referenceTimestamp) - created) / DAY_MS));
    const lastPush = dayText(repo.pushed);
    const languageKo = repo.lang === 'Other' ? '\uc5b8\uc5b4 \ud45c\uc2dd\uc774 \uc5c6\ub294' : `${repo.lang} \ud45c\uc2dd\uc774 \ubd99\uc740`;
    const languageEn = repo.lang === 'Other' ? 'a repo with no language label' : `a ${repo.lang} repo`;
    const greeting = Object.freeze({
      ko: `\uc800\ub294 ${name.ko}, ${repo.repo} \uc9d1\uc758 ${job.labels.ko}\uc608\uc694.`,
      en: `I'm ${name.en}, the ${job.labels.en} at ${repo.repo}.`,
    });
    const ambient = Object.freeze({
      ko: Object.freeze([
        `${repo.repo}\ub294 ${languageKo} \uacf5\uac1c \uc9d1\uc774\uc5d0\uc694.`,
        repo.openIssues
          ? `\uacf5\uac1c \uc774\uc288 ${repo.openIssues}\uac1c\uac00 \ubcf4\uc5ec\uc11c \ud604\uad00 \uc7a5\ubd80\ub97c \uc0b4\ud3b4\ubcf4\ub294 \uc911\uc774\uc5d0\uc694.`
          : '\uacf5\uac1c \uc774\uc288 \uc7a5\ubd80\ub294 \uc870\uc6a9\ud558\ub124\uc694.',
        lastPush
          ? `\ub9c8\uc9c0\ub9c9 \uacf5\uac1c push\ub294 ${lastPush}\ub85c \uc801\ud600 \uc788\uc5b4\uc694.`
          : '\uc0ac\uc6a9\ud560 \uc218 \uc788\ub294 \ub9c8\uc9c0\ub9c9 \uacf5\uac1c push \ub0a0\uc9dc\ub294 \uc5c6\uc5b4\uc694.',
      ]),
      en: Object.freeze([
        `${repo.repo} is ${languageEn} open to the public.`,
        repo.openIssues
          ? `${repo.openIssues} public open issues are listed, so I am checking the ledger by the door.`
          : 'The public issue ledger is quiet.',
        lastPush
          ? `The last public push is dated ${lastPush}.`
          : 'No usable last public push date is available.',
      ]),
    });
    const profile = Object.freeze({
      schema: 'repolis.portable-resident',
      version: 1,
      portable: true,
      repo: Object.freeze({
        slug,
        name: repo.repo,
        summary: repo.desc,
        language: repo.lang,
        topics: repo.topics,
      }),
      age: Object.freeze({ created_on: dayText(created), days: ageDays }),
      job,
      personality,
      greeting,
      blurb: Object.freeze({
        ko: `${name.ko} \u00b7 ${repo.repo}\uc5d0 \ubb36\uc778 ${personality.labels.ko} ${job.labels.ko}\uc785\ub2c8\ub2e4.`,
        en: `${name.en} is the ${personality.labels.en} ${job.labels.en} bound to ${repo.repo}.`,
      }),
      ambient,
      publicSignals: Object.freeze({
        stars: repo.stars,
        forks: repo.forks,
        openIssues: repo.openIssues,
        lastPublicPush: lastPush,
      }),
      recent_concerns: Object.freeze([]),
      bound_memories: Object.freeze([]),
      shared: Object.freeze({ available: false, reason: 'not_loaded_for_public_town' }),
      availability: Object.freeze({
        concernTitles: false,
        boundMemory: false,
        sharedMemory: false,
        dialogue: 'local',
      }),
    });
    return Object.freeze({
      id: `portable-${String(index + 1).padStart(2, '0')}`,
      repo: repo.repo,
      slug,
      name,
      job,
      personality,
      greeting,
      profile,
    });
  }));
}

function portableDirectory(repositories, residents) {
  const profiles = Object.freeze(repositories.map(repo => Object.freeze({
    slug: portableSlug(repo.repo),
    repo: repo.repo,
    archived: repo.archived,
    dialogue_available: !repo.archived,
  })));
  const activeRoster = Object.freeze(residents.map(resident => Object.freeze({
    resident_id: resident.id,
    slug: resident.slug,
    repo: resident.repo,
    name: resident.name,
  })));
  return Object.freeze({
    profiles,
    active_roster: activeRoster,
  });
}

function portableCityState(owner, repositories, coverage) {
  const referenceTimestamp = portableReference(repositories);
  const referenceDay = dayTimestamp(referenceTimestamp);
  const dated = repositories.map(repo => {
    const created = dayTimestamp(repo.created);
    return created === null ? null : { created, repo: repo.repo };
  }).filter(Boolean).sort((left, right) => left.created - right.created || compareText(left.repo, right.repo));
  const founded = dated.length ? dated[0].created : referenceDay;
  const ageDays = Math.max(0, Math.floor((referenceDay - founded) / DAY_MS));
  const archived = repositories.filter(repo => repo.archived);
  const season = portableSeason(repositories, referenceTimestamp);
  const languages = new Map();
  for (const repo of repositories) languages.set(repo.lang, (languages.get(repo.lang) || 0) + 1);
  const languageDistribution = Object.freeze([...languages.entries()]
    .sort((left, right) => right[1] - left[1] || compareText(left[0], right[0]))
    .map(([language, count]) => Object.freeze({ language, repositories: count })));
  const partial = coverage?.partial === true;
  const error = boundedText(coverage?.error, 32) || null;
  return Object.freeze({
    schema: CITY_STATE_SCHEMA,
    version: CITY_STATE_VERSION,
    era: Object.freeze({
      founded_on: dayText(founded),
      oldest_repository: dated[0]?.repo || '',
      as_of: dayText(referenceDay),
      city_age_days: ageDays,
      city_age_years: Number((ageDays / 365.2425).toFixed(2)),
      city_year: Math.floor(ageDays / 365.2425) + 1,
      basis: 'Oldest creation date in the normalized public repository payload.',
    }),
    season,
    silence: portableSilence(repositories, referenceTimestamp),
    stats: Object.freeze({
      repository_count: repositories.length,
      active_repository_count: repositories.length - archived.length,
      archived_repository_count: archived.length,
      total_stars: repositories.reduce((sum, repo) => sum + repo.stars, 0),
      total_forks: repositories.reduce((sum, repo) => sum + repo.forks, 0),
      language_distribution: languageDistribution,
      latest_push_signal: Object.freeze({
        repositories_with_push_date: repositories.filter(repo => timestamp(repo.pushed) !== null).length,
        recent_30d_repositories: season.inputs.recent_active_repositories,
      }),
      commit_history: Object.freeze({
        available: false,
        total: null,
        limitation: 'The public repository payload exposes latest push timestamps, not complete commit history.',
      }),
    }),
    last_sap_flow: null,
    roots: Object.freeze(archived.map(portableRoot)),
    portable: Object.freeze({
      schema: PORTABLE_TOWN_SCHEMA,
      version: PORTABLE_TOWN_VERSION,
      owner,
      reference_date: dayText(referenceDay),
      reference_basis: 'newest_public_repository_timestamp',
      coverage: Object.freeze({
        partial,
        error,
        request_cap: PORTABLE_TOWN_LIMITS.publicRepoRequestCap,
      }),
      availability: Object.freeze({
        visitors: false,
        views: false,
        clones: false,
        sharedMemory: false,
        boundMemory: false,
        ownerResidents: false,
        realtime: false,
        groundedBackend: false,
      }),
    }),
  });
}

export function projectPortableTown({
  townOwner = '',
  currentUser = '',
  repositories = [],
  cityState = null,
  coverage = null,
} = {}) {
  const owner = boundedText(townOwner, 39);
  const user = boundedText(currentUser, 39) || owner;
  if (owner && user.toLowerCase() === owner.toLowerCase()) {
    return Object.freeze({
      kind: 'owner',
      owner: user,
      cityState,
      residents: null,
      directory: null,
      limits: PORTABLE_TOWN_LIMITS,
    });
  }
  const normalized = (Array.isArray(repositories) ? repositories : [])
    .map(portableRepository).filter(Boolean)
    .sort((left, right) => compareText(left.repo, right.repo));
  const projectedState = portableCityState(user, normalized, coverage);
  const residents = portableResidents(user, normalized, dayTimestamp(projectedState.era.as_of));
  return Object.freeze({
    kind: 'portable',
    owner: user,
    cityState: projectedState,
    residents,
    directory: portableDirectory(normalized, residents),
    limits: PORTABLE_TOWN_LIMITS,
  });
}

export function bindPortableResidentSlots(slots, projection, repositories, options = {}) {
  if (projection?.kind !== 'portable') {
    return Object.freeze({
      residents: [],
      generated: false,
      portable: false,
      activeCount: 0,
      profileCount: 0,
      directory: null,
    });
  }
  const limit = options.lowEnd
    ? PORTABLE_TOWN_LIMITS.lowEndResidents : PORTABLE_TOWN_LIMITS.desktopResidents;
  const repoMap = new Map((Array.isArray(repositories) ? repositories : [])
    .filter(repo => repo?.repo)
    .map(repo => [String(repo.repo).toLowerCase(), repo]));
  const residents = [];
  for (let index = 0; index < Math.min(limit, slots?.length || 0, projection.residents.length); index += 1) {
    const slot = slots[index], projected = projection.residents[index];
    const repo = repoMap.get(projected.repo.toLowerCase());
    if (!slot?.id || !repo || repo.archived) continue;
    const color = Number.parseInt(projected.job.color.slice(1), 16);
    const accent = Number.parseInt(projected.job.accent.slice(1), 16);
    residents.push({
      id: slot.id,
      zone: 'plaza',
      color,
      accent,
      tone: projected.personality.labels.en,
      topics: projected.profile.repo.topics.slice(),
      ko: { name: projected.name.ko, role: projected.job.labels.ko },
      en: { name: projected.name.en, role: projected.job.labels.en },
      greet: { ...projected.greeting },
      blurb: { ...projected.profile.blurb },
      amb: {
        ko: projected.profile.ambient.ko.slice(),
        en: projected.profile.ambient.en.slice(),
      },
      bound: {
        residentId: slot.id,
        repo: projected.repo,
        slug: projected.slug,
        path: null,
        profileDigest: null,
        authorityDigest: null,
        jobKey: projected.job.key,
        jobColor: projected.job.color,
        jobProp: projected.job.prop,
        generated: false,
        portable: true,
        repoRecord: repo,
      },
      _profile: projected.profile,
      _profileState: 'portable',
    });
  }
  const directory = Object.freeze({
    profiles: projection.directory.profiles,
    active_roster: Object.freeze(residents.map(resident => Object.freeze({
      resident_id: resident.id,
      slug: resident.bound.slug,
      repo: resident.bound.repo,
      name: Object.freeze({ ko: resident.ko.name, en: resident.en.name }),
    }))),
  });
  return Object.freeze({
    residents,
    generated: false,
    portable: true,
    activeCount: residents.length,
    profileCount: projection.directory.profiles.length,
    directory,
  });
}
/*PORTABLE_TOWN_PROJECTION:END*/

/*UNDERCROFT_PROJECTION:START*/
export function projectUndercroftArchive({
  owner = '',
  roots = [],
  repositories = [],
} = {}) {
  const townOwner = boundedText(owner, 39);
  const ownerKey = townOwner.toLowerCase();
  const archivedByName = new Map();
  for (const repo of Array.isArray(repositories) ? repositories : []) {
    if (!repo || typeof repo !== 'object' || repo.private === true || repo.archived !== true) continue;
    const name = boundedText(repo.repo, 100);
    const repoOwner = boundedText(repo._owner || townOwner, 39);
    if (!name || !repoOwner || repoOwner.toLowerCase() !== ownerKey) continue;
    archivedByName.set(name.toLowerCase(), Object.freeze({
      repo: name,
      owner: repoOwner,
      url: `https://github.com/${encodeURIComponent(repoOwner)}/${encodeURIComponent(name)}`,
      createdOn: dayText(repo.created),
      lastPublicActivity: dayText(repo.pushed),
    }));
  }

  const records = [], seen = new Set();
  for (const source of Array.isArray(roots) ? roots : []) {
    const root = normalizeRoot(source), key = root.repo.toLowerCase();
    const repo = archivedByName.get(key);
    if (!root.repo || seen.has(key) || !repo) continue;
    seen.add(key);
    records.push(Object.freeze({
      ...repo,
      activeYears: root.activeYears,
      achievement: root.achievement,
      achievementKo: root.achievementKo,
      achievementEn: root.achievementEn,
    }));
  }
  const totalRecords = records.length;
  const spatialRecords = records.slice(0, UNDERCROFT_LIMITS.maxRecords);
  return Object.freeze({
    available: true,
    owner: townOwner,
    totalRecords,
    overflow: Math.max(0, totalRecords - spatialRecords.length),
    records: Object.freeze(spatialRecords),
    limits: UNDERCROFT_LIMITS,
  });
}
/*UNDERCROFT_PROJECTION:END*/

export function projectWorldTreeGrowth(cityState) {
  if (!validCityState(cityState)) {
    return Object.freeze({
      available: false,
      stars: 0,
      repositories: 0,
      starSignal: 0,
      repositorySignal: 0,
      combinedSignal: 0,
      scale: 1,
      haloScale: 1,
      energyGain: 1,
    });
  }

  const stars = finiteCount(cityState.stats?.total_stars);
  const repositories = finiteCount(cityState.stats?.repository_count);
  const starSignal = logarithmicSignal(stars, WORLD_TREE_GROWTH_LIMITS.starSaturation);
  const repositorySignal = logarithmicSignal(
    repositories,
    WORLD_TREE_GROWTH_LIMITS.repositorySaturation,
  );
  const combinedSignal = starSignal * 0.58 + repositorySignal * 0.42;
  const eased = smoothstep(combinedSignal);
  const scale = WORLD_TREE_GROWTH_LIMITS.minimumScale
    + (WORLD_TREE_GROWTH_LIMITS.maximumScale - WORLD_TREE_GROWTH_LIMITS.minimumScale) * eased;

  return Object.freeze({
    available: true,
    stars,
    repositories,
    starSignal,
    repositorySignal,
    combinedSignal,
    scale,
    haloScale: 0.98 + eased * 0.05,
    energyGain: 0.94 + eased * 0.12,
  });
}

export function resolveSapFlowFreshness(lastSapFlow, now = Date.now()) {
  const timestamp = Date.parse(String(lastSapFlow ?? ''));
  if (!Number.isFinite(timestamp)) {
    return Object.freeze({
      available: false,
      timestamp: null,
      ageDays: null,
      freshness: 'unavailable',
      animate: false,
    });
  }

  const ageMs = Math.max(0, Number(now) - timestamp);
  const ageDays = Math.floor(ageMs / DAY_MS);
  const recent = ageMs <= SAP_FLOW_LIMITS.recentHours * 3600000;
  const freshness = recent
    ? 'recent'
    : ageMs <= SAP_FLOW_LIMITS.storedDays * DAY_MS ? 'stored' : 'stale';
  return Object.freeze({
    available: true,
    timestamp: new Date(timestamp).toISOString(),
    ageDays,
    freshness,
    animate: recent,
  });
}

export function resolveSapFlowMode(sapFlow, options = {}) {
  if (!sapFlow?.available) return 'none';
  if (options.reducedMotion || options.lowEnd || !sapFlow.animate) return 'static';
  return 'travel';
}

function strictCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function projectSapMetric(value, repositoryCount) {
  if (!exactKeys(value, ['total', 'repositories_with_value', 'repositories_without_value'])) return null;
  const known = strictCount(value.repositories_with_value);
  const unknown = strictCount(value.repositories_without_value);
  const total = value.total === null ? null : strictCount(value.total);
  if (known === null || unknown === null || known + unknown !== repositoryCount
      || (value.total !== null && total === null) || (unknown > 0 && total !== null)) return null;
  return Object.freeze({ total, knownRepositories: known, unknownRepositories: unknown });
}

function projectSapEntry(value) {
  if (!exactKeys(value, ['reference_date', 'repositories', 'stars', 'forks', 'season', 'silence'])) return null;
  const referenceDate = normalizedDate(value.reference_date);
  const repositories = value.repositories;
  if (!referenceDate || !exactKeys(repositories, [
    'public', 'archived', 'latest_push_with_date', 'latest_push_without_date', 'recent_active_30d',
  ])) return null;
  const publicCount = strictCount(repositories.public);
  const archived = strictCount(repositories.archived);
  const withPushDate = strictCount(repositories.latest_push_with_date);
  const withoutPushDate = strictCount(repositories.latest_push_without_date);
  const recentActive = strictCount(repositories.recent_active_30d);
  if ([publicCount, archived, withPushDate, withoutPushDate, recentActive].includes(null)
      || archived > publicCount || withPushDate + withoutPushDate !== publicCount
      || recentActive > withPushDate) return null;
  const stars = projectSapMetric(value.stars, publicCount);
  const forks = projectSapMetric(value.forks, publicCount);
  const season = value.season;
  if (!stars || !forks || !exactKeys(season, ['value', 'fallback_used'])
      || !CITY_SEASONS.includes(season.value) || typeof season.fallback_used !== 'boolean') return null;
  const silence = value.silence;
  if (!exactKeys(silence, [
    'unarchived', 'with_push_date', 'without_push_date', 'at_least_365_days', 'at_least_730_days',
  ])) return null;
  const silenceValues = {
    unarchived: strictCount(silence.unarchived),
    withPushDate: strictCount(silence.with_push_date),
    withoutPushDate: strictCount(silence.without_push_date),
    atLeast365Days: strictCount(silence.at_least_365_days),
    atLeast730Days: strictCount(silence.at_least_730_days),
  };
  if (Object.values(silenceValues).includes(null)
      || silenceValues.unarchived !== publicCount - archived
      || silenceValues.withPushDate + silenceValues.withoutPushDate !== silenceValues.unarchived
      || silenceValues.atLeast730Days > silenceValues.atLeast365Days
      || silenceValues.atLeast365Days > silenceValues.withPushDate) return null;
  return Object.freeze({
    referenceDate,
    repositories: Object.freeze({
      public: publicCount,
      archived,
      withPushDate,
      withoutPushDate,
      recentActive,
    }),
    stars,
    forks,
    season: Object.freeze({ value: season.value, fallbackUsed: season.fallback_used }),
    silence: Object.freeze(silenceValues),
  });
}

export function projectSapLedger(value) {
  const unavailable = () => Object.freeze({
    available: false,
    schema: SAP_LEDGER_SCHEMA,
    version: SAP_LEDGER_VERSION,
    maximumEntries: SAP_LEDGER_LIMITS.entries,
    maximumBytes: SAP_LEDGER_LIMITS.bytes,
    entries: Object.freeze([]),
    first: null,
    latest: null,
    missingDays: 0,
    comparison: null,
  });
  if (!exactKeys(value, [
    'schema', 'version', 'scope', 'reference_basis', 'ordering', 'gap_policy',
    'maximum_entries', 'maximum_bytes', 'recent_activity', 'silence_thresholds_days', 'entries',
  ]) || value.schema !== SAP_LEDGER_SCHEMA || value.version !== SAP_LEDGER_VERSION
      || value.scope !== 'public_repository_aggregates'
      || value.reference_basis !== 'city_state_utc_reference_date'
      || value.ordering !== 'reference_date_ascending'
      || value.gap_policy !== 'actual_entries_only'
      || value.maximum_entries !== SAP_LEDGER_LIMITS.entries
      || value.maximum_bytes !== SAP_LEDGER_LIMITS.bytes
      || !exactKeys(value.recent_activity, ['signal', 'window_days'])
      || value.recent_activity.signal !== 'latest_public_push'
      || value.recent_activity.window_days !== 30
      || !Array.isArray(value.silence_thresholds_days)
      || value.silence_thresholds_days.length !== SILENCE_LEDGER_THRESHOLDS_DAYS.length
      || value.silence_thresholds_days.some((threshold, index) => (
        threshold !== SILENCE_LEDGER_THRESHOLDS_DAYS[index]
      ))
      || !Array.isArray(value.entries)
      || value.entries.length < 1
      || value.entries.length > SAP_LEDGER_LIMITS.entries) return unavailable();
  const entries = value.entries.map(projectSapEntry);
  if (entries.some(entry => !entry)) return unavailable();
  for (let index = 1; index < entries.length; index++) {
    if (entries[index - 1].referenceDate >= entries[index].referenceDate) return unavailable();
  }
  const first = entries[0], latest = entries.at(-1);
  const spanDays = Math.floor((dayTimestamp(latest.referenceDate) - dayTimestamp(first.referenceDate)) / DAY_MS);
  const missingDays = Math.max(0, spanDays + 1 - entries.length);
  let comparison = null;
  if (entries.length > 1) {
    const previous = entries.at(-2);
    const elapsedDays = Math.floor((
      dayTimestamp(latest.referenceDate) - dayTimestamp(previous.referenceDate)
    ) / DAY_MS);
    comparison = Object.freeze({
      from: previous.referenceDate,
      to: latest.referenceDate,
      elapsedDays,
      missingDays: Math.max(0, elapsedDays - 1),
      repositories: latest.repositories.public - previous.repositories.public,
      stars: latest.stars.total === null || previous.stars.total === null
        ? null : latest.stars.total - previous.stars.total,
      forks: latest.forks.total === null || previous.forks.total === null
        ? null : latest.forks.total - previous.forks.total,
      recentActive: latest.repositories.recentActive - previous.repositories.recentActive,
      season: Object.freeze({ from: previous.season.value, to: latest.season.value }),
      silence365: latest.silence.atLeast365Days - previous.silence.atLeast365Days,
      silence730: latest.silence.atLeast730Days - previous.silence.atLeast730Days,
    });
  }
  return Object.freeze({
    available: true,
    schema: SAP_LEDGER_SCHEMA,
    version: SAP_LEDGER_VERSION,
    maximumEntries: SAP_LEDGER_LIMITS.entries,
    maximumBytes: SAP_LEDGER_LIMITS.bytes,
    entries: Object.freeze(entries),
    first,
    latest,
    missingDays,
    comparison,
  });
}

export function projectSilenceLedger(value) {
  const unavailable = () => Object.freeze({
    available: false,
    schema: SILENCE_LEDGER_SCHEMA,
    version: SILENCE_LEDGER_VERSION,
    referenceDate: null,
    thresholdsDays: SILENCE_LEDGER_THRESHOLDS_DAYS,
    repositories: Object.freeze({ total: 0, withPushDate: 0, withoutPushDate: 0 }),
    quiet: Object.freeze({ atLeast365Days: 0, atLeast730Days: 0, longest: null }),
  });
  if (value?.schema !== SILENCE_LEDGER_SCHEMA
      || value?.version !== SILENCE_LEDGER_VERSION
      || value?.scope !== 'unarchived_public_repositories'
      || value?.activity_signal !== 'latest_public_push'
      || !Array.isArray(value?.thresholds_days)
      || value.thresholds_days.length !== SILENCE_LEDGER_THRESHOLDS_DAYS.length
      || value.thresholds_days.some((threshold, index) => (
        threshold !== SILENCE_LEDGER_THRESHOLDS_DAYS[index]
      ))) {
    return unavailable();
  }

  const referenceDate = normalizedDate(value.reference_date);
  const total = finiteCount(value.repositories?.total);
  const withPushDate = finiteCount(value.repositories?.with_push_date);
  const withoutPushDate = finiteCount(value.repositories?.without_push_date);
  const atLeast365Days = finiteCount(value.quiet?.at_least_365_days);
  const atLeast730Days = finiteCount(value.quiet?.at_least_730_days);
  if (!referenceDate
      || withPushDate + withoutPushDate !== total
      || atLeast365Days > withPushDate
      || atLeast730Days > atLeast365Days) {
    return unavailable();
  }

  const sourceLongest = value.quiet?.longest;
  const longestRepo = boundedText(sourceLongest?.repo, 160);
  const longestPush = normalizedDate(sourceLongest?.last_public_push);
  const longestDays = Number(sourceLongest?.elapsed_days);
  const longest = sourceLongest && longestRepo && longestPush
      && Number.isFinite(longestDays) && longestDays >= 0
    ? Object.freeze({
      repo: longestRepo,
      lastPublicPush: longestPush,
      elapsedDays: Math.floor(longestDays),
    })
    : null;
  if ((withPushDate === 0) !== (longest === null)) return unavailable();

  return Object.freeze({
    available: true,
    schema: SILENCE_LEDGER_SCHEMA,
    version: SILENCE_LEDGER_VERSION,
    referenceDate,
    thresholdsDays: SILENCE_LEDGER_THRESHOLDS_DAYS,
    repositories: Object.freeze({ total, withPushDate, withoutPushDate }),
    quiet: Object.freeze({ atLeast365Days, atLeast730Days, longest }),
  });
}

export function projectWorldTreeChronicle(cityState, options = {}) {
  if (!validCityState(cityState)) {
    return Object.freeze({
      available: false,
      portable: null,
      era: null,
      season: null,
      sapLedger: projectSapLedger(null),
      silence: projectSilenceLedger(null),
      stats: null,
      lastSapFlow: resolveSapFlowFreshness(null, options.now),
      roots: Object.freeze([]),
    });
  }

  const roots = Array.isArray(cityState.roots)
    ? cityState.roots.map(normalizeRoot).filter((root) => root.repo)
    : [];
  const languages = Array.isArray(cityState.stats?.language_distribution)
    ? cityState.stats.language_distribution.map((entry) => Object.freeze({
      language: boundedText(entry?.language, 80),
      repositories: finiteCount(entry?.repositories),
    })).filter((entry) => entry.language && entry.repositories > 0)
    : [];
  const portable = cityState.portable?.schema === PORTABLE_TOWN_SCHEMA
      && cityState.portable?.version === PORTABLE_TOWN_VERSION
    ? Object.freeze({
      owner: boundedText(cityState.portable.owner, 39),
      referenceDate: normalizedDate(cityState.portable.reference_date),
      referenceBasis: boundedText(cityState.portable.reference_basis, 80),
      coverage: Object.freeze({
        partial: cityState.portable.coverage?.partial === true,
        error: boundedText(cityState.portable.coverage?.error, 32) || null,
        requestCap: finiteCount(cityState.portable.coverage?.request_cap),
      }),
      availability: Object.freeze({
        visitors: cityState.portable.availability?.visitors === true,
        views: cityState.portable.availability?.views === true,
        clones: cityState.portable.availability?.clones === true,
        sharedMemory: cityState.portable.availability?.sharedMemory === true,
        boundMemory: cityState.portable.availability?.boundMemory === true,
        ownerResidents: cityState.portable.availability?.ownerResidents === true,
        realtime: cityState.portable.availability?.realtime === true,
        groundedBackend: cityState.portable.availability?.groundedBackend === true,
      }),
    }) : null;

  return Object.freeze({
    available: true,
    portable,
    era: Object.freeze({
      asOf: boundedText(cityState.era?.as_of, 32),
      foundedOn: boundedText(cityState.era?.founded_on, 32),
      oldestRepository: boundedText(cityState.era?.oldest_repository, 160),
      cityAgeYears: Number.isFinite(cityState.era?.city_age_years)
        ? Math.max(0, cityState.era.city_age_years) : null,
      cityYear: Number.isInteger(cityState.era?.city_year)
        ? Math.max(1, cityState.era.city_year) : null,
      basis: boundedText(cityState.era?.basis, 240),
    }),
    season: Object.freeze({
      value: boundedText(cityState.season?.value, 16),
      recentRepositories: finiteCount(cityState.season?.inputs?.recent_active_repositories),
      repositoriesWithPushDate: finiteCount(
        cityState.season?.inputs?.repositories_with_push_date,
      ),
      ratio: Number.isFinite(cityState.season?.inputs?.recent_to_historical_ratio)
        ? Math.max(0, cityState.season.inputs.recent_to_historical_ratio) : null,
      fallbackUsed: cityState.season?.fallback?.used === true,
    }),
    sapLedger: projectSapLedger(cityState.sap_ledger),
    silence: projectSilenceLedger(cityState.silence),
    stats: Object.freeze({
      repositories: finiteCount(cityState.stats?.repository_count),
      activeRepositories: finiteCount(cityState.stats?.active_repository_count),
      archivedRepositories: finiteCount(cityState.stats?.archived_repository_count),
      stars: finiteCount(cityState.stats?.total_stars),
      forks: finiteCount(cityState.stats?.total_forks),
      languages: Object.freeze(languages),
      commitTotal: cityState.stats?.commit_history?.available === true
        ? finiteCount(cityState.stats?.commit_history?.total) : null,
      commitLimitation: boundedText(cityState.stats?.commit_history?.limitation, 260),
    }),
    lastSapFlow: resolveSapFlowFreshness(cityState.last_sap_flow, options.now),
    roots: Object.freeze(roots),
  });
}
