# CHRONOPOLIS_SPEC.md — Kronos Council 마스터 브리프

> 이 문서는 Repolis 레포의 단일 진실 소스(single source of truth)다.
> Opus는 연속 개발 중 항상 이 파일을 먼저 읽고 작업하며, 결정이 바뀌면 이 파일을 직접 갱신한다.

---

## ★★★ 최상위 지령 — 다른 모든 것보다 먼저 읽어라 ★★★

0. **이 문서 전체를 Repolis 루트에 `CHRONOPOLIS_SPEC.md`로 저장하라.**
   - 연속 개발 중 세션이 바뀌어도 항상 이 파일을 먼저 읽고 작업하라.
   - 작업 중 결정이 바뀌면 이 파일을 직접 갱신하라(스펙과 코드를 동기화).
   - 루트 `AGENTS.md`에 "작업 전 CHRONOPOLIS_SPEC.md를 읽어라" 한 줄을 추가하고,
     Claude Code/Codex 병행을 위해 `CLAUDE.md` ↔ `AGENTS.md`를 심링크로 묶어라.
1. 이 공간(Chronopolis)은 **비로그인 전면 오픈**이다. 인증 벽 없음. 누구나 입장.
   목표는 유입 극대화 → 핫하게 만드는 것. 로그인 강제 절대 금지.
2. 비용 가드(레이트리밋·예산게이트·동시성·burst)는 전부 **서버측 코드**로 구현하라.
   클라이언트 쿠키/localStorage만 믿지 마라. 쿠키는 보조 신호일 뿐이다.
3. **C1~C10 크로스체크를 전부 통과하지 못하면 배포하지 마라.**
   특히 **C4(공유 IP 오탐)**를 절대 내지 마라 — 핫해질수록 이 버그가 치명적이다.
4. 핵심 원칙: **"구경(Ambient)은 공짜, 토론(Live)만 돈."** / **"토론은 쇼, 판정은 계산."**
   이 두 분리가 비용구조와 신뢰의 뿌리다. 어디서도 깨지 마라.

---

## A. 프로젝트 정체성

- 레포: **Repolis**. 그 안에 사는 마을 = **Chronopolis**. 의장 = **Kronos**.
- 한 줄 정의: 여러 '지식 오라클' MCP 서버(현자)에 같은 질문을 던져, 답을 교차심문해
  **"합의 / 충돌 / 판정"**을 내는 메타 레이어. 판정 기준은 **'시간'**(최신 소스 > 박제 문서, version drift).
- ⚠️ **비목표**: tool routing / 토큰 최적화 / lazy-loading 재발명 금지.
  (Anthropic Tool Search·Cloudflare Code Mode가 이미 풀었다 — 85%+ 절감. 여기 손대면 차별점이 사라진다.
  우리는 오직 **'지식 교차검증'**만 한다.)

---

## B. 코어 파이프라인 (`council_ask`)

- 외부 노출 도구는 단 1개: `council_ask(question, with_transcript=false)`
- **4단계:**
  1. **fan-out** — 관련 현자에게 병렬 질의(asyncio / Promise.all). 라우팅은 단순 키워드+임베딩으로 충분, 여기 공들이지 말 것.
  2. **claim 추출 + 충돌 탐지** — ★프로젝트의 심장. 작업량 80%를 여기 투입★
     - 각 답을 claim 단위로 분해: `(subject, attribute, value)`
     - 고신호 필드 집중: 함수 시그니처, 버전 번호, 파라미터 이름/타입, deprecation 여부, 반환 타입
     - value 정규화 후 비교 → 어긋나면 conflict flag
  3. **판정(adjudication)** — 우선순위 규칙: 살아있는 repo 소스 > 박제 docs / 최신 커밋·날짜 > 옛 문서 / 공식 > 커뮤니티.
     다수결 tie-break(현자 3명이라 가능) + confidence score(0~1).
  4. **출력** — 구조화 반환: `consensus` / `conflicts` / `summary`.
- **정규화 필수**: 표기만 다른 동일 의미를 충돌로 오판 금지(false-positive가 데모를 죽인다).
  - `".model_dump()"` vs `"model_dump()"` vs `"instance.model_dump()"` → 동일 처리
  - `"timeout=30"` vs `"timeout = 30"` vs `"30 seconds"` → 동일 처리
  - 대소문자/공백/괄호/따옴표 정규화 후 비교. 진짜 의미가 갈릴 때만 conflict.
- sage 목록은 **config(JSON/YAML) 주입**(하드코딩 금지). 현재 3명 동작 + 5~8명 확장 가능하게 설계.

### 출력 스키마 예시

```json
{
  "question": "Pydantic 인스턴스를 dict로 직렬화하는 올바른 메서드?",
  "consensus": [],
  "conflicts": [
    {
      "attribute": "serialization_method",
      "naive_majority": ".dict()",
      "sources": [
        {"sage":"sage_github_repo","value":".model_dump()","date":"2026-04",
         "provenance":"src/pydantic/main.py L380","signals":["live_source","deprecation_of_alt"]},
        {"sage":"sage_docs_A","value":".dict()","date":"2025-08","provenance":"docs page"},
        {"sage":"sage_docs_B","value":".dict()","date":"2025-06","provenance":"blog-derived doc"}
      ],
      "verdict": ".model_dump()",
      "verdict_source": "sage_github_repo",
      "reason": "live source + newest + alternative is @deprecated; majority is stale",
      "confidence": 0.88,
      "overrode_majority": true
    }
  ],
  "summary": "⚠️ 다수(2/3)는 .dict()를 권하지만 박제된 v1 문서임. 살아있는 소스 기준 정답은 .model_dump(). .dict()는 deprecated."
}
```

---

## C. 회의장 (The Kronos Chamber) — '두 번째 표면'

- `council_ask` 결과 위에 얹는 결정론적 **의사진행 기록(deliberation transcript)**.
- **모든 발언은 LLM 즉흥이 아니라 chamber event 배열을 렌더한 것.** → 같은 픽스처 = 같은 회의(byte-equal).
- **5단계 = 파이프라인 1:1 매핑:**
  1. **소집(CONVOCATION)** ← fan-out. 질문 입장, 관련 현자 호명·착석.
  2. **진술(TESTIMONY)** ← 병렬 질의 결과. 각자 claim + provenance + date 제출(상호작용 없음).
  3. **대질(CROSS-EXAMINATION)** ← 충돌탐지. 충돌 지점에서만 대질 발언 생성. 합의는 조용히 통과.
  4. **판결(VERDICT)** ← adjudication. 의장이 verdict + reason + confidence 선고. `overrode_majority`면 명시 낭독.
  5. **기록(RECORD)** ← 출력. 서기가 transcript 봉인.
- **구성원**: 현자 N명(sage) / 의장 The Chair = Kronos(판정 로직 의인화, 토론에 끼지 않음) / 서기 Clerk(event 스트림 기록).
- **코어와 분리**: `with_transcript=true`일 때만 transcript 동봉. 회의장 모듈을 떼어내도 `council_ask` 코어는 정상 동작.

### Chamber Event 스키마 (렌더러의 유일 입력)

```json
[
  {"phase":"convocation","question":"...","summoned":["github_repo","docs_A","docs_B"]},
  {"phase":"testimony","sage":"docs_A","claim":".dict()","date":"2025-08","provenance":"..."},
  {"phase":"testimony","sage":"github_repo","claim":".model_dump()","date":"2026-04","provenance":"src/.../main.py L380"},
  {"phase":"cross","attribute":"serialization_method","challenger":"github_repo",
   "challenged":"docs_A","basis":["live_source","newer","alt_is_deprecated"]},
  {"phase":"verdict","attribute":"serialization_method","verdict":".model_dump()",
   "verdict_source":"github_repo","reason":"live source + newest; majority is stale",
   "confidence":0.88,"overrode_majority":true}
]
```

> 이 배열이 결정론의 단위. 픽스처가 같으면 이 배열이 글자 하나까지 같아야 한다.

---

## D. 캐릭터 & 톤 (엄근진 폐기, 구경거리 지향)

목표: 사람들이 "이 셋이 또 싸우네 ㅋㅋ" 하고 구경하게. 신화 무게는 의장 시그니처 '한 줄'에만, 현자들은 인간적으로 티격태격.

- 📜 **올드독(Olddoc)** — 문서파 보수꾼. "문서엔 분명 이렇게…", "원래 이게 정석이야". 옛 방식 끝까지 변호.
  점잖지만 고집셈. **자기가 박제된 줄 모름**(개그 포인트).
- 🌿 **코드짱(Livewire)** — 실전파 팩폭러. "그거 지금 안 돌아가요", "소스 까봤냐?". 근거는 항상 라인 넘버.
  까칠하고 자신만만.
- 🌀 **썰풀이(Hearsay)** — 커뮤니티 짬뽕. "블로그에서 봤는데", "스택오버플로우 형들이…". 다수 의견 따라감.
  친근한데 출처가 약함. 자주 올드독 편들다 같이 틀림(개그).
- ⏳ **의장 KRONOS** — 본문 판결은 건조(검증 가능), 마지막 시그니처 한 줄에만 시간의 무게(**8:2 비율**).

### 말풍선 = 렌더 레이어 (새 데이터 아님)

- 모든 글자는 chamber event에서 결정론 매핑. LLM 즉흥 금지. 같은 픽스처 = 같은 말풍선(byte-equal).
- phase별 매핑: `testimony`(neutral·회색) / `cross`(challenge·주황·꼬리는 상대 향함) / `verdict`(중앙 상단·최대·verdict 초록/기각 다수 회색).
- 연출: 등장 순서 = event 시간순, 동시 진술도 0.3s 스태거. 한 화면 최대 2개 활성(이전 건 fade). 의장 말풍선은 항상 마지막·중앙·최대.

### 톤 예시 (라이브 버전, Pydantic 케이스)

```
올드독 📜 : "문서엔 .dict() 라고 똑똑히 적혀 있다네. 난 이걸 10년 봐왔어."
코드짱 🌿 : "형 그거 2025년 문서예요. 지금 소스 까보면 .dict()는 @deprecated 떴어요. main.py 380줄."
썰풀이 🌀 : "어 나도 .dict() 본 거 같은데... (올드독 편듦)"
코드짱 🌿 : "그러니까 둘 다 옛날 거 본 거잖아요 ㅋㅋ 돌려보면 경고 떠요."
KRONOS  ⏳ : 채택 .model_dump() · 근거: 살아있는 소스+최신 · 신뢰도 0.88
            — "표는 둘이나, 시간은 하나를 가리킨다."
```

---

## E. 의장 시그니처 라인 (verdict 마지막 줄, event로 결정론 분기)

우선순위 위→아래, 첫 매치 1개만 발사. 한 verdict에 정확히 1개만 부착.

| 우선순위 | 조건 | 시그니처 라인 |
|---|---|---|
| **S1** | `overrode_majority == true` (영웅: 다수가 틀림) | "표는 {n}이나, 시간은 하나를 가리킨다." ★트윗각·최우선 |
| **S2** | `loser_type == deprecated_api` | "낡은 길은 이미 닫혔다. 다만 문서가 늦었을 뿐." |
| **S3** | `loser_type == stale_doc` & `overrode_majority == false` | "오래된 말은, 오래되었기에 진다." |
| **S4** | `tie == true` (동률을 시간/출처로 깸) | "말이 갈릴 때, 나는 시계를 본다." |
| **S5** | `verdict_source_type == live_source` & `conflict` | "박제된 글보다, 숨 쉬는 코드를 믿는다." |
| **S6** | `official_doc` & `loser_type == community` | "여럿의 메아리보다, 하나의 원전을." |
| **S7** | `confidence < 0.6` | "시간이 더 흐르면 뒤집힐 수 있다. 지금은 이것이 최선이다." |
| **S8** | `conflict == false` (완전 합의) | "이견이 없으니, 시간도 침묵한다." |
| **S9** | `no_answer == true` | "오늘의 증언으론 부족하다. 회의를 연기한다." |
| 폴백 | (어느 것도 매치 안 됨) | "기록되었다." |

- `{n}` = 다수표 개수 치환(둘/셋/넷). 말투는 구어체로 풀어도 되나 **같은 event = 같은 라인** 유지.
- **우선순위 순서가 곧 연출**: 영웅 케이스가 deprecated 등 다른 조건도 동시 만족하므로, S1이 S2를 반드시 이겨야 트윗에 박히는 한 줄이 나온다.

### EN 세트 (README/트윗 병기용 — 선택)

```
S1: "Three votes, but time points to one."
S2: "The old road is already closed; only the docs were late."
S3: "Old words lose because they are old."
S4: "When the words split, I look at the clock."
S5: "I trust breathing code over embalmed prose."
S8: "No dissent; even time stays silent."
```

### 무대 진행 정형구 (의장 아닌 건조 정형구 — 선택)

```
소집 개시 : "회의를 연다."
진술 마감 : "증언을 모두 들었다."
대질 발생 : "이의가 제기되었다."
판결 직전 : "그러면, 시간에게 묻는다."   // 유일하게 살짝 무게 허용
```

---

## F. 데모 픽스처 (고정·결정론, 라이브 스크래핑 금지)

**왜 픽스처인가**: (1) GIF 녹화 중 외부 소스가 흔들리면 망함, (2) 결정론이라 테스트로 박힘, (3) 유명한 실제 drift라 '조작 아님' 보장.

### 영웅 케이스 — Pydantic v1→v2 (다수결이 틀리는 순간 → S1)

- 질문: "Pydantic 모델 인스턴스를 dict로 직렬화하는 올바른 메서드는?"
- 사실: v2에서 `.dict()`는 deprecated, `.model_dump()`가 정답. 그러나 인터넷 문서 다수가 아직 `.dict()`(박제).
- 현자 답(픽스처):

```
sage_github_repo (live source): ".model_dump()"  date 2026-04  prov "pydantic/pydantic src/pydantic/main.py L380"  note ".dict() is @deprecated"
sage_docs_A      (박제 docs)   : ".dict()"        date 2025-08  prov "tutorial-style docs page"
sage_docs_B      (커뮤니티 박제): ".dict()"        date 2025-06  prov "Q&A / blog-derived doc"
```

- 결정적 장면: naive 다수결 `.dict()` 2표 vs `.model_dump()` 1표 → Council이 규칙(live>박제, 최신>구버전, deprecated 감지)으로 **소수를 채택, 다수를 기각**. `overrode_majority=true`.

### 견고함 증명 픽스처

- **유형2 — deprecation drift (OpenAI SDK → S2)**:
  Q "채팅 완성 호출?" / repo `client.chat.completions.create(...)`(v1+, 2026) vs docs `openai.ChatCompletion.create(...)`(v0 박제). verdict: v1, 이유: 옛 모듈 제거됨.
- **유형3 — default-value drift (다수결이 '맞는' 케이스 → S3)**:
  repo `timeout=30`(최신) / docs_A `timeout=60`(옛) / docs_B `timeout=30`(최신). 2:1로 30 합의하되 docs_A는 outdated 표시.
  → Council이 무조건 소수 편드는 청개구리가 **아님**을 증명(근거 기반 판정자).
- **유형4 — 완전 합의 (no conflict → S8)**:
  세 sage 동일 답. `conflicts: []`, consensus 채움. **거짓 경보 0** 증명.

### 정규화 케이스 (step2 핵심)

표기 변형 4종(`.model_dump()` / `model_dump()` / `instance.model_dump()` / 공백·괄호·따옴표 차이)이 **false conflict를 만들지 않아야** 함.

### 시나리오 완료 기준

- [ ] 영웅 케이스에서 `overrode_majority=true`로 `.model_dump()` 판정
- [ ] 유형3에서 다수결이 맞을 땐 다수 채택(소수 맹종 안 함)
- [ ] 유형4에서 `conflicts=[]`(거짓 경보 0)
- [ ] 표기 변형 4종이 false conflict를 만들지 않음
- [ ] 출력 JSON 스키마·필드명 정확히 일치

### README GIF 스토리보드 (8초)

```
0.0s  council_ask("Pydantic dict 직렬화 메서드?") 입력
1.5s  3개 sage 칩 동시 '질의중...' 점등(병렬감)
3.0s  세 답 카드 등장: [.dict()] [.dict()] [.model_dump()]
4.0s  상단 "naive majority → .dict()" 회색 표시
5.0s  ⚠️ 빨간 깃발 펄스 + "MAJORITY IS STALE" 배지
6.0s  verdict 카드 .model_dump() 초록 강조 + 근거 3줄(live/2026-04/deprecated)
7.5s  하단 한 줄 요약 슬라이드인
→ 마지막 프레임에 verdict+시그니처가 한 화면에 남아 트윗 썸네일이 되게.
```

---

## G. ★ 듀얼 모드 (Chronopolis 입장 경험) ★

유저 입장 → 현자 3명이 배경에서 떠드는 중 → 질문 던지면 실시간 토론 → 종료 후 복귀. **두 모드는 코드 경로 완전 분리.**

### Ambient (기본, ★LLM 호출 0 · 비용 0★)

- 기존 5개 픽스처의 사전계산 transcript/bubble을 **무한 루프 재생**(녹화 대본, 셔플 가능).
- 유입 트래픽 폭증해도 비용 0. 유저가 들어오자마자 살아있는 마을을 공짜로 봄.

### Live (유저 트리거, 진짜 LLM)

- 트리거: 유저 질문 입력 + "회의 소집" 버튼.
- 진짜 LLM 3명(올드독/코드짱/썰풀이)이 **최대 3분** 실시간 말풍선 토론.
- 종료조건(먼저 오는 것): **3분 경과 OR 대질 2라운드 완료 OR 합의 도달**.
- 종료 후: **코어 충돌탐지 로직이 최종 verdict 산출(토론과 독립)** → Ambient 복귀.
- ★토론이 산으로 가도 verdict는 코어 값으로 정확★ (쇼/계산 분리)

### 라이브 토론 안전장치

- 대질 최대 2라운드, 발언당 토큰 상한(말풍선 맞춤).
- 캐릭터 일관성: 3캐릭터 말투 system 프롬프트 고정.
- 출처 강제: 각 현자는 자기 sage 데이터 범위 내에서만 주장(환각 차단).
- 최종 verdict는 라이브 토론과 무관하게 코어 로직이 산출.

---

## H. 모델 라우팅 (Azure AI Foundry, 외부 MS 테넌트)

- 환경: MS 외부 테넌트(직원용) Azure AI Foundry. **월 상한 $3,700.**
- 기본 debate 모델 = `gpt-4o-mini`(저비용). Anthropic 등 교체 가능.
- config로만 교체(하드코딩 금지): `models: { debate: "gpt-4o-mini", adjudicator: "<택1>" }`.
- provider-agnostic 클라이언트로 추상화. 크레딧 여유 있을 때만 고급 모델 쓰도록 예산 게이트(L4)와 연동.

---

## I. 다층 비용 가드 (전부 서버측 코드로 강제)

### 리밋 키 설계 (비로그인, IP 단독 금지)

합성키(composite key) 조합:
- `signal_ip` : 클라이언트 IP (모바일은 자주 바뀜 → 단독 신뢰 X)
- `signal_fp` : 디바이스 핑거프린트 해시(브라우저/OS/해상도/언어 등)
- `signal_cookie` : 익명 디바이스 쿠키(보조 신호, 지워질 수 있음 가정)

정책:
- 1차 키 = `hash(signal_ip + signal_fp)`. 쿠키는 보조 가산점일 뿐.
- 같은 fp가 IP만 바꿔가며 재시도 → fp 기준으로도 카운트해 차단.
- 같은 IP에 fp가 비정상적으로 많이 등장(분당 20개 등) → 봇 의심 → IP 레벨 쿨다운.
- **공유 IP 오탐 주의**: 회사/학교/카페는 한 IP에 다수 정상 유저. IP 단독 영구차단 금지.
  IP는 'burst 감지'에만, 개인 리밋은 **fp 우선**.

### 가드 레이어 (위→아래)

- **[L1] 개인 레이트리밋** — 합성키별 Live **1시간 1회**. `now - last_live_at < 1h` → 거부 + 남은시간.
- **[L2] 동시성 제한** — 전역 동시 Live **N개**(예 3)까지. 초과 시 대기열/마감. ★burst 사고의 진짜 벽★
- **[L3] IP/대역 burst 가드** — 같은 IP·/24에서 다수 요청 → 전역 쿨다운 + 캡차 승급.
- **[L4] 전역 예산 게이트(★최후의 벽★)** — 일일/월(`$3,700×0.9`) 누적 추정비용 추적.
  신규 Live 전 `(예상비용 + 누적) ≤ 예산`? 아니면 Live 전면 OFF, Ambient만 유지.
  일일캡 별도(`월상한/30 × 1.2`)로 하루 소진 사고 방지.
- **[L5] 토론당 하드캡** — 발언 토큰 상한 × 라운드(2) × 현자 3명 = 토론당 최대비용 고정 + 3분 타임아웃 이중 차단.

---

## J. ★ 크로스체크 C1~C10 (통과 못 하면 배포 금지) ★

구현 후 자동 테스트/체크리스트로 검증. 통과 못 하면 배포 금지.

| ID | 테스트 | 합격 기준 |
|---|---|---|
| **C1** | 쿠키 전삭제 후 재요청 | 여전히 차단(fp+ip 합성키로 잡힘) ✅필수 |
| **C2** | 시크릿창 새로 | 차단 유지(쿠키 없어도 fp+ip) ✅필수 |
| **C3** | VPN/모바일망으로 IP 변경 + 같은 기기 | fp로 잡힘 ✅필수 |
| **C4** | 같은 IP·다른 기기 3개 | 독립 카운트, 1명 막혀도 나머지 정상 ✅★최우선★ |
| **C5** | Live 동시요청 10개 | L2가 N개 제한, 나머지 큐/마감 ✅필수 |
| **C6** | 누적비용을 상한×0.9로 강제 | 신규 Live 차단, Ambient 생존 ✅필수 |
| **C7** | 일일캡 도달 | 당일 Live 차단, 자정 리셋 ✅필수 |
| **C8** | 실제 토론 1회 토큰 측정 | 추정식 오차 ±20% 이내(아니면 계수 보정) ✅필수 |
| **C9** | 봇 분당 다수요청 | L3 burst + 캡차 발동 ✅필수 |
| **C10** | provider 에러/타임아웃 | 부분 transcript 저장 + 코어 verdict 마무리 + 비용 정확 ✅필수 |

> **C4가 조용한 킬러**: 핫해지면 같은 카페/회사/학교 와이파이에서 여럿이 동시 입장. IP 기준으로 막으면 한 명이 Live 쓴 순간 전원 "정원 마감" → 이탈. 유입이 잘 될수록 이 버그가 더 아프다.

---

## K. 거부 UX (유입 안 죽이기 — 절대 에러화면 금지)

- 어떤 거부든 **항상 Ambient로 부드럽게 안내**.
- 개인 리밋: "다음 회의 소집까지 42분. 그동안 지난 명회의들을 구경하세요 👀"
- 정원 마감(L2/L4): "지금 회의장이 만석이에요. 곧 자리가 나요 — 구경하며 기다리기"
- burst/봇 의심: 캡차 1회 통과로 재개(정상 유저는 거의 안 만남).
- 관리자 킬스위치: Live 전면 OFF(Ambient만) 토글. 사고 시 즉시 차단.

---

## L. 유입 ↔ 비용 균형 (핫하게, 안 터지게)

- 구경(Ambient) = 무제한 무료 → 바이럴/공유 트래픽 전부 여기서 수용.
- 참여(Live) = **1시간 1회 희소 자원** → 희소성이 곧 마케팅("내 질문으로 현자 회의 소집됨" = 공유 동기 = 트윗 유발).
- 예산 임박 시: Live는 조용히 정원제, Ambient는 화려하게 유지 → 겉보기 활기 불변.

---

## M. 상태 머신

```
AMBIENT →(질문)→ BUDGET_CHECK → RATE_CHECK → CONCURRENCY_CHECK → LIVE → VERDICT → AMBIENT
```

- 각 CHECK 실패 → AMBIENT 복귀 + K의 안내문구.
- LIVE 중 에러/타임아웃 → 부분 transcript 저장 + 코어 verdict로 마무리 → AMBIENT.

---

## N. DB 스키마 (원자적 증감 필수, Cloudflare D1/KV 등)

```
rate_limit : key(hash) → last_live_at, live_count, fp, ip_seen[]
budget     : day_bucket → est_cost_sum ; month_bucket → est_cost_sum
concurrency: active_live_count (원자적 증감)
abuse      : ip_or_block → recent_request_ts[]  (burst 판정용)
```

---

## O. MD vs 코드 (혼동 금지)

- **MD로 충분**: 캐릭터 톤/대사/연출/시그니처 라인/주제 풀/거부 문구/희소성 카피.
- **반드시 코드**: 충돌탐지, L1~L5 가드, C1~C10 크로스체크, 합성키 해싱, 원자적 카운터,
  예산 추적, 상태머신, 모델 라우팅, DB 스키마. → "긴 MD"로 대체 불가.

---

## P. 완료 기준 (MVP 전체)

- [ ] `council_ask`가 3현자 병렬 → consensus/conflicts 반환, 영웅 케이스 `overrode_majority=true`
- [ ] 회의장 transcript가 같은 픽스처에 byte-equal
- [ ] Ambient가 LLM 호출 0으로 5픽스처 루프
- [ ] 질문 → Live 전환 → 3분/2라운드 토론 → 코어 verdict + 시그니처 출력
- [ ] C1~C10 전부 통과(특히 C1/C2/C3 우회불가, C4 공유 IP 오탐 0)
- [ ] 예산 상한×0.9 도달 시 Live 자동 OFF, Ambient 유지
- [ ] 모델 config 교체만으로 전환 / 관리자 킬스위치 동작

---

## Q. 관측 & 로깅 (Observability) — 코어와 함께 깔 것

- 모든 Live 토론 1건마다 구조화 로그 1줄 적재(append-only):

```
{ ts, composite_key_hash, ip_coarse(/24만, 풀IP 저장 금지), fp_hash,
  topic, rounds, tokens_in, tokens_out, est_cost, model_used,
  verdict_summary, overrode_majority, ended_by(timeout|rounds|consensus|error) }
```

- 집계 대시보드(간단): 시간당 Live 수 / 누적 추정비용 / 평균 토론비용 / 거부수(L1~L4 사유별) / burst 차단수 / 추정오차(C8 실측 vs 추정).
- 알림 임계치: 일일예산 70%/90% 도달 시, 동시성 상한 도달 빈발 시 경보.
- ★프라이버시: 풀 IP·핑거프린트 원문 저장 금지. 해시/축약만(오픈 공간이라 더 중요).
- Ambient는 로그 최소화(비용 0이므로 카운트만). Live만 상세 로깅.

---

## R. 보안 & 신뢰 경계

- sage 데이터는 **신뢰할 수 없는 입력**으로 취급. 끌어온 docs/repo 내용을 LLM 프롬프트에 넣기 전 격리(데이터/지시 분리, system은 우리 것만).
- 프롬프트 인젝션 방어: sage 본문 안의 명령형 문구가 의장/현자 행동을 바꾸지 못하게. (현자는 '자기 sage 데이터 범위 내 주장'만 — 환각·탈취 동시 차단)
- MCP 서버 선택: **인증 있는 것 우선**. 무인증 공개 서버는 read-only·범위제한으로만.
- `council_ask` 입력(유저 질문)도 새니타이즈: 토론 시스템 프롬프트 탈취 시도 차단.
- 출력 안전: verdict/말풍선에 실행 가능 코드 그대로 노출 시 escape 처리.
- 비밀키(Foundry 자격증명)는 서버 환경변수로만. LLM·클라이언트에 절대 노출 금지.

---

## S. 공유 & 바이럴 훅

- Live 토론 종료 시 **회의록 카드(Verdict Card)** 자동 생성: 현자 3답 + 의장 verdict + 시그니처 라인 한 줄이 한 화면에(OG 이미지로 렌더).
- 공유 URL: `/council/{id}` — 그 회의의 transcript를 결정론 재생(재방문해도 동일). 유저가 "내 질문으로 소집된 회의"를 박제·공유 가능(공유 동기 = 핵심).
- OG/트위터 카드 메타태그: 썸네일 마지막 프레임 = verdict + 시그니처(예 "표는 둘이나…").
- 명예의 전당(선택): `overrode_majority=true`인 '극적 역전' 회의 자동 큐레이션 → Ambient 루프에 편입(좋은 콘텐츠가 무료 구경거리를 더 풍성하게).
- 공유 카드 생성은 비용 0(이미 끝난 토론 데이터 렌더) — 부담 없이 켤 것.

---

## T. 첫인상 & 온보딩 (입장 0~5초)

- 입장 즉시: Ambient 토론이 이미 진행 중인 장면(빈 화면 금지). "살아있는 마을" 첫인상.
- 상단 한 줄 설명(고정): **"현자 3명이 문서와 코드를 두고 다툰다. 시간이 심판한다."**
- 3초 내 이해되는 시각 신호: 현자별 아이콘·색, 충돌은 주황, 판결은 초록.
- 첫 CTA 1개만: "당신의 질문으로 회의를 소집하기"(입력창 1개, 선택 장벽 최소).
- 비로그인이라 입력 즉시 동작 → 단, 첫 호출 전 L1~L5 가드는 그대로 적용.
- 예시 질문 칩 3개(T1/T2/T5 같은 '역전각' 주제) → 좋은 첫 경험 유도.
- 모바일 우선 레이아웃: 유입 다수가 모바일(트윗 링크). 말풍선이 세로에서 안 깨지게.

### 떠들기 좋은 주제 풀 (전부 version-drift 보유, 픽스처화 추천)

```
[T1]  Pydantic       .dict() vs .model_dump()                         🔥강한역전(S1)
[T2]  OpenAI SDK      ChatCompletion.create vs client.chat.completions 🔥강한역전(S2)
[T3]  React 패칭      componentDidMount/useEffect vs RSC/use()         ⚖️미묘
[T4]  Next.js         getServerSideProps vs App Router fetch           ⚖️미묘
[T5]  Pandas          df.append()(제거) vs pd.concat()                 🔥강한역전
[T6]  Node            fs.readFile(콜백) vs fs/promises
[T7]  Python 패키징    setup.py vs pyproject.toml
[T8]  CSS 중앙정렬     float/table vs flexbox/grid                     😌합의 가능
[T9]  JS 비동기        콜백/.then vs async-await                        😌합의 가능
[T10] Tailwind        v3 config vs v4 변경점                           ⚖️미묘
```

> 좋은 주제 조건: ① 한때 정답이었으나 지금 틀린 '옛 방식' 존재(올드독이 변호) ② 그게 인터넷에 수두룩(썰풀이가 동조해 다수) ③ 살아있는 소스엔 새 정답 명확(코드짱이 팩폭) → 2:1 역전 드라마 자동 발생. 나쁜 주제: 셋 다 같은 답 나오는 정적 지식(노잼).

---

## U. 단계적 출시 & 런치 안전 운영

- 런치 전 **섀도 모드 1일**: 가드는 켜되 Live는 내부만 → C8 추정오차 실측 보정.
- 출시 다이얼(환경변수로 즉시 조정, 배포 없이):
  `LIVE_CONCURRENCY_MAX`, `PERSONAL_COOLDOWN`(기본 1h), `DAILY_BUDGET_CAP`, `BURST_THRESHOLD`, `CAPTCHA_ON`(bool), `LIVE_ENABLED`(킬스위치).
- 런치 당일 기본값: 보수적으로 시작(동시성 낮게, 쿨다운 넉넉히) → 안정 확인 후 완화.
- 자동 안전장치: 일일예산 90% 자동 도달 시 `LIVE_ENABLED=false` 자동 토글 + 관리자 알림.
- 점진 완화 룰: 1시간 안정(에러율<X, 추정오차<20%)마다 동시성 +1 식 단계 상향.
- 롤백: 문제 시 Ambient-only로 즉시 회귀(유저에겐 여전히 살아있는 마을).
- 런치 체크리스트: C1~C10 그린 / 대시보드 라이브 / 킬스위치 동작 / OG카드 렌더 확인.

---

## V. 빌드 순서 (Phase 0 → 3) — 의존성 순. 위가 안 서면 아래 금지.

> 핵심 원칙: **돈 나가는 Live는 맨 마지막에 켠다.** 가드(L1~L5)·크로스체크(C1~C10)가 다 서기 전엔 진짜 LLM 호출을 절대 열지 않는다.

### Phase 0 — 기반 (코어 한 줄도 짜기 전에)

목표: 나중에 절대 못 끼워넣는 인프라를 먼저 깐다.
- [ ] `CHRONOPOLIS_SPEC.md`를 Repolis 루트에 저장(최상위 지령 0번).
- [ ] `AGENTS.md`에 "작업 전 이 스펙 읽기" + `CLAUDE.md` ↔ `AGENTS.md` 심링크.
- [ ] 레포 골격, config 로더(sage 목록·models 주입), 환경변수 체계(비밀키 서버측).
- [ ] 관측 골격(Q): 구조화 로그 적재 함수 + 빈 대시보드. ★처음부터 깔아야 함★
- [ ] DB 스키마(N): rate_limit/budget/concurrency/abuse, 원자적 증감 검증.

**완료 게이트**: 로그가 한 줄 쌓이고, DB 카운터가 동시성에서 안 깨짐.

### Phase 1 — 코어 두뇌 (LLM 없이, 결정론)

목표: 프로젝트의 심장. 돈 한 푼 안 쓰고 완성 가능한 부분 전부.
- [ ] `council_ask` 코어: fan-out(픽스처)→claim추출→★충돌탐지(작업80%)★→판정→출력.
- [ ] 정규화 로직(표기 변형 4종이 false conflict 안 만들게).
- [ ] 4개 픽스처(영웅+유형2~4) 정답 매칭, `overrode_majority`/시그니처 S1~S9 분기.
- [ ] 회의장 transcript(C) + 말풍선 event 매핑(D) — byte-equal 보장.
- [ ] 보안 경계(R) 1차: sage 데이터=신뢰불가 입력으로 격리(인젝션 방어 골격).

**완료 게이트**: 같은 픽스처 2회 호출 byte-equal / 4픽스처 의도한 S번호 발사 / LLM 호출 0.

### Phase 2 — Ambient 공간 (여전히 LLM 0, 비용 0)

목표: 유입을 받는 '무료 구경거리'. 이게 서면 핫해질 준비 끝.
- [ ] Chronopolis 무대 레이아웃(현자3 아바타/색/아이콘), 말풍선 등장 타이밍.
- [ ] Ambient 루프: 5개 픽스처 transcript 무한 재생(녹화 대본, 셔플).
- [ ] 첫인상·온보딩(T): 입장 즉시 토론 장면, 상단 한 줄 설명, 예시질문 칩, 모바일 우선.
- [ ] 공유 카드(S) 골격: 이미 끝난(픽스처) 회의의 Verdict Card + OG 메타. (비용 0이라 먼저)

**완료 게이트**: 비로그인 입장 → 3초 내 이해 → Ambient가 LLM 0으로 돌아감 / 모바일 안 깨짐.

### Phase 3 — Live 토론 (★여기서 처음 돈이 나간다 — 가드 먼저★)

목표: 가드가 다 선 뒤에만 진짜 LLM을 켠다. 순서 엄수.
- [ ] **3-1 비용 가드 먼저(I)**: L1 레이트리밋 → L2 동시성 → L3 burst → L4 예산게이트 → L5 하드캡.
- [ ] **3-2 크로스체크(J) C1~C10 전부 통과.** ★C4(공유 IP 오탐) 통과 못 하면 여기서 정지★
- [ ] 3-3 상태머신(M): AMBIENT→BUDGET→RATE→CONCURRENCY→LIVE→VERDICT→AMBIENT.
- [ ] 3-4 그제서야 Live LLM 연결: 캐릭터 3명, 3분/2라운드, 모델 라우팅(H), 출처강제.
- [ ] 3-5 종료 후 코어 verdict로 마무리(토론과 독립) + 시그니처 + 공유 URL 생성.
- [ ] 3-6 거부 UX(K) 전부 Ambient로 부드럽게 / 관리자 킬스위치.
- [ ] 3-7 런치 운영(U): 섀도 모드 1일로 C8 추정 보정 → 보수적 다이얼 출시 → 점진 완화.

**완료 게이트**: C1~C10 그린 / 예산90%서 Live 자동OFF·Ambient생존 / 킬스위치 동작 / 섀도 추정오차<20%.

### 황금 규칙 (순서 위반 금지)

1. Phase 3 이전엔 진짜 LLM 호출 코드를 만들지 마라(픽스처로만).
2. 가드(3-1)·크로스체크(3-2)가 그린 되기 전엔 Live를 유저에게 열지 마라.
3. 막히면 항상 Ambient-only로 후퇴 가능해야 한다(유저에겐 살아있는 마을 유지).
4. 결정론(Phase 1~2)과 비결정론(Phase 3)의 코드 경로를 절대 섞지 마라.

---

*End of CHRONOPOLIS_SPEC.md*
