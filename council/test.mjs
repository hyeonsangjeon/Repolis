/* council/test.mjs — Kronos Council 결정론 크로스체크 (Phase 1)
 *
 * 스펙 §F 시나리오 완료 기준 + §C byte-equal + §B 정규화를 코드로 박는다.
 * 전부 PASS여야 배포(AGENTS.md 황금규칙). LLM 호출 0.
 *
 *   node council/test.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Engine = require('./engine.js');
const Fixtures = require('./fixtures.js');

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function group(name) { console.log('\n• ' + name); }

/* ── 1) 시그니처 라인 S1~S9 가 의도대로 발사되는가 ── */
group('signature lines fire as intended (S1/S1/S1/S3/S2/S2/S8/S4/S5/S6/S5/S6/S7)');
const expectSig = { pydantic_dict: 'S1', transformers_generate: 'S1', pandas_concat: 'S1', request_timeout: 'S3', openai_sdk: 'S2', langchain_lcel: 'S2', css_center: 'S8',
  js_deepcopy: 'S4', react_effect: 'S5', http_created: 'S6', torch_nograd: 'S5', tensor_dtype: 'S6', rag_longctx: 'S7' };
Fixtures.list().forEach(function (fx) {
  const r = Engine.councilAsk(fx, { lang: 'ko' });
  eq(r.signature.id, expectSig[fx.id], fx.id + ' → ' + expectSig[fx.id]);
});

/* ── 2) 영웅 케이스: overrode_majority=true 로 소수(.model_dump) 채택 ── */
group('hero case overrides the majority');
const hero = Engine.councilAsk(Fixtures.get('pydantic_dict'), { lang: 'ko' });
ok(hero.conflicts.length === 1, 'pydantic has exactly one conflict');
ok(hero.conflicts[0].overrode_majority === true, 'pydantic overrode_majority=true');
ok(Engine.normalizeValue(hero.conflicts[0].verdict) === 'model_dump', 'pydantic verdict normalizes to model_dump');
ok(hero.conflicts[0].verdict_source === 'livewire', 'pydantic verdict_source=livewire (live source)');
ok(hero.signature.ko.indexOf('둘') >= 0, 'pydantic S1 says 둘 (2 votes substituted)');

/* ── 3) 다수결이 '맞는' 케이스: 소수 맹종 안 함 ── */
group('not a contrarian — agrees when the majority is right');
const tmo = Engine.councilAsk(Fixtures.get('request_timeout'), { lang: 'ko' });
ok(tmo.conflicts[0].overrode_majority === false, 'timeout overrode_majority=false');
ok(Engine.normalizeValue(tmo.conflicts[0].verdict) === '30', 'timeout verdict=30 (majority, backed by live)');
ok(tmo.conflicts[0].loser_type === 'stale_doc', 'timeout loser_type=stale_doc');
const oai = Engine.councilAsk(Fixtures.get('openai_sdk'), { lang: 'ko' });
ok(oai.conflicts[0].overrode_majority === false, 'openai overrode_majority=false (community caught up)');
ok(oai.conflicts[0].loser_type === 'deprecated_api', 'openai loser_type=deprecated_api (removed road)');
const lcel = Engine.councilAsk(Fixtures.get('langchain_lcel'), { lang: 'ko' });
ok(lcel.conflicts[0].overrode_majority === false, 'langchain overrode_majority=false (community caught up)');
ok(lcel.conflicts[0].loser_type === 'deprecated_api', 'langchain loser_type=deprecated_api (LLMChain deprecated)');
const trf = Engine.councilAsk(Fixtures.get('transformers_generate'), { lang: 'ko' });
ok(trf.conflicts[0].overrode_majority === true, 'transformers overrode_majority=true (majority on max_length is stale)');
ok(trf.conflicts[0].verdict === 'max_new_tokens', 'transformers verdict picks max_new_tokens');
const pdc = Engine.councilAsk(Fixtures.get('pandas_concat'), { lang: 'ko' });
ok(pdc.conflicts.length === 1, 'pandas has exactly one conflict');
ok(pdc.conflicts[0].overrode_majority === true, 'pandas overrode_majority=true (majority still on df.append)');
ok(Engine.normalizeValue(pdc.conflicts[0].verdict) === 'pd.concat', 'pandas verdict normalizes to pd.concat');
ok(pdc.conflicts[0].verdict_source === 'livewire', 'pandas verdict_source=livewire (live source)');
ok(pdc.conflicts[0].loser_type === 'deprecated_api', 'pandas loser_type=deprecated_api (append removed in 2.0)');
ok(Engine.normalizeValue('df.append(df2)') === Engine.normalizeValue('df.append([row])'), 'pandas two append notations normalize equal (real majority of 2)');

/* ── 4) 완전 합의: conflicts=[] (거짓 경보 0) ── */
group('full consensus → zero false alarms');
const css = Engine.councilAsk(Fixtures.get('css_center'), { lang: 'ko' });
eq(css.conflicts, [], 'css conflicts=[]');
ok(css.consensus.length === 1, 'css has one consensus entry');
ok(css.consensus[0].value === 'flexbox', 'css consensus value=flexbox');
ok(css.signature.id === 'S8', 'css signature=S8');

/* ── 5) 정규화: 표기 변형 4종이 false conflict 를 만들지 않는다 ── */
group('normalization — notation variants do not create false conflicts');
const variants = ['.model_dump()', 'model_dump()', 'instance.model_dump()', 'instance . model_dump( mode="json" )'];
const normed = variants.map(Engine.normalizeValue);
ok(new Set(normed).size === 1, 'four model_dump variants normalize to one: ' + JSON.stringify(normed));
eq(Engine.normalizeValue('timeout=30'), '30', 'timeout=30 → 30');
eq(Engine.normalizeValue('timeout = 30'), '30', 'timeout = 30 → 30');
eq(Engine.normalizeValue('30 seconds'), '30', '30 seconds → 30');
// a synthetic fixture where all three agree (in different notations) must be consensus, not conflict
const synth = { id: 'synth_norm', topic: 'norm', attribute: 'm', question: { ko: 'q', en: 'q' }, answers: [
  { sage: 'olddoc', value: '.model_dump()', date: '2025-08' },
  { sage: 'livewire', value: 'instance.model_dump()', date: '2026-04', signals: ['live_source'] },
  { sage: 'hearsay', value: 'model_dump( mode="json" )', date: '2026-01' } ] };
const synthR = Engine.councilAsk(synth, { lang: 'ko' });
eq(synthR.conflicts, [], 'synthetic notation-variant fixture → no conflict');
ok(synthR.consensus.length === 1, 'synthetic fixture → consensus');
// and that distinct APIs are NOT merged
ok(Engine.normalizeValue('openai.ChatCompletion.create()') !== Engine.normalizeValue('client.chat.completions.create()'),
  'distinct API paths stay distinct (no over-merge)');

/* ── 6) 결정론: 같은 픽스처 2회 호출 → transcript byte-equal ── */
group('determinism — same fixture twice is byte-equal');
Fixtures.list().forEach(function (fx) {
  const a = JSON.stringify(Engine.councilAsk(fx, { withTranscript: true, lang: 'ko' }));
  const b = JSON.stringify(Engine.councilAsk(fx, { withTranscript: true, lang: 'ko' }));
  ok(a === b, fx.id + ' transcript byte-equal on repeat');
});
// EN path also deterministic
Fixtures.list().forEach(function (fx) {
  const a = JSON.stringify(Engine.councilAsk(fx, { withTranscript: true, lang: 'en' }));
  const b = JSON.stringify(Engine.councilAsk(fx, { withTranscript: true, lang: 'en' }));
  ok(a === b, fx.id + ' (en) transcript byte-equal on repeat');
});

/* ── 7) 출력 스키마 필드가 정확히 존재하는가 ── */
group('output schema fields present');
Fixtures.list().forEach(function (fx) {
  const r = Engine.councilAsk(fx, { withTranscript: true, lang: 'ko' });
  ok('question' in r && 'consensus' in r && 'conflicts' in r && 'summary' in r && 'signature' in r, fx.id + ' has core fields');
  ok(Array.isArray(r.transcript) && r.transcript[0].phase === 'convocation', fx.id + ' transcript starts with convocation');
  const phases = r.transcript.map(function (e) { return e.phase; });
  ok(phases.indexOf('testimony') >= 0 && phases.indexOf('verdict') >= 0 && phases[phases.length - 1] === 'record',
    fx.id + ' transcript has testimony→verdict→record');
});

/* ── 8) no-answer 경로 → S9 ── */
group('empty testimony → S9 (adjourn)');
const empty = Engine.councilAsk({ id: 'empty', attribute: 'x', question: { ko: 'q', en: 'q' }, answers: [] }, { lang: 'ko' });
ok(empty.signature.id === 'S9', 'no answers → S9');

/* ── 9) 신규 큐레이티드 케이스: 그동안 미사용이던 S4/S5/S6/S7 커버 ── */
group('new curated cases cover S4 (tie) / S5 (live) / S6 (official) / S7 (tentative)');
const s4 = Engine.councilAsk(Fixtures.get('js_deepcopy'), { lang: 'ko' });
ok(s4.signature.id === 'S4', 'js_deepcopy → S4 (no decisive authority, tie)');
ok(s4.conflicts[0].overrode_majority === false, 'js_deepcopy is not an override (1·1·1 split)');
ok(Engine.normalizeValue(s4.conflicts[0].verdict) === Engine.normalizeValue('structuredClone(obj)'), 'js_deepcopy verdict = structuredClone (most recent)');

const s5a = Engine.councilAsk(Fixtures.get('react_effect'), { lang: 'ko' });
ok(s5a.signature.id === 'S5', 'react_effect → S5 (verified by a live source)');
ok(s5a.conflicts[0].verdict_source === 'livewire', 'react_effect verdict_source = livewire');
ok(s5a.conflicts[0].loser_type === 'community', 'react_effect loser_type = community');
const s5b = Engine.councilAsk(Fixtures.get('torch_nograd'), { lang: 'en' });
ok(s5b.signature.id === 'S5', 'torch_nograd → S5 (verified by a live source)');
ok(s5b.conflicts[0].verdict_source === 'livewire', 'torch_nograd verdict_source = livewire');

const s6a = Engine.councilAsk(Fixtures.get('http_created'), { lang: 'ko' });
ok(s6a.signature.id === 'S6', 'http_created → S6 (one origin beats many echoes)');
ok(s6a.conflicts[0].verdict_source === 'olddoc', 'http_created verdict_source = olddoc (official_doc)');
ok(s6a.conflicts[0].loser_type === 'community', 'http_created loser_type = community');
ok(s6a.conflicts[0].overrode_majority === false, 'http_created not an override (official is in the majority)');
const s6b = Engine.councilAsk(Fixtures.get('tensor_dtype'), { lang: 'en' });
ok(s6b.signature.id === 'S6', 'tensor_dtype → S6 (one origin beats many echoes)');
ok(Engine.normalizeValue(s6b.conflicts[0].verdict) === Engine.normalizeValue('torch.float32'), 'tensor_dtype verdict = torch.float32');

const s7 = Engine.councilAsk(Fixtures.get('rag_longctx'), { lang: 'ko' });
ok(s7.signature.id === 'S7', 'rag_longctx → S7 (tentative, no settled authority)');
ok(s7.conflicts[0].confidence < 0.6, 'rag_longctx confidence < 0.6 (tentative penalty applied)');
ok(s7.conflicts[0].reason.indexOf('잠정') >= 0, 'rag_longctx reason flags 잠정 (tentative)');
const s7en = Engine.councilAsk(Fixtures.get('rag_longctx'), { lang: 'en' });
ok(s7en.conflicts[0].reason.indexOf('tentative') >= 0, 'rag_longctx (en) reason flags tentative');

/* sourceType override가 기존 케이스를 깨지 않는가(회귀) */
ok(Engine.councilAsk(Fixtures.get('pydantic_dict'), { lang: 'ko' }).signature.id === 'S1', 'pre-existing pydantic_dict still S1 after sourceType change');
ok(Engine.councilAsk(Fixtures.get('openai_sdk'), { lang: 'ko' }).signature.id === 'S2', 'pre-existing openai_sdk still S2 after sourceType change');

console.log('\n──────────────────────────────');
console.log(fail === 0 ? '✅ ALL GREEN — ' + pass + ' checks passed' : '❌ ' + fail + ' FAILED / ' + pass + ' passed');
if (fail) { console.log('\nFailures:'); fails.forEach(function (f) { console.log('  - ' + f); }); }
process.exit(fail === 0 ? 0 : 1);
