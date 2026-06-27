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
- **Public repos only, by design.** Private repo names never appear. Untouched mirror forks are filtered
  out; only forks you've actually committed to are shown.

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
  (`RT_DEFAULT`, `?rt=`, `localStorage.repolisRT`, or `window.REPOLIS_RT`). A bare fork is single-player.
- **Self-host count is in-memory.** The `node scripts/dev_realtime.mjs` server forgets counts on restart;
  only the PartyKit / Cloudflare Durable-Object backends persist the cumulative total.

## Client / rendering

- **Single static `index.html`, on purpose.** No bundler, no `package.json`, no `node_modules` for the
  site. Don't add a build step — it's a feature, and tooling that assumes one will not find it.
- **Three.js loads from a CDN import map** (jsDelivr). Fully offline first-loads won't render until the
  module is cached; there is no local copy of Three.js in the repo.
- **WebLLM needs WebGPU** and a ~1 GB one-time download; unsupported browsers simply don't offer that mode.
- **No automated UI tests.** `index.html` has no unit harness — UI changes are verified by serving locally
  and driving the page (Chrome DevTools), checking for 0 console errors on mobile + desktop.
- **Owner town is fixed at 62 repos** at the current data snapshot; that number tracks the owner's public
  repos and changes only when the data refreshes.

## Tooling

- **Tests cover the Council only.** `node council/test*.mjs` are hermetic and authoritative for that engine;
  the city build, taxi UI, and workers have no equivalent unit suite — verify those by running them.
- **No linter/formatter is configured.** Match the surrounding code style by hand.
