# Known limitations

So an agent (or contributor) doesn't chase a "bug" that is actually intended behavior, or design a
change around a constraint that can't move. Pair this with [`AGENTS.md`](../AGENTS.md).

## Data

- **Traffic is daily, not live.** The city reflects yesterday's cumulative totals. `repos.json` updates
  once per day via `.github/workflows/refresh.yml`; there is no real-time traffic feed.
- **Traffic needs an external collector.** GitHub's traffic API only keeps a rolling **14-day** window,
  so lifetime visitor/clone totals come from a separate private collector
  ([`github-traffic-monitor`](https://github.com/hyeonsangjeon/github-traffic-monitor)). A fork without a
  collector will show stars/forks/issues but flat/zero visitor·clone·view history.
- **`repos.json` is generated.** Hand edits are overwritten on the next refresh. Change
  `scripts/build_repos.py` instead.
- **Resident profiles are generated and public-only.** `data/residents/*.json` contains only bounded,
  sanitized public repository metadata available during refresh. Missing issue/PR/commit/release history stays
  empty. Details load only after explicit interaction; a Bound-source change may temporarily use the local
  fallback until the generated Worker registry is redeployed.
- **Public repos only, by design.** Private repo names never appear. Untouched mirror forks are filtered
  out; only forks you've actually committed to are shown.
- **Public API modes do not have traffic.** Repo Portal and `?user=` receive stars, forks, issues, language,
  topics, and lifecycle dates from unauthenticated public endpoints. GitHub does not return visitors, views,
  or clones there, so Repolis keeps those fields unknown and uses stars, forks, and recency for architecture.
  An exact Portal match in the generated owner snapshot may reuse its known cumulative traffic.
- **Repo Portal is one unauthenticated request, not a proxy.** An arbitrary target uses one
  `GET /repos/{owner}/{repo}` request with no retry. A 15-minute LRU cache is limited to 30 entries and 512
  KiB; failed requests may use an explicitly labelled stale entry. Without one, the target error appears
  over the existing owner town. GitHub's anonymous 403/429 limit still applies.
- **Repo Route is a current-catalog path, not a permanent playlist.** Its URL contains two or three public
  repository names from the town that created it. Renamed, deleted, privatized, or newly filtered repositories
  cannot be reconstructed and make that shared route fail soft to the normal town. Route drafts are session-only,
  and strict order means opening another house does not skip the current stop.
- **Open Source Quests uses GitHub's anonymous search, not an issue mirror.** It reads up to 50 current open
  public issues only after the visitor presses Find, displays at most three, and keeps results in memory for
  this tab. Anonymous Search API rate limits can produce an explicit temporary error. A changed, closed,
  renamed, deleted, private, or newly filtered issue disappears on the next page load; Repolis does not claim,
  assign, cache, refresh, or track contribution outcomes.
- **Creator Hall reads one public profile explicitly.** Opening the hall requests GitHub's public
  `/users/<login>` endpoint and caches only the fields it renders for 24 hours. Anonymous API rate limits
  can hide the avatar/bio temporarily; the hall still falls back to the public repository facts already
  present in town. Email, blog, contribution-calendar scraping, and private data are not collected.

## AI / scholars

- **Grounded answers depend on a backend.** The live grounding needs the `repolis-taxi` Cloudflare Worker
  plus an Azure AI Search Knowledge Base. A fresh clone with no backend falls back to **keyless Local
  search** — accurate navigation, but no grounded prose Q&A. This is graceful, not an error.
- **KB latency is real.** A cold/complex Knowledge Base + MCP round-trip can take **15–21 s**. Cloudflare
  Workers tolerate it (they bill CPU time, not awaited wall-clock); the optional **Vercel Hobby** path caps
  at ~10 s and silently falls back to Local — so the Vercel function is best-effort only.
- **`gpt-5.4-mini` is a small model.** Synthesized answers are concise and occasionally hedge. Retrieval is
  done client-side first and the model only **picks from a shortlist**, which limits hallucination but does
  not eliminate it. Free-topic Council verdicts are AI inference and are explicitly marked `⚡ unverified`.
- **Starlit (general) chat is intentionally unsourced.** Off-topic / small-talk replies carry no references
  by design and are labeled as general knowledge.

## Realtime / multiplayer

- **Solo by default.** Presence + the live visitor counter only appear when a realtime server is wired
  (`repolis.config.js`, `?rt=`, `localStorage.repolisRT`, or `window.REPOLIS_RT`). A bare fork is single-player.
- **Self-host count is in-memory.** The `node scripts/dev_realtime.mjs` server forgets counts on restart;
  only the PartyKit / Cloudflare Durable-Object backends persist the cumulative total.

## Client / rendering

- **Zero-build static runtime, on purpose.** `index.html` remains the primary runtime and imports a few
  local modules/assets directly. There is no bundler, `package.json`, or `node_modules` requirement for
  the site. Don't add a build step — it is a feature.
- **Three.js loads from a CDN import map** (jsDelivr). Fully offline first-loads won't render until the
  module is cached; there is no local copy of Three.js in the repo.
- **WebLLM needs WebGPU** and a ~1 GB one-time download; unsupported browsers simply don't offer that mode.
- **No full browser automation suite.** `scripts/smoke.mjs` guards many static and extracted behavioral
  contracts, but visual and interaction changes still require serving locally and driving the page in
  Chrome DevTools with 0 console errors on mobile + desktop.
- **Owner-town size is a snapshot, not a contract.** Its repository count changes whenever the daily
  public data refresh adds, removes, or filters a repository.
- **Town Gazette is browser-local.** It compares public repo fields against the last snapshot marked read
  in this browser, keeps at most five towns, and does not sync across devices. Negative metric corrections
  are ignored rather than presented as losses. Release-tag changes are available in the owner town's
  generated data; lightweight `?user=` towns do not fetch release metadata.
- **Town Growth Replay is a creation timeline, not a historical analytics database.** Each year is taken from
  a currently public repo's `created` date; deleted or private repos cannot appear. GitHub does not provide
  past Star, fork, traffic, topic, or language snapshots, so a visible house keeps its current architecture
  and language label and the UI says so explicitly. Repos without a valid creation date appear only in the
  present step. Replay state lives in the URL and is not persisted.
- **Repository Atelier is a metadata exhibition, not a source-code IDE.** One reusable room redraws the
  current repo description, topics, public metrics, lifecycle dates, and available traffic. It does not clone
  source files, reconstruct old metrics, or simulate build/runtime behavior. Explicit Gitber questions use
  the currently selected chat mode and its existing Local or backend fallback.
- **Resident Shared Joy is bounded and session-local.** At most one pair takes a scripted excursion at a
  time; it is not remembered across reloads and does not use a model. Stargazing starts autonomously only
  while stars are visible, and visitor/chat/festival ownership intentionally interrupts an outing.
- **Starlight Row is exterior and session-local.** The eight cottages do not have walk-in interiors, saved
  occupancy, or offline simulation. Residents finish any stronger social owner before commuting, so a
  festival or conversation can intentionally delay home/work arrival. Long commutes use purposeful speed
  plus existing circle-collider resolution rather than authored road splines. Its trees and gardens are
  procedural scenery rather than a persistent gardening simulation; cottage styles are fixed to resident
  identity rather than user-customizable, and LOW_END intentionally uses fewer plants and omits canopy,
  chimney, and finial detail.

## Tooling

- **Coverage is layered, not end-to-end.** `node council/test*.mjs` is authoritative for the Council;
  `node scripts/smoke.mjs` guards the static client and selected extracted behavior. Workers and rendered
  interactions still need their targeted syntax/runtime checks.
- **No linter/formatter is configured.** Match the surrounding code style by hand.
