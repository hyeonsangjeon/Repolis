// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ OPTIONAL ALTERNATIVE BACKEND — NOT what powers the live Repolis site.
//
// The LIVE deployment is served by the Cloudflare Worker in ../cloudflare-taxi/.
// Prefer that Worker: Cloudflare bills CPU time (not wall-clock awaiting a slow
// subrequest), so it doesn't hit Vercel Hobby's ~10s wall that silently drops slow
// KB answers to Local fallback. The Worker is also a SUPERSET of this function —
// it additionally answers off-KB / general / small-talk questions IN PERSONA via a
// keyless Entra service principal, and serves multiple scholar NPCs (see SCHOLARS.md).
//
// THIS Vercel function does grounded KB retrieval ONLY. It does NOT do the
// in-persona general chat — a `chat:true` / off-topic question here just returns
// { fallback:true } and the client shows a canned reply. Deploy it only if you
// specifically want Vercel instead of Cloudflare. See ../cloudflare-taxi/README.md
// and README "AI Foundry Live (grounded)".
// ─────────────────────────────────────────────────────────────────────────────
//
// Repolis taxi → Azure AI Search Knowledge Base (live GitHub MCP grounding).
//
// "🛰️ 라이브" mode routes free-form / live questions about my repos through an
// Azure AI Search Knowledge Base whose MCP Server Knowledge Source calls GitHub's
// hosted MCP server. The KB itself runs answerSynthesis with gpt-5.4-mini (via the
// search service's managed identity), so THIS function only needs a Search key —
// it never holds the Azure OpenAI key or the GitHub PAT (those stay server-side in
// the Knowledge Source on Azure).
//
// Deterministic navigation ("take me to the most popular repo") is handled on the
// client and never reaches here. If the KB is unreachable / slow / unconfigured we
// return { fallback:true } and the client silently falls back to Local search.
//
// Required environment variables (set in Vercel project settings):
//   SEARCH_ENDPOINT        e.g. https://<your-search>.search.windows.net
//   SEARCH_API_KEY         Search admin or query key (data-plane retrieve)
//   SEARCH_KB_NAME         knowledge base name (e.g. repolis-github-kb)
//   SEARCH_KS_NAME         comma-separated knowledge source name(s) — attach more MCPs
//                          here, e.g. github-repos-mcp-ks,microsoft-learn-mcp-ks
//   SEARCH_API_VERSION     optional (default 2026-05-01-preview)
//   GROUNDED_TIMEOUT_MS    optional fetch abort ms (default 9000, fits Vercel Hobby 10s;
//                          this — not the KB budget — is the real wall on Hobby)
//   GROUNDED_MAX_RUNTIME_S optional KB runtime budget seconds (default 30; the KB
//                          requires 11–599, but our fetch abort caps it earlier on Hobby)
//   ALLOW_ORIGIN           optional, e.g. https://hyeonsangjeon.github.io

function parseRefs(references) {
  const out = [];
  for (const r of references || []) {
    if (!r || !r.sourceData) continue;
    let c = r.sourceData.content;
    let obj = null;
    if (typeof c === "string") { try { obj = JSON.parse(c); } catch { obj = null; } }
    else if (c && typeof c === "object") { obj = c; }
    if (!obj || !(obj.name || obj.full_name)) continue;
    out.push({
      name: obj.name || (obj.full_name || "").split("/").pop(),
      full_name: obj.full_name || "",
      desc: obj.description || "",
      stars: obj.stargazers_count ?? null,
      forks: obj.forks_count ?? null,
      issues: obj.open_issues_count ?? null,
      lang: obj.language || "",
      url: obj.html_url || "",
      updated: obj.updated_at || "",
      tool: r.toolName || "",
      score: r.rerankerScore ?? 0,
    });
  }
  return out;
}

function pickRepo(answer, refs) {
  // Prefer the repo the model named in `backticks`, validated against references.
  const names = new Set(refs.map((r) => r.name.toLowerCase()));
  const ticks = [...String(answer || "").matchAll(/`([\w.\-]+)`/g)].map((m) => m[1]);
  for (const tk of ticks) {
    if (names.has(tk.toLowerCase())) return tk;
  }
  // else the top-reranked reference.
  if (refs.length) return [...refs].sort((a, b) => b.score - a.score)[0].name;
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOW_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const endpoint = process.env.SEARCH_ENDPOINT;
  const key = process.env.SEARCH_API_KEY;
  const kb = process.env.SEARCH_KB_NAME;
  const ksList = (process.env.SEARCH_KS_NAME || "github-repos-mcp-ks")
    .split(",").map((s) => s.trim()).filter(Boolean);   // attach N MCP sources to one KB
  const apiVersion = process.env.SEARCH_API_VERSION || "2026-05-01-preview";
  const timeoutMs = Number(process.env.GROUNDED_TIMEOUT_MS || 9000);
  const maxRuntime = Number(process.env.GROUNDED_MAX_RUNTIME_S || 30); // KB requires 11–599

  // No KB configured → tell the client to use Local search (silent fallback).
  if (!endpoint || !key || !kb) {
    return res.status(200).json({ fallback: true, reason: "grounding not configured" });
  }

  let question;
  try {
    ({ question } = req.body || {});
  } catch {
    return res.status(400).json({ error: "bad body" });
  }
  if (!question) return res.status(400).json({ error: "question required" });

  const url = `${endpoint.replace(/\/$/, "")}/knowledgebases/${kb}/retrieve?api-version=${apiVersion}`;
  const payload = {
    messages: [{ role: "user", content: [{ type: "text", text: String(question).slice(0, 500) }] }],
    includeActivity: true,
    knowledgeSourceParams: ksList.map((name) => ({
      kind: "mcpServer", knowledgeSourceName: name, includeReferences: true, includeReferenceSourceData: true,
    })),
    outputMode: "answerSynthesis",
    maxRuntimeInSeconds: maxRuntime,
  };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": key },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    // 200 OK or 206 Partial (ran the budget but returned usable refs) are both fine.
    if (r.status !== 200 && r.status !== 206) {
      const detail = (await r.text().catch(() => "")).slice(0, 200);
      return res.status(200).json({ fallback: true, reason: "kb " + r.status, detail });
    }

    const data = await r.json();
    const blocks = data.response?.[0]?.content || [];
    let answer = "";
    for (const c of blocks) if (c.type === "text") answer += c.text;
    answer = answer.replace(/\s*\[ref_id:\d+\]/g, "").trim(); // strip citation markers for the chat bubble

    const refs = parseRefs(data.references);
    if (!answer && !refs.length) {
      return res.status(200).json({ fallback: true, reason: "empty grounding" });
    }

    const repo = pickRepo(answer, refs);
    const tools = [...new Set((data.references || []).map((x) => x.toolName).filter(Boolean))];
    const mcpMs = (data.activity || [])
      .filter((a) => a.type === "mcpServer")
      .reduce((s, a) => s + (a.elapsedMs || 0), 0);

    return res.status(200).json({
      repo,
      message: answer,
      trace: {
        ks: ksList.join(", "),
        tools,
        refs: refs.slice(0, 6),
        mcpMs,
        totalMs: Date.now() - started,
        partial: r.status === 206,
      },
    });
  } catch (e) {
    clearTimeout(timer);
    const reason = e.name === "AbortError" ? "timeout " + timeoutMs + "ms" : String(e).slice(0, 160);
    return res.status(200).json({ fallback: true, reason });
  }
}
