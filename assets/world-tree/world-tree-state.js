import { CITY_STATE_SCHEMA, CITY_STATE_VERSION } from '../city-time.js';

const DAY_MS = 86400000;

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

function logarithmicSignal(value, saturation) {
  return clamp(Math.log1p(finiteCount(value)) / Math.log1p(saturation));
}

function smoothstep(value) {
  const bounded = clamp(value);
  return bounded * bounded * (3 - 2 * bounded);
}

function normalizeRoot(root) {
  const years = root?.active_years ?? {};
  const from = Number.isInteger(years.from) ? years.from : null;
  const to = Number.isInteger(years.to) ? years.to : null;
  const count = Number.isInteger(years.count) && years.count > 0 ? years.count : null;
  return Object.freeze({
    repo: boundedText(root?.repo, 160),
    activeYears: Object.freeze({ from, to, count }),
    achievement: boundedText(root?.achievement),
  });
}

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

export function projectWorldTreeChronicle(cityState, options = {}) {
  if (!validCityState(cityState)) {
    return Object.freeze({
      available: false,
      era: null,
      season: null,
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

  return Object.freeze({
    available: true,
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
