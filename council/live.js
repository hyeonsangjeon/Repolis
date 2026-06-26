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
    daily_count: {
      ko: '오늘 라이브 토론 정원이 모두 찼어요. 지난 명회의들을 감상하세요 👀',
      en: "Today's live debates are all used up. Enjoy past councils 👀",
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
  // ---- free-topic debate ROLES (Phase 40) ------------------------------------
  // The 7 curated fixtures use the doc/source/community personas above; FREE topics
  // instead assign each seat a general DEBATE ROLE so any subject — even a single
  // noun like "reasoning ratio" — gets a real advocate / skeptic / analyst clash.
  var FREE_ROLES = {
    olddoc: {
      ko: { stance: '신중한 회의주의 비판가', guide: '주제의 위험·함정·과장·반례를 파고든다. 근거 없는 낙관과 유행을 경계하며 "정말 그런가? 부작용·예외는?"을 끈질기게 따진다. 오래 지켜본 시니어의 보수적 시선으로 약점을 짚는다.' },
      en: { stance: 'cautious skeptic and critic', guide: 'Probe the risks, traps, hype and counter-examples. Distrust ungrounded optimism and fashion; keep asking "is that really so? what about the side-effects and edge cases?" Point at weaknesses with a seasoned senior\'s conservative eye.' }
    },
    livewire: {
      ko: { stance: '적극적인 옹호가', guide: '주제의 가능성·이점·실용적 가치를 구체적 근거를 들어 밀어붙인다. 새로운 시도에 열려 있고 "이래서 좋다, 이렇게 쓰면 된다"며 회의론에 맞선다. 자신만만한 실전파의 목소리.' },
      en: { stance: 'energetic advocate', guide: 'Push the upside, benefits and practical value with concrete reasons. Stay open to new ideas; answer skepticism with "here is why it works, here is how to use it." A confident hands-on builder.' }
    },
    hearsay: {
      ko: { stance: '균형잡힌 분석가', guide: '양쪽 주장을 인정하면서 맥락·조건·트레이드오프로 쟁점을 정리한다. "경우에 따라 다르다, 진짜 변수는 이것"이라며 감정보다 구조를 본다. 차분한 중재자.' },
      en: { stance: 'balanced analyst', guide: 'Acknowledge both sides and organize the issue by context, conditions and trade-offs. "It depends — the real variable is this." Sees structure over emotion; a calm mediator.' }
    },
    _default: {
      ko: { stance: '토론자', guide: '주제에 대해 네 관점에서 입장을 밝히고 앞 발언에 반응한다.' },
      en: { stance: 'panelist', guide: 'State your view on the topic and react to the others.' }
    }
  };

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
    // Deterministic-time rule: if a fixed `now` is injected (tests, replay) but no
    // explicit clock, pin the clock to that `now` so the deadline math is reproducible
    // regardless of wall-clock. Production injects neither → real Date.now() as before.
    var clock = ctx.clock || (ctx.now != null ? function () { return ctx.now; } : function () { return Date.now(); });
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

  // ---- free-topic Live debate (Phase 39): no fixture, no core-engine verdict ---
  // The 7 curated fixtures keep the deterministic core verdict (runDebate above).
  // A FREE topic has no ground truth, so each sage argues freely from persona with
  // the running transcript as context (real tiki-taka), bounded by a deadline +
  // MAX_ROUNDS; then the strong CHAIR LLM (gpt-5.4 + reasoning) delivers the verdict.
  // Because there is no math to fall back on, the verdict MUST be labelled
  // "AI inference · unverified". `onEvent(evt)` streams each event for live viewing;
  // it is optional — tests pass a collector, the worker pipes it to SSE.
  async function runFreeDebate(ctx, onEvent) {
    var guards = ctx.guards || G_default;
    var lang = ctx.lang === 'en' ? 'en' : 'ko';
    var sages = ctx.sages || [];
    var f = ctx.freeDials || {};
    var emit = (typeof onEvent === 'function') ? onEvent : function () {};
    var clock = ctx.clock || (ctx.now != null ? function () { return ctx.now; } : function () { return Date.now(); });
    var startedAt = (ctx.now != null ? ctx.now : clock());
    var deadline = startedAt + (f.DEBATE_TIMEOUT_SEC || 120) * 1000;
    var maxRounds = f.MAX_ROUNDS || 4;
    var maxTurnTokens = f.TOKENS_PER_TURN_MAX || 220;
    var topic = String(ctx.topic == null ? '' : ctx.topic).replace(/\s+/g, ' ').trim().slice(0, 300);

    var transcript = [];
    var events = [];
    var NAME_BY_ID = {};
    sages.forEach(function (s) { NAME_BY_ID[s.id] = { ko: s.nameKo || s.id, en: s.nameEn || s.id }; });
    var tokensIn = 0, tokensOut = 0, chairIn = 0, chairOut = 0;
    var endedBy = 'rounds', rounds = 0;
    function pushEvt(e) { events.push(e); try { emit(e); } catch (_) {} }

    function roleOf(sage) {
      var rr = (FREE_ROLES[sage.id] || FREE_ROLES._default);
      return rr[lang] || rr.ko;
    }
    function freePersona(sage) {
      var role = roleOf(sage);
      var nm = (lang === 'en' ? (sage.nameEn || sage.id) : (sage.nameKo || sage.id));
      if (lang === 'en') {
        return [
          'You are "' + nm + '", the ' + role.stance + ' on a 3-seat panel debating a free topic.',
          role.guide,
          'If the topic is a single word or bare concept (e.g. "reasoning ratio"), first frame what it means from your angle, then take your stance.',
          'Rules: speak ONE or TWO short spoken sentences, in your own natural voice. Name a previous speaker and react to them (agree, sharpen, or push back) once others have spoken. No markdown, no emoji, no quotation marks, no lists. You may be wrong — KRONOS the Chair weighs everyone at the end.'
        ].join('\n');
      }
      return [
        '너는 자유주제를 토론하는 3인 패널의 "' + nm + '" — ' + role.stance + '다.',
        role.guide,
        '주제가 한 단어나 개념이면(예: "reasoning ratio"), 먼저 그게 무엇을 뜻하는지 네 관점에서 한 번 짚고 입장을 밝혀라.',
        '규칙: 짧은 구어체 1~2문장. 네 고유한 말투로. 앞사람이 말했으면 그 사람 이름을 거론하며 반응해라(동의·날카롭게·반박). 마크다운·이모지·따옴표·목록 금지. 틀려도 된다 — 마지막에 의장 크로노스가 모두를 저울질한다.'
      ].join('\n');
    }
    function freePrompt(sage) {
      var nm = (lang === 'en' ? (sage.nameEn || sage.id) : (sage.nameKo || sage.id));
      var hist = transcript.slice(-8).map(function (t) {
        var who = (NAME_BY_ID[t.sage] && NAME_BY_ID[t.sage][lang]) || t.sage;
        return who + ': ' + t.text;
      }).join('\n');
      return (lang === 'en'
        ? 'Topic to debate: ' + topic + '\n\nDebate so far:\n' + (hist || '(you open the debate)') + '\n\nYour turn now, ' + nm + ':'
        : '토론 주제: ' + topic + '\n\n지금까지의 토론:\n' + (hist || '(네가 토론을 연다)') + '\n\n이제 ' + nm + ' 차례:');
    }
    async function speak(sage) {
      var turn = await ctx.llm({ system: freePersona(sage), user: freePrompt(sage), maxTokens: maxTurnTokens, signal: ctx.signal });
      tokensIn += (turn && turn.usageIn) || 0;
      tokensOut += (turn && turn.usageOut) || 0;
      var text = clampText(turn && turn.text, (f.CLAMP_CHARS || 280));
      transcript.push({ sage: sage.id, text: text });
      return text;
    }

    try {
      pushEvt({ phase: 'convocation', topic: topic, summoned: sages.map(function (s) { return s.id; }) });
      for (var r = 0; r < maxRounds; r++) {
        if (clock() > deadline) { endedBy = 'timeout'; break; }
        for (var i = 0; i < sages.length; i++) {
          if (clock() > deadline) { endedBy = 'timeout'; break; }
          var text = await speak(sages[i]);
          pushEvt({ phase: 'turn', round: r + 1, sage: sages[i].id, text: text });
        }
        rounds = r + 1;
      }
    } catch (e) {
      endedBy = 'error';
    }

    // VERDICT — strong Chair LLM (no math fallback for free topics → must be unverified-labelled)
    var verdict = '', signature = '', basis = '', confidence = null;
    if (ctx.chairLLM && transcript.length) {
      try {
        var vr = await ctx.chairLLM({ topic: topic, transcript: transcript, lang: lang, maxTokens: (f.CHAIR_MAXTOK || 700), signal: ctx.signal });
        chairIn = (vr && vr.usageIn) || 0;
        chairOut = (vr && vr.usageOut) || 0;
        verdict = (vr && vr.verdict) || '';
        signature = (vr && vr.signature) || '';
        basis = (vr && vr.basis) || '';
        confidence = (vr && vr.confidence != null) ? vr.confidence : null;
      } catch (e) {
        if (endedBy !== 'error' && endedBy !== 'timeout') endedBy = 'chair_error';
      }
    }
    // Graceful fallback: a Chair was expected but returned nothing (model cold-start or a
    // transient empty completion) → never stream a blank verdict to the spectator.
    if (ctx.chairLLM && transcript.length && !verdict) {
      verdict = (lang === 'en')
        ? 'The Chair finds the debate finely balanced — no single source proved decisive.'
        : '의장은 토론이 팽팽하다 보았다 — 어느 한쪽도 결정적이지 못했다.';
      if (!signature) signature = (lang === 'en') ? 'Time keeps its counsel.' : '시간은 아직 말을 아낀다.';
      if (confidence == null) confidence = 0.5;
    }
    pushEvt({ phase: 'verdict', verdict: verdict, signature: signature, basis: basis, confidence: confidence, unverified: true });

    var price = ctx.price || {};
    var debateCost = guards.estimateCost(tokensIn, tokensOut, price);
    var chairCost = (chairIn / 1000) * (price.chairInPer1k || 0.0025) + (chairOut / 1000) * (price.chairOutPer1k || 0.015);
    var estCost = debateCost + chairCost;

    pushEvt({ phase: 'done', endedBy: endedBy, rounds: rounds, tokensIn: tokensIn + chairIn, tokensOut: tokensOut + chairOut, cost: estCost });
    return {
      events: events, transcript: transcript,
      verdict: verdict, signature: signature, basis: basis, confidence: confidence, unverified: true,
      endedBy: endedBy, rounds: rounds,
      tokensIn: tokensIn, tokensOut: tokensOut, chairIn: chairIn, chairOut: chairOut,
      estCost: estCost, partial: (endedBy === 'error' || endedBy === 'timeout' || endedBy === 'chair_error'),
    };
  }

  // ---- the state machine (§M) -----------------------------------------------
  // ctx: { fixture, sages, dials, lang, now, signals, store, salt, caps, price,
  //        budgetGateRatio, dayLiveMax, llm, engine, guards, clock, signal }
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

    // L4b daily live-count hard cap — a blunt, intuitive ceiling on top of the USD
    // gate ("at most N live debates/day"). Because L5 bounds one debate's tokens,
    // this is effectively a hard daily token ceiling. dayLiveMax == null → off.
    var dayCnt = guards.checkDailyCount(store, ctx.dayLiveMax, now);
    if (!dayCnt.ok) return ambient(ctx, 'daily_count', dayCnt);

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
      guards.recordLiveCount(store, now);   // count this live toward the daily count cap (L4b)
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

  // ---- free-topic Live: the SAME guard state machine as councilLive, but the
  // debate is fixture-less (runFreeDebate) and the verdict is the Chair LLM's
  // (unverified-labelled) — a free topic has no math ground truth (§1d golden-rule
  // relaxation). Streams convocation/turn/verdict/done via onEvent. On a guard
  // block it streams one notice + done(blocked) and returns early (0 cost).
  async function councilLiveFree(ctx, onEvent) {
    var guards = ctx.guards || G_default;
    ctx.guards = guards;
    var dials = ctx.dials || {};
    var freeDials = ctx.freeDials || {};
    var store = ctx.store || guards.makeMemStore();
    var now = (ctx.now != null ? ctx.now : Date.now());
    var sages = ctx.sages || [];
    var lang = ctx.lang === 'en' ? 'en' : 'ko';
    var emit = (typeof onEvent === 'function') ? onEvent : function () {};

    function blocked(reason, extra) {
      var text = noticeFor(reason, lang, extra);
      emit({ phase: 'notice', reason: reason, text: text });
      emit({ phase: 'done', endedBy: 'blocked', reason: reason, rounds: 0, cost: 0 });
      return { state: 'ambient', live: false, blocked: true, reason: reason, notice: text, cost: 0 };
    }

    // 0. KILLSWITCH / LIVE_ENABLED — the whole town stays Ambient, 0 cost.
    if (!dials.LIVE_ENABLED) return blocked('spectator');
    // L3 burst guard
    var ipC = guards.coarseIp(ctx.signals && ctx.signals.ip);
    var burst = guards.checkBurst(store, ipC, now, dials.BURST_THRESHOLD_PER_MIN || 20, 60);
    if (!burst.ok) return blocked('burst', burst);
    // L5 hard cap + L4 budget — price a free debate (bounded debate tokens + the
    // dominant Chair) so the budget wall sees the real (chair-heavy) cost.
    var capDials = { TOKENS_PER_TURN_MAX: freeDials.TOKENS_PER_TURN_MAX || 220, CROSS_ROUNDS_MAX: (freeDials.MAX_ROUNDS || 4) - 1 };
    var hardCap = guards.debateHardCap(capDials, sages.length, ctx.price);
    var chairEst = ((freeDials.CHAIR_MAXTOK || 700) / 1000) * ((ctx.price && ctx.price.chairOutPer1k) || 0.015);
    var bud = guards.checkBudget(store, hardCap.estCost + chairEst, ctx.caps, ctx.budgetGateRatio, now);
    if (!bud.ok) return blocked('budget', bud);
    // L4b daily live-count hard cap
    var dayCnt = guards.checkDailyCount(store, ctx.dayLiveMax, now);
    if (!dayCnt.ok) return blocked('daily_count', dayCnt);
    // L1 personal rate-limit
    var key = guards.compositeKey(ctx.signals, ctx.salt);
    var rate = guards.checkRate(store, key, now, dials.PERSONAL_COOLDOWN_SEC || 3600);
    if (!rate.ok) return blocked('cooldown', rate);
    // L2 concurrency (atomic acquire)
    var conc = guards.acquireConcurrency(store, dials.LIVE_CONCURRENCY_MAX || 2);
    if (!conc.ok) return blocked('full', conc);

    // ---- LIVE ----
    try {
      guards.recordLive(store, key, now);
      guards.recordLiveCount(store, now);
      var out = await runFreeDebate(ctx, onEvent);
      guards.recordSpend(store, out.estCost, now);
      return Object.assign({ state: 'verdict', live: true, blocked: false }, out);
    } finally {
      guards.releaseConcurrency(store);
    }
  }

  var mod = {
    councilLive: councilLive,
    councilLiveFree: councilLiveFree,
    runDebate: runDebate,
    runFreeDebate: runFreeDebate,
    ambient: ambient,
    noticeFor: noticeFor,
    NOTICES: NOTICES,
    personaSystem: personaSystem,
    _internal: { observeLog: observeLog, clampText: clampText, fmtMin: fmtMin },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof globalThis !== 'undefined') globalThis.CouncilLive = mod;
})();
