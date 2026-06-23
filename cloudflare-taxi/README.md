# Repolis taxi grounding — Cloudflare Worker

A tiny Cloudflare Worker that powers the **🛰️ AI Foundry Live** taxi mode for every
visitor. It forwards a free-form repo question to your **Azure AI Search Knowledge
Base**, which calls the **GitHub hosted MCP server** as a knowledge source, and
returns one grounded sentence + the repo to drive to.

This is a **separate** Worker from the realtime presence server in [`../cloudflare`](../cloudflare).
It's the Cloudflare port of the Vercel function [`../api/taxi-grounded.js`](../api/taxi-grounded.js).

## Why Cloudflare instead of Vercel Hobby?

The Knowledge Base + MCP round-trip can take **15–21 s**. Vercel Hobby cuts functions
off at ~10 s, so slow questions silently fall back to Local search. Cloudflare Workers
bill **CPU time** (not the wall-clock spent awaiting a subrequest), so the Worker can
wait for the slow KB to finish. Free plan, no card, and you already run a Worker here.

## What it holds (and what it doesn't)

It only ever holds your **Azure AI Search key** (a Worker secret). The **Azure OpenAI
key** and the **GitHub PAT** stay server-side inside the Knowledge Source on Azure —
they never touch this Worker or the browser. Deterministic navigation ("take me to the
most popular repo") is handled in the client and never reaches here. If the KB is
unreachable / slow / unconfigured, the Worker returns `{ fallback:true }` and the
client silently uses Local search.

## Deploy (2 commands + the secret)

```bash
cd cloudflare-taxi

# 1) Set your Azure AI Search endpoint (edit wrangler.toml [vars] SEARCH_ENDPOINT,
#    or keep it out of git as a secret):
npx wrangler secret put SEARCH_ENDPOINT      # paste https://<your-search>.search.windows.net

# 2) Set the Search key (SECRET — never commit it):
npx wrangler secret put SEARCH_API_KEY       # paste your Azure AI Search key

# 3) Ship it:
npx wrangler deploy
```

`wrangler deploy` prints your URL, e.g. `https://repolis-taxi.<you>.workers.dev`.

> First deploy needs `npx wrangler login` (opens a browser once). The non-secret config
> (KB name, KS name, api-version, timeouts) lives in `wrangler.toml [vars]` — edit it
> there. Add more MCP knowledge sources by making `SEARCH_KS_NAME` a comma-separated list.

## Turn it on for every visitor

Open `../index.html`, find `GROUNDED_DEFAULT`, and paste your Worker URL:

```js
const GROUNDED_DEFAULT = 'https://repolis-taxi.<you>.workers.dev/';
```

Commit + push. Now every visitor who picks **🛰️ AI Foundry Live** gets live grounded
answers — no per-user setup. Leave it `''` and the site stays Local-default (each
visitor can still paste their own backend URL in the taxi mode prompt).

Optionally set `ALLOW_ORIGIN` in `wrangler.toml` to your Pages origin so only your site
can call the Worker. (Origin headers are spoofable, so this is soft protection; for a
portfolio the Azure free tiers are the real cost ceiling.)

## Test locally (no login, no deploy)

`wrangler dev` runs the Worker on your machine with [Miniflare]. Put your real values
in a **git-ignored** `.dev.vars` file:

```
SEARCH_ENDPOINT=https://<your-search>.search.windows.net
SEARCH_API_KEY=<your-search-key>
SEARCH_KB_NAME=repolis-github-kb
SEARCH_KS_NAME=github-repos-mcp-ks
SEARCH_API_VERSION=2026-05-01-preview
GROUNDED_MAX_RUNTIME_S=25
GROUNDED_TIMEOUT_MS=25000
```

```bash
npx wrangler dev --port 8788
curl -s -X POST http://localhost:8788/ \
  -H 'Content-Type: application/json' \
  -d '{"question":"what is the most popular repo?"}' | jq
# → { "repo": "...", "message": "...", "trace": { ... } }   (or { "fallback": true })
```

`.dev.vars` (and `.wrangler/`) are git-ignored — never commit your key.

[Miniflare]: https://developers.cloudflare.com/workers/testing/miniflare/

## Request / response

`POST /` (any path) with `{ "question": "..." }` →

```jsonc
// grounded:
{ "repo": "AI-Search-Foundry-IQ", "message": "one grounded sentence …",
  "trace": { "ks": "github-repos-mcp-ks", "tools": ["search_repositories"],
             "refs": [ /* up to 6 */ ], "mcpMs": 3100, "totalMs": 7200, "partial": false } }
// or, when the client should use Local search instead:
{ "fallback": true, "reason": "timeout 25000ms" }
```
