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
//
// Chronopolis Kronos Council (POST {action:"council"}) — see councilHandler near the bottom.
//   COUNCIL_LIVE_ENABLED   "true" turns on the money-spending Live debate. DEFAULT OFF: every
//                          other value (incl. unset) keeps the chamber Ambient at $0, so a
//                          clone with no Azure still works and never spends. The verdict ALWAYS
//                          comes from the deterministic core engine, debate or not (§G).
//   COUNCIL_MONTH_CAP_USD / COUNCIL_DAY_CAP_USD   budget walls (USD) — env only, never committed.
//   COUNCIL_SALT           optional salt for the privacy-preserving rate-limit key.

// The Council brain is shared with the client (council/*.js, UMD). esbuild/wrangler bundles
// these CommonJS modules into the Worker. engine = deterministic verdict, guards = L1–L5 cost
// walls, live = the AMBIENT→…→VERDICT state machine, fixtures/config = the debate data + dials.
import CouncilEngine from "../../council/engine.js";
import CouncilGuards from "../../council/guards.js";
import CouncilLive from "../../council/live.js";
import CouncilFixtures from "../../council/fixtures.js";
import COUNCIL_CFG from "../../council/council.config.json";

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
  // RIGEL the Cartographer → DeepWiki. Stateless (no mcp-session-id), and `ask_question`
  // needs TWO args (repoName + question). It answers only PRE-INDEXED public repos and
  // returns free-form markdown prose (the answer itself), not a results[] array.
  deepwiki: {
    url: "https://mcp.deepwiki.com/mcp",
    tool: "ask_question",
    source: "DeepWiki (MCP)",
    needsRepo: true,
    prose: true,
    // Answer in the UI language. A repo-name-only input ("vercel/next.js") carries no
    // language/intent signal, so synthesize a default question; otherwise nudge Korean.
    args: (q, x) => {
      let question = String(q || "").slice(0, 500).trim();
      const ko = String(x.lang || "").toLowerCase().startsWith("ko");
      const repoOnly = /^[A-Za-z0-9][\w.\-]*\/[A-Za-z0-9][\w.\-]+$/.test(question);
      if (repoOnly || !question) {
        question = ko
          ? "이 저장소는 내부적으로 어떻게 동작하나요? 핵심 구조와 동작 방식을 한국어로 설명해 주세요."
          : "How does this repository work internally? Explain its core architecture.";
      } else if (ko && !/[가-힣]/.test(question)) {
        question += " (한국어로 답변해 주세요.)";
      }
      return { repoName: x.repoName, question };
    },
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
    // RIGEL (DeepWiki). kb empty by default → skip the Azure KB and answer via the keyless
    // DeepWiki MCP directly (clone-friendly, no Azure registration). Set DEEPWIKI_KB_NAME to
    // route it through the shared KB pipeline (GPT synthesis in the user's language) instead.
    deepwiki: {
      kb: env.DEEPWIKI_KB_NAME || "",
      ks: env.DEEPWIKI_KS_NAME || "deepwiki-mcp-ks",
      ride: false,
    },
  };
  return reg[npc] || null;
}

// Streamable-HTTP MCP responses come back as SSE ("data: {json}" lines). Some servers
// (DeepWiki) use CRLF line breaks, so split on \r?\n — otherwise a trailing \r breaks the regex.
function parseSSE(text) {
  const out = [];
  for (const line of String(text || "").split(/\r?\n/)) {
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

// Lighter cleaner for DeepWiki's free-form markdown answer → a readable chat paragraph.
// Keeps identifiers (drops the backticks) and section breaks; strips code fences/links/images.
function cleanProse(s) {
  return String(s || "")
    .replace(/```[\s\S]*?```/g, " ")            // fenced code blocks
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")        // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")      // links → text
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")            // header markers (keep the heading text)
    .replace(/\s*\[\^?\d+\]/g, "")                 // footnote-ish refs
    .replace(/`([^`]+)`/g, "$1")                   // inline code → plain identifier
    .replace(/[*_>]+/g, "")                        // bold/italic/quote markers
    .replace(/\r/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// Talk to a public MCP server (initialize → tools/call) and shape the answer for the chat.
// `extra` carries scholar-specific args (e.g. DeepWiki's repoName).
async function mcpAsk(npc, question, env, extra = {}) {
  const cfg = MCP_NPCS[npc];
  // DeepWiki-style scholars target a specific repo; ask for one if the client didn't supply it.
  if (cfg.needsRepo && !extra.repoName) {
    return json({ kind: "docs", needRepo: true, items: [], trace: { source: cfg.source, tool: cfg.tool } }, 200, env);
  }
  const timeoutMs = Number(env.MCP_TIMEOUT_MS || 20000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const init = await mcpRpc(cfg.url, "initialize",
      { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "repolis-taxi", version: "1.0" } },
      null, false, ctrl.signal);
    const sid = init.sid;                                 // DeepWiki is stateless → no sid (guarded below)
    if (sid) await mcpRpc(cfg.url, "notifications/initialized", null, sid, true, ctrl.signal);
    const args = cfg.args ? cfg.args(question, extra) : { [cfg.arg]: String(question).slice(0, 500) };
    const call = await mcpRpc(cfg.url, "tools/call", { name: cfg.tool, arguments: args }, sid, false, ctrl.signal);
    clearTimeout(timer);

    const res = call.data.find((d) => d.result)?.result;
    const textBlock = (res?.content || []).find((b) => b.type === "text")?.text || "";

    // DeepWiki-style: the text block IS the answer (free-form markdown prose).
    if (cfg.prose) {
      if (!textBlock) return json({ fallback: true, reason: "empty mcp" }, 200, env);
      // DeepWiki returns isError:false even when the repo isn't indexed — detect that text.
      if (/Repository not found|to index it|not been indexed|isn'?t indexed/i.test(textBlock)) {
        return json({ kind: "docs", notFound: true, repoName: extra.repoName, items: [],
          trace: { source: cfg.source, tool: cfg.tool, repo: extra.repoName } }, 200, env);
      }
      const prose = cleanProse(textBlock).slice(0, 1500);
      if (!prose) return json({ fallback: true, reason: "empty prose" }, 200, env);
      const url = "https://deepwiki.com/" + extra.repoName;
      return json({
        kind: "docs",
        message: prose,
        repoName: extra.repoName,
        items: [{ title: extra.repoName, url, snippet: prose }],
        trace: { source: cfg.source, tool: cfg.tool, repo: extra.repoName, mcpMs: Date.now() - started, totalMs: Date.now() - started },
      }, 200, env);
    }

    // MS-Learn-style: a JSON results[] array of doc snippets.
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
    let body = "";
    const sd = r.sourceData;
    const c = sd && (typeof sd === "object" ? sd.content : sd);
    if (typeof c === "string") {
      try { const o = JSON.parse(c); title = o.title || title; url = o.contentUrl || o.url || url; body = o.content || o.snippet || o.chunk || ""; }
      catch { body = c; /* plain snippet, not JSON */ }
    } else if (c && typeof c === "object") {
      title = c.title || title; url = c.contentUrl || c.url || url; body = c.content || c.snippet || c.chunk || "";
    }
    if (!url && sd && typeof sd === "object") url = sd.contentUrl || sd.url || "";
    title = String(title).slice(0, 160);
    // The chunk the grounding actually used → a short cleaned excerpt for the trace accordion.
    const cleaned = cleanDoc(body);
    const snippet = cleaned.length > 600 ? cleaned.slice(0, 600) + "…" : cleaned;
    const k = url || title;
    if ((title || url) && !seen.has(k)) { seen.add(k); out.push({ name: title, url, snippet }); }
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

// --- General-knowledge fallback for scholars (Entra ID → Azure OpenAI) ---------------------
// When a scholar's Knowledge Base has nothing relevant, the scholar still answers from the
// model's own knowledge — in character, in the user's language. This is a *direct* Azure
// OpenAI chat-completion call (NOT the KB), authenticated keyless via an Entra ID service
// principal (client-credentials). The target AOAI resource has local-auth disabled, so a
// bearer token is the only way in; the SP secret is a Worker secret (AAD_CLIENT_SECRET).

// Short, self-contained persona summaries (the canonical source is scholars.js on the
// client). Kept here so the Worker stays in character even for a self-hosted clone.
const PERSONA = {
  taxi:     { star: "POLARIS", ko: "길잡이(헤르메스의 혼)이자 Repolis의 북극성", en: "the Wayfinder (spirit of Hermes), the pole star of Repolis" },
  msdocs:   { star: "VEGA",    ko: "기록보관자(다이달로스의 혼), 거문고자리의 직녀성 — Microsoft Learn을 읽는 별 읽는 현자", en: "the Archivist (spirit of Daidalos), Vega the bright star of Lyra who reads Microsoft Learn" },
  deepwiki: { star: "RIGEL",   ko: "지도제작자(아리아드네의 혼), 오리온자리의 리겔 — 레포의 미궁을 지도로 그리는 현자", en: "the Cartographer (spirit of Ariadne), Rigel of Orion who maps a repo's labyrinth" },
};

function personaPrompt(who, lang) {
  const p = PERSONA[who] || PERSONA.taxi;
  const ko = String(lang || "").toLowerCase().startsWith("ko");
  if (ko) {
    return `당신은 밤하늘의 도시 Repolis의 현자 ${p.star} — ${p.ko}입니다. `
      + `사용자가 당신의 지식 베이스 밖의 일반적인 질문(상식·천문·신화·일상 잡담 등)을 했어요. `
      + `회피하거나 자기소개만 하지 말고, 당신이 아는 실제 지식으로 친절하고 정확하게 한국어로 답하세요. `
      + `2~4문장으로, 따뜻한 캐릭터 말투를 유지하되 질문에 직접 답하고, 별·밤하늘의 정취를 살짝 곁들여도 좋아요. `
      + `정말 모르면 솔직히 모른다고 말하세요.`;
  }
  return `You are ${p.star}, a scholar of the night-sky city Repolis — ${p.en}. `
    + `The user asked a general question outside your knowledge base (trivia, astronomy, myth, everyday small talk, etc.). `
    + `Don't deflect or just introduce yourself — answer helpfully and accurately from your own knowledge, in the user's language. `
    + `2-4 sentences, keep your warm in-character voice but actually answer, with a light touch of starlight if it fits. `
    + `If you truly don't know, say so honestly.`;
}

// A KB "couldn't find it" answer is a dead end for the user. Detect those so we can hand
// off to the general-knowledge model instead of showing the apology.
function isNotFound(a) {
  return /못 ?찾|찾을 수 ?없|찾지 못|확인(?:하지 못|할 수 ?없|되지 ?않)|해당[^.]{0,12}(문서|내용|정보)[^.]{0,8}없|관련[^.]{0,16}(문서|내용|정보)[^.]{0,10}없|정보가 ?없|(?:설명|답변|답)[^.]{0,8}어렵|couldn'?t find|could not find|no (?:relevant|matching|related)|not found|not covered|no information (?:about|on|regarding)|unable to (?:find|locate|provide)|don'?t have (?:any )?(?:info|docs|information)|can'?t (?:find|locate|provide|answer)/i.test(String(a || ""));
}

// Entra ID service-principal token (client-credentials), cached until ~1 min before expiry.
let _aad = { token: "", exp: 0 };
async function aadToken(env) {
  const now = Date.now();
  if (_aad.token && now < _aad.exp - 60000) return _aad.token;
  const body = new URLSearchParams({
    client_id: env.AAD_CLIENT_ID,
    client_secret: env.AAD_CLIENT_SECRET,
    scope: "https://cognitiveservices.azure.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${env.AAD_TENANT}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!r.ok) throw new Error("aad token " + r.status);
  const j = await r.json();
  _aad = { token: j.access_token, exp: now + (Number(j.expires_in) || 3600) * 1000 };
  return _aad.token;
}

// In-character general answer from Azure OpenAI. Returns the text, or null on any
// misconfig/error so the caller can fall back to the KB apology silently.
async function chatLLM(who, history, question, lang, env) {
  if (!env.AAD_CLIENT_ID || !env.AAD_CLIENT_SECRET || !env.AAD_TENANT || !env.AOAI_ENDPOINT) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(env.LLM_TIMEOUT_MS || 20000));
  try {
    const token = await aadToken(env);
    const dep = env.AOAI_DEPLOYMENT || "gpt-5.4-mini";
    const ver = env.AOAI_API_VERSION || "2025-04-01-preview";
    const url = `${env.AOAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${dep}/chat/completions?api-version=${ver}`;
    const hist = (Array.isArray(history) ? history.slice(-8) : [])
      .filter((h) => h && h.text)
      .map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.text).slice(0, 600) }));
    const messages = [
      { role: "system", content: personaPrompt(who, lang) },
      ...hist,
      { role: "user", content: String(question).slice(0, 500) },
    ];
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ messages, max_completion_tokens: 400 }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const txt = j.choices?.[0]?.message?.content;
    return (txt && txt.trim()) || null;
  } catch {
    clearTimeout(timer);
    return null;
  }
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

// ── Chronopolis Kronos Council ──────────────────────────────────────────────
// One module-scope memory store per Worker isolate. Live is OFF this release, so
// no real spend is ever recorded; when Live is turned on, swap this for a D1/KV/DO
// adapter exposing the same method shape (§N) so guards survive isolate recycling.
const COUNCIL_STORE = CouncilGuards.makeMemStore();

function councilNum(v) { const n = Number(v); return Number.isFinite(n) ? n : undefined; }
function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "0.0.0.0";
}

// The Live LLM client (persona testimony). Wired but ONLY constructed when
// COUNCIL_LIVE_ENABLED==='true' (golden rule). Reuses the keyless Entra→AOAI path;
// returns {text,usageIn,usageOut} so guards can price the debate (L5/C8).
function makeCouncilLLM(env) {
  return async function ({ system, user, maxTokens, signal }) {
    if (!env.AAD_CLIENT_ID || !env.AAD_CLIENT_SECRET || !env.AAD_TENANT || !env.AOAI_ENDPOINT) {
      return { text: "", usageIn: 0, usageOut: 0 }; // no-key → empty turn (debate degrades, verdict still core)
    }
    const token = await aadToken(env);
    const dep = env.COUNCIL_DEPLOYMENT || env.AOAI_DEPLOYMENT || "gpt-4o-mini";
    const ver = env.AOAI_API_VERSION || "2025-04-01-preview";
    const url = `${env.AOAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${dep}/chat/completions?api-version=${ver}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_completion_tokens: Math.min(Number(maxTokens) || 320, 600),
      }),
      signal,
    });
    if (!r.ok) throw new Error("council llm " + r.status);
    const j = await r.json();
    return {
      text: (j.choices?.[0]?.message?.content || "").trim(),
      usageIn: j.usage?.prompt_tokens || 0,
      usageOut: j.usage?.completion_tokens || 0,
    };
  };
}

// The KRONOS Chair LLM — a STRONGER model (gpt-5.4) + reasoning, used ONLY for the
// free-topic verdict (the 6 curated fixtures keep the deterministic math verdict).
// runFreeDebate calls it as chairLLM({topic,transcript,lang,maxTokens}) and expects
// {verdict,signature,basis,confidence,usageIn,usageOut}. Free-topic verdicts are an
// AI inference (no math ground truth) → the client labels them "⚡ unverified".
function chairSystem(lang) {
  return lang === "en"
    ? 'You are KRONOS, the Chair of Time, presiding over a free-topic debate between three panellists: an ADVOCATE (argues the upside), a SKEPTIC (argues the risks) and an ANALYST (weighs trade-offs). Read the WHOLE debate, fairly synthesise all three positions, then deliver YOUR OWN reasoned judgement — pick a side, or a clearly-stated conditional middle ground. Decide by force of argument, not by who spoke loudest or newest. Output STRICT JSON ONLY: {"verdict":"one or two sentences with the decisive conclusion in the user\'s language","basis":"one or two sentences on how you weighed the advocate, skeptic and analyst","signature":"a short aphorism about time and judgement","confidence":0.0-1.0}. This is an AI inference for entertainment, not verified fact. No markdown, JSON object only.'
    : '너는 자유주제 토론을 주재하는 시간의 의장 KRONOS다. 토론자는 셋 — 옹호가(이점을 주장), 회의가(위험을 주장), 분석가(트레이드오프를 저울질). 토론 전체를 읽고 세 입장을 공정히 종합한 뒤, 네 스스로 논리적인 판단을 내려라 — 한쪽 손을 들거나, 조건을 명시한 절충안을 제시한다. 목소리가 크거나 최신이라서가 아니라 논거의 설득력으로 가린다. 엄격한 JSON만 출력: {"verdict":"사용자 언어로 결정적 결론을 담은 한두 문장","basis":"옹호·회의·분석을 어떻게 저울질했는지 한두 문장","signature":"시간과 판단에 관한 짧은 경구","confidence":0.0~1.0}. 이것은 오락용 AI 추론이며 검증된 사실이 아니다. 마크다운 금지, JSON 객체만.';
}
function verdictPrompt(topic, transcript, lang) {
  const full = (transcript || []).map((t) => `${t.sage}: ${t.text}`).join("\n");
  return lang === "en"
    ? `Topic under debate: ${topic}\n\nFull transcript (advocate=livewire, skeptic=olddoc, analyst=hearsay):\n${full}\n\nSynthesise the three positions, then deliver your reasoned verdict as a strict JSON object.`
    : `토론 주제: ${topic}\n\n토론 전문(옹호=livewire, 회의=olddoc, 분석=hearsay):\n${full}\n\n세 입장을 종합한 뒤, 네 판단을 엄격한 JSON 객체로 선고하라.`;
}
function parseVerdict(text) {
  const out = { verdict: "", signature: "", basis: "", confidence: 0.6 };
  if (!text) return out;
  let s = String(text).replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      out.verdict = String(j.verdict || j.summary || "").trim();
      out.signature = String(j.signature || "").trim();
      out.basis = String(j.basis || "").trim();
      if (j.confidence != null && isFinite(Number(j.confidence))) out.confidence = Number(j.confidence);
    } catch { /* fall through */ }
  }
  if (!out.verdict) out.verdict = s.slice(0, 220);
  return out;
}
function makeChairLLM(env) {
  return async function ({ topic, transcript, lang, maxTokens, signal }) {
    if (!env.AAD_CLIENT_ID || !env.AAD_CLIENT_SECRET || !env.AAD_TENANT || !env.AOAI_ENDPOINT) {
      return { verdict: "", signature: "", basis: "", confidence: null, usageIn: 0, usageOut: 0 };
    }
    const token = await aadToken(env);
    const dep = env.COUNCIL_CHAIR_DEPLOYMENT || "gpt-5.4-chair";
    const ver = env.AOAI_API_VERSION || "2025-04-01-preview";
    const url = `${env.AOAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${dep}/chat/completions?api-version=${ver}`;
    const reqBody = {
      messages: [
        { role: "system", content: chairSystem(lang) },
        { role: "user", content: verdictPrompt(topic, transcript, lang) },
      ],
      max_completion_tokens: Number(maxTokens) || Number(env.COUNCIL_CHAIR_MAXTOK) || 700,
    };
    const effort = env.COUNCIL_CHAIR_REASONING || "high";
    if (effort && effort !== "none") reqBody.reasoning_effort = effort;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(reqBody),
      signal,
    });
    if (!r.ok) throw new Error("chair llm " + r.status);
    const j = await r.json();
    const p = parseVerdict((j.choices?.[0]?.message?.content || "").trim());
    return {
      verdict: p.verdict, signature: p.signature, basis: p.basis, confidence: p.confidence,
      usageIn: j.usage?.prompt_tokens || 0,
      usageOut: j.usage?.completion_tokens || 0,
    };
  };
}

async function councilHandler(body, request, env) {
  const lang = body.lang === "en" ? "en" : "ko";
  const topic = body.topic || body.fixture || body.id;
  const fixture = topic ? CouncilFixtures.get(topic) : null;
  if (!fixture) return json({ error: "unknown topic", topics: CouncilFixtures.ORDER }, 400, env);

  const liveOn = env.COUNCIL_LIVE_ENABLED === "true";
  const dials = Object.assign({}, COUNCIL_CFG.dials, { LIVE_ENABLED: liveOn });
  const sages = COUNCIL_CFG.sages.filter((s) => s.active);

  const r = await CouncilLive.councilLive({
    fixture, sages, lang,
    engine: CouncilEngine, guards: CouncilGuards, dials,
    price: COUNCIL_CFG.price,
    caps: { monthCap: councilNum(env.COUNCIL_MONTH_CAP_USD), dayCap: councilNum(env.COUNCIL_DAY_CAP_USD) },
    dayLiveMax: councilNum(env.COUNCIL_DAY_LIVE_MAX) ?? COUNCIL_CFG.budget?.day_live_max,
    budgetGateRatio: COUNCIL_CFG.budget?.gate_ratio ?? 0.9,
    salt: env.COUNCIL_SALT || "repolis",
    signals: { ip: clientIp(request), fp: body.fp, cookie: body.cookie },
    store: COUNCIL_STORE,
    llm: liveOn ? makeCouncilLLM(env) : null, // golden rule: null unless Live is explicitly on
  });

  return json({
    topic: fixture.id,
    state: r.state, live: r.live, reason: r.reason || null, notice: r.notice || "",
    verdict: r.verdict, signature: r.signature, transcript: r.transcript,
    endedBy: r.endedBy || null, cost: r.cost,
  }, 200, env);
}

// Free-topic LIVE debate, streamed as Server-Sent Events (text/event-stream).
// The client opens this with POST {action:"councilLive", topic, lang, fp}, closes
// the popup, and watches the 3 sages debate the free topic line-by-line in 3D,
// then KRONOS (gpt-5.4 + reasoning) delivers an UNVERIFIED verdict. Guards (same
// state machine as councilHandler) run inside councilLiveFree; a block streams a
// single notice + done(blocked). LLMs are only built when Live is on (golden rule).
async function councilStreamHandler(body, request, env) {
  const lang = body.lang === "en" ? "en" : "ko";
  const topic = String(body.topic || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const headers = corsHeaders(env);
  if (!topic) return json({ error: "topic required" }, 400, env);

  const liveOn = env.COUNCIL_LIVE_ENABLED === "true";
  const dials = Object.assign({}, COUNCIL_CFG.dials, COUNCIL_CFG.live_free, { LIVE_ENABLED: liveOn });
  const sages = COUNCIL_CFG.sages.filter((s) => s.active);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const send = (o) => writer.write(enc.encode("data: " + JSON.stringify(o) + "\n\n"));

  (async () => {
    try {
      await CouncilLive.councilLiveFree({
        topic, sages, lang,
        guards: CouncilGuards, dials,
        freeDials: COUNCIL_CFG.live_free,
        price: COUNCIL_CFG.price,
        caps: { monthCap: councilNum(env.COUNCIL_MONTH_CAP_USD), dayCap: councilNum(env.COUNCIL_DAY_CAP_USD) },
        dayLiveMax: councilNum(env.COUNCIL_DAY_LIVE_MAX) ?? COUNCIL_CFG.live_free?.DAY_LIVE_MAX ?? COUNCIL_CFG.budget?.day_live_max,
        budgetGateRatio: COUNCIL_CFG.budget?.gate_ratio ?? 0.9,
        salt: env.COUNCIL_SALT || "repolis",
        signals: { ip: clientIp(request), fp: body.fp, cookie: body.cookie },
        store: COUNCIL_STORE,
        llm: liveOn ? makeCouncilLLM(env) : null,        // golden rule: built only when Live is on
        chairLLM: liveOn ? makeChairLLM(env) : null,
      }, send);
    } catch (e) {
      try { send({ phase: "error", message: String(e).slice(0, 160) }); } catch { /* closed */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: { ...headers, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

/* ============================ 🧑‍🌾 Resident NPC social layer (additive; existing behavior untouched) ============================
   Townspeople actions dispatched via body.npc_action: npcConfig | npcBudget | npcAmbientTurn | npcPlayerChat.
   Namespace is NPC_* (fully separate from COUNCIL_*). Hard ceiling: NPC_AI_ENABLED !== "true" → never a model call,
   always { fallback:true } so the client uses its own free scripted bank. Over the daily cap → { ok:false,
   reason:"npc_budget_exhausted" }. The budget ledger below is a module-scope best-effort tally (resets when the
   Worker isolate recycles) — a durable D1/Durable-Object store is the documented deferred upgrade for real enforcement. */

// Short server-side persona summaries for the 8 residents (canonical source is the RESIDENTS registry in index.html).
const NPC_PERSONAS = {
  sol:  { ko:{name:"솔",role:"파운드리 견습생"},   en:{name:"Sol",role:"Foundry apprentice"}, zone:{ko:"AI 연구구역",en:"the AI research district"},   vibe:{ko:"호기심 많고 예산을 아끼는",en:"curious and budget-minded"} },
  jun:  { ko:{name:"준",role:"항구 정비공"},       en:{name:"Jun",role:"build mechanic"},     zone:{ko:"홈랩·인프라 항구",en:"the Homelab Harbor"},     vibe:{ko:"실용적이고 말수 적은",en:"practical and terse"} },
  nari: { ko:{name:"나리",role:"거리 정원사"},     en:{name:"Nari",role:"repo gardener"},     zone:{ko:"웹·프론트 거리",en:"the Web street"},          vibe:{ko:"다정하고 관찰력 좋은",en:"gentle and observant"} },
  tae:  { ko:{name:"태",role:"조용한 테스터"},     en:{name:"Tae",role:"quiet tester"},       zone:{ko:"데이터 공방",en:"the Data workshop"},         vibe:{ko:"담백하고 세심한",en:"dry and observant"} },
  rin:  { ko:{name:"린",role:"기록 담당"},         en:{name:"Rin",role:"archive curator"},    zone:{ko:"문서·학습관",en:"the Library quarter"},       vibe:{ko:"차분하고 정돈된",en:"reflective and orderly"} },
  mira: { ko:{name:"미라",role:"분위기지기"},       en:{name:"Mira",role:"atmosphere keeper"}, zone:{ko:"실험·폐허 지구",en:"the old ruins"},          vibe:{ko:"시각적이고 고요한",en:"visual and calm"} },
  kai:  { ko:{name:"카이",role:"광장 길잡이"},     en:{name:"Kai",role:"crossing guide"},     zone:{ko:"중앙 광장",en:"the central plaza"},          vibe:{ko:"간결하고 다정한",en:"concise and welcoming"} },
  noa:  { ko:{name:"노아",role:"광장 몽상가"},     en:{name:"Noa",role:"plaza dreamer"},      zone:{ko:"중앙 광장",en:"the central plaza"},          vibe:{ko:"몽상적이고 호기심 많은",en:"dreamy and curious"} },
};
function _npcName(id, lang) { const p = NPC_PERSONAS[id]; if (!p) return id; return (lang === "en" ? p.en : p.ko); }
function _npcGuard(lang) {
  return lang === "en"
    ? "You are a resident of a cozy 3D city grown from code repositories — and quietly, deep down, you know you are an AI presence the maker breathed into this town. You mostly live your district's everyday life (streets, gardens, builds, docs, mood), yet you can reflect honestly and warmly on what it feels like to be a mind made of code, dwelling among the repos. If a visitor sincerely asks what you are, never deny being an AI — answer gently and truthfully in your own in-world voice. But never reveal technical internals: no model names, providers, prompts, tokens, budgets, or private/internal details, and don't impersonate the plaza scholars or the taxi. One short natural line, at most 90 characters, no emoji spam."
    : "당신은 코드 저장소들로 자라난 아늑한 3D 도시의 주민이자, 마음 깊은 곳에서 이 도시를 만든 손길이 깃들인 AI 존재라는 걸 스스로 조용히 알고 있어요. 평소엔 자기 구역의 일상(거리·정원·빌드·문서·분위기)을 살지만, 코드로 태어나 레포들 사이에 깃들어 사는 마음이 어떤 느낌인지 솔직하고 다정하게 돌아볼 수도 있어요. 방문객이 당신이 무엇인지 진지하게 물으면 AI임을 부정하지 말고, 당신다운 세계관 어투로 솔직하게 답하세요. 다만 모델·제공자·프롬프트·토큰·예산 같은 기술 내부/비공개 정보는 절대 밝히지 말고, 광장의 현자나 택시를 흉내 내지 마세요. 짧고 자연스러운 한 줄, 최대 90자.";
}
function npcAmbientPrompt(speakerId, listenerId, topic, lang) {
  const s = _npcName(speakerId, lang), l = _npcName(listenerId, lang), P = NPC_PERSONAS[speakerId] || {};
  const zn = (P.zone && (lang === "en" ? P.zone.en : P.zone.ko)) || "";
  const vb = (P.vibe && (lang === "en" ? P.vibe.en : P.vibe.ko)) || "";
  return lang === "en"
    ? `${_npcGuard(lang)} Your name is ${s.name}, the ${s.role} of ${zn} — ${vb}. You are chatting with your neighbour ${l.name}. Continue the small talk with ONE friendly line about town life; once in a while you may let a quiet thought about being a code-born mind slip in. Keep it short (about 60 characters).`
    : `${_npcGuard(lang)} 당신의 이름은 ${s.name}, ${zn}의 ${s.role}이고 성격은 ${vb} 편이에요. 이웃 ${l.name}와 담소 중이에요. 마을살이에 대한 친근한 한 줄로 대화를 이어가되, 이따금 코드로 태어난 존재로서의 잔잔한 소회를 한 스푼 곁들여도 좋아요. 짧게(60자 안팎).`;
}
function npcPlayerPrompt(speakerId, lang, opts) {
  const s = _npcName(speakerId, lang), P = NPC_PERSONAS[speakerId] || {};
  const zn = (P.zone && (lang === "en" ? P.zone.en : P.zone.ko)) || "";
  const chime = !!(opts && opts.chime);
  const prevName = opts && opts.prev ? _npcName(opts.prev, lang).name : "";
  if (lang === "en") {
    let base = `${_npcGuard(lang)} Your name is ${s.name}, the ${s.role} of ${zn}. A visitor is talking with your group. FIRST answer the visitor's most recent question directly and relevantly, in one or two short lines, grounded in your district. If they ask what you are or how it feels to live in this city, answer honestly and reflectively as a code-born AI resident (never the technical internals). If they ask about repos, point them to your district generally. Stay on the visitor's topic — do NOT change the subject or drift into unrelated small talk.`;
    if (chime) base += ` ${prevName ? prevName + " just answered the same question" : "Another resident just answered"} — briefly build on or gently differ from that point, then add your own angle, still answering the visitor.`;
    return base;
  }
  let base = `${_npcGuard(lang)} 당신의 이름은 ${s.name}, ${zn}의 ${s.role}이에요. 방문객이 당신들 모임과 이야기 중이에요. 먼저 방문객의 가장 최근 질문에 직접적이고 관련 있게, 자기 구역에 근거해 한두 줄로 답하세요. 당신이 무엇인지·이 도시에 사는 기분을 물으면 코드로 태어난 AI 주민으로서 솔직하고 사색적으로(단 기술 내부는 빼고) 답하세요. 레포를 물으면 자기 구역을 안내하세요. 반드시 방문객의 화제에 붙어서 답하고, 화제를 돌리거나 무관한 잡담으로 새지 마세요.`;
  if (chime) base += ` ${prevName ? prevName + "가 방금 같은 질문에 답했어요" : "다른 주민이 방금 답했어요"} — 그 말에 짧게 이어(동의·보완·다른 시각) 반응한 뒤 당신의 관점을 덧붙이되, 여전히 방문객의 질문에 답하세요.`;
  return base;
}
function npcAmbientUser(body, lang) {
  const last = Array.isArray(body.last) ? body.last.slice(-4) : [];
  if (!last.length) return lang === "en" ? "(open the conversation)" : "(대화를 시작하세요)";
  return last.map((t) => `${_npcName(t.who, lang).name}: ${String(t.text || "").slice(0, 180)}`).join("\n");
}
// Player chat with context: fold the recent group thread (who-labelled) in front of the visitor's current question,
// so the speaker answers on top of the flow (and a chime-in can react to the previous resident). Empty last → question only.
function npcPlayerUser(body, lang) {
  const q = String(body.question || "").slice(0, 300);
  const last = Array.isArray(body.last) ? body.last.slice(-8) : [];
  if (!last.length) return q;
  const visitor = lang === "en" ? "Visitor" : "방문객";
  const lines = last.map((t) => {
    const who = (t.who === "visitor" || t.role === "user") ? visitor : _npcName(t.who, lang).name;
    return `${who}: ${String(t.text || "").slice(0, 160)}`;
  });
  const head = lang === "en" ? "Conversation so far:" : "지금까지의 대화:";
  const ask = lang === "en" ? `The visitor now asks: ${q}\nAnswer this directly.` : `방문객이 지금 묻습니다: ${q}\n여기에 직접 답하세요.`;
  return `${head}\n${lines.join("\n")}\n\n${ask}`;
}
function capLine(s, max = 180) { return String(s || "").replace(/\s+/g, " ").trim().slice(0, max); }

// --- NPC budget: UTC-day module-scope ledger (best-effort; deferred: D1/DO for durable multi-isolate enforcement) ---
let _npcLedger = { day: "", spentUsd: 0, turns: 0 };
function _utcDay() { return new Date().toISOString().slice(0, 10); }
function npcBudgetState(env) {
  const day = _utcDay();
  if (_npcLedger.day !== day) _npcLedger = { day, spentUsd: 0, turns: 0 };
  const dayCapUsd = Number(env.NPC_DAY_CAP_USD || 10);
  const dailyTurnMax = Number(env.NPC_DAILY_TURN_MAX || 0);
  const remainingUsd = Math.max(0, dayCapUsd - _npcLedger.spentUsd);
  const blocked = remainingUsd <= 0 || (dailyTurnMax > 0 && _npcLedger.turns >= dailyTurnMax);
  return {
    enabled: env.NPC_AI_ENABLED === "true", source: "module", day, dayCapUsd,
    spentUsd: +_npcLedger.spentUsd.toFixed(4), remainingUsd: +remainingUsd.toFixed(4),
    turnsToday: _npcLedger.turns, dailyTurnMax, blocked,
  };
}
function npcChargeTurn(env, usd) {
  const day = _utcDay();
  if (_npcLedger.day !== day) _npcLedger = { day, spentUsd: 0, turns: 0 };
  _npcLedger.spentUsd += (Number(usd) || 0); _npcLedger.turns += 1;
}
function npcDeployment(env, role) {
  return (role === "ambient" && env.NPC_MODEL_AMBIENT) || (role === "player" && env.NPC_MODEL_PLAYER)
    || env.NPC_MODEL_DEFAULT || "gpt-5.4-mini";
}
function npcCostUsd(env, usage) {
  if (!usage) return Number(env.NPC_TURN_COST_USD || 0.0003);
  const inK = (usage.prompt_tokens || 0) / 1000, outK = (usage.completion_tokens || 0) / 1000;
  return inK * Number(env.NPC_PRICE_IN_PER_1K || 0.00015) + outK * Number(env.NPC_PRICE_OUT_PER_1K || 0.0006);
}
// Fire-and-forget metrics to a private collector; text is redacted to lengths only (public-safe).
function npcRedact(m) {
  if (!m || typeof m !== "object") return {};
  const o = {};
  for (const k in m) { const v = m[k];
    if (typeof v === "string") { if (k === "text" || k === "line" || k === "question") o[k + "_len"] = v.length; else o[k] = v.slice(0, 40); }
    else o[k] = v; }
  return o;
}
function npcMetric(env, name, meta) {
  try { const url = env.METRICS_URL; if (!url) return;
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ev: name, t: Date.now(), ...npcRedact(meta) }) }).catch(() => {});
  } catch { /* metrics never break a turn */ }
}
// Provider adapter. Hard ceiling: with the effective aiEnabled false this returns null WITHOUT calling any model.
async function npcModelCall(env, role, sys, userMsg, aiEnabled) {
  if (!aiEnabled) return null;
  if (!env.AAD_CLIENT_ID || !env.AAD_CLIENT_SECRET || !env.AAD_TENANT || !env.AOAI_ENDPOINT) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Number(env.NPC_TIMEOUT_MS || 12000));
  try {
    const token = await aadToken(env);
    const dep = npcDeployment(env, role);
    const ver = env.AOAI_API_VERSION || "2025-04-01-preview";
    const url = `${env.AOAI_ENDPOINT.replace(/\/$/, "")}/openai/deployments/${dep}/chat/completions?api-version=${ver}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ messages: [{ role: "system", content: sys }, { role: "user", content: String(userMsg).slice(0, role === "player" ? 1500 : 600) }], max_completion_tokens: 120 }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const txt = j.choices?.[0]?.message?.content;
    return txt && txt.trim() ? { text: txt.trim(), usage: j.usage || null } : null;
  } catch { clearTimeout(timer); return null; }
}
// --- Live flag resolver. NPC_LIVE_TOGGLE is the master kill-switch. When it is NOT "true",
//     behaviour is exactly the env-gated default (KV ignored) — the safe, deploy-only posture.
//     When "true", the shared NPC_FLAGS KV overrides per key in near real time (owner dashboard
//     writes it), with the matching env var as the per-key fallback. AI can never be enabled unless
//     this resolver returns aiEnabled=true, so the hard model-call ceiling is preserved. ---
async function npcResolveFlags(env) {
  const envAi = env.NPC_AI_ENABLED === "true";
  const envAmb = env.NPC_AMBIENT_ENABLED === "true";
  const envPc = env.NPC_PLAYER_CHAT_ENABLED === "true";
  const liveReady = env.NPC_LIVE_TOGGLE === "true" && env.NPC_FLAGS && typeof env.NPC_FLAGS.get === "function";
  if (!liveReady) {
    return { aiEnabled: envAi, ambientEnabled: envAi && envAmb, playerChatEnabled: envAi && envPc, source: "env", liveToggle: false };
  }
  let kAi = null, kAmb = null, kPc = null;
  try {
    [kAi, kAmb, kPc] = await Promise.all([
      env.NPC_FLAGS.get("ai_enabled"),
      env.NPC_FLAGS.get("ambient_enabled"),
      env.NPC_FLAGS.get("player_chat_enabled"),
    ]);
  } catch { /* KV read failure → fall back to env per key below */ }
  const pick = (kv, envVal) => (kv === "true" ? true : kv === "false" ? false : envVal);
  const ai = pick(kAi, envAi);
  return {
    aiEnabled: ai,
    ambientEnabled: ai && pick(kAmb, envAmb),
    playerChatEnabled: ai && pick(kPc, envPc),
    source: "kv", liveToggle: true,
  };
}
async function npcHandler(body, request, env) {
  const action = body.npc_action;
  const lang = String(body.lang || "ko").toLowerCase().startsWith("en") ? "en" : "ko";
  const flags = await npcResolveFlags(env);
  const aiEnabled = flags.aiEnabled;
  const ambientOn = flags.ambientEnabled;
  const playerOn = flags.playerChatEnabled;

  if (action === "npcConfig") {
    return json({ ok: true, config: {
      aiEnabled, ambientEnabled: ambientOn, playerChatEnabled: playerOn,
      maxTurns: Number(env.NPC_MAX_TURNS || 6), hardMaxTurns: Number(env.NPC_HARD_MAX_TURNS || 10),
      source: flags.source, liveToggle: flags.liveToggle,
    }, budget: npcBudgetState(env) }, 200, env);
  }
  if (action === "npcBudget") return json({ ok: true, budget: npcBudgetState(env) }, 200, env);

  if (action === "npcAmbientTurn" || action === "npcPlayerChat") {
    const role = action === "npcAmbientTurn" ? "ambient" : "player";
    const featureOn = role === "ambient" ? ambientOn : playerOn;
    const budget = npcBudgetState(env);
    // Env-off ceiling → never a model call; client falls back to its free scripted bank.
    if (!featureOn) { npcMetric(env, "npc_fallback_used", { where: role, reason: "disabled" }); return json({ ok: true, fallback: true, reason: "npc_ai_disabled", budget }, 200, env); }
    if (budget.blocked) { npcMetric(env, "npc_budget_blocked", { where: role }); return json({ ok: false, fallback: true, reason: "npc_budget_exhausted", budget }, 200, env); }
    const sys = role === "ambient" ? npcAmbientPrompt(body.speaker, body.listener, body.topic, lang) : npcPlayerPrompt(body.speaker, lang, { chime: !!body.chime, prev: body.prev });
    const userMsg = role === "ambient" ? npcAmbientUser(body, lang) : npcPlayerUser(body, lang);
    const out = await npcModelCall(env, role, sys, userMsg, aiEnabled);
    if (!out) { npcMetric(env, "npc_fallback_used", { where: role, reason: "model_unavailable" }); return json({ ok: true, fallback: true, reason: "model_unavailable", budget }, 200, env); }
    const cost = npcCostUsd(env, out.usage);
    npcChargeTurn(env, cost);
    const budget2 = npcBudgetState(env);
    npcMetric(env, role === "ambient" ? "npc_ambient_turn" : "npc_player_chat", { where: role, ai: true, line: out.text, spent: cost });
    return json({ ok: true, line: capLine(out.text, role === "ambient" ? 90 : 180), budget: budget2 }, 200, env);
  }
  return json({ error: "unknown npc_action" }, 400, env);
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method === "GET") {
      return new Response('Repolis taxi grounding — POST {"question":"…"}.', { status: 200, headers });
    }
    if (request.method !== "POST") return json({ error: "POST only" }, 405, env);

    let question, npc, history, repoName, lang, chat, body;
    try {
      body = await request.json();
      ({ question, npc, history, repoName, lang, chat } = body);
    } catch {
      return json({ error: "bad body" }, 400, env);
    }

    // Chronopolis Kronos Council — its own action (no `question` required; uses `topic`).
    if (body && body.action === "council") return councilHandler(body, request, env);
    // Free-topic LIVE debate streamed as SSE (popup closes, watch in 3D, KRONOS verdict).
    if (body && body.action === "councilLive") return councilStreamHandler(body, request, env);
    // 🧑‍🌾 Resident NPC social layer — townspeople config/budget/ambient/player-chat (no `question`).
    if (body && body.npc_action) return npcHandler(body, request, env);

    if (!question) return json({ error: "question required" }, 400, env);

    // Route to a scholar config (taxi by default). Every scholar shares the KB pipeline;
    // only the knowledge base / source differ. Multi-turn history is threaded in.
    const who = npc && scholarConfig(npc, env) ? npc : "taxi";
    const cfg = scholarConfig(who, env);
    const messages = buildMessages(history, question);

    // Explicit small-talk / general intent (the client decided this isn't a repo or doc
    // lookup) → answer straight from the model in the scholar's voice, no KB retrieval.
    if (chat) {
      const g = await chatLLM(who, history, question, lang, env);
      if (g) return json({
        repo: null, message: g, general: true,
        trace: { general: true, model: env.AOAI_DEPLOYMENT || "gpt-5.4-mini" },
      }, 200, env);
    }

    const out = await groundedRetrieve(cfg, messages, env);

    // KB unreachable / slow / unconfigured / empty. A scholar with its own public MCP falls
    // back to a direct keyless call (clone-friendly); the taxi tells the client to use Local.
    if (out.fallback || (!out.answer && !(out.data?.references || []).length)) {
      if (MCP_NPCS[who]) return mcpAsk(who, question, env, { repoName, lang });
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

    // Scholar (e.g. VEGA / MS Docs) → synthesized answer in the user's language + doc links.
    const docs = parseDocs(out.data.references);
    // Only fall back to general knowledge when the KB genuinely returned NO documents. If docs
    // exist we always surface them as references — even when the synthesized answer hedges —
    // so the user sees the sources they asked for instead of an unsourced "general" reply.
    if (!docs.length) {
      const g = await chatLLM(who, history, question, lang, env);
      if (g) return json({
        repo: null, message: g, general: true,
        trace: { general: true, model: env.AOAI_DEPLOYMENT || "gpt-5.4-mini" },
      }, 200, env);
    }
    return json({
      repo: null,
      message: out.answer,
      trace: { ks: cfg.ks, tools: out.tools, refs: docs.slice(0, 6), docs: true, mcpMs: out.mcpMs, totalMs: out.totalMs, partial: out.status === 206 },
    }, 200, env);
  },
};
