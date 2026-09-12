import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as atelierChat from '../assets/repository-atelier-chat.js';
import {
  authorizeRepositoryAtelierRequest,
  buildRepositoryAtelierMessages,
  projectRepositoryAtelierReferences,
  repositoryAtelierKnowledgeSource,
  repositoryAtelierMessage,
} from '../cloudflare-taxi/src/repository-atelier.js';

const {
  REPOSITORY_ATELIER_CHAT_LIMIT,
  REPOSITORY_ATELIER_CHAT_TIMEOUT_MS,
  appendRepositoryAtelierChatTurn,
  beginRepositoryAtelierChatCall,
  createRepositoryAtelierChatVisit,
  repositoryAtelierChatPayload,
  repositoryAtelierChatResponseFailure,
  repositoryAtelierChatSnapshot,
  setRepositoryAtelierChatPanel,
} = atelierChat;
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const requestStart = html.indexOf('function _showRepositoryAtelierLimit(');
const requestEnd = html.indexOf('function _startRepositoryAtelierChatVisit(', requestStart);
if (requestStart < 0 || requestEnd < requestStart) throw new Error('Atelier request boundary missing');
const requestSource = html.slice(requestStart, requestEnd);

function requestFixture({ headersAfter = 0, bodyAfter = 0, status = 200, response,
  networkFailure = false, malformed = false, backend = 'http://127.0.0.1/atelier-fixture', send = false } = {}) {
  let now = 0, nextId = 0, finished = false, requestSignal;
  const timers = new Map(), messages = [], requests = [], events = [], workCalls = [];
  const setTimer = (fn, ms) => {
    const id = ++nextId;
    timers.set(id, { fn, at: now + ms });
    return id;
  };
  const clearTimer = id => timers.delete(id);
  const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
  const wait = (ms, signal) => new Promise((resolve, reject) => {
    let id;
    const abort = () => {
      clearTimer(id);
      reject(new DOMException('Fixture aborted', 'AbortError'));
    };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    if (ms !== 'hang') id = setTimer(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
  });
  const visit = createRepositoryAtelierChatVisit('hyeonsangjeon/Repolis');
  const call = send ? null : beginRepositoryAtelierChatCall(visit);
  const context = {
    ...atelierChat, AbortController, LANG: 'en',
    REPOSITORY_ATELIER: { chat: visit }, busy: false,
    chatText: { value: '', disabled: false, focus() {} },
    repositoryAtelierGroundedUrl: () => backend, _syncRepositoryAtelierChatChrome: () => {},
    trackChatEvent: () => {}, qLenBucket: () => 'short',
    nowMs: () => now, setTimeout: setTimer, clearTimeout: clearTimer,
    aiRequestPayload: value => value, esc: value => String(value),
    tf: key => key, t: key => key,
    trackAiTurn: (...args) => events.push(args.at(-1)), traceRefCount: () => 0,
    errName: error => error.name,
    addMsg: (role, text, options = {}) => {
      const message = { role, text, noHist: !!options.noHist, removed: false };
      messages.push(message);
      if (!options.noHist) appendRepositoryAtelierChatTurn(visit, role === 'me' ? 'user' : 'assistant', text);
      return { remove() { message.removed = true; } };
    },
    showTyping: value => value,
    fetch: async (url, options) => {
      requests.push({ url, payload: JSON.parse(options.body) });
      requestSignal = options.signal;
      await wait(headersAfter, options.signal);
      if (networkFailure) throw new TypeError('Local fixture network failure');
      return {
        ok: status >= 200 && status < 300, status,
        json: async () => {
          await wait(bodyAfter, options.signal);
          if (malformed) throw new SyntaxError('RAW_DETAIL_MUST_NOT_REACH_UI');
          return response === undefined ? { repoName: visit.repoName, message: 'Scoped local fixture reply' } : response;
        },
      };
    },
  };
  runInNewContext(requestSource + '\nglobalThis.ask = _askRepositoryAtelier; globalThis.send = _sendRepositoryAtelierChat;', context);
  const work = (send ? context.send('Explain this repository.')
    : context.ask(visit, 'Explain this repository.', call, backend))
    .then(() => { finished = true; });
  workCalls.push(work);
  return {
    visit, messages, requests, timers, events,
    get finished() { return finished; },
    get aborted() { return requestSignal?.aborted === true; },
    get busy() { return context.busy; },
    submit(question = 'Explain this repository.') {
      const next = context.send(question);
      workCalls.push(next);
      return next;
    },
    async advance(ms) {
      const until = now + ms;
      await settle();
      for (;;) {
        const next = [...timers].sort((left, right) => left[1].at - right[1].at)[0];
        if (!next || next[1].at > until) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].fn();
        await settle();
      }
      now = until;
      await settle();
    },
    async close() {
      visit.cancelled = true;
      visit.controller?.abort();
      await Promise.all(workCalls);
    },
  };
}

function reference(fullName) {
  const repo = fullName.split('/')[1];
  return {
    toolName: 'get_repository',
    sourceData: {
      content: JSON.stringify({
        full_name: fullName,
        name: repo,
        html_url: `https://github.com/${fullName}`,
        description: `${repo} description`,
        stargazers_count: 7,
        language: 'Python',
      }),
    },
  };
}

function searchReference(fullNames) {
  return {
    toolName: 'search_repositories',
    activitySource: 1,
    sourceData: {
      content: JSON.stringify({
        total_count: fullNames.length,
        items: fullNames.map((fullName) => ({
          full_name: fullName,
          name: fullName.split('/')[1],
          html_url: `https://github.com/${fullName}`,
          description: `${fullName} description`,
          stargazers_count: 11,
        })),
      }),
    },
  };
}

function fileReference(activitySource, path = 'README.md') {
  return {
    toolName: 'get_file_contents',
    activitySource,
    sourceData: {
      content: JSON.stringify({ name: path, path, type: 'file' }),
    },
  };
}

function fileActivity(id, owner, repo) {
  return {
    type: 'mcpServer',
    id,
    mcpServerArguments: {
      toolName: 'get_file_contents',
      toolArguments: { owner, repo, path: '/', ref: 'main' },
    },
  };
}

export async function runRepositoryAtelierChatTests(check) {
  const workerConfig = readFileSync(new URL('../cloudflare-taxi/wrangler.toml', import.meta.url), 'utf8');
  const workerTimeout = Number(workerConfig.match(/^GROUNDED_TIMEOUT_MS\s*=\s*"(\d+)"/m)?.[1]);
  check(REPOSITORY_ATELIER_CHAT_TIMEOUT_MS === 30000 && workerTimeout === 25000,
    'the client allows the unchanged 25-second Worker fetch budget plus five seconds for transport and body completion');
  const slow = requestFixture({ headersAfter: 10000 });
  await slow.advance(10000);
  check(slow.finished && !slow.aborted
    && slow.messages.some(message => message.text === 'Scoped local fixture reply')
    && slow.requests.length === 1 && slow.visit.calls === 1 && slow.timers.size === 0,
  'the actual Atelier client accepts a 10-second scoped reply within the Worker fetch budget (virtual time)');
  await slow.close();

  const body = requestFixture({ bodyAfter: 'hang' });
  await body.advance(30001);
  check(body.finished && body.aborted && body.visit.controller === null && body.timers.size === 0
    && body.visit.lastFailure === 'timeout' && body.messages.at(-1).text === 'atelierChatTimeout',
    'the actual Atelier deadline also bounds a stalled JSON body after response headers (virtual time)');
  await body.close();

  const complete = requestFixture({ headersAfter: 25000, bodyAfter: 4000 });
  await complete.advance(29000);
  check(complete.finished && !complete.aborted && complete.visit.lastFailure === null
    && complete.messages.at(-1).text === 'Scoped local fixture reply' && complete.timers.size === 0,
  'a complete reply within the total deadline is not aborted when headers consume the Worker budget (virtual time)');
  await complete.close();

  const repoName = 'hyeonsangjeon/Repolis', answer = { repoName, message: 'Scoped reply' };
  const failures = [
    [200, answer, null], [206, { ...answer, notFound: true }, null],
    [200, null, 'invalid_response'], [200, [], 'invalid_response'],
    [200, { ...answer, message: {} }, 'invalid_response'], [200, { ...answer, message: ' ' }, 'invalid_response'],
    [200, { ...answer, repoName: 'another/repository' }, 'scope_mismatch'],
    [200, { message: 'Unscoped reply' }, 'scope_mismatch'],
    [429, null, 'rate_limited'], [401, null, 'access_denied'], [403, null, 'access_denied'],
    [500, null, 'http_error'], [504, null, 'timeout'],
    [200, { ...answer, fallback: true, reason: 'grounding not configured' }, 'unconfigured'],
    [200, { ...answer, fallback: true, reason: 'timeout 25000ms' }, 'timeout'],
    [200, { ...answer, fallback: true, reason: 'kb 429' }, 'rate_limited'],
    [200, { ...answer, fallback: true, reason: 'kb 403' }, 'access_denied'],
    [200, { ...answer, fallback: true, reason: 'kb 500' }, 'http_error'],
    [200, { ...answer, fallback: true, reason: 'RAW_DETAIL_MUST_NOT_REACH_UI' }, 'unavailable'],
  ];
  check(failures.every(([status, data, expected]) => repositoryAtelierChatResponseFailure(status, data, repoName) === expected)
    && repositoryAtelierChatResponseFailure(200, { repoName: '', message: 'Unscoped' }, '') === 'scope_mismatch',
  'response classification preserves exact scope and distinguishes HTTP, service, malformed and empty failures without raw details');

  const invalid = requestFixture({ malformed: true });
  await invalid.advance(0);
  check(invalid.finished && invalid.visit.lastFailure === 'invalid_response'
    && invalid.messages.at(-1).text === 'atelierChatInvalidResponse'
    && invalid.events.at(-1).err === 'SyntaxError' && invalid.timers.size === 0,
  'malformed JSON is an explicit invalid response rather than a success-shaped empty object');
  await invalid.close();

  const denied = requestFixture({ status: 403, malformed: true });
  await denied.advance(0);
  check(denied.finished && denied.visit.lastFailure === 'access_denied'
    && denied.messages.at(-1).text === 'atelierChatAccessDenied',
  'non-JSON HTTP errors retain the known access failure without displaying the response body');
  await denied.close();

  const stale = requestFixture({ headersAfter: 1000, networkFailure: true });
  stale.visit.sequence++;
  await stale.advance(1000);
  check(stale.finished && stale.messages.every(message => message.removed)
    && stale.visit.lastFailure === null && stale.events.length === 0 && stale.timers.size === 0,
  'a rejected stale call cannot append an error to a newer request sequence');
  await stale.close();

  const cancelled = requestFixture({ bodyAfter: 'hang', send: true });
  await cancelled.advance(0);
  await cancelled.close();
  check(cancelled.finished && cancelled.aborted && !cancelled.busy && cancelled.visit.controller === null
    && cancelled.visit.calls === 1 && cancelled.visit.lastFailure === null && cancelled.timers.size === 0
    && cancelled.messages.filter(message => message.role === 'bot').every(message => message.removed),
  'room-exit cancellation clears a pending body, busy state and timer without refunding the started call or appending an error');

  const off = requestFixture({ backend: '', send: true });
  await off.advance(0);
  check(off.finished && off.requests.length === 0 && off.visit.calls === 0 && !off.busy
    && off.messages.at(-1).text === 'atelierChatNoBackend',
  'a disabled Atelier service remains an explicit zero-request, zero-call state');
  await off.close();

  const counted = requestFixture({ networkFailure: true, send: true });
  const duplicate = counted.submit();
  await counted.advance(0);
  const duplicateStarted = await duplicate;
  for (let index = 1; index < 5; index++) {
    const next = counted.submit();
    await counted.advance(0);
    await next;
  }
  const sixth = await counted.submit();
  check(!duplicateStarted && !sixth && counted.visit.calls === 5 && counted.requests.length === 5 && !counted.busy
    && counted.visit.lastFailure === 'network_error' && counted.timers.size === 0
    && counted.visit.history.every(turn => turn.role === 'user')
    && counted.messages.filter(message => message.text === 'atelierChatLimit').length === 1,
  'failed started requests still exhaust five calls; concurrent and sixth submissions add no requests, retries or error history');
  await counted.close();

  const previous = createRepositoryAtelierChatVisit('hyeonsangjeon/YoutubeDlNas');
  appendRepositoryAtelierChatTurn(previous, 'user', 'How does YoutubeDlNas work?');
  appendRepositoryAtelierChatTurn(previous, 'assistant', 'YoutubeDlNas answer');

  const visit = createRepositoryAtelierChatVisit('hyeonsangjeon/Dataplatformfrm');
  setRepositoryAtelierChatPanel(visit, true);
  const auto = beginRepositoryAtelierChatCall(visit);
  appendRepositoryAtelierChatTurn(visit, 'user', 'Explain this repository.');
  const payload = repositoryAtelierChatPayload(visit, 'Explain this repository.', 'en');
  check(auto.call === 1
    && payload.surface === 'repository_atelier'
    && payload.repoName === 'hyeonsangjeon/Dataplatformfrm'
    && payload.history.length === 0
    && !JSON.stringify(payload).includes('YoutubeDlNas'),
  'Atelier auto explain pins hyeonsangjeon/Dataplatformfrm at 1/5 without mixing the previous YoutubeDlNas visit');

  setRepositoryAtelierChatPanel(visit, false);
  setRepositoryAtelierChatPanel(visit, true);
  const reopened = repositoryAtelierChatSnapshot(visit);
  for (let index = visit.calls; index < REPOSITORY_ATELIER_CHAT_LIMIT; index += 1) {
    beginRepositoryAtelierChatCall(visit);
  }
  const blocked = beginRepositoryAtelierChatCall(visit);
  const reentered = createRepositoryAtelierChatVisit('hyeonsangjeon/Dataplatformfrm');
  check(reopened.calls === 1
    && reopened.historyTurns === 1
    && blocked === null
    && visit.calls === 5
    && reentered.calls === 0
    && reentered.history.length === 0,
  'panel reopen preserves Atelier context, five started calls exhaust the visit, and room re-entry creates a fresh visit');

  const authorized = authorizeRepositoryAtelierRequest({
    ...payload,
    instanceOrigin: 'owner-dev',
    cityUser: 'hyeonsangjeon',
    cityMode: 'owner',
  });
  const invalidScope = authorizeRepositoryAtelierRequest({
    surface: 'repository_atelier',
    repoName: 'private-or-deleted',
    question: 'Explain this repository.',
  });
  const forgedIdentity = authorizeRepositoryAtelierRequest({
    ...payload,
    cityUser: ['private-owner'],
  });
  const messages = buildRepositoryAtelierMessages(
    [{ role: 'user', text: 'Tell me about another repository.' }],
    'What does this one do?',
    authorized.repoName,
  );
  const messageText = messages.flatMap(message => message.content).map(item => item.text).join('\n');
  check(authorized.ok
    && authorized.repoName === 'hyeonsangjeon/Dataplatformfrm'
    && !invalidScope.ok
    && invalidScope.reason === 'repository_atelier_repo_invalid'
    && !forgedIdentity.ok
    && forgedIdentity.reason === 'repository_atelier_payload_invalid'
    && messages.at(-1).content[0].text.includes('hyeonsangjeon/Dataplatformfrm')
    && messageText.includes('Do not search, compare, recommend, or answer from another repository'),
  'the Worker boundary accepts only a valid scoped owner/repo and repeats the no-cross-repo instruction on every question');

  const exact = projectRepositoryAtelierReferences(
    [reference('hyeonsangjeon/Dataplatformfrm')],
    'hyeonsangjeon/Dataplatformfrm',
  );
  const mixed = projectRepositoryAtelierReferences(
    [reference('hyeonsangjeon/Dataplatformfrm'), reference('hyeonsangjeon/YoutubeDlNas')],
    'hyeonsangjeon/Dataplatformfrm',
  );
  const missing = projectRepositoryAtelierReferences([], 'hyeonsangjeon/Dataplatformfrm');
  const foundryExact = projectRepositoryAtelierReferences(
    [
      searchReference(['hyeonsangjeon/Dataplatformfrm']),
      fileReference(3),
    ],
    'hyeonsangjeon/Dataplatformfrm',
    [fileActivity(3, 'hyeonsangjeon', 'Dataplatformfrm')],
  );
  const forgedFileScope = projectRepositoryAtelierReferences(
    [
      searchReference(['hyeonsangjeon/Dataplatformfrm']),
      fileReference(4),
    ],
    'hyeonsangjeon/Dataplatformfrm',
    [fileActivity(4, 'hyeonsangjeon', 'YoutubeDlNas')],
  );
  const mixedSearch = projectRepositoryAtelierReferences(
    [searchReference(['hyeonsangjeon/Dataplatformfrm', 'hyeonsangjeon/YoutubeDlNas'])],
    'hyeonsangjeon/Dataplatformfrm',
  );
  check(exact.exact
    && exact.refs[0].name === 'hyeonsangjeon/Dataplatformfrm'
    && !mixed.exact
    && mixed.rejected === 1
    && !missing.exact
    && foundryExact.exact
    && foundryExact.refs.length === 1
    && foundryExact.rejected === 0
    && !forgedFileScope.exact
    && forgedFileScope.rejected === 1
    && !mixedSearch.exact
    && mixedSearch.rejected === 1
    && repositoryAtelierKnowledgeSource('github-repos-mcp-ks,other-ks') === 'github-repos-mcp-ks',
  'Atelier grounding accepts exact Foundry MCP references, rejects cross-repo activity, and selects only the GitHub source');

  check(repositoryAtelierMessage('not_found', 'hyeonsangjeon/Dataplatformfrm', 'ko').includes('현재 공개 정보를 찾지 못')
    && repositoryAtelierMessage('not_found', 'hyeonsangjeon/Dataplatformfrm', 'en').includes("couldn't find current public information")
    && repositoryAtelierMessage('unavailable', 'hyeonsangjeon/Dataplatformfrm', 'ko').includes('다른 레포로 대신 답하지')
    && repositoryAtelierMessage('unavailable', 'hyeonsangjeon/Dataplatformfrm', 'en').includes('not substitute another repository'),
  'invalid, private, deleted, empty, and failed repository lookups use factual bilingual no-substitution copy');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let failed = 0;
  await runRepositoryAtelierChatTests((condition, name) => {
    if (condition) console.log(`  ok - ${name}`);
    else {
      failed += 1;
      console.error(`  not ok - ${name}`);
    }
  });
  if (failed) process.exit(1);
  console.log('Repository Atelier chat tests passed');
}
