# Domain model — how Repolis turns data into a city

This is the conceptual model behind Repolis: the entities, how a repo becomes a building, how the
taxi/scholars answer, and how town modes work. For the operating contract (run/deploy/verify/rules)
see [`AGENTS.md`](../AGENTS.md); for narrative see [`README.md`](../README.md).

---

## 1. Entities

| Entity | Where it lives | Notes |
|---|---|---|
| **Repo** | one object in `repos.json` | The unit of the world — becomes one house. |
| **City / Town** | derived in `index.html` at load | The whole 3D scene built from the `repos.json` array. |
| **District** | deterministic `zoneOf(repo)` result | A topic-shaped neighborhood with a hub, board, map destination, and progress. |
| **Resident** | resident roster in `index.html` | A district-local townsperson with mood, routine, relationships, and a cherished haunt. |
| **Exploration state** | browser `localStorage` | Passport visits, district progress, daily Village Chronicle, and constellation completion. |
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
| `size` | number | Repo size (KB). |
| `open_issues` | number | Shown as a live badge on the repo card. |
| `license` | string | Shown as a badge. |
| `archived` | boolean | Archived repos render muted. |
| `default_branch` | string | e.g. `main`. |
| `release_tag` / `release_date` | string | Latest release badge. |
| `created` / `pushed` | string | Timestamps; `pushed` feeds night-glow recency. |
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

`score` / `rank` are computed in `scripts/build_repos.py` from these signals. Rank chooses the house tier
(`cabin → cottage → house → villa → manor → portico mansion`), while the client-side deterministic
`zoneOf(repo)` classifier chooses a topic district from repository name, description, topics, and language.
Every active district receives a map region, walkable hub, board, and representative repositories.

Counts are **cumulative since move-in day** (`first_seen`/`tracked`), because GitHub's traffic API only
keeps a rolling 14-day window — a daily collector accumulates the lifetime totals offline.

---

## 4. Data pipeline

```
github-traffic-monitor (private, daily)        Repolis (public)
  └ cumulative traffic → data/logs/*.csv ──┐
                                           ├─▶ .github/workflows/refresh.yml (daily)
  gh api: owner's public repos (+ committed forks) ─┘  └ scripts/build_repos.py
                                                          └─▶ repos.json ──▶ index.html (3D city)
```

- Only **public** repos appear (created repos + forks you actually committed to; mirror forks skipped).
- The daily Action commits `chore: refresh` to `main` — **always rebase before pushing** (see AGENTS.md rule 2).

---

## 5. Scholars & the taxi (NPCs)

Each scholar in `scholars.js` is *a star + a myth + one MCP knowledge source*. `active: true` ones are
summoned into the plaza and drawn in the night sky as their constellation.

| Scholar | `kind` | Myth | Knowledge source (`ks` / `kb`) | Role |
|---|---|---|---|---|
| **POLARIS** · the Wayfinder | `taxi` | Hermes | `github-repos-mcp-ks` / `repolis-github-kb` | Finds a repo and **drives** you to its house. |
| **VEGA** · the Archivist | `msdocs` | Daidalos | `microsoft-learn-mcp-ks` / `repolis-mslearn-kb` | Answers Azure/.NET/Copilot from **Microsoft Learn**, with references. |
| **RIGEL** · the Cartographer | `deepwiki` | (Ariadne's thread) | DeepWiki MCP | Maps how a named public repo works (keyless). |

### How a scholar answers (two paths)

```
your question
  ├─▶ grounded path  — repo/docs question → KB retrieval via the scholar's MCP source
  │                     → answer synthesized by Azure AI Foundry gpt-5.4-mini, in your language,
  │                       WITH references (📚 참고한 문서 / Sources — a collapsible panel, default-collapsed)
  └─▶ starlit path    — off-topic / small-talk / KB miss → in-persona general chat (keyless Entra SP),
                        no repo pushed, marked "✦ how I answered · general knowledge"
```

The grounding Worker (`cloudflare-taxi/src/grounded.js`) routes `npc → {kb, ks}`. If the KB returns
**zero** documents it takes the starlit path; if it returns documents they are **always surfaced** as
references (the answer never silently drops grounded sources).

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

Public mode only activates for a **valid, non-owner** username; the bare URL always loads the owner city unchanged.

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
