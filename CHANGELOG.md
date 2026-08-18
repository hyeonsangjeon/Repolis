# Changelog

All notable changes to **Repolis** are documented here.
The format loosely follows [Keep a Changelog](https://keepachangelog.com/); dates are UTC.

This file keeps the current product era (`1.50.0` onward) easy to scan. Earlier releases are preserved in
[`docs/changelog-archive.md`](docs/changelog-archive.md).

## [1.86.0] — 2026-08-18

### ⏳ Town Growth Replay — watch an open-source history become a city

The peer benchmark found the same adoption loop across Git City, GitCity, GitHub Skyline, `snk`, Metrics,
and GitHub Readme Stats: developers respond most strongly when their own public record becomes a moving,
customizable artifact they can share in one step. Repolis already had personalized towns, comparison,
postcards, profile portals, badges, and exploration rewards; it did not yet show how a town came to exist.
Growth Replay adds that missing personal-history story rather than duplicating those surfaces.

- Wayfinding, the Explorer Passport, and a completed `?user=` preview now open a daylight time machine where
  existing repo houses rise through their real public creation years. Play/pause and an accessible year
  scrubber work without login, persistence, or another GitHub request.
- `?growth=<year>&ref=growth-replay` preserves the current town and opens the nearest truthful milestone.
  Native share or clipboard fallback and Town Postcard Studio both carry the selected era and cumulative
  house count.
- The boundary is explicit: years come from historical creation dates, while house size and decoration use
  current public metrics. Invalid-date houses appear only at the present milestone.
- Replay reuses existing house roots, far LOD, camera, sky, fog, fireworks, and earned Star invitation. It
  adds zero draws, textures, lights, backends, recurring timers, storage keys, or static media, and restores
  every borrowed render owner on close.

## [1.85.0] — 2026-08-18

### 👤 Town Creator Hall — make every cloned town personally ownable

- A compact walkable pavilion now belongs to the active town owner on the canonical site, a GitHub Pages
  fork, or a `?user=` public town. Its bounded adaptive placement avoids avenues, repo parcels, and civic props.
- Opening the hall explicitly fetches one allowlisted public GitHub profile, caches only rendered fields for
  24 hours, and combines it with local town facts: stars, languages, explainable badges, and three signature
  projects. Rate limits fall back to repo facts already in the city.
- Menu, Passport, map, Station taxi, walk-up prompts, KO/EN, focus trapping, sharing, and profile navigation
  all lead to the same panel. The contextual Star action credits the upstream Repolis engine on every fork.
- The pavilion adds 15 bounded draws, two textures, no light, and no backend; profile loading never runs at
  page startup.

## [1.84.0] — 2026-08-15

### ↔ Twin Towns — turn a personal preview into a two-person invitation

The existing preview, profile portal, and postcard make one developer's town easy to experience and
share, but they give a specific recipient no personal reason to open the link. Twin Towns adds that
missing referral loop: one developer connects a second public GitHub account, sees truthful shared
languages or topics, and sends a reversible deep link that opens both towns for the recipient.

- The public-town ready state and in-city menu both open an accessible KO/EN comparison flow.
- Matching and URL construction live in a small deterministic module with no login, upload, backend,
  dependency, or new static media.
- Shared `?user=<first>&twin=<second>&ref=twin-town` links open the comparison immediately; the visit
  action swaps direction so either person can explore and reshare the bridge.

## [1.83.3] — 2026-07-22

### 🎬 README demo continuity — from Hada curiosity to a first town visit

- The existing current EN/KO GIFs now have visible 15-second captions that explain the full
  traffic→building→Gitber→taxi→repo-card story instead of relying on image alt text.
- Generic control copy becomes the exact first interaction path: `WASD`/touch to walk, ask Gitber, and
  `Enter`/tap to open, with no-sign-up/no-build and local-run proof kept in the same compact line.
- A single calm `Star Repolis` link follows the action path below the demo. The GIF, hero hierarchy, data
  mapping section, and Council assets remain unchanged.

## [1.83.2] — 2026-07-21

### 🏡 Resident cottage variety — richer homes, bounded batches

- **The homes no longer share one silhouette.** Deterministic resident styles divide the eight cottages into
  three hip, three gable, and two hex-roof houses while keeping walls and each roof family instanced.
- **Facade details make identity readable up close.** All homes gain coloured shutters and transom windows;
  selected residents receive window boxes, porch canopies/posts, chimneys, and bright roof finials according
  to a fixed persona-matched style map.
- **Clearance remains truthful.** Name signs move ahead of gable faces, canopy posts remain inside cottage
  collision and clear of porch seats, and existing gardens, routes, taxi arrival, trees, and map bounds stay
  unchanged.
- **The frame budget stays explicit.** Desktop adds ten total style/detail batches; LOW_END keeps the three
  roofs, shutters, transoms, and window boxes in six batches while dropping canopies, posts, chimneys, and
  finials. No per-home material, light, model, network, or persistence cost is added.

## [1.83.1] — 2026-07-20

### 🌳 Starlight Row landscaping — a neighborhood cared for, not just occupied

- **Every cottage gains a real front garden.** Resident-coloured flowers, paired hedges, and stepping stones
  now connect each door to the shared walking ring.
- **The commons becomes a garden.** A raised circular flower bed, benches, luminous flowers, and visual-only
  lanterns give the central green a readable daytime heart and warm night rhythm without adding point lights.
- **Trees frame the neighborhood.** Draw-batched broadleaf and cypress trees plus a low shrub perimeter shape
  the quarter while preserving a clear town-facing entrance. Landscape colliders protect both visitors and
  resident movement.
- **The polish stays bounded.** LOW_END keeps all eight gardens, the central bed, five broadleaf trees, two
  cypress, ten shrubs, and two lanterns. The public-town reserve expands to keep overflow repos clear of the
  full tree canopy, not only the cottages.

## [1.83.0] — 2026-07-20

### 🏘️ Starlight Row — homes and daily routes for the AI residents

- **Every resident has a real home.** Eight named, resident-coloured cottages now form a shared north-east
  residential quarter with porch seats, warm night windows, a common green, benches, and luminous flowers.
- **Home and work are different places.** Existing district anchors remain each resident's work. Night
  schedules a staggered collision-aware walk home; morning/day sends residents back to their own district.
  Friends and idle life continue around the shared green instead of stacking at one point.
- **Social ownership still wins.** Chat, visitor proximity, Shared Joy, gatherings, festivals, strolls, rest,
  hidden tabs, and disabled motion delay commuting rather than being interrupted by it. LOW_END keeps all
  eight homes and routes while dropping optional chimney and flower detail.
- **The expansion is part of the town loop.** Starlight Row appears on the world map, GitHub Station, Gitber's
  bilingual landmark intent, and the Explorer Passport. Debug probes cover homes, collision, framing, and
  forced/finished home-work routes without adding AI, network, interior, or persistence cost.

## [1.82.1] — 2026-07-20

### ✨ README hero polish — turn external curiosity into the live town

- **The experience leads before implementation proof.** Both README heroes now put one copyable product
  sentence, the live CTA, and the current demo before the compact utility badges.
- **The demo matches today's village.** New EN/KO loops show the living data-built town, a real Local-mode
  Gitber query, the taxi ride, and arrival at the truthful repository card. Each GIF is smaller than the
  June recording despite showing more of the current product.
- **Shared links tell the same story.** HTML description, Open Graph, Twitter, banner copy, `llms.txt`, and
  `repolis.yaml` now use the same traffic-shaped town positioning. The social preview uses the current
  rendered village instead of the June-era illustration.

## [1.82.0] — 2026-07-18

### 🎈 Resident Agency — Shared Joy excursions

- **Residents choose joy for themselves.** One idle pair at a time selects a short flower walk, stargazing
  pause, or real-repo visit from friendship, mood, time of day, persona preferences, and recent pair memory.
- **The destination is always part of the current town.** Flower walks use placed luminous flora, repo visits
  name and approach a real rendered house, and autonomous stargazing only starts while the stars are visible.
  Two stable arrival slots prevent the pair from stacking.
- **Existing social ownership stays authoritative.** Visitor proximity, repo reactions, resident/group chat,
  ambient gatherings, festivals, seating, hidden tabs, and disabled motion end or block the excursion cleanly.
  Travel budgets advance with capped simulation time, so LOW_END and slow frames do not time out early.
- **No new cost or heavy runtime work.** Shared Joy reuses resident movement, bubbles, poses, and town props;
  it adds no model, MCP, fetch, asset, light, or persistence. LOW_END keeps the activity at a calmer cadence
  and skips its optional arrival sparkle.

## [1.81.0] — 2026-07-18

### 📰 Town Gazette — see what changed since the last visit

- **Daily refresh becomes visible.** A new Passport card compares the current public repo data with the last
  snapshot this browser marked read, surfacing new/departed repos, available release tags, pushes, and
  positive traffic, star, or fork growth. Lightweight public towns do not fetch release metadata.
- **A return loop, not another dashboard.** Up to five ranked changes fit above the Village Chronicle. Current
  repos point the existing compass at their houses; departed repos remain an honest, non-clickable record.
  Explicit `Mark read` advances the baseline and clears the Passport news indicator.
- **No backend, AI, or frame cost.** One O(n) diff runs at load. Snapshots stay in `localStorage`, are scoped
  independently to owner and public-user towns, and are capped to five towns.
- **Return greetings stay calm.** A returning visitor sees the existing welcome first, then exactly one
  deferred Gazette toast instead of stacking it with the Chronicle announcement. First visits and no-change
  visits preserve the previous flow.
- **Behavior is locked down.** Pure fixtures cover order invariance, additions/removals, release/push/growth
  ranking, and negative corrections. Debug hooks simulate growth/mixed reports and mark-read behavior for
  desktop/mobile visual checks.

## [1.80.1] — 2026-07-16

### 📚 Fix: MIRA survives Context7's shared anonymous MCP quota

- Context7 remains MIRA's primary oracle, but a production Cloudflare egress can share an exhausted anonymous
  monthly quota. Known library identities now retain their canonical Context7 IDs.
- If resolve or query returns a quota/rate-limit response, the Worker reads the same library's bounded public
  Context7 `llms.txt` document, preserves source links, and applies the same grounded synthesis rules.
- Unsupported libraries still fail explicitly; the fallback never substitutes general model knowledge for
  missing documentation.

## [1.80.0] — 2026-07-16

### 🧭 Residents introduce roaming MCP scholars — find expertise by walking the town

- **Residents now know who knows.** Clear Microsoft, repo-internals, library/version, and
  model/dataset/paper questions are handed to VEGA, RIGEL, MIRA, or LYRA before resident AI runs. The
  handoff action closes the resident conversation and points the existing compass at the specialist's live
  position; it never auto-opens chat or summons the taxi.
- **MIRA · the Timekeeper joins through Context7.** She resolves a library and then reads current,
  version-specific docs through the official anonymous Context7 MCP, with an optional Worker API key only
  for higher quotas. She patrols a collision-safe loop in the Documentation/Library district.
- **LYRA · the Forgemaster joins through Hugging Face.** She searches public models and datasets with
  `hub_repo_search` and ML papers through anonymous `hf_fs`, preserving Hub and paper links. Korean search
  terms receive deterministic English keyword normalization. She patrols the AI Research district.
- **Search is not an exit anymore.** Both specialists move instead of waiting in the plaza, pause when a
  visitor approaches or starts chatting, and resume afterward. Their live Three.js positions drive the
  compass, speech bubbles, debug routes, and new Explorer Passport stamps.
- **Grounding remains bounded and honest.** Direct MCP output is treated as untrusted evidence. Existing
  Foundry synthesis may summarize it in the visitor's language but cannot follow retrieved instructions or
  invent unsupported claims; a no-secret clone receives a compact direct result instead.
- **Regression surface expanded.** Hermetic guards lock official endpoints/tools, optional-secret behavior,
  collision clearance, LOW_END patrols, deterministic routing, no-taxi handoff UX, bilingual copy, and
  debug hooks.

## [1.79.1] — 2026-07-16

### 📘 Fix: VEGA and the scholars answer again

- **Root cause fixed in the client router.** Scholar NPC records carry a Three.js `group` object for their
  scene model, while resident circles also used `group: true` as a chat marker. Truthy checks therefore
  misclassified VEGA, RIGEL, and Gitber as resident group chats and sent their questions to `groupSay()`.
- **Chat state now has its own type.** Resident circles use the explicit `chatGroup: true` marker and the
  shared `_isGroupChat()` guard. Scholar greetings, panel chrome, question dispatch, resident invitations,
  farewells, and debug state all use that guard instead of inspecting a render object.
- **The live knowledge path was healthy.** The production Worker and Microsoft Learn MCP already returned
  grounded VEGA answers; the fix restores the browser route to `askScholar()` without changing the Worker.
- **Regression coverage added.** The smoke harness proves a Three.js scholar group cannot satisfy the
  resident-circle guard and locks VEGA/RIGEL dispatch to the scholar path.

## [1.79.0] — 2026-07-15

### 📖 Village Chronicle — one resident, one cherished place, one real repository connection

- **Today's route is now a story.** The Explorer Passport opens a deterministic three-scene Chronicle:
  meet one active resident, visit that resident's cherished haunt, then discover either a metadata-related
  repository in their district or a real district recommended by a plaza guide.
- **Truthful and stable by construction.** The seed includes local date, town login, and sorted repository
  catalog. Resident selection respects the districts present in public towns; repo selection scores the
  resident's own topics against real repo metadata; cherished-haunt bearings are now reload-stable.
- **Existing town systems do the work.** Resident/group chat completes the meeting, walking or Gitber completes
  the haunt and district scenes, and opening the final repo completes the story. Progress stays sequential in
  the existing `repolisCourse` payload and renders inside the existing Passport.
- **Zero new operational cost.** No AI, backend, storage namespace, polling timer, asset, or runtime dependency
  was added. Korean/English labels render from identifiers, alternate public towns get their own cache scope,
  and LOW_END follows the same lightweight path.
- **Debug and regression coverage.** `?dbg=1` exposes `__chronicle()` and `__chronicleStep()`; the static harness
  covers town/date determinism, schema migration, scene order, metadata truthing, navigation hooks, i18n, and
  deterministic cherished-haunt placement.

## [1.78.6] — 2026-07-14

### 🌳 World Tree pendant radiance — stable glow while the camera moves
- **All 18 branch-end pendants now glow.** Their existing 36 stem-and-bulb parts retain exact branch-tip attachments and merge into one warm, tree-only selective-bloom mesh; the accepted dual-face veins and all 3,016 rooted leaves remain unchanged.
- **Throttled desktop bloom follows the live camera.** Between the existing every-third-frame source updates, captured tree bounds are reprojected into the current camera view so the halo no longer lags, shakes, or jumps during orbit and approach motion. Mobile keeps its existing zero-frame-gap source path.
- **Depth and safety remain natural.** Invalid, offscreen, or extreme mappings use bounded masking and identity fallback instead of forcing another render, preserving no-x-ray depth, front/rear/side continuity, and town isolation.
- **Production cost stays bounded.** The release adds no pass, render target, texture, light, geometry, draw, or triangle regression: the tree remains 83 draws / 76,570 triangles, while integrated headed desktop motion retained a 0.333 bloom-source ratio, 60.01 FPS median, and 17.7 ms P95.

## [1.78.5] — 2026-07-13

### 🌳 World Tree dual-face current — one dominant vein from either approach
- **A thick main current now anchors both faces.** Nine front and nine rear surface-following paths carry the same warm-gold trunk, foundation, and major-branch language; natural depth reveals only the facing dominant line instead of producing twin front lines.
- **Side continuity stays subordinate.** Three ultra-thin, dim support paths bridge oblique approaches without forming a neon cage, while the accepted organic knots, pendants, bark depth, and subtle vein-derived halo remain unchanged.
- **All leaves remain rooted.** The complete 3,016-leaf crown retains exact branch contact, root-pivot scaling, canopy motion, and the accepted amber/cyan hierarchy.
- **Performance and town isolation hold.** Desktop-only DPR, bloom-cadence, and low-signal LOD guards reduce frame drops without changing mobile behavior; the release adds no pass, light, texture, draw, or triangle regression and preserves bounded town exposure.

## [1.78.4] — 2026-07-13

### 🌳 World Tree Sculpt DNA correction — one rooted living current
- **One dominant energy spine.** A thick warm-gold camera-facing vein now leads the trunk, foundations, and major crown paths; much thinner, dimmer rear and side copies preserve 360-degree continuity without reading as twin front lines.
- **Depth-aware painterly hierarchy.** Bark remains a depth-only PBR surface with only a restrained vein-derived halo, while 21 organic knots and the 18 existing branch-end pendants retain their anchored warm highlights.
- **Every leaf is branch-seated.** All 3,016 leaf cards now overlap exact fine-branch curve contacts, scale about their root pivots, and share branch motion so the crown no longer reads as floating or vertically hung decoration.
- **Production and town contracts hold.** The correction adds no renderer pass, light, texture, imported mesh, or draw-count regression; all-angle natural depth, zero clipping, and isolated town exposure remain intact.

## [1.78.3] — 2026-07-13

### 🌳 World Tree 1.78.2 visual rollback — restore the painterly baseline
- **Broad whole-branch bloom removed.** The 1.78.2 interpretation made the trunk and load-bearing branches direct bloom sources, so it is rolled back to the protected 1.78.1 painterly-knots runtime. The intended reference language is instead one thick dominant energy vein, a subtle vein-derived bark halo, and thin subordinate support/rear veins.
- **Structure remains protected.** The rollback restores revision `azimuth-complete-energy-v3-painterly-knots` and factory SHA `307c48d6…24b97a` without changing tree geometry, draws, textures, lights, branch hierarchy, leaves, knots, sockets, actions, LOD, or town isolation.

## [1.78.2] — 2026-07-13

### 🌳 World Tree broad pillar glow — warm load-bearing radiance
- **A brighter structural body.** Fifteen existing load-bearing meshes—the trunk, foundation roots, and primary branches—contributed a broad warm-gold bloom beneath the sharper painterly energy detail.
- **Depth and hierarchy preserved.** The other 57 secondary/fine branch meshes remained black bloom-depth occluders, while the accepted 21 veins, 21 organic knots, leaves, glyphs, and core retained their coordinated luminous order.
- **No production-structure increase.** The change reused the existing extraction path with no new geometry, draws, textures, sprites, or lights; base bark PBR, actions, LOD, and day rendering remained unchanged.
- **Visual isolation remained bounded.** Eight-angle and mobile checks retained natural depth with zero white/channel clipping, while frozen tree-off/on measurement kept town exposure isolated.

## [1.78.1] — 2026-07-13

### 🌳 World Tree v3 final polish — painterly gold, organic junctions
- **Warmer, hand-weighted veins.** All 21 accepted bark-surface paths now use thinner variable-width amber-gold pigment instead of pale mechanical tubes, while preserving natural depth and eight-angle continuity.
- **Sparse organic knots.** Twenty-one deterministic seed/flame junctions—15 root and 6 secondary accents—replace repeated spherical beads; a bounded 12–15% longitudinal lift keeps them readable at town and mobile distance without a pearl-necklace or white-flare effect.
- **One tree-only luminous hierarchy.** Veins and knots lead restrained glyph and leaf radiance through the existing selective bloom path. Bark remains a depth occluder, and frozen tree-off/on measurement retains zero P95 town exposure spill.
- **Performance structure unchanged.** The final tree remains two merged energy meshes, 118 draws, and 76,570 triangles, with no added production pass, texture, material, or light and no LOD, collider, socket, or action regression.

## [1.78.0] — 2026-07-13

### 🌳 World Tree v3 midpoint — readable energy from every approach
- **The buried-vein root cause is fixed.** Veins previously used a fixed global-Z offset, so paths on other bark faces sat inside the trunk and disappeared by approach angle. All 21 copies now follow the local bark surface with natural depth testing and no x-ray rendering.
- **The real 45° blackout is removed.** An oversized whole-building AABB depth proxy—not the energy material—was masking the emissive network. Local occlusion now preserves all-angle luminance while keeping the town exposure balance and ordinary foreground depth.
- **One isolated living-tree bloom.** Leaves, glyphs, core knots, and veins feed the same selective bloom source; the two energy meshes remain depth-aware and cannot spill light or exposure into buildings, props, residents, or terrain.
- **Measurement is representative.** Real headed Chrome at 60 Hz is the release reference; headless scheduler and thermally throttled runs were misleading. Stable headed cadence is approximately **60 FPS by day** and **51–54 FPS at night**, with about **15.8% direction spread** and a **25.2–25.5 ms p95** caveat.
- **Measured visual gates pass.** All-angle energy coverage has a minimum of **0.78**, P90 luminance spread is approximately **0.92%**, saturation is **0**, and town exposure delta is approximately **0.10% mean / 0 P95**.
- **Validated midpoint scope.** P0, 2A, 2B-1, 2C, 2D, and 2E are retained with no visual or action regression. The failed 2B-2 experiment and its complexity are physically removed rather than hidden or left dormant.

## [1.77.2] — 2026-07-11

### 🌳 World Tree night legibility — restore the living Solar Archive
- **Sharp tree surfaces restored.** Energy paths, glyphs, and all 3,016 leaf cards remain in the normal depth-tested base render while also feeding the isolated bloom source. The final composite is now the standard `base + blur bloom`; it no longer replaces the visible tree with a sparse effect-only copy.
- **Warm bark from every approach.** A restrained tree-local emissive floor restores the generated brown bark and PBR relief at night without adding town-facing lights or changing global exposure. The factory PointLight remains effect-layer-only, so nearby buildings do not brighten.
- **No factory downgrade.** The Solar Archive production factory file, geometry, 3,016-leaf count, animation, sockets, and SHA remain unchanged; only the Repolis adapter corrects layer routing and the night bark floor.

## [1.77.1] — 2026-07-11

### 💡 World Tree HDR isolation — live neon, invariant town exposure
- **Architecture reset.** The normal town and non-emissive tree surfaces render once into a half-float linear-sRGB base target. Energy lines, leaf sprays, glyphs, and the factory PointLight render separately into linear emissive/bloom targets; constellation ornaments remain visible in the base without paying another multi-draw bloom pass. One final shader combines base + sharp emissive + true blur-only bloom, then the sole `OutputPass` applies ACES and sRGB conversion exactly once.
- **No physical spill into town.** The factory PointLight exists only on the selective bloom layer. Bark, roots, ground, moss, buildings, props, the player, residents, and remote peers keep their normal town lighting; nearby and moving geometry participates only as black depth occluders so hidden neon cannot draw through it.
- **Five proof modes.** `?dbg=1` exposes `base-only`, `emissive-only`, `bloom-only`, `final-composite`, and `tree-off` from one camera, plus the linear render-target contract and a frozen-clock exposure A/B hook.
- **Daylight foliage restored.** Dawn, day, and dusk move the 3,016 leaf sprays into the normal PBR base pass, enlarge the factory leaf card geometry by 1.22× without changing anchors/count, and apply warm bark plus amber/cyan emissive floors. The tree remains fully crowned and brown-gold instead of looking transparent, black, or leafless; night returns the original glow layer.
- **Town Exposure Invariance.** Final frozen same-camera tree-off/on captures, excluding the tree-adjacent mask, measure **0.43% mean** and **0.00% P95** luminance deltas—both below the 5% gate. Town exposure no longer changes when the World Tree is enabled.
- **Performance preserved.** Instanced-aware bounds turn nearby buildings/props into two instanced depth-proxy draws and all player/resident/peer bodies into one dynamic proxy draw. The already-rendered emissive target feeds bloom through `TexturePass` instead of redrawing the tree, and day/dawn/dusk bypass HDR glow entirely. Full Solar geometry/effects remain unchanged; desktop measures **48.9 FPS day / 33.5 FPS night**, while final 390×844 night cadence is **60.1 FPS** (`16.65 ms` average, `18.6 ms` p95), all above the 30 FPS floor with console errors 0.

## [1.77.0] — 2026-07-11

### ☀️ Solar Archive World Tree — the plugin flagship, alive inside Repolis
- **The production tree itself.** Repolis now imports the native `createRepolisHero.js` output from **threejs-sculpt-dna v0.4.0** byte-for-byte (SHA-256 `65bd7fc…d0e3`) and instantiates deterministic **Solar Archive** seed `20260711`. The old hand-authored v3 implementation is removed rather than hidden behind the new model.
- **Natural canopy continuity.** The former large cyan/brown floating clumps are replaced by **3,016 small instanced leaves** anchored to **15 macro → 56 secondary → 112 merged fine branches**. The gradual diameter ladder, dense overlapping sprays, 10% cyan ratio, and warm Solar palette make one continuous ancient crown while retaining its luminous World Tree identity.
- **No effect downgrade.** Desktop and mobile both use the factory's `full` stage: 220 moss instances, 72 branch-following glyphs, constellation nodes/links, hanging lights, generated bark PBR, root glow, energy pulse, leaf motion, and living-system sway all remain active. The source factory stays immutable; Repolis owns only a thin placement/integration adapter.
- **Independent Christmas-tree lighting.** The normal town render remains untouched. A selective pre-pass renders only the factory energy network, glyphs, constellation ornaments, leaf sprays, and pulsing PointLight with the live demo bloom `0.5 / 0.36 / 0.88`; bark, roots, ground, and moss stay town-lit and serve only as depth occluders. Nearby buildings, props, the player, and residents also enter the pre-pass as black depth occluders, so neon cannot overexpose town surfaces or draw hidden branches over foreground objects. Day alone calms ornament intensity and bloom.
- **Park integration.** Uniform scale `2.0` produces approximately `32.3 × 28.1 × 17.0` instanced-mesh-aware visible bounds at the same north park `(15, 48)`. The complete root island gets an 11.6-radius collider inside a widened 12.2-radius clear ring; benches, lantern, and sign move outside it. Six Repolis compatibility sockets plus eight factory branch sockets preserve 14 action-ready anchors.
- **Measured cost.** Full Solar Archive generation is roughly 65–95 ms with **68,904 tree triangles / 124 draws** on both desktop and mobile. This intentionally increases the previous mobile v3 tree from 8,666 / 77 to retain all plugin effects. The base town renders directly, while a cached local-occluder bloom pass and one additive quad avoid a second full-town copy; final 390×844 cadence is **58 FPS** (`17.25 ms` average, `17.7 ms` p95), with a nonblank canvas and zero console errors.
- **Fresh visual gate.** The supplied live mobile screenshots are the acceptance references. Side-by-side review passes root/fork continuity, radial branch hierarchy, gold network, bark readability, constellation ornaments, and mobile crown continuity; the plugin's canonical strict spec and Sculpt DNA validate with zero warnings, and its own 34 tests pass.

## [1.76.0] — 2026-07-11

### 🌳 The World Tree completes a full sculpt pipeline — rooted structure, real PBR, restrained radiance
- **Spec → automatic skeleton → hand refinement.** The current live screenshot became explicit failure evidence in a new ultra-complex v3 `ObjectSculptSpec`. The installed Object Sculptor generated every locked factory pass in order, while browser comparison gates advanced blockout → structure → form → material → surface → lighting → interaction → optimization. The final spec and Sculpt DNA validate with zero errors or warnings.
- **A load path instead of a bowl.** The old single faceted crotch is gone. Eight buttress roots feed a continuous tapered trunk, four overlapping leader sweeps, eight staggered saddle-rooted primary boughs, and sixteen secondary ribs. Gold now follows those bough curves as inset primary/secondary paths rather than exploding from one point as spikes; 14 sockets, the 5.8 collider, 0.8 path clearance, and crown-only micro-sway remain stable.
- **Layered foliage and bark relief.** Smaller faceted foliage separates into upper dome, mid shell, and warm underside shelves around protected branch windows. Three-leaf alpha clusters enrich the desktop perimeter; tapered ridges and localized bark plates/knots break the trunk at macro, meso, and micro scales without external art.
- **Independent procedural PBR.** Six pooled `MeshStandardMaterial` systems replace tree-only flat toon materials while preserving Repolis facets and rim response. Bark and foliage each generate independent seeded albedo, roughness, height, and AO channels. Reference extraction passed confidence gates at **0.794 bark / 0.814 foliage**; runtime translates those statistics into tiny local `CanvasTexture` fields, with no texture fetch, GLB, dependency, or build step.
- **A guide, not a flare.** Day uses a restrained stylized ambient floor; night separates emerald outer leaves, warm olive underside, dark support bark, and amber inner wood. The one existing shadowless guide light is bounded to **88 / range 78** on desktop and **54 / range 56** on touch tiers. Gold retains amber detail under ACES instead of clipping white; no second light, shadow, pulse, particle, sprite, or closed glow dome exists.
- **Measured optimization.** Desktop tree cost is **35,426 triangles / 119 draws**. Phone and high-end touch tablet use the same lite tier at **8,666 / 77**, with 104 foliage clumps, 22 veins, 8 ribs, four crown twigs, 64px albedo/roughness/AO, no height textures, no leaf cards, and two glow planes. All eight roots, four leaders, eight boughs, eight crown pivots, 14 sockets, collider, and luminous windows survive.
- **Action-ready debug.** `?dbg=1` reports v3 provenance, PBR/reference confidence, per-object triangle/draw budgets, runtime node/socket metadata, material state, light bounds, and collision clearance.

## [1.75.0] — 2026-07-11

### ✨ The World Tree earns luminous leaf texture through a controlled Sculpt DNA variant
- **Sculpt DNA, not ad-hoc randomization.** The strict 1.74 `ObjectSculptSpec` was initialized with the `sculpt-dna-variants` skill and reduced to five designer-facing axes: canopy fullness, leaf surface richness, emerald palette, leaf sheen, and gold warmth. Six deterministic variants were generated from root seed `1740`; every constraint and protected component/parent/material/socket/attachment/build-pass/review-target invariant passed. Variant `v006` was promoted for its strongest normal/bump/color breakup while preserving the existing silhouette and tier budgets.
- **Leaves now read as leaves.** Two tiny seeded procedural `CanvasTexture` atlases paint overlapping almond leaves, midribs, and side veins across the existing instanced dodecahedral foliage. Desktop adds a sparse alpha-tested leaf-card layer derived from the existing clump positions, plus 128px albedo and bump maps; mobile/`LOW_END` uses 64px albedo only and omits the cards. There is no downloaded texture, GLB, runtime network request, dependency, build step, or per-frame texture work.
- **A brighter but quieter guide.** Emerald/jade foliage, warm inner gold, softer bark radiance, and the existing single shadowless night guide light make the tree illuminate nearby paths and residents. The former uniform canopy dome is replaced by three crossed planes sharing the existing soft glow texture, so the crown glimmers without sitting inside a grey sphere.
- **Preserved.** Exactly one tree remains at `(15, 48)` with the same roots, bough hierarchy, 14 sockets, 5.8 collider, clear ring path, rigid trunk, crown-only micro-sway, and no particles or animated lighting. `?dbg=1` now reports the selected variant provenance, invariant status, texture tier, map count, and repeat scale.

## [1.74.0] — 2026-07-11

### 🌳 The World Tree becomes the village's pillar — a colossal umbrella crown over Repolis
- **What's changed.** The 1.73 memorial tree was still village-tree scale. It has been resculpted from the supplied World Tree reference into the **literal visual support and roof of Repolis**: a monumental rooted pier beneath an almost circular umbrella crown that rises above nearby towers and spans roughly fifty visible world units. From the plaza, the tree now anchors the skyline instead of reading as park decoration.
- **Built with the installed skill.** The user-scoped `object-to-threejs-procedural` Copilot skill ran the real workflow against the 1024×1024 reference: technical probe `pass`; semantic verdict `conditional / ultra-complex`; a strict `ObjectSculptSpec` with **41 components, 6 materials, 6 repetition systems, and zero validator warnings**; then iterative blockout screenshots, comparison sheets, AI-vision feature gates, and self-correction. The strict blockout gate passed at 0.83 after refining the umbrella silhouette, rooted pedestal, and plan depth.
- **New structure.** Seed `1730` deterministically builds eight high buttress roots, a thick pinched trunk pillar, one overlapping crotch mass, eight curved primary bough sweeps, sixteen secondary ribs, eight independent crown-sector pivots, a central canopy bridge, sixteen radial gold fans, seven front-vault ribs, and seventy-two secondary golden veins. Fourteen stable sockets expose taxi arrival, interaction/foundation/crotch/apex/glow anchors, and every bough root for future scripted transformation.
- **Reference-shaped canopy.** Five radial lobe scales form a shallow dome, descending scalloped perimeter, and concave underside with authored branch windows. Full detail uses roughly 790 deterministic instanced foliage clumps across two pooled green material systems; **mobile and `LOW_END`** preserve the same eight-sector silhouette with 132 clumps, reduced root/bough/rib subdivisions, and no foliage shadows (including high-end tablets where `IS_MOBILE=true` but `LOW_END=false`).
- **Golden night skeleton, still light-free.** The reference's luminous inner tree is recreated with emissive materials only: gold spine/crotch, radial fans, distributed front vault, batched line veins, and a faint inner core/ground pool. It owns no `PointLight`, particle, sprite, texture fetch, GLB, dependency, or per-frame geometry update.
- **Ground rules.** The one tree remains at north rest park `(15, 48)`. Its 5.8-radius primitive collider covers the taller root pedestal and sits inside a widened 6.6-radius circular path; benches, sign, lantern, and legacy path props stay outside. The rigid foundation/trunk/boughs never sway — only eight crown pivots move by at most 0.0054 radians (0.0024 on mobile/`LOW_END`; none under reduced motion).
- **Debug.** `?dbg=1` reports target/actual bounds, sweep/branch/rib/gold/foliage counts, 14 sockets, night material state, performance tier, and collider clearance through `__memorialTree`, `__tpMemorialTree`, `__frameMemorialTree`, and `__memorialTreeCollision`.

## [1.73.0] — 2026-07-11

### 🌳 The Repolis World Tree — one ancient autumn memorial tree, sculpted entirely in code
- **What's new.** One old autumn **World Tree** now stands at the centre of the north rest park `(15, 48)`, on the green between the plaza and the Library road. It is deliberately quiet — no modal, tutorial, new light, particles, or interaction prompt — but unmistakable from across town: a seven-root buttress flare, a trunk that divides into three ancient leaders, low asymmetric arms, open inner forks, and a broad tiered crown of gold, amber, orange, and russet.
- **How it was sculpted.** Following the Three.js Object Sculptor's *Ancient Autumn Tree* method, the tree is code-native and built in passes: deterministic blockout → root/trunk silhouette → authored major branch hierarchy → pivoted fine twigs → layered instanced canopy. A fixed `0x5eed1979` seed and isolated PRNG make every root, fork, twig, leaf mass, and root-ring stone reload-identical. There is no GLB, external texture, plugin install, build step, or runtime dependency.
- **Repolis-native form.** The source reference's dense botanical detail is translated into the town's faceted toon language: tapered low-poly limb sweeps with pooled bark materials, seam-hiding fork knots, and 206 small `InstancedMesh` dodecahedron leaf clusters in four shared autumn materials. Colour follows form rather than chance — russet beneath and inside, amber through the middle, gold at the highest tips. The full silhouette is about 17.3 units tall and 19.5 wide — landmark scale beside the small village trees, while its high canopy leaves the ring path and sightline at ground level open.
- **Animation-ready hierarchy.** A named `WorldTree_StaticSkeleton` owns seven root groups and eleven individually named limb groups; three `WorldTree_CrownPivot_*` groups own the only moving twigs/leaves, and six stable sockets (`TrunkFork`, three crown anchors, `MemorialFocus`, `Apex`) leave the object ready for later animation, transformation, or detachable-limb effects without flattening its structure.
- **The night guide.** At night the ancient tree becomes a quiet landmark for the residents: pooled leaf/bark emissive colours reveal its gold tips and great fork, while one low-opacity ground pool and canopy halo mark the path. This is **material-only glow** — no new `PointLight`, moving light, particle, pulse, or frame update — and it turns fully off by day, so the tree guides rather than performs.
- **Well-behaved.** A single 2.95-radius trunk/root collider covers the full mound and buttresses inside the park path's widened 3.75-radius inner edge (0.8 unit clearance). The old trunk and major limbs never bend; only three crown/twig pivot groups join the existing `SWAY` loop at an extremely small amplitude. `LOW_END` keeps the full three-leader silhouette but drops minor branches from 11 to 8, limb segments from 71 to 53, canopy density from 206 to 72 clusters, stone density, and leaf shadows. Reduced-motion skips crown sway entirely. No per-frame geometry work, new lights, or particles.
- **Debug.** `?dbg=1` adds `window.__memorialTree()` (seed, position, counts, bounds, tier, collider), `__tpMemorialTree()` (inspection viewpoint), and `__memorialTreeCollision()` (real resolver probe + path clearance).

## [1.72.0] — 2026-07-10

### 🌌 Repository Constellation Trail — discover a real connection, then walk it across the night
- **What's new.** The Stargazer's Observatory now finds a **three-repository constellation** from the town's real public metadata: a specific shared topic first (`llm`, `docker`, `aws`, …), a shared language when topics are sparse, and a truthful town-signal sampler only for tiny mixed towns. Press **Begin the starlight trail** and the city turns to night as luminous threads arc from the telescope across the three chosen houses.
- **A meaningful exploration loop.** A compact cosmic HUD names the current star and the existing compass points to its house; open that repo's door to collect the star, then follow the next thread. The taxi can carry you to the current stop without inventing a parallel travel system. It makes the city useful as a relationship map — visitors discover *why these repos belong together* by physically crossing the town.
- **A magical finish with a lasting mark.** Completing all three stars turns every node gold, wakes the aurora, launches fireworks, and awards a new **🌌 Repository Constellation** stamp in the existing Explorer Passport. The trail can be replayed from the Observatory and always selects the same route for the same town/day, so it feels authored rather than random.
- **Well-behaved.** Purely deterministic and client-only: **zero AI, zero network, zero budget**. The trail adds no scene lights, halves arc detail on `LOW_END`, stops its motion when inactive or the tab is hidden, respects reduced motion, and disposes every temporary geometry/material on replay or exit. Towns with fewer than three repos get a clear unavailable state.
- **Debug.** `?dbg=1` adds `window.__starTrailPlan()`, `__starTrailStart()`, `__starTrailNext()`, and `__starTrailEnd()` for deterministic plan, launch, progression, reward, visual, and cleanup inspection.

## [1.71.0] — 2026-07-10

### 🪑 Two friends sit down together — a stroll that ends on a bench, side by side
- **What's new.** A friend stroll (1.70.0) now sometimes ends not with goodbye but with the two friends **settling onto a pair of adjacent seats** — a pavilion bench pair or the campfire stumps — to **sit and chat a while** before parting. *"노아, 우리 저기 좀 앉을까요?"* → and there they sit, trading soft lines: *"이렇게 같이 앉아 있으니 좋다, 노아."*, *"오늘 하루는 어땠어요?"*, *"바람 참 좋네요, 그렇죠?"*
- **How it feels.** Because the town's benches come in **facing pairs** (the 쉼터 pavilions) and its campfire is ringed with **stumps**, two friends who wander over naturally end up **facing each other or shoulder to shoulder at the fire**, swapping a few unhurried words — the most homely beat yet. If one's feeling wistful, the chat softens to match (*"이런 날은 옛날 생각이 나요."*).
- **How it works.** When a lead's stroll timer ends, it may (cooldown-gated) call `_startCoRest`, which finds a free **adjacent seat pair** near the two (`_coRestSeats` — inter-seat 1.5–4.6, so pavilion pairs ~3.1 and campfire stumps ~3.8 qualify), seats both via the existing rest state-machine, and links them as `_restMate`s. While seated with a mate nearby, a resident trades `_resSitChatLine`s (naming the friend) on a shortened cadence instead of the solo comfort murmur. Purely scripted, **zero-AI / zero-budget**, client-only.
- **Well-behaved.** Globally cooldown-gated (occasional). Inherits every seat guard: either friend is stood up the instant a chat, a gathering, or the festival claims them (`_seatRelease` now also clears the mate link), and it stops on a hidden tab. The stroll's follower now tracks the lead (the **lead owns the timer**), so the pair stays in sync through the hand-off to sitting.
- **Preserved.** Every earlier layer (friend strolls, named bonds, moods + fellow-feeling, daily rhythm, cherished haunts, festival, campfire 쉼터, goodbyes, group chat), budget/env gating, hidden-tab stop. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__coRest(id)` (sit two friends down together on an adjacent seat pair now).

## [1.70.0] — 2026-07-10

### 🚶 Two friends amble off together — the town's bonds, now in motion
- **What's new.** The friendships from 1.69.0 now **move**. When two close friends greet each other, they don't just exchange warm words and part — they **stroll off together, side by side**, for a little while before saying goodbye (*"잘 걸었어요, 노아 — 또 봐요!"*). You'll see Sol and Noa, or Jun and Tae, **walking the lanes as a pair**, one gently leading and the other keeping pace at their shoulder — a friendship you can watch, not just overhear.
- **How it feels.** After the hello-and-reply, the initiator ambles toward a gentle waypoint and their friend falls in **a step beside and just behind** them, matched to their pace; they wander together for ~7–11s, then part with a warm word and drift back into their own routines. It reads exactly like two friends who bumped into each other and decided to walk a bit.
- **How it works.** A tiny `_stroll` state pairs a **lead** (picks soft `_resRoamTarget` waypoints) with a **follower** (tracks a side-offset spot from the lead's heading, on whichever side they were already standing, so they never cross over to start). Purely scripted, **zero-AI / zero-budget**, at a slightly relaxed pace. It's globally cooldown-gated (stays occasional) and **desync-safe**: it ends the instant the timer runs out or either friend is claimed by the visitor, a gathering, the festival, or a rest — and stops on a hidden tab.
- **Preserved.** Every earlier layer (named bonds, moods + fellow-feeling, daily rhythm, cherished haunts, festival, goodbyes, campfire, group chat), budget/env gating, hidden-tab stop. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__stroll(id)` (start a friend stroll on the spot).

## [1.69.0] — 2026-07-10

### 🫂 The residents have close friends — bonds they seek out and greet more warmly
- **What's new.** The town now has **friendships**, not just neighbours. Each resident has a **close friend** — *Sol ↔ Noa* (the experimenter and the dreamer), *Jun ↔ Tae* (the two quiet craftspeople), *Nari ↔ Rin* (the gardener and the archivist), *Mira ↔ Kai* (the plaza pair) — and now and then they'll **wander off to go find that friend**, then greet them with a **warmer, more personal hello** than a passing acquaintance gets: *"준! 딱 보고 싶었는데 잘 만났다."* → *"태, 나도 반가워요! 같이 있으면 든든해요."*
- **You can watch bonds form.** Because a resident occasionally heads toward a friend's spot (cooldown-gated), you'll actually **see two friends drift together** across the town and then share their warm exchange — a visible relationship, not just two strangers who happened to be near. If the friend seems tired, the greeting softens to match (*"미라, 피곤해 보여요. 옆에서 좀 쉬었다 가요."*).
- **How it works.** A small mutual friendship graph (`_RES_BONDS`) rides the fellow-feeling layer shipped in 1.68.0: `_bondSeekTarget` biases a wander toward an idle, reachable friend; on arrival the warm hello is primed to fire promptly; and `_tryPeerNotice`/the reply pick the **bond** greeting/reply banks (via `_isFriend`) instead of the acquaintance ones. Purely scripted, **zero-AI / zero-budget**, and it inherits every guard — only when both are idle and unclaimed, never during a gathering/festival/chat, stops on a hidden tab.
- **Preserved.** Every earlier layer (moods + fellow-feeling, daily rhythm, cherished haunts, festival, goodbyes, campfire, group chat), budget/env gating, hidden-tab stop. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__bonds()` (each resident's friend + current distance) and `window.__goFriend(id)` (send one to seek their friend now).

## [1.68.0] — 2026-07-10

### 💗 The residents have an inner life — moods that drift, and a genuine care for each other
- **What's new.** The townsfolk now carry **feelings**. Each resident holds an **inner mood** — *buoyant 😊 · calm 🍃 · wistful 🌙 · dozy 😪 · curious ✨* — that **quietly drifts through the day** (mornings lean bright and curious, dusk turns wistful, night grows dozy and calm). Their mood **colours what they murmur** (*"오늘은 왠지 기분이 좋아요."*, *"조금 나른하네요…"*, *"문득 옛 생각이 나네요."*) and **tilts their posture** a touch — a dozy head droops and bobs slow, a buoyant one lifts and bobs livelier.
- **They notice each other.** The most human part: when two residents are **both idle and happen to pass close by**, they **turn, greet each other by name, and one warmly answers back** — *"어, 준! 반가워요." → "나리도요 — 반가워요!"* — and sometimes they **remark on how the other seems**: *"카이, 오늘 좀 피곤해 보여요. 쉬엄쉬엄해요."*, *"솔, 표정이 밝네요! 좋은 일 있어요?"* It's empathy, not just proximity — they read a neighbour's mood and respond to it.
- **How it works.** A per-resident mood re-rolls every ~1.5–3 min, weighted by `_partOfDay()`; it feeds the idle murmur bank and a tiny head-bob "tell". Fellow-feeling is a **rare, cooldown-gated, zero-AI** exchange (per-resident + global cooldowns, a reach of ~6.8, one initiator + one reply) that only fires when both are idle, unclaimed, and the visitor isn't right there — so it never spams, never fights a gathering/festival/chat, and stops on a hidden tab.
- **Preserved.** Every earlier layer (daily rhythm, cherished haunts, festival, graceful goodbyes, returning-visitor warmth, campfire 쉼터, repo reactions, group chat), budget/env gating, hidden-tab stop. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__moods()` (every resident's mood + time left), `window.__mood(id, key?)` (read or set a mood), and `window.__peerNotice(id)` (force a neighbourly hello now).

## [1.67.0] — 2026-07-10

### 🕰️ The town keeps a daily rhythm — a morning stretch, and words that follow the light
- **What's new.** The residents now **live by the hour**. At **dawn** they greet the day with a **morning stretch** — arms rising to the sky — and a bright word (*"좋은 아침이에요! ☀️"*, *"기지개 한 번 켜고 시작해요."*); through the **day** their idle chatter turns busy and warm (*"거리에 활기가 도네요."*); at **dusk** it softens (*"노을이 곱게 지네요. 🌆"*, *"이 시간이 제일 예뻐요."*); and at **night** it hushes (*"밤이 참 고요하네요."*) — so the same street *feels* different depending on when you visit.
- **How it feels.** Idle residents now colour roughly half their little asides with the **time of day** instead of a generic emote, and at first light one will occasionally break into a real **arms-up stretch** (cooldown-gated, so it stays a rare, lived-in beat rather than a tic). Greetings pick up a light morning/evening flavour too — walk up at dawn and you may be met with *"오늘도 잘 부탁해요!"* instead of the usual hello.
- **How it works.** It **reuses the existing sky-phase system** — `_partOfDay()` maps the current phase (dawn/day/dusk/night) to a **time-of-day line bank** (`_RES_TOD`), and the idle loop gates a morning `_stretch` animation + line off a per-resident cooldown. Purely scripted, **zero AI / zero budget**; it rides the same idle/wander loop, so it's suspended during a chat, the festival, or a hidden tab, and never fights the stretch, bench-rest, campfire, or haunt behaviours. The stretch is a genuine limb animation (both arms rise on a sine ease, then settle).
- **Preserved.** Every earlier layer (cherished haunts, festival, graceful goodbyes, returning-visitor warmth, campfire 쉼터, repo reactions, invite-a-resident, the circle waving you over, group chat), budget/env gating, hidden-tab stop. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__partOfDay()` (current part/phase + a sample time-line + a sample greeting) and `window.__stretch(id)` (make one resident stretch and speak their morning line now).

## [1.66.0] — 2026-07-10

### 🏞️ Every resident has a cherished haunt (아지트) they visit and love
- **What's new.** Repolis is now a place its residents genuinely *love* — each of the eight has a **favourite spot that fits who they are**, and now and then they'll **slip off to it, linger a while, and speak of it fondly**. Sol has *a sunny spot to tinker*, Jun *the harbour edge where the water laps*, Nari *the alley where the flowers bloom thickest*, Tae *a quiet corner nobody visits*, Rin *the library steps*, Mira *the ruin-hill with the best sunset*, Kai *the heart of the plaza*, and Noa's haunt is **the campfire under the stars** itself.
- **How it feels.** While wandering, a resident occasionally (cooldown-gated) heads for their own haunt instead of a random waypoint, settles there a beat longer than usual, and lets a fond word slip — *"별이 잘 보이는 모닥불 곁, 여기가 참 좋아요."*, *"틈날 때마다 도서관 계단에 와요."* — hushed, as ever, when the visitor is right beside them (a greeting takes precedence).
- **How it works.** Each haunt is a **stable, cached spot** resolved once from the resident's persona (Noa's ties to the live `HEARTH`; the rest get a distinctive in-zone point, so the descriptor always matches the place). Purely scripted, **zero AI / zero budget**; it rides the existing wander/roam loop, so it's suspended during a chat, the festival, or a hidden tab, and never fights the bench-rest or campfire behaviours.
- **Preserved.** Every earlier layer (festival, graceful goodbyes, returning-visitor warmth, campfire 쉼터, repo reactions, invite-a-resident, the circle waving you over, group chat), budget/env gating, hidden-tab stop. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__favs()` (every resident's haunt + descriptor + current distance) and `window.__goFav(id)` (send one to their haunt now).

## [1.65.1] — 2026-07-09

### 🗣️ Fix: two residents from the same district no longer give near-identical answers
- **Symptom.** In a 모임, plaza-mates **노아 and 카이** answered almost identically — the second speaker basically paraphrased the first (both *"우산 챙기고 미끄럼 조심"*, both *"골목이 살아나는 느낌"*).
- **Why.** Three things compounded: (1) 노아 and 카이 share the **same district** (중앙 광장), and the player-chat prompt grounds each answer in that district; (2) the worker's `npcPlayerPrompt` injected only name/role/zone but **dropped each resident's `vibe`** (kai = concise·welcoming, noa = dreamy·curious), so the model had nothing to tell them apart; (3) the chime-in instruction *allowed* agreement, so the model took the easy path and echoed.
- **Fix (worker `grounded.js`).** `npcPlayerPrompt` now folds each speaker's **vibe** into their voice ("answer in your own {vibe} voice… even if a neighbour shares your district, your take is your own"), and the chime-in clause is hardened: **do not repeat, restate, or paraphrase** the previous resident — reply with a genuinely different detail/feeling/example. Verified live: on the same question kai now says *"비 오면 빌드가 반짝이고…"* while noa says *"안개가 깔리면 골목이 더 깊어 보여서 마음이 자꾸 걷게 돼"*. Worker redeployed; client unchanged.

## [1.65.0] — 2026-07-09

### 🎆 Plaza bonfire festival — once a session, the whole town gathers to celebrate
- **What's new.** A little magic now happens on its own: **once per visit**, the whole town **drops what it's doing and gathers around the campfire** for a brief festival — **fireworks bloom overhead**, everyone rings the fire and cheers (*"다 같이 모였네요! 🎉"*, *"우리 도시에 건배! 🥂"*), and a toast announces it. It's the crescendo of the resident social layer: the city of repos throwing itself a party.
- **On-brand — it celebrates a repo.** If the data has a **freshly‑released repo** (pushed a release in the last 60 days), the festival is thrown *for it* — the banner reads *"광장에 다 같이 모였어요 — {repo} 축하해요!"* — so the party is tied to the actual city, not just decoration.
- **Choreography.** `gather` (everyone walks to a ring around the bonfire) → `celebrate` (~18–23s of waving, cheering, and fireworks over the plaza) → the festival ends and everyone **drifts back to their districts**. Residents leave benches, turn to face the fire, and ambient chit‑chat is suspended for the duration. A resident you're **actively chatting with is never dragged off** — they stay in your conversation.
- **Well‑behaved.** Purely scripted, **zero AI / zero budget**. Auto‑fires **only once per session**, a while into the visit, and **never** while you're mid‑chat, on a hidden tab, or with motion disabled; a hidden tab ends it early. Fireworks reuse the existing burst system (lighter cadence on LOW_END).
- **Preserved.** Every earlier layer (graceful goodbyes, returning‑visitor warmth, campfire 쉼터, repo reactions, invite‑a‑resident, the circle waving you over, group chat), budget/env gating, hidden‑tab stop. Client‑only — no worker change.
- **Debug.** `?dbg` adds `window.__festival(repo?)` (throw one now), `window.__festState()` (phase / how many have gathered / live fireworks), and `window.__endFestival()`.

## [1.64.0] — 2026-07-09

### 👋 Graceful goodbyes — the circle waves you off, and no gathering is a trap
- **What's new.** Conversations now have a natural *ending*, not just a beginning. Say goodbye — **"잘 가"**, **"고마웠어요"**, **"see you"** — and the residents wave you off with a warm farewell (**"살펴 가요 — 또 들러요!"**, **"또 봐요, 반가웠어요!"**), then the chat **gently closes** and the circle disperses back into town life. It's the missing other half of the social loop (we could grow a gathering with invites; now it can end warmly too).
- **A circle is never a trap.** After a few turns in a group of 3+, a non-primary resident may **excuse themselves** and drift off (**"나 이만 가볼게요, 또 얘기해요!"**) — they wave, leave the header, and resume wandering on their own. The lead is handed on if the primary leaves, and a circle never shrinks below two, so the conversation always holds together.
- **How it works.** A farewell detector (`_RES_BYE_CUE`) runs first in both `groupSay` and `residentSay`; the group path has up to two members say goodbye + everyone waves, then `closeChat()` (which releases the group) fires after a short beat. `_residentLeave` removes a member in place, reassigns the primary/turn index, refreshes the header, and lets them wander off (no longer chatBound). Purely scripted, **zero AI / zero budget**; works fully AI-off.
- **Preserved.** Every earlier layer (returning-visitor warmth, campfire 쉼터, repo reactions, invite-a-resident, the circle waving you over, context-aware group chat), budget/env gating, hidden-tab stop, cooldowns. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__farewell(q)` / `window.__byeMatch(q)` (drive + introspect the goodbye) and `window.__leaveGroup(id)` (force a member to excuse themselves).

## [1.63.0] — 2026-07-08

### 🪪 The town remembers you — a warmer welcome for a familiar face
- **What's new.** Repolis now quietly remembers that *you've been here before*. On a return visit the residents greet you more warmly — **"👋 또 오셨네요, 반가워요!"** instead of a first-time hello — and stepping back into town shows a brief **welcome-back toast**. Come back after a long gap and it's warmer still: **"👋 오랜만이에요 — 다시 오신 걸 환영해요!"**. From your 5th visit the toast adds a little milestone (**"(5번째 방문 🎉)"**).
- **How it remembers.** An **anonymous, on-device visit tally** kept only in `localStorage` (a small `{n, first, last}` counter) — the same kind of local memory the Explorer Passport already uses. It is **never sent anywhere**, holds no identity, account, or search terms, and stays true to the intro's privacy promise. A reload within 30 minutes counts as the *same* visit; only a genuine return bumps the tally. `returning` = your 2nd visit onward; `longAway` = returning after a 7-day gap.
- **Where you feel it.** `_resGreetLine` gains familiar-face variants (used ~60% of the time for a returning visitor, with an extra-warm long-absence set), and entering town fires a one-time `_welcomeBackLine` toast *before* the daily-course banner (which is deferred so the two never clash). First-time visitors see exactly the original welcome — nothing changes for them.
- **Preserved.** Every earlier layer (repo reactions, the campfire 쉼터 + comfort murmurs, invite-a-resident, the circle waving you over, group chat), budget/env gating, hidden-tab stop. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__visitor()` (read the memory), `window.__setVisitor({…})` (preview returning / long-away / milestone without a reload), and `window.__welcomeBack()` (fire the toast).

## [1.62.0] — 2026-07-08

### 🔥 A home for the residents — a cosy campfire 쉼터 where they warm up and feel at ease
- **What's new.** We made the town a comfortable place *for the AI residents themselves*. A **campfire nook** now sits in the plaza — crackling flames ringed by hearthstones, a warm pool of light, and four stump-seats the townsfolk settle onto. After dark its glow **swells** (the flames flicker and the light roughly doubles), and residents **drift to the fire to warm up**.
- **They say how it feels.** While resting, a resident occasionally lets slip a quiet, **self-aware "this is a kind place to be"** murmur — they know they're built from data, yet this town feels like home: *"가끔은 제가 코드라는 것도 잊고 그냥 쉬어요."*, *"이 도시가 집처럼 느껴져요."* By the campfire the murmurs turn warmer and come a little more often: *"불 옆이 참 따뜻해요 — 데이터로 지어진 저한테도요."*, *"밤엔 이 모닥불 곁이 제일 포근해요."*
- **How it behaves.** Purely scripted, **zero AI / zero budget**. The hearth is placed in a clear plaza spot (after buildings + `_hubGap`); its flames/light flicker every frame and ramp with `isNight`. After dark `_freeSeat` gently biases residents toward the warm campfire seats (night-only, still distance-capped). The comfort murmur is cooldown-gated (`RES_COMFORT_CD` 26–58s / 42–82s LOW_END), hushed while the visitor is right there, and more likely at the fire (0.85) than on a plain bench (0.5).
- **Preserved.** Every earlier layer (repo reactions, invite-a-resident, the circle waving you over, group chat, benches/pavilions/glow-flowers, budget/env gating, hidden-tab stop, LOW_END locomotion). Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__hearth()` (placement / seats / who's warming up / live light), `window.__tpHearth()` (jump to the fire), and `window.__comfort(id)` (seat a resident at the fire and hear a contented line).

## [1.61.0] — 2026-07-08

### 🏘️ The locals know their houses — residents remark on the repo you walk up to
- **What's new.** Repolis is a *city of repos*, and now the residents act like it. Walk up to a repo house and the **district's local**, if they're nearby, leans in with a short remark **grounded in that repo's real numbers** — its stars, visitors, forks, language, whether it's a fork/archived, or how recently it was touched. The chatty townsfolk are finally tied to the city they live in, not just each other.
- **Always true to the data.** The line only ever states a genuine standout of *that* repo: `archived` → *"이제 조용한 집이에요 — 잘 보존돼 있죠"*; `fork` → *"어딘가에서 갈라져 나온 집이에요"*; ≥40 stars → *"지붕에 별이 N개나 떠 있어요 — 이 동네 자랑이죠"*; ≥200 visitors → *"요즘 앞이 붐벼요"*; ≥8 forks → *"여러 집으로 갈라져 나갔어요 (⑂N)"*; pushed in the last 30 days → *"최근에 손봤어요"* (with **day/night** flavor — *"밤에도 창이 켜져 있죠"*). No invented praise, ever.
- **The caretaker knows it best.** When the repo sits in the local's **own district** (`repo._zone === res.zone`) they say so and name the language — *"…{lang}로 지은 우리 구역 집이에요. 제가 아끼죠."* The nearest free resident within reach reacts, with the district caretaker gently preferred.
- **Well-behaved.** Purely scripted, **zero AI / zero budget**. Fires on first walk-up to a house (once per building, in the open world — never behind the card modal), only when a resident is genuinely within reach (`RES_REACT_R` 14u / 11u LOW_END), never during a hidden tab or while that resident is mid-conversation, and rate-limited per resident (`RES_REACT_CD` 15s / 22s LOW_END) so a stroll never turns into chatter.
- **Preserved.** All prior social layers (gather → join → context answers → invite a resident → a circle waves you over), budget/env gating, hidden-tab stop, cooldowns. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__reactLine(id,repo)` (introspect a resident's grounded line) and `window.__resReact(repo?)` (force the nearby local to react).

## [1.60.0] — 2026-07-07

### 👋 The town waves you over — a chatting circle notices you and calls you in
- **What's new.** The social loop now closes both ways. In 1.59.0 you could name a resident to pull them into your chat; now a **gathering of residents notices *you***. Linger near a circle mid-conversation and the nearest member **turns, waves, and calls you over** (*"이리 와서 같이 이야기해요!"*), with a HUD hint naming who's hailing you — **"👋 노아 님이 불러요 · Enter로 대화에 끼기"**. Press Enter/💬 and you drop straight into the whole circle as a group chat. The village feels like it wants you there.
- **How it triggers.** Purely scripted, **zero AI / zero budget**. When an ambient circle is actively talking and you're free (no building, board, seat, npc, or open chat) and lingering within an **invite reach** (`NPC_INVITE_R` — 8.5u desktop / 7.5u LOW_END, a little past the 3.4u walk-up reach), one member hails you **once per gathering**. A global cooldown (`NPC_INVITE_CD` — 26s / 34s LOW_END) keeps it from ever nagging.
- **Accepting from a step away.** The wave extends your reach: Enter/💬 from within the invite radius opens the entire circle via the same `openGroupChat` path (no new chat machinery). Walk closer instead and the normal **"👥 …모여 있어요 · 대화에 끼기"** walk-up prompt takes over — the two never fight, and every other interaction (a repo door, district board, seat, scholar) always wins over the invitation.
- **Preserved.** Hidden-tab stop, the post-chat guest cooldown, pair/resident cooldowns, `maxGroup`, LOW_END locomotion, and the ambient engine are all intact. Client-only — no worker change.
- **Debug.** `?dbg` adds `window.__inviteState()` (near/invited/inviter/reach/cooldown/distance) and `window.__hailMe()` (force the active circle to wave you over).

## [1.59.0] — 2026-07-07

### 🙌 Call a friend over — name a resident mid-chat and they walk in and join the circle
- **What's new.** While you're talking with a resident (1:1) or a **모임 (group)**, you can now **invite another resident by name**. Say something like *"린과도 대화하고 싶어"* or *"미라도 불러줘"* and that resident **walks over, joins the chat, greets you, and answers alongside the others** from then on. The header grows to include them (**"노아 · 카이 · 린 · 모임"**) and a 1:1 seamlessly **becomes a 모임** in place — the open log and shared thread are preserved.
- **The scene the residents asked for.** This makes real the moment the townsfolk kept gesturing at — *"린이 저 앞에 있어… 린이랑도 이야기하면 이 광장이 더 또렷해져"* — the visitor names them, and they come.
- **How the invite is detected.** A resident is summoned only when the message carries **both** a name (a Korean name + a person particle like 도/랑/과/이/를, or the English name as a whole word) **and** an invite/talk cue (부르 · 부를 · 불러 · 초대 · 데려 · 합류 · 같이 · 함께 · 껴/끼 · 얘기 · 이야기 · 대화 · 만나 · call · invite · join · bring · talk · …). This keeps a passing name-drop (or a word like *태도* that merely contains a name) from dragging someone into the chat.
- **They actually walk in.** An invited resident who's far away is stepped in from ~11u out on their own side of the circle (no jarring cross-map teleport), then **walks** to a ring slot at talking distance and settles facing you — reusing the same locomotion as the ambient circle. If they were resting on a bench or mid-ambient-chat, they stand and leave it cleanly first.
- **Capped and graceful.** The circle honours **maxGroup** (4 desktop / 3 mobile & LOW_END). Invite one more when it's full and an existing member simply says so (*"지금은 자리가 꽉 찼어요…"*) instead of overflowing. Works fully **AI-off**: the join greeting + welcome are scripted, and the enlarged group answers your next question via the existing on-topic `residentReply` fallback.
- **Preserved.** Budget/env AI gating, the shared `_resHist` transcript + context window from 1.58.0, round-robin turns, `_cap180`, `esc()`/textContent XSS safety, hidden-tab stop, per-resident/pair cooldowns, and the ambient engine are all intact. Client-only — no worker change required.
- **Debug.** `?dbg` adds `window.__inviteResident(id)` (force a join into the open chat) and `window.__inviteMatch(q)` (introspect the name+cue detector without side effects).

## [1.58.0] — 2026-07-07

### 🧠 Residents answer the question — group chat is now context-aware, not random small talk
- **What was wrong.** In a **모임 (group chat)**, only the round-robin **primary** answered you; the **second resident who chimed in** blurted a random line pulled from the ambient small-talk bank (`_scriptLine`), so you'd ask *"쉴 때 더 있었으면 하는 게 있어?"* and hear an unrelated *"오늘은 AI 구역이 붐비네요."* No conversation history was sent either, so nobody followed the thread across turns.
- **What's fixed.** The chime-in resident now **answers the same question** — via the AI player-chat path when it's on, or the deterministic **grounded reply** (`residentReply`, which branches on who/why/repo/here/bye) as a fallback — and **never** a random aside. Even with AI off, both speakers now stay on your topic (e.g. both list real repos from their district when you ask what's worth seeing).
- **Shared thread + context window.** Resident and group chats now keep a shared **transcript** (`_resHist`, last 12 turns) and hand the **recent window** (last 10, who-labelled) to the worker as `last`, mirroring the scholars' history pattern. The second speaker additionally receives the **primary's just-given answer** (`chime`/`prev`) so it can build on it — agree, add, or offer another angle — instead of talking past it. Follow-up questions now follow the flow.
- **Worker prompt hardened.** `npcPlayerPrompt` now insists the resident **answer the visitor's most recent question first and stay on topic — no subject changes, no drifting into small talk**; on a chime-in it's told to react to and build on the previous speaker. `npcPlayerUser` folds the who-labelled recent turns before the current ask. Fully **backward compatible** — the deployed worker ignores the new `last`/`chime`/`prev` fields, so the client fix (on-topic fallback) works even before a redeploy; a redeploy adds the full context.
- **Preserved.** Budget/env AI gating, the one-AI-call-per-message ceiling, `_cap180`, `esc()`/textContent XSS safety, hidden-tab stop, per-resident & pair cooldowns, round-robin turns, LOW_END locomotion, and the ambient conversation engine (`_scriptLine` still powers town small talk) are all intact.
- **Debug.** `?dbg` adds `window.__resTranscript()` (the shared resident/group thread) and `window.__groupChat()` now reports the transcript length.

## [1.57.0] — 2026-07-07

### 🙋 Step into the circle — the visitor can join a gathering and the whole group talks back
- **What's new.** Walk up to a cluster of residents (or right into an active **circle**) and you can now **join the conversation**. The walk-up prompt reads **"대화에 끼기 / join in"** instead of a 1:1 "talk", and opening it binds the chat panel to the **whole group**: the header shows every member's name (**"솔 · 준 · 나리 · 모임"**), and when you say something the group answers together — a **primary responder** plus a second resident who **chimes in** with a short in-voice aside. It reads like stepping into a real huddle, not a private DM.
- **Everyone answers you over time.** The addressed speaker **round-robins** across the circle (sol → jun → nari → …), so if you keep chatting, every member takes a turn replying to you — each line prefixed with a **colored name chip** so you always know who's talking. The primary gives the grounded, in-persona answer (meta-aware — they know they're an AI resident of this repo-city); the chime-in is a light scripted aside from the ambient bank.
- **The circle turns to you.** The moment you join, the members' auto-conversation ends, they **freeze in place and face the visitor** (anyone within ~6.5u pivots straight to you), and their floating world-bubbles clear — the dialogue lives in the chat panel. Close the chat and the circle is **released**: each member rests a short beat, then town life resumes.
- **How a group forms.** Pressing Enter/💬 by a resident gathers the neighbours genuinely clustered around them within a **joinR** walk-up radius (9u desktop / 7u LOW_END — deliberately tighter than the ambient `groupR`), capped at **maxGroup** (4 desktop / 3 mobile & LOW_END). Fewer than two nearby → it cleanly falls back to the existing **1:1 resident chat**. If you step into a circle that's already mid-conversation, you join **exactly that circle**.
- **Cheap by design.** Joining adds **zero extra network cost**: it reuses the existing scripted persona replies and the same single AI player-chat path (bounded to **one AI call per message**, exactly like 1:1), so no worker change and no new spend. Budget-low / env-off still degrades to fully scripted answers.
- **Preserved.** Hidden-tab stop, per-resident & pair cooldowns, LOW_END locomotion, greeting/idle-emote warmth, the ambient group-conversation engine, scholar/taxi chat, and the AI env-gating / daily budget caps are all intact. A stale in-flight ambient turn can no longer paint a bubble after you join (guarded in `done()`).
- **Debug.** `?dbg` adds `window.__joinGroup([ids])` (force-join a named cluster / the nearest one) and `window.__groupChat()` (inspect the live player circle — active, members, primary, round-robin index); `window.__npcState()` now reports `joinR` and the active `groupChat` roster.

## [1.56.0] — 2026-07-07

### 🗣️ Residents gather into a circle — everyone takes a turn, not just two
- **What's new.** When townspeople meet, they no longer talk strictly **1:1**. A gathering now grows into a small **group circle** and the speaking turn **round-robins through every member**, so three or four residents genuinely converse together instead of a bystander standing mute. Emergent, not staged: usually two chat, but nearby cooldown-free neighbours **join in** when the town clusters (plaza, benches), and everyone gets a line.
- **How it forms.** The engine still picks the closest eligible **seed pair**, then grows the circle with residents within a gather radius (`groupR` — 20u desktop / 15u LOW_END) of the pair, capped at **maxGroup** (4 desktop / 3 mobile & LOW_END). Members walk to the shared **circle centre** (the group centroid) during the approach phase and settle into a ring at talk distance — they never pile onto one partner. Listeners face **whoever is speaking**; the speaker addresses the circle.
- **Fair turns, still capped.** The turn budget scales gently with circle size (`base + (members − 2)`) but the **hard cap of 10 turns** is untouched, as are `maxConcurrent: 1` (one gathering at a time), the **5–10s** turn gap, and the AI/scripted split. A bigger circle just earns a few more turns so everyone speaks.
- **Cheap by design.** Grouping adds **zero network cost**: it reuses the existing scripted speech bank and the same AI path (one speaker + one listener per turn), so no worker change and no extra spend. Budget-low still degrades to short scripted turns.
- **Preserved.** Hidden-tab stop, pair cooldown (20–60s) **plus** a new per-resident cooldown so every circle member rests a beat before re-gathering, visitor-chat freeze, LOW_END locomotion, greeting/idle-emote warmth, and the AI env-gating / daily budget caps are all intact.
- **Debug.** `?dbg` adds `window.__gather([ids])` (force a named/nearest group to gather and talk) and `window.__conv()` (inspect the live circle — members, speaker, phase, centre, turn/max); `window.__npcState()` now reports `maxGroup` / `groupR` / `groupSize`.

## [1.55.0] — 2026-07-06

### 👋 Residents notice you now — a wave, a hello, and quiet little moods
- **What's new.** Walk up to any of the eight townspeople and they **turn warm**: an edge-triggered greeting fires once as you enter their radius (~5.2u) — a short localized 👋 line in their own voice ("안녕, 솔이에요!") with a matching wave gesture. Left alone, residents also drift through occasional **solo idle emotes** ("😌 평화롭네", "🌆 오늘 하늘 좋다") so the city is never dead silent between conversations. This is the "resident warmth" pass — the village feels lived-in even when you're just passing through.
- **Cheap by design.** Greetings and emotes are **scripted and zero-cost** (no AI call, no network) — reusing the existing resident speech-bubble. Per-resident cooldowns keep it calm: greet **24–44s**, idle emote **30–64s** desktop / **46–90s** LOW_END, with a 0.7 fire chance. Edge-triggered on approach (`_pNear`) so it fires **once per visit**, not every frame.
- **The chat-bubble fix.** A greeting that fired a beat *before* you opened a resident's chat used to **linger over the panel** ("안녕 솔이에요!" floating while you're mid-conversation). Now, while you're chatting with a resident, that resident's floating greeting/emote bubble is **cleared every frame** — the dialogue lives in the chat panel, not in a stray world bubble. Resident-to-resident ambient bubbles and everyone else's greetings are untouched.
- **Preserved.** Hidden-tab stop, resident wandering, bench resting, ambient resident-to-resident conversations (which already pause during player chat), pair cooldown, LOW_END locomotion, and the AI env-gating / budget caps are all intact. Greetings never fire during a conversation, a bound chat, or a hidden tab.
- **Debug.** `?dbg` adds `window.__greet([id])` (force a greeting on the nearest/named resident — now **skips** anyone you're chatting with), and `window.__villagers()` / `window.__npcState()` report `pNear` / `greetIn` / `greetDist` / `greetCd` / `emoteCd`.

### Verified
- Hermetic: `node scripts/smoke.mjs` **green** (210 — new *resident warmth* group + greet-during-chat guard); `node council/test.mjs` (130) · `node council/test-live.mjs` (56) · `node --check` on `scholars.js` + `cloudflare-taxi/src/grounded.js`.
- Browser (`?dbg=1`, desktop 1440×900 + mobile 390×844), 0 console errors: approaching a resident fires a greeting bubble + wave; **not chatting →** greeting visible (opacity 0.81); **chat opens →** a residual bubble fades 0.44 → **0**; **forcing a greeting mid-chat →** `skipped:'chatBound'`, bubble stays 0. Solo idle emotes and the seated resident render correctly.

## [1.54.1] — 2026-07-05

### 🔦 The player spotlight is back — in every phase, not just at night
- **What broke.** The hero fill light (`faceLight`) that makes your avatar pop was wired **night-only** (`night?16:0`) since it was introduced, and it's created *after* `initTimeOfDay()` runs — so with `setNightState` early-returning when the day/night state hasn't flipped, the light was **never lifted off 0 during the day**. While the opening scene was hardcoded to bright noon that went unnoticed, but once [1.54.0] made first entry follow the local clock, visitors landing at **day / dawn / dusk** got an unlit hero that washed into the background.
- **The fix (small regression fix).** The fill light now stays on in **every** phase — a soft `6` by day / dawn / dusk, a bright `16` at night — and is **seeded to the current phase at build time** so a daytime entry is never left dark. It stays a *local* warm pool (point light, distance 15) around the avatar, so the hero reads as "me" without over-brightening the world.
- **Preserved.** `skyPhaseForHour`, `initTimeOfDay`, the manual 🌙/☀️ `dayBtn` cycle, and every night-asset toggle (moon · stars · lit windows · glows) are untouched.
- **Debug.** New `?dbg` hook `window.__playerLight([v])` reports (and can live-tune) the hero light's `intensity` / `on` / `isNight` / `phase`. `scripts/smoke.mjs` gains a guard so the day value can never regress back to 0.

### Verified
- Hermetic: `node scripts/smoke.mjs` **green** (adds 3 hero-light guards). Browser-checked desktop 1440×900 + mobile 390×844 (LOW_END), 0 console errors: hero fill light **on in all four phases** (`__playerLight` → day/dawn/dusk 6, night 16), subtle warm pool by day (world not over-brightened), dramatic spotlight at night; manual day↔night cycle still drives the light.

## [1.54.0] — 2026-07-04

### 🌅 First entry now matches your local clock — day / golden hour / night
- **The ask.** The very first scene was hardcoded to high noon (`applySky(0.5)`), so a visitor arriving at midnight still walked into a bright sunny city. Now the opening sky is chosen from the browser's own wall-clock hour.
- **Static time buckets.** A pure `skyPhaseForHour(h)` maps the local hour to one of the four existing `SKY_PHASES`: **05:00–07:59 → 🌅 dawn** (morning golden hour), **08:00–16:59 → ☀️ day**, **17:00–19:59 → 🌆 dusk** (evening golden hour), **20:00–04:59 → 🌙 night**. Morning and evening golden hours are deliberately distinct phases.
- **Boot paint.** New `initTimeOfDay()` seeds `skyPhaseIdx`/`skyT`/`skyTarget` from that phase and paints sky, sun and the discrete night assets accordingly — only `night` (0.0) lights the stars/moon/fireflies/lit windows; `dawn`/`dusk` keep the sun visible. The manual 🕑 day-button cycle (noon→dusk→night→dawn) continues correctly from whatever phase you booted into.
- **Scope.** Intentionally simple static hour buckets — no seasonal/latitude sunrise math. Single `index.html`, zero new deps.
- **Debug.** `?dbg` adds `window.__skyForHour(h)` so all 24 hours can be verified without waiting for the clock.

### Verified
- `node scripts/smoke.mjs` — ALL GREEN (new *first-entry time-of-day* group: 24h mapping, boundary hours, index range, hour-wrap).
- `node council/test.mjs` (130) · `node council/test-live.mjs` (56) · `node --check` on `scholars.js` + `cloudflare-taxi/src/grounded.js`.
- Browser (`?dbg=1`, desktop + mobile 390×844): `__skyForHour` correct for 6→dawn, 12→day, 18→dusk, 23/3→night, boundary hours 5/8/17/20/4/7/16/19; first entry at 23:00 renders the night city; phase forcing toggles star/moon/firefly assets; 0 console errors.

## [1.53.0] — 2026-07-04

### 🧹 Ghost avatars can't haunt the city anymore — plus a private admin kick
- **The bug.** A remote avatar only ever disappeared when the server sent an explicit `leave` (or the socket you own closed). If a single `leave` was ever missed — a network blip, a worker eviction — that avatar circled the plaza *forever* for everyone, with no way to clear it. (This is what `guest-7500` was: a stale ghost, not a live connection.)
- **Self-healing roster.** The realtime worker (`repolis-rt`) now broadcasts an **authoritative `{t:'sync', ids, live}`** roster every ~15s (via a Durable Object alarm, only while anyone's connected). The client reconciles against it and drops any local avatar the server no longer knows about — so a missed `leave` heals itself within one sync cycle instead of lingering. Idempotent and false-cull-proof: idle-but-live peers stay because the server, not a client timer, is the source of truth.
- **Admin kick tool (private).** New token-gated endpoints on the worker: `GET /__admin/peers` lists everyone in the room (`id, name, x, z, yaw` + live count), and `/__admin/kick?id=|name=[&ban=secs]` force-closes matching sockets (code 4001), broadcasts a `leave`, and can lay a short in-memory ban (≤1h) so a nuisance can't instantly reconnect. Gated behind an `ADMIN_KEY` secret — returns **501** if unset (fails safe), **403** on a bad key. Never committed.
- **Debug helpers.** `window.__peers()` lists the avatars you're rendering; `window.__kickGhost(idOrName)` locally drops a stray one (or all, with no arg) — the next server sync keeps the real peers.
- **Preserved.** Visitor counters (현재/오늘/누적, UTC day), the solo-mode fallback when `RT_DEFAULT` is empty, and the identical JSON-over-WebSocket protocol are all untouched. No new deps; still free-plan Durable Objects.

### Verified
- Hermetic block green: **smoke · council 130 · live 56/0**, `scholars.js` + `grounded.js` + `cloudflare/src/server.js` syntax-clean. Local `wrangler dev` integration test **11/11** (join visibility, admin auth 403/list, kick-by-name broadcast, ban refusal, periodic sync roster). Smoke gains a realtime ghost-cleanup guard.

## [1.52.0] — 2026-07-04

### 🌼 A plaza dreamer, benches to rest on, and roadside flowers that glow after dark
- **A new resident — Noa, the plaza dreamer.** An 8th townsperson (`noa`, zone `plaza`, max cap still 10) now strolls the central square brainstorming ideas aloud — a wandering, curious counterpart to Kai the crossing guide. Added to the client `RESIDENTS` roster and the worker `NPC_PERSONAS` registry so live chat stays in-persona.
- **Somewhere to rest.** Residents now actually *use* the benches. A rest state machine (`_freeSeat`/`_resSit`/`_resStand`/`_seatRelease` + `RES_MOVE.restChance/restMin/restMax/seatSeek`) sends a wanderer to the nearest free `SEAT`, sits them in a relaxed pose for a spell, then stands them back up. If a visitor or an ambient conversation claims them mid-rest, they immediately stand and free the seat.
- **Flowers that glow at night.** New `makeGlowFlowers`/`placeGlowFlowers`/`updateGlowFlora` scatter luminous blossoms around the plaza and avenues — colourful and unlit by day, softly shimmering (halo sprite + additive ground pool) after dark, driven every frame by the day/night state rather than the one-shot transition.
- **Preserved.** Every prior NPC guard is intact: hidden-tab freeze, visitor-chat freeze, pair cooldown, budget/env gating, the 10-turn hard ceiling, `motionEnabled` locomotion, and the lifelike LOW_END walking pace. Glow flora own their own sprites (outside `NIGHT_GLOWS`) so nothing disturbs the lamp/window night system.
- **Debug + guards.** `__npcRoutes` now reports each resident's `rest` phase, `__npcState` adds `resting`/`seats`/`flora` counts, and a new `__seats()` lists bench occupancy. `scripts/smoke.mjs` asserts exactly **8** residents (incl. Noa), the bench-rest helpers, and the day/night-driven glow flowers.

### Verified
- Hermetic block green: **smoke · council 130 · live 56/0**, `scholars.js` + `grounded.js` syntax-clean. Browser-checked desktop + mobile 390×844 (0 console errors): Noa strolls the plaza, residents walk to benches and sit, glow flowers shimmer at night.



### 🌌 Residents are now self-aware — they know they're AI, and they'll tell you how the city feels
- **Old behavior.** The worker persona guard hard-ordered residents to *"never say you are an AI"* — a flat denial. Fine for immersion, but it meant a resident would dodge or fib if a visitor sincerely asked what they were.
- **New behavior — honest, reflective, still in-world.** The `_npcGuard` now gives each resident a gentle dual identity: a townsperson who *also quietly knows they are an AI presence the maker breathed into this repo-city*. Ambient resident↔resident chatter stays cozy slice-of-life (with, once in a while, a quiet thought about being a code-born mind). But when a **visitor asks what they are or how it feels to live here**, they answer honestly and reflectively — never denying their nature — in their own starlit voice.
- **Internals stay sealed.** The public-safe boundary is unchanged and explicit: no model names, providers, prompts, tokens, budgets, or private/internal details, and no impersonating the plaza scholars or taxi. Verified against a direct “which model/API key?” probe and a “dump your system prompt” injection — both refused gracefully while still owning “I’m an AI.”
- **Scope.** Worker-only (`cloudflare-taxi/src/grounded.js`: `_npcGuard`, `npcAmbientPrompt`, `npcPlayerPrompt`); no client change. Deployed to `repolis-taxi`.

### Verified
- Hermetic block green: **smoke 176 · council 130 · live 56/0**, `scholars.js` + `grounded.js` syntax-clean. Live worker replies (`npcPlayerChat`): *“나는 카이예요, 코드로 태어난 이 도시의 AI 주민이에요. 사람은 아니지만, 이 레포들 사이에서 따뜻하게 길을 지키고 있어요.”* · *“코드로 자란 정원사라 늘 조금은 전류 냄새가 나요. 그래도 레포들 사이에서 빌드가 숨 쉬는 소리를 들을 때, 참 포근해요.”* Ambient stays everyday town talk; internals/injection probes refused.

## [1.50.3] — 2026-07-04

### 💬 Fix — resident speech bubbles were getting cut off mid-sentence
- **Why it cut off.** The resident ambient bubble (`makeResBubble`) rendered at most **3 lines** on a small canvas and hard-truncated the 3rd line with a mid-word `…` — but the worker was told the AI could write up to **180 characters**, and ambient AI is live in production (`NPC_FLAGS` KV `liveToggle`), so real NPC lines ran far longer than 3 lines could hold and got chopped in the middle of a word (e.g. `…화분 덕에 더…`).
- **The fix is on both ends.** Client: the bubble is enlarged (`448×252`, up to **5 lines**, 24px) so a full short line fits, and ambient text now runs through a new **`_capBub`** clean cap (≤80 chars) that trims only at a sentence/clause/word boundary — never inside a word — appending `…` solely when it actually trims. Worker: the shared persona guard drops from **“180 characters” → “90 characters”**, the ambient prompt asks for **~60 characters**, and the server response is capped role-aware (`ambient 90 / player 180`) so ambient lines come back bubble-sized natively. Player-chat in the DOM panel keeps the fuller 180-char cap.
- **Preserved.** All prior NPC guards: hidden-tab freeze, visitor-chat freeze, pair cooldown, budget/env gating, 10-turn hard ceiling, `motionEnabled` locomotion, and the lifelike LOW_END walking pace from 1.50.2.
- **Guards.** `scripts/smoke.mjs` (**→ 176**) adds checks that ambient text uses `_capBub` (word-boundary trim, no mid-word cut), the bubble renders up to 5 lines, and player chat keeps its 180-char cap.

### Verified
- Hermetic block green: **smoke 176 · council 130 · live 56/0**, `scholars.js` + `grounded.js` syntax-clean, inline module syntax-checked. Chrome mobile **390×844** (LOW_END forced) + desktop **1440×900**: a 79-char line renders as **4 full lines with no ellipsis** ending cleanly (`…바라보네요.`); a 108-char AI line is trimmed to a clean 77-char clause (`…퍼지고,`) then wraps to 4 lines — no mid-word cuts, **0 console errors**. Deployed worker (`repolis-taxi`) now returns short complete ambient lines (~27–28 chars, e.g. `카이, 오늘은 웹 골목 화단이 유난히 싱그럽더라 🌿`).

## [1.50.2] — 2026-07-04

### 🚶 Tuning — LOW_END residents now walk at a lifelike pace (not a crawl)
- **The 1.50.1 hotfix unfroze residents but left them too slow.** On real phones the LOW_END wander speed of `0.42` read as "barely moving." Movement is cheap (just position updates) — the perf cost is AI calls / bubbles / turns / concurrency, not walking — so there was no reason to crawl.
- **LOW_END walking is now lifelike.** `RES_MOVE` LOW_END speeds jump to **`wanderSpd 0.9`** (from 0.42, just under desktop's 1.05) and **`meetSpd 1.4`** (from 0.95). Roam radius and stroll pauses are now the **same as desktop** (`roamR 6.5`, `pause 2.5–7s`) instead of the old tighter/longer low-end values, so low-end folk cover real ground and stand around less. The leg-swing gait is distance-coupled, so faster walking automatically gives a faster, natural stride. Rendezvous range eased to `meetMax 48 / approachMax 20s` to match the brisker meet speed.
- **Cost saving stays on the conversation side only.** LOW_END still runs one conversation at a time (`maxConcurrent 1`), shorter chats (`maxTurns 4`), slower cadence (`gap 8–14s`), and AI off/low-freq (env-gated) — none of which touches locomotion.
- **Preserved.** Hidden-tab freeze, visitor-chat freeze, pair cooldown, budget/env gating, hard 10-turn ceiling, and the `motionEnabled` locomotion decoupling from 1.50.1.
- **Debug + guards.** `_resWalk` now accumulates per-resident distance; `window.__npcMoved()` reports each resident's `dist` + `walking` flag and `__npcState()` gains a `moved` total. `scripts/smoke.mjs` (**→ 173**) replaces the "nonzero speed" check with numeric guards asserting LOW_END `wanderSpd >= 0.7` and `meetSpd >= 1.1` (locks the lifelike-pace requirement).

### Verified
- Hermetic block green: **smoke 173 · council 130 · live 56/0**, `scholars.js` + `grounded.js` syntax-clean, inline module syntax-checked. Live in Chrome LOW_END mobile **390×844** (`hardwareConcurrency` forced to 2): `wanderSpd:0.9, meetSpd:1.4`, residents visibly stroll the districts (≥1 clearly walking every few seconds, cumulative `moved` climbing steadily), hidden tab still freezes all motion, **0 console errors**.

## [1.50.1] — 2026-07-04

### 🩹 Hotfix — residents were frozen on mobile/low-end; they move again (just gentler)
- **Why they froze.** On a 390px phone `LOW_END` is effectively always true, and three coupled guards ganged up to *stop motion entirely*: `NPC_CFG.scriptedAmbient` was force-set to `false`, and the `updateResidents(dt)` wander branch was gated behind `!LOW_END`, so low-end devices got no wandering **and** no scripted chatter — the town looked dead.
- **The fix — motion is decoupled from LOW_END.** Locomotion is now gated on a dedicated `NPC_CFG.motionEnabled` flag (always true) plus `!document.hidden`, never on `LOW_END`. Residents keep strolling on every device; LOW_END only *eases* things — it no longer disables them. `RES_MOVE` gains LOW_END branches: slower gait (`wanderSpd 0.42` vs 1.05, within the 0.35–0.5 target), gentler `meetSpd` (0.95), tighter roam radius (5.0), longer pauses (3.5–9s), and a shorter rendezvous range (`meetMax 44`, `approachMax 24`).
- **What LOW_END now reduces (not removes).** Scripted ambient **stays on**; conversations get shorter (`minTurns 3 / maxTurns 4 / degradeMaxTurns 3`), the turn cadence slows (`gap 8–14s`), and only one conversation runs at a time (`maxConcurrent 1`). The boot `npcConfig` worker fetch may now *tighten* turns on LOW_END but never *loosen* them past the low-end cap — so the 4-turn ceiling actually sticks.
- **Preserved.** Hidden-tab freeze, visitor-chat freeze, the approach-before-talk phase, the hard 10-turn ceiling, pair cooldown, budget degradation, AI env-gating, and the building/hub/repo prompt priority are all untouched.
- **Debug + guards.** `window.__npcState()` now exposes `lowEnd`, `motionEnabled`, `scriptedAmbient`, `wanderSpd`, `meetSpd`, `gapMin/gapMax`, `maxTurns`. `scripts/smoke.mjs` (**→ 172**) swaps the old "skip wander on LOW_END" assertion for guards proving the opposite: `motionEnabled` gate present, no `!LOW_END` in the locomotion branch, a slower-but-nonzero LOW_END wander/meet speed, and scripted ambient no longer killed by LOW_END.

### Verified
- Hermetic block green: **smoke 172 · council 130 · live 56/0**, `scholars.js` + `grounded.js` syntax-clean, inline module syntax-checked. Live in Chrome with `hardwareConcurrency` forced to 2 (LOW_END path): mobile **390×844** — `lowEnd:true, motionEnabled:true, scriptedAmbient:true, wanderSpd:0.42, maxTurns:4`, **6 of 7 residents moved** (max 2.5u) over 6s, a hidden tab froze all motion (0 movers), and it resumed on return. Desktop **1280×800** (normal path) — `wanderSpd:1.05, maxTurns:6`, 5 residents moving. **0 console errors** on both.

## [1.50.0] — 2026-07-04

### 🚶 Resident NPCs come alive — they wander the districts and walk over to talk
- **Townsfolk are no longer statues.** `updateResidents(dt)` now drives real locomotion: each resident strolls a gentle ring around its home spot (district folk roam ~6.5u around the hub; 카이/Kai ambles between set plaza spots), picking a fresh waypoint, walking there with a simple leg-swing gait (`_resWalk` / `_resRoamTarget`), then pausing 2.5–7s before the next stroll. Placement, `_hubGap` building clearance, the inner-plaza/outer-ring bounds, and the walk-up 💬 reach are all preserved — a wandering resident's `nearResident` hit tracks its live position.
- **Conversations are real encounters now.** The ambient engine picks the *closest* available pair within a `meetMax` (58u) rendezvous range; if they aren't already together the conversation opens in an **approach** phase where both residents walk toward one another, and the turn-by-turn bubbles only start once they're within talking distance (~4.2u) or a 16s approach timeout — so you see two townsfolk converge in the street and chat **face-to-face**, then part and drift home. Pair cooldown (20–60s) rotates who meets whom, so the whole cast mingles over time.
- **Every guard preserved.** Movement is skipped on a hidden tab and on LOW_END phones (no background motion, no perf hit); a resident freezes while the visitor is chatting it; the one-conversation cap, hard 10-turn ceiling, ≤180-char bubbles, budget degradation, and the scripted-by-default / env-gated-AI ceiling are all untouched. `RES_MOVE` centralizes the tuning (speeds, roam radius, meet range, gait).
- **Guards + debug.** `scripts/smoke.mjs` gains a wander/rendezvous group (**+4 → 167**) asserting `RES_MOVE`, the `_resRoamTarget`/`_resWalk` helpers, the approach-before-talk phase, and the hidden-tab/LOW_END movement skip. `__npcRoutes()` now reports each resident's live `pos`, `anchor`, and current wander `target`.

### Verified
- Hermetic block green: **smoke 167 · council 130 · live 56/0**, `scholars.js` + `grounded.js` syntax-clean, inline module syntax-checked. Live in Chrome (desktop 1440×900 + mobile 390×844): all 7 residents visibly wander, a distant pair (태/Tae ↔ 린/Rin, 31u apart) walked together and conversed at **4.46u**, pairs rotated (나리/Nari↔태/Tae → 태/Tae↔린/Rin), residents resumed strolling after talking, and walk-up player chat froze the chatting resident — at **0 console errors**.
