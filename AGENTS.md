# AGENTS.md — operating manual for AI agents working on Repolis

> **You are an AI agent. Read this once and you can run, change, verify, and ship Repolis correctly.**
> Repolis is a **zero-build static 3D "city of repos"** web app. Humans get [`README.md`](README.md);
> this file is the machine-readable contract. If something here disagrees with a comment in code, trust this file and flag it.

- **Live:** https://hyeonsangjeon.github.io/Repolis/
- **What it is:** `index.html` is the primary Three.js runtime for a walkable town built from public GitHub repos; local modules and generated assets provide the World Tree, scholars, Council, and data. Gitber + star-named scholar NPCs answer questions and guide visitors through it.
- **Owner / required git identity:** `Hyeon Sang Jeon <wingnut0310@gmail.com>` · GitHub `hyeonsangjeon`
- **License:** MIT

---

## ⏱️ 60-second quickstart (no build, no install)

```bash
git clone https://github.com/hyeonsangjeon/Repolis && cd Repolis
python3 -m http.server 8000          # any static server works (npx serve . etc.)
# open http://localhost:8000  → walk the city with WASD, click the 🚕 to ask the taxi
```

There is **no build step, no bundler, no `package.json`, no `npm install`.** The page boots from a
CDN import map (Three.js r0.160 via jsDelivr) plus local data, scripts, and modules served as static files.

---

## 🗺️ Repository map (what lives where)

| Path | What it is | Touch it when… |
|---|---|---|
| **`index.html`** | Primary app runtime — 3D engine, UI, navigation, residents, exploration, i18n, day/night. | Any UI / gameplay / client behavior change. |
| **`repolis.config.js`** | Fork-facing runtime identity and optional-service policy. GitHub Pages infers the fork owner; upstream Workers stay off on forks. | Changing owner inference, template behavior, or canonical endpoints. |
| **`repos.json` + `data/city-state.json`** | Generated repo catalog plus deterministic era, season, current statistics, Silence Ledger, bounded 30-day Sap Ledger, sap timestamp, and archived roots for the current owner city. **Do not hand-edit.** | Never directly; regenerate (see below). |
| **`data/city-state.schema.json`** | Strict JSON Schema for the generated city-state artifact. | Changing the city-state contract. |
| **`assets/city-time.js`** | Pure wear (`recent` / `faded` / `mossed`), ruin, reference-date, and seasonal palette rules. | Changing how public time metadata affects the city. |
| **`data/lore/fragments.json` + `assets/lore-fragments.js`** | Hand-authored KO/EN elder fragments plus strict validation, deterministic active-roster allocation, and session-bounded delivery. | Changing The Silence fragments or their rarity/allocation contract. Never generate or overwrite the JSON. |
| **`assets/taxi-voice.js`** | Pure local taxi Shared-state answers, household redirect, and once-per-ride seasonal/district observations. | Changing travel voice without adding a backend call. |
| **`assets/session-footprints.js`** | Pure bounded current-tab footprint ring: movement threshold, lifetime, LOW_END/reduced-motion policy, and teardown. | Changing the local player's ephemeral walking trace. |
| **`scripts/fork_lineage.py` + `assets/fork-lineage.js`** | Public-only fork source sanitizer plus deterministic six-color crest projection. | Changing generated fork source truth, lineage cards, or the shared crest batch. |
| **`scholars.js`** | `window.SCHOLARS` roster: POLARIS · VEGA · RIGEL · MIRA · LYRA. | Adding / editing an NPC scholar. |
| **`assets/world-tree/createRepolisHero.js`** | Procedural World Tree factory imported by `index.html`. | Changing the tree geometry, materials, sockets, or actions. |
| **`assets/world-tree/world-tree-state.js`** | Pure projection for Chronicle, Silence Ledger, 30-day Sap Ledger, Roots, sap-flow freshness/mode, bounded star/repo growth, and portable public-town residents. | Changing how owner or normalized public-town state reaches the silent World Tree and local resident roster. |
| **`assets/repo-portal.js`** | Pure username/repository parser, route precedence, public projection, canonical Portal URL, and owner-town expansion link. | Changing `?repo=`, accepted GitHub inputs, public traffic truth, or target share links. |
| **`assets/repository-atelier-chat.js` + `cloudflare-taxi/src/repository-atelier.js`** | Pure visit-scoped five-call chat state plus strict exact-`owner/repo` GitHub MCP request and reference boundaries. | Changing Repository Atelier chat lifecycle, limits, payloads, or grounding scope. |
| **`assets/repository-blueprint.js`** | Pure exact-repository GitHub Tree request boundary plus deterministic bounded source-tree projection. | Changing Repository Blueprint validation, request, cache, node, edge, depth, or layout rules. |
| **`assets/repo-route.js`** | Pure 2–3 stop route validator, current-catalog resolver, conflict policy, and canonical Repo Route URL. | Changing visitor-curated multi-repo paths or `?route=` links. |
| **`assets/contribution-quests.js`** | Pure current-owner/catalog issue projector and bounded quest ranker. | Changing Open Source Quest validation, tier priority, or result diversity. |
| **`assets/town-growth.js`** | Pure repo-creation timeline, year snapshot, and Growth Replay share-link logic. | Changing historical cutoffs, unknown-date policy, or `?growth=` links. |
| **`assets/town-creator.js`** | Pure allowlisted public-profile + town-repo summary for Creator Hall. | Changing creator facts, badges, signature-repo ranking, or avatar safety. |
| **`assets/twin-towns.js`** | Pure public-repo comparison and reversible Twin Towns link builder. | Changing the two-person referral bridge or its URL contract. |
| **`scripts/build_repos.py`** | Rebuilds `repos.json` and `data/city-state.json` from `data/logs/*` traffic + `gh api`. | Refreshing the city data locally. |
| **`scripts/resident_profiles.py` + `data/residents/`** | Generates sanitized public resident profiles, the boot manifest, and the Worker authority registry. Profile JSON is generated — do not hand-edit. | Changing repository-bound resident identity or Shared/Bound inputs. |
| **`scripts/smoke.mjs`** | Hermetic static and behavioral regression guards for the city runtime. | Any client feature, navigation, or generated-module integration change. |
| **`scripts/test-visual-governor.mjs`** | Extracts and deterministically replays the inline adaptive visual-governor core. | Changing warm-up, thresholds, hysteresis, dwell, LOW_END/reduced-motion bounds, or recovery. |
| **`scripts/test-portable-town.mjs`** | Deterministic fixtures for canonical, foreign, empty/archive-only, partial, missing-date, leakage, resident-cap, and zero-request portable towns. | Changing public-town projection or local resident derivation. |
| **`.github/workflows/refresh.yml`** | "Refresh Repolis data" — daily Action that regenerates `repos.json` and pushes `chore: refresh`. | CI / data-refresh changes. |
| **`scripts/build-contribution-library.mjs` + `assets/contribution-library.json`** | Generates the in-app **Contribution Library** JSON from the sibling `Hyeonsang-AI-Contributions` README (KO/EN); `index.html` fetches it at runtime. JSON is **generated — do not hand-edit.** Daily via `.github/workflows/update-contribution-library.yml`. | Changing the library landmark's data/source. |
| **`cloudflare-taxi/`** | **The live AI backend** — Worker `repolis-taxi` (`src/grounded.js`): grounded repo/docs Q&A + in-persona chat. | Grounding / scholar answer logic. |
| **`cloudflare/`** | Realtime presence Worker `repolis-rt` (multiplayer avatars + visitor counter). | Realtime/multiplayer changes. |
| **`party/` + `partykit.json`** | PartyKit realtime server (alternative to `cloudflare/`). | Forks that prefer PartyKit. |
| **`api/taxi.js`, `api/taxi-grounded.js`** | **Optional** Vercel functions — fork-only alternatives to the Worker. | Only if maintaining the Vercel path. |
| **`council/`** | Kronos Council deterministic decision engine + hermetic tests. | The debate/verdict feature. |
| **`docs/`** | Agent-facing specs, known limitations, and archived release history. | Understanding the data/feature model or historical context. |
| **`examples/`** | Copy-paste recipes (curl the worker, share links, embed). | Learning the public surface fast. |
| **`README.md` / `README.ko.md`** | Human docs (EN / KO). | User-facing narrative. |
| **`SCHOLARS.md`** | Human roster of the scholar NPCs. | Documenting a new scholar. |
| **`llms.txt`** | One-page LLM index of this project. | Keep links in sync on big changes. |
| **`repolis.yaml`** | Machine-readable project manifest. | Entry points / deploy targets change. |

**Do not touch (local/secret, gitignored):** `*.local.md`, `cloudflare-taxi/.dev.vars`, `CLAUDE.md`,
`CHRONOPOLIS_SPEC.md`, `.wrangler/`. These hold private notes/keys and never get committed.

---

## ▶️ Run & rebuild

```bash
# 1) Run the city (static)
python3 -m http.server 8000

# 2) Rebuild repos.json + data/city-state.json from public repos and committed traffic logs
gh auth login
GTM_DIR=data python3 scripts/build_repos.py     # generated artifacts; do not hand-edit
# Optional reproducible clock override (the daily workflow supplies its UTC run day):
CITY_STATE_AS_OF=2026-08-23T00:00:00Z GTM_DIR=data python3 scripts/build_repos.py

# 3) Rebuild the Contribution Library JSON from the sibling Hyeonsang-AI-Contributions README (KO/EN)
node scripts/build-contribution-library.mjs     # regenerates assets/contribution-library.json (deterministic)
```

`repos.json` is an **array**; each entry's shape (keys you can rely on):
`repo, desc, lang, topics[], url, home, stars, forks, fork, views, visitors, clones, size, open_issues,
license, archived, default_branch, release_tag, release_date, created, pushed, tracked, first_seen,
social, social_custom, score, rank`, plus `lineage{source,url}` only for a proven included public fork.
Full meaning: [`docs/domain-model.md`](docs/domain-model.md).

`data/city-state.json` is a deterministic projection of that public catalog. It carries `schema`,
`version`, `era`, `season`, the nested versioned `silence` ledger, honest aggregate `stats`,
`last_sap_flow`, and archived-only `roots`.
The daily workflow injects its UTC run day; local builds without that input use the newest
reproducible public source timestamp.

---

## 🚀 Deploy

| Target | Command / trigger | Result |
|---|---|---|
| **The site** (index.html, data, scholars) | `git push origin main` | GitHub Pages serves root (`.nojekyll`). Build is automatic. |
| **Grounding worker** | `cd cloudflare-taxi && npx wrangler deploy` | Updates `repolis-taxi` (the live AI brain). |
| **Realtime worker** | `cd cloudflare && npx wrangler deploy` | Updates `repolis-rt` (presence). |

The canonical site gets its Worker defaults from `repolis.config.js`:
`services.grounded` → `https://repolis-taxi.wingnut0310.workers.dev/`, and
`services.realtime` → `wss://repolis-rt.wingnut0310.workers.dev`. GitHub Pages forks infer their
own owner and receive empty service defaults, so the taxi falls back to keyless **Local search**
and the city stays solo. **No backend is required to run.**

Worker secrets live in Cloudflare (set via `npx wrangler secret put …`) and local `.dev.vars` — see
[`cloudflare-taxi/README.md`](cloudflare-taxi/README.md). Never put a real key in tracked files.

---

## ✅ Verify before you ship (the golden rule)

**Everything below must pass before any deploy.** These tests are hermetic — zero network, zero clock,
zero LLM, zero cost — so run them freely:

```bash
node council/test.mjs        # deterministic Council crosscheck
node council/test-live.mjs   # live guards + state machine
node scripts/smoke.mjs       # city/runtime static + behavioral regression guards
node scripts/test-visual-governor.mjs
node scripts/test-portable-town.mjs
python3 scripts/test_city_state.py
python3 scripts/validate_city_state.py
python3 scripts/test_fork_lineage.py
node scripts/test-city-time.mjs
node scripts/test-session-footprints.mjs
node scripts/test-fork-lineage.mjs
node scripts/test-repository-atelier-chat.mjs
node scripts/test-repository-blueprint.mjs
node scripts/validate-lore-fragments.mjs
node --check scholars.js
node --check cloudflare-taxi/src/grounded.js
node --check cloudflare-taxi/src/taxi-boundary.js
node --check assets/repo-route.js
node --check assets/contribution-quests.js
```

For UI / client changes there is no unit harness — verify by **serving locally and driving the page**
(Chrome DevTools is the project's tool of choice): load `http://localhost:8000`, exercise the changed
flow, and confirm **0 console errors** at a mobile viewport (390×844) and desktop. The repo ships with
in-page debug helpers (e.g. `window.__trace(...)`) for poking the chat/trace UI during local verification.

Tested on Node v24. There is no linter or formatter configured — match the surrounding style.

---

## 🚫 Hard rules — do not break these

1. **Git identity.** Author every commit as `Hyeon Sang Jeon <wingnut0310@gmail.com>` (GitHub `hyeonsangjeon`).
2. **Rebase before pushing `main`.** A daily Action (`refresh.yml`) pushes `chore: refresh` to `main`.
   Always `git fetch origin && git rebase origin/main` before `git push`, or you'll be rejected.
3. **Tests green before deploy.** Run the verify block above. A red council test blocks the deploy — no exceptions.
4. **Never commit secrets.** API keys / tokens live only in Cloudflare secrets, `.dev.vars`, and `*.local.md`
   (all gitignored). Don't echo them into tracked files, examples, or commit messages.
5. **Public-safe only.** This repo is public. Only the owner's **public** repos appear; private repo names
   never get exposed. Do not add private infrastructure, analytics, or dashboards to public docs/code.
6. **`repos.json` is generated.** Change the data by editing `scripts/build_repos.py` and regenerating,
   not by hand-editing the JSON.
7. **No new heavy deps / build step.** The zero-build static runtime is a feature. Don't introduce a
   bundler or `node_modules` runtime requirement for the site.

---

## 🧭 Common tasks → where to look

| You want to… | Start here |
|---|---|
| Change how a repo becomes a building (height/size/ornaments) | `index.html` (city-build section) + score/rank in `scripts/build_repos.py`; model in [`docs/domain-model.md`](docs/domain-model.md). |
| Change Repo Portal parsing, target-first loading, cache, expansion, or privacy events | `assets/repo-portal.js` + the repo data/intro/Station/Atelier blocks in `index.html` + `scripts/smoke.mjs`; preserve one repo request before Aha, `trafficKnown:false` for public API data, 15-minute/512 KiB LRU bounds, canonical `?repo=owner/repo&ref=repo-portal`, and [`docs/repo-portal-change-guide.md`](docs/repo-portal-change-guide.md). |
| Change portable `?user=` / Repo Portal / Station World Tree or residents | `assets/world-tree/world-tree-state.js` + the post-load projection, World Tree, resident, service-boundary, and debug blocks in `index.html` + `scripts/test-portable-town.mjs`; preserve one existing public load, deterministic public-only state, 6/4 desktop/LOW_END resident caps, unknown traffic/memory, and local/solo service closure. |
| Change Repo Route selection, ordering, share links, recipient progress, or privacy events | `assets/repo-route.js` + `/*REPO_ROUTE*/` in `index.html` + the Repo Route group in `scripts/smoke.mjs`; preserve 2–3 unique current public repos, strict ordered completion, session-only drafts, identity-free telemetry, and no new scene or network work. |
| Change Open Source Quest search, ranking, repo-house handoff, or privacy events | `assets/contribution-quests.js` + `/*CONTRIBUTION_QUESTS*/` in `index.html` + the Open Source Quests group in `scripts/smoke.mjs`; preserve explicit one-request search, current owner/catalog filtering, three-card/2-per-repo caps, in-memory results, identity-free telemetry, and Star eligibility only after issue handoff. |
| Change districts, Village Chronicle, passport, or exploration loops | `index.html` + the matching behavioral groups in `scripts/smoke.mjs`. |
| Change Creator Hall profile facts, caching, or upstream Star handoff | `assets/town-creator.js` + the Creator Hall landmark/panel blocks in `index.html` + `scripts/smoke.mjs`; keep profile loading explicit-read and allowlisted. |
| Change Town Growth Replay years, camera, reveal, share links, or era postcards | `assets/town-growth.js` + `/*TOWN_GROWTH_REPLAY*/` in `index.html` + the Growth Replay group in `scripts/smoke.mjs`; creation dates are historical, building metrics are current, and replay must restore camera/fog/sky/LOD exactly. |
| Change Repository Atelier room, avatar, data walls, action terminals, or scoped chat | `assets/repository-atelier-chat.js` + `cloudflare-taxi/src/repository-atelier.js` + `/*REPOSITORY_ATELIER*/` in `index.html` + the Atelier group in `scripts/smoke.mjs`; preserve one lazy reusable room, three bounded canvas atlases, exact exterior restore, zero exterior renders inside, exact public `owner/repo` grounding, isolated in-memory visit history, five started calls, panel-reopen continuity, room-reentry reset, and explicit-only exit/GitHub navigation. |
| Change Repository Blueprint scanning, projection, or DOM/3D focus | `assets/repository-blueprint.js` + `/*REPOSITORY_ATELIER*/` in `index.html` + `scripts/test-repository-blueprint.mjs` + the Atelier smoke group; preserve explicit one-request Tree API access, 8 s/2 MiB bounds, current-repo-only memory, 220/96 nodes, depth 4, 160/64 edges, two instanced batches, one line batch, zero Blueprint atlases/lights/exterior objects, and factual source-tree-only copy. |
| Change adaptive frame thresholds or visual tiers | `/*VISUAL_GOVERNOR_CORE*/` + `/*VISUAL_GOVERNOR_RUNTIME*/` in `index.html`, `scripts/test-visual-governor.mjs`, and the matching smoke group; preserve 6 s eligible warm-up, separated hysteresis/dwell, balanced-before-lean ambient ordering, LOW_END/reduced-motion authority, state continuity, and zero storage/network/telemetry. |
| Change the 30-day Sap Ledger fields, retention, or Chronicle summary | `scripts/city_state.py` + `data/city-state.schema.json` + `assets/world-tree/world-tree-state.js` + `/*WORLD_TREE_CHRONICLE*/` in `index.html`; preserve actual UTC entries only, same-day replacement, 30-entry/32 KiB caps, public aggregate privacy, and unavailable foreign history. |
| Change Twin Towns matching or two-person share links | `assets/twin-towns.js` + the Twin Towns block in `index.html` + `scripts/smoke.mjs`. |
| Change Town Gazette / return-visit freshness | `/*FRESHNESS*/` + Passport render/start flow in `index.html`; keep snapshots local, bounded, per-town, and explicit-read only. |
| Change resident homes, styles, gardens, routines, moods, friendships, haunts, or Shared Joy | The resident social layer + Starlight Row blocks in `index.html`; preserve the resident style map, 3 roof batches, 10/6 desktop/LOW_END detail-batch cap, 42-unit reserve, entrance gap, quarter colliders, home/work truth, owned porch seats, and social ownership guards. |
| Change elder lore, newcomer voice/scaffolding, or taxi travel observations | `data/lore/fragments.json`, `assets/lore-fragments.js`, `assets/taxi-voice.js`, `assets/city-time.js`, and the Phase 4 blocks in `index.html`; preserve the nine-resident active roster, World Tree silence, local-only delivery, and one observation per ride. |
| Change session footprints | `assets/session-footprints.js` + `/*SESSION_FOOTPRINTS*/` in `index.html` + the Phase 5 group in `scripts/smoke.mjs`; preserve current-tab memory only, local post-collision walking truth, one fixed instanced pool, zero storage/network/analytics/sync, and no colliders. |
| Change public fork lineage | `scripts/fork_lineage.py`, `assets/fork-lineage.js`, `/*FORK_LINEAGE*/` in `index.html`, and the Phase 5 lineage tests; preserve included-fork-only build lookups, minimal public fields, one shared crest draw, factual KO/EN copy, and zero runtime GitHub calls. |
| Fix / improve a scholar's answer or references | `cloudflare-taxi/src/grounded.js` (server) + the trace panel in `index.html`. |
| Add a new scholar NPC | `scholars.js` + `scholarConfig`/`MCP_NPCS` in `cloudflare-taxi/src/grounded.js`; choose KB-backed or direct MCP deliberately; document in `SCHOLARS.md`. |
| Tune the taxi's repo search/intent routing | `index.html` (Local search: inverted index + intent agent). |
| Touch the debate/verdict engine | `council/` — and keep `node council/test*.mjs` green. |
| Add a UI string | both `ko` and `en` i18n dictionaries in `index.html`. |
| Know what's intentionally NOT supported | [`docs/known-limitations.md`](docs/known-limitations.md). |

---

## 🧩 One-paragraph mental model

A daily Action turns the owner's **public repos + committed traffic logs** into `repos.json`; included public
forks may also carry a minimal canonical source record. `index.html`
turns that array into metric-shaped buildings, topic districts, routes, maps, and exploration progress.
Residents add named homes, home/work commutes, moods, friendships, haunts, Shared Joy excursions, gatherings, and festivals. The owner World Tree retains at most 30 actual UTC daily public aggregate entries in its Sap Ledger; same-day refreshes replace, missing days stay missing, and no browser or traffic data enters it. Foreign `?user=` and Repo Portal towns run the same pure portable projection after their one existing public load, deriving their own era, season, Silence Ledger, Roots, and 6/4-capped local resident roster without owner history, traffic, memories, services, or extra requests. The oldest eligible 20% of the owner roster can rarely let slip a hand-authored local lore fragment; repositories younger than 90 reproducible-clock days receive a lightweight construction layer and newcomer voice. Landmarks include the Contribution Library, Chronopolis, Observatory, and imported procedural World Tree. Repo Portal lets one public `owner/repo` arrive before its owner catalog, then reuses the same building and Repository Atelier with truthful public-metadata boundaries. Repo Route lets a visitor hand off an ordered 2–3 house path they actually explored. Open Source Quests connects an explicitly loaded current public issue to its real repo house before GitHub handoff. Every repo also rebinds one reusable Atelier where its data, impact signals, current avatar, and in-room Gitber stay inside the exhibition; its explicit Repository Blueprint scan makes one bounded public Tree API request and projects only factual file/folder topology, never a call graph or runtime architecture. Town Growth Replay turns public repo creation dates into a reversible, shareable city history without inventing historical metrics. Gitber/POLARIS and the
scholars (VEGA · MS Learn, RIGEL · DeepWiki, MIRA · Context7, LYRA · Hugging Face) add natural-language
navigation and grounded answers. Residents hand specialist questions to the right scholar instead of gaining
their own MCP access. Gitber remains the only all-district traveler: ride observations and Shared-state answers are local, while household memory questions return to the correct repo home. The Passport's local Town Gazette makes daily public-repo changes visible on return. Everything
degrades gracefully to keyless Local search and solo play.
