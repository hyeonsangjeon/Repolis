# Repolis taxi grounding — Cloudflare Worker

The **live backend** behind Repolis. This Worker is what answers AI questions on the
public site (https://hyeonsangjeon.github.io/Repolis/) — the Vercel functions in
[`../api`](../api) are optional fork-only alternatives. It does three things:

1. **Grounded repo Q&A** (the **🛰️ AI Foundry Live** taxi mode) — forwards a free-form
   question to your **Azure AI Search Knowledge Base**, which calls the **GitHub hosted
   MCP server** as a knowledge source, and returns one grounded sentence + the repo to
   drive to.
2. **In-persona general chat** — when a question is off-KB (astronomy, myth, small talk)
   or the KB returns nothing, the Worker answers *in the scholar's voice* via a direct
   **Azure OpenAI** chat completion, authenticated **keyless** with an **Entra ID service
   principal** (no Azure OpenAI api-key anywhere). This is the `chat:true` / fallback path.
3. **Direct public MCP scholars** — RIGEL calls DeepWiki, MIRA resolves and reads current
   library docs through Context7, and LYRA searches Hugging Face models, datasets, and papers.
   Their results keep source links and can be synthesized in the visitor's language.
4. **AURI's read-only market ledger** — the hidden resident queries one Azure AI Search KB
   backed by this Worker's bounded Coinbase spot-data MCP (Longbridge stock tools optional).
   It returns cited, time-stamped facts and has no order, account, transfer, or withdrawal tools.

It serves **five specialist scholars**: POLARIS, VEGA · MS Learn, RIGEL · DeepWiki,
MIRA · Context7, and LYRA · Hugging Face, plus one **easter-egg resident**, AURI · Market.
See [`../SCHOLARS.md`](../SCHOLARS.md) and the hybrid `scholarConfig` / `MCP_NPCS` maps
in [`src/grounded.js`](src/grounded.js).

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

The Worker needs **two provider secrets** for the existing live KB/persona path:

- your **Azure AI Search key** (`SEARCH_API_KEY`) — for KB retrieval, and
- an **Entra ID service-principal secret** (`AAD_CLIENT_SECRET`) — so it can call Azure
  OpenAI **keyless** for in-persona general chat.

It never holds an **Azure OpenAI api-key** and never holds the **GitHub PAT** — those
stay server-side: the OpenAI access for KB answer-synthesis and the GitHub PAT both live
inside the Knowledge Source on Azure, never touching this Worker or the browser. The
service principal only has the `Cognitive Services OpenAI User` role on your AOAI resource.

MIRA and LYRA work anonymously. For higher third-party quotas you may additionally set
`CONTEXT7_API_KEY` and `HF_TOKEN` as Worker secrets. They remain server-side and are optional.
If Context7's anonymous MCP quota is exhausted, MIRA falls back to that library's public
Context7 `llms.txt` page rather than returning an ungrounded answer.

AURI's stock source optionally adds `MARKET_LONGBRIDGE_ACCESS_TOKEN`, a dedicated Longbridge
OAuth access token. The Worker forwards it only to `longbridge-market-mcp-ks` through Azure AI
Search query-time control headers. Coinbase spot data is public and keyless. Never use a
full-trading token when a read-only market-data token is available.

When `METRICS_URL` points at Repolis Observatory, also set `METRICS_INGEST_TOKEN` to the
same random value configured on `repolis-metrics`. The Worker sends it only as
`X-Repolis-Metrics-Key` to that collector. This keeps server provider calls, delivered answers,
KB attempts, and final grounding paths out of the untrusted browser lane; prompt and answer text
are never included.

The committed `REPOLIS_METRICS` Service Binding is the primary transport. Cloudflare does not
support an ordinary same-zone Worker-to-Worker `fetch()` to a `workers.dev` route without special
routing, which can surface as error 1042. The binding forwards the same signed HTTP `Request`
directly to `repolis-metrics`; global `fetch()` remains only an optional fallback for deployments
that do not expose the binding. Deploy `repolis-metrics` before deploying this caller.

Deterministic navigation ("take me to the most popular repo") is handled in the client
and never reaches here. If the KB is unreachable / slow / unconfigured, the Worker returns
`{ fallback:true }` and the client silently uses Local search. If the KB has nothing but
general chat is configured, the scholar still answers in persona; if *neither* is
configured, a fresh clone degrades gracefully (direct keyless MCP where possible).

POLARIS is also constrained by `src/taxi-boundary.js`. The taxi receives Shared city-state context only.
Any client-supplied resident/profile/Bound field is rejected before prompt or provider planning. A household
memory question naming a known public repo returns a deterministic home handoff; an untargeted one is refused.
Season/district ride observations are generated entirely in the browser and never call this Worker. Requests
explicitly marked as a foreign public/portal town fail closed to local navigation instead of receiving this
owner deployment's generated Shared season or resident-home registry.

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

**(3) Authoritative Observatory telemetry** (required before publishing per-answer economics):

```bash
# Use the identical random value already set on repolis-metrics:
npx wrangler secret put METRICS_INGEST_TOKEN
```

Deploy `repolis-metrics` first, then this Worker. Without the shared token, telemetry remains
public diagnostic data and is deliberately excluded from provider/cost/answer attribution.

**(4) Ship it:**

```bash
npx wrangler deploy
```

`wrangler deploy` prints your URL, e.g. `https://repolis-taxi.<you>.workers.dev`.

**(5) AURI's optional market KB** — create the two MCP Knowledge Sources and the
`repolis-market-kb` described in [`../SCHOLARS.md`](../SCHOLARS.md), then set the Longbridge
token server-side:

```bash
npx wrangler secret put MARKET_LONGBRIDGE_ACCESS_TOKEN
```

The crypto Knowledge Source points to the deployed Worker itself:
`https://repolis-taxi.<you>.workers.dev/mcp/crypto`. AURI remains safe when this setup is
missing: the client says the market ledger is unavailable and never invents a live price.

> First deploy needs `npx wrangler login` (opens a browser once). The **non-secret**
> config — KB/KS names per scholar, `AOAI_DEPLOYMENT`, api-versions, timeouts — lives in
> `wrangler.toml [vars]`; edit it there. Add more MCP knowledge sources by making
> `SEARCH_KS_NAME` a comma-separated list, and add a scholar by following
> [`../SCHOLARS.md`](../SCHOLARS.md).

Optional direct-MCP quota secrets:

```bash
npx wrangler secret put CONTEXT7_API_KEY
npx wrangler secret put HF_TOKEN
```

## Turn it on for every visitor

Open `../repolis.config.js` and set `services.grounded` for your deployment policy:

```js
grounded: canonicalServices ? 'https://repolis-taxi.<you>.workers.dev/' : '',
```

Commit + push. Visitors on that configured deployment can use **🛰️ AI Foundry Live** with
no per-user setup. Leave it `''` and the site stays Local-default (each visitor can still
paste their own backend URL in the taxi mode prompt). Template forks ship service-off.

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
MARKET_KB_NAME=repolis-market-kb
MARKET_KS_NAME=crypto-market-mcp-ks
MARKET_LONGBRIDGE_KS_NAME=longbridge-market-mcp-ks
MARKET_LONGBRIDGE_ACCESS_TOKEN=<dedicated-read-only-oauth-token>
SEARCH_API_VERSION=2026-05-01-preview
GROUNDED_MAX_RUNTIME_S=25
GROUNDED_TIMEOUT_MS=25000
# In-persona general chat (optional — omit to test grounding only):
AOAI_ENDPOINT=https://<your-aoai>.cognitiveservices.azure.com
AOAI_DEPLOYMENT=gpt-5.4-mini
AAD_TENANT=<tenant-id>
AAD_CLIENT_ID=<sp-app-id>
AAD_CLIENT_SECRET=<sp-password>
# Optional direct-MCP quota upgrades (MIRA/LYRA work without them):
CONTEXT7_API_KEY=<context7-key>
HF_TOKEN=<hugging-face-token>
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
// scholar grounded question:                { "question": "…", "npc": "msdocs" }
// direct public MCP scholar:                { "question": "React 19 useEffect", "npc": "context7", "lang": "ko" }
// Hugging Face model/dataset/paper search:   { "question": "VLM papers", "npc": "huggingface", "lang": "en" }
// DeepWiki repo map:                        { "question": "how does it work?", "npc": "deepwiki", "repoName": "facebook/react" }
// AURI market KB (two MCP sources):          { "question": "BTCUSDT 24h change", "npc": "market", "lang": "en" }
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
// Context7 / Hugging Face direct MCP (MIRA / LYRA):
{ "kind": "docs", "message": "…", "items": [ /* source links */ ],
  "trace": { "ks": "Context7 (MCP)", "tools": ["resolve-library-id", "query-docs"], "direct": true } }
// AURI market answer: { "message": "…", "trace": {
//   "ks": "crypto-market-mcp-ks",
//   "tools": ["quote", "crypto_spot_quotes"], "refs": [ /* cited source snapshots */ ] } }
// use Local search instead:
{ "fallback": true, "reason": "timeout 25000ms" }
```

## Read-only crypto MCP endpoint

`POST /mcp/crypto` implements stateless Streamable HTTP JSON-RPC for Azure AI Search. It
supports only:

| Tool | Purpose | Limits |
|---|---|---|
| `crypto_spot_quotes` | Coinbase spot last price, 24h open/high/low/change/volume, retrieval time | 1–4 symbols |
| `crypto_candles` | Recent Coinbase spot OHLCV candles, oldest first | one symbol, 2–50 rows |

Symbols, intervals, result counts, upstream host, and timeout are bounded in the Worker. The
tool list intentionally contains no account, position, order, conversion, deposit, withdrawal,
or transfer capability. Returned MCP documents include a Coinbase source URL and a retrieval
timestamp so the KB can cite the data it used.

## 🧑‍🌾 Resident NPC social layer (optional, hard-capped)

The city's **townspeople** (9 residents — distinct from the specialist scholars and Gitber the taxi) trade
short ambient lines and chat with the visitor. They remain deterministic **scripted** residents by default:
zero network, zero backend, and zero model cost. The Worker produces a real model turn only when every env/KV
kill switch is on **and** the Durable NPC Budget Governor accepts a worst-case reservation.

### Durable hard-cap design

`NPC_BUDGET_GOVERNOR` is a SQLite-backed Durable Object binding. Every Worker isolate addresses the same
`npc-budget-canonical-v1` instance for ambient/legacy NPC traffic and the separate
`resident-dialogue-budget-v1` instance for explicit repository-bound visitor dialogue:

- aggregate only: `spent`, `reserved`, completed/in-flight turns, bounded daily attempts, and a short
  aggregate rate-window count;
- idempotency records: reservation day, amount, and pending/settled/released status;
- **never** prompts, conversation text, visitor identifiers, or personal data.

Before Azure OpenAI is called, the Worker validates the selected deployment's price table and official model
input/output limits, then calculates a conservative maximum cost from the exact bounded message bytes plus 512
chat-framing tokens and the request's `max_completion_tokens`. One UTF-8 byte per input token is the conservative
tokenizer bound; the reservation uses the more expensive of normal/cached input prices and the full output
allowance. The committed `gpt-5.4-mini` entry uses Azure's documented 272,000-token maximum input and
128,000-token maximum output limits; the request itself is capped at 120 output tokens. The Governor atomically
accepts only when:

```text
spent + reserved + maximumTurnCost <= NPC_DAY_CAP_USD
completedTurns + reservedTurns < NPC_DAILY_TURN_MAX  (when non-zero)
acceptedAttempts < NPC_DAILY_ATTEMPT_MAX
```

Concurrent requests therefore cannot pass the same remaining dollars or turn slot. Success settles normalized
provider usage and returns the unused reservation. A failure proven to occur before Azure model dispatch releases
the reservation at zero cost. Once dispatch begins, HTTP/network error, timeout, abort, unusable/empty content, or
missing/partial/malformed/out-of-bounds usage conservatively settles the full reservation before scripted fallback;
that removes the reservation without pretending an ambiguous provider attempt was free. Unknown deployment pricing,
malformed caps, a missing/unresponsive binding, or failed settlement all **fail closed before another model
call**; the client uses its free scripted bank. A failed settlement leaves the conservative reservation held,
so loss of availability cannot become cap overshoot.

UTC rollover starts a clean active-day aggregate on the first Governor operation of the new day. Prior-day
in-flight reservations and their aggregate remain only as needed to settle/release cross-midnight calls safely.
Lowering the cap or imposing a tighter turn limit during a day is sticky until the next UTC day, so an older
Worker isolate cannot reopen it with stale higher settings. In-day increases normally wait until rollover. An
operator can deliberately apply one immediately, without clearing spend or reservations, by increasing the
matching monotonic `*_DAY_CAP_REVISION`; calls from an older revision cannot overwrite that cap.
If current spend/reservations already exceed a new lower cap, no new reservation is accepted.
`NPC_DAY_CAP_USD=0` disables model turns immediately at the Governor.
Accepted reservations also increment a durable attempt counter. `NPC_DAILY_ATTEMPT_MAX` provides a bounded
abuse/storage ceiling even when providers repeatedly fail and release their dollar/turn reservations; released
idempotency tombstones are deleted, the immediately prior UTC day's settled records remain available for response
retries, and later rollovers remove older finalized records once no pending call needs them.
Every pending reservation has a durable lease longer than the provider timeout plus Governor retries. A Durable
Object alarm full-settles an orphaned lease, so a terminated Worker cannot leave permanent pending state or reopen
possibly billable dollars.

### Actions

`POST /` with an `npc_action` (no `question` needed):

```jsonc
{ "npc_action": "npcConfig", "lang": "ko" }
// → { ok, config:{ requested, controlEffective, effective, runtimeAvailable,
//                  budgetReason, pending, canEnable, blockReason,
//                  aiEnabled, ambientEnabled, playerChatEnabled,
//                  hardAiEnabled, hardAmbientEnabled, hardPlayerChatEnabled,
//                  maxTurns, hardMaxTurns, source:"durable-object", flagSource, liveToggle },
//      budget:{ source:"durable-object", durable:true, enforcement:"atomic_reservation",
//               scope:"npc", dayCapUsd, capRevision, available, ... },
//      residentDialogueBudget:{ source:"durable-object", durable:true,
//               enforcement:"atomic_reservation", scope:"resident-dialogue",
//               dayCapUsd, capRevision, available, ... } }
{ "npc_action": "npcBudget" }
// → { ok, budget:{ enabled, available, source:"durable-object", durable:true,
//                  enforcement:"atomic_reservation", day, dayCapUsd, capRevision,
//                  spentUsd, reservedUsd, remainingUsd, turnsToday, reservedTurns,
//                  dailyTurnMax, attemptsToday, dailyAttemptMax, blocked } }
{ "npc_action": "npcAmbientTurn", "speaker":"sol", "listener":"jun", "topic":"model", "lang":"ko",
  "last":[{ "who":"jun", "text":"…" }] }
// → { ok, line:"one short line", budget:{…} } | { ok, fallback:true, reason, budget }
{ "npc_action": "npcPlayerChat", "speaker":"nari", "zone":"web", "question":"…", "lang":"ko" }
// → { ok, line:"…", budget } | { ok:false, fallback:true, reason:"npc_budget_exhausted", budget }
{ "npc_action": "residentDialogue", "resident_id":"nari", "authority_digest":"<generated sha256>",
  "question":"이 집의 최근 고민은?", "history":[], "lang":"ko" }
// → own Bound answer | deterministic other-home redirect | { fallback:true, reason, budget }
```

`residentDialogue` is the repository-bound route used by the browser. The Worker imports the generated
resident registry and accepts only a resident id plus its stable authority digest. Client-supplied repo names,
profile JSON, Bound arrays, roles, messages, system text, or prompts are rejected. Public issue/PR/commit text
is bounded, sanitized during generation, and quoted as untrusted evidence. A question naming another repo is
redirected to that house before any model reservation. Response traces expose only source kind, public
resident/repo identity, and redirect identity — never prompts or another resident's Bound payload.

`npcConfig` and `npcBudget` only read flags/Governor state; they never invoke a model. `controlEffective`
reports the env∧KV control plane independently, while the backward-compatible `effective` remains the
fail-closed runtime view. A transient Governor probe failure therefore reports `runtimeAvailable:false`
and a bounded `budgetReason` without being mislabeled as KV propagation. Every budget view,
including a fail-closed unavailable response, declares `source:"durable-object"`, `durable:true`, and
`enforcement:"atomic_reservation"`. These fields mean the configured enforcement mechanism is the single
SQLite-backed Durable Object reservation ledger, never an isolate-local estimate. When that binding or its
storage cannot be reached, `available:false` and `blocked:true` prevent a provider call; they do not downgrade
to best-effort accounting.

### Env (all optional — defaults keep AI **off**)

| Var | Default | Meaning |
|---|---|---|
| `NPC_AI_ENABLED` | `false` | Top-level env ceiling. Anything except `"true"` means **never** a resident model call. KV cannot override it on. |
| `NPC_AMBIENT_ENABLED` | `false` in code; `true` in the canonical deployment | Env ceiling for model-powered ambient turns (also requires `NPC_AI_ENABLED`). The canonical pilot permits owner-controlled ambient calls behind KV and the durable daily cap; blocked or unavailable calls retain the scripted fallback. |
| `NPC_PLAYER_CHAT_ENABLED` | `false` | Env ceiling for model-powered player chat (also requires `NPC_AI_ENABLED`). |
| `NPC_LIVE_TOGGLE` | `false` | Enables per-request `NPC_FLAGS` kill switches. When off, KV is ignored. |
| `NPC_MODEL_DEFAULT` | `gpt-5.4-mini` | Azure OpenAI deployment name for resident turns. |
| `NPC_MODEL_AMBIENT` / `NPC_MODEL_PLAYER` | — | Optional per-role deployment overrides; each deployed name needs a pricing entry. |
| `NPC_MODEL_PRICING_JSON` | built-in `gpt-5.4-mini` table | JSON map of deployment alias to `inputPer1MUsd`, `cachedInputPer1MUsd`, `outputPer1MUsd`, `maxInputTokens`, and `maxOutputTokens`. Invalid/unknown/incomplete means no call. |
| `NPC_MAX_COMPLETION_TOKENS` | `120` | Provider output cap and reservation output bound (1–4096). |
| `NPC_DAY_CAP_USD` | `0.15` in this deployment (`10` code default) | Durable UTC-day hard cap. The committed value bounds a 31-day month to `$4.65` of resident Azure model calls. `0` disables calls; invalid values fail closed. |
| `NPC_DAY_CAP_REVISION` | `1` | Monotonic operator revision for an explicit same-day NPC cap change. Keep unchanged for normal rollover changes; increase it only when an in-day cap replacement is intentional. |
| `NPC_DAILY_TURN_MAX` | `0` (off) | Optional durable daily turn cap; in-flight reservations consume slots. |
| `NPC_DAILY_ATTEMPT_MAX` | `5000` | Hard abuse/storage ceiling for accepted reservations, including provider failures. Must be positive. |
| `NPC_BUDGET_TIMEOUT_MS` | `3000` | Internal Governor response deadline (100–10000 ms); timeout fails closed. Retryable failures wait 100–250 ms before one idempotent retry; overload is not retried. |
| `NPC_RESERVATION_LEASE_MS` | `60000` | Orphan lease; must exceed `NPC_TIMEOUT_MS + 2×NPC_BUDGET_TIMEOUT_MS + 10000` and be ≤300000. Expiry full-settles. |
| `NPC_TIMEOUT_MS` | `12000` | Entra token + model request deadline; timeout aborts the request and releases its reservation. |
| `NPC_MAX_TURNS` / `NPC_HARD_MAX_TURNS` | `6` / `10` | Advertised default / absolute ambient conversation caps. |
| `RESIDENT_DIALOGUE_MAX_COMPLETION_TOKENS` | `96` | Separate explicit resident-dialogue output/reservation cap. |
| `RESIDENT_DIALOGUE_DAY_CAP_USD` | `10` in this deployment | Separate daily visitor resident-dialogue dollar ceiling (`$310` across 31 days if considered alone); the independent turn, attempt, and rate caps remain in force. Missing configuration defaults to zero and fails closed. |
| `RESIDENT_DIALOGUE_DAY_CAP_REVISION` | `2` in this deployment | Monotonic operator revision applying the `$10` visitor-dialogue cap immediately while preserving today's ledger. |
| `RESIDENT_DIALOGUE_DAILY_TURN_MAX` | `120` | Separate completed/in-flight visitor dialogue cap. |
| `RESIDENT_DIALOGUE_DAILY_ATTEMPT_MAX` | `240` | Separate accepted-attempt/storage ceiling. |
| `RESIDENT_DIALOGUE_RATE_MAX` / `RESIDENT_DIALOGUE_RATE_WINDOW_S` | `12` / `60` | Durable aggregate rate cap; stores counts only, with no IP, user agent, cookie, transcript, or visitor identity. |
| `METRICS_URL` | — | Optional private collector. Resident budget telemetry is anonymous aggregate operations only. |
| `METRICS_INGEST_TOKEN` | — | Shared Worker secret for `X-Repolis-Metrics-Key`; identical value on `repolis-metrics`. Required for authoritative per-answer/provider/grounding attribution. |

Model turns reuse the **same** Entra ID service principal as scholar chat (`AAD_*` + `AOAI_ENDPOINT`); no
new secret is needed. Keep the committed `NPC_MODEL_PRICING_JSON` synchronized with the actual deployment
meter before enabling the pilot. A custom deployment alias without a matching entry is deliberately rejected.

Allowed resident-budget telemetry is limited to `npc_budget_reserve` (accepted/rejected),
`npc_budget_settle` (settled/released), `npc_provider_error`, and `npc_budget_utc_reset`. Separate
`ai_chat_turn` records distinguish each provider call (`providerCall=true`, `answer=false`) from the one
user-visible delivered answer (`providerCall=false`, `answer=true`). Scholar grounding additionally emits
one `ai_kb_query` only for a real Azure `/retrieve` attempt and one `ai_grounding_outcome` for the final
KB or direct-MCP path. `pathRole=primary` distinguishes configured direct scholars from a real
`pathRole=fallback`; only the latter carries `timeout`, `empty`, `error`, or `unconfigured`. Budget events
may include role, categorical reason, aggregate dollars/turns, and
whether provider usage was authoritative; they never include prompt text, conversation text, speaker/visitor
identity, instance ID, or reservation ID. AI attribution events may add the coarse traffic class and an
anonymous installation UUID already accepted by Observatory, but still never include prompt or answer text.

### Live kill switches

By default the three feature flags are deploy-time env ceilings. For an owner dashboard, bind the shared KV
namespace and enable live reads:

```bash
# create once; bind the SAME id in the private dashboard Worker
npx wrangler kv namespace create NPC_FLAGS
# [[kv_namespaces]] binding="NPC_FLAGS" id="…" is already wired here
npx wrangler secret put NPC_LIVE_TOGGLE   # enter: true
```

With `NPC_LIVE_TOGGLE="true"`, the Worker reads `ai_enabled`, `ambient_enabled`, and
`player_chat_enabled` (`"true"`/`"false"`) on every resident request. Every enabled feature requires an
explicit KV `"true"`; missing or malformed keys fail closed. KV may permit an env-enabled feature, but can
never turn an env-disabled feature on. A missing binding or KV read failure disables all resident AI for that
request. `npcConfig` exposes the requested KV state separately from the effective env/budget-gated state so
the dashboard can confirm asynchronous propagation instead of treating a successful write as activation.
Cloudflare KV propagation can take up to about 60 seconds; use `NPC_AI_ENABLED=false` plus a Worker deploy for
the account-level hard stop.

### Disable and rollback safely

1. Set all three dashboard KV flags to `"false"` (if live toggles are enabled).
2. Set `NPC_AI_ENABLED=false` in the Worker environment and deploy. Confirm `npcConfig.config.aiEnabled=false`
   and read `npcBudget`; neither action calls a model.
3. Roll back application code only while the env ceiling remains false. Do **not** remove the binding or add a
   destructive Durable Object deletion migration during an incident; the persisted ledger can remain unused.
4. Re-enable only after the pricing table, cap, migration, and read-only `npcBudget` response are verified.

The binding and `new_sqlite_classes = ["NpcBudgetGovernor"]` migration in `wrangler.toml` create the namespace
on first deploy. Validate packaging without publishing by running `npx wrangler deploy --dry-run --outdir
/tmp/repolis-taxi-dry-run`. Template forks and the public site still require no backend: without a configured
grounded service, the browser never contacts this Worker and residents remain scripted.

Local `.dev.vars` for a bounded real-turn test:

```text
NPC_AI_ENABLED=true
NPC_AMBIENT_ENABLED=true
NPC_PLAYER_CHAT_ENABLED=true
NPC_DAY_CAP_USD=1
# Reuses AOAI_ENDPOINT + AAD_* from the scholar-chat block above.
# Keep NPC_MODEL_PRICING_JSON aligned if NPC_MODEL_DEFAULT is a custom deployment alias.
```
