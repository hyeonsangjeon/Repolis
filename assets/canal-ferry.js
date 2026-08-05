const TWO_PI = Math.PI * 2;

export const CANAL_FERRY_DEFAULTS = Object.freeze({
  duration: 38,
  center: 0.5,
  amplitude: 0.34,
  phaseOffset: -Math.PI / 18
});

export function sampleCanalFerryRoute(elapsed, options = CANAL_FERRY_DEFAULTS, out = {}) {
  const duration = Number.isFinite(options.duration) && options.duration > 0
    ? options.duration
    : CANAL_FERRY_DEFAULTS.duration;
  const center = Number.isFinite(options.center)
    ? Math.min(1, Math.max(0, options.center))
    : CANAL_FERRY_DEFAULTS.center;
  const maxAmplitude = Math.min(center, 1 - center);
  const amplitude = Number.isFinite(options.amplitude)
    ? Math.min(maxAmplitude, Math.max(0, options.amplitude))
    : Math.min(maxAmplitude, CANAL_FERRY_DEFAULTS.amplitude);
  const phaseOffset = Number.isFinite(options.phaseOffset)
    ? options.phaseOffset
    : CANAL_FERRY_DEFAULTS.phaseOffset;
  const safeElapsed = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  const progress = Math.min(1, safeElapsed / duration);
  const phase = phaseOffset + progress * TWO_PI;
  const velocity = Math.cos(phase);

  out.progress = progress;
  out.phase = phase;
  out.t = center + Math.sin(phase) * amplitude;
  out.direction = velocity < -1e-9 ? -1 : 1;
  out.complete = progress >= 1;
  return out;
}
