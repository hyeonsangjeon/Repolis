# 🏛️ Repolis Scholars — Foundry MCP Knowledge Sources

Every NPC you can talk to in Repolis is a **scholar**: one town character grounded by
exactly **one public MCP server**. Each MCP is registered as an Azure AI Search
**Knowledge Source (KS)** and answered through a shared **Knowledge Base (KB)** pipeline —
GPT answer‑synthesis, multi‑turn memory, and a "how I found this" trace. Walk up to an
NPC and only *that* NPC's MCP is consulted.

> **Add a scholar = register one KS + persona KB, add one row here, add one line in the worker map.**
> This file is the single source of truth. The worker's `npc → { kb, ks }` map
> (`cloudflare-taxi/src/grounded.js`) and the registration script
> (`scripts/register_scholar_ks.sh`) mirror this table.

---

## 🗺️ How a scholar answers

```
You ─▶ NPC chat ─▶ Cloudflare Worker ─▶ Azure AI Search  Knowledge Base
                                          │   • answerInstructions = NPC persona
                                          │   • replies in the user's own language
                                          │   • outputMode: answerSynthesis
                                          ├▶ Knowledge Source  (kind: mcpServer)
                                          │     └▶ public MCP server  (tools/call)
                                          └▶ Azure OpenAI  gpt-5.4-mini  (synthesis)
                              ◀────────── grounded answer + trace refs
```

**Clone‑friendly.** A fresh clone with no Azure works too: if a scholar's KB is not
configured, the worker degrades gracefully (direct keyless MCP call where possible, or the
NPC says it's live‑site‑only). No backend is ever *required* to run the city.

---

## 👥 Active scholars

Each scholar is **one star in the night sky** — a name‑plate floating overhead, a
myth‑constellation drawn on the dome, a softly pulsing aura, and astronomer‑mage robes.
Their persona — star name, the myth they carry, the town, and the owner they serve — lives
in [`scholars.js`](scholars.js) and is wired into the chat, so *"who are you?"*, *"what is
this place?"* and *"who else is here?"* are answered **in‑character**, instantly, without
ever spending a Knowledge‑Source call.

| Scholar | Plays | Domain | MCP server | Auth | Key tool(s) | Knowledge Source | Knowledge Base | Status |
|---------|-------|--------|------------|------|-------------|------------------|----------------|--------|
| 🚕 **POLARIS** · the Wayfinder<br><sub>_Hermes · Ursa Minor_</sub> | Taxi driver | The owner's GitHub repos | [GitHub MCP](https://api.githubcopilot.com/mcp/readonly) | `storedHeaders` (PAT, server‑side) | `search_repositories`, `get_file_contents`, `list_commits`, `list_issues` | `github-repos-mcp-ks` | `repolis-github-kb` | ✅ live |
| 📘 **VEGA** · the Archivist<br><sub>_Daidalos · Lyra_</sub> | MS Docs engineer | Microsoft · Azure · .NET docs | [Microsoft Learn MCP](https://learn.microsoft.com/api/mcp) | keyless (no auth) | `microsoft_docs_search` | `microsoft-learn-mcp-ks` | `repolis-mslearn-kb` | ✅ live |

---

## 🔭 Candidate scholars (curated — not yet wired)

Excellent public MCP servers that would make great town scholars. Pick one, register a KS,
add a row above:

| Idea NPC | Domain | MCP server | Auth | Notes |
|----------|--------|------------|------|-------|
| 🤗 **AI scholar** | ML models & datasets | [Hugging Face MCP](https://huggingface.co/mcp) | token (some tools) | model / dataset / paper search |
| ☁️ **Cloud scholar** | AWS service docs | [AWS Knowledge MCP](https://github.com/awslabs/mcp) | keyless | hosted AWS documentation lookup |
| 📚 **Librarian** | Up‑to‑date library docs | [Context7 MCP](https://mcp.context7.com/mcp) | keyless | version‑accurate API docs |

---

## 🧩 Knowledge Source shape (`kind: mcpServer`)

Cloned from the live `github-repos-mcp-ks`. A keyless server only differs in
`authentication`:

```jsonc
{
  "name": "<scholar>-mcp-ks",
  "kind": "mcpServer",
  "description": "<one line about the source>",
  "mcpServerParameters": {
    "serverURL": "https://…/mcp",
    // keyless servers (e.g. Microsoft Learn): OMIT authentication entirely.
    // private servers instead use storedHeaders:
    // "authentication": { "kind": "storedHeaders",
    //   "storedHeadersParameters": { "headers": { "Authorization": "Bearer <token>" } } },
    "tools": [
      { "name": "<search_tool>", "inclusionMode": "reranked" }
    ]
  }
}
```

## 📒 Knowledge Base shape (the persona)

Each scholar gets its **own** KB so its voice and retrieval rules don't bleed into others:

```jsonc
{
  "name": "repolis-<scholar>-kb",
  "outputMode": "answerSynthesis",
  "retrievalReasoningEffort": { "kind": "medium" },
  "knowledgeSources": [ { "name": "<scholar>-mcp-ks" } ],
  "models": [ { "kind": "azureOpenAI", "azureOpenAIParameters": {
    "resourceUri": "https://<aoai>.cognitiveservices.azure.com",
    "deploymentId": "gpt-5.4-mini", "modelName": "gpt-5.4-mini"
  } } ],
  "retrievalInstructions": "Always call <search_tool> before answering …",
  "answerInstructions": "You are <persona>. Ground every answer in the references. "
    + "CRITICAL: detect the language of the user's question and write your ENTIRE reply "
    + "in that same language."
}
```

> The **"reply in the user's language"** clause is what makes a Korean question get a Korean
> answer even when the underlying docs are English.

---

## ➕ Add a new scholar (5 steps)

1. **Find** a public MCP server and its primary search tool.
2. **Register** the KS + persona KB in your Azure AI Search:
   `scripts/register_scholar_ks.sh <name> <serverURL> <searchTool> "<persona>"`
3. **Map** it in `cloudflare-taxi/src/grounded.js` → `SCHOLARS[npc] = { kb, ks }`.
4. **Build** the NPC in `index.html` (`NPCS.push({ …, kind:'<npc>' })`) + persona i18n keys.
5. **Document** — add a row to the *Active scholars* table above. Done. 🎉

---

## 🔐 Secrets

KS/KB definitions hold the GitHub PAT and the Azure OpenAI key **server‑side on Azure** —
never in this repo or the browser. The Cloudflare Worker only ever holds the Azure AI
**Search** key (`wrangler secret put SEARCH_API_KEY`). Real endpoint/key values live in the
git‑ignored `cloudflare-taxi/SECRETS.local.md`.
