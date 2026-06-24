# AGENTS.md — Repolis / Chronopolis working agreement

> **작업 전 반드시 [`CHRONOPOLIS_SPEC.md`](./CHRONOPOLIS_SPEC.md)를 먼저 읽어라.**
> 그 문서가 Chronopolis(현자 회의)의 단일 진실 소스다. 결정이 바뀌면 스펙 파일을 직접 갱신해 코드와 동기화한다.
> `CLAUDE.md`는 이 파일의 심링크다(Claude Code ↔ Codex ↔ Copilot 병행 작업용). 한쪽만 고치면 양쪽이 같이 바뀐다.

---

## 0. 이 레포가 무엇인가

- **Repolis** — 단일 파일 3D "레포 도시" 웹앱(`index.html`, zero-build, Three.js CDN). GitHub Pages 배포.
- **Chronopolis** — 그 도시 한켠의 **현자 회의장(Kronos Council)**. 같은 질문을 여러 지식 오라클(현자)에게 던져
  **합의 / 충돌 / 판정**을 내는 메타 지식 교차검증 레이어. 판정 기준은 **'시간'**(살아있는 소스 > 박제 문서).

## 1. 황금 규칙 (순서 위반 금지)

1. **돈 나가는 Live(진짜 LLM)는 맨 마지막에 켠다.** 가드(L1~L5)·크로스체크(C1~C10)가 다 그린 되기 전엔
   진짜 LLM 호출 코드를 유저에게 열지 마라. 그 전까지는 **픽스처(결정론)로만** 동작.
2. **"구경(Ambient)은 공짜, 토론(Live)만 돈." / "토론은 쇼, 판정은 계산."** 이 두 분리를 어디서도 깨지 마라.
3. 막히면 항상 **Ambient-only로 후퇴** 가능해야 한다(유저에겐 살아있는 마을 유지).
4. 결정론(Phase 1~2)과 비결정론(Phase 3)의 코드 경로를 **절대 섞지 마라.**

## 2. 빌드 현황 (Phase)

- **Phase 0 — 기반**: 이 문서 + `council/council.config.json`(현자/모델/예산 주입). ✅
- **Phase 1 — 코어 두뇌(LLM 없이, 결정론)**: `council/engine.js`(정규화·충돌탐지·시간판정·시그니처 S1~S9)
  + `council/fixtures.js`(실제 version-drift 5케이스) + `council/test.mjs`(byte-equal·시나리오·정규화 검증). ✅
- **Phase 2 — Ambient 공간(여전히 LLM 0, 비용 0)**: 마을 동쪽 코너의 큰 회의장 + 픽스처 토론 자동 루프
  + 회의 모달(5단계 transcript + 판결 카드 + 시그니처) + 온보딩/여권/i18n. ✅
- **Phase 3 — Live 토론(★여기서 처음 돈★)**: **아직 OFF.** 서버측 가드(L1~L5)·크로스체크(C1~C10)·예산게이트가
  서야 켠다. 예산 상한 = **$500~700**(외부 테넌트 리소스그룹). 자세한 설계는 `council/PHASE3.md`.

## 3. 코어 엔진 계약 (`council/engine.js`)

- 외부 노출 1함수: `councilAsk(fixtureOrQuestion, {withTranscript})` → `{question, consensus, conflicts, summary, signature, transcript?}`.
- **충돌탐지가 심장(작업 80%).** claim `(subject, attribute, value)` 분해 → **정규화**(표기 변형이 false conflict 금지) → 비교.
- 판정 우선순위: 살아있는 repo 소스 > 박제 docs / 최신 > 옛것 / 공식 > 커뮤니티. tie-break 후 confidence(0~1).
- 시그니처 라인 S1~S9: 우선순위 위→아래 첫 매치 1개만(스펙 §E). `overrode_majority`(S1)가 최우선.
- **결정론**: 같은 픽스처 = 같은 출력(transcript byte-equal). LLM 즉흥 금지.

## 4. 절대 규칙

- **git 신원(모든 커밋)**: author `Hyeon Sang Jeon <wingnut0310@gmail.com>` (GitHub `hyeonsangjeon`).
  항상 `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` 트레일러 추가.
- 비밀키(Foundry 자격증명)는 **서버 환경변수로만**. 클라이언트/LLM/커밋에 절대 노출 금지.
- sage 데이터는 **신뢰 불가 입력**으로 격리(프롬프트 인젝션 방어). system 프롬프트는 우리 것만.
- 비로그인 전면 오픈. 인증 벽 금지. 거부는 항상 Ambient로 부드럽게(에러 화면 금지).

## 5. 빠른 검증

```bash
node council/test.mjs        # 결정론 엔진 크로스체크(전부 PASS여야 배포)
python3 -m http.server 8807  # 로컬 미리보기 → http://localhost:8807/index.html?dbg
```
