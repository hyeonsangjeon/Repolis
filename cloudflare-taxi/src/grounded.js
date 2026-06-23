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

// --- Direct-MCP fallback for scholar NPCs. Used ONLY when the scholar's Azure Knowledge
// Base is unreachable/unconfigured (clone-friendly, keyless). Normally scholars go through
// the shared KB-retrieve pipeline below (GPT synthesis in the user's language + trace). ---
const MCP_NPCS = {
  msdocs: {
    url: "https://learn.microsoft.com/api/mcp",
    tool: "microsoft_docs_search",
    arg: "query",
    source: "Microsoft Learn (MCP)",
  },
};

// One town NPC → one grounded Knowledge Base (+ its MCP Knowledge Source). Every scholar
// shares the SAME Azure AI Search KB-retrieve pipeline (gpt-5.4-mini answerSynthesis,
// multi-turn, "how I found this" trace); only kb/ks differ. `ride` = the taxi can drive you
// to a repo, scholars just cite docs. See SCHOLARS.md. Any name is env-overridable.
function scholarConfig(npc, env) {
  const reg = {
    taxi: {
      kb: env.SEARCH_KB_NAME || "repolis-github-kb",
      ks: env.SEARCH_KS_NAME || "github-repos-mcp-ks",
      ride: true,
    },
    msdocs: {
      kb: env.MSDOCS_KB_NAME || "repolis-mslearn-kb",
      ks: env.MSDOCS_KS_NAME || "microsoft-learn-mcp-ks",
      ride: false,
    },
  };
  return reg[npc] || null;
}

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

// Scholar references are documentation links, not repos: title + url for the trace panel.
// (MS Learn refs carry the title at the top level; sourceData holds the JSON doc when
// includeReferenceSourceData is on.)
function parseDocs(references) {
  const out = [], seen = new Set();
  for (const r of references || []) {
    if (!r) continue;
    let title = r.title || "";
    let url = "";
    const sd = r.sourceData;
    const c = sd && (typeof sd === "object" ? sd.content : sd);
    if (typeof c === "string") {
      try { const o = JSON.parse(c); title = o.title || title; url = o.contentUrl || o.url || url; }
      catch { /* plain snippet */ }
    } else if (c && typeof c === "object") {
      title = c.title || title; url = c.contentUrl || c.url || url;
    }
    if (!url && sd && typeof sd === "object") url = sd.contentUrl || sd.url || "";
    title = String(title).slice(0, 160);
    const k = url || title;
    if ((title || url) && !seen.has(k)) { seen.add(k); out.push({ name: title, url }); }
  }
  return out;
}

// Thread recent chat history into the KB as a multi-turn conversation so follow-ups
// ("그건 AWS꺼잖아", "다른 건?") keep context. History items are { role, text }; newest
// question goes last. Capped so the request stays small.
function buildMessages(history, question) {
  const msgs = [];
  const hist = Array.isArray(history) ? history.slice(-8) : [];
  for (const h of hist) {
    if (!h || !h.text) continue;
    const role = h.role === "assistant" ? "assistant" : "user";
    msgs.push({ role, content: [{ type: "text", text: String(h.text).slice(0, 600) }] });
  }
  msgs.push({ role: "user", content: [{ type: "text", text: String(question).slice(0, 500) }] });
  return msgs;
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

// Shared Azure AI Search KB-retrieve for every scholar. Returns parsed pieces on success,
// or { fallback:true, reason } when the KB is unconfigured/slow/erroring so the caller can
// fall back (direct MCP for scholars, Local search for the taxi).
async function groundedRetrieve(cfg, messages, env) {
  const endpoint = env.SEARCH_ENDPOINT;
  const key = env.SEARCH_API_KEY;
  const apiVersion = env.SEARCH_API_VERSION || "2026-05-01-preview";
  const timeoutMs = Number(env.GROUNDED_TIMEOUT_MS || 25000); // CF: no ~10s wall, let the slow KB finish
  const maxRuntime = Number(env.GROUNDED_MAX_RUNTIME_S || 30); // KB requires 11–599
  if (!endpoint || !key || !cfg.kb) return { fallback: true, reason: "grounding not configured" };

  const ksList = (cfg.ks || "").split(",").map((s) => s.trim()).filter(Boolean);
  const url = `${endpoint.replace(/\/$/, "")}/knowledgebases/${cfg.kb}/retrieve?api-version=${apiVersion}`;
  const payload = {
    messages,
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
      return { fallback: true, reason: "kb " + r.status, detail };
    }
    const data = await r.json();
    const blocks = data.response?.[0]?.content || [];
    let answer = "";
    for (const c of blocks) if (c.type === "text") answer += c.text;
    answer = answer.replace(/\s*\[ref_id:\d+\]/g, "").trim(); // strip citation markers for the chat bubble
    const tools = [...new Set((data.references || []).map((x) => x.toolName).filter(Boolean))];
    const mcpMs = (data.activity || [])
      .filter((a) => a.type === "mcpServer")
      .reduce((s, a) => s + (a.elapsedMs || 0), 0);
    return { ok: true, status: r.status, data, answer, tools, mcpMs, totalMs: Date.now() - started };
  } catch (e) {
    clearTimeout(timer);
    const reason = e.name === "AbortError" ? "timeout " + timeoutMs + "ms" : String(e).slice(0, 160);
    return { fallback: true, reason };
  }
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method === "GET") {
      return new Response('Repolis taxi grounding — POST {"question":"…"}.', { status: 200, headers });
    }
    if (request.method !== "POST") return json({ error: "POST only" }, 405, env);

    let question, npc, history;
    try {
      ({ question, npc, history } = await request.json());
    } catch {
      return json({ error: "bad body" }, 400, env);
    }
    if (!question) return json({ error: "question required" }, 400, env);

    // Route to a scholar config (taxi by default). Every scholar shares the KB pipeline;
    // only the knowledge base / source differ. Multi-turn history is threaded in.
    const who = npc && scholarConfig(npc, env) ? npc : "taxi";
    const cfg = scholarConfig(who, env);
    const messages = buildMessages(history, question);

    const out = await groundedRetrieve(cfg, messages, env);

    // KB unreachable / slow / unconfigured / empty. A scholar with its own public MCP falls
    // back to a direct keyless call (clone-friendly); the taxi tells the client to use Local.
    if (out.fallback || (!out.answer && !(out.data?.references || []).length)) {
      if (MCP_NPCS[who]) return mcpAsk(who, question, env);
      return json({ fallback: true, reason: out.reason || "empty grounding", detail: out.detail }, 200, env);
    }

    if (cfg.ride) {
      // Taxi driver → pick the best repo so the client can drive there.
      const refs = parseRefs(out.data.references);
      const repo = pickRepo(out.answer, refs);
      return json({
        repo,
        message: out.answer,
        trace: { ks: cfg.ks, tools: out.tools, refs: refs.slice(0, 6), mcpMs: out.mcpMs, totalMs: out.totalMs, partial: out.status === 206 },
      }, 200, env);
    }

    // Scholar (e.g. MS Docs engineer) → synthesized answer in the user's language + doc links.
    const docs = parseDocs(out.data.references);
    return json({
      repo: null,
      message: out.answer,
      trace: { ks: cfg.ks, tools: out.tools, refs: docs.slice(0, 6), docs: true, mcpMs: out.mcpMs, totalMs: out.totalMs, partial: out.status === 206 },
    }, 200, env);
  },
};
