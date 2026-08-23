export const CITY_STATE_SCHEMA = 'repolis.city-state';
export const CITY_STATE_VERSION = 1;
export const CITY_SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
export const WEAR_THRESHOLDS_DAYS = Object.freeze({ recent: 90, faded: 365 });

const DAY_MS = 86400000;
const PALETTES = Object.freeze({
  spring: Object.freeze({ sky:0xe3c4d0, fog:0xd5e6d5, light:0xffeed2, building:0xd7e4cb, skyMix:.055, fogMix:.12, lightMix:.08, buildingMix:.055 }),
  summer: Object.freeze({ sky:0x8fc9e5, fog:0xd9e4c8, light:0xffe4ad, building:0xf0dfbd, skyMix:.025, fogMix:.05, lightMix:.04, buildingMix:.025 }),
  autumn: Object.freeze({ sky:0xd49a79, fog:0xdec5a7, light:0xffc985, building:0xd7b184, skyMix:.07, fogMix:.13, lightMix:.09, buildingMix:.065 }),
  winter: Object.freeze({ sky:0x9fb7cf, fog:0xcbd7dc, light:0xdde9f2, building:0xc8d2d5, skyMix:.075, fogMix:.15, lightMix:.1, buildingMix:.06 })
});

function timestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveCitySeason(cityState, override = '') {
  if (CITY_SEASONS.includes(override)) return override;
  const value = cityState?.schema === CITY_STATE_SCHEMA && cityState?.version === CITY_STATE_VERSION
    ? cityState?.season?.value : '';
  return CITY_SEASONS.includes(value) ? value : 'summer';
}

export function seasonPalette(season) {
  return PALETTES[CITY_SEASONS.includes(season) ? season : 'summer'];
}

export function cityReferenceTimestamp(cityState, repositories = [], fallback = Date.now()) {
  const stateCandidates = [
    cityState?.last_sap_flow,
    cityState?.season?.inputs?.reference_date,
    cityState?.era?.as_of
  ];
  for (const value of stateCandidates) {
    const parsed = timestamp(value);
    if (parsed !== null) return parsed;
  }
  const repositoryCandidates = repositories.flatMap(repo => [repo?.pushed, repo?.created])
    .map(timestamp).filter(value => value !== null);
  return repositoryCandidates.length ? Math.max(...repositoryCandidates) : fallback;
}

export function classifyBuildingWear(repo, referenceTimestamp, override = '') {
  const pushedAt = timestamp(repo?.pushed);
  const daysSincePush = pushedAt === null ? null : Math.max(0, Math.floor((referenceTimestamp - pushedAt) / DAY_MS));
  let state = daysSincePush === null || daysSincePush > WEAR_THRESHOLDS_DAYS.faded
    ? 'mossed'
    : daysSincePush > WEAR_THRESHOLDS_DAYS.recent ? 'faded' : 'recent';
  if (['recent', 'faded', 'mossed'].includes(override)) state = override;
  return Object.freeze({
    state,
    daysSincePush,
    archived: Boolean(repo?.archived),
    referenceDate: new Date(referenceTimestamp).toISOString().slice(0, 10)
  });
}

export function projectCityTime(repo, cityState, repositories = [], options = {}) {
  const referenceTimestamp = options.referenceTimestamp
    ?? cityReferenceTimestamp(cityState, repositories, options.fallbackTimestamp);
  const wear = classifyBuildingWear(repo, referenceTimestamp, options.wear);
  return Object.freeze({
    ...wear,
    archived: options.archived === true || wear.archived,
    season: resolveCitySeason(cityState, options.season)
  });
}
