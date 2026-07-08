/* scripts/smoke.mjs — Repolis static regression guard (hermetic, zero deps)
 *
 * Catches the small index.html regressions that kept coming back from the
 * mobile-first-screen / input-event / runtime-load areas. Pure text + a
 * `node --check` of the extracted inline module: zero network, zero clock,
 * zero LLM, zero install — run it as freely as council/test*.mjs.
 *
 *   node scripts/smoke.mjs        → "ALL GREEN — N checks passed" (exit 0) | red (exit 1)
 */
import { readFileSync, writeFileSync, rmSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0; const fails = [];
function ok(cond, msg) { if (cond) { pass++; } else { fail++; fails.push(msg); console.log('  ✗ ' + msg); } }
function group(name) { console.log('\n• ' + name); }

/* pull the meta viewport content + the #introTour {…} CSS rule once, for sane scoping */
const viewport = (HTML.match(/<meta\s+name=["']viewport["'][^>]*content=["']([^"']*)["']/i) || [, ''])[1];
const introTour = (HTML.match(/#introTour\s*\{[^}]*\}/) || [''])[0];

/* ── 1) mobile viewport: pinch-zoom stays enabled (a11y 1.4.4) ── */
group('mobile viewport keeps pinch-zoom (no user-scalable=no / maximum-scale)');
ok(viewport.length > 0, 'meta viewport tag exists');
ok(!/user-scalable\s*=\s*no/i.test(viewport), 'viewport has no user-scalable=no');
ok(!/maximum-scale/i.test(viewport), 'viewport has no maximum-scale');
ok(/width=device-width/i.test(viewport), 'viewport still width=device-width');

/* ── 2) #introTour secondary CTA: legible, not the washed-out purple ── */
group('#introTour secondary CTA contrast sanity');
ok(introTour.length > 0, '#introTour rule exists');
ok(!/#c9b8f2/i.test(introTour), '#introTour drops the old washed #c9b8f2 text');
ok(/#7a3f12/i.test(introTour), '#introTour uses dark warm text #7a3f12');
ok(/background\s*:\s*rgba\(255,\s*255,\s*255/i.test(introTour), '#introTour has a frosted-white background');
ok(/border\s*:\s*2px/i.test(introTour), '#introTour keeps a visible 2px border');

/* ── 3) move-key stuck guard: press-again-to-stop + clear on focus/menu loss ── */
group('movement key stuck-fix wiring');
ok(/const\s+MOVE\s*=\s*new Set\(/.test(HTML), 'MOVE set of movement codes exists');
ok(/!e\.repeat\s*&&\s*MOVE\.has\(e\.code\)\s*&&\s*keys\[e\.code\]/.test(HTML), 'second real press of a held move key releases it');
ok(/const\s+clearKeys\s*=/.test(HTML), 'clearKeys() helper exists');
ok(/addEventListener\(['"]blur['"]\s*,\s*clearKeys/.test(HTML), 'blur clears keys');
ok(/['"]pagehide['"]\s*,\s*clearKeys/.test(HTML), 'pagehide clears keys');
ok(/visibilitychange['"]\s*,\s*\(\)=>\{\s*if\(document\.hidden\)\s*clearKeys/.test(HTML), 'visibilitychange(hidden) clears keys');
ok(/contextmenu[\s\S]{0,80}clearKeys\(\)/.test(HTML), 'contextmenu suppression also clears keys');

/* ── 4) contribution library load is non-blocking (no startup stall) ── */
group('contribution library loads non-blocking');
ok(/libLoadState/.test(HTML), 'libLoadState flag present');
ok(/fetch\(['"]assets\/contribution-library\.json['"][\s\S]{0,120}\.then\(/.test(HTML), 'library fetch resolves via .then');
ok(/contribution-library[\s\S]{0,300}\.catch\(/.test(HTML), 'library fetch has a .catch fallback');
ok(!/await\s+fetch\(['"]assets\/contribution-library/.test(HTML), 'library fetch is not top-level awaited');

/* ── 5) Train Network v0: station landmark-stop single-hop travel ──
 *    NOTE: these are LANDMARK fast-travel stops (plaza/library/chrono/…), a separate namespace
 *    from the repo districts (ZONE_CAT). Naming is kept distinct so the two never read as one. */
group('station landmark stops (Train Network v0) wiring');
ok(/const\s+LANDMARK_STOPS\s*=\s*\[/.test(HTML), 'LANDMARK_STOPS table exists');
ok(/id=["']stationDistricts["']/.test(HTML), '#stationDistricts container in station modal');
ok(/function\s+renderLandmarkStops\s*\(/.test(HTML), 'renderLandmarkStops() builder exists');
ok(/renderStation\s*\(\s*\)\s*\{[\s\S]{0,120}renderLandmarkStops\s*\(\s*\)/.test(HTML), 'renderStation() calls renderLandmarkStops()');
ok(/lmCourseDest\s*\(\s*d\.id\s*\)/.test(HTML), 'landmark stop resolves its destination via lmCourseDest(id)');
ok(/if\s*\(\s*!dest\s*\)\s*return/.test(HTML), 'absent stops are skipped (public-town graceful degrade)');
ok(/taxiTo\s*\(\s*dest\s*\)/.test(HTML), 'landmark stop button rides via taxiTo(dest)');
ok(/track\(\s*['"]landmark_stop_ride['"]/.test(HTML), 'landmark stop ride is tracked');
ok(/stationDistrictsH\s*:/.test(HTML), 'stationDistrictsH i18n key present');

/* ── 6) inline <script type=module> still parses ── */
group('inline module parses (node --check)');
const mod = HTML.match(/<script type="module">([\s\S]*?)<\/script>/);
ok(!!mod, 'inline module script found');
if (mod) {
  const tmp = join(tmpdir(), 'repolis-smoke-' + process.pid + '.mjs');
  let clean = true;
  try { writeFileSync(tmp, mod[1]); execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  catch (e) { clean = false; console.log('  ✗ module syntax: ' + (e.stderr ? e.stderr.toString().split('\n')[0] : e.message)); }
  finally { try { rmSync(tmp); } catch (_) {} }
  ok(clean, 'inline module passes node --check');
}

/* ── 7) chronoMatch: the repo↔debate matcher stays correct, but the repo card must NOT expose a
 *    "관련 토론 보기"(→Chronopolis) button —집(레포)에서 토론장으로 튕기는 흐름을 제거했다.
 *    chronoMatch 자체는 검색/디버그용으로 유지되므로 아래 행동 테스트로 계속 가드한다.
 *    Also the historical youtube-dl-nas → Chronopolis(HTTP) mis-route guard: bottle/websocket/login-system
 *    must NOT match the HTTP-status debate. Runs the REAL shipped chronoMatch against repos.json + fixtures. */
group('chronoMatch stays correct · repo card exposes no debate-jump button');
ok(/const CHRONO_GENERIC_TAGS\s*=\s*new Set\(/.test(HTML), 'CHRONO_GENERIC_TAGS stoplist exists');
ok(/if\(toks\.has\(tg\)\s*&&\s*!CHRONO_GENERIC_TAGS\.has\(tg\)\)/.test(HTML), 'chronoMatch ignores generic/plumbing tags when scoring');
ok(!/id="relChronoBtn"/.test(HTML), 'repo card no longer renders the 관련 토론 보기(→Chronopolis) button (removed by request)');
const genSrc = (HTML.match(/const CHRONO_GENERIC_TAGS=new Set\(\[[\s\S]*?\]\);/) || [])[0];
const tokSrc = (HTML.match(/function repoChronoTokens\(repo\)\{[\s\S]*?return s; \}/) || [])[0];
const matchSrc = (HTML.match(/function chronoMatch\(repo\)\{[\s\S]*?return bestScore>=1 \? bestId : null; \}/) || [])[0];
ok(!!(genSrc && tokSrc && matchSrc), 'chronoMatch + helpers extractable from index.html');
if (genSrc && tokSrc && matchSrc) {
  let CF = null, repos = [], chronoMatch = null, tokensOf = null, GEN = null;
  try {
    CF = require(join(ROOT, 'council/fixtures.js'));
    const rj = JSON.parse(readFileSync(join(ROOT, 'repos.json'), 'utf8'));
    repos = Array.isArray(rj) ? rj : (rj.repos || []);
    chronoMatch = new Function('CF', `${genSrc}\n${tokSrc}\n${matchSrc}\nreturn chronoMatch;`)(CF);
    tokensOf = new Function(`${tokSrc}\nreturn repoChronoTokens;`)();
    GEN = new Function(`${genSrc}\nreturn CHRONO_GENERIC_TAGS;`)();
  } catch (e) { console.log('  ✗ chronoMatch harness: ' + e.message); }
  ok(!!(CF && CF.list && repos.length), 'council fixtures + repos.json loaded for behavioral check');
  if (chronoMatch && repos.length) {
    const byName = n => repos.find(r => r.repo === n);
    const yt = byName('youtube-dl-nas');
    ok(!!yt && chronoMatch(yt) === null, 'youtube-dl-nas no longer routes to a Chronopolis debate (reported bug fixed)');
    const gotty = byName('gotty-docker');
    ok(!gotty || chronoMatch(gotty) === null, 'generic-only match (gotty-docker via websocket) is dropped');
    const rag = byName('rag-faq-streamlit');
    ok(!rag || chronoMatch(rag) === 'rag_longctx', 'genuine match preserved (rag-faq-streamlit → RAG debate)');
    const react = byName('channel-vault-nas');
    ok(!react || chronoMatch(react) === 'react_effect', 'genuine match preserved (channel-vault-nas → React debate)');
    // Invariant: no repo may reach a debate through generic/plumbing tags alone.
    const genOnly = [];
    for (const r of repos) {
      const id = chronoMatch(r); if (!id) continue;
      const fx = CF.get(id); const toks = tokensOf(r);
      const specific = (fx.tags || []).filter(tg => toks.has(tg) && !GEN.has(tg));
      if (!specific.length) genOnly.push(r.repo + '→' + id);
    }
    ok(genOnly.length === 0, 'every 관련토론 link shares a domain-specific tag' + (genOnly.length ? ' [' + genOnly.join(', ') + ']' : ''));
  }
}

/* ── 8) repoByKey: the one canonical string→repo resolver — a shown repo can never resolve to a different one ──
 *    Runs the REAL shipped repoByKey (extracted from index.html) against the REAL repos.json, plus data
 *    invariants (url last segment ↔ repo.repo) and the #repo deep-link hash round-trip. */
group('repoByKey canonical identity resolve (navigation reliability)');
ok(/function repoByKey\(key\)\{/.test(HTML), 'repoByKey canonical resolver exists');
ok(/function openRepoFromHash\(\)\{/.test(HTML) && /#repo=/.test(HTML), 'repo deep link (#repo=) wiring exists');
ok(/function repoHashKey\(\)\{[\s\S]*?try\{[\s\S]*?\}catch/.test(HTML), 'repoHashKey guards decodeURIComponent (a mangled shared link cannot throw)');
ok(/modal\._repoKey=repo\.repo/.test(HTML), 'openCard records the card repo key for hash sync');
const normSrc = (HTML.match(/const _repoNorm=[^;]+;/) || [])[0];
const rbkSrc  = (HTML.match(/function repoByKey\(key\)\{[\s\S]*?return null; \}/) || [])[0];
const rhkSrc  = (HTML.match(/function repoHashKey\(\)\{[\s\S]*?catch\(_\)\{ return m\[1\]; \} \}/) || [])[0];
ok(!!(normSrc && rbkSrc && rhkSrc), 'repoByKey + _repoNorm + repoHashKey extractable from index.html');
if (normSrc && rbkSrc) {
  let repos = [];
  try { const rj = JSON.parse(readFileSync(join(ROOT, 'repos.json'), 'utf8')); repos = Array.isArray(rj) ? rj : (rj.repos || []); } catch (e) { console.log('  ✗ repos.json load: ' + e.message); }
  ok(repos.length > 0, 'repos.json loaded for identity check');
  if (repos.length) {
    const R = new Function('REPOS', `${normSrc}\n${rbkSrc}\nreturn repoByKey;`)(repos);
    const norm = new Function(`${normSrc}\nreturn _repoNorm;`)();
    const s = repos[0];
    ok(R(s.repo) === s, 'exact canonical key resolves to its own repo');
    ok(R(s.repo.toUpperCase()) === s, 'case-insensitive key resolves to the same repo');
    ok(R(s.repo.replace(/-/g, '_')) === s, "'-'/'_' -insensitive key resolves to the same repo");
    ok(R('__no-such-repo__') === null && R('') === null && R(null) === null && R('   ') === null, 'unknown / empty / null key resolves to null (no accidental match)');
    const bad = repos.filter(r => R(r.repo) !== r).map(r => r.repo);
    ok(bad.length === 0, 'every repo round-trips through its canonical key' + (bad.length ? ' [' + bad.slice(0, 4).join(', ') + ']' : ''));
    const mism = repos.filter(r => { const seg = String(r.url || '').replace(/\/+$/, '').split('/').pop(); return String(seg).toLowerCase() !== String(r.repo).toLowerCase(); }).map(r => r.repo);
    ok(mism.length === 0, 'every repo.url last segment matches repo.repo (Open-on-GitHub cannot mis-route)' + (mism.length ? ' [' + mism.slice(0, 4).join(', ') + ']' : ''));
    const seen = new Map(), coll = [];
    for (const r of repos) { const n = norm(r.repo); if (seen.has(n)) coll.push(seen.get(n) + '≈' + r.repo); else seen.set(n, r.repo); }
    ok(coll.length === 0, 'no two repos share a normalized key (the -/_ fallback stays unambiguous)' + (coll.length ? ' [' + coll.join(', ') + ']' : ''));
  }
}
if (rhkSrc) {
  const mk = hash => new Function('location', `${rhkSrc}\nreturn repoHashKey();`)({ hash });
  ok(mk('#repo=' + encodeURIComponent('youtube-dl-nas')) === 'youtube-dl-nas', 'deep-link hash round-trips the canonical key');
  ok(mk('#repo=' + encodeURIComponent('owner/repo name')) === 'owner/repo name', 'deep-link hash decodes special chars');
  ok(mk('') === null && mk('#other') === null, 'non-repo hash yields null');
  const noThrow = h => { try { return mk(h); } catch (e) { return '__THREW__:' + e.name; } };
  ok(noThrow('#repo=%') === '%', 'malformed %-encoding hash falls back to raw (never throws URIError)');
  ok(noThrow('#repo=%zz') === '%zz', 'invalid %-sequence hash falls back to raw (never throws URIError)');
}

/* ── 9) District Expansion v1: deterministic repo-district classifier + world map wiring ──
 *    Runs the REAL shipped zoneOf (extracted between the ZONECLASSIFIER markers) over the REAL repos.json:
 *    every repo lands in exactly one active district, the active count stays in the readable 5–7 band, and
 *    a district id can never collide with a repo's canonical key. Plus presence of the map / travel wiring. */
group('district classifier + world map (District Expansion v1)');
const zcSrc = (HTML.match(/\/\*ZONECLASSIFIER:START\*\/([\s\S]*?)\/\*ZONECLASSIFIER:END\*\//) || [, ''])[1];
ok(zcSrc.length > 0, 'ZONECLASSIFIER block extractable from index.html');
ok(/const ZONE_CAT\s*=\s*\[/.test(zcSrc), 'ZONE_CAT district catalog exists');
ok(/function zoneOf\(repo\)/.test(zcSrc), 'zoneOf() classifier exists');
ok(/const ZONE_SYN\s*=\s*\{/.test(HTML), 'ZONE_SYN travel-synonym namespace exists (separate from repoByKey)');
ok(/function districtNav\(q\)\{/.test(HTML) && /const dz=districtNav\(q\);/.test(HTML), 'districtNav wired into _coreIntent (every taxi mode)');
ok(/function zoneOf\(repo\)/.test(HTML) && /REPOS\.forEach\(r=>\{\s*r\._zone\s*=\s*zoneOf\(r\)/.test(HTML), 'every repo is assigned r._zone at build');
ok(/function paintDistricts\(\)/.test(HTML) && /function refreshDistrictSigns\(\)/.test(HTML), 'district ground tints + signposts (paintDistricts/refresh) present');
ok(/if\(repo\._zoneDest\)\{/.test(HTML), 'arriveTaxi has a _zoneDest branch (district arrival, no card)');
ok(/function gotoZone\(id\)\{/.test(HTML), 'gotoZone(id) travel helper exists');
ok(/id=["']worldmap["']/.test(HTML) && /id=["']mapWrap["']/.test(HTML) && /id=["']mapBtn["']/.test(HTML), 'world map DOM (#mapWrap/#worldmap/#mapBtn) present');
ok(/function drawMinimap\(\)/.test(HTML) && /function openMap\(\)/.test(HTML) && /function closeMap\(\)/.test(HTML), 'minimap draw/open/close functions present');
ok(/mapBtn\s*:\s*['"]/.test(HTML) && /mapTitle\s*:\s*['"]/.test(HTML) && /mapHint\s*:\s*['"]/.test(HTML), 'map i18n keys (mapBtn/mapTitle/mapHint) present');
ok(/window\.__zones\s*=/.test(HTML) && /window\.__gotoZone\s*=/.test(HTML), 'debug helpers __zones() + __gotoZone() present');
if (zcSrc && normSrc) {
  let repos = [], zoneOf = null, CAT = null;
  try {
    const rj = JSON.parse(readFileSync(join(ROOT, 'repos.json'), 'utf8'));
    repos = Array.isArray(rj) ? rj : (rj.repos || []);
    const built = new Function(`${zcSrc}\nreturn { ZONE_CAT, zoneOf };`)();
    CAT = built.ZONE_CAT; zoneOf = built.zoneOf;
  } catch (e) { console.log('  ✗ zoneOf harness: ' + e.message); }
  ok(!!(zoneOf && CAT && repos.length), 'zoneOf + ZONE_CAT + repos.json loaded for behavioral check');
  if (zoneOf && CAT && repos.length) {
    const ids = new Set(CAT.map(z => z.id));
    const norm = new Function(`${normSrc}\nreturn _repoNorm;`)();
    const counts = {}; let bad = [];
    for (const r of repos) { const z = zoneOf(r); if (!ids.has(z)) { bad.push(r.repo + '→' + z); continue; } counts[z] = (counts[z] || 0) + 1; }
    ok(bad.length === 0, 'every repo classifies into exactly one catalog district' + (bad.length ? ' [' + bad.slice(0, 4).join(', ') + ']' : ''));
    const active = Object.keys(counts);
    ok(active.length >= 5 && active.length <= 7, 'active district count is in the 5–7 readable band (got ' + active.length + ': ' + active.map(a => a + ':' + counts[a]).join(', ') + ')');
    ok(active.every(a => counts[a] >= 1), 'every active district holds at least one repo');
    ok(repos.reduce((s, r) => s + (ids.has(zoneOf(r)) ? 1 : 0), 0) === repos.length, 'district assignment total equals repo count (no repo dropped/duplicated)');
    const collide = CAT.filter(z => repos.some(r => norm(r.repo) === norm(z.id))).map(z => z.id);
    ok(collide.length === 0, 'no district id collides with a repo canonical key (district resolve stays a separate namespace)' + (collide.length ? ' [' + collide.join(', ') + ']' : ''));
    // determinism: classifying twice yields identical labels
    const drift = repos.filter(r => zoneOf(r) !== zoneOf(r)).map(r => r.repo);
    ok(drift.length === 0, 'zoneOf is deterministic (same repo → same district across calls)');
  }
}

/* ── 10) World Loop Integration v1: passport district progress · district-aware course ──
 *    repo-card actions/questions · deterministic zoneWhy · station-vs-district naming · debug hooks.
 *    All wired to REUSE the existing passport/course/taxi flow — no new localStorage key, no new backend. */
group('passport + course + card district loop (World Loop Integration v1)');
// 10a — passport district progress (derived from passport.repos + r._zone; backward-compatible)
ok(/function districtProgress\(\)/.test(HTML), 'districtProgress() helper exists');
ok(/function districtProgress\(\)\{[\s\S]*?passport\.repos/.test(HTML), 'districtProgress derives from existing passport.repos (no new storage key)');
ok(/id=["']pDistricts["']/.test(HTML), 'passport #pDistricts progress DOM present');
ok(/function renderPassport\(\)[\s\S]*?renderDistrictProgress\(\)/.test(HTML), 'renderPassport() renders district progress');
ok(/passportDistricts:\s*['"]/.test(HTML) && (HTML.match(/passportDistricts:\s*['"]/g) || []).length >= 2, 'passportDistricts i18n present in ko + en');
// 10b — Today's Course is district-aware, with a safe version gate
ok(/const COURSE_V\s*=\s*2\b/.test(HTML), 'COURSE_V version gate exists');
ok(/function buildCourse\(\)\{[\s\S]*?ZONES[\s\S]*?zone:\s*o\.z\.id/.test(HTML), 'buildCourse crosses ZONES districts (carries zone id on repo stops)');
ok(/function getCourse\(\)\{[\s\S]*?c\.v===COURSE_V/.test(HTML), 'getCourse gates on course version (safe migration/rebuild)');
ok(/zoneIconById\(it\.zone\)/.test(HTML), 'renderCourse shows the district icon for repo stops');
// 10c — repo-card actions + suggested questions, wired into the existing chat flow
ok(/id=["']cardAsk["']/.test(HTML), 'repo card #cardAsk section DOM present');
ok(/function renderCardAsk\(repo\)/.test(HTML), 'renderCardAsk() builds the card actions');
ok(/renderCardAsk\(repo\);/.test(HTML), 'openCard() populates the card-ask section');
ok(/function askInChat\(q\)\{[\s\S]*?sendChat\(\)/.test(HTML), 'askInChat() reuses the existing taxi sendChat flow (no new backend)');
ok(/function cardWhyZone\(repo\)/.test(HTML) && /function cardSimilar\(repo\)/.test(HTML), 'cardWhyZone() + cardSimilar() actions exist');
ok(/function repoSuggestedQs\(repo\)/.test(HTML), 'repoSuggestedQs() builds contextual questions');
ok(/function similarRepos\(repo,n\)/.test(HTML), 'similarRepos() finds same-district matches');
ok((HTML.match(/cardAskRepo:\s*['"]/g) || []).length >= 2 && (HTML.match(/cardAskWhy:\s*['"]/g) || []).length >= 2 && (HTML.match(/cardSimilar:\s*['"]/g) || []).length >= 2, 'card-ask i18n keys present in ko + en');
// 10d — district explanation is deterministic (no LLM / network)
const zoneWhySrc = (HTML.match(/function zoneWhy\(repo\)\{[\s\S]*?\nfunction cardWhyZone/) || [, ''])[0];
ok(zoneWhySrc.length > 0, 'zoneWhy() explanation helper exists');
ok(zoneWhySrc.length > 0 && !/fetch\(|groundedAsk|webllmAsk|proxyAsk|await /.test(zoneWhySrc), 'zoneWhy() is deterministic — no fetch/LLM call');
// 10e — station "landmark stops" no longer read as repo districts
ok(/const LANDMARK_STOPS\s*=\s*\[/.test(HTML), 'station list renamed to LANDMARK_STOPS');
ok(!/const DISTRICTS\s*=\s*\[/.test(HTML), 'old station const DISTRICTS is gone (no landmark/district name clash)');
ok(/function renderLandmarkStops\(\)/.test(HTML) && !/function renderDistricts\(\)/.test(HTML), 'renderLandmarkStops() replaces renderDistricts()');
ok(!/지식 구역/.test(HTML) && !/Knowledge districts/i.test(HTML), 'station heading no longer says "지식 구역" / "Knowledge districts"');
ok(/🚉 명소로 바로 이동/.test(HTML) && /🚉 Landmark stops/.test(HTML), 'station heading now reads as landmark stops (ko + en)');
// 10f — debug helpers
ok(/window\.__passport\s*=/.test(HTML) && /window\.__districtProgress\s*=/.test(HTML), 'debug helpers __passport() + __districtProgress() present');
ok(/window\.__course=\(\)=>\{[\s\S]*?districts:/.test(HTML), '__course() reports district info');

/* ── 11) District Landmark Hubs v1: one walkable hub + info board per active district ──
 *    procedural (shared geometry), placed clear of buildings, checked AFTER houses (no door hijack),
 *    taxi/map arrive at the hub, board reuses passport/course data + the canonical repo resolver. */
group('district landmark hubs + info board (District Landmark Hubs v1)');
// 11a — hub system + one hub for every active district
ok(/const ZONE_HUBS\s*=\s*\[\]/.test(HTML), 'ZONE_HUBS registry exists');
ok(/function buildHub\(z\)/.test(HTML), 'buildHub() procedural builder exists');
ok(/for\(const z of ZONES\)\s*buildHub\(z\)/.test(HTML), 'a hub is built for every active ZONES district');
ok(/function _hubSpot\(z,\s*taken\)/.test(HTML) && /function _hubGap\(x,z\)/.test(HTML), 'deterministic placement (_hubSpot) + building-clearance (_hubGap) helpers exist');
ok(/function _hubAccent\(z,g\)/.test(HTML), '_hubAccent() gives each district its own low-cost identity');
const buildHubSrc = (HTML.match(/function buildHub\(z\)\{[\s\S]*?\nfor\(const z of ZONES\) buildHub/) || [, ''])[0];
ok(/EXTRA_COLLIDERS\.push\(\{x:hx,z:hz,r:1\.9\}\)/.test(buildHubSrc), 'hub adds a single minimal centre collider (accents stay walkable)');
ok(!/new THREE\.PointLight|new THREE\.SpotLight/.test(buildHubSrc), 'hub build spawns no new scene lights (perf gate)');
// 11b — hubs never hijack a repo building's own door: detected only when no house is in reach, acted after nearest
ok(/nearHub=null;\s*if\(!nearest\)\{/.test(HTML), 'nearHub is detected only when no building is in reach (buildings win)');
ok(/openCard\(nearest\);\s*else if\(nearHub\)\s*openZoneBoard\(nearHub\.id\)/.test(HTML), 'doAct() checks nearHub AFTER nearest (no repo-prompt hijack)');
// 11c — taxi + map destinations are hub-based
ok(/function zoneDest\(z\)\{[\s\S]*?z\._hub/.test(HTML), 'zoneDest() sends the taxi to the district hub');
ok(/for\(const z of ZONES\)\{ const hp=\(z\._hub&&z\._hub\.pos\)/.test(HTML), 'minimap draws the district icon on its hub');
// 11d — the district board modal + its action hooks
ok(/id=["']zoneBoard["']/.test(HTML) && /id=["']zbBody["']/.test(HTML) && /id=["']zbClose["']/.test(HTML), 'district board modal DOM (#zoneBoard/#zbBody/#zbClose) present');
ok(/function renderZoneBoard\(id\)/.test(HTML) && /function openZoneBoard\(id\)/.test(HTML) && /function closeZoneBoard\(\)/.test(HTML), 'board render/open/close functions exist');
ok(/id=["']zbRide["']/.test(HTML) && /id=["']zbUnseen["']/.test(HTML) && /id=["']zbAsk["']/.test(HTML), 'board action hooks (ride / guide-unseen / ask) present');
ok(/class="zbRepo"[\s\S]*?data-repo=/.test(HTML), 'board lists clickable representative repos');
// 11e — board reuses canonical repo identity + the existing chat, and its basis line is deterministic
ok(/repoByKey\(a\.dataset\.repo\)/.test(HTML), 'board re-resolves repo taps through the canonical repoByKey resolver');
ok(/zbAsk[\s\S]{0,140}?askInChat\(/.test(HTML), 'board "ask" reuses the existing askInChat/taxi chat flow (no new backend)');
const zoneBasisSrc = (HTML.match(/function zoneBasis\(z\)\{[\s\S]*?\nfunction renderZoneBoard/) || [, ''])[0];
ok(zoneBasisSrc.length > 0 && !/fetch\(|groundedAsk|webllmAsk|await /.test(zoneBasisSrc), 'zoneBasis() district explanation is deterministic — no fetch/LLM');
// 11f — hub sign i18n + language refresh + debug helpers
ok((HTML.match(/zbSub:\s*['"]/g) || []).length >= 2 && (HTML.match(/zbRide:\s*['"]/g) || []).length >= 2 && (HTML.match(/zbBoard:\s*['"]/g) || []).length >= 2, 'board i18n keys (zbSub/zbRide/zbBoard) present in ko + en');
ok(/function refreshHubSigns\(\)/.test(HTML) && /if\(typeof refreshHubSigns==='function'\) refreshHubSigns\(\)/.test(HTML), 'hub signs re-texture on language change');
ok(/window\.__zoneHubs\s*=/.test(HTML) && /window\.__zoneBoard\s*=/.test(HTML), 'debug helpers __zoneHubs() + __zoneBoard() present');
// 11g — hub districts stay distinct from the station's landmark rides (no naming clash)
ok(/const ZONE_HUBS\s*=/.test(HTML) && /const LANDMARK_STOPS\s*=/.test(HTML), 'repo-district hubs (ZONE_HUBS) and station landmark rides (LANDMARK_STOPS) remain separate systems');

/* ── 12) Resident NPC Social Layer v1: budget-capped townspeople ──
 *    7 residents (max 10) that trade turn-by-turn ambient lines + chat with the visitor. Default = deterministic
 *    SCRIPTED (zero network / zero cost); an optional Cloudflare Worker path lights up model turns only when the
 *    operator enables it AND the daily budget allows. Guards: roster size, prompt priority (residents never hijack
 *    a repo door or a district board), hidden-tab ambient stop, budget-exhausted fallback, turn/cooldown caps,
 *    NO secret/model/endpoint in the public client, debug probes, and the additive worker actions. */
group('resident NPC social layer + budget cap (Resident NPC Social Layer v1)');
const npcBlock = (HTML.match(/RESIDENT NPC SOCIAL LAYER v1[\s\S]*?character \(chibi/) || [, ''])[0];
ok(npcBlock.length > 0, 'resident NPC block extractable from index.html');
// 12a — roster: exactly 8 residents (7 district folk + the plaza dreamer Noa), hard cap 10
ok(/const MAX_RESIDENTS=10/.test(npcBlock), 'MAX_RESIDENTS cap is 10');
ok((npcBlock.match(/\{ id:'/g) || []).length === 8, 'RESIDENTS roster holds exactly 8 townspeople');
ok(/\{ id:'noa', zone:'plaza'/.test(npcBlock), 'the plaza dreamer Noa is in the roster (strolls the square brainstorming ideas)');
ok(/RESIDENTS\.slice\(0,MAX_RESIDENTS\)/.test(npcBlock), 'placement is clamped to the max-resident cap');
// 12b — prompt priority: residents sit BELOW buildings + hubs (no repo-door / district-board hijack)
ok(/nearResident=null; if\(!nearest && !nearHub\)\{/.test(HTML), 'nearResident is detected only when no building AND no hub is in reach');
ok(/openZoneBoard\(nearHub\.id\); else if\(nearResident\)\{ const _g=_groupNear\(nearResident\)/.test(HTML), 'doAct() checks nearResident AFTER nearHub (buildings + hubs win)');
ok(/else if\(nearResident&&!modalOpen\)\{ const _g=_groupNear\(nearResident\); promptEl\.innerHTML=_g\?_groupPromptHtml\(_g\):residentPromptHtml/.test(HTML), 'resident prompt is emitted after the hub prompt branch');
ok(/const RES_REACH=3\.4/.test(npcBlock), 'residents use a small walk-up reach (3.4)');
// 12b-2 — living town: residents wander around home and walk toward one another before talking (not static statues)
ok(/const RES_MOVE=\{[^}]*meetMax:/.test(npcBlock) && /talkDist:/.test(npcBlock), 'RES_MOVE tuning (meetMax + talkDist) exists for wander + rendezvous');
ok(/function _resRoamTarget\(/.test(npcBlock) && /function _resWalk\(/.test(npcBlock), 'residents have a wander-target picker + a walk-step locomotion helper');
ok(/phase:near\?'talk':'approach'/.test(npcBlock) && /C\.phase==='approach'/.test(npcBlock), 'a distant pair first walks together (approach) before the turn-by-turn talk');
// 12b-3 — LOW_END must NOT freeze the town: residents keep wandering (slower), only a hidden tab / chat / conversation stops them
ok(/motionEnabled:true/.test(npcBlock), 'NPC_CFG carries a motionEnabled flag (residents move by default)');
ok(!/!inConv && !chatBound && !LOW_END/.test(npcBlock), 'wander gate is NOT disabled by LOW_END (no "!LOW_END" in the locomotion branch)');
ok(/!inConv && !chatBound && !hidden && NPC_CFG\.motionEnabled/.test(npcBlock), 'wander runs whenever motion is enabled and the tab is visible (LOW_END-independent)');
ok(!/LOW_END\) NPC_CFG\.scriptedAmbient=false/.test(npcBlock), 'LOW_END no longer kills scripted ambient chatter (kept, just eased)');
const _lowW=(npcBlock.match(/wanderSpd:\(LOW_END\?([0-9.]+)/)||[])[1], _lowM=(npcBlock.match(/meetSpd:\(LOW_END\?([0-9.]+)/)||[])[1];
ok(_lowW && parseFloat(_lowW)>=0.7, `LOW_END wander speed (${_lowW}) is a lifelike walking pace (>=0.7), not a near-frozen crawl`);
ok(_lowM && parseFloat(_lowM)>=1.1, `LOW_END meet speed (${_lowM}) is brisk enough to actually rendezvous (>=1.1)`);
ok(/if\(document\.hidden\)\{ if\(_ambConv\) _endAmb\('hidden'\)/.test(npcBlock), 'a hidden tab still stops ambient chatter (background motion/cost guard preserved)');
// 12b-4 — a quiet place to rest: townsfolk stroll to a free bench, sit a while, then get back up (and yield the seat to a chat/conversation)
ok(/function _resSit\(/.test(npcBlock) && /function _resStand\(/.test(npcBlock), 'residents have sit + stand pose helpers for resting on a bench');
ok(/function _freeSeat\(/.test(npcBlock) && /for\(const s of SEATS\)/.test(npcBlock), 'residents pick the nearest free SEAT within seatSeek to rest at');
ok(/restChance:/.test(npcBlock) && /seatSeek:/.test(npcBlock), 'RES_MOVE carries rest tuning (restChance + seatSeek)');
ok(/if\(inConv\|\|chatBound\)\{ _resStand\(L\); _seatRelease\(L\)/.test(npcBlock), 'a resting resident stands + frees the bench the moment a chat/conversation claims them');
// 12b-5 — glowing roadside flowers: colourful by day, a soft shimmer after dark (day/night-driven, not always-on)
ok(/function makeGlowFlowers\(/.test(HTML) && /const GLOW_FLORA=\[\]/.test(HTML), 'glowing-flower builder + registry exist');
ok(/function updateGlowFlora\(t\)\{[\s\S]*?if\(!isNight\)/.test(HTML), 'glow flora are driven by day/night (dark → glow, day → off)');
ok(/placeGlowFlowers\(\);/.test(HTML), 'glow flowers are placed into the world');
// 12c — turn-by-turn ambient engine: hidden-tab stop, one conversation, turn + cooldown caps
ok(/if\(document\.hidden\)\{ if\(_ambConv\) _endAmb\('hidden'\); return; \}/.test(npcBlock), 'ambient engine stops on a hidden tab (no background chatter/cost)');
ok(/hardMaxTurns:10/.test(npcBlock), 'ambient conversations are hard-capped at 10 turns');
ok(/pairCooldownMin:20, pairCooldownMax:60/.test(npcBlock), 'a resident pair has a 20–60s cooldown before chatting again');
ok(/maxConcurrent:1/.test(npcBlock), 'at most one ambient conversation runs at a time');
ok(/_capBub\(line\)/.test(npcBlock), 'ambient bubble text runs through the bubble-friendly clean cap (_capBub), not a raw 180-char slice');
ok(/function _capBub\(s\)\{[\s\S]*?lastIndexOf\(' '\)[\s\S]*?\}/.test(npcBlock), '_capBub trims at a sentence/word boundary so a bubble line never gets cut mid-word');
ok(/function makeResBubble\(\)\{[\s\S]*?const ML=5/.test(npcBlock), 'resident speech bubble renders up to 5 lines (a full conversational line shows instead of a 3-line cut)');
ok(/_cap180/.test(npcBlock) && /slice\(0,180\)/.test(npcBlock), 'player-chat lines keep the 180-char cap for the DOM panel');
// 12d — budget: exhaustion forces the free scripted fallback, degradation trims turns
ok(/function _budgetExhausted\(\)/.test(npcBlock) && /function _budgetLow\(\)/.test(npcBlock), 'client budget mirror exposes low + exhausted checks');
ok(/NPC_CFG\.aiEnabled && NPC_CFG\.ambientAiEnabled && !_budgetExhausted\(\)/.test(npcBlock), 'AI ambient turn is gated on budget-not-exhausted');
ok(/NPC_CFG\.aiEnabled && NPC_CFG\.playerChatAiEnabled && !_budgetExhausted\(\)/.test(npcBlock), 'AI player chat is gated on budget-not-exhausted');
ok(/degrade\?NPC_CFG\.degradeMaxTurns/.test(npcBlock), 'a low budget degrades the conversation to fewer turns');
// 12e — public-safe: the client ships NO api key, model deployment name, or Azure endpoint
ok(!/AOAI_ENDPOINT|AAD_CLIENT|SEARCH_API_KEY|cognitiveservices|["']api-key["']/.test(npcBlock), 'resident client code contains no Azure endpoint / secret');
ok(!/gpt-[0-9]/.test(npcBlock), 'resident client code names no model deployment');
ok(!/NPC_MODEL_|NPC_DAY_CAP_USD|AOAI_DEPLOYMENT/.test(npcBlock), 'server-only NPC env names never appear in the client');
// 12f — debug probes
ok(/window\.__villagers=/.test(HTML) && /window\.__npcRoutes=/.test(HTML) && /window\.__npcEncounter=/.test(HTML), 'debug helpers __villagers/__npcRoutes/__npcEncounter present');
ok(/window\.__npcBudget=/.test(HTML) && /window\.__npcTranscript=/.test(HTML), 'debug helpers __npcBudget/__npcTranscript present');
// 12g — worker: additive npc_action scaffolding with the env-off ceiling + budget guard + fallback model
let WORKER = '';
try { WORKER = readFileSync(join(ROOT, 'cloudflare-taxi/src/grounded.js'), 'utf8'); } catch (e) { console.log('  ✗ grounded.js load: ' + e.message); }
ok(WORKER.length > 0, 'grounded.js worker source loaded');
ok(/if \(body && body\.npc_action\) return npcHandler\(body, request, env\)/.test(WORKER), 'fetch router dispatches body.npc_action to npcHandler (existing actions untouched)');
ok(/async function npcHandler\(/.test(WORKER), 'npcHandler() exists');
ok(/action === "npcConfig"/.test(WORKER) && /action === "npcBudget"/.test(WORKER) && /"npcAmbientTurn"/.test(WORKER) && /"npcPlayerChat"/.test(WORKER), 'all four npc actions (config/budget/ambientTurn/playerChat) handled');
ok(/if \(!aiEnabled\) return null/.test(WORKER), 'hard ceiling: npcModelCall returns null unless the resolved aiEnabled is true');
ok(/async function npcResolveFlags\(/.test(WORKER), 'npcResolveFlags() resolves the effective NPC flags (env vs live KV)');
ok(/env\.NPC_LIVE_TOGGLE === "true"/.test(WORKER), 'NPC_LIVE_TOGGLE is the master kill-switch for the live toggle');
ok(/source: "env", liveToggle: false/.test(WORKER), 'live toggle OFF → resolver ignores KV and stays env-gated (safe deploy-only default)');
ok(/env\.NPC_FLAGS\.get\(/.test(WORKER), 'live mode reads on/off from the shared NPC_FLAGS KV');
ok(/npcModelCall\(env, role, sys, userMsg, aiEnabled\)/.test(WORKER), 'model call is gated by the resolved effective aiEnabled');
ok(/reason: "npc_budget_exhausted"/.test(WORKER), 'over-budget returns npc_budget_exhausted (client falls back to scripted)');
ok(/NPC_MODEL_DEFAULT \|\| "gpt-5\.4-mini"/.test(WORKER), 'provider adapter falls back to gpt-5.4-mini when no NPC_MODEL_* alias is set');
ok(/env\.NPC_DAY_CAP_USD/.test(WORKER) && !/COUNCIL_[A-Z_]*\s*\|\|\s*env\.NPC_/.test(WORKER), 'NPC budget uses the NPC_* namespace (separate from COUNCIL_*)');
ok(/function npcMetric\(/.test(WORKER) && /env\.METRICS_URL/.test(WORKER), 'redacted fire-and-forget metrics emit (env.METRICS_URL) present');

// 13 — realtime ghost cleanup: client reconciles against the server's authoritative roster
ok(/m\.t==='sync'/.test(HTML) && /for\(const id of \[\.\.\.peers\.keys\(\)\]\) if\(!ids\.has\(id\)\) removePeer\(id\)/.test(HTML), "client drops any avatar missing from the server's authoritative sync roster (self-healing ghost cleanup)");
ok(/window\.__peers=\(\)=>/.test(HTML) && /window\.__kickGhost=\(q\)=>/.test(HTML), 'realtime debug helpers (__peers / __kickGhost) are present for inspecting and dropping stray avatars');

// 14 — first-entry time-of-day: skyPhaseForHour maps the visitor's local hour to the right SKY_PHASES bucket
group('first-entry time-of-day (browser clock → sky phase)');
ok(/function skyPhaseForHour\(h\)\{/.test(HTML), 'skyPhaseForHour() exists');
ok(/function initTimeOfDay\(\)\{/.test(HTML) && /initTimeOfDay\(\);/.test(HTML), 'initTimeOfDay() defined and invoked at boot');
ok(!/applySky\(0\.5\); setNightState\(false\); updateDayIcon\(\);/.test(HTML), 'hardcoded noon first-entry paint removed');
ok(/window\.__skyForHour=\(h\)=>/.test(HTML), '?dbg __skyForHour hook present for 24h verification');
const sphSrc = (HTML.match(/function skyPhaseForHour\(h\)\{[\s\S]*?return 2; \}/) || [])[0];
ok(!!sphSrc, 'skyPhaseForHour extractable from index.html');
if (sphSrc) {
  const skyPhaseForHour = new Function(`${sphSrc}\nreturn skyPhaseForHour;`)();
  // PHASES mirrors the shipped SKY_PHASES index→name mapping (0 day,1 dusk,2 night,3 dawn)
  const PHASES = ['day', 'dusk', 'night', 'dawn'];
  const expect = h => (h >= 5 && h < 8) ? 'dawn' : (h >= 8 && h < 17) ? 'day' : (h >= 17 && h < 20) ? 'dusk' : 'night';
  let allOk = true, ranges = true;
  for (let h = 0; h < 24; h++) {
    const i = skyPhaseForHour(h);
    if (i < 0 || i > 3) ranges = false;
    if (PHASES[i] !== expect(h)) { allOk = false; console.log('  ✗ hour ' + h + ' → ' + PHASES[i] + ' (expected ' + expect(h) + ')'); }
  }
  ok(allOk, 'all 24 hours map to the expected phase (dawn 5-7 · day 8-16 · dusk 17-19 · night 20-4)');
  ok(ranges, 'skyPhaseForHour always returns an index in 0..3');
  // exact boundary hours (both sides of every transition)
  ok(PHASES[skyPhaseForHour(5)] === 'dawn' && PHASES[skyPhaseForHour(4)] === 'night', 'boundary 4→night, 5→dawn');
  ok(PHASES[skyPhaseForHour(8)] === 'day' && PHASES[skyPhaseForHour(7)] === 'dawn', 'boundary 7→dawn, 8→day');
  ok(PHASES[skyPhaseForHour(17)] === 'dusk' && PHASES[skyPhaseForHour(16)] === 'day', 'boundary 16→day, 17→dusk');
  ok(PHASES[skyPhaseForHour(20)] === 'night' && PHASES[skyPhaseForHour(19)] === 'dusk', 'boundary 19→dusk, 20→night');
  ok(skyPhaseForHour(24) === skyPhaseForHour(0) && skyPhaseForHour(-1) === skyPhaseForHour(23), 'hour normalization wraps (24≡0, -1≡23)');
}

// 15 — player spotlight: the hero fill light must stay lit in every phase (regression guard: day was stuck at 0)
group('player hero fill light (all phases)');
ok(/faceLight\.intensity = night\?16:6;/.test(HTML), 'setNightState keeps the hero fill light on by day (6) — never drops to 0 — and brighter at night (16)');
ok(/faceLight=new THREE\.PointLight\(0xfff0d8, isNight\?16:6,/.test(HTML), 'the hero fill light is seeded to the current phase at build (day entry is not left dark)');
ok(/window\.__playerLight=/.test(HTML), '?dbg __playerLight hook present to inspect/tune the hero fill light');

// 16 — resident warmth: residents notice the visitor (wave + hello) and show the occasional solo life-emote (all client-side, zero-cost)
group('resident warmth (greet + idle emote)');
ok(/function _resGreetLine\(res\)\{/.test(HTML), '_resGreetLine() builds a short localized wave-hello');
ok(/const RES_GREET_DIST=5\.2, RES_GREET_CD_MIN=24, RES_GREET_CD_MAX=44;/.test(HTML), 'greet radius + cooldown constants present (edge-triggered, not spammy)');
ok(/if\(pnear && !L\._pNear && tt>=L\._greetCd\)\{ L\.bub\.say\(_resGreetLine\(L\.res\), _hex\(L\.res\.color\)\); L\._gt=2\.6;/.test(HTML), 'proximity greeting is edge-triggered (_pNear), cooldown-gated (_greetCd), and waves (_gt) with a bubble');
ok(/if\(!inConv && !chatBound && !hidden\)\{/.test(HTML), 'greeting is suppressed during a conversation / bound chat / hidden tab (never clobbers ambient bubbles)');
ok(/if\(chatBound\) L\.bub\.clear\(\);/.test(HTML), 'a resident the visitor is chatting with hides its floating greeting/emote bubble (no residual bubble lingers into the chat)');
ok(/function _resIdleEmote\(\)\{/.test(HTML) && /if\(Math\.random\(\)<0\.7\)\{ L\.bub\.say\(_resIdleEmote\(\), _hex\(L\.res\.color\)\); L\._gt=1\.6;/.test(HTML), 'low-frequency solo idle emote adds ambient town life');
ok(/if\(!inConv && !chatBound && !L\._pNear && L\._gt<=0 && tt>=L\._emoteCd\)\{/.test(HTML), 'idle emote only fires when idle, alone, visitor not right here (greeting has precedence) and not mid-gesture');
ok(/const RES_EMOTE_CD_MIN=\(LOW_END\?46:30\), RES_EMOTE_CD_MAX=\(LOW_END\?90:64\);/.test(HTML), 'LOW_END keeps the greeting warmth but spaces solo emotes further (saving stays on the AI side)');
ok(/window\.__greet=\(id\)=>/.test(HTML) && /greetDist:RES_GREET_DIST, greetCd:\[RES_GREET_CD_MIN,RES_GREET_CD_MAX\]/.test(HTML), '?dbg __greet hook + __npcState greet/emote config present');

// 17 — resident group conversations: a nearby cluster forms a CIRCLE and everyone takes turns (not just 1:1)
group('resident group conversations (gather → everyone talks)');
ok(/maxGroup:4/.test(npcBlock), 'NPC_CFG carries a maxGroup so a gathering becomes a circle, not just a pair');
ok(/if\(LOW_END\)\{[\s\S]*?NPC_CFG\.maxGroup=3;/.test(npcBlock), 'LOW_END + mobile cap the circle smaller (maxGroup 3) to stay light/readable');
ok(/const groupR=|groupR:\(LOW_END\?15:20\)/.test(npcBlock), 'RES_MOVE carries a groupR gather radius so only genuinely-nearby folk join the circle');
ok(/_ambConv=\{ members,/.test(npcBlock), 'ambient conversation holds a members[] array (N residents), not a fixed a/b pair');
ok(/C\.si=\(C\.si\+1\)%C\.members\.length/.test(npcBlock), 'the speaking turn round-robins through every circle member so all of them talk');
ok(/const cap=Math\.max\(2, Math\.min\(NPC_CFG\.maxGroup/.test(npcBlock), 'group size is clamped to maxGroup (nearby cooldown-free folk join, capped)');
ok(/Math\.hypot\(g\.position\.x-C\.center\.x,g\.position\.z-C\.center\.z\)>RES_MOVE\.talkDist/.test(npcBlock), 'members converge on the shared circle centre during the approach phase (a ring, never a pile-up)');
ok(/Math\.min\(NPC_CFG\.hardMaxTurns, base\+\(members\.length-2\)\)/.test(npcBlock), 'a bigger circle earns a few more turns but stays hard-capped at 10');
ok(/for\(const m of C\.members\) _resCd\.set/.test(npcBlock), 'every member gets a cooldown when the gathering ends (whole circle rests, not just the seed pair)');
ok(/window\.__conv=\(\)=>/.test(HTML) && /window\.__gather=/.test(HTML), '?dbg __conv/__gather hooks expose + force group conversations');
ok(/if\(document\.hidden\)\{ if\(_ambConv\) _endAmb\('hidden'\); return; \}/.test(npcBlock) && /maxConcurrent:1/.test(npcBlock), 'group conversations preserve the hidden-tab stop and the one-gathering-at-a-time cap');

// 18 — the visitor can JOIN a gathering: walk up to a circle (or cluster) and the whole group chats back, round-robin
group('resident player group chat (visitor joins a gathering)');
ok(/let activeGroupMembers=null/.test(npcBlock), 'a module-level activeGroupMembers holds the residents in a player-facing circle');
ok(/joinR:\(LOW_END\?7:9\)/.test(npcBlock), 'RES_MOVE carries a joinR walk-up radius (smaller than groupR) so a circle only forms when folk are genuinely clustered');
ok(/function _groupNear\(npc\)\{[\s\S]*?_ambConv\.members\.indexOf\(seed\)>=0/.test(npcBlock), '_groupNear joins an existing circle if the seed is mid-conversation, else gathers the nearby cluster');
ok(/function openGroupChat\(members\)\{[\s\S]*?_endAmb\('player-joined'\)/.test(npcBlock), "opening a group chat ends the residents' auto-conversation so they turn to the visitor");
ok(/async function groupSay\(q\)\{/.test(npcBlock), 'groupSay drives the whole-circle reply to the visitor');
ok(/const pi=\(wrap\.gi\|\|0\)%ms\.length/.test(npcBlock) && /wrap\.gi=\(wrap\.gi\|\|0\)\+1/.test(npcBlock), 'the addressed speaker round-robins (wrap.gi) so every circle member answers the visitor over the exchange');
ok(/if\(ms\.length>1\)\{[\s\S]*?residentReply\(other,q\)/.test(npcBlock) && !/_scriptLine\(other\)/.test(npcBlock), 'the second resident answers the SAME question (AI chime or residentReply fallback), never a random _scriptLine aside');
ok(/const chatBound=_resChatActive\(\)&&activeNpc&&\(activeNpc\.res===L\.res \|\| \(activeGroupMembers&&activeGroupMembers\.indexOf\(L\)>=0\)\)/.test(npcBlock), 'every circle member freezes + turns to the visitor while the group chat is open (chatBound covers activeGroupMembers)');
ok(/pd<6\.5\)\?player\.position/.test(npcBlock), 'residents in a circle turn to face the visitor who steps right up (pd<6.5)');
ok(/if\(_ambConv!==C\)\{ C\.pending=false; return; \}/.test(npcBlock), "a stale in-flight ambient turn can't paint a bubble after the visitor joins (done() guards on _ambConv)");
ok(/function _releaseGroup\(\)\{/.test(npcBlock) && /_releaseGroup\(\);/.test(HTML), 'closing/ switching the chat releases the circle (members rest a beat, then town life resumes)');
ok(/if\(n&&n\.group\) return groupGreet\(n\)/.test(HTML) && /if\(n&&n\.group\)\{/.test(HTML), 'the chat panel has a group branch for greeting + chrome (names header, no mode selector)');
ok(/if\(activeNpc&&activeNpc\.group\)\{ await groupSay\(q\)/.test(HTML), 'sendChat routes to groupSay when a gathering is active (before the 1:1 resident + taxi paths)');
ok(/const _g=_groupNear\(nearResident\); if\(_g\) openGroupChat\(_g\); else openChat\(nearResident\)/.test(HTML), 'pressing Enter/💬 by a cluster opens the group chat, else falls back to a 1:1');
ok(/promptEl\.innerHTML=_g\?_groupPromptHtml\(_g\):residentPromptHtml\(nearResident\)/.test(HTML), 'the walk-up prompt shows "join in / 대화에 끼기" for a cluster');
ok(/window\.__joinGroup=/.test(HTML) && /window\.__groupChat=/.test(HTML), '?dbg __joinGroup/__groupChat hooks force + inspect a player group chat');

group('resident chat carries conversation context (answers stay on the visitor\'s question)');
ok(/let _resHist=\[\]/.test(npcBlock) && /function _resHistPush\(who,text\)/.test(npcBlock) && /function _resHistWindow\(\)/.test(npcBlock), 'a shared _resHist transcript (push + recent window) backs resident + group multi-turn memory');
ok(/if\(_resHist\.length>12\) _resHist=_resHist\.slice\(-12\)/.test(npcBlock) && /return _resHist\.slice\(-10\)/.test(npcBlock), 'the transcript is bounded (keep 12, hand the last 10 to the worker) so the prompt never runs away');
ok(/async function _aiPlayerChat\(res,q,opts\)\{/.test(npcBlock) && /if\(opts\.last&&opts\.last\.length\) payload\.last=opts\.last/.test(npcBlock), '_aiPlayerChat forwards the prior thread (payload.last) so the speaker follows the flow, not just the raw question');
ok(/if\(opts\.chime\)\{ payload\.chime=true; if\(opts\.prev\) payload\.prev=opts\.prev/.test(npcBlock), '_aiPlayerChat marks a chime-in (chime+prev) so the worker tells the 2nd speaker to build on the previous one');
ok(/const last=_resHistWindow\(\); _resHistPush\('visitor',q\)/.test(npcBlock) && /_resHistPush\(res\.id,c\)/.test(npcBlock), 'residentSay snapshots history then records both the question and the reply, so a follow-up keeps context');
ok(/const ctx=base\.concat\(\[\{who:pres\.id,text:mainLine\}\]\)/.test(npcBlock) && /_aiPlayerChat\(other,q,\{last:ctx,chime:true,prev:pres\.id\}\)/.test(npcBlock), "groupSay feeds the 2nd resident the primary's just-given answer so the chime-in reacts to it (context-aware, on the same question)");
ok(/_resHistPush\(pres\.id,mainLine\)/.test(npcBlock) && /_resHistPush\(other\.id,chime\)/.test(npcBlock), 'every group answer is recorded to the shared thread so later turns build on the whole exchange');
ok(/_resHist=\[\]/.test(HTML.match(/if\(activeNpc!==npc\)\{[\s\S]*?\}/)?.[0] || ''), 'switching the chat NPC clears _resHist so a new gathering starts with a fresh thread');
ok(/window\.__resTranscript=\(\)=>_resHist\.slice\(-12\)/.test(HTML), '?dbg __resTranscript surfaces the shared resident/group thread for verification');
ok(/function npcPlayerUser\(body, ?lang\)/.test(WORKER) && /body\.last/.test(WORKER), 'the worker folds body.last into the player-chat user turn (who-labelled recent turns before the current ask)');
ok(/npcPlayerPrompt\(body\.speaker, ?lang, ?\{[\s\S]*?chime:[\s\S]*?prev:/.test(WORKER), 'the worker passes chime/prev into npcPlayerPrompt so the second speaker is told to answer + build on the previous resident');

group('resident invite-to-group (name a resident mid-chat → they walk over and join)');
ok(/const _RES_INV_CUE=\/\(부르\|부를\|불러\|초대/.test(npcBlock) && /function _resNamedIn\(q, ?excludeIds\)/.test(npcBlock), 'name+cue detection: an invite/talk CUE plus a resident name (KO name + person particle, or EN word) is required to summon anyone');
ok(/function _inviteTarget\(q\)\{ if\(!_RES_INV_CUE\.test\(String\(q\|\|''\)\)\) return null/.test(npcBlock), 'a bare name mention without an invite cue never triggers an invite (avoids false positives like a passing name)');
ok(/function _inviteResident\(res\)\{/.test(npcBlock) && /wrap\.live\.push\(L\); wrap\.members\.push\(res\)/.test(npcBlock) && /wrap\.group=true; wrap\.id='group'; wrap\.kind='resident'; wrap\.live=\[curL,L\]/.test(npcBlock), '_inviteResident adds to an open circle, or upgrades a 1:1 into a 모임 in place (preserving the open log + shared thread)');
ok(/async function _maybeInvite\(q\)\{/.test(npcBlock) && /const cap=Math\.max\(2, ?Math\.min\(NPC_CFG\.maxGroup, ?RESIDENTS_LIVE\.length\)\)/.test(npcBlock), '_maybeInvite caps the circle at NPC_CFG.maxGroup — a full circle says so instead of overflowing');
ok(/async function groupSay\(q\)\{[\s\S]*?if\(await _maybeInvite\(q\)\) return;/.test(npcBlock) && /async function residentSay\(q\)\{[\s\S]*?if\(await _maybeInvite\(q\)\) return;/.test(npcBlock), 'both groupSay and residentSay check for an invite first, so naming a resident routes to the join flow');
ok(/if\(chatBound && L\._joinWalk && !hidden && NPC_CFG\.motionEnabled\)\{[\s\S]*?_resWalk\(L,L\._joinWalk\.x,L\._joinWalk\.z,RES_MOVE\.meetSpd,dt\)/.test(npcBlock), 'an invited resident actually walks into the circle (chatBound + _joinWalk branch) instead of freezing in place');
ok(/L\._joinWalk=\{ x:cx\+Math\.cos\(a\)\*R, z:cz\+Math\.sin\(a\)\*R \}/.test(npcBlock) && /if\(d>14\) L\.group\.position\.set\(cx\+Math\.cos\(a\)\*11/.test(npcBlock), '_placeJoiner steps a far-off joiner in from ~11u (no cross-map teleport) and settles them on a ring slot beside the circle');
ok(/window\.__inviteResident=\(id\)=>/.test(HTML) && /window\.__inviteMatch=\(q\)=>/.test(HTML), '?dbg __inviteResident/__inviteMatch hooks force a join + introspect the name/cue detector');

group('a gathering waves you over (residents invite the lingering visitor)');
ok(/const NPC_INVITE_R=\(LOW_END\?7\.5:8\.5\), ?NPC_INVITE_CD=\(LOW_END\?34:26\)/.test(npcBlock), 'a circle-invite reach (NPC_INVITE_R) + a global cooldown (NPC_INVITE_CD) — tuned tighter on LOW_END so it never nags');
ok(/function _ambInvitePlayer\(C\)\{ if\(!C\|\|C\._invited\|\|C\.phase!=='talk'\) return;/.test(npcBlock) && /_ambInviteCd=clock\.elapsedTime\+NPC_INVITE_CD/.test(npcBlock), '_ambInvitePlayer fires once per gathering (talk phase only) and arms the global cooldown');
ok(/inv\.bub\.say\(_inviteHailLine\(inv\.res\), ?_hex\(inv\.res\.color\)\); inv\._gt=2\.8/.test(npcBlock), 'the nearest member calls out (speech bubble) with a friendly wave gesture — no AI, no budget spend');
ok(/nearInviteCircle=null;/.test(HTML) && /_ambConv && _ambConv\.phase==='talk' && clock\.elapsedTime>=_guestCdUntil/.test(HTML) && /Math\.hypot\(player\.position\.x-C\.center\.x, ?player\.position\.z-C\.center\.z\)<=NPC_INVITE_R/.test(HTML), 'the wave-over only triggers near a talking circle when the visitor is free (no building/hub/npc, not chatting, off the post-chat cooldown)');
ok(/!nearNpc && !nearest && !nearHub && !nearResident && !modalOpen && !sitting && !ferris && !carousel && !activeGroupMembers && !_resChatActive\(\)/.test(HTML), 'the invitation yields to every other interaction — a door, board, seat, or open chat always wins');
ok(/else if\(nearInviteCircle\)\{ openGroupChat\(nearInviteCircle\.members\.slice\(\)\); \}/.test(HTML), 'accepting the wave (Enter/💬) opens the whole circle as a group chat — reusing openGroupChat');
ok(/👋 \$\{esc\(nm\)\} 님이 불러요/.test(HTML) && /is waving you over/.test(HTML), 'the HUD prompt names who is waving you over, in KO + EN');
ok(/window\.__inviteState=\(\)=>/.test(HTML) && /window\.__hailMe=\(\)=>/.test(HTML), '?dbg __inviteState/__hailMe surface + force the wave-over for verification');

group('residents react to the city (a local remarks on the repo you walk up to)');
ok(/const RES_REACT_R=\(LOW_END\?11:14\), ?RES_REACT_CD=\(LOW_END\?22:15\)/.test(npcBlock), 'a walk-up react reach (RES_REACT_R) + per-resident cooldown (RES_REACT_CD) — a stroll past many houses never spams one local');
ok(/function _repoReactLine\(res, ?repo\)\{/.test(npcBlock) && /zoneMatch=repo\._zone && repo\._zone===res\.zone/.test(npcBlock), '_repoReactLine builds a line grounded in the repo (and knows when it sits in the local\'s own district)');
ok(/if\(repo\.archived\)/.test(npcBlock) && /if\(st>=40\)/.test(npcBlock) && /if\(vv>=200\)/.test(npcBlock) && /if\(fk>=8\)/.test(npcBlock) && /if\(recent\)/.test(npcBlock), 'the remark picks a TRUE standout of that repo — archived / stars / visitors / forks / recent activity — never invented praise');
ok(/isNight\?`\$\{nm\}는 최근에 손봤어요 — 밤에도 창이 켜져 있죠/.test(npcBlock), 'recent-activity lines carry day/night flavor (windows glow at night)');
ok(/function _residentReactToRepo\(repo\)\{ if\(!repo\|\|!repo\.repo\|\|repo\._isLibrary\|\|document\.hidden\) return;/.test(npcBlock), '_residentReactToRepo skips the library + a hidden tab, and only the nearest FREE local (not mid ambient/player chat) within reach speaks');
ok(/const score=raw-\(\(repo\._zone && repo\._zone===L\.res\.zone\)\?4:0\); if\(score<bestScore\)/.test(npcBlock), 'the district caretaker is preferred (zone-match bias) but the reach cap (raw>RES_REACT_R) is still hard');
ok(/if\(typeof _residentReactToRepo==='function'\) _residentReactToRepo\(b\);/.test(HTML), 'greetBuilding fires the reaction on first walk-up to a house (once per building, in the open world — not behind the card modal)');
ok(/window\.__reactLine=\(id,name\)=>/.test(HTML) && /window\.__resReact=\(name\)=>/.test(HTML), '?dbg __reactLine/__resReact introspect + force a resident\'s repo reaction');

group('a cosy campfire 쉼터 — residents warm up, rest, and feel at home');
ok(/function makeHearth\(x,z\)\{/.test(HTML) && /_hearth:true/.test(HTML), 'makeHearth builds the campfire + a ring of stump-seats flagged _hearth (so residents can settle at the fire)');
ok(/function placeHearth\(\)\{ const cands=\[/.test(HTML) && /_hubGap\(x,z\)>=3\.4/.test(HTML) && /^placeHearth\(\);/m.test(HTML), 'placeHearth drops the nook in a clear plaza spot (after buildings + _hubGap), and is actually called at boot');
ok(/function updateHearth\(t\)\{/.test(HTML) && /H\.light\.intensity=H\.baseInt\*nightK\*flick/.test(HTML) && /updateHearth\(clock\.elapsedTime\)/.test(HTML), 'updateHearth flickers the flames + warm light every frame; the glow swells after dark (nightK)');
ok(/H\.halo\.material\.opacity=\(isNight\?0\.62:0\.34\)\*flick/.test(HTML), 'the campfire glow ramps up at night (halo/pool opacity keyed on isNight) — cosy after dark, gentle by day');
ok(/const d=raw-\(\(isNight&&s\._hearth\)\?7:0\)/.test(npcBlock), '_freeSeat biases residents toward the warm campfire seats after dark (night-only, still distance-capped)');
ok(/const _RES_COMFORT=\{ ko:\[/.test(npcBlock) && /const _RES_HEARTH_LINES=\{ ko:\[/.test(npcBlock) && /function _resComfortLine\(L\)/.test(npcBlock), 'contented at-home murmurs exist as two banks (general + campfire-specific), self-aware they are built from data yet at home');
ok(/if\(!L\._pNear && L\._gt<=0 && tt>=\(L\._comfortCd\|\|0\)\)\{ L\._comfortCd=tt\+RES_COMFORT_CD_MIN/.test(npcBlock) && /_resComfortLine\(L\)/.test(npcBlock), 'a resting resident occasionally murmurs a comfort line (cooldown-gated, hushed when the visitor is right there)');
ok(/\?0\.85:0\.5/.test(npcBlock), 'the murmur is warmer + more likely at the campfire (0.85) than on a plain bench (0.5)');
ok(/window\.__hearth=\(\)=>/.test(HTML) && /window\.__comfort=\(id\)=>/.test(HTML) && /window\.__tpHearth=\(\)=>/.test(HTML), '?dbg __hearth/__tpHearth/__comfort surface + drive the campfire nook and comfort murmurs');

group('the town remembers you — a warmer welcome for a returning visitor');
ok(/let VISITOR = \(function\(\)\{ const KEY='repolisVisits'/.test(HTML) && /localStorage\.setItem\(KEY, ?JSON\.stringify\(v\)\)/.test(HTML), 'VISITOR is an anonymous, on-device visit tally kept only in localStorage (never sent anywhere)');
ok(/const now=Date\.now\(\), ?prevLast=v\.last, ?fresh=!prevLast \|\| \(now-prevLast\)>1800000/.test(HTML), 'a reload within 30 min counts as the same visit; only a genuine return bumps the tally');
ok(/returning:v\.n>1/.test(HTML) && /longAway:\(v\.n>1 && awayDays>=7\)/.test(HTML), 'the memory derives returning (2nd+ visit) and longAway (returning after a 7-day gap)');
ok(/if\(VISITOR\.returning && Math\.random\(\)<0\.6\)\{/.test(npcBlock) && /VISITOR\.longAway \?/.test(npcBlock), 'a returning visitor gets a warmer resident hello ~60% of the time — with an extra-warm variant after a long absence');
ok(/function _welcomeBackLine\(\)\{/.test(npcBlock) && /n>=5\?/.test(npcBlock) && /visit #\$\{n\}/.test(npcBlock), 'a one-time welcome-back toast greets a returning visitor (with a little milestone note from the 5th visit)');
ok(/const rb=VISITOR\.returning; if\(rb\)\{ setTimeout\(\(\)=>\{ try\{ showWave\(_welcomeBackLine\(\),3600\)/.test(HTML) && /}, ?rb\?4700:1000\)/.test(HTML), 'entering town shows the welcome-back toast first, and defers the daily-course banner so the two never clash');
ok(/window\.__visitor=\(\)=>/.test(HTML) && /window\.__setVisitor=\(o\)=>/.test(HTML) && /window\.__welcomeBack=\(\)=>/.test(HTML), '?dbg __visitor/__setVisitor/__welcomeBack read + preview the returning-visitor warmth without a reload');

group('graceful goodbyes — the circle waves you off, and no gathering is a trap');
ok(/const _RES_BYE_CUE=\/\(잘\\s\*가/.test(npcBlock) && /function _farewellLine\(res\)/.test(npcBlock), 'a farewell detector + warm goodbye bank back the "say bye and they wave you off" flow');
ok(/async function _maybeFarewell\(q\)\{ if\(!_RES_BYE_CUE\.test/.test(npcBlock) && /setTimeout\(\(\)=>\{ try\{ closeChat\(\); \}catch\(e\)\{\} \}, ?1500\)/.test(npcBlock), 'a goodbye makes the circle say farewell + wave, then the chat gently closes (closeChat releases the group)');
ok(/async function groupSay\(q\)\{[\s\S]*?if\(await _maybeFarewell\(q\)\) return;/.test(npcBlock) && /async function residentSay\(q\)\{[\s\S]*?if\(await _maybeFarewell\(q\)\) return;/.test(npcBlock), 'both groupSay and residentSay honour a goodbye before anything else');
ok(/function _residentLeave\(L\)\{ const wrap=activeNpc; if\(!wrap\|\|!wrap\.group\|\|!activeGroupMembers\|\|activeGroupMembers\.length<=2/.test(npcBlock), '_residentLeave never shrinks a circle below 2, and hands the lead on if the primary leaves');
ok(/if\(ms\.length>2 && \(wrap\.gi\|\|0\)>=3 && activeGroupMembers && activeGroupMembers\.length>2 && Math\.random\(\)<0\.22\)/.test(npcBlock) && /_residentLeave\(leaver\)/.test(npcBlock), 'after a few turns in a 3+ circle, a non-primary resident may excuse themselves and wander off');
ok(/L\._gt=2\.6; L\._rt=null; L\._rp=clock\.elapsedTime;/.test(npcBlock), 'a leaving resident waves, then (no longer chatBound) resumes wandering on their own');
ok(/window\.__farewell=\(q\)=>/.test(HTML) && /window\.__byeMatch=\(q\)=>/.test(HTML) && /window\.__leaveGroup=\(id\)=>/.test(HTML), '?dbg __farewell/__byeMatch/__leaveGroup drive + introspect the goodbye and member-leave flows');

console.log('\n──────────────────────────────');
console.log(fail === 0 ? '✅ ALL GREEN — ' + pass + ' checks passed' : '❌ ' + fail + ' FAILED / ' + pass + ' passed');
if (fail) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail === 0 ? 0 : 1);
