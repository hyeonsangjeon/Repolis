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

/* ── 5) Train Network v0: station knowledge-district single-hop travel ── */
group('station districts (Train Network v0) wiring');
ok(/const\s+DISTRICTS\s*=\s*\[/.test(HTML), 'DISTRICTS table exists');
ok(/id=["']stationDistricts["']/.test(HTML), '#stationDistricts container in station modal');
ok(/function\s+renderDistricts\s*\(/.test(HTML), 'renderDistricts() builder exists');
ok(/renderStation\s*\(\s*\)\s*\{[\s\S]{0,120}renderDistricts\s*\(\s*\)/.test(HTML), 'renderStation() calls renderDistricts()');
ok(/lmCourseDest\s*\(\s*d\.id\s*\)/.test(HTML), 'district resolves its destination via lmCourseDest(id)');
ok(/if\s*\(\s*!dest\s*\)\s*return/.test(HTML), 'absent districts are skipped (public-town graceful degrade)');
ok(/taxiTo\s*\(\s*dest\s*\)/.test(HTML), 'district button rides via taxiTo(dest)');
ok(/track\(\s*['"]district_ride['"]/.test(HTML), 'district ride is tracked');
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

/* ── 7) chronoMatch: a repo's "관련 토론 보기" link must reflect its own identity, not incidental plumbing ──
 *    Regression guard for the youtube-dl-nas → Chronopolis(HTTP) mis-route: the repo merely uses
 *    bottle/websocket/login-system, so it must NOT match the HTTP-status debate. Runs the REAL shipped
 *    chronoMatch (extracted from index.html) against the REAL repos.json + council fixtures. */
group('chronoMatch anchors on domain-specific tags (no spurious debate routing)');
ok(/const CHRONO_GENERIC_TAGS\s*=\s*new Set\(/.test(HTML), 'CHRONO_GENERIC_TAGS stoplist exists');
ok(/if\(toks\.has\(tg\)\s*&&\s*!CHRONO_GENERIC_TAGS\.has\(tg\)\)/.test(HTML), 'chronoMatch ignores generic/plumbing tags when scoring');
ok(/data-preset="\$\{esc\(relId\)\}"/.test(HTML), 'relChrono button binds its target to the card repo (data-preset)');
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

console.log('\n──────────────────────────────');
console.log(fail === 0 ? '✅ ALL GREEN — ' + pass + ' checks passed' : '❌ ' + fail + ' FAILED / ' + pass + ' passed');
if (fail) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail === 0 ? 0 : 1);
