<div align="center">

<a href="https://hyeonsangjeon.github.io/Repolis/"><img src="assets/banner.svg" alt="Repolis — the City of Repos" width="80%"></a>

# Repolis — the City of Repos

[English](README.md) · [한국어](README.ko.md)

**Public GitHub repos become a walkable 3D town. Traffic shapes the buildings, residents live there, and Gitber drives you to the right project.**

<p>
  <a href="https://hyeonsangjeon.github.io/Repolis/?view=plaza&amp;lang=en"><img src="https://img.shields.io/badge/-%E2%96%B6%20ENTER%20LIVE%20TOWN-178f86?style=for-the-badge" alt="Enter the live Repolis town" height="40"></a><br>
  <sub><strong>Start here:</strong> enter the live Repolis plaza now.</sub>
</p>
<p>
  <a href="https://hyeonsangjeon.github.io/Repolis/?launch=1"><img src="https://img.shields.io/badge/-TRY%20MY%20GITHUB-24292f?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="Try Repolis with my GitHub" height="32"></a>
  <a href="https://github.com/new?template_name=Repolis&amp;template_owner=hyeonsangjeon"><img src="https://img.shields.io/badge/-USE%20THIS%20TEMPLATE-c56a26?style=for-the-badge&amp;logo=github&amp;logoColor=white" alt="Use the Repolis template" height="32"></a><br>
  <sub>Preview your public repos · or copy the template to build your own town.</sub>
</p>

<a href="https://hyeonsangjeon.github.io/Repolis/"><img src="assets/demo.gif" alt="Repolis demo: a living traffic-shaped GitHub town, Gitber search, taxi ride, and real repository card" width="92%"></a>

<sub>🎬 <strong>15-second demo:</strong> traffic → buildings · ask Gitber → taxi ride → real repo card</sub><br>
<sub><code>WASD</code> / touch to walk · ask Gitber · <code>Enter</code> / tap to open · no sign-up or build · <strong><a href="#run-in-60-seconds">Run locally</a></strong> · ⭐ <strong><a href="https://github.com/hyeonsangjeon/Repolis">Star Repolis</a></strong></sub><br>
<sub>Type a GitHub username, <code>owner/repo</code>, or repository URL on the first screen. Repolis uses public metadata only.</sub>

[![Daily refresh](https://img.shields.io/github/actions/workflow/status/hyeonsangjeon/Repolis/refresh.yml?style=flat-square&label=daily%20refresh&logo=githubactions&logoColor=white)](https://github.com/hyeonsangjeon/Repolis/actions/workflows/refresh.yml)
[![Three.js](https://img.shields.io/badge/Three.js-r160-000000?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org)
[![Zero build](https://img.shields.io/badge/runtime-zero%20build-83bb59?style=flat-square)](index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-a0a0a0?style=flat-square)](LICENSE)

</div>

## What the demo proves

| In the demo | What it means for your repositories |
|---|---|
| traffic, stars, forks, clones, and activity shape the architecture | people can understand your portfolio signals without opening a dashboard |
| Gitber searches in natural language, then drives to the result | repository discovery becomes an interaction rather than another list |
| `?user=<login>` rebuilds the town from any public GitHub account | you can try the same engine with your work before cloning or configuring anything |

**Fastest proof:** open **[Try my GitHub](https://hyeonsangjeon.github.io/Repolis/?launch=1)** and enter your login or one `owner/repo`. A username builds the public town; a repository opens that project first. No token, account connection, or fork is required.

<div align="center">

<a href="https://hyeonsangjeon.github.io/Repolis/?launch=1"><img src="assets/launch.gif" alt="Typing a GitHub username on the Repolis launchpad and walking into a town built from that account's public repositories" width="86%"></a>

<sub>⌨️ <strong>Username → your own town:</strong> type <code>mrdoob</code> → his 58 public repos become a walkable city</sub>

</div>

If you find this useful for presenting repositories, **[star Repolis](https://github.com/hyeonsangjeon/Repolis)**. Your star helps other developers discover the template.

## From preview to your own city

| Goal | What to do | Result |
|---|---|---|
| preview my public repos | use the live username field | a shareable town built from metadata in seconds |
| share one repository as an experience | paste `owner/repo` or a GitHub repository URL, then use **Copy Repo Portal** in its Atelier | a canonical confirmation link, plus `?repo=owner/repo&view=atelier&lang=en` when the exhibition should be the first screen |
| hand another developer the best path I found | add 2–3 opened repo cards to **Repo Route**, then follow or share it | one ordered deep link that guides the recipient through those real houses before the earned Star invitation |
| find a current open-source task | open **Open Source Quests** in Wayfinding, then explicitly search | three current public issues ranked for approachability, each connected to its real repo house and exact GitHub issue |
| introduce who built the town | visit **Town Creator Hall** or open **Meet the town creator** in the city menu | public bio, followers, GitHub tenure, top languages, badges, and signature projects tied to the current town owner |
| watch my open-source history unfold | open **Town Growth Replay** from Wayfinding, the Passport, or my completed public-town preview | a creation-date timeline where repo houses rise year by year, with a shareable year link and era postcard |
| connect with another developer | click **Connect with a friend** after a preview, or open **Twin Towns** in the city menu | a two-person link that opens both towns and their shared languages or topics |
| keep my town on my GitHub profile | click **Put this town on my GitHub profile** when the preview is ready, or use **Town Postcard Studio** | a 600px portal that always opens my personalized town |
| publish my own Repolis | use the template, enable Actions + Pages, run **Refresh Repolis data** once | your fork owner's public repos become the default town; no PAT required |
| grow buildings from real traffic | optionally add the `GH_PAT` Actions secret | cumulative views, visitors, and clones enrich the city each day |

Forks automatically infer `<owner>.github.io` as the town owner and do **not** call the upstream AI or realtime Workers. For a custom domain, set one value in [`repolis.config.js`](repolis.config.js).

## How repository data becomes a city

Repolis maps public GitHub metadata and cumulative traffic onto a walkable town.

| Signal | What it becomes |
|---|---|
| unique visitors | building height |
| forks | lot and building width |
| clones | banners and gold trim |
| views | garden and fence size |
| stars | roof ornaments |
| recent activity | window glow at night |

Repositories are grouped into topic districts with roads, signs, hubs, and a world map. The owner's town refreshes daily from committed traffic history and the GitHub API. `?user=<login>` builds a lighter public town with that user's own World Tree record and bounded local residents, while `?repo=<owner>/<repo>` loads one project first through the same projection. GitHub does not publish visitor, view, or clone traffic for those public API modes, so their buildings use stars, forks, and update recency without inventing traffic.
At ordinary walking distances, a one-draw architectural LOD keeps each repo house's textured walls and roof while preserving its plot, hedge, path, real window panes, shutters, sills, flower boxes, gutters, and tier-specific porch, balcony, or portico.

## A village that lives

- **Residents follow daily routines.** Named townspeople wander their districts with changing moods, visit cherished haunts, recognize friends, stroll or sit together, gather around the campfire, and sometimes celebrate a recent repository release. At night, they return to warm windows and porch seats. In the morning, they head back to work in their districts. Their cottages form **Starlight Row** on the north-east edge, with resident-coloured gardens, three roof silhouettes, shutters, transoms, selected window boxes, canopies, chimneys, and roof finials. A shared flower bed, lanterns, hedges, broadleaf trees, and cypresses fill the common spaces. Pairs also choose short **Shared Joy** excursions to real flower patches, visible stars at night, or a real repository house, all without a player prompt or AI call. When asked a specialist question, residents introduce the right scholar instead of pretending to know the answer. Follow the compass to find that scholar in the world.
- **A public town lives from its own record.** The one existing public-repository load deterministically supplies its era, season, Silence Ledger, archived Roots, and up to six desktop/four phone-or-LOW_END residents with local jobs, greetings, and real repo-home bindings. Traffic, owner residents, Shared/Bound memories, realtime, and grounded services stay unknown or off; no second API request or model call is made.
- **The owner World Tree keeps a small factual history.** Its **Thirty-day Sap Ledger** retains up to 30 actual UTC daily entries of public repo, star, fork, recent-activity, season, and Silence aggregates. Same-day refreshes replace instead of duplicate, missing days stay missing, and foreign towns explicitly receive no owner ledger.
- **The roots open into a walkable archive.** **The Undercroft** turns the current town's archived public repositories into deterministic shelves and plaques beneath the World Tree. Approach one to read its existing Roots text, active years, and available last public activity, then open the repository in a new tab. The Chronicle stays available as the accessible summary; empty and foreign towns keep their own truthful record without borrowing owner history.
- **Exploration continues across visits.** The Explorer Passport records houses and landmarks, district progress shows what remains, and the daily **Village Chronicle** links one resident and their cherished haunt to a repository or district with a real connection.
- **The city points outward to real work.** **Open Source Quests** makes one anonymous public GitHub search only when the visitor asks, ranks up to three current `good first issue`, `help wanted`, or open issues, and leads through the actual repository house before the exact issue handoff. After that repository's Blueprint is explicitly loaded, **Issue-to-Code Scout** can compare only the selected issue's title and labels with actual path metadata and offer up to five candidate paths to inspect first. It makes no file relationship or modification claim, adds no request, and returns no guess when lexical evidence is weak. Results stay in the tab; no login, token, issue tracking, or new backend is involved. The existing earned Star invitation can appear only after the visitor chooses to open an issue.
- **A visitor can hand off the route that proved the town's value.** After opening a repository house, **Repo Route** can save it to an ordered 2–3 stop walk. The recipient's link confirms the stops before entry, points to each real house in sequence, and offers the existing earned Star invitation only after completion. The draft is session-only; the URL contains public repo names and adds no backend, account, storage key, or render asset.
- **Your repository history becomes a moving city story.** **Town Growth Replay** reads the public creation date already carried by every repo house, then raises the town through its real repo-birth years from the first house to the present. The scrubber, play/pause controls, deep link, and era postcard work for the owner and every `?user=` public town. The timeline covers repos still public today; house appearance and language labels stay explicitly marked as today’s metadata. Replay adds no mesh, texture, light, backend, account, or stored history.
- **A repository can be the front door.** **Repo Portal** accepts `owner/repo` or a GitHub URL, loads that one public target before the owner catalog, and takes the visitor into its Repository Atelier after one entry click. A strict `?repo=owner/repo&view=atelier&lang=en` campaign link instead holds a short portal transition over initialization and opens the same exhibition directly, without flashing the exterior town or covering it with chat. Direct links default to English; use `lang=ko` for Korean. The Atelier can copy the canonical confirmation address, open GitHub, or expand into the owner's full town. A 15-minute, 512 KiB local cache and stale fallback keep the path bounded; unavailable traffic remains unknown.
- **Every repo house opens into one finished exhibition.** Its card leads to the reusable **Repository Atelier**, where the current Repolis chibi, data and signal walls, Repository Core, and action terminals rebind to that repo. The new **Repository Blueprint** stays silent until **Scan public source map** is chosen, then makes one exact public GitHub Tree request and projects a bounded, accessible DOM/3D file-and-folder map. A focused node can become a canonical **Blueprint Deep Link**; recipients confirm the exact public repo/path before **Load public Blueprint** starts that same single request, and missing paths are never guessed. It is explicitly the current source tree—not a call graph or runtime architecture—and truncated results remain labeled without follow-up crawling. **Ask Gitber** still keeps an isolated in-room thread for up to five backend calls per visit, no other repository is substituted, and GitHub remains an explicit external action.
- **Returning visitors can see what changed.** The Passport's **Town Gazette** compares the current public repository snapshot with the last one this browser marked as read. It then highlights new repositories, release tags when available, pushes, and positive metric growth. The comparison is entirely local and costs nothing.
- **Repository connections are visible.** The Stargazer's Observatory finds a genuine connection among three repositories that share topics or languages and draws it as a nighttime Constellation Trail.
- **Every town introduces its creator.** **Town Creator Hall** belongs to the active town owner—canonical, fork, or `?user=` visitor—and combines an explicitly loaded public GitHub profile with the repositories already rendered in town. The hall highlights truthful stats, languages, earned badges, and three signature projects before crediting the upstream Repolis engine.
- **Two developers can connect their towns.** **Twin Towns** compares public repo metadata, finds shared languages or topics, and creates a recipient-specific link that can be followed in either direction—without login or a backend.
- **Quiet maintenance gets its own light.** The Observatory's Maintainers' Night Watch selects three recently maintained, low-star repositories from public metadata and asks visitors to light their lanterns. The Watch recognizes care regardless of popularity.
- **Landmarks carry the project story.** The Contribution Library archives papers, talks, open-source work, and awards. Chronopolis hosts the Council of Time. The plaza, observatory, park, and fairground make the city worth walking. At Petite-Venise, a boardable, low-profile ferry follows the real canal curve beneath the flower bridges for one scenic tour of the town.
- **The World Tree anchors the skyline.** It is a deterministic, code-native Three.js sculpture created with the [threejs-sculpt-dna](https://github.com/hyeonsangjeon/threejs-sculpt-dna) Copilot plugin, with rooted foliage, living motion, and tree-isolated bloom.

## Ask the city

| Guide | What to ask | How it answers |
|---|---|---|
| **Gitber · POLARIS** | “Take me to an AI agent repo” or “most cloned” | uses local indexed search by default, then drives to the selected house |
| **VEGA · Archivist** | Azure, .NET, Copilot, Microsoft products | grounded Microsoft Learn search with references |
| **RIGEL · Cartographer** | how a public repository works | grounded DeepWiki exploration |
| **MIRA · Timekeeper** | current library APIs and version-specific examples | direct Context7 lookup; roams the Library district |
| **LYRA · Forgemaster** | public models, datasets, and ML papers | direct Hugging Face search; roams the AI district |
| **Council of Time** | a technical trade-off or disputed claim | curated, deterministic verdicts, plus an optional live debate clearly marked as unverified |

The town works without a backend. **Local** search is instant and keyless. **WebLLM** provides optional in-browser inference. The live demo adds grounded answers and official public MCP lookups through a Cloudflare Worker. If those services are unavailable, the town falls back to Local search or solo play.

## Run in 60 seconds

```bash
git clone https://github.com/hyeonsangjeon/Repolis
cd Repolis
python3 -m http.server 8000
# open http://localhost:8000
```

No installation or build step is required. Three.js is loaded from a CDN import map, while local data and modules are served as static files.

To rebuild the owner's city from GitHub data and collected traffic history:

```bash
gh auth login
GTM_DIR=data python3 scripts/build_repos.py
```

`repos.json` is generated. Edit the builder instead of changing the generated JSON by hand.

## Build your own city

The quickest preview requires no fork. Open **[Try my GitHub](https://hyeonsangjeon.github.io/Repolis/?launch=1)**, share `https://hyeonsangjeon.github.io/Repolis/?user=<login>`, enter the English owner plaza with `?view=plaza&lang=en`, point one project at `https://hyeonsangjeon.github.io/Repolis/?repo=<owner>/<repo>&ref=repo-portal`, or enter its exhibition directly with `?repo=<owner>/<repo>&view=atelier&lang=en`.

To publish a persistent city built from repository metadata:

1. Click **[Use this template](https://github.com/new?template_name=Repolis&template_owner=hyeonsangjeon)**.
2. Enable Actions, then configure GitHub Pages to publish from the root of `main`.
3. Run **Refresh Repolis data** once. The workflow uses `github.token` to build the city from the template owner's public repositories and then runs daily.
4. Optionally, add an Actions secret named `GH_PAT` to collect cumulative traffic. Without it, stars, forks, recency, language, topics, and releases still shape the city.

Only public repositories are rendered. Unmodified mirror forks are filtered out, and private repository names never enter the public data.

## Architecture

```text
traffic history + GitHub API
             │
             ▼
 scripts/build_repos.py ──▶ repos.json
                                │
                                ▼
                    index.html + local modules
                         Three.js town
                         ├─ Local search
                         ├─ optional grounded AI Worker
                         └─ optional realtime Worker
```

Repolis remains a **zero-build static web app**. Its main runtime lives in `index.html`. Specialized local files contain generated data, the scholar roster, the World Tree factory, and deterministic Council logic.

| Path | Purpose |
|---|---|
| [`index.html`](index.html) | 3D world, UI, navigation, residents, exploration, i18n |
| [`repolis.config.js`](repolis.config.js) | fork owner inference and safe optional-service defaults |
| [`repos.json`](repos.json) | generated repository and traffic data |
| [`scholars.js`](scholars.js) | scholar roster |
| [`assets/repo-portal.js`](assets/repo-portal.js) | strict target parsing, public projection, and canonical repository links |
| [`assets/town-growth.js`](assets/town-growth.js) | deterministic repo-birth timeline, year snapshots, and share links |
| [`assets/world-tree/`](assets/world-tree/) | procedural World Tree factory |
| [`cloudflare-taxi/`](cloudflare-taxi/) | grounded AI and optional resident dialogue Worker |
| [`cloudflare/`](cloudflare/) | realtime presence Worker |
| [`council/`](council/) | deterministic Council engine and guards |
| [`scripts/`](scripts/) | data builders and regression checks |

## Optional services

| Capability | Setup |
|---|---|
| Grounded taxi and scholars | [`cloudflare-taxi/README.md`](cloudflare-taxi/README.md) |
| Realtime visitors and counters | [`cloudflare/README.md`](cloudflare/README.md) |
| Vercel taxi alternatives | [`api/`](api/) and [`.env.example`](.env.example) |
| Copy-paste integrations | [`examples/`](examples/) |

## Controls

| Input | Action |
|---|---|
| `W A S D`, arrows, or left touch stick | walk |
| mouse drag or right touch stick | look and turn |
| wheel | zoom |
| `Enter`, click, or the mobile door button | open the nearby place |
| taxi button | ask Gitber |
| menu / map / passport buttons | navigate, track exploration, and replay the town's growth |
| language and sun/moon buttons | switch language and time of day |

## Documentation

- [`AGENTS.md`](AGENTS.md) — contributor and agent operating contract
- [`docs/domain-model.md`](docs/domain-model.md) — repository data and feature model
- [`docs/repo-portal-change-guide.md`](docs/repo-portal-change-guide.md) — Repo Portal URL, data, cache, privacy, and maintenance contract
- [`docs/known-limitations.md`](docs/known-limitations.md) — intentional constraints
- [`SCHOLARS.md`](SCHOLARS.md) — scholar roster and grounding roles
- [`COUNCIL_PATTERN.md`](COUNCIL_PATTERN.md) — the debate-to-judge pattern
- [`CHANGELOG.md`](CHANGELOG.md) — recent releases and archive links
- [`repolis.yaml`](repolis.yaml) / [`llms.txt`](llms.txt) — machine-readable project entry points

## License

MIT © [Hyeonsang Jeon](https://github.com/hyeonsangjeon). Data collection credit: [github-traffic-monitor](https://github.com/hyeonsangjeon/github-traffic-monitor).
