# Repo Portal change guide

Repo Portal gives one public repository its own front door into Repolis:

```text
https://hyeonsangjeon.github.io/Repolis/?repo=owner/repo&ref=repo-portal
```

This is the product change most likely to improve Star acquisition because it shortens the path from a
developer sharing real work to a visitor understanding Repolis. A repository link now opens one
metadata-shaped building and its Repository Atelier before Repolis requests the owner catalog. The recipient
gets relevant proof, a GitHub handoff, and a copyable artifact in one short visit. Only after that proof do
they choose whether to expand into the owner's town. That link can travel with the repository that
already has an audience instead of asking people to share Repolis as a destination on its own.

## User flow

1. Paste a GitHub username, `owner/repo`, or a GitHub repository root URL into the intro or Station.
2. A username keeps the existing `?user=<login>` public-town flow.
3. A repository resolves to the canonical Portal URL and loads that target first.
4. The first screen confirms stars, forks, language, description, and data source.
5. **Enter this repo exhibition** opens the target's Repository Atelier.
6. The Atelier can copy the same Portal address, open GitHub, or explicitly load the owner's full town.
7. The earned Star invitation remains deferred until the visitor has completed the Atelier Aha or copied
   the Portal and then returned to the town.

## URL contract

| Purpose | URL |
|---|---|
| Canonical repository entry | `?repo=owner/repo&ref=repo-portal` |
| Public owner-town expansion | `?user=owner&focus=repo&ref=repo-portal` |
| Canonical owner-town expansion | `?focus=repo&ref=repo-portal` |
| Existing public town | `?user=owner` |

`repo` is the source of truth when `repo` and `user` disagree. Portal links discard unrelated `user`,
`twin`, `growth`, and hash state instead of composing ambiguous experiences. Browser history remains
ordinary navigation: entering the Atelier does not push a synthetic history entry, and Back returns to the
previous page.

The shared parser accepts:

- a GitHub username;
- `owner/repo`;
- `https://github.com/owner/repo`;
- the same repository forms with one trailing slash or `.git`.

It rejects non-GitHub hosts, credentials, ports, extra path segments, query strings, fragments, encoded path
separators, traversal, control characters, and malformed owner or repository names. Rejected input never
starts a GitHub API request.

## Target-first data path

The runtime resolves a repository in this order:

| Step | Source | Result |
|---|---|---|
| 1 | Exact match in the generated owner snapshot | Reuses known owner traffic with `trafficKnown: true`. |
| 2 | Fresh local Portal cache | Reuses allowlisted public metadata for 15 minutes. |
| 3 | `GET /repos/{owner}/{repo}` | Makes one unauthenticated GitHub request with no automatic retry. |
| 4 | Stale local Portal cache | Recovers explicitly as stale when the request fails. |
| 5 | Existing owner town | Preserves a usable local scene and displays the target error. |

The Portal cache is an LRU capped at 30 entries and 512 KiB. It stores only the public fields projected by
`assets/repo-portal.js`. A 403 or 429 is surfaced immediately; the runtime does not retry or fetch an owner
catalog. The owner catalog is requested only after the visitor chooses **Explore @owner's full town**.
Target-only mode does not write a Town Gazette baseline or Village Chronicle payload. A Postcard copy-link
returns the same canonical Portal URL instead of dropping the target or composing unrelated feature state.

## Traffic truth boundary

GitHub's public repository endpoint does not expose visitors, views, or clones. Repo Portal and `?user=`
towns therefore keep:

```js
trafficKnown: false
visitors: null
views: null
clones: null
```

Public architecture uses stars, forks, and update recency directly. Cards, search answers, and Atelier walls
do not print unavailable traffic as zero or describe a public building as traffic-shaped. An exact match in
the generated owner snapshot may show cumulative traffic because that data is already present and marked
`trafficKnown: true`.

## Funnel events

Repo Portal uses the existing optional analytics sink with a stricter payload:

| Event | Moment |
|---|---|
| `feature_seen` | The universal repository entry is visible or a Portal link opens. |
| `feature_started` | Input is rejected, or a canonical target finishes resolving. |
| `aha_completed` | The target Atelier reaches its inside state after facts are bound. |
| `share_created` | A canonical Portal address is copied. |
| `github_repo_opened` | The visitor explicitly opens the target on GitHub. |
| `project_star_click` | The earned upstream Repolis Star link is clicked. |

These events may include only a page-lifetime session ID, timestamp, entry surface, device class, language,
result enum, coarse latency bucket, and channel enum. They omit owner, repository, URL, pasted input, query
text, `cityUser`, and the persistent anonymous instance ID.

## Performance and accessibility contract

- No binary asset, model, image, texture, light, shadow, backend, package, or build step was added.
- A cold arbitrary target makes at most one GitHub repository request before Aha.
- Portal code stays below 30 KiB uncompressed, and the complete local runtime stays below 5 MiB.
- Target arrival adds no steady-state town draw and no Portal-specific Three.js object.
- Intro and Station use one labelled 320-character field, visible alert text, and shared validation.
- Proof and copy results use live regions. Atelier actions use 44 px mobile targets and hide while its chat
  owns the screen.
- Reduced-motion visitors keep the same flow with the existing shortened Atelier fade.

## Files to change

| File | Responsibility |
|---|---|
| `assets/repo-portal.js` | Parser, route precedence, public projection, canonical links, and latency buckets. |
| `index.html` | Loading, bounded cache, truthful architecture, intro/Station UX, Atelier actions, and events. |
| `scripts/smoke.mjs` | Hermetic parser, security, fallback, privacy, i18n, accessibility, and budget guards. |
| `examples/share-links.md` | Copy-ready public URL examples. |
| `docs/domain-model.md` | Portal mode and `trafficKnown` semantics. |
| `docs/known-limitations.md` | API, cache, and public-traffic constraints. |

Keep parsing and link construction in the pure module. Do not add a second input resolver or build Portal
links by editing `location.search` in place. Do not add synthetic traffic fields to make existing building
math convenient.

## Verification

Run the golden suite:

```bash
node council/test.mjs
node council/test-live.mjs
node scripts/smoke.mjs
node --check scholars.js
node --check cloudflare-taxi/src/grounded.js
```

Then serve the repository and test a known owner repo, an arbitrary public repo, a fresh and stale cache,
404, 403/429, offline fallback, malicious input, owner-town expansion, copy, GitHub handoff, Back, KO/EN,
keyboard operation, reduced motion, desktop, and 390x844 mobile. Both viewports must finish with no console
errors, overlap, or horizontal overflow.
