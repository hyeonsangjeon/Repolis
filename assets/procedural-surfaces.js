export const PROCEDURAL_SURFACE_VERSION = 2;

export const PROCEDURAL_SURFACE_FAMILIES = Object.freeze([
  'brick',
  'siding',
  'panel',
  'stone',
  'stucco',
  'timber',
  'board',
  'metal',
]);

export const PROCEDURAL_SURFACE_LIMITS = Object.freeze({
  desktopVariants: 1,
  compactVariants: 1,
  desktopCacheEntries: PROCEDURAL_SURFACE_FAMILIES.length + 1,
  compactCacheEntries: PROCEDURAL_SURFACE_FAMILIES.length + 1,
  materialCacheEntries: 384,
});

const FAMILY_SCALE = Object.freeze({
  brick: Object.freeze([3.8, 3.1]),
  siding: Object.freeze([4.6, 3.4]),
  panel: Object.freeze([4.4, 4.4]),
  stone: Object.freeze([4.2, 3.5]),
  stucco: Object.freeze([5.2, 4.6]),
  timber: Object.freeze([5.2, 4.8]),
  board: Object.freeze([4.4, 4.4]),
  metal: Object.freeze([4.8, 4.8]),
});

export function surfaceSeed(value) {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSurfaceRng(seed) {
  let state = surfaceSeed(seed) || 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeSurfaceFamily(family) {
  return PROCEDURAL_SURFACE_FAMILIES.includes(family) ? family : 'stucco';
}

const INTERIOR_TOPICS = {
  books: ['cookbook', 'documentation', 'handbook'],
  terminal: ['terminal', 'browser-terminal', 'web-terminal', 'terminal-emulator'],
  media: ['audio', 'audio-processing', 'media-management', 'video-downloader'],
};

// At most one already-lit, public house per motif. Generic rooms need no new art.
export function pickNightInteriors(houses) {
  const selected = new Map(), used = new Set();
  const rank = house => Number.isFinite(house.rank) ? house.rank : Infinity;
  const eligible = houses.filter(h => h?.repo && !h.archived && !h.private && Array.isArray(h.topics));
  eligible.sort((a,b) => rank(a)-rank(b) || (a.repo < b.repo ? -1 : a.repo > b.repo ? 1 : 0));
  for (const h of eligible) {
    const type = Object.keys(INTERIOR_TOPICS).find(key => !used.has(key) && INTERIOR_TOPICS[key].some(t => h.topics.includes(t)));
    if (type) { selected.set(h.repo,type); used.add(type); }
    if (used.size === 3) break;
  }
  return selected;
}

export function surfaceVariant(seed, compact = false) {
  const count = compact
    ? PROCEDURAL_SURFACE_LIMITS.compactVariants
    : PROCEDURAL_SURFACE_LIMITS.desktopVariants;
  const hash = surfaceSeed(seed);
  return ((hash ^ (hash >>> 16)) >>> 0) % count;
}

export function surfaceTextureKey(kind, family, variant) {
  const normalizedKind = kind === 'roof' ? 'roof' : 'wall';
  const normalizedFamily = normalizedKind === 'roof' ? 'shingle' : normalizeSurfaceFamily(family);
  return `${normalizedKind}:${normalizedFamily}:v${variant}`;
}

export function surfaceUvTransform(seed) {
  const random = createSurfaceRng(`uv:${seed}`);
  return Object.freeze({
    offsetX: random(),
    offsetY: random(),
    mirrorX: random() >= 0.5,
  });
}

export function surfaceWallRepeat(family, width, height) {
  const scale = FAMILY_SCALE[normalizeSurfaceFamily(family)];
  return Object.freeze({
    x: Math.max(1.15, Number(width) / scale[0]),
    y: Math.max(1.15, Number(height) / scale[1]),
  });
}

export function getOrCreateBoundedSurface(cache, key, limit, create) {
  if (!(cache instanceof Map)) throw new TypeError('surface cache must be a Map');
  if (cache.has(key)) return cache.get(key);
  if (cache.size >= limit) throw new RangeError(`surface cache limit exceeded: ${limit}`);
  const value = create();
  if (!value) throw new Error(`surface factory returned no value for ${key}`);
  cache.set(key, value);
  return value;
}

export function disposeBoundedSurfaceCache(cache, dispose = value => value.dispose()) {
  for (const value of cache.values()) dispose(value);
  cache.clear();
}

export function surfacePixelHash(bytes) {
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
