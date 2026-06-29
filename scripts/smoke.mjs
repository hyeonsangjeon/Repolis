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

/* ── 5) inline <script type=module> still parses ── */
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

console.log('\n──────────────────────────────');
console.log(fail === 0 ? '✅ ALL GREEN — ' + pass + ' checks passed' : '❌ ' + fail + ' FAILED / ' + pass + ' passed');
if (fail) { console.log('\nFailures:'); fails.forEach(f => console.log('  - ' + f)); }
process.exit(fail === 0 ? 0 : 1);
