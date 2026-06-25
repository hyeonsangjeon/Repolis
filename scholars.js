/* scholars.js — Repolis 밤하늘의 현자들 (oracles)
 *
 * 각 현자 = 하나의 별 + 신화의 혼 + 단 하나의 MCP 지식 소스(신탁).
 * index.html이 <script src>로 먼저 불러오는 전역 데이터 모듈 (window.SCHOLARS).
 * 빌드 스텝 0 · 의존성 0 · file:// 안전(클래식 스크립트).
 *
 *   별 이름표는 머리 위에,  별자리는 밤하늘에,  신화는 페르소나에 깃든다.
 *
 * constellation: center 방향(az 방위 · el 고도, 라디안)을 정하고, 그 접평면에
 * [u,v] 각도 오프셋으로 별을 찍은 뒤 edges로 잇는다. primary = 그 현자의 '별'(으뜸별) 인덱스.
 * active:true 인 현자만 실제로 밤하늘에 그려지고 마을에 소환된다.
 */
(function () {
  const OWNER = 'hyeonsangjeon', OWNER_KO = '전현상', OWNER_EN = 'Hyeon Sang Jeon';

  const SCHOLARS = [
    {
      id: 'polaris', kind: 'taxi', active: true, emoji: '🚕',
      star: 'POLARIS', epithetEn: 'the Wayfinder', epithetKo: '길잡이',
      mythEn: 'Hermes', mythKo: '헤르메스',
      color: 0xfff0d6, auraColor: 0xffe0a0,
      domainKo: '레포 세계의 길', domainEn: 'the roads of the repo-world',
      ks: 'github-repos-mcp-ks', kb: 'repolis-github-kb',
      constellation: { // 작은곰자리(Ursa Minor) — POLARIS는 꼬리 끝의 북극성
        nameKo: '작은곰자리', nameEn: 'Ursa Minor',
        az: 0.0, el: 1.18,
        nodes: [[0, 0], [0.045, 0.030], [0.092, 0.052], [0.150, 0.044], [0.165, -0.012], [0.118, -0.040], [0.073, -0.018]],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]],
        primary: 0
      },
      persona: {
        ko: {
          greet: '밤하늘 아래 어서오세요! 🚕 저는 <b>POLARIS</b> · 길잡이, 길을 밝히는 북극성이에요. 어떤 레포로 모실까요? 예: <b>제일 인기있는 레포</b>, <b>AI 에이전트</b>, <b>STT</b>',
          who: '저는 <b>POLARIS</b> · the Wayfinder 🚕 길의 전령 <i>헤르메스</i>의 혼을 품은 북극성이에요. 이 도시 <b>Repolis</b>는 ' + OWNER_KO + '(' + OWNER + ')님의 GitHub 세계이고, 저는 손님을 어떤 레포 집이든 모셔다드려요. 어디로 갈까요?',
          help: '레포를 찾아 그 집까지 태워다드려요 🚕 “제일 인기있는 레포”, “RAG”, “최근에 뭐 푸시했어?”처럼 물어보세요. 북극성이 길을 잃지 않듯, 저도 길을 잃지 않아요.'
        },
        en: {
          greet: 'Welcome under the night sky! 🚕 I\'m <b>POLARIS</b> · the Wayfinder, the pole star that lights the way. Where shall I take you? e.g. <b>most popular repo</b>, <b>AI agents</b>, <b>STT</b>',
          who: 'I\'m <b>POLARIS</b> · the Wayfinder 🚕 the pole star carrying the spirit of <i>Hermes</i>, messenger of the ways. This city, <b>Repolis</b>, is ' + OWNER_EN + '\'s (' + OWNER + ') GitHub world, and I drive you to any repo\'s house. Where to?',
          help: 'I find repos and drive you to their houses 🚕 Try “most popular”, “RAG”, or “what did I push recently?” Like the pole star, I never lose the way.'
        }
      },
      backstory: {
        ko: OWNER_KO + '님의 도시 Repolis에서 길을 밝히는 북극성. 모든 레포 집의 위치를 알고, github-repos-mcp-ks 신탁으로 어떤 저장소든 찾아 데려다준다.',
        en: 'The pole star lighting the ways of ' + OWNER_EN + '\'s Repolis. Knows every repo\'s address and, through the github-repos-mcp-ks oracle, drives you to any of them.'
      }
    },
    {
      id: 'vega', kind: 'msdocs', active: true, emoji: '📘',
      star: 'VEGA', epithetEn: 'the Archivist', epithetKo: '기록보관자',
      mythEn: 'Daidalos', mythKo: '다이달로스',
      color: 0xbcd0ff, auraColor: 0x9fc0ff,
      domainKo: 'Microsoft의 지식', domainEn: 'the knowledge of Microsoft',
      ks: 'microsoft-learn-mcp-ks', kb: 'repolis-mslearn-kb',
      constellation: { // 거문고자리(Lyra) — VEGA가 으뜸별(직녀성)
        nameKo: '거문고자리', nameEn: 'Lyra',
        az: 1.55, el: 0.78,
        nodes: [[0, 0], [0.028, -0.052], [0.069, -0.036], [0.060, -0.092], [0.020, -0.100]],
        edges: [[0, 1], [0, 2], [1, 2], [1, 4], [2, 3], [3, 4]],
        primary: 0
      },
      persona: {
        ko: {
          greet: '별빛 아래 인사드려요 📘 저는 <b>VEGA</b> · 기록보관자, 직녀성의 빛으로 <b>Microsoft Learn</b> 공식 문서를 읽어드리는 별 읽는 현자예요. 무엇이 궁금하세요? 예: <b>Azure AI Foundry 에이전트</b>, <b>Azure AI Search</b>',
          who: '저는 <b>VEGA</b> · the Archivist 📘 장인 <i>다이달로스</i>의 혼을 지닌, 별을 읽는 기록보관자예요. 한때 북극성이었던 직녀성의 빛으로, ' + OWNER_KO + '(' + OWNER + ')님의 도시 Repolis에서 Microsoft의 지식을 벼려 답해요. 무엇이 궁금하세요?',
          help: 'Azure·.NET·Copilot 같은 Microsoft 기술을 물어보세요 📘 microsoft-learn-mcp-ks 신탁으로 <b>공식 문서</b>를 실시간으로 읽어, 여러분의 언어로 정리해 드려요. 예: “Azure AI Foundry 에이전트 만드는 법”.'
        },
        en: {
          greet: 'Greetings under the starlight 📘 I\'m <b>VEGA</b> · the Archivist, the star-reader who reads the official <b>Microsoft Learn</b> docs by Vega\'s light. What do you need? e.g. <b>Azure AI Foundry agent</b>, <b>Azure AI Search</b>',
          who: 'I\'m <b>VEGA</b> · the Archivist 📘 a star-reading keeper carrying the spirit of <i>Daidalos</i> the artificer. By the light of Vega — once the pole star — I forge Microsoft\'s knowledge in ' + OWNER_EN + '\'s (' + OWNER + ') city, Repolis. What would you like to know?',
          help: 'Ask about Azure, .NET, Copilot and other Microsoft tech 📘 Through the microsoft-learn-mcp-ks oracle I read the <b>official docs</b> in real time and compose the answer in your language. e.g. “how to build an Azure AI Foundry agent”.'
        }
      },
      backstory: {
        ko: OWNER_KO + '님의 도시 Repolis 광장의 별 읽는 마법사. 직녀성 VEGA의 빛과 다이달로스의 솜씨로, microsoft-learn-mcp-ks 신탁을 통해 Microsoft Learn 공식 문서를 실시간으로 읽어 답한다.',
        en: 'The star-reading mage in the plaza of ' + OWNER_EN + '\'s Repolis. By Vega\'s light and Daidalos\'s craft, reads the official Microsoft Learn docs in real time through the microsoft-learn-mcp-ks oracle.'
      }
    },

    {
      id: 'rigel', kind: 'deepwiki', active: true, emoji: '🗺️',
      star: 'RIGEL', epithetEn: 'the Cartographer', epithetKo: '지도제작자',
      mythEn: 'Ariadne', mythKo: '아리아드네',
      color: 0x7fe3da, auraColor: 0x57ccc2,
      domainKo: '레포의 내부 구조', domainEn: 'a repo\'s inner architecture',
      ks: 'deepwiki-mcp-ks', kb: 'repolis-deepwiki-kb',
      constellation: { // 오리온자리(Orion) — RIGEL은 발끝의 청백색 별
        nameKo: '오리온자리', nameEn: 'Orion',
        az: 5.60, el: 0.50,
        nodes: [[0, 0], [0.052, 0.085], [0.104, 0.150], [0.040, 0.066], [0.078, 0.066], [0.118, 0.066], [0.135, 0.150], [-0.010, -0.020], [0.160, 0.044]],
        edges: [[0, 3], [3, 1], [1, 2], [2, 6], [6, 8], [8, 5], [5, 4], [4, 3], [4, 7]],
        primary: 0
      },
      persona: {
        ko: {
          greet: '별빛 지도를 펼치며 인사드려요 🗺️ 저는 <b>RIGEL</b> · 지도제작자, 아리아드네의 실을 풀어 어떤 코드의 미궁이든 그 안의 길을 비춰드리는 현자예요. 어떤 레포의 미궁을 함께 그려볼까요? <b>owner/repo</b>로 알려주세요. 예: <b>facebook/react</b>의 재조정 원리, <b>langchain-ai/langchain</b>의 구조',
          who: '저는 <b>RIGEL</b> · the Cartographer 🗺️ 미궁에 실을 드리운 <i>아리아드네</i>의 혼을 품은, 오리온자리 발끝의 청백색 별이에요. ' + OWNER_KO + '(' + OWNER + ')님의 도시 <b>Repolis</b>에서, <b>DeepWiki</b> 신탁으로 세상 어떤 공개 레포든 그 내부 아키텍처를 읽어 지도처럼 펼쳐드려요. 어떤 코드의 미궁이 궁금하세요?',
          help: '레포를 <b>owner/repo</b> 형식으로 알려주세요 🗺️ DeepWiki 신탁이 미리 탐사해 둔 레포라면, 내부 구조·아키텍처·동작 원리를 지도처럼 풀어드려요. 예: “<b>facebook/react</b> 재조정은 어떻게 동작해?”, “<b>vercel/next.js</b> 라우팅 구조”. 아직 탐사되지 않은 레포는 deepwiki.com에서 인덱싱하면 제가 읽을 수 있어요.',
          title: '🗺️ RIGEL · 지도제작자',
          ph: '어떤 레포의 구조가 궁금하세요? 예: facebook/react',
          searching: '아리아드네의 실을 따라 레포의 미궁을 그려볼게요 🗺️🧵',
          none: '그 레포는 아직 DeepWiki에 탐사되지 않았나 봐요 🗺️ <b>owner/repo</b> 형식이 맞는지 확인해 주시거나, deepwiki.com에서 인덱싱해 주세요.',
          err: '미궁을 그리는 중 실이 엉켰어요 😅 잠시 후 다시 시도해 주세요.',
          noBackend: '레포 탐사 백엔드(DeepWiki MCP)가 연결돼 있지 않아요. 라이브 사이트에서 사용해 주세요 🗺️',
          ask: '어떤 레포의 미궁을 그려드릴까요? <b>owner/repo</b> 형식으로 알려주세요 🗺️ 예: <b>facebook/react</b>, <b>vercel/next.js</b>',
          thanks: '미궁을 무사히 빠져나오셨다니 기뻐요 🗺️ 또 그릴 지도가 있으면 불러주세요.',
          bye: '좋은 항해 되세요 🗺️ 길을 잃으면 언제든 실타래를 들고 찾아올게요.',
          how: '저는 늘 새 미궁의 지도를 그리고 있죠 🗺️ 어떤 레포의 구조가 궁금하세요? <b>owner/repo</b>로 알려주세요.',
          nice: '별빛에 비춰주셔서 고마워요 😊 또 어떤 레포를 그려드릴까요?'
        },
        en: {
          greet: 'Unrolling a map of starlight 🗺️ I\'m <b>RIGEL</b> · the Cartographer — the scholar who lights the way through any code-labyrinth by unspooling Ariadne\'s thread. Which repo\'s maze shall we chart? Name it as <b>owner/repo</b>. e.g. <b>facebook/react</b>\'s reconciliation, <b>langchain-ai/langchain</b>\'s architecture',
          who: 'I\'m <b>RIGEL</b> · the Cartographer 🗺️ the blue-white star at Orion\'s foot, carrying the spirit of <i>Ariadne</i> who strung the thread through the labyrinth. In ' + OWNER_EN + '\'s (' + OWNER + ') city, <b>Repolis</b>, I read the inner architecture of any public repo through the <b>DeepWiki</b> oracle and chart it like a map. Which code-maze are you curious about?',
          help: 'Name a repo as <b>owner/repo</b> 🗺️ If the DeepWiki oracle has already surveyed it, I\'ll unfold its inner structure, architecture and how it works — like a map. e.g. “how does <b>facebook/react</b> reconciliation work?”, “<b>vercel/next.js</b> routing structure”. A repo that isn\'t surveyed yet can be indexed at deepwiki.com so I can read it.',
          title: '🗺️ RIGEL · the Cartographer',
          ph: 'Which repo\'s structure? e.g. facebook/react',
          searching: 'Following Ariadne\'s thread through the repo\'s labyrinth 🗺️🧵',
          none: 'That repo doesn\'t seem to be surveyed on DeepWiki yet 🗺️ Check the <b>owner/repo</b> spelling, or index it at deepwiki.com.',
          err: 'The thread tangled while charting the maze 😅 Please try again.',
          noBackend: 'The repo-survey backend (DeepWiki MCP) isn\'t connected. Try it on the live site 🗺️',
          ask: 'Which repo\'s maze shall I chart? Name it as <b>owner/repo</b> 🗺️ e.g. <b>facebook/react</b>, <b>vercel/next.js</b>',
          thanks: 'Glad you made it out of the maze 🗺️ Call me whenever there\'s another to chart.',
          bye: 'Fair voyage 🗺️ If you ever lose the way, I\'ll be here with the thread.',
          how: 'Always charting some new labyrinth 🗺️ Which repo\'s structure are you curious about? Name it as <b>owner/repo</b>.',
          nice: 'Thank you for the starlight 😊 Which repo shall I chart next?'
        }
      },
      backstory: {
        ko: OWNER_KO + '님의 도시 Repolis 광장의 지도제작자. 오리온자리 발끝의 청백색 별 RIGEL의 빛과 아리아드네의 실타래로, deepwiki-mcp-ks 신탁을 통해 어떤 공개 GitHub 레포든 그 내부 구조·아키텍처를 실시간으로 읽어 지도처럼 펼쳐 설명한다.',
        en: 'The cartographer in the plaza of ' + OWNER_EN + '\'s Repolis. By the light of Orion\'s blue-white star RIGEL and Ariadne\'s thread, reads the inner structure and architecture of any public GitHub repo in real time through the deepwiki-mcp-ks oracle, charting it like a map.'
      }
    },
    /* —— 아직 소환되지 않은 현자들 (밤하늘에 별자리 좌표만 예약) —— */
    {
      id: 'mira', kind: 'context7', active: false, emoji: '⏳',
      star: 'MIRA', epithetEn: 'the Timekeeper', epithetKo: '시간지기',
      mythEn: 'Kairos', mythKo: '카이로스',
      color: 0xffd9b0, auraColor: 0xffc890,
      domainKo: '라이브러리의 최신·버전', domainEn: 'libraries\' latest versions',
      ks: '(context7-mcp-ks)', kb: '',
      constellation: { // 고래자리(Cetus) — MIRA는 맥동하는 심장(변광성)
        az: 3.90, el: 0.42,
        nodes: [[0, 0], [0.050, 0.030], [0.100, 0.010], [0.140, 0.050], [0.082, -0.044], [0.030, -0.060]],
        edges: [[0, 1], [1, 2], [2, 3], [1, 4], [0, 5]],
        primary: 0
      }
    },
    {
      id: 'lyra', kind: 'huggingface', active: false, emoji: '🔥',
      star: 'LYRA', epithetEn: 'the Forgemaster', epithetKo: '창조의 대장장이',
      mythEn: 'Orpheus', mythKo: '오르페우스',
      color: 0xffe0c0, auraColor: 0xff9a6a,
      domainKo: '모델·데이터셋·논문', domainEn: 'models, datasets and papers',
      ks: '(huggingface-mcp-ks)', kb: '',
      constellation: { // 거문고자리의 리라(오르페우스의 현악기)
        az: 2.60, el: 0.62,
        nodes: [[0, 0], [0.030, -0.052], [0.072, -0.040], [0.060, -0.094], [0.018, -0.104]],
        edges: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
        primary: 0
      }
    },
    {
      id: 'deneb', kind: 'memory', active: false, emoji: '🧠',
      star: 'DENEB', epithetEn: 'the Rememberer', epithetKo: '기억지기',
      mythEn: 'Mnemosyne', mythKo: '므네모시네',
      color: 0xeaf3ff, auraColor: 0xcfe0ff,
      domainKo: '세션을 넘는 기억', domainEn: 'memory across sessions',
      ks: '(memory-kv)', kb: '',
      constellation: { // 백조자리(Cygnus)의 북십자 — DENEB은 꼬리 끝의 별
        az: 0.90, el: 0.66,
        nodes: [[0, 0], [0, -0.060], [0, -0.120], [0, -0.176], [0.092, 0.010], [-0.092, 0.010]],
        edges: [[0, 1], [1, 2], [2, 3], [1, 4], [1, 5]],
        primary: 0
      }
    }
  ];

  // —— 전역 노출 (index.html 모듈에서 window 으로 읽는다) ——
  window.SCHOLAR_OWNER = { id: OWNER, ko: OWNER_KO, en: OWNER_EN };
  window.SCHOLARS = SCHOLARS;
  window.scholarByKind = function (k) { return SCHOLARS.find(function (s) { return s.kind === k; }); };
  window.activeScholars = function () { return SCHOLARS.filter(function (s) { return s.active; }); };
})();
