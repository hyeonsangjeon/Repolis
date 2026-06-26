/* council/engine.js — Kronos Council deterministic core (Phase 1)
 *
 * 프로젝트의 심장: 같은 질문에 대한 현자들의 답을 claim 단위로 분해 →
 * 정규화(표기 변형이 false conflict 금지) → 충돌 탐지 → '시간' 우선순위로 판정 →
 * verdict + confidence + overrode_majority + 시그니처 라인 S1~S9.
 *
 * ★ 결정론 ★ — LLM 호출 0. 같은 픽스처 = 같은 출력(transcript byte-equal).
 * 브라우저(<script src>)와 Node(require/import) 양쪽에서 동작하는 클래식 모듈.
 *
 * 외부 노출: councilAsk(fixture, { withTranscript, lang }) → result
 * 자세한 계약은 CHRONOPOLIS_SPEC.md §B/§C/§E, AGENTS.md §3 참조.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof window !== 'undefined') window.CouncilEngine = mod;
  if (typeof globalThis !== 'undefined') globalThis.CouncilEngine = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ----- source-type priority (스펙: 살아있는 소스 > 박제 docs > 커뮤니티) ----- */
  const SOURCE_WEIGHT = { live_source: 3.0, official_doc: 2.4, stale_doc: 1.5, community: 1.0 };
  const SOURCE_OF = { livewire: 'live_source', olddoc: 'stale_doc', hearsay: 'community' };

  /* =========================================================================
   * 1) 정규화 — 표기만 다른 동일 의미가 false conflict를 만들지 않게 한다.
   *    ".model_dump()" / "model_dump()" / "instance.model_dump()" → 동일
   *    "timeout=30" / "timeout = 30" / "30 seconds" → 동일
   *    대소문자 · 공백 · 괄호 · 따옴표 정규화 후 비교.
   * ========================================================================= */
  const GENERIC_RECEIVERS = new Set(['instance', 'self', 'obj', 'this', 'model', 'm', 'mymodel', 'user', 'o']);
  const UNIT_WORDS = /\b(seconds?|secs?|s|ms|milliseconds?|minutes?|mins?|m|bytes?|chars?|characters?)\b/g;

  function normalizeValue(raw) {
    if (raw == null) return '';
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/[`'"]/g, '');                 // strip quotes/backticks
    s = s.replace(/\s+/g, ' ').trim();

    // collapse call args FIRST so a kwarg '=' (model_dump(mode=json)) is gone
    // before the assignment check — otherwise "foo(a=1)" would split on '='.
    const hadCall = /\([^)]*\)/.test(s);
    s = s.replace(/\([^)]*\)/g, '()');           // foo(a,b) / foo(mode=json) → foo()

    // key=value assignment → keep the value side ("timeout = 30" → "30").
    // Only when it's NOT a call (no parens), so call kwargs never trip this.
    if (!hadCall && !s.includes('(') && s.includes('=') && !s.includes('==')) {
      const parts = s.split('=');
      s = parts[parts.length - 1].trim();
    }

    // pure numeric (optionally with a unit word): "30 seconds" / "30s" / "30" → "30"
    const num = s.replace(UNIT_WORDS, '').trim();
    if (/^-?\d+(\.\d+)?$/.test(num)) return num;

    // method-like: drop a single generic receiver, keep the API path
    if (s.includes('(') || s.includes('.')) {
      s = s.replace(/\(\)/g, '');                // drop the empty parens
      s = s.replace(/\s*\.\s*/g, '.');           // tidy dots
      s = s.replace(/^\.+/, '');                 // leading ".model_dump" → "model_dump"
      const segs = s.split('.').filter(Boolean);
      if (segs.length > 1 && GENERIC_RECEIVERS.has(segs[0])) segs.shift();
      return segs.join('.');
    }
    return s.replace(/\s+/g, ' ').trim();
  }

  /* =========================================================================
   * 2) claim 추출 + 충돌 탐지
   *    각 현자의 답 = (sage, attribute, value, date, provenance, signals).
   *    정규화 후 값이 갈리면 conflict.
   * ========================================================================= */
  function extractClaims(fixture) {
    return (fixture.answers || []).map(function (a) {
      return {
        sage: a.sage,
        sourceType: a.sourceType || SOURCE_OF[a.sage] || 'community',
        attribute: fixture.attribute,
        value: a.value,
        norm: normalizeValue(a.value),
        date: a.date || null,
        ts: a.date ? Date.parse((a.date.length === 7 ? a.date + '-01' : a.date)) || 0 : 0,
        provenance: a.provenance || null,
        signals: a.signals || []
      };
    });
  }

  function hasConflict(claims) {
    const norms = new Set(claims.map(function (c) { return c.norm; }));
    return norms.size > 1;
  }

  /* =========================================================================
   * 3) 판정 — 살아있는 소스 > 박제 / 최신 > 옛것 / 공식 > 커뮤니티.
   *    다수결과 갈리면 overrode_majority=true. confidence(0~1) 산출.
   * ========================================================================= */
  function tallyVotes(claims) {
    const m = {};
    claims.forEach(function (c) { (m[c.norm] = m[c.norm] || { norm: c.norm, value: c.value, votes: 0, claims: [] }), m[c.norm].votes++, m[c.norm].claims.push(c); });
    return Object.values(m);
  }

  function scoreValue(group) {
    // best supporting source weight + recency nudge
    let best = 0, ts = 0;
    group.claims.forEach(function (c) {
      const w = SOURCE_WEIGHT[c.sourceType] || 1;
      if (w > best) best = w;
      if (c.ts > ts) ts = c.ts;
    });
    return best + (ts ? ts / 1e16 : 0) + group.votes * 0.01;
  }

  function monthsBetween(a, b) {
    if (!a || !b) return 0;
    return Math.abs(a - b) / (1000 * 60 * 60 * 24 * 30.4);
  }

  function adjudicate(fixture, claims) {
    const groups = tallyVotes(claims);

    // naive majority = most-voted value (tie → undefined majority)
    let majority = groups.slice().sort(function (a, b) { return b.votes - a.votes; });
    const naiveTie = majority.length > 1 && majority[0].votes === majority[1].votes;
    const naive = majority[0];

    // verdict = highest scored value (rule-based)
    const ranked = groups.slice().sort(function (a, b) { return scoreValue(b) - scoreValue(a); });
    const winner = ranked[0];
    const winnerClaim = winner.claims.slice().sort(function (a, b) {
      return (SOURCE_WEIGHT[b.sourceType] - SOURCE_WEIGHT[a.sourceType]) || (b.ts - a.ts);
    })[0];

    const overrode_majority = !naiveTie && naive.norm !== winner.norm;
    const tie = naiveTie && groups.length > 1;

    // the losing (rejected) value = the naive majority when overridden, else the strongest loser
    const loserGroup = overrode_majority ? naive : (ranked[1] || null);
    const loserClaim = loserGroup ? loserGroup.claims.slice().sort(function (a, b) {
      return (SOURCE_WEIGHT[b.sourceType] - SOURCE_WEIGHT[a.sourceType]);
    })[0] : null;

    // loser_type: removed/deprecated API > stale doc > community
    const altRemoved = winnerClaim.signals.indexOf('alt_removed') >= 0;
    const altDeprecated = winnerClaim.signals.indexOf('alt_deprecated') >= 0;
    let loser_type = null;
    if (loserClaim) {
      if (altRemoved || altDeprecated || loserClaim.signals.indexOf('removed') >= 0 || loserClaim.signals.indexOf('deprecated') >= 0) {
        loser_type = 'deprecated_api';
      } else if (loserClaim.sourceType === 'stale_doc') {
        loser_type = 'stale_doc';
      } else if (loserClaim.sourceType === 'community') {
        loser_type = 'community';
      }
    }

    // confidence — gap of authority + recency + signal strength
    let confidence = 0.55;
    if (winnerClaim.sourceType === 'live_source') confidence += 0.15;
    if (winnerClaim.sourceType === 'official_doc') confidence += 0.1;
    if (loser_type === 'deprecated_api') confidence += 0.1;
    const gapMonths = loserClaim ? monthsBetween(winnerClaim.ts, loserClaim.ts) : 0;
    if (gapMonths >= 12) confidence += 0.08; else if (gapMonths >= 6) confidence += 0.04;
    if (winner.votes >= 2) confidence += 0.05;
    if (winnerClaim.signals.indexOf('tentative') >= 0) confidence -= 0.12;
    confidence = Math.max(0, Math.min(0.97, Math.round(confidence * 100) / 100));

    const reasonBits = [];
    if (winnerClaim.sourceType === 'live_source') reasonBits.push('live_source');
    if (winnerClaim.sourceType === 'official_doc') reasonBits.push('official');
    if (gapMonths >= 6) reasonBits.push('newest');
    if (loser_type === 'deprecated_api') reasonBits.push(altRemoved ? 'alt_removed' : 'alt_deprecated');
    if (overrode_majority) reasonBits.push('majority_is_stale');
    if (winnerClaim.signals.indexOf('tentative') >= 0) reasonBits.push('tentative');

    return {
      attribute: fixture.attribute,
      verdict: winner.value,
      verdict_norm: winner.norm,
      verdict_source: winnerClaim.sage,
      verdict_source_type: winnerClaim.sourceType,
      naive_majority: naive ? naive.value : null,
      overrode_majority: overrode_majority,
      tie: tie,
      loser_value: loserClaim ? loserClaim.value : null,
      loser_type: loser_type,
      confidence: confidence,
      reason: reasonBits,
      groups: groups,
      winnerClaim: winnerClaim,
      loserClaim: loserClaim
    };
  }

  /* =========================================================================
   * 4) 의장 시그니처 라인 S1~S9 (스펙 §E) — 우선순위 위→아래, 첫 매치 1개만.
   * ========================================================================= */
  const SIGNATURES = {
    S1: { id: 'S1', ko: '표는 {n}이나, 시간은 하나를 가리킨다.', en: 'Three votes, but time points to one.' },
    S2: { id: 'S2', ko: '낡은 길은 이미 닫혔다. 다만 문서가 늦었을 뿐.', en: 'The old road is already closed; only the docs were late.' },
    S3: { id: 'S3', ko: '오래된 말은, 오래되었기에 진다.', en: 'Old words lose because they are old.' },
    S4: { id: 'S4', ko: '말이 갈릴 때, 나는 시계를 본다.', en: 'When the words split, I look at the clock.' },
    S5: { id: 'S5', ko: '박제된 글보다, 숨 쉬는 코드를 믿는다.', en: 'I trust breathing code over embalmed prose.' },
    S6: { id: 'S6', ko: '여럿의 메아리보다, 하나의 원전을.', en: 'One origin over many echoes.' },
    S7: { id: 'S7', ko: '시간이 더 흐르면 뒤집힐 수 있다. 지금은 이것이 최선이다.', en: 'More time may overturn this; for now it is the best.' },
    S8: { id: 'S8', ko: '이견이 없으니, 시간도 침묵한다.', en: 'No dissent; even time stays silent.' },
    S9: { id: 'S9', ko: '오늘의 증언으론 부족하다. 회의를 연기한다.', en: 'Today\'s testimony is not enough; the council adjourns.' },
    FALLBACK: { id: 'FALLBACK', ko: '기록되었다.', en: 'It is recorded.' }
  };

  const KO_NUM = { 1: '하나', 2: '둘', 3: '셋', 4: '넷', 5: '다섯' };

  function pickSignature(ctx) {
    // ctx: { conflict, no_answer, overrode_majority, tie, loser_type, verdict_source_type, official_doc, confidence, majorityVotes }
    let key;
    if (ctx.no_answer) key = 'S9';
    else if (!ctx.conflict) key = 'S8';
    else if (ctx.overrode_majority) key = 'S1';
    else if (ctx.loser_type === 'deprecated_api') key = 'S2';
    else if (ctx.loser_type === 'stale_doc' && !ctx.overrode_majority) key = 'S3';
    else if (ctx.tie) key = 'S4';
    else if (ctx.verdict_source_type === 'live_source') key = 'S5';
    else if (ctx.official_doc && ctx.loser_type === 'community') key = 'S6';
    else if (ctx.confidence < 0.6) key = 'S7';
    else key = 'FALLBACK';

    const sig = SIGNATURES[key];
    const n = KO_NUM[ctx.majorityVotes] || String(ctx.majorityVotes || '');
    return {
      id: sig.id,
      ko: sig.ko.replace('{n}', n),
      en: sig.en.replace('{n}', String(ctx.majorityVotes || 'many'))
    };
  }

  /* =========================================================================
   * 5) 회의장 transcript (스펙 §C) — 5단계 결정론 event 배열 + 말풍선 텍스트.
   *    모든 글자는 fixture 데이터에서 결정론 매핑. 같은 fixture = byte-equal.
   * ========================================================================= */
  function prov(claim, lang) {
    const p = claim.provenance;
    if (!p) return '';
    return (typeof p === 'string') ? p : (p[lang] || p.en || p.ko || '');
  }

  function reasonText(reason, lang) {
    const KO = { live_source: '살아있는 소스', official: '공식 출처', newest: '최신', alt_removed: '구버전 제거됨', alt_deprecated: '대안 deprecated', majority_is_stale: '다수가 박제됨', tentative: '잠정·미확정' };
    const EN = { live_source: 'live source', official: 'official source', newest: 'newest', alt_removed: 'old API removed', alt_deprecated: 'alternative deprecated', majority_is_stale: 'majority is stale', tentative: 'tentative · unsettled' };
    const M = lang === 'ko' ? KO : EN;
    return reason.map(function (r) { return M[r] || r; }).join(lang === 'ko' ? ' · ' : ' · ');
  }

  /* ----- deterministic variant picker: same fixture → same phrasing (byte-equal),
   *       different fixtures → different phrasing (so the six topics don't all read alike). ----- */
  function hashSeed(s) { let h = 2166136261 >>> 0; s = String(s == null ? '' : s); for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; } return h; }
  function pickV(arr, seed) { return arr[(seed >>> 0) % arr.length]; }

  function bubble(verdict, claims, adj, lang, seedStr) {
    // deterministic spoken banter, interpolated from fixture data (no LLM).
    // tiki-taka: every sage gets to jab back, in character. byte-equal on repeat.
    // a per-fixture seed rotates through phrasing pools so each topic sounds different.
    const byId = {}; claims.forEach(function (c) { byId[c.sage] = c; });
    const live = byId.livewire, doc = byId.olddoc, crowd = byId.hearsay;
    const ko = lang === 'ko';
    const lines = [];
    const crowdSidesLive = crowd && live && crowd.norm === live.norm;
    const docSidesLive = doc && live && doc.norm === live.norm;
    const closed = adj.loser_type === 'deprecated_api';
    const seed = hashSeed(seedStr || (doc && doc.value) || verdict || '');
    const dv = doc ? doc.value : '', lv = live ? live.value : '', cv = crowd ? crowd.value : '';
    const dd = (doc && doc.date) || (ko ? '옛날' : 'the old days');
    const pvl = live ? prov(live, lang) : '';

    /* ── testimony: spoken, in character ── */
    if (doc) lines.push({ phase: 'testimony', sage: 'olddoc', tone: 'assert',
      text: ko ? pickV([
                 '에헴, 문서엔 분명 ' + dv + '라고 적혀 있네. 난 이걸 십 년을 봐왔어.',
                 '내 오래된 매뉴얼엔 ' + dv + '. 이게 정석이야, 암.',
                 '예로부터 ' + dv + '라 했지. 검증된 길이 안전한 법이야.'
               ], seed)
               : pickV([
                 'Ahem — the docs plainly say ' + dv + '. I have watched this for ten years.',
                 'My old manual says ' + dv + '. That is the canonical way, trust me.',
                 'Since the old days it has been ' + dv + '. A proven road is a safe road.'
               ], seed) });
    if (live) lines.push({ phase: 'testimony', sage: 'livewire', tone: 'snark',
      text: ko ? (docSidesLive ? pickV([
                   '소스 까보면 ' + lv + '. 이건 형 말이 맞네요. ' + pvl,
                   '어 이번엔 형이 맞아요, 소스도 ' + lv + '. ' + pvl
                 ], seed) : pickV([
                   '십 년 전 문서겠죠 ㅋㅋ 소스 까보면 ' + lv + '예요. ' + pvl,
                   '그 문서 박물관에 있던데요 ㅋㅋ 소스는 ' + lv + '. ' + pvl,
                   '문서 말고 소스를 봐야죠. 지금은 ' + lv + '예요. ' + pvl
                 ], seed))
               : (docSidesLive ? pickV([
                   'Read the source: ' + lv + '. You got this one right. ' + pvl,
                   'Huh, you are right this time — source says ' + lv + ' too. ' + pvl
                 ], seed) : pickV([
                   'Ten-year-old docs, sure. Read the source: ' + lv + '. ' + pvl,
                   'That manual belongs in a museum, heh. Source says ' + lv + '. ' + pvl,
                   'Forget the docs — read the source, it is ' + lv + ' now. ' + pvl
                 ], seed)) });
    if (crowd) lines.push({ phase: 'testimony', sage: 'hearsay', tone: 'unsure',
      text: ko ? (crowdSidesLive ? pickV([
                   '아 요즘은 ' + cv + ' 쓰던데? 그건 나도 봤어요.',
                   '맞아 맞아, 요즘 ' + cv + '로 가던데요.'
                 ], seed) : pickV([
                   '어, 나도 ' + cv + ' 블로그에서 본 거 같은데…',
                   '음, 어디서 ' + cv + ' 봤던 거 같기도 하고…',
                   '나 ' + cv + ' 쓰는 글 본 적 있는데, 맞나…?'
                 ], seed))
               : (crowdSidesLive ? pickV([
                   'Oh, folks use ' + cv + ' these days — saw that too.',
                   'Right, right, everyone is on ' + cv + ' lately.'
                 ], seed) : pickV([
                   'Uh, I think I saw ' + cv + ' on a blog too…',
                   'Hmm, pretty sure I read ' + cv + ' somewhere…',
                   'I have seen posts using ' + cv + ', I think…?'
                 ], seed)) });

    /* ── cross-examination: tiki-taka jabs ── */
    if (adj.overrode_majority && live && doc) {
      // the crowd backed the stale answer → live calls it, doc digs in, crowd wobbles
      lines.push({ phase: 'cross', sage: 'livewire', target: 'olddoc', tone: 'challenge',
        text: ko ? pickV([
                   '형, 그거 ' + dd + ' 문서잖아요. ' + (closed ? '지금 돌리면 경고 떠요. ' : '') + '정답은 ' + verdict + '.',
                   '그 ' + dd + ' 문서론 안 돼요. ' + (closed ? '돌리면 경고 떠요. ' : '') + '지금 정답은 ' + verdict + '예요.'
                 ], seed)
                 : pickV([
                   'Old-timer, that is a ' + dd + ' doc. ' + (closed ? "Run it now and you'll get a warning. " : '') + 'The answer is ' + verdict + '.',
                   'That ' + dd + " doc won't fly. " + (closed ? 'It warns if you run it. ' : '') + 'The answer now is ' + verdict + '.'
                 ], seed) });
      lines.push({ phase: 'cross', sage: 'olddoc', target: 'livewire', tone: 'defend',
        text: ko ? pickV([
                   '허 참, 요즘 젊은 친구들은 성급해. 검증된 길이 안전한 거야.',
                   '쯧, 급하기는. 오래 버틴 게 괜히 버틴 줄 아나.'
                 ], seed)
                 : pickV([
                   'Hmph. Kids these days, always in a hurry. The proven road is the safe one.',
                   'Tsk. So impatient. What lasts, lasts for a reason.'
                 ], seed) });
      if (crowd) lines.push({ phase: 'cross', sage: 'hearsay', target: 'olddoc', tone: 'concede',
        text: ko ? pickV([
                   '어… 잠깐, 그럼 내가 본 게 옛날 블로그였나? 😅',
                   '엇… 내가 본 글이 구버전이었나 봐요 😅'
                 ], seed)
                 : pickV([
                   'Wait… was the blog I read that old? 😅',
                   'Oops… guess my post was an old one 😅'
                 ], seed) });
      if (crowd) lines.push({ phase: 'cross', sage: 'livewire', target: 'hearsay', tone: 'snark',
        text: ko ? pickV([
                   '거 봐요, 둘이 같은 박물관 다녀왔네 ㅋㅋ',
                   '두 분 같은 옛날 책 보셨구나 ㅋㅋ'
                 ], seed)
                 : pickV([
                   'See? You two toured the same museum, heh.',
                   'Ha, you both read the same old book.'
                 ], seed) });
    } else if (live && doc) {
      // majority is right; the stale/closed road loses — crowd piles on, doc grumbles
      lines.push({ phase: 'cross', sage: 'livewire', target: 'olddoc', tone: 'challenge',
        text: ko ? (closed ? pickV([
                     '형, 그건 ' + dd + '에 막혔어요. 돌리면 에러나요.',
                     '그거 ' + dd + '에 닫혔어요. 지금 돌리면 에러예요.'
                   ], seed) : pickV([
                     '형, ' + dv + '는 ' + dd + ' 기준이라 outdated예요. 지금은 ' + verdict + '.',
                     '형, ' + dv + '는 ' + dd + '꺼라 옛날이에요. 요즘은 ' + verdict + '.'
                   ], seed))
                 : (closed ? pickV([
                     'Old-timer, that was closed off back in ' + dd + ' — it errors now.',
                     'That one was shut in ' + dd + ' — it just errors today.'
                   ], seed) : pickV([
                     dv + ' is from ' + dd + ' — outdated. Now it is ' + verdict + '.',
                     dv + ' dates to ' + dd + '. These days it is ' + verdict + '.'
                   ], seed)) });
      if (crowd && crowdSidesLive) lines.push({ phase: 'cross', sage: 'hearsay', target: 'olddoc', tone: 'pileon',
        text: ko ? pickV([
                   '아 맞다, 나도 요즘 ' + verdict + ' 써요. 형만 옛날 버전이네 ㅋㅋ',
                   '저도 ' + verdict + ' 쓰는데 ㅋㅋ 형만 옛날 빌드네요.'
                 ], seed)
                 : pickV([
                   'Yeah, I use ' + verdict + ' now too. You are the only one on the old build, heh.',
                   'I am on ' + verdict + ' as well — only you are stuck back there, heh.'
                 ], seed) });
      lines.push({ phase: 'cross', sage: 'olddoc', target: null, tone: 'grumble',
        text: ko ? pickV([
                   '흠… 내 문서엔 아직 ' + dv + '라고 돼 있는데…',
                   '허… 내 책엔 여태 ' + dv + '인데 말이지…'
                 ], seed)
                 : pickV([
                   'Hmm… my docs still say ' + dv + '…',
                   'Hmph… my book still reads ' + dv + '…'
                 ], seed) });
    }
    return lines;
  }

  /* =========================================================================
   * 6) councilAsk — fan-out → claim → 충돌탐지 → 판정 → 출력 (+옵션 transcript).
   * ========================================================================= */
  function councilAsk(fixture, opts) {
    opts = opts || {};
    const lang = opts.lang === 'en' ? 'en' : 'ko';
    const claims = extractClaims(fixture);
    const noAnswer = claims.length === 0 || claims.every(function (c) { return !c.norm; });
    const conflict = !noAnswer && hasConflict(claims);

    const question = (fixture.question && (fixture.question[lang] || fixture.question.ko)) || fixture.id;
    const result = { id: fixture.id, topic: fixture.topic || null, question: question, consensus: [], conflicts: [], summary: '', signature: null };

    if (noAnswer) {
      result.signature = pickSignature({ no_answer: true });
      result.summary = lang === 'ko' ? '증언이 부족하여 판정을 연기합니다.' : 'Not enough testimony; the verdict is deferred.';
    } else if (!conflict) {
      const v = claims[0];
      result.consensus.push({ attribute: fixture.attribute, value: v.value, sources: claims.map(function (c) { return { sage: c.sage, value: c.value, date: c.date }; }), confidence: 0.95 });
      result.signature = pickSignature({ conflict: false });
      result.summary = lang === 'ko'
        ? '세 현자가 모두 ' + v.value + ' 로 합의했습니다. 충돌 없음(거짓 경보 0).'
        : 'All three sages agree on ' + v.value + '. No conflict (zero false alarms).';
    } else {
      const adj = adjudicate(fixture, claims);
      const majorityVotes = adj.groups.slice().sort(function (a, b) { return b.votes - a.votes; })[0].votes;
      const sig = pickSignature({
        conflict: true, overrode_majority: adj.overrode_majority, tie: adj.tie,
        loser_type: adj.loser_type, verdict_source_type: adj.verdict_source_type,
        official_doc: adj.verdict_source_type === 'official_doc', confidence: adj.confidence,
        majorityVotes: majorityVotes
      });
      result.signature = sig;
      result.conflicts.push({
        attribute: adj.attribute,
        naive_majority: adj.naive_majority,
        verdict: adj.verdict,
        verdict_source: adj.verdict_source,
        sources: claims.map(function (c) { return { sage: c.sage, value: c.value, date: c.date, provenance: prov(c, lang), signals: c.signals }; }),
        reason: reasonText(adj.reason, lang),
        confidence: adj.confidence,
        overrode_majority: adj.overrode_majority,
        loser_type: adj.loser_type
      });
      const warn = lang === 'ko' ? '⚠️ ' : '⚠️ ';
      result.summary = adj.tie
        ? (lang === 'ko'
            ? '의견이 ' + claims.length + '갈래로 갈렸습니다. 어느 쪽도 결정적 권위가 없어, 가장 최신인 ' + adj.verdict + '를 채택합니다.'
            : 'Opinions split ' + claims.length + ' ways with no decisive authority; the most recent — ' + adj.verdict + ' — is adopted.')
        : adj.confidence < 0.6
        ? (lang === 'ko'
            ? '확정된 권위가 없어 잠정 판정입니다. 현재로선 ' + adj.verdict + '가 최선이나, 시간이 더 흐르면 뒤집힐 수 있습니다.'
            : 'No settled authority yet — this is tentative. For now ' + adj.verdict + ' is best, but more time may overturn it.')
        : adj.overrode_majority
        ? (lang === 'ko'
            ? warn + '다수(' + majorityVotes + '/' + claims.length + ')는 ' + adj.naive_majority + '를 권하지만 박제된 문서입니다. 살아있는 소스 기준 정답은 ' + adj.verdict + '.'
            : warn + 'The majority (' + majorityVotes + '/' + claims.length + ') pushes ' + adj.naive_majority + ', but that is stale. By the living source the answer is ' + adj.verdict + '.')
        : (lang === 'ko'
            ? '다수가 옳습니다: ' + adj.verdict + '. 다만 ' + (adj.loser_value || '') + '는 오래된 출처라 기각.'
            : 'The majority is right: ' + adj.verdict + '. ' + (adj.loser_value || '') + ' is rejected as outdated.');
    }

    if (opts.withTranscript) {
      result.transcript = buildTranscript(fixture, result, claims, lang);
    }
    return result;
  }

  function buildTranscript(fixture, result, claims, lang) {
    const ko = lang === 'ko';
    const ev = [];
    const summoned = claims.map(function (c) { return c.sage; });
    ev.push({ phase: 'convocation', question: result.question, summoned: summoned,
      line: ko ? '회의를 연다.' : 'The council opens.' });

    claims.forEach(function (c) {
      ev.push({ phase: 'testimony', sage: c.sage, claim: c.value, date: c.date, provenance: prov(c, lang) });
    });

    if (result.conflicts.length) {
      const adj = adjudicate(fixture, claims);
      const lines = bubble(result.conflicts[0].verdict, claims, adj, lang, fixture.id);
      // attach testimony bubble text
      lines.filter(function (l) { return l.phase === 'testimony'; }).forEach(function (l) {
        const e = ev.find(function (x) { return x.phase === 'testimony' && x.sage === l.sage; });
        if (e) { e.text = l.text; e.tone = l.tone; }
      });
      lines.filter(function (l) { return l.phase === 'cross'; }).forEach(function (l) {
        ev.push({ phase: 'cross', sage: l.sage, target: l.target, tone: l.tone, text: l.text,
          attribute: fixture.attribute,
          basis: adj.reason });
      });
      const c0 = result.conflicts[0];
      ev.push({ phase: 'verdict', attribute: c0.attribute, verdict: c0.verdict,
        verdict_source: c0.verdict_source, reason: c0.reason, confidence: c0.confidence,
        overrode_majority: c0.overrode_majority,
        signature: result.signature,
        line: (ko ? '채택 ' : 'Adopted ') + c0.verdict + (ko ? ' · 근거: ' : ' · reason: ') + c0.reason + (ko ? ' · 신뢰도 ' : ' · confidence ') + c0.confidence });
    } else if (result.consensus.length) {
      const ccv = result.consensus[0].value;
      const cText = {
        olddoc:   ko ? '이건 나도 인정하네 — ' + ccv + '.'          : 'On this, even I agree — ' + ccv + '.',
        livewire: ko ? '어, 이건 형 말이 맞아요. ' + ccv + '.'      : 'Yeah, you got this one right. ' + ccv + '.',
        hearsay:  ko ? '오 셋이 같은 거 처음이네 ㅋㅋ ' + ccv + '!' : 'Whoa, all three of us agree? First time, heh — ' + ccv + '!'
      };
      claims.forEach(function (c) {
        const e = ev.find(function (x) { return x.phase === 'testimony' && x.sage === c.sage; });
        if (e) e.text = cText[c.sage] || ((ko ? '저는 ' : 'I say ') + c.value + (ko ? ' 입니다.' : '.'));
      });
      const cc = result.consensus[0];
      ev.push({ phase: 'verdict', attribute: cc.attribute, verdict: cc.value, consensus: true,
        confidence: cc.confidence, signature: result.signature,
        line: (ko ? '이견 없음 — ' : 'No dissent — ') + cc.value });
    } else {
      ev.push({ phase: 'verdict', no_answer: true, signature: result.signature,
        line: ko ? '회의를 연기한다.' : 'The council is adjourned.' });
    }

    ev.push({ phase: 'record', line: ko ? '서기, 기록을 봉인하다.' : 'The clerk seals the record.',
      signature: result.signature });
    return ev;
  }

  return {
    councilAsk: councilAsk,
    normalizeValue: normalizeValue,
    SIGNATURES: SIGNATURES,
    _internal: { adjudicate: adjudicate, extractClaims: extractClaims, pickSignature: pickSignature, hasConflict: hasConflict, buildTranscript: buildTranscript }
  };
}));
