# First-visit review evidence: #120, #121, #122

One goal: a first visitor can see the town, select a current public repository, and arrive in its existing Atelier without an implicit AI request or a wrong-target fallback.

Implementation order: unchanged #122 baseline, #120 viewport, #121 repository path, #122 arrival, integrated gates. This document distinguishes issue evidence from release gates. Merge and production deployment require separate approval.

## Unchanged baseline

Recorded **2026-09-08 13:56 UTC**, before runtime changes, at `76f3b1d81d9a2ed6f5fc28950b8554f6b98d1c26`. GitHub Pages reported that same revision built at **2026-09-07 21:36:33 UTC**. No production test traffic was generated.

Environment: local static server on `127.0.0.1:8017`, Chrome **152.0.7977.76** headless, Node **24.7.0**, 1440 x 900 CSS pixels, DPR 1, no CPU throttling. CDP network emulation: 40 ms latency, 1,250,000 B/s download, 625,000 B/s upload. Fixed application clock: `2026-09-08T14:00:00Z`; random seed: `120121122`.

The URL was exactly `/?view=plaza&lang=en`; adding diagnostic query keys would change strict direct-entry semantics. A test-only pre-document probe observed Three.js' native renderer event, the first completed draw, and loading/intro/transition visibility. Each cold run cleared HTTP cache and localhost site data; its paired warm run retained HTTP cache **and returning-visitor storage**. Samples ran sequentially in an isolated browser context.

| Pair | Cache | Scene / controls available, ms | Camera moved after W, ms | Requests | ResourceTiming transfer, bytes |
|---|---|---:|---:|---:|---:|
| 1 | Cold | 7,461 | 7,580 | 48 | 2,210,627 |
| 1 | Warm | 3,573 | 3,789 | 48 | 1,800 |
| 2 | Cold | 5,319 | 5,483 | 48 | 2,210,627 |
| 2 | Warm | 3,568 | 3,778 | 48 | 1,800 |
| 3 | Cold | 5,287 | 5,451 | 48 | 2,210,627 |
| 3 | Warm | 3,541 | 3,741 | 48 | 1,800 |

Cold scene/control median: **5,319 ms**, range **5,287-7,461 ms**. Warm median: **3,568 ms**, range **3,541-3,573 ms**. All six samples had a 16.7 ms median rAF interval, 131 renderer-resident textures, 59 programs, and no captured application errors; geometries varied from 3,226 to 3,231.

These are local browser observations, not production latency or a hardware-mobile result. ResourceTiming transfer is not a wire capture; rAF cadence is not CPU render time. The first cold sample includes browser/GPU/CDN startup variation. The W probe detects camera displacement; the separate functional checks compare actual player coordinates. No conversion, traffic, Star, or AI-cost improvement is inferred.

## #120: viewport and panel ownership

Natural reproduction: exact English plaza URL, 1440 x 900, default graphics. RIGEL's existing “Which codebase?” speech became larger than the lower-left viewport and clipped at its edge. This was not limited to resident dialogue: both existing scholar and resident sprite factories needed the same presentation boundary.

The controlled stress fixture freezes the simulation after placing five existing scholars near the same camera and calls their existing `say` method with long English and Korean lines, including an unbroken repository name. It is **synthetic**, not the naturally generated sentence. Existing house detail, resident simulation, RNG cadence, dialogue generation and texture dimensions remain unchanged.

Presentation policy: at most **two** eligible bubbles, retained selection with a 350 ms offscreen grace, interaction priority, 12 px edge gutters, reserved HUD/action lanes, no overlaps between selected rectangles. Width ceiling: **272 px desktop / 224 px narrow viewport**. Fewer bubbles are shown when they cannot fit. Word and Unicode-token wrapping is bounded; an ellipsis denotes a preview, and the unmodified selected lines can be read in Wayfinding's “Read nearby dialogue” disclosure. Panels own the view over ambient speech and incidental toasts.

| Stress scene | Before: visible / clipped | After: visible / clipped | Largest shown width, before -> after | Full-frame draws, before -> after | Geometries |
|---|---:|---:|---:|---:|---:|
| Desktop EN | 5 / 5 | 2 / 0 | 1,134 -> 272 px | 2,178 -> 2,174 | 3,311 -> 3,311 |
| Desktop KO | 5 / 5 | 2 / 0 | 1,134 -> 272 px | 2,176 -> 2,172 | 3,311 -> 3,311 |
| Mobile EN | 5 / 5 | 2 / 0 | 1,064 -> 224 px | 991 -> 988 | 2,226 -> 2,226 |
| Mobile KO | 5 / 5 | 2 / 0 | 1,064 -> 224 px | 989 -> 986 | 2,226 -> 2,226 |

GPU-resident textures in the same captures: desktop EN 115 -> 107, KO 98 -> 90; mobile 67 -> 64. This reflects hidden sprites not being submitted/uploaded, not a reduced building/texture budget. No new canvas, texture, light, or scene object was introduced by speech presentation.

| View | Before | After |
|---|---|---|
| Desktop EN | [JPEG](before-speech-en-desktop.jpg) | [JPEG](after-speech-en-desktop.jpg) |
| Desktop KO | [JPEG](before-speech-ko-desktop.jpg) | [JPEG](after-speech-ko-desktop.jpg) |
| 390 x 844 EN | [JPEG](before-speech-en-mobile.jpg) | [JPEG](after-speech-en-mobile.jpg) |
| 390 x 844 KO | [JPEG](before-speech-ko-mobile.jpg) | [JPEG](after-speech-ko-mobile.jpg) |

The compact top row keeps Station, Map and Wayfinding direct. “Town / visits” is one native disclosure containing language, time, Passport, exploration and **all four original counters**. Counter IDs, updates, UTC and entry/unique definitions are unchanged.

Local functional checks passed for Wayfinding, Map, Station, chat and Passport: one panel at a time, inert hidden controls, Tab containment, Escape/close focus return, held-key clearing, no player-coordinate movement behind panels, and no console exceptions. A 430 px shortened viewport kept chat/input bottoms at 418/408 px on desktop and touch-emulated mobile ([desktop](viewport-chat-desktop.jpg), [mobile](viewport-chat-mobile.jpg)). This is a virtual-keyboard sizing fixture, **not an iOS/Android keyboard test**.

The existing smoke harness includes `scripts/test-first-visit.mjs` for wrapping, bounds, retention, priority, resource boundaries, counter ownership, inert/focus and cancellation guards. Final combined entry, failure, LOW_END/reduced-motion and full AGENTS gates are recorded below after #121 and #122.

## #121: a current-catalog path, not a new onboarding flow

“Understand a repository” now switches the existing Wayfinding search/list to a picker. It starts with six entries in **existing `REPOS` order**, with six-entry paging and in-memory search for the rest. Station remains a separate top-row action. Each native button contains the exact `owner/repo`, existing description or explicit missing-description text, language/topics and an archive marker. There is no new score, recommendation claim, inferred content, or Star prompt.

One Intent Lens choice plus one row selection enters `enterRepositoryAtelier(repo,{autoChat:false})`. Selection revalidates object membership, exact owner and GitHub URL against the current public catalog. A valid explicit Portal target still bypasses the picker; mixed `?repo=fixture-town/...&user=wrong-town` retained the exact repository owner. Route/Blueprint URL handling is unchanged by this issue and is included in the combined arrival matrix.

| Local scenario | Input / result | Evidence |
|---|---|---|
| Canonical EN desktop | Intent + keyboard Enter -> `hyeonsangjeon/youtube-dl-nas` | [Picker](picker-canonical-en.jpg) |
| Canonical KO 390 x 844 | Intent + emulated touch -> same exact repo | [Picker](picker-canonical-ko-mobile.jpg) |
| Foreign EN 390 x 844 | Long name, absent description, archive marker; exact fixture owner | [Picker](picker-foreign-en-mobile.jpg) |
| Partial foreign KO desktop | 100-record API fixture; explicitly limited to loaded public catalog | [Picker](picker-partial-ko.jpg) |
| Empty catalog EN | Explicit empty state; no guessed destination | [Picker](picker-empty-en.jpg) |
| Single Portal KO, conflicting user | Reentry remained in the explicit Portal repo; one existing room | Target, chat and resource assertions |

Public API responses in these scenarios were **local intercepted fixtures**, not live GitHub requests. Picker opening, typed no-match search, paging and selection generated **zero network requests** after the loaded scene. Opening/search produced zero storage calls. The unchanged canonical Atelier path read its existing `taxiGroundedUrl` override once; portable Atelier did not. No picker storage access or writes were added.

Picker opening preserved renderer geometry/texture counts. Each entered Atelier had the existing one room, 25 geometries, 16 materials, three canvas atlases and five exhibit batches; scoped chat reported zero started calls, zero history turns and the unchanged five-call limit. Blueprint reported zero requests until explicitly scanned. Local configured AI/realtime/analytics endpoints remained empty.

Cancel preserved player coordinates and camera controls; camera position differed by less than 0.001 world units while its existing spring finished settling. Atelier exit restored the original player pose. Desktop keyboard, 390 x 844 touch emulation, text overflow, search/no-match, next-page and cancel/return checks had no captured application errors. Physical-device touch and keyboard behavior remain a separate, unverified boundary.

## #122: readiness, exact destinations and explicit recovery

Implementation commits are separated for review: `bb19dd4b` (#120), `57758d89` (#121), and `b1163988` (#122). The final evidence follow-up also darkens recovery explanation text for contrast; it does not change the measured plaza's boot logic or byte count.

The ordinary intro now waits for two completed scene frames. Covered direct entry retains the existing 1,200 ms initialization and 900 ms cover minima, but only a rendered owner plaza or the exact requested Atelier's **inside** state can release the cover. Repeated activation cannot repeat entry. A frame-drained queue retains a pending destination across context loss instead of discarding its timer callback.

Awaited boot responses have an 8 s / 2 MiB decoded-body bound; optional resident/lore/Council loads have a 4 s deadline and retain their validated local fallbacks. Required script/module failures and a 45 s startup watchdog have an independent KO/EN recovery dialog. It offers exact-link reload, the validated original GitHub target when available, and a language-preserving default plaza. There is no automatic retry or wrong-owner substitution.

Two concrete integration defects were reproduced and fixed: Blueprint's **Enter town instead** previously entered the Atelier anyway, and context loss could discard an initial arrival callback. Context restoration now waits for a rendered frame and explicit **Continue**, preserving the current room, input focus, chat draft and pending entry. A missing `focus` keeps its exact GitHub destination rather than returning a different repository or only the owner's profile.

### Final browser matrix

Each normal row ran in **EN and KO, 1440 x 900 desktop and 390 x 844 touch emulation**. Strict direct links seeded the opposite stored language to check URL precedence. GitHub responses were locally intercepted; optional services remained empty and Worker URLs were blocked.

| Entry | Expected destination and return behavior | Cases |
|---|---|---:|
| Default | Existing intro after a real frame; ordinary town entry | 4 |
| `?launch=1` | Existing input focused only after readiness | 4 |
| `?view=plaza&lang=en|ko` | Covered owner-plaza entry, original spawn | 4 |
| `?user=fixture-town` | Current public catalog, local/solo town | 4 |
| `?repo=fixture-town/alpha&user=wrong-town` | Repo owner wins; exact Atelier and GitHub link; exterior return | 4 |
| Strict `view=atelier` | Exact interior before cover release; explicit exit | 4 |
| Blueprint confirmation | Zero Tree requests before consent; one Tree GET and exact shared path afterward | 4 |
| Blueprint cancellation | Existing exterior, no Atelier entry or Tree request | 4 |
| Repo Route | Existing ordered route and cancel behavior | 4 |
| Public-town `focus` | Exact current-catalog repo and exterior return | 4 |
| Growth Replay | Existing year-specific replay and close behavior | 4 |

Additional groups: **22 failure scenarios**, **7 slow/LOW_END/reduced-motion/context scenarios**, and **4 mixed-speech/panel/governor scenarios**. Total: **77 passing cases**, including 55 non-fault scenarios with zero captured runtime, console-API or browser resource errors. Injected missing resources, HTTP failures and unavailable WebGL produce expected browser errors and are recorded separately, not reported as ordinary zero-error sessions.

Failure coverage includes required classic/module failure, hung module, optional missing/hung data, malformed/missing local catalog, WebGL unavailable, public and Portal 403/429/404, response deadline, malformed/invalid/oversized JSON, explicit retry, empty town, wrong-owner response and missing focus. Recovery checks include the accessibility-tree dialog name, 44 px targets, focus containment, readable contrast, original/default links and no forced wrong room.

The normal public/Portal cases make one existing public GET. Blueprint adds its one explicit Tree GET and existing CORS preflight. An absent public-town focus retains the existing catalog GET plus exact-repository lookup; explicit retry adds one request only when chosen. No test used a production counter or AI endpoint.

[Machine-readable browser results](browser-results.json) retain every case and distinguish expected injected errors. A final 29-case failure/context rerun also checks text contrast after the recovery-palette correction: at least 4.5:1 for primary-button text and explanation text even with a black backdrop behind the translucent card. Recovery captures: [KO missing module](arrival-required-module.jpg), [EN rate limit](arrival-portal-429.jpg), [WebGL unavailable](arrival-webgl-unavailable.jpg), [KO restored Atelier](arrival-context-atelier-mobile.jpg), [restored chat draft](arrival-context-chat.jpg).

### Extended #120 comparison: residents, rotation and graphics policy

The historical HTML at `76f3b1d` was replayed locally **after implementation**, without changing HEAD or the checkout. This supplements, rather than replaces, the original pre-change observation. The same fixture places nine existing residents and five scholars near the camera and feeds their actual bubble factories long KO/EN text. Their unchanged greeting/routine code can replace that text as the camera rotates.

The renderer's real camera moved through offsets 0, 0.8, pi and back to 0 radians. All 16 post-change angle observations kept at most two speech rectangles, zero clipped speech and no overlap. Complete selected dialogue was also exposed as accessible DOM text. Mobile fixtures combined LOW_END with reduced motion.

| Near fixture | Visible / clipped before -> after | Draws before -> after | GPU-resident textures before -> after | GPU geometries | Median render CPU, ms |
|---|---:|---:|---:|---:|---:|
| Desktop EN | 14 / 7 -> 2 / 0 | 2,312 -> 2,300 | 134 -> 122 | 3,521 unchanged | 8.9 -> 9.2 |
| Desktop KO | 14 / 7 -> 2 / 0 | 2,312 -> 2,300 | 134 -> 122 | 3,521 unchanged | 9.4 -> 9.1 |
| Mobile EN | 14 / 14 -> 2 / 0 | 1,150 -> 1,138 | 104 -> 92 | 2,723 unchanged | 6.2 -> 5.6 |
| Mobile KO | 14 / 14 -> 2 / 0 | 1,150 -> 1,138 | 104 -> 92 | 2,723 unchanged | 6.5 -> 6.1 |

These are approximately 900 ms frozen-scene samples, not a statistical speed claim. The EN desktop render median increased 0.3 ms; the other medians fell. No geometry/resource budget was enlarged to produce this result. Scene census was identical except one transient-count difference in the EN desktop snapshot; renderer residency and snapshot timing must not be confused with allocation budgets.

| View | Near, before / after | Rotated, before / after |
|---|---|---|
| Desktop EN | [Before](before-mixed-speech-en-desktop-near.jpg) / [After](after-mixed-speech-en-desktop-near.jpg) | [Before](before-mixed-speech-en-desktop-rotated.jpg) / [After](after-mixed-speech-en-desktop-rotated.jpg) |
| Desktop KO | [Before](before-mixed-speech-ko-desktop-near.jpg) / [After](after-mixed-speech-ko-desktop-near.jpg) | [Before](before-mixed-speech-ko-desktop-rotated.jpg) / [After](after-mixed-speech-ko-desktop-rotated.jpg) |
| 390 x 844 EN | [Before](before-mixed-speech-en-mobile-near.jpg) / [After](after-mixed-speech-en-mobile-near.jpg) | [Before](before-mixed-speech-en-mobile-rotated.jpg) / [After](after-mixed-speech-en-mobile-rotated.jpg) |
| 390 x 844 KO | [Before](before-mixed-speech-ko-mobile-near.jpg) / [After](after-mixed-speech-ko-mobile-near.jpg) | [Before](before-mixed-speech-ko-mobile-rotated.jpg) / [After](after-mixed-speech-ko-mobile-rotated.jpg) |

World-space nameplates/signs remain unchanged and can overlap or clip in this deliberately crowded arrangement; the speech bounds do not claim to clamp every label in the 3D world. Existing governor transitions balanced -> lean -> full -> auto retained the active speaker, input focus and draft; LOW_END correctly clamped the full request to balanced. Pointer drags behind chat neither moved the player/camera nor opened a repository. [Comparison data](viewport-comparison.json).

### Same-protocol cold/warm result

Post-change measurement at **2026-09-08 15:33 UTC**, revision `b1163988fbe0da8906556f04dbb174a3828f32af`, used the original server, exact English plaza URL, clock, seed, network, viewport and cold/warm rules. No competing browser test ran during measurement.

| Pair | Cache | Scene / controls available, ms | Camera moved after W, ms | Requests | ResourceTiming transfer, bytes |
|---|---|---:|---:|---:|---:|
| 1 | Cold | 5,448 | 5,683 | 48 | 2,248,353 |
| 1 | Warm | 3,601 | 3,718 | 48 | 1,800 |
| 2 | Cold | 5,417 | 5,667 | 48 | 2,248,353 |
| 2 | Warm | 3,628 | 3,841 | 48 | 1,800 |
| 3 | Cold | 5,407 | 5,591 | 48 | 2,248,353 |
| 3 | Warm | 3,610 | 3,806 | 48 | 1,800 |

| Scene/control availability | Original baseline median (range), ms | After median (range), ms |
|---|---:|---:|
| Cold | 5,319 (5,287-7,461) | 5,417 (5,407-5,448) |
| Warm | 3,568 (3,541-3,573) | 3,610 (3,601-3,628) |

Observed median deltas are **+98 ms cold / +42 ms warm**, not a speed improvement. Request count stayed 48. Cold transfer grew **37,726 bytes**, exactly the HTML growth for UI, KO/EN copy and recovery logic; there is no new runtime module/image/request. Warm transfer stayed 1,800 bytes. rAF medians stayed 16.7 ms, shader programs stayed 59, and GPU-resident textures fell 131 -> 118. Renderer-resident geometry ranges were 3,226-3,231 before and 3,229-3,234 after; the fixed mixed-scene test and the coordinate-based replay below show no enlarged geometry budget.

### Actual-player timing supplement

The original probe observed camera displacement, which alone cannot prove a player's movement timestamp. A second paired comparison identifies the unique existing player group through its contact shadow and face-light structure, then records its actual world-coordinate displacement after W in rAF. No debug query, application-source change or visitor identifier is needed.

This is a **historical-code replay**, not a claim that extra instrumentation existed in the original baseline. Both versions used the same loopback comparison server on port 8018 and the same conditions as above, three cold/warm pairs each. The snapshot's Last-Modified timestamp was aligned to the current HTML to avoid differing heuristic cache freshness. An earlier unmatched-mtime trial was excluded because it added a 300-byte warm revalidation; its values are not used below.

| Code / cache | Scene median (range), ms | Actual player moved median (range), ms |
|---|---:|---:|
| Historical / cold | 5,362 (5,351-5,405) | 5,468 (5,455-5,479) |
| Current / cold | 5,399 (5,393-5,409) | 5,515 (5,509-5,526) |
| Historical / warm | 3,610 (3,596-3,626) | 3,676 (3,660-3,713) |
| Current / warm | 3,583 (3,576-3,602) | 3,650 (3,626-3,652) |

The matched replay has 48 requests in every run, the same cold/warm bytes as the primary comparison, 59 programs, 16.7 ms median rAF and the same 3,230-3,234 geometry range on both sides. All actual-player samples changed position and had no captured application/console errors. This timestamps an emulated W action, not human reaction time or physical-device input latency. With only three pairs, small timing differences are descriptive, not a causal latency or conversion claim.

[Raw measurements](arrival-measurements.json) preserve all four retained series, each sample, first-draw timing, source revisions, transfer sizes and resources. The original baseline captured window errors/rejections; subsequent runs additionally captured console errors. Neither series is a production measurement. These are historical revisions: daily generated-data refreshes can advance main and Pages independently. This PR's runtime changes have not been merged or deployed.

## Reproduction and release boundary

The original `c17abcda` release record ran the **22-command AGENTS.md hermetic block**, plus `node --check scripts/test-first-visit-browser.mjs`. All passed; [release record](release-gates.json). Smoke reported **1,538 checks**, including **53 first-visit checks**; these are not additive totals. That browser flow also reran the earlier panel/picker fixtures. For the current complete local/CI command list, run `bash scripts/check-hermetic.sh`; see the #124 follow-up below.

The browser runner uses only Node's built-in APIs and an already-running local static server plus isolated Chrome CDP browser. No package install or production URL is required:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
# In another terminal, start your installed Chrome with an unused debugging port
# and a fresh user-data directory; do not attach the test to your everyday profile.
# Example macOS executable: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
# Flags: --headless=new --remote-debugging-address=127.0.0.1
#        --remote-debugging-port=9222 --user-data-dir=<fresh-directory> about:blank
REPOLIS_TEST_URL=http://127.0.0.1:8000/ \
BROWSER_CDP_URL=http://127.0.0.1:9222/ \
node scripts/test-first-visit-browser.mjs
```

Optional `FIRST_VISIT_GROUP` selects one or more comma-separated groups from `matrix,failures,policy,viewport,regressions`; `FIRST_VISIT_CASE=<substring>` narrows a run further. `FIRST_VISIT_OUTPUT` selects an evidence directory; otherwise the runner creates a fresh temporary directory. Non-local hosts and selectors matching no cases fail closed. `FIRST_VISIT_REFERENCE=76f3b1d` with only `FIRST_VISIT_GROUP=viewport` reads historical HTML via `git show` for observations only; it never checks out or alters the working tree. Shared modules/catalog must remain matched for an A/B comparison. Historical violation counts are observations, not assertions that old behavior passes the new bounds.

**Still unverified:** physical iOS/Android devices, native virtual keyboards, Safari/Firefox, hardware/driver-induced context loss and production latency. The context-loss extension, shortened viewport, touch and hardware flags are emulations. Nameplates and world signage remain world-space. No Star/traffic/conversion gain is promised.

The PR is ready for review, not deployment approval. Issues remain open and the board moves to **In review**, never Done. Merge and production deployment are deliberately outside this task.

## #124: PR gate and release review (2026-09-09 KST)

[`scripts/check-hermetic.sh`](../../scripts/check-hermetic.sh) is now the shared **24-command** local/CI list: all 22 original commands, standalone first-visit guards, and the browser runner's syntax check. Injected Node, Python, and late first-visit failures each stopped the script with their original exit code (37), before later commands ran.

The **PR quality gate / Hermetic regression** job uses one ordinary Ubuntu 24.04 runner, Node 24.7.0, Python 3.12.11, a 10-minute timeout, and cancellation of superseded same-PR runs. It asserts the checked-out PR head SHA. Actions are SHA-pinned; checkout has `contents: read` and `persist-credentials: false`. No secrets, caches, model/production requests, data regeneration, write-enabled refresh workflows, commits, merges, or deployments are used. Actions and runtime setup may download public tools; the hermetic commands themselves do not use the network.

The release review reproduced and fixed three boundaries without changing product scope or graphics:

| Boundary | Reproduction | Fix |
|---|---|---|
| Native disclosure keys | Focus the closed Town/visits summary; Space was consumed and Enter could also run a world action. | Summary and its descendants retain native activation keys. |
| Recovery panel ownership | A delayed existing tour callback opened Passport or closed chat while recovery owned focus. Continue restored stale inert/focus state. | Keep panels mutually exclusive while blocked; reconcile current and pending panel mutations on explicit Continue. |
| Asynchronous context-loss event | During repeated loss injection, a frame could reach Three.js with an already-lost context before the DOM event updated the state flag, producing a null shader-log error. | Read the actual context state at the frame boundary; no rendering or readiness progress through a lost context. |

The final local run passed **1,549 Smoke checks**, including **64 first-visit checks** (11 more than the original report), and all 24 shared commands. Local Python was 3.11.7; the separate GitHub Linux execution uses the explicitly selected 3.12.11. Platform agreement is established by that execution, not assumed from the local run.

The affected browser selection passed **45 cases**: 22 injected failures, 7 policy/context cases, 12 new keyboard/deferred-panel regressions, and 4 mixed-speech/panel/governor cases. The new regressions cover KO/EN at 1440x900 and 390x844; existing selected cases retain LOW_END and reduced-motion coverage. Non-failure cases had zero captured console/runtime/resource errors; expected injected failures remain separate. The original 44-entry matrix and performance measurements above are historical evidence, not newly rerun measurements for this follow-up.

With the local server and isolated Chrome already running, reproduce that selection with:

```bash
REPOLIS_TEST_URL=http://127.0.0.1:8000/ BROWSER_CDP_URL=http://127.0.0.1:9222/ \
FIRST_VISIT_GROUP=failures,policy,viewport,regressions node scripts/test-first-visit-browser.mjs
```

[Compact regression evidence](quality-gate-review.json) records the before failures, after cases, emulation boundaries, and tested source blobs. The exact final-head GitHub check, run URL, result and elapsed time are recorded in [PR #123](https://github.com/hyeonsangjeon/Repolis/pull/123) and [issue #124](https://github.com/hyeonsangjeon/Repolis/issues/124), avoiding a self-referential evidence commit. Physical devices, native keyboards, Safari/Firefox, hardware/driver loss and production latency remain unverified. Required-check settings, merge and deployment still require separate approval.

## Review closeout: startup ownership and transport evidence (2026-09-11 KST)

The local GHCP preview failure was reproducible on a fresh English plaza navigation, not just an old failure-injection screen. Its embedded WebKit host rejected a notification-permission probe with `Command plugin:notification|is_permission_granted not allowed by ACL` before town readiness. The global preboot `unhandledrejection` listener incorrectly turned that unrelated host rejection into the town's fatal initialization state.

The fix removes that indiscriminate promise listener and explicitly catches the town module's own initialization, after its static imports. Owned awaited failures still show recovery and rethrow their original Error or non-Error reason. Required-script/ErrorEvent recovery, the 45-second watchdog, bounded data loading, WebGL recovery and real-render readiness remain intact. This distinction matters: embedded WebKit reports failed top-level module awaits as promise rejections too, so simply removing the listener would lose genuine startup recovery.

The original synthetic host rejection failed before the change (`blocked:true`, `initialization`); it now remains visible in diagnostics while the town becomes ready. A diagnostic-only WebKit capture also retained the actual host ACL rejection while readiness succeeded. No error was prevented or hidden, and no host ACL, notification permission, Safari automation setting or CSP allowlist was changed. Fresh normal KO/EN preview entries and the current-repository Atelier handoff were checked separately from that diagnostic capture.

### Executed gates

All **24** shared hermetic commands passed: **1,554 Smoke checks**, including **69 first-visit checks**, not additive totals. The existing local browser runner passed **95 cases** in installed Chrome **152.0.7977.84**: 44 entry, 24 failure, 7 policy/context, 16 regression and 4 mixed-speech cases. The six new cases cover four KO/EN desktop/mobile host rejections and two owned bootstrap rejection types.

The **67 non-fault cases** had zero captured runtime exceptions, console-API errors and browser Log errors. Injected faults remain separate; each host fixture requires exactly its one injected diagnostic rather than permitting arbitrary errors. The runner does not collect raw CDP `Network.loadingFailed`, so this is not a transport-level zero-failure claim. Local public API fixtures, empty AI/realtime/analytics endpoints and blocked Worker URLs remain in force.

[Compact closeout evidence](release-closeout.json) retains the tested source blobs, before failure, all 95 outcomes, mixed-speech observations and the request-lifecycle records below. The normal strict plaza still recorded 48 requests and 59 programs. This startup-boundary fix adds no request or scene allocation. Earlier cold/warm, frame and transfer comparisons remain dated historical measurements; they were not relabeled as new measurements for this follow-up. Exact final-head CI links belong in the PR and #124, not in a self-referential commit.

### Completed response versus application cancellation

The preceding compatibility run remains **16/16 UI outcomes, 14/16 strict network-gate outcomes**. Its two failing scenarios were English desktop plaza and Korean desktop slow public loading; full bodies had been consumed when the browser reported `ERR_ABORTED`. That raw result has not been changed to green.

A bounded follow-up used the exact existing `ARRIVAL_DATA` loader outside the 3D app, the same local 57,909-byte catalog over HTTP/1.1, four samples per reading method, and explicit garbage collection after each sample. Sixteen successful consumptions were compared with one explicit pre-response abort.

| Method | Samples | Successful consumers | Raw failed transport events | Application aborts |
|---|---:|---:|---:|---:|
| Native JSON | 4 | 4 | 0 | 0 |
| Native text + JSON parse | 4 | 4 | 0 | 0 |
| Existing bounded stream loader | 4 | 4 | 1 | 0 |
| Same loader retaining the native Response | 4 | 4 | 0 | 0 |
| Explicit pre-response abort control | 1 | 0 | 1 | 1 |

For request `3096.13`, HTTP 200 arrived at 1.66 ms and the canceled `ERR_ABORTED` event at 2.72 ms. CDP and the reader both counted all 57,909 bytes, the reader reached `done:true`, JSON consumption succeeded and the application's signal was not aborted. The deliberate abort control (`3096.19`) had no response/body completion, an aborted application signal and an `AbortError`. Times are relative to each request, not page load.

This reproduces a completed-consumption transport diagnostic, not an intentional application cancellation or an observed missing-data failure. Native Response lifetime is a plausible explanation given the retention control, but four samples do not establish a browser-internal root cause. No retention workaround or transport-error suppression was added. The hermetic success path now explicitly asserts an un-aborted signal; raw transport failures remain recorded alongside request identity, complete-body/parse evidence and the failing control. Reader instrumentation applies to the two stream methods, not native `json()`/`text()` internals.

### Local review and approval boundary

The review server is loopback-only at `http://127.0.0.1:8043/?view=plaza&lang=ko`; use `lang=en` for English. Its optional service endpoints are empty, and its local CSP disallows production Worker connections. No public tunnel or LAN listener is used. This URL lasts only while the task-owned local server runs.

The preceding compatibility inspection found Safari **26.6.2**, but an automated session could not start because remote automation was disabled; that setting was left alone. Firefox was absent from the inspected application, PATH and browser-cache locations. The GHCP embedded WebKit observations are **not Safari tests**. Physical mobile devices/native keyboards, actual GPU-driver failures and production latency remain unverified.

After separately approved merge, record the actual Pages build's commit and completion time, then perform a small manual KO/EN direct-entry and exact-Atelier/cancel check. Do not mistake a newer daily data refresh for this PR's deployment. If a regression appears, retain its URL/revision/error evidence, use the existing explicit recovery actions, and seek approval for a tested revert PR; do not reset history, discard newer generated data or start an automatic retry loop. No merge, deployment, branch-protection change or Done/Closed transition is authorized by this closeout.

## Atelier chat request follow-up: 2026-09-12

The reported screenshot shows three unavailable replies at 3/5 inside the correct exhibition, not a town-initialization error. Its URL, HTTP response and elapsed time were not available. The normal loopback review has no AI endpoint and already returns before incrementing the call count; it cannot explain that screenshot's 3/5. The changes below fix reproduced client defects, **not a confirmed diagnosis of the unobserved production request**.

### Reproduced defects and bounded repair

The unchanged Worker configuration gives its retrieval fetch 25,000 ms, but the Atelier client aborted after 9,500 ms. Replaying the actual pre-change request function with virtual time rejected a valid exact-repository reply at 10,000 ms. A second regression delivered headers but stalled JSON consumption: the client had already cleared its timer, leaving the body unbounded.

The client now waits at most 30,000 ms through headers **and body completion**. This allows the existing Worker fetch budget plus 5,000 ms of transport/body overhead; it does not extend the Worker fetch or model-runtime settings. HTTP failures, known service failures, malformed/empty or wrong-repository responses and network timeouts receive distinct, safe KO/EN guidance. Raw backend messages are not shown as answers or saved as assistant history. `chat.lastFailure` is a visit-local diagnostic category, not new storage or telemetry.

The five-**started**-call limit remains: failures and timeouts count, duplicate in-flight submissions do not start another request, closing/reopening the panel preserves the visit, and only room re-entry resets it. There is no automatic retry, model call refund, new service or change to foreign/fork closure.

### Local evidence, not live AI

Conditions: installed Chrome **152.0.7977.84**, Node **24.7.0**, KO/EN, 1440 x 900 and 390 x 844 touch emulation, with LOW_END/reduced-motion cases. The existing browser runner starts a task-owned loopback HTTP fixture only for the configured-chat cases. It forwards static GETs to the existing review server, returns canned replies through native browser `fetch`, keeps ambient AI disabled, and closes the fixture afterward. The normal review configuration is unchanged. No operational AI, realtime or telemetry endpoint was used.

All **24 hermetic commands** passed, with **1,565 Smoke checks**, including **69 first-visit checks** and **16 Atelier chat groups**; these are not additive totals. The targeted browser run passed **17 cases**: four existing foreign direct-Atelier entries, twelve chat cases, and the existing Atelier context-recovery case. The new cases cover delayed success, closed-panel completion, exact scope, malformed JSON, rate/access/configuration failures, five-call exhaustion, body timeout, room-exit cancellation, fresh re-entry and four disabled-service combinations. Korean cases also send UTF-8 Korean text. A timeout during simulated WebGL recovery preserved recovery focus until explicit resume.

The four delayed fixtures completed at **10,202 ms each**, measured at the fixture server. The two incomplete-body timeout fixtures were closed at **30,002 ms** and **30,000 ms**. These are local request-fixture durations, not production latency or new cold/warm measurements. Atelier-owned geometry/material/atlas counts stayed unchanged across chat outcomes, and the exterior remained paused.

Captured runtime, console-API and browser Log errors were **zero** in all 17 cases. Raw `Network.loadingFailed` was additionally recorded **only for the fixture endpoint**: 32 scoped requests, 28 completed responses and four expected pending-body cancellations (two timeouts, two explicit room exits), each `ERR_ABORTED` with `canceled:true`. This does not reclassify the earlier completed-consumption transport diagnostics or turn their 14/16 result green.

[Compact source/case evidence](atelier-chat-follow-up.json) · [Korean desktop failure/quota](atelier-chat-errors-ko-desktop.jpg) · [Korean mobile timeout after simulated recovery](atelier-chat-timeout-ko.jpg). Both images are local fixtures, not live AI or physical-device captures.

With the existing local server and isolated Chrome setup above:

```bash
REPOLIS_TEST_URL=http://127.0.0.1:8043/ BROWSER_CDP_URL=http://127.0.0.1:9351/ \
FIRST_VISIT_GROUP=atelier-chat,matrix,policy FIRST_VISIT_CASE=atelier \
node scripts/test-first-visit-browser.mjs
```

The ordinary review remains at `http://127.0.0.1:8043/?view=plaza&lang=ko` while its task-owned server runs, with AI/RT/analytics disabled. Actual live AI success, the screenshot's upstream cause, physical mobile/native keyboards, Safari/Firefox and hardware GPU failure remain unverified. No Worker deployment, merge, main push or branch-protection change is part of this repair; the exact final-head CI record belongs in PR #123 and the issue review record.

## Approved release and live Atelier follow-up: 2026-09-13

**PR #123 is merged and published; live grounding is only partially confirmed.**
The approved merge is `f7adafda62f5e078b7e29d20ae77d5a4fbcc8b79`, merged at
`2026-09-13T04:56:58Z`. The [Pages run](https://github.com/hyeonsangjeon/Repolis/actions/runs/34739091421)
built that exact revision at `2026-09-13T04:57:21Z`. Downloaded production HTML and
the Atelier helper matched the merge's Git blobs; production browser scripts were not executed.
This release did **not** deploy the Taxi Worker.

### Live conditions and observations

Conditions: 2026-09-13 UTC, installed Chrome **152.0.7977.84** on macOS, isolated
headless contexts, KO at 1440 x 900 and EN at 390 x 844 with touch/LOW_END emulation.
The ordinary repository card entered the exact `hyeonsangjeon/Repolis` Atelier and
triggered its existing automatic explanation. The Intent Lens picker still uses
`autoChat:false`; it was not changed to obtain these results.

A loopback-only overlay explicitly enabled the existing Atelier Worker connection
while disabling other AI, NPC AI, realtime and browser analytics. Native browser
requests went directly to the existing Worker through its existing CORS path.
There was no model-response mock, proxy, new credential, automatic retry or service
configuration change. Existing Worker-internal accounting was left unchanged.
The local admission gate allowed one request at a time, at most eight; it was stopped
after **seven**. Internal model-operation counts, model names, cache state and billing
were not exposed, so seven browser requests must not be reported as seven billed model calls.

The observed Worker version was `d3823cb5-ddce-4836-9d80-02aab8e81335`, serving 100%
of traffic, deployed at `2026-09-04T12:31:52.668Z`. Its 25,000 ms fetch timeout and
30-second retrieval runtime were unchanged. This is deployment metadata observed
during the run, not a per-response Git revision.

| Request / UI | Question or lifecycle step | Browser response time | Result |
|---|---|---:|---|
| 1 / KO desktop | Automatic repository explanation | 15,627 ms | No source |
| 2 / KO desktop | English metadata-first diagnostic follow-up | 6,900 ms | No source |
| 3 / EN mobile emulation | Automatic repository explanation | 8,153 ms | Exact repository reference |
| 4 / EN mobile emulation | Local run instructions, citing README | 11,996 ms | No source |
| 5 / EN mobile emulation | Fresh archive status and license | 12,138 ms | Archive status grounded; license unconfirmed |
| 6 / EN mobile emulation | Automatic explanation after room re-entry | 7,850 ms | Exact repository reference |
| 7 / KO desktop | Fresh automatic explanation, corrected error UI | 9,549 ms | No source |

These are heterogeneous diagnostic/lifecycle cases, not an accuracy-rate or latency
benchmark. Browser time covers native fetch through the application's single JSON
read, after local admission; it is not model inference time. All seven POST responses
completed with HTTP 200. Four carried `notFound:true` with no references and are
**not** grounded-answer successes. No live POST timeout or transport failure was captured.
Separate raw `ERR_ABORTED` observations on consumed bootstrap JSON still occurred;
the earlier strict-network **14/16** result is not being relabeled.

The three grounded replies cited only
[`hyeonsangjeon/Repolis`](https://github.com/hyeonsangjeon/Repolis). They described
the repository's walkable 3D town and reported `archived:false`. The license question
was not fully answered: the Worker explicitly said the retrieved metadata did not
contain a license. A separate public API check in the evidence is not substituted
for the Worker's missing evidence. No other repository was recommended.

Panel reopening preserved the current 3/5 budget and five history turns without a
request. Room exit cleared the visit. Re-entry sent empty history and started at
1/5 while reusing the same room: 25 geometries, 16 materials and three canvas textures;
exterior rendering stayed paused.

### Reproduced corrections and remaining uncertainty

**Observed defects.** A no-source reply was incorrectly attributed to general knowledge
and retained as assistant history. Closing chat could focus the hidden exterior taxi
control instead of a visible in-room control. The Worker projector also rejected
exact-repository directory/commit context despite matching MCP activity.

The follow-up treats no-source replies as explicit failures without false attribution
or assistant error history, restores focus to the visible Atelier exit when necessary,
and accepts directory/file/commit context only with a unique valid activity ID,
matching tool and exact owner/repo. Missing, duplicate, invalid or mismatched activity
proof still fails closed. Context alone never replaces the required repository metadata
reference. Five started calls, the 30-second whole-response deadline, visit isolation,
and fork/foreign-town closure are unchanged.

**Possible explanation, not confirmed cause.** Directory/commit rejection is reproducible
with local fixtures and could account for some no-source outcomes after those tools
ran. The live Worker did not expose its raw retrieval references/activity, so that
payload shape, an upstream missing record, source configuration and tool-specific
access cannot be separated from the recorded replies. Successful search-backed
replies establish a working connection, not that every retrieval path is healthy.
The original screenshot's URL/response is still unavailable; its cause remains unconfirmed.

Requests 1-2 used the merged client. Requests 3-7 used the local no-source correction.
The focus and Worker-context corrections were added afterward. The proposed Worker
change is **not deployed or live-verified**; a follow-up PR, explicit deployment
approval and a separately authorized bounded live check remain necessary.

### Final local regression evidence

Conditions: the same installed Chrome, KO/EN at 1440 x 900 and 390 x 844, including
LOW_END/reduced-motion cases; **local native HTTP fixtures, not additional live AI**.
All **24 hermetic commands** passed, with **1,568 Smoke checks**, including **69
first-visit checks** and **19 Atelier groups** (not additive totals).
The full Atelier browser group passed **16/16** with zero captured console and browser
Log resource errors. It covers no-source guidance/history, pending and no-source focus
restoration, reopen/re-entry, five-call limits, body deadlines, cancellation and disabled
services. The strengthened activity-correlation guards also reject missing, invalid
and duplicate identifiers while retaining valid numeric/string zero correlation.

[Compact release, live receipts and case evidence](approved-live-ai.json) ·
[Actual English grounded response, mobile emulation](live-ai-en-mobile.jpg) ·
[Actual Korean no-source response, desktop](live-ai-no-source-ko.jpg) ·
[Local fixture regression, explicitly not live AI](no-source-regression-en-mobile.jpg).

The normal review remains `http://127.0.0.1:8043/?view=plaza&lang=ko`, with AI/RT/analytics
off after the bounded live run; use `lang=en` for English. Physical mobile, native
keyboards, Safari/Firefox, hardware GPU failure and extreme-proximity world-space
text overlap remain unverified or unresolved. A rollback, if requested, should use a
reviewed revert PR and the same gate, then confirm its Pages revision; neither a
force-push nor a Worker rollback is implied by this static-site release.

## Taxi deployment and bounded live follow-up: 2026-09-14 UTC

**Deployment succeeded; complete Atelier answer normalization did not.** Of eight
sequential browser requests, three answered the requested facts: KO/EN repository
overviews and one explicit `LICENSE`-path diagnostic. A valid repository reference
or HTTP 200 is not an answer-quality pass.

PR #126 merged as `84e8b3056746a72eef9710c8460dde7b36a74c7f`.
[Pages run 34855862621](https://github.com/hyeonsangjeon/Repolis/actions/runs/34855862621)
published that revision at `2026-09-14T14:29:12Z`; downloaded HTML matched the merge
blob. All 24 hermetic commands passed on the clean merge before Taxi deployment.
Worker version `d3823cb5-ddce-4836-9d80-02aab8e81335` was replaced by
`2f7cc207-71bb-40ef-8060-019d83ebaf96` at 100% traffic. Its source annotation identifies
the merge above; deployment completed at `2026-09-14T14:32:03.952755Z`.
Committed configuration, remote binding descriptors and runtime settings matched
before/after. No secret update, permission change, model/budget adjustment or other
service deployment was requested.

### Live conditions and content verdicts

Installed Chrome `152.0.7977.84` on macOS, native browser-to-Worker POSTs from a
loopback-only review. Two isolated contexts started as KO desktop (1440 x 900) and
EN mobile emulation (390 x 844). They were later resized to the opposite viewport
without more calls; this is not four independent cold starts or real-device QA.
Only exact `hyeonsangjeon/Repolis` Atelier calls were enabled. Other NPC AI,
ambient AI, RT and browser analytics stayed off. No browser credential, proxy or
automatic retry was used. The eight-call cap included both automatic explanations.

Times below run from the browser request through complete JSON consumption. They
are not internal model-call counts; those counts were not exposed by these
responses. Every POST completed with HTTP 200, but only **3/8** answered its question.
All seven reference-bearing responses cited exactly
`https://github.com/hyeonsangjeon/Repolis`; the remaining response had no references.

| Call | Question | Browser time | Content result |
|---|---|---:|---|
| 1 | KO automatic overview | 12,179 ms | Answered: public repos as a walkable 3D town. |
| 2 | KO README local-run commands | 15,109 ms | Unanswered: reply said README body/commands were unavailable. |
| 3 | KO license | 12,760 ms | `notFound`; the existing response did not identify the rejected predicate. |
| 4 | EN automatic overview | 8,885 ms | Answered: 3D town, repo-shaped buildings, residents and Gitber. |
| 5 | EN README local-run commands | 12,947 ms | Unanswered: no commands or install/build conclusion. |
| 6 | EN license | 14,236 ms | Unanswered: reply could not verify license information. |
| 7 | Explicit `get_file_contents`, `README.md` path | 12,635 ms | Unanswered: reply said the retrieved excerpt omitted the run section. |
| 8 | Explicit `get_file_contents`, `LICENSE` path | 13,169 ms | Answered: MIT, matching committed LICENSE and public metadata. |

The ordinary six questions therefore passed **2/6**, and the two explicit-path
diagnostics passed **1/2**. The successful LICENSE diagnostic is not proof that the
path instruction caused success: prompt, history and tool choices also differed.
README's actual instructions are `git clone`, `cd Repolis`, and
`python3 -m http.server 8000`, with no installation or build step. No live reply
provided those commands in this phase.

### Confirmed correction versus remaining source uncertainty

Calls 2, 5, 6 and 7 explicitly declined to answer the requested facts but were still
returned as successful, reference-bearing replies. Replaying their actual delivered
strings through the Worker handler with synthetic valid repository metadata
reproduced all four misclassifications. This replay uses **no network** and is not a
reconstruction of the original KB payload.

The follow-up moves the existing refusal guard into the pure Atelier module,
handles observed KO wording and typographic English apostrophes, and retains all
exact-repository/activity/tool checks. It requests actual file evidence and an
explicit missing-answer marker. Safe failure reasons and two reference counts
distinguish rejected/absent repository evidence from empty/unavailable answers;
raw file content, prompts and credentials are not added to diagnostics. Failed
answers keep the existing counted-turn/no-assistant-history client path.

The corrected local replay rejects **4/4** of those strings, emits no delivered-answer
events and makes one fixture retrieval per case. All **24 hermetic commands** passed,
with **1,573 Smoke checks**, including **24 Atelier groups** and **69 first-visit
checks** (not additive totals). The four affected KO/EN desktop/mobile no-source
HTTP-fixture cases passed with zero captured console or browser Log resource errors.
Existing limit, deadline, cancellation and context-correlation fixtures remain in
the shared gate. **This follow-up has not been deployed or live-tested.**

The live replies show missing requested facts in synthesis, not a client timeout:
all eight POST bodies completed before the unchanged 30-second client deadline.
They do not establish whether MCP source output, excerpt selection or synthesis
lost the README section. Raw KB references/activity arguments and file payloads
were not exposed; the original cause of call 3 remains undetermined.

### Lifecycle and remaining review boundaries

Panel reopen retained history and counters without requests. EN reached 5/5 and
disabled submission; reopening focused the accessible Close button rather than
the disabled input. Exit released chat state. Reentry through the existing Intent
Lens picker reset both visits to 0 calls/0 history and reused the one room
(25 geometries, 16 materials, three canvas textures), without a ninth request.
The existing `autoStarted:true` latch suppresses automatic calls for that picker.

There were zero captured live console errors or Worker POST transport failures.
Startup still recorded three static-response `ERR_ABORTED` events across the two
contexts (`city-state.json` and/or `council.config.json`); **strict network cleanliness
is not claimed**. After EN mobile-to-desktop resizing and room exit, the restored
repo-card Close button could not be hit and Escape from outside the card did not
dismiss it; backdrop dismissal worked. This is not an accessibility pass for #120.
Real mobile/native keyboard, Safari/Firefox and hardware GPU recovery remain
unverified, and the existing #120/#122 gaps stay open.

[Compact actual responses, source comparison and local replay](atelier-postdeploy-ai.json) ·
[Actual KO overview](atelier-postdeploy-ko-desktop.jpg) ·
[Actual EN LICENSE diagnostic, mobile emulation](atelier-postdeploy-en-mobile.jpg).

The live-call server was stopped after eight requests. Ordinary review remains
`http://127.0.0.1:8043/?view=plaza&lang=ko` (`lang=en` for English), with AI/RT/browser
analytics off. A further Worker release and a fresh bounded live phase require
approval; no additional call, rollback or configuration expansion was performed.

## Complete document candidate: 2026-09-15 UTC

**One local Worker answer now provides the actual README run commands. Production
confirmation is still pending at this checkpoint.** The answer says to clone the
repository, enter `Repolis`, run `python3 -m http.server 8000`, and open
`http://localhost:8000`; it correctly states that installation and a build are not
required. The source is the current public `hyeonsangjeon/Repolis` README, not a
different repository or a visitor-supplied file path.

Before modifying the candidate, the full hermetic gate passed on
`0abacaef0a3286c9c6c5211eb3c4752c11dee195`. The approved pending #127 Worker code was
deployed from that revision: `2f7cc207-71bb-40ef-8060-019d83ebaf96` became
`1ddde1ca-d368-4a0a-afd0-387542ab9243` at 100% traffic. Deployment time was
`2026-09-15T05:10:15.153566Z`; binding descriptors, runtime settings and configured
budgets were unchanged. This deployment is not a deployment of the later candidate.

### What the recorded requests establish

Six browser-to-local-Worker requests used real providers. They are heterogeneous
debugging samples, not a controlled success-rate or latency benchmark. The
eight-request allowance includes an unintended fixture-origin request whose
answer was not captured. That request was counted, not discarded. Two requests
remain reserved for the merged production deployment.

| Request | Observed outcome | Browser elapsed time |
|---|---|---:|
| 1, baseline KO local run | Two repository searches, no file call; one exact metadata reference passed and none were rejected. No answer. | 13,381 ms |
| 2, harness incident | A service-off fixture inherited the live endpoint. Response unobserved; not a content pass. The fixture and live servers are now separate, and the live lane requires one-shot question arming. | Not captured |
| 3, discarded candidate | No repository reference with extractive output and low retrieval effort. Both overrides were removed; their effects were not isolated. | 4,787 ms |
| 4, restored KB defaults | Exact metadata arrived; workerd rejected `redirect: "error"` before the document fetch. A no-model runtime probe confirmed `manual` works without following redirects. | 10,260 ms |
| 5, manual redirects | Both MCP search activities reported zero returned documents. No answer. | 11,635 ms |
| 6, complete-document candidate | Actual clone, directory and static-server commands, with the correct no-install/no-build statement and exact repository/README references. | 20,416 ms |

For request 6, the internal metadata lookup called `get_file_contents` for the
exact `README.md`, but the returned reference contained 1,782 characters and
lacked the exact local-run command. The separate public read supplied the complete
21,724-byte README to the existing Entra-authenticated model. Characters, bytes and
API-reported tokens are different quantities. This observation does not establish
which MCP parsing or excerpt-selection step affected every earlier failure.
Content acceptance was a manual comparison with the public source, not an
independent model-quality evaluation.

### Repair and remaining boundary

MCP and its existing authentication remain the first lookup. Rejected/private
references still fail closed. A successful-but-empty lookup may obtain one exact
anonymous public repository proof before reading the README or license. Complete
file evidence, not a metadata-only answer, reaches synthesis. The existing model,
configuration and budgets remain unchanged; no automatic retry was added.

The first valid answer exposed a separate presentation defect: fenced commands
were rendered as bold text and a long URL exceeded the mobile bubble. The scoped
Atelier formatter now escapes markup, preserves code line breaks, and wraps long
commands and file links. Twenty local HTTP-fixture browser cases passed in KO/EN
at 1440 x 900 and 390 x 844, with zero captured console/resource errors. These are
replays, not additional real model calls. They retain the five-started-call limit,
panel-reopen continuity, exit/re-entry reset, and 30-second response-body deadline.

The candidate's complete hermetic gate also passed. None of these results closes
#120's near-camera world-space text or exterior-card accessibility gaps. Physical
mobile devices, native keyboards, Safari/Firefox and hardware WebGL recovery
remain unverified. Final merge, Pages and production-Worker evidence belongs in
the subsequent release record on [#122](https://github.com/hyeonsangjeon/Repolis/issues/122).

[Captured responses, source fingerprints and the compact browser matrix](atelier-documents-candidate.json).

## Authenticated document transport: 2026-09-21 UTC

**The same Cloudflare document path now reads the complete public README and
LICENSE with the owner's existing, explicitly authorized GitHub credential.**
These are document-only preview checks; final production dialogue remains pending
in this pre-release record.

The preceding anonymous probes established GitHub `core` quota exhaustion:
HTTP 403, `x-ratelimit-remaining: 0`, and an explicit rate-limit message. Waiting
until the provider's reset allowed one README read, but the subsequent LICENSE
read again exhausted the anonymous quota. That sequence did not justify
redeploying the unchanged #128 Worker.

The repair adds the optional server secret `ATELIER_GITHUB_TOKEN`, reusing the
existing owner-authorized credential without creating a token or adding GitHub
permissions. Requests stay on `api.github.com` with manual redirects and the same
byte and time limits. Every authenticated document read first requires fresh
exact-repository metadata with `private: false`, even if MCP already supplied a
matching reference. Private, rejected or conflicting evidence cannot be rescued
by the credential. No secret enters the client, model messages or response trace.

Authenticated `wrangler dev --remote` ran the actual request-header helper on the
Cloudflare network using the existing Worker identity and compatibility date.
The preview had no production bindings or model calls and did not change live
traffic. The temporary mode-0600 credential transfer file was removed on exit.

| Probe | Exact-repository GET | GitHub status | Result |
|---|---|---:|---|
| 4 | Repository metadata | 200 | Canonical identity and explicit public visibility verified. |
| 5 | README | 200 | Complete 21,724-byte `README.md`; blob `ed31bdb801d30e0bed30ae18baeacd136e40f24d`. |
| 6 | License | 200 | Complete 1,083-byte `LICENSE`; blob `127c4643a61d5c0a7369162b8fc82a85c3596ea8`. |

The blobs match the committed public source. Both document bodies passed the
production projection's path, encoding, size and same-repository URL checks.
All six diagnostic GET slots are now used, including the three earlier anonymous
probes and the new metadata request. The three approved final dialogue calls
remain unused. There was no retry loop, new proxy, host change or model change.
The two groups ran on different days; these observations are functional evidence,
not a latency or population-level reliability comparison.

Focused fixtures cover the quota failure, authenticated metadata visibility,
private and mismatched references, malformed or expired credentials, redirects,
secret separation and whole-response deadlines. The full hermetic gate passed.
Twenty KO/EN browser fixtures at 1440 x 900 and 390 x 844 also passed with zero
captured console/resource errors, including command blocks, expanded source links,
five started calls, reopen continuity and re-entry reset. Those are local HTTP
fixtures, not additional live model calls or physical-device coverage.

[Sanitized GET records, source fingerprints and browser results](atelier-authenticated-documents.json).
Final production version, questions and release verdict belong in the subsequent
[#122 record](https://github.com/hyeonsangjeon/Repolis/issues/122). Unrelated #120
and #122 acceptance criteria remain open.

## Single-pass document answers: 2026-09-21 UTC

The authenticated document repair in #129 passed its Cloudflare GET probes, but
its first production question returned `timeout 25000ms` in 25,317 ms of browser
time. The response did not identify the expired stage. Production was restored
to `1ddde1ca-d368-4a0a-afd0-387542ab9243`, and the other two questions were not sent.

The next change removes unnecessary work from the authenticated path rather than
extending the deadline. Exact authenticated public metadata, then one complete
README or license, feeds a single existing Entra-authenticated synthesis. No MCP
query planner or intermediate KB answer is invoked in that path. The existing
MCP-first route remains for installations without the GitHub credential.

This does not relax the public boundary: explicit `private: false`, exact
canonical identity, bounded complete documents and manual redirects are still
required. The model, 400-token completion cap, shared 25-second Worker deadline,
30-second client deadline and five-started-call visit budget are unchanged.
Failures carry a bounded stage identifier, without provider bodies or secrets.
Direct answers identify their public REST/document source and emit no KB-query
event; the UI does not label a nonexistent MCP call.

Hermetic fixtures supply a KB dependency that throws if the authenticated path
invokes it. They verify exactly two public GETs and one synthesis, unchanged
private/mismatch/redirect refusal, complete long documents and deadlines through
metadata, document, token and model bodies. This establishes the implemented
call graph, not the measured cause of the earlier timeout or production speed.
The KO/EN browser matrix also checks the direct-document source label alongside
the existing chat lifecycle and wrapping cases.

No extra document diagnostic or model comparison was run. After the user's
continued all-approved objective, final acceptance is limited to three fresh
production questions (the two previously remaining calls plus one additional
call): Korean local run, English local run and license. Their actual answers,
sources, timing and deployment verdict belong in the release record on
[#122](https://github.com/hyeonsangjeon/Repolis/issues/122); local fixtures alone
do not establish that result. Unrelated accessibility and physical-device
criteria remain open.

## Entra token request follow-up: 2026-09-21 UTC

The first single-pass production request reached `model_authentication` before
the shared 25-second timer expired. This establishes that public metadata and
document validation had finished, but not how much of the deadline they used.
The production Worker was restored before further diagnosis; no second dialogue
was sent against that failed candidate.

An authenticated Cloudflare remote preview then ran only the production Entra
token helper, with an eight-second bound and no document, MCP or model request.
Wrangler 4.131.2 inherits deployed secrets server-side in remote previews; no
secret value or tenant/client identifier was read into the agent's output.
Earlier descriptions of previews as having no secrets refer to their explicit
configuration and unused credential paths, not an assertion that Wrangler
disables inherited bindings.

| Token-only probe | Body representation | Result |
|---|---|---|
| Baseline | `URLSearchParams` | No headers before the eight-second diagnostic timeout. |
| Explicit serialization | String form body | HTTP 200 and a token in 662 ms. |
| Reversion, cache cleared | `URLSearchParams` | HTTP 200 and a token in 458 ms. |
| Exact candidate helper | String form body, manual redirects | HTTP 200 and a token in 670 ms. |

Because the reversion also succeeded, these probes do **not** prove that the body
object alone caused the original stall. Cold or transient provider behavior
remains a possible confound. The minimal hardening explicitly serializes the
OAuth form and refuses redirects, while preserving the existing credentials,
scope, token cache and cancellation signal. The exact helper's encoded fields,
cache reuse and redirect refusal are covered by hermetic tests.

Token bodies were never returned or persisted. The probe output contains only
configuration-shape booleans, request/response type, status, elapsed time and
token-availability boolean. This is authentication verification, not an inference
success or proof that a production answer finishes on time. Final dialogue
acceptance is recorded separately on [#122](https://github.com/hyeonsangjeon/Repolis/issues/122).
