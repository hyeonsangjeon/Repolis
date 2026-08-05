const EPSILON = 1e-7;
const TAU = Math.PI * 2;

export const CAMERA_OBSTRUCTION_DEFAULTS = Object.freeze({
  padding: 0.7,
  surfaceEpsilon: 0.06,
  minDistance: 1.25,
  hysteresis: 0.35,
  fastIn: 0.72,
  slowOut: 0.075
});

export const CAMERA_ARRIVAL_OFFSETS = Object.freeze([
  0,
  -Math.PI / 12, Math.PI / 12,
  -Math.PI / 6, Math.PI / 6,
  -Math.PI / 4, Math.PI / 4,
  -Math.PI / 3, Math.PI / 3,
  -Math.PI * 5 / 12, Math.PI * 5 / 12
]);

function finite(value) {
  return Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizedAngle(value) {
  value = (value + Math.PI) % TAU;
  if (value < 0) value += TAU;
  return value - Math.PI;
}

export function resolveCameraObstruction(query, blockers, out) {
  const requested = query.requestedDistance;
  out.valid = false;
  out.blocked = false;
  out.distance = finite(requested) && requested >= 0 ? requested : 0;
  out.fraction = 1;
  out.clearance = 0;
  out.hit = null;
  out.hitIndex = -1;
  out.hitDistance = out.distance;

  const fx = query.focusX, fy = query.focusY, fz = query.focusZ;
  const dx = query.desiredX, dy = query.desiredY, dz = query.desiredZ;
  if (!finite(fx) || !finite(fy) || !finite(fz) || !finite(dx) || !finite(dy) || !finite(dz)
      || !finite(requested) || requested < 0) return out;

  out.valid = true;
  if (requested <= EPSILON) return out;

  const vx = dx - fx, vy = dy - fy, vz = dz - fz;
  const horizontalLengthSq = vx * vx + vz * vz;
  const segmentLengthSq = horizontalLengthSq + vy * vy;
  if (!(segmentLengthSq > EPSILON)) return out;

  const padding = finite(query.padding) ? Math.max(0, query.padding) : CAMERA_OBSTRUCTION_DEFAULTS.padding;
  const surfaceEpsilon = finite(query.surfaceEpsilon) ? Math.max(0, query.surfaceEpsilon) : CAMERA_OBSTRUCTION_DEFAULTS.surfaceEpsilon;
  const minDistance = finite(query.minDistance) ? clamp(query.minDistance, 0, requested) : Math.min(requested, CAMERA_OBSTRUCTION_DEFAULTS.minDistance);
  let nearestSafe = requested;
  let nearestHit = requested;

  for (let i = 0; i < blockers.length; i++) {
    const blocker = blockers[i];
    if (!blocker || blocker.cameraBlocking === false || blocker.enabled === false) continue;
    const cx = blocker.x, cz = blocker.z;
    const physicalRadius = finite(blocker.cameraR) ? blocker.cameraR : blocker.r;
    if (!finite(cx) || !finite(cz) || !finite(physicalRadius) || physicalRadius < 0) continue;

    const extraPadding = finite(blocker.cameraPadding)
      ? Math.max(0, blocker.cameraPadding)
      : (finite(blocker.padding) ? Math.max(0, blocker.padding) : 0);
    const radius = physicalRadius + padding + extraPadding;
    const minY = finite(blocker.cameraMinY) ? blocker.cameraMinY : (finite(blocker.minY) ? blocker.minY : 0);
    const maxY = finite(blocker.cameraMaxY) ? blocker.cameraMaxY : (finite(blocker.maxY) ? blocker.maxY : Infinity);
    if (maxY < minY) continue;

    const sx = fx - cx, sz = fz - cz;
    let horizontalEnter = 0, horizontalExit = 1;
    if (horizontalLengthSq <= EPSILON) {
      if (sx * sx + sz * sz > radius * radius + EPSILON) continue;
    } else {
      const halfB = sx * vx + sz * vz;
      const c = sx * sx + sz * sz - radius * radius;
      const discriminant = halfB * halfB - horizontalLengthSq * c;
      if (discriminant < -EPSILON) continue;
      const root = Math.sqrt(Math.max(0, discriminant));
      horizontalEnter = (-halfB - root) / horizontalLengthSq;
      horizontalExit = (-halfB + root) / horizontalLengthSq;
      if (horizontalExit < -EPSILON || horizontalEnter > 1 + EPSILON) continue;
    }

    let verticalEnter = 0, verticalExit = 1;
    if (Math.abs(vy) <= EPSILON) {
      if (fy < minY - EPSILON || fy > maxY + EPSILON) continue;
    } else {
      const y0 = (minY - fy) / vy, y1 = (maxY - fy) / vy;
      verticalEnter = Math.min(y0, y1);
      verticalExit = Math.max(y0, y1);
      if (verticalExit < -EPSILON || verticalEnter > 1 + EPSILON) continue;
    }

    let enter = Math.max(0, horizontalEnter, verticalEnter);
    const exit = Math.min(1, horizontalExit, verticalExit);
    if (enter > exit + EPSILON) continue;

    if (enter <= EPSILON) {
      const insidePhysical = sx * sx + sz * sz <= physicalRadius * physicalRadius + EPSILON
        && fy >= minY - EPSILON && fy <= maxY + EPSILON;
      if (!insidePhysical && sx * vx + sz * vz >= 0) continue;
      enter = 0;
    }

    const hitDistance = requested * clamp(enter, 0, 1);
    const safeDistance = Math.max(minDistance, hitDistance - surfaceEpsilon);
    if (safeDistance < nearestSafe - EPSILON
        || (Math.abs(safeDistance - nearestSafe) <= EPSILON && hitDistance < nearestHit)) {
      nearestSafe = safeDistance;
      nearestHit = hitDistance;
      out.hit = blocker;
      out.hitIndex = i;
    }
  }

  if (out.hit) {
    out.blocked = true;
    out.distance = clamp(nearestSafe, 0, requested);
    out.fraction = requested > EPSILON ? out.distance / requested : 1;
    out.clearance = requested - out.distance;
    out.hitDistance = nearestHit;
  }
  return out;
}

function frameAlpha(base, dt) {
  if (!(base > 0)) return 0;
  if (base >= 1) return 1;
  const frames = clamp(finite(dt) ? dt * 60 : 1, 0.05, 3);
  return 1 - Math.pow(1 - base, frames);
}

export function stepCameraResolvedDistance(current, target, requested, blocked, dt, options = CAMERA_OBSTRUCTION_DEFAULTS) {
  if (!finite(requested) || requested < 0) return finite(current) && current >= 0 ? current : 0;
  target = finite(target) ? clamp(target, 0, requested) : requested;
  current = finite(current) ? clamp(current, 0, requested) : target;
  if (Math.abs(target - current) <= EPSILON) return target;

  const hysteresis = finite(options.hysteresis) ? Math.max(0, options.hysteresis) : CAMERA_OBSTRUCTION_DEFAULTS.hysteresis;
  if (target > current && blocked && target < requested && target - current < hysteresis) return current;

  const inward = target < current;
  const base = inward
    ? (finite(options.fastIn) ? options.fastIn : CAMERA_OBSTRUCTION_DEFAULTS.fastIn)
    : (finite(options.slowOut) ? options.slowOut : CAMERA_OBSTRUCTION_DEFAULTS.slowOut);
  const next = current + (target - current) * frameAlpha(base, dt);
  if (!blocked && requested - next <= Math.min(hysteresis, 0.025)) return requested;
  return Math.abs(target - next) <= 0.002 ? target : next;
}

export function chooseCameraArrivalYaw(query, blockers, softOccluders, offsets, out, scratch) {
  const requested = query.requestedDistance;
  const currentYaw = finite(query.currentYaw) ? query.currentYaw : 0;
  out.valid = false;
  out.count = 0;
  out.index = 0;
  out.yaw = currentYaw;
  out.score = -Infinity;
  out.clearDistance = finite(requested) && requested >= 0 ? requested : 0;
  out.softBlocked = false;

  const fx = query.focusX, fy = query.focusY, fz = query.focusZ;
  const destinationX = query.destinationX, destinationZ = query.destinationZ;
  const pitch = query.pitch;
  if (!finite(fx) || !finite(fy) || !finite(fz) || !finite(destinationX) || !finite(destinationZ)
      || !finite(pitch) || !finite(requested) || requested < 0 || !offsets || offsets.length === 0) return out;

  const toDestinationX = destinationX - fx, toDestinationZ = destinationZ - fz;
  const destinationLengthSq = toDestinationX * toDestinationX + toDestinationZ * toDestinationZ;
  const idealYaw = destinationLengthSq > EPSILON
    ? Math.atan2(-toDestinationX, -toDestinationZ)
    : currentYaw;
  const verticalBaseOffset = finite(query.verticalBaseOffset) ? query.verticalBaseOffset : -0.2;
  const horizontalDistance = Math.cos(pitch) * requested;
  const verticalDistance = Math.sin(pitch) * requested + verticalBaseOffset;
  const segmentQuery = scratch.query;
  segmentQuery.focusX = fx;
  segmentQuery.focusY = fy;
  segmentQuery.focusZ = fz;
  segmentQuery.requestedDistance = requested;
  segmentQuery.padding = query.padding;
  segmentQuery.surfaceEpsilon = query.surfaceEpsilon;
  segmentQuery.minDistance = query.minDistance;

  out.valid = true;
  out.idealYaw = idealYaw;
  for (let i = 0; i < offsets.length; i++) {
    const yaw = currentYaw + offsets[i];
    segmentQuery.desiredX = fx + Math.sin(yaw) * horizontalDistance;
    segmentQuery.desiredY = fy + verticalDistance;
    segmentQuery.desiredZ = fz + Math.cos(yaw) * horizontalDistance;
    resolveCameraObstruction(segmentQuery, blockers, scratch.hard);

    let softBlocked = false, softDistance = requested;
    if (softOccluders && softOccluders.length) {
      segmentQuery.padding = finite(query.softPadding) ? query.softPadding : 0.15;
      segmentQuery.minDistance = 0;
      resolveCameraObstruction(segmentQuery, softOccluders, scratch.soft);
      softBlocked = scratch.soft.blocked;
      softDistance = scratch.soft.distance;
      segmentQuery.padding = query.padding;
      segmentQuery.minDistance = query.minDistance;
    }

    const clearRatio = requested > EPSILON ? scratch.hard.distance / requested : 1;
    const alignment = Math.cos(normalizedAngle(yaw - idealYaw));
    const softOcclusion = softBlocked && requested > EPSILON ? 1 - softDistance / requested : 0;
    const score = clearRatio * 7 + alignment * 3 - softOcclusion * 4;
    if (out.yaws) out.yaws[i] = yaw;
    if (out.distances) out.distances[i] = scratch.hard.distance;
    if (out.scores) out.scores[i] = score;
    if (out.softHits) out.softHits[i] = softBlocked ? 1 : 0;
    out.count = i + 1;
    if (score > out.score + EPSILON) {
      out.index = i;
      out.yaw = yaw;
      out.score = score;
      out.clearDistance = scratch.hard.distance;
      out.softBlocked = softBlocked;
    }
  }
  return out;
}
