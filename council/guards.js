/*
 * council/guards.js — Chronopolis Live cost guards (CHRONOPOLIS_SPEC §I, §N).
 *
 * The money-spending Live debate path is gated behind FIVE server-side guards.
 * This module is pure + deterministic: every function takes an injected `store`
 * and an injected `now` (ms), so the whole guard stack can be unit-tested with
 * no clock, no network and no real LLM (see council/test-live.mjs, C1–C10).
 *
 *   [L1] personal rate-limit   — one Live per composite key per cooldown window
 *   [L2] concurrency cap        — at most N simultaneous Live debates, global
 *   [L3] IP / band burst guard  — too many requests from one coarse IP → cooldown
 *   [L4] global budget gate     — cumulative est. cost vs month/day caps (the last wall)
 *   [L5] per-debate hard cap    — token cap × rounds × sages bounds one debate's cost
 *
 * Privacy (§R/§Q): never store a full IP or raw fingerprint. We hash a salted
 * composite key and only keep a /24-style coarse IP for burst detection.
 *
 * Loaded as a CommonJS module in Node, on globalThis.CouncilGuards in browsers /
 * Cloudflare Workers.
 */
(function () {
  'use strict';

  // ---- salted, deterministic hash (FNV-1a 64-bit → hex) ---------------------
  // Not a cryptographic hash; it exists to bucket a composite key without ever
  // persisting the raw IP / fingerprint. A deploy-time salt makes the buckets
  // un-reversible in practice.
  function fnv1a64(str) {
    // 64-bit FNV-1a using BigInt for determinism across Node / Workers / browser.
    let h = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    const mask = 0xffffffffffffffffn;
    for (let i = 0; i < str.length; i++) {
      h ^= BigInt(str.charCodeAt(i) & 0xff);
      h = (h * prime) & mask;
      // also fold in the high byte of multi-byte chars so unicode doesn't collide trivially
      const hi = str.charCodeAt(i) >> 8;
      if (hi) { h ^= BigInt(hi); h = (h * prime) & mask; }
    }
    return h.toString(16).padStart(16, '0');
  }

  // composite key for the PERSONAL rate-limit. Per §I the personal limit keys on
  // the device fingerprint FIRST, and the IP is reserved for burst detection (L3)
  // only. fp-first means:
  //   • changing IP on the same device (VPN / mobile, C3) still collides → blocked
  //   • a shared IP with different devices (C4) does NOT collide → independent
  //   • wiping cookies / incognito (C1/C2) is irrelevant since we don't key on the cookie
  // The cookie is an auxiliary signal only (it can be wiped) — it can merge two
  // otherwise-identical keys but never weakens one. We fall back to IP only when
  // fp is missing (very old browsers) so there is always *some* key.
  function compositeKey(signals, salt) {
    const ip = (signals && signals.ip) || '';
    const fp = (signals && signals.fp) || '';
    if (fp) return fnv1a64((salt || '') + '|fp:' + fp);
    return fnv1a64((salt || '') + '|ip:' + ip);
  }

  // coarse IP for burst detection only: keep the /24 (v4) or /48 (v6), never the host.
  function coarseIp(ip) {
    if (!ip) return '';
    if (ip.indexOf(':') >= 0) { // IPv6 → first 3 hextets
      return ip.split(':').slice(0, 3).join(':') + '::/48';
    }
    const p = ip.split('.');
    if (p.length === 4) return p[0] + '.' + p[1] + '.' + p[2] + '.0/24';
    return ip;
  }

  // day / month buckets in UTC (matches §Q logging + §N budget rows).
  function dayBucket(now) { return new Date(now).toISOString().slice(0, 10); }       // YYYY-MM-DD
  function monthBucket(now) { return new Date(now).toISOString().slice(0, 7); }      // YYYY-MM

  // ---- in-memory store (the reference implementation) -----------------------
  // A Cloudflare D1 / KV / Durable-Object adapter only has to expose the SAME
  // method shape with atomic increments; the guard logic below is storage-agnostic.
  function makeMemStore() {
    const rate = new Map();        // key → { lastLiveAt, liveCount }
    const budget = new Map();      // bucket → estCostSum
    const abuse = new Map();       // coarseIp → number[] (request timestamps)
    let active = 0;                // concurrency counter (atomic in single-thread JS)
    return {
      kind: 'memory',
      // rate_limit
      getRate(key) { return rate.get(key) || null; },
      setRate(key, v) { rate.set(key, v); },
      // budget (atomic add)
      addBudget(bucket, cost) { const c = (budget.get(bucket) || 0) + cost; budget.set(bucket, c); return c; },
      getBudget(bucket) { return budget.get(bucket) || 0; },
      // concurrency (atomic inc/dec)
      incConcurrency() { active += 1; return active; },
      decConcurrency() { active = Math.max(0, active - 1); return active; },
      getConcurrency() { return active; },
      // abuse / burst
      pushAbuse(ip, ts) { const a = abuse.get(ip) || []; a.push(ts); abuse.set(ip, a); },
      countAbuse(ip, since) { const a = abuse.get(ip) || []; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] >= since) n++; return n; },
      pruneAbuse(ip, before) { const a = abuse.get(ip) || []; abuse.set(ip, a.filter(function (t) { return t >= before; })); },
      // test / observability helpers
      _dump() { return { rate: rate, budget: budget, abuse: abuse, active: active }; },
    };
  }

  // ---- [L1] personal rate-limit --------------------------------------------
  // One Live per composite key per cooldownSec. Returns retryAfter seconds when blocked.
  function checkRate(store, key, now, cooldownSec) {
    const r = store.getRate(key);
    if (r && r.lastLiveAt && (now - r.lastLiveAt) < cooldownSec * 1000) {
      const retryAfter = Math.ceil((cooldownSec * 1000 - (now - r.lastLiveAt)) / 1000);
      return { ok: false, layer: 'L1', reason: 'cooldown', retryAfter: retryAfter };
    }
    return { ok: true, layer: 'L1' };
  }
  // record a granted Live against the key (call only after a Live actually starts).
  function recordLive(store, key, now) {
    const r = store.getRate(key) || { lastLiveAt: 0, liveCount: 0 };
    r.lastLiveAt = now;
    r.liveCount = (r.liveCount || 0) + 1;
    store.setRate(key, r);
    return r;
  }

  // ---- [L2] concurrency cap -------------------------------------------------
  // The real wall against burst incidents. Try to acquire a slot atomically.
  function acquireConcurrency(store, max) {
    if (store.getConcurrency() >= max) return { ok: false, layer: 'L2', reason: 'full' };
    const active = store.incConcurrency();
    if (active > max) { store.decConcurrency(); return { ok: false, layer: 'L2', reason: 'full' }; }
    return { ok: true, layer: 'L2', active: active };
  }
  function releaseConcurrency(store) { return store.decConcurrency(); }

  // ---- [L3] IP / band burst guard ------------------------------------------
  // Count requests from one coarse IP inside windowSec; over threshold → cooldown
  // (and, in production, a captcha upgrade). NB this is *burst* detection only —
  // a coarse IP is never permanently banned (shared IPs are normal, see C4/§I).
  function checkBurst(store, ip, now, threshold, windowSec) {
    const since = now - windowSec * 1000;
    store.pruneAbuse(ip, since);
    store.pushAbuse(ip, now);
    const n = store.countAbuse(ip, since);
    if (n > threshold) return { ok: false, layer: 'L3', reason: 'burst', count: n, captcha: true };
    return { ok: true, layer: 'L3', count: n };
  }

  // ---- [L5] per-debate hard cap (compute BEFORE L4 so we can price the next debate) ----
  // Bounds one debate's worst-case tokens & cost: tokens/turn × turns, where
  // turns = sages summoned × (1 testimony + crossRounds). Plus the final
  // adjudicator synthesis. Used both as a spend ceiling and as L4's estimate.
  function debateHardCap(dials, sageCount, price) {
    const tpt = dials.TOKENS_PER_TURN_MAX || 160;
    const rounds = dials.CROSS_ROUNDS_MAX || 2;
    const sages = sageCount || 3;
    const turns = sages * (1 + rounds);          // testimony + cross rounds per sage
    const adjudicator = tpt;                       // one closing synthesis
    const maxOutTokens = turns * tpt + adjudicator;
    // assume input ≈ output for a chat turn (prompt + history); conservative ×2.
    const maxTokens = maxOutTokens * 2;
    const estCost = estimateCost(maxTokens / 2, maxTokens / 2, price);
    return { maxTurns: turns, maxOutTokens: maxOutTokens, maxTokens: maxTokens, estCost: estCost };
  }

  // ---- cost estimator -------------------------------------------------------
  // price = { inPer1k, outPer1k } in USD. Defaults to a gpt-4o-mini-ish rate;
  // real numbers come from deploy env, never hard-committed (§H/§I).
  function estimateCost(tokensIn, tokensOut, price) {
    const p = price || { inPer1k: 0.00015, outPer1k: 0.0006 };
    return (tokensIn / 1000) * p.inPer1k + (tokensOut / 1000) * p.outPer1k;
  }

  // ---- [L4] global budget gate (the last wall) ------------------------------
  // Before a new Live: would (cumulative + thisDebate) exceed the month cap×ratio
  // or the day cap? If so → Live OFF, Ambient stays. Caps come from env (USD),
  // never from the public config.
  function checkBudget(store, estCost, caps, gateRatio, now) {
    const ratio = (gateRatio == null ? 0.9 : gateRatio);
    const monthCap = caps && caps.monthCap;
    const dayCap = caps && caps.dayCap;
    const mB = monthBucket(now), dB = dayBucket(now);
    const monthSoFar = store.getBudget('m:' + mB);
    const daySoFar = store.getBudget('d:' + dB);
    if (monthCap != null && (monthSoFar + estCost) > monthCap * ratio) {
      return { ok: false, layer: 'L4', reason: 'month_budget', monthSoFar: monthSoFar, monthCap: monthCap };
    }
    if (dayCap != null && (daySoFar + estCost) > dayCap) {
      return { ok: false, layer: 'L4', reason: 'day_budget', daySoFar: daySoFar, dayCap: dayCap };
    }
    return { ok: true, layer: 'L4', monthSoFar: monthSoFar, daySoFar: daySoFar };
  }
  // commit actual (or estimated) spend into both buckets after a debate.
  function recordSpend(store, cost, now) {
    store.addBudget('m:' + monthBucket(now), cost);
    store.addBudget('d:' + dayBucket(now), cost);
  }

  // ---- [L4b] daily live-count hard cap --------------------------------------
  // A blunt, intuitive ceiling layered ON TOP of the USD budget gate: at most
  // dayMax Live debates per UTC day, no matter how cheap each one is. Because one
  // debate's tokens are already bounded by L5, "N debates/day" is effectively a
  // hard daily TOKEN ceiling that's easy to reason about. Reuses the budget store
  // under a 'cnt:' bucket so no new store method is needed (any KV/D1 adapter that
  // implements addBudget/getBudget supports it for free). dayMax == null → off.
  function checkDailyCount(store, dayMax, now) {
    if (dayMax == null) return { ok: true, layer: 'L4', count: 0 };
    var n = store.getBudget('cnt:' + dayBucket(now));
    if (n >= dayMax) return { ok: false, layer: 'L4', reason: 'daily_count', count: n, dayMax: dayMax };
    return { ok: true, layer: 'L4', count: n };
  }
  // count one granted Live against today's bucket (call only after a Live starts).
  function recordLiveCount(store, now) {
    return store.addBudget('cnt:' + dayBucket(now), 1);
  }

  var mod = {
    fnv1a64: fnv1a64,
    compositeKey: compositeKey,
    coarseIp: coarseIp,
    dayBucket: dayBucket,
    monthBucket: monthBucket,
    makeMemStore: makeMemStore,
    checkRate: checkRate,
    recordLive: recordLive,
    acquireConcurrency: acquireConcurrency,
    releaseConcurrency: releaseConcurrency,
    checkBurst: checkBurst,
    debateHardCap: debateHardCap,
    estimateCost: estimateCost,
    checkBudget: checkBudget,
    recordSpend: recordSpend,
    checkDailyCount: checkDailyCount,
    recordLiveCount: recordLiveCount,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof globalThis !== 'undefined') globalThis.CouncilGuards = mod;
})();
