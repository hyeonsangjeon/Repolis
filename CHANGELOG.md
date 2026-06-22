# Changelog

All notable changes to **Repolis** are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/); dates are UTC.

## [1.2.0] — 2026-06-23

### 🎨 Procedural texture detail
- **3D‑beveled surfaces** — the category‑themed wall textures (brick · siding · panel · stone · stucco) and shingled roofs now have per‑brick/plank/stone colour variation, highlight + shadow edges, recessed mortar and panel bolts, so flat patterns read as raised masonry. Still 100% procedural canvas textures, zero image assets.
- **Detailed ground** — directional grass blades on the lawn, gravel speckle + jagged cracks on asphalt, and fine grain on dirt/sand, all seamless (9‑tile wrap) and deterministic.
- **Contact shadows** — every building drops a soft shadow onto its plot so houses sit grounded on the lawn instead of floating (daytime depth cue).

### 🏘️ A livelier, more varied world
- **High‑contrast signage** — white halo + category colour band, sized up for readability from a distance.
- **Roaming chow‑chows** trot between plaza waypoints with wagging tails; well‑loved repos also get a garden dog.
- **Ponds & garages** — koi ponds for active / well‑starred repos and driveway garages with a parked car for well‑forked ones.
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
