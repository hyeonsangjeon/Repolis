<div align="center">

<a href="https://hyeonsangjeon.github.io/Repolis/"><img src="assets/banner.svg" alt="Repolis — the City of Repos" width="100%"></a>

# 🏙️ Repolis — the City of Repos

**Your GitHub isn't a 6‑pin grid — it's a 3D city you can walk, and a taxi drives you to any repo you name.**

[![Live demo](https://img.shields.io/badge/Live%20demo-Repolis-4fb4c2?style=for-the-badge&logo=googlechrome&logoColor=white)](https://hyeonsangjeon.github.io/Repolis/)
[![Pages](https://img.shields.io/github/deployments/hyeonsangjeon/Repolis/github-pages?style=for-the-badge&label=Pages&logo=githubpages&logoColor=white)](https://hyeonsangjeon.github.io/Repolis/)
[![Three.js](https://img.shields.io/badge/Three.js-r160-000000?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org)
[![Single file](https://img.shields.io/badge/build-single%20index.html-83bb59?style=for-the-badge)](index.html)
[![Last commit](https://img.shields.io/github/last-commit/hyeonsangjeon/Repolis?style=for-the-badge&color=b3a07f)](https://github.com/hyeonsangjeon/Repolis/commits)
[![Stars](https://img.shields.io/github/stars/hyeonsangjeon/Repolis?style=for-the-badge&logo=github&color=f5c542&logoColor=white)](https://github.com/hyeonsangjeon/Repolis/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-a0a0a0?style=for-the-badge)](LICENSE)

[English](README.md) · [한국어](README.ko.md)

**Your GitHub repos aren't a list — they're a city you can walk.** Every house is a repo, and its height, brightness, ornaments and garden grow from **real traffic** (visitors · clones · forks · views), not ⭐.
Don't know where to go? Just tell the 🚕 **LLM taxi driver** — say _"take me to the most popular repo"_ and the cab **drives over, picks you up, and carries you straight to that repo's house.**

<a href="https://hyeonsangjeon.github.io/Repolis/"><img src="assets/demo.gif" alt="Repolis: see your GitHub repos as a 3D city, tell the taxi &quot;most popular&quot;, ride to that repo's house, open its card, and jump straight to it on GitHub" width="86%"></a>

<sub>▶ <a href="https://hyeonsangjeon.github.io/Repolis/"><b>Live demo</b></a> · Built with Three.js · one single <code>index.html</code></sub>

</div>

---

## ✨ What's inside

- 🚶 **Walkable open world** — stroll a hand-built low-poly city with WASD / arrows / on-screen joystick. **Houses are solid** — walk *around* them, down brown dirt paths and along asphalt ring-roads with painted lane lines. Reach a house (repo) and its card opens (with the GitHub **social preview** image when set).
- 🏙️ **Downtown & Hometown districts** — the most popular repos rise as inner‑city towers; the rest become cozy cottages in the outer hometown, along ring roads and radial avenues.
- 📊 **Metrics _are_ the architecture** — the data builds the city:
  | Metric | Shows up as |
  |---|---|
  | 👁 unique visitors | building **height** |
  | ⑂ forks | building **width** (lot size) |
  | ⬇ clones | **ornamentation** (banners · gold trim) |
  | 📈 views | **garden** · fence size |
  | ★ stars | **gold-star** ornaments on the roof |
  | 🌙 activity _(recent push · clones · views)_ | **window glow at night** |
- 🗓️ **Cumulative since move‑in day** — visitors & clones are lifetime totals, counted from the day each house was "built" (first seen in the data). The card shows a _"since YYYY‑MM‑DD"_ note, plus **live GitHub badges** — license, open issues and the latest release tag, shown when present.
- 🚕 **LLM taxi driver that actually drives you** — ask in natural language; it picks the best‑matching repo, explains it, then the cab **comes to your spot, you board, and it carries you** to the house. Three modes:
  - **Local search** (default · no key · instant) — synonym‑expanded intent search, also metric‑aware (_"most cloned"_, _"most visited"_, _"most forked"_); a strong topic match always beats generic metric sorting, and you always get a few alternatives to pick from.
  - **WebLLM** (in‑browser AI · no key · WebGPU)
  - **🛰️ AI Foundry Live** (optional · grounded) — live questions about your repos route through an Azure AI Search Knowledge Base + GitHub's hosted MCP server; **falls back to Local automatically** when no backend is set, so a keyless clone still works.
- 📘 **Named scholars you can talk to** — beyond the taxi, the plaza's NPCs are **named night‑sky stars**, each grounded by **one live MCP knowledge source**: **POLARIS · the Wayfinder** (your taxi driver), **VEGA · the Archivist** — the **MS Docs engineer**, and **RIGEL · the Cartographer**. Walk up to VEGA and ask about Azure, .NET or Copilot — it searches the **official Microsoft Learn docs in real time** through an Azure AI Search **Foundry MCP Knowledge Source**, and `gpt-5.4-mini` writes the answer back **in your own language** with a trace panel linking every doc. Walk up to **RIGEL** instead and name a public repo (`facebook/react`, `langchain-ai/langchain`) — carrying the spirit of *Ariadne*, it unspools a thread through the code via the **keyless DeepWiki MCP** and maps how the repo works inside. Each scholar also **knows who it is** — ask _"who are you?"_, _"what is this place?"_ or _"who else is here?"_ and it answers **in‑character** (its myth, this city, its owner) instantly, with no knowledge‑source call. The chat keeps **multi‑turn context**, and every scholar is registered in **[`SCHOLARS.md`](SCHOLARS.md)** — add your own with one script.
- 🏡 **Six house tiers, not just taller boxes** — by traffic rank each repo becomes a `cabin → cottage → house → villa → manor → portico mansion`, with wings, columns, porticos, dormers, balconies and cupolas. Top repos get grand columned 저택; quiet ones get cosy cabins.
- 🌳 **A city that feels alive** — **procedurally textured houses** (brick · siding · stone · shingle roofs — *zero image assets*), gardens, **roaming chow‑chow pets**, street trees, street lamps, **rest pavilions you can sit in** (and stand back up), and **koi ponds & driveway garages** for your most active repos. Category logos on the roofs (AI / Data / Software / …) and proper town‑house roads.
- 🌙 **Day & night, with living windows** — flip the 🌙 / ☀️ switch in the HUD. At night the sky turns navy, lamps and stars switch on, and **each repo's windows glow by how active it is** (recent pushes · clones · views) — so your busiest repos literally light up the skyline. Overhead, each scholar's **myth‑constellation** (POLARIS in Ursa Minor, VEGA in Lyra, RIGEL in Orion) twinkles on the dome, above a glowing **rune‑circle and drifting star‑dust** in the plaza.
- 🟢 **Realtime multiplayer** — see other visitors walking around as avatars with name tags, plus a **live · today · all-time unique-visitor counter** (🟢 현재 · 오늘 · 누적) in the HUD. It's **already live on the demo above**; a fork stays solo until you add one free server (below).
- 🌐 **English / 한국어 toggle** — switch the whole UI language live from the HUD.

> 💬 **Try asking the taxi:** _"most popular repo"_ · _"a repo about AI agents"_ · _"most cloned"_ · _"a Korean STT project"_ · _"anything"_ — it picks the best match, explains why, then drives you there.

## 🧠 How it works (data flow)

```
github-traffic-monitor (private)          Repolis (public)
  └ daily cumulative traffic (logs/*.csv) ──┐
                                            ├─▶ .github/workflows/refresh.yml (daily)
  gh api: your public repos (+ committed forks) ─┘  └ scripts/build_repos.py
                                                       └─▶ repos.json ──▶ index.html (Three.js 3D city)
```

- **Your public repos** — everything you created, **plus any fork you've actually committed to** (untouched mirror forks are skipped). A private repo name is never exposed on the public site.
- Traffic totals are the **cumulative values** gathered by [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor). (GitHub's own traffic API only keeps a rolling 14‑day window — this is why a daily collector is needed to build lifetime totals.)

## 🚀 Run your own

1. **Fork / copy this repo.** You also need a daily traffic source — keep a collector like [`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor) running.
2. **Add a secret** — `Settings → Secrets and variables → Actions`:
   - `GH_PAT` : a `repo`‑scoped Personal Access Token (to check out the private traffic‑monitor + list your repos).
3. **Enable GitHub Pages** — `Settings → Pages → Source: Deploy from a branch → main / (root)`.
4. **Run the Action** — `Actions → Refresh Repolis data → Run workflow` (then it auto‑refreshes daily).
5. Done — your city opens at `https://<you>.github.io/Repolis/`.

### Try it locally (no build step)

It's one static file — clone and serve:

```bash
git clone https://github.com/hyeonsangjeon/Repolis && cd Repolis
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

Rebuild the city from **your** repos (needs the GitHub CLI, logged in):

```bash
gh auth login
GTM_DIR=data python3 scripts/build_repos.py   # regenerates repos.json
```

### 🚕 AI taxi driver — modes, intent routing & indexing

The driver turns a free‑text question into the right house through a small **retrieval pipeline**, so it stays accurate even on a tiny in‑browser model:

```
your question
  └▶ ① intent agent (deterministic) ─ "library / 도서관", "most popular", "most stars",
  │      landmark & metric routing      "recent", "most cloned·forked·viewed", "random"
  │      → answered directly, no LLM     → exact, zero hallucination
  └▶ ② search index (inverted index) ─ tokens(name·label·lang·desc·topics) + synonyms,
  │      candidate retrieval             built once, lazily → top‑K shortlist
  └▶ ③ ranking ────────────────────── name‑hit ≫ token‑hit ≫ substring, +topic, +popularity,
  │                                      and your *own* word in a repo name wins
  └▶ ④ LLM picks from candidates (RAG)─ WebLLM / proxy choose ONLY among the shortlist → "PICK: <repo>"
  └▶ ⑤ multiple suggestions ────────── the remaining candidates become one‑tap chips you can pick from
```

Why it matters: *"take me to the library"* is a **navigation** intent, not a repo search — step ① catches it and drives you to the Contribution Library instead of guessing a random repo (the bug you'd hit when the question went straight to the model). Free‑form questions ("an AI agent repo", "speech‑to‑text") flow through ②–⑤.

**Three modes** — switch from the chat header:

| Mode | Engine | Key? | Notes |
|---|---|---|---|
| **Local** | synonym + metric search | none | **default** · instant · fully offline — *what every fresh clone ships with* |
| **WebLLM** | in‑browser LLM (WebGPU) | none | downloads ~1 GB once; picks from the index shortlist |
| **🛰️ AI Foundry Live** | Vercel → Azure AI Search KB → GitHub MCP | server‑side | optional · live, grounded repo Q&A. **Unconfigured → silent Local fallback** |

> 🔌 **No backend required.** A fresh clone runs entirely in the browser: **Local** is the default and needs no key, and **WebLLM** runs on‑device. **AI Foundry Live** is 100% optional — if you don't deploy it, selecting that mode just **falls back to Local search** (no errors, no setup). Deploy to GitHub Pages and everything works. _(A simpler `api/taxi.js` Azure‑OpenAI proxy is also available — see below.)_

The browser always does retrieval first and hands the model only the **shortlisted candidates** — so a WebLLM/grounded agent just has to choose one:

```jsonc
// POST /api/taxi — request the city sends (already shortlisted, not the full catalog)
{
  "question": "show me a repo about an AI agent",
  "repos": [
    { "repo": "multi-agent-orchestration-observability", "lang": "Python",
      "stars": 12, "topics": ["agent","observability","llm"], "desc": "…" },
    { "repo": "strands-bedrock-agents-cookbook", "lang": "Jupyter Notebook", "…": "…" }
  ]
}
```

```js
// api/taxi.js — minimal agent: pick ONE from the candidates, return strict JSON
export default async function handler(req, res) {
  const { question, repos } = req.body;
  const sys = `You are the Repolis taxi driver. Choose the single best repo for the user
ONLY from this candidate list (never invent one). Reply warmly in one or two sentences.
Return strict JSON {"repo":"<repo-name>","message":"<reply>"}.
Candidates:\n${repos.map(r => `- ${r.repo} | ${r.lang} | ${(r.topics||[]).join(',')} | ${r.desc}`).join('\n')}`;

  const r = await fetch(`${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.AZURE_OPENAI_KEY },
    body: JSON.stringify({
      messages: [{ role: 'system', content: sys }, { role: 'user', content: question }],
      temperature: 0.4, max_tokens: 200, response_format: { type: 'json_object' }
    })
  }).then(x => x.json());

  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOW_ORIGIN || '*');
  res.json(JSON.parse(r.choices[0].message.content)); // → { repo, message }
}
```

Return `{ "repo": "<repo-name>", "message": "<reply>" }`; the city drives there and offers the remaining candidates as one‑tap alternatives. If the endpoint is unreachable, the driver silently falls back to local search.

### (Optional) AI backends for the taxi

Both backends are **opt‑in** — the city is fully usable without them. All configuration lives in [`.env.example`](.env.example): copy it to `.env` for local `vercel dev`, or paste the values into **Vercel → Settings → Environment Variables**.

#### 🛰️ AI Foundry Live (grounded) — live answers about your repos

`api/taxi-grounded.js` routes a free‑text question through an **Azure AI Search Knowledge Base** whose **MCP Knowledge Source** calls **GitHub's hosted MCP server**, then synthesises the answer with a small model — all server‑side. The serverless function only ever holds a **Search key**; your Azure OpenAI key and GitHub PAT stay inside the Knowledge Source on Azure (never in the browser, never in this function). The chat shows a live **trace panel** — knowledge source · MCP tools · reference repos — for each grounded answer.

1. **Azure AI Search** — create a service, then a **Knowledge Base** (e.g. `repolis-github-kb`) with a **Knowledge Source** of kind *MCP server* pointing at GitHub's hosted MCP (`https://api.githubcopilot.com/mcp/`, with a **read‑only** PAT in its header). Give the search service a **managed identity** with access to an Azure OpenAI deployment for answer synthesis.
2. **Deploy** `api/taxi-grounded.js` to Vercel (import the repo → you get `/api/taxi-grounded`).
3. **Set env vars** (see [`.env.example`](.env.example)): `SEARCH_ENDPOINT`, `SEARCH_API_KEY`, `SEARCH_KB_NAME`, `SEARCH_KS_NAME` (comma‑separated to attach more MCPs), plus optional `SEARCH_API_VERSION`, `GROUNDED_TIMEOUT_MS`, `GROUNDED_MAX_RUNTIME_S`, `ALLOW_ORIGIN`.
4. In the taxi, pick **🛰️ AI Foundry Live** and paste your URL (`https://<project>.vercel.app/api/taxi-grounded`). Leave it blank to stay on Local.

> ⏱️ **Vercel Hobby caveat:** the KB can take 6–21 s on cold/complex queries, but Hobby caps a function at ~10 s. `GROUNDED_TIMEOUT_MS` (9000) aborts just before that and the taxi **silently falls back to Local** — so it never hangs, but slow queries won't show grounded results. For consistently grounded answers, deploy on **Vercel Pro** and raise `maxDuration` (and `localStorage.taxiGroundedTimeoutMs` in the browser).

> ☁️ **Recommended — Cloudflare Workers (no ~10 s wall).** Workers bill *CPU time*, not the wall‑clock spent awaiting a subrequest, so the slow KB call finishes instead of being cut off — far fewer Local fallbacks, on the **free** plan (no card). A ready‑to‑deploy port lives in [`cloudflare-taxi/`](cloudflare-taxi/): `wrangler secret put SEARCH_ENDPOINT && wrangler secret put SEARCH_API_KEY && wrangler deploy`. Paste the resulting Worker URL into the taxi, or into **`GROUNDED_DEFAULT`** in `index.html` to enable grounding for **every visitor**. See [`cloudflare-taxi/README.md`](cloudflare-taxi/README.md).

#### 🌐 AI proxy (simple) — one Azure OpenAI call

Prefer a lightweight LLM picker over the full grounding stack? `api/taxi.js` takes the shortlist the browser already retrieved and asks Azure OpenAI to choose one repo. Deploy it to Vercel, set `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT` / `AZURE_OPENAI_KEY` (see [`.env.example`](.env.example)), and point the taxi at `/api/taxi`. If the endpoint is unreachable, the driver falls back to Local search. _(This mode isn't in the default dropdown; it stays available for forks that prefer it.)_

### (Optional) Realtime multiplayer

The static site is solo by default. To let visitors meet each other, run one tiny WebSocket server and point the world at it:

- **PartyKit (one command):** `npx partykit deploy` (uses `party/repolis.js` + `partykit.json`). You'll get a URL like `wss://repolis.<you>.partykit.dev/parties/main/world`.
- **Cloudflare Workers (most reliable):** `cd cloudflare && npx wrangler login && npx wrangler deploy`. Deploys the same server straight to your own Cloudflare account on the **free** plan (SQLite Durable Objects, no credit card). You'll get `wss://repolis-rt.<you>.workers.dev`. See `cloudflare/README.md`. Handy when PartyKit's hosted login is having a bad day.
- **Self‑host:** `node scripts/dev_realtime.mjs` (needs `npm i ws`) → listens on `ws://localhost:1999`.
- **Point the world at it** with any one of:
  - URL query: `?rt=wss://…`
  - `localStorage.setItem('repolisRT','wss://…')`
  - `window.REPOLIS_RT = 'wss://…'`
- **Count *every* visitor (not just you):** the three options above only affect whoever sets them. To bake it in for all visitors, set `const RT_DEFAULT='wss://…'` near the realtime block in `index.html` and push. The HUD then shows **🟢 live · today · all‑time** for everyone. On PartyKit the cumulative total is kept in room storage, so it survives restarts (the self‑host `ws` server keeps counts in memory only).

> Privacy: the traffic logs that drive the city are committed publicly, and only your **public** repos — the ones you created, plus forks you've committed to — are ever shown. Private repos never appear.

## 🎮 Controls (WoW‑style camera)

| Input | Action |
|---|---|
| `W A S D` / arrows / joystick | Walk |
| 📱 **Mobile** | **Left stick** move · **right 👁️ stick** look & turn · center **🚪** opens the repo |
| **Left‑drag** | Orbit camera (free look) |
| **Right‑drag** | Steer character · WoW‑style · wheel = zoom |
| `Enter` / click | Open the repo you're standing at |
| 🚕 button | Ask the taxi driver |
| ☰ button | Wayfinding menu (search) |
| 🌐 button | Switch English / 한국어 |
| 🌙 / ☀️ button | Toggle day / night (night = activity-lit windows) |

## 🛠 Tech

Three.js (r0.160) · toon shading + inverted-hull outlines · **Fresnel rim light** via `onBeforeCompile` · **procedural canvas textures** — walls, roofs, grass & asphalt are all generated in code, **no image assets** · ACES tone mapping · day/night lighting · circle-collision walking · **one dependency‑free `index.html` (~2,300 lines, zero build step)** · GitHub Actions · (optional) Vercel + Azure OpenAI · **Azure AI Search + GitHub MCP grounding** · WebLLM · (optional) PartyKit / Cloudflare Workers for realtime.

## ⭐ Like it?

Only six pins on your profile — but **all** your repos can be a city. If that made you smile, **[give it a star](https://github.com/hyeonsangjeon/Repolis)** so more people stumble onto Repolis. New here? See [`CHANGELOG.md`](CHANGELOG.md) for what shipped.

## 🙏 Credits

Data: [github-traffic-monitor](https://github.com/hyeonsangjeon/github-traffic-monitor) · social previews: `opengraph.githubassets.com`.

## 📄 License

MIT © [Hyeonsang Jeon](https://github.com/hyeonsangjeon) — see [`LICENSE`](LICENSE).

<div align="center"><sub>Made with ☕ &amp; Three.js — only 6 pins, but your repos become a whole city. 🏙️</sub></div>
