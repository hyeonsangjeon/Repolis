# 🏛️ Repolis Scholars — MCP Oracles

Every specialist scholar in Repolis is one star, one myth, and exactly **one MCP oracle**.
POLARIS and VEGA use Azure AI Search Knowledge Sources/Knowledge Bases; RIGEL, MIRA, and
LYRA call official public MCP servers directly. Both paths return a "how I found this"
trace. Ordinary residents stay social and deterministic: they introduce the right scholar
and point the compass there instead of receiving MCP tools themselves.

> **Add a scholar = choose one oracle path, add one roster entry, one Worker adapter/config,
> one world encounter, and one row here.** This file is the human source of truth.

---

## 🗺️ How a scholar answers

```
You ─▶ scholar chat ─▶ Cloudflare Worker
                         ├─ POLARIS / VEGA ─▶ Azure AI Search KB ─▶ MCP Knowledge Source
                         └─ RIGEL / MIRA / LYRA ─▶ official public MCP directly
                                      │
                                      ├─ optional Foundry synthesis in the user's language
                                      └─ grounded answer + trace refs
```

**Clone‑friendly.** A fresh clone with no Azure works too: if a scholar's KB is not
configured, the worker degrades gracefully (direct keyless MCP call where possible, or the
NPC says it's live‑site‑only). No backend is ever *required* to run the city.

**✦ Off‑KB? The scholar still answers.** Every scholar — **the taxi POLARIS included** —
also handles **general conversation**. When a question falls outside its knowledge base
(trivia, astronomy, myth, plain small talk), or the KB returns nothing, the worker answers
**in‑persona** straight from **Azure AI Foundry `gpt-5.4-mini`** — no retrieval, no repo
pushed — and tags the reply with a ✦ *"how I answered"* trace panel. The client marks pure
small talk with a `chat:true` flag so the knowledge source is skipped entirely.

```
                    ┌─ repo / doc question ─▶ Knowledge Base (grounding) ─▶ answer + 🔎 refs
You ─▶ NPC chat ─▶ ┤
                    └─ small talk / off‑KB ─▶ Foundry gpt-5.4-mini (in‑persona) ─▶ answer + ✦ panel
```

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
| 📘 **VEGA** · the Archivist<br><sub>_Daidalos · Lyra_</sub> | MS Docs engineer | Microsoft · Azure · .NET docs | [Microsoft Learn MCP](https://learn.microsoft.com/api/mcp) | keyless (no auth) | `microsoft_docs_search` | `microsoft-learn-mcp-ks` | `repolis-mslearn-kb` | ✅ plaza |
| 🗺️ **RIGEL** · the Cartographer<br><sub>_Ariadne · Orion_</sub> | DeepWiki cartographer | Any public repo's inner architecture | [DeepWiki MCP](https://mcp.deepwiki.com/mcp) | keyless (no auth) | `ask_question` | _direct MCP — no KS_ | _direct MCP — no KB_ | ✅ live |
| 📚 **MIRA** · the Timekeeper<br><sub>_Kairos · Cetus_</sub> | Version librarian | Current library/API docs | [Context7 MCP](https://mcp.context7.com/mcp) | anonymous; optional API key | `resolve-library-id` → `query-docs` | _direct MCP_ | _direct MCP_ | ✅ roaming · Library |
| 🤗 **LYRA** · the Forgemaster<br><sub>_Orpheus · the Lyre_</sub> | AI material finder | Models · datasets · ML papers | [Hugging Face MCP](https://huggingface.co/mcp) | anonymous; optional token | `hub_repo_search`, `hf_fs` | _direct MCP_ | _direct MCP_ | ✅ roaming · AI |

---

## 🔭 Candidate scholars (curated — not yet wired)

Excellent public MCP servers that would make great town scholars. Pick one, choose a KB-backed
or direct path, then add a row above:

| Idea NPC | Domain | MCP server | Auth | Notes |
|----------|--------|------------|------|-------|
| ☁️ **Cloud scholar** | AWS service docs | [AWS Knowledge MCP](https://github.com/awslabs/mcp) | keyless | hosted AWS documentation lookup |

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
2. **Choose the path:** register a KS + persona KB when answer synthesis needs Azure retrieval, or
   implement a bounded direct adapter when the public MCP already has a useful read-only result.
3. **Map** it in `cloudflare-taxi/src/grounded.js` → `scholarConfig` and, for direct calls, `MCP_NPCS`.
4. **Build** the NPC in `index.html` (`NPCS.push({ …, kind:'<npc>' })`) + persona i18n keys.
5. **Document** — add a row to the *Active scholars* table above. Done. 🎉

---

## 🔐 Secrets

KS/KB definitions hold the GitHub PAT and the KB answer‑synthesis model access
**server‑side on Azure** — never in this repo or the browser. The Cloudflare Worker
holds two required things for the KB/persona path: the Azure AI **Search** key (`wrangler secret put SEARCH_API_KEY`)
for KB retrieval, and an **Entra ID service‑principal secret** (`AAD_CLIENT_SECRET`)
that lets it call Azure OpenAI **keyless** for the in‑persona general‑chat fallback —
no Azure OpenAI api‑key ever lives on the Worker. Real endpoint/key values live in the
git‑ignored `cloudflare-taxi/SECRETS.local.md`; the full secret list + the one‑line
`az ad sp create-for-rbac` setup are in [`cloudflare-taxi/README.md`](cloudflare-taxi/README.md).

MIRA and LYRA work anonymously. Optional `CONTEXT7_API_KEY` and `HF_TOKEN` Worker
secrets only raise third-party quotas; they are never sent to the browser.
When Context7's shared anonymous MCP quota is exhausted, MIRA uses the resolved library's
public Context7 `llms.txt` document as a bounded fallback and keeps the same source trace.
