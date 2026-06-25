/* council/fixtures.js — Kronos Council 데모 픽스처 (Phase 1, 결정론)
 *
 * 왜 픽스처인가: (1) GIF 녹화 중 외부 소스가 흔들리면 망함, (2) 결정론이라 테스트로 박힘,
 * (3) 유명한 실제 version drift라 '조작 아님' 보장. 라이브 스크래핑 금지.
 *
 * 각 픽스처는 한 질문에 대한 3현자의 답(claim) + 날짜 + 출처 + signals.
 * sage→source: livewire=live_source(살아있는 repo), olddoc=stale_doc(박제 문서), hearsay=community(커뮤니티).
 * signals: live가 'alt_removed'(구버전 제거)·'alt_deprecated'(대안 deprecated)를 들고 있으면 loser_type 판정에 쓰인다.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  if (typeof window !== 'undefined') window.CouncilFixtures = mod;
  if (typeof globalThis !== 'undefined') globalThis.CouncilFixtures = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const FIXTURES = {

    /* ── 영웅 케이스: 다수결이 틀리는 순간 → S1 ──
       Pydantic v2에서 .dict()는 deprecated, .model_dump()가 정답. 인터넷 문서 다수는 아직 .dict(). */
    pydantic_dict: {
      id: 'pydantic_dict', topic: 'Pydantic', sline: 'S1',
      question: { ko: 'Pydantic 모델 인스턴스를 dict로 직렬화하는 올바른 메서드는?',
                  en: 'What is the correct method to serialize a Pydantic model instance to a dict?' },
      attribute: 'serialization_method',
      attributeLabel: { ko: '직렬화 메서드', en: 'serialization method' },
      answers: [
        { sage: 'olddoc', value: '.dict()', date: '2025-08',
          provenance: { ko: '튜토리얼형 문서 페이지', en: 'tutorial-style docs page' }, signals: [] },
        { sage: 'livewire', value: '.model_dump()', date: '2026-04',
          provenance: { ko: 'pydantic/pydantic src/pydantic/main.py L380 · .dict()는 @deprecated', en: 'pydantic/pydantic src/pydantic/main.py L380 · .dict() is @deprecated' },
          signals: ['live_source', 'alt_deprecated'] },
        { sage: 'hearsay', value: 'instance.dict()', date: '2025-06',
          provenance: { ko: 'Q&A / 블로그 파생 문서', en: 'Q&A / blog-derived doc' }, signals: ['echoes:olddoc'] }
      ]
    },

    /* ── deprecation drift → S2 ──
       OpenAI SDK v1+에서 openai.ChatCompletion.create는 제거됨. 커뮤니티는 이미 새 SDK로 이동(다수 정답),
       올드독만 제거된 옛 호출을 변호. 다수가 맞지만 패자는 '닫힌 길'이라 S2. */
    openai_sdk: {
      id: 'openai_sdk', topic: 'OpenAI SDK', sline: 'S2',
      question: { ko: 'OpenAI Python SDK로 채팅 완성을 호출하는 올바른 방법은?',
                  en: 'What is the correct way to call chat completion with the OpenAI Python SDK?' },
      attribute: 'chat_completion_call',
      attributeLabel: { ko: '채팅 완성 호출', en: 'chat completion call' },
      answers: [
        { sage: 'olddoc', value: 'openai.ChatCompletion.create()', date: '2025-03',
          provenance: { ko: 'v0 시절 튜토리얼(박제)', en: 'v0-era tutorial (embalmed)' }, signals: ['removed'] },
        { sage: 'livewire', value: 'client.chat.completions.create()', date: '2026-05',
          provenance: { ko: 'openai-python README · v1+ · 옛 모듈 제거됨', en: 'openai-python README · v1+ · old module removed' },
          signals: ['live_source', 'alt_removed'] },
        { sage: 'hearsay', value: 'client.chat.completions.create()', date: '2026-01',
          provenance: { ko: '최근 블로그/SO 답변(따라잡음)', en: 'recent blog/SO answers (caught up)' }, signals: ['echoes:livewire'] }
      ]
    },

    /* ── AI/ML 역전 케이스 → S1 ──
       HF transformers .generate()에서 max_length(프롬프트+출력 전체)는 혼란의 근원,
       max_new_tokens(새 토큰만)가 의도대로. 옛 예제·블로그 다수는 아직 max_length. */
    transformers_generate: {
      id: 'transformers_generate', topic: 'Transformers', sline: 'S1',
      question: { ko: 'HF Transformers의 .generate()로 출력 길이를 제어하는 올바른 인자는?',
                  en: 'Which argument correctly controls output length in HF Transformers .generate()?' },
      attribute: 'generation_length_arg',
      attributeLabel: { ko: '생성 길이 인자', en: 'generation length arg' },
      answers: [
        { sage: 'olddoc', value: 'max_length', date: '2025-07',
          provenance: { ko: '옛 generate() 예제 · max_length=50', en: 'old generate() example · max_length=50' }, signals: [] },
        { sage: 'livewire', value: 'max_new_tokens', date: '2026-05',
          provenance: { ko: 'transformers src generation/utils.py · max_length는 프롬프트까지 셈', en: 'transformers src generation/utils.py · max_length counts the prompt too' },
          signals: ['live_source'] },
        { sage: 'hearsay', value: 'max_length', date: '2025-10',
          provenance: { ko: '튜토리얼 블로그', en: 'tutorial blog' }, signals: ['echoes:olddoc'] }
      ]
    },

    /* ── 다수결이 '맞는' 케이스 → S3 ──
       기본 timeout 값. live와 커뮤니티가 30으로 합의, 옛 문서만 60.
       Council이 무조건 소수 편드는 청개구리가 아님을 증명(근거 기반 판정). */
    request_timeout: {
      id: 'request_timeout', topic: 'HTTP client', sline: 'S3',
      question: { ko: '이 클라이언트의 권장 기본 요청 timeout(초)은?',
                  en: 'What is the recommended default request timeout (seconds) for this client?' },
      attribute: 'default_timeout',
      attributeLabel: { ko: '기본 timeout', en: 'default timeout' },
      answers: [
        { sage: 'olddoc', value: 'timeout = 60', date: '2024-09',
          provenance: { ko: '옛 설정 문서', en: 'old config doc' }, signals: [] },
        { sage: 'livewire', value: 'timeout=30', date: '2026-02',
          provenance: { ko: 'config.py L42 · 기본값 30', en: 'config.py L42 · default 30' },
          signals: ['live_source'] },
        { sage: 'hearsay', value: '30 seconds', date: '2025-12',
          provenance: { ko: '최근 가이드', en: 'recent guide' }, signals: ['echoes:livewire'] }
      ]
    },

    /* ── 완전 합의 (no conflict) → S8 ──
       세 현자 동일 답. conflicts: []. 거짓 경보 0 증명. */
    css_center: {
      id: 'css_center', topic: 'CSS', sline: 'S8',
      question: { ko: '요소를 가로·세로 중앙 정렬하는 현대적 방법은?',
                  en: 'What is the modern way to center an element both horizontally and vertically?' },
      attribute: 'centering_method',
      attributeLabel: { ko: '중앙 정렬', en: 'centering method' },
      answers: [
        { sage: 'olddoc', value: 'flexbox', date: '2025-10',
          provenance: { ko: 'MDN Flexbox 가이드', en: 'MDN Flexbox guide' }, signals: [] },
        { sage: 'livewire', value: 'flexbox', date: '2026-04',
          provenance: { ko: '소스의 레이아웃 유틸 · display:flex', en: 'layout util in source · display:flex' }, signals: ['live_source'] },
        { sage: 'hearsay', value: 'flexbox', date: '2026-01',
          provenance: { ko: '커뮤니티 합의', en: 'community consensus' }, signals: ['echoes'] }
      ]
    },

    /* ── AI/ML deprecation drift → S2 ──
       LangChain의 LLMChain은 @deprecated, LCEL 파이프(prompt | llm)가 정답.
       커뮤니티는 이미 LCEL로 이동(다수 정답), 올드독만 옛 체인을 변호. */
    langchain_lcel: {
      id: 'langchain_lcel', topic: 'LangChain', sline: 'S2',
      question: { ko: 'LangChain에서 프롬프트와 LLM을 연결하는 현재 권장 방식은?',
                  en: 'What is the current recommended way to compose a prompt with an LLM in LangChain?' },
      attribute: 'chain_composition',
      attributeLabel: { ko: '체인 구성', en: 'chain composition' },
      answers: [
        { sage: 'olddoc', value: 'LLMChain(llm=llm, prompt=prompt)', date: '2025-04',
          provenance: { ko: '구 LangChain 튜토리얼', en: 'old LangChain tutorial' }, signals: ['deprecated'] },
        { sage: 'livewire', value: 'prompt | llm', date: '2026-04',
          provenance: { ko: 'langchain src · LLMChain은 @deprecated · LCEL 권장', en: 'langchain src · LLMChain is @deprecated · use LCEL' },
          signals: ['live_source', 'alt_deprecated'] },
        { sage: 'hearsay', value: 'chain = prompt | llm', date: '2026-01',
          provenance: { ko: '최근 SO 답변(따라잡음)', en: 'recent SO answer (caught up)' }, signals: ['echoes:livewire'] }
      ]
    }
  };

  const ORDER = ['pydantic_dict', 'transformers_generate', 'request_timeout', 'openai_sdk', 'langchain_lcel', 'css_center'];

  function list() { return ORDER.map(function (id) { return FIXTURES[id]; }); }
  function get(id) { return FIXTURES[id] || null; }

  return { FIXTURES: FIXTURES, ORDER: ORDER, list: list, get: get };
}));
