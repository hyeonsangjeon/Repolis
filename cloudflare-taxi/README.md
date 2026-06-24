# Repolis taxi grounding — Cloudflare Worker

The **live backend** behind Repolis. This Worker is what answers AI questions on the
public site (https://hyeonsangjeon.github.io/Repolis/) — the Vercel functions in
[`../api`](../api) are optional fork-only alternatives. It does two things:

1. **Grounded repo Q&A** (the **🛰️ AI Foundry Live** taxi mode) — forwards a free-form
   question to your **Azure AI Search Knowledge Base**, which calls the **GitHub hosted
   MCP server** as a knowledge source, and returns one grounded sentence + the repo to
   drive to.
2. **In-persona general chat** — when a question is off-KB (astronomy, myth, small talk)
   or the KB returns nothing, the Worker answers *in the scholar's voice* via a direct
   **Azure OpenAI** chat completion, authenticated **keyless** with an **Entra ID service
   principal** (no Azure OpenAI api-key anywhere). This is the `chat:true` / fallback path.

It also serves **multiple scholar NPCs** (POLARIS the taxi, VEGA · MS Learn, RIGEL ·
DeepWiki) from one shared pipeline — each just points at its own KB + MCP knowledge
source. See [`../SCHOLARS.md`](../SCHOLARS.md) for the roster and the `npc → { kb, ks }`
map in [`src/grounded.js`](src/grounded.js).

This is a **separate** Worker from the realtime presence server in [`../cloudflare`](../cloudflare).
The grounding logic mirrors the Vercel function [`../api/taxi-grounded.js`](../api/taxi-grounded.js),
but the Worker is a **superset**: the Vercel function does grounded retrieval only and
has **no** in-persona general chat.

## Why Cloudflare instead of Vercel Hobby?

The Knowledge Base + MCP round-trip can take **15–21 s**. Vercel Hobby cuts functions
off at ~10 s, so slow questions silently fall back to Local search. Cloudflare Workers
bill **CPU time** (not the wall-clock spent awaiting a subrequest), so the Worker can
wait for the slow KB to finish. Free plan, no card, and you already run a Worker here.

## What it holds (and what it doesn't)

The Worker holds exactly **two secrets**:

- your **Azure AI Search key** (`SEARCH_API_KEY`) — for KB retrieval, and
- an **Entra ID service-principal secret** (`AAD_CLIENT_SECRET`) — so it can call Azure
  OpenAI **keyless** for in-persona general chat.

It never holds an **Azure OpenAI api-key** and never holds the **GitHub PAT** — those
stay server-side: the OpenAI access for KB answer-synthesis and the GitHub PAT both live
inside the Knowledge Source on Azure, never touching this Worker or the browser. The
service principal only has the `Cognitive Services OpenAI User` role on your AOAI resource.

Deterministic navigation ("take me to the most popular repo") is handled in the client
and never reaches here. If the KB is unreachable / slow / unconfigured, the Worker returns
`{ fallback:true }` and the client silently uses Local search. If the KB has nothing but
general chat is configured, the scholar still answers in persona; if *neither* is
configured, a fresh clone degrades gracefully (direct keyless MCP where possible).

## Deploy

```bash
cd cloudflare-taxi
```

**(1) Grounded repo Q&A** — the Search endpoint + key:

```bash
# Azure AI Search endpoint (account-specific; not strictly secret but kept out of git):
npx wrangler secret put SEARCH_ENDPOINT      # paste https://<your-search>.search.windows.net
# Azure AI Search key (SECRET — never commit it):
npx wrangler secret put SEARCH_API_KEY       # paste your Azure AI Search key
```

**(2) In-persona general chat** (optional but recommended) — a keyless Entra ID service
principal with the `Cognitive Services OpenAI User` role on your AOAI resource:

```bash
# Create the service principal once (note the appId / tenant / password it prints):
az ad sp create-for-rbac --name repolis-taxi-aoai \
  --role "Cognitive Services OpenAI User" --scopes <your-aoai-resource-id>

npx wrangler secret put AOAI_ENDPOINT        # https://<your-aoai>.cognitiveservices.azure.com
npx wrangler secret put AAD_TENANT           # directory (tenant) id
npx wrangler secret put AAD_CLIENT_ID        # service principal appId
npx wrangler secret put AAD_CLIENT_SECRET    # service principal password (the only OpenAI secret)
```

If you skip (2), grounded answers still work; off-KB / small-talk questions just fall
back to the client's Local reply instead of an in-persona answer.

**(3) Ship it:**

```bash
npx wrangler deploy
```

`wrangler deploy` prints your URL, e.g. `https://repolis-taxi.<you>.workers.dev`.

> First deploy needs `npx wrangler login` (opens a browser once). The **non-secret**
> config — KB/KS names per scholar, `AOAI_DEPLOYMENT`, api-versions, timeouts — lives in
> `wrangler.toml [vars]`; edit it there. Add more MCP knowledge sources by making
> `SEARCH_KS_NAME` a comma-separated list, and add a scholar by following
> [`../SCHOLARS.md`](../SCHOLARS.md).

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
# In-persona general chat (optional — omit to test grounding only):
AOAI_ENDPOINT=https://<your-aoai>.cognitiveservices.azure.com
AOAI_DEPLOYMENT=gpt-5.4-mini
AAD_TENANT=<tenant-id>
AAD_CLIENT_ID=<sp-app-id>
AAD_CLIENT_SECRET=<sp-password>
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

`POST /` (any path). The body selects the path:

```jsonc
// grounded repo question (taxi):            { "question": "…" }
// scholar grounded question:                { "question": "…", "npc": "msdocs" }   // or "deepwiki" (needs repoName)
// in-persona general / small talk:          { "question": "…", "npc": "taxi", "chat": true, "history": [], "lang": "ko" }
```

Responses:

```jsonc
// taxi grounded (drive to a repo):
{ "repo": "AI-Search-Foundry-IQ", "message": "one grounded sentence …",
  "trace": { "ks": "github-repos-mcp-ks", "tools": ["search_repositories"],
             "refs": [ /* up to 6 */ ], "mcpMs": 3100, "totalMs": 7200, "partial": false } }
// in-persona general / KB-miss (chat:true, or KB found nothing):
{ "repo": null, "message": "…", "general": true,
  "trace": { "general": true, "model": "gpt-5.4-mini" } }
// scholar grounded answer (e.g. VEGA · MS Learn):
{ "repo": null, "message": "…", "trace": { "ks": "microsoft-learn-mcp-ks", "docs": true, … } }
// DeepWiki direct MCP (RIGEL): { "kind": "docs", "message": "…", "repoName": "…", "items": [ … ], "trace": { … } }
// use Local search instead:
{ "fallback": true, "reason": "timeout 25000ms" }
```
