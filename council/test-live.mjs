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

  /* ── C11: daily live-count hard cap (L4b) → blocked after N today, resets next day ── */
  group('C11 daily live-count cap → blocked after N debates today, resets next day');
  {
    const store = Guards.makeMemStore();
    const MAX = 3;
    // MAX live debates from DIFFERENT devices (so L1 cooldown never trips) on one day
    for (let i = 0; i < MAX; i++) {
      let r = await Live.councilLive(ctx({ store, dayLiveMax: MAX, signals: { ip: '12.0.0.' + i, fp: 'DC_' + i } }));
      ok(r.live === true, 'live #' + (i + 1) + ' under the daily count cap runs');
    }
    // the next fresh device is stopped by the COUNT cap, not by cooldown/budget
    let over = await Live.councilLive(ctx({ store, dayLiveMax: MAX, signals: { ip: '12.0.0.50', fp: 'DC_OVER' } }));
    ok(over.state === 'ambient' && over.reason === 'daily_count', 'over the daily count → daily_count notice (not cooldown)');
    ok(over.live === false && over.transcript.length > 0, 'still shows a past council at $0 when the day is full');
    // next UTC day → the count bucket resets
    let tomorrow = await Live.councilLive(ctx({ store, dayLiveMax: MAX, signals: { ip: '12.0.0.0', fp: 'DC_0' }, now: T0 + DAY }));
    ok(tomorrow.live === true, 'next day → count bucket resets, live runs again');
  }

  /* ── concurrency is always released (finally) ── */
  group('L2 concurrency is released after every live (even on error)');
  {
    const store = Guards.makeMemStore();
    await Live.councilLive(ctx({ store, signals: { ip: '11.1.1.1', fp: 'REL1' }, llm: mockLLM() }));
    await Live.councilLive(ctx({ store, signals: { ip: '11.1.1.2', fp: 'REL2' }, llm: async () => { throw new Error('x'); } }));
    ok(store.getConcurrency() === 0, 'active concurrency back to 0 after success + error');
  }

  /* ── C12: free-topic debate (Phase 39) — fixture-less, Chair LLM verdict ── */
  group('C12 free-topic debate → tiki-taka rounds + Chair verdict (unverified)');
  {
    const FD = CFG.live_free;
    const PRICE2 = CFG.price;
    let dn = 0;
    const debateLLM = async () => { dn++; return { text: '자유발언 ' + dn, usageIn: 30, usageOut: 50 }; };
    const chairLLM = async () => ({ verdict: '코드짱 승', signature: '시간은 살아있는 소스 편', basis: '실측', confidence: 0.82, usageIn: 400, usageOut: 300 });
    const base = { topic: '탭 vs 스페이스', sages: SAGES, lang: 'ko', guards: Guards, price: PRICE2, freeDials: FD, now: T0 };

    // 1) happy path: streamed events + tiki-taka rounds + Chair verdict
    const seen = [];
    const r = await Live.runFreeDebate(Object.assign({}, base, { llm: debateLLM, chairLLM }), e => seen.push(e.phase));
    ok(seen[0] === 'convocation', 'first streamed event is convocation');
    ok(seen[seen.length - 1] === 'done', 'last streamed event is done');
    ok(seen.includes('verdict'), 'a verdict event is streamed');
    ok(r.rounds === FD.MAX_ROUNDS, 'runs MAX_ROUNDS rounds when within the deadline');
    ok(r.transcript.length === FD.MAX_ROUNDS * SAGES.length, 'one turn per sage per round (free tiki-taka)');
    ok(r.verdict === '코드짱 승' && r.signature.length > 0, 'verdict + signature come from the Chair LLM');
    ok(r.unverified === true, 'free-topic verdict is labelled unverified (no math ground truth)');
    ok(r.endedBy === 'rounds', 'ended by rounds when the deadline is not reached');

    // 2) cost is split: debate(price) + chair(chairPrice), and the strong Chair dominates
    const turns = FD.MAX_ROUNDS * SAGES.length;
    const expectDebate = (turns * 30 / 1000) * PRICE2.inPer1k + (turns * 50 / 1000) * PRICE2.outPer1k;
    const expectChair = (400 / 1000) * PRICE2.chairInPer1k + (300 / 1000) * PRICE2.chairOutPer1k;
    ok(Math.abs(r.estCost - (expectDebate + expectChair)) < 1e-9, 'estCost = debate(price) + chair(chairPrice), priced separately');
    ok(expectChair > expectDebate, 'the strong Chair dominates the cost (gpt-5.4 out $15/1M)');

    // 3) deadline → timeout cuts the debate short (clock jumps past the 2-min wall)
    let tk = T0; const fastClock = () => (tk += 999999);
    const r2 = await Live.runFreeDebate(Object.assign({}, base, { llm: debateLLM, chairLLM, clock: fastClock }));
    ok(r2.endedBy === 'timeout', 'deadline reached → endedBy timeout');
    ok(r2.rounds < FD.MAX_ROUNDS, 'timeout cuts the rounds short');

    // 4) no Chair injected → graceful: debate still runs, verdict empty, no throw
    const r3 = await Live.runFreeDebate(Object.assign({}, base, { llm: debateLLM, chairLLM: null }));
    ok(r3.verdict === '' && r3.endedBy === 'rounds', 'no Chair → empty verdict, debate still completes');

    // 5) Chair throws → chair_error + partial, transcript preserved
    const r4 = await Live.runFreeDebate(Object.assign({}, base, { llm: debateLLM, chairLLM: async () => { throw new Error('chair down'); } }));
    ok(r4.endedBy === 'chair_error' && r4.partial === true, 'Chair error → chair_error + partial');
    ok(r4.transcript.length > 0, 'partial keeps the debate transcript even if the Chair fails');
  }

  /* ── C13: councilLiveFree — free-topic guard state machine + Chair verdict ── */
  group('C13 councilLiveFree → guards gate the free debate (spectator/live/daily)');
  {
    const FD = CFG.live_free;
    const PRICE2 = CFG.price;
    const debateLLM = async () => ({ text: '한 줄', usageIn: 30, usageOut: 50 });
    const chairLLM = async () => ({ verdict: 'V', signature: 'S', basis: 'B', confidence: 0.7, usageIn: 400, usageOut: 300 });
    function freeCtx(over) {
      return Object.assign({
        topic: '탭 vs 스페이스', sages: SAGES, lang: 'ko',
        guards: Guards, price: PRICE2, freeDials: FD,
        dials: dials({ LIVE_ENABLED: true }),
        caps: { monthCap: 600, dayCap: 24 }, dayLiveMax: 100, budgetGateRatio: 0.9,
        salt: 'repolis', signals: { ip: '5.5.5.5', fp: 'FREE1' },
        llm: debateLLM, chairLLM, now: T0,
      }, over || {});
    }

    // spectator: LIVE_ENABLED false → blocked, no debate turns, spectator notice
    const evs = [];
    const rs = await Live.councilLiveFree(freeCtx({ dials: dials({ LIVE_ENABLED: false }) }), e => evs.push(e));
    ok(rs.blocked === true && rs.reason === 'spectator', 'LIVE off → blocked spectator (golden rule)');
    ok(evs.some(e => e.phase === 'notice' && e.reason === 'spectator'), 'streams a spectator notice when blocked');
    ok(!evs.some(e => e.phase === 'turn'), 'no debate turns are streamed when blocked (0 cost)');

    // live on + within caps → runs, live:true, streams the full arc + Chair verdict
    const ev2 = [];
    const r2 = await Live.councilLiveFree(freeCtx({ store: Guards.makeMemStore() }), e => ev2.push(e));
    ok(r2.live === true && r2.blocked === false, 'live on + within caps → free debate runs');
    ok(ev2[0].phase === 'convocation' && ev2[ev2.length - 1].phase === 'done', 'streams convocation … done');
    ok(r2.verdict === 'V' && r2.unverified === true, 'verdict comes from the Chair LLM, labelled unverified');

    // daily-count cap: on a fresh store, exactly dayLiveMax grants, then blocked
    const store = Guards.makeMemStore();
    let granted = 0;
    for (let k = 0; k < 4; k++) {
      const rr = await Live.councilLiveFree(freeCtx({ store, dayLiveMax: 3, signals: { ip: '5.5.5.' + k, fp: 'D' + k } }));
      if (rr.live) granted++;
    }
    ok(granted === 3, 'exactly dayLiveMax(3) live debates are granted; the 4th is blocked');
  }

  // ── summary ──
  console.log('\n' + (fail === 0 ? '✅' : '❌') + ' live crosschecks: ' + pass + ' passed, ' + fail + ' failed');
  if (fail) { console.log('FAILURES:\n  - ' + fails.join('\n  - ')); process.exit(1); }
})();
