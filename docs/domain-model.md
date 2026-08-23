# Domain model — how Repolis turns data into a city

This is the conceptual model behind Repolis: the entities, how a repo becomes a building, how the
taxi/scholars answer, and how town modes work. For the operating contract (run/deploy/verify/rules)
see [`AGENTS.md`](../AGENTS.md); for narrative see [`README.md`](../README.md).

---

## 1. Entities

| Entity | Where it lives | Notes |
|---|---|---|
| **Repo** | one object in `repos.json` | The unit of the world — becomes one house. |
| **Repo Portal target** | one allowlisted public repo projection | A target-first house and Atelier reached through `?repo=owner/repo`. |
| **Repo Route** | ordered list of 2–3 current repo canonical names | A session-authored or shared path that advances only when its next real house opens. |
| **Contribution Quest** | one bounded projection of a current public GitHub issue | An explicit-read task connected to its current repository house and exact issue URL. |
| **City / Town** | derived in `index.html` at load | The whole 3D scene built from the `repos.json` array. |
| **District** | deterministic `zoneOf(repo)` result | A topic-shaped neighborhood with a hub, board, map destination, and progress. |
| **Resident** | resident roster in `index.html` | A townsperson with a residential home, district work anchor, mood, relationships, and a cherished haunt. |
| **Exploration state** | browser `localStorage` | Passport visits, district progress, daily Village Chronicle, Town Gazette baselines, constellation completion, and the Maintainers' Night Watch stamp. |
| **Scholar (NPC)** | `scholars.js` (`window.SCHOLARS`) | A named star + myth + exactly one MCP knowledge source. |
| **Taxi** | the POLARIS scholar (`kind: taxi`) | Finds a repo and physically drives you there. |
| **Grounding Worker** | `cloudflare-taxi/` (`repolis-taxi`) | Server brain: KB retrieval + in-persona chat. |
| **Council** | `council/` | Separate deterministic debate→verdict engine. |

---

## 2. The Repo object (`repos.json`)

`repos.json` is an **array** of repo objects (generated — never hand-edit). Reliable keys:

| Key | Type | Meaning |
|---|---|---|
| `repo` | string | Repo name (the house's identity). |
| `desc` | string | Description. |
| `lang` | string | Primary language. |
| `topics` | string[] | GitHub topics (drives search + category logo). |
| `url` | string | GitHub URL. |
| `home` | string | Homepage URL, if any. |
| `stars` | number | ⭐ → gold-star roof ornaments. |
| `forks` | number | ⑂ → building **width** (lot size). |
| `fork` | boolean | Is this repo itself a fork? (mirror forks are filtered out upstream). |
| `views` | number | 📈 → **garden** / fence size. |
| `visitors` | number | 👁 unique visitors → building **height**. |
| `clones` | number | ⬇ → **ornamentation** (banners, gold trim). |
| `trafficKnown` | boolean | `true` for the generated owner snapshot; `false` for public API projections where views/visitors/clones stay `null`. |
| `size` | number | Repo size (KB). |
| `open_issues` | number | Shown as a live badge on the repo card. |
| `license` | string | Shown as a badge. |
| `archived` | boolean | Archived repos remain in place as warm, gentle ruins with their identity intact. |
| `default_branch` | string | e.g. `main`. |
| `release_tag` / `release_date` | string | Latest release badge. |
| `created` / `pushed` | string | Timestamps; `pushed` feeds night-glow recency and deterministic building wear. |
| `tracked` / `first_seen` | string | When the house was "built" (drives the *since YYYY-MM-DD* note). |
| `social` / `social_custom` | string/bool | Social-preview image for the card. |
| `score` | number | Ranking score (see §3). |
| `rank` | number | Final ordering → district + house tier. |

---

## 3. Metrics → architecture (the core idea)

**The data is the blueprint.** Traffic, not popularity, shapes the city:

| Signal | Becomes |
|---|---|
| 👁 unique visitors | building **height** |
| ⑂ forks | building **width** (lot size) |
| ⬇ clones | **ornamentation** (banners · gold trim) |
| 📈 views | **garden** · fence |
| ⭐ stars | **gold-star** roof ornaments |
| 🌙 recent push · clones · views | **window glow** at night |
| 🕰 latest push | **wear**: recent (≤90d), faded (91–365d), or mossed (>365d/unknown) |
| 🏛 archived | a named **gentle ruin** with moss, vines, and wildflowers |

`score` / `rank` are computed in `scripts/build_repos.py` from these signals. Rank chooses the house tier
(`cabin → cottage → house → villa → manor → portico mansion`), while the client-side deterministic
`zoneOf(repo)` classifier chooses a topic district from repository name, description, topics, and language.
Every active district receives a map region, walkable hub, board, and representative repositories.

The World Tree performance path does not replace these houses with bare boxes. Full models remain available
nearby; the one-draw architectural mid LOD combines textured walls and the authored roof with a deterministic
parcel/detail mesh (plot, hedge, path, framed live windows, shutters, sills, window boxes, drainage, and the
kind-specific entrance). The far visual keeps a low-poly parcel, while its separate shadow proxy remains only
the body/roof silhouette so decorative ground geometry cannot pollute the frozen town shadow map.

Counts are **cumulative since move-in day** (`first_seen`/`tracked`), because GitHub's traffic API only
keeps a rolling 14-day window — a daily collector accumulates the lifetime totals offline.

That mapping applies only when `trafficKnown` is true. GitHub's unauthenticated public repository endpoints
do not expose visitors, views, or clones. Repo Portal and `?user=` projections leave those fields `null`;
their architecture uses stars, forks, and update recency directly. Cards, search answers, and Atelier walls
state the boundary instead of presenting derived values as observed traffic.

---

## 4. Data pipeline

```
github-traffic-monitor (private, daily)        Repolis (public)
  └ cumulative traffic → data/logs/*.csv ──┐
                                           ├─▶ .github/workflows/refresh.yml (daily)
  gh api: owner's public repos (+ committed forks) ─┘  └ scripts/build_repos.py
                                                         ├─▶ repos.json ──────────┐
                                                         └─▶ data/city-state.json ┴─▶ index.html
```

- Only **public** repos appear (created repos + forks you actually committed to; mirror forks skipped).
- Both outputs are generated together; `data/city-state.json` is validated against
  `data/city-state.schema.json` and fixture-tested before the refresh can commit.
- The daily Action commits `chore: refresh` to `main` — **always rebase before pushing** (see AGENTS.md rule 2).

### 4.1 Deterministic city state

`data/city-state.json` records the city's public, reproducible time state:

- `era` is founded on the oldest public repository creation date. The daily workflow injects its UTC
  run day as `as_of`, so quiet repositories continue to age; local builds without that explicit input
  fall back to the newest reproducible public source timestamp.
- `season` compares repositories pushed in the latest 30-day window with six preceding 30-day
  buckets. Sparse histories use the recorded recent-active share fallback. The value is one of
  `spring`, `summer`, `autumn`, or `winter`, with its inputs and reason stored beside it.
- `stats` contains only aggregates defensible from the current public catalog. Complete commit
  history is unavailable, so `commit_history.total` stays `null` rather than being estimated.
- `last_sap_flow` is that explicit UTC batch day or, for local fallback builds, the latest reproducible
  source timestamp. It is never an implicit wall-clock read inside the generator.
- `roots` contains archived public repositories only, with active years and a one-line achievement
  derived from public metadata. It is correctly empty when the catalog has no archived repos.

The owner town uses this state for a restrained static sky/fog/light palette. Other public towns use
the neutral summer palette because no owner-specific city-state artifact is fetched for them.
Buildings derive wear from the same reference date, while archived buildings preserve their footprint,
silhouette, nameplate, collision, and card identity. These effects require no runtime GitHub or LLM call.

---

## 5. Scholars & the taxi (NPCs)

Each scholar in `scholars.js` is *a star + a myth + one MCP knowledge source*. Active scholars are drawn
in the night sky; POLARIS/VEGA/RIGEL stay around the plaza while MIRA and LYRA patrol their domain districts.

| Scholar | `kind` | Myth | Knowledge source (`ks` / `kb`) | Role |
|---|---|---|---|---|
| **POLARIS** · the Wayfinder | `taxi` | Hermes | `github-repos-mcp-ks` / `repolis-github-kb` | Finds a repo and **drives** you to its house. |
| **VEGA** · the Archivist | `msdocs` | Daidalos | `microsoft-learn-mcp-ks` / `repolis-mslearn-kb` | Answers Azure/.NET/Copilot from **Microsoft Learn**, with references. |
| **RIGEL** · the Cartographer | `deepwiki` | (Ariadne's thread) | DeepWiki MCP | Maps how a named public repo works (keyless). |
| **MIRA** · the Timekeeper | `context7` | Kairos | Context7 direct MCP | Reads current, version-specific library docs while patrolling the Library district. |
| **LYRA** · the Forgemaster | `huggingface` | Orpheus | Hugging Face direct MCP | Finds public models, datasets, and papers while patrolling the AI district. |

### How a scholar answers (two paths)

```
your question
  ├─▶ grounded path  — repo/docs question → KB retrieval via the scholar's MCP source
  │                     → answer synthesized by Azure AI Foundry gpt-5.4-mini, in your language,
  │                       WITH references (📚 참고한 문서 / Sources — a collapsible panel, default-collapsed)
  └─▶ starlit path    — off-topic / small-talk / KB miss → in-persona general chat (keyless Entra SP),
                        no repo pushed, marked "✦ how I answered · general knowledge"
```

The grounding Worker (`cloudflare-taxi/src/grounded.js`) supports two grounded paths: Azure AI Search KB
synthesis for POLARIS/VEGA, and direct public MCP adapters for RIGEL/MIRA/LYRA. Direct MCP text is treated
as untrusted evidence, optionally synthesized into the user's language, and always surfaced with references.
Off-topic chat still uses the starlit persona path.

Residents do not own MCP tools. `scholarHandoffKind()` recognizes only clear specialist intent, adds a
bilingual handoff action to resident or circle chat, and points the existing compass at the scholar's live
position. It never calls the taxi or opens the specialist chat automatically.

### Taxi search pipeline (client, in `index.html`)

```
question → ① intent agent (deterministic: landmarks, "most popular/cloned/forked/viewed", random)
         → ② inverted index over name·label·lang·desc·topics + synonyms → top-K shortlist
         → ③ ranking (name-hit ≫ token-hit ≫ substring, +topic, +popularity)
         → ④ LLM picks ONE from the shortlist (RAG) → "PICK: <repo>"
         → ⑤ remaining candidates become one-tap alternative chips
```

Three modes: **Local** (default, keyless, instant) · **WebLLM** (on-device WebGPU) ·
**🛰️ AI Foundry Live** (the Worker). Anything unconfigured → silent Local fallback.

---

## 6. Town modes

| Mode | URL | Behavior |
|---|---|---|
| **Owner town** | bare URL | The generated owner snapshot from `repos.json`. The taxi + scholars are fully live. |
| **Public town** | `?user=<login>` | Rebuilds the town from any public GitHub user's repos (cached in `localStorage`, stale-fallback). Cross-town taxi driving is disabled; a "go home" button returns to the owner city. |
| **Repo Portal** | `?repo=<owner>/<repo>&ref=repo-portal` | Resolves one public repo first, shows a compact proof, then opens its Atelier after one entry click. |
| **Expanded owner town** | `?user=<owner>&focus=<repo>&ref=repo-portal` | Loads the existing public-town catalog only after explicit expansion, merges the target when needed, and opens the same Atelier. |
| **Repo Route entry** | `?user=<login>&route=<repo1>,<repo2>,<repo3>&ref=repo-route` | Confirms an ordered current-catalog route before entry, then guides the existing town one real house at a time. |

Public mode only activates for a **valid, non-owner** username; the bare URL always loads the owner city
unchanged. A valid `repo` query takes precedence over `user`, `twin`, `growth`, and repo-card hash state.

---

## 7. The Kronos Council (separate subsystem)

`council/` is a self-contained **multi-agent debate → judge** engine, unrelated to the city build:
three peer sages (Olddoc · Livewire · Hearsay) argue, and the Chair **KRONOS** weighs claims by
`source × recency` for a **deterministic** verdict. Curated cases keep a math verdict; free-topic verdicts
are AI inference and wear a `⚡ unverified` badge. Its determinism is locked by
`node council/test.mjs` + `node council/test-live.mjs` — see [`COUNCIL_PATTERN.md`](../COUNCIL_PATTERN.md).

---

## 8. Village Chronicle

The daily Village Chronicle is a deterministic three-scene exploration loop stored in the existing
`repolisCourse` payload:

1. meet one resident who exists in the current town,
2. visit that resident's reload-stable cherished haunt,
3. discover either a metadata-related repo in their district or, for a plaza guide, a real active district.

Its seed includes the local date, public-town login, and sorted repository catalog. The payload stores
identifiers and completion keys rather than rendered text, so language switching remains live. Progress is
strictly sequential and reuses resident chat, the compass/Gitber ride, district hubs, repo cards, and the
Explorer Passport UI. It adds no AI call, backend, timer loop, or storage namespace.

---

## 9. Town Gazette

The Gazette compares a compact public-repo snapshot with the last snapshot explicitly marked read for the
same town. Canonical repo names make ordering irrelevant. It detects additions, removals, push timestamps,
positive visitor/view/clone/star/fork deltas, and release tags when the source provides them (owner data;
lightweight public towns do not fetch releases). Negative corrections are ignored.

Snapshots are local-only, capped to the five most recently visited owner/public towns, and never sent to a
backend. The comparison runs once at load. Gazette rows reuse compass navigation, while `Mark read` advances
the baseline and clears the Passport notification.

---

## 10. Town Growth Replay

Growth Replay uses only each repo's public `created` timestamp. The pure
[`assets/town-growth.js`](../assets/town-growth.js) helper deduplicates canonical repo names, rejects invalid
dates, groups houses by UTC creation year, and returns immutable cumulative milestones. Two or more distinct
birth years are required; unknown-date houses appear only in the present milestone.

The runtime hides or reveals existing house roots, animates only newly visible roots, forces the existing far
architectural LOD, and frames the visible bounds with reusable camera vectors. It adds no scene object, texture,
light, backend, recurring timer, or storage key. Closing restores house visibility, LOD ownership, camera,
fog, sky phase, player visibility, and navigation.

`?growth=<year>&ref=growth-replay` resolves to the latest real milestone at or before that year. Era postcards
capture the same visible houses and report their truthful cumulative count. Only repos that remain public
today can appear. The year is historical; house height, width, garden, ornaments, languages, topics, and all
other architecture still use **current** public metadata because Repolis does not possess historical metric
snapshots.

---

## 11. Repo Portal

[`assets/repo-portal.js`](../assets/repo-portal.js) is the pure contract for username/repository parsing,
query precedence, public repo projection, canonical share links, owner-town expansion links, and coarse
latency buckets. It has no DOM, storage, network, Three.js, or random dependency.

The runtime's target-first loader follows one bounded sequence:

1. exact owner `repos.json` match;
2. fresh 15-minute local cache;
3. one unauthenticated `GET /repos/{owner}/{repo}`;
4. explicitly labelled stale cache after failure;
5. the existing owner town as a usable fallback.

The Portal cache stores only projected public fields, uses LRU order, and is capped at 30 entries and 512
KiB. A 403/429 is not retried. The target mode creates one normal repo object, so district classification,
building construction, repo search, and Repository Atelier do not need a parallel rendering model.

The intro and GitHub Station share the parser. A repository resolves to
`?repo=owner/repo&ref=repo-portal`; entering hides unrelated proof actions and opens the bound Atelier. The
Atelier can copy the same published address, open GitHub, or navigate to an explicit `?user=&focus=`
expansion. Expansion is the only action that fetches the owner catalog before showing it.

New Portal funnel events use a page-lifetime session ID and coarse enums only. They remove owner, repo, URL,
raw input, query text, `cityUser`, and persistent instance ID before the optional analytics sink. See
[`repo-portal-change-guide.md`](repo-portal-change-guide.md) for the full maintenance and QA contract.

---

## 12. Repo Route

[`assets/repo-route.js`](../assets/repo-route.js) is the pure URL and validation contract. A route contains
exactly two or three unique GitHub repository names, resolves case-insensitively to canonical names in the
town currently loaded, and rejects invalid, unknown, duplicate, overflow, and conflicting input. A valid
Repo Portal, focused Atelier, Growth Replay, or Twin Towns query wins instead of layering incompatible HUDs.

The builder is session-only. A card can add the house the visitor actually opened; Wayfinding can then add
other visited houses, remove stops, follow the order locally, or share one canonical URL. The recipient intro
shows the stop list before entry. Progress advances only when the current repo card opens; unrelated cards do
not skip stops. Completion reuses the existing earned Star invitation and bounded celebration.

The runtime adds no scene object, texture, light, fetch, backend, storage key, or timer. Route events are
allowlisted to entry, stop count, result, device, language, channel, and timestamp. Repository names, owner,
URL, query, session ID, and persistent instance ID do not leave through this feature's telemetry.

---

## 13. Open Source Quests

[`assets/contribution-quests.js`](../assets/contribution-quests.js) is the pure boundary between GitHub
Search data and the product. It validates the current town owner and catalog, excludes pull requests and
closed issues, requires a canonical `/owner/repo/issues/<number>` URL, trims untrusted text, caps labels, and
returns immutable projections. Ranking is deterministic: `good first issue`, then `help wanted`, then other
open issues; newer work wins within a tier. At most 50 API items are inspected, three quests are displayed,
and no repository can occupy more than two slots.

Opening Wayfinding or the Quest Board performs no request. Only **Find public quests** makes one anonymous
`GET /search/issues?q=user:<owner> is:issue is:open` request with a nine-second timeout. A successful result is
held in memory for the tab and is not refetched. Rate, network, and empty states stay inside the accessible
dialog. No login, token, issue mutation, proxy, cache, or new backend exists.

Selecting a quest closes the board and reuses the real taxi, house, and repo card. The exact GitHub issue
link appears on that card, so the journey remains city → repository → contribution rather than becoming
another issue list. Only clicking an issue link makes the existing earned Star invitation eligible; it still
waits until modal ownership clears and remains dismissible. Telemetry is limited to coarse entry, result,
count, tier, device, language, and channel values and removes all owner, repo, issue, URL, session, and
persistent instance identity.

The feature adds no Three.js object, texture, light, storage key, dependency, startup network request, or
recurring timer. Its only network work is the visitor-triggered public search.

---

## 14. Repository Atelier

Every non-library repo card can enter one lazy-created dedicated Three.js scene. The room is reused rather
than duplicated: three bounded canvas atlases redraw the History/Data, Impact/Signals, and Action walls, while
the core shape, metric artifacts, instanced architecture, path, colors, and lighting rebind from the selected
repo's current metadata. The visitor is a clone of the current Repolis chibi hierarchy with shared GPU
geometry/materials, not a separate placeholder character.

The room owns update, camera, input, and rendering until explicit exit; exterior simulation renders zero
frames during that time. Entry snapshots the exact exterior player, camera, navigation, modal, chat, and tour
state, and exit restores it idempotently.

Terminal ownership is explicit:

- **Open GitHub** is the only external action and opens a safe new tab.
- **Ask Gitber about this repo** opens the existing Local/WebLLM/grounded chat as a dark in-room panel.
- **Why this district?** renders the deterministic classifier explanation in the same panel.
- Taxi rides, scholar handoffs, and repo recommendation ride buttons are unavailable while the room owns
  interaction, so they cannot leak exterior state into the exhibition.

Entering or rebinding performs no fetch, model call, dynamic import, or backend work. Only an explicit Ask
turn may use the already selected Gitber mode.

---

## 15. Resident Agency — Shared Joy

Shared Joy is a single session-local pair state in the resident social layer. When no stronger owner is
active, a deterministic time-slice planner chooses two compatible idle residents, preferring named friends.
Persona preferences, current moods, time of day, and recent pair memory select one activity:

- a flower walk to an existing `GLOW_FLORA` patch,
- stargazing while the town's stars are visible, or
- a visit to a real rendered repo house.

The lifecycle is `go → enjoy → complete`. Participants travel to separate arrival slots, alternate scripted
bilingual lines, and reuse existing low-cost poses. LOW_END keeps the same behavior with a longer cadence,
shorter enjoyment, purposeful movement, and no arrival sparkle.

Shared Joy yields immediately to visitor proximity, repo reactions, resident/group chat, ambient gatherings,
festivals, seating, hidden tabs, or disabled motion. Travel timeout uses the same capped simulation delta as
resident movement. The state is not persisted and makes no AI, MCP, network, asset, or storage request.

---

## 16. Starlight Row — resident homes and routines

Starlight Row is a fixed civic landmark at `(130, 130)`, outside the repository rings but inside the
205-unit map and 215-unit player bounds. It contains one roster-bound cottage per resident. Shared instanced
walls, roofs, yards, doors, and windows keep the draw cost bounded; only bilingual name signs remain
individual. Cottage and sign colliders join both player collision and resident destination clearance.

Each live resident now carries two truthful anchors:

- `work`: the existing district/plaza spawn used by daytime wandering and cherished haunts,
- `home`: that resident's cottage porch in Starlight Row.

At the night boundary, free residents begin staggered collision-aware commutes home. After night, they return
to `work`. A resident already claimed by chat, Shared Joy, a gathering, festival, stroll, seat, visitor
proximity, hidden tab, or disabled motion waits until that owner releases them. At home, residents use their
own porch seat and deterministic sectors of the shared green, keeping the neighborhood social without
stacking. The schedule is session-local and deterministic; it adds no model, MCP, backend, or saved state.

The landscape is part of the same bounded quarter model. Each home receives resident-coloured instanced
flowers, hedges, and stepping stones. The central green contains a raised shared flower bed and visual-only
lanterns. Instanced broadleaf/cypress trees and shrubs form a perimeter with a deliberate entrance gap toward
town. Tree and home colliders share `RES_QUARTER_COLLIDERS`; overflow repository slots reserve the full
42-unit landscape clearing. LOW_END reduces counts rather than removing the garden structure.

Cottage identity is also deterministic. `RES_HOME_STYLES` maps residents to hip, gable, or hex roofs and
optional window boxes, canopies, and chimneys. Walls remain one instance batch; roofs use three batches;
shutters, transoms, boxes, canopies, posts, chimneys, and finials each use at most one additional batch.
LOW_END preserves roof/shutter/transom/box identity but omits the four optional exterior batches.

The quarter is reachable through Gitber landmark intent and GitHub Station, appears as `🏘️` on the world
map, and awards the local-only `homes` Explorer Passport stamp.
