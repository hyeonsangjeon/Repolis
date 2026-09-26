# Readable & Controllable Town

This frontend release addresses the remaining near-camera names and card/Atelier
input paths in #120 and #122. It does not change the working Atelier answer
backend, model, credentials, budget or deployment. Local browser verification
blocks AI, realtime and browser analytics; all backend outcomes are fixtures.

## Changed behavior

Resident and scholar sprites keep their existing materials and depth tests.
Their world labels now show names, with roles available in the existing
Wayfinding panel's **Choose someone nearby** controls and chat heading. A hidden
label does not remove the nearby person's dialogue action. The nearby roster
updates on explicit panel/disclosure interaction, not through an `aria-live`
feed of moving NPCs.

The screen admits at most six desktop or four mobile/LOW_END nameplates.
Projected height is at most 32/28 CSS pixels, with a 176/148-pixel width ceiling.
Existing speech, open UI, bottom-right controls and safe-area gutters take
priority. Conversation partners outrank nearby/ambient names. Retained slots,
distance buckets and a 400 ms nearby-target dwell prevent minor camera or
distance changes from alternating names. Behind-camera and near-plane candidates
are not drawn. Physical sign planes keep their texture and geometry but cap
their projected corners to 260 x 84 pixels near the camera; crossing the near
plane suppresses that plane until it is projectable again.

Cards have a separately scrolling body and a fixed, 48 x 48-pixel Close control.
Resizing inside the Atelier no longer makes the restored card's close action
unreachable. An initial delayed hash action cannot reopen the exterior card over
a room entered in the meantime. Escape closes one active owner even when focus
was moved outside it; a held Escape cannot cascade through panels and rooms.
Existing guided-tour and recovery ownership remains authoritative.

Tab/Shift+Tab stay within the active panel, input is cleared when ownership
changes, and delayed chat focus restoration cannot steal focus from a new card.
IME Escape/Enter does not dismiss or submit. Suggested questions and related
repository/handoff actions are native buttons. The card chooses a readable
foreground for its existing accent color, and small metadata text has stronger
contrast. Card return preserves the source repository and scrolling position.

## Repeatable evidence

[Measurements and source fingerprints](readable-town.json) distinguish the
pre-fix reproduction, current behavior and the existing compatibility cases.
The baseline HTML is immutable `ebdf5d3df83d82546c507c260051a6302710d82f`.
Both runs use the same committed catalog, seed, application-date fixture,
camera poses, CSS viewports and browser runner. Scripted ambient timing and
host scheduling are not a controlled benchmark; no claim of a general FPS gain
is made from the render medians.

The new cases cover KO/EN at 1440 x 900 and 390 x 844, 844 x 390 landscape,
LOW_END/reduced motion, near/reversed/edge/behind-camera poses, crowded talking
priority, accessible hidden-person selection, native Enter/Space and touch
activation, focus trapping, IME events, both resize directions, and rapid
card/Atelier/Blueprint return. Earlier assertions were run against the old code
and failed; `READABLE_BASELINE=1` records those known defects, not a quality pass.

Pixel hashes come from the actual existing label canvases. Texture byte counts
are canvas RGBA backing bytes, not total GPU VRAM. Controller timings cover the
new label/sign update only, not the whole frame. Resource checks retain the
actual material/texture identities across selection and verify no steady-frame
DOM layout reads. There is no new scene geometry, material, texture, storage,
service or external runtime dependency for this feature.

| Same-protocol view | Before | After |
|---|---|---|
| KO mobile names | [Near crowd](readable-town/before-readable-labels-ko-mobile-near.jpg) | [Bounded names](readable-town/after-readable-labels-ko-mobile-near.jpg) |
| EN desktop names | [Near crowd](readable-town/before-readable-labels-en-desktop-near.jpg) | [Bounded names](readable-town/after-readable-labels-en-desktop-near.jpg) |
| KO mobile → desktop card return | [Clipped controls](readable-town/before-readable-card-ko-mobile-resized.jpg) | [Fixed close target](readable-town/after-readable-card-ko-mobile-resized.jpg) |
| EN desktop → mobile card return | [Unbounded card](readable-town/before-readable-card-en-desktop-resized.jpg) | [Scrollable card](readable-town/after-readable-card-en-desktop-resized.jpg) |

For a local reproduction, serve the repository with an AI-off loopback server
and use an isolated installed Chrome CDP endpoint, as in the parent
[evidence guide](README.md#reproduction-and-release-boundary):

```bash
REPOLIS_TEST_URL=http://127.0.0.1:8050/ \
BROWSER_CDP_URL=http://127.0.0.1:9261/ \
FIRST_VISIT_GROUP=readable-town \
FIRST_VISIT_OUTPUT=/absolute/path/to/evidence \
node scripts/test-first-visit-browser.mjs
```

To replay the historical comparison, also set `READABLE_BASELINE=1` and
`FIRST_VISIT_REFERENCE=ebdf5d3df83d82546c507c260051a6302710d82f`.
Do not use the historical observation mode as a release gate. The current
hermetic command list adds the readable-town fixtures and browser-case syntax
check without removing or skipping the previous checks.

## Remaining physical-device checklist

Chrome emulation is not proof of physical touch, a native keyboard/IME, Safari,
Firefox, a notched display, assistive-technology behavior, or hardware WebGL
recovery. These remain owner/reviewer checks; do not mark their board items Done
from the automated results.

1. On a real phone with a safe-area inset, open a repo card, enter its Atelier,
   rotate in both directions and exit. The same card should return, with Close
   reachable, a scrolling body and no page movement behind it.
2. With a hardware keyboard and then the native Korean IME, traverse the card's
   questions/actions using Tab and Shift+Tab. Enter/Space should activate once.
   Escape while composing should cancel composition rather than close the panel;
   a later Escape should close only the active panel and restore meaningful focus.
3. Approach and circle a resident/scholar crowd. Names should remain bounded,
   avoid other names and speech, and favor the current conversation. A person
   whose label is hidden should still be reachable through the nearby selector.
4. Repeat with reduced motion and screen-reader navigation. Names/roles and repo
   titles should be discoverable through DOM controls without repeated live
   announcements. Verify contrast and text scaling on the physical display.
5. Repeat direct Plaza, Atelier and Blueprint entry in Safari and Firefox. Use
   their real context-loss/recovery facilities if available, and distinguish
   native GPU failures from simulated Chrome context loss in the record.

The four pre-existing dirty NPC-budget files in the shared checkout are not part
of this release. Their byte hashes and original diff are checked separately
throughout implementation and release; neither the source hunks nor their tests
are silently included or deployed.
