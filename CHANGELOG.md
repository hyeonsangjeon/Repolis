# Changelog

All notable changes to **Repolis** are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/); dates are UTC.

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
