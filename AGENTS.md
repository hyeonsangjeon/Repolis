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
| **`repos.json`** | Generated array of repo objects that build the current owner city. **Do not hand-edit.** | Never directly; regenerate (see below). |
| **`scholars.js`** | `window.SCHOLARS` roster: POLARIS · VEGA · RIGEL · MIRA · LYRA. | Adding / editing an NPC scholar. |
| **`assets/world-tree/createRepolisHero.js`** | Procedural World Tree factory imported by `index.html`. | Changing the tree geometry, materials, sockets, or actions. |
| **`scripts/build_repos.py`** | Rebuilds `repos.json` from `data/logs/*` traffic + `gh api`. | Refreshing the city data locally. |
| **`scripts/smoke.mjs`** | Hermetic static and behavioral regression guards for the city runtime. | Any client feature, navigation, or generated-module integration change. |
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

# 2) Rebuild repos.json from the owner's repos + committed traffic logs (needs gh CLI, logged in)
gh auth login
GTM_DIR=data python3 scripts/build_repos.py     # regenerates repos.json (do not hand-edit)

# 3) Rebuild the Contribution Library JSON from the sibling Hyeonsang-AI-Contributions README (KO/EN)
node scripts/build-contribution-library.mjs     # regenerates assets/contribution-library.json (deterministic)
```

`repos.json` is an **array**; each entry's shape (keys you can rely on):
`repo, desc, lang, topics[], url, home, stars, forks, fork, views, visitors, clones, size, open_issues,
license, archived, default_branch, release_tag, release_date, created, pushed, tracked, first_seen,
social, social_custom, score, rank`. Full meaning: [`docs/domain-model.md`](docs/domain-model.md).

---

## 🚀 Deploy

| Target | Command / trigger | Result |
|---|---|---|
| **The site** (index.html, data, scholars) | `git push origin main` | GitHub Pages serves root (`.nojekyll`). Build is automatic. |
| **Grounding worker** | `cd cloudflare-taxi && npx wrangler deploy` | Updates `repolis-taxi` (the live AI brain). |
| **Realtime worker** | `cd cloudflare && npx wrangler deploy` | Updates `repolis-rt` (presence). |

The site talks to the workers through two constants in `index.html` (already wired for the live site):
`GROUNDED_DEFAULT` → `https://repolis-taxi.wingnut0310.workers.dev/`, and
`RT_DEFAULT` → `wss://repolis-rt.wingnut0310.workers.dev`. A fresh fork with neither deployed still
works: the taxi falls back to keyless **Local search** and the city stays solo. **No backend is required to run.**

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
node --check scholars.js
node --check cloudflare-taxi/src/grounded.js
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
| Change districts, Village Chronicle, passport, or exploration loops | `index.html` + the matching behavioral groups in `scripts/smoke.mjs`. |
| Change Town Gazette / return-visit freshness | `/*FRESHNESS*/` + Passport render/start flow in `index.html`; keep snapshots local, bounded, per-town, and explicit-read only. |
| Change resident homes, styles, gardens, routines, moods, friendships, haunts, or Shared Joy | The resident social layer + Starlight Row blocks in `index.html`; preserve the resident style map, 3 roof batches, 10/6 desktop/LOW_END detail-batch cap, 42-unit reserve, entrance gap, quarter colliders, home/work truth, owned porch seats, and social ownership guards. |
| Fix / improve a scholar's answer or references | `cloudflare-taxi/src/grounded.js` (server) + the trace panel in `index.html`. |
| Add a new scholar NPC | `scholars.js` + `scholarConfig`/`MCP_NPCS` in `cloudflare-taxi/src/grounded.js`; choose KB-backed or direct MCP deliberately; document in `SCHOLARS.md`. |
| Tune the taxi's repo search/intent routing | `index.html` (Local search: inverted index + intent agent). |
| Touch the debate/verdict engine | `council/` — and keep `node council/test*.mjs` green. |
| Add a UI string | both `ko` and `en` i18n dictionaries in `index.html`. |
| Know what's intentionally NOT supported | [`docs/known-limitations.md`](docs/known-limitations.md). |

---

## 🧩 One-paragraph mental model

A daily Action turns the owner's **public repos + committed traffic logs** into `repos.json`. `index.html`
turns that array into metric-shaped buildings, topic districts, routes, maps, and exploration progress.
Residents add named homes, home/work commutes, moods, friendships, haunts, Shared Joy excursions, gatherings, and festivals; landmarks include the
Contribution Library, Chronopolis, Observatory, and imported procedural World Tree. Gitber/POLARIS and the
scholars (VEGA · MS Learn, RIGEL · DeepWiki, MIRA · Context7, LYRA · Hugging Face) add natural-language
navigation and grounded answers. Residents hand specialist questions to the right scholar instead of gaining
their own MCP access. The Passport's local Town Gazette makes daily public-repo changes visible on return. Everything
degrades gracefully to keyless Local search and solo play.
