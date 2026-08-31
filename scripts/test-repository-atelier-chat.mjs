import {
  REPOSITORY_ATELIER_CHAT_LIMIT,
  appendRepositoryAtelierChatTurn,
  beginRepositoryAtelierChatCall,
  createRepositoryAtelierChatVisit,
  repositoryAtelierChatPayload,
  repositoryAtelierChatSnapshot,
  setRepositoryAtelierChatPanel,
} from '../assets/repository-atelier-chat.js';
import {
  authorizeRepositoryAtelierRequest,
  buildRepositoryAtelierMessages,
  projectRepositoryAtelierReferences,
  repositoryAtelierKnowledgeSource,
  repositoryAtelierMessage,
} from '../cloudflare-taxi/src/repository-atelier.js';

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
  const invalid = authorizeRepositoryAtelierRequest({
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
    && !invalid.ok
    && invalid.reason === 'repository_atelier_repo_invalid'
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
