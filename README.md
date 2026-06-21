<div align="center">

# 🏙️ Repolis — 레포들의 도시

**핀 6개의 한계를 넘어, 내 모든 GitHub 레포가 사는 걸어다닐 수 있는 3D 도시.**

집 하나하나가 레포예요. 건물의 높이·밝기·화려함·마당은 ⭐가 아니라 **실제 트래픽**(방문자·클론·포크·조회수)으로 자라요.
길을 잃었다면? 🚕 **택시기사 NPC**에게 물어보세요. _"RAG 관련 레포 보여줘"_ 하면 설명해주고, 그 집까지 **자동으로 데려다줍니다.**

[**▶ 라이브 데모**](https://hyeonsangjeon.github.io/Repolis/) · Built with Three.js · 한 개의 `index.html`

</div>

---

## ✨ 무엇이 들어있나

- 🚶 **걸어다니는 오픈월드** — WASD/조이스틱으로 지브리풍 도시를 산책, 집(레포)에 도착하면 카드가 열려요(소셜 프리뷰 포함).
- 🏙️ **도심지 & 홈타운 구역** — 종합 인기 상위 레포는 안쪽 도심지의 타워로, 나머지는 외곽 홈타운의 아늑한 코티지로.
- 📊 **지표가 곧 건축** — 데이터가 도시를 짓습니다:
  | 지표 | 건물에 반영 |
  |---|---|
  | 👁 방문자(unique visitors) | 건물 **높이** · 창문 **밝기** |
  | ⑂ forks | 건물 **너비** |
  | ⬇ clones | **화려함**(깃발·금장식) |
  | 📈 views | **마당**·울타리 크기 |
  | ★ stars | 지붕 위 **금별** 장식 |
- 🚕 **LLM 택시기사** — 자연어로 물어보면 가장 맞는 레포를 골라 안내하고, **자동 주행**으로 그 집까지 데려다줘요. 3가지 모드:
  - **로컬검색** (기본·키 불필요·즉시) — 동의어 확장 인텐트 검색
  - **WebLLM** (브라우저 내장 AI·키 불필요·WebGPU)
  - **AI 프록시** (Vercel → Azure OpenAI·최고 품질)
- 🔎 **길찾기 메뉴** — 검색 + 구역별 그룹, 방문 진행도(n/총합).

## 🧠 어떻게 동작하나 (데이터 흐름)

```
github-traffic-monitor (private)        Repolis (public)
  └ 매일 트래픽 누적(logs/*.csv) ──┐
                                   ├─▶ .github/workflows/refresh.yml (매일)
  gh api: 공개·non-fork 레포 메타 ─┘        └ scripts/build_repos.py
                                              └─▶ repos.json  ──▶  index.html (Three.js 3D 도시)
```

- **공개·non-fork 레포만** 포함합니다 — 비공개 레포 이름이 공개 사이트에 절대 노출되지 않아요.
- 트래픽 합계는 [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor)가 모아 온 **누적값**입니다.

## 🚀 직접 띄우기

1. **이 레포를 Fork/사용** 후, 트래픽 데이터 소스가 필요해요. [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor) 같은 일일 트래픽 수집 레포를 두세요.
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

## 🎮 조작

| 입력 | 동작 |
|---|---|
| `W A S D` / 방향키 / 조이스틱 | 걷기 |
| 마우스 드래그 | 둘러보기 · 휠: 줌 |
| `Enter` / 클릭 | 도착한 레포 열기 |
| 🚕 버튼 | 택시기사에게 묻기 |
| ☰ 버튼 | 길찾기 메뉴(검색) |

## 🛠 기술

Three.js (r0.160) · toon shading + 인버티드-헐 아웃라인 · ACES 톤매핑 · 의존성 빌드 없는 단일 `index.html` · GitHub Actions · (선택) Vercel + Azure OpenAI · WebLLM.

## 🙏 크레딧

데이터: [github-traffic-monitor](https://github.com/hyeonsangjeon/github-traffic-monitor) · 소셜 프리뷰: `opengraph.githubassets.com`.

<div align="center"><sub>Made with ☕ &amp; Three.js — 핀은 6개지만, 레포는 도시가 됩니다. 🏙️</sub></div>
