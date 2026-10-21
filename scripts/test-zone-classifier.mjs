/* scripts/test-zone-classifier.mjs — golden district assignments for assets/zone-classifier.js (hermetic).
 *
 * scripts/fixtures/zone-classifier-golden.json holds the classifier fields of all 71 repos.json entries and
 * the district the inline zoneOf in index.html gave each of them before the rule moved into the shared
 * module. Both the module and the adapter that index.html ships must reproduce every assignment, and the
 * edge fixtures below were checked against that inline version too. Zero network, clock or randomness.
 *
 *   node scripts/test-zone-classifier.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  ZONE_IDS, ZONE_KEYWORDS, ZONE_LANGUAGE_AFFINITY, ZONE_RUINS_RULE, classifyRepoZone, zoneHaystack, zoneScores,
} from '../assets/zone-classifier.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/zone-classifier-golden.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const reference = Date.parse(golden.source.reference);
let count = 0;
const check = (condition, message) => { assert(condition, message); count++; };
const same = (actual, expected, message) => { assert.equal(actual, expected, message); count++; };

const rules = JSON.stringify({ ids: ZONE_IDS, keywords: ZONE_KEYWORDS, languages: ZONE_LANGUAGE_AFFINITY, ruins: ZONE_RUINS_RULE });
same(createHash('sha256').update(rules).digest('hex'), golden.rulesSha256,
  'zone rules changed: re-baseline scripts/fixtures/zone-classifier-golden.json on purpose and bump the zone-classifier ?v= tag in index.html');

// The adapter index.html ships, run with the module it imports.
const block = (html.match(/\/\*ZONECLASSIFIER:START\*\/([\s\S]*?)\/\*ZONECLASSIFIER:END\*\//) || [, ''])[1];
const shipped = new Function('_now', 'ZONE_KEYWORDS', 'ZONE_LANGUAGE_AFFINITY', 'classifyRepoZone',
  `${block}\nreturn { ZONE_CAT, ZKW, ZLANG, zoneOf };`)(reference, ZONE_KEYWORDS, ZONE_LANGUAGE_AFFINITY, classifyRepoZone);
check(shipped.ZKW === ZONE_KEYWORDS && shipped.ZLANG === ZONE_LANGUAGE_AFFINITY,
  'zoneWhy and zoneBasis read the shared tables under their original names');
check(shipped.ZONE_CAT.map(zone => zone.id).join() === ZONE_IDS.join(), 'ZONE_CAT keeps the shared district ids in catalog order');

same(golden.repos.length, 71, 'the golden fixture covers all 71 repositories');
const counts = Object.fromEntries(ZONE_IDS.map(id => [id, 0]));
for (const { zone, ...repo } of golden.repos) {
  same(classifyRepoZone(repo, reference), zone, `${repo.repo}: module district`);
  same(shipped.zoneOf(repo), zone, `${repo.repo}: index.html district`);
  counts[zone]++;
}
assert.deepEqual(counts, golden.counts, 'golden district counts');
same(golden.repos.find(repo => repo.repo === 'Hyeonsang-AI-Contributions').zone, 'library',
  'the repository behind the Contribution Library stands in the library district');

// [name, repo, district the inline classifier gave]
const EDGE_CASES = [
  ['empty strings', { repo: '', desc: '', topics: [], lang: '', stars: 0, pushed: '', rank: 0 }, 'commons'],
  ['empty object', {}, 'commons'],
  ['null fields', { repo: 'x', desc: null, topics: null, lang: null, stars: null, pushed: null, rank: null }, 'commons'],
  ['no push date at rank 40 counts as long quiet', { repo: '', rank: 40 }, 'ruins'],
  ['no topics: the description decides', { repo: 'tool', desc: 'A Kubernetes operator', topics: [] }, 'infra'],
  ['no topics: the language decides', { repo: 'misc', lang: 'Dockerfile' }, 'infra'],
  ['one language point is enough', { repo: 'misc', lang: 'Python' }, 'ai'],
  ['a long description is read to the end', { repo: 'misc', desc: 'filler '.repeat(4000) + 'kafka' }, 'infra'],
  ['a junk word at the end of a long description', { repo: 'misc', desc: 'filler '.repeat(4000) + 'sandbox' }, 'ruins'],
  ['keywords match in any case', { repo: 'LLM-RAG-Agent', desc: 'GPT', topics: ['LangChain'] }, 'ai'],
  ['language names are case-sensitive', { repo: 'misc', lang: 'python' }, 'commons'],
  ['junk words match in any case', { repo: 'Python-XMAS-tree' }, 'ruins'],
  ['junk words need word boundaries', { repo: 'attempts' }, 'commons'],
  ['infra wins a tie with library', { repo: 'nas-workshop' }, 'infra'],
  ['library wins a tie with data', { repo: 'csv-tutorial' }, 'library'],
  ['420 quiet days stay in the district', { repo: 'misc', lang: 'Python', stars: 1, rank: 40, pushed: '2025-08-26' }, 'ai'],
  ['421 quiet days join the ruins', { repo: 'misc', lang: 'Python', stars: 1, rank: 40, pushed: '2025-08-25' }, 'ruins'],
  ['two stars keep a quiet house', { repo: 'misc', lang: 'Python', stars: 2, rank: 40, pushed: '2019-01-01' }, 'ai'],
  ['rank 39 keeps a quiet house', { repo: 'misc', lang: 'Python', stars: 0, rank: 39, pushed: '2019-01-01' }, 'ai'],
  ['the Contribution Library landmark object', { _isLibrary: true, label: 'Contribution Library' }, 'commons'],
  ['a landmark entry named library', { landmark: true, repo: 'library' }, 'commons'],
];
for (const [name, repo, zone] of EDGE_CASES) {
  same(classifyRepoZone(Object.freeze(repo), reference), zone, `${name}: module district`);
  same(shipped.zoneOf(repo), zone, `${name}: index.html district`);
}

// Inputs the inline classifier could not take (it threw); the module answers instead.
for (const value of [null, undefined, 'llm', 42]) same(classifyRepoZone(value, reference), 'commons', `${String(value)} is commons`);
same(classifyRepoZone({ repo: 'x', topics: 'llm' }, reference), 'commons', 'a non-array topics value is ignored');
same(classifyRepoZone({ repo: 'misc', lang: 'Python', rank: 50, pushed: '2019-01-01' }, NaN), 'ai',
  'a non-finite reference never makes a pushed repository quiet');
same(classifyRepoZone({ repo: 'misc', lang: 'Python', rank: 50 }, NaN), 'ruins', 'a missing push date still counts as quiet');

same(zoneHaystack({ repo: 'Repolis', desc: 'A Town', topics: ['Three-JS', 'webgl'] }), 'repolis a town three-js webgl',
  'the haystack is the lowercased name, description and topics');
const scores = zoneScores({ repo: 'llm-docker', lang: 'Python' });
check(scores.ai === 4 && scores.infra === 2 && scores.web === 0 && Object.isFrozen(scores), 'scores add keyword weights and language affinity');
check([ZONE_IDS, ZONE_RUINS_RULE, ZONE_KEYWORDS, ZONE_KEYWORDS.ai, ZONE_KEYWORDS.ai[0], ZONE_LANGUAGE_AFFINITY, ZONE_LANGUAGE_AFFINITY.Python]
  .every(Object.isFrozen), 'the shared rule tables are deeply frozen');

console.log(`ALL GREEN - ${count} zone classifier checks: 71 golden assignments, ${EDGE_CASES.length} edge fixtures, shipped adapter`);
