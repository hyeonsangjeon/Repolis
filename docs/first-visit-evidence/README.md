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
