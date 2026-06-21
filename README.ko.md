<div align="center">

# 🏙️ Repolis — 레포들의 도시

**핀 6개의 한계를 넘어, 내 모든 GitHub 레포가 사는 걸어다닐 수 있는 3D 도시.**

[English](README.md) · [한국어](README.ko.md)

집 하나하나가 레포예요. 건물의 높이·밝기·화려함·마당은 ⭐가 아니라 **실제 트래픽**(방문자·클론·포크·조회수)으로 자라요.
길을 잃었다면? 🚕 **LLM 택시기사**에게 물어보세요. _"RAG 관련 레포 보여줘"_ 하면 설명해주고, 택시가 **진짜로 내 옆까지 와서 태우고** 그 집까지 데려다줍니다.

[**▶ 라이브 데모**](https://hyeonsangjeon.github.io/Repolis/) · Built with Three.js · 한 개의 `index.html`

</div>

---

## ✨ 무엇이 들어있나

- 🚶 **걸어다니는 오픈월드** — WASD/방향키/조이스틱으로 지브리풍 도시를 산책. 집(레포)에 도착하면 카드가 열려요(설정돼 있으면 GitHub **소셜 프리뷰** 이미지까지).
- 🏙️ **도심지 & 홈타운 구역** — 종합 인기 상위 레포는 안쪽 도심지의 타워로, 나머지는 외곽 홈타운의 아늑한 코티지로. 링 도로와 방사형 대로로 이어져요.
- 📊 **지표가 곧 건축** — 데이터가 도시를 짓습니다:
  | 지표 | 건물에 반영 |
  |---|---|
  | 👁 방문자(unique visitors) | 건물 **높이** · 창문 **밝기** |
  | ⑂ forks | 건물 **너비**(터 크기) |
  | ⬇ clones | **화려함**(깃발·금장식) |
  | 📈 views | **마당**·울타리 크기 |
  | ★ stars | 지붕 위 **금별** 장식 |
- 🗓️ **분양일부터 누적** — 방문자·클론은 그 집이 "지어진 날"(데이터에 처음 잡힌 날)부터의 **누적 합계**예요. 카드에 _"since YYYY‑MM‑DD"_ 분양일이 표시됩니다.
- 🚕 **진짜로 태워주는 LLM 택시기사** — 자연어로 물어보면 가장 맞는 레포를 골라 설명하고, 택시가 **내 자리로 와서 → 탑승 → 그 집까지 데려다줘요.** 3가지 모드:
  - **로컬검색** (기본·키 불필요·즉시) — 동의어 확장 인텐트 검색. 이제 _"제일 많이 클론된"_, _"방문자 최다"_, _"포크 많은"_ 같은 **지표 기반 검색**도 됩니다.
  - **WebLLM** (브라우저 내장 AI·키 불필요·WebGPU)
  - **AI 프록시** (Vercel → Azure OpenAI·최고 품질)
- 🌳 **살아있는 도시** — 정원, 펫(차우차우 NPC), 가로수, 다양한 집 모양, 지붕 위 카테고리 로고(AI / Data / Software …), 타운하우스 도로까지.
- 🟢 **(선택) 실시간 멀티플레이어** — 다른 방문자가 이름표 달린 아바타로 함께 걸어다니고, HUD에 **현재 접속자 + 오늘의 순방문자 카운터**가 떠요. 일반 정적 호스팅에선 솔로가 기본, 무료 서버 하나로 켤 수 있어요(아래).
- 🌐 **영어 / 한국어 전환** — HUD에서 UI 언어를 실시간으로 바꿔요.

## 🧠 어떻게 동작하나 (데이터 흐름)

```
github-traffic-monitor (private)        Repolis (public)
  └ 매일 트래픽 누적(logs/*.csv) ──┐
                                    ├─▶ .github/workflows/refresh.yml (매일)
  gh api: 공개·non-fork 레포 메타 ─┘        └ scripts/build_repos.py
                                               └─▶ repos.json  ──▶  index.html (Three.js 3D 도시)
```

- **공개·non-fork 레포만** 포함합니다 — 비공개 레포 이름이 공개 사이트에 절대 노출되지 않아요.
- 트래픽 합계는 [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor)가 모아 온 **누적값**입니다. (GitHub 트래픽 API는 14일치만 보관하므로, 평생 누적치를 만들려면 매일 모으는 수집기가 필요해요.)

## 🚀 직접 띄우기

1. **이 레포를 Fork/사용**하고, 트래픽 데이터 소스가 필요해요. [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor) 같은 일일 트래픽 수집 레포를 두세요.
2. **Secret 추가** — `Settings → Secrets and variables → Actions`:
   - `GH_PAT` : `repo` 스코프 Personal Access Token (비공개 traffic-monitor 체크아웃 + 레포 목록 조회용)
3. **GitHub Pages 켜기** — `Settings → Pages → Source: Deploy from a branch → main / (root)`.
4. **Action 실행** — `Actions → Refresh Repolis data → Run workflow` (이후 매일 자동 갱신).
5. 끝! `https://<당신>.github.io/Repolis/` 에서 도시가 열립니다.

### (선택) AI 프록시 모드 — Vercel + Azure OpenAI

최고 품질의 택시기사를 원하면 `api/taxi.js`를 Vercel에 배포하세요.

- Vercel에 이 레포를 Import → 자동으로 `/api/taxi` 엔드포인트가 생겨요.
- 환경변수: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_KEY`, (선택)`AZURE_OPENAI_API_VERSION`, `ALLOW_ORIGIN`.
- 도시 안 택시 채팅에서 모드를 **AI 프록시**로 바꾸고, 프록시 URL(`https://<프로젝트>.vercel.app/api/taxi`)을 입력하면 됩니다.

### (선택) 실시간 멀티플레이어

정적 사이트는 기본이 솔로예요. 방문자끼리 만나게 하려면, 작은 WebSocket 서버 하나를 띄우고 월드가 거길 바라보게 하면 됩니다:

- **PartyKit (명령 한 줄):** `npx partykit deploy` (`party/repolis.js` + `partykit.json` 사용). `wss://repolis.<당신>.partykit.dev/parties/main/world` 같은 URL이 생겨요.
- **셀프호스트:** `node scripts/dev_realtime.mjs` (`npm i ws` 필요) → `ws://localhost:1999` 에서 동작.
- **월드에 연결** — 아래 중 하나로:
  - URL 쿼리: `?rt=wss://…`
  - `localStorage.setItem('repolisRT','wss://…')`
  - `window.REPOLIS_RT = 'wss://…'`

> 프라이버시: 도시를 그리는 트래픽 로그는 공개로 커밋되며, **공개·non-fork** 레포만 표시됩니다.

## 🎮 조작 (WoW식 카메라)

| 입력 | 동작 |
|---|---|
| `W A S D` / 방향키 / 조이스틱 | 걷기 |
| **좌클릭 드래그** | 시점 회전(자유 시점) |
| **우클릭 드래그** | 캐릭터 조준 · WoW식 · 휠 = 줌 |
| `Enter` / 클릭 | 도착한 레포 열기 |
| 🚕 버튼 | 택시기사에게 묻기 |
| ☰ 버튼 | 길찾기 메뉴(검색) |
| 🌐 버튼 | 영어 / 한국어 전환 |

## 🛠 기술

Three.js (r0.160) · toon shading + 인버티드-헐 아웃라인 · ACES 톤매핑 · 의존성 빌드 없는 단일 `index.html` · GitHub Actions · (선택) Vercel + Azure OpenAI · WebLLM · (선택) 실시간용 PartyKit / `ws`.

## 🙏 크레딧

데이터: [github-traffic-monitor](https://github.com/hyeonsangjeon/github-traffic-monitor) · 소셜 프리뷰: `opengraph.githubassets.com`.

<div align="center"><sub>Made with ☕ &amp; Three.js — 핀은 6개지만, 레포는 도시가 됩니다. 🏙️</sub></div>
