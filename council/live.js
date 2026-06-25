/*
 * council/live.js — Chronopolis Live debate state machine + scaffold (SPEC §G, §M, §K).
 *
 * THE GOLDEN RULE (SPEC §V): the money-spending Live LLM path only runs when
 * BOTH (a) dials.LIVE_ENABLED is true AND (b) a real `llm` client is injected.
 * Otherwise this module silently falls back to the deterministic Ambient
 * transcript from council/engine.js at ZERO cost. The final verdict is ALWAYS
 * produced by the core engine, independent of whatever the debate says — "the
 * debate is theatre, the verdict is math."
 *
 * State machine (§M):
 *   AMBIENT → BUDGET(L4) → RATE(L1) → CONCURRENCY(L2) → LIVE → VERDICT → AMBIENT
 *   (L3 burst is checked per-request up front.) Any failed check returns to
 *   AMBIENT with a soft §K notice — never an error screen.
 *
 * Pure-ish + deterministic: inject `store`, `now`, `clock`, `llm`, `engine`,
 * `guards` so the whole thing is unit-testable with no real clock/network/LLM
 * (see council/test-live.mjs, C1–C10).
 */
(function () {
  'use strict';

  function req(name) { try { return require(name); } catch (e) { return null; } }
  var E_default = (typeof globalThis !== 'undefined' && globalThis.CouncilEngine) || req('./engine.js');
  var G_default = (typeof globalThis !== 'undefined' && globalThis.CouncilGuards) || req('./guards.js');

  // ---- §K reject notices (always route the user back to Ambient) -------------
  var NOTICES = {
    spectator: {
      ko: '지금은 구경 모드예요 👀 지난 명회의들을 감상하세요 — 라이브 토론은 곧 열립니다.',
      en: "Spectator mode for now 👀 Enjoy past councils — live debate opens soon.",
    },
    cooldown: {
      ko: function (x) { return '다음 회의 소집까지 ' + fmtMin(x && x.retryAfter) + '. 그동안 지난 명회의를 구경하세요 👀'; },
      en: function (x) { return 'Next council in ' + fmtMin(x && x.retryAfter, 'en') + '. Enjoy past councils meanwhile 👀'; },
    },
    full: {
      ko: '지금 회의장이 만석이에요. 곧 자리가 나요 — 구경하며 기다려 주세요 👀',
      en: "The chamber is full right now. A seat will open soon — watch while you wait 👀",
    },
    budget: {
      ko: '오늘 회의 정원이 모두 찼어요. 지난 명회의들을 감상하세요 👀',
      en: "Today's councils are all booked. Enjoy past councils 👀",
    },
    burst: {
      ko: '잠시 후 다시 시도해 주세요. 그동안 명회의를 구경할 수 있어요 👀',
      en: 'Please try again shortly — you can watch past councils meanwhile 👀',
    },
  };
  function fmtMin(sec, lang) {
    if (!sec || sec < 0) return lang === 'en' ? 'a moment' : '잠시';
    var m = Math.ceil(sec / 60);
    return lang === 'en' ? (m + (m === 1 ? ' minute' : ' minutes')) : (m + '분');
  }
  function noticeFor(reason, lang, extra) {
    var n = NOTICES[reason]; if (!n) return '';
    var v = n[lang === 'en' ? 'en' : 'ko'];
    return typeof v === 'function' ? v(extra) : v;
  }

  // ---- build an Ambient (deterministic, 0-cost) result -----------------------
  function ambient(ctx, reason, extra) {
    var engine = ctx.engine || E_default;
    var core = engine.councilAsk(ctx.fixture, { withTranscript: true, lang: ctx.lang });
    return {
      state: 'ambient',
      live: false,
      reason: reason || 'ambient',
      notice: reason ? noticeFor(reason, ctx.lang, extra) : '',
      transcript: core.transcript || [],
      verdict: core.summary,
      signature: core.signature,
      result: core,
      cost: 0,
    };
  }

  // ---- persona + grounding prompts (used ONLY on the real LLM path) -----------
  function personaSystem(sage, lang, ground) {
    var v = (sage.voice && sage.voice[lang === 'en' ? 'en' : 'ko']) || {};
    var tone = v.tone || '';
    var tics = (v.tics || []).join(' / ');
    // Source-grounding (§G "출처 강제"): the sage may only speak within its own
    // claim — it cannot invent a different value. The verdict is decided by the
    // core engine regardless, so this just keeps the *theatre* on-script.
    var scope = ground
      ? (lang === 'en'
          ? 'You may ONLY argue for "' + ground.value + '" (your source, dated ' + (ground.date || '?') + '). Never cite any other value.'
          : '너는 오직 "' + ground.value + '"만 주장한다(네 출처, ' + (ground.date || '?') + ' 기준). 다른 값은 절대 언급하지 마라.')
      : '';
    return [tone, tics ? ('말버릇: ' + tics) : '', scope,
      (lang === 'en' ? 'One short spoken line, in character. No markdown.' : '한 문장, 캐릭터 말투로. 마크다운 금지.')]
      .filter(Boolean).join('\n');
  }
  function testimonyPrompt(fixture, sage, ground, lang) {
    var q = (fixture.question && (fixture.question[lang] || fixture.question.ko)) || fixture.id;
    return (lang === 'en' ? 'Question: ' : '질문: ') + q;
  }
  function clampText(s, maxChars) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    var m = maxChars || 140;
    return s.length > m ? s.slice(0, m - 1) + '…' : s;
  }

  // ---- the Live debate itself (real LLM path; deterministic when llm is null) -
  // Returns chamber events + token/cost accounting + how it ended. The verdict is
  // NOT decided here — the caller always overrides it with the core engine.
  async function runDebate(ctx, hardCap) {
    var engine = ctx.engine || E_default;
    var guards = ctx.guards || G_default;
    var lang = ctx.lang;

    // Deterministic fallback: no llm injected (this session) → core transcript, $0.
    if (!ctx.llm) {
      var core = engine.councilAsk(ctx.fixture, { withTranscript: true, lang: lang });
      return { events: core.transcript || [], endedBy: 'deterministic', rounds: 0, tokensIn: 0, tokensOut: 0, estCost: 0, partial: false };
    }

    // ---- real LLM debate (only reached when LIVE_ENABLED && llm present) ------
    var dials = ctx.dials || {};
    var sages = ctx.sages || [];
    var clock = ctx.clock || function () { return Date.now(); };
    var startedAt = (ctx.now != null ? ctx.now : clock());
    var deadline = startedAt + (dials.DEBATE_TIMEOUT_SEC || 180) * 1000;
    var maxTurnTokens = dials.TOKENS_PER_TURN_MAX || 160;
    var crossRounds = dials.CROSS_ROUNDS_MAX || 2;

    var events = [];
    var tokensIn = 0, tokensOut = 0;
    var endedBy = 'consensus';
    var rounds = 0;

    var claims = engine._internal.extractClaims(ctx.fixture);
    var byId = {}; claims.forEach(function (c) { byId[c.sage] = c; });

    async function speak(sage) {
      var ground = byId[sage.id];
      var turn = await ctx.llm({
        system: personaSystem(sage, lang, ground),
        user: testimonyPrompt(ctx.fixture, sage, ground, lang),
        maxTokens: maxTurnTokens,
        signal: ctx.signal,
      });
      tokensIn += (turn && turn.usageIn) || 0;
      tokensOut += (turn && turn.usageOut) || 0;
      return { text: clampText(turn && turn.text, 140), ground: ground };
    }

    try {
      // 1. CONVOCATION
      events.push({ phase: 'convocation', question: testimonyPrompt(ctx.fixture, null, null, lang).replace(/^.*?: /, ''), summoned: sages.map(function (s) { return s.id; }) });
      // 2. TESTIMONY (sequential so we can honour the deadline + token budget)
      for (var i = 0; i < sages.length; i++) {
        if (clock() > deadline) { endedBy = 'timeout'; break; }
        var t = await speak(sages[i]);
        events.push({ phase: 'testimony', sage: sages[i].id, text: t.text, claim: t.ground ? t.ground.value : null, date: t.ground ? t.ground.date : null });
      }
      // 3. CROSS-EXAMINATION — only on real conflict, bounded by CROSS_ROUNDS_MAX
      var conflict = engine._internal.hasConflict(claims);
      if (conflict && endedBy !== 'timeout') {
        var live = sages.filter(function (s) { return s.source_type === 'live_source'; })[0] || sages[0];
        for (var r = 0; r < crossRounds; r++) {
          if (clock() > deadline) { endedBy = 'timeout'; break; }
          var c = await speak(live);
          events.push({ phase: 'cross', challenger: live.id, text: c.text, round: r + 1 });
          rounds = r + 1;
          endedBy = (r + 1 >= crossRounds) ? 'rounds' : 'consensus';
        }
      }
    } catch (e) {
      // C10: provider error/timeout → keep the partial transcript; the core
      // verdict still finishes downstream, and cost is whatever we burned.
      endedBy = 'error';
    }

    var estCost = guards.estimateCost(tokensIn, tokensOut, ctx.price);
    // never let a runaway debate exceed the L5 hard cap estimate
    if (hardCap && estCost > hardCap.estCost) estCost = hardCap.estCost;
    return { events: events, endedBy: endedBy, rounds: rounds, tokensIn: tokensIn, tokensOut: tokensOut, estCost: estCost, partial: endedBy === 'error' || endedBy === 'timeout' };
  }

  // ---- the state machine (§M) -----------------------------------------------
  // ctx: { fixture, sages, dials, lang, now, signals, store, salt, caps, price,
  //        budgetGateRatio, llm, engine, guards, clock, signal }
  async function councilLive(ctx) {
    var guards = ctx.guards || G_default;
    var engine = ctx.engine || E_default;
    ctx.engine = engine; ctx.guards = guards;
    var dials = ctx.dials || {};
    var store = ctx.store || guards.makeMemStore();
    var now = (ctx.now != null ? ctx.now : Date.now());
    var sages = ctx.sages || [];

    // 0. KILLSWITCH / LIVE_ENABLED — the whole town stays Ambient, 0 cost.
    if (!dials.LIVE_ENABLED) return ambient(ctx, 'spectator');

    // L3 burst guard (per request, before we spend anything)
    var ipC = guards.coarseIp(ctx.signals && ctx.signals.ip);
    var burst = guards.checkBurst(store, ipC, now, dials.BURST_THRESHOLD_PER_MIN || 20, 60);
    if (!burst.ok) return ambient(ctx, 'burst', burst);

    // L5 hard cap → price the next debate, then L4 budget gate (the last wall)
    var hardCap = guards.debateHardCap(dials, sages.length, ctx.price);
    var bud = guards.checkBudget(store, hardCap.estCost, ctx.caps, ctx.budgetGateRatio, now);
    if (!bud.ok) return ambient(ctx, 'budget', bud);

    // L1 personal rate-limit
    var key = guards.compositeKey(ctx.signals, ctx.salt);
    var rate = guards.checkRate(store, key, now, dials.PERSONAL_COOLDOWN_SEC || 3600);
    if (!rate.ok) return ambient(ctx, 'cooldown', rate);

    // L2 concurrency (atomic acquire)
    var conc = guards.acquireConcurrency(store, dials.LIVE_CONCURRENCY_MAX || 3);
    if (!conc.ok) return ambient(ctx, 'full', conc);

    // ---- LIVE ----
    try {
      guards.recordLive(store, key, now);
      var debate = await runDebate(ctx, hardCap);
      // VERDICT is ALWAYS the core engine's, independent of the debate (§G).
      var core = engine.councilAsk(ctx.fixture, { withTranscript: true, lang: ctx.lang });
      guards.recordSpend(store, debate.estCost, now);
      return {
        state: 'verdict',
        live: true,
        endedBy: debate.endedBy,
        rounds: debate.rounds,
        tokensIn: debate.tokensIn,
        tokensOut: debate.tokensOut,
        cost: debate.estCost,
        partial: debate.partial,
        // show the live theatre if we produced any, else the deterministic record
        transcript: (debate.events && debate.events.length) ? debate.events : (core.transcript || []),
        verdict: core.summary,
        signature: core.signature,
        result: core,
        log: observeLog(ctx, debate, core, now),
      };
    } finally {
      guards.releaseConcurrency(store);
    }
  }

  // ---- §Q observability: one append-only structured line per Live -----------
  function observeLog(ctx, debate, core, now) {
    var guards = ctx.guards || G_default;
    return {
      ts: now,
      key_hash: guards.compositeKey(ctx.signals, ctx.salt),
      ip_coarse: guards.coarseIp(ctx.signals && ctx.signals.ip),
      topic: ctx.fixture && ctx.fixture.id,
      rounds: debate.rounds,
      tokens_in: debate.tokensIn,
      tokens_out: debate.tokensOut,
      est_cost: debate.estCost,
      model_used: (ctx.dials && ctx.dials.LIVE_ENABLED && ctx.llm) ? ((ctx.models && ctx.models.debate) || 'debate') : null,
      verdict_summary: core.summary,
      overrode_majority: !!(core.conflicts && core.conflicts[0] && core.conflicts[0].overrode_majority),
      ended_by: debate.endedBy,
    };
  }

  var mod = {
    councilLive: councilLive,
    runDebate: runDebate,
    ambient: ambient,
    noticeFor: noticeFor,
    NOTICES: NOTICES,
    personaSystem: personaSystem,
    _internal: { observeLog: observeLog, clampText: clampText, fmtMin: fmtMin },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof globalThis !== 'undefined') globalThis.CouncilLive = mod;
})();
