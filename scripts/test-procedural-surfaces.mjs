import assert from 'node:assert/strict';
import {
  PROCEDURAL_SURFACE_FAMILIES,
  PROCEDURAL_SURFACE_LIMITS,
  PROCEDURAL_SURFACE_VERSION,
  createSurfaceRng,
  disposeBoundedSurfaceCache,
  getOrCreateBoundedSurface,
  normalizeSurfaceFamily,
  surfacePixelHash,
  surfaceTextureKey,
  surfaceUvTransform,
  surfaceVariant,
  surfaceWallRepeat,
} from '../assets/procedural-surfaces.js';

assert.equal(PROCEDURAL_SURFACE_VERSION, 2);
assert.deepEqual(PROCEDURAL_SURFACE_FAMILIES, [
  'brick', 'siding', 'panel', 'stone', 'stucco', 'timber', 'board', 'metal',
]);
assert.equal(PROCEDURAL_SURFACE_LIMITS.desktopCacheEntries, 9);
assert.equal(PROCEDURAL_SURFACE_LIMITS.compactCacheEntries, 9);
assert.equal(PROCEDURAL_SURFACE_LIMITS.materialCacheEntries, 384);
assert.ok(PROCEDURAL_SURFACE_LIMITS.materialCacheEntries >= 300);
assert.equal(normalizeSurfaceFamily('brick'), 'brick');
assert.equal(normalizeSurfaceFamily('unknown'), 'stucco');

const sequence = seed => {
  const random = createSurfaceRng(seed);
  return Array.from({ length: 12 }, () => random());
};
assert.deepEqual(sequence('brick:v0'), sequence('brick:v0'));
assert.notDeepEqual(sequence('brick:v0'), sequence('brick:v1'));

const transform = surfaceUvTransform('repo:facade');
assert.deepEqual(transform, surfaceUvTransform('repo:facade'));
assert.notDeepEqual(transform, surfaceUvTransform('other:facade'));
assert.ok(transform.offsetX >= 0 && transform.offsetX < 1);
assert.ok(transform.offsetY >= 0 && transform.offsetY < 1);

for (const family of PROCEDURAL_SURFACE_FAMILIES) {
  const repeat = surfaceWallRepeat(family, 8, 10);
  assert.ok(Number.isFinite(repeat.x) && repeat.x >= 1.15);
  assert.ok(Number.isFinite(repeat.y) && repeat.y >= 1.15);
  assert.match(surfaceTextureKey('wall', family, 0), new RegExp(`^wall:${family}:v0$`));
}
assert.equal(surfaceTextureKey('roof', 'ignored', 1), 'roof:shingle:v1');
assert.deepEqual(new Set(Array.from({ length: 32 }, (_, index) => surfaceVariant(`repo-${index}`, false))), new Set([0]));
assert.deepEqual(new Set(Array.from({ length: 32 }, (_, index) => surfaceVariant(`repo-${index}`, true))), new Set([0]));

const cache = new Map();
let creates = 0, disposals = 0;
const first = getOrCreateBoundedSurface(cache, 'wall:brick:v0', 2, () => ({ id: ++creates }));
const hit = getOrCreateBoundedSurface(cache, 'wall:brick:v0', 2, () => ({ id: ++creates }));
assert.equal(hit, first);
assert.equal(creates, 1);
getOrCreateBoundedSurface(cache, 'roof:shingle:v0', 2, () => ({ id: ++creates }));
assert.throws(
  () => getOrCreateBoundedSurface(cache, 'wall:stone:v0', 2, () => ({ id: ++creates })),
  /surface cache limit exceeded/,
);
disposeBoundedSurfaceCache(cache, () => { disposals += 1; });
assert.equal(disposals, 2);
assert.equal(cache.size, 0);

const pixels = new Uint8Array([0, 16, 128, 255, 8, 24, 64, 255]);
assert.equal(surfacePixelHash(pixels), surfacePixelHash(pixels.slice()));
assert.notEqual(surfacePixelHash(pixels), surfacePixelHash(new Uint8Array([...pixels, 1])));

console.log('ALL GREEN - procedural surface determinism, variants, UV scale, bounded cache, and disposal fixtures');
