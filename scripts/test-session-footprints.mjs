import assert from 'node:assert/strict';
import {
  SESSION_FOOTPRINT_LIMITS,
  clearSessionFootprints,
  createSessionFootprintState,
  resolveSessionFootprintConfig,
  sessionFootprintScale,
  sessionFootprintSnapshot,
  stepSessionFootprints,
  teardownSessionFootprints,
} from '../assets/session-footprints.js';

function step(state, x, z, options = {}) {
  return stepSessionFootprints(state, {
    x,
    y: 0,
    z,
    heading: options.heading,
    dt: options.dt ?? 0.1,
    walking: options.walking ?? true,
    resetAnchor: options.resetAnchor ?? false,
  });
}

const desktop = createSessionFootprintState();
assert.equal(step(desktop, 0, 0, { walking: false }), -1);
assert.equal(step(desktop, 0, 0, { walking: false }), -1);
assert.equal(sessionFootprintSnapshot(desktop).active, 0);
assert.equal(step(desktop, SESSION_FOOTPRINT_LIMITS.desktop.spacing - 0.01, 0), -1);
assert.equal(step(desktop, SESSION_FOOTPRINT_LIMITS.desktop.spacing + 0.01, 0), 0);
assert.equal(sessionFootprintSnapshot(desktop).active, 1);

clearSessionFootprints(desktop, { resetTotals: true });
step(desktop, 0, 0, { walking: false });
for (let index = 1; index <= SESSION_FOOTPRINT_LIMITS.desktop.capacity + 7; index += 1) {
  step(desktop, index * (SESSION_FOOTPRINT_LIMITS.desktop.spacing + 0.05), 0);
}
const reused = sessionFootprintSnapshot(desktop);
assert.equal(reused.active, SESSION_FOOTPRINT_LIMITS.desktop.capacity);
assert.equal(reused.spawned, SESSION_FOOTPRINT_LIMITS.desktop.capacity + 7);
assert.equal(reused.cursor, 7);

clearSessionFootprints(desktop, { resetTotals: true });
step(desktop, 0, 0, { walking: false });
assert.equal(step(desktop, SESSION_FOOTPRINT_LIMITS.teleportDistance + 1, 0), -1);
assert.equal(step(desktop, SESSION_FOOTPRINT_LIMITS.teleportDistance + 1.2, 0), -1);
assert.equal(sessionFootprintSnapshot(desktop).active, 0);
assert.equal(step(desktop, 20, 20, { resetAnchor: true }), -1);
assert.equal(step(desktop, 21, 20, { walking: false }), -1);
assert.equal(sessionFootprintSnapshot(desktop).active, 0);

const freshReload = createSessionFootprintState();
assert.equal(sessionFootprintSnapshot(freshReload).active, 0);
assert.equal(sessionFootprintSnapshot(freshReload).spawned, 0);

const lowEnd = resolveSessionFootprintConfig({ lowEnd: true });
const reduced = resolveSessionFootprintConfig({ reducedMotion: true });
assert.equal(lowEnd.capacity, SESSION_FOOTPRINT_LIMITS.lowEnd.capacity);
assert.ok(lowEnd.capacity < SESSION_FOOTPRINT_LIMITS.desktop.capacity);
assert.equal(reduced.capacity, SESSION_FOOTPRINT_LIMITS.reduced.capacity);
assert.ok(reduced.spacing > lowEnd.spacing);
assert.ok(reduced.lifetime < lowEnd.lifetime);

const fading = createSessionFootprintState();
step(fading, 0, 0, { walking: false });
step(fading, 2, 0);
const bornScale = sessionFootprintScale(fading, 0);
for (let index = 0; index < 15; index += 1) step(fading, 2, 0, { walking: false, dt: 0.25 });
const laterScale = sessionFootprintScale(fading, 0);
assert.equal(bornScale, 1);
assert.ok(laterScale < bornScale && laterScale > 0);
for (let index = 0; index < 6; index += 1) step(fading, 2, 0, { walking: false, dt: 0.25 });
assert.equal(sessionFootprintSnapshot(fading).active, 0);

teardownSessionFootprints(desktop);
assert.deepEqual(sessionFootprintSnapshot(desktop), {
  capacity: SESSION_FOOTPRINT_LIMITS.desktop.capacity,
  spacing: SESSION_FOOTPRINT_LIMITS.desktop.spacing,
  lifetime: SESSION_FOOTPRINT_LIMITS.desktop.lifetime,
  lowEnd: false,
  reducedMotion: false,
  active: 0,
  cursor: 0,
  spawned: 0,
  disposed: true,
});
assert.equal(step(desktop, 0, 0), -1);

console.log('ALL GREEN - session footprint movement, privacy, pool, accessibility, and teardown fixtures');
