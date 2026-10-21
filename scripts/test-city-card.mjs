/* scripts/test-city-card.mjs — hermetic fixtures for assets/city-card.js.
 *
 * Covers empty, one-house, capped and archive-only towns, hostile names (Hangul, emoji, control, bidi and
 * lone-surrogate characters), XML escaping, byte caps, text fit, and byte-identical SVG for the same input.
 * Zero network, clock or randomness.
 *
 *   node scripts/test-city-card.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  CITY_CARD_LIMITS, CITY_CARD_SIZES, CITY_CARD_ZONE_COLORS, cityCardRepoSlug, cityCardSvg, cityCardTextRuns, cityCardTextWidth,
  summarizeCityCard,
} from '../assets/city-card.js';
import { ZONE_IDS, classifyRepoZone } from '../assets/zone-classifier.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/zone-classifier-golden.json', import.meta.url), 'utf8'));
const reference = Date.parse(golden.source.reference);
const sha = text => createHash('sha256').update(text).digest('hex');
const bytes = text => Buffer.byteLength(text, 'utf8');
const ch = (...codes) => String.fromCodePoint(...codes);
const NUL = ch(0), BEL = ch(7), DEL = ch(0x7f), NEL = ch(0x85), RLO = ch(0x202e), LRI = ch(0x2066), ZWSP = ch(0x200b);
const BOM = ch(0xfeff), LONE = ch(0xd800);
let count = 0;
const check = (condition, message) => { assert(condition, message); count++; };

/* Small XML 1.0 well-formedness check for the markup this module writes: legal characters, double-quoted
 * attributes, known entities only, balanced tags, one root. Returns '' when well-formed. */
function xmlProblem(svg) {
  for (const char of svg) {
    const code = char.codePointAt(0);
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff) {
      return `illegal character ${code.toString(16)}`;
    }
  }
  const entity = /&(?!(?:amp|lt|gt|quot|#39);)/;
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9:-]*)((?:\s+[A-Za-z][A-Za-z0-9:-]*="[^"<]*")*)\s*(\/?)>/y;
  const stack = [];
  let at = 0, roots = 0;
  while (at < svg.length) {
    const open = svg.indexOf('<', at);
    const text = svg.slice(at, open < 0 ? svg.length : open);
    if (entity.test(text)) return 'raw & in text';
    if (!stack.length && text.trim()) return 'text outside the root';
    if (open < 0) break;
    tag.lastIndex = open;
    const match = tag.exec(svg);
    if (!match) return `malformed tag at ${open}`;
    if (entity.test(match[3])) return 'raw & in an attribute';
    if (match[1]) { if (stack.pop() !== match[2]) return `unbalanced </${match[2]}>`; }
    else { if (!stack.length) roots++; if (!match[4]) stack.push(match[2]); }
    at = tag.lastIndex;
  }
  return stack.length ? `unclosed <${stack.pop()}>` : roots === 1 ? '' : `${roots} roots`;
}

const unescape = text => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const textNodes = svg => [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(match => unescape(match[1]));
const unsafe = text => [...text].some(char => {
  const code = char.codePointAt(0);
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || (code >= 0xd800 && code <= 0xdfff)
    || [0x061c, 0x200b, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff].includes(code);
});

/* Every card is well-formed, draws exactly its text runs, and every run fits its slot. */
function drawn(summary, name, options) {
  const svg = cityCardSvg(summary, name, options);
  const runs = cityCardTextRuns(summary, name, options);
  const problem = xmlProblem(svg);
  check(problem === '', `well-formed SVG (${problem})`);
  check(JSON.stringify(textNodes(svg)) === JSON.stringify(runs.map(run => run.text)), 'the SVG draws exactly the placed text runs');
  check(runs.every(run => cityCardTextWidth(run.text, run.size, run.weight) <= run.maxWidth + 1e-6 && !unsafe(run.text)),
    'every run fits its width and carries no control, bidi or invisible format character');
  return svg;
}

// Zero repositories.
const empty = summarizeCityCard([]);
check(empty.repos === 0 && empty.stars === 0 && empty.archived === 0 && empty.language === null && empty.firstYear === null
  && !empty.truncated && !empty.zones.length && !empty.top.length && !empty.skyline.length, 'an empty catalog gives an empty summary');
for (const value of [undefined, null, 'repos', 42, {}]) check(JSON.stringify(summarizeCityCard(value)) === JSON.stringify(empty), `${String(value)} is an empty catalog`);
const emptySvg = drawn(empty, 'newbie의 마을', { lang: 'ko' });
check(emptySvg.includes('>아직 공개 레포가 없어요<') && !emptySvg.includes('<path') && !emptySvg.includes('<circle') && !emptySvg.includes('clip-path='),
  'an empty town says so and draws no skyline, district bar or houses');
check(textNodes(drawn(empty, '', {}))[1] === 'A GitHub town' && textNodes(drawn(empty, 42, { lang: 'ko' }))[1] === '깃허브 마을',
  'a missing or non-string city name falls back to a generic one');

// One repository.
const one = summarizeCityCard([{ repo: 'hello-world', lang: 'JavaScript', stars: 3, created: '2024-05-01T00:00:00Z', pushed: '2026-10-01', topics: ['react'] }],
  { referenceTimestamp: reference });
check(one.repos === 1 && one.stars === 3 && one.language === 'JavaScript' && one.firstYear === 2024 && one.zones.length === 1
  && one.zones[0].id === 'web' && one.zones[0].percent === 100 && one.top.length === 1 && one.top[0].name === 'hello-world'
  && one.skyline.length === 1, 'one repository is one house, one district at 100% and the first year');
check(textNodes(drawn(one, 'JavaScript Boulevard of octo'))[2] === '1 repo · ★ 3 · JavaScript · since 2024', 'one repository reads as singular');
check(textNodes(drawn(one, 'octo의 자바스크립트 거리', { lang: 'ko', size: 'readme' }))[2] === '레포 1개 · ★ 3 · JavaScript · 2024년부터',
  'the Korean stats line');

// The real 71-repository town (classifier fields from the zone golden fixture).
const town = summarizeCityCard(golden.repos, { referenceTimestamp: reference });
check(town.repos === 71 && town.stars === golden.repos.reduce((sum, repo) => sum + repo.stars, 0) && town.language === 'Python' && town.firstYear === null,
  'the owner town counts every repository and star; the fixture carries no creation dates');
check(town.zones.every(zone => zone.count === golden.counts[zone.id]) && town.zones.reduce((sum, zone) => sum + zone.percent, 0) === 100
  && town.zones.map(zone => zone.id).join() === ZONE_IDS.filter(id => golden.counts[id]).join(),
  'district shares use the shared rule, follow catalog order and add up to 100');
check(town.top.map(house => `${house.name}:${house.stars}:${house.zone}`).join() === 'youtube-dl-nas:201:infra,computing-Korean-STT-error-rates:73:ai,Repolis:47:web',
  'the three most-starred houses with their districts');
check(town.skyline.length === 71 && town.skyline.every((house, index, all) => !index
  || ZONE_IDS.indexOf(all[index - 1].zone) < ZONE_IDS.indexOf(house.zone)
  || (all[index - 1].zone === house.zone && all[index - 1].stars >= house.stars)), 'the skyline groups houses by district, most stars first');
const zonesByRule = summarizeCityCard(golden.repos, { referenceTimestamp: Date.parse('2030-01-01T00:00:00Z') });
check(zonesByRule.zones.find(zone => zone.id === 'ruins').count === golden.repos.filter(repo => classifyRepoZone(repo, Date.parse('2030-01-01T00:00:00Z')) === 'ruins').length,
  'the card classifies with the reference time it is given');

// The 100-repository cap.
const many = Array.from({ length: 150 }, (_, index) => ({ repo: `repo-${index}`, stars: index, lang: 'Go', created: `${2010 + (index % 10)}-01-01` }));
const capped = summarizeCityCard(many, { referenceTimestamp: reference });
check(capped.repos === CITY_CARD_LIMITS.maxRepos && capped.truncated && capped.skyline.length === 100 && capped.stars === 4950
  && capped.top[0].name === 'repo-99' && capped.firstYear === 2010, 'only the first 100 repositories in caller order count; more marks the card truncated');
check(!summarizeCityCard(many.slice(0, 100)).truncated && summarizeCityCard(many.slice(0, 100), { partial: true }).truncated,
  'exactly 100 is complete unless the caller says the list is partial');
const cappedSvg = drawn(capped, 'Go Town of octo');
check(textNodes(cappedSvg)[2] === '100+ repos · ★ 4,950+ · Go · since 2010' && bytes(cappedSvg) < 24000, 'a capped card says 100+ and stays small');
check(textNodes(drawn(capped, 'octo의 Go 마을', { lang: 'ko' }))[2] === '레포 100개 이상 · ★ 4,950+ · Go · 2010년부터', 'a capped Korean card');

// Only public, named, unique, non-landmark entries are read; e-mail and avatar fields never are.
const mixed = summarizeCityCard([
  { repo: 'Alpha', stars: 1 }, { repo: 'alpha', stars: 99 }, { repo: 'secret', private: true, stars: 500 }, { repo: 'library', landmark: true },
  { _isLibrary: true, label: 'Contribution Library' }, { repo: 'chrono', _landmark: 'chrono' }, { repo: '', stars: 5 }, { repo: '   ', stars: 5 },
  { repo: 42 }, null, 'beta',
]);
check(mixed.repos === 1 && mixed.stars === 1 && mixed.top[0].name === 'Alpha' && !JSON.stringify(mixed).includes('secret'),
  'duplicates (any case), private repositories, landmarks and nameless entries are skipped');
const personal = [{ repo: 'tool', stars: 2, email: 'octo@example.com', avatar_url: 'https://avatars.example.com/u/1',
  owner: { login: 'octo', email: 'octo@example.com', avatar_url: 'https://avatars.example.com/u/1' } }];
check(!/example|avatar|@/.test(JSON.stringify(summarizeCityCard(personal)) + drawn(summarizeCityCard(personal), 'Town of octo')),
  'no e-mail address or avatar reaches the summary or the card');

// Archive-only towns.
const archivedOnly = golden.repos.slice(0, 9).map(repo => ({ ...repo, archived: true, created: '2018-03-01' }));
const quiet = summarizeCityCard(archivedOnly, { referenceTimestamp: reference });
check(quiet.repos === 9 && quiet.archived === 9 && quiet.top.length === 3 && quiet.skyline.every(house => house.archived) && quiet.firstYear === 2018,
  'an archive-only town still counts every house');
const quietSvg = drawn(quiet, 'quiet-keeper의 파이썬 연구소 도시', { lang: 'ko' });
check(textNodes(quietSvg)[2].endsWith(' · 모두 보관됨') && quietSvg.includes('opacity="0.4"') && !quietSvg.includes('fill="#ffd98a"'),
  'archived houses are faded without lit windows and the stats line says all are archived');
const someArchived = summarizeCityCard(golden.repos.slice(0, 5).map((repo, index) => ({ ...repo, archived: index < 2 })), { referenceTimestamp: reference });
check(textNodes(drawn(someArchived, 'Town'))[2].endsWith(' · 2 archived'), 'a partly archived town counts its archived houses');

// Hangul, emoji, control and bidi characters in repository and city names.
check(cityCardRepoSlug('한글레포') === 'repo' && cityCardRepoSlug('my 한글 repo') === 'my-repo' && cityCardRepoSlug('emoji🚀rocket') === 'emoji-rocket'
  && cityCardRepoSlug(`ctrl${NUL}${BEL}name${RLO}`) === 'ctrl-name' && cityCardRepoSlug('café-crème') === 'cafe-creme'
  && cityCardRepoSlug('.github') === '.github' && cityCardRepoSlug(null) === 'repo', 'repository names become GitHub-style ASCII slugs');
const longSlug = cityCardRepoSlug('x'.repeat(100));
check(bytes(longSlug) <= CITY_CARD_LIMITS.repoNameBytes && longSlug.endsWith('…') && longSlug.startsWith('x'.repeat(37)), 'a long repository name is cut by bytes');
const named = summarizeCityCard([
  { repo: '한글레포', stars: 9 }, { repo: 'emoji🚀rocket', stars: 7 }, { repo: `ctrl${NUL}${BEL}name${RLO}`, stars: 5 }, { repo: 'x'.repeat(100), stars: 1 },
]);
check(named.top.map(house => house.name).join() === 'repo,emoji-rocket,ctrl-name', 'top houses carry slugs');
const hostile = `<script>alert("x")</script> & 🚀 도시${NUL}${RLO}${LRI}${LONE}${ZWSP}${BOM}${DEL}${NEL}`;
const hostileSvg = drawn(named, hostile, { lang: 'ko' });
check(cityCardTextRuns(named, hostile, { lang: 'ko' }).find(run => run.role === 'name').text === '<script>alert("x")</script> & 🚀 도시',
  'control, bidi, invisible and lone-surrogate characters are dropped from the city name; visible text stays');
check(hostileSvg.includes('>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; 🚀 도시<') && !hostileSvg.includes('<script'),
  'city-name markup is escaped in text');
const quoted = drawn(one, `O'Reilly & "Friends" <City>`, { size: 'readme' });
check(quoted.includes('aria-label="O&#39;Reilly &amp; &quot;Friends&quot; &lt;City&gt; — 1 repo') && quoted.includes('<title>O&#39;Reilly &amp;'),
  'quotes and markup are escaped in attributes and the title');
const longName = cityCardTextRuns(empty, '가'.repeat(200)).find(run => run.role === 'name').text;
const emojiName = cityCardTextRuns(empty, '🚀'.repeat(60)).find(run => run.role === 'name').text;
check(bytes(longName) <= CITY_CARD_LIMITS.cityNameBytes && longName.endsWith('…') && bytes(emojiName) <= CITY_CARD_LIMITS.cityNameBytes
  && [...emojiName.slice(0, -1)].every(char => char === '🚀'), 'a long city name is cut by bytes on whole characters');
check(cityCardTextRuns(empty, 'x'.repeat(5000000)).find(run => run.role === 'name').text.length < 100, 'a huge city name is cheap and bounded');

// Same input, same bytes.
const name = 'Python Lab City of hyeonsangjeon';
const ogSvg = drawn(town, name);
check(sha(ogSvg) === sha(cityCardSvg(summarizeCityCard(golden.repos.map(repo => ({ ...repo })), { referenceTimestamp: reference }), name)),
  'the same catalog gives byte-identical SVG');
check(sha(ogSvg) === sha(cityCardSvg(summarizeCityCard(golden.repos.slice().reverse(), { referenceTimestamp: reference }), name)),
  'catalog order does not change a complete, duplicate-free card');
check(sha(ogSvg) === sha(cityCardSvg(JSON.parse(JSON.stringify(town)), name)) && sha(drawn(capped, 'x')) === sha(cityCardSvg(JSON.parse(JSON.stringify(capped)), 'x')),
  'a summary that went through JSON (a cache) draws the same bytes');
const readmeKo = drawn(town, 'hyeonsangjeon의 파이썬 연구소 도시', { size: 'readme', lang: 'ko' });
check(sha(ogSvg) === '95b5ee5923fa7f5b3062b352874db78c9169e726ffd2c08ca2ab43f0682cdacd' && sha(readmeKo) === '65c21a5238d088c6e8ab6445b93d6dca085bf848b203841cd188fc9d4d087de4',
  'the owner card bytes are pinned; update these hashes only with a deliberate card design change');

// Sizes, languages and the shared district palette.
check(ogSvg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" ')
  && readmeKo.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 1200 600" ')
  && CITY_CARD_SIZES.og.width === 1200 && CITY_CARD_SIZES.readme.height === 300, 'OG 1200×630 and README 600×300');
check(cityCardSvg(town, name, { size: 'poster', lang: 'fr' }) === ogSvg, 'an unknown size or language falls back to the English OG card');
check(Object.keys(CITY_CARD_ZONE_COLORS).join() === ZONE_IDS.join() && town.zones.every(zone => ogSvg.includes(`fill="${CITY_CARD_ZONE_COLORS[zone.id]}"`)),
  'one color per shared district id, all drawn');
const tagged = drawn(summarizeCityCard(golden.repos.slice(0, 40), { referenceTimestamp: reference }), name, { lang: 'ko' });
check(!/ruins|폐허/i.test(tagged + ogSvg), 'the card never calls a district ruins');

// Summary rules and immutability.
check(summarizeCityCard([{ repo: 'a', lang: 'Rust' }, { repo: 'b', lang: 'Go' }, { repo: 'c', lang: 'Rust' }, { repo: 'd', lang: 'Go' },
  { repo: 'e', lang: 'Other' }, { repo: 'f', lang: '—' }, { repo: 'g', lang: null }]).language === 'Go', 'a language tie goes to English collation order');
check(summarizeCityCard([{ repo: 'llm-a' }, { repo: 'docker-b' }, { repo: 'react-c' }], { referenceTimestamp: reference }).zones.map(zone => zone.percent).join() === '34,33,33',
  'whole-number shares use the largest remainder, ties in catalog order');
check(summarizeCityCard([{ repo: 'a', created: 'not a date' }, { repo: 'b', created: '2019-12-31T23:30:00-01:00' }, { repo: 'c', created: 20180101 }]).firstYear === 2020,
  'the first year is the earliest valid UTC creation year');
const frozenInput = Object.freeze(golden.repos.slice(0, 3).map(repo => Object.freeze({ ...repo, topics: Object.freeze(repo.topics.slice()) })));
const frozenSummary = summarizeCityCard(frozenInput, { referenceTimestamp: reference });
check(Object.isFrozen(frozenSummary) && Object.isFrozen(frozenSummary.zones[0]) && Object.isFrozen(frozenSummary.top[0])
  && Object.isFrozen(frozenSummary.skyline[0]) && Object.isFrozen(cityCardTextRuns(frozenSummary, name)[0]), 'inputs are not touched and outputs are frozen');

console.log(`ALL GREEN - ${count} city card checks: empty, one, 71, capped, archive-only, hostile names, escaping, byte-identical SVG`);
