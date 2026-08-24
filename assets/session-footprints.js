export const SESSION_FOOTPRINT_LIMITS = Object.freeze({
  desktop: Object.freeze({ capacity: 36, spacing: 1.35, lifetime: 5.2, fadeStart: 0.58 }),
  lowEnd: Object.freeze({ capacity: 18, spacing: 1.8, lifetime: 4.0, fadeStart: 0.52 }),
  reduced: Object.freeze({ capacity: 8, spacing: 3.0, lifetime: 1.2, fadeStart: 1 }),
  teleportDistance: 6,
  lateralOffset: 0.14,
  surfaceOffset: 0.035,
  width: 0.11,
  length: 0.25,
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function resolveSessionFootprintConfig({ lowEnd = false, reducedMotion = false } = {}) {
  const tier = reducedMotion
    ? SESSION_FOOTPRINT_LIMITS.reduced
    : lowEnd ? SESSION_FOOTPRINT_LIMITS.lowEnd : SESSION_FOOTPRINT_LIMITS.desktop;
  return Object.freeze({
    ...tier,
    lowEnd: Boolean(lowEnd),
    reducedMotion: Boolean(reducedMotion),
    teleportDistance: SESSION_FOOTPRINT_LIMITS.teleportDistance,
    lateralOffset: SESSION_FOOTPRINT_LIMITS.lateralOffset,
    surfaceOffset: SESSION_FOOTPRINT_LIMITS.surfaceOffset,
    width: SESSION_FOOTPRINT_LIMITS.width,
    length: SESSION_FOOTPRINT_LIMITS.length,
  });
}

export function createSessionFootprintState(options = {}) {
  const config = resolveSessionFootprintConfig(options);
  const capacity = config.capacity;
  return {
    config,
    elapsed: 0,
    cursor: 0,
    activeCount: 0,
    totalSpawned: 0,
    hasAnchor: false,
    anchorX: 0,
    anchorZ: 0,
    disposed: false,
    active: new Uint8Array(capacity),
    x: new Float32Array(capacity),
    y: new Float32Array(capacity),
    z: new Float32Array(capacity),
    heading: new Float32Array(capacity),
    born: new Float32Array(capacity),
  };
}

export function clearSessionFootprints(state, { resetTotals = false } = {}) {
  state.active.fill(0);
  state.activeCount = 0;
  state.cursor = 0;
  state.hasAnchor = false;
  if (resetTotals) state.totalSpawned = 0;
}

function setAnchor(state, x, z) {
  state.anchorX = x;
  state.anchorZ = z;
  state.hasAnchor = true;
}

function expireSessionFootprints(state) {
  const { active, born } = state;
  for (let index = 0; index < active.length; index += 1) {
    if (active[index] && state.elapsed - born[index] >= state.config.lifetime) {
      active[index] = 0;
      state.activeCount -= 1;
    }
  }
}

export function stepSessionFootprints(state, sample = {}) {
  if (!state || state.disposed) return -1;
  state.elapsed += Math.max(0, Math.min(0.25, finite(sample.dt)));
  expireSessionFootprints(state);

  const x = finite(sample.x, NaN), z = finite(sample.z, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return -1;
  if (sample.resetAnchor) {
    setAnchor(state, x, z);
    return -1;
  }
  if (!state.hasAnchor) {
    setAnchor(state, x, z);
    return -1;
  }

  const dx = x - state.anchorX, dz = z - state.anchorZ;
  const distance = Math.hypot(dx, dz);
  if (distance > state.config.teleportDistance) {
    setAnchor(state, x, z);
    return -1;
  }
  if (!sample.walking || distance < state.config.spacing) return -1;

  const heading = Number.isFinite(sample.heading) ? sample.heading : Math.atan2(dx, dz);
  const side = state.totalSpawned % 2 === 0 ? -1 : 1;
  const lateralX = Math.cos(heading) * state.config.lateralOffset * side;
  const lateralZ = -Math.sin(heading) * state.config.lateralOffset * side;
  const slot = state.cursor;
  if (!state.active[slot]) state.activeCount += 1;
  state.active[slot] = 1;
  state.x[slot] = x + lateralX;
  state.y[slot] = finite(sample.y) + state.config.surfaceOffset;
  state.z[slot] = z + lateralZ;
  state.heading[slot] = heading;
  state.born[slot] = state.elapsed;
  state.cursor = (slot + 1) % state.config.capacity;
  state.totalSpawned += 1;
  setAnchor(state, x, z);
  return slot;
}

export function sessionFootprintScale(state, index) {
  if (!state.active[index]) return 0;
  if (state.config.reducedMotion) return 1;
  const progress = Math.max(0, (state.elapsed - state.born[index]) / state.config.lifetime);
  if (progress <= state.config.fadeStart) return 1;
  return Math.max(0, 1 - (progress - state.config.fadeStart) / (1 - state.config.fadeStart));
}

export function sessionFootprintSnapshot(state) {
  return Object.freeze({
    capacity: state.config.capacity,
    spacing: state.config.spacing,
    lifetime: state.config.lifetime,
    lowEnd: state.config.lowEnd,
    reducedMotion: state.config.reducedMotion,
    active: state.activeCount,
    cursor: state.cursor,
    spawned: state.totalSpawned,
    disposed: state.disposed,
  });
}

export function teardownSessionFootprints(state) {
  clearSessionFootprints(state);
  state.disposed = true;
}
