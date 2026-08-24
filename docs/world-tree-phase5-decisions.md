# World Tree Phase 5 experiment decisions

Decision date: 2026-08-24. Parent backlog: [#81](https://github.com/hyeonsangjeon/Repolis/issues/81).

Phase 5 is a decision gate, not a promise to build every idea. The current generated snapshot has 68
public repo houses, nine active residents, nine included public forks, and zero archived repositories.
The controlled Chrome cold baseline is 3,001,294 decoded bytes and 42 requests against the 5 MiB ceiling.

| Candidate | Decision | World-model value | Current evidence | Data source | Privacy | Runtime / network cost | Cold-load / draw-call cost | Accessibility | Removability |
|---|---|---|---|---|---|---|---|---|---|
| Session footprints | **SHIP** | Makes walking leave a brief, mortal trace without adding explanatory UI. | The local avatar already has authoritative post-collision `moving` and position state. | Current-tab, in-memory local avatar samples only. | No storage, identity, peer/resident replay, analytics, socket, or backend. | Zero requests; bounded typed-array ring updated only for the local exterior walk. | One small module and one instanced draw; caps are 36 desktop, 18 LOW_END, and 8 reduced-motion. | No copy required; reduced motion uses wider spacing, a short static lifetime, and the smallest cap. | `assets/session-footprints.js`, one runtime block, and its tests can be removed together. |
| Public fork lineage | **SHIP** | Gives an honest origin detail to houses that are already known forks without claiming authorship or kinship. | 9/68 current houses are committed-to forks; all nine expose an accessible public canonical source. | Daily build only: bounded lookup for included public forks, then generated `repos.json`. | Public `owner/name` and canonical GitHub URL only; inaccessible or malformed sources become no lineage. | Runtime GitHub API remains zero; current build delta is at most nine REST reads. | A tiny generated field plus one shared batched crest palette; no source-specific texture/material. | Exact source appears as KO/EN text and a normal focusable `noopener` link in the repo card. | Generator helper, generated field, crest batch, card row, and lineage tests form one boundary. |
| Returnee event | **DEFER** | A real return could deepen the half-mortal model, but inventing one would weaken it. | Archived repositories are currently 0, with no observed public archived-to-active transition. | No truthful transition source is committed today. | A future design must remain public and snapshot-based. | Unknown until a deterministic daily transition contract exists. | Zero now: no runtime event, field, fixture placeholder, or UI was added. | Must define non-motion meaning and avoid implying restored Bound memory. | Re-enter only after daily snapshots prove the transition deterministically and a real case or explicit fixture contract exists. |
| Contributor windows | **DEFER** | Contributor count does not currently justify replacing a stronger existing city meaning. | Night window glow already means repository activity; visit lighting is separately owned. | Accurate bounded contributors and bot filtering are not available in the current batch contract. | Public counts still risk misleading identity/credit implications. | Per-repo contributor reads and filtering would expand the 68-repo API budget. | A separate visual grammar and batching budget are not defined. | A non-color-only explanation would be required without overloading the card. | Re-enter only with a bounded public source, explicit bot rule, API budget, and a distinct visual channel that preserves activity glow. |

## Session-footprint ship evidence

- Cold boot: 3,010,884 decoded bytes and 43 requests, a direct delta of **+9,590 bytes / +1 request**.
- Frozen-pose desktop active-cap A/B: **+1 draw, +216 triangles, -0.81% render median**.
- Frozen-pose LOW_END active-cap A/B: **+1 draw, +108 triangles, 0.00% render median**.
- Desktop/LOW_END/reduced-motion caps observed as 36/18/8. Reload starts at zero; taxi, teleport,
  Growth Replay, hidden/non-walking frames, and Atelier movement created zero footprints.
- The footprint boundary contains no storage, cookie, analytics, network, WebSocket, peer/resident,
  identity, or collider path. Page navigation clears or tears down the one pool.

## Guardrails for the two approved experiments

- Each experiment ships in its own branch, commit, PR, test boundary, merge, Pages deployment, and live QA.
- Runtime external API requests remain unchanged; neither experiment calls a Worker, model, analytics sink, or
  recurring service.
- World Tree silence, Shared/Bound authority, ambient-AI hard-off, activity-window meaning, resident movement,
  fork-safe local behavior, and the zero-build runtime remain unchanged.
- A visible frame-time regression above 5%, cold decoded load at or above 5 MiB, or an unbounded scene/allocation
  path rejects the experiment instead of weakening those contracts.
