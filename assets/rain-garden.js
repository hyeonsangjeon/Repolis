const TWO_PI = Math.PI * 2;

export const RAIN_GARDEN_DEFAULTS = Object.freeze({
  duration: 36,
  fadeIn: 1.6,
  fadeOut: 3.2,
  desktopDrops: 96,
  mobileDrops: 48,
  radius: 17,
  height: 18,
  streak: 0.9,
  fallSpeed: 17,
  rippleCount: 8
});

const clamp01 = value => Math.min(1, Math.max(0, value));
const smoothstep = value => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function unitHash(value) {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function sampleRainGarden(elapsed, options = RAIN_GARDEN_DEFAULTS, out = {}) {
  const duration = Number.isFinite(options.duration) && options.duration > 0
    ? options.duration
    : RAIN_GARDEN_DEFAULTS.duration;
  const fadeIn = Number.isFinite(options.fadeIn) && options.fadeIn > 0
    ? Math.min(duration, options.fadeIn)
    : Math.min(duration, RAIN_GARDEN_DEFAULTS.fadeIn);
  const fadeOut = Number.isFinite(options.fadeOut) && options.fadeOut > 0
    ? Math.min(duration, options.fadeOut)
    : Math.min(duration, RAIN_GARDEN_DEFAULTS.fadeOut);
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const remaining = Math.max(0, duration - safeElapsed);
  const envelope = Math.min(safeElapsed / fadeIn, remaining / fadeOut);

  out.progress = clamp01(safeElapsed / duration);
  out.remaining = remaining;
  out.intensity = safeElapsed >= duration ? 0 : smoothstep(envelope);
  out.active = safeElapsed < duration;
  out.complete = safeElapsed >= duration;
  return out;
}

export function seedRainDrop(index, count, options = RAIN_GARDEN_DEFAULTS, out = {}) {
  const safeCount = Math.max(1, Number.isFinite(count) ? Math.floor(count) : RAIN_GARDEN_DEFAULTS.desktopDrops);
  const safeIndex = Math.max(0, Number.isFinite(index) ? Math.floor(index) : 0);
  const radius = Number.isFinite(options.radius) && options.radius > 0 ? options.radius : RAIN_GARDEN_DEFAULTS.radius;
  const height = Number.isFinite(options.height) && options.height > 0 ? options.height : RAIN_GARDEN_DEFAULTS.height;
  const ring = Math.sqrt((safeIndex + 0.5) / safeCount);
  const angle = safeIndex * 2.399963229728653 + unitHash(safeIndex + 17) * 0.65;

  out.x = Math.cos(angle) * ring * radius;
  out.z = Math.sin(angle) * ring * radius;
  out.y = (0.08 + unitHash(safeIndex + 131) * 0.92) * height;
  out.speed = 0.78 + unitHash(safeIndex + 313) * 0.44;
  return out;
}

export function wrapRainDropY(y, fallDistance, height = RAIN_GARDEN_DEFAULTS.height) {
  const safeHeight = Number.isFinite(height) && height > 0 ? height : RAIN_GARDEN_DEFAULTS.height;
  const next = (Number.isFinite(y) ? y : safeHeight) - Math.max(0, Number.isFinite(fallDistance) ? fallDistance : 0);
  if (next >= 0) return next;
  const wrapped = safeHeight - ((-next) % safeHeight);
  return wrapped === safeHeight ? 0 : wrapped;
}
