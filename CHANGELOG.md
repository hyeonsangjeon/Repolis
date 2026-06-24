# Changelog

All notable changes to **Repolis** are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/); dates are UTC.

## [1.10.2] — 2026-06-24

### 📚 Backend docs cleansing — clear story for clone/fork
- **The live backend is now unambiguous everywhere.** Several docs still said the Cloudflare Worker *"only ever holds a Search key"* — true before the keyless in‑persona general‑chat feature, but stale now. The Worker actually holds **two** secrets: the Azure AI **Search** key (KB retrieval) **and** an **Entra ID service‑principal secret** (`AAD_CLIENT_SECRET`) used to call Azure OpenAI **keyless** for off‑KB / small‑talk answers in the scholar's voice. Corrected in `cloudflare-taxi/README.md`, `SCHOLARS.md`, and both READMEs.
- **`cloudflare-taxi/README.md` rewritten to match the real Worker** — it now documents both jobs (grounded repo Q&A **+** in‑persona general chat), the multi‑scholar pipeline, the full secret/var list with the one‑line `az ad sp create-for-rbac` setup, the `.dev.vars` for local dev, and the actual request/response shapes (`chat:true`, `general:true`, `kind:"docs"`, `fallback:true`).
- **Vercel functions clearly labeled OPTIONAL alternatives.** `api/taxi.js` (simple Azure‑OpenAI repo picker, not in the mode dropdown) and `api/taxi-grounded.js` (grounded retrieval only — *no* in‑persona general chat) each get a header banner pointing to the Cloudflare Worker as the live path, so an MS AI GBB engineer who clones/forks isn't confused about what runs production.
- **README (EN/KO) precedence fixed:** the modes table engine cell now reads *Cloudflare Worker → Azure AI Search KB → GitHub MCP* (was "Vercel"), the grounded section distinguishes Worker (superset: grounding + general chat) from the Vercel function, and the grounded‑mode URL prompt now suggests the Worker URL first. `.env.example` gained a "which backend?" callout. No code‑logic changes.

## [1.10.1] — 2026-06-24

### 🐛 Grounded mode now routes general chat the same as every other mode
- **POLARIS answers a general question in 🛰️ AI Foundry Live mode instead of funneling it into the repo search.** The grounded path used a repo‑biased gate (`needsSearch`, which counts *"알려줘 / tell me / 소개 / show"* as a repo signal), so *"오리온자리에 대해 알려줘"* was sent to the repo Knowledge Base — which found nothing and silently fell back to Local search, never giving a real answer. Every other mode (Local / WebLLM) already used the precise `isGeneralChat()` gate. `groundedAsk()` now uses that **same** gate, so a general/small‑talk question goes straight to the starlit general model (`chat:true` → in‑persona `gpt-5.4-mini`) while a genuine repo query (*"STT 레포 알려줘"*) still rides to the Knowledge Base. One routing rule, all modes.

## [1.10.0] — 2026-06-24

### 🐕 Chow‑chows — clean shape, three coats
- **The poofy fur experiment is rolled back to a clean, rounded chow.** The layered fur‑tuft coat read as *balloon‑lumpy* rather than fluffy, so each dog returns to the original soft, rounded silhouette (body · mane ruff · head · snout · curled tail · four legs).
- **Now in three coats instead of one ginger.** Every chow is built from a `CHOW_COATS` palette — **🤍 ivory · 🤎 brown · 🖤 black** — cycled across the plaza pack and picked at random for garden dogs (the black coat uses a warm‑amber eye so the face still reads on dark fur). All chows still wander, wag and trot.

### 🛶 Petite‑Venise canals thread the whole map
- **Five more canals now run through the mid‑map inter‑ring gaps**, not just the plaza — so a walk out toward the suburbs keeps passing little Colmar/Riquewihr water pockets (cel‑water, flower‑box banks, a humpbacked flower bridge, a moored boat, cypress framing).
- **Tangential placement keeps them tidy.** Each canal sits 30° off every avenue and is rotated **parallel to its ring road**, so it hugs the green gap with a tiny radial footprint and never overlaps a building.

## [1.9.1] — 2026-06-24

### 🐛 General chat now works in every mode
- **Small‑talk / general questions reach the starlit LLM from any search mode.** Previously, asking POLARIS a general question while in **Local search** mode (the default) just returned the canned *"하하, 그건 저도 잘 모르겠어요 😅"* — the worker's in‑persona general chat was only wired into **AI Foundry Live** mode. A new `isGeneralChat()` gate routes any non‑repo, non‑metric question to `generalChat()` in **Local / WebLLM / Foundry** alike, so *"오리온자리에 대해 알려줘"* gets a real `gpt-5.4-mini` answer in the scholar's own voice — while a genuine repo query (*"STT 레포 알려줘"*) still rides to the building.
- **RIGEL answers general questions instead of nagging for a repo.** Ask the Cartographer something with no `owner/repo` and it now replies as a general question in‑persona (LLM), rather than always repeating *"어떤 레포의 미궁을 그려드릴까요? owner/repo…"*. An explicit `owner/repo` (or a known alias) still routes straight to the DeepWiki map.

## [1.9.0] — 2026-06-24

### 🏘️ Colmar — an Alsace‑village makeover for the plaza
- **The town square is now dressed like a corner of Colmar.** Pretty objects are scattered through the village so every stroll passes something charming:
  - **🛶 Petite‑Venise canal nook** — a quiet pocket with a **cel‑animated canal**, flower‑box banks, a **humpbacked flower bridge** and a moored rowboat, framed by cypress.
  - **🌸 Flower market** — striped market stalls, flower carts (blooming wheelbarrows), barrels and crates clustered like a Sunday morning *marché aux fleurs*.
  - **🌹 Rose arches** arc over the six avenue mouths, with **flower planters** flanking each one.
  - **⛲ A stone well**, **guild lanterns**, lavender clumps and a gentle scatter of charms across the lawns.
- **🌙 Beautiful by night, free of cost.** Every bloom, lantern and the canal water glow warmly after dusk by **reusing the existing lamp‑glow and cel‑water systems** — no new lights, shared geometry and materials, glow sprites only. The decorations melt into the night‑sky / starlight theme instead of fighting it.

### 🐕 Fluffy chow‑chows
- **The plaza chow‑chows are properly poofy now.** Each dog was rebuilt with **fur tufts** — a layered coat, a lion‑mane ruff, fuzzy cheeks, a curled fluffy tail and paw fluff — in a warm ginger double‑coat. All **16 chows** still wander, wag and trot (tufts share geometry and skip shadows, so the fur is free).

### 🐛 Fixes
- **Spawn beside the fountain, not in it.** New visitors used to materialise **standing inside the plaza fountain** (the camera framed the back of the avatar's head against the water like a dark orb). The spawn point now places 서원이 **on the plaza beside the fountain**, so the very first frame shows the square — fountain, blooms and scholars — cleanly.

## [1.8.0] — 2026-06-24

### ✦ Every scholar can chat — starlit general conversation (Azure AI Foundry)
- **All members — the taxi POLARIS included — now do general chat.** Ask anything off‑topic, cosmic, mythic, or just small talk (*"직녀성이 뭐야?"*, *"오늘 좀 울적해"*, *"do you like stargazing?"*) and the scholar answers **in‑persona from general knowledge** via **Azure AI Foundry `gpt-5.4-mini`** — no repo pushed, no knowledge‑base call. Previously the taxi blocked off‑topic questions with *"저도 모르겠어요 😅"*; now it reckons by the starlight.
- **Two clean paths, one chat.** A **repo / doc question** runs **KB grounding** through that scholar's MCP knowledge source and returns references; an **off‑KB / small‑talk question** — or a KB miss — falls to the **starlit general** model. The client sends a `chat:true` flag so the worker skips retrieval entirely for pure small talk (faster, no wasted KS call).
- **✦ "how I answered" trace panel** — general replies get their own trace panel (*별빛에 깃든 일반 지식에서 답했어요 · gpt-5.4-mini*), distinct from the 🔎 *"how I found this"* grounding panel.
- **🌌 New diagram** — an awesome self‑contained night‑sky SVG (`assets/scholar-grounding.svg` · `assets/scholar-grounding.ko.svg`) shows the grounding‑vs‑starlit fork, embedded in both READMEs.

### 🐛 Fixes
- **Ambiguous‑word routing** — cosmic small talk that shares words with our metrics (*"밤하늘 **별** 보는 거 좋아해?"* → `별`=star) no longer triggers a star‑count sort; it now correctly routes to general chat. A night‑sky/cosmic guard runs before the metric branches, and a bare `많이` no longer false‑fires the popularity sort.
- **"택시기사" mislabel** — the chat action bar now names each scholar by its star + epithet (🗺️ RIGEL · the Cartographer) via `scholarByKind`, instead of falling through to "택시기사" for non‑taxi NPCs.
- **Live‑site guard** — a stale `localhost` grounding URL saved in `localStorage` is ignored on the live site, so a dev URL can't break production chat.

## [1.7.0] — 2026-06-23

### 🗺️ RIGEL · the Cartographer — a third scholar (DeepWiki)
- **A new named scholar joins the plaza: 🗺️ RIGEL · the Cartographer**, carrying the spirit of *Ariadne* and shining as the blue‑white star at the foot of **Orion**. Walk up and RIGEL maps the **inner architecture of any DeepWiki‑indexed public repo** — ask `facebook/react`'s reconciliation, `langchain-ai/langchain`'s structure, and it unspools "Ariadne's thread" through the labyrinth of the code. Like the other scholars it gets a floating ✦ star‑nameplate, a pulsing teal aura, its own Orion constellation on the night dome, and astronomer‑cartographer robes (teal hooded robe, an unrolled star‑map, and a ball of Ariadne's yarn).
- **Keyless & clone‑friendly.** RIGEL answers through the **DeepWiki MCP** (`mcp.deepwiki.com/mcp`, `ask_question`) directly — **no Azure KB, no key required** — so it works in a fresh clone out of the box. The Cloudflare Worker routes `{question, npc:'deepwiki', repoName}` straight to DeepWiki and returns grounded prose + a "how I found this" trace.
- **Smart repo targeting** — RIGEL needs a target repo. The chat extracts an explicit `owner/repo` from your question, or resolves ~35 famous library aliases (`react` → `facebook/react`, `langchain` → `langchain-ai/langchain`, …). If none is found it asks for `owner/repo`; if the repo isn't indexed on DeepWiki it says so and points to deepwiki.com. An explicit `owner/repo` is always treated as a repo request, so owner‑name routing can't swallow it.
- **🐛 Roster vs. town** — *"이 마을에 다른 현자 누구 있어?"* now correctly lists the scholars (the roster check runs before the town‑description check). The roster names all three: **POLARIS · 길잡이**, **VEGA · 기록보관자**, **RIGEL · 지도제작자**.

## [1.6.0] — 2026-06-23

### ✨ Named night‑sky scholars
- **The scholars now have names, myths and stars.** The two town NPCs are **POLARIS · the Wayfinder** (the taxi driver, carrying the spirit of *Hermes*) and **VEGA · the Archivist** (the MS Docs engineer, carrying *Daidalos*). Each is rendered as **one star in the night sky**:
  - **Myth‑constellations on the dome** — POLARIS anchors **Ursa Minor**, VEGA is the lead star of **Lyra**; each scholar's own star is the brightest and twinkles.
  - **A floating ✦ star‑nameplate** over each scholar's head, tinted to their star's colour.
  - **A softly pulsing aura** around each scholar.
  - **Astronomer‑mage robes** — POLARIS wears a compass‑star chest badge and a pole‑star cap; VEGA wears a star cape, a pointed wizard hat with a glowing star at its tip, and star‑rune robes.
- **Persona‑aware chat ([`scholars.js`](scholars.js))** — each scholar now *knows who it is*. Ask **"who are you?"**, **"what is this place?"**, **"who built this city?"** or **"who else is here?"** and it replies **in‑character** — its star name and myth, the city **Repolis**, its owner **Hyeon Sang Jeon (`hyeonsangjeon`)**, and the roster of fellow scholars — **instantly, with no Knowledge‑Source call**. A new `scholars.js` data module is the single source of truth (star · myth · constellation · persona · backstory), shared by the night‑sky constellations, the name‑plates and the chat; [`SCHOLARS.md`](SCHOLARS.md) mirrors it.
- **🐛 Identity vs. search** — fixed an English edge case where *"who are you / what can you do"* could leak into a repo search (the token *you* → `youtube‑dl‑nas`). Identity and help small‑talk are now matched **before** the search gate, in every chat path (local, grounded and the engineer).

### 🌌 Plaza beautification
- **Rune‑circle + star‑dust** in the plaza — glowing concentric starlight rings with two polygon stars set into the ground, and 96 drifting motes of golden star‑dust overhead, all pulsing softly at night and fading by day.

## [1.5.0] — 2026-06-23

### 🏛️ Every scholar grounded by Foundry MCP Knowledge Sources
- **Unified all town NPCs on one Azure AI Search KB‑retrieve pipeline.** The **MS Docs engineer** no longer dumps raw doc snippets — it now answers through its own **Foundry MCP Knowledge Source** (`microsoft-learn-mcp-ks`) and a persona **Knowledge Base** (`repolis-mslearn-kb`), so replies are **synthesised by `gpt-5.4-mini` in the user's own language** with a doc‑link trace. Ask in Korean → get Korean (fixes the earlier Korean‑question‑English‑answer bug). The taxi driver and the engineer now share a single `groundedRetrieve()` path in the Worker; only the `{ kb, ks }` differ per NPC.
- **🗂️ [`SCHOLARS.md`](SCHOLARS.md)** — an awesome‑style registry that is the single source of truth for every scholar (NPC · domain · MCP server · auth · tool · Knowledge Source · Knowledge Base), with KS/KB JSON shapes and a 5‑step "add a scholar" guide.
- **🛠️ [`scripts/register_scholar_ks.sh`](scripts/register_scholar_ks.sh)** — one command registers a scholar's MCP Knowledge Source **and** clones a persona Knowledge Base (model binding copied from an existing KB). Keyless servers (e.g. Microsoft Learn) need no auth; private servers pass `AUTH_HEADER`.

### 💬 Memory + meta‑routing
- **Multi‑turn memory** — the chat now threads recent conversation history to the Worker (`history[]` → KB `messages[]`), so follow‑ups like *"다른 건?"* or *"그건 어떻게 시작해?"* keep context instead of starting over.
- **Town meta‑questions answered locally** — *"현자 몇 명이야?"*, *"몇 명이 물어봤어?"* and *"레포 몇 개야?"* are answered instantly from town data and **never spend a Knowledge‑Source call**; off‑topic questions get a friendly reply, while genuine repo questions and mid‑thread follow‑ups still reach the live LLM.
- **Clone‑friendly fallback kept** — if a scholar's KB isn't configured, the Worker still answers via a direct keyless MCP call, so a no‑Azure clone keeps working.



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
