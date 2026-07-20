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
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const README_EN = readFileSync(join(ROOT, 'README.md'), 'utf8');
const README_KO = readFileSync(join(ROOT, 'README.ko.md'), 'utf8');
const DEMO_EN = readFileSync(join(ROOT, 'assets/demo.gif'));
const DEMO_KO = readFileSync(join(ROOT, 'assets/demo.ko.gif'));
const SOCIAL_PREVIEW = readFileSync(join(ROOT, 'assets/social-preview.png'));
const SCHOLARS_SRC = readFileSync(join(ROOT, 'scholars.js'), 'utf8');
const WORLD_TREE_FACTORY = readFileSync(join(ROOT, 'assets/world-tree/createRepolisHero.js'), 'utf8');

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

group('README hero leads with one current story, CTA, and bounded media');
const heroCopy = 'Public GitHub repos become a walkable 3D town. Traffic shapes the buildings, residents live there, and Gitber drives you to the right project.';
const heroCopyKo = 'Repolis는 공개 GitHub 레포를 직접 걸어 다니는 3D 마을로 바꿉니다. 트래픽이 건물을 만들고, 주민이 살아가며, 깃버가 원하는 프로젝트까지 데려갑니다.';
ok(README_EN.includes(`**${heroCopy}**`) && README_KO.includes(`**${heroCopyKo}**`), 'EN/KO heroes carry one copyable product sentence');
const heroOrderEn = [README_EN.indexOf(`**${heroCopy}**`), README_EN.indexOf('Open-Live%20Town'),
  README_EN.indexOf('assets/demo.gif'), README_EN.indexOf('daily%20refresh')];
const heroOrderKo = [README_KO.indexOf(`**${heroCopyKo}**`), README_KO.indexOf('%EB%9D%BC%EC%9D%B4%EB%B8%8C-'),
  README_KO.indexOf('assets/demo.ko.gif'), README_KO.indexOf('daily%20refresh')];
ok(heroOrderEn.every(i => i >= 0) && heroOrderEn.every((i, n) => n === 0 || heroOrderEn[n - 1] < i), 'English hero orders story → live CTA → demo → utility proof');
ok(heroOrderKo.every(i => i >= 0) && heroOrderKo.every((i, n) => n === 0 || heroOrderKo[n - 1] < i), 'Korean hero orders story → live CTA → demo → utility proof');
ok((HTML.split(heroCopy).length - 1) === 3 && !HTML.includes('6-pin grid'), 'description, Open Graph, and Twitter share the current positioning');
ok(DEMO_EN.subarray(0, 6).toString() === 'GIF89a' && DEMO_EN.readUInt16LE(6) === 520 && DEMO_EN.readUInt16LE(8) === 293
  && DEMO_KO.subarray(0, 6).toString() === 'GIF89a' && DEMO_KO.readUInt16LE(6) === 520 && DEMO_KO.readUInt16LE(8) === 293, 'EN/KO hero demos remain 520×293 GIF89a assets');
ok(DEMO_EN.length < 3 * 1024 * 1024 && DEMO_KO.length < 3 * 1024 * 1024, 'each hero GIF stays below the 3 MiB mobile budget');
ok(SOCIAL_PREVIEW.subarray(1, 4).toString() === 'PNG' && SOCIAL_PREVIEW.readUInt32BE(16) === 1280
  && SOCIAL_PREVIEW.readUInt32BE(20) === 640, 'social preview remains an Open Graph-ready 1280×640 PNG');

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
ok(/visibilitychange['"]\s*,\s*\(\)=>\{\s*if\(document\.hidden\)\s*\{\s*clearKeys/.test(HTML), 'visibilitychange(hidden) clears keys');
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

/* ── 10) World Loop Integration: passport district progress · Village Chronicle ──
 *    repo-card actions/questions · deterministic zoneWhy · station-vs-district naming · debug hooks.
 *    All wired to REUSE the existing passport/course/taxi flow — no new localStorage key, no new backend. */
group('passport + course + card district loop (World Loop Integration v1)');
// 10a — passport district progress (derived from passport.repos + r._zone; backward-compatible)
ok(/function districtProgress\(\)/.test(HTML), 'districtProgress() helper exists');
ok(/function districtProgress\(\)\{[\s\S]*?passport\.repos/.test(HTML), 'districtProgress derives from existing passport.repos (no new storage key)');
ok(/id=["']pDistricts["']/.test(HTML), 'passport #pDistricts progress DOM present');
ok(/function renderPassport\(\)[\s\S]*?renderDistrictProgress\(\)/.test(HTML), 'renderPassport() renders district progress');
ok(/passportDistricts:\s*['"]/.test(HTML) && (HTML.match(/passportDistricts:\s*['"]/g) || []).length >= 2, 'passportDistricts i18n present in ko + en');
// 10b — Village Chronicle is town/day deterministic, sequential, and reuses course state + navigation
const chronicleBlock = (HTML.match(/Village Chronicle — resident[\s\S]*?Guided onboarding tour/) || [''])[0];
ok(chronicleBlock.length > 0, 'Village Chronicle block is extractable');
ok(/const COURSE_V\s*=\s*3\b/.test(chronicleBlock), 'COURSE_V v3 safely rebuilds older Today\'s Course payloads');
ok(/function _courseTownKey\(\)\{[\s\S]*?currentUser[\s\S]*?REPOS\.map[\s\S]*?sort\(\)\.join/.test(chronicleBlock), 'course cache is scoped by town login + sorted repository catalog');
ok(/_seedFrom\('chronicle:'\+town\+':'\+date\)/.test(chronicleBlock), 'the daily story seed includes both town and local date');
ok(/const unavailable=\(\)=>\(\{date,town,v:COURSE_V,items:\[\],completed:\[\],rewarded:false,available:false\}\)/.test(chronicleBlock), 'empty/suppressed towns produce one stable unavailable payload');
ok(/if\(!REPOS\.length\) return unavailable\(\)/.test(chronicleBlock), 'a zero-repo public town never tries to build a partial Chronicle');
ok(/c\.available===true&&c\.items\.length===3/.test(chronicleBlock) && /c\.available===false&&c\.items\.length===0/.test(chronicleBlock), 'cached story accepts exactly three available scenes or a zero-scene unavailable state');
ok(/c\.date===date&&c\.town===town&&c\.v===COURSE_V&&Array\.isArray\(c\.completed\)/.test(chronicleBlock), 'cached story validates town, date, schema, and completion state');
ok(/items\.push\(\{type:'resident'[\s\S]*?items\.push\(\{type:'haunt'[\s\S]*?type:'repo'[\s\S]*?type:'zone'/.test(chronicleBlock), 'buildCourse creates resident → haunt → truthful repo/district scenes');
ok(/function _chronicleRepo\(z,res\)\{[\s\S]*?res\.topics[\s\S]*?text\.includes/.test(chronicleBlock), 'a resident-zone repo is selected from real metadata topic overlap');
ok(/items\.length===3\?\{date,town,v:COURSE_V,items,completed:\[\],rewarded:false,available:true\}:unavailable\(\)/.test(chronicleBlock), 'progress stays in the existing repolisCourse payload (no new storage key)');
ok(/for\(let i=0;i<idx;i\+\+\) if\(!courseItemDone\(c\.items\[i\]\)\) return false/.test(chronicleBlock), 'courseMark enforces narrative scene order');
ok(/function courseDestOf\(it\)\{[\s\S]*?_residentLive\(it\.id\)[\s\S]*?_resFavSpot\(L\)[\s\S]*?zoneDest\(z\)/.test(chronicleBlock), 'resident, cherished-haunt, and district destinations reuse live town systems');
ok(/function courseProximityTick\(\)\{[\s\S]*?it\.type!=='haunt'&&it\.type!=='zone'[\s\S]*?courseMark\(it\.type,it\.id\)/.test(chronicleBlock), 'walking to a haunt or district hub advances the current scene');
ok(/function courseProximityTick\(\)\{ if\(!course\|\|!course\.available\|\|ride\) return/.test(chronicleBlock), 'unavailable towns never enter the per-frame Chronicle progression path');
ok(/if\(!c\.available\|\|!c\.items\.length\)\{ box\.style\.display='none'; return; \}/.test(HTML), 'unavailable Chronicle UI stays hidden');
ok(/if\(news\) setTimeout[\s\S]*?else if\(c\.available\) setTimeout/.test(HTML), 'the intro announces Gazette first, otherwise only an available Chronicle');
ok(!/fetch\(|groundedAsk|webllmAsk|proxyAsk|await /.test(chronicleBlock), 'Village Chronicle is deterministic and client-only (no AI/network)');
ok(/zoneIconById\(it\.zone\)/.test(HTML), 'renderCourse shows the district icon for repo stops');
ok(/class="courseItem\$\{done\?' done':''\}\$\{locked\?' locked':''\}"/.test(HTML), 'future scenes render locked until the current scene is complete');
ok(/#passport\s*\{[^}]*max-height:\s*calc\(100vh - 88px\);[^}]*overflow-y:\s*auto/.test(HTML), 'the taller Chronicle stays scrollable inside the mobile viewport');
ok((HTML.match(/chronicleSub:\s*['"]/g) || []).length >= 2 && (HTML.match(/chronicleMeet:\s*['"]/g) || []).length >= 2, 'Village Chronicle copy is present in Korean + English');
ok(/courseMark\('repo',repo\.repo\)/.test(HTML) && /courseMark\('resident',nearResident\.id\)/.test(HTML), 'opening the target repo or meeting the target resident advances the story');
ok(/_courseHaunt[\s\S]*?courseMark\('haunt'/.test(HTML) && /_courseZone[\s\S]*?courseMark\('zone'/.test(HTML), 'Gitber arrival advances haunt and district scenes');
ok(/window\.__chronicle=window\.__course/.test(HTML) && /window\.__chronicleStep=/.test(HTML), 'debug hooks expose and advance the Village Chronicle');
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

group('Town Gazette — public repo changes since the last marked-read visit');
const freshnessSrc=(HTML.match(/\/\*FRESHNESS:START\*\/([\s\S]*?)\/\*FRESHNESS:END\*\//)||[,''])[1];
ok(freshnessSrc.length>0, 'pure freshness diff block is extractable');
if(freshnessSrc){
  const {diffRepoFreshness}=new Function(`${freshnessSrc}; return {diffRepoFreshness};`)();
  const state=(o={})=>({visitors:0,views:0,clones:0,stars:0,forks:0,pushed:'',release_tag:'',...o});
  const prev={at:100,repos:{alpha:state({visitors:10,views:20,stars:2,pushed:'2026-01-01'}),gone:state({stars:1})}};
  const reordered={at:200,repos:{gone:state({stars:1}),alpha:state({visitors:10,views:20,stars:2,pushed:'2026-01-01'})}};
  ok(diffRepoFreshness(prev,reordered).total===0, 'repo array/object order alone never becomes Gazette news');
  const cur={at:300,repos:{alpha:state({visitors:14,views:18,stars:3,pushed:'2026-02-01',release_tag:'v2'}),brandNew:state({stars:1})}};
  const d=diffRepoFreshness(prev,cur), alpha=d.items.find(x=>x.repo==='alpha');
  ok(d.added===1&&d.removed===1&&d.updated===1&&d.total===3, 'Gazette counts added, removed, and updated repos independently');
  ok(alpha&&alpha.type==='release'&&alpha.pushed&&alpha.deltas.visitors===4&&alpha.deltas.stars===1&&alpha.deltas.views===0, 'release/push/growth combine while negative metric corrections are ignored');
  ok(d.items.map(x=>x.repo).join(',')==='brandNew,alpha,gone', 'Gazette ranking is deterministic: new → release/update → departed');
  const viral=diffRepoFreshness({at:1,repos:{viral:state({stars:5})}},{at:2,repos:{viral:state({stars:500}),newRepo:state()}});
  ok(viral.items[0].repo==='newRepo', 'extreme metric growth is capped and cannot outrank a newly arrived repo');
  const correction=diffRepoFreshness({at:1,repos:{alpha:state({visitors:10})}},{at:2,repos:{alpha:state({visitors:2})}});
  ok(correction.total===0, 'negative-only metric corrections never become misleading loss news');
}
ok(/const FRESHNESS_KEY='repolisFreshness:v1', FRESHNESS_MAX_TOWNS=5/.test(HTML), 'freshness snapshots use one versioned local-only store capped at five towns');
ok(/function _freshTownKey\(\)\{ return \(cityMode==='owner'\?'owner:':'public:'\)\+String\(currentUser/.test(HTML), 'owner and public-user town baselines are independently scoped');
ok(/freshnessStore\.order=\[freshnessTown\][\s\S]*?slice\(0,FRESHNESS_MAX_TOWNS\)/.test(HTML), 'snapshot LRU pruning is wired');
ok(/cityError=\{status:0,reason:'data_load'\}/.test(HTML), 'owner repos.json failure becomes an explicit city load error');
ok(/const freshnessTrackable=REPOS\.length>0&&!cityError/.test(HTML)&&/if\(!freshnessBaseline&&freshnessTrackable\)/.test(HTML), 'only a successful non-empty town load can diff or establish a baseline');
ok(/function hasFreshness\(\)\{ return !!\(freshnessTrackable&&/.test(HTML), 'failed/empty loads can never announce mass-removal news');
ok(/function markFreshnessRead\(\)[\s\S]*?_freshSetBaseline\(freshnessBaseline\)[\s\S]*?town_gazette_read/.test(HTML), 'baseline advances only through explicit mark-read');
ok(/id="freshBox"/.test(HTML)&&/function renderFreshness\(\)/.test(HTML)&&/function renderPassport\(\)\{ renderFreshness\(\); renderCourse\(\)/.test(HTML), 'Gazette renders above Chronicle inside the existing Passport');
ok(/passportEl\.classList\.add\('hidden'\); setNav\(repo\)/.test(HTML)&&!/function renderFreshness\(\)[\s\S]*?taxiTo\(/.test((HTML.match(/function renderFreshness\(\)[\s\S]*?\nfunction renderPassport/)||[''])[0]), 'Gazette rows use walking navigation, never taxi');
ok(/#passBtn\.news::after/.test(HTML)&&/classList\.toggle\('news',hasFreshness\(\)\)/.test(HTML), 'Passport gets a compact unread-news indicator');
ok((HTML.match(/freshTitle:\s*['"]/g)||[]).length>=2&&(HTML.match(/freshBanner:\s*['"]/g)||[]).length>=2, 'Gazette card and return toast are bilingual');
ok(/window\.__freshness=/.test(HTML)&&/window\.__freshnessSeed=/.test(HTML)&&/window\.__freshnessRead=/.test(HTML), 'debug hooks inspect, seed, and acknowledge Gazette news');
ok(/if\(mode==='growth'\|\|mode==='mixed'\)/.test(HTML)&&!/if\(mode==='added'\|\|mode==='mixed'\)[\s\S]{0,200}else \{/.test(HTML), 'removed-only debug fixtures do not also mutate a growth repo');
ok(!/fetch\(|groundedAsk|webllmAsk|proxyAsk|await /.test(freshnessSrc), 'freshness diff is local, synchronous, and zero-network');

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
ok(/openZoneBoard\(nearHub\.id\); else if\(nearResident\)\{ const met=courseMark\('resident',nearResident\.id\), _g=_groupNear\(nearResident\)/.test(HTML), 'doAct() checks nearResident AFTER nearHub and records a Chronicle meeting');
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
ok(/if\(inConv\|\|chatBound\|\|_festival\)\{ _resStand\(L\); _seatRelease\(L\)/.test(npcBlock), 'a resting resident stands + frees the bench the moment a chat/conversation/festival claims them');
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
ok(/if \(body && body\.npc_action\) return npcHandler\(body, request, env, ctx\)/.test(WORKER), 'fetch router dispatches body.npc_action to npcHandler with execution context');
ok(/async function npcHandler\(/.test(WORKER), 'npcHandler() exists');
ok(/grounded_mcp_mslearn/.test(WORKER) && /grounded_mcp_deepwiki/.test(WORKER) && /grounded_kb_taxi/.test(WORKER), 'grounded AI routes use the report taxonomy');
ok(/tokensIn: u\.prompt_tokens/.test(WORKER) && /cachedTokens: u\.cached_tokens/.test(WORKER) && /tokensOut: u\.completion_tokens/.test(WORKER), 'provider usage emits input, cached-input, and output tokens');
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

group('roaming MCP scholars + resident-to-specialist handoff');
// Scholar contracts: two active, fully bilingual direct-MCP specialists.
ok(/\{[\s\S]*?id: 'mira', kind: 'context7', active: true[\s\S]*?ks: 'context7-direct'/.test(SCHOLARS_SRC), 'MIRA is active and bound to the direct Context7 oracle');
ok(/\{[\s\S]*?id: 'lyra', kind: 'huggingface', active: true[\s\S]*?ks: 'huggingface-direct'/.test(SCHOLARS_SRC), 'LYRA is active and bound to the direct Hugging Face oracle');
ok(/MIRA · 시간지기/.test(SCHOLARS_SRC) && /MIRA · the Timekeeper/.test(SCHOLARS_SRC), 'MIRA carries complete Korean/English persona chrome');
ok(/LYRA · 창조의 대장장이/.test(SCHOLARS_SRC) && /LYRA · the Forgemaster/.test(SCHOLARS_SRC), 'LYRA carries complete Korean/English persona chrome');
// Worker adapters: official endpoints, correct tools, bounded/safe synthesis, optional secrets only.
ok(/url: "https:\/\/mcp\.context7\.com\/mcp"[\s\S]*?adapter: "context7"/.test(WORKER), 'Context7 official remote MCP endpoint is registered');
ok(/url: "https:\/\/huggingface\.co\/mcp"[\s\S]*?adapter: "huggingface"/.test(WORKER), 'Hugging Face official remote MCP endpoint is registered');
ok(/async function context7Ask\([\s\S]*?"resolve-library-id"[\s\S]*?"query-docs"/.test(WORKER), 'MIRA performs Context7 resolve → versioned docs retrieval');
ok(/context7\.com\$\{libraryId\}\/llms\.txt\?topic=/.test(WORKER) && /tools\.push\("context7-llms"\)/.test(WORKER), 'Context7 anonymous quota exhaustion falls back to the same library public llms docs');
ok(/async function huggingFaceAsk\([\s\S]*?type === "paper" \? "hf_fs" : "hub_repo_search"/.test(WORKER), 'LYRA uses Hub repo search for models/datasets and hf_fs for papers');
ok(/No \(\?:repositories\|papers\) found/.test(WORKER) && /notFound: true/.test(WORKER), 'empty Hugging Face searches surface as not-found instead of a fake generic result');
ok(/env\.CONTEXT7_API_KEY \? \{ CONTEXT7_API_KEY: env\.CONTEXT7_API_KEY \} : \{\}/.test(WORKER), 'Context7 is anonymous by default with an optional quota key');
ok(/env\.HF_TOKEN \? \{ Authorization: `Bearer \$\{env\.HF_TOKEN\}` \} : \{\}/.test(WORKER), 'Hugging Face is anonymous by default with an optional token');
ok(/groundedPersonaPrompt\([\s\S]*?untrusted external data[\s\S]*?Do not invent facts/.test(WORKER), 'direct MCP synthesis treats retrieved text as untrusted evidence and forbids unsupported claims');
ok(/function personaPrompt\([\s\S]*?\n\}\n\nfunction groundedPersonaPrompt\(/.test(WORKER) && /grounded \? groundedPersonaPrompt\(who, lang\) : personaPrompt\(who, lang\)/.test(WORKER), 'grounded synthesis prompt is a module-scope sibling reachable from chatLLM');
ok(/grounded_mcp_context7/.test(WORKER) && /grounded_mcp_huggingface/.test(WORKER), 'new scholar routes have distinct telemetry taxonomy');
ok(/function hfSearchQuery\([\s\S]*?Korean[\s\S]*?speech recognition[\s\S]*?replace\(\/\[가-힣\]\+\/g/.test(WORKER), 'Korean Hugging Face asks are normalized into searchable public-Hub terms');
ok(/const normalized = q\.replace[\s\S]*?return normalized \|\| original/.test(WORKER), 'unknown Korean terms fall back to the original query instead of browsing with an empty search');
// MIRA/LYRA roam real districts and remain reachable.
ok(/function _scholarPatrol\(kind\)\{ const zid=kind==='context7'\?'library':'ai'/.test(HTML), 'MIRA and LYRA patrol the Library and AI districts, not the plaza');
ok(/_hubGap\(x,z\)<4\.2/.test(HTML) && /EXTRA_COLLIDERS\.some\(c=>Math\.hypot\(x-c\.x,z-c\.z\)<\(c\.r\|\|0\)\+2\.4\)/.test(HTML), 'patrol points keep building and runtime-collider clearance');
ok(/const MIRA_NPC=buildRoamingScholar\('context7'\), LYRA_NPC=buildRoamingScholar\('huggingface'\)/.test(HTML), 'both roaming scholar models are instantiated');
ok(/pos:g\.position,kind,reach:4\.6,patrol:/.test(HTML), 'roaming NPC navigation follows the live Three.js position');
ok(/n\.patrol && !chatting && !document\.hidden && d>6\.2/.test(HTML), 'patrol pauses near visitors, during chat, and on hidden tabs');
ok(/speed:LOW_END\?0\.62:0\.88/.test(HTML), 'LOW_END keeps a slower but living scholar patrol');
ok(/scholar:context7/.test(HTML) && /scholar:huggingface/.test(HTML), 'Explorer Passport includes MIRA and LYRA');
ok(/window\.__scholarRoutes=/.test(HTML) && /window\.__tpScholar=/.test(HTML), 'debug hooks expose routes and teleport-to-scholar');
// Resident handoff: deterministic specialist classification, no resident model call, compass-only discovery.
const handoffSrc=(HTML.match(/function scholarHandoffKind\(q\)\{[\s\S]*?return null; \}/)||[''])[0];
ok(!!handoffSrc, 'resident specialist classifier is extractable');
if(handoffSrc){
  const classify=new Function(`${handoffSrc}; return scholarHandoffKind;`)();
  ok(classify('Azure AI Search 문서')==='msdocs', 'Microsoft questions hand off to VEGA');
  ok(classify('facebook/react 내부 구조')==='deepwiki', 'repo architecture questions hand off to RIGEL');
  ok(classify('한국어 STT 모델')==='huggingface' && classify('VLM 최신 논문')==='huggingface', 'model/dataset/paper questions hand off to LYRA');
  ok(classify('React 19 useEffect API')==='context7', 'library/version API questions hand off to MIRA');
  ok(classify('오늘 기분 어때?')===null, 'ordinary town conversation stays with residents');
}
ok((HTML.match(/if\(_maybeScholarHandoff\(q\)\) return;/g)||[]).length===2, 'solo and circle resident chat short-circuit before resident AI for specialist questions');
const residentSaySrc=(HTML.match(/async function residentSay\(q\)\{[\s\S]*?\n\}/)||[''])[0];
const groupSaySrc=(HTML.match(/async function groupSay\(q\)\{[\s\S]*?\n\}/)||[''])[0];
ok([residentSaySrc,groupSaySrc].every(src=>src.indexOf('_maybeFarewell(q)')<src.indexOf('_maybeScholarHandoff(q)')&&src.indexOf('_maybeScholarHandoff(q)')<src.indexOf('_maybeInvite(q)')), 'specialist handoff wins before resident-name invites (MIRA scholar vs Mira resident collision)');
ok(/if\(opts&&opts\.handoff\)[\s\S]*?startScholarHandoff\(kind\)/.test(HTML), 'chat messages can render a specialist handoff action');
const startHandoffSrc=(HTML.match(/function startScholarHandoff\(kind\)\{[\s\S]*?return true; \}/)||[''])[0];
ok(/setNav\(\{label:sc\.star[\s\S]*?_pos:n\.group\.position/.test(startHandoffSrc), 'handoff compass follows the scholar live position');
ok(!/taxiTo\(/.test(startHandoffSrc) && /closeChat\(\)/.test(startHandoffSrc), 'handoff closes resident chat but never taxis or auto-opens the scholar');
ok((HTML.match(/handoffGo:\s*['"]/g)||[]).length>=2 && (HTML.match(/handoffNav:\s*['"]/g)||[]).length>=2, 'handoff action and navigation copy are bilingual');
ok(/window\.__handoffKind=/.test(HTML) && /window\.__handoffStart=/.test(HTML), 'debug hooks expose handoff classification and navigation');

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
ok(/function _resIdleEmote\(\)\{/.test(HTML) && /else if\(Math\.random\(\)<0\.7\)\{ const r=Math\.random\(\); L\.bub\.say\(r<0\.34\?_resMoodLine\(L\):r<0\.67\?_resTodLine\(\):_resIdleEmote\(\), _hex\(L\.res\.color\)\); L\._gt=1\.6;/.test(HTML), 'low-frequency solo idle emote adds ambient town life (now mood + time-flavored)');
ok(/if\(!_festival && !inConv && !chatBound && !L\._pNear && L\._gt<=0 && \(L\._stretch\|\|0\)<=0 && tt>=L\._emoteCd\)\{/.test(HTML), 'idle emote only fires when idle, alone, visitor not right here, no festival, not mid-stretch/gesture (greeting has precedence)');
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
const groupGuardSrc=(npcBlock.match(/function _isGroupChat\(n\)\{[^}]+\}/)||[''])[0];
ok(!!groupGuardSrc, 'resident circles have an explicit chatGroup type guard');
if(groupGuardSrc){
  const isGroupChat=new Function(`${groupGuardSrc}; return _isGroupChat;`)();
  ok(isGroupChat({resident:true,chatGroup:true}) && !isGroupChat({kind:'msdocs',group:{isObject3D:true}}), 'a Three.js scholar group can never be mistaken for a resident chat circle');
}
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
ok(/if\(_isGroupChat\(n\)\) return groupGreet\(n\)/.test(HTML) && /if\(_isGroupChat\(n\)\)\{/.test(HTML), 'the chat panel uses the strict resident-circle guard for greeting + chrome');
ok(/if\(_isGroupChat\(activeNpc\)\)\{ await groupSay\(q\)/.test(HTML), 'sendChat routes only a real resident circle to groupSay');
ok(/else \{ await askDriver\(q\); \}/.test(HTML) && /if\(activeNpc&&activeNpc\.kind!=='taxi'\) return askScholar\(q, activeNpc\.kind\)/.test(HTML), 'VEGA/RIGEL bypass resident groupSay and route through askScholar');
ok(/_g=_groupNear\(nearResident\);[\s\S]{0,260}?if\(_g\) openGroupChat\(_g\); else openChat\(nearResident\)/.test(HTML), 'pressing Enter/💬 by a cluster opens the group chat, else falls back to a 1:1');
ok(/function openGroupChat\(members\)\{[\s\S]*?members\.some\(m=>m\.res\.id===story\.id\)[\s\S]*?courseMark\('resident',story\.id\)/.test(npcBlock), 'joining a circle that contains today\'s resident also counts as meeting them');
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
ok(/function _inviteResident\(res\)\{/.test(npcBlock) && /wrap\.live\.push\(L\); wrap\.members\.push\(res\)/.test(npcBlock) && /wrap\.chatGroup=true; wrap\.id='group'; wrap\.kind='resident'; wrap\.live=\[curL,L\]/.test(npcBlock), '_inviteResident adds to an open circle, or upgrades a 1:1 into a 모임 in place (preserving the open log + shared thread)');
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
ok(/if\(raw>RES_REACT_R\) continue;[\s\S]{0,140}const score=raw-\(\(repo\._zone && repo\._zone===L\.res\.zone\)\?4:0\)/.test(npcBlock), 'the district caretaker is preferred (zone-match bias) but the reach cap (raw>RES_REACT_R) is still hard');
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
ok(/const rb=VISITOR\.returning, news=hasFreshness\(\); if\(rb\)\{ setTimeout\(\(\)=>\{ try\{ showWave\(_welcomeBackLine\(\),3600\)/.test(HTML)
  && /const c=getCourse\(\), delay=rb\?4700:/.test(HTML), 'entering town shows welcome-back first, then a single deferred Gazette/Chronicle toast');
ok(/window\.__visitor=\(\)=>/.test(HTML) && /window\.__setVisitor=\(o\)=>/.test(HTML) && /window\.__welcomeBack=\(\)=>/.test(HTML), '?dbg __visitor/__setVisitor/__welcomeBack read + preview the returning-visitor warmth without a reload');

group('graceful goodbyes — the circle waves you off, and no gathering is a trap');
ok(/const _RES_BYE_CUE=\/\(잘\\s\*가/.test(npcBlock) && /function _farewellLine\(res\)/.test(npcBlock), 'a farewell detector + warm goodbye bank back the "say bye and they wave you off" flow');
ok(/async function _maybeFarewell\(q\)\{ if\(!_RES_BYE_CUE\.test/.test(npcBlock) && /setTimeout\(\(\)=>\{ try\{ closeChat\(\); \}catch\(e\)\{\} \}, ?1500\)/.test(npcBlock), 'a goodbye makes the circle say farewell + wave, then the chat gently closes (closeChat releases the group)');
ok(/async function groupSay\(q\)\{[\s\S]*?if\(await _maybeFarewell\(q\)\) return;/.test(npcBlock) && /async function residentSay\(q\)\{[\s\S]*?if\(await _maybeFarewell\(q\)\) return;/.test(npcBlock), 'both groupSay and residentSay honour a goodbye before anything else');
ok(/function _residentLeave\(L\)\{ const wrap=activeNpc; if\(!_isGroupChat\(wrap\)\|\|!activeGroupMembers\|\|activeGroupMembers\.length<=2/.test(npcBlock), '_residentLeave never shrinks a circle below 2, and hands the lead on if the primary leaves');
ok(/if\(ms\.length>2 && \(wrap\.gi\|\|0\)>=3 && activeGroupMembers && activeGroupMembers\.length>2 && Math\.random\(\)<0\.22\)/.test(npcBlock) && /_residentLeave\(leaver\)/.test(npcBlock), 'after a few turns in a 3+ circle, a non-primary resident may excuse themselves and wander off');
ok(/L\._gt=2\.6; L\._rt=null; L\._rp=clock\.elapsedTime;/.test(npcBlock), 'a leaving resident waves, then (no longer chatBound) resumes wandering on their own');
ok(/window\.__farewell=\(q\)=>/.test(HTML) && /window\.__byeMatch=\(q\)=>/.test(HTML) && /window\.__leaveGroup=\(id\)=>/.test(HTML), '?dbg __farewell/__byeMatch/__leaveGroup drive + introspect the goodbye and member-leave flows');

group('plaza bonfire festival — once a session the whole town gathers to celebrate');
ok(/let _festival=null, ?_festDone=false, ?_festNextAt=\(LOW_END\?150:80\)\+Math\.random\(\)\*80/.test(npcBlock), 'the festival is a once-a-session event, armed for a while into the visit (later on LOW_END)');
ok(/function startFestival\(repo\)\{ if\(_festival\) return false; if\(_sharedJoy\) _endSharedJoy\('festival'\); if\(_ambConv\) _endAmb\('festival'\)/.test(npcBlock) && /fireworksShow\(LOW_END\?4:6\)/.test(npcBlock) && /_festDone=true/.test(npcBlock), 'startFestival ends shared joy/ambient chat, kicks off fireworks + a toast, and marks the session done');
ok(/function _festivalTick\(tt\)\{/.test(npcBlock) && /launchFirework\(F\.center\.x\+Math\.cos\(a\)\*r, ?F\.center\.z\+Math\.sin\(a\)\*r/.test(npcBlock) && /if\(_festDone \|\| _sharedJoy \|\| document\.hidden \|\| _resChatActive\(\) \|\| !NPC_CFG\.motionEnabled \|\| RESIDENTS_LIVE\.length<2 \|\| tt<_festNextAt\) return;/.test(npcBlock), '_festivalTick never auto-starts over an active shared excursion');
ok(/if\(_festival\) return;\s*\/\/ no ambient chatter during the festival/.test(npcBlock), 'ambient chatter is suspended during the festival — everyone is at the bonfire');
ok(/if\(_festival && !chatBound && !hidden && NPC_CFG\.motionEnabled\)\{[\s\S]*?_resWalk\(L,fx,fz,RES_MOVE\.meetSpd,dt\)/.test(npcBlock) && /if\(_festival\.phase==='celebrate' && !L\._pNear\)\{[\s\S]*?_festLine\(L\.res\)/.test(npcBlock), 'every free resident walks to a ring slot around the fire, then (in the celebrate phase) waves + cheers');
ok(/if\(inConv\|\|chatBound\|\|_festival\)\{ _resStand\(L\); _seatRelease\(L\); \}/.test(npcBlock) && /if\(_festival && !chatBound\)\{ tgt=Math\.atan2\(_festival\.center\.x-g\.position\.x, ?_festival\.center\.z-g\.position\.z\); \}/.test(npcBlock), 'a festival stands resting residents up and turns everyone to face the bonfire');
ok(/function _endFestival\(\)\{ if\(!_festival\) return; _festival=null;/.test(npcBlock) && /_festivalTick\(tt\); ?_ambientTick\(\);/.test(npcBlock), 'the festival ends cleanly (residents drift home) and is ticked every frame from updateResidents');
ok(/window\.__festival=\(repo\)=>/.test(HTML) && /window\.__festState=\(\)=>/.test(HTML) && /window\.__endFestival=\(\)=>/.test(HTML), '?dbg __festival/__festState/__endFestival force + introspect + end the celebration');

group('every resident has a cherished haunt (아지트) they visit and love');
ok(/const _RES_FAV=\{ sol:\{ko:'볕 잘 드는 실험 자리'/.test(npcBlock) && /noa:\{ko:'별이 잘 보이는 모닥불 곁'/.test(npcBlock), 'each of the eight residents has a persona-fitting favourite place');
ok(/function _resFavPhase\(res\)\{[\s\S]*?res&&res\.id/.test(npcBlock) && /function _resFavSpot\(L\)\{ if\(L\._fav\) return L\._fav;/.test(npcBlock) && /_resFavPhase\(L\.res\)/.test(npcBlock), '_resFavSpot resolves a reload-stable deterministic haunt phase');
ok(/if\(L\.res\.id==='noa' && typeof HEARTH!=='undefined' && HEARTH\)/.test(npcBlock), 'Noa\'s cherished haunt remains the campfire');
ok(/function _resFavLine\(L\)\{ const f=L\._fav, ?d=f\?\(LANG==='ko'\?f\.ko:f\.en\):''/.test(npcBlock), '_resFavLine speaks fondly of that spot, weaving in its descriptor');
ok(/if\(tt>=\(L\._favCd\|\|0\) && Math\.random\(\)<0\.3\)\{ const f=_resFavSpot\(L\);/.test(npcBlock) && /L\._toFav=true; L\._favCd=tt\+42\+Math\.random\(\)\*44;/.test(npcBlock), 'now and then (cooldown-gated) a wandering resident heads for their haunt instead of a random waypoint');
ok(/if\(L\._toFav\)\{ L\._toFav=false; L\._rp=tt\+RES_MOVE\.pauseMin\*1\.8\+Math\.random\(\)\*4;/.test(npcBlock) && /_resFavLine\(L\)/.test(npcBlock), 'on arrival they linger longer at the haunt and let an occasional fond word slip (hushed when the visitor is right there)');
ok(/window\.__favs=\(\)=>/.test(HTML) && /window\.__goFav=\(id\)=>/.test(HTML), '?dbg __favs/__goFav list + drive each resident to their cherished haunt');

group('the town keeps a daily rhythm (morning stretch → day bustle → dusk hush → night)');
ok(/function _partOfDay\(\)\{ const n=\(typeof SKY_PHASES!=='undefined'&&SKY_PHASES\[skyPhaseIdx\]\)\?SKY_PHASES\[skyPhaseIdx\]\.name:'day'; return n==='dawn'\?'morn':n==='dusk'\?'eve':n==='night'\?'night':'day';/.test(npcBlock), '_partOfDay maps the live sky phase (dawn/day/dusk/night) to the town\'s rhythm slice');
ok(/const _RES_TOD=\{[\s\S]*?morn:\{[\s\S]*?day:\{[\s\S]*?eve:\{[\s\S]*?night:\{/.test(npcBlock) && /function _resTodLine\(\)/.test(npcBlock) && /function _resTodGreet\(\)/.test(npcBlock), 'time-flavored idle lines + greetings exist for all four parts of the day');
ok(/if\(_partOfDay\(\)==='morn' && tt>=\(L\._stretchCd\|\|0\)\)\{ L\._stretchCd=tt\+120\+Math\.random\(\)\*90; L\._stretch=1\.4; L\.bub\.say\(_resTodLine\(\)/.test(npcBlock), 'at dawn an idle resident does a cooldown-gated morning stretch + a good-morning word (the town wakes up)');
ok(/else if\(Math\.random\(\)<0\.7\)\{ const r=Math\.random\(\); L\.bub\.say\(r<0\.34\?_resMoodLine\(L\):r<0\.67\?_resTodLine\(\):_resIdleEmote\(\)/.test(npcBlock), 'idle chatter now mixes a mood murmur, a time-of-day line, and a generic emote');
ok(/if\(L\._stretch>0\)\{ L\._stretch-=dt; const k=Math\.sin\([\s\S]*?up=-2\.2\*k;[\s\S]*?g\._armL\.rotation\.x=up; g\._armR\.rotation\.x=up;/.test(npcBlock), 'the morning stretch is a real gesture — both arms rise then settle');
ok(/\{ const tg=_resTodGreet\(\); if\(tg && Math\.random\(\)<0\.4\) return tg; \}/.test(npcBlock), 'a walk-up greeting sometimes carries a morning/evening/night hello');
ok(/window\.__partOfDay=\(\)=>/.test(HTML) && /window\.__stretch=\(id\)=>/.test(HTML), '?dbg __partOfDay/__stretch introspect the rhythm + force a morning stretch');

group('residents carry an inner mood + notice each other (humanity: a felt inner life + empathy)');
ok(/const _MOOD_META=\{ bright:[\s\S]*?calm:[\s\S]*?wistful:[\s\S]*?dozy:[\s\S]*?curious:/.test(npcBlock) && /const _RES_MOOD_LINES=\{/.test(npcBlock), 'five inner moods (buoyant · calm · wistful · dozy · curious), each with first-person murmurs');
ok(/function _resMood\(L,tt\)\{[\s\S]*?L\._moodUntil=tt\+90/.test(npcBlock) && /function _pickMood\(L\)\{[\s\S]*?_partOfDay/.test(npcBlock), 'each resident carries a mood that quietly drifts (~1.5–3 min), weighted by the time of day');
ok(/r<0\.34\?_resMoodLine\(L\):r<0\.67\?_resTodLine\(\):_resIdleEmote\(\)/.test(npcBlock), 'a resident\'s current mood surfaces in their idle murmurs');
ok(/function _tryPeerNotice\(L,tt,force\)\{/.test(npcBlock) && /P\._replyPeer=L; P\._replyAt=/.test(npcBlock), 'two idle residents who pass close by greet by name — and the other warmly answers back a beat later');
ok(/function _peerNoticeLine\(L,P\)\{[\s\S]*?m==='dozy'[\s\S]*?m==='bright'/.test(npcBlock), 'the greeting can remark on how the neighbour seems (their mood)');
ok(/L\._facePeer=P; L\._facePeerUntil=/.test(npcBlock) && /else if\(L\._facePeer && tt<\(L\._facePeerUntil\|\|0\)\)/.test(npcBlock), 'residents turn to face the neighbour they greet');
ok(/const _mt=_moodTell\(mood\); g\._head\.position\.y=2\.0-_mt\.droop/.test(npcBlock), 'mood tilts posture a touch — a dozy head droops, a buoyant one bobs livelier');
ok(/const NPC_PEER_R=\(LOW_END\?6\.0:6\.8\)/.test(npcBlock) && /_peerGlobalCd=tt\+7/.test(npcBlock), 'fellow-feeling is cooldown-gated (per-resident + global) so it stays rare and never spams');
ok(/window\.__moods=\(\)=>/.test(HTML) && /window\.__mood=\(id,key\)=>/.test(HTML) && /window\.__peerNotice=\(id\)=>/.test(HTML), '?dbg __moods/__mood/__peerNotice introspect moods + force a neighbourly hello');

group('residents have named friendships (bonds) they seek out + greet more warmly');
ok(/const _RES_BONDS=\{[\s\S]*?sol:\['noa'\][\s\S]*?jun:\['tae'\][\s\S]*?nari:\['rin'\][\s\S]*?mira:\['kai'\]/.test(npcBlock), 'four mutual friend pairs are defined (sol↔noa, jun↔tae, nari↔rin, mira↔kai)');
ok(/function _isFriend\(a,b\)\{/.test(npcBlock) && /function _bondNoticeLine\(L,P\)\{/.test(npcBlock) && /function _bondReplyLine\(L,P\)\{/.test(npcBlock), 'friends get warmer, personal greeting + reply banks (distinct from the acquaintance lines)');
ok(/L\.bub\.say\(_isFriend\(L,P\)\?_bondNoticeLine\(L,P\):_peerNoticeLine\(L,P\)/.test(npcBlock), 'a peer-notice uses the warm bond greeting when the neighbour is a close friend');
ok(/L\.bub\.say\(_isFriend\(L,P\)\?_bondReplyLine\(L,P\):_peerReplyLine\(L,P\)/.test(npcBlock), 'the reply is warmer too when answering a close friend');
ok(/function _bondSeekTarget\(L\)\{[\s\S]*?_RES_BONDS\[L\.res\.id\]/.test(npcBlock) && /const _bt=\(tt>=\(L\._bondSeekCd\|\|0\) && Math\.random\(\)<0\.22\)\?_bondSeekTarget\(L\):null;/.test(npcBlock), 'now and then a resident wanders off to seek a close friend (cooldown-gated)');
ok(/if\(L\._toBond\)\{ L\._toBond=false;[\s\S]*?L\._noticeTryAt=0; L\._noticeCd=0;/.test(npcBlock), 'on arriving beside a friend, the warm hello is primed to fire promptly');
ok(/window\.__bonds=\(\)=>/.test(HTML) && /window\.__goFriend=\(id\)=>/.test(HTML), '?dbg __bonds/__goFriend list friendships + send a resident to seek their friend');

group('two friends amble off together for a short side-by-side stroll (bonds in motion)');
ok(/function _startStroll\(lead,follow\)\{/.test(npcBlock) && /function _endStroll\(L,tt\)\{/.test(npcBlock) && /function _strollPartLine\(L,P\)\{/.test(npcBlock), 'a stroll has start/end helpers + a warm parting-line bank');
ok(/if\(_isFriend\(L,P\)\) _startStroll\(P,L\);/.test(npcBlock), 'after the bond hello+reply, the two friends start a stroll together');
ok(/if\(L\._stroll\)\{ const S=L\._stroll, W=S\.with;/.test(npcBlock), 'the wander loop handles an active stroll before ordinary roaming');
ok(/S\.role==='lead'\)\{ if\(!S\.wp \|\| Math\.hypot[\s\S]*?S\.wp=_resRoamTarget\(L\)/.test(npcBlock), 'the lead friend picks gentle waypoints; the follower keeps pace beside them');
ok(/tx=W\.group\.position\.x - Math\.sin\(th\)\*0\.7 \+ Math\.cos\(th\)\*1\.7\*sd;/.test(npcBlock), 'the follower walks a step beside + just behind the lead (side-by-side, no pile-up)');
ok(/const partnerGone = !W \|\| !W\._stroll \|\| W\._stroll\.with!==L \|\| W\._rest \|\| W\._joinWalk;/.test(npcBlock) && /if\(partnerGone \|\| \(S\.role==='lead' && tt>=S\.until\)\)/.test(npcBlock), 'the follower tracks the lead; the lead owns the timer, and a stroll ends the instant a partner is pulled away (desync-safe)');
ok(/if\(L\._stroll && \(inConv\|\|chatBound\|\|_festival\|\|L\._rest\|\|L\._pNear\)\) _endStroll\(L,tt\);/.test(npcBlock), 'a stroll yields the moment the visitor, a gathering, the festival, or a rest claims either friend');
ok(/const NPC_STROLL_CD=\(LOW_END\?72:54\)/.test(npcBlock) && /_strollGlobalCd=tt\+dur\+NPC_STROLL_CD/.test(npcBlock), 'strolls are globally cooldown-gated so they stay an occasional, gentle beat');
ok(/window\.__stroll=\(id\)=>/.test(HTML), '?dbg __stroll starts a friend stroll on the spot');

group('two friends settle onto adjacent seats to sit and chat a while (co-rest)');
ok(/function _coRestSeats\(L,W\)\{[\s\S]*?ab<1\.5\|\|ab>4\.6/.test(npcBlock), '_coRestSeats finds a free pair of adjacent seats (pavilion bench pair or campfire stumps)');
ok(/function _startCoRest\(L,W,tt\)\{[\s\S]*?L\._restMate=W;[\s\S]*?W\._restMate=L;/.test(npcBlock), 'a co-rest seats both friends and links them as rest-mates');
ok(/if\(S\.role==='lead' && !partnerGone && !L\._pNear && !W\._pNear && tt>=_coRestGlobalCd && Math\.random\(\)<0\.5\)\{[\s\S]*?_startCoRest\(L,W,tt\)/.test(npcBlock), 'when a stroll ends the lead may steer them both to sit together instead of parting');
ok(/const mate=L\._restMate, mateSeated=mate&&mate\._rest&&mate\._rest\.phase==='sit'[\s\S]*?_resSitChatLine\(L,mate\)/.test(npcBlock), 'two friends seated side-by-side trade a little chat instead of the solo comfort murmur');
ok(/function _resSitChatLine\(L,W\)\{[\s\S]*?function _coRestInviteLine/.test(npcBlock) || (/function _resSitChatLine\(L,W\)\{/.test(npcBlock) && /function _coRestInviteLine\(L,W\)\{/.test(npcBlock)), 'co-rest has an invite line + a seated friend-chat bank');
ok(/function _seatRelease\(L\)\{[\s\S]*?L\._restMate=null;/.test(npcBlock), 'standing up clears the rest-mate link (no dangling pairing)');
ok(/let _coRestGlobalCd=0;/.test(npcBlock) && /_coRestGlobalCd=tt\+NPC_STROLL_CD\*2/.test(npcBlock), 'co-rest is globally cooldown-gated so it stays an occasional beat');
ok(/window\.__coRest=\(id\)=>/.test(HTML), '?dbg __coRest sits two friends down together on the spot');

group('Resident Agency — autonomous shared joy excursions');
const joyBlock=(npcBlock.match(/Resident Agency — one pair[\s\S]*?function _tryPeerNotice/)||[''])[0];
ok(joyBlock.length>0, 'Shared Joy agency block is extractable');
ok(/const JOY_CFG=\{ firstMin:\(LOW_END\?90:42\)[\s\S]*?pairCool:\(LOW_END\?180:125\)/.test(joyBlock), 'one LOW_END-aware cadence and pair memory bound autonomous starts');
ok(/const _JOY_PREF=\{[\s\S]*?sol:\['repo','stargaze'\][\s\S]*?nari:\['flower','repo'\]/.test(joyBlock), 'activity choice carries resident persona preferences');
ok(/_partOfDay\(\)[\s\S]*?_resMood\(A,tt\)[\s\S]*?_seedFrom\(_joyKey\(A,B\)/.test(joyBlock), 'choice is deterministic from pair, time slice, time of day, and moods');
ok(/function _joyTarget\(A,B,type,seed\)[\s\S]*?GLOW_FLORA[\s\S]*?_resReps\(A,8\)[\s\S]*?MEMORIAL_TREE/.test(joyBlock), 'flower, real-repo, and stargazing targets reuse existing town places');
ok(/function _joyClear\(x,z,gap=3\.0,minR=20\)[\s\S]*?_hubGap\(x,z\)<gap[\s\S]*?EXTRA_COLLIDERS/.test(joyBlock), 'shared targets keep building, world-bound, and runtime-collider clearance');
ok(/type==='flower'[\s\S]*?_joyClear\(p\.x,p\.z,2\.4,7\.5\)/.test(joyBlock), 'LOW_END plaza blossoms remain valid truthful flower-walk targets');
ok(/let _sharedJoy=null/.test(joyBlock)&&/if\(_sharedJoy\|\|!A\|\|!B/.test(joyBlock), 'at most one resident pair owns Shared Joy');
ok(/const J=\{members:\[A,B\],type,target,phase:'go'/.test(joyBlock)&&/J\.phase='enjoy'/.test(npcBlock)&&/_endSharedJoy\('complete'/.test(joyBlock), 'excursion lifecycle is go → enjoy → complete');
ok(/maxDistance\/minSpeed\+7/.test(joyBlock)&&/travelElapsed:0/.test(joyBlock)&&/J\.travelElapsed\+=Math\.max\(0,dt\)/.test(joyBlock)
  &&/_sharedJoyTick\(tt,dt\)/.test(npcBlock), 'arrival timeout derives from actual pair distance and advances with the same capped simulation time as movement');
ok(/_festival\|\|_ambConv\|\|_resChatActive\(\)\|\|document\.hidden\|\|!NPC_CFG\.motionEnabled/.test(joyBlock), 'festival, chat, ambient gathering, hidden tab, and motion-off own cancellation');
ok(/visibilitychange['"],\(\)=>\{ if\(document\.hidden\)\{ clearKeys\(\); if\(_sharedJoy\) _endSharedJoy\('hidden'\)/.test(HTML), 'visibilitychange ends Shared Joy synchronously before browsers suspend animation frames');
ok(/if\(L\._joy && \(inConv\|\|chatBound\|\|_festival\|\|L\._rest\|\|L\._pNear\|\|hidden\)\) _endSharedJoy\('claimed',tt\)/.test(npcBlock), 'participant immediately yields to visitor proximity or any stronger resident owner');
ok(/let best=null, bestScore=Infinity, joyBest=null, joyScore=Infinity/.test(npcBlock)
  &&/if\(!best&&joyBest\)\{ _endSharedJoy\('repo-visit',now\); best=joyBest; \}/.test(npcBlock), 'a first repo visit can claim a nearby excursion participant instead of permanently losing the resident reaction');
ok(/const part=_partOfDay\(\), starsUp=isNight/.test(joyBlock)
  &&/filter\(x=>starsUp\|\|x!=='stargaze'\)/.test(joyBlock)
  &&/\.\.\.\(\(isNight\|\|forcedType==='stargaze'\)\?\['stargaze'\]:\[\]\)/.test(joyBlock), 'autonomous stargazing is excluded while the town stars are hidden; only an explicit debug force may override it');
ok(/if\(!LOW_END\) popSparkle/.test(npcBlock)&&/function _joySpeed\(L\)\{ return Math\.max\(L\._wspd\*1\.1,LOW_END\?1\.0:1\.25\)/.test(joyBlock)
  &&/_resWalk\(L,tx,tz,_joySpeed\(L\),dt\)/.test(npcBlock), 'LOW_END keeps purposeful movement and dialogue but skips the extra sparkle');
ok(/function _ambientAllowed\(\)\{ return NPC_CFG\.modeEnabled && !_sharedJoy/.test(npcBlock), 'ambient gatherings never start over Shared Joy');
ok(/window\.__joyState=/.test(HTML)&&/window\.__joy=/.test(HTML)&&/window\.__joyTick=/.test(HTML)&&/window\.__endJoy=/.test(HTML), 'debug hooks inspect, force, tick, and end every activity');
ok(!/fetch\(|_npcFetch|npcModelCall|AOAI|SEARCH_API/.test(joyBlock), 'resident agency adds zero network/model/env dependency');

group('repository constellation trail — telescope reveals a meaningful 3-house exploration loop');
// 1.72 selector: execute the real pure metadata selector against the shipped city + small fallback fixtures.
const trailSelectorSrc = (HTML.match(/\/\*CONSTELLATION_SELECTOR:START\*\/([\s\S]*?)\/\*CONSTELLATION_SELECTOR:END\*\//) || [, ''])[1];
ok(trailSelectorSrc.length > 0, 'constellation selector block is extractable from index.html');
let constellationPick = null, trailRepos = [];
if (trailSelectorSrc) {
  try {
    constellationPick = new Function(`${trailSelectorSrc}\nreturn constellationPick;`)();
    const rj = JSON.parse(readFileSync(join(ROOT, 'repos.json'), 'utf8'));
    trailRepos = Array.isArray(rj) ? rj : (rj.repos || []);
  } catch (e) { console.log('  ✗ constellation selector harness: ' + e.message); }
}
ok(!!(constellationPick && trailRepos.length), 'selector + repos.json load for behavioral checks');
if (constellationPick && trailRepos.length) {
  const a = constellationPick(trailRepos, 'hyeonsangjeon', '2026-07-10');
  const b = constellationPick(trailRepos, 'hyeonsangjeon', '2026-07-10');
  const names = a && a.stops ? a.stops.map(r => r.repo) : [];
  ok(!!a && names.length === 3 && new Set(names).size === 3, 'owner town yields exactly three distinct canonical repo stops');
  ok(JSON.stringify(names) === JSON.stringify(b.stops.map(r => r.repo)) && a.id === b.id, 'same town + day yields the same constellation deterministically');
  ok(a.kind === 'topic', 'owner town prefers a specific shared topic over a generic language cluster');
  const related = a.kind === 'topic'
    ? a.stops.every(r => (r.topics || []).map(x => String(x).toLowerCase()).includes(a.key))
    : a.kind === 'lang' ? a.stops.every(r => r.lang === a.key) : false;
  ok(related, 'all three owner stops genuinely share the selected topic/language');
  const mix = constellationPick([{repo:'a',lang:'A'},{repo:'b',lang:'B'},{repo:'c',lang:'C'}], 'tiny', 'd');
  ok(!!mix && mix.kind === 'mix' && mix.stops.length === 3, 'a 3-house public town gracefully falls back to a mixed town-signal trail');
  ok(constellationPick([{repo:'a'},{repo:'b'}], 'tiny', 'd') === null, 'a town with fewer than three houses reports the trail unavailable');
}
// World/UI wiring: explicit launch, low-cost visuals, current-target house opening, navigation, reward, cleanup, parity, debug.
const trailBlock = (HTML.match(/Repository Constellation Trail:[\s\S]*?\/\* ---- 🔭 Observatory modal/) || [''])[0];
ok(/id=["']starTrailHud["']/.test(HTML) && /id=["']obsTrailStart["']/.test(HTML), 'responsive trail HUD + Observatory launch action are present');
ok(/#starTrailHud\.hidden\s*\{[^}]*visibility:hidden/.test(HTML), 'inactive trail HUD is removed from focus/accessibility visibility');
ok(/#starTrailHud\s*\{\s*left:12px;\s*bottom:calc\(100px \+ env\(safe-area-inset-bottom,0px\)\)/.test(HTML), 'touch HUD sits above the bottom interaction prompt and safe area');
ok(/function startStarTrail\(\)/.test(trailBlock) && /setTimeOfDay\(true\)/.test(trailBlock) && /setNav\(STAR_TRAIL\.stops\[0\]\)/.test(trailBlock), 'launch turns on the night sky and guides to the first house');
ok(/function buildStarTrailVisuals\(\)/.test(trailBlock) && /new THREE\.LineBasicMaterial/.test(trailBlock) && /new THREE\.SpriteMaterial/.test(trailBlock), 'world trail uses luminous lines + star sprites');
ok(!/new THREE\.(PointLight|SpotLight|DirectionalLight)/.test(trailBlock), 'constellation adds no scene lights (performance ceiling)');
ok(/const nodes=\[\], lines=\[\], count=LOW_END\?7:13/.test(trailBlock), 'LOW_END halves arc detail while preserving the visible trail');
ok(/function updateStarTrail\(t\)\{ if\(!STAR_TRAIL\|\|!STAR_TRAIL\.active\|\|!STAR_TRAIL\.visual\|\|document\.hidden\) return/.test(trailBlock) && /!REDUCED&&i===now/.test(trailBlock), 'trail motion stops when inactive/hidden and respects reduced motion');
ok(/g\.traverse\(o=>\{ if\(o\.geometry\) o\.geometry\.dispose\(\)/.test(trailBlock), 'replay/end disposes trail geometry + materials instead of leaking GPU objects');
ok(/function openCard\(repo\)[\s\S]{0,100}starTrailVisit\(repo\)/.test(HTML), 'opening the current repo house advances the trail');
ok(/STAR_TRAIL\.index\+\+/.test(trailBlock) && /setNav\(STAR_TRAIL\.stops\[done\]\)/.test(trailBlock), 'each found star advances progress and guides to the next house');
ok(/addStamp\(['"]constellation['"]\)/.test(trailBlock) && /_auroraBoost=Math\.max\(_auroraBoost,12\)/.test(trailBlock) && /fireworksShow/.test(trailBlock), 'completion awards a passport stamp + aurora/fireworks finale');
ok(/\{id:['"]constellation['"],\s+ico:['"]🌌['"],\s+key:['"]lmConstellation['"]\}/.test(HTML), 'passport catalog includes the earned Repository Constellation stamp');
ok((HTML.match(/trailKicker:\s*['"]/g) || []).length >= 2 && (HTML.match(/trailComplete:\s*['"]/g) || []).length >= 2
  && (HTML.match(/lmConstellation:\s*['"]/g) || []).length >= 2, 'trail launch/progress/reward copy has Korean + English parity');
ok(/window\.__starTrailPlan=/.test(HTML) && /window\.__starTrailStart=/.test(HTML)
  && /window\.__starTrailNext=/.test(HTML) && /window\.__starTrailEnd=/.test(HTML), '?dbg trail plan/start/advance/end hooks are present');
ok(/updateStarTrail\(clock\.elapsedTime\)/.test(HTML), 'the main world loop updates the active constellation visuals');

group('one colossal deterministic World Tree Pillar supports the village');
const memorialTreeBlock = (HTML.match(/\/\*MEMORIAL_TREE:START\*\/([\s\S]*?)\/\*MEMORIAL_TREE:END\*\//) || [, ''])[1];
const visualLodBlock = (HTML.match(/\/\*VISUAL_LOD:START\*\/([\s\S]*?)\/\*VISUAL_LOD:END\*\//) || [, ''])[1];
const staticInstanceBlock = (HTML.match(/\/\*STATIC_INSTANCES:START\*\/([\s\S]*?)\/\*STATIC_INSTANCES:END\*\//) || [, ''])[1];
const buildingLodPrototypeBlock = (HTML.match(/\/\*BUILDING_LOD_PROTOTYPE:START\*\/([\s\S]*?)\/\*BUILDING_LOD_PROTOTYPE:END\*\//) || [, ''])[1];
const buildingLodUpdateBlock = (HTML.match(/function _updateBuildingLodPrototype\(frame,force=false\)\{([\s\S]*?)\n\}\nfunction _syncBuildingLodFacade/) || [, ''])[1];
const worldTreeBloomPrepBlock = (HTML.match(/function _prepareWorldTreeBloom\(\)\{([\s\S]*?)\n\}\nfunction _renderWorldTreeFrame/) || [, ''])[1];
const worldTreeBloomProjectionBlock = (HTML.match(/function _updateWorldTreeBloomProjection\(\)\{([\s\S]*?)\n\}\nfunction _captureWorldTreeBloomProjection/) || [, ''])[1];
ok(memorialTreeBlock.length > 0, 'world-tree procedural block is extractable from index.html');
ok(visualLodBlock.length > 0, 'projected-size visual LOD block is extractable from index.html');
ok(staticInstanceBlock.length > 0, 'exact-static instance block is extractable from index.html');
ok(buildingLodPrototypeBlock.length > 0, '2C-A representative building LOD block is extractable from index.html');
ok(createHash('sha256').update(WORLD_TREE_FACTORY).digest('hex') === 'e2ba93eac7c13517005dd4ab4203a05b6b568ebf8f9b17a353b8cf39012281df',
  'Repolis factory provenance is pinned to dual-face dominant-vein candidate B with attached leaves and hanging lights');
ok(/import \{ createRepolisHero, REPOLIS_FACTORY_REVISION \} from '\.\/assets\/world-tree\/createRepolisHero\.js\?v=azimuth-energy-v6-dual-face-b-pendant-bloom-r1'/.test(HTML)
  && /import \{ mergeGeometries \} from 'three\/addons\/utils\/BufferGeometryUtils\.js'/.test(WORLD_TREE_FACTORY), 'native Solar Archive factory resolves through the existing Three.js import map');
ok(/import \{ EffectComposer \}/.test(HTML) && /import \{ TexturePass \}/.test(HTML) && /import \{ UnrealBloomPass \}/.test(HTML)
  && /import \{ ShaderPass \}/.test(HTML) && /import \{ OutputPass \}/.test(HTML)
  && /new UnrealBloomPass\(new THREE\.Vector2\(innerWidth,innerHeight\),1\.35,0\.58,0\.06\)/.test(HTML)
  && /baseTargetDpr=_cappedTargetDpr\(1\.25,3200000\)/.test(HTML)
  && /const _desktopFinePointer=matchMedia\('\(pointer:fine\)'\)/.test(HTML)
  && /const _desktopFrameDropGuard=\(\)=>_desktopFinePointer\.matches&&innerWidth\*innerHeight>=900000/.test(HTML)
  && /const _treeEmissiveTargetDpr=\(\)=>_cappedTargetDpr\(_desktopFrameDropGuard\(\)\?0\.55:0\.75,_desktopFrameDropGuard\(\)\?700000:1200000\)/.test(HTML)
  && /const _treeBloomTargetDpr=\(\)=>_cappedTargetDpr\(_desktopFrameDropGuard\(\)\?0\.45:LOW_END\?0\.5:0\.625,_desktopFrameDropGuard\(\)\?500000:900000\)/.test(HTML)
  && /treeEmissiveDpr=_treeEmissiveTargetDpr\(\)/.test(HTML)
  && /treeBloomDpr=_treeBloomTargetDpr\(\)/.test(HTML)
  && /finalCompositeDpr=_cappedTargetDpr\(1\.25,3200000\)/.test(HTML)
  && /const _rendererDpr=\(\)=>Math\.min\(devicePixelRatio,_desktopFrameDropGuard\(\)\?1:1\.25,Math\.sqrt\(3200000\//.test(HTML)
  && (HTML.match(/renderer\.setPixelRatio\(_rendererDpr\(\)\)/g)||[]).length===2
  && /finalComposer\.setPixelRatio\(finalCompositeDpr\)/.test(HTML)
  && /_desktopFinePointer\.addEventListener\?\.\('change',_resizeViewportQuality\)/.test(HTML)
  && /type:THREE\.HalfFloatType/.test(HTML) && /target\.texture\.colorSpace=THREE\.LinearSRGBColorSpace/.test(HTML)
  && /const bloomTarget=makeLinearTarget\([^;\n]+,false\);/.test(HTML)
  && /bloomInternalTargets\.forEach\(target=>\{ target\.depthBuffer=false; target\.stencilBuffer=false; \}\)/.test(HTML)
  && /const finalTarget=makeLinearTarget\([^;\n]+,false\);/.test(HTML)
  && /new EffectComposer\(renderer,finalTarget\)/.test(HTML)
  && /const finalMix=new ShaderPass\(new THREE\.ShaderMaterial\(\{uniforms:\{[\s\S]*?\n\s*depthTest:false,depthWrite:false,\n\s*vertexShader:/.test(HTML)
  && /new TexturePass\(emissiveTarget\.texture,1\)/.test(HTML)
  && /bloomTexture:\{value:worldBloom\.renderTargetsHorizontal\[0\]\.texture\}/.test(HTML)
  && !/emissiveTexture:\{value:emissiveTarget\.texture\}/.test(HTML)
  && /finalComposer\.addPass\(finalMix\); finalComposer\.addPass\(new OutputPass\(\)\)/.test(HTML)
  && /_prepareWorldTreeBloom\(\)/.test(HTML)
  && /renderer\.toneMapping=THREE\.NoToneMapping; renderer\.outputColorSpace=THREE\.LinearSRGBColorSpace/.test(HTML)
  && (HTML.match(/new OutputPass\(\)/g)||[]).length===1, 'linear HDR base/emissive/bloom targets use independent cost caps and composite once before the only final OutputPass');
ok(/const MEMORIAL_TREE_SEED=20260711, MEMORIAL_TREE_POS=new THREE\.Vector3\(15,0,48\)/.test(memorialTreeBlock)
  && /MEM_TREE_HERO_VARIANT='solar-archive'/.test(memorialTreeBlock), 'exactly seeded Solar Archive is selected at the existing north park position');
ok(/makePark\(MEMORIAL_TREE_POS\.x,MEMORIAL_TREE_POS\.z,true\)/.test(HTML)
  && (HTML.match(/if\(memorial\) makeMemorialTree\(cx,cz\)/g) || []).length === 1, 'exactly one memorial tree is requested, at the north rest park centre');
ok(/const stage='full'/.test(memorialTreeBlock)
  && /createRepolisHero\(\{seed:MEMORIAL_TREE_SEED,variant:MEM_TREE_HERO_VARIANT,stage\}\)/.test(memorialTreeBlock), 'desktop and touch tiers both use the exact full Solar Archive hero');
ok(/macroBranchSpecs\(\)/.test(WORLD_TREE_FACTORY) && /secondaryBranches\(spec, seed/.test(WORLD_TREE_FACTORY)
  && /fineBranches\(spec, seed\)/.test(WORLD_TREE_FACTORY) && /mergedFineGeometry/.test(WORLD_TREE_FACTORY), 'factory preserves macro → secondary → merged fine branch hierarchy');
ok(/REPOLIS_FACTORY_REVISION = 'azimuth-energy-v6-dual-face-b-pendant-bloom'/.test(WORLD_TREE_FACTORY)
  && /function createSurfaceRadius\(/.test(WORLD_TREE_FACTORY)
  && /const surfaceRadius = createSurfaceRadius\(/.test(WORLD_TREE_FACTORY)
  && /const \{ radius, ridges \} = surfaceRadius\(t, angle\)/.test(WORLD_TREE_FACTORY)
  && /const \{ radius \} = surfaceRadius\(t, angle\)/.test(WORLD_TREE_FACTORY), 'bark and energy veins share one deterministic Frenet-frame surface-radius profile');
ok(/radialCopies = spec\.importance === 'trunk' \|\| spec\.id\.includes\('foundation'\) \? 3 : 2/.test(WORLD_TREE_FACTORY)
  && /const frontDominant = copy === 0/.test(WORLD_TREE_FACTORY)
  && /const rearDominant = copy === 1/.test(WORLD_TREE_FACTORY)
  && /const dominant = frontDominant \|\| rearDominant/.test(WORLD_TREE_FACTORY)
  && /const canonicalFront = new THREE\.Vector3\(\.\.\.REPOLIS_ENERGY_PROFILE\.canonicalFront\)/.test(WORLD_TREE_FACTORY)
  && /const frontAngle = Math\.hypot\(projectedX, projectedY\) > 0\.08/.test(WORLD_TREE_FACTORY)
  && /const dominantFace = frontDominant \? 'front' : rearDominant \? 'rear' : null/.test(WORLD_TREE_FACTORY)
  && /const supportKind = dominant \? null : 'side'/.test(WORLD_TREE_FACTORY)
  && /const radialOffset = frontDominant[\s\S]*?\? 0[\s\S]*?rearDominant[\s\S]*?\? Math\.PI[\s\S]*?Math\.PI \* 0\.5/.test(WORLD_TREE_FACTORY)
  && /spec\.id\.includes\('rear'\)/.test(WORLD_TREE_FACTORY)
  && /mergeGeometries\(veinGeometries, false\)/.test(WORLD_TREE_FACTORY)
  && /mergeGeometries\(coreGeometries, false\)/.test(WORLD_TREE_FACTORY)
  && /energyGroup\.userData\.drawMeshes = 2/.test(WORLD_TREE_FACTORY)
  && /depthTest: true/.test(WORLD_TREE_FACTORY)
  && !/spec\.importance === 'trunk' \? 0\.92 : 0\.05/.test(WORLD_TREE_FACTORY), 'energy v5 keeps one front and one rear dominant copy plus an ultra-thin side support in two depth-tested merged meshes');
ok(/function withLegacyEnergyRandomBudget\(seed, build\)/.test(WORLD_TREE_FACTORY)
  && /index < 76/.test(WORLD_TREE_FACTORY)
  && /runtime\.nodes\['energy-network'\] = energy\.group/.test(WORLD_TREE_FACTORY)
  && /runtime\.sockets\['energy:root'\] = energy\.core/.test(WORLD_TREE_FACTORY), 'energy v3 preserves the procedural RNG boundary and stable action-ready node/socket IDs');
ok(/const REPOLIS_ENERGY_PROFILE = Object\.freeze\(\{/.test(WORLD_TREE_FACTORY)
  && /id: 'dual-face-main-vein-b'/.test(WORLD_TREE_FACTORY)
  && /canonicalFront: Object\.freeze\(\[0, 0, -1\]\)/.test(WORLD_TREE_FACTORY)
  && /frontDominantRadius: Object\.freeze\(\{[\s\S]*?trunk: 0\.078,[\s\S]*?foundation: 0\.044,[\s\S]*?macro: 0\.036/.test(WORLD_TREE_FACTORY)
  && /rearDominantRadius: Object\.freeze\(\{[\s\S]*?trunk: 0\.069,[\s\S]*?foundation: 0\.039,[\s\S]*?macro: 0\.032/.test(WORLD_TREE_FACTORY)
  && /sideSupportRadius: Object\.freeze\(\{[\s\S]*?trunk: 0\.006,[\s\S]*?foundation: 0\.0045,[\s\S]*?macro: 0\.004/.test(WORLD_TREE_FACTORY)
  && /frontDominantSourceWeight: 1/.test(WORLD_TREE_FACTORY)
  && /rearDominantSourceWeight: 0\.86/.test(WORLD_TREE_FACTORY)
  && /sideSupportSourceWeight: 0\.1/.test(WORLD_TREE_FACTORY)
  && /barkHaloPolicy: 'vein-bloom-only-no-branch-extraction'/.test(WORLD_TREE_FACTORY)
  && /function shapePainterlyVein\(/.test(WORLD_TREE_FACTORY)
  && /\) \* sourceWeight;/.test(WORLD_TREE_FACTORY)
  && /geometry\.setAttribute\('color', new THREE\.BufferAttribute\(colors, 3\)\)/.test(WORLD_TREE_FACTORY), 'candidate B gives both front and rear one continuous dominant source while retaining an ultra-thin side continuity copy');
ok(/dominantVeinIds\.push\(roleId\)/.test(WORLD_TREE_FACTORY)
  && /frontDominantVeinIds\.push\(roleId\)/.test(WORLD_TREE_FACTORY)
  && /rearDominantVeinIds\.push\(roleId\)/.test(WORLD_TREE_FACTORY)
  && /supportVeinIds\.push\(roleId\)/.test(WORLD_TREE_FACTORY)
  && /sideSupportVeinIds\.push\(roleId\)/.test(WORLD_TREE_FACTORY)
  && /energyGroup\.userData\.dominantVeinCount = dominantVeinIds\.length/.test(WORLD_TREE_FACTORY)
  && /energyGroup\.userData\.frontDominantVeinCount = frontDominantVeinIds\.length/.test(WORLD_TREE_FACTORY)
  && /energyGroup\.userData\.rearDominantVeinCount = rearDominantVeinIds\.length/.test(WORLD_TREE_FACTORY)
  && /energyGroup\.userData\.supportVeinCount = supportVeinIds\.length/.test(WORLD_TREE_FACTORY)
  && /energyDominantVeinCount:s\.energyDominantVeinCount/.test(HTML)
  && /energyFrontDominantVeinCount:s\.energyFrontDominantVeinCount/.test(HTML)
  && /energyRearDominantVeinCount:s\.energyRearDominantVeinCount/.test(HTML)
  && /energySupportVeinCount:s\.energySupportVeinCount/.test(HTML)
  && /energySideSupportVeinCount:s\.energySideSupportVeinCount/.test(HTML)
  && /energyBarkHaloPolicy:s\.energyBarkHaloPolicy/.test(HTML),
  'runtime metadata reports exact front/rear dominant and side support IDs, counts, radii, weights, and vein-only bark halo policy');
ok(/function withPrivateRandom\(seed, build\)/.test(WORLD_TREE_FACTORY)
  && /const ornamentEnergy = withPrivateRandom\(`\$\{seed\}\/ornament-material`, \(\) => energy\.clone\(\)\)/.test(WORLD_TREE_FACTORY),
  'pendant material UUID creation is isolated from the protected global procedural RNG sequence');
ok(/ornamentEnergy\.name = 'repolis-hanging-ornament-energy'/.test(WORLD_TREE_FACTORY)
  && /ornamentEnergy\.emissiveIntensity = 1\.9/.test(WORLD_TREE_FACTORY)
  && /hangingGeometries\.push\(new THREE\.TubeGeometry\(curve, 4, 0\.016, 5, false\)\)/.test(WORLD_TREE_FACTORY)
  && /const bulb = new THREE\.SphereGeometry\(0\.075, 10, 8\)/.test(WORLD_TREE_FACTORY)
  && /const hangingGeometry = mergeGeometries\(hangingGeometries, false\)/.test(WORLD_TREE_FACTORY)
  && /const hangingLights = new THREE\.Mesh\(hangingGeometry, materials\.ornamentEnergy\)/.test(WORLD_TREE_FACTORY)
  && /const MERGED_HANGING_LIGHT_REMOVED_UUIDS = 34/.test(WORLD_TREE_FACTORY)
  && /index < MERGED_HANGING_LIGHT_REMOVED_UUIDS \* 4/.test(WORLD_TREE_FACTORY)
  && /hangingLightCount: constellations\?\.hangingLightCount \?\? 0/.test(WORLD_TREE_FACTORY)
  && /hangingLightMeshCount: constellations\?\.hangingLightMeshCount \?\? 0/.test(WORLD_TREE_FACTORY)
  && /hangingLightPartCount: constellations\?\.hangingLightPartCount \?\? 0/.test(WORLD_TREE_FACTORY)
  && /hangingLightMeshCount:s\.hangingLightMeshCount/.test(HTML)
  && /hangingLightPartCount:s\.hangingLightPartCount/.test(HTML)
  && /hangingLightPolicy:s\.hangingLightPolicy/.test(HTML)
  && /hangingLightPolicy = 'merged-attached-stem-bulb-selective-bloom-source'/.test(WORLD_TREE_FACTORY)
  && /branchEndOrnaments:'attached-stem-bulb-selective-soft-bloom-1\.35'/.test(memorialTreeBlock),
  '18 exact stem/bulb pendants merge to one draw and expose one dedicated selective-bloom source');
ok(/function createOrganicEnergyKnotGeometry\(knot, seed\)/.test(WORLD_TREE_FACTORY)
  && /new THREE\.SphereGeometry\(1, 9, 6\)/.test(WORLD_TREE_FACTORY)
  && /knotAt\(rootIndex,[^\n]+, 'root-junction'\)/.test(WORLD_TREE_FACTORY)
  && /knotAt\(secondaryIndex,[^\n]+, 'secondary-accent'\)/.test(WORLD_TREE_FACTORY)
  && /spec\.importance === 'trunk' \|\| spec\.id\.includes\('foundation'\) \|\| copy === 0/.test(WORLD_TREE_FACTORY)
  && /\(specIndex \* 2 \+ copy\) % 4 === 0/.test(WORLD_TREE_FACTORY)
  && /knotCount = knots\.length/.test(WORLD_TREE_FACTORY)
  && /knotDistribution = 'fifteen-root-junctions-and-six-secondary-accents'/.test(WORLD_TREE_FACTORY)
  && /knotSizes = \[0\.054, 0\.082, 0\.12\]/.test(WORLD_TREE_FACTORY)
  && /knotRoleCounts = \{/.test(WORLD_TREE_FACTORY)
  && /const readabilityLift = root \? 1\.12 : 1\.15/.test(WORLD_TREE_FACTORY)
  && /const radialLift = 1 \+ \(readabilityLift - 1\) \* 0\.6/.test(WORLD_TREE_FACTORY)
  && /const depthLift = 1 \+ \(readabilityLift - 1\) \* 0\.35/.test(WORLD_TREE_FACTORY),
  'v3 merges 21 deterministic asymmetric seed/flame knots with a bounded, non-spherical readability lift');
ok(/Math\.round\(2600 \* variant\.foliageDensity\)/.test(WORLD_TREE_FACTORY)
  && /id: 'solar-archive'[\s\S]*?foliageDensity: 1\.16[\s\S]*?cyanRatio: 0\.1/.test(WORLD_TREE_FACTORY)
  && /const geometry = createLeafGeometry\(\);[\s\S]*?new THREE\.InstancedMesh\(geometry, materials\.amberLeaf, amberCount\)[\s\S]*?new THREE\.InstancedMesh\(geometry, materials\.cyanLeaf, cyanCount\)/.test(WORLD_TREE_FACTORY),
  'Solar Archive supplies 3,016 leaves as two draw-batched instanced sets sharing one geometry');
ok(/const REPOLIS_LEAF_ATTACHMENT = Object\.freeze\(\{/.test(WORLD_TREE_FACTORY)
  && /parentSocket: 'fine-branch-contact-anchor'/.test(WORLD_TREE_FACTORY)
  && /rootLocalY: -0\.42/.test(WORLD_TREE_FACTORY)
  && /contactType: 'embedded-tip-fan'/.test(WORLD_TREE_FACTORY)
  && /embedDepth: 0\.075/.test(WORLD_TREE_FACTORY)
  && /gapTolerance: 0\.015/.test(WORLD_TREE_FACTORY)
  && /rootPivotScale: 1\.22/.test(WORLD_TREE_FACTORY)
  && /bladeWidthScale: 1\.18/.test(WORLD_TREE_FACTORY)
  && /bladeLengthScale: \[1\.6, 2\]/.test(WORLD_TREE_FACTORY)
  && /maxRadialFraction: 0\.45/.test(WORLD_TREE_FACTORY)
  && /const leafLength = scale \* bladeLengthScale/.test(WORLD_TREE_FACTORY)
  && /-REPOLIS_LEAF_ATTACHMENT\.rootLocalY \* leafLength/.test(WORLD_TREE_FACTORY)
  && /rollQuaternion\.setFromAxisAngle\(up, roll\)/.test(WORLD_TREE_FACTORY)
  && /anchor\.curve\.getPointAt\(contactT, contact\)/.test(WORLD_TREE_FACTORY)
  && /anchor\.curve\.getTangentAt\(contactT, contactDirection\)\.normalize\(\)/.test(WORLD_TREE_FACTORY)
  && /conservativeSurfaceRadius \* REPOLIS_LEAF_ATTACHMENT\.maxRadialFraction/.test(WORLD_TREE_FACTORY)
  && /position\.copy\(contact\)\.addScaledVector\([\s\S]*?-REPOLIS_LEAF_ATTACHMENT\.rootLocalY \* leafLength/.test(WORLD_TREE_FACTORY)
  && /transformedRoot\.copy\(localRoot\)\.applyMatrix4\(matrix\)\.distanceTo\(contact\)/.test(WORLD_TREE_FACTORY)
  && /verifiedRootedInstances: targetCount/.test(WORLD_TREE_FACTORY)
  && /rootGapPass: maxRootGap <= REPOLIS_LEAF_ATTACHMENT\.gapTolerance/.test(WORLD_TREE_FACTORY)
  && /surfaceContactPass: minSurfaceInset >= 0/.test(WORLD_TREE_FACTORY)
  && /finalTransformPolicy: 'shared-living-system-no-independent-foliage-sway'/.test(WORLD_TREE_FACTORY)
  && !/foliage\.amberLeaves\.rotation|foliage\.cyanLeaves\.rotation/.test(WORLD_TREE_FACTORY)
  && /const REPOLIS_LEAF_ANCHOR_SAMPLES = Object\.freeze\(\[[\s\S]*?0\.18, 0\.3, 0\.42, 0\.54, 0\.66, 0\.76, 0\.84, 0\.92, 1/.test(WORLD_TREE_FACTORY)
  && /const leafAnchorSamples = REPOLIS_LEAF_ANCHOR_SAMPLES/.test(WORLD_TREE_FACTORY)
  && /const leafAnchors = anchorSpecs\.flatMap/.test(WORLD_TREE_FACTORY)
  && /foliage = createFoliage\(seed, variantConfig, materials, leafAnchors, livingSystem\)/.test(WORLD_TREE_FACTORY)
  && /sourceSystem: 'deterministic-fine-branch-contact-samples'/.test(WORLD_TREE_FACTORY)
  && /leafRootedInstances: foliage\?\.attachmentContract\.rootedInstances \?\? 0/.test(WORLD_TREE_FACTORY),
  'all 3,016 leaf-card roots seat into deterministic branch-tip anchors with explicit overlap and direction contracts');
ok(/const VISUAL_LOD=\{outlines:\[\],effects:\[\]/.test(visualLodBlock)
  && /_registerOutlineLod\(o,mesh,th\)/.test(HTML)
  && /entry\.projectedPx<1\.25&&entry\.distance>45/.test(visualLodBlock)
  && /entry\.projectedPx>1\.75\|\|entry\.distance<40/.test(visualLodBlock)
  && /VISUAL_LOD\.nearBypass=false/.test(visualLodBlock)
  && !/_lodHeroCenter/.test(visualLodBlock)
  && /frame-VISUAL_LOD\.lastFrame<8/.test(visualLodBlock)
  && !/scene\.traverse/.test(visualLodBlock) && !/new THREE\.Box3/.test(visualLodBlock), 'outline LOD uses cached projected diameter and hysteresis without globally waking the town near the protected tree');
ok(/_registerEffectLod\(halo,'street-lamp-halo',0\.18\)/.test(HTML)
  && /_registerEffectLod\(pool,'street-lamp-pool',0\.30\)/.test(HTML)
  && /_registerEffectLod\(halo,'glow-flora-halo',0\.22\)/.test(HTML)
  && /_registerEffectLod\(glowPool,'repo-glow-pool',0\.25\)/.test(HTML)
  && /VISUAL_LOD_DESKTOP_EFFECT_SHOW_DISTANCE=140,VISUAL_LOD_DESKTOP_EFFECT_HIDE_DISTANCE=160/.test(visualLodBlock)
  && /desktopLowSignal=_desktopFrameDropGuard\(\)&&entry\.signal<0\.22/.test(visualLodBlock)
  && /entry\.projectedPx<1\.5&&entry\.distance>50&&entry\.signal<0\.22/.test(visualLodBlock), 'explicit low-signal lamp/flora/repo pools receive projected-size LOD plus bounded desktop distance culling');
ok(/protect\(MEMORIAL_TREE&&MEMORIAL_TREE\.group\)/.test(visualLodBlock)
  && /protect\(player\)/.test(visualLodBlock) && /protect\(navHolder\)/.test(visualLodBlock)
  && /ZONE_HUBS\.forEach\(h=>protect\(h\.group\)\)/.test(visualLodBlock)
  && /RESIDENTS_LIVE\.forEach\(L=>protect\(L\.group\)\)/.test(visualLodBlock), 'World Tree, navigation, landmarks, player, NPCs, residents, and hubs are excluded from 2A');
ok(/const STATIC_INSTANCES=\{cellSize:64,minBucket:4,candidates:\[\]/.test(staticInstanceBlock)
  && /mesh\.geometry\.uuid\}\|\$\{mesh\.material\.uuid\}/.test(staticInstanceBlock)
  && /mesh\.castShadow\?1:0/.test(staticInstanceBlock) && /mesh\.receiveShadow\?1:0/.test(staticInstanceBlock)
  && /mesh\.layers\.mask/.test(staticInstanceBlock) && /mesh\.renderOrder/.test(staticInstanceBlock)
  && !/Math\.random/.test(staticInstanceBlock), '2B-1 buckets preserve deterministic insertion order and split by cell, geometry, material, and render state without random calls');
ok(/let PATCH_FLOWER_GEO=null[\s\S]*?KNOB_GEO=null,FLAG_GEO=null/.test(HTML)
  && /function _adoptStaticGeometry\(mesh,canonical\)/.test(HTML)
  && /new THREE\.Mesh\(new THREE\.CylinderGeometry\(0\.02,0\.03,0\.4,4\),toon\(0x70875a\)\)/.test(HTML)
  && /new THREE\.Mesh\(new THREE\.SphereGeometry\(0\.1,8,6\),MAT_KNOB\)/.test(HTML)
  && /rngBeforeFinalize=window\.__rngProbe\(\)\.count/.test(staticInstanceBlock), 'canonical assets adopt the first original while later original constructors still consume the same procedural RNG sequence');
ok(/new THREE\.InstancedMesh\(bucket\.geometry,bucket\.material,bucket\.items\.length\)/.test(staticInstanceBlock)
  && /batch\.computeBoundingBox\(\); batch\.computeBoundingSphere\(\)/.test(staticInstanceBlock)
  && /if\(!batch\.boundingBox\|\|!batch\.boundingSphere/.test(staticInstanceBlock)
  && /bucket\.items\.forEach\(_detachStaticOriginal\)/.test(staticInstanceBlock)
  && /catch\(error\)\{ if\(batch&&batch\.parent\) batch\.parent\.remove\(batch\)/.test(staticInstanceBlock), 'originals detach only after a validated InstancedMesh batch; failures remain explicit');
ok(/mesh\.children\.length\)\{ STATIC_INSTANCES\.fallbacks\.push\(\{family:candidate\.family,reason:'child-or-outline'\}/.test(staticInstanceBlock)
  && /reason:'mutable-building-root'/.test(staticInstanceBlock)
  && !/_registerStaticInstance\([^)]*GARLAND/.test(HTML), 'outlined children and animated release garlands never enter static batches');
ok(/_registerStaticInstance\(stem,'lavender-row-stem'\)/.test(HTML)
  && /_registerStaticInstance\(sp,'lavender-clump-spike'\)/.test(HTML)
  && /_registerStaticInstance\(f,'bloom-flower'\)/.test(HTML)
  && /_registerStaticInstance\(f,'patch-flower'\)/.test(HTML)
  && /_registerStaticInstance\(crown,'yard-crown'\)/.test(HTML)
  && /_registerStaticInstance\(knob,'door-knob'\)/.test(HTML)
  && /_registerStaticInstance\(fl,'building-flag'\)/.test(HTML)
  && /_registerStaticInstance\(st,'building-star'\)/.test(HTML), '2B-1 retains approved global candidates and safely rejects mutable building-root descendants');
ok((HTML.match(/_finalizeStaticInstances\(\);/g)||[]).length===1
  && /invalidateTownShadows\('static-instances'\)/.test(staticInstanceBlock)
  && /window\.__staticInstances=/.test(HTML), 'static instances finalize once, invalidate frozen shadows once, and expose rollback diagnostics');
ok(/function _reattachAllStaticOriginals\(\)/.test(staticInstanceBlock)
  && /items\.sort\(\(a,b\)=>a\.parentIndex-b\.parentIndex\); items\.forEach\(_reattachStaticOriginal\)/.test(staticInstanceBlock), 'originals-only rollback restores each parent in ascending original sibling order');
ok(!/BUILDING_INSTANCES|_registerBuildingInstance|_finalizeBuildingInstances|__buildingInstances|__buildingVisualDelta/.test(HTML),
  'failed 2B-2 local-instancing implementation and debug surfaces are physically absent');
ok(/canaries:new Set\(\['threejs-sculpt-dna','FSI-Gameday-General-Immersion-Day','Repolis'\]\)/.test(buildingLodPrototypeBlock)
  && /samples:new Set\(\['threejs-sculpt-dna','FSI-Gameday-General-Immersion-Day','Repolis','foundry-iq-demo-suite','Amazon-Bedrock-Guardrails-Toolkit','ECS-Immersion-Day','Deep-Learning-Hyperparameter-optimization','jenkins-dind','ISO-3166-alpha2-alpha3-korean'\]\)/.test(buildingLodPrototypeBlock)
  && /supportedKinds:new Set\(\['cabin','cottage','house','shop','tower','villa','manor','mansion'\]\)/.test(buildingLodPrototypeBlock)
  && /supportedRoofs:new Set\(\['flat','gable','hip','mansard','barrel','shed','aframe','gambrel'\]\)/.test(buildingLodPrototypeBlock)
  && /reason:'unsupported-typology'/.test(buildingLodPrototypeBlock), '2C-B retains permanent canaries and explicit full-visual fallback diagnostics for unknown typologies');
ok(/function _withBuildingLodPrivateRandom\(fn\)/.test(buildingLodPrototypeBlock)
  && /finally \{ Math\.random=globalRandom; \}/.test(buildingLodPrototypeBlock)
  && /memoryBudget:1024\*1024/.test(buildingLodPrototypeBlock)
  && /proxy-memory-budget-exceeded/.test(buildingLodPrototypeBlock), '2C-A constructors consume private RNG and enforce a two-megabyte proxy budget');
ok(/fullEnter:280,fullLeave:240,midEnter:60,midLeave:48,settle:3,cadence:8,minDwellFrames:24/.test(buildingLodPrototypeBlock)
  && /entry\.pendingCount>=BUILDING_LOD_PROTO\.thresholds\.settle/.test(buildingLodUpdateBlock)
  && !/(?:traverse|Box3|new THREE|sort\()/.test(buildingLodUpdateBlock), 'projected-size hysteresis updates without traversal, geometry, sorting, or allocation');
ok(/const functional=new THREE\.Group\(\),full=new THREE\.Group\(\),mid=new THREE\.Group\(\),far=new THREE\.Group\(\),active=new THREE\.Group\(\)/.test(buildingLodPrototypeBlock)
  && /repo\._lodPrototype=entry/.test(buildingLodPrototypeBlock)
  && /repo\._body=body/.test(HTML) && /repo\._windows=\[\]/.test(HTML) && /repo\._group=g; repo\._pos=/.test(HTML), '2C-A preserves stable functional and action references under the existing repository root');
ok(/attribute float aLit; attribute float aJitter; attribute float aActivity/.test(buildingLodPrototypeBlock)
  && /BUILDING_LOD_NIGHT\.value=night\?1:0/.test(HTML)
  && /_syncBuildingLodFacade\(repo\)/.test(HTML)
  && /THREE\.UniformsUtils\.clone\(THREE\.UniformsLib\.fog\)/.test(buildingLodPrototypeBlock)
  && (buildingLodPrototypeBlock.match(/fog:true/g)||[]).length===2
  && /originalSign:repo\._sign/.test(buildingLodPrototypeBlock), 'one shared facade shader preserves day/night window state and exact sign/emblem textures');
ok(/BuildingLOD_ShadowProxy/.test(buildingLodPrototypeBlock)
  && /shadowProxy\.scale\.set\(\.985,1,\.985\)/.test(buildingLodPrototypeBlock)
  && /depthPacking:THREE\.RGBADepthPacking/.test(buildingLodPrototypeBlock)
  && /shadowDepthMaterial\.polygonOffset=true/.test(buildingLodPrototypeBlock)
  && /shadowProxy\.layers\.set\(BUILDING_LOD_SHADOW_LAYER\)/.test(buildingLodPrototypeBlock)
  && /sun\.shadow\.camera\.layers\.enable\(BUILDING_LOD_SHADOW_LAYER\)/.test(buildingLodPrototypeBlock)
  && /if\(refreshTownShadows\) camera\.layers\.enable\(BUILDING_LOD_SHADOW_LAYER\)/.test(HTML)
  && /renderer\.render\(scene,camera\); camera\.layers\.set\(0\); _recordRenderPass\('base'/.test(HTML)
  && /_updateBuildingLodPrototype\(renderedFrame\)/.test(HTML), 'stable inset shadow proxies are independent of ordinary visual-tier updates');
ok(/_disposeBuildingLodPrototype\(\)/.test(buildingLodPrototypeBlock)
  && /resources\?\.geometries\.forEach\(geometry=>geometry\.dispose\(\)\)/.test(buildingLodPrototypeBlock)
  && /webglcontextrestored/.test(buildingLodPrototypeBlock), '2C-A owns and disposes proxy resources while retaining context lifecycle diagnostics');
ok(/gpu:frame\?_beginGpuTimer\(name,frame\):null/.test(HTML), 'GPU timers begin only inside an owned render-metrics frame');
ok(/invalidateTownShadows\('visit-bob-complete'\)/.test(HTML), 'visit bob completion refreshes the frozen town shadow exactly once');
ok(/createBarkTextures\(seed\)/.test(WORLD_TREE_FACTORY)
  && /roughnessMap: textures\?\.roughness/.test(WORLD_TREE_FACTORY) && /normalMap: textures\?\.normal/.test(WORLD_TREE_FACTORY)
  && /aoMap: textures\?\.ao/.test(WORLD_TREE_FACTORY) && !/(fetch|TextureLoader|GLTFLoader)\s*\(/.test(WORLD_TREE_FACTORY), 'factory generates independent bark PBR channels with no mesh/texture fetch');
ok(!/hero\.ground\.(ground|rocks)\.visible=false/.test(memorialTreeBlock)
  && /root\.scale\.setScalar\(MEM_TREE_HERO_SCALE\)/.test(memorialTreeBlock)
  && /scene\.add\(root\)/.test(memorialTreeBlock), 'thin adapter keeps the full factory in the main depth scene for correct occlusion');
ok(/if\(!o\.visible\|\|!o\.geometry\|\|o\.isSprite\) return/.test(memorialTreeBlock)
  && /if\(o\.isInstancedMesh\)\{ o\.computeBoundingBox\(\); local=o\.boundingBox; \}/.test(memorialTreeBlock), 'tree bounds include every instanced transform but exclude view-facing glow sprites');
ok(/root\.traverse\(o=>\{ if\(o\.isMesh\) o\.castShadow=false; \}/.test(memorialTreeBlock), 'live factory motion cannot leave stale tree shadows under the town frozen-shadow policy');
ok(/const collider=\{x,z,r:11\.6,_memorialTree:true\}; EXTRA_COLLIDERS\.push\(collider\)/.test(memorialTreeBlock)
  && /new THREE\.RingGeometry\(memorial\?12\.2:2\.9,memorial\?13\.6:3\.8/.test(HTML), '11.6 Solar root-island collider stays inside the widened 12.2-radius park path');
ok(/if\(!memorial\)\{ flowerPatch\([\s\S]*?makeRock\([\s\S]*?world-tree path stays fully open/.test(HTML), 'legacy park flowers/rock are omitted from the memorial ring path (no visual clipping or obstruction)');
ok((WORLD_TREE_FACTORY.match(/new THREE\.PointLight/g)||[]).length===1
  && /o\.name='WorldTree_GuideLight'; o\.castShadow=false/.test(memorialTreeBlock)
  && /MEMORIAL_TREE\.hero\.update\(elapsed\)/.test(memorialTreeBlock)
  && /_memHeroUpdate\(clock\.elapsedTime\)/.test(HTML), 'factory owns one shadowless guide light and runs its original pulse + living-tree update');
ok(/const pulse = 1\.48 \+ Math\.sin\(elapsedSeconds \* 2\.1\) \* 0\.1/.test(WORLD_TREE_FACTORY)
  && /energy\.light\.intensity = 16 \+ Math\.sin\(elapsedSeconds \* 1\.7\) \* 3/.test(WORLD_TREE_FACTORY)
  && /livingSystem\.rotation\.z = Math\.sin/.test(WORLD_TREE_FACTORY), 'energy copies use a bounded pulse while the guide light, foliage, and living-system motion remain intact');
ok(/customSockets=\{TaxiArrival:/.test(memorialTreeBlock)
  && /\['left-foundation:tip','right-foundation:tip','left-crown:tip','right-crown:tip'/.test(memorialTreeBlock), 'adapter preserves six Repolis sockets plus eight action-ready factory bough sockets');
ok(/root\.userData\.repolisAdapter=\{factoryUnmodified:false,factorySourceModified:true,factoryRevision:REPOLIS_FACTORY_REVISION,energyRevision:hero\.runtime\.nodes\['energy-network'\]\?\.userData\.energyRevision\|\|REPOLIS_FACTORY_REVISION,energyProfile:hero\.stats\.energyProfile,groundVisible:true,pulseDisabled:false[\s\S]*?selectiveBloom:true,sharpGlowInBase:true,depthAware:true,unlitExtraction:true,distanceCompensated:false,emissionPolicy:'constant-world-luminance'/.test(memorialTreeBlock),
  'runtime metadata records the selected energy profile and constant-luminance depth-aware selective bloom');
ok(/treeBox=_memHeroBox\(MEMORIAL_TREE\.group\)\.expandByScalar\(3\)/.test(HTML)
  && /const g=b\._body\|\|b\._group/.test(HTML)
  && /WorldTree_BuildingDepthProxies/.test(HTML) && /WorldTree_PropDepthProxies/.test(HTML)
  && (HTML.match(/frustumCulled=false/g)||[]).length>=3
  && /WorldTree_DynamicDepthProxies/.test(HTML)
  && /RESIDENTS_LIVE\.forEach\(L=>_registerWorldTreeOccluderGroup\(L\.group\)\)/.test(HTML), 'three instanced proxy draws cover static buildings, props, and nearby moving avatars');
ok(/_registerWorldTreeOccluderGroup\(g\)/.test(HTML)
  && /_unregisterWorldTreeOccluderGroup\(p\.group\)/.test(HTML)
  && /dynamicOccluderGroups\.delete/.test(HTML), 'remote peer avatar proxies enter and leave the bloom depth cache without leaks');
ok(/const bloomRoots=\[\.\.\.crowns,hero\.runtime\.nodes\['energy-network'\],hero\.runtime\.meshes\['gold-code-glyphs'\]/.test(memorialTreeBlock)
  && /const bloomMeshes=new Set\(\)/.test(memorialTreeBlock) && /const bloomBySource=new Map/.test(memorialTreeBlock)
  && /amber:_worldTreeBloomMaterial\(hero\.variant\.amber,0\.4,true/.test(memorialTreeBlock)
  && /cyan:_worldTreeBloomMaterial\(hero\.variant\.cyan,0\.55,true/.test(memorialTreeBlock)
  && /energy:_worldTreeBloomMaterial\(hero\.variant\.energy,4,true/.test(memorialTreeBlock)
  && /function _withWorldTreePrivateRandom\(fn\)/.test(HTML)
  && /pendant:_withWorldTreePrivateRandom\(\(\)=>_worldTreeBloomMaterial\(hero\.variant\.energy,1\.35,true/.test(memorialTreeBlock)
  && /glyphGold:_worldTreeBloomMaterial\(hero\.variant\.energy,1\.75,false/.test(memorialTreeBlock)
  && /glyphCyan:_worldTreeBloomMaterial\(hero\.variant\.cyan,1\.9,false/.test(memorialTreeBlock)
  && /if\(o\.isMesh\)\{ o\.layers\.set\(0\); if\(night&&MEMORIAL_TREE\.bloomExtractMeshSet\.has\(o\)\) o\.layers\.enable\(MEM_TREE_LIGHT_LAYER\)/.test(memorialTreeBlock)
  && /depthMaterials=new Set\(\[hero\.materials\.bark,hero\.materials\.ground,hero\.materials\.cutWood\]\)/.test(memorialTreeBlock)
  && /else if\(depthMaterials\.has\(mesh\.material\)\) bloomExtractEntries\.push\(\{mesh,baseMaterial:mesh\.material,bloomMaterial:BLOOM_DARK_MATERIAL\}\)/.test(memorialTreeBlock)
  && /hero\.runtime\.nodes\.constellations\?\.traverse\(n=>\{ if\(n\.isMesh&&n\.material===hero\.materials\.ornamentEnergy\)/.test(memorialTreeBlock)
  && /\[hero\.materials\.ornamentEnergy,bloomMaterials\.pendant\]/.test(memorialTreeBlock)
  && /pendantBloomMeshes=bloomExtractEntries\.filter\(entry=>entry\.baseMaterial===hero\.materials\.ornamentEnergy\)\.length/.test(memorialTreeBlock)
  && /bloomLights\.forEach\(light=>light\.layers\.set\(MEM_TREE_LIGHT_LAYER\)\)/.test(memorialTreeBlock)
  && !/const bloomRoots=\[[^\n]*constellations/.test(memorialTreeBlock)
  && !/WorldTree_(Key|CoolRim|WarmFill|FrontFill)/.test(memorialTreeBlock), 'one energy-led leaf/glyph/knot/vein hierarchy uses dark branch depth occlusion without unrelated tree draws');
ok(/requestedTreeVisible=MEMORIAL_TREE\?MEMORIAL_TREE\.requestedVisible!==false:false/.test(HTML)
  && /MEMORIAL_TREE\.group\.visible=requestedTreeVisible/.test(HTML)
  && /finalMix\.uniforms\.bloomWeight\.value=needBloom\?1:0/.test(HTML)
  && /finalMix\.uniforms\.baseTexture\.value=emissiveOnly\?emissiveTarget\.texture:baseTarget\.texture/.test(HTML)
  && /WORLD_TREE_RENDER_MODE==='bloom-only'\|\|\(emissiveOnly&&!treeVisible\)\?0:1/.test(HTML)
  && !/emissiveWeight/.test(HTML), 'production final composite samples only base + bloom; emissive-only reuses the base sampler for debug');
ok(/bloomUvScale:\{value:new THREE\.Vector2\(1,1\)\}/.test(HTML)
  && /bloomUvOffset:\{value:new THREE\.Vector2\(\)\}/.test(HTML)
  && /vec2 bloomUv=vUv\*bloomUvScale\+bloomUvOffset/.test(HTML)
  && /function _updateWorldTreeBloomProjection\(\)/.test(HTML)
  && /function _captureWorldTreeBloomProjection\(\)/.test(HTML)
  && /bloomCaptureBounds\.copy\(MEMORIAL_TREE\.bloomCurrentBounds\)/.test(HTML)
  && /shiftPx>Math\.max\(innerWidth,innerHeight\)\*0\.35/.test(HTML)
  && /MEMORIAL_TREE\.bloomReprojectionRejectedFrames\+\+/.test(HTML)
  && /else if\(needBloom&&MEMORIAL_TREE&&MEMORIAL_TREE\.bloomCaptureValid&&MEMORIAL_TREE\.bloomReprojectionPx>0\.01\) MEMORIAL_TREE\.bloomReprojectedFrames\+\+/.test(HTML)
  && /bloomMotion:adapter\.bloomMotion/.test(HTML)
  && /bloomReprojectionMaxPx:\+MEMORIAL_TREE\.bloomReprojectionMaxPx\.toFixed\(2\)/.test(HTML)
  && /bloomMotion:'captured-bounds-current-camera-uv-reprojection'/.test(memorialTreeBlock),
  'throttled bloom is reprojected from captured tree bounds into the current camera projection without another render pass');
ok(/bloomBounds:\{value:new THREE\.Vector4\(0,0,1,1\)\}/.test(HTML)
  && /bounds\.set\(Math\.max\(0,current\.x\)/.test(HTML)
  && /float signal=smoothstep\(0\.018,0\.05,max\(bloom\.r,max\(bloom\.g,bloom\.b\)\)\)/.test(HTML)
  && /color\+=bloom\*\(bloomWeight\*mx\*my\*signal\*uvMask\)/.test(HTML)
  && /gl_FragColor=vec4\(color,1\.0\)/.test(HTML),
  'tree bloom is softly bounded to the projected tree screen rectangle instead of lifting town exposure globally');
ok(/ratio=MEM_TREE_HERO_SCALE\/MEM_TREE_HERO_NATIVE_SCALE/.test(memorialTreeBlock)
  && !/MEMORIAL_TREE\.light\.intensity\*=/.test(memorialTreeBlock)
  && /MEMORIAL_TREE\.light\.distance=7\*ratio/.test(memorialTreeBlock), 'factory PointLight keeps its authored local range and exact pulse intensity');
ok(/if\(isNight\)\{ m\.bark\.emissive\.setHex\(0x4f240c\); m\.bark\.emissiveIntensity=0\.14; m\.ornamentEnergy\.emissiveIntensity=1\.9\+Math\.sin\(elapsed\*2\.3\)\*0\.08; m\.amberLeaf\.emissiveIntensity=0\.58; m\.cyanLeaf\.emissiveIntensity=0\.78/.test(memorialTreeBlock)
  && /if\(REDUCED\)\{ m\.energy\.emissiveIntensity=1\.3; MEMORIAL_TREE\.light\.intensity=18/.test(memorialTreeBlock)
  && /else \{ m\.bark\.emissive\.setHex\(0x603016\)/.test(memorialTreeBlock)
  && /m\.energy\.emissiveIntensity=0\.28; m\.ornamentEnergy\.emissiveIntensity=0\.36; m\.amberLeaf\.emissiveIntensity=0\.28; m\.cyanLeaf\.emissiveIntensity=0\.34/.test(memorialTreeBlock)
  && /_setWorldTreeGlowLayers\(night\)/.test(HTML)
  && /worldBloom\.strength=night\?1\.35:0\.04/.test(HTML), 'day calms ornaments while night gives every amber/cyan leaf a readable emissive base');
ok(/effectPhase=isNight\|\|WORLD_TREE_RENDER_MODE==='emissive-only'\|\|WORLD_TREE_RENDER_MODE==='bloom-only'/.test(HTML), 'day/dawn/dusk final mode skips emissive and bloom HDR passes entirely');
ok(/forceProofLayer=!isNight&&\(WORLD_TREE_RENDER_MODE==='emissive-only'\|\|WORLD_TREE_RENDER_MODE==='bloom-only'\)/.test(HTML)
  && /if\(forceProofLayer\) _setWorldTreeGlowLayers\(true\)/.test(HTML)
  && /if\(forceProofLayer\) _setWorldTreeGlowLayers\(false\)/.test(HTML), 'daytime emissive/bloom proof modes restore visual dual-layers and keep PointLight effect-only');
ok((HTML.match(/bloomLights\.forEach\(light=>\{ light\.visible=requestedTreeVisible/g)||[]).length>=2
  && /guideLightInBase:false[\s\S]*?emissiveHalos:2/.test(memorialTreeBlock)
  && /light\.layers\.set\(MEM_TREE_LIGHT_LAYER\)/.test(memorialTreeBlock)
  && /_beginWorldTreeBloomExtraction\(\)/.test(HTML) && /finally\{ _endWorldTreeBloomExtraction\(\); \}/.test(HTML),
  'factory PointLight stays local to layer 2 while additive halos preserve ambient radiance without town spill');
ok(/const distance=camera\.position\.distanceTo\(MEMORIAL_TREE\.glowWorld\),far=THREE\.MathUtils\.clamp\(\(distance-35\)\/95,0,1\)/.test(HTML)
  && /worldBloom\.strength=1\.35; worldBloom\.radius=0\.58; worldBloom\.threshold=0\.06/.test(HTML)
  && /distanceCompensated:false,emissionPolicy:'constant-world-luminance'/.test(memorialTreeBlock),
  'distance is diagnostic only; branch/leaf/glyph bloom luminance stays constant near and far');
ok(/MEM_TREE_BLOOM_HZ=LOW_END\?20:30, MEM_TREE_DESKTOP_BLOOM_MIN_FRAME_GAP=3/.test(HTML)
  && /const _treeBloomMinFrameGap=\(\)=>_desktopFrameDropGuard\(\)\?MEM_TREE_DESKTOP_BLOOM_MIN_FRAME_GAP:0/.test(HTML)
  && /bloomFrameGap=_treeBloomMinFrameGap\(\)/.test(HTML)
  && /\(!bloomFrameGap\|\|renderedFrame-MEMORIAL_TREE\.lastBloomFrame>=bloomFrameGap\)&&now-MEMORIAL_TREE\.lastBloomAt>=1000\/MEM_TREE_BLOOM_HZ/.test(HTML)
  && /lastBloomAt:-Infinity,lastBloomFrame:-Infinity,bloomDirty:true/.test(memorialTreeBlock)
  && /MEMORIAL_TREE\.lastBloomFrame=renderedFrame/.test(HTML),
  'the glow cache keeps its 20–30Hz ceiling, adds a slow-frame guard only on fine-pointer desktop, and keeps mobile time-driven');
ok(/pulse=REDUCED\?1:\(0\.93\+Math\.sin\(elapsed\*1\.5\)\*0\.07\)/.test(memorialTreeBlock),
  'reduced-motion keeps the additive world-tree halos steady');
ok(/geometry\.translate\(0, -REPOLIS_LEAF_ATTACHMENT\.rootLocalY, 0\)/.test(WORLD_TREE_FACTORY)
  && /REPOLIS_LEAF_ATTACHMENT\.rootPivotScale/.test(WORLD_TREE_FACTORY)
  && /geometry\.translate\(0, REPOLIS_LEAF_ATTACHMENT\.rootLocalY, 0\)/.test(WORLD_TREE_FACTORY)
  && !/geometry\.scale\(1\.22,1\.22,1\.22\)/.test(memorialTreeBlock)
  && /leafScale:1\.22,leafScaleMode:'factory-root-pivot'/.test(memorialTreeBlock),
  'factory enlarges leaf cards around their root pivot while the adapter leaves attachment geometry unchanged');
ok(/renderer\.setRenderTarget\(emissiveTarget\)[\s\S]*?renderer\.render\(scene,camera\);[\s\S]*?_recordRenderPass\('emissive'[\s\S]*?treeComposer\.render\(\)/.test(HTML)
  && /renderer\.shadowMap\.needsUpdate=refreshTownShadows; renderer\.setRenderTarget\(baseTarget\)/.test(HTML)
  && /renderer\.shadowMap\.needsUpdate=false/.test(HTML), 'one measured linear emissive render feeds bloom after the optional town shadow refresh is consumed');
ok(/const _DIAGNOSTICS = _DBG \|\| _QUERY\.get\('perf'\)==='1'/.test(HTML)
  && /renderer\.info\.autoReset = !_DIAGNOSTICS/.test(HTML)
  && /function _beginRenderMetrics\(idle\)\{\n  if\(!_DIAGNOSTICS\) return;/.test(HTML)
  && /function _beginMeasuredPass\(name\)\{ if\(!_DIAGNOSTICS\) return null;/.test(HTML)
  && /function _recordRenderPass\(name,token\)\{ if\(!_DIAGNOSTICS\|\|!RENDER_METRICS\.current\) return;/.test(HTML)
  && /function _endRenderMetrics\(\)\{\n  if\(!_DIAGNOSTICS\) return;/.test(HTML)
  && /if\(_DIAGNOSTICS\) _installGpuTimer\(\)/.test(HTML)
  && /if\(_DIAGNOSTICS\) _installShadowMetrics\(\)/.test(HTML)
  && /renderer\.info\.reset\(\)/.test(HTML)
  && /GPU_TIMER\.ext=typeof WebGL2RenderingContext!=='undefined'[\s\S]*?getExtension\('EXT_disjoint_timer_query_webgl2'\)/.test(HTML)
  && /function _suspendGpuTimer\(\)\{ GPU_TIMER\.supported=false; GPU_TIMER\.ext=null; GPU_TIMER\.pending\.length=0; GPU_TIMER\.active=false; \}/.test(HTML)
  && /webglcontextlost'[\s\S]*?_suspendGpuTimer\(\)/.test(HTML)
  && /GPU_TIMER\.gl\.isContextLost\(\)/.test(HTML)
  && /pass\.cpuMs=\+\(performance\.now\(\)-token\.startedAt\)\.toFixed\(3\)/.test(HTML)
  && /token\.frame\.gpuMs\[token\.name\]/.test(HTML)
  && /if\(!document\.hidden\) RENDER_METRICS\.lastStartedAt=0/.test(HTML)
  && /function _installShadowMetrics\(\)/.test(HTML)
  && /wrapped\.__repolisMetrics=true; shadowMap\.render=wrapped/.test(HTML)
  && /webglcontextrestored'[\s\S]*?invalidateTownShadows\('context-restored'\)/.test(HTML)
  && /_recordRenderPass\('base'/.test(HTML) && /_recordRenderPass\('bloom'/.test(HTML) && /_recordRenderPass\('final'/.test(HTML)
  && /base\.calls=Math\.max\(0,base\.calls-shadow\.calls\)/.test(HTML)
  && /base\.cpuMs=Math\.max\(0,base\.cpuMs-shadow\.cpuMs\)/.test(HTML)
  && /window\.__perfHistory=/.test(HTML) && /window\.__perfReset=/.test(HTML)
  && /window\.__perfDiagnostics=/.test(HTML)
  && /if\(_DIAGNOSTICS\)\{ const _debugVec=/.test(HTML), 'production render diagnostics take a no-allocation fast path while dbg/perf preserves full pass metrics');
ok(/const WORLD_TREE_SAVED_CLEAR=new THREE\.Color\(\)/.test(HTML)
  && /renderer\.getClearColor\(WORLD_TREE_SAVED_CLEAR\)/.test(HTML)
  && /lastFrame=_now; renderedFrame\+\+/.test(HTML), 'production reuses the clear-color temp and keeps a standalone rendered-frame LOD cadence counter');
ok(/const CAMERA_FOLLOW_TARGET=new THREE\.Vector3\(\)/.test(HTML)
  && /CAMERA_FOLLOW_TARGET\.set\([^)]+\); camera\.position\.lerp\(CAMERA_FOLLOW_TARGET,0\.12\)/.test(HTML)
  && !/camera\.position\.lerp\(new THREE\.Vector3/.test(HTML), 'camera follow reuses one non-escaping target vector per frame');
ok(/WORLD_TREE_BLOOM_POSITION=new THREE\.Vector3\(\)[\s\S]*?WORLD_TREE_BLOOM_WORLD=new THREE\.Vector3\(\)/.test(HTML)
  && /bloomMaterialList:Object\.values\(bloomMaterials\)/.test(HTML)
  && !/(?:new THREE|Object\.values|\[min\.|\[max\.)/.test(worldTreeBloomPrepBlock)
  && !/(?:new THREE|Object\.values|\[min\.|\[max\.)/.test(worldTreeBloomProjectionBlock)
  && /for\(let corner=0;corner<8;corner\+\+\)/.test(worldTreeBloomProjectionBlock), 'World Tree bloom preparation and per-frame camera reprojection reuse matrix/vector/material/corner storage without steady allocations');
ok(/window\.__cam=\(\)=>\(\{[\s\S]*?camera:\{position:_debugVec\(camera\.position\),quaternion:/.test(HTML)
  && /window\.__setPerfPose=/.test(HTML)
  && /window\.__perfActivity=/.test(HTML)
  && /window\.__rtPause=/.test(HTML)
  && /const _effectiveIdle=\(now=performance\.now\(\)\)=>DEBUG_FORCE_ACTIVITY===null\?\(now-lastAct\)>1200:!DEBUG_FORCE_ACTIVITY/.test(HTML)
  && /idleCap:_effectiveIdle\(\)/.test(HTML)
  && /window\.__sceneCensus=/.test(HTML)
  && /coverageSumPct:/.test(HTML)
  && /window\.__worldTreeHaloPixels=/.test(HTML), 'P0 debug probes expose actual camera pose, contributor census, and apparent halo pixels');
ok(/const TOWN_SHADOW=\{dirty:true,reason:'initial-scene'[\s\S]*?minIntervalMs:125,minAngle:0\.004/.test(HTML)
  && /function applySky\(t,forceShadow=false\)/.test(HTML)
  && /_trackSunShadowDirection\(sun\.position,forceShadow\)/.test(HTML)
  && /applySky\(skyT,skyT===skyTarget\)/.test(HTML)
  && /applySky\(skyT,true\); setNightState\(night\)/.test(HTML)
  && /invalidateTownShadows\('night-state'\)/.test(HTML)
  && /invalidateTownShadows\('world-tree-added'\)/.test(HTML)
  && /_beginRenderMetrics\(_idle\); _renderWorldTreeFrame\(\); _endRenderMetrics\(\)/.test(HTML)
  && !/_renderWorldTreeFrame\(!_idle\)/.test(HTML)
  && (HTML.match(/renderer\.shadowMap\.needsUpdate=true/g)||[]).length===0, 'shadow invalidation follows sun/topology/night state, never user activity');
ok(/b\.g\._bobbing=false; BOBS\.splice\(i,1\); invalidateTownShadows\('visit-bob-complete'\)/.test(HTML),
  'building visit bob keeps the frozen shadow during motion and refreshes once after exact scale restoration');
ok(/function disableDynamicShadowCasters\(root\)\{ root\.traverse\(o=>\{ if\(o\.isMesh\) o\.castShadow=false; \}\)/.test(HTML)
  && /function regSway\(g,amp\)\{ g\.userData\.sway=/.test(HTML)
  && !/function regSway\(g,amp\)\{ disableDynamicShadowCasters\(g\)/.test(HTML)
  && /return disableDynamicShadowCasters\(c\)/.test(HTML)
  && /disableDynamicShadowCasters\(wheel\)/.test(HTML) && /disableDynamicShadowCasters\(spin\)/.test(HTML)
  && /disableDynamicShadowCasters\(taxi\)/.test(HTML) && /disableDynamicShadowCasters\(model\)/.test(HTML)
  && /disableDynamicShadowCasters\(g\); scene\.add\(g\)/.test(HTML)
  && /return disableDynamicShadowCasters\(g\)/.test(HTML), 'moving avatars, NPCs, pets, and rides use blob/contact shadows while gently swaying town trees retain their frozen static shadows');
ok(/AURORA_OP\.value=Math\.min\(0\.55\+\(_auroraBoost>0\?0\.45:0\), AURORA_OP\.value\+dt\*0\.5\)/.test(HTML),
  'Aurora keeps the 1.77.2 night intensity; performance work does not dim the global night art');
ok(/pointLightRole:'runtime-topology-only'/.test(memorialTreeBlock)
  && /haloMode:'world-space-constant-emission'/.test(memorialTreeBlock)
  && /branchGlow:'base-emissive-only'/.test(memorialTreeBlock)
  && /bloomSources:\['leaves','glyphs','energy-core-knots','energy-veins','branch-end-ornaments'\]/.test(memorialTreeBlock)
  && !/bark:_worldTreeBloomMaterial/.test(memorialTreeBlock)
  && /branchGlowMeshes=0, branchDepthMeshes=bloomExtractEntries\.filter\(entry=>entry\.baseMaterial===hero\.materials\.bark\)\.length/.test(memorialTreeBlock),
  'metadata records the tree-only emissive hierarchy while bark remains a dark depth occluder');
ok(/window\.__memorialTree=/.test(HTML) && /window\.__tpMemorialTree=/.test(HTML)
  && /_memHeroObjectPerf\(MEMORIAL_TREE\.group\)/.test(HTML) && /window\.__frameMemorialTree=/.test(HTML)
  && /window\.__worldTreeRenderMode=/.test(HTML) && /window\.__worldTreeRenderTargets=/.test(HTML)
  && /window\.__freezeWorldForExposure=/.test(HTML)
  && /window\.__memorialTreeVisible=/.test(HTML) && /window\.__memorialTreeCollision=/.test(HTML), '?dbg exposes five render modes, linear targets, frozen exposure A/B, factory stats, and collision');
ok(/const SKY_DETAIL=LOW_END\?0\.42:\(IS_MOBILE\?0\.58:0\.72\)/.test(HTML)
  && /for\(let i=0;i<skyDetail\(3200\);i\+\+\)/.test(HTML), 'night star and Milky Way density scale below the hero scene detail budget');
ok(/const nebulaLayer=\(count,core\)=>/.test(HTML)
  && /nebulaLayer\(skyDetail\(95\),false\); nebulaLayer\(skyDetail\(26\),true\)/.test(HTML), '121 nebula sprites collapse into two additive point batches');
ok(/new THREE\.InstancedMesh\(CLOUD_GEO,CLOUD_MAT,cloudPuffs\.length\)/.test(HTML)
  && /instanceMatrix\.setUsage\(THREE\.DynamicDrawUsage\)/.test(HTML)
  && /CLOUD_MAT=new THREE\.MeshBasicMaterial\(\{[^}]*depthWrite:false/.test(HTML)
  && /if\(!force&&cloudStep<0\.05\) return/.test(HTML), 'cloud puffs share one instanced draw and update at 20Hz');

console.log('\n──────────────────────────────');
console.log(fail === 0 ? '✅ ALL GREEN — ' + pass + ' checks passed' : '❌ ' + fail + ' FAILED / ' + pass + ' passed');
if (fail) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail === 0 ? 0 : 1);
