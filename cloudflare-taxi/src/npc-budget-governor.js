const NPC_BUDGET_SOURCE = "durable-object";
const NPC_BUDGET_VIEW_CONTRACT = Object.freeze({
  source: NPC_BUDGET_SOURCE,
  durable: true,
  enforcement: "atomic_reservation",
});
const NPC_BUDGET_OBJECT_NAME = "npc-budget-canonical-v1";
const NPC_LEDGER_KEY = "ledger";
const NPC_ARCHIVED_LEDGER_PREFIX = "ledger:";
const NPC_RESERVATION_PREFIX = "reservation:";
const NPC_USD_SCALE = 1_000_000_000;
const NPC_INPUT_OVERHEAD_TOKENS = 512;
const NPC_DEFAULT_MAX_COMPLETION_TOKENS = 120;
const NPC_DEFAULT_PRICING = Object.freeze({
  "gpt-5.4-mini": Object.freeze({
    inputPer1MUsd: 0.75,
    cachedInputPer1MUsd: 0.075,
    outputPer1MUsd: 4.5,
    maxInputTokens: 272_000,
    maxOutputTokens: 128_000,
  }),
});

function internalJson(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function utcDay(nowMs = Date.now()) {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function workerUtcDay(env) {
  return utcDay(typeof env?.__npcBudgetNow === "function" ? env.__npcBudgetNow() : Date.now());
}

function isSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = value === undefined || value === null || value === "" ? fallback : Number(value);
  return isSafeNonNegativeInteger(parsed) ? parsed : null;
}

function usdToNanos(value, fallback) {
  const parsed = value === undefined || value === null || value === "" ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const scaled = parsed * NPC_USD_SCALE;
  if (!Number.isSafeInteger(Math.floor(scaled))) return null;
  return Math.floor(scaled);
}

function nanosToUsd(value) {
  return Number((value / NPC_USD_SCALE).toFixed(9));
}

function validLedger(ledger) {
  return !!ledger
    && /^\d{4}-\d{2}-\d{2}$/.test(String(ledger.day || ""))
    && isSafeNonNegativeInteger(ledger.capNanos)
    && isSafeNonNegativeInteger(ledger.dailyTurnMax)
    && isSafeNonNegativeInteger(ledger.dailyAttemptMax)
    && ledger.dailyAttemptMax > 0
    && isSafeNonNegativeInteger(ledger.spentNanos)
    && isSafeNonNegativeInteger(ledger.reservedNanos)
    && isSafeNonNegativeInteger(ledger.turns)
    && isSafeNonNegativeInteger(ledger.reservedTurns)
    && isSafeNonNegativeInteger(ledger.attempts);
}

function freshLedger(day, capNanos, dailyTurnMax, dailyAttemptMax) {
  return {
    day,
    capNanos,
    dailyTurnMax,
    dailyAttemptMax,
    spentNanos: 0,
    reservedNanos: 0,
    turns: 0,
    reservedTurns: 0,
    attempts: 0,
  };
}

function tighterTurnMax(current, incoming) {
  if (current === 0) return incoming;
  if (incoming === 0) return current;
  return Math.min(current, incoming);
}

function tightenPolicy(ledger, capNanos, dailyTurnMax, dailyAttemptMax) {
  const nextCap = Math.min(ledger.capNanos, capNanos);
  const nextTurnMax = tighterTurnMax(ledger.dailyTurnMax, dailyTurnMax);
  const nextAttemptMax = Math.min(ledger.dailyAttemptMax, dailyAttemptMax);
  const changed = nextCap !== ledger.capNanos
    || nextTurnMax !== ledger.dailyTurnMax
    || nextAttemptMax !== ledger.dailyAttemptMax;
  if (changed) {
    ledger.capNanos = nextCap;
    ledger.dailyTurnMax = nextTurnMax;
    ledger.dailyAttemptMax = nextAttemptMax;
  }
  return changed;
}

function budgetPolicy(env) {
  const capNanos = usdToNanos(env?.NPC_DAY_CAP_USD, 10);
  const dailyTurnMax = parseNonNegativeInteger(env?.NPC_DAILY_TURN_MAX, 0);
  const dailyAttemptMax = parseNonNegativeInteger(env?.NPC_DAILY_ATTEMPT_MAX, 5000);
  const providerTimeoutMs = parseNonNegativeInteger(env?.NPC_TIMEOUT_MS, 12_000);
  const governorTimeoutMs = parseNonNegativeInteger(env?.NPC_BUDGET_TIMEOUT_MS, 3000);
  const hasConfiguredLease = env?.NPC_RESERVATION_LEASE_MS !== undefined
    && env?.NPC_RESERVATION_LEASE_MS !== null
    && env?.NPC_RESERVATION_LEASE_MS !== "";
  const configuredLeaseMs = hasConfiguredLease
    ? parseNonNegativeInteger(env.NPC_RESERVATION_LEASE_MS, null)
    : null;
  const minimumLeaseMs = providerTimeoutMs === null || governorTimeoutMs === null
    ? null
    : providerTimeoutMs + governorTimeoutMs * 2 + 10_000;
  const reservationLeaseMs = hasConfiguredLease
    ? configuredLeaseMs
    : Math.max(60_000, minimumLeaseMs || 0);
  if (capNanos === null || dailyTurnMax === null
    || dailyAttemptMax === null || dailyAttemptMax < 1
    || providerTimeoutMs === null || providerTimeoutMs < 100 || providerTimeoutMs > 120_000
    || governorTimeoutMs === null || governorTimeoutMs < 100 || governorTimeoutMs > 10_000
    || reservationLeaseMs === null || reservationLeaseMs < minimumLeaseMs
    || reservationLeaseMs > 300_000) {
    return { ok: false, reason: "npc_budget_config_invalid" };
  }
  return {
    ok: true,
    capNanos,
    dailyTurnMax,
    dailyAttemptMax,
    reservationLeaseMs,
  };
}

function validPolicyPayload(body) {
  return isSafeNonNegativeInteger(body?.capNanos)
    && isSafeNonNegativeInteger(body?.dailyTurnMax)
    && isSafeNonNegativeInteger(body?.dailyAttemptMax)
    && body.dailyAttemptMax > 0
    && isSafeNonNegativeInteger(body?.reservationLeaseMs)
    && body.reservationLeaseMs > 0;
}

function publicBudget(ledger) {
  const { capNanos, dailyTurnMax } = ledger;
  const committedNanos = ledger.spentNanos + ledger.reservedNanos;
  const remainingNanos = Math.max(0, capNanos - committedNanos);
  const turnBlocked = dailyTurnMax > 0 && ledger.turns + ledger.reservedTurns >= dailyTurnMax;
  const attemptBlocked = ledger.attempts >= ledger.dailyAttemptMax;
  return {
    ...NPC_BUDGET_VIEW_CONTRACT,
    available: true,
    day: ledger.day,
    dayCapUsd: nanosToUsd(capNanos),
    spentUsd: nanosToUsd(ledger.spentNanos),
    reservedUsd: nanosToUsd(ledger.reservedNanos),
    remainingUsd: nanosToUsd(remainingNanos),
    turnsToday: ledger.turns,
    reservedTurns: ledger.reservedTurns,
    dailyTurnMax,
    attemptsToday: ledger.attempts,
    dailyAttemptMax: ledger.dailyAttemptMax,
    blocked: capNanos === 0 || committedNanos >= capNanos || turnBlocked || attemptBlocked,
  };
}

function unavailableBudget(reason, policy) {
  return {
    ...NPC_BUDGET_VIEW_CONTRACT,
    available: false,
    enabled: false,
    day: null,
    dayCapUsd: policy?.ok ? nanosToUsd(policy.capNanos) : null,
    spentUsd: null,
    reservedUsd: null,
    remainingUsd: null,
    turnsToday: null,
    reservedTurns: null,
    dailyTurnMax: policy?.ok ? policy.dailyTurnMax : null,
    attemptsToday: null,
    dailyAttemptMax: policy?.ok ? policy.dailyAttemptMax : null,
    blocked: true,
    reason,
  };
}

// Keep the asynchronous flag-control plane distinct from a point-in-time
// Governor health probe. A transient Durable Object failure must still fail the
// runtime closed, but it is not KV propagation and must not be reported as such.
export function npcControlStatus(flags, budget) {
  const controlEffective = {
    ai: flags?.effective?.ai === true,
    ambient: flags?.effective?.ambient === true,
    player: flags?.effective?.player === true,
  };
  const runtimeAvailable = budget?.available === true;
  const effective = {
    ai: controlEffective.ai && runtimeAvailable,
    ambient: controlEffective.ambient && runtimeAvailable,
    player: controlEffective.player && runtimeAvailable,
  };
  const pending = Object.keys(controlEffective).some((key) =>
    typeof flags?.requested?.[key] === "boolean"
      && flags.requested[key] !== controlEffective[key]
  );
  return {
    controlEffective,
    effective,
    pending,
    runtimeAvailable,
    budgetReason: runtimeAvailable
      ? null
      : String(budget?.reason || "npc_budget_unavailable").slice(0, 64),
  };
}

function reservationKey(reservationId) {
  return NPC_RESERVATION_PREFIX + reservationId;
}

function archivedLedgerKey(day) {
  return NPC_ARCHIVED_LEDGER_PREFIX + day;
}

function validReservationId(value) {
  return /^[a-f0-9-]{16,64}$/i.test(String(value || ""));
}

function validReservationRecord(record) {
  if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(String(record.day || ""))) return false;
  if (record.status === "pending") {
    return isSafeNonNegativeInteger(record.amountNanos) && record.amountNanos > 0
      && isSafeNonNegativeInteger(record.expiresAtMs) && record.expiresAtMs > 0;
  }
  if (record.status === "settled") {
    return isSafeNonNegativeInteger(record.chargedNanos);
  }
  return record.status === "released";
}

function operationMeta(result, extra = {}) {
  const budget = result?.budget;
  return {
    ...NPC_BUDGET_VIEW_CONTRACT,
    ...extra,
    ...(budget?.day ? {
      day: budget.day,
      spentUsd: budget.spentUsd,
      reservedUsd: budget.reservedUsd,
      remainingUsd: budget.remainingUsd,
      turnsToday: budget.turnsToday,
      reservedTurns: budget.reservedTurns,
      dailyTurnMax: budget.dailyTurnMax,
      attemptsToday: budget.attemptsToday,
      dailyAttemptMax: budget.dailyAttemptMax,
    } : {}),
  };
}

function emitReset(emit, result) {
  if (result?.reset) emit?.("npc_budget_utc_reset", operationMeta(result));
}

export class NpcBudgetGovernor {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  now() {
    return typeof this.env?.__npcBudgetNow === "function"
      ? this.env.__npcBudgetNow()
      : Date.now();
  }

  async cleanupFinalized(day, retainDay) {
    const records = await this.state.storage.list({ prefix: NPC_RESERVATION_PREFIX });
    const pendingDays = new Set();
    const deleteKeys = [];
    for (const [key, record] of records) {
      if (!validReservationRecord(record)) throw new Error("npc_budget_corrupt");
      if (record.status === "pending") pendingDays.add(record.day);
      else if (record.day !== day && record.day !== retainDay) deleteKeys.push(key);
    }
    const archived = await this.state.storage.list({ prefix: NPC_ARCHIVED_LEDGER_PREFIX });
    for (const [key, ledger] of archived) {
      if (!validLedger(ledger)) throw new Error("npc_budget_corrupt");
      if (!pendingDays.has(ledger.day)) deleteKeys.push(key);
    }
    for (let index = 0; index < deleteKeys.length; index += 128) {
      await this.state.storage.delete(deleteKeys.slice(index, index + 128));
    }
  }

  async loadLedger(capNanos, dailyTurnMax, dailyAttemptMax) {
    const day = utcDay(this.now());
    const stored = await this.state.storage.get(NPC_LEDGER_KEY);
    if (!stored) {
      const ledger = freshLedger(day, capNanos, dailyTurnMax, dailyAttemptMax);
      await this.state.storage.put(NPC_LEDGER_KEY, ledger);
      return { ledger, reset: false };
    }
    if (!validLedger(stored)) throw new Error("npc_budget_corrupt");
    if (stored.day === day) {
      if (tightenPolicy(stored, capNanos, dailyTurnMax, dailyAttemptMax)) {
        await this.state.storage.put(NPC_LEDGER_KEY, stored);
      }
      return { ledger: stored, reset: false };
    }

    const ledger = freshLedger(day, capNanos, dailyTurnMax, dailyAttemptMax);
    await this.state.storage.put({
      [archivedLedgerKey(stored.day)]: stored,
      [NPC_LEDGER_KEY]: ledger,
    });
    await this.cleanupFinalized(day, stored.day);
    return { ledger, reset: true };
  }

  async reservationLedger(record, currentLedger) {
    if (record.day === currentLedger.day) {
      return { ledger: currentLedger, key: NPC_LEDGER_KEY };
    }
    const key = archivedLedgerKey(record.day);
    const ledger = await this.state.storage.get(key);
    if (!validLedger(ledger)) throw new Error("npc_budget_corrupt");
    return { ledger, key };
  }

  async scheduleAlarm(expiresAtMs) {
    const current = await this.state.storage.getAlarm();
    if (current === null || expiresAtMs < current) {
      await this.state.storage.setAlarm(expiresAtMs);
    }
  }

  async reconcileExpiredReservations() {
    const nowMs = this.now();
    const currentLedger = await this.state.storage.get(NPC_LEDGER_KEY);
    if (!currentLedger) return;
    if (!validLedger(currentLedger)) throw new Error("npc_budget_corrupt");
    const records = await this.state.storage.list({ prefix: NPC_RESERVATION_PREFIX });
    let processed = 0;
    let nextAlarm = null;
    for (const [key, record] of records) {
      if (!validReservationRecord(record)) throw new Error("npc_budget_corrupt");
      if (record.status !== "pending") continue;
      if (record.expiresAtMs > nowMs) {
        nextAlarm = nextAlarm === null ? record.expiresAtMs : Math.min(nextAlarm, record.expiresAtMs);
        continue;
      }
      if (processed >= 64) {
        nextAlarm = nowMs + 1000;
        continue;
      }
      const target = await this.reservationLedger(record, currentLedger);
      if (target.ledger.reservedNanos < record.amountNanos || target.ledger.reservedTurns < 1) {
        throw new Error("npc_budget_corrupt");
      }
      target.ledger.reservedNanos -= record.amountNanos;
      target.ledger.reservedTurns -= 1;
      target.ledger.spentNanos += record.amountNanos;
      target.ledger.turns += 1;
      await this.state.storage.put({
        [target.key]: target.ledger,
        [key]: {
          day: record.day,
          status: "settled",
          chargedNanos: record.amountNanos,
          bounded: true,
          expired: true,
        },
      });
      processed += 1;
    }
    if (nextAlarm !== null) await this.state.storage.setAlarm(nextAlarm);
  }

  async handle(request) {
    if (request.method !== "POST") return internalJson({ ok: false, reason: "POST only" }, 405);
    let body;
    try {
      body = await request.json();
    } catch {
      return internalJson({ ok: false, reason: "bad body" }, 400);
    }
    if (!validPolicyPayload(body)) {
      return internalJson({ ok: false, reason: "invalid_policy" }, 400);
    }

    const loaded = await this.loadLedger(body.capNanos, body.dailyTurnMax, body.dailyAttemptMax);
    const currentBudget = () => publicBudget(loaded.ledger);
    if (body.op === "status") {
      return internalJson({ ok: true, reset: loaded.reset, budget: currentBudget() });
    }

    if (!validReservationId(body.reservationId)) {
      return internalJson({ ok: false, reset: loaded.reset, reason: "invalid_reservation", budget: currentBudget() }, 400);
    }
    const key = reservationKey(body.reservationId);
    const record = await this.state.storage.get(key);
    if (record && !validReservationRecord(record)) throw new Error("npc_budget_corrupt");

    if (body.op === "reserve") {
      if (!isSafeNonNegativeInteger(body.amountNanos) || body.amountNanos <= 0) {
        return internalJson({ ok: false, reset: loaded.reset, accepted: false, reason: "unsafe_cost_bound", budget: currentBudget() }, 400);
      }
      if (record) {
        if (record.status === "pending" && record.day !== loaded.ledger.day) {
          const target = await this.reservationLedger(record, loaded.ledger);
          if (target.ledger.reservedNanos < record.amountNanos || target.ledger.reservedTurns < 1) {
            throw new Error("npc_budget_corrupt");
          }
          target.ledger.reservedNanos -= record.amountNanos;
          target.ledger.reservedTurns -= 1;
          await this.state.storage.put({
            [target.key]: target.ledger,
            [key]: { day: record.day, status: "released" },
          });
          await this.state.storage.delete(key);
          return internalJson({
            ok: true,
            reset: loaded.reset,
            accepted: false,
            idempotent: true,
            reason: "reservation_expired",
            budget: currentBudget(),
          });
        }
        const accepted = record.day === loaded.ledger.day
          && record.status === "pending"
          && record.amountNanos === body.amountNanos;
        if (accepted) await this.scheduleAlarm(record.expiresAtMs);
        return internalJson({
          ok: true,
          reset: loaded.reset,
          accepted,
          idempotent: true,
          reason: accepted ? null
            : record.status === "pending" ? "reservation_mismatch" : "reservation_finalized",
          budget: currentBudget(),
        });
      }
      const committedNanos = loaded.ledger.spentNanos + loaded.ledger.reservedNanos;
      if (loaded.ledger.capNanos === 0) {
        return internalJson({ ok: true, reset: loaded.reset, accepted: false, reason: "day_cap_zero", budget: currentBudget() });
      }
      if (body.amountNanos > loaded.ledger.capNanos - Math.min(loaded.ledger.capNanos, committedNanos)) {
        return internalJson({ ok: true, reset: loaded.reset, accepted: false, reason: "day_cap_exhausted", budget: currentBudget() });
      }
      if (loaded.ledger.dailyTurnMax > 0
        && loaded.ledger.turns + loaded.ledger.reservedTurns >= loaded.ledger.dailyTurnMax) {
        return internalJson({ ok: true, reset: loaded.reset, accepted: false, reason: "daily_turn_max", budget: currentBudget() });
      }
      if (loaded.ledger.attempts >= loaded.ledger.dailyAttemptMax) {
        return internalJson({ ok: true, reset: loaded.reset, accepted: false, reason: "daily_attempt_max", budget: currentBudget() });
      }

      const expiresAtMs = this.now() + body.reservationLeaseMs;
      if (!Number.isSafeInteger(expiresAtMs)) {
        return internalJson({ ok: false, reset: loaded.reset, accepted: false, reason: "invalid_reservation_lease", budget: currentBudget() }, 400);
      }
      loaded.ledger.reservedNanos += body.amountNanos;
      loaded.ledger.reservedTurns += 1;
      loaded.ledger.attempts += 1;
      await this.state.storage.put({
        [NPC_LEDGER_KEY]: loaded.ledger,
        [key]: {
          day: loaded.ledger.day,
          status: "pending",
          amountNanos: body.amountNanos,
          expiresAtMs,
        },
      });
      await this.scheduleAlarm(expiresAtMs);
      return internalJson({ ok: true, reset: loaded.reset, accepted: true, budget: currentBudget() });
    }

    if (body.op === "settle") {
      if (!record) {
        return internalJson({ ok: false, reset: loaded.reset, reason: "unknown_reservation", budget: currentBudget() }, 409);
      }
      if (record.status === "settled") {
        return internalJson({
          ok: true,
          reset: loaded.reset,
          idempotent: true,
          settled: true,
          chargedNanos: record.chargedNanos,
          bounded: !!record.bounded,
          budget: currentBudget(),
        });
      }
      if (record.status !== "pending") {
        return internalJson({ ok: false, reset: loaded.reset, reason: "reservation_released", budget: currentBudget() }, 409);
      }
      if (!isSafeNonNegativeInteger(body.actualNanos)) {
        return internalJson({ ok: false, reset: loaded.reset, reason: "invalid_actual_cost", budget: currentBudget() }, 400);
      }
      const target = await this.reservationLedger(record, loaded.ledger);
      if (target.ledger.reservedNanos < record.amountNanos || target.ledger.reservedTurns < 1) {
        throw new Error("npc_budget_corrupt");
      }

      const chargedNanos = Math.min(body.actualNanos, record.amountNanos);
      target.ledger.reservedNanos -= record.amountNanos;
      target.ledger.reservedTurns -= 1;
      target.ledger.spentNanos += chargedNanos;
      target.ledger.turns += 1;
      await this.state.storage.put({
        [target.key]: target.ledger,
        [key]: {
          day: record.day,
          status: "settled",
          chargedNanos,
          bounded: body.actualNanos > record.amountNanos,
        },
      });
      return internalJson({
        ok: true,
        reset: loaded.reset,
        settled: true,
        bounded: body.actualNanos > record.amountNanos,
        chargedNanos,
        budget: currentBudget(),
      });
    }

    if (body.op === "release") {
      if (!record) {
        return internalJson({ ok: true, reset: loaded.reset, idempotent: true, released: false, budget: currentBudget() });
      }
      if (record.status === "released") {
        return internalJson({ ok: true, reset: loaded.reset, idempotent: true, released: true, budget: currentBudget() });
      }
      if (record.status !== "pending") {
        return internalJson({ ok: false, reset: loaded.reset, reason: "reservation_settled", budget: currentBudget() }, 409);
      }
      const target = await this.reservationLedger(record, loaded.ledger);
      if (target.ledger.reservedNanos < record.amountNanos || target.ledger.reservedTurns < 1) {
        throw new Error("npc_budget_corrupt");
      }

      target.ledger.reservedNanos -= record.amountNanos;
      target.ledger.reservedTurns -= 1;
      await this.state.storage.put({
        [target.key]: target.ledger,
        [key]: { day: record.day, status: "released" },
      });
      await this.state.storage.delete(key);
      return internalJson({ ok: true, reset: loaded.reset, released: true, budget: currentBudget() });
    }

    return internalJson({ ok: false, reset: loaded.reset, reason: "unknown_operation", budget: currentBudget() }, 400);
  }

  async fetch(request) {
    const run = async () => {
      try {
        return await this.handle(request);
      } catch (error) {
        const reason = error?.message === "npc_budget_corrupt" ? "npc_budget_corrupt" : "npc_budget_storage_error";
        return internalJson({ ok: false, reason }, 503);
      }
    };
    return typeof this.state.blockConcurrencyWhile === "function"
      ? this.state.blockConcurrencyWhile(run)
      : run();
  }

  async alarm() {
    const run = () => this.reconcileExpiredReservations();
    return typeof this.state.blockConcurrencyWhile === "function"
      ? this.state.blockConcurrencyWhile(run)
      : run();
  }
}

function npcDeployment(env, role) {
  return (role === "ambient" && env.NPC_MODEL_AMBIENT)
    || (role === "player" && env.NPC_MODEL_PLAYER)
    || env.NPC_MODEL_DEFAULT
    || "gpt-5.4-mini";
}

function parsePrice(value, allowZero) {
  if (typeof value !== "number" || !Number.isFinite(value)
    || value < 0 || (!allowZero && value === 0)) return null;
  return value;
}

function modelPricing(env, deployment) {
  let configured = {};
  if (env?.NPC_MODEL_PRICING_JSON) {
    try {
      configured = JSON.parse(env.NPC_MODEL_PRICING_JSON);
    } catch {
      return { ok: false, reason: "npc_pricing_invalid" };
    }
    if (!configured || typeof configured !== "object" || Array.isArray(configured)) {
      return { ok: false, reason: "npc_pricing_invalid" };
    }
  }
  const entry = configured[deployment] || NPC_DEFAULT_PRICING[deployment];
  if (!entry || typeof entry !== "object") {
    return { ok: false, reason: "npc_pricing_unavailable" };
  }
  const inputPer1MUsd = parsePrice(entry.inputPer1MUsd, false);
  const cachedInputPer1MUsd = parsePrice(entry.cachedInputPer1MUsd, true);
  const outputPer1MUsd = parsePrice(entry.outputPer1MUsd, false);
  const maxInputTokens = parseNonNegativeInteger(entry.maxInputTokens, null);
  const maxOutputTokens = parseNonNegativeInteger(entry.maxOutputTokens, null);
  if (inputPer1MUsd === null || cachedInputPer1MUsd === null || outputPer1MUsd === null) {
    return { ok: false, reason: "npc_pricing_invalid" };
  }
  if (maxInputTokens === null || maxInputTokens < 1
    || maxOutputTokens === null || maxOutputTokens < 1) {
    return { ok: false, reason: "npc_model_bounds_invalid" };
  }
  return {
    ok: true,
    inputPer1MUsd,
    cachedInputPer1MUsd,
    outputPer1MUsd,
    maxInputTokens,
    maxOutputTokens,
  };
}

function maxCostNanos(maxInputTokens, maxOutputTokens, pricing) {
  const maxInputPrice = Math.max(pricing.inputPer1MUsd, pricing.cachedInputPer1MUsd);
  const usd = maxInputTokens / 1_000_000 * maxInputPrice
    + maxOutputTokens / 1_000_000 * pricing.outputPer1MUsd;
  const nanos = Math.ceil(usd * NPC_USD_SCALE);
  return Number.isSafeInteger(nanos) && nanos > 0 ? nanos : null;
}

export function createNpcCallPlan(env, role, messages) {
  if (role !== "ambient" && role !== "player") {
    return { ok: false, reason: "npc_role_invalid" };
  }
  if (!Array.isArray(messages) || messages.length !== 2) {
    return { ok: false, reason: "npc_messages_invalid" };
  }
  const deployment = npcDeployment(env, role);
  const pricing = modelPricing(env, deployment);
  if (!pricing.ok) return pricing;
  const maxOutputTokens = parseNonNegativeInteger(
    env?.NPC_MAX_COMPLETION_TOKENS,
    NPC_DEFAULT_MAX_COMPLETION_TOKENS,
  );
  if (maxOutputTokens === null || maxOutputTokens < 1 || maxOutputTokens > 4096) {
    return { ok: false, reason: "npc_output_bound_invalid" };
  }
  const encodedBytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;
  const maxInputTokens = encodedBytes + NPC_INPUT_OVERHEAD_TOKENS;
  if (maxInputTokens > pricing.maxInputTokens || maxOutputTokens > pricing.maxOutputTokens) {
    return { ok: false, reason: "npc_request_exceeds_model_bounds" };
  }
  const reservationNanos = maxCostNanos(maxInputTokens, maxOutputTokens, pricing);
  if (reservationNanos === null) {
    return { ok: false, reason: "npc_cost_bound_invalid" };
  }
  return {
    ok: true,
    deployment,
    messages,
    maxInputTokens,
    maxOutputTokens,
    pricing,
    reservationNanos,
  };
}

export function normalizeNpcUsage(usage) {
  const raw = usage && typeof usage === "object" ? usage : {};
  const details = raw.prompt_tokens_details || raw.input_tokens_details || {};
  const promptTokens = Math.max(0, Number(raw.prompt_tokens ?? raw.input_tokens) || 0);
  return {
    prompt_tokens: promptTokens,
    cached_tokens: Math.min(promptTokens, Math.max(0, Number(details.cached_tokens ?? raw.cached_tokens) || 0)),
    completion_tokens: Math.max(0, Number(raw.completion_tokens ?? raw.output_tokens) || 0),
  };
}

function usageCount(usage, primary, alternate) {
  const key = Object.prototype.hasOwnProperty.call(usage, primary)
    ? primary
    : Object.prototype.hasOwnProperty.call(usage, alternate)
      ? alternate
      : null;
  if (!key || !isSafeNonNegativeInteger(usage[key])) return null;
  return usage[key];
}

function settledCost(plan, usage, requireOutputTokens) {
  if (!usage || typeof usage !== "object") {
    return {
      usage: normalizeNpcUsage(null),
      actualNanos: plan.reservationNanos,
      usageAuthoritative: false,
      reason: "provider_usage_missing",
    };
  }

  const promptTokens = usageCount(usage, "prompt_tokens", "input_tokens");
  const completionTokens = usageCount(usage, "completion_tokens", "output_tokens");
  const totalTokens = Object.prototype.hasOwnProperty.call(usage, "total_tokens")
    && isSafeNonNegativeInteger(usage.total_tokens)
    ? usage.total_tokens
    : null;
  const details = usage.prompt_tokens_details || usage.input_tokens_details;
  let cachedTokens = 0;
  if (details !== undefined) {
    if (!details || typeof details !== "object") {
      return {
        usage: normalizeNpcUsage(usage),
        actualNanos: plan.reservationNanos,
        usageAuthoritative: false,
        reason: "provider_usage_invalid",
      };
    }
    if (Object.prototype.hasOwnProperty.call(details, "cached_tokens")) {
      cachedTokens = details.cached_tokens;
      if (!isSafeNonNegativeInteger(cachedTokens)) {
        return {
          usage: normalizeNpcUsage(usage),
          actualNanos: plan.reservationNanos,
          usageAuthoritative: false,
          reason: "provider_usage_invalid",
        };
      }
    } else if (Object.prototype.hasOwnProperty.call(usage, "cached_tokens")) {
      cachedTokens = usage.cached_tokens;
      if (!isSafeNonNegativeInteger(cachedTokens)) {
        return {
          usage: normalizeNpcUsage(usage),
          actualNanos: plan.reservationNanos,
          usageAuthoritative: false,
          reason: "provider_usage_invalid",
        };
      }
    }
  } else if (Object.prototype.hasOwnProperty.call(usage, "cached_tokens")) {
    cachedTokens = usage.cached_tokens;
    if (!isSafeNonNegativeInteger(cachedTokens)) {
      return {
        usage: normalizeNpcUsage(usage),
        actualNanos: plan.reservationNanos,
        usageAuthoritative: false,
        reason: "provider_usage_invalid",
      };
    }
  }
  if (promptTokens === null || promptTokens < 1
    || completionTokens === null
    || (requireOutputTokens && completionTokens < 1)
    || totalTokens === null
    || totalTokens !== promptTokens + completionTokens
    || cachedTokens > promptTokens) {
    return {
      usage: normalizeNpcUsage(usage),
      actualNanos: plan.reservationNanos,
      usageAuthoritative: false,
      reason: "provider_usage_invalid",
    };
  }
  const normalized = {
    prompt_tokens: promptTokens,
    cached_tokens: cachedTokens,
    completion_tokens: completionTokens,
  };
  if (normalized.prompt_tokens > plan.maxInputTokens
    || normalized.completion_tokens > plan.maxOutputTokens) {
    return {
      usage: normalized,
      actualNanos: plan.reservationNanos,
      usageAuthoritative: false,
      reason: "provider_usage_out_of_bounds",
    };
  }
  const uncached = normalized.prompt_tokens - normalized.cached_tokens;
  const usd = uncached / 1_000_000 * plan.pricing.inputPer1MUsd
    + normalized.cached_tokens / 1_000_000 * plan.pricing.cachedInputPer1MUsd
    + normalized.completion_tokens / 1_000_000 * plan.pricing.outputPer1MUsd;
  const actualNanos = Math.min(plan.reservationNanos, Math.ceil(usd * NPC_USD_SCALE));
  return { usage: normalized, actualNanos, usageAuthoritative: true, reason: null };
}

function governorStub(env) {
  const namespace = env?.NPC_BUDGET_GOVERNOR;
  if (!namespace) throw new Error("npc_budget_binding_missing");
  if (typeof namespace.getByName === "function") {
    return namespace.getByName(NPC_BUDGET_OBJECT_NAME);
  }
  if (typeof namespace.idFromName === "function" && typeof namespace.get === "function") {
    return namespace.get(namespace.idFromName(NPC_BUDGET_OBJECT_NAME));
  }
  throw new Error("npc_budget_binding_invalid");
}

async function governorCall(env, payload) {
  const timeoutMs = parseNonNegativeInteger(env?.NPC_BUDGET_TIMEOUT_MS, 3000);
  if (timeoutMs === null || timeoutMs < 100 || timeoutMs > 10_000) {
    return { ok: false, reason: "npc_budget_timeout_invalid" };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await governorStub(env).fetch("https://npc-budget.internal/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!response?.ok) {
      const body = await response?.json().catch(() => null);
      return { ok: false, reason: body?.reason || "npc_budget_governor_error" };
    }
    const body = await response.json();
    return body?.ok ? body : { ok: false, reason: body?.reason || "npc_budget_governor_error" };
  } catch (error) {
    const overloaded = error?.overloaded === true;
    const bindingMisconfigured = ["npc_budget_binding_missing", "npc_budget_binding_invalid"]
      .includes(error?.message);
    return {
      ok: false,
      reason: overloaded
        ? "npc_budget_governor_overloaded"
        : error?.name === "AbortError"
          ? "npc_budget_governor_timeout"
          : "npc_budget_governor_unavailable",
      overloaded,
      retryable: !overloaded && !bindingMisconfigured
        && (error?.name === "AbortError" || error?.retryable !== false),
    };
  } finally {
    clearTimeout(timer);
  }
}

function retryableGovernorFailure(result) {
  if (result?.overloaded === true || result?.retryable === false
    || result?.reason === "npc_budget_governor_overloaded") return false;
  if (result?.retryable === true) return true;
  return [
    "npc_budget_governor_timeout",
    "npc_budget_governor_unavailable",
    "npc_budget_governor_error",
    "npc_budget_storage_error",
  ].includes(result?.reason);
}

function governorRetryDelayMs(env) {
  const sampled = typeof env?.__npcBudgetRandom === "function"
    ? Number(env.__npcBudgetRandom())
    : Math.random();
  const unit = Number.isFinite(sampled) ? Math.max(0, Math.min(1, sampled)) : 0;
  return 100 + Math.floor(unit * 150);
}

async function waitBeforeGovernorRetry(env) {
  const delayMs = governorRetryDelayMs(env);
  if (typeof env?.__npcBudgetSleep === "function") {
    await env.__npcBudgetSleep(delayMs);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function reliableGovernorCall(env, payload) {
  const first = await governorCall(env, payload);
  if (!retryableGovernorFailure(first)) return first;
  await waitBeforeGovernorRetry(env);
  return governorCall(env, payload);
}

function withEnabled(budget, enabled) {
  return { ...budget, enabled: !!enabled && budget.available === true };
}

export async function npcBudgetStatus(env, enabled, emit) {
  const policy = budgetPolicy(env);
  if (!policy.ok) return unavailableBudget(policy.reason, policy);
  const result = await reliableGovernorCall(env, { op: "status", ...policy });
  if (!result.ok || !result.budget) {
    return unavailableBudget(result.reason || "npc_budget_governor_unavailable", policy);
  }
  emitReset(emit, result);
  return withEnabled(result.budget, enabled);
}

async function releaseReservation(env, policy, reservationId) {
  return reliableGovernorCall(env, { op: "release", ...policy, reservationId });
}

export async function runBudgetedNpcCall({
  env,
  role,
  messages,
  enabled,
  emit,
  providerCall,
}) {
  const policy = budgetPolicy(env);
  if (!enabled) {
    return {
      ok: false,
      reason: "npc_ai_disabled",
      budget: await npcBudgetStatus(env, false, emit),
    };
  }
  if (!policy.ok) {
    const budget = unavailableBudget(policy.reason, policy);
    emit?.("npc_budget_reserve", operationMeta({ budget }, {
      role,
      accepted: false,
      reason: policy.reason,
    }));
    return { ok: false, reason: policy.reason, budget };
  }

  const plan = createNpcCallPlan(env, role, messages);
  if (!plan.ok) {
    const budget = await npcBudgetStatus(env, enabled, emit);
    emit?.("npc_budget_reserve", operationMeta({ budget }, {
      role,
      accepted: false,
      reason: plan.reason,
    }));
    return { ok: false, reason: plan.reason, budget };
  }

  const reservationId = crypto.randomUUID();
  const reserved = await reliableGovernorCall(env, {
    op: "reserve",
    ...policy,
    reservationId,
    amountNanos: plan.reservationNanos,
  });
  emitReset(emit, reserved);
  if (!reserved.ok || !reserved.accepted) {
    const budget = reserved.budget
      ? withEnabled(reserved.budget, enabled)
      : unavailableBudget(reserved.reason || "npc_budget_governor_unavailable", policy);
    emit?.("npc_budget_reserve", operationMeta({ budget }, {
      role,
      accepted: false,
      reason: reserved.reason || "npc_budget_governor_unavailable",
      maxCostUsd: nanosToUsd(plan.reservationNanos),
    }));
    return {
      ok: false,
      reason: reserved.reason || "npc_budget_governor_unavailable",
      budget,
    };
  }
  const reservedBudget = withEnabled(reserved.budget, enabled);
  if (reservedBudget.day !== workerUtcDay(env)) {
    const released = await releaseReservation(env, policy, reservationId);
    const budget = released.ok && released.budget
      ? withEnabled(released.budget, enabled)
      : unavailableBudget(released.reason || "npc_budget_governor_unavailable", policy);
    if (released.ok) {
      emit?.("npc_budget_settle", operationMeta({ budget }, {
        role,
        outcome: "released",
      }));
    }
    return { ok: false, reason: "reservation_expired", budget };
  }
  emit?.("npc_budget_reserve", operationMeta({ budget: reservedBudget }, {
    role,
    accepted: true,
    maxCostUsd: nanosToUsd(plan.reservationNanos),
  }));

  let provider;
  try {
    provider = await providerCall(plan);
  } catch (error) {
    provider = {
      ok: false,
      reason: error?.name === "AbortError" ? "provider_timeout" : "provider_error",
    };
  }
  if (!provider?.ok && !provider?.billable) {
    const released = await releaseReservation(env, policy, reservationId);
    emitReset(emit, released);
    const budget = released.ok && released.budget
      ? withEnabled(released.budget, enabled)
      : unavailableBudget(released.reason || "npc_budget_governor_unavailable", policy);
    emit?.("npc_provider_error", operationMeta({ budget }, {
      role,
      reason: provider?.reason || "provider_error",
      reservationReleased: !!released.ok,
    }));
    if (released.ok) {
      emit?.("npc_budget_settle", operationMeta({ budget }, {
        role,
        outcome: "released",
      }));
    }
    return {
      ok: false,
      reason: provider?.reason || "provider_error",
      budget,
    };
  }

  const cost = settledCost(plan, provider.usage, provider.ok && !!provider.text);
  const settled = await reliableGovernorCall(env, {
    op: "settle",
    ...policy,
    reservationId,
    actualNanos: cost.actualNanos,
  });
  emitReset(emit, settled);
  if (!settled.ok || !settled.budget) {
    const budget = unavailableBudget(settled.reason || "npc_budget_governor_unavailable", policy);
    emit?.("npc_provider_error", operationMeta({ budget }, {
      role,
      reason: "npc_budget_settle_failed",
      reservationReleased: false,
    }));
    return { ok: false, reason: "npc_budget_settle_failed", budget };
  }

  const budget = withEnabled(settled.budget, enabled);
  emit?.("npc_budget_settle", operationMeta({ budget }, {
    role,
    outcome: "settled",
    costUsd: nanosToUsd(settled.chargedNanos),
    usageAuthoritative: cost.usageAuthoritative,
    usageReason: cost.reason,
  }));
  if (!provider.ok) {
    emit?.("npc_provider_error", operationMeta({ budget }, {
      role,
      reason: provider.reason || "provider_error",
      reservationReleased: false,
    }));
    return {
      ok: false,
      reason: provider.reason || "provider_error",
      budget,
      usage: cost.usage,
      model: plan.deployment,
      costUsd: nanosToUsd(settled.chargedNanos),
    };
  }
  return {
    ok: true,
    value: provider,
    budget,
    usage: cost.usage,
    model: plan.deployment,
    costUsd: nanosToUsd(settled.chargedNanos),
  };
}
