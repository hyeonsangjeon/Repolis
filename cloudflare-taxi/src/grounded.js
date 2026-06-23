// Repolis taxi → Azure AI Search Knowledge Base (live GitHub MCP grounding) — Cloudflare Worker.
//
// Same grounding logic as ../../api/taxi-grounded.js (the Vercel function), ported to the
// Cloudflare Workers runtime: a `fetch(request, env)` handler returning Response objects,
// `env` bindings instead of process.env, and a Worker *secret* for the Search key.
//
// Why Cloudflare: Workers bill CPU time, not the wall-clock spent awaiting a subrequest, so a
// slow Knowledge Base call (the KB can take 15–21 s) can finish instead of being cut off by
// Vercel Hobby's ~10 s function wall — that means far fewer silent Local fallbacks on the
// public site. You already run the realtime presence Worker on Cloudflare's free plan, so this
// adds no new provider.
//
// This Worker only ever holds a *Search* key (`wrangler secret put SEARCH_API_KEY`). The Azure
// OpenAI key and the GitHub PAT stay server-side inside the Knowledge Source on Azure.
// Deterministic navigation ("take me to the most popular repo") is handled on the client and
// never reaches here. If the KB is unreachable / slow / unconfigured we return { fallback:true }
// and the client silently falls back to Local search.
//
// Bindings (see wrangler.toml [vars] + secrets):
//   SEARCH_ENDPOINT        e.g. https://<your-search>.search.windows.net
//   SEARCH_API_KEY         Search admin or query key  (SECRET — wrangler secret put)
//   SEARCH_KB_NAME         knowledge base name (e.g. repolis-github-kb)
//   SEARCH_KS_NAME         comma-separated knowledge source name(s) — attach more MCPs here
//   SEARCH_API_VERSION     optional (default 2026-05-01-preview)
//   GROUNDED_TIMEOUT_MS    optional fetch abort ms (default 25000; CF has no 10 s wall)
//   GROUNDED_MAX_RUNTIME_S optional KB runtime budget seconds (default 30; KB requires 11–599)
//   ALLOW_ORIGIN           optional, e.g. https://<you>.github.io (default *)

// --- Scholar/engineer NPC MCP servers (public, read-only; the Worker calls them directly,
// so these need no Azure Knowledge Base and no key). The allowlist stops clients from
// pointing the Worker at arbitrary MCP endpoints. Each maps one town NPC → one hosted MCP. ---
const MCP_NPCS = {
  msdocs: {
    url: "https://learn.microsoft.com/api/mcp",
    tool: "microsoft_docs_search",
    arg: "query",
    source: "Microsoft Learn (MCP)",
  },
};

// Streamable-HTTP MCP responses come back as SSE ("data: {json}" lines).
function parseSSE(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/^data:\s?(.*)$/);
    if (m) { try { out.push(JSON.parse(m[1])); } catch { /* skip keep-alives */ } }
  }
  return out;
}

async function mcpRpc(url, method, params, sid, isNotif, signal) {
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (sid) headers["mcp-session-id"] = sid;
  const body = { jsonrpc: "2.0", method };
  if (!isNotif) body.id = Math.floor(Math.random() * 1e9);
  if (params) body.params = params;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
  const ct = r.headers.get("content-type") || "";
  const txt = await r.text();
  let data = [];
  if (ct.includes("event-stream")) data = parseSSE(txt);
  else { try { data = [JSON.parse(txt)]; } catch { data = []; } }
  return { status: r.status, sid: r.headers.get("mcp-session-id"), data };
}

// Strip markdown so a docs snippet reads like a sentence in the chat bubble.
function cleanDoc(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\]\(https?:\/\/[^)]+\)/g, "")
    .replace(/^\s{0,3}#+\s*/gm, "")
    .replace(/[*_`>[\]]+/g, " ")
    .replace(/\r/g, "")
    .replace(/\n{2,}/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Talk to a public MCP server (initialize → tools/call) and shape the top docs for the chat.
async function mcpAsk(npc, question, env) {
  const cfg = MCP_NPCS[npc];
  const timeoutMs = Number(env.MCP_TIMEOUT_MS || 20000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const init = await mcpRpc(cfg.url, "initialize",
      { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "repolis-taxi", version: "1.0" } },
      null, false, ctrl.signal);
    const sid = init.sid;
    if (sid) await mcpRpc(cfg.url, "notifications/initialized", null, sid, true, ctrl.signal);
    const call = await mcpRpc(cfg.url, "tools/call",
      { name: cfg.tool, arguments: { [cfg.arg]: String(question).slice(0, 500) } },
      sid, false, ctrl.signal);
    clearTimeout(timer);

    const res = call.data.find((d) => d.result)?.result;
    const textBlock = (res?.content || []).find((b) => b.type === "text")?.text || "";
    let results = [];
    try { results = JSON.parse(textBlock).results || []; }
    catch { if (textBlock) results = [{ title: "", content: textBlock, contentUrl: "" }]; }

    const items = results.slice(0, 6).map((r) => ({
      title: String(r.title || "").slice(0, 160),
      url: r.contentUrl || r.url || "",
      snippet: cleanDoc(r.content).slice(0, 420),
    })).filter((i) => i.title || i.snippet);

    if (!items.length) return json({ fallback: true, reason: "no docs" }, 200, env);
    return json({
      kind: "docs",
      items,
      trace: { source: cfg.source, tool: cfg.tool, mcpMs: Date.now() - started, totalMs: Date.now() - started },
    }, 200, env);
  } catch (e) {
    clearTimeout(timer);
    const reason = e.name === "AbortError" ? "timeout " + timeoutMs + "ms" : String(e).slice(0, 160);
    return json({ fallback: true, reason }, 200, env);
  }
}

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

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method === "GET") {
      return new Response('Repolis taxi grounding — POST {"question":"…"}.', { status: 200, headers });
    }
    if (request.method !== "POST") return json({ error: "POST only" }, 405, env);

    let question, npc;
    try {
      ({ question, npc } = await request.json());
    } catch {
      return json({ error: "bad body" }, 400, env);
    }
    if (!question) return json({ error: "question required" }, 400, env);

    // Scholar/engineer NPCs answer from their own public MCP server (no Azure, no key).
    if (npc && MCP_NPCS[npc]) return mcpAsk(npc, question, env);

    // --- default (taxi driver): Azure AI Search KB → live GitHub MCP ---
    const endpoint = env.SEARCH_ENDPOINT;
    const key = env.SEARCH_API_KEY;
    const kb = env.SEARCH_KB_NAME;
    const ksList = (env.SEARCH_KS_NAME || "github-repos-mcp-ks")
      .split(",").map((s) => s.trim()).filter(Boolean);   // attach N MCP sources to one KB
    const apiVersion = env.SEARCH_API_VERSION || "2026-05-01-preview";
    const timeoutMs = Number(env.GROUNDED_TIMEOUT_MS || 25000); // CF: no ~10s wall, let the slow KB finish
    const maxRuntime = Number(env.GROUNDED_MAX_RUNTIME_S || 30); // KB requires 11–599

    // No KB configured → tell the client to use Local search (silent fallback).
    if (!endpoint || !key || !kb) {
      return json({ fallback: true, reason: "grounding not configured" }, 200, env);
    }

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
        return json({ fallback: true, reason: "kb " + r.status, detail }, 200, env);
      }

      const data = await r.json();
      const blocks = data.response?.[0]?.content || [];
      let answer = "";
      for (const c of blocks) if (c.type === "text") answer += c.text;
      answer = answer.replace(/\s*\[ref_id:\d+\]/g, "").trim(); // strip citation markers for the chat bubble

      const refs = parseRefs(data.references);
      if (!answer && !refs.length) {
        return json({ fallback: true, reason: "empty grounding" }, 200, env);
      }

      const repo = pickRepo(answer, refs);
      const tools = [...new Set((data.references || []).map((x) => x.toolName).filter(Boolean))];
      const mcpMs = (data.activity || [])
        .filter((a) => a.type === "mcpServer")
        .reduce((s, a) => s + (a.elapsedMs || 0), 0);

      return json({
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
      }, 200, env);
    } catch (e) {
      clearTimeout(timer);
      const reason = e.name === "AbortError" ? "timeout " + timeoutMs + "ms" : String(e).slice(0, 160);
      return json({ fallback: true, reason }, 200, env);
    }
  },
};
