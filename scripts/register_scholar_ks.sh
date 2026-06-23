#!/usr/bin/env bash
#
# register_scholar_ks.sh — register one Repolis "scholar" on Azure AI Search:
#   1) a Knowledge Source (kind: mcpServer) pointing at a public MCP server
#   2) a persona Knowledge Base that answers via gpt-5.4-mini answerSynthesis,
#      replying in the user's own language.
#
# The Azure OpenAI model binding is CLONED from an existing KB (default
# repolis-github-kb) so you never hardcode the resource/deployment/identity.
# See SCHOLARS.md for the full picture.
#
# Run it from the repo root or from cloudflare-taxi/ (it auto-loads .dev.vars),
# or export SEARCH_ENDPOINT + SEARCH_API_KEY yourself.
#
# Usage:
#   scripts/register_scholar_ks.sh                       # default = MS Docs engineer (Microsoft Learn MCP)
#   scripts/register_scholar_ks.sh <ksName> <serverURL> <tool> <kbName> "<persona>"
#
# Example (explicit):
#   scripts/register_scholar_ks.sh microsoft-learn-mcp-ks \
#     https://learn.microsoft.com/api/mcp microsoft_docs_search repolis-mslearn-kb \
#     "You are the friendly Microsoft Docs engineer in Repolis."
#
set -euo pipefail
APIV="2026-05-01-preview"

# --- load secrets from .dev.vars (cloudflare-taxi) if present ---
for f in ./.dev.vars ./cloudflare-taxi/.dev.vars ../cloudflare-taxi/.dev.vars; do
  [ -f "$f" ] && { set -a; . "$f"; set +a; }
done
EP="${SEARCH_ENDPOINT:-}"; KEY="${SEARCH_API_KEY:-}"
[ -z "$EP" ]  && { echo "❌ SEARCH_ENDPOINT not set — add it to cloudflare-taxi/.dev.vars or export it"; exit 1; }
[ -z "$KEY" ] && { echo "❌ SEARCH_API_KEY not set — add it to cloudflare-taxi/.dev.vars or export it"; exit 1; }
EP="${EP%/}"

# --- args (defaults = the MS Docs engineer scholar) ---
KS_NAME="${1:-microsoft-learn-mcp-ks}"
SERVER_URL="${2:-https://learn.microsoft.com/api/mcp}"
TOOL="${3:-microsoft_docs_search}"
KB_NAME="${4:-repolis-mslearn-kb}"
PERSONA="${5:-You are the friendly Microsoft Docs engineer NPC in Repolis, a walkable 3D city of repositories. Answer using official Microsoft Learn documentation found in the references (Azure, .NET, Microsoft 365, and related Microsoft technologies).}"
SRC_KB="${SRC_KB:-repolis-github-kb}"   # existing KB to clone the Azure OpenAI model binding from

# common answerInstructions tail — the part that makes replies match the user's language
TAIL=" In one or two warm, conversational sentences, answer the question using only the references. Keep it friendly and concise. CRITICAL: detect the language of the user's question and write your ENTIRE reply in that same language; never answer in English when the user wrote in another language. Never invent facts, APIs, or links that are not in the references."
ANSWER="${PERSONA}${TAIL}"
RHINT="Always call ${TOOL} with keywords from the user's question BEFORE answering. Never answer from memory — ground every reply in the freshly retrieved documents."

echo "▶ endpoint OK · KS=$KS_NAME · KB=$KB_NAME · tool=$TOOL · serverURL=$SERVER_URL"

# --- 1) Knowledge Source: mcpServer.
#     Keyless public servers (e.g. Microsoft Learn): OMIT authentication entirely.
#     Private servers: pass AUTH_HEADER="Authorization: Bearer <token>" → storedHeaders.
AUTH_HEADER="${AUTH_HEADER:-}"
if [ -n "$AUTH_HEADER" ]; then
  HK="${AUTH_HEADER%%:*}"; HV="${AUTH_HEADER#*:}"; HV="${HV# }"
  AUTH_JSON=$(jq -n --arg k "$HK" --arg v "$HV" '{kind:"storedHeaders",storedHeadersParameters:{headers:{($k):$v}}}')
else
  AUTH_JSON="null"
fi
jq -n --arg name "$KS_NAME" --arg url "$SERVER_URL" --arg tool "$TOOL" --argjson auth "$AUTH_JSON" '{
  name: $name,
  kind: "mcpServer",
  description: ("Repolis scholar MCP grounding source (" + $name + ")."),
  mcpServerParameters: (
    { serverURL: $url, tools: [ { name: $tool, inclusionMode: "reranked" } ] }
    + (if $auth == null then {} else { authentication: $auth } end)
  )
}' > /tmp/_scholar_ks.json
echo "▶ PUT knowledgeSources/$KS_NAME"
HTTP=$(curl -sS -X PUT "$EP/knowledgeSources/$KS_NAME?api-version=$APIV" \
  -H "api-key: $KEY" -H "Content-Type: application/json" \
  --data @/tmp/_scholar_ks.json -w "%{http_code}" -o /tmp/_scholar_ks_resp.json)
echo "  → HTTP $HTTP"
case "$HTTP" in 2*) : ;; *) echo "❌ KS registration failed:"; cat /tmp/_scholar_ks_resp.json; echo; exit 1;; esac

# --- 2) clone the Azure OpenAI model binding from an existing KB ---
echo "▶ GET model binding from $SRC_KB"
curl -sS "$EP/knowledgebases/$SRC_KB?api-version=$APIV" -H "api-key: $KEY" -o /tmp/_scholar_srckb.json
MODELS=$(jq -c '.models' /tmp/_scholar_srckb.json 2>/dev/null || echo null)
[ "$MODELS" = "null" ] && { echo "❌ could not read .models from $SRC_KB (is it registered?)"; exit 1; }

# --- 3) Knowledge Base: persona + cloned model + this KS ---
jq -n \
  --arg name "$KB_NAME" \
  --arg ks "$KS_NAME" \
  --arg answer "$ANSWER" \
  --arg rhint "$RHINT" \
  --argjson models "$MODELS" '{
    name: $name,
    description: ("Repolis scholar KB grounding the " + $name + " NPC via an MCP knowledge source."),
    outputMode: "answerSynthesis",
    retrievalReasoningEffort: { kind: "medium" },
    knowledgeSources: [ { name: $ks } ],
    models: $models,
    retrievalInstructions: $rhint,
    answerInstructions: $answer
  }' > /tmp/_scholar_kb.json
echo "▶ PUT knowledgebases/$KB_NAME"
HTTP=$(curl -sS -X PUT "$EP/knowledgebases/$KB_NAME?api-version=$APIV" \
  -H "api-key: $KEY" -H "Content-Type: application/json" \
  --data @/tmp/_scholar_kb.json -w "%{http_code}" -o /tmp/_scholar_kb_resp.json)
echo "  → HTTP $HTTP"
case "$HTTP" in 2*) : ;; *) echo "❌ KB registration failed:"; cat /tmp/_scholar_kb_resp.json; echo; exit 1;; esac

echo
echo "✅ Registered scholar: KS=$KS_NAME  +  KB=$KB_NAME"
echo "   Worker map → SCHOLARS['<npc>'] = { kb: '$KB_NAME', ks: '$KS_NAME' }"
echo "   (then add a row to SCHOLARS.md and build the NPC in index.html)"
rm -f /tmp/_scholar_ks.json /tmp/_scholar_kb.json /tmp/_scholar_srckb.json /tmp/_scholar_ks_resp.json /tmp/_scholar_kb_resp.json
