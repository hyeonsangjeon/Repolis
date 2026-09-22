import {
  buildRepositoryAtelierAnswerMessages,
  buildRepositoryAtelierMessages,
  projectRepositoryAtelierDocument,
  projectRepositoryAtelierPublicMetadata,
  projectRepositoryAtelierReferences,
  repositoryAtelierDocumentKind,
  repositoryAtelierDocumentUrl,
  repositoryAtelierMetadataUrl,
} from './repository-atelier.js';

const JSON_BYTES = 65536;
const MODEL_JSON_BYTES = 131072;
const MODEL_STREAM_BYTES = 524288;
const DEADLINE_MS = 25000;

class EvidenceError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

export function repositoryAtelierGitHubRequest(env, signal) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Repolis-Repository-Atelier',
  };
  const token = env.ATELIER_GITHUB_TOKEN;
  if (token !== undefined) {
    if (typeof token !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(token)) {
      throw new EvidenceError('repository_auth_invalid');
    }
    headers.Authorization = 'Bearer ' + token;
  }
  return { method: 'GET', redirect: 'manual', signal, headers };
}

function completionFromEvents(text) {
  let content = '', finishReason = null, usage = null, done = false;
  const events = text.replace(/\r\n?/g, '\n').split('\n\n');
  if (events.at(-1) === '') events.pop();
  if (events.length > 2048) throw new EvidenceError('repository_answer_oversized');
  for (const event of events) {
    const data = event.split('\n').filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data) continue;
    if (done) throw new EvidenceError('repository_answer_invalid_stream');
    if (data === '[DONE]') { done = true; continue; }
    let chunk;
    try { chunk = JSON.parse(data); } catch (error) {
      if (error instanceof SyntaxError) throw new EvidenceError('repository_answer_invalid_stream');
      throw error;
    }
    if (!chunk || typeof chunk !== 'object' || chunk.error || !Array.isArray(chunk.choices)) {
      throw new EvidenceError('repository_answer_invalid_stream');
    }
    if (chunk.usage) usage = chunk.usage;
    if (chunk.choices.length === 0) continue;
    if (chunk.choices.length !== 1 || chunk.choices[0]?.index !== 0) throw new EvidenceError('repository_answer_invalid_stream');
    const choice = chunk.choices[0], delta = choice.delta ?? {};
    if (typeof delta !== 'object' || Array.isArray(delta)
      || delta.tool_calls || delta.function_call || delta.refusal) throw new EvidenceError('repository_answer_invalid_stream');
    if (delta.content != null) {
      if (typeof delta.content !== 'string' || finishReason !== null) throw new EvidenceError('repository_answer_invalid_stream');
      content += delta.content;
    }
    if (choice.finish_reason != null) {
      if (typeof choice.finish_reason !== 'string' || finishReason !== null) throw new EvidenceError('repository_answer_invalid_stream');
      finishReason = choice.finish_reason;
    }
  }
  if (!done || finishReason === null || !usage
    || ![usage.prompt_tokens, usage.completion_tokens].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new EvidenceError('repository_answer_incomplete_stream');
  }
  if (new TextEncoder().encode(content).byteLength > MODEL_JSON_BYTES) throw new EvidenceError('repository_answer_oversized');
  return { choices: [{ finish_reason: finishReason, message: { content } }], usage };
}

async function boundedJson(fetcher, url, options, limit, source) {
  let response;
  try { response = await fetcher(url, options); } catch (error) {
    if (error instanceof TypeError) throw new EvidenceError(`${source}_network`);
    throw error;
  }
  if (!response.ok || response.redirected) {
    await response.body?.cancel();
    if (source === 'repository_metadata' && response.status === 404) {
      throw new EvidenceError('repository_metadata_unavailable');
    }
    throw new EvidenceError(`${source}_http_${response.status}`);
  }
  const streaming = source === 'repository_answer'
    && /^text\/event-stream(?:;|$)/i.test(response.headers.get('content-type') || '');
  if (streaming) limit = MODEL_STREAM_BYTES;
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw new EvidenceError(`${source}_oversized`);
  }
  if (!response.body) throw new EvidenceError(`${source}_empty`);
  const reader = response.body.getReader(), chunks = [];
  let size = 0, streamTail = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new EvidenceError(`${source}_oversized`);
      }
      chunks.push(value);
      if (streaming) {
        streamTail = (streamTail + new TextDecoder().decode(value)).slice(-64);
        if (/(?:^|\n)data: ?\[DONE\]\r?\n\r?\n/.test(streamTail)) {
          await reader.cancel();
          break;
        }
      }
    }
  } catch (error) {
    if (error instanceof TypeError) throw new EvidenceError(`${source}_network`);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (streaming) return { ...completionFromEvents(text), transport: 'sse' };
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EvidenceError(`${source}_invalid_json`);
    if (source === 'repository_answer') value.transport = 'json';
    return value;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) throw new EvidenceError(`${source}_invalid_json`);
    throw error;
  }
}

export async function retrieveRepositoryAtelier(authorized, cfg, env, { retrieve, getToken, normalizeUsage, fetcher = fetch }) {
  const started = Date.now();
  const timeoutMs = Math.max(1, Math.min(DEADLINE_MS, Number(env.GROUNDED_TIMEOUT_MS) || DEADLINE_MS));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let out = {
    attempted: false, direct: false, modelActivities: [], phase: 'configuration',
    scoped: { refs: [], rejected: 0, exact: false }, tools: [], mcpMs: 0,
  };
  try {
    if (!env.AAD_CLIENT_ID || !env.AAD_CLIENT_SECRET || !env.AAD_TENANT || !env.AOAI_ENDPOINT) {
      throw new EvidenceError('repository_answer_not_configured');
    }
    const publicRequest = repositoryAtelierGitHubRequest(env, controller.signal);
    const authenticated = !!publicRequest.headers.Authorization;
    out.direct = authenticated;
    // Authenticated exact metadata proves identity without a planner or an
    // intermediate answer. Unconfigured installations retain their MCP path.
    if (!authenticated) {
      out.phase = 'mcp_retrieval';
      const messages = buildRepositoryAtelierMessages([],
        `Explain the purpose of the public repository ${authorized.repoName} and include its exact repository metadata reference.`,
        authorized.repoName);
      const retrieval = await retrieve({ ...cfg, signal: controller.signal }, messages, env);
      out = { ...out, ...retrieval, retrieval };
      if (out.fallback) return out;
      out.scoped = projectRepositoryAtelierReferences(out.data?.references, authorized.repoName, out.data?.activity);
      out.answer = '';
      if (out.scoped.rejected) return out;
    }
    out.identitySource = 'github_mcp';
    if (authenticated || !out.scoped.exact) {
      out.phase = 'public_metadata';
      const metadataUrl = repositoryAtelierMetadataUrl(authorized.repoName);
      if (!metadataUrl) throw new EvidenceError('repository_metadata_scope_invalid');
      const metadata = await boundedJson(fetcher, metadataUrl, publicRequest, JSON_BYTES, 'repository_metadata');
      const publicScope = projectRepositoryAtelierPublicMetadata(metadata, authorized.repoName);
      if (!publicScope) throw new EvidenceError('repository_metadata_unavailable');
      out.scoped = publicScope;
      out.identitySource = 'github_public_rest';
    }

    const kind = repositoryAtelierDocumentKind(authorized.question);
    const url = repositoryAtelierDocumentUrl(authorized.repoName, kind);
    if (!url) throw new EvidenceError('repository_document_scope_invalid');
    out.phase = 'public_document';
    const file = await boundedJson(fetcher, url, publicRequest, JSON_BYTES, 'repository_document');
    const document = projectRepositoryAtelierDocument(file, authorized.repoName, kind);
    if (!document) throw new EvidenceError('repository_document_invalid');
    out.document = {
      kind, path: document.path, sha: document.sha, bytes: document.bytes,
      source: 'github_public_rest', authentication: authenticated ? 'authenticated' : 'anonymous',
    };

    const modelStarted = Date.now();
    out.phase = 'model_authentication';
    let token;
    try { token = await getToken(env, controller.signal); } catch (error) {
      if (error instanceof TypeError || /^aad token \d{3}$/.test(error.message)) throw new EvidenceError('repository_answer_auth');
      throw error;
    }
    if (typeof token !== 'string' || !token) throw new EvidenceError('repository_answer_auth');
    controller.signal.throwIfAborted();
    const model = env.AOAI_DEPLOYMENT || 'gpt-5.4-mini';
    const endpoint = `${env.AOAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${model}/chat/completions?api-version=${env.AOAI_API_VERSION || '2025-04-01-preview'}`;
    out.phase = 'answer_synthesis';
    const completion = await boundedJson(fetcher, endpoint, {
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        messages: buildRepositoryAtelierAnswerMessages(authorized, out.scoped.refs, document),
        max_completion_tokens: 400, stream: true, stream_options: { include_usage: true },
      }),
    }, MODEL_JSON_BYTES, 'repository_answer');
    out.modelActivities = [...(out.modelActivities || []), {
      phase: 'answer_synthesis', model, ms: Date.now() - modelStarted,
      refs: out.scoped.refs.length + 1, usage: normalizeUsage(completion.usage),
    }];
    out.modelTransport = completion.transport;
    if (!Array.isArray(completion.choices) || completion.choices.length !== 1
      || completion.choices[0]?.finish_reason !== 'stop' || typeof completion.choices[0]?.message?.content !== 'string') {
      throw new EvidenceError('repository_answer_incomplete');
    }
    out.answer = completion.choices[0].message.content.trim();
    out.refs = [...out.scoped.refs, document.reference];
    out.phase = 'complete';
    out.ok = true;
    return out;
  } catch (error) {
    if (error.name === 'AbortError') {
      Object.assign(out, { fallback: true, answer: '', reason: `timeout ${timeoutMs}ms` });
    } else if (error instanceof EvidenceError) {
      Object.assign(out, { fallback: true, answer: '', reason: error.reason });
    } else {
      throw error;
    }
    return out;
  } finally {
    clearTimeout(timer);
    out.totalMs = Date.now() - started;
  }
}
