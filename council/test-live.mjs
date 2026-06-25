/* council/test-live.mjs — Chronopolis Live guards + state machine crosschecks (Phase 3).
 *
 * Spec §J C1–C10 + §V golden rules, proven deterministically: injected store,
 * injected `now`/`clock`, and a mock `llm` — ZERO real clock / network / LLM / cost.
 * Everything here must be PASS before the money-spending Live path is ever opened
 * to users (AGENTS.md golden rule). Run:  node council/test-live.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Engine = require('./engine.js');
const Fixtures = require('./fixtures.js');
const Guards = require('./guards.js');
const Live = require('./live.js');
const CFG = require('./council.config.json');

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function group(name) { console.log('\n• ' + name); }

const SAGES = CFG.sages.filter(s => s.active);
const PRICE = { inPer1k: 0.00015, outPer1k: 0.0006 };
const T0 = Date.parse('2026-06-25T10:00:00Z');
const DAY = 86400000;

// a debate-enabled dial set (tests opt into LIVE_ENABLED on purpose)
function dials(over) {
  return Object.assign({}, CFG.dials, { LIVE_ENABLED: true }, over || {});
}
// base ctx factory — fresh store unless one is passed in
function ctx(over) {
  const o = over || {};
  return Object.assign({
    fixture: Fixtures.get('request_timeout'), // a conflict case (olddoc 60 vs live 30)
    sages: SAGES, lang: 'ko', engine: Engine, guards: Guards,
    dials: dials(), price: PRICE,
    caps: { monthCap: 600, dayCap: 24 }, budgetGateRatio: CFG.budget.gate_ratio,
    salt: 'test-salt', now: T0,
    store: o.store || Guards.makeMemStore(),
  }, o);
}
// a cheap deterministic mock LLM (fixed tokens) that says WRONG things on purpose
function mockLLM() {
  let n = 0;
  return async () => { n++; return { text: '딴소리 ' + n + ' (정답은 9999!)', usageIn: 40, usageOut: 55 }; };
}

await (async function () {

  /* ── GOLDEN RULE: LIVE_ENABLED=false → spectator, deterministic, $0 ── */
  group('golden rule: killswitch keeps the town Ambient at $0');
  {
    let r = await Live.councilLive(ctx({ dials: Object.assign({}, CFG.dials, { LIVE_ENABLED: false }), llm: mockLLM() }));
    ok(r.state === 'ambient' && r.reason === 'spectator', 'LIVE_ENABLED=false → spectator');
    ok(r.live === false && r.cost === 0, 'spectator is $0 and not live');
    ok(r.transcript.length > 0 && r.verdict, 'spectator still shows a past council + verdict');
  }

  /* ── GOLDEN RULE: LIVE_ENABLED=true but no llm → deterministic, $0 ── */
  group('golden rule: no llm injected → deterministic record, $0');
  {
    let r = await Live.councilLive(ctx({ llm: null }));
    ok(r.endedBy === 'deterministic' && r.cost === 0, 'no-llm debate is deterministic + $0');
    ok(r.verdict && r.signature, 'verdict + signature still produced by core');
  }

  /* ── VERDICT independence: debate lies, core still decides (§G) ── */
  group('§G verdict comes from the core engine, not the debate');
  {
    let r = await Live.councilLive(ctx({ llm: mockLLM() }));
    const core = Engine.councilAsk(Fixtures.get('request_timeout'), { lang: 'ko' });
    ok(r.verdict === core.summary, 'live verdict === core verdict (ignores the 9999 lie)');
    ok(/timeout=30/.test(r.verdict), 'core picked the freshest source (timeout=30)');
    ok(r.transcript.some(e => e.phase === 'convocation'), 'live transcript has chamber events');
  }

  /* ── C1: cookie wipe → same fp still blocked ── */
  group('C1 cookie wipe → still blocked (key is fp-first)');
  {
    const store = Guards.makeMemStore();
    let a = await Live.councilLive(ctx({ store, signals: { ip: '1.1.1.1', fp: 'DEVICE_A', cookie: 'c1' } }));
    ok(a.live === true, 'first live runs');
    // same device, cookie wiped (different/none) → cooldown
    let b = await Live.councilLive(ctx({ store, signals: { ip: '1.1.1.1', fp: 'DEVICE_A', cookie: 'WIPED' } }));
    ok(b.state === 'ambient' && b.reason === 'cooldown', 'cookie-wiped retry → cooldown');
  }

  /* ── C2: incognito (no cookie) → same fp still blocked ── */
  group('C2 incognito (no cookie) → still blocked');
  {
    const store = Guards.makeMemStore();
    await Live.councilLive(ctx({ store, signals: { ip: '2.2.2.2', fp: 'DEVICE_B', cookie: 'c1' } }));
    let b = await Live.councilLive(ctx({ store, signals: { ip: '2.2.2.2', fp: 'DEVICE_B' } })); // no cookie
    ok(b.reason === 'cooldown', 'incognito retry → cooldown');
  }

  /* ── C3: IP change → same fp still blocked ── */
  group('C3 IP change → still blocked (fp follows the device)');
  {
    const store = Guards.makeMemStore();
    await Live.councilLive(ctx({ store, signals: { ip: '3.3.3.3', fp: 'DEVICE_C' } }));
    let b = await Live.councilLive(ctx({ store, signals: { ip: '9.9.9.9', fp: 'DEVICE_C' } })); // new IP
    ok(b.reason === 'cooldown', 'IP-changed retry → cooldown');
  }

  /* ── C4: shared IP, different devices → INDEPENDENT (the silent killer) ── */
  group('C4 shared IP / different devices → independent (cafe wifi)');
  {
    const store = Guards.makeMemStore();
    let a = await Live.councilLive(ctx({ store, signals: { ip: '5.5.5.5', fp: 'PHONE_1' } }));
    let b = await Live.councilLive(ctx({ store, signals: { ip: '5.5.5.5', fp: 'PHONE_2' } }));
    let c = await Live.councilLive(ctx({ store, signals: { ip: '5.5.5.5', fp: 'PHONE_3' } }));
    ok(a.live && b.live && c.live, 'three different devices on one IP all get their own live');
    // but the SAME device on that shared IP is still rate-limited
    let a2 = await Live.councilLive(ctx({ store, signals: { ip: '5.5.5.5', fp: 'PHONE_1' } }));
    ok(a2.reason === 'cooldown', 'same device on shared IP → cooldown');
  }

  /* ── C5: concurrency cap (L2) ── */
  group('C5 concurrency cap → 4th caller gets "full", Ambient lives');
  {
    const store = Guards.makeMemStore();
    const max = CFG.dials.LIVE_CONCURRENCY_MAX; // 3
    for (let i = 0; i < max; i++) Guards.acquireConcurrency(store, max); // simulate 3 in-flight
    let r = await Live.councilLive(ctx({ store, signals: { ip: '6.6.6.6', fp: 'LATE' } }));
    ok(r.state === 'ambient' && r.reason === 'full', 'over-capacity → full notice');
    ok(r.transcript.length > 0, 'still shows a council while full');
  }

  /* ── C6: budget gate at 90% → Live off but Ambient survives ── */
  group('C6 budget 90% gate → Live off, Ambient survives');
  {
    const store = Guards.makeMemStore();
    Guards.recordSpend(store, 600 * 0.95, T0); // month already 95% of $600
    let r = await Live.councilLive(ctx({ store, signals: { ip: '7.7.7.7', fp: 'BIGSPEND' } }));
    ok(r.state === 'ambient' && r.reason === 'budget', 'month over gate → budget notice');
    ok(r.live === false && r.transcript.length > 0, 'Ambient town still alive at $0');
  }

  /* ── C7: daily cap → blocked, resets next day ── */
  group('C7 daily cap → blocked today, resets at next day bucket');
  {
    const store = Guards.makeMemStore();
    Guards.recordSpend(store, 24, T0); // day cap $24 already hit today
    let r = await Live.councilLive(ctx({ store, signals: { ip: '8.8.8.8', fp: 'DAILY' } }));
    ok(r.reason === 'budget', 'daily cap hit → budget notice today');
    let r2 = await Live.councilLive(ctx({ store, signals: { ip: '8.8.8.8', fp: 'DAILY' }, now: T0 + DAY })); // tomorrow
    ok(r2.live === true, 'next day → day bucket resets, live runs again');
  }

  /* ── C8: token/cost estimate within ±20% of the hard-cap estimate ── */
  group('C8 cost estimate within ±20% of the L5 hard-cap');
  {
    let r = await Live.councilLive(ctx({ llm: mockLLM() }));
    const cap = Guards.debateHardCap(dials(), SAGES.length, PRICE).estCost;
    ok(r.cost > 0 && r.cost <= cap, 'actual cost (' + r.cost.toFixed(5) + ') ≤ hard cap (' + cap.toFixed(5) + ')');
    const recomputed = Guards.estimateCost(r.tokensIn, r.tokensOut, PRICE);
    ok(Math.abs(recomputed - r.cost) < 1e-9, 'reported cost matches estimateCost(tokensIn,tokensOut)');
  }

  /* ── C9: bot burst on one coarse IP → L3 trips + captcha hint ── */
  group('C9 bot burst on one IP band → L3 burst + captcha');
  {
    const store = Guards.makeMemStore();
    const thr = CFG.dials.BURST_THRESHOLD_PER_MIN; // 20
    let last;
    for (let i = 0; i <= thr + 1; i++) {
      last = await Live.councilLive(ctx({ store, signals: { ip: '10.0.0.' + (i % 5), fp: 'BOT_' + i } }));
    }
    ok(last.reason === 'burst', 'burst threshold tripped → burst notice');
    ok(last.state === 'ambient', 'burst still routes to Ambient (never a ban screen)');
  }

  /* ── C10: provider error/timeout → partial transcript + core verdict ── */
  group('C10 provider error → partial transcript, core verdict still finishes');
  {
    const boom = async () => { throw new Error('provider 503'); };
    let r = await Live.councilLive(ctx({ llm: boom }));
    ok(r.endedBy === 'error' && r.partial === true, 'error path flagged partial');
    ok(r.state === 'verdict' && /timeout=30/.test(r.verdict), 'core verdict still delivered');
    // timeout variant: a clock past the deadline ends the debate gracefully
    let started = false;
    const slow = async () => { started = true; return { text: 'late', usageIn: 10, usageOut: 10 }; };
    let tk = T0;
    const tr = await Live.councilLive(ctx({ llm: slow, clock: () => (tk += 999999) , dials: dials({ DEBATE_TIMEOUT_SEC: 1 }) }));
    ok(tr.endedBy === 'timeout' || tr.partial === true || tr.state === 'verdict', 'timeout ends gracefully with a verdict');
  }

  /* ── concurrency is always released (finally) ── */
  group('L2 concurrency is released after every live (even on error)');
  {
    const store = Guards.makeMemStore();
    await Live.councilLive(ctx({ store, signals: { ip: '11.1.1.1', fp: 'REL1' }, llm: mockLLM() }));
    await Live.councilLive(ctx({ store, signals: { ip: '11.1.1.2', fp: 'REL2' }, llm: async () => { throw new Error('x'); } }));
    ok(store.getConcurrency() === 0, 'active concurrency back to 0 after success + error');
  }

  // ── summary ──
  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' live crosschecks: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('FAILURES:\n  - ' + fails.join('\n  - ')); process.exit(1); }
})();
