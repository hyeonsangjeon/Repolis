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
      tags: ['pydantic', 'fastapi', 'serialization', 'validation', 'schema'],
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
      tags: ['openai', 'azure-openai', 'gpt', 'gpt-5', 'chatgpt', 'completion'],
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
      tags: ['transformers', 'huggingface', 'nlp', 'llm', 'text-generation', 'language-model'],
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

    /* ── 데이터/ML 영웅 케이스: 다수가 아직 옛 길 → S1 ──
       pandas 2.0(2023-04)에서 DataFrame.append는 '제거'됨. 정답은 pd.concat.
       옛 튜토리얼과 SO 답변 다수는 아직 df.append → 다수결(2표)이 박제된 옛 API,
       살아있는 소스만 concat을 가리킨다. 다수결이 틀리는 순간(S1). */
    pandas_concat: {
      id: 'pandas_concat', topic: 'pandas', sline: 'S1',
      tags: ['pandas', 'dataframe', 'data-analysis', 'data-extraction', 'numpy', 'csv'],
      question: { ko: '두 DataFrame을 행 방향으로 이어 붙이는 올바른 방법은?',
                  en: 'What is the correct way to concatenate two DataFrames row-wise?' },
      attribute: 'dataframe_concat',
      attributeLabel: { ko: '데이터프레임 연결', en: 'dataframe concatenation' },
      answers: [
        { sage: 'olddoc', value: 'df.append(df2)', date: '2025-06',
          provenance: { ko: '옛 pandas 튜토리얼 · DataFrame.append', en: 'old pandas tutorial · DataFrame.append' }, signals: ['removed'] },
        { sage: 'livewire', value: 'pd.concat([df1, df2])', date: '2026-05',
          provenance: { ko: 'pandas src · DataFrame.append는 2.0에서 제거됨 · concat 사용', en: 'pandas src · DataFrame.append removed in 2.0 · use concat' },
          signals: ['live_source', 'alt_removed'] },
        { sage: 'hearsay', value: 'df.append([row])', date: '2025-10',
          provenance: { ko: 'SO 상위 답변(옛 패턴)', en: 'top SO answer (old pattern)' }, signals: ['echoes:olddoc'] }
      ]
    },

    /* ── 다수결이 '맞는' 케이스 → S3 ──
       기본 timeout 값. live와 커뮤니티가 30으로 합의, 옛 문서만 60.
       Council이 무조건 소수 편드는 청개구리가 아님을 증명(근거 기반 판정). */
    request_timeout: {
      id: 'request_timeout', topic: 'HTTP client', sline: 'S3',
      tags: ['requests', 'http', 'timeout', 'scraping', 'crawler', 'queue'],
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
      tags: ['css', 'html', 'frontend', 'flexbox', 'layout', 'tailwind', 'bootstrap'],
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
      tags: ['langchain', 'chain', 'agent', 'prompt', 'llmops'],
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
    },

    /* ── 동점 케이스 → S4 ──
       JS 깊은 복사: 직렬화 핵 / lodash / 네이티브 structuredClone. 셋 다 권위는 비등(커뮤니티),
       표는 1·1·1로 갈린다. 결정적 권위가 없을 때 의장은 '시계'(가장 최신 표준)를 본다. */
    js_deepcopy: {
      id: 'js_deepcopy', topic: 'JavaScript', sline: 'S4',
      tags: ['javascript', 'typescript', 'nodejs', 'clone', 'json'],
      question: { ko: 'JavaScript에서 객체를 깊은 복사하는 현대적 표준 방법은?',
                  en: 'What is the modern standard way to deep-copy an object in JavaScript?' },
      attribute: 'deep_copy_method',
      attributeLabel: { ko: '깊은 복사', en: 'deep copy' },
      answers: [
        { sage: 'olddoc', sourceType: 'community', value: 'JSON.parse(JSON.stringify(obj))', date: '2024-03',
          provenance: { ko: '옛 블로그의 직렬화 핵', en: 'old blog serialization hack' }, signals: [] },
        { sage: 'hearsay', sourceType: 'community', value: '_.cloneDeep(obj)', date: '2025-02',
          provenance: { ko: 'lodash 의존 답변', en: 'lodash-dependent answer' }, signals: [] },
        { sage: 'livewire', sourceType: 'community', value: 'structuredClone(obj)', date: '2026-03',
          provenance: { ko: '네이티브 structuredClone(2022+ 베이스라인)', en: 'native structuredClone (2022+ baseline)' }, signals: [] }
      ]
    },

    /* ── 살아있는 소스 케이스 → S5 ──
       React 마운트 부수효과: 문서와 라이브 소스가 useEffect로 일치(다수), 옛 커뮤니티만 클래스 시절
       componentDidMount를 반복. 박제된 메아리보다 숨 쉬는 코드를 믿는다. */
    react_effect: {
      id: 'react_effect', topic: 'React', sline: 'S5',
      tags: ['react', 'reactjs', 'frontend', 'hooks', 'jsx', 'nextjs', 'vite'],
      question: { ko: 'React 함수 컴포넌트에서 마운트 직후 부수효과를 실행하는 방법은?',
                  en: 'How do you run a side effect right after a React function component mounts?' },
      attribute: 'mount_side_effect',
      attributeLabel: { ko: '마운트 부수효과', en: 'mount side effect' },
      answers: [
        { sage: 'olddoc', value: 'useEffect(fn, [])', date: '2025-05',
          provenance: { ko: 'React 공식 문서 Effect 가이드', en: 'React docs Effects guide' }, signals: [] },
        { sage: 'livewire', value: 'useEffect(fn, [])', date: '2026-04',
          provenance: { ko: 'react src · 함수형 훅', en: 'react src · function hooks' }, signals: ['live_source'] },
        { sage: 'hearsay', value: 'componentDidMount()', date: '2024-02',
          provenance: { ko: '옛 클래스 컴포넌트 블로그', en: 'old class-component blog' }, signals: ['echoes:olddoc'] }
      ]
    },

    /* ── 공식 원전 케이스 → S6 ──
       리소스 생성 성공 코드: 공식 표준(RFC)과 그것을 반복한 커뮤니티가 201로 일치(다수),
       라이브 현자는 이번엔 라이브 코드가 아니라 흔한 구현 습관(200 남용)을 들고 와 패배.
       여럿의 메아리보다 하나의 원전을. */
    http_created: {
      id: 'http_created', topic: 'HTTP', sline: 'S6',
      tags: ['http', 'rest', 'api', 'backend', 'express', 'bottle', 'flask', 'websocket', 'login-system'],
      question: { ko: 'REST에서 리소스 생성에 성공했을 때 권장 응답 상태 코드는?',
                  en: 'Which response status code is recommended when a REST resource is created successfully?' },
      attribute: 'created_status_code',
      attributeLabel: { ko: '생성 성공 코드', en: 'created status code' },
      answers: [
        { sage: 'olddoc', sourceType: 'official_doc', value: '201 Created', date: '2025-09',
          provenance: { ko: 'RFC 9110 §15.3.2 (공식 표준)', en: 'RFC 9110 §15.3.2 (official standard)' }, signals: [] },
        { sage: 'hearsay', value: '201 Created', date: '2024-11',
          provenance: { ko: '커뮤니티 가이드(원전 반복)', en: 'community guide (echoing the spec)' }, signals: ['echoes:olddoc'] },
        { sage: 'livewire', sourceType: 'community', value: '200 OK', date: '2026-03',
          provenance: { ko: '흔한 구현 습관(200 남용)', en: 'common impl habit (200 overuse)' }, signals: [] }
      ]
    },

    /* ── AI/ML 살아있는 소스 케이스 → S5 ──
       PyTorch 추론 시 그래디언트 차단: 문서·라이브 소스가 torch.no_grad()로 일치(다수),
       흔한 오해(model.eval()만으로 grad가 꺼진다)는 커뮤니티 패자. */
    torch_nograd: {
      id: 'torch_nograd', topic: 'PyTorch grad', sline: 'S5',
      tags: ['pytorch', 'torch', 'inference', 'deep-learning', 'cuda', 'gpu', 'finetuning', 'unsloth', 'distillation'],
      question: { ko: 'PyTorch에서 추론 시 그래디언트 계산을 끄는 올바른 방법은?',
                  en: 'What is the correct way to disable gradient computation during inference in PyTorch?' },
      attribute: 'disable_grad',
      attributeLabel: { ko: '그래디언트 비활성화', en: 'disable gradients' },
      answers: [
        { sage: 'olddoc', value: 'torch.no_grad()', date: '2025-04',
          provenance: { ko: 'PyTorch 공식 추론 튜토리얼', en: 'PyTorch inference tutorial' }, signals: [] },
        { sage: 'livewire', value: 'torch.no_grad()', date: '2026-03',
          provenance: { ko: 'torch src · autograd 컨텍스트 매니저', en: 'torch src · autograd context manager' }, signals: ['live_source'] },
        { sage: 'hearsay', value: 'model.eval()', date: '2024-08',
          provenance: { ko: '흔한 혼동: eval()만으로 grad가 꺼진다는 오해', en: 'common mix-up: eval() alone disables grad' }, signals: ['echoes'] }
      ]
    },

    /* ── AI/ML 공식 원전 케이스 → S6 ──
       PyTorch 기본 부동소수 dtype: 공식 문서와 그 메아리가 float32로 일치(다수),
       NumPy 습관에서 온 오해(float64)가 패배. 원전이 메아리들을 이긴다. */
    tensor_dtype: {
      id: 'tensor_dtype', topic: 'PyTorch dtype', sline: 'S6',
      tags: ['pytorch', 'torch', 'tensor', 'dtype', 'deep-learning'],
      question: { ko: 'PyTorch에서 torch.tensor([1.0, 2.0])의 기본 부동소수점 dtype은?',
                  en: 'What is the default floating-point dtype of torch.tensor([1.0, 2.0]) in PyTorch?' },
      attribute: 'default_float_dtype',
      attributeLabel: { ko: '기본 dtype', en: 'default dtype' },
      answers: [
        { sage: 'olddoc', sourceType: 'official_doc', value: 'torch.float32', date: '2025-07',
          provenance: { ko: 'PyTorch 공식 문서 · 기본 dtype', en: 'PyTorch docs · default dtype' }, signals: [] },
        { sage: 'hearsay', value: 'torch.float32', date: '2024-12',
          provenance: { ko: '커뮤니티 답변(문서 반복)', en: 'community answer (echoing docs)' }, signals: ['echoes:olddoc'] },
        { sage: 'livewire', sourceType: 'community', value: 'torch.float64', date: '2026-02',
          provenance: { ko: 'NumPy 습관에서 온 오해(float64)', en: 'mix-up from NumPy habit (float64)' }, signals: [] }
      ]
    },

    /* ── AI/ML 잠정 케이스 → S7 ──
       장문 처리(RAG vs 롱컨텍스트): 어느 쪽도 확정 권위가 없는 진행형 논쟁이라 셋 다 커뮤니티 의견.
       최신 흐름(맞으면 직접 주입)이 다수지만 'tentative' 신호로 잠정. 시간이 더 흐르면 뒤집힐 수 있다. */
    rag_longctx: {
      id: 'rag_longctx', topic: 'LLM', sline: 'S7',
      tags: ['rag', 'retrieval', 'embedding', 'vector', 'knowledge', 'bedrock', 'sagemaker', 'llm'],
      question: { ko: '긴 문서를 LLM에 넣어 질문할 때, RAG 검색과 롱컨텍스트 직접 주입 중 무엇이 권장되나?',
                  en: 'For querying a long document with an LLM, is retrieval (RAG) or long-context direct injection recommended?' },
      attribute: 'long_doc_strategy',
      attributeLabel: { ko: '장문 처리 전략', en: 'long-doc strategy' },
      answers: [
        { sage: 'olddoc', sourceType: 'community', value: 'always chunk and retrieve (RAG)', date: '2024-05',
          provenance: { ko: '2024년 통념: 무조건 청크+검색', en: '2024 conventional wisdom: always chunk + retrieve' }, signals: [] },
        { sage: 'livewire', sourceType: 'community', value: 'inject the full context when it fits', date: '2026-04',
          provenance: { ko: '롱컨텍스트 모델 등장 후 최신 흐름(미확정)', en: 'emerging post-long-context view (unsettled)' }, signals: ['tentative'] },
        { sage: 'hearsay', sourceType: 'community', value: 'inject the full context when it fits', date: '2025-09',
          provenance: { ko: '최근 실무자 의견', en: 'recent practitioner take' }, signals: [] }
      ]
    }
  };

  const ORDER = ['pydantic_dict', 'transformers_generate', 'pandas_concat', 'request_timeout', 'openai_sdk', 'langchain_lcel', 'css_center', 'js_deepcopy', 'react_effect', 'http_created', 'torch_nograd', 'tensor_dtype', 'rag_longctx'];

  function list() { return ORDER.map(function (id) { return FIXTURES[id]; }); }
  function get(id) { return FIXTURES[id] || null; }

  return { FIXTURES: FIXTURES, ORDER: ORDER, list: list, get: get };
}));
