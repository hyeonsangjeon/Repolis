/* cloudflare-card/src/rate-limit.js — how many new renders one address may start per minute.
 *
 * A render is a GitHub request for a login KV does not know yet, or drawing a PNG the cache does not hold. The
 * Workers Rate Limiting binding CARD_RATE_LIMIT counts per Cloudflare location with no storage write and no network
 * round trip; it is permissive and eventually consistent, which is enough for a soft per-address bound. Without the
 * binding (local tests, a fork that did not add it) or when it fails, an isolate-local fixed window applies the same
 * limit. Keys are never logged.
 */

/* Keep `limit` and the 60 s period equal to [[ratelimits]] CARD_RATE_LIMIT in wrangler.toml. */
export const RENDER_LIMIT = Object.freeze({ limit: 30, periodMs: 60000, maxKeys: 4096 });

/* An in-memory fixed window per key, bounded to `maxKeys` keys. */
export function createWindowLimiter({ limit = RENDER_LIMIT.limit, periodMs = RENDER_LIMIT.periodMs, maxKeys = RENDER_LIMIT.maxKeys } = {}) {
  const windows = new Map();
  return function allow(key, now) {
    const entry = windows.get(key);
    if (entry && now - entry.start < periodMs) {
      entry.count += 1;
      return entry.count <= limit;
    }
    windows.delete(key);
    if (windows.size >= maxKeys) {
      for (const [old, value] of windows) if (now - value.start >= periodMs) windows.delete(old);
      while (windows.size >= maxKeys) windows.delete(windows.keys().next().value);
    }
    windows.set(key, { start: now, count: 1 });
    return limit >= 1;
  };
}

/* True when `key` may start one more render now. */
export async function allowRender(env, key, fallback, now) {
  const binding = env && env.CARD_RATE_LIMIT;
  if (binding && typeof binding.limit === 'function') {
    try {
      const result = await binding.limit({ key });
      if (result && typeof result.success === 'boolean') return result.success;
    } catch (error) { /* the isolate window below still bounds this address */ }
  }
  return fallback(key, now);
}
