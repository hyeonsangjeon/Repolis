<div align="center">

<a href="https://hyeonsangjeon.github.io/Repolis/"><img src="assets/banner.svg" alt="Repolis — 레포들의 도시" width="80%"></a>

# Repolis — 레포들의 도시

[English](README.md) · [한국어](README.ko.md)

**Repolis는 공개 GitHub 레포를 직접 걸어 다니는 3D 마을로 바꿉니다. 트래픽이 건물을 만들고, 주민이 살아가며, 깃버가 원하는 프로젝트까지 데려갑니다.**

[![라이브 마을 열기](https://img.shields.io/badge/%EB%9D%BC%EC%9D%B4%EB%B8%8C-%EB%A7%88%EC%9D%84%20%EC%97%B4%EA%B8%B0-4fb4c2?style=for-the-badge&logo=googlechrome&logoColor=white)](https://hyeonsangjeon.github.io/Repolis/)
**[공개 GitHub 마을 방문 →](https://hyeonsangjeon.github.io/Repolis/?user=mrdoob)**

<a href="https://hyeonsangjeon.github.io/Repolis/"><img src="assets/demo.ko.gif" alt="Repolis 데모: 트래픽으로 지은 살아 있는 GitHub 마을, 깃버 검색과 택시 이동, 실제 레포 카드" width="92%"></a>

<sub>가입 없음 · 빌드 없음 · 키보드, 터치, 모바일 조작 지원 · <strong><a href="#60초-로컬-실행">로컬 실행</a></strong></sub>

[![매일 갱신](https://img.shields.io/github/actions/workflow/status/hyeonsangjeon/Repolis/refresh.yml?style=flat-square&label=daily%20refresh&logo=githubactions&logoColor=white)](https://github.com/hyeonsangjeon/Repolis/actions/workflows/refresh.yml)
[![Three.js](https://img.shields.io/badge/Three.js-r160-000000?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![빌드 없음](https://img.shields.io/badge/runtime-zero%20build-83bb59?style=flat-square)](index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-a0a0a0?style=flat-square)](LICENSE)

</div>

## 레포 데이터로 지은 도시

Repolis는 공개 GitHub 메타데이터와 누적 트래픽을 또 하나의 대시보드가 아니라 실제 장소로 바꿉니다.

| 신호 | 마을에 나타나는 모습 |
|---|---|
| 순방문자 | 건물 높이 |
| 포크 | 터와 건물 너비 |
| 클론 | 깃발과 금장식 |
| 조회수 | 정원과 울타리 크기 |
| 스타 | 지붕 장식 |
| 최근 활동 | 밤에 빛나는 창문 |

레포는 주제별 구역으로 나뉘고 도로, 표지판, 구역 허브, 세계 지도로 연결됩니다. 주인 마을은 누적 트래픽 기록과 GitHub API로 매일 갱신되며, `?user=<login>`을 붙이면 누구의 공개 레포든 가벼운 마을로 만들 수 있습니다.

## 실제로 살아가는 마을

- **주민은 제자리 반복 동작만 하지 않습니다.** 여덟 주민이 자기 구역을 거닐고, 시간대에 맞춰 생활하며, 기분이 바뀌고, 아끼는 아지트를 찾습니다. 친구를 알아보고 함께 산책하거나 나란히 쉬며, 모닥불에 모이고, 때로는 새 릴리스 축제를 엽니다. 두 주민은 플레이어 지시나 AI 호출 없이 실제 꽃밭·별이 보이는 밤하늘·실제 레포 집으로 짧은 **함께하는 기쁨** 나들이도 스스로 떠납니다. 전문 질문을 받으면 아는 척하지 않고 맞는 현자를 소개합니다. 나침반을 따라 마을 안에서 그 현자를 직접 찾아가세요.
- **탐험에는 흐름이 남습니다.** 탐험 여권이 집과 명소 방문을 기록하고, 구역 진행률이 남은 곳을 보여주며, 매일 열리는 **마을 이야기**가 한 주민과 그 아지트, 실제로 이어진 레포 또는 구역을 연결합니다.
- **매일 갱신되는 이유가 재방문에서 보입니다.** 여권의 **마을 소식**은 이 브라우저가 마지막으로 읽은 공개 레포 스냅샷과 현재를 비교해 새 레포·제공되는 경우의 릴리스 태그·푸시·양의 지표 성장을 보여줍니다. 전부 로컬에서 계산되어 비용이 없습니다.
- **레포끼리의 관계도 보입니다.** 별빛 전망대는 공통 주제나 언어를 바탕으로 실제 세 레포의 연결을 찾고, 밤하늘 저장소 별자리 탐사로 펼칩니다.
- **명소가 프로젝트의 이야기를 품습니다.** 기여 도서관은 논문·발표·오픈소스 기여·수상을 보관하고, 크로노폴리스에는 시간의 회의가 열립니다. 운하, 광장, 전망대, 공원, 놀이 구역은 도시를 직접 걸을 이유를 만듭니다.
- **월드 트리가 스카이라인을 받칩니다.** [threejs-sculpt-dna](https://github.com/hyeonsangjeon/threejs-sculpt-dna) Copilot 플러그인으로 생성한 결정적 코드 네이티브 Three.js 조형물이며, 가지에 뿌리내린 잎, 살아 있는 움직임, 나무에만 격리된 블룸을 갖습니다.

## 마을에 물어보기

| 안내자 | 이렇게 물어보세요 | 답하는 방식 |
|---|---|---|
| **깃버 · POLARIS** | “AI 에이전트 레포로 가자”, “클론이 가장 많은 곳” | 기본은 로컬 색인 검색, 선택한 집까지 실제 운행 |
| **VEGA · 기록자** | Azure, .NET, Copilot, Microsoft 제품 | Microsoft Learn 근거 검색과 출처 |
| **RIGEL · 지도제작자** | 공개 레포가 내부에서 어떻게 동작하는지 | DeepWiki 기반 탐색 |
| **MIRA · 시간지기** | 최신 라이브러리 API와 버전별 예제 | Context7 직접 조회 · 문서 구역 순회 |
| **LYRA · 창조의 대장장이** | 공개 모델·데이터셋·ML 논문 | Hugging Face 직접 검색 · AI 구역 순회 |
| **시간의 회의** | 기술 선택이나 서로 다른 주장 | 큐레이트된 결정적 판정과, 미검증으로 명시된 선택형 라이브 토론 |

백엔드가 없어도 마을은 동작합니다. **로컬** 검색은 즉시 실행되고 키가 필요 없으며, **WebLLM**은 선택형 브라우저 내 추론입니다. 라이브 데모는 Cloudflare Worker를 통해 근거 있는 답변과 공식 공개 MCP 조회를 더합니다. 서비스가 없으면 로컬 검색이나 솔로 플레이로 자연스럽게 전환됩니다.

## 60초 로컬 실행

```bash
git clone https://github.com/hyeonsangjeon/Repolis
cd Repolis
python3 -m http.server 8000
# http://localhost:8000 열기
```

설치나 빌드 단계가 없습니다. Three.js는 CDN import map으로 불러오고, 로컬 데이터와 모듈은 정적 파일로 제공됩니다.

GitHub와 누적 트래픽 기록으로 주인 마을을 다시 만들려면:

```bash
gh auth login
GTM_DIR=data python3 scripts/build_repos.py
```

`repos.json`은 생성 파일입니다. JSON을 직접 고치지 말고 빌더를 변경하세요.

## 내 도시로 만들기

가장 빠른 미리보기에는 포크도 필요 없습니다. `https://hyeonsangjeon.github.io/Repolis/?user=<login>`을 여세요.

누적 트래픽을 가진 영구 도시를 운영하려면:

1. 이 저장소를 포크하고 [github-traffic-monitor](https://github.com/hyeonsangjeon/github-traffic-monitor) 같은 일일 수집기를 유지합니다.
2. 갱신 워크플로에 필요한 Actions 시크릿 `GH_PAT`을 설정합니다.
3. 저장소 루트의 `main` 브랜치에서 GitHub Pages를 활성화합니다.
4. **Refresh Repolis data**를 한 번 실행하면 이후 매일 자동으로 이어집니다.

공개 레포만 마을에 나타납니다. 손대지 않은 미러 포크는 제외되며, 비공개 레포 이름은 공개 데이터에 들어가지 않습니다.

## 구조

```text
누적 트래픽 + GitHub API
             │
             ▼
 scripts/build_repos.py ──▶ repos.json
                                │
                                ▼
                    index.html + 로컬 모듈
                         Three.js 마을
                         ├─ 로컬 검색
                         ├─ 선택형 근거 검색 Worker
                         └─ 선택형 실시간 Worker
```

Repolis는 **빌드 없는 정적 웹 앱**을 유지합니다. 주 런타임은 `index.html`에 있고, 생성 데이터, 현자 명단, 월드 트리 팩토리, 결정적 회의 엔진은 목적별 로컬 파일로 분리합니다.

| 경로 | 역할 |
|---|---|
| [`index.html`](index.html) | 3D 월드, UI, 이동, 주민, 탐험, 다국어 |
| [`repos.json`](repos.json) | 생성된 레포 및 트래픽 데이터 |
| [`scholars.js`](scholars.js) | 현자 명단 |
| [`assets/world-tree/`](assets/world-tree/) | 절차적 월드 트리 팩토리 |
| [`cloudflare-taxi/`](cloudflare-taxi/) | 근거 검색 AI와 선택형 주민 대화 Worker |
| [`cloudflare/`](cloudflare/) | 실시간 접속 Worker |
| [`council/`](council/) | 결정적 회의 엔진과 가드 |
| [`scripts/`](scripts/) | 데이터 빌더와 회귀 검사 |

## 선택형 서비스

| 기능 | 설정 문서 |
|---|---|
| 근거 검색 택시와 현자 | [`cloudflare-taxi/README.md`](cloudflare-taxi/README.md) |
| 실시간 방문자와 카운터 | [`cloudflare/README.md`](cloudflare/README.md) |
| Vercel 택시 대안 | [`api/`](api/)와 [`.env.example`](.env.example) |
| 복사해서 쓰는 연동 예제 | [`examples/`](examples/) |

## 조작

| 입력 | 동작 |
|---|---|
| `W A S D`, 방향키, 왼쪽 터치 스틱 | 걷기 |
| 마우스 드래그 또는 오른쪽 터치 스틱 | 시점과 방향 전환 |
| 휠 | 확대·축소 |
| `Enter`, 클릭, 모바일 문 버튼 | 가까운 장소 열기 |
| 택시 버튼 | 깃버에게 묻기 |
| 메뉴·지도·여권 버튼 | 길찾기와 탐험 기록 |
| 언어 및 해·달 버튼 | 언어와 시간대 전환 |

## 문서

- [`AGENTS.md`](AGENTS.md) — 기여자와 에이전트 운영 계약
- [`docs/domain-model.md`](docs/domain-model.md) — 레포 데이터와 기능 모델
- [`docs/known-limitations.md`](docs/known-limitations.md) — 의도된 제약
- [`SCHOLARS.md`](SCHOLARS.md) — 현자 명단과 근거 검색 역할
- [`COUNCIL_PATTERN.ko.md`](COUNCIL_PATTERN.ko.md) — 토론에서 판정으로 가는 패턴
- [`CHANGELOG.md`](CHANGELOG.md) — 최근 릴리스와 보관 기록
- [`repolis.yaml`](repolis.yaml) / [`llms.txt`](llms.txt) — 도구용 프로젝트 진입점

## 라이선스

MIT © [전현상](https://github.com/hyeonsangjeon). 데이터 수집: [github-traffic-monitor](https://github.com/hyeonsangjeon/github-traffic-monitor).
