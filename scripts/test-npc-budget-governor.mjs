import {
  NpcBudgetGovernor,
  createNpcCallPlan,
  npcBudgetStatus,
  runBudgetedNpcCall,
} from '../cloudflare-taxi/src/npc-budget-governor.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
    this.alarmAt = null;
  }

  async get(key) {
    const value = this.values.get(key);
    return value === undefined ? undefined : structuredClone(value);
  }

  async put(key, value) {
    if (typeof key === 'object' && key !== null) {
      for (const [entryKey, entryValue] of Object.entries(key)) {
        this.values.set(entryKey, structuredClone(entryValue));
      }
      return;
    }
    this.values.set(key, structuredClone(value));
  }

  async list(options = {}) {
    const prefix = String(options.prefix || '');
    return new Map([...this.values.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key, structuredClone(value)]));
  }

  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) this.values.delete(key);
  }

  async deleteAll() {
    this.values.clear();
  }

  async getAlarm() {
    return this.alarmAt;
  }

  async setAlarm(timestamp) {
    this.alarmAt = timestamp;
  }
}

class MemoryState {
  constructor() {
    this.storage = new MemoryStorage();
    this.tail = Promise.resolve();
  }

  blockConcurrencyWhile(callback) {
    const result = this.tail.then(callback, callback);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function makeGovernor(nowRef = { value: Date.parse('2026-07-30T12:00:00Z') }) {
  const state = new MemoryState();
  const governor = new NpcBudgetGovernor(state, { __npcBudgetNow: () => nowRef.value });
  return { state, governor, nowRef };
}

function namespaceFor(governor, failure) {
  return {
    getByName(name) {
      if (name !== 'npc-budget-canonical-v1') throw new Error('non-canonical governor name');
      return {
        async fetch(input, init) {
          if (failure) throw new Error('binding unavailable');
          const request = input instanceof Request ? input : new Request(input, init);
          return governor.fetch(request);
        },
      };
    },
  };
}

async function operation(governor, body) {
  const response = await governor.fetch(new Request('https://npc-budget.internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return response.json();
}

function reservationId(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function baseEnv(governor) {
  return {
    __npcBudgetNow: () => governor.now(),
    NPC_AI_ENABLED: 'true',
    NPC_DAY_CAP_USD: '1',
    NPC_DAILY_TURN_MAX: '0',
    NPC_MODEL_DEFAULT: 'gpt-5.4-mini',
    NPC_MODEL_PRICING_JSON: JSON.stringify({
      'gpt-5.4-mini': {
        inputPer1MUsd: 0.75,
        cachedInputPer1MUsd: 0.075,
        outputPer1MUsd: 4.5,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,
      },
    }),
    NPC_MAX_COMPLETION_TOKENS: '120',
    NPC_BUDGET_TIMEOUT_MS: '500',
    NPC_BUDGET_GOVERNOR: namespaceFor(governor),
  };
}

const MESSAGES = [
  { role: 'system', content: 'A short resident system prompt.' },
  { role: 'user', content: 'A unique hermetic visitor message.' },
];

export async function runNpcBudgetGovernorTests(check) {
  {
    const { governor } = makeGovernor();
    const policy = { capNanos: 1_000_000, dailyTurnMax: 0, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const reservations = await Promise.all([
      operation(governor, { op: 'reserve', ...policy, reservationId: reservationId(1), amountNanos: 600_000 }),
      operation(governor, { op: 'reserve', ...policy, reservationId: reservationId(2), amountNanos: 600_000 }),
    ]);
    const status = await operation(governor, { op: 'status', ...policy });
    check(reservations.filter((result) => result.accepted).length === 1
      && status.budget.reservedUsd === 0.0006
      && status.budget.source === 'durable-object'
      && status.budget.durable === true
      && status.budget.enforcement === 'atomic_reservation'
      && status.budget.reservedUsd + status.budget.spentUsd <= status.budget.dayCapUsd,
    'Durable governor advertises atomic reservation enforcement and serializes simultaneous reservations without cap overshoot');
  }

  {
    const { governor } = makeGovernor();
    const policy = { capNanos: 1_000_000, dailyTurnMax: 0, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const id = reservationId(3);
    const first = await operation(governor, { op: 'reserve', ...policy, reservationId: id, amountNanos: 500_000 });
    const duplicateReserve = await operation(governor, { op: 'reserve', ...policy, reservationId: id, amountNanos: 500_000 });
    const mismatchedReserve = await operation(governor, { op: 'reserve', ...policy, reservationId: id, amountNanos: 400_000 });
    const settled = await operation(governor, { op: 'settle', ...policy, reservationId: id, actualNanos: 250_000 });
    const duplicateSettle = await operation(governor, { op: 'settle', ...policy, reservationId: id, actualNanos: 250_000 });
    check(first.accepted && duplicateReserve.accepted && duplicateReserve.idempotent
      && !mismatchedReserve.accepted && mismatchedReserve.reason === 'reservation_mismatch'
      && settled.settled && duplicateSettle.idempotent
      && duplicateSettle.chargedNanos === 250_000
      && duplicateSettle.budget.spentUsd === 0.00025
      && duplicateSettle.budget.reservedUsd === 0
      && duplicateSettle.budget.turnsToday === 1,
    'reserve and settle retries are idempotent');
  }

  {
    const { governor, nowRef } = makeGovernor();
    const policy = { capNanos: 1_000_000, dailyTurnMax: 0, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const id = reservationId(4);
    await operation(governor, { op: 'reserve', ...policy, reservationId: id, amountNanos: 500_000 });
    nowRef.value = Date.parse('2026-07-31T00:00:01Z');
    const nextDay = await operation(governor, { op: 'status', ...policy });
    const settledAfterMidnight = await operation(governor, {
      op: 'settle',
      ...policy,
      reservationId: id,
      actualNanos: 300_000,
    });
    const duplicateSettle = await operation(governor, {
      op: 'settle',
      ...policy,
      reservationId: id,
      actualNanos: 300_000,
    });
    const priorLedger = await governor.state.storage.get('ledger:2026-07-30');
    check(nextDay.reset && nextDay.budget.day === '2026-07-31'
      && nextDay.budget.spentUsd === 0 && nextDay.budget.reservedUsd === 0
      && settledAfterMidnight.settled && duplicateSettle.idempotent
      && priorLedger.spentNanos === 300_000 && priorLedger.reservedNanos === 0
      && priorLedger.turns === 1 && priorLedger.reservedTurns === 0,
    'UTC rollover starts a clean day while preserving cross-midnight settlement idempotency');
  }

  {
    const { governor, nowRef } = makeGovernor();
    const policy = { capNanos: 1_000_000, dailyTurnMax: 0, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const id = reservationId(42);
    await operation(governor, { op: 'reserve', ...policy, reservationId: id, amountNanos: 500_000 });
    await operation(governor, { op: 'settle', ...policy, reservationId: id, actualNanos: 200_000 });
    nowRef.value = Date.parse('2026-07-31T00:00:01Z');
    const duplicateAfterMidnight = await operation(governor, {
      op: 'settle',
      ...policy,
      reservationId: id,
      actualNanos: 200_000,
    });
    check(duplicateAfterMidnight.idempotent && duplicateAfterMidnight.chargedNanos === 200_000,
      'settlement response retries remain idempotent across the next UTC rollover');
  }

  {
    const { governor, nowRef } = makeGovernor();
    const policy = { capNanos: 1_000_000, dailyTurnMax: 0, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const id = reservationId(41);
    await operation(governor, { op: 'reserve', ...policy, reservationId: id, amountNanos: 500_000 });
    nowRef.value = Date.parse('2026-07-31T00:00:01Z');
    const expiredRetry = await operation(governor, {
      op: 'reserve',
      ...policy,
      reservationId: id,
      amountNanos: 500_000,
    });
    const priorLedger = await governor.state.storage.get('ledger:2026-07-30');
    const record = await governor.state.storage.get(`reservation:${id}`);
    check(!expiredRetry.accepted && expiredRetry.reason === 'reservation_expired'
      && priorLedger.reservedNanos === 0 && priorLedger.reservedTurns === 0
      && record === undefined,
    'a lost reserve response retried after UTC rollover releases its expired authorization');
  }

  {
    const { governor } = makeGovernor();
    const initial = { capNanos: 1_000_000, dailyTurnMax: 0, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const id = reservationId(5);
    await operation(governor, { op: 'reserve', ...initial, reservationId: id, amountNanos: 500_000 });
    await operation(governor, { op: 'settle', ...initial, reservationId: id, actualNanos: 400_000 });
    const lowered = await operation(governor, {
      op: 'reserve',
      capNanos: 300_000,
      dailyTurnMax: 0,
      dailyAttemptMax: 5000,
      reservationLeaseMs: 60_000,
      reservationId: reservationId(6),
      amountNanos: 1,
    });
    const zero = await operation(governor, {
      op: 'reserve',
      capNanos: 0,
      dailyTurnMax: 0,
      dailyAttemptMax: 5000,
      reservationLeaseMs: 60_000,
      reservationId: reservationId(7),
      amountNanos: 1,
    });
    const staleHigherCap = await operation(governor, {
      op: 'reserve',
      capNanos: 1_000_000,
      dailyTurnMax: 0,
      dailyAttemptMax: 5000,
      reservationLeaseMs: 60_000,
      reservationId: reservationId(71),
      amountNanos: 1,
    });
    check(!lowered.accepted && lowered.reason === 'day_cap_exhausted' && lowered.budget.blocked
      && !zero.accepted && zero.reason === 'day_cap_zero' && zero.budget.blocked
      && !staleHigherCap.accepted && staleHigherCap.reason === 'day_cap_zero'
      && staleHigherCap.budget.dayCapUsd === 0,
    'midday reductions are sticky so cap=0 cannot be reopened by a stale Worker');
  }

  {
    const { governor } = makeGovernor();
    const policy = { capNanos: 2_000_000, dailyTurnMax: 1, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const firstId = reservationId(8);
    await operation(governor, { op: 'reserve', ...policy, reservationId: firstId, amountNanos: 500_000 });
    const whileReserved = await operation(governor, {
      op: 'reserve',
      ...policy,
      reservationId: reservationId(9),
      amountNanos: 500_000,
    });
    await operation(governor, { op: 'release', ...policy, reservationId: firstId });
    const completedId = reservationId(10);
    await operation(governor, { op: 'reserve', ...policy, reservationId: completedId, amountNanos: 500_000 });
    await operation(governor, { op: 'settle', ...policy, reservationId: completedId, actualNanos: 200_000 });
    const afterTurn = await operation(governor, {
      op: 'reserve',
      capNanos: policy.capNanos,
      dailyTurnMax: 0,
      dailyAttemptMax: 5000,
      reservationLeaseMs: 60_000,
      reservationId: reservationId(11),
      amountNanos: 500_000,
    });
    check(!whileReserved.accepted && whileReserved.reason === 'daily_turn_max'
      && !afterTurn.accepted && afterTurn.reason === 'daily_turn_max'
      && afterTurn.budget.turnsToday === 1,
    'daily turn max counts in-flight/settled turns and cannot be relaxed by a stale Worker');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    let providerCalls = 0;
    const failure = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: false, reason: 'provider_http_error' };
      },
    });
    const timeout = await runBudgetedNpcCall({
      env,
      role: 'ambient',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      },
    });
    const status = await npcBudgetStatus(env, true);
    check(providerCalls === 2 && !failure.ok && !timeout.ok
      && failure.budget.reservedUsd === 0 && timeout.budget.reservedUsd === 0
      && status.spentUsd === 0 && status.reservedUsd === 0
      && status.turnsToday === 0 && status.reservedTurns === 0,
    'provider failure and timeout always release their reservations');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    env.NPC_DAILY_ATTEMPT_MAX = '2';
    let providerCalls = 0;
    const fail = () => runBudgetedNpcCall({
      env,
      role: 'ambient',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: false, reason: 'provider_http_error' };
      },
    });
    await fail();
    await fail();
    const blocked = await fail();
    const status = await npcBudgetStatus(env, true);
    const reservationKeys = [...governor.state.storage.values.keys()]
      .filter((key) => key.startsWith('reservation:'));
    check(providerCalls === 2 && !blocked.ok && blocked.reason === 'daily_attempt_max'
      && status.attemptsToday === 2 && status.dailyAttemptMax === 2
      && status.blocked && reservationKeys.length === 0,
    'failed providers have bounded daily attempts and leave no persistent reservation tombstones');
  }

  {
    const { governor, nowRef } = makeGovernor();
    const policy = { capNanos: 1_000_000, dailyTurnMax: 0, dailyAttemptMax: 5000, reservationLeaseMs: 60_000 };
    const id = reservationId(12);
    await operation(governor, { op: 'reserve', ...policy, reservationId: id, amountNanos: 500_000 });
    nowRef.value += 60_001;
    await governor.alarm();
    const afterAlarm = await operation(governor, { op: 'status', ...policy });
    const settledRecord = await governor.state.storage.get(`reservation:${id}`);
    nowRef.value = Date.parse('2026-07-31T00:00:01Z');
    await operation(governor, { op: 'status', ...policy });
    nowRef.value = Date.parse('2026-08-01T00:00:01Z');
    await operation(governor, { op: 'status', ...policy });
    const prunedRecord = await governor.state.storage.get(`reservation:${id}`);
    check(afterAlarm.budget.spentUsd === 0.0005 && afterAlarm.budget.reservedUsd === 0
      && afterAlarm.budget.turnsToday === 1 && settledRecord.status === 'settled'
      && settledRecord.expired && prunedRecord === undefined,
    'orphan leases full-settle by alarm and finalized tombstones prune after the retry window');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    const events = [];
    const success = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      emit: (name, meta) => events.push({ name, meta }),
      providerCall: async () => ({
        ok: true,
        text: 'hello',
        usage: {
          prompt_tokens: 100,
          prompt_tokens_details: { cached_tokens: 20 },
          completion_tokens: 50,
          total_tokens: 150,
        },
      }),
    });
    const serializedState = JSON.stringify([...governor.state.storage.values.entries()]);
    const serializedEvents = JSON.stringify(events);
    check(success.ok && success.costUsd === 0.0002865
      && success.budget.spentUsd === 0.0002865
      && success.budget.reservedUsd === 0
      && success.budget.remainingUsd === 0.9997135
      && success.budget.turnsToday === 1
      && success.budget.source === 'durable-object'
      && success.budget.durable === true
      && success.budget.enforcement === 'atomic_reservation',
    'npcBudget reports authoritative spent, reserved, remaining, and turn values');
    check(!serializedState.includes('unique hermetic visitor')
      && !serializedEvents.includes('unique hermetic visitor')
      && !serializedEvents.includes('reservationId')
      && events.every(({ name }) => ['npc_budget_reserve', 'npc_budget_settle', 'npc_budget_utc_reset'].includes(name)),
    'governor persistence and metrics contain no prompt, conversation, reservation ID, or personal data');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    const plan = createNpcCallPlan(env, 'player', MESSAGES);
    const billableEmpty = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => ({
        ok: false,
        billable: true,
        reason: 'provider_empty_response',
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110 },
      }),
    });
    const partialUsage = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => ({
        ok: true,
        text: 'partial usage',
        usage: { prompt_tokens: 100 },
      }),
    });
    check(!billableEmpty.ok && billableEmpty.costUsd >= 0.00012
      && billableEmpty.costUsd <= 0.000120001,
      'billable empty responses settle returned provider usage before fallback');
    check(partialUsage.ok && partialUsage.costUsd === plan.reservationNanos / 1_000_000_000,
      'partial provider usage settles the full conservative reservation');
    check(Math.abs(partialUsage.budget.spentUsd - billableEmpty.costUsd - partialUsage.costUsd) < 1e-12
      && partialUsage.budget.reservedUsd === 0,
    'billable fallback and partial usage remain reflected in authoritative budget totals');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    const plan = createNpcCallPlan(env, 'player', MESSAGES);
    env.NPC_DAY_CAP_USD = String(plan.reservationNanos / 1_000_000_000);
    let providerCalls = 0;
    const attempted = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: false, billable: true, reason: 'provider_http_error', usage: null };
      },
    });
    const blocked = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: true, text: 'must not run', usage: null };
      },
    });
    const status = await npcBudgetStatus(env, true);
    check(!attempted.ok && attempted.reason === 'provider_http_error'
      && attempted.costUsd === plan.reservationNanos / 1_000_000_000
      && !blocked.ok && blocked.reason === 'day_cap_exhausted'
      && providerCalls === 1
      && status.spentUsd === status.dayCapUsd && status.reservedUsd === 0
      && status.turnsToday === 1 && status.attemptsToday === 1
      && status.blocked && status.durable === true
      && status.enforcement === 'atomic_reservation',
    'a dispatched attempt with missing usage full-settles its conservative reservation and cannot overshoot or reopen the hard daily cap');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    const plan = createNpcCallPlan(env, 'player', MESSAGES);
    const malformed = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => ({
        ok: true,
        text: 'malformed usage',
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 999 },
      }),
    });
    const zeroOutput = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => ({
        ok: true,
        text: 'nonempty text requires output tokens',
        usage: { prompt_tokens: 100, completion_tokens: 0, total_tokens: 100 },
      }),
    });
    check(malformed.ok && malformed.costUsd === plan.reservationNanos / 1_000_000_000
      && zeroOutput.ok && zeroOutput.costUsd === plan.reservationNanos / 1_000_000_000
      && Math.abs(zeroOutput.budget.spentUsd - malformed.costUsd - zeroOutput.costUsd) < 1e-12,
    'zero/inconsistent usage and nonempty zero-output responses settle the full reservation');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    let dropped = false;
    env.NPC_BUDGET_GOVERNOR = {
      getByName() {
        return {
          async fetch(input, init) {
            const payload = JSON.parse(init.body);
            const response = await governor.fetch(new Request(input, init));
            if (payload.op === 'settle' && !dropped) {
              dropped = true;
              throw new Error('settle response lost');
            }
            return response;
          },
        };
      },
    };
    const retried = await runBudgetedNpcCall({
      env,
      role: 'ambient',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => ({
        ok: true,
        text: 'idempotent retry',
        usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
      }),
    });
    check(dropped && retried.ok && retried.costUsd > 0
      && retried.budget.turnsToday === 1 && retried.budget.reservedUsd === 0,
    'lost settlement responses retry with the same reservation and charge exactly once');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    const plan = createNpcCallPlan(env, 'ambient', MESSAGES);
    env.NPC_DAY_CAP_USD = String(plan.reservationNanos / 1_000_000_000 * 1.5);
    let providerCalls = 0;
    const calls = await Promise.all([
      runBudgetedNpcCall({
        env,
        role: 'ambient',
        messages: MESSAGES,
        enabled: true,
        providerCall: async () => {
          providerCalls += 1;
          return { ok: true, text: 'one', usage: null };
        },
      }),
      runBudgetedNpcCall({
        env,
        role: 'ambient',
        messages: MESSAGES,
        enabled: true,
        providerCall: async () => {
          providerCalls += 1;
          return { ok: true, text: 'two', usage: null };
        },
      }),
    ]);
    const status = await npcBudgetStatus(env, true);
    check(calls.filter((result) => result.ok).length === 1 && providerCalls === 1
      && status.spentUsd <= status.dayCapUsd && status.reservedUsd === 0,
    'simultaneous lifecycle calls invoke the provider only after an accepted worst-case reservation');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    env.NPC_DAY_CAP_USD = '0';
    let providerCalls = 0;
    const zeroCap = await runBudgetedNpcCall({
      env,
      role: 'ambient',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: true, text: 'must not run', usage: null };
      },
    });
    check(!zeroCap.ok && zeroCap.reason === 'day_cap_zero' && providerCalls === 0,
      'zero daily cap blocks the provider before invocation');
  }

  {
    const { governor } = makeGovernor();
    const env = baseEnv(governor);
    let providerCalls = 0;
    const disabled = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: false,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: true, text: 'must not run', usage: null };
      },
    });
    env.NPC_MODEL_DEFAULT = 'unpriced-deployment-alias';
    const unpriced = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: true, text: 'must not run', usage: null };
      },
    });
    check(!disabled.ok && disabled.reason === 'npc_ai_disabled'
      && !unpriced.ok && unpriced.reason === 'npc_pricing_unavailable'
      && unpriced.budget.available && providerCalls === 0,
    'kill switch and unknown model pricing both refuse before provider invocation');
    env.NPC_MODEL_DEFAULT = 'gpt-5.4-mini';
    env.NPC_MODEL_PRICING_JSON = JSON.stringify({
      'gpt-5.4-mini': {
        inputPer1MUsd: 0.75,
        cachedInputPer1MUsd: null,
        outputPer1MUsd: 4.5,
        maxInputTokens: 272_000,
        maxOutputTokens: 128_000,
      },
    });
    const malformedPrice = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: true, text: 'must not run', usage: null };
      },
    });
    check(!malformedPrice.ok && malformedPrice.reason === 'npc_pricing_invalid'
      && providerCalls === 0,
    'malformed cached-input pricing fails closed rather than becoming free');
    env.NPC_MODEL_PRICING_JSON = JSON.stringify({
      'gpt-5.4-mini': {
        inputPer1MUsd: 0.75,
        cachedInputPer1MUsd: 0.075,
        outputPer1MUsd: 4.5,
      },
    });
    const missingBounds = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: true, text: 'must not run', usage: null };
      },
    });
    check(!missingBounds.ok && missingBounds.reason === 'npc_model_bounds_invalid'
      && providerCalls === 0,
    'pricing entries without official model input/output bounds fail closed');
  }

  {
    const { governor } = makeGovernor();
    const env = { ...baseEnv(governor) };
    delete env.NPC_BUDGET_GOVERNOR;
    let providerCalls = 0;
    const unavailable = await runBudgetedNpcCall({
      env,
      role: 'player',
      messages: MESSAGES,
      enabled: true,
      providerCall: async () => {
        providerCalls += 1;
        return { ok: true, text: 'must not run', usage: null };
      },
    });
    check(!unavailable.ok && unavailable.reason === 'npc_budget_governor_unavailable'
      && unavailable.budget.available === false && unavailable.budget.blocked
      && unavailable.budget.source === 'durable-object'
      && unavailable.budget.durable === true
      && unavailable.budget.enforcement === 'atomic_reservation'
      && providerCalls === 0,
    'missing Durable Object binding retains the durable atomic contract and fails closed before any provider call');
  }
}
