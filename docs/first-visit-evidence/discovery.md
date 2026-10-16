# First discovery: search, arrival, source map and growth

Implementation for #136, #137, #138, #139 and #140. This is a local browser
verification record, not evidence of increased visits, stars or conversion.

## Changed contracts

- **Gitber:** task and installation queries use the existing semantic index.
  Explicit count/ranking requests use the corresponding metric. Popularity is
  only a tie-breaker for actual matches, never proof that a query matched.
  Unknown queries no longer select a popular unrelated repository, and
  alternatives are not padded with unrelated houses. Unknown public traffic
  remains unavailable. The server, models and budget policy are unchanged.
- **Arrival card:** exact identity, public description and Atelier/live-demo
  actions precede an initially closed details section. All existing metrics,
  questions, lineage and GitHub actions remain available. The fixed close
  control and the world behind the sheet remain visible. Hidden disclosure
  contents are excluded from all town panel focus traps.
- **Source map:** explicit opening of an already scanned map, or a successful
  explicit scan, frames the existing table below the ceiling and outside the
  panel. Selection highlights a node without moving the camera. Closing or
  switching away restores position, quaternion, zoom, view offset and camera
  controller values. Resize recomputes framing; reduced motion uses the same
  immediate stable framing. `cameraUnchanged` now means exact restoration on
  close, not that the camera never moved while viewing the map.
  The bounded folder/file batches reuse the existing terminal material with
  instance colors only: their geometry has no per-vertex color attribute.
  No additional material, texture, light, geometry or draw batch is introduced.
  Existing Blueprint URLs, exact-path handoff and request caps are unchanged.
- **Growth Replay:** the aerial camera alone uses near=5/far=1100. A controlled
  near-plane-only comparison isolated the large road-fragment artifact from
  shadows, LOD and geometry. Walking and room camera planes are restored.
  Projection fits the visible houses above the controls without removing detail.
  Milestone duration is 2.8 seconds plus bounded reading time for up to five
  names (maximum 5.85 seconds), instead of a fixed 1.35 seconds. Pause, scrub,
  current-year, sharing and postcards retain their existing behavior. Reduced
  motion applies the fitted view immediately. Background chat and transient
  notifications are only visually suppressed during replay, not erased.
  Short landscape screens put the controls beside the city; portrait screens
  retain a bottom sheet. Framing follows the actual unobscured rectangle.
- **Entry and wayfinding:** the actual rendered town appears behind entry only
  after readiness. Enter is the primary action; another GitHub target and
  optional controls remain below it. Search and the three existing goal
  choices precede the expandable town/people/sharing tools. No new automatic
  document or model request is introduced.

## Reproduction

Serve the repository and start an isolated Chrome CDP instance. Do not use a
personal browser profile. The runner creates and disposes its own contexts,
injects local public fixtures and disables production Workers/telemetry.

```sh
python3 -m http.server 8017 --bind 127.0.0.1
REPOLIS_TEST_URL=http://127.0.0.1:8017/ \
BROWSER_CDP_URL=http://127.0.0.1:9333 \
FIRST_VISIT_GROUP=discovery \
FIRST_VISIT_OUTPUT=/tmp/repolis-discovery-final \
node scripts/test-first-visit-browser.mjs

bash scripts/check-hermetic.sh
```

Historical observation uses `FIRST_VISIT_REFERENCE=644d1642`,
`DISCOVERY_BASELINE=1` and `FIRST_VISIT_GROUP=discovery`. It serves only the
historical HTML while keeping the catalog, local assets, clock, seed and Tree
fixture identical. It does not switch or reset the checkout. The focused
`DISCOVERY_DEPTH_PROBE=1` observation changes only the near plane at a frozen
pose; it is not a performance benchmark.

## Conditions and limits

- Chrome 155.0.8059.80, isolated headless SwiftShader; Node 24.7.0.
- Desktop 1440x900; mobile 390x844 with LOW_END and reduced motion; rotation
  to 844x390. KO and EN. Fixed clock `2026-09-08T14:00:00Z`, seed `120121122`.
- Catalog: 71 public repositories from `644d1642`. Source fixture: `src`,
  twelve folders and eight files per folder. Desktop/compact projection caps
  remain 220/96 nodes and 160/64 edges.
- A projected coordinate is not sufficient evidence of a visible model. The
  browser gate compares actual screenshot pixels at the selected root with
  the same node hidden, in addition to panel exclusion and resource assertions.
- Camera restoration is sampled immediately before open and immediately after
  close in a single browser task, avoiding false drift from the next normal
  walking-camera interpolation frame.
- CPU render submission and frame cadence samples from software rendering are
  diagnostic only. They do not establish GPU time, hardware FPS or mobile
  battery improvements. Real device, native keyboard, screen reader and
  Safari/Firefox coverage remains tracked in #120/#122.
- No live model calls, paid sandbox, Worker deployment, credential change or
  budget change was made. Existing unrelated NPC budget edits are not part of
  this work.

## Verification results

- All **32 hermetic commands** passed, including 1,668 smoke assertions, 42
  behavioral Gitber intent/scope cases and the new projection/pacing guards.
- **97 distinct local browser scenarios** passed across the selected suites:
  44 entry/deep-link cases, eight API failure cases, one empty-town policy case,
  four readable-panel cases, 34 source-exhibit cases and six discovery cases.
  The local chat -> taxi ride -> matching house was also exercised separately.
  The final discovery run includes return visits, portrait/landscape rotation,
  source-node pixel checks and exact camera/sky/fog/LOD/controller restoration.
- A separate Playwright desktop/mobile smoke test captured screenshots and
  exercised actual walking input against the local app. Sampled screenshots
  contained 3,122 / 2,932 distinct RGB colors, the player moved, and page errors
  were zero. [Results](discovery/playwright-smoke.json). This supplemental run
  used the browser clock, not the fixed-clock comparison above. Playwright was
  installed only in `/tmp`; no project dependency or build step was added.
- No unexpected application console errors. Deliberately injected HTTP
  403/404/429 resource failures are expected and remain separately recorded.
- The first long-description assertion incorrectly expected all 540 raw fixture
  characters. It now checks the existing **500-character public projection**;
  both long-name/archive/foreign-town cases passed. The production sanitizer
  was not relaxed.
- [Machine-readable results](discovery/verification.json) identify each case,
  rerun, baseline and the SHA-256 of the tested `index.html`. This record is
  local verification, not a deployed release or an exact-head CI result.

### Observable changes

| Same KO fixture / viewport | Before | After |
| --- | --- | --- |
| Mobile Atelier action, 390x844 | y=920, below viewport | y=647, 48px high, visible |
| Desktop Atelier action, 1440x900 | y=908, below viewport | y=703, 48px high, visible |
| Mobile town search | y=886, below viewport | y=126, visible |
| Source model | off-screen / blank node materials | all 109 desktop / 96 compact fixture nodes outside panel |
| Room resources | 25 geometries / 16 materials / 3 canvases | unchanged |
| Selected root pixel delta, shown vs hidden | not measured | about 110/255 mean absolute channel delta |
| Milestone hold | 1.35s fixed | 2.8-5.85s, bounded by displayed names |

Source map retains two instanced batches and one line batch, one explicit Tree
request and zero automatic README/AI calls. The room's exterior render count
remains zero. Long original text within the existing sanitized bound remains
scrollable, not replaced by an invented summary.

### Rendering trade-off

Current-year samples use the same catalog/seed/clock/quality, but intentionally
different framing. Scene allocation is unchanged; exposing more of the city
increases visible submissions and lazy texture residency. This is **not a frame
rate optimization claim**. These single-run software-renderer samples are not a
controlled hardware performance benchmark.

| Current year, 60-frame sample | Desktop before / after | Mobile before / after |
| --- | --- | --- |
| Geometry count | 4,358 / 4,358 | 4,344 / 4,344 |
| Material count | 4,712 / 4,712 | 4,632 / 4,632 |
| Scene object count | 7,910 / 7,910 | 7,553 / 7,553 |
| Resident textures | 157 / 160 | 139 / 153 |
| Render calls | 2,978 / 3,129 | 2,745 / 2,981 |
| Median CPU render submission | 8.5 / 8.9 ms | 7.9 / 8.6 ms |
| Median frame cadence | 16.3 / 16.2 ms | 16.7 / 16.7 ms |

### Screenshots

| Flow | Before | After |
| --- | --- | --- |
| Entry | [Before](discovery/before-mobile-entry.jpg) | [After](discovery/after-mobile-entry.jpg) |
| Wayfinding | [Before](discovery/before-mobile-menu.jpg) | [After](discovery/after-mobile-menu.jpg) |
| Arrival | [Before](discovery/before-mobile-card.jpg) | [After](discovery/after-mobile-card.jpg) |
| Source map | [Before](discovery/before-mobile-blueprint.jpg) | [After](discovery/after-mobile-blueprint.jpg) |
| Growth Replay | [Before](discovery/before-mobile-growth-999.jpg) | [After](discovery/after-mobile-growth-999.jpg) |
| Frozen pose, near-plane-only probe | [near .1](discovery/depth-desktop-near-original.jpg) | [near 5](discovery/depth-desktop-near-5.jpg) |

Landscape: [source map](discovery/after-blueprint-landscape.jpg),
[Growth Replay](discovery/after-growth-landscape.jpg).
The remaining regular dark road surfaces are existing materials; this patch
addresses the depth-fragment artifact, not a road-art redesign.
