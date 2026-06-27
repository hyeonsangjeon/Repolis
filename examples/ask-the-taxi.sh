#!/usr/bin/env bash
# examples/ask-the-taxi.sh — query the live Repolis grounding Worker from the shell.
#
# This is the same backend the public site uses (the "🛰️ AI Foundry Live" taxi mode and the
# scholar NPCs). It is public and keyless to call. The site itself works WITHOUT it — when the
# Worker is unreachable the browser silently falls back to keyless Local search.
#
# Usage:
#   ./ask-the-taxi.sh "Azure AI Foundry"            # default npc=msdocs (VEGA · MS Learn), lang=ko
#   ./ask-the-taxi.sh "most popular repo" taxi en
#   ./ask-the-taxi.sh "facebook/react" deepwiki en
#
# Args:  $1 = question   $2 = npc (taxi|msdocs|deepwiki)   $3 = lang (ko|en)
set -euo pipefail

WORKER="${REPOLIS_WORKER:-https://repolis-taxi.wingnut0310.workers.dev/}"
QUESTION="${1:-Azure AI Foundry}"
NPC="${2:-msdocs}"
LANG="${3:-ko}"

curl -sS -X POST "$WORKER" \
  -H 'Content-Type: application/json' \
  --max-time 40 \
  -d "$(printf '{"question":%s,"npc":"%s","lang":"%s","history":[]}' \
        "$(printf '%s' "$QUESTION" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')" \
        "$NPC" "$LANG")"
echo

# Response shape (grounded answer):
#   { "message": "<answer in your language>",
#     "repo": null,
#     "trace": { "docs": true, "ks": "...", "tools": [...], "mcpMs": 812,
#                "refs": [ { "name": "Azure AI Foundry overview",
#                           "url": "https://learn.microsoft.com/azure/ai-foundry/..." }, ... ] } }
#
# Starlit (off-KB / small-talk) answer instead carries: "trace": { "general": true, "model": "gpt-5.4-mini" }
# Taxi navigation answers ("most popular repo") also return a "repo" the city would drive you to.
