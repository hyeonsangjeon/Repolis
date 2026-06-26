# Changelog

All notable changes to **Repolis** are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/); dates are UTC.

## [1.30.0] — 2026-06-28

### 🗺️ Repolis Quest — a daily course to follow, and houses that light up when you visit
- **Today's Course gives you a reason to walk.** Open the 🛂 passport and a new gold **course card** shows three hand-picked stops for the day — one popular repo plus two landmarks — chosen by a **date-seeded deterministic** shuffle (everyone gets the same course on the same day, and it's stable across reloads, stored local-only in `localStorage`). A progress bar and per-stop ✓ track how far you've gone, and each stop is **tappable to summon the taxi** straight there (the cab auto-opens the landmark when it arrives). A "🚕 Guide me" button drives you to the next unvisited stop in one tap; once all three are done it flips to "🎉 Course complete!".
- **Visiting a house leaves a mark — for good.** The first time you reach a repo's house, every window **lights up** and a warm **lantern glow** settles above its roof (an additive halo that reads as "someone's home" by day and genuinely glows at night). It's persistent: come back tomorrow and your visited houses are still lit (restored from the passport on load, and re-painted immediately if you're visiting at night).
- **Finishing the course is celebrated.** Completing all three stops pops **fireworks** and a "course complete" toast — once per day. The course auto-syncs with the existing stamp/visit system (a repo stop is done when you've visited it; a landmark stop when you've earned its stamp), so there's no separate state to keep.
- Fully bilingual (KO/EN) — the course card re-renders on language switch. Mobile-safe (the passport is width-capped, **0 horizontal overflow** at 390 px). Verified on real GPU: deterministic course, live progress 2/3 → 3/3, taxi guide starts on tap, house lights + lantern at night, **0 console errors**.

## [1.29.0] — 2026-06-28

### 🏘️ Village Alive + Mobile Playability — a town that feels lived-in, smooth to roam
- **The scholars are alive now.** POLARIS, VEGA and RIGEL no longer stand frozen — they **breathe** (a soft head bob), **look around** when idle and **turn to face you** as you approach, and every so often raise a hand and pop a **speech bubble** with a character-appropriate one-liner (the taxi-finder hawks rides, the docs engineer offers Microsoft Learn, the cartographer offers to chart a repo), fully bilingual (KO/EN). A near-only gate keeps it free when you're elsewhere.
- **Reaching a place now reacts to you.** The first time you walk up to a **house**, a gentle ✨ **sparkle** pops in the open air on the side facing you and the building gives a quick squash-stretch **"acknowledge" bob** — and landmarks (the three scholars, library, plaza, Chronopolis, Observatory, canals) each pop a colour-matched sparkle the first time you earn their passport stamp. Lightweight additive particles that clean themselves up; the idle-FPS budget is preserved (full 60 fps only while a pop is on screen).
- **A calmer plaza, with quiet parks set off to the sides.** The fountain's flower ring is slimmed (8 → 4 beds) and the flower blossoms sit lower and rounder, opening up sight-lines and the avenue approaches. Two more **rest parks** join the first — calm pockets in the lawn (SW · N · E) with a gravel path ring, a low lavender bed, benches you can sit on, mixed Provençal trees, a rock and a "Park · 공원" signpost — so activity and focal points spread out instead of crowding the centre.
- **Smoother to move through.** The player-vs-world collision now runs a **multi-pass resolver**, so you slide along tight rows of Chronopolis columns and Colmar props instead of wedging between two of them — a single pass would shove you out of one collider straight back into its neighbour. (`?dbg` `__walkSim`/`__chronoEscape` prove a straight walk out of the council chamber never sticks.)
- **Mobile controls respect the notch.** Added `viewport-fit=cover` and `env(safe-area-inset-*)` to the top bar, menu, and the bottom-right action / taxi / emote stack, so on notched phones they lift above the home-indicator and inset from the curved edges (with a `0px` fallback — zero change on non-notched devices and desktop). Verified on real GPU at 390 × 844: touch joystick drives movement, walk-up shows the 🚪 door button + arrival prompt, scholar nameplates + bubbles + gestures render, no overflow, **0 console errors**.

## [1.28.1] — 2026-06-28

### 📜 A new Council of Time case — pandas `df.append()` → `pd.concat()`
- **A new curated debate joins Chronopolis: how to concatenate two DataFrames.** pandas 2.0 **removed** `DataFrame.append`, yet a huge body of old tutorials and Stack Overflow answers still reach for `df.append(...)` — so the **majority is wrong**. The live source says `pd.concat([df1, df2])`, and the deterministic Council overrides the majority on **recency**: verdict `pd.concat([df1, df2])`, signature **S1** ("표는 둘이나, 시간은 하나를 가리킨다" / *the table is split two-to-one, but time points to one*), `overrode_majority=true`, the removed-API loser boosting confidence. It's the data/ML-flavoured companion to the existing pydantic & transformers S1 cases — the dramatic "time topples the majority" verdict the engine was built for.
- **Wired everywhere the other cases are.** It appears as the 7th example chip in the Convene modal (`pandas`), pre-fills the live-debate box with its question in the active language (KO *"두 DataFrame을 행 방향으로 이어 붙이는 올바른 방법은?"* / EN *"What is the correct way to concatenate two DataFrames row-wise?"*), and auto-joins the ambient world-bubble debate cycle. `council/test.mjs` adds 7 assertions for it and stays green (**74 checks**). Stale "5/6 curated cases" comments corrected to 7. Verified in-browser desktop + KO/EN: chip selects + fills the box, modal renders clean, **0 console errors**. (Golden rule intact — the curated verdict is deterministic math; the gold "unverified" LLM path is only for free-form topics.)

## [1.28.0] — 2026-06-28

### 🎆 The milestone festival — aurora over the city & fireworks for every milestone
- **The night sky now shimmers with an aurora borealis.** A tall open cylindrical shell wraps the city with a custom shader — drifting hash-noise curtains, vertical streaks and a height envelope blend a teal→violet glow that ripples across the upper sky. It's an ambient part of the night (data-independent), riding the `starsGroup` night-visibility toggle for free, and fades in smoothly as the time-of-day clock crosses into night.
- **Reaching a milestone sets off real fireworks.** Rising shells streak up from around you, burst into 70-particle spheres in seven festive colours, then fall under gravity with drag and fade — all additive, sharing the existing star/glow textures, queued so a big show launches over several seconds. While fireworks are in the air the aurora **boosts** to full brightness, so the whole sky celebrates with you.
- **The festival is earned, not ambient.** Collecting a **passport landmark stamp** pops a small burst (and a 🎆 toast + a 20-shell finale when you complete *all* landmarks), and **visiting repos** lights the sky at the 5th / 15th / 30th / final repo. The idle-FPS budget is preserved — the world still drops to ~30 fps when truly idle, but holds full 60 fps whenever fireworks are active. Verified on real GPU, desktop + 390 px mobile, day & night: aurora night-visible (opacity → 1.0 on festival boost), fireworks reach steady-state on screen, milestone triggers check length *after* push (no off-by-one), no mobile overflow, **0 console errors**.

## [1.27.0] — 2026-06-28

### 🔭 The Stargazer's Observatory — a new landmark for the night-sky scholars
- **A giant observatory now stands in the eastern clearing.** A three-tier stone stylobate carries a circular view-deck inlaid with an engraved **star-map** (concentric rings + scattered stars), wrapped by a balustrade with an entrance stair. At its centre is a **great brass-banded telescope** on a pedestal-and-yoke mount (it slowly tracks the sky), beside an ornamental **armillary sphere** of golden rings around a glowing core, a carved `OBSERVATORY` sign, four flanking cypress and two guild lanterns, and a golden arrival ring.
- **It comes alive at night.** The telescope's lens **glows** after dark (wired into the shared lamp-glow set, so the existing time-of-day clock toggles it for free), the lanterns light up, and the deck's star-map reads against the starfield — turning the observatory into a beacon on the eastern edge.
- **A passport stamp + a modal that gathers the scholars' constellations.** Walking up earns the 🔭 **Observatory** passport stamp and opens a modal collecting all three named scholars in one place — **POLARIS** (Ursa Minor · Hermes), **VEGA** (Lyra · Daidalos) and **RIGEL** (Orion · Ariadne) — each with its star, constellation, myth and backstory, fully bilingual (KO/EN) and re-rendered on language switch. Constellation names live in `scholars.js` as the single source of truth.
- **The taxi knows the way.** "전망대로 가자" / "take me to the observatory" routes the taxi to the landmark (a proper noun — no verb needed), drives you there with the library/Chronopolis speed boost, and auto-opens the modal on arrival. Verified on real GPU, desktop + 390 px mobile: 3D landmark day & night, placement clear of the nearest building (edge ≈30 u), proximity stamp, modal KO/EN, full taxi e2e (route → arrive → modal), no mobile overflow, **0 console errors**.

## [1.26.0] — 2026-06-28

### 🌅 A living day — continuous time-of-day with dawn, dusk & an arcing sun
- **The day↔night button is now a full time-of-day cycle.** The old toggle flipped a single `isNight` boolean between two hard-coded skies. The sky is now driven by a **continuous `t∈[0,1)` clock** (0 = midnight · 0.25 = sunrise · 0.5 = noon · 0.75 = sunset) interpolated between four keyframes, so the world passes through **golden dawn and amber dusk** — not just "day" and "night". Sky gradient, sun/hemisphere light colour & intensity, fog, tone-mapping exposure, and the toon **rim-light** all blend together along the curve.
- **A real sun now crosses the sky.** Added a visual **sun disc** (core + additive glow + halo) that arcs along a celestial path — low and amber near the horizon at dawn/dusk, high and bright at noon, and gone below the horizon at night — while the directional light rakes low at dawn/dusk (long shadows) and moves overhead at noon. It fades out as night falls, leaving the existing moon/stars to take over.
- **Smooth, eased transitions instead of an instant flip.** Tapping the button now **eases** from the current time to the target with a smoothstep curve (≈a couple of seconds), advancing *forward* through time (day → dusk → night → dawn → day) so it always reads as a natural cycle. The stepper does **zero work once settled**, preserving the adaptive idle-FPS perf budget. A debug auto-cycle (`?dbg` `__skyCycle()`) drifts the clock continuously.
- **The button cycles four phases.** `dayBtn` now rotates **☀️ day → 🌆 dusk → 🌙 night → 🌅 dawn**, its icon tracking the phase. Every existing night-dependent system is untouched — the discrete night assets (moon, stars, fireflies, lit windows whose brightness still tracks repo activity, lamps, glows) flip on a single threshold deep in the night band, so dawn/dusk stay day-ish. Verified on real GPU, desktop + 390 px mobile: all four phases visually distinct, transition sampled smooth, sun disc arc + fade, **0 console errors**; back-compat `__night(bool)` and the initial paint snap instantly as before.

## [1.25.2] — 2026-06-28

### 📐 Docs — the Kronos Council pattern, written down
- **New concept doc: horizontal multi-agent deliberation.** Added `COUNCIL_PATTERN.md` (+ Korean `COUNCIL_PATTERN.ko.md`) explaining the pattern Chronopolis implements — peer agents debate *as equals* (advocate / skeptic / analyst), a separate **chair** aggregates the whole transcript and rules — with the **golden rule** that curated cases are deterministic/**verified** while free topics are chair-LLM/**unverified**. Covers why roles create productive disagreement, reading-speed pacing as a UX rule, the cost/safety guards, the lineage (Multi-Agent Debate · Mixture-of-Agents · LLM-as-a-Judge · Society of Mind), and a file-by-file code map.
- **New diagram (EN + KO).** `assets/council-pattern.svg` / `assets/council-pattern.ko.svg` — a night-sky figure: a topic fans out to three peer role-agents (tiki-taka arrows + a round loop), down to the KRONOS chair, then out to the two verdict modes (deterministic-verified vs. chair-unverified). Rendered and verified in both languages.
- **README sections.** Both `README.md` and `README.ko.md` gain a *"the pattern behind it"* section that embeds the diagram and links the deep-dive, right after the deterministic Kronos-Council section.

## [1.25.1] — 2026-06-28

### ⚡ Chronopolis — the Convene modal is now a clean live-debate launcher (no canned dialogue)
- **Removed the scripted simulation transcript from the popup.** The Convene modal used to render a full **pre-scripted "sage conversation" + verdict + timeline** below the topic box (Olddoc/Livewire/Hearsay canned lines, a fake judgment, and a recency timeline). On general topics this read like a fixed simulation and buried the actual call-to-action. The modal is now a **pure launcher**: a topic box, six example chips, and a one-line live notice — *all the real debate happens live in the 3D chamber*, where the three sages argue your topic over SSE and the Chair of Time rules. The deterministic transcript/verdict/timeline are gone from the popup entirely (`renderChronoCase` no longer calls `councilAsk`/`chronoTurn`/`chronoTimeline`).
- **Example chips now pre-fill a real question.** Tapping a chip (label stays the short topic — `Pydantic`, `CSS`…) fills the box with the **full question** in the active language (e.g. "Pydantic 모델 인스턴스를 dict로 직렬화하는 올바른 메서드는?") instead of the bare two-word label, so a chip-launched live debate gets a meaningful prompt.
- **Refreshed the modal copy for the live era.** The header subtitle, the gold badge (`⚡ 라이브 AI 토론` / `⚡ Live AI debate`), and the footer notice no longer say live debate is "locked behind budget guards / Ambient only" — they now describe the real flow (type a topic → three sages debate live ~2 min → the Chair rules, *AI inference · unverified*). Switching language while the modal is open now re-renders it so the dynamic notice re-translates too. Verified on real GPU, KO + EN: 0 transcript rows, chip→question pre-fill, empty-input guard, language re-translation, **0 console errors**.

## [1.25.0] — 2026-06-28

### ⚡ Chronopolis — live debates you can actually read, with real debate roles
- **No more 7-second blur.** The previous build drew each sage's line the instant it arrived over SSE, so a two-minute debate flashed past in seconds and the bubbles were unreadable. The client now runs a **producer/consumer pacing queue**: streamed turns are buffered, **split into sentence-sized bubbles**, and shown one at a time at **human reading speed** (≈2.4–7.2 s per bubble, auto-catching-up only when the worker races far ahead). Long rebuttals that overflowed a single bubble are now **wrapped and shown in sequence** — you read the whole argument, then the next sage reacts. The verdict is **held until the queue drains**, so it never appears before you've read the debate.
- **Real roles, not canned lines.** The free-topic sages used to share the curated docs/source/community personas, which rang hollow on general subjects and *looked like a fixed simulation*. Each seat now gets a genuine **debate role** — 📜 Olddoc the **skeptic/critic**, 🌿 Livewire the **advocate**, 🌀 Hearsay the **analyst** — that works for **any topic, even a single noun** like "reasoning ratio" (they first frame the concept, then take a stance). They **name each other and push back** ("Olddoc, I agree the ratio shouldn't be maxed blindly, but…"), and the bubble nameplates now show a **role chip** (`📜 올드독 · 회의가` / `🌀 Hearsay · Analyst`) so spectators can follow the clash.
- **The chair aggregates, then judges.** KRONOS no longer just "picks the newest source" — for free topics it now **synthesises all three positions** (advocate / skeptic / analyst) and delivers **its own reasoned verdict** with a one-line *basis* explaining how it weighed them, in the user's language. Per-turn and chair **token budgets were raised** (context window `slice(-8)`, clamp 600 chars, chair 1400 tokens) so arguments and verdicts are fuller. Pacing is owned entirely by the client, so the worker streams turns with **zero artificial gap**.
- **Sim-leak fixed for good.** While the live HUD is open, the ambient (free, scripted) sequence can no longer overwrite the live verdict — the `updateChrono` gate now also checks `_hudShown()`, so the gold verdict bubble persists until you close the HUD, and the ambient loop only resumes afterward. Verified end-to-end on real GPU: KO (vitamin-C megadose) + EN single-noun ("reasoning ratio") — role chips correct in both languages, long turns split across bubbles, verdict held until the queue drained, **0 console errors** on desktop + mobile. The six curated cases keep their deterministic math verdict; only free topics use the chair LLM (always **⚡ unverified**-labelled).

## [1.24.0] — 2026-06-28

### ⚡ Chronopolis — free-topic live debates you watch unfold in 3D
- **Type any topic and the council argues it for real.** The Convene modal now has a free-text box (the six curated cases pre-fill it, but you can ask anything — "monorepo vs many repos", "REST냐 GraphQL이냐"). Pressing **⚡ 라이브 토론 시작** sends the topic to the worker's new **Server-Sent Events** endpoint (`action:"councilLive"`), and the three sages debate it **live for up to two minutes** — `gpt-5.4-mini` tiki-taka streamed turn-by-turn ("Did you read the source?" / "소스 까봤냐?").
- **The popup closes and you watch in the chamber.** Convene dismisses the modal and drops you into the 3D rotunda with a live **HUD overlay** — a debate badge, the topic, a round counter, and a **progress bar** that fills over the two minutes — while each sage's line pops as a speech bubble over their own head in real time. A close button (44 px, mobile-safe) bails out any time.
- **A stronger chair, and an honest label.** Free topics are judged by a stronger chair model — **`gpt-5.4-chair` with reasoning `high`** and a raised token budget — whose verdict streams into a gold verdict card. Because a free-topic verdict is *AI inference, not computed from a curated source*, it **always carries an "⚡ AI 라이브 추론 · 출처 미검증 / unverified" badge**. The six curated cases keep their deterministic math verdict ("debate is theatre, the verdict is math") — only free topics use the chair LLM.
- **Safe by construction.** The client gracefully falls back to the zero-cost Ambient stage if the worker can't stream (offline, capped, or error) — never an error screen. The new **L4b daily live-count cap is lowered to 100/day** for the pricier free-topic path, on top of the existing five-layer cost guards. Production-verified KO + EN: full SSE flow (convocation → 12 turns → verdict → done), verdict populated in the user's language, `unverified:true`, **~$0.007–0.011/debate**, 0 console errors on desktop + 390 px mobile.

## [1.23.0] — 2026-06-27

### ⚡ Chronopolis — the Kronos Council goes Live (real LLM, with a hard daily ceiling)
- **Convene now runs a real debate.** With the worker's `COUNCIL_LIVE_ENABLED` switch on, pressing **⚖️ 회의 소집 (라이브)** sends the three sages into an actual `gpt-5.4-mini` argument — the testimony/cross-examination lines you read are now LLM-generated tiki-taka ("소스 까봤냐?" / "블로그에서 봤는데…"), not a fixed script. **The verdict is still pure math:** it always comes from the deterministic core engine, never from the debate ("debate is theatre, the verdict is math"). Live-verified on the public site: `live:true`, real `cost`, core verdict, **0 console errors**.
- **New L4b guard — a daily live-count hard cap.** On top of the existing five-layer cost guards (rate / concurrency / burst / USD budget / per-debate token cap), there's now a blunt, intuitive ceiling: **at most N Live debates per UTC day** (`COUNCIL_DAY_LIVE_MAX`, default 300). Because each debate's tokens are already bounded by L5, "N debates/day" is effectively a hard daily *token* ceiling that's easy to reason about. Once it's hit, Convene silently falls back to the zero-cost Ambient stage with a friendly notice — never an error screen. It reuses the budget store under a `cnt:` bucket, so any KV/D1 adapter supports it for free.
- **Caps in effect:** month $600 · day $24 · 300 live/day. (The store is in-memory, so caps are best-effort per worker isolate; L1–L3 frequency throttles keep runaway impossible, and L5 bounds every single debate.)
- **Deterministic-time fix.** `runDebate` now pins its deadline clock to an injected `now` when one is provided (tests/replay), so the live-path crosschecks (cost > 0, error → partial) are reproducible regardless of wall-clock. Production injects neither `now` nor `clock`, so it still uses real `Date.now()` — no behavior change. Tests stay green: engine **62** + live crosschecks **34** (incl. the new daily-count cap C11).

## [1.22.0] — 2026-06-27

### ⏳ Chronopolis — the sages are dev geeks now, and they argue with their hands
- The four council figures were reading as **hooded monks/priests** (a long robe-like capsule with no legs and no arms, half-sunk into the chamber floor). They've been rebuilt as **dev-geek chibis** — big head, hoodie torso, **visible legs + shoes**, and **articulated shoulder-pivot arms** — each with their own persona: **올드독/Olddoc** (silver hair, glasses, cardigan, coffee mug), **코드짱/Livewire** (messy hair, slung hood, **headphones**, glowing phone), **썰풀이/Hearsay** (beanie + pom-pom, mic), and **⏳크로노스/KRONOS** — the gold chair — who **lost the priest cone-hood** and is now a visor-capped tech-lead with a glowing tablet.
- **They debate with gestures.** When you're near the chamber the three debaters **raise and point their free arm to make their case** (the held prop stays in the rest hand), sway their torso, and bob their heads — phase-offset so it reads as a live back-and-forth — while KRONOS calmly *weighs time* with alternating hands. Arms settle to a neutral rest pose once you leave (gesture loop is near-gated for performance).
- **Engine untouched, still byte-equal & zero-cost.** This is purely the 3D figures + an animation block; the council logic, fixtures, tiki-taka banter, and verdict timeline are unchanged (tests stay green 62 + 28). Verified on real GPU desktop + 390 px mobile: dev-geek silhouettes with planted feet, arms animating, council modal + verdict timeline intact, **0 console errors**.

## [1.21.0] — 2026-06-27

### 📱 Mobile tap-target polish — every control is thumb-friendly
- A focused accessibility pass over the **touch UI**: the chat **close (×)** button — previously a tiny 11×18 hit area that was easy to miss — is now a full **44×44** tap target, and the **send (▶)** button, topbar buttons (**🌐 language · 🌙 day/night · 🛂 passport**), and the intro language toggle all meet the **44 px** minimum on touch devices. The taxi/scholar **chat input now uses 16 px** on mobile so iOS Safari no longer zooms the whole page when you tap to type. In-chat **"ride" and alternate-repo chips** got taller hit areas too.
- **Surgical & desktop-safe.** Everything new lives behind a single `(hover: none) and (pointer: coarse)` media block placed last in the stylesheet, so the desktop layout is byte-for-byte unchanged (verified `pointer: coarse` is false on desktop, input stays 13 px). No 3D, camera, or render code touched. Verified on a 390 px viewport: **no horizontal overflow, every interactive control ≥ 44 px, 0 console errors**, and Phases 33–35 (emotes, tree sway, council timeline) all still intact.

## [1.20.0] — 2026-06-27

### ⏳ Chronopolis — the Verdict of Time, made visible
- When you convene the Kronos Council, the verdict now comes with a **recency timeline** that shows *why* Time decided the way it did. The three sages' sources are laid out on a single axis — **older → newer** — each as a card with its emoji, date, and claim, and the one Time points to (the newest, living source) **glows green** with a "⏳ Time points here" tag. The abstract principle "the debate is theater; the verdict is computed — Time is the judge" is now something you can *see* at a glance, for every one of the six cases (Pydantic, Transformers, OpenAI SDK, HTTP client, LangChain, CSS), in both Korean and English.
- **Engine untouched, still byte-equal & zero-cost.** The timeline is pure presentation built from the deterministic transcript the council already produces — no new LLM calls, no new fixtures, no change to the adjudication logic. All council tests stay green (62 + 28). Mobile-safe: three cards fit a 390 px viewport with no overflow.

## [1.19.0] — 2026-06-27

### 🌳 Wind in the trees — the whole town breathes
- Every tree in Repolis now **sways gently in the wind**. Leafy shade trees, Provençal cypress spires, and silvery olives all lean and rock from their base on a soft, per-tree rhythm, modulated by a slow town-wide gust so the canopy ripples instead of swaying in lockstep. Combined with the birds gliding overhead, butterflies fluttering through the gardens, drifting clouds, and chimney smoke that were already there, the village finally feels like it's *alive* and lived-in — somewhere you want to walk and linger.
- **Featherweight & mobile-safe.** The effect is a tiny base-pivot tilt per tree (no geometry work, no extra draw calls, no new objects) — 81 trees updated per frame with two cheap trig calls each. Day and night alike. Central plaza stays open and uncluttered; nothing was added, only motion. Verified with **0 console errors** on desktop and mobile.

## [1.18.0] — 2026-06-27

### 👋 Multiplayer emotes — wave, clap, cheer, dance, heart
- The click-to-greet wave grew into a small **emote wheel**. A new 😊 button (above the taxi button, on the right) opens a row of five one-tap emotes — **👋 wave · 👏 clap · 🙌 cheer · 🕺 dance · 💖 heart** — each with its own shoulder-pivot animation on your avatar plus a floating emoji bubble. Tap one and **everyone else in the town sees it too**: the emote is relayed over the realtime backend (a new `emote` message broadcast to all peers) and replayed on your avatar in their world.
- **The peer wave/greet still works exactly as before** — tapping a nearby visitor waves at them specifically (targeted), while the emote bar broadcasts to the room. Peers gained a second shoulder pivot (`_armL`) so two-armed emotes (clap/cheer/dance/heart) animate correctly on other players, not just your own avatar.
- **Mobile-first UI.** The emote bar uses 46 px tap targets, wraps inside a 390 px viewport with no overflow, never overlaps the taxi/action buttons, and carries `aria-label`s for every emote. Tapping anywhere outside closes it.
- The realtime worker (`repolis-rt` on Cloudflare) was redeployed with the new `emote` relay case; verified end-to-end on production (a second client receives `{t:'emote',kind:'dance'}` and the legacy `{t:'wave',to}`), with **0 console errors** on desktop and mobile.

## [1.17.0] — 2026-06-27

### ⏳ Chronopolis: every topic now argues in its own words + slower, readable bubbles
- **"맨트가 전부 같아" — fixed.** The six council debates used one shared template, so every topic read with the *same* sentences (only the interpolated value changed). Each sage now draws from a **per-topic phrasing pool**, picked by a **deterministic seed hashed from the fixture id** — so Pydantic opens *"내 오래된 매뉴얼엔 .dict()…"* while Transformers opens *"예로부터 max_length라 했지…"* and OpenAI SDK opens *"에헴, 문서엔 분명…"*. Testimony, the cross-examination jabs, the defend/concede/pile-on lines — all of them rotate, in **KO and EN**, so walking past the rotunda six times sounds like six different arguments instead of one on repeat.
- **Still 100% deterministic, still \$0.** Because the variant is chosen from a stable hash of the fixture id (not randomness), each topic is **byte-equal on repeat** — the same guarantee the tests assert. `council/test.mjs` **62 checks** + `council/test-live.mjs` **28 checks** stay green.
- **The ambient bubbles slowed down.** "말풍선 속도가 너무 빨라" — the floating debate bubble over Chronopolis advanced every flat **2.7 s**, too fast to read a full line. It now holds for a **length-scaled 3.8–8 s** (longer lines linger longer; the verdict line holds 6.5 s), so you can actually read each jab before the next one lands.

## [1.16.0] — 2026-06-27

### 🛣️ Chronopolis is now reachable — an approach road + "take me there" taxi nav
- **A spur road out to the Council.** The town grid was all concentric ring roads (very Paris), which left **Chronopolis marooned on the lawn** with no way in. There's now a **radial approach avenue** — a dirt sidewalk apron + dashed asphalt lane — running straight from the outer ring (r≈150) down the entrance corridor to the rotunda steps, finishing in a **half-round forecourt** that blends the straight lane into the round stylobate. You can now walk or drive right up to the doors.
- **Tell the taxi a landmark and it drives you.** Ask POLARIS *"크로노폴리스로 가자" / "take me to Chronopolis"* (or the canal, the town square, the rest park) and the cab now offers a **ride straight to that landmark** — following the new road for Chronopolis — instead of treating it as a repo search. **Chronopolis is a proper noun**, so just naming it is enough; generic spots (운하 / canal, 광장 / plaza, 공원 / park) need a "go" verb so idle chatter about a canal doesn't hail a taxi. On arrival at Chronopolis the **Council opens automatically**; the other landmarks just drop you off with a welcome line. Works in **every taxi mode** (Local / WebLLM / Foundry Live) because it resolves inside the shared intent core, and in **KO / EN**.
- Repo search is untouched — *"제일 인기있는 레포"* still ranks `youtube-dl-nas` with alternates. Verified end-to-end in both languages (drive message → ride button → taxi drives the route → arrival → Council) with **0 console errors**.

## [1.15.0] — 2026-06-26

### 🎨 Chronopolis: the three debate-sages got a hip AI/dev redesign
- Real-device feedback was that the council sages read **too much like priests / monks** in their plain robes. The three debaters are now distinct, modern AI/dev characters, each with its own silhouette, colour, accessory and **a real face** (brows + mouth): **📜 Olddoc** is a vintage senior dev — chunky horn-rimmed glasses, a cardigan shirt-collar, silver side-hair and a steaming coffee mug; **🌿 Livewire** is a hacker — hoodie with the hood slumped behind the neck + drawstrings, headphones over the head, and a glowing code-laptop on the lap, wearing a cocky smirk; **🌀 Hearsay** is a community streamer — a pom-pom beanie, a handheld mic with a little "on-air" glow, and a big grin. **⏳ KRONOS (the Chair of Time) keeps the mythic gold robe** on purpose, for contrast with the street-wear debaters. Same height/scale so the colliders and name-plates still fit; verified day + night with **0 console errors**.

### ⏳ Chronopolis: six debate topics (3 dev + 3 AI/ML) + the sages actually talk
- **Six curated cases now, split evenly between dev and AI/ML.** The council debates **three dev questions** — Pydantic `.dict()` → `.model_dump()`, the recommended request timeout, modern CSS centering — and **three AI/ML questions** — the OpenAI SDK `ChatCompletion.create` → `client.chat.completions.create`, HF Transformers `max_length` → `max_new_tokens`, and LangChain `LLMChain` → LCEL `prompt | llm`. (`pandas_append` retired to keep the set tight.) Each is a real, famous version-drift so nothing is fabricated, and the deterministic engine still fires the right hourglass signature for each (S1/S1/S3/S2/S2/S8).
- **The sages stopped narrating and started bickering.** Testimony and cross-examination are now **spoken, in-character tiki-taka** instead of dry statements: 📜 Olddoc digs in *("에헴, 문서엔 분명…"/"Ahem — the docs plainly say…")*, 🌿 Livewire snarks back with a line number *("십 년 전 문서겠죠 ㅋㅋ 소스 까보면…")*, and 🌀 Hearsay wobbles or piles on *("어… 잠깐, 그럼 내가 본 게 옛날 블로그였나? 😅", "형만 옛날 버전이네 ㅋㅋ")*. **All three now jab back** (previously only Livewire cross-examined); when there's a real consensus they good-naturedly agree instead. No profanity — just character. Both the ambient bubble over the rotunda and the interaction modal show the banter, in KO / EN.
- **Still 100% deterministic, still \$0.** Every line is interpolated from fixture data with no randomness, so transcripts stay byte-equal on repeat and the verdict is always math. `council/test.mjs` updated for six fixtures — **62 checks green**.



### ⏳ Fix: don't get wedged inside the Kronos Council on mobile
- Real-device feedback showed players getting **trapped between the council's columns** on mobile. The 14-pillar ring used `r:1.0` colliders that left gaps too narrow to find, and the dais core (`r:2.2`) crowded the centre. Now the **two town-facing pillars are collider-free** (a clear, wide entry corridor), every column collider is **slimmed to `r:0.62`** so all gaps widen, the three sages' colliders go `1.0 → 0.7`, and the centre is just the **sundial gnomon (`r:1.0`)** instead of a `2.2` dais core — the rest of the floor stays freely walkable. Verified with frame-by-frame walk sims: from inside the ring a straight line out is now monotonic (dist 11.5 → 55.7, no snag at the column radius), and from dead-centre the player never pins to a point. 0 console errors.

### ⚖️ Chronopolis: the Live debate pipeline + cost guards (built, but Live stays OFF)
- **The whole Live machine now exists end-to-end — and is wired so it can never spend a cent until you flip one switch.** A new `council/guards.js` implements the five cost walls (§I): **L1** personal rate-limit, **L2** concurrency cap, **L3** IP-band burst, **L4** global budget gate (Live off but the town stays alive), **L5** per-debate hard cap. A new `council/live.js` is the `AMBIENT → BUDGET → RATE → CONCURRENCY → LIVE → VERDICT` state machine — and crucially **the verdict ALWAYS comes from the deterministic core engine, independent of whatever the debate says** ("the debate is theatre, the verdict is math"). Provider error/timeout keeps the partial transcript and still finishes with the core verdict.
- **The rate-limit key is fingerprint-first, on purpose.** It keys on a device fingerprint (IP is reserved for burst detection only), so wiping cookies / going incognito / changing IP can't farm extra Live debates — while **different devices on one shared café/office IP each stay independent** (the silent killer that naive IP-keying gets wrong). Keys are salted, un-reversible FNV-1a buckets so no raw IP/fp is ever stored.
- **Proven deterministically, no real clock/network/LLM.** A new `council/test-live.mjs` runs the §J crosschecks **C1–C10 — 28/28 green**: cookie-wipe / incognito / IP-change still blocked, shared-IP independent, concurrency caps, budget 90% gate → Ambient survives, daily cap resets next day, cost within ±20% of the hard cap, bot burst trips L3, provider error → partial transcript + core verdict.
- **Worker endpoint + modal button, both Ambient by default.** The Cloudflare taxi Worker gains a `POST {action:"council"}` route that runs the same state machine; with `COUNCIL_LIVE_ENABLED` unset (the default) it returns a friendly **spectator** notice and the deterministic record — a clone with no Azure still works and never spends. In the chamber modal there's now a **"⚖️ Convene the council (Live)"** button that shows the live/spectator/cooldown/full/budget state inline (KO / EN); with Live off it simply says *"Spectator mode for now 👀 enjoy past councils"* while the zero-cost record above stays the verdict. **`LIVE_ENABLED` / `COUNCIL_LIVE_ENABLED` remain false** — turning Live on is a deliberate, budget-capped future step.

## [1.14.0] — 2026-06-25

### ⏳ Chronopolis — the Council of Time (a deterministic "docs vs code" debate chamber)
- **A new landmark in the far-south clearing: the Kronos Council.** A 3D Doric rotunda — three-step stylobate, a 14-column ring, architrave, a raised dais and a working sundial — where **three new debate-sages** argue an eternal software question: *"is it the docs or the code that's right?"* **📜 Olddoc / 올드독** (the Keeper of Old Pages) defends the documentation, **🌿 Livewire / 코드짱** (the Reader of Living Source) cites the running source, and **🌀 Hearsay / 썰풀이** (the Echo of the Crowd) repeats what the community says. Above them, golden **⏳ KRONOS / 크로노스** (the Chair of Time) lets the verdict be decided not by who shouts loudest but by **which source is newest** — *"세 표가 갈려도, 시간은 하나를 가리킨다."*
- **Philosophy: ambient is free, only the live debate would cost.** The chamber runs an **ambient debate bubble** over the rotunda that cycles seeded debate lines at **0 LLM cost**, and an interaction modal that adjudicates **five seeded cases** (pydantic dict, OpenAI SDK, pandas append, request timeout, CSS centering) with a deterministic engine — *"토론은 쇼, 판정은 계산."* Each case renders a distinct, correct verdict and a one-line hourglass signature. **The money-spending Live LLM path is intentionally OFF** (`LIVE_ENABLED: false`); a documented budget gate (\$500–700 / month cap, auto-killswitch at 90%) sits behind it for a future, opt-in Live phase.
- **Fully wired into the existing town.** A **⏳ passport stamp** is earned when you walk up to the council entrance (a 7th landmark for the Explorer Passport), the proximity prompt + action button open the modal, and everything renders in **KO / EN**. The deterministic council core ships as a small `council/` module (`engine.js` + seeded `fixtures.js` + `council.config.json`, validated by `council/test.mjs` — **52 checks green**).
- **Two bugs fixed during verification.** The passport stamp gate was using a center-radius check the player could never satisfy (the player stands at the *entrance*, ~22u from center) → it now gates on the same entrance-reach check as the scholar/library stamps. And the chamber's original south-west diagonal placement collided with a repo cottage (a red-roofed house sat inside the columns) → the rotunda was relocated to a genuinely clear far-south clearing (no buildings within 55u), opposite the north library for axial balance. Verified day + night, all five fixtures + EN, with **0 console errors**.

## [1.13.0] — 2026-06-25

### 🌳 Let the plaza breathe + a calm park pocket off the square
- **Decluttered the central plaza.** Feedback was that the square felt too busy. The **12 flower planters that ringed the plaza are gone**, the **6 rose arches at the avenue mouths were de-ballooned** (far fewer, smaller blooms on the poles and crown so they read as elegant arches, not bouquets), and the floating star-dust was thinned (96 → 54 motes, lower opacity). The fountain, glowing rune circle, four benches and the fountain's low flower ring are untouched — so sightlines across the square and the movement paths down each avenue are open again, on desktop and mobile.
- **Added a separate "Park · 공원" rest pocket on the south-west lawn** (set off the plaza, tucked between the ring streets), to spread the visual focal points instead of piling everything in the centre. It's intentionally calm: a circular gravel stroll path, a low lavender flower bed with a stone rim, **three benches you can actually sit on** facing the bed, mixed Provençal shade trees (leafy · cypress · olive), a couple of low flower patches and a rock, one **night-aware guild lantern** that lights the path after dark, and a little wooden **signpost** at the plaza-facing entrance. No flashy balloons, particles or VFX — just somewhere to slow down between repo visits.
- **Cheap and safe.** The park reuses existing shared geometry/materials and the established lantern night-glow system (no new lights, minimal extra draw calls); benches register with the same `SEATS` sit system, and the bed/trees/signpost push to `EXTRA_COLLIDERS` so you walk around them. The Passport / scholar / taxi / library / canal flows are all untouched. Verified day + night + mobile width with **0 console errors**.

## [1.12.1] — 2026-06-25

### 🏠 Fixed the oversized barrel-vault roof on villa buildings
- **Five tier-3 villa buildings had a giant brown dome floating above (and behind) them.** Any repo whose typology rolled a *barrel* roof — **AIsketcher**, **pronunciation-mapper**, **Hyeonsang-AI-Contributions**, **FSI-Gameday-General-Immersion-Day**, **aws-korea-2023-coding-school** — rendered a huge half-cylinder that ignored the building footprint and curved off to one side instead of sitting on the roof.
- **Root cause:** the old barrel was a half-`CylinderGeometry(w*0.58,…,w*1.06,…,0,π)` laid down with a single `rotation.x = π/2`. That rotation left the **rounded face pointing sideways (+x) rather than up**, and the `w*0.58` radius / `w*1.06` length overshot the footprint — so the curved sheet and its circular end-cap read as an oversized floating dome, very pronounced on tall, slender villas.
- **The vault is now a real arch clamped to the footprint.** It's rebuilt from an `ExtrudeGeometry` of a flat-bottomed semicircle (`R = w*0.52`) extruded **front-to-back** (`L = w*1.02`), so the round face always points up, the ends are closed automatically, and it can never exceed the building width regardless of how tall the villa is. A slim ridge beam was added along the crown. Verified headless on all affected buildings, **day and night, with no clipping and 0 console errors**.
- Added `__roofs(style?)` / `__roofOf(name)` debug hooks (under `?dbg` only) that report each repo's typology + position, used to locate every barrel building during the fix.

## [1.12.0] — 2026-06-25

### 👋 Click-to-greet — wave at other visitors in real time
- **Tap another player to wave at them.** When the town has more than one live visitor, clicking (or tapping on mobile) directly on another player's avatar now makes **your** character raise a hand and wave. The greeting is fully networked: the person you waved at — and everyone else in the world — sees your avatar wave, and the recipient gets a friendly toast (*"○○님이 인사했어요 👋"* / *"○○ waved at you 👋"*). A little 👋 bubble floats up over the target and fades.
- **Real raycast picking, proximity untouched.** A new `THREE.Raycaster` resolves the tapped screen point to the nearest peer avatar; if the tap doesn't hit a peer it falls straight through to the existing proximity action (enter a building, talk to a scholar, sit), so nothing about walking up to places changes. Peer arms were rebuilt as shoulder-pivot groups so the wave pivots at the shoulder (the rest pose is pixel-identical).
- **Server relay is additive + free.** The realtime Worker (`repolis-rt`) now relays a `{t:"wave",id,to}` message to everyone except the sender; old clients simply ignore it. The initiator animates locally and is **not** echoed, so there's no double-wave. Verified end-to-end against the live Worker (`wss://repolis-rt.workers.dev`) with two clients — the recipient receives the wave, the sender gets no self-echo — plus 0-console-error headless checks of the local + peer arm animation, bubble, and toast. **Local-only identity, no PII.**

## [1.11.1] — 2026-06-25

### 🔗 Tappable, copyable reference links in "How I found this"
- **The scholars' source citations are now mobile-friendly.** In VEGA / RIGEL / POLARIS answers, the *"🔎 How I found this"* panel already rendered each reference as a real `<a target="_blank">`, but on a phone the link was a tiny one-line tap target and a long-press to copy was swallowed by the town's global right-click/context-menu suppression. Each reference is now a **full-width 40px tap target** with an external-link affordance (`↗`) plus a dedicated **📋 copy button** beside it.
- **Copy works everywhere.** The copy button uses the async Clipboard API with a `document.execCommand` textarea fallback for self-hosted `file://` clones, and flips to a green **✓ / "Copied"** state for a moment so the tap is confirmed.
- **Hardened against bad URLs.** A new `safeHref()` only lets **http/https** references become clickable — `javascript:` / `data:` and other non-web URLs are rendered as plain, non-clickable text (and get no copy button), closing a small XSS surface. Links now carry `rel="noopener noreferrer"`.
- **No new event leaks.** The chat is a DOM overlay above the WebGL canvas and all camera/touch controls are bound to the canvas only, so link/button taps never reach the player controls; the copy button also `stopPropagation`s for good measure. Verified KO/EN, desktop + mobile widths, 0 console errors.

## [1.11.0] — 2026-06-25

### 🛂 Explorer Passport — collect stamps as you explore the town
- **A local-only visit passport.** A new 🛂 button in the HUD opens a passport popup that tracks where you've been: a six-stamp grid for the town's landmarks — **POLARIS · Wayfinder**, **VEGA · Archivist**, **RIGEL · Cartographer**, the **Contribution Library**, the **Town Square**, and the **Petite-Venise Canal** — plus a **repos-visited** counter and a *"not yet visited"* list of zones still to discover.
- **Stamps are earned by walking up to a place.** The existing per-frame proximity loop now also awards a stamp the first time you get close to a scholar, the library, the plaza, or any canal nook (canal centres are auto-collected as the world builds). Each award early-outs once earned, so there are **no per-frame writes**.
- **Everything persists across visits.** The passport (stamps + visited repos + first/last timestamp) is saved to `localStorage['repolisPassport']`. On reload it's restored — your repo **visit counter**, the green *visited* rings, and the highlighted repo rows all come back, so progress survives a refresh (previously the visit count reset to 0 every load). **Local-only, no server, no PII.**
- **Bilingual + mobile-safe.** All passport copy is KO/EN and re-renders on language switch; the popup reuses the `#panel` look (frosted card, `max-width: calc(100vw − 28px)`) and the HUD bar wraps, so the new button is safe on phones. Pure DOM HUD — the 3D scene, camera, and renderer are untouched.

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
