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
