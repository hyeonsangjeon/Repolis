export const CITY_STATE_SCHEMA = 'repolis.city-state';
export const CITY_STATE_VERSION = 1;
export const CITY_SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
export const WEAR_THRESHOLDS_DAYS = Object.freeze({ recent: 90, faded: 365 });
export const REPO_NEWCOMER_DAYS = 90;

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

export function repositoryAgeDays(repo, referenceTimestamp) {
  const createdAt = timestamp(repo?.created);
  if (createdAt === null || !Number.isFinite(referenceTimestamp)) return null;
  return Math.max(0, Math.floor((referenceTimestamp - createdAt) / DAY_MS));
}

export function constructionScaffoldPlan({
  width,
  height,
  depth,
  kind = '',
  lowEnd = false,
  newcomer = true,
  archived = false,
} = {}) {
  if (!newcomer || archived) {
    return Object.freeze({
      enabled: false,
      poles: 0,
      rails: 0,
      decks: 0,
      parts: 0,
      draws: 0,
      colliders: 0,
    });
  }
  const w = Math.min(32, Math.max(2, Number(width) || 2));
  const h = Math.min(24, Math.max(2, Number(height) || 2));
  const d = Math.min(32, Math.max(2, Number(depth) || 2));
  const z = lowEnd ? [-d * 0.34, d * 0.1] : [-d * 0.38, -d * 0.1, d * 0.18];
  const levels = lowEnd ? [0.34, 0.72] : [0.25, 0.52, 0.8];
  const decks = lowEnd ? [0.5] : [0.38, 0.68];
  const scaffoldHeight = Math.min(8, Math.max(3.2, h * 0.72));
  const winged = ['villa', 'manor', 'mansion'].includes(String(kind));
  return Object.freeze({
    enabled: true,
    poles: z.length,
    rails: levels.length,
    decks: decks.length,
    parts: z.length + levels.length + decks.length,
    draws: 1,
    colliders: 0,
    lod: 'full+mid',
    side: 'non-entrance',
    sideX: w * (winged ? 1.02 : 0.5) + 0.38,
    z: Object.freeze(z),
    levels: Object.freeze(levels),
    deckLevels: Object.freeze(decks),
    span: Math.max(1.8, z[z.length - 1] - z[0] + 0.24),
    height: Number(scaffoldHeight.toFixed(2)),
    frontClearance: Number((d * 0.5 - z[z.length - 1]).toFixed(2)),
  });
}

export function projectCityTime(repo, cityState, repositories = [], options = {}) {
  const referenceTimestamp = options.referenceTimestamp
    ?? cityReferenceTimestamp(cityState, repositories, options.fallbackTimestamp);
  const wear = classifyBuildingWear(repo, referenceTimestamp, options.wear);
  const archived = options.archived === true || wear.archived;
  const ageDays = Number.isInteger(options.ageDays)
    ? Math.max(0, options.ageDays)
    : repositoryAgeDays(repo, referenceTimestamp);
  return Object.freeze({
    ...wear,
    archived,
    ageDays,
    newcomer: !archived && ageDays !== null && ageDays < REPO_NEWCOMER_DAYS,
    season: resolveCitySeason(cityState, options.season)
  });
}
