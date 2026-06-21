<div align="center">

# 🏙️ Repolis — the City of Repos

**Beyond the 6‑pin limit: a walkable 3D city where every one of your GitHub repos lives.**

[English](README.md) · [한국어](README.ko.md)

Every house is a repo. Its height, brightness, ornamentation and garden don't grow from ⭐ — they grow from **real traffic** (visitors · clones · forks · views).
Lost? Ask the 🚕 **LLM taxi driver**. Say _"show me a repo about RAG"_ and the cab **physically drives over, picks you up, and takes you to that house.**

[**▶ Live demo**](https://hyeonsangjeon.github.io/Repolis/) · Built with Three.js · one single `index.html`

</div>

---

## ✨ What's inside

- 🚶 **Walkable open world** — stroll a Ghibli‑style city with WASD / arrows / on‑screen joystick. Arrive at a house (repo) and a card opens (with its GitHub **social preview** image when set).
- 🏙️ **Downtown & Hometown districts** — the most popular repos rise as inner‑city towers; the rest become cozy cottages in the outer hometown, along ring roads and radial avenues.
- 📊 **Metrics _are_ the architecture** — the data builds the city:
  | Metric | Shows up as |
  |---|---|
  | 👁 unique visitors | building **height** · window **brightness** |
  | ⑂ forks | building **width** (lot size) |
  | ⬇ clones | **ornamentation** (banners · gold trim) |
  | 📈 views | **garden** · fence size |
  | ★ stars | **gold‑star** ornaments on the roof |
- 🗓️ **Cumulative since move‑in day** — visitors & clones are lifetime totals, counted from the day each house was "built" (first seen in the data). The card shows a _"since YYYY‑MM‑DD"_ note.
- 🚕 **LLM taxi driver that actually drives you** — ask in natural language; it picks the best‑matching repo, explains it, then the cab **comes to your spot, you board, and it carries you** to the house. Three modes:
  - **Local search** (default · no key · instant) — synonym‑expanded intent search, now also metric‑aware (_"most cloned"_, _"most visited"_, _"most forked"_).
  - **WebLLM** (in‑browser AI · no key · WebGPU)
  - **AI proxy** (Vercel → Azure OpenAI · best quality)
- 🌳 **A city that feels alive** — gardens, pets (chow‑chow NPCs), street trees, varied house shapes, category logos on the roofs (AI / Data / Software / …), and proper town‑house roads.
- 🟢 **Optional realtime multiplayer** — see other visitors walking around as avatars with name tags, plus a **live online + today's unique‑visitor counter** in the HUD. Defaults to solo on a plain static host; turn it on with one free server (below).
- 🌐 **English / 한국어 toggle** — switch the whole UI language live from the HUD.

## 🧠 How it works (data flow)

```
github-traffic-monitor (private)          Repolis (public)
  └ daily cumulative traffic (logs/*.csv) ──┐
                                            ├─▶ .github/workflows/refresh.yml (daily)
  gh api: public · non-fork repo metadata ─┘        └ scripts/build_repos.py
                                                       └─▶ repos.json ──▶ index.html (Three.js 3D city)
```

- **Public, non‑fork repos only** — a private repo name is never exposed on the public site.
- Traffic totals are the **cumulative values** gathered by [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor). (GitHub's own traffic API only keeps a rolling 14‑day window — this is why a daily collector is needed to build lifetime totals.)

## 🚀 Run your own

1. **Fork / copy this repo.** You also need a daily traffic source — keep a collector like [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor) running.
2. **Add a secret** — `Settings → Secrets and variables → Actions`:
   - `GH_PAT` : a `repo`‑scoped Personal Access Token (to check out the private traffic‑monitor + list your repos).
3. **Enable GitHub Pages** — `Settings → Pages → Source: Deploy from a branch → main / (root)`.
4. **Run the Action** — `Actions → Refresh Repolis data → Run workflow` (then it auto‑refreshes daily).
5. Done — your city opens at `https://<you>.github.io/Repolis/`.

### (Optional) AI proxy mode — Vercel + Azure OpenAI

For the highest‑quality taxi driver, deploy `api/taxi.js` to Vercel:

- Import this repo into Vercel → you automatically get an `/api/taxi` endpoint.
- Env vars: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_KEY`, (optional) `AZURE_OPENAI_API_VERSION`, `ALLOW_ORIGIN`.
- In the taxi chat, switch the mode to **AI proxy** and enter your proxy URL (`https://<project>.vercel.app/api/taxi`).

### (Optional) Realtime multiplayer

The static site is solo by default. To let visitors meet each other, run one tiny WebSocket server and point the world at it:

- **PartyKit (one command):** `npx partykit deploy` (uses `party/repolis.js` + `partykit.json`). You'll get a URL like `wss://repolis.<you>.partykit.dev/parties/main/world`.
- **Self‑host:** `node scripts/dev_realtime.mjs` (needs `npm i ws`) → listens on `ws://localhost:1999`.
- **Point the world at it** with any one of:
  - URL query: `?rt=wss://…`
  - `localStorage.setItem('repolisRT','wss://…')`
  - `window.REPOLIS_RT = 'wss://…'`

> Privacy: the traffic logs that drive the city are committed publicly, and only your **public, non‑fork** repos are ever shown.

## 🎮 Controls (WoW‑style camera)

| Input | Action |
|---|---|
| `W A S D` / arrows / joystick | Walk |
| **Left‑drag** | Orbit camera (free look) |
| **Right‑drag** | Steer character · WoW‑style · wheel = zoom |
| `Enter` / click | Open the repo you're standing at |
| 🚕 button | Ask the taxi driver |
| ☰ button | Wayfinding menu (search) |
| 🌐 button | Switch English / 한국어 |

## 🛠 Tech

Three.js (r0.160) · toon shading + inverted‑hull outlines · ACES tone mapping · a single dependency‑free `index.html` · GitHub Actions · (optional) Vercel + Azure OpenAI · WebLLM · (optional) PartyKit / `ws` for realtime.

## 🙏 Credits

Data: [github-traffic-monitor](https://github.com/hyeonsangjeon/github-traffic-monitor) · social previews: `opengraph.githubassets.com`.

<div align="center"><sub>Made with ☕ &amp; Three.js — only 6 pins, but your repos become a whole city. 🏙️</sub></div>
