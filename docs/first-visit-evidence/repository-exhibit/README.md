# Repository Exhibit: source and browser evidence

The reviewed implementation at `378a24e8bb7ef164ec24ff35792a488b38da13df` passed
**34 exhibit cases, 24 directly affected existing browser cases, and all 29 hermetic
commands**. Entry now presents the exact public repository and description; an
explicit README action provides source excerpts and copyable code without an AI
question. This is a source-fidelity and interaction result, not proof that every
quoted installation procedure works on every platform.

The [machine-readable record](results.json) includes source receipts, case results,
resource observations, and SHA-256 fingerprints of the tested runtime and runners.
[Issue #134](https://github.com/hyeonsangjeon/Repolis/issues/134) and its release PR
hold the final CI, merge, and Pages receipts. These measurements precede publication.

## Comparator and conditions

The original entry at `4697b29f200895be537234c97382071dad99e81a` placed the Core in
the center and the description on a side wall. The revised entry moves the Core
aside, reuses the front atlas for the public description, and adds an explicit
README reader to the existing room. Statistics, history, avatar, and the other
two atlases remain. No new scene, geometry, material, texture, or model was added.

Recorded on **2026-10-02**, using macOS, Node **v24.7.0**, and headless
**Chrome/154.0.8037.93** via CDP. The application clock was fixed at
`2026-09-08T14:00:00Z`, with seed `120121122`. KO/EN entry observations used
**1440x900** desktop and **390x844** mobile emulation. The mobile source/entry
cases enabled LOW_END and reduced motion. Input cases also used **844x390**
landscape and both resize directions.

Production AI, realtime, and analytics were disabled. GitHub API responses and
repository thumbnail images were fixtures; chat regression cases used a bounded
local HTTP fixture, not a model. Two anonymous, bounded public README reads
prepared the original source fixtures. **Live model calls: 0. Worker deployments: 0.**

| Same entry flow | Before | After |
|---|---|---|
| KO, 390x844 | [Original room](before-ko-mobile.jpg) | [Purpose first](after-ko-mobile.jpg) |
| EN, 1440x900 | [Original room](before-en-desktop.jpg) | [Purpose first](after-en-desktop.jpg) |

The flow was Plaza/first entry → Wayfinding → Understand one repository → Repolis.
Entry performed **zero README requests**. The extra startup request is the
**13,944-byte** local exhibit module, not a repository or model request.

## Original-source checks

The public README bytes were captured on 2026-10-02 and verified against their
Git blob hashes. The two committed fixtures are unchanged originals, not rewritten
examples. The displayed read time in deterministic browser tests is the fixed
application clock, not the source-download date.

| Public repository | README blob SHA | UTF-8 bytes | Selected source |
|---|---|---:|---|
| `hyeonsangjeon/Repolis` | `c46888b2abceb622716034e9bef99f31b4a5edbd` | 22,110 | `Run in 60 seconds`; two code blocks, including the separately introduced optional data rebuild |
| `hyeonsangjeon/youtube-dl-nas` | `a9f86d1041b00b37bdd81840e12c85b09fa9c464` | 29,849 | `Start Here`, `Quick Start`, `Docker Options`, `Local Development`; eight code blocks |

Repolis retained `python3 -m http.server 8000` and its no-install/build condition.
The NAS excerpt retained `.env`, `MY_ID`/`MY_PW`, persistent-volume notes, the
host-network variant, and the separate `Auth.json` prerequisite for local
development. Every displayed code block was compared with its original source.
The first code block for each repository was also copied through the browser
clipboard in all four language/viewport combinations and matched the original.
The review did not execute the quoted deployment commands.

| Reading surface | KO mobile | EN desktop |
|---|---|---|
| Repolis | [Original code and conditions](repolis-ko-mobile.jpg) | [Original code and conditions](repolis-en-desktop.jpg) |
| youtube-dl-nas | [Original code and conditions](nas-ko-mobile.jpg) | [Original code and conditions](nas-en-desktop.jpg) |

The reader preserves source-language text and exposes heading, line range,
branch/ref, document blob SHA, and read time. The ref may move; the blob SHA is
**not a commit SHA**. Excerpts are not a complete procedure or support matrix.
Other headings or linked files may contain additional prerequisites.

## Request and resource bounds

| Boundary | Implemented limit |
|---|---|
| README access | One explicit anonymous exact-repository GET per visit; no retry or prefetch |
| Whole-response deadline | 8 seconds, including the response body |
| Response / document | 128 KiB JSON, including base64 / 64 KiB decoded UTF-8 |
| Excerpts | Six complete sections, twelve code blocks, 24 KiB total |
| Individual section / code | 12 KiB / 8 KiB; oversized or incomplete sections are omitted, not cut into commands |
| Media / persistence | Zero media bytes; visit-only memory, cancelled and cleared on exit/rebind |
| Existing room | One room, 25 owned geometries, 16 materials, three canvas atlases |

Desktop atlas dimensions remained `1536x960`, `1536x960`, `1536x576`; compact
dimensions remained `1024x640`, `1024x640`, `1024x384`. History and signals
pixel hashes matched before/after in each condition. Only the front atlas changed.
Reading and reopening added no room resources. Interior renders issued zero
exterior draws, and reentry reused the same room identity.

The following CPU measurements time `renderer.render()` submission, not GPU work
or complete application-frame cost. Each condition had one observation per
revision, with the first 20 samples discarded and 80–83 retained CPU samples.
The 95th percentile is the sorted sample at `floor(0.95 * count)`, rounded here
to 0.1 ms. This one-machine sample does not establish a frame-rate gain.
Background system load was not controlled. Draw counts describe the captured
entry frame; peaks and full sample counts remain in `results.json`.

| Condition | Before p95 CPU ms | After p95 CPU ms | Before / after interior draw calls |
|---|---:|---:|---|
| KO desktop | 1.5 | 1.5 | 61 / 61 |
| EN desktop | 1.1 | 1.4 | 61 / 61 |
| KO mobile emulation | 1.7 | 1.4 | 61 / 54 |
| EN mobile emulation | 1.6 | 1.3 | 61 / 54 |

The mobile viewpoint changed, so its draw-count difference is not a claim of
geometry removal or an isolated rendering optimization. Median observed frame
intervals were 16.7 ms in all four conditions; physical-device performance was
not measured.

## Verification and review boundaries

The final 58 browser cases cover source/clipboard fidelity, a named accessibility
dialog, labelled controls, keyboard and emulated touch, IME-event guards,
Escape ownership, focus restoration, resize, exact outside return, strict direct
Atelier/Blueprint entry, chat continuity and five-started-call limits, empty and
archived repositories, missing descriptions, hostile text/URLs, 404/403/429,
redirect refusal, timeout, size limits, and stale document/copy results.
All normal cases had zero console/resource errors. Injected HTTP/redirect failures
are recorded separately; their expected failures were not counted as successful
document reads. The hermetic exhibit suite contains **72 checks**.

A separate same-agent source/diff/screen review found and corrected unread error
body cancellation, `Install`/`Installing` recognition, blank-line preservation in
indented code, unnecessary quadratic selection, async source-link focus loss,
hidden return-focus targets, and copy/status races. An earlier exploratory run
also passed 127 existing browser cases; it is not counted as 127 additional
final-revision cases. No independent semantic reviewer was used.

The original dirty NPC work in `grounded.js`, `npc-budget-governor.js`,
`smoke.mjs`, and `test-npc-budget-governor.mjs` remained byte-identical and outside
the exhibit commits. The smoke file was not edited; the new behavioral tests
explicitly establish that entry no longer invokes the legacy auto-explain helper.

Physical devices, native IME, screen-reader interaction, Safari/Firefox, and real
GPU failure remain unverified. The WebGL recovery case is a simulated browser
event, not hardware evidence. Those manual criteria remain with #120 and #122.

## Reproduce locally

Use a loopback static server with production AI/RT/analytics disabled and an
isolated Chrome debugging endpoint. The browser runner rejects non-loopback test
URLs, intercepts public API/thumbnail fixtures, and blocks production Workers.

```bash
bash scripts/check-hermetic.sh
REPOLIS_TEST_URL=http://127.0.0.1:8000/ BROWSER_CDP_URL=http://127.0.0.1:9222/ \
  FIRST_VISIT_GROUP=exhibit node scripts/test-first-visit-browser.mjs
```

`EXHIBIT_BASELINE=1 FIRST_VISIT_REFERENCE=4697b29f200895be537234c97382071dad99e81a`
with the `exhibit` group replays only the four original entry observations.
