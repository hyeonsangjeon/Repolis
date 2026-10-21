/* assets/zone-classifier.js — the deterministic repository → district rule.
 *
 * The town sorts every public repository into exactly one district from its name, description,
 * topics and language, and the planned city-card Worker imports this same file, so a shared card and
 * the town it links to agree. Nothing here reads the DOM, storage, network, the wall clock or a random
 * source: the caller passes the reference time that decides how long a repository has been quiet.
 * District names, icons and colors stay with ZONE_CAT in index.html.
 */

/* Every district id in catalog order; ZONE_CAT in index.html lists the same ids in the same order. */
export const ZONE_IDS = Object.freeze(['ai', 'infra', 'web', 'data', 'library', 'ruins', 'commons']);

/* A repository joins the ruins when it has a junk-style name or description, or when all four hold:
 * score at most maxScore, at most maxStars stars, quiet longer than minQuietDays, rank minRank or later.
 * A repository without a push date counts as quiet for unknownPushDays. */
export const ZONE_RUINS_RULE = Object.freeze({ maxScore: 1, maxStars: 1, minQuietDays: 420, minRank: 40, unknownPushDays: 3650 });

const freezeTable = table => {
  for (const row of Object.values(table)) {
    if (Array.isArray(row)) row.forEach(Object.freeze);
    Object.freeze(row);
  }
  return Object.freeze(table);
};

/* [keyword, weight]: the weight counts once when the keyword appears anywhere in the lowercased
 * "name description topics" text. It is a substring match, so 'agent' also scores inside 'agents'. */
export const ZONE_KEYWORDS = freezeTable({
  ai:       [['llm',3],['rag',3],['agent',3],['agents',3],['gpt',2],['openai',2],['azure-openai',3],['anthropic',2],
    ['claude',2],['bedrock',3],['sagemaker',3],['huggingface',2],['transformer',2],['transformers',2],['embedding',2],
    ['embeddings',2],['faiss',2],['langchain',3],['nlp',2],['stt',2],['asr',2],['speech',2],['whisper',2],
    ['diffusion',3],['controlnet',3],['lora',3],['peft',3],['finetuning',3],['fine-tuning',3],['distillation',2],
    ['bert',2],['kobert',2],['ml',1],['machine-learning',2],['generative-ai',3],['genai',3],['reasoning',2],
    ['hyperparameter',3],['deep-learning',3],['tensorflow',2],['tpu',2],['sentiment',2],['guardrails',2],['mcp',2],
    ['evaluation',1],['benchmark',1],['neural',2],['deblurring',2],['image-processing',1],['sentence-transformers',2],
    ['kullm',2],['polyglot',1],['ployglot',1],['pii',1],['stable-diffusion',3],['gdpval',2],['ptu',2],['llmops',3],
    ['mlops',2],['cer',1],['wer',1],['pronunciation',1]],
  infra:    [['nas',4],['docker',2],['docker-compose',2],['dockerindocker',3],['dind',3],['kubernetes',3],['k8s',3],
    ['rancher',3],['vagrant',3],['minikube',3],['jenkins',3],['cicd',2],['continuous-integration',2],
    ['continuous-delivery',2],['devops',2],['self-hosted',3],['selfhosted',3],['homelab',3],['gotty',3],
    ['web-terminal',2],['browser-terminal',2],['terminal',2],['galera',3],['cluster',2],['nginx',2],['alpine',2],
    ['ubuntu',2],['orchestration',2],['sysmon',3],['kafka',2],['mariadb',2],['nodeport',2],['rbac',1],['proxy',1],
    ['server',1],['worker',1],['container',2],['monitor',2]],
  web:      [['react',3],['vue',3],['svelte',3],['three',2],['three-js',3],['webgl',3],['frontend',3],['ui',2],
    ['dashboard',2],['browser',1],['website',2],['site',1],['css',2],['tailwind',2],['vite',2],['bootstrap',2],
    ['spa',2],['pwa',2],['d3',2],['data-visualization',2],['portfolio',2],['flask',2],['bottle',2],['socket-io',2],
    ['socket',1],['websocket',1],['static',1],['login-system',1],['3d',2],['ghibli',1]],
  data:     [['csv',3],['dataset',3],['iso3166',3],['spark',3],['pyspark',3],['emr',3],['zeppelin',3],['hadoop',3],
    ['dataplatform',3],['analytics',2],['etl',2],['pandas',2],['scrap',2],['crawl',2],['queue',2],['producer',1],
    ['consumer',1],['producer-consumer',2],['thread',1],['batch',1],['normalization',1]],
  library:  [['workshop',4],['immersion',4],['immersion-day',4],['tutorial',3],['awesome',3],['awosome',3],
    ['example',3],['examples',3],['cookbook',4],['coding-school',4],['hands-on',3],['lab',2],['prelab',4],
    ['materials',3],['sample',2],['samples',2],['docs',3],['doc',1],['guide',3],['book',2],['notes',2],['roadmap',2],
    ['wiki',2],['knowledge',2],['contribution',4],['contributions',4],['education',3],['learn',2],['learning',2],
    ['publications',3],['speaking',2]],
});

/* Extra weight from the repository's GitHub language. */
export const ZONE_LANGUAGE_AFFINITY = freezeTable({
  'Shell': { infra: 2 }, 'Dockerfile': { infra: 3 }, 'PowerShell': { infra: 2 }, 'HCL': { infra: 2 },
  'JavaScript': { web: 2 }, 'TypeScript': { web: 2 }, 'HTML': { web: 2 }, 'CSS': { web: 2 }, 'Vue': { web: 3 }, 'PHP': { web: 1 },
  'Jupyter Notebook': { ai: 2 }, 'Python': { ai: 1 }, 'Java': { web: 1 },
});

const DAY_MS = 86400000;
/* Equal top scores go to the district that comes first here. */
const TIE_ORDER = Object.freeze(['ai', 'infra', 'library', 'data', 'web']);
const JUNK = /\b(temp|tmp|test ?bed|xmas|christmas|competition|myipynb|scratch|playground|sandbox)\b/i;

/* The lowercased "name description topics" text that every keyword is matched against. */
export function zoneHaystack(repo) {
  const r = repo && typeof repo === 'object' ? repo : {};
  const topics = Array.isArray(r.topics) ? r.topics.join(' ') : '';
  return ((r.repo ?? '') + ' ' + (r.desc || '') + ' ' + topics).toLowerCase();
}

/* Keyword plus language score for each of the five topic districts. */
export function zoneScores(repo) {
  const haystack = zoneHaystack(repo);
  const scores = { ai: 0, infra: 0, web: 0, data: 0, library: 0 };
  for (const zone in ZONE_KEYWORDS) {
    for (const [keyword, weight] of ZONE_KEYWORDS[zone]) if (haystack.includes(keyword)) scores[zone] += weight;
  }
  const lang = repo && typeof repo === 'object' ? repo.lang : undefined;
  const affinity = Object.prototype.hasOwnProperty.call(ZONE_LANGUAGE_AFFINITY, lang) ? ZONE_LANGUAGE_AFFINITY[lang] : {};
  for (const zone in affinity) scores[zone] += affinity[zone];
  return Object.freeze(scores);
}

/* The district id for one repository. `referenceTimestamp` is the town's reference time in ms; a
 * non-finite reference never makes a pushed repository quiet. Anything that is not an object is commons. */
export function classifyRepoZone(repo, referenceTimestamp) {
  if (!repo || typeof repo !== 'object') return 'commons';
  const scores = zoneScores(repo);
  const best = Math.max(scores.ai, scores.infra, scores.web, scores.data, scores.library);
  const junk = JUNK.test((repo.repo ?? '') + ' ' + (repo.desc || ''));
  const quietDays = repo.pushed
    ? Math.max(0, (referenceTimestamp - new Date(repo.pushed).getTime()) / DAY_MS)
    : ZONE_RUINS_RULE.unknownPushDays;
  if (junk || (best <= ZONE_RUINS_RULE.maxScore && (repo.stars || 0) <= ZONE_RUINS_RULE.maxStars
    && quietDays > ZONE_RUINS_RULE.minQuietDays && (repo.rank || 0) >= ZONE_RUINS_RULE.minRank)) return 'ruins';
  let zone = 'commons', top = 0;
  for (const id of TIE_ORDER) if (scores[id] > top) { top = scores[id]; zone = id; }
  return zone;
}
