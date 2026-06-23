# Changelog

All notable changes to **Repolis** are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/); dates are UTC.

## [1.4.0] — 2026-06-23

### 📘 Knowledge NPCs — talk to MCP‑grounded experts (NPC = MCP)
- New **MS Docs engineer NPC** in the plaza: walk up and ask about Azure, .NET or Copilot, and it answers from the **official Microsoft Learn docs in real time** via the hosted **Microsoft Learn MCP server** (`learn.microsoft.com/api/mcp`) — **keyless and free** (this NPC needs no Azure and no key). Each answer shows a **trace panel** linking the source docs.
- Generalized the town into an **NPC = MCP** system — the taxi driver and the engineer are both NPCs you walk up to and chat with, and **each NPC activates only its own MCP knowledge source**. The Cloudflare Worker gained an MCP allowlist (`MCP_NPCS`) and a small streamable‑HTTP MCP client that routes `{question, npc}` to the right server, falling back to the Azure KB taxi path otherwise.
- The engineer greets and small‑talks **in character** (no taxi lines leaking through), fully localized in **English / 한국어**.

## [1.3.0] — 2026-06-23

### 🛰️ AI Foundry Live — grounded taxi mode
- New **🛰️ AI Foundry Live** taxi mode: live, real‑time answers about your repos via an **Azure AI Search Knowledge Base** whose **MCP Knowledge Source** calls **GitHub's hosted MCP server** (`api/taxi-grounded.js`). The serverless function holds only a Search key — the Azure OpenAI key and GitHub PAT stay server‑side inside the Knowledge Source. A live **trace panel** shows the knowledge source, MCP tools and reference repos behind each answer. `SEARCH_KS_NAME` is comma‑separated, so you can attach more MCP sources to the same KB.
- **Zero‑backend by design** — a fresh clone needs no keys or servers: **Local** is the default and **WebLLM** runs on‑device. AI Foundry Live is fully optional and **silently falls back to Local** when unconfigured, unreachable or slow (no errors, no hanging). Added [`.env.example`](.env.example) documenting every backend variable for both `api/taxi-grounded.js` and `api/taxi.js`.
- **Cloudflare Workers backend** — added [`cloudflare-taxi/`](cloudflare-taxi/), a ready‑to‑deploy port of the grounding function to Cloudflare Workers. Workers bill CPU time (not the wall‑clock spent awaiting a subrequest), so the slow KB call finishes instead of hitting Vercel Hobby's ~10 s wall — fewer silent Local fallbacks, on the free plan. Paste the Worker URL into `GROUNDED_DEFAULT` in `index.html` to enable grounding for every visitor.

### 🧠 Smarter, friendlier chat
- **Auto knowledge‑source routing** — the driver now decides *per message* whether a question actually needs a repo search (→ grounding/Knowledge Base) or is just chit‑chat, so greetings and small talk get instant local replies and only real repo questions hit the KB.
- **Friendlier small talk** — greetings, thanks, "who are you?", "what can you do?" get warm, direct answers; mid‑chat replies no longer tack on a forced repo recommendation.

### 🐛 Fixes & polish
- **Korean IME + Enter** — fixed the input getting garbled when pressing Enter mid‑composition (now commits the syllable first; a second Enter sends — standard Korean web UX).
- **Mode persistence** — the selected taxi mode is remembered across reloads (`localStorage`).
- The grounded backend's runtime budget is configurable (`GROUNDED_MAX_RUNTIME_S`, default 30; KB requires 11–599), and selecting AI Foundry Live with no URL now stays on Local **without re‑prompting on every message**.

## [1.2.0] — 2026-06-23

### 🌿 Provençal village
- **Warm southern‑France palette** — every house now wears terracotta‑clay roof tiles over warm ochre, cream and limestone walls, with pastel **lavender, sage and Provence‑blue shutters** for contrast. The language palette was re‑tuned so the whole town reads as one sun‑washed Provençal village while keeping subtle per‑language neighbourhood tints.
- **Lavender, cypress, olive & sunflowers** — lavender clumps bloom in every yard and frame the plaza fountain, while the outer ring is planted with tall cypress spires, silvery olive trees and sunflower patches.
- **Azure sky & golden light** — a deeper cobalt‑azure sky, warmer golden sun and a soft warm haze give the village that bright, sun‑drenched Mediterranean feel (daytime; the starry galaxy night is unchanged).

### 🎨 Procedural texture detail
- **3D‑beveled surfaces** — the category‑themed wall textures (brick · siding · panel · stone · stucco) and shingled roofs now have per‑brick/plank/stone colour variation, highlight + shadow edges, recessed mortar and panel bolts, so flat patterns read as raised masonry. Still 100% procedural canvas textures, zero image assets.
- **Detailed ground** — directional grass blades on the lawn, gravel speckle + jagged cracks on asphalt, and fine grain on dirt/sand, all seamless (9‑tile wrap) and deterministic.
- **Contact shadows** — every building drops a soft shadow onto its plot so houses sit grounded on the lawn instead of floating (daytime depth cue).

### 🏛️ Varied architecture
- **Eight roof styles** — added **mansard, A‑frame, shed (mono‑pitch) and barrel‑vault** roofs alongside the existing flat · hip · gambrel · gable, so the skyline now reads as a real mix of silhouettes instead of repeating gables.
- **New wall textures** — **Tudor half‑timber, vertical board‑and‑batten and corrugated metal** join brick · siding · panel · stone · stucco, assigned per repo so neighbours look distinct (still 100% procedural, zero image assets).
- **Stone base plinth** — every building now sits on a projecting water‑table base course, grounding it on its plot.
- **Window shutters** — traditional pitched‑roof homes gain colour‑matched shutters flanking their windows, skipped automatically where they'd overhang the wall edge.
- **Rooftop tech on flat‑roofed shops** — commercial flat roofs carry a tilted solar array, a glowing skylight and an HVAC unit, tucked inside the parapet.

### 💧 Living water
- **Animated cel water** — ponds and the new plaza fountain use a custom shader with drifting ripples, a sun/moon glint, depth‑tinted colour and a day↔night palette, so water actually moves and catches the light instead of sitting as a flat disc. One shared time/night uniform drives every water surface.
- **Town‑square fountain** — the central plaza medallion is now a two‑tier stone fountain with a pedestal bowl, arcing spray particles and stone coping; it glows softly at night while staying low enough that distant houses remain visible.
- **Koi, lotus & reeds** — ponds gained swimming koi that trace lazy circles, a lotus bloom, lily pads and cattail reeds at the rim.

### 🏘️ A livelier, more varied world
- **High‑contrast signage** — white halo + category colour band, sized up for readability from a distance.
- **Roaming chow‑chows** trot between plaza waypoints with wagging tails; well‑loved repos also get a garden dog.
- **Ponds & garages** — animated koi ponds (swimming koi, lotus & reeds) for active / well‑starred repos and driveway garages with a parked car for well‑forked ones.
- **Rest pavilions** dotted around the city — and you can now **sit** on benches/chairs and stand back up.

### 📊 More GitHub metrics on cards
- Repo cards now also surface **open issues, license, latest release (with date) and an archived badge** when present.

### 🎬 Demo
- **Refreshed hero GIF** (EN/KO) — a high‑overhead tour of the newly textured city (pavilions, ponds, ground shadows), then hailing the taxi with "most popular repo" and riding to that repo's house and social card. Shot with an overhead‑locked camera so the city stays readable end‑to‑end.

## [1.1.0] — 2026-06-23

### 🚕 Smarter taxi driver (search quality)
- **Intent agent** — a deterministic router now runs *before* any LLM in all three modes, so navigation/metric questions are exact and never hallucinated: "library / 도서관" drives to the Contribution Library, and "most popular / most stars / recent / most cloned·forked·viewed / random" are answered directly. (Fixes WebLLM sending "도서관 데려다줘" to a random repo.)
- **Topic beats metric sorting** — a strong subject match now wins over generic "popular/clones/traffic" sorting, and English metric keywords are word‑boundary matched, so "youtube **download**er nas" lands on the repo instead of the most‑cloned one and "traffic monitor" finds dashboard tools rather than the busiest page.
- **Search index** — repos are indexed once into an inverted index with per‑repo token sets (name · label · language · description · topics) plus synonym expansion; ranking weighs name‑hit ≫ token‑hit ≫ substring, with topic and popularity boosts, and a bonus when *your own word* appears in a repo's name.
- **Candidate RAG** — WebLLM and the AI proxy now receive only the index's top‑K shortlist (not the full catalog) and must `PICK` from it, cutting wrong/invented picks and speeding up the tiny in‑browser model.
- **Multiple suggestions** — every mode now always returns a few remaining candidates as one‑tap chips (padded with popular repos when a query has only one hit), so you can pick among several recommendations instead of one.

### 🎨 Visuals
- **Fresnel rim light** on all toon materials (buildings · ground · characters · NPCs · trees) — a soft sky backlight by day and a cool moonlight silhouette by night, for a cleaner cel look. Pure shader math, zero assets.

### 📚 Docs
- README (EN/KO): the AI taxi driver section now documents the modes, intent routing, indexing and candidate‑RAG pipeline, with a Vercel `/api/taxi` agent example.

## [1.0.0] — 2026-06-22

First public release — every GitHub repo you own becomes a walkable 3D city. Beyond the 6‑pin profile limit.

### 🏙️ World & visuals
- Walkable low‑poly 3D city built with Three.js (toon shading + inverted‑hull outlines, ACES tone mapping), shipping as a single dependency‑free `index.html`.
- **Six house tiers** by traffic rank: `cabin → cottage → house → villa → manor → portico mansion`, with wings, columns, porticos, dormers, balconies and cupolas.
- **Downtown vs. hometown** districts — popular repos rise as inner‑city towers; the rest are cozy cottages along ring roads and radial avenues.
- **Day / night toggle** (🌙 / ☀️): navy sky, street lamps and stars at night — and **each repo's windows glow by how active it is** (recent pushes · clones · views), so your busiest repos light up the skyline.
- **Solid buildings** — circle‑collision walking; you now walk *around* houses instead of through them.
- **Roads** — brown dirt footpaths between houses plus asphalt ring‑roads with painted lane lines.
- Prettier windows (frames · mullions · sills · flowerboxes), gardens, chow‑chow pets, street trees, lamps, benches and rooftop category emblems (AI / Data / Software / …).
- **Social‑preview cards** — each house opens a card with the repo's GitHub OG image, stats and "moved‑in" date.

### 📊 Metrics _are_ the architecture
- Height = unique visitors · width = forks · ornamentation = clones · garden = views · gold stars = ⭐ · night window glow = activity.
- Metrics are **cumulative lifetime totals** counted since each repo's move‑in day, working around GitHub's rolling 14‑day traffic window via a daily collector.

### 🚕 LLM taxi driver
- Ask in natural language; the cab **drives to you, picks you up and carries you** to the best‑matching repo, then opens it on GitHub.
- Three modes: **local** synonym/metric‑aware search (default, no key), in‑browser **WebLLM** (WebGPU), and **AI proxy** (Vercel → Azure OpenAI).

### 🟢 Multiplayer & counters
- Optional realtime presence — other visitors appear as name‑tagged avatars.
- **Live · today · all‑time** unique‑visitor counter (🟢 현재 · 오늘 · 누적), backed by a free Cloudflare Worker + SQLite Durable Object (PartyKit and self‑hosted `ws` also supported).

### 🔒 Repos included
- Every public repo you **created**, **plus forks you've actually committed to**; untouched mirror forks and private repos are excluded.

### 🌐 i18n & controls
- Full **English / 한국어** toggle, live from the HUD.
- WoW‑style two‑button camera; desktop (WASD / keys / mouse) and mobile dual‑stick.

### 🛠 Build & ops
- Deployed on GitHub Pages.
- A daily GitHub Action (`refresh.yml` + `scripts/build_repos.py`) regenerates `repos.json` from committed traffic logs.

[1.0.0]: https://github.com/hyeonsangjeon/Repolis/releases/tag/v1.0.0
