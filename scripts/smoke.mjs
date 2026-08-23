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
import { runInNewContext } from 'vm';
import { runNpcBudgetGovernorTests } from './test-npc-budget-governor.mjs';
import { runResidentDialogueTests } from './test-resident-dialogue.mjs';
import { runResidentRuntimeTests } from './test-resident-runtime.mjs';
import {
  CAMERA_OBSTRUCTION_DEFAULTS,
  CAMERA_ARRIVAL_OFFSETS,
  resolveCameraObstruction,
  stepCameraResolvedDistance,
  chooseCameraArrivalYaw
} from '../assets/camera-obstruction.js';
import { CANAL_FERRY_DEFAULTS, sampleCanalFerryRoute } from '../assets/canal-ferry.js';
import { RAIN_GARDEN_DEFAULTS, sampleRainGarden, seedRainDrop, wrapRainDropY } from '../assets/rain-garden.js';
import { summarizePublicTown } from '../assets/public-town-proof.js';
import {
  POSTCARD_FORMATS,
  createTownPostcardIdentity,
  createTownReadmePortal,
  summarizeTownRepos,
  postcardFormatForViewport,
  postcardCaptureSize,
  analyzeTownFrame,
  flipPixelRows
} from '../assets/town-postcard.js';
import { createTwinTownLink, createTwinTownMatch, summarizeTwinTown } from '../assets/twin-towns.js';
import { selectTownCreatorFields, summarizeTownCreator } from '../assets/town-creator.js';
import { buildTownGrowthTimeline, createTownGrowthShareUrl, townGrowthIndexForYear, townGrowthSnapshot } from '../assets/town-growth.js';
import {
  REPO_PORTAL_LIMITS,
  createRepoOwnerTownUrl,
  createRepoPortalUrl,
  parseRepoPortalInput,
  projectPublicRepo,
  projectPublicRepos,
  repoPortalLatencyBucket,
  resolveRepoPortalRequest
} from '../assets/repo-portal.js';
import {
  REPO_ROUTE_LIMITS,
  createRepoRouteUrl,
  normalizeRepoRouteNames,
  resolveRepoRouteRequest
} from '../assets/repo-route.js';
import {
  CONTRIBUTION_QUEST_LIMITS,
  createContributionQuestSearchUrl,
  projectContributionQuest,
  selectContributionQuests
} from '../assets/contribution-quests.js';
import {
  WEAR_THRESHOLDS_DAYS,
  classifyBuildingWear,
  cityReferenceTimestamp,
  resolveCitySeason,
  seasonPalette
} from '../assets/city-time.js';
import {
  SAP_FLOW_LIMITS,
  WORLD_TREE_GROWTH_LIMITS,
  projectWorldTreeChronicle,
  projectWorldTreeGrowth,
  resolveSapFlowFreshness,
  resolveSapFlowMode
} from '../assets/world-tree/world-tree-state.js';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(join(ROOT, 'index.html'), 'utf8');
const README_EN = readFileSync(join(ROOT, 'README.md'), 'utf8');
const README_KO = readFileSync(join(ROOT, 'README.ko.md'), 'utf8');
const AGENTS_GUIDE = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
const CHANGELOG = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
const DOMAIN_MODEL = readFileSync(join(ROOT, 'docs/domain-model.md'), 'utf8');
const KNOWN_LIMITATIONS = readFileSync(join(ROOT, 'docs/known-limitations.md'), 'utf8');
const REPO_PORTAL_GUIDE = readFileSync(join(ROOT, 'docs/repo-portal-change-guide.md'), 'utf8');
const SHARE_LINKS = readFileSync(join(ROOT, 'examples/share-links.md'), 'utf8');
const MANIFEST = readFileSync(join(ROOT, 'repolis.yaml'), 'utf8');
const LLMS_INDEX = readFileSync(join(ROOT, 'llms.txt'), 'utf8');
const DEMO_EN = readFileSync(join(ROOT, 'assets/demo.gif'));
const DEMO_KO = readFileSync(join(ROOT, 'assets/demo.ko.gif'));
const LAUNCH_GIF_EN = readFileSync(join(ROOT, 'assets/launch.gif'));
const LAUNCH_GIF_KO = readFileSync(join(ROOT, 'assets/launch.ko.gif'));
const SOCIAL_PREVIEW = readFileSync(join(ROOT, 'assets/social-preview.png'));
const SCHOLARS_SRC = readFileSync(join(ROOT, 'scholars.js'), 'utf8');
const WORLD_TREE_FACTORY = readFileSync(join(ROOT, 'assets/world-tree/createRepolisHero.js'), 'utf8');
const LAUNCH_CONFIG_SRC = readFileSync(join(ROOT, 'repolis.config.js'), 'utf8');
const REFRESH_WORKFLOW = readFileSync(join(ROOT, '.github/workflows/refresh.yml'), 'utf8');
const REPO_BUILDER = readFileSync(join(ROOT, 'scripts/build_repos.py'), 'utf8');
const CAMERA_MATH_SRC = readFileSync(join(ROOT, 'assets/camera-obstruction.js'), 'utf8');
const POSTCARD_SRC = readFileSync(join(ROOT, 'assets/town-postcard.js'), 'utf8');
const PUBLIC_TOWN_PROOF_SRC = readFileSync(join(ROOT, 'assets/public-town-proof.js'), 'utf8');
const TWIN_TOWNS_SRC = readFileSync(join(ROOT, 'assets/twin-towns.js'), 'utf8');
const TOWN_CREATOR_SRC = readFileSync(join(ROOT, 'assets/town-creator.js'), 'utf8');
const TOWN_GROWTH_SRC = readFileSync(join(ROOT, 'assets/town-growth.js'), 'utf8');
const REPO_PORTAL_SRC = readFileSync(join(ROOT, 'assets/repo-portal.js'), 'utf8');
const REPO_ROUTE_SRC = readFileSync(join(ROOT, 'assets/repo-route.js'), 'utf8');
const CONTRIBUTION_QUEST_SRC = readFileSync(join(ROOT, 'assets/contribution-quests.js'), 'utf8');
const CITY_TIME_SRC = readFileSync(join(ROOT, 'assets/city-time.js'), 'utf8');
const WORLD_TREE_STATE_SRC = readFileSync(join(ROOT, 'assets/world-tree/world-tree-state.js'), 'utf8');
const CITY_STATE = JSON.parse(readFileSync(join(ROOT, 'data/city-state.json'), 'utf8'));
const CITY_STATE_SCHEMA = JSON.parse(readFileSync(join(ROOT, 'data/city-state.schema.json'), 'utf8'));
const CITY_REPOS = JSON.parse(readFileSync(join(ROOT, 'repos.json'), 'utf8'));
const CITY_STATE_BUILDER = readFileSync(join(ROOT, 'scripts/city_state.py'), 'utf8');
const CITY_STATE_VALIDATOR = readFileSync(join(ROOT, 'scripts/validate_city_state.py'), 'utf8');
const RESIDENT_RUNTIME_SRC = readFileSync(join(ROOT, 'assets/resident-profiles.js'), 'utf8');
const RESIDENT_DIALOGUE_SRC = readFileSync(join(ROOT, 'cloudflare-taxi/src/resident-dialogue.js'), 'utf8');
const RESIDENT_MANIFEST = JSON.parse(readFileSync(join(ROOT, 'data/residents/index.json'), 'utf8'));

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
ok(/@media \(max-width: 520px\) \{[^\n]*#mapBtn \{ order: 10; \}/.test(HTML),
  'the mobile map action wraps below the hamburger instead of overlapping it');
ok(/@media \(hover: none\) and \(pointer: coarse\) \{[\s\S]*?#prompt \{ left: 12px; right: 112px;[\s\S]*?white-space: normal/.test(HTML)
  && /#prompt\.show \{ transform: translateY\(0\); \}/.test(HTML),
  'mobile interaction prompts wrap inside a left lane reserved away from the round action button');

group('README hero leads with one current story, CTA, and bounded media');
const heroCopy = 'Public GitHub repos become a walkable 3D town. Traffic shapes the buildings, residents live there, and Gitber drives you to the right project.';
const heroCopyKo = 'Repolis는 공개 GitHub 레포를 직접 걸어 다니는 3D 마을로 바꿉니다. 트래픽이 건물을 만들고, 주민이 살아가며, 깃버가 원하는 프로젝트까지 데려갑니다.';
ok(README_EN.includes(`**${heroCopy}**`) && README_KO.includes(`**${heroCopyKo}**`), 'EN/KO heroes carry one copyable product sentence');
const heroOrderEn = [README_EN.indexOf(`**${heroCopy}**`), README_EN.indexOf('Open-Live%20Town'),
  README_EN.indexOf('assets/demo.gif'), README_EN.indexOf('🎬 <strong>15-second demo:</strong>'),
  README_EN.indexOf('<code>WASD</code> / touch to walk'), README_EN.indexOf('>Star Repolis</a>'), README_EN.indexOf('daily%20refresh')];
const heroOrderKo = [README_KO.indexOf(`**${heroCopyKo}**`), README_KO.indexOf('%EB%9D%BC%EC%9D%B4%EB%B8%8C-'),
  README_KO.indexOf('assets/demo.ko.gif'), README_KO.indexOf('🎬 <strong>15초 데모:</strong>'),
  README_KO.indexOf('<code>WASD</code> / 터치로 걷기'), README_KO.indexOf('>Star 남기기</a>'), README_KO.indexOf('daily%20refresh')];
ok(heroOrderEn.every(i => i >= 0) && heroOrderEn.every((i, n) => n === 0 || heroOrderEn[n - 1] < i), 'English hero orders story → live CTA → demo → caption → controls → Star → utility proof');
ok(heroOrderKo.every(i => i >= 0) && heroOrderKo.every((i, n) => n === 0 || heroOrderKo[n - 1] < i), 'Korean hero orders story → live CTA → demo → caption → controls → Star → utility proof');
ok(/traffic → buildings · ask Gitber → taxi ride → real repo card/.test(README_EN)
  &&/트래픽 → 건물 · 깃버에게 질문 → 택시 이동 → 실제 레포 카드/.test(README_KO), 'visible EN/KO captions describe what the existing demo proves');
ok(/<code>Enter<\/code> \/ tap to open · no sign-up or build/.test(README_EN)
  &&/<code>Enter<\/code> \/ 탭으로 열기 · 가입이나 빌드 없음/.test(README_KO), 'visible controls state the exact first interaction and friction-free setup');
ok((README_EN.match(/href="https:\/\/github\.com\/hyeonsangjeon\/Repolis">Star Repolis<\/a>/g)||[]).length===1
  &&(README_KO.match(/href="https:\/\/github\.com\/hyeonsangjeon\/Repolis">Star 남기기<\/a>/g)||[]).length===1, 'each hero contains exactly one calm repository Star CTA');
ok((HTML.split(heroCopy).length - 1) === 3 && !HTML.includes('6-pin grid'), 'description, Open Graph, and Twitter share the current positioning');
ok(/Try-My%20GitHub/.test(README_EN) && /template_name=Repolis&template_owner=hyeonsangjeon/.test(README_EN)
  &&/%EB%82%B4%20GitHub%EB%A1%9C%20%EB%B3%B4%EA%B8%B0/.test(README_KO), 'EN/KO heroes expose personal preview and template adoption above the demo');
ok(README_EN.indexOf('## What the demo proves') < README_EN.indexOf('## A village that lives')
  && README_KO.indexOf('## 이 데모가 보여 주는 것') < README_KO.indexOf('## 실제로 살아가는 마을'), 'proof and adoption appear before the long feature narrative');
ok(/No token, account connection, or fork is required/.test(README_EN)
  &&/토큰·계정 연결·포크가 필요 없습니다/.test(README_KO), 'personal preview states its real zero-auth boundary');
ok(/assets\/launch\.gif/.test(README_EN) && /assets\/launch\.ko\.gif/.test(README_KO)
  && README_EN.indexOf('assets/launch.gif') > README_EN.indexOf('**Fastest proof:**')
  && README_KO.indexOf('assets/launch.ko.gif') > README_KO.indexOf('**가장 빠른 확인:**'), 'each proof section shows the username→own-town capture right after its claim');
ok(LAUNCH_GIF_EN.subarray(0, 6).toString() === 'GIF89a' && LAUNCH_GIF_EN.readUInt16LE(6) === 520 && LAUNCH_GIF_EN.readUInt16LE(8) === 360
  && LAUNCH_GIF_KO.subarray(0, 6).toString() === 'GIF89a' && LAUNCH_GIF_KO.readUInt16LE(6) === 520 && LAUNCH_GIF_KO.readUInt16LE(8) === 360, 'EN/KO launch captures stay 520×360 GIF89a assets');
ok(LAUNCH_GIF_EN.length < 1.6 * 1024 * 1024 && LAUNCH_GIF_KO.length < 1.6 * 1024 * 1024, 'each launch capture stays inside its mobile weight budget');
ok(/no PAT required/.test(README_EN) && /PAT 불필요/.test(README_KO)
  &&/GH_PAT.*optional|optionally add the `GH_PAT`/s.test(README_EN), 'template metadata mode is PAT-free and traffic is clearly optional');
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

group('Launch Kit — personal preview + fork-safe runtime + PAT-optional refresh');
ok(/id="introLaunchForm"/.test(HTML) && /id="introUser"/.test(HTML) && /data-i18n="introLaunchGo"/.test(HTML), 'intro contains the bilingual username launchpad');
ok(/form\.onsubmit=e=>[\s\S]*?parseRepoPortalInput\(input\.value\)[\s\S]*?target\.kind==='repo'[\s\S]*?createRepoPortalUrl\(target,location\.href\)[\s\S]*?\?user='\+encodeURIComponent\(user\)/.test(HTML),
  'launchpad resolves usernames and repo targets while preserving the established public-town URL');
ok(/new URLSearchParams\(location\.search\)\.has\('launch'\)/.test(HTML), '?launch=1 focuses the personal preview field');
ok((HTML.match(/introLaunchLabel:/g)||[]).length===2 && (HTML.match(/introLaunchInvalid:/g)||[]).length===2, 'launchpad labels and errors are bilingual');
const townProof = summarizePublicTown('Octo-Cat', [
  { repo:'beacon', lang:'Rust', stars:3, forks:4 },
  { repo:'atlas', lang:'JavaScript', stars:9, forks:1 },
  { repo:'canopy', lang:'JavaScript', stars:9, forks:2 }
]);
ok(townProof.user==='Octo-Cat' && townProof.count===3 && townProof.stars===21 && townProof.languages===2
  && townProof.topRepos.join(',')==='canopy,atlas,beacon', 'personal-town proof truthfully summarizes loaded public metadata and ranks featured houses deterministically');
ok(/id="introPublicProof" hidden role="status" aria-live="polite"/.test(HTML)
  && /id="introTryAnother" type="button" data-i18n="introTryAnother"/.test(HTML)
  && /function renderPublicIntro\(\)/.test(HTML) && /introLaunchForm\.hidden=ready/.test(HTML)
  && /introPublicProof\.hidden=!ready/.test(HTML), 'a completed public town replaces the duplicate username form with an accessible proof state');
ok(/introProofStats\.textContent=tf\('introProofStats'/.test(HTML)
  && /new Intl\.NumberFormat\(LANG==='ko'\?'ko-KR':'en-US'\)/.test(HTML)
  && /introProofTop\.textContent=tf\('introProofTop'/.test(HTML)
  && !/introProofTop\.innerHTML/.test(HTML), 'untrusted GitHub names enter the first-screen proof through textContent only');
ok((HTML.match(/introReady:/g)||[]).length===2 && (HTML.match(/introProofStats:/g)||[]).length===2
  && (HTML.match(/enterTownPublic:/g)||[]).length===2
  && /window\.__publicIntroRefresh=renderPublicIntro/.test(HTML)
  && /window\.__introProof=\(\)=>renderPublicIntro\(\)/.test(HTML), 'the personalized ready state is bilingual, language-refreshable, and diagnosable');
ok(/#introPublicProof\[hidden\], #introLaunchForm\[hidden\], #introLaunchHint\[hidden\] \{ display: none; \}/.test(HTML)
  && /\.introProofTop \{[^}]*overflow: hidden[^}]*text-overflow: ellipsis[^}]*white-space: nowrap/.test(HTML), 'the replacement state stays compact and clips long repository names on mobile');
ok(!/innerHTML/.test(PUBLIC_TOWN_PROOF_SRC) && /Object\.freeze\(topRepos\)/.test(PUBLIC_TOWN_PROOF_SRC), 'the pure proof helper is immutable and has no DOM injection surface');
const introProfileBlock = (HTML.match(/async function copyIntroProfileReadme\(\)\{[\s\S]*?\n\}/) || [''])[0];
ok(/class="introProofActions"/.test(HTML) && /id="introPinProfile" type="button" data-i18n="introPinProfile"/.test(HTML)
  && /id="introProfileStatus"/.test(HTML), 'the ready state exposes one profile-portal command with inline result feedback');
ok(/_copyPostcardText\(_postcardReadmePortal\(\)\.html\)/.test(introProfileBlock)
  && /track\('share_click',\{channel:'intro_profile_readme',ok\}\)/.test(introProfileBlock)
  && !/fetch\(|targetUser|currentUser/.test(introProfileBlock), 'the first-screen portal reuses the local bounded helper and tracks no GitHub identity');
ok(/introProfileStatus\.textContent=introProfileResult\?t\(introProfileResult\.key\):''/.test(HTML)
  && (HTML.match(/introPinProfile:'/g)||[]).length===2 && (HTML.match(/introProfileCopied:/g)||[]).length===2
  && /window\.__introCopyProfile=\(\)=>copyIntroProfileReadme\(\)/.test(HTML), 'copy feedback is text-only, bilingual, language-refreshable, and browser-diagnosable');
ok(/\.introProofActions \{[^}]*display: flex[^}]*flex-wrap: wrap/.test(HTML)
  && /\.introProofActions button \{[^}]*flex: 1 1 150px[^}]*min-height: 44px/.test(HTML), 'the ready-state actions stay stable, touch-sized, and wrap instead of overflowing on mobile');
ok(/document\.getElementById\('startBtn'\)\.onclick=[\s\S]*?showWave\(tf\('arrived',\{user:currentUser\}\),3600\)/.test(HTML)
  && /if\(!rb&&!_reqFocus\) setTimeout\(\(\)=>\{ try\{ showWave\(tf\('arrived'/.test(HTML)
  && (HTML.match(/showWave\(tf\('arrived',\{user:currentUser\}\),3600\)/g)||[]).length===1,
  'a public-town arrival toast waits for actual entry and cannot cover the first-screen proof');
ok(/Put this town on my GitHub profile/.test(README_EN) && /GitHub 프로필에 마을 붙이기/.test(README_KO), 'EN/KO adoption tables surface the same profile portal at the moment the preview is ready');
function launchConfig(hostname) {
  const sandbox = { window: {}, location: { hostname } };
  runInNewContext(LAUNCH_CONFIG_SRC, sandbox);
  return sandbox.window.REPOLIS_CONFIG;
}
const canonicalConfig = launchConfig('hyeonsangjeon.github.io');
const forkConfig = launchConfig('octocat.github.io');
const customConfig = launchConfig('town.example.com');
const localConfig = launchConfig('localhost');
ok(canonicalConfig.town.owner==='hyeonsangjeon' && canonicalConfig.town.canonical
  && /^https:/.test(canonicalConfig.services.grounded) && /^wss:/.test(canonicalConfig.services.realtime)
  && /^https:/.test(canonicalConfig.services.analytics), 'canonical Pages host keeps the live optional services');
ok(forkConfig.town.owner==='octocat' && forkConfig.town.source==='github-pages' && !forkConfig.town.canonical
  && forkConfig.services.grounded==='' && forkConfig.services.realtime==='' && forkConfig.services.analytics==='', 'a Pages fork infers its owner and cannot call upstream Workers');
ok(customConfig.services.grounded==='' && customConfig.services.realtime==='' && customConfig.services.analytics==='', 'an undeclared custom domain gets safe service-off defaults');
ok(localConfig.services.grounded==='' && localConfig.services.realtime==='' && localConfig.services.analytics==='', 'a local template clone cannot call canonical services without explicit dev opt-in');
ok(/<script src="repolis\.config\.js"><\/script>\s*<script src="scholars\.js"><\/script>/.test(HTML)
  &&/window\.REPOLIS_CONFIG\?\.town\?\.owner/.test(HTML)
  &&/CFG\.town\?\.owner/.test(SCHOLARS_SRC), 'runtime config loads before scholars and owns both city and persona identity');
ok(/const GROUNDED_DEFAULT=window\.REPOLIS_CONFIG\?\.services\?\.grounded\|\|''/.test(HTML)
  &&/const RT_DEFAULT=window\.REPOLIS_CONFIG\?\.services\?\.realtime\|\|''/.test(HTML), 'optional backend defaults come only from fork-safe config');
ok(/REPOLIS_CONFIG\?\.services\?\.analytics/.test(HTML)
  &&/<meta name="repolis-analytics-endpoint" content="" \/>/.test(HTML), 'analytics is config-gated and the template meta override is empty');
ok(/secrets\.GH_PAT \|\| github\.token/.test(REFRESH_WORKFLOW)
  &&/if: \$\{\{ env\.GH_PAT != '' \}\}/.test(REFRESH_WORKFLOW)
  &&/if: \$\{\{ env\.GH_PAT == '' \}\}/.test(REFRESH_WORKFLOW), 'refresh always has github.token and collects traffic only when GH_PAT exists');
ok(/GTM_DIR=data\/towns\/\$REPO_OWNER/.test(REFRESH_WORKFLOW)
  &&/LOGS_DIR="\$GTM_DIR\/logs"/.test(REFRESH_WORKFLOW)
  &&/git add -A data repos\.json/.test(REFRESH_WORKFLOW), 'fork traffic is owner-scoped and committed separately from upstream logs');
ok(/\/users\/\{OWNER\}\/repos\?per_page=100&type=owner/.test(REPO_BUILDER)
  &&/Public owner endpoint works with the built-in Actions token/.test(REPO_BUILDER), 'builder lists public owner repos without requiring an authenticated user endpoint');
ok(/Path\("data"\) \/ "towns" \/ OWNER/.test(REPO_BUILDER), 'manual non-upstream builds default to an owner-scoped traffic root');

group('deterministic city state — generated time, wear, ruins, and season');
ok(CITY_STATE.schema==='repolis.city-state' && CITY_STATE.version===1
  &&['era','season','stats','last_sap_flow','roots'].every(key=>key in CITY_STATE),
  'generated city state exposes the versioned minimum contract');
ok(CITY_STATE_SCHEMA.$id==='https://hyeonsangjeon.github.io/Repolis/data/city-state.schema.json'
  &&CITY_STATE_SCHEMA.additionalProperties===false
  &&CITY_STATE_SCHEMA.required.every(key=>key in CITY_STATE),
  'city-state schema is strict and matches the checked-in artifact');
const archivedCityRepos=CITY_REPOS.filter(repo=>repo.archived);
ok(CITY_STATE.stats.repository_count===CITY_REPOS.length
  &&CITY_STATE.stats.active_repository_count+CITY_STATE.stats.archived_repository_count===CITY_REPOS.length
  &&CITY_STATE.stats.archived_repository_count===archivedCityRepos.length,
  'city-state repository totals reconcile with repos.json');
ok(CITY_STATE.stats.total_stars===CITY_REPOS.reduce((sum,repo)=>sum+(repo.stars||0),0)
  &&CITY_STATE.stats.total_forks===CITY_REPOS.reduce((sum,repo)=>sum+(repo.forks||0),0),
  'city-state public star and fork totals reconcile with repos.json');
ok(CITY_STATE.stats.commit_history.available===false
  &&CITY_STATE.stats.commit_history.total===null
  &&/not complete commit history/i.test(CITY_STATE.stats.commit_history.limitation),
  'unavailable commit history is explicit and never estimated');
ok(CITY_STATE.roots.length===archivedCityRepos.length
  &&CITY_STATE.roots.every(root=>archivedCityRepos.some(repo=>repo.repo===root.repo)),
  'roots contain every and only archived public repository');
ok(/sort_keys=True/.test(CITY_STATE_BUILDER)
  &&/schema_path/.test(CITY_STATE_VALIDATOR)
  &&/CITY_STATE_AS_OF=\$\(date -u \+%FT00:00:00Z\)/.test(REFRESH_WORKFLOW)
  &&/scripts\/test_city_state\.py/.test(REFRESH_WORKFLOW)
  &&/scripts\/validate_city_state\.py/.test(REFRESH_WORKFLOW)
  &&/scripts\/test-city-time\.mjs/.test(REFRESH_WORKFLOW),
  'stable serialization, schema validation, and fixture tests gate daily refresh');
const cityReference=cityReferenceTimestamp(CITY_STATE,CITY_REPOS);
const cityReferenceDate=new Date(cityReference).toISOString().slice(0,10);
const cityDateBefore=days=>new Date(cityReference-days*86400000).toISOString().slice(0,10);
ok(cityReferenceDate===CITY_STATE.season.inputs.reference_date
  &&cityReferenceDate===CITY_STATE.era.as_of,
  'runtime reference date agrees with the generated artifact');
ok(WEAR_THRESHOLDS_DAYS.recent===90 && WEAR_THRESHOLDS_DAYS.faded===365
  &&classifyBuildingWear({pushed:cityDateBefore(0)},cityReference).state==='recent'
  &&classifyBuildingWear({pushed:cityDateBefore(120)},cityReference).state==='faded'
  &&classifyBuildingWear({pushed:cityDateBefore(500)},cityReference).state==='mossed'
  &&classifyBuildingWear({pushed:cityDateBefore(0),archived:true},cityReference).archived,
  'wear thresholds and archived ruin state are deterministic');
ok(resolveCitySeason(CITY_STATE)===CITY_STATE.season.value
  &&resolveCitySeason({...CITY_STATE,season:{...CITY_STATE.season,value:'spring'}})==='spring'
  &&resolveCitySeason({...CITY_STATE,season:{...CITY_STATE.season,value:'winter'}})==='winter'
  &&resolveCitySeason({season:{value:'not-a-season'}})==='summer'
  &&seasonPalette('spring').sky!==seasonPalette('winter').sky,
  'season accepts four generated values, falls back neutrally, and has distinct fixture palettes');
ok(!/\bfetch\s*\(|api\.github|workers\.dev|\/taxi\b/i.test(CITY_TIME_SRC),
  'city-time projection is local and adds no runtime API, LLM, or backend call');
ok(/fetch\('data\/city-state\.json',\{cache:'no-cache'\}\)/.test(HTML)
  &&/cityStateLoad/.test(HTML)
  &&/scene\.fog = new THREE\.Fog\(CITY_SEASON_STYLE\.fog/.test(HTML)
  &&/SKY_KEYS\.forEach\(k=>/.test(HTML)
  &&/projectCityTime\(repo,CITY_STATE,REPOS/.test(HTML),
  'owner runtime loads static city state before applying season and wear');
ok(/function addGentleRuin\(g,repo,w,h,d,yr,topH\)/.test(HTML)
  &&/repo\._wearState=cityTime\.state/.test(HTML)
  &&/wear:repo\._wearState,ruin:repo\._ruin/.test(HTML)
  &&/spec\.ruin/.test(HTML)
  &&/RUIN_FLOWER_MAT=new THREE\.MeshBasicMaterial\(\{color:0xffffff\}\)/.test(HTML),
  'gentle ruin identity survives full and LOD building paths');
ok(/if\(repo\._ruin\)\{ \(repo\._windows\|\|\[\]\)\.forEach\(w=>\{ w\.userData\.lit=false; \}\); _syncBuildingLodFacade\(repo\); return; \}/.test(HTML),
  'visiting a ruin cannot relight its full, mid, or far LOD windows');
ok((HTML.match(/wearRecent:/g)||[]).length===2
  &&(HTML.match(/wearFaded:/g)||[]).length===2
  &&(HTML.match(/wearMossed:/g)||[]).length===2
  &&(HTML.match(/ruinNote:/g)||[]).length===2
  &&(HTML.match(/seasonSpring:/g)||[]).length===2,
  'wear, ruin, and season copy is bilingual');
ok(/citySeason/.test(HTML)&&/cityTimeFixtures/.test(HTML)&&/prefers-reduced-motion:reduce/.test(HTML),
  'debug fixtures and the existing reduced-motion contract cover static time treatments');

group('World Tree Phase 2 — city-state projection, roots, growth, and sap freshness');
const worldTreeFixture=(stars,repositories,roots=[],lastSapFlow='2026-08-23T00:00:00Z')=>({
  schema:'repolis.city-state',version:1,last_sap_flow:lastSapFlow,
  era:{as_of:'2026-08-23',founded_on:'2017-01-23',oldest_repository:'first-repo',city_age_years:9.58,city_year:10,basis:'fixture'},
  season:{value:'spring',fallback:{used:false},inputs:{recent_active_repositories:4,repositories_with_push_date:repositories,recent_to_historical_ratio:1.5}},
  stats:{repository_count:repositories,active_repository_count:Math.max(0,repositories-roots.length),archived_repository_count:roots.length,
    total_stars:stars,total_forks:7,language_distribution:[{language:'JavaScript',repositories:Math.max(1,repositories)}],
    commit_history:{available:false,total:null,limitation:'Complete commit history is unavailable.'}},
  roots
});
const growthMinimum=projectWorldTreeGrowth(worldTreeFixture(0,0));
const growthMiddle=projectWorldTreeGrowth(worldTreeFixture(420,54));
const growthMaximum=projectWorldTreeGrowth(worldTreeFixture(
  WORLD_TREE_GROWTH_LIMITS.starSaturation*3,
  WORLD_TREE_GROWTH_LIMITS.repositorySaturation*3
));
ok(growthMinimum.scale===WORLD_TREE_GROWTH_LIMITS.minimumScale
  &&growthMaximum.scale===WORLD_TREE_GROWTH_LIMITS.maximumScale
  &&growthMiddle.scale>growthMinimum.scale&&growthMiddle.scale<growthMaximum.scale,
  'total-star plus public-repo growth is monotonic and clamped at minimum, middle, and maximum fixtures');
ok(projectWorldTreeGrowth(null).scale===1
  &&projectWorldTreeGrowth(CITY_STATE).stars===CITY_STATE.stats.total_stars
  &&projectWorldTreeGrowth(CITY_STATE).repositories===CITY_STATE.stats.repository_count,
  'growth consumes the generated city-state totals and preserves neutral scale when the contract is unavailable');
const manyRoots=Array.from({length:18},(_,index)=>({
  repo:`archived-${String(index+1).padStart(2,'0')}`,
  active_years:{from:2000+index,to:2002+index,count:3},
  achievement:`Public achievement ${index+1}.`
}));
const emptyChronicle=projectWorldTreeChronicle(worldTreeFixture(0,0,[]),{now:Date.parse('2026-08-23T12:00:00Z')});
const manyChronicle=projectWorldTreeChronicle(worldTreeFixture(500,24,manyRoots),{now:Date.parse('2026-08-23T12:00:00Z')});
ok(emptyChronicle.roots.length===0
  &&manyChronicle.roots.length===manyRoots.length
  &&manyChronicle.roots[0].repo==='archived-01'
  &&manyChronicle.roots.at(-1).activeYears.count===3,
  'Chronicle keeps an honest empty Roots state and preserves every bounded root in a many-roots fixture');
const recentSap=resolveSapFlowFreshness('2026-08-23T00:00:00Z',Date.parse('2026-08-23T12:00:00Z'));
const staleSap=resolveSapFlowFreshness('2026-07-20T00:00:00Z',Date.parse('2026-08-23T12:00:00Z'));
ok(recentSap.animate&&recentSap.freshness==='recent'
  &&!staleSap.animate&&staleSap.freshness==='stale'
  &&resolveSapFlowMode(recentSap)==='travel'
  &&resolveSapFlowMode(recentSap,{reducedMotion:true})==='static'
  &&resolveSapFlowMode(recentSap,{lowEnd:true})==='static'
  &&resolveSapFlowMode(staleSap)==='static',
  'sap travel is short-lived only for a recent record; stale, reduced-motion, and LOW_END fixtures stay static');
ok(SAP_FLOW_LIMITS.travelSeconds<7&&!/\bfetch\s*\(|api\.github|workers\.dev|\/taxi\b/i.test(WORLD_TREE_STATE_SRC),
  'World Tree projection is bounded, local-only, and adds no runtime GitHub, LLM, or service request');

group('Repo Portal — one repository becomes the first shareable destination');
const portalUser=parseRepoPortalInput('@Octo-Cat');
const portalSlug=parseRepoPortalInput('Octo-Cat/hello-world.git/');
const portalUrl=parseRepoPortalInput('https://github.com/Octo-Cat/hello-world.git/');
const portalBareUrl=parseRepoPortalInput('github.com/Octo-Cat/hello-world');
ok(portalUser.ok&&portalUser.kind==='user'&&portalUser.user==='Octo-Cat', 'parser keeps the established username grammar');
ok(portalSlug.ok&&portalSlug.kind==='repo'&&portalSlug.slug==='Octo-Cat/hello-world'
  && portalUrl.ok&&portalUrl.slug===portalSlug.slug&&portalBareUrl.ok&&portalBareUrl.slug===portalSlug.slug,
  'owner/repo, GitHub root URLs, trailing slashes, and .git normalize to one target');
[
  'https://gitlab.com/octo/repo',
  'https://github.com/octo/repo/issues',
  'https://github.com/octo/repo?tab=readme',
  'octo/../repo',
  'octo/%2e%2e/repo',
  'octo/repo?user=other',
  'octo/repo\u0000',
  'octo/repo/extra'
].forEach(value=>ok(!parseRepoPortalInput(value).ok,`unsafe or non-root target fails closed: ${JSON.stringify(value)}`));
const portalCanonical=createRepoPortalUrl(portalSlug,'https://example.test/Repolis/?user=other&twin=friend&growth=2020#repo=old');
ok(portalCanonical==='https://example.test/Repolis/?repo=Octo-Cat/hello-world&ref=repo-portal',
  'canonical Portal URL strips town, twin, growth, and hash state without hiding the owner/repo slash');
ok(createRepoOwnerTownUrl(portalSlug,'https://example.test/Repolis/?repo=old','owner')
    ==='https://example.test/Repolis/?user=Octo-Cat&focus=hello-world&ref=repo-portal'
  && createRepoOwnerTownUrl('owner/repo','https://example.test/Repolis/','owner')
    ==='https://example.test/Repolis/?focus=repo&ref=repo-portal',
  'explicit expansion keeps the target focus and omits a redundant owner query');
const portalWins=resolveRepoPortalRequest('?user=someone-else&repo=Octo-Cat/hello-world&twin=x&growth=2020','owner');
const portalFocus=resolveRepoPortalRequest('?user=Octo-Cat&focus=hello-world&ref=repo-portal','owner');
const portalBad=resolveRepoPortalRequest('?repo=Octo-Cat/../secret&user=someone','owner');
const publicAtUser=resolveRepoPortalRequest('?user=@Octo-Cat','owner');
ok(portalWins.mode==='portal'&&portalWins.repoWins&&portalWins.target.slug==='Octo-Cat/hello-world',
  'repo is the single source of truth when user and legacy feature parameters conflict');
ok(portalFocus.mode==='public'&&portalFocus.focus?.slug==='Octo-Cat/hello-world',
  'owner-town expansion carries one validated repo focus without staying in target-first mode');
ok(portalBad.mode==='portal'&&!portalBad.target&&!!portalBad.error, 'an invalid repo query stays an explicit Portal error instead of falling through to user mode');
ok(publicAtUser.mode==='public'&&/const _reqUser = \(_QUERY\.get\('user'\) \|\| ''\)\.trim\(\)\.replace\(\/\^@\+\/,''\)/.test(HTML),
  'an @-prefixed public-town query uses the same cleaned username for routing and the GitHub fetch');

const portalRaw={
  name:'hello-world',full_name:'Octo-Cat/hello-world',owner:{login:'Octo-Cat'},private:false,disabled:false,
  description:'A public fixture',language:'JavaScript',topics:['demo','threejs'],homepage:'https://example.test/',
  stargazers_count:12,forks_count:3,fork:false,size:44,open_issues_count:2,license:{spdx_id:'MIT'},
  archived:false,default_branch:'main',created_at:'2020-01-02T00:00:00Z',pushed_at:'2026-08-19T00:00:00Z',
  updated_at:'2026-08-19T00:00:00Z',email:'private@example.test',subscribers_count:999,watchers_count:999
};
const portalProjection=projectPublicRepo(portalRaw,'Octo-Cat',Date.parse('2026-08-20T00:00:00Z'));
ok(portalProjection.repo==='hello-world'&&portalProjection.stars===12&&portalProjection.forks===3
  &&portalProjection.trafficKnown===false&&portalProjection.visitors===null&&portalProjection.views===null&&portalProjection.clones===null,
  'public projection keeps GitHub facts and represents unavailable traffic as unknown, never synthetic zero');
ok(!('email' in portalProjection)&&!('subscribers_count' in portalProjection)&&!('watchers_count' in portalProjection)
  &&projectPublicRepo({...portalRaw,private:true},'Octo-Cat')===null
  &&projectPublicRepo({...portalRaw,owner:{login:'Other'}},'Octo-Cat')===null,
  'projection allowlists rendered fields and rejects private or owner-mismatched responses');
const portalRanked=projectPublicRepos([
  {...portalRaw,name:'quiet',full_name:'Octo-Cat/quiet',stargazers_count:0,forks_count:0},
  portalRaw
],'Octo-Cat',Date.parse('2026-08-20T00:00:00Z'));
ok(portalRanked.map(repo=>repo.repo).join(',')==='hello-world,quiet'&&portalRanked[0].rank===0&&portalRanked[1].rank===1,
  'public projection ranks the same allowlisted signals deterministically');
ok(repoPortalLatencyBucket(999)==='under-1s'&&repoPortalLatencyBucket(1000)==='1-3s'
  &&repoPortalLatencyBucket(3000)==='3-10s'&&repoPortalLatencyBucket(10000)==='10s-plus',
  'funnel latency uses four coarse buckets rather than exact request timing');

const portalLoader=(HTML.match(/let _ownerSnapshotPromise=null;[\s\S]*?(?=\ntrack\('page_load'\);)/)||[''])[0];
const portalTargetLoader=(portalLoader.match(/async function _loadRepoPortalTarget\(target\)\{[\s\S]*?\n\}/)||[''])[0];
ok(/from '\.\/assets\/repo-portal\.js\?v=repo-portal-v1'/.test(HTML)&&REPO_PORTAL_SRC.length<30*1024,
  'the zero-build runtime imports one small dedicated Portal module');
ok(!/document|window|localStorage|sessionStorage|fetch\(|Math\.random|THREE/.test(REPO_PORTAL_SRC),
  'parser, canonicalizer, projection, and link builders stay pure and browser-independent');
ok(REPO_PORTAL_LIMITS.cacheTtlMs===15*60*1000&&REPO_PORTAL_LIMITS.cacheMaxBytes===512*1024&&REPO_PORTAL_LIMITS.cacheMaxEntries===30,
  'public repo cache is fixed at 15 minutes, 512 KiB, and 30 LRU entries');
ok(/_ownerRepos\(await _ownerSnapshot\(\)\)\.find/.test(portalTargetLoader)
  &&portalTargetLoader.indexOf('_ownerSnapshot')<portalTargetLoader.indexOf('_repoPortalCacheLookup')
  &&portalTargetLoader.indexOf('_repoPortalCacheLookup')<portalTargetLoader.indexOf("fetch('https://api.github.com/repos/"),
  'target loading checks the local owner snapshot, then fresh cache, then one exact repo endpoint');
ok((portalTargetLoader.match(/fetch\(/g)||[]).length===1
  &&/if\(!res\.ok\)\{[\s\S]*?if\(cached\.stale\) return \{repo:cached\.stale,source:'repo-stale-cache',result:'stale'\}/.test(portalTargetLoader)
  &&!/retry|setTimeout/.test(portalTargetLoader),
  'the target path makes one GitHub request, never retries 403/429, and labels stale recovery');
ok(/while\(bytes>REPO_PORTAL_LIMITS\.cacheMaxBytes&&cache\.order\.length>1\)/.test(portalLoader)
  &&/cache\.order=\[key,\.\.\.cache\.order\.filter/.test(portalLoader)
  &&/slice\(0,REPO_PORTAL_LIMITS\.cacheMaxEntries\)/.test(portalLoader),
  'cache writes enforce byte and entry bounds while touching the latest target first');
ok(/if\(!repoPortalTarget\) repoPortalResult=\{repo:null/.test(HTML)
  &&/else repoPortalResult=await _loadRepoPortalTarget\(repoPortalTarget\)/.test(HTML),
  'invalid repo queries perform no GitHub target request');
ok(/if\(repoPortalResult\.repo\)\{ REPOS=\[repoPortalResult\.repo\]/.test(HTML)
  &&/repoPortalFallback=true;[\s\S]*?REPOS=_ownerRepos\(await _ownerSnapshot\(\)\); cityMode='owner'/.test(HTML),
  'success builds one target first while failure preserves the existing owner town');
ok(/return projectPublicRepos\(raw,user,Date\.now\(\)\)/.test(HTML)
  &&!/derived "liveliness"|derived → yard size|never a real clone count/.test(HTML)
  &&/if\(repo\.trafficKnown===false\)\{[\s\S]*?starSignal[\s\S]*?forkSignal/.test(HTML),
  'all public towns share truthful unknown traffic and map only stars, forks, and recency to architecture');
ok(/REPOS\.every\(repo=>repo\.trafficKnown===false\)[\s\S]*?publicTrafficUnavailable/.test(HTML)
  &&/repo\.trafficKnown===false\?`★\$\{repo\.stars\}/.test(HTML),
  'search answers and repo facts never print unavailable traffic as observed zero');
ok(/const freshnessTrackable=cityMode!=='portal'&&REPOS\.length>0&&!cityError/.test(HTML)
  &&/if\(cityMode==='portal'\)\{ course=\{date,town,v:COURSE_V,items:\[\],completed:\[\],rewarded:false,available:false\}; return course; \}/.test(HTML),
  'target-only visits cannot overwrite the owner Town Gazette baseline or Village Chronicle progress');

ok(/id="introUser"[\s\S]*?maxlength="320"/.test(HTML)&&/id="stationInput"[\s\S]*?maxlength="320"/.test(HTML)
  &&/data-i18n-aria="repoTargetAria"/.test(HTML),
  'intro and Station accept the full target grammar through labelled bounded text fields');
ok(/target=parseRepoPortalInput\(input\.value\)/.test(HTML)
  &&/const target=parseRepoPortalInput\(String\(value\|\|''\)\)/.test(HTML)
  &&/createRepoPortalUrl\(target,location\.href\)/.test(HTML),
  'both entry surfaces use the same strict resolver and canonical link builder');
ok(/const portalRepo=cityMode==='portal'[\s\S]*?introPortalReady[\s\S]*?introPortalStats/.test(HTML)
  &&/introProofActions\.hidden=portalReady/.test(HTML)&&/introTourBtn\.hidden=portalReady/.test(HTML),
  'a loaded target replaces generic actions with one concise repo proof and one exhibition CTA');
ok(/if\(cityMode==='portal'&&repoPortalTarget\)[\s\S]*?enterRepositoryAtelier\(repo\)/.test(HTML)
  &&/else if\(_reqFocus\)[\s\S]*?enterRepositoryAtelier\(repo\)/.test(HTML),
  'shared targets and expanded owner towns arrive at the exact Atelier after one entry click');
ok(/if\(!rb&&!_reqFocus\) setTimeout\(\(\)=>\{ try\{ showWave\(tf\('arrived'/.test(HTML)
  &&/if\(cityMode!=='portal'&&!_reqFocus&&REPOS\.length\)/.test(HTML),
  'target arrivals suppress the generic public-town toast, Gazette, and Chronicle until after the focused Aha');
ok(/id="atelierPortalActions" hidden role="group"[\s\S]*?id="atelierPortalCopy"[\s\S]*?id="atelierPortalGithub"[\s\S]*?id="atelierPortalExplore"/.test(HTML)
  &&/#atelierPortalActions button, #atelierPortalActions a \{[\s\S]*?min-height:40px/.test(HTML)
  &&/@media \(max-width: 520px\)[\s\S]*?#atelierPortalActions button, #atelierPortalActions a \{[^}]*min-height:44px/.test(HTML),
  'Atelier exposes copy, GitHub, and full-town actions with desktop and mobile touch targets');
ok(/createRepoOwnerTownUrl\(target,location\.href,OWNER\)/.test(HTML)
  &&/_copyPostcardText\(createRepoPortalUrl\(target,_postcardPublishedBase\(\)\)\)/.test(HTML),
  'Atelier can copy the canonical address or explicitly expand into the existing owner-town loader');
ok(/if\(cityMode==='portal'&&repoPortalTarget\) return createRepoPortalUrl\(repoPortalTarget,base\)/.test(HTML),
  'Postcard copy-link keeps the canonical target without composing postcard, growth, or twin state');
ok(/atelierPortalExplore\.hidden=cityMode!=='portal'/.test(HTML)
  &&/#atelierPortalActions \[hidden\] \{ display:none; \}/.test(HTML),
  'full owner towns hide the now-redundant expansion action while keeping copy and GitHub');
['introSubPortal','introPortalReady','introPortalStats','enterRepoPortal','portalSourceLocal','portalSourceApi',
  'portalSourceCache','portalSourceStale','repoTargetAria','modePortalLabel','repoPortalOf','trainDepartRepo',
  'fetchingRepo','portalInvalidTitle','portalInvalidMsg','portalNotFoundMsg','portalRateMsg','portalNetMsg',
  'portalContinue','portalActionsAria','portalCopy','portalCopied','portalCopyFailed','portalExplore',
  'atelierTrafficUnavailable','publicTrafficUnavailable']
  .forEach(key=>ok((HTML.match(new RegExp(key+":[\\\"']",'g'))||[]).length===2,`Repo Portal key ${key} is bilingual`));
ok(/id="introPublicProof" hidden role="status" aria-live="polite"/.test(HTML)
  &&/id="introLaunchErr" role="alert"/.test(HTML)
  &&/id="atelierPortalStatus" role="status" aria-live="polite" aria-atomic="true"/.test(HTML),
  'loading proof, validation errors, and copy results use accessible live semantics');
ok(/#intro \.langsel button\.active \{[^}]*color: #7a3f12/.test(HTML)
  &&/#startBtn \{[^}]*color: #7a3f12/.test(HTML),
  'active language and primary entry text retain AA contrast on white');
ok(/const allowed=new Set\(\['ev','sessionId','ts','entry','device','lang','result','latency','channel'\]\)/.test(HTML)
  &&/\['cityUser','targetUser','user','repo','owner','url','query','input','instanceId'\]/.test(HTML),
  'Portal events remove identities, URLs, raw input, query text, and persistent instance IDs');
['feature_seen','feature_started','aha_completed','share_created','github_repo_opened','project_star_click']
  .forEach(event=>ok(HTML.includes(`'${event}'`),`privacy-safe Repo Portal event ${event} is instrumented`));
ok(/repoPortalRequested&&!A\.ahaTracked[\s\S]*?trackPortal\('aha_completed'/.test(HTML)
  &&/maybeStarNudge\('repo_portal_aha'\)/.test(HTML)&&/maybeStarNudge\('repo_portal_share'\)/.test(HTML),
  'Aha fires only after the target room is inside, then reuses the earned Star invitation after exit or share');
ok(/#atelierPortalActions \{[\s\S]*?pointer-events:auto/.test(HTML)
  &&/#atelierPortalActions\[hidden\] \{ display:none; \}/.test(HTML)
  &&/body\.atelier-chat-open #atelierPortalActions \{ display:none !important; \}/.test(HTML),
  'Portal actions remain operable without overlapping the in-room chat');
ok(/A repository can be the front door/.test(README_EN)&&/레포 하나가 입구가 됩니다/.test(README_KO)
  &&/repo=mrdoob\/three\.js&ref=repo-portal/.test(SHARE_LINKS),
  'EN/KO product docs and copy-ready examples expose the same repository-first loop');
ok(/This is the product change most likely to improve Star acquisition/.test(REPO_PORTAL_GUIDE)
  &&/trafficKnown: false/.test(REPO_PORTAL_GUIDE)&&/512 KiB/.test(REPO_PORTAL_GUIDE)
  &&/These events may include only/.test(REPO_PORTAL_GUIDE),
  'the change guide records the Star rationale, URL/data/cache boundary, and privacy allowlist');
ok(/## 11\. Repo Portal/.test(DOMAIN_MODEL)&&/Public API modes do not have traffic/.test(KNOWN_LIMITATIONS)
  &&/assets\/repo-portal\.js/.test(AGENTS_GUIDE)&&/id: repo-portal/.test(MANIFEST)
  &&/Repo Portal: `\?repo=owner\/repo/.test(LLMS_INDEX)&&/\[1\.87\.0\]/.test(CHANGELOG),
  'domain, limitations, agent guide, manifest, LLM index, and changelog stay in sync');

group('Twin Towns — recipient-specific, reversible public-town referrals');
const twinLeft = [
  { repo:'agent-harbor', lang:'JavaScript', topics:['agents','threejs'], stars:12, forks:2 },
  { repo:'rust-light', lang:'Rust', topics:['wasm'], stars:4, forks:1 }
];
const twinRight = [
  { repo:'agent-map', lang:'TypeScript', topics:['agents','maps'], stars:8, forks:3 },
  { repo:'web-stage', lang:'JavaScript', topics:['threejs'], stars:5, forks:1 }
];
const twinSummary = summarizeTwinTown('Ada-L', twinLeft);
const twinMatch = createTwinTownMatch('Ada-L', twinLeft, 'Grace-H', twinRight);
const twinReverse = createTwinTownMatch('Grace-H', twinRight, 'Ada-L', twinLeft);
ok(twinSummary.repos===2 && twinSummary.stars===16 && twinSummary.languages.map(item=>item.name).join(',')==='JavaScript,Rust'
  && twinSummary.topRepo.name==='agent-harbor', 'town matching summarizes only bounded public repo facts and picks a deterministic featured house');
ok(twinMatch.bridgeKind==='topics' && twinMatch.bridgeItems.map(item=>item.name).join(',')==='agents,threejs'
  && twinMatch.sharedLanguages.map(item=>item.name).join(',')==='JavaScript'
  && twinMatch.combinedRepos===4 && twinMatch.combinedStars===29, 'shared topics win the bridge while shared languages and combined proof remain truthful');
ok(twinReverse.bridgeKind===twinMatch.bridgeKind && twinReverse.bridgeItems.map(item=>item.name).join(',')===twinMatch.bridgeItems.map(item=>item.name).join(',')
  && twinReverse.combinedRepos===twinMatch.combinedRepos && twinReverse.combinedStars===twinMatch.combinedStars, 'reversing the same public inputs preserves the bridge and combined proof');
const twinLanguageMatch = createTwinTownMatch('one', [{repo:'a',lang:'Go',stars:1}], 'two', [{repo:'b',lang:'Go',stars:2}]);
const twinContrastMatch = createTwinTownMatch('one', [{repo:'a',lang:'Go'}], 'two', [{repo:'b',lang:'Ruby'}]);
ok(twinLanguageMatch.bridgeKind==='languages' && twinLanguageMatch.bridgeItems[0].name==='Go'
  && twinContrastMatch.bridgeKind==='contrast' && twinContrastMatch.bridgeItems.length===0, 'language-only and contrasting towns degrade deterministically without invented overlap');
ok(Object.isFrozen(twinMatch) && Object.isFrozen(twinMatch.left) && Object.isFrozen(twinMatch.bridgeItems),
  'match results are immutable before entering the UI');
ok(createTwinTownLink('Ada-L','Grace-H','https://example.test/Repolis/index.html?old=1#repo=x')
  ==='https://example.test/Repolis/?user=ada-l&twin=grace-h&ref=twin-town', 'share links discard stale state and preserve a reversible two-login URL contract');
let sameTwinRejected=false, badTwinRejected=false;
try{ createTwinTownMatch('Ada-L',twinLeft,'ada-l',twinRight); }catch(error){ sameTwinRejected=error instanceof TypeError; }
try{ createTwinTownLink('bad--','Grace-H'); }catch(error){ badTwinRejected=error instanceof TypeError; }
ok(sameTwinRejected && badTwinRejected, 'same-user and invalid-login comparisons fail closed');

const twinBlock = (HTML.match(/\/\* ====================== ↔ TWIN TOWNS[\s\S]*?\/\* ====================== 🚉 GITHUB STATION/) || [''])[0];
ok(/import \{ createTwinTownLink, createTwinTownMatch \} from '\.\/assets\/twin-towns\.js\?v=twin-towns-v1'/.test(HTML),
  'the zero-build runtime imports the deterministic Twin Towns module');
ok(/id="twinModal" role="dialog" aria-modal="true" aria-labelledby="twinTitle" aria-describedby="twinSub" aria-hidden="true"/.test(HTML)
  && /id="twinStatus" role="status" aria-live="polite" aria-atomic="true"/.test(HTML)
  && /id="twinResult" hidden aria-live="polite" aria-atomic="true"/.test(HTML), 'comparison state is exposed as a labelled modal with polite live results');
ok(/id="introCompare" type="button" data-i18n="introCompare"/.test(HTML)
  && /id="twinMenuBtn" type="button"/.test(HTML), 'Twin Towns is discoverable after personal proof and from the in-city menu');
ok(/const _reqTwin = \(_QUERY\.get\('twin'\)/.test(HTML)
  && /cityMode!=='portal'[\s\S]*?setTimeout\(\(\)=>openTwinTowns\('link',_reqTwin\),120\)/.test(twinBlock),
  'a shared twin parameter opens its comparison automatically unless a repo target owns the route');
ok(/const currentLoad=cityMode==='owner'\?_loadPublicCity\(currentUser\)/.test(twinBlock)
  && /Promise\.all\(\[currentLoad,_loadPublicCity\(user\)\]\)/.test(twinBlock)
  && /createTwinTownMatch\(currentUser,leftRepos,user,loaded\.repos\)/.test(twinBlock)
  && !/fetch\(/.test(twinBlock), 'the second town reuses the existing public GitHub cache path with no new backend');
ok(/createTwinTownLink\(TWIN\.match\.right\.user,TWIN\.match\.left\.user,_twinBaseUrl\(\)\)/.test(twinBlock),
  'turning toward the other town swaps the pair so either recipient can continue the loop');
ok(/textContent='@'\+side\.user/.test(twinBlock) && /top\.textContent=side\.topRepo/.test(twinBlock)
  && !/innerHTML/.test(twinBlock) && !/innerHTML/.test(TWIN_TOWNS_SRC), 'untrusted GitHub names and repo facts enter Twin Towns through text-only sinks');
ok(/function _twinFocusables\(\)/.test(twinBlock) && /event\.key!=='Tab'/.test(twinBlock)
  && /twinForm\.setAttribute\('aria-busy','true'\)/.test(twinBlock)
  && /\.twinClose \{[^}]*width: 44px; height: 44px/.test(HTML)
  && /\.twinActions button \{[^}]*min-height: 44px/.test(HTML), 'keyboard focus is trapped and close/result actions meet the 44px touch target');
['introCompare','twinMenu','twinTitle','twinSub','twinUserPh','twinGo','twinReady','twinShare','twinCopy','twinPrivacy']
  .forEach(key => ok((HTML.match(new RegExp(key+":[\\\"']",'g'))||[]).length===2, `Twin Towns key ${key} is bilingual`));
ok(/if\(typeof window\.__twinLangRefresh==='function'\) window\.__twinLangRefresh\(\)/.test(HTML),
  'dynamic match facts refresh when KO/EN changes');
ok(/track\('twin_compare_success',\{entry,bridge:TWIN\.match\.bridgeKind,combinedRepos:TWIN\.match\.combinedRepos\}\)/.test(twinBlock)
  && !/targetUser|cityUser|leftUser|rightUser/.test(twinBlock), 'Twin Towns funnel events omit both GitHub identities');
ok(/connect with another developer/.test(README_EN) && /다른 개발자와 마을 연결/.test(README_KO)
  && /twin=torvalds&ref=twin-town/.test(readFileSync(join(ROOT, 'examples/share-links.md'), 'utf8')), 'EN/KO adoption docs and the URL reference explain the new loop');

group('Town Creator Hall — a cloner-owned identity landmark and contextual Star path');
const creatorNow = Date.parse('2026-08-18T00:00:00Z');
const creatorFields = selectTownCreatorFields({
  login:'octocat', name:'The Octocat', bio:'Public profile', company:'GitHub', location:'Internet',
  avatar_url:'https://avatars.githubusercontent.com/u/583231?v=4', followers:9000, following:9,
  public_repos:12, created_at:'2011-01-25T00:00:00Z', email:'must-not-cache@example.test', blog:'https://example.test'
});
ok(Object.keys(creatorFields).sort().join(',')==='avatarUrl,bio,company,createdAt,followers,following,location,login,name,publicRepos'
  && !('email' in creatorFields) && !('blog' in creatorFields), 'profile selection allowlists only the public fields the hall actually renders');
ok(creatorFields.avatarUrl.startsWith('https://avatars.githubusercontent.com/')
  && selectTownCreatorFields({login:'octocat',avatar_url:'https://evil.example/avatar.png'}).avatarUrl==='',
  'avatar URLs fail closed outside GitHub\'s dedicated avatar host');
const creatorSummary = summarizeTownCreator(creatorFields, [
  {repo:'alpha',lang:'Python',stars:5,forks:1,pushed:'2026-08-17T00:00:00Z',desc:'Alpha'},
  {repo:'beta',lang:'Rust',stars:10,forks:2,pushed:'2025-01-01T00:00:00Z',desc:'Beta'},
  {repo:'gamma',lang:'JavaScript',stars:2,forks:0,pushed:'2024-01-01T00:00:00Z'},
  {repo:'delta',lang:'Go',stars:1,forks:0,pushed:'2023-01-01T00:00:00Z'}
], creatorNow);
ok(creatorSummary.displayName==='The Octocat' && creatorSummary.townRepos===4 && creatorSummary.townStars===18
  && creatorSummary.townForks===3 && creatorSummary.years===15 && creatorSummary.joinedYear===2011,
  'creator proof combines public profile age with truthful facts from the rendered town');
ok(creatorSummary.topLanguages.map(item=>item.name).join(',')==='Go,JavaScript,Python,Rust'
  && creatorSummary.signatureRepos.map(repo=>repo.name).join(',')==='beta,alpha,gamma',
  'top languages and signature repositories are deterministic and bounded');
ok(creatorSummary.badges.join(',')==='builder,polyglot,maintainer,veteran'
  && Object.isFrozen(creatorSummary) && Object.isFrozen(creatorSummary.signatureRepos),
  'public signals earn immutable, explainable creator badges without contribution scraping');
let creatorLoginRejected=false;
try{ selectTownCreatorFields({login:'bad--'}); }catch(error){ creatorLoginRejected=error instanceof TypeError; }
ok(creatorLoginRejected && !/fetch\(|localStorage|document\.|innerHTML|Math\.random/.test(TOWN_CREATOR_SRC),
  'the creator model is pure, hermetic, DOM-free, and rejects invalid GitHub identities');

const creatorLandmarkBlock = (HTML.match(/\/\* ---- 👤 Town Creator Hall —[\s\S]*?\/\/ 📘 Microsoft Docs engineer/) || [''])[0];
const creatorPanelBlock = (HTML.match(/\/\* ---- 👤 Town Creator Hall panel[\s\S]*?\/\* a visited house/) || [''])[0];
ok(/import \{ selectTownCreatorFields, summarizeTownCreator \} from '\.\/assets\/town-creator\.js\?v=creator-hall-v1'/.test(HTML),
  'the zero-build runtime imports the pure creator profile model');
ok(/id="creatorModal" role="dialog" aria-modal="true" aria-labelledby="creatorName" aria-describedby="creatorBio" aria-hidden="true"/.test(HTML)
  && /id="creatorStatus" role="status" aria-live="polite" aria-atomic="true"/.test(HTML),
  'Creator Hall exposes a labelled modal and polite load/copy feedback');
ok(/id="creatorMenuBtn" type="button"/.test(HTML)
  && /\{id:'creator',\s+ico:'👤',\s+key:'lmCreator'\}/.test(HTML)
  && /\{id:'creator',ico:'👤'\}/.test(HTML), 'the hall is discoverable from the city menu, Passport, and Station');
ok(/function creatorHallSpot\(\)/.test(creatorLandmarkBlock)
  && /if\(avenue<0\.20\) continue/.test(creatorLandmarkBlock)
  && /for\(const building of buildings\)/.test(creatorLandmarkBlock)
  && /for\(const collider of EXTRA_COLLIDERS\)/.test(creatorLandmarkBlock), 'placement searches bounded non-avenue gaps against repo parcels and civic props');
ok(/new THREE\.InstancedMesh\(columnGeo,columnMat,4\)/.test(creatorLandmarkBlock)
  && /disableDynamicShadowCasters\(g\)/.test(creatorLandmarkBlock)
  && /meshes,draws:meshes/.test(creatorLandmarkBlock)
  && !/PointLight|SpotLight|DirectionalLight/.test(creatorLandmarkBlock), 'the civic pavilion batches columns, casts no dynamic shadows, and adds no light');
ok(/COLLIDERS\.push\(collider\)/.test(creatorLandmarkBlock)
  && /_registerCameraBlocker\(collider,'creator','creator-hall'/.test(creatorLandmarkBlock), 'the solid plinth participates in player and camera collision');
ok(/const CREATOR_CACHE_TTL=24\*3600\*1000/.test(creatorPanelBlock)
  && /repolis:town-creator:/.test(creatorPanelBlock)
  && /selectTownCreatorFields\(await response\.json\(\)\)/.test(creatorPanelBlock)
  && /localStorage\.setItem\(key,JSON\.stringify\(\{fetchedAt:now,profile\}\)\)/.test(creatorPanelBlock),
  'an explicit hall open caches only the selected public profile fields for one day');
ok(/openCreatorHall=\(entry='landmark'\)=>/.test(creatorPanelBlock)
  && /loadCreatorHallProfile\(false\)/.test(creatorPanelBlock)
  && !/await _loadTownCreatorProfile\(currentUser/.test(HTML.slice(0,HTML.indexOf('openCreatorHall='))),
  'profile network work starts from the hall interaction, never page startup');
ok(/creatorAvatarImg\.src=summary\.avatarUrl/.test(creatorPanelBlock)
  && /document\.getElementById\('creatorName'\)\.textContent=summary\.displayName/.test(creatorPanelBlock)
  && /name\.textContent=repo\.name/.test(creatorPanelBlock)
  && /desc\.textContent=/.test(creatorPanelBlock)
  && /link\.href=safeHref\(repo\.url\)\|\|summary\.profileUrl/.test(creatorPanelBlock), 'untrusted profile and repo facts use allowlisted URLs and text-only sinks');
ok(/creatorStar\.href=\(window\.REPOLIS_CONFIG&&REPOLIS_CONFIG\.project&&REPOLIS_CONFIG\.project\.url\)/.test(creatorPanelBlock)
  && /track\('project_star_click',\{source:'creator_hall'\}\)/.test(creatorPanelBlock)
  && /_starNudgeClose\('clicked'\)/.test(creatorPanelBlock), 'the earned in-context Star action always credits the upstream Repolis engine without a duplicate nudge');
ok(/function _creatorFocusables\(\)/.test(creatorPanelBlock)
  && /event\.key!=='Tab'/.test(creatorPanelBlock)
  && /\.creatorFoot a, \.creatorFoot button \{[^}]*min-height: 44px/.test(HTML), 'Creator Hall traps keyboard focus and keeps every primary action touch-sized');
ok(/case 'creator': return CREATOR_HALL\?/.test(HTML)
  && /nearCreatorHall = \(CREATOR_HALL/.test(HTML)
  && /else if\(nearCreatorHall\) openCreatorHall\('landmark'\)/.test(HTML)
  && /addStamp\('creator'\)/.test(HTML)
  && /LM\.push\(\[CREATOR_HALL\._pos\.x,CREATOR_HALL\._pos\.z,'👤'\]\)/.test(HTML)
  && /if\(k==='creator'\)[\s\S]{0,140}openCreatorHall\('station'\)/.test(HTML), 'walk-up, Passport, map, Station taxi, and automatic arrival all converge on the same hall');
['lmCreator','creatorMenu','creatorReached','creatorLoading','creatorReady','creatorStatRepos','creatorStatStars',
  'creatorStatFollowers','creatorStatYears','creatorBadgesTitle','creatorLanguagesTitle','creatorSignatureTitle',
  'creatorViewProfile','creatorShareTown','creatorStarEngine','creatorPowered','lmArriveCreator']
  .forEach(key => ok((HTML.match(new RegExp(key+":[\\\"']",'g'))||[]).length===2, `Creator Hall key ${key} is bilingual`));
ok(/window\.__creatorLangRefresh=\(\)=>renderCreatorHall\(\)/.test(creatorPanelBlock)
  && /if\(typeof refreshCreatorHallSign==='function'\) refreshCreatorHallSign\(\)/.test(HTML), 'live KO/EN switching refreshes both the modal and in-world sign');
ok(/window\.__creatorHall=\(\)=>/.test(HTML)
  && /meshes:CREATOR_HALL\.meshes,draws:CREATOR_HALL\.draws,textures:2,lights:0/.test(HTML),
  'browser diagnostics expose placement clearance, resources, current profile proof, and modal state');

group('Town Growth Replay — a truthful personal history made from repo birth dates');
const growthFixture=[
  {repo:'gamma',lang:'Go',created:'2021-09-01T10:00:00Z'},
  {repo:'alpha',lang:'Rust',created:'2019-01-02T00:00:00Z'},
  {repo:'beta',lang:'Go',created:'2021-04-05T00:00:00Z'},
  {repo:'unknown',lang:'Other',created:''},
  {repo:'ALPHA',lang:'Python',created:'2020-01-01T00:00:00Z'}
];
const growthTimeline=buildTownGrowthTimeline(growthFixture);
ok(growthTimeline.available && growthTimeline.firstYear===2019 && growthTimeline.lastYear===2021
  && growthTimeline.knownCount===3 && growthTimeline.unknownCount===1 && growthTimeline.totalCount===4,
  'creation dates produce one deduplicated, bounded timeline while unknown dates remain explicit');
ok(growthTimeline.milestones.length===2
  && growthTimeline.milestones[0].added.join(',')==='alpha'
  && growthTimeline.milestones[1].added.join(',')==='beta,gamma'
  && growthTimeline.milestones[1].total===3 && growthTimeline.milestones[1].languageCount===2
  && Object.isFrozen(growthTimeline)&&Object.isFrozen(growthTimeline.entries)&&Object.isFrozen(growthTimeline.milestones),
  'birth-year milestones sort deterministically and keep immutable cumulative counts and language diversity');
const growthFirst=townGrowthSnapshot(growthTimeline,0),growthPresent=townGrowthSnapshot(growthTimeline,99);
ok(growthFirst.year===2019&&growthFirst.visibleCount===1&&!growthFirst.isPresent
  && growthPresent.year===2021&&growthPresent.visibleCount===4&&growthPresent.isPresent,
  'unknown-date houses appear only in the truthful present snapshot, never in an invented historical year');
ok(townGrowthIndexForYear(growthTimeline,2018)===0&&townGrowthIndexForYear(growthTimeline,2020)===0
  && townGrowthIndexForYear(growthTimeline,2025)===1
  && !buildTownGrowthTimeline([{repo:'one',created:'2020-01-01'},{repo:'two',created:'2020-05-01'}]).available,
  'shared years resolve to the nearest real milestone and one-year towns fail soft');
ok(createTownGrowthShareUrl('https://town.test/?user=octocat&twin=hub&dbg=1&perf=1&launch=1#repo=alpha',2021)
  ==='https://town.test/?user=octocat&growth=2021&ref=growth-replay',
  'the share URL preserves town identity while removing debug, launch, Twin Towns, and repo-modal state');
ok(!/window|document|fetch\(|WebSocket|localStorage|Date\.now|Math\.random/.test(TOWN_GROWTH_SRC)
  && TOWN_GROWTH_SRC.length<6000, 'the pure timeline helper is a small deterministic zero-network module');

const townGrowthBlock=(HTML.match(/\/\*TOWN_GROWTH_REPLAY:START\*\/([\s\S]*?)\/\*TOWN_GROWTH_REPLAY:END\*\//)||[,''])[1];
const growthFrame=(townGrowthBlock.match(/function _updateTownGrowthReplay\(dt\)\{([\s\S]*?)\n\}/)||[,''])[1];
ok(townGrowthBlock.length>0
  && /from '\.\/assets\/town-growth\.js\?v=town-growth-v1'/.test(HTML)
  && /const TOWN_GROWTH=buildTownGrowthTimeline\(REPOS\)/.test(HTML),
  'the loaded owner or public repo catalog feeds one local Growth Replay helper');
ok(/id="growthMenuBtn"/.test(HTML)&&/id="introGrowth"/.test(HTML)&&/id="growthBox"/.test(HTML)
  && /introGrowth\.hidden=!TOWN_GROWTH\.available/.test(HTML)
  && /renderFreshness\(\); renderCourse\(\); renderGrowthPassport\(\)/.test(HTML),
  'Wayfinding, personalized first-screen proof, and Passport expose the same available history');
ok(/id="growthReplay" class="hidden" aria-hidden="true"/.test(HTML)
  && /role="dialog" aria-modal="true" aria-labelledby="growthTitle" aria-describedby="growthSummary"/.test(HTML)
  && /id="growthRange" type="range"/.test(HTML)
  && /id="growthStatus" class="growthStatus" role="status" aria-live="polite" aria-atomic="true"/.test(HTML),
  'the year scrubber is an accessible labelled modal with atomic live feedback');
ok(/id="growthTruth" class="growthTruth" data-i18n="growthTruth"/.test(HTML)
  && /document\.getElementById\('growthTruth'\)\.textContent=t\('growthTruth'\)/.test(townGrowthBlock),
  'the replay always distinguishes truthful creation years from present-day building metrics');
ok(/function _growthFocusables\(\)/.test(townGrowthBlock)
  && /event\.key==='Escape'/.test(townGrowthBlock)&&/event\.key!=='Tab'/.test(townGrowthBlock)
  && /function _growthSuspendBackground\(saved\)/.test(townGrowthBlock)
  && /element\.inert=true/.test(townGrowthBlock)&&/function _growthRestoreBackground\(saved\)/.test(townGrowthBlock)
  && /growthRange\.setAttribute\('aria-label',t\('growthRange'\)\+'\s·\s'\+snapshot\.year\)/.test(townGrowthBlock)
  && /#growthReplay \.growthActions button, #growthReplay \.growthClose \{ min-height:44px/.test(HTML)
  && /#growthReplay \.growthPanel \{ width:100%; max-height:min\(62vh,520px\)/.test(HTML),
  'background UI is inert, focus is trapped, the slider names its year, and mobile actions stay 44px');
ok(/const _reqGrowth = .*get\('growth'\)/.test(HTML)
  && /startTownGrowthReplay\(\{entry:'link',year:_reqGrowth,autoplay:false\}\)/.test(HTML)
  && /introGrowth\.onclick=.*startTownGrowthReplay\(\{entry:'intro',autoplay:true\}\)/.test(HTML),
  'shared years open after town entry without autoplay while the explicit Watch action starts the story');
ok(/repo\._growthHidden=!visible/.test(townGrowthBlock)
  && /repo\._group\.visible=visible/.test(townGrowthBlock)
  && /repo\._group\.scale\.set\(1,\.025,1\)/.test(townGrowthBlock)
  && /newlyVisible\.slice\(0,3\)/.test(townGrowthBlock),
  'existing repo groups hide by creation year and only newly born houses receive a bounded reveal');
ok(/state\.entry\.forcedTier='far'; state\.entry\.active\.visible=false/.test(townGrowthBlock)
  && /state\.entry\.forcedTier=state\.forced; state\.entry\.active\.visible=state\.activeVisible/.test(townGrowthBlock),
  'the panoramic view forces existing far LOD and hides decorative active batches, then restores both exactly');
ok(/function _growthSuspendScenery\(saved\)/.test(townGrowthBlock)
  && /for\(const group of SWAY\) add\(group\)/.test(townGrowthBlock)
  && /for\(const live of RESIDENTS_LIVE\) add\(live\.group\)/.test(townGrowthBlock)
  && /MEMORIAL_TREE\.requestedVisible=false/.test(townGrowthBlock)
  && /function _growthRestoreScenery\(saved\)/.test(townGrowthBlock)
  && /MEMORIAL_TREE\.requestedVisible=saved\.worldTreeRequested/.test(townGrowthBlock),
  'non-historical residents, rides, pets, tree motion, and scenery pause outside the panorama and restore exactly');
ok(/cameraFar:camera\.far/.test(townGrowthBlock)&&/fogNear:scene\.fog\.near,fogFar:scene\.fog\.far/.test(townGrowthBlock)
  && /skyT,skyTarget,skyAuto,skyPhaseIdx,isNight/.test(townGrowthBlock)
  && /camera\.far=1100/.test(townGrowthBlock)&&/scene\.fog\.near=600; scene\.fog\.far=1100/.test(townGrowthBlock)
  && /scene\.fog\.near=saved\.fogNear; scene\.fog\.far=saved\.fogFar/.test(townGrowthBlock),
  'cinematic camera, daylight, and fog are replay-owned and restore the visitor world on close');
ok(/if\(GROWTH_REPLAY\.active\) return 'town-growth-replay'/.test(HTML)
  && /owner==='town-growth-replay'/.test(HTML)
  && /else if\(GROWTH_REPLAY\.active\)\{\s*clearKeys\(\)/.test(HTML),
  'Growth Replay owns camera and movement without competing with ClearSight or the player');
ok(growthFrame.length>0&&!/new\s+|REPOS|scene\.traverse|\.map\(|\.filter\(|fetch\(|setTimeout|setInterval/.test(growthFrame)
  && /GROWTH_REPLAY\.reveals/.test(growthFrame)&&/_growthPositionCamera\(dt,false\)/.test(growthFrame),
  'steady playback only advances a bounded reveal list and reusable camera vectors');
ok(!/new THREE\.(?:Mesh|InstancedMesh|Line|LineSegments|Points)|PointLight|SpotLight|DirectionalLight|fetch\(|WebSocket|setInterval/.test(townGrowthBlock)
  && /resources:\{draws:0,textures:0,lights:0,network:0,timers:0\}/.test(townGrowthBlock),
  'the feature adds no scene draw, texture, light, backend, or recurring timer');
ok(/createTownGrowthShareUrl\(location\.href,snapshot\.year\)/.test(townGrowthBlock)
  && /track\('share_click',\{channel:'town_growth'/.test(townGrowthBlock)
  && /openPostcardStudio\('growth'\)/.test(townGrowthBlock)
  && /params\.set\('growth',growth\); params\.set\('ref','growth-replay'\)/.test(HTML)
  && /growthShot\?tf\('growthPostcardRepoCount'/.test(HTML),
  'each era has a reversible share link and a truthful current-camera postcard with era-specific house counts');
ok(/if\(POSTCARD\.entry==='growth'\)[\s\S]*?panel\.inert=true[\s\S]*?aria-hidden','true'/.test(HTML)
  && /if\(modalOpen\)[\s\S]*?panel\.inert=false[\s\S]*?aria-hidden','false'/.test(HTML),
  'the era postcard becomes the only accessible modal, then returns focus ownership to Growth Replay');
ok(/maybeStarNudge\('town_growth_replay'\)/.test(townGrowthBlock)
  && /track\('town_growth_complete'/.test(townGrowthBlock)
  && /fireworksShow\(10\)/.test(townGrowthBlock),
  'watching the full personal history earns one existing Star invitation and a bounded celebration');
['growthMenu','growthMenuSub','growthPassportTitle','growthKicker','growthTitle','growthTitlePresent','growthSummary',
  'growthAdded','growthRange','growthPlay','growthPause','growthPresent','growthShare','growthPostcard','growthClose',
  'growthTruth','growthShared','growthComplete','growthUnavailable','growthPostcardRepoCount','growthPostcardSignature','introGrowth']
  .forEach(key=>ok((HTML.match(new RegExp(key+":[\\\"']",'g'))||[]).length===2,`Town Growth key ${key} is bilingual`));
ok(/window\.__townGrowth=/.test(townGrowthBlock)&&/window\.__growthOpen=/.test(townGrowthBlock)
  &&/window\.__growthStep=/.test(townGrowthBlock)&&/window\.__growthFinish=/.test(townGrowthBlock)
  &&/window\.__growthShare=/.test(townGrowthBlock)&&/window\.__growthPostcard=/.test(townGrowthBlock)
  &&/window\.__growthClose=/.test(townGrowthBlock),
  'diagnostics expose availability, exact years, visibility, playback, sharing, postcard, resources, and restoration');
ok(/Your repository history becomes a moving city story/.test(README_EN)
  &&/레포 역사가 움직이는 도시 이야기가 됩니다/.test(README_KO)
  &&/timeline covers repos still public today; house appearance and language labels/.test(README_EN)
  &&/현재도 공개된 레포만 시간축에 들어가며, 집의 모습과 언어 표시는 현재 메타데이터/.test(README_KO)
  &&/assets\/town-growth\.js/.test(README_EN)&&/assets\/town-growth\.js/.test(README_KO),
  'both READMEs explain the personal-history value, truth boundary, zero-cost runtime, and helper');

group('Repo Route — a visitor-authored path from value proof to referral and earned Star');
const routeCatalog=['Alpha','beta_repo','gamma.js'];
const routeReady=resolveRepoRouteRequest('?user=octocat&route=alpha,beta_repo&ref=repo-route',routeCatalog);
ok(routeReady.valid&&routeReady.reason==='ready'&&routeReady.repos.join(',')==='Alpha,beta_repo'
  && Object.isFrozen(routeReady)&&Object.isFrozen(routeReady.repos),
  'two current catalog names resolve case-insensitively to one immutable ordered route');
ok(!resolveRepoRouteRequest('?route=Alpha,alpha',routeCatalog).valid
  && !resolveRepoRouteRequest('?route=Alpha,missing',routeCatalog).valid
  && !resolveRepoRouteRequest('?route=Alpha,beta_repo',[]).valid,
  'duplicate, unavailable, and empty-catalog repository names fail closed instead of changing route meaning');
const routeOverflow=resolveRepoRouteRequest('?route=Alpha,beta_repo,gamma.js,fourth',routeCatalog);
const routeConflict=resolveRepoRouteRequest('?route=Alpha,beta_repo&repo=octocat/Alpha',routeCatalog);
const routeAmbiguous=resolveRepoRouteRequest('?route=Alpha,beta_repo&route=beta_repo,gamma.js',routeCatalog);
ok(!routeOverflow.valid&&routeOverflow.reason==='overflow'
  && !routeConflict.valid&&routeConflict.reason==='conflict'&&routeConflict.conflict==='repo'
  && !routeAmbiguous.valid&&routeAmbiguous.reason==='ambiguous',
  'a fourth stop, repeated route, and exclusive product query conflicts fail soft before runtime navigation');
ok(normalizeRepoRouteNames(['Alpha','alpha','bad/name','beta_repo'],routeCatalog).join(',')==='Alpha,beta_repo'
  && REPO_ROUTE_LIMITS.minStops===2&&REPO_ROUTE_LIMITS.maxStops===3,
  'normalization preserves first-seen order, canonical spelling, uniqueness, and the 2–3 stop boundary');
const publicRouteUrl=new URL(createRepoRouteUrl('Octo-Cat',['Alpha','beta_repo'],
  'https://town.test/?twin=friend&growth=2020&dbg=1#repo=old','owner'));
const ownerRouteUrl=new URL(createRepoRouteUrl('owner',['Alpha','beta_repo'],'https://town.test/?user=elsewhere','OWNER'));
ok(publicRouteUrl.searchParams.get('user')==='Octo-Cat'
  && publicRouteUrl.searchParams.get('route')==='Alpha,beta_repo'
  && publicRouteUrl.searchParams.get('ref')==='repo-route'
  && !publicRouteUrl.searchParams.has('twin')&&!publicRouteUrl.searchParams.has('growth')&&!publicRouteUrl.hash,
  'public-town share links preserve only town identity, ordered stops, and the Repo Route referral marker');
ok(!ownerRouteUrl.searchParams.has('user')&&ownerRouteUrl.searchParams.get('route')==='Alpha,beta_repo',
  'canonical owner routes omit the redundant username');
let routeCreateRejected=0;
for(const input of [['Alpha'],['Alpha','Alpha'],['Alpha','beta_repo','gamma.js','fourth'],['Alpha','bad/name']]){
  try{ createRepoRouteUrl('owner',input,'https://town.test/','owner'); }catch(error){ routeCreateRejected++; }
}
ok(routeCreateRejected===4, 'the link builder rejects insufficient, duplicate, overflow, and hostile route inputs');
ok(!/window|document|fetch\(|WebSocket|localStorage|sessionStorage|Date\.now|Math\.random/.test(REPO_ROUTE_SRC)
  && REPO_ROUTE_SRC.length<6000, 'the pure route helper is small, deterministic, and has no browser, network, storage, clock, or random dependency');

const repoRouteBlock=(HTML.match(/\/\*REPO_ROUTE:START\*\/([\s\S]*?)\/\*REPO_ROUTE:END\*\//)||[,''])[1];
ok(repoRouteBlock.length>0
  &&/from '\.\/assets\/repo-route\.js\?v=repo-route-v1'/.test(HTML)
  &&/resolveRepoRouteRequest\(location\.search,REPOS\.filter/.test(repoRouteBlock),
  'the loaded owner or public catalog feeds one pure current-town route resolver');
ok(/id="repoRouteMenuBtn"/.test(HTML)&&/id="repoRouteCardBtn"/.test(HTML)
  &&/id="repoRouteHud"/.test(HTML)&&/id="repoRouteMenuCount"/.test(HTML),
  'Wayfinding, every real repo card, and the compact world HUD expose one shared route state');
ok(/id="repoRouteModal" role="dialog" aria-modal="true" aria-labelledby="repoRouteTitle" aria-describedby="repoRouteSub"/.test(HTML)
  &&/id="repoRouteStatus" role="status" aria-live="polite" aria-atomic="true"/.test(HTML)
  &&/function _repoRouteFocusables\(\)/.test(repoRouteBlock)
  &&/!element\.closest\('\[hidden\]'\)/.test(repoRouteBlock)
  &&/event\.key==='Escape'/.test(repoRouteBlock)&&/event\.key!=='Tab'/.test(repoRouteBlock)
  &&/function _repoRouteSuspendBackground\(\)/.test(repoRouteBlock)&&/element\.inert=true/.test(repoRouteBlock)
  &&/\.repoRouteStop button, \.repoRouteSuggestion \{[^}]*min-width:44px; min-height:44px/.test(HTML)
  &&/\.repoRoutePrivacy\s*\{[^}]*color:#725a47/.test(HTML),
  'the bilingual builder is labelled, inert, focus-trapped, keyboard-safe, touch-sized, and contrast-safe');
ok(/REPO_ROUTE\.stops\[REPO_ROUTE\.index\]!==repo/.test(repoRouteBlock)
  &&/REPO_ROUTE\.index\+\+/.test(repoRouteBlock)
  &&/setNav\(REPO_ROUTE\.stops\[done\]\)/.test(repoRouteBlock),
  'only opening the current real house advances the ordered route and points to the next stop');
ok(/REPO_ROUTE_REQUEST\.valid&&cityMode!=='portal'/.test(HTML)
  &&/startRepoRoute\('link'\)/.test(HTML)
  &&/introRouteReady/.test(HTML)&&/enterRoute/.test(HTML),
  'a valid shared route proves its stop list before entry and starts only after the recipient enters town');
ok(/#intro\.hidden\s*\{[^}]*visibility:\s*hidden/.test(HTML),
  'the shared-route intro leaves the accessibility tree after its exit transition');
ok(/createRepoRouteUrl\(currentUser,REPO_ROUTE\.selected,_repoRouteBaseUrl\(\),OWNER\)/.test(repoRouteBlock)
  &&/typeof navigator\.share!=='function'/.test(repoRouteBlock)
  &&/_copyPostcardText\(_repoRouteUrl\(\)\)/.test(repoRouteBlock),
  'route sharing uses one canonical URL with native share and clipboard fallback');
ok(/if\(STAR_TRAIL\) endStarTrail\(\); if\(LANTERN_WATCH\) endLanternWatch\(\)/.test(repoRouteBlock)
  &&/if\(REPO_ROUTE\.active\|\|REPO_ROUTE\.complete\) endRepoRoute\('replaced'\)/.test(HTML)
  &&/startTownGrowthReplay\(options=\{\}\)[\s\S]{0,520}endRepoRoute\('replaced'\)/.test(HTML),
  'Repo Route, Constellation, Night Watch, and Growth Replay release competing HUD ownership');
ok(/maybeStarNudge\('repo_route_complete'\)/.test(repoRouteBlock)
  &&/if\(!REPO_ROUTE_REQUEST\.valid\) setTimeout\(\(\)=>\{ try\{ maybeStarNudge\('personal_town'\)/.test(HTML)
  &&/fireworksShow\(10\)/.test(repoRouteBlock)
  &&!/maybeStarNudge\(['"](?:repo_route_open|repo_route_start|repo_route_share)/.test(repoRouteBlock),
  'the existing Star invitation is earned after ordered completion, never on open, start, or share');
const routeTelemetry=(HTML.match(/function trackRepoRoute\(eventName,payload\)\{([\s\S]*?)\n\}/)||[,''])[1];
ok(/if\(ev\.__privacy==='repo-route'\)[\s\S]{0,260}new Set\(\['ev','ts','entry','device','lang','result','count','channel'\]\)/.test(HTML)
  &&routeTelemetry.length>0&&!/cityUser|targetUser|owner|url|sessionId|instanceId/.test(routeTelemetry)
  &&!/track\('repo_route/.test(repoRouteBlock),
  'route telemetry allowlists coarse funnel enums and cannot emit repository names or persistent identity');
ok(!/new THREE\.|fetch\(|WebSocket|localStorage|sessionStorage|setInterval/.test(repoRouteBlock)
  &&/resources:\{draws:0,textures:0,lights:0,network:0,timers:0\}/.test(HTML),
  'the route reuses existing houses and navigation with zero scene, network, storage, or recurring timer resources');
['routeMenu','routeMenuSub','routeTitle','routeSub','routeClose','routeEmpty','routeSuggestions','routeStart',
  'routeShare','routeCopy','routePrivacy','routeRemove','routeAddCard','routeRemoveCard','routeFull','routeReady',
  'routeCopied','routeShared','routeHudTheme','routeHudTarget','routeHudRide','routeHudShare','routeStop',
  'routeCompleteTitle','routeComplete','routeStarted','routeFound','introRouteReady','introRouteStats','enterRoute']
  .forEach(key=>ok((HTML.match(new RegExp(key+":[\\\"']",'g'))||[]).length===2,`Repo Route key ${key} is bilingual`));
ok(/window\.__repoRoute=/.test(HTML)&&/window\.__repoRouteOpen=/.test(HTML)
  &&/window\.__repoRouteAdd=/.test(HTML)&&/window\.__repoRouteStart=/.test(HTML)
  &&/window\.__repoRouteVisit=/.test(HTML)&&/window\.__repoRouteCopy=/.test(HTML)&&/window\.__repoRouteEnd=/.test(HTML),
  'browser diagnostics expose request, selection, order, progress, sharing, zero resources, and close behavior');
ok(/hand another developer the best path I found/.test(README_EN)
  &&/내가 발견한 가장 좋은 동선을 다른 개발자에게 건네기/.test(README_KO)
  &&/A visitor can hand off the route that proved the town's value/.test(README_EN)
  &&/방문자가 도시의 가치를 증명한 동선을 그대로 건넬 수 있습니다/.test(README_KO),
  'both READMEs explain the value-first multi-repo handoff and earned Star boundary');
ok(/## 12\. Repo Route/.test(DOMAIN_MODEL)&&/Repo Route is a current-catalog path/.test(KNOWN_LIMITATIONS)
  &&/## Share a Repo Route/.test(SHARE_LINKS)&&/repo_route: assets\/repo-route\.js/.test(MANIFEST)
  &&/assets\/repo-route\.js/.test(LLMS_INDEX)&&/\| Repo Route \| 5 \| 5 \| 4 \| 5 \| 5 \| \*\*24\*\* \|/.test(CHANGELOG),
  'domain model, limitations, share contract, manifest, LLM index, and scored BOLT decision stay discoverable');

group('Open Source Quests — current public work becomes a contribution journey');
const questSearchUrl=new URL(createContributionQuestSearchUrl('Octo-Cat'));
ok(questSearchUrl.origin==='https://api.github.com'&&questSearchUrl.pathname==='/search/issues'
  &&questSearchUrl.searchParams.get('q')==='user:Octo-Cat is:issue is:open'
  &&questSearchUrl.searchParams.get('per_page')==='50'&&questSearchUrl.searchParams.get('sort')==='updated'
  &&questSearchUrl.searchParams.get('order')==='desc',
  'one bounded anonymous search asks only for the current town owner’s open public issues');
const questIssue={
  state:'open',number:7,title:'  Fix keyboard focus in the town menu  ',updated_at:'2026-08-22T12:00:00Z',comments:4,
  repository_url:'https://api.github.com/repos/Octo-Cat/Alpha',
  html_url:'https://github.com/Octo-Cat/Alpha/issues/7',
  labels:[{name:'good first issue'},{name:'accessibility'},{name:'accessibility'},{name:'frontend'},{name:'overflow'}],
  assignees:[]
};
const projectedQuest=projectContributionQuest(questIssue,'octo-cat',['Alpha','Beta']);
ok(projectedQuest?.repo==='Alpha'&&projectedQuest.number===7&&projectedQuest.tier==='good-first'
  &&projectedQuest.url==='https://github.com/octo-cat/Alpha/issues/7'
  &&projectedQuest.labels.join(',')==='good first issue,accessibility,frontend,overflow'&&projectedQuest.assigned===false
  &&Object.isFrozen(projectedQuest)&&Object.isFrozen(projectedQuest.labels),
  'the pure projection keeps only safe issue facts, canonical catalog spelling, bounded labels, and immutable output');
ok(projectContributionQuest({...questIssue,pull_request:{}},'octo-cat',['Alpha'])===null
  &&projectContributionQuest({...questIssue,state:'closed'},'octo-cat',['Alpha'])===null
  &&projectContributionQuest({...questIssue,state:undefined},'octo-cat',['Alpha'])===null
  &&projectContributionQuest({...questIssue,updated_at:'invalid'},'octo-cat',['Alpha'])===null
  &&projectContributionQuest({...questIssue,repository_url:'https://api.github.com/repos/elsewhere/Alpha'},'octo-cat',['Alpha'])===null
  &&projectContributionQuest({...questIssue,html_url:'https://evil.test/redirect'},'octo-cat',['Alpha'])?.url==='https://github.com/octo-cat/Alpha/issues/7'
  &&projectContributionQuest({...questIssue,repository_url:'https://api.github.com/repos/Octo-Cat/Missing',
    html_url:'https://github.com/Octo-Cat/Missing/issues/7'},'octo-cat',['Alpha'])===null,
  'pull requests, non-open or undated work, foreign owners, and non-town repositories fail closed while hostile issue URLs are replaced canonically');
const questCandidate=(repo,number,label,updated)=>({...questIssue,number,title:`Issue ${number}`,
  repository_url:`https://api.github.com/repos/Octo-Cat/${repo}`,
  html_url:`https://github.com/Octo-Cat/${repo}/issues/${number}`,updated_at:updated,
  labels:label?[{name:label}]:[]});
const selectedQuests=selectContributionQuests([
  questCandidate('Alpha',1,'good first issue','2026-08-20T00:00:00Z'),
  questCandidate('Alpha',2,'help wanted','2026-08-23T00:00:00Z'),
  questCandidate('Alpha',3,'','2026-08-22T00:00:00Z'),
  questCandidate('Beta',4,'','2026-08-21T00:00:00Z')
],'octo-cat',['Alpha','Beta']);
ok(selectedQuests.map(quest=>`${quest.repo}#${quest.number}`).join(',')==='Alpha#1,Alpha#2,Beta#4'
  &&selectedQuests.length===CONTRIBUTION_QUEST_LIMITS.maxQuests
  &&selectedQuests.filter(quest=>quest.repo==='Alpha').length===CONTRIBUTION_QUEST_LIMITS.maxPerRepo
  &&Object.isFrozen(selectedQuests),
  'selection ranks good-first/help-wanted work first, then recent open work, while preserving repo diversity and a three-card cap');
ok(CONTRIBUTION_QUEST_LIMITS.maxItems===50&&CONTRIBUTION_QUEST_LIMITS.maxQuests===3
  &&CONTRIBUTION_QUEST_LIMITS.maxPerRepo===2&&CONTRIBUTION_QUEST_LIMITS.maxLabels===8
  &&!/window|document|fetch\(|WebSocket|localStorage|sessionStorage|Date\.now|Math\.random/.test(CONTRIBUTION_QUEST_SRC)
  &&CONTRIBUTION_QUEST_SRC.length<9000,
  'the quest helper is small, deterministic, bounded, and independent of browser, network, storage, clock, and random state');

const contributionQuestBlock=(HTML.match(/\/\*CONTRIBUTION_QUESTS:START\*\/([\s\S]*?)\/\*CONTRIBUTION_QUESTS:END\*\//)||[,''])[1];
ok(contributionQuestBlock.length>0
  &&/from '\.\/assets\/contribution-quests\.js\?v=open-source-quests-v1'/.test(HTML)
  &&/id="questMenuBtn"/.test(HTML)&&/id="questModal" role="dialog" aria-modal="true" aria-labelledby="questTitle" aria-describedby="questSub questLead"/.test(HTML),
  'Wayfinding exposes one labelled Open Source Quests dialog backed by the pure helper');
ok(/id="questStatus" role="status" aria-live="polite" aria-atomic="true" tabindex="-1"/.test(HTML)
  &&/id="questList" role="list" data-i18n-aria="questListAria"/.test(HTML)
  &&/function _questFocusables\(\)/.test(contributionQuestBlock)
  &&/event\.key==='Escape'/.test(contributionQuestBlock)&&/event\.key!=='Tab'/.test(contributionQuestBlock)
  &&/function _questSuspendBackground\(\)/.test(contributionQuestBlock)&&/element\.inert=true/.test(contributionQuestBlock)
  &&/const focusTarget=previous&&previous\.isConnected&&!previous\.closest\?\.\('\.hidden'\)\?previous:menuBtn/.test(contributionQuestBlock)
  &&/\.questCardActions button, \.questCardActions a, #questScan \{[^}]*min-height:44px/.test(HTML)
  &&/@media \(max-width:520px\) \{[\s\S]*?\.questCardActions \{ grid-template-columns:1fr; \}/.test(HTML)
  &&/@media \(prefers-reduced-motion:reduce\) \{[\s\S]*?\.questStudio, \.questCard \{ transition:none/.test(HTML),
  'the modal is live-announced, inert, focus-trapped, keyboard-safe, touch-sized, mobile-stacked, and reduced-motion-safe');
ok((contributionQuestBlock.match(/fetch\(/g)||[]).length===1
  &&/questScan\.onclick=loadContributionQuests/.test(contributionQuestBlock)
  &&/questMenuBtn\.onclick=\(\)=>openContributionQuestBoard\('menu'\)/.test(contributionQuestBlock)
  &&/fetch\(createContributionQuestSearchUrl\(currentUser\)/.test(contributionQuestBlock)
  &&/REPOS\.filter\(repo=>!repo\._isLibrary&&!repo\.archived\)/.test(contributionQuestBlock)
  &&/if\(CONTRIBUTION_QUESTS\.loading\|\|CONTRIBUTION_QUESTS\.loaded\) return false/.test(contributionQuestBlock)
  &&/setTimeout\(\(\)=>controller\.abort\(\),9000\)/.test(contributionQuestBlock)
  &&/if\(returnFocus&&CONTRIBUTION_QUESTS\.open\) setTimeout\(\(\)=>questStatus\.focus\(\),0\)/.test(contributionQuestBlock),
  'GitHub is read once only after Find, with one request, a timeout, no startup call, no repeat, and a visible focus destination');
ok(/title\.textContent=quest\.title/.test(contributionQuestBlock)
  &&/repo\.textContent=quest\.repo\+'\ · #'\+quest\.number/.test(contributionQuestBlock)
  &&/issue\.href=quest\.url/.test(contributionQuestBlock)
  &&/tf\('questVisitAria',\{repo:quest\.repo,number:quest\.number\}\)/.test(contributionQuestBlock)
  &&/tf\('questOpenAria',\{repo:quest\.repo,number:quest\.number\}\)/.test(contributionQuestBlock)
  &&!/innerHTML/.test(contributionQuestBlock),
  'untrusted issue titles, labels, repository names, and canonical links enter the UI without HTML injection');
ok(/guideToContributionQuest\(quest\)[\s\S]*?taxiTo\(repo\)/.test(contributionQuestBlock)
  &&/syncContributionQuestCardAction\(repo,act\)/.test(HTML)
  &&/link\.href=quest\.url/.test(contributionQuestBlock)
  &&/link\.onclick=\(\)=>markContributionQuestHandoff\(quest,'repo_card'\)/.test(contributionQuestBlock),
  'a selected quest reuses the real taxi and repository card before the exact issue handoff');
ok((contributionQuestBlock.match(/maybeStarNudge\(/g)||[]).length===1
  &&/maybeStarNudge\('contribution_quest_handoff'\)/.test(contributionQuestBlock)
  &&/flushStarNudge\(\)/.test(contributionQuestBlock)
  &&!/window\.open/.test(contributionQuestBlock),
  'the existing dismissible Star invitation becomes eligible only after an explicit GitHub issue handoff and never auto-navigates');
const questTelemetry=(HTML.match(/function trackContributionQuest\(eventName,payload\)\{([\s\S]*?)\n\}/)||[,''])[1];
ok(/if\(ev\.__privacy==='contribution-quest'\)[\s\S]{0,300}new Set\(\['ev','ts','entry','device','lang','result','count','tier','channel'\]\)/.test(HTML)
  &&questTelemetry.length>0&&!/cityUser|targetUser|owner|repo|issue|number|title|url|sessionId|instanceId/.test(questTelemetry)
  &&!/track\('contribution_quest/.test(contributionQuestBlock),
  'quest telemetry permits coarse funnel enums only and cannot emit owner, repository, issue, URL, or persistent identity');
ok(!/new THREE\.|WebSocket|localStorage|sessionStorage|setInterval/.test(contributionQuestBlock)
  &&/resources:\{draws:0,textures:0,lights:0,startupNetwork:0,explicitRequests:CONTRIBUTION_QUESTS\.fetches,storage:0,recurringTimers:0\}/.test(contributionQuestBlock),
  'quests add no scene resource, storage, backend, or recurring timer; diagnostics distinguish zero startup traffic from explicit reads');
['questMenu','questMenuSub','questTitle','questSub','questClose','questLead','questListAria','questBeforeScan',
  'questScan','questScanning','questTryAgain','questReady','questEmpty','questRate','questNetwork','questTierGood',
  'questTierHelp','questTierOpen','questUpdatedToday','questUpdatedDays','questUnassigned','questAssigned','questComments',
  'questVisit','questVisitAria','questOpen','questOpenAria','questCardOpen','questGuiding','questHandoff','questUnavailable','questPrivacy']
  .forEach(key=>ok((HTML.match(new RegExp(key+":[\\\"']",'g'))||[]).length===2,`Open Source Quests key ${key} is bilingual`));
ok(/window\.__questBoard=/.test(contributionQuestBlock)&&/window\.__questOpen=/.test(contributionQuestBlock)
  &&/window\.__questLoad=/.test(contributionQuestBlock)&&/window\.__questSelect=/.test(contributionQuestBlock)
  &&/window\.__questHandoff=/.test(contributionQuestBlock)&&/window\.__questClose=/.test(contributionQuestBlock),
  'browser diagnostics expose explicit requests, sanitized quest identities, selection, handoff, resources, and close behavior');
ok(/current public issues ranked for approachability, each connected to its real repo house/.test(README_EN)
  &&/실제로 도울 수 있는 레포 집/.test(README_KO)
  &&/## 13\. Open Source Quests/.test(DOMAIN_MODEL)&&/Open Source Quests uses GitHub's anonymous search/.test(KNOWN_LIMITATIONS)
  &&/contribution_quests: assets\/contribution-quests\.js/.test(MANIFEST)
  &&/assets\/contribution-quests\.js/.test(LLMS_INDEX)
  &&/\| Open Source Quest Board \| 5 \| 5 \| 5 \| 4 \| 3 \| \*\*22\*\* \|/.test(CHANGELOG),
  'READMEs, domain model, limitations, manifest, LLM index, and scored BOLT decision make the contribution loop discoverable');

const runtimeLocalFiles = [
  'index.html','repolis.config.js','scholars.js','repos.json','data/city-state.json','assets/contribution-library.json',
  'assets/world-tree/createRepolisHero.js','assets/camera-obstruction.js','assets/canal-ferry.js',
  'assets/public-town-proof.js','assets/rain-garden.js','assets/town-postcard.js','assets/twin-towns.js','assets/town-creator.js','assets/town-growth.js','assets/repo-portal.js','assets/repo-route.js','assets/contribution-quests.js','assets/city-time.js',
  'council/council.config.json','council/engine.js','council/fixtures.js','council/guards.js','council/live.js'
];
const runtimeLocalBytes = runtimeLocalFiles.reduce((sum,file)=>sum+readFileSync(join(ROOT,file)).length,0);
ok(runtimeLocalBytes < 5*1024*1024, 'the complete uncompressed local runtime remains below the 5 MiB transfer ceiling');

group('star funnel — earned invitation + the events that show where visitors drop');
ok(/id="starNudge"/.test(HTML) && /id="starNudgeGo"/.test(HTML) && /id="starNudgeX"/.test(HTML), 'the town carries a dismissible star invitation with its own close control');
ok((HTML.match(/starNudge:'/g)||[]).length===2 && (HTML.match(/starNudgeGo:'/g)||[]).length===2, 'the invitation copy is bilingual');
ok(/if\(passport\.repos\.length>=3\) maybeStarNudge\('repos_visited'\)/.test(HTML)
  &&/if\(cityMode==='public'\)\{[\s\S]*?maybeStarNudge\('personal_town'\)/.test(HTML), 'the invitation is earned: three explored repo houses, or time spent in a self-built town');
ok(/if\(_starNudgeShown\|\|_starNudgeSeen\(\)\) return false/.test(HTML)
  &&/if\(modalOpen\|\|\(tour&&tour\.active\)\|\|repositoryAtelierActive\(\)\)\{ _starNudgePending=reason; return false; \}/.test(HTML)
  &&/function flushStarNudge\(\)/.test(HTML)
  &&/clearRepoHash\(\); flushStarNudge\(\);/.test(HTML)
  &&/localStorage\.setItem\(STAR_NUDGE_KEY,how\)/.test(HTML), 'it shows at most once per browser, waits out a modal or the tour, and returns when the visitor steps back out');
ok(/REPOLIS_CONFIG&&REPOLIS_CONFIG\.project&&REPOLIS_CONFIG\.project\.url/.test(HTML), 'a fork still credits the upstream project it runs on');
['town_enter','intro_launch_invalid','intro_personal_preview','star_nudge_shown','star_nudge_dismiss','project_star_click']
  .forEach(ev => ok(HTML.includes(`track('${ev}'`), `funnel event ${ev} is instrumented`));

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

group('Town Postcard Studio — current-view local artifact loop');
const postcardRepos = [
  { repo: 'atlas', lang: 'JavaScript', stars: 9, forks: 2 },
  { repo: 'beacon', lang: 'Rust', stars: 4, forks: 1 },
  { repo: 'canopy', lang: 'JavaScript', stars: 2, forks: 0 }
];
const postcardIdentity = createTownPostcardIdentity('Octo-Cat', postcardRepos);
const postcardIdentityReordered = createTownPostcardIdentity('octo-cat', postcardRepos.slice().reverse());
const postcardIdentityChanged = createTownPostcardIdentity('octo-cat', [{ ...postcardRepos[0], stars: 10 }, ...postcardRepos.slice(1)]);
ok(JSON.stringify(postcardIdentity) === JSON.stringify(postcardIdentityReordered),
  'username normalization and sorted public metadata produce one deterministic civic identity');
ok(postcardIdentity.palette.name === postcardIdentityChanged.palette.name
  && postcardIdentity.hash !== postcardIdentityChanged.hash && postcardIdentity.letters === 'OC',
  'username fixes the recognizable palette while public repository metadata personalizes the seal');
const readmePortal = createTownReadmePortal('Octo-Cat', 'https://example.github.io/town/index.html?preview=1');
ok(readmePortal.townUrl === 'https://example.github.io/town/?user=octo-cat&ref=profile-readme'
  && readmePortal.bannerUrl === 'https://example.github.io/town/assets/banner.svg'
  && readmePortal.html.includes('width="600"') && readmePortal.html.includes("Walk @octo-cat's GitHub town in Repolis"),
  'the profile README portal is a stable personalized link with a bounded self-hostable banner');
let invalidPortalRejected = false;
try { createTownReadmePortal('not/a/login'); } catch (error) { invalidPortalRejected = error instanceof TypeError; }
ok(invalidPortalRejected, 'the README portal rejects values outside the GitHub login grammar');
const postcardLanguageSummary = summarizeTownRepos(postcardRepos);
const postcardRepoSummary = summarizeTownRepos(postcardRepos.map(repo => ({ ...repo, lang: 'Other' })));
ok(postcardLanguageSummary.type === 'languages' && postcardLanguageSummary.items[0].name === 'JavaScript'
  && postcardLanguageSummary.items[0].count === 2 && postcardRepoSummary.type === 'repos'
  && postcardRepoSummary.items.map(item => item.name).join(',') === 'atlas,beacon,canopy',
  'truthful signatures prefer counted top languages and deterministically fall back to top public repositories');
ok(postcardFormatForViewport(390, 844) === POSTCARD_FORMATS.portrait
  && postcardFormatForViewport(1440, 900) === POSTCARD_FORMATS.landscape
  && POSTCARD_FORMATS.portrait.width === 1200 && POSTCARD_FORMATS.portrait.height === 1500
  && POSTCARD_FORMATS.landscape.width === 1600 && POSTCARD_FORMATS.landscape.height === 1000,
  'mobile and desktop choose legible fixed social-card output dimensions');
const postcardCapture = postcardCaptureSize(4000, 3000);
ok(postcardCapture.pixels <= 1800000 && Math.max(postcardCapture.width, postcardCapture.height) <= 1600
  && Math.abs(postcardCapture.width / postcardCapture.height - 4 / 3) < 0.002,
  'one-shot capture keeps its aspect ratio inside the 1.8MP and 1600px GPU budget');
const blankPixels = new Uint8Array(4 * 4 * 4);
const flatPixels = new Uint8Array(4 * 4 * 4);
const variedPixels = new Uint8Array(4 * 4 * 4);
for (let i = 0; i < 16; i++) {
  flatPixels.set([48, 48, 48, 255], i * 4);
  variedPixels.set(i % 2 ? [244, 225, 180, 255] : [18, 42, 60, 255], i * 4);
}
ok(analyzeTownFrame(blankPixels, 4, 4).blank && analyzeTownFrame(flatPixels, 4, 4).blank
  && !analyzeTownFrame(variedPixels, 4, 4).blank,
  'transparent and flat WebGL frames fail explicitly while an opaque varied town frame passes');
const flippedPixels = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);
flipPixelRows(flippedPixels, 2, 2);
ok(flippedPixels[0] === 7 && flippedPixels[4] === 10 && flippedPixels[8] === 1 && flippedPixels[12] === 4,
  'readback rows are deterministically flipped from WebGL to canvas coordinates');

const postcardBlock = (HTML.match(/\/\* ====================== 📸 TOWN POSTCARD STUDIO ====================== \*\/([\s\S]*?)\/\* ====================== LLM TAXI DRIVER/) || [, ''])[1];
const postcardCaptureBlock = (postcardBlock.match(/function _capturePostcardComposite\(\)\{([\s\S]*?)\n\}/) || [, ''])[1];
ok(/id="postcardMenuBtn"/.test(HTML) && /id="postcardModal" role="dialog" aria-modal="true"/.test(HTML)
  && /aria-labelledby="postcardTitle" aria-describedby="postcardSub"/.test(HTML)
  && /id="postcardStatus" role="status" aria-live="polite"/.test(HTML),
  'Wayfinding exposes one native dialog with named controls and a polite live status');
ok(/buildPostcardKiosk/.test(HTML) && /new THREE\.Vector3\(-9\.5,0,14\.5\)/.test(HTML)
  && /nearPostcardKiosk\) openPostcardStudio\('kiosk'\)/.test(HTML)
  && /actBtn\.textContent='📸'/.test(HTML) && /LM\.push\(\[POSTCARD_KIOSK\._pos\.x,POSTCARD_KIOSK\._pos\.z,'📸'\]\)/.test(HTML),
  'a non-HUD civic kiosk supports Enter/mobile action and the existing minimap vocabulary');
ok(/renderer\.getRenderTarget\(\)/.test(postcardCaptureBlock)
  && /captureComposer\.addPass\(finalMix\)/.test(postcardCaptureBlock)
  && /const outputPass=finalComposer\.passes\[1\]/.test(postcardCaptureBlock)
  && /captureComposer\.addPass\(outputPass\)/.test(postcardCaptureBlock)
  && /readRenderTargetPixels/.test(postcardCaptureBlock),
  'capture replays the latest real base/bloom composite through the existing final color pass');
ok(/renderer\.setRenderTarget\(savedTarget\)/.test(postcardCaptureBlock)
  && /renderer\.autoClear=savedAutoClear/.test(postcardCaptureBlock)
  && /finalMix\.renderToScreen=savedMixToScreen/.test(postcardCaptureBlock)
  && /outputPass\.renderToScreen=savedOutputToScreen/.test(postcardCaptureBlock)
  && /outputPass\.uniforms\.tDiffuse\.value=savedOutputTexture/.test(postcardCaptureBlock)
  && /renderTarget1\.dispose\(\)/.test(postcardCaptureBlock) && /renderTarget2\.dispose\(\)/.test(postcardCaptureBlock)
  && /activeTargets=Math\.max\(0,POSTCARD\.activeTargets-2\)/.test(postcardCaptureBlock),
  'temporary targets are disposed and renderer target/autoclear state is restored on every outcome');
ok(!/preserveDrawingBuffer|renderer\.setSize|camera\.position|player\.position|requestAnimationFrame/.test(postcardCaptureBlock)
  && !/renderTownPostcard|_capturePostcardComposite/.test((HTML.match(/function animate\([\s\S]*?requestAnimationFrame\(animate\)/) || [''])[0]),
  'export neither resizes/moves the live world nor enters the steady frame loop');
ok(!/fetch\(|XMLHttpRequest|FormData|WebSocket|GROUNDED/.test(postcardBlock + POSTCARD_SRC)
  && /Everything stays in this browser\. The image is never uploaded\./.test(HTML)
  && /이 브라우저 안에서만 이뤄지며 이미지는 업로드되지 않아요/.test(HTML),
  'image composition is local-only and the bilingual privacy boundary is explicit');
ok(/navigator\.canShare\(\{files:\[file\]\}\)/.test(postcardBlock)
  && /navigator\.share\(\{files:\[file\],[\s\S]*?url:_postcardShareUrl\(\)\}\)/.test(postcardBlock)
  && /URL\.createObjectURL\(POSTCARD\.blob\)/.test(postcardBlock)
  && /navigator\.clipboard&&navigator\.clipboard\.writeText/.test(postcardBlock),
  'native PNG file sharing includes the exact URL with download and copy-link fallbacks');
ok(/id="postcardReadme"/.test(HTML) && /createTownReadmePortal\(currentUser,_postcardPublishedBase\(\)\)/.test(postcardBlock)
  && /track\('share_click',\{channel:'profile_readme',ok\}\)/.test(postcardBlock)
  && /maybeStarNudge\('profile_readme'\)/.test(postcardBlock),
  'the postcard studio copies a persistent profile portal and schedules its earned star invitation');
ok(/postcardCaptureBlank/.test(postcardBlock) && /postcardCaptureContext/.test(postcardBlock)
  && /postcardCaptureSecurity/.test(postcardBlock) && /forceBlank/.test(postcardBlock)
  && /forceFallback/.test(postcardBlock),
  'blank, lost-context, CORS/security, generic capture, and forced fallback paths stay visible and testable');
ok(/if\(ride\|\|ferris\|\|carousel\|\|canalFerryRide\|\|performance\.now\(\)<ridePostActionUntil\)/.test(postcardBlock)
  && (HTML.match(/postcardMotionBusy:/g) || []).length === 2
  && /ridePostActionUntil=performance\.now\(\)\+700; setTimeout\(\(\)=>openCard\(repo\),500\)/.test(HTML),
  'moving rides and delayed arrival UI cannot overlap the postcard dialog');
['postcard_open', 'postcard_render', 'postcard_share', 'postcard_download'].forEach(event =>
  ok(postcardBlock.includes(`track('${event}'`), `postcard event ${event} is instrumented`));
ok(!/track\('postcard_[^']+',\{[^}]*?(?:url|blob|image)/.test(postcardBlock),
  'postcard-specific analytics payloads stay bounded and omit URL, blob, and image data');
ok((HTML.match(/postcardTitle:/g) || []).length === 2 && (HTML.match(/postcardPrivacy:/g) || []).length === 2
  && (HTML.match(/postcardReadmeCopied:/g) || []).length === 2
  && (HTML.match(/postcardCaptureBlank:/g) || []).length === 2 && /@media \(max-width: 520px\)[\s\S]*?\.postcardActions \{ grid-template-columns: 1fr 1fr/.test(HTML)
  && /\.postcardActions button \{ min-height: 46px/.test(HTML) && /\.postcardActions \.readme \{ grid-column: 1 \/ -1/.test(HTML)
  && /\.postcardClose \{[^}]*width: 44px; height: 44px/.test(HTML),
  'KO/EN states and 44px-plus responsive controls remain legible at 390×844');
ok(/window\.__postcardOpen=/.test(HTML) && /window\.__postcardRetake=/.test(HTML)
  && /window\.__postcardFallback=/.test(HTML) && /window\.__postcardPixels=/.test(HTML)
  && /window\.__postcardPortal=/.test(HTML) && /window\.__postcardCopyReadme=/.test(HTML)
  && /window\.__postcardKiosk=/.test(HTML) && /activeTargets:POSTCARD\.activeTargets/.test(HTML)
  && /stateRestored:POSTCARD\.stateRestored/.test(HTML),
  'bounded diagnostics cover open/render/blank/fallback/pixels/kiosk and resource lifetime');

group('ClearSight camera — pure obstruction math, arrival framing, and ownership');
const nearNumber = (actual, expected, epsilon = 1e-6) => Math.abs(actual - expected) <= epsilon;
const cameraQuery = (focus, desired, requested, extra = {}) => ({
  focusX: focus[0], focusY: focus[1], focusZ: focus[2],
  desiredX: desired[0], desiredY: desired[1], desiredZ: desired[2],
  requestedDistance: requested, padding: 0, surfaceEpsilon: 0, minDistance: 1, ...extra
});
let cameraResult = {};
resolveCameraObstruction(cameraQuery([0, 1, 0], [10, 1, 0], 10),
  [{ x: 5, z: 0, r: 1, minY: 0, maxY: 2, cameraId: 'middle' }], cameraResult);
ok(cameraResult.valid && cameraResult.blocked && nearNumber(cameraResult.distance, 4)
  && cameraResult.hit.cameraId === 'middle', 'segment crossing a height-bounded collider resolves immediately before its near face');

cameraResult = {};
resolveCameraObstruction(cameraQuery([0, 4, 0], [10, 4, 0], 10),
  [{ x: 5, z: 0, r: 2, minY: 0, maxY: 3 }], cameraResult);
ok(cameraResult.valid && !cameraResult.blocked && cameraResult.distance === 10,
  'a horizontal overlap outside the collider height range is not a false positive');

cameraResult = {};
resolveCameraObstruction(cameraQuery([0, 1, 0], [12, 1, 0], 12),
  [{ x: 9, z: 0, r: 1, minY: 0, maxY: 3, cameraId: 'far' },
    { x: 4, z: 0, r: 1, minY: 0, maxY: 3, cameraId: 'near' }], cameraResult);
ok(cameraResult.blocked && cameraResult.hit.cameraId === 'near' && nearNumber(cameraResult.distance, 3),
  'multiple colliders resolve to the nearest hit regardless of registry order');

const internal = {}, tangent = {}, short = {}, invalid = {};
resolveCameraObstruction(cameraQuery([0, 1, 0], [8, 1, 0], 8),
  [{ x: 0, z: 0, r: 2, minY: 0, maxY: 2 }], internal);
resolveCameraObstruction(cameraQuery([0, 1, 1], [10, 1, 1], 10),
  [{ x: 5, z: 0, r: 1, minY: 0, maxY: 2 }], tangent);
resolveCameraObstruction(cameraQuery([0, 1, 0], [.5, 1, 0], .5),
  [{ x: 0, z: 0, r: 1, minY: 0, maxY: 2 }], short);
resolveCameraObstruction(cameraQuery([0, 1, 0], [NaN, 1, 0], NaN), [], invalid);
ok(internal.blocked && internal.distance === 0 && tangent.blocked && nearNumber(tangent.distance, 5)
  && short.blocked && short.distance === 0 && !invalid.valid && !invalid.blocked && Number.isFinite(invalid.distance),
  'inside-start, tangent, sub-minimum request, and NaN inputs are deterministic and fail soft');
const outward = {};
resolveCameraObstruction(cameraQuery([2, 1, 0], [8, 1, 0], 6),
  [{ x: 0, z: 0, r: 2, minY: 0, maxY: 2 }], outward);
ok(!outward.blocked && outward.distance === 6, 'a camera moving outward from a collider boundary is not trapped at the focus point');

const padded = {}, minimum = {};
resolveCameraObstruction(cameraQuery([0, 1, 0], [10, 1, 0], 10, { padding: .5 }),
  [{ x: 5, z: 0, r: 1, minY: 0, maxY: 2 }], padded);
resolveCameraObstruction(cameraQuery([0, 1, 0], [3, 1, 0], 3, { minDistance: 1 }),
  [{ x: 1, z: 0, r: .8, minY: 0, maxY: 2 }], minimum);
const fastIn = stepCameraResolvedDistance(10, 4, 10, true, 1 / 60, CAMERA_OBSTRUCTION_DEFAULTS);
const slowOut = stepCameraResolvedDistance(4, 10, 10, false, 1 / 60, CAMERA_OBSTRUCTION_DEFAULTS);
const hysteresisHold = stepCameraResolvedDistance(4, 4.2, 10, true, 1 / 60, CAMERA_OBSTRUCTION_DEFAULTS);
ok(nearNumber(padded.distance, 3.5) && nearNumber(minimum.distance, .2)
  && 10 - fastIn > slowOut - 4 && hysteresisHold === 4,
  'padding, minimum distance, fast-in/slow-out, and outward hysteresis stay deterministic');

const clear = {};
resolveCameraObstruction(cameraQuery([2, 1.7, -3], [11, 7, 4], 13), [], clear);
ok(clear.valid && !clear.blocked && clear.distance === 13 && clear.fraction === 1,
  'clear space preserves the requested camDist and the existing desired pose exactly');

const starlightBlockers = [], starlightX = 130, starlightZ = 130;
for (let i = 0; i < 9; i++) {
  const angle = i / 9 * Math.PI * 2 + Math.PI / 36;
  const x = starlightX + Math.cos(angle) * 13, z = starlightZ + Math.sin(angle) * 13;
  starlightBlockers.push(
    { x, z, r: 3.15, minY: 0, maxY: 3.3, cameraId: 'home-' + i },
    { x, z, r: 3.9, minY: 3.05, maxY: 6.15, cameraId: 'home-' + i + '-roof' }
  );
}
const spawnX = 2.6, spawnZ = -3.2, routeX = starlightX - spawnX, routeZ = starlightZ - spawnZ;
const routeLength = Math.hypot(routeX, routeZ);
const arrivalX = starlightX - routeX / routeLength * 6, arrivalZ = starlightZ - routeZ / routeLength * 6;
const arrivalBaseYaw = Math.atan2(arrivalX - starlightX, arrivalZ - starlightZ);
const arrivalQuery = {
  focusX: arrivalX, focusY: 1.7, focusZ: arrivalZ, destinationX: starlightX, destinationZ: starlightZ,
  currentYaw: arrivalBaseYaw, pitch: .42, requestedDistance: 13, verticalBaseOffset: -.2,
  padding: CAMERA_OBSTRUCTION_DEFAULTS.padding, surfaceEpsilon: CAMERA_OBSTRUCTION_DEFAULTS.surfaceEpsilon,
  minDistance: CAMERA_OBSTRUCTION_DEFAULTS.minDistance, softPadding: .12
};
const arrivalResult = {
  yaws: new Float64Array(CAMERA_ARRIVAL_OFFSETS.length), distances: new Float64Array(CAMERA_ARRIVAL_OFFSETS.length),
  scores: new Float64Array(CAMERA_ARRIVAL_OFFSETS.length), softHits: new Uint8Array(CAMERA_ARRIVAL_OFFSETS.length)
};
const arrivalScratch = { query: {}, hard: {}, soft: {} };
chooseCameraArrivalYaw(arrivalQuery, starlightBlockers, [{
  x: starlightX - 8 / Math.sqrt(2), z: starlightZ - 8 / Math.sqrt(2),
  r: .45, cameraR: 1.4, minY: 0, maxY: 2.9, cameraId: 'starlight-row-sign'
}], CAMERA_ARRIVAL_OFFSETS, arrivalResult, arrivalScratch);
ok(arrivalResult.valid && arrivalResult.index === 10
  && nearNumber(arrivalResult.yaw - arrivalBaseYaw, Math.PI * 5 / 12)
  && arrivalResult.softHits[0] === 1 && !arrivalResult.softBlocked
  && arrivalResult.clearDistance > 7.5,
  'deterministic Starlight arrival turns off the sign/roof axis and settles before the cottage ring');

const resizeA = {}, resizeB = {};
resolveCameraObstruction(cameraQuery([0, 1, 0], [10, 4, 0], 10, { padding: .4 }),
  [{ x: 6, z: 0, r: 1.2, minY: 0, maxY: 5 }], resizeA);
resolveCameraObstruction({ ...cameraQuery([0, 1, 0], [10, 4, 0], 10, { padding: .4 }), viewportWidth: 390, viewportHeight: 844 },
  [{ x: 6, z: 0, r: 1.2, minY: 0, maxY: 5 }], resizeB);
ok(resizeA.distance === resizeB.distance && !/innerWidth|innerHeight|devicePixelRatio/.test(CAMERA_MATH_SRC),
  'camera safety math is viewport-independent across desktop/mobile resize');

const clearSightBlock = (HTML.match(/\/\*CLEAR_SIGHT_CAMERA:START\*\/([\s\S]*?)\/\*CLEAR_SIGHT_CAMERA:END\*\//) || [, ''])[1];
const clearSightUpdate = (clearSightBlock.match(/function _updateClearSightCamera\(dt,owner\)\{([\s\S]*?)\n\}/) || [, ''])[1];
ok(/if\(tour&&tour\.active\) return 'guided-tour'/.test(clearSightBlock)
  && /if\(ride\) return 'taxi-ride'/.test(clearSightBlock)
  && /if\(ferris\) return 'ferris'/.test(clearSightBlock)
  && /if\(carousel\) return 'carousel'/.test(clearSightBlock)
  && /if\(canalFerryRide\) return 'canal-ferry'/.test(clearSightBlock)
  && /if\(sitting\) return 'seated'/.test(clearSightBlock)
  && /if\(owner!=='open-world'\)/.test(clearSightUpdate)
  && /_repositoryAtelierFrame\(dt\)\) return/.test(HTML),
  'Atelier, guided tour, taxi ride, Ferris, carousel, canal ferry, and seated camera owners bypass ClearSight');
ok(clearSightUpdate.length > 0 && !/new\s+|scene\.traverse|Raycaster|raycast|material\.clone|\.map\(/.test(clearSightUpdate)
  && /resolveCameraObstruction\(CAMERA_QUERY,CAMERA_BLOCKERS,CAMERA_RESULT\)/.test(clearSightUpdate)
  && /resolveCameraObstruction\(CAMERA_POST_QUERY,CAMERA_BLOCKERS,CAMERA_POST_RESULT\)/.test(clearSightUpdate),
  'steady-state ClearSight reuses fixed storage and bounded collider math without allocation or scene raycasts');
ok(/_registerCameraBlocker\(c,'resident-quarter','cottage'[\s\S]*?3\.15,0,3\.3\)/.test(HTML)
  && /_registerCameraBlocker\(\{x:c\.x,z:c\.z,r:3\.9\},'resident-quarter','cottage-roof'[\s\S]*?3\.9,3\.05,6\.15\)/.test(HTML)
  && /'repo','roof'/.test(HTML), 'repo and Starlight blockers separate wall and roof height ranges');
ok(/for\(const c of EXTRA_COLLIDERS\) if\(c\.cameraBlocking==null\)[\s\S]*?c\.cameraBlocking=false; c\.cameraOwner='town-decor'/.test(HTML)
  && /c\.cameraBlocking='arrival-only'; c\.cameraOwner='resident-quarter'; c\.cameraType='sign'/.test(HTML)
  && /c\.cameraBlocking=false; c\.cameraOwner='resident-quarter'; c\.cameraType=c\._residentQuarterTree\?'tree':'decor'/.test(HTML),
  'thin signs, trees, lamps, and town decor are explicitly arrival-only or non-blocking');
ok(/window\.__clearSightCamera=/.test(HTML) && /window\.__clearSightStarlightProbe=/.test(HTML)
  && /requestedDist:[\s\S]*?resolvedDist:[\s\S]*?blocked:[\s\S]*?hit:[\s\S]*?pose:[\s\S]*?arrival:[\s\S]*?timingMs:/.test(HTML),
  'one debug surface exposes requested/resolved pose, hit identity, arrival scoring, skip reason, and timing');
ok(/window\.__clearSightResourceProbe=/.test(HTML)
  && /for\(let i=0;i<iterations;i\+\+\) resolveCameraObstruction\(CAMERA_QUERY,CAMERA_BLOCKERS,CAMERA_RESULT\)/.test(HTML)
  && /delta:\{objects:[\s\S]*?materials:[\s\S]*?renderCalls:/.test(HTML),
  'debug resource probe measures resolver-only object, material, memory, and draw-call deltas');

group('Petite-Venise canal ferry — one deterministic scenic loop');
const ferryAt = ratio => sampleCanalFerryRoute(CANAL_FERRY_DEFAULTS.duration * ratio, CANAL_FERRY_DEFAULTS, {});
const ferryStart=ferryAt(0), ferryQuarter=ferryAt(0.25), ferryHalf=ferryAt(0.5), ferryThreeQuarter=ferryAt(0.75), ferryEnd=ferryAt(1);
ok(CANAL_FERRY_DEFAULTS.duration===38 && CANAL_FERRY_DEFAULTS.amplitude===0.34,
  'the user-started ferry tour has one bounded 38-second route and no autonomous cadence');
ok(ferryStart.t>0.43 && ferryStart.t<0.45 && ferryQuarter.t>0.83 && ferryThreeQuarter.t<0.17,
  'the route starts clear of the central bridge and reaches both scenic halves of the canal');
ok(ferryStart.direction===1 && ferryHalf.direction===-1 && ferryEnd.direction===1,
  'the launch changes heading at each end instead of drifting off the river curve');
ok(!ferryStart.complete && ferryEnd.complete && Math.abs(ferryStart.t-ferryEnd.t)<1e-12,
  'one complete tour returns to the exact dock-side curve point');
const ferryReuse={sentinel:true};
ok(sampleCanalFerryRoute(Infinity,CANAL_FERRY_DEFAULTS,ferryReuse)===ferryReuse
  && ferryReuse.progress===0 && ferryReuse.complete===false, 'invalid elapsed time fails soft and reuses caller-owned output');
const ferryBlock=(HTML.match(/\/\*CANAL_FERRY:START\*\/([\s\S]*?)\/\*CANAL_FERRY:END\*\//)||[,''])[1];
const ferryMove=(ferryBlock.match(/function _placeCanalFerry\(elapsed,dt\)\{([\s\S]*?)\n\}/)||[,''])[1];
const ferryUpdate=(ferryBlock.match(/function updateCanalFerry\(dt\)\{([\s\S]*?)\n\}/)||[,''])[1];
const ferryRider=(ferryBlock.match(/function _placeCanalFerryRider\(\)\{([\s\S]*?)\n\}/)||[,''])[1];
ok(ferryBlock.length>0 && /makeCanalFerry\(curve,RIVER_LANDMARK\)/.test(HTML),
  'the grand river creates exactly one dedicated boardable ferry from its existing curve');
ok(/root\.name='petite-venise-canal-ferry'/.test(ferryBlock)
  && /bridgeUnderY:0\.62,maxWorldY:0\.55,bridgeClearance:0\.07/.test(ferryBlock)
  && !/canopy|roof/i.test(ferryBlock), 'the low-profile craft keeps measured clearance beneath every flower bridge');
ok(/const hull=capsule\(0\.8,2\.7,0xb85f3d,10\); hull\.name='canal-ferry-hull'/.test(ferryBlock)
  && /hull\.rotation\.x=Math\.PI\/2;[\s\S]*?hull\.scale\.set\(1\.1,1,0\.22\)/.test(ferryBlock)
  && /const deck=capsule\(0\.62,2\.45,0x3f2d27,8\); deck\.name='canal-ferry-cockpit'/.test(ferryBlock)
  && /deck\.scale\.set\(1\.06,0\.92,0\.08\)/.test(ferryBlock)
  && /seat=rbox\(1\.02,0\.07,0\.13,0xc78347/.test(ferryBlock)
  && !/SphereGeometry\(0\.5,12,8,0,Math\.PI\*2,0,Math\.PI\/2\)/.test(ferryBlock),
  'a flattened terracotta hull, dark open cockpit, and bright cross-seats replace the closed barrel silhouette');
ok(/CANAL_FERRY=\{group:root,hull,deck,curve/.test(ferryBlock)
  && /silhouette:CANAL_FERRY\?\{profile:'open-skiff',hull:CANAL_FERRY\.hull\.visible,deck:CANAL_FERRY\.deck\.visible,opaque:/.test(HTML),
  'the runtime retains and exposes both silhouette layers for bounded visual verification');
ok(!/LOW_END/.test(ferryBlock) && /disableDynamicShadowCasters\(root\)/.test(ferryBlock),
  'desktop and mobile keep the same single lightweight craft without dynamic shadow churn');
ok(ferryMove.length>0 && ferryUpdate.length>0 && !/new THREE|\.clone\(|scene\.traverse|\.map\(/.test(ferryMove+ferryUpdate),
  'steady ferry motion reuses its route sample and fixed curve vectors without per-frame allocation or traversal');
ok(ferryRider.length>0
  && /player\.position\.set\(F\.group\.position\.x,F\.group\.position\.y-F\.baseY,F\.group\.position\.z\)/.test(ferryRider)
  && /model\.rotation\.y=F\.group\.rotation\.y/.test(ferryRider),
  'the existing player root follows the center bench, ferry yaw, and bob without parenting or another avatar');
ok(/_placeCanalFerryRider\(\); model\.visible=true; blob\.visible=false; emoteT=0/.test(ferryBlock)
  && /if\(canalFerryRide\)\{[\s\S]*?legL\.rotation\.x=legR\.rotation\.x=-1\.5[\s\S]*?model\.position\.y=-0\.34; model\.rotation\.y=CANAL_FERRY\.group\.rotation\.y/.test(HTML),
  'boarding keeps the character visible in the seated pose and hides only its ground contact shadow');
ok(/rider:CANAL_FERRY\?\{aboard:!!canalFerryRide,visible:model\.visible,seat:canalFerryRide\?'center':null/.test(HTML)
  && !/CANAL_FERRY\.group\.add\(model\)/.test(HTML),
  'debug state exposes the reused center-seat rider while the ferry remains a nine-child craft');
ok(/nearCanalFerry = \(CANAL_FERRY && !canalFerryRide/.test(HTML)
  && /else if\(nearCanalFerry\) boardCanalFerry\(\)/.test(HTML)
  && /actBtn\.textContent='🛶'/.test(HTML), 'the canal dock owns a walk-up prompt and the shared Enter/mobile action path');
ok(/!carousel && !canalFerryRide && FW\.length/.test(HTML)
  && /ride\|\|canalFerryRide\|\|dragging/.test(HTML), 'an active tour stays at full interaction cadence while idle town throttling is unchanged');
ok((HTML.match(/ferryName:/g)||[]).length===2 && (HTML.match(/ferryReached:/g)||[]).length===2
  && (HTML.match(/ferryRiding:/g)||[]).length===2 && /if\(canalFerryRide\)\{ promptEl\.innerHTML = t\('ferryRiding'\)/.test(HTML)
  && /window\.__canalFerry=/.test(HTML) && /window\.__boardFerry=/.test(HTML) && /window\.__finishFerry=/.test(HTML),
  'Korean/English ride copy and bounded debug board/finish probes are present');
ok(/boardable low-profile ferry/.test(README_EN) && /낮은 유람선에 올라/.test(README_KO),
  'both READMEs describe the real boardable canal interaction');

group('Rain Garden Weather Bell — one bounded town sunshower');
const rainStart=sampleRainGarden(0,RAIN_GARDEN_DEFAULTS,{}), rainFull=sampleRainGarden(8,RAIN_GARDEN_DEFAULTS,{});
const rainFade=sampleRainGarden(35,RAIN_GARDEN_DEFAULTS,{}), rainEnd=sampleRainGarden(36,RAIN_GARDEN_DEFAULTS,{});
ok(RAIN_GARDEN_DEFAULTS.duration===36 && RAIN_GARDEN_DEFAULTS.desktopDrops===96
  && RAIN_GARDEN_DEFAULTS.mobileDrops===48 && RAIN_GARDEN_DEFAULTS.rippleCount===8,
  'the visitor-started shower is capped at 36 seconds, 96/48 drops, and eight ripples');
ok(rainStart.active && rainStart.intensity===0 && rainFull.active && rainFull.intensity===1
  && rainFade.intensity>0 && rainFade.intensity<1 && rainEnd.complete && !rainEnd.active && rainEnd.intensity===0,
  'the pure lifecycle fades in, holds, fades out, and completes exactly once');
const rainReuse={sentinel:true};
ok(sampleRainGarden(Infinity,RAIN_GARDEN_DEFAULTS,rainReuse)===rainReuse
  && rainReuse.progress===0 && rainReuse.active && !rainReuse.complete,
  'invalid elapsed time fails soft and reuses caller-owned lifecycle output');
const rainSeedA=seedRainDrop(17,96,RAIN_GARDEN_DEFAULTS,{}), rainSeedB=seedRainDrop(17,96,RAIN_GARDEN_DEFAULTS,{});
ok(rainSeedA.x===rainSeedB.x && rainSeedA.y===rainSeedB.y && rainSeedA.z===rainSeedB.z
  && Math.hypot(rainSeedA.x,rainSeedA.z)<=RAIN_GARDEN_DEFAULTS.radius
  && rainSeedA.y>0 && rainSeedA.y<=RAIN_GARDEN_DEFAULTS.height && rainSeedA.speed>=0.78 && rainSeedA.speed<=1.22,
  'drop seeding is deterministic and remains inside the fixed player-following field');
ok(Math.abs(wrapRainDropY(5,1,18)-4)<1e-12 && Math.abs(wrapRainDropY(0.2,1,18)-17.2)<1e-12,
  'falling drops wrap within one fixed-height buffer instead of allocating replacements');
const rainBlock=(HTML.match(/\/\*RAIN_GARDEN:START\*\/([\s\S]*?)\/\*RAIN_GARDEN:END\*\//)||[,''])[1];
const rainUpdate=(rainBlock.match(/function updateRainGarden\(dt\)\{([\s\S]*?)\n\}/)||[,''])[1];
const rainUmbrellaUpdate=(rainBlock.match(/function _updateRainGardenUmbrellas\(dt,intensity\)\{([\s\S]*?)\n\}/)||[,''])[1];
ok(rainBlock.length>0 && /const RAIN_GARDEN_POS=new THREE\.Vector3\(20,0,-6\)/.test(rainBlock)
  && /makeRainGarden\(RAIN_GARDEN_POS\.x,RAIN_GARDEN_POS\.z\)/.test(HTML)
  && /EXTRA_COLLIDERS\.push\(\{x,z,r:1\.55,_rainGarden:true\}\)/.test(rainBlock),
  'one plaza-edge garden is built at a fixed clear site with a minimal walk collider');
ok(/new THREE\.LineSegments\(rainGeometry,rainMaterial\)/.test(rainBlock)
  && /new THREE\.InstancedMesh\(new THREE\.RingGeometry\(0\.34,0\.42,14\),rippleMaterial,RAIN_GARDEN_DEFAULTS\.rippleCount\)/.test(rainBlock)
  && /LOW_END\?RAIN_GARDEN_DEFAULTS\.mobileDrops:RAIN_GARDEN_DEFAULTS\.desktopDrops/.test(rainBlock),
  'rain and ripples stay in two batches with the explicit low-end drop cap');
ok(/new THREE\.InstancedMesh\(new THREE\.ConeGeometry\(0\.78,0\.34,12,1,true\),canopyMat,n\)/.test(rainBlock)
  && /new THREE\.InstancedMesh\(new THREE\.CylinderGeometry\(0\.035,0\.035,1\.12,6\),poleMat,n\)/.test(rainBlock)
  && /buildRainGardenResidentUmbrellas\(\);/.test(HTML),
  'resident reactions reuse two instanced umbrella batches created only after residents exist');
ok(rainUpdate.length>0 && rainUmbrellaUpdate.length>0
  && !/new\s+|\.clone\(|scene\.traverse|setTimeout|setInterval|fetch\(/.test(rainUpdate+rainUmbrellaUpdate)
  && /wrapRainDropY\(/.test(rainUpdate) && /instanceMatrix\.needsUpdate/.test(rainUpdate+rainUmbrellaUpdate),
  'steady rain and umbrella motion reuse fixed buffers and matrices with no timer, network, traversal, or allocation');
ok(/function _stopRainGarden\(reason\)[\s\S]*?_setRainGardenUmbrellas\(false\); _setRainGardenClouds\(0\)/.test(rainBlock)
  && /if\(RAIN_SAMPLE\.complete\)\{ _stopRainGarden\('duration'\)/.test(rainBlock)
  && /updateResidents\(dt\);\s*updateRainGarden\(dt\);/.test(HTML),
  'completion restores clouds and hides every dynamic batch while the exterior loop owns the only lifecycle');
ok(/else if\(nearRainGarden\) ringRainGarden\(\)/.test(HTML)
  && /nearRainGarden = \(RAIN_GARDEN && player\.position\.distanceTo\(RAIN_GARDEN\._pos\) < 5\.8\)/.test(HTML)
  && /actBtn\.textContent=rainGardenActive\?'☀️':'🌦️'/.test(HTML),
  'the Weather Bell owns the shared Enter/mobile action path and toggles without taking camera control');
ok(/\{id:'rain',\s+ico:'🌦️', key:'lmRain'\}/.test(HTML)
  && /\{id:'rain',ico:'🌦️'\}/.test(HTML)
  && /case 'rain': return RAIN_GARDEN\?\{label:t\('lmRain'\),_pos:RAIN_GARDEN\._pos,_landmark:'rain'\}:null/.test(HTML)
  && /LM\.push\(\[RAIN_GARDEN\.center\.x,RAIN_GARDEN\.center\.z,'🌦️'\]\)/.test(HTML),
  'Passport, Station, taxi destination, and world map all expose the same garden');
ok(/rain \?garden\|weather \?bell\|sunshower/.test(HTML)
  && /mk\('lmDriveRain',t\('lmRain'\),RAIN_GARDEN\._pos,'rain'\)/.test(HTML),
  'distinctive Korean/English Weather Bell phrases route locally with no AI or backend');
ok((HTML.match(/rainName:/g)||[]).length===2 && (HTML.match(/rainStarted:/g)||[]).length===2
  && (HTML.match(/lmArriveRain:/g)||[]).length===2,
  'the walk-up, weather-state, and arrival copy are complete in Korean and English');
ok(/window\.__rainGarden=/.test(HTML) && /window\.__ringRain=/.test(HTML)
  && /window\.__finishRain=/.test(HTML) && /window\.__stopRain=/.test(HTML)
  && /resources:\{activeDraws:rainDraws\+rippleDraws\+umbrellaDraws,rainDraws,rippleDraws,umbrellaDraws,timers:0,network:0,steadyAllocations:0\}/.test(HTML)
  && /clouds:\{color:'#'\+CLOUD_MAT\.color\.getHexString\(\),opacity:/.test(HTML),
  'bounded diagnostics expose placement, lifecycle, counts, ownership, and zero recurring resources');

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
ok(/_now-new Date\(repo\.pushed\)/.test(zcSrc)&&!/Date\.now\(\)/.test(zcSrc),
  'district age uses the generated city reference instead of the viewer clock');
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
    const built = new Function('_now', `${zcSrc}\nreturn { ZONE_CAT, zoneOf };`)(cityReference);
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

group('Repository Atelier — one reusable walkable room for every repo');
const atelierSrc=(HTML.match(/\/\*REPOSITORY_ATELIER:START\*\/([\s\S]*?)\/\*REPOSITORY_ATELIER:END\*\//)||[,''])[1];
const atelierCreateSrc=(atelierSrc.match(/function _createRepositoryAtelier\(\)\{[\s\S]*?(?=\nfunction _drawRepositoryAtelierHistory)/)||[''])[0];
const atelierBindSrc=(atelierSrc.match(/function _bindRepositoryAtelier\(repo\)\{[\s\S]*?(?=\nfunction _refreshRepositoryAtelierLanguage)/)||[''])[0];
ok(atelierSrc.length>0, 'atelier runtime is a bounded, extractable integration block');
ok(/id="atelierBtn"/.test(HTML) && /class="btn atelier"/.test(HTML)
  && /class="btn gh"[\s\S]*?target="_blank" rel="noopener"/.test(HTML), 'repo card adds a clear room entry command without removing quick GitHub access');
ok((HTML.match(/atelierEnter:\s*['"]/g)||[]).length===2 && (HTML.match(/atelierExit:\s*['"]/g)||[]).length===2
  && (HTML.match(/atelierAsk:\s*['"]/g)||[]).length===2 && (HTML.match(/atelierWhy:\s*['"]/g)||[]).length===2
  && (HTML.match(/atelierSignals:\s*['"]/g)||[]).length===2 && (HTML.match(/atelierRoomHint:\s*['"]/g)||[]).length===2
  && (HTML.match(/atelierChatTitle:\s*['"]/g)||[]).length===2, 'atelier card, exhibits, chat, exit, and terminal copy is bilingual');
ok(/const REPOSITORY_ATELIER_LAYER=6/.test(atelierSrc) && /new THREE\.Scene\(\)/.test(atelierCreateSrc)
  && /renderer\.render\(A\.scene,camera\)/.test(atelierSrc), 'interior uses a dedicated scene plus camera layer instead of drawing the town behind it');
ok(/if\(REPOSITORY_ATELIER&&REPOSITORY_ATELIER\.created\) return REPOSITORY_ATELIER/.test(atelierCreateSrc)
  && /A\.created=true; A\.createCount\+\+/.test(atelierCreateSrc), 'the single room is lazy-created once');
ok((atelierCreateSrc.match(/_atelierCanvas\(/g)||[]).length===3
  && /history=_atelierCanvas\([^,]+,[^,]+,'history'\)/.test(atelierCreateSrc)
  && /signals=_atelierCanvas\([^,]+,[^,]+,'signals'\)/.test(atelierCreateSrc)
  && /actions=_atelierCanvas\([^,]+,[^,]+,'actions'\)/.test(atelierCreateSrc), 'the reusable room owns exactly three bounded data, signal, and action atlases');
ok(/A\.resources=\S*\|\|\{geometries:new Set\(\),materials:new Set\(\),textures:new Set\(\)\}/.test(atelierCreateSrc)
  && /resources:\{rooms:A\.created\?1:0,geometries:/.test(atelierSrc), 'room geometry, material, and texture resources are explicitly counted');
ok(!/new THREE\.(?:CanvasTexture|Texture|Material|Geometry)/.test(atelierBindSrc)
  && /_drawRepositoryAtelierHistory\(canonical\); _drawRepositoryAtelierSignals\(canonical\); _drawRepositoryAtelierActions\(canonical\)/.test(atelierBindSrc)
  && /A\.bindings=\{github:canonical\.repo,ask:canonical\.repo,why:canonical\.repo\}/.test(atelierBindSrc), 'repo switches redraw existing atlases and rebind all actions without allocating a second room');
ok(/RepositoryCore/.test(atelierCreateSrc) && /AtelierHistoryWall/.test(atelierCreateSrc)
  && /AtelierSignalsWall/.test(atelierCreateSrc) && /AtelierTerminals/.test(atelierCreateSrc),
  'Repository Core, History/Data Wall, Signals Wall, and action terminals are real 3D exhibits');
ok(/AtelierArchitecture/.test(atelierCreateSrc)&&/AtelierDataPath/.test(atelierCreateSrc)
  &&/AtelierMetricPillars/.test(atelierCreateSrc)&&/AtelierMetricArtifacts/.test(atelierCreateSrc),
  'ceiling frames, a curved data path, and three metric artifacts replace the sparse placeholder floor');
ok(/model\.clone\(true\)/.test(atelierCreateSrc)&&/AtelierVisitor_CurrentChibi/.test(atelierCreateSrc)
  &&/avatarCloneOf\(armL\)/.test(atelierCreateSrc)&&/avatarCloneOf\(legL\)/.test(atelierCreateSrc)
  &&!/new THREE\.CapsuleGeometry\(\.32,\.64/.test(atelierCreateSrc),
  'the Atelier reuses the current chibi avatar design and mapped limb animation instead of a primitive placeholder');
ok(/canonical\.stars/.test(atelierBindSrc) && /canonical\._activity/.test(atelierBindSrc) && /canonical\.score/.test(atelierBindSrc)
  && /langColor[\s\S]*?zoneColor[\s\S]*?hash=_atelierHash\(canonical\.repo\)/.test(atelierBindSrc), 'core size, light, structure, language, district, and deterministic repo identity all bind from shipped data');
ok(/repo\.desc\|\|t\('noDesc'\)/.test(atelierSrc) && /repo\.topics\|\|\[\]/.test(atelierSrc)
  && /repo\.stars/.test(atelierSrc) && /repo\.forks/.test(atelierSrc) && /repo\.open_issues/.test(atelierSrc)
  && /repo\.license/.test(atelierSrc) && /repo\.created/.test(atelierSrc) && /repo\.pushed/.test(atelierSrc)
  && /repo\.release_tag/.test(atelierSrc) && /repo\.visitors/.test(atelierSrc) && /repo\.views/.test(atelierSrc)
  && /repo\.clones/.test(atelierSrc), 'data wall covers identity, description, topics, repo metrics, dates, releases, and available traffic');
ok(/const hasTraffic=repo\.trafficKnown===true/.test(atelierSrc)
  && /else \{ y\+=58;[\s\S]*?atelierTrafficUnavailable/.test(atelierSrc),
  'the TRAFFIC section appears only for known owner traffic and explains the public-metadata boundary otherwise');
ok(/function _drawRepositoryAtelierSignals\(repo\)/.test(atelierSrc)
  &&/canonical\.stars/.test(atelierBindSrc)&&/canonical\.forks/.test(atelierBindSrc)&&/canonical\._activity/.test(atelierBindSrc)
  &&/A\.metricSignals=metricSignals/.test(atelierBindSrc)&&/atelierSignalsNow/.test(atelierSrc),
  'the Signals Wall and metric artifacts bind stars, forks, activity, lifecycle, language, and topics from current public data');
ok(/A\.terminalKinds=\['github','ask','why'\]/.test(atelierCreateSrc)
  && /window\.open\(repo\.url,'_blank','noopener'\)/.test(atelierSrc)
  && /_openRepositoryAtelierChat\(kind,repo\)/.test(atelierSrc)
  && !/exitRepositoryAtelier\(\{kind,repoKey:repo\.repo\}\)/.test(atelierSrc),
  'GitHub remains external while Ask and Why open their exact flows without leaving the room');
ok(/function _openRepositoryAtelierChat\(kind,repo\)/.test(atelierSrc)
  && /kind==='why'[\s\S]*?_showCardWhyZone\(repo\)/.test(atelierSrc)
  && /chatText\.value=question; sendChat\(\)/.test(atelierSrc)
  && /A\.inRoomChat=true; A\.roomPanel=kind/.test(atelierSrc),
  'in-room Gitber sends a real repo question and renders deterministic district context under Atelier ownership');
ok(/#chat\.atelierChat/.test(HTML)&&/body\.atelier-chat-open #prompt/.test(HTML)
  &&/atelierRoomHint/.test(HTML)&&/atelierChatTitle/.test(HTML)&&/atelierChatPh/.test(HTML),
  'the room owns a dark responsive chat surface, hides conflicting prompts, and explains its completed interaction model');
ok(/#chat\.atelierChat \.msg\.bot span\[style\*="#ab8a66"\] \{ color:#dbcba8 !important; \}/.test(HTML)
  && /#chat\.atelierChat \.msg \.alt \{ color:#244d7b; background:#edf4ff; \}/.test(HTML),
  'in-room metric text and alternative repo chips retain AA contrast on the dark chat surface');
ok(/if\(repositoryAtelierChatActive\(\)\) _syncRepositoryAtelierChatChrome\(\); \}/.test(HTML)
  &&/if\(repositoryAtelierChatActive\(\)\) _syncRepositoryAtelierChatChrome\(\);/.test(atelierSrc),
  'live language switching redraws all three walls and restores the in-room chat title and placeholder');
ok(/opts&&opts\.repo&&!repositoryAtelierActive\(\)/.test(HTML)
  &&/opts&&opts\.handoff&&!repositoryAtelierActive\(\)/.test(HTML)
  &&/function taxiTo\(repo\)\{ if\(repositoryAtelierActive\(\)\) return false/.test(HTML)
  &&/function startScholarHandoff\(kind\)\{ if\(repositoryAtelierActive\(\)\) return false/.test(HTML),
  'chat replies cannot start an exterior taxi ride or scholar handoff while the room owns interaction');
ok(!/fetch\(|new WebSocket|groundedAsk|webllmAsk|proxyAsk|import\(/.test(atelierCreateSrc+atelierBindSrc), 'entering and rebinding the room has no network, model, CDN, or dynamic-import work');
ok(!/track\('atelier_(?:enter|exit)'/.test(atelierSrc) && /track\('atelier_terminal'/.test(atelierSrc),
  'enter and exit emit no remote analytics; only an explicit terminal action may record an event');
ok(/if\(kind==='exit'\) return exitRepositoryAtelier\(\);[\s\S]*?if\(kind!=='github'&&kind!=='ask'&&kind!=='why'\) return false;[\s\S]*?track\('atelier_terminal'/.test(atelierSrc),
  'terminal analytics run only after validating GitHub, Ask, or Why—not exit or passive core');
ok(/state:'outside'/.test(atelierSrc) && /A\.state='entering'/.test(atelierSrc)
  && /A\.state='inside'/.test(atelierSrc) && /A\.state='exiting'/.test(atelierSrc)
  && /A\.state='outside'/.test(atelierSrc), 'state machine explicitly follows outside → entering → inside → exiting → outside');
ok(/playerPosition:player\.position\.clone\(\)/.test(atelierSrc)
  && /cameraPosition:camera\.position\.clone\(\)/.test(atelierSrc)
  && /cameraLayerMask:camera\.layers\.mask,camYaw,camPitch,camDist/.test(atelierSrc)
  && /navTarget,navVisible:navHolder\.visible/.test(atelierSrc)
  && /sitting,ride,ferris,carousel,modalOpen/.test(atelierSrc)
  && /introInert:document\.getElementById\('intro'\)\.inert/.test(atelierSrc),
  'entry snapshot owns exact player, camera, navigation, seat, ride, and UI accessibility state');
ok(/player\.position\.copy\(s\.playerPosition\)/.test(atelierSrc)
  && /camera\.position\.copy\(s\.cameraPosition\)/.test(atelierSrc)
  && /camYaw=s\.camYaw; camPitch=s\.camPitch; camDist=s\.camDist/.test(atelierSrc)
  && /navTarget=s\.navTarget; navHolder\.visible=s\.navVisible/.test(atelierSrc)
  && /document\.getElementById\('intro'\)\.inert=s\.introInert/.test(atelierSrc)
  && /if\(!s\|\|s\.restored\) return/.test(atelierSrc), 'exit restore is exact and idempotent');
ok(/_resetRepositoryAtelierInput\(\)/.test(atelierSrc) && /clearKeys\(\); stickVec=\{x:0,y:0\}/.test(atelierSrc)
  && /moveTid=null; lookTid=null/.test(atelierSrc), 'entry and exit clear keyboard and touch ownership so movement cannot stick');
ok(/if\(e\.code==='Enter'&&e\.repeat\)\{ e\.preventDefault\(\); return; \}/.test(HTML), 'held Enter cannot repeatedly fire a room terminal');
ok(/const isUiKeyTarget=e=>/.test(HTML) && /if\(isTyping\(\)\|\|isUiKeyTarget\(e\)\) return/.test(HTML)
  && /\^\(BUTTON\|A\|INPUT\|SELECT\|TEXTAREA\)\$/.test(HTML), 'focused native controls own Enter/Space without also firing a world action');
ok(/!repositoryAtelierActive\(\)\|\|repositoryAtelierChatActive\(\)/.test(HTML)
  && /\(!repositoryAtelierActive\(\)\|\|repositoryAtelierChatActive\(\)\)&&!chatEl\.classList\.contains\('hidden'\)/.test(HTML)
  && /if\(document\.activeElement===chatText\) chatText\.blur\(\)/.test(atelierSrc),
  'only the explicit in-room chat may own keyboard focus while the room is active');
ok(/if\(repositoryAtelierActive\(\)\)\{ REPOSITORY_ATELIER\.pendingHash=true; exitRepositoryAtelier\(\); return; \}/.test(HTML)
  && /pendingHash=A\.pendingHash/.test(atelierSrc) && /if\(pendingHash\)\{ A\.afterExit=null; const key=repoHashKey\(\),repo=repoByKey\(key\); if\(repo\) openCard\(repo\)/.test(atelierSrc),
  'repo hash changes exit the room and rebuild the requested card only after the exterior reveal');
ok(/if\(pendingHash\)\{ A\.afterExit=null;/.test(atelierSrc), 'explicit hash navigation supersedes a terminal after-exit action');
ok(/const CHAT_QUEUE_MAX=4,queuedChatQuestions=\[\]; let pendingChatNpc=null/.test(HTML)
  && /if\(busy\)\{ chatText\.value=''; _queueChatQuestion\(q,npc\); return; \}/.test(HTML)
  && /function _queueChatAction\(action\)/.test(HTML) && /_queueChatAction\(\{kind:'ask',q,npc\}\)/.test(HTML)
  && /function _drainQueuedChat\(\)\{ if\(busy\|\|\(repositoryAtelierActive\(\)&&!repositoryAtelierChatActive\(\)\)\|\|!queuedChatQuestions\.length\)/.test(HTML)
  && /function _resumePendingChatNpc\(\)\{ if\(busy\|\|\(repositoryAtelierActive\(\)&&!repositoryAtelierChatActive\(\)\)\|\|!pendingChatNpc\)/.test(HTML),
  'busy chat preserves a bounded question and may drain only inside the explicitly opened Atelier chat');
ok(/if\(busy&&activeNpc&&npc!==activeNpc\)\{ pendingChatNpc=npc;/.test(HTML)
  && /function _resumePendingChatNpc\(\)/.test(HTML), 'an in-flight scholar answer cannot leak into a newly selected Gitber thread');
ok(/_queueChatAction\(\{kind:'why',repoKey:repo\.repo,npc:_taxiNpc\(\)\}\)/.test(HTML)
  && /_queueChatAction\(\{kind:'similar',repoKey:repo\.repo,npc:_taxiNpc\(\)\}\)/.test(HTML)
  && /if\(next\.kind==='why'&&repo\)\{ _showCardWhyZone\(repo\)/.test(HTML)
  && /if\(next\.kind==='similar'&&repo\)\{ _showCardSimilar\(repo\)/.test(HTML)
  && /while\(queuedChatQuestions\.length\)/.test(HTML) && /_resumePendingChatNpc\(\); return true;/.test(HTML),
  'deterministic Why and Similar actions drain synchronously before the next async turn or deferred NPC switch');
ok(/function _pauseTourForAtelier\(\)/.test(HTML) && /tourPause:_pauseTourForAtelier\(\)/.test(atelierSrc)
  && /A\.resumeTour=s\.tourPause/.test(atelierSrc) && /_resumeTourAfterAtelier\(pausedTour\)/.test(atelierSrc)
  && /body\.atelier-active #tourCap/.test(HTML), 'guided-tour deadlines and chrome pause through the room and resume only after the exterior reveal');
ok(/if\(pendingHash&&tour&&tour\.active\) endTour\(false\); else _resumeTourAfterAtelier\(pausedTour\)/.test(atelierSrc),
  'explicit hash navigation cancels a paused tour before the requested card opens');
ok(/if\(_repositoryAtelierFrame\(dt\)\) return;/.test(HTML)
  && /one explicit gate: room or frozen transition/.test(HTML)
  && /if\(mode==='interior'\)\{ _updateRepositoryAtelier\(dt\); _renderRepositoryAtelier\(\); \}/.test(atelierSrc), 'one main-loop gate pauses all exterior updates while the room owns update/render');
ok(/renderer\.render\(A\.scene,camera\)/.test(atelierSrc) && !/renderer\.render\(scene,camera\)/.test(atelierSrc)
  && /exteriorCalls:A\.renderInterior\?0:null/.test(atelierSrc), 'inside frames issue zero exterior scene renders');
ok(/rtSock\?rtSock\.readyState:-1/.test(atelierSrc) && !/rtSock\.close|rtConnect\(|clearPeers\(/.test(atelierSrc), 'atelier leaves realtime connection and counters intact while exterior avatar work is paused');
ok(/function _realtimeExteriorPose\(\)/.test(HTML)
  && /snapshot\?\{x:snapshot\.playerPosition\.x,z:snapshot\.playerPosition\.z,yaw:snapshot\.modelYaw\}/.test(HTML)
  && /rtSock\.onopen=\(\)=>\{ const pose=_realtimeExteriorPose\(\)/.test(HTML), 'a realtime reconnect publishes the saved exterior pose, never room-local coordinates');
ok(/\(LOW_END\|\|IS_MOBILE\)\?1024:1536/.test(atelierCreateSrc) && /LOW_END\?2:3/.test(atelierBindSrc)
  && /A\.rods\.count=LOW_END\?4/.test(atelierBindSrc), 'LOW_END reduces atlas and core detail without removing any exhibit');
ok(/webglcontextrestored'[\s\S]*?_repositoryAtelierContextRestored/.test(HTML)
  && /A\.resources\.textures\.forEach\(texture=>\{ texture\.needsUpdate=true; \}\)/.test(atelierSrc), 'context restore marks all reusable atlases for re-upload');
ok(/window\.__repositoryAtelier=/.test(atelierSrc) && /window\.__atelierEnter=/.test(atelierSrc)
  && /window\.__atelierSelect=/.test(atelierSrc)
  && /inRoomChat:!!A\.inRoomChat,roomPanel:A\.roomPanel/.test(atelierSrc)
  && /sharedAvatarDraws:A\.avatarDraws/.test(atelierSrc),
  'short diagnostics expose active repo, room chat ownership, current avatar, exhibits, resources, render cost, bindings, and poses');
ok(/one finished exhibition/.test(README_EN)&&/완성된 전시실/.test(README_KO)
  &&/Ask Gitber[\s\S]*?without ejecting the visitor/.test(README_EN)
  &&/깃버에게 이 레포 질문[\s\S]*?밖으로 내보내지 않고/.test(README_KO),
  'both READMEs describe the completed room and in-room action ownership');
const atelierHashSrc=(atelierSrc.match(/function _atelierHash\(value\)\{[^\n]+\}/)||[''])[0];
if(atelierHashSrc){ const hash=new Function(`${atelierHashSrc}; return _atelierHash;`)();
  ok(hash('Repolis')===hash('Repolis') && hash('Repolis')!==hash('jenkins-dind'), 'repo style seed is stable across re-entry and differs across repos');
} else ok(false, 'repo style seed helper is extractable');
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
ok(/const freshnessTrackable=cityMode!=='portal'&&REPOS\.length>0&&!cityError/.test(HTML)&&/if\(!freshnessBaseline&&freshnessTrackable\)/.test(HTML),
  'only a successful non-empty full-town load can diff or establish a baseline');
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
// 12a — roster: 8 social residents + the solitary market easter egg AURI, hard cap 10
ok(/const MAX_RESIDENTS=10/.test(npcBlock), 'MAX_RESIDENTS cap is 10');
ok((npcBlock.match(/\{ id:'/g) || []).length === 9, 'RESIDENTS roster holds exactly 9 townspeople');
ok(/\{ id:'noa', zone:'plaza'/.test(npcBlock), 'the plaza dreamer Noa is in the roster (strolls the square brainstorming ideas)');
ok(/\{ id:'auri', zone:'data'[\s\S]*?oracle:'market', easterEgg:true/.test(npcBlock), 'AURI is a hidden market-oracle resident, not a plaza scholar');
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
ok(!/NPC_MODEL_|NPC_DAY_CAP_USD|NPC_DAILY_ATTEMPT_MAX|AOAI_DEPLOYMENT/.test(npcBlock), 'server-only NPC env names never appear in the client');
// 12f — debug probes
ok(/window\.__villagers=/.test(HTML) && /window\.__npcRoutes=/.test(HTML) && /window\.__npcEncounter=/.test(HTML), 'debug helpers __villagers/__npcRoutes/__npcEncounter present');
ok(/window\.__npcBudget=/.test(HTML) && /window\.__npcTranscript=/.test(HTML), 'debug helpers __npcBudget/__npcTranscript present');
// 12g — worker: additive npc_action scaffolding with hard kill switches + durable budget governor
let WORKER = '', NPC_GOVERNOR = '', TAXI_WRANGLER = '';
try { WORKER = readFileSync(join(ROOT, 'cloudflare-taxi/src/grounded.js'), 'utf8'); } catch (e) { console.log('  ✗ grounded.js load: ' + e.message); }
try { NPC_GOVERNOR = readFileSync(join(ROOT, 'cloudflare-taxi/src/npc-budget-governor.js'), 'utf8'); } catch (e) { console.log('  ✗ npc-budget-governor.js load: ' + e.message); }
try { TAXI_WRANGLER = readFileSync(join(ROOT, 'cloudflare-taxi/wrangler.toml'), 'utf8'); } catch (e) { console.log('  ✗ cloudflare-taxi/wrangler.toml load: ' + e.message); }
ok(WORKER.length > 0, 'grounded.js worker source loaded');
ok(NPC_GOVERNOR.length > 0, 'Durable NPC budget governor source loaded');
ok(/if \(body && body\.npc_action\) return npcHandler\(body, request, env, ctx\)/.test(WORKER), 'fetch router dispatches body.npc_action to npcHandler with execution context');
ok(/async function npcHandler\(/.test(WORKER), 'npcHandler() exists');
ok(/grounded_mcp_mslearn/.test(WORKER) && /grounded_mcp_deepwiki/.test(WORKER) && /grounded_kb_taxi/.test(WORKER), 'grounded AI routes use the report taxonomy');
ok(/tokensIn: u\.prompt_tokens/.test(WORKER) && /cachedTokens: u\.cached_tokens/.test(WORKER) && /tokensOut: u\.completion_tokens/.test(WORKER), 'provider usage emits input, cached-input, and output tokens');
ok(/headers\["X-Repolis-Metrics-Key"\] = ingestToken/.test(WORKER)
  && /env\.METRICS_INGEST_TOKEN/.test(WORKER),
  'server telemetry authenticates to Observatory with the shared ingest secret');
ok((WORKER.match(/npcMetric\(env, "ai_kb_query"/g) || []).length === 1
  && /groundingPath: "grounded_via_kb"/.test(WORKER)
  && /pathRole: "primary"/.test(WORKER),
  'ai_kb_query is emitted only by the real Azure KB retrieve-attempt helper');
ok(/function emitGroundingOutcome\(/.test(WORKER)
  && /npcMetric\(env, "ai_grounding_outcome"/.test(WORKER)
  && /groundingPath: "grounded_via_mcp_direct"/.test(WORKER)
  && /pathRole === "fallback"/.test(WORKER)
  && /boundedGroundingReason\(out\)/.test(WORKER),
  'final grounding telemetry separates KB from direct MCP and labels only true fallbacks');
const reasonSource = (WORKER.match(/function boundedGroundingReason\([\s\S]*?(?=\nfunction emitGroundingOutcome)/) || [''])[0];
const outcomeSource = (WORKER.match(/function emitGroundingOutcome\([\s\S]*?(?=\nfunction emitDirectGrounding)/) || [''])[0];
if (reasonSource && outcomeSource) {
  const boundedReason = new Function(`${reasonSource}; return boundedGroundingReason;`)();
  ok(boundedReason({ attempted: false, reason: 'grounding not configured' }) === 'unconfigured'
    && boundedReason({ attempted: true, reason: 'timeout 25000ms' }) === 'timeout'
    && boundedReason({ attempted: true, ok: true, answer: '', data: { references: [] } }) === 'empty'
    && boundedReason({ attempted: true, reason: 'kb 500' }) === 'error',
    'fallback reasons collapse to the four metrics-safe categories');
  const outcomes = [];
  const emitOutcome = new Function('npcMetric', `${outcomeSource}; return emitGroundingOutcome;`)(
    (_env, event, meta) => outcomes.push({ event, meta })
  );
  emitOutcome({}, null, 'grounded_mcp_context7', { ks: 'context7-direct', kb: 'none' }, 'context7', {
    groundingPath: 'grounded_via_mcp_direct', pathRole: 'primary', fallbackReason: 'timeout', ok: true,
  });
  emitOutcome({}, null, 'grounded_mcp_mslearn', { ks: 'microsoft-learn-mcp-ks', kb: 'repolis-mslearn-kb' }, 'msdocs', {
    groundingPath: 'grounded_via_mcp_direct', pathRole: 'fallback', fallbackReason: 'timeout', ok: true,
  });
  ok(outcomes[0].event === 'ai_grounding_outcome' && outcomes[0].meta.pathRole === 'primary'
    && outcomes[0].meta.fallbackReason === undefined
    && outcomes[1].meta.pathRole === 'fallback' && outcomes[1].meta.fallbackReason === 'timeout',
    'direct-primary has no fallback reason while KB-to-direct fallback retains its bounded cause');
}
const providerTelemetry = (WORKER.match(/function emitProviderUsage\([\s\S]*?(?=\nfunction emitDeliveredAnswer)/) || [''])[0];
const answerTelemetry = (WORKER.match(/function emitDeliveredAnswer\([\s\S]*?(?=\nfunction hasDeliveredContent)/) || [''])[0];
ok(/providerCall: true/.test(providerTelemetry) && /answer: false/.test(providerTelemetry)
  && /providerCall: false/.test(answerTelemetry) && /answer: true/.test(answerTelemetry)
  && /phase: "delivered_answer"/.test(answerTelemetry),
  'provider usage is additive and distinct from the exactly-one delivered-answer contract');
const deliveredContentSource = (WORKER.match(/function hasDeliveredContent\([\s\S]*?(?=\nfunction emitKbQuery)/) || [''])[0];
if (deliveredContentSource) {
  const hasDeliveredContent = new Function(`${deliveredContentSource}; return hasDeliveredContent;`)();
  ok(!hasDeliveredContent('', 0) && !hasDeliveredContent('   ', 0)
    && hasDeliveredContent('answer', 0) && hasDeliveredContent('', 2),
    'delivered-answer denominator requires visible text or visible result references');
}
ok(/if \(hasDeliveredContent\(out\.answer, 0\)\) \{[\s\S]{0,160}emitDeliveredAnswer\(env, ctx, "persona_visitor", "none"/.test(WORKER),
  'a no-doc KB response is never mislabeled as a successful grounded delivered answer');
const metricTransportSource = (WORKER.match(/function npcRedact\([\s\S]*?(?=\nfunction metricContext)/) || [''])[0];
ok(!!metricTransportSource, 'trusted telemetry transport is extractable for behavioral checks');
if (metricTransportSource) {
  const originalFetch = globalThis.fetch;
  const metricRequests = [];
  const serviceRequests = [];
  globalThis.fetch = async (request) => {
    metricRequests.push(request);
    return new Response(null, { status: 204 });
  };
  try {
    const metric = new Function(`${metricTransportSource}; return npcMetric;`)();
    await metric({ METRICS_URL: 'https://metrics.example/event', METRICS_INGEST_TOKEN: 'shared-secret' },
      'ai_chat_turn', { answer: true, providerCall: false, question: 'private' });
    const sent = metricRequests[0];
    const sentBody = await sent.clone().json();
    ok(sent instanceof Request
      && sent.headers.get('X-Repolis-Metrics-Key') === 'shared-secret'
      && sentBody.answer === true && sentBody.providerCall === false
      && sentBody.question === undefined && sentBody.question_len === 7,
      'trusted global-fetch fallback sends the secret header while redacting prompt text');
    await metric({
      METRICS_URL: 'https://metrics.example/event',
      METRICS_INGEST_TOKEN: 'shared-secret',
      REPOLIS_METRICS: {
        async fetch(request) {
          serviceRequests.push(request);
          return new Response(null, { status: 204 });
        },
      },
    }, 'ai_grounding_outcome', { groundingPath: 'grounded_via_kb', ok: true });
    const serviceSent = serviceRequests[0];
    const serviceBody = await serviceSent.clone().json();
    ok(serviceSent instanceof Request && serviceSent.url === 'https://metrics.example/event'
      && serviceSent.headers.get('X-Repolis-Metrics-Key') === 'shared-secret'
      && serviceBody.ev === 'ai_grounding_outcome'
      && serviceBody.groundingPath === 'grounded_via_kb'
      && metricRequests.length === 1,
      'same-account telemetry prefers the signed REPOLIS_METRICS Service Binding and never hairpins through global fetch');
  } finally {
    globalThis.fetch = originalFetch;
  }
}
ok(/\[\[services\]\][\s\S]*?binding = "REPOLIS_METRICS"[\s\S]*?service = "repolis-metrics"/.test(TAXI_WRANGLER),
  'Taxi deployment binds repolis-metrics for same-account Worker telemetry');
ok(/route:'persona_ambient',npc:'resident',phase:'client_observation',answer:false,providerCall:false/.test(HTML),
  'browser ambient observations are explicitly non-authoritative and never leak into the none route');
ok(/function trackAiTurn\([\s\S]{0,260}phase:'client_observation', answer:false, providerCall:false/.test(HTML),
  'browser scholar/taxi observations cannot duplicate the Worker delivered-answer denominator');
ok(/who==='context7'\?'grounded_mcp_context7':who==='huggingface'\?'grounded_mcp_huggingface'/.test(HTML)
  && /route==='market_grounded'\) return 'grounded_kb_market'/.test(HTML),
  'client route aliases match the Worker taxonomy for Context7, Hugging Face, and market grounding');
ok(/action === "npcConfig"/.test(WORKER) && /action === "npcBudget"/.test(WORKER) && /"npcAmbientTurn"/.test(WORKER) && /"npcPlayerChat"/.test(WORKER), 'all four npc actions (config/budget/ambientTurn/playerChat) handled');
ok(/if \(!aiEnabled\) return \{ ok: false, reason: "npc_ai_disabled" \}/.test(WORKER), 'hard ceiling: npcModelCall refuses unless the resolved aiEnabled is true');
ok(/async function npcResolveFlags\(/.test(WORKER), 'npcResolveFlags() resolves the effective NPC flags (env vs live KV)');
ok(/env\.NPC_LIVE_TOGGLE === "true"/.test(WORKER), 'NPC_LIVE_TOGGLE is the master kill-switch for the live toggle');
ok(/source: "env"[\s\S]{0,80}liveToggle: false/.test(WORKER), 'live toggle OFF → resolver ignores KV and stays env-gated (safe deploy-only default)');
ok(/env\.NPC_FLAGS\.get\(/.test(WORKER), 'live mode reads on/off from the shared NPC_FLAGS KV');
ok(/const allows = \(kv\) => kv === "true"/.test(WORKER)
  && /ai: envAi && requested\.ai/.test(WORKER)
  && /ambient: envAi && envAmb && requested\.ambient/.test(WORKER)
  && /player: envAi && envPc && requested\.player/.test(WORKER)
  && /source: "kv-unavailable"/.test(WORKER),
  'KV live flags require explicit true, never bypass env ceilings, and fail closed on missing/read errors');
const npcResolverSource = (WORKER.match(/async function npcResolveFlags\(env\) \{[\s\S]*?(?=\nasync function npcHandler)/) || [''])[0];
ok(!!npcResolverSource, 'npcResolveFlags is extractable for behavioral contract tests');
if (npcResolverSource) {
  const resolveNpcFlags = new Function(`${npcResolverSource}; return npcResolveFlags;`)();
  const liveKv = (values) => ({ get: async (key) => Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null });
  const hardOff = await resolveNpcFlags({
    NPC_LIVE_TOGGLE: 'true',
    NPC_AI_ENABLED: 'false', NPC_AMBIENT_ENABLED: 'false', NPC_PLAYER_CHAT_ENABLED: 'false',
    NPC_FLAGS: liveKv({ ai_enabled: 'true', ambient_enabled: 'true', player_chat_enabled: 'true' }),
  });
  ok(hardOff.requested.ai === true && hardOff.effective.ai === false
    && hardOff.hardAiEnabled === false,
  'KV true cannot bypass an OFF deployment ceiling and both states remain observable');
  const requestedOff = await resolveNpcFlags({
    NPC_LIVE_TOGGLE: 'true',
    NPC_AI_ENABLED: 'true', NPC_AMBIENT_ENABLED: 'true', NPC_PLAYER_CHAT_ENABLED: 'true',
    NPC_FLAGS: liveKv({ ai_enabled: 'false', ambient_enabled: 'false', player_chat_enabled: 'false' }),
  });
  ok(requestedOff.requested.ai === false && requestedOff.effective.ai === false,
    'explicit KV false keeps an enabled deployment ceiling effectively OFF');
  const requestedOn = await resolveNpcFlags({
    NPC_LIVE_TOGGLE: 'true',
    NPC_AI_ENABLED: 'true', NPC_AMBIENT_ENABLED: 'true', NPC_PLAYER_CHAT_ENABLED: 'true',
    NPC_FLAGS: liveKv({ ai_enabled: 'true', ambient_enabled: 'true', player_chat_enabled: 'true' }),
  });
  ok(requestedOn.requested.ai === true && requestedOn.effective.ai === true
    && requestedOn.effective.ambient === true && requestedOn.effective.player === true,
  'explicit KV true activates only features with ON deployment ceilings');
  const missingKeys = await resolveNpcFlags({
    NPC_LIVE_TOGGLE: 'true',
    NPC_AI_ENABLED: 'true', NPC_AMBIENT_ENABLED: 'true', NPC_PLAYER_CHAT_ENABLED: 'true',
    NPC_FLAGS: liveKv({}),
  });
  ok(missingKeys.requested.ai === false && missingKeys.effective.ai === false,
    'missing KV keys fail closed instead of inheriting an enabled deployment default');
  const readFailure = await resolveNpcFlags({
    NPC_LIVE_TOGGLE: 'true',
    NPC_AI_ENABLED: 'true', NPC_AMBIENT_ENABLED: 'true', NPC_PLAYER_CHAT_ENABLED: 'true',
    NPC_FLAGS: { get: async () => { throw new Error('kv unavailable'); } },
  });
  ok(readFailure.requested.ai === null && readFailure.effective.ai === false
    && readFailure.source === 'kv-unavailable',
  'KV read failures expose unknown request state and fail effective flags closed');
  let ignoredReads = 0;
  const deployOnly = await resolveNpcFlags({
    NPC_LIVE_TOGGLE: 'false',
    NPC_AI_ENABLED: 'true', NPC_AMBIENT_ENABLED: 'true', NPC_PLAYER_CHAT_ENABLED: 'false',
    NPC_FLAGS: { get: async () => { ignoredReads += 1; return 'false'; } },
  });
  ok(ignoredReads === 0 && deployOnly.source === 'env' && deployOnly.effective.ai === true
    && deployOnly.effective.player === false,
  'live toggle OFF ignores KV and reports the env-gated effective state');
}
ok(/requested: flags\.requested/.test(WORKER)
  && /controlEffective: status\.controlEffective/.test(WORKER)
  && /runtimeAvailable: status\.runtimeAvailable/.test(WORKER)
  && /budgetReason: status\.budgetReason/.test(WORKER)
  && /hardAiEnabled: flags\.hardAiEnabled/.test(WORKER)
  && /hardAmbientEnabled: flags\.hardAmbientEnabled/.test(WORKER)
  && /hardPlayerChatEnabled: flags\.hardPlayerChatEnabled/.test(WORKER)
  && /pending,/.test(WORKER)
  && /canEnable,/.test(WORKER),
  'npcConfig exposes requested/effective/pending and per-feature deployment ceilings');
ok(/NPC_BUDGET_TIMEOUT_MS = "3000"/.test(TAXI_WRANGLER)
  && /npc_budget_governor_overloaded/.test(NPC_GOVERNOR)
  && /waitBeforeGovernorRetry/.test(NPC_GOVERNOR),
  'Governor uses a 3-second deadline, bounded retry backoff, and an overload no-retry lane');
ok(/runBudgetedNpcCall\(\{[\s\S]*?providerCall: \(plan\) => npcModelCall\(env, role, plan, aiEnabled\)/.test(WORKER),
  'model call is reachable only through the durable reserve/settle lifecycle');
ok(/"npc_budget_exhausted"/.test(WORKER), 'over-budget returns npc_budget_exhausted (client falls back to scripted)');
ok(/NPC_MODEL_DEFAULT[\s\S]*?"gpt-5\.4-mini"/.test(NPC_GOVERNOR), 'provider adapter falls back to gpt-5.4-mini when no NPC_MODEL_* alias is set');
ok(/env\?\.NPC_DAY_CAP_USD/.test(NPC_GOVERNOR) && !/COUNCIL_/.test(NPC_GOVERNOR), 'NPC budget uses the NPC_* namespace (separate from COUNCIL_*)');
ok(/function npcMetric\(/.test(WORKER) && /env\.METRICS_URL/.test(WORKER), 'redacted fire-and-forget metrics emit (env.METRICS_URL) present');
ok(/export class NpcBudgetGovernor/.test(NPC_GOVERNOR)
  && /npc: "npc-budget-canonical-v1"/.test(NPC_GOVERNOR)
  && /"resident-dialogue": "resident-dialogue-budget-v1"/.test(NPC_GOVERNOR)
  && /blockConcurrencyWhile\(run\)/.test(NPC_GOVERNOR),
  'separate canonical Durable Object names serialize NPC and resident-dialogue budget mutations');
ok(!/_npcLedger|source: "module"|module-scope ledger/.test(WORKER + NPC_GOVERNOR),
  'isolate-local NPC budget ledger is fully removed');
ok(/NPC_DAILY_ATTEMPT_MAX/.test(NPC_GOVERNOR)
  && /reason: "daily_attempt_max"/.test(NPC_GOVERNOR)
  && /cleanupFinalized/.test(NPC_GOVERNOR)
  && /deleteKeys\.slice\(index, index \+ 128\)/.test(NPC_GOVERNOR),
  'provider failures are attempt-capped and finalized Durable Object records stay bounded');
ok(/NPC_RESERVATION_LEASE_MS/.test(NPC_GOVERNOR)
  && /async reconcileExpiredReservations\(/.test(NPC_GOVERNOR)
  && /async alarm\(\)/.test(NPC_GOVERNOR)
  && /chargedNanos: record\.amountNanos/.test(NPC_GOVERNOR),
  'orphaned reservations have a durable lease and conservatively full-settle by alarm');
ok(/modelDispatched = true/.test(WORKER)
  && /billable: modelDispatched/.test(WORKER)
  && /billable: true, reason: "provider_http_error"/.test(WORKER),
  'ambiguous failures after Azure model dispatch settle instead of reopening budget');
ok(/NPC_INPUT_OVERHEAD_TOKENS = 512/.test(NPC_GOVERNOR)
  && /maxInputTokens = encodedBytes \+ NPC_INPUT_OVERHEAD_TOKENS/.test(NPC_GOVERNOR)
  && /max_completion_tokens: plan\.maxOutputTokens/.test(WORKER)
  && /maxInputTokens: 272_000/.test(NPC_GOVERNOR)
  && /maxOutputTokens: 128_000/.test(NPC_GOVERNOR)
  && /npc_pricing_unavailable/.test(NPC_GOVERNOR),
  'reservation validates model limits and covers byte-bounded input, provider output cap, and prices');
ok(/name = "NPC_BUDGET_GOVERNOR"/.test(TAXI_WRANGLER)
  && /class_name = "NpcBudgetGovernor"/.test(TAXI_WRANGLER)
  && /new_sqlite_classes = \["NpcBudgetGovernor"\]/.test(TAXI_WRANGLER),
  'Wrangler binds and migrates the SQLite-backed NPC budget Durable Object');
ok(/source: "durable-object"/.test(WORKER)
  && /NPC_BUDGET_SOURCE = "durable-object"/.test(NPC_GOVERNOR),
  'npcConfig and npcBudget identify the Durable Object as their budget authority');

group('Durable NPC budget governor — hermetic atomicity and fail-closed behavior');
await runNpcBudgetGovernorTests(ok);

group('resident profiles — manifest-only boot, lazy detail, and local Bound fallback');
await runResidentRuntimeTests(ok);

group('resident Shared/Bound authority — generated registry and adversarial requests');
await runResidentDialogueTests(ok);
ok(RESIDENT_MANIFEST.profile_count === CITY_REPOS.length
  && RESIDENT_MANIFEST.active_count === 9
  && RESIDENT_MANIFEST.active_roster.every(entry => !RESIDENT_MANIFEST.profiles.find(profile => profile.slug === entry.slug)?.archived),
  'the manifest covers every public repo while the bounded active roster excludes archives');
ok(/await loadResidentManifest\(\{owner:currentUser\}\)/.test(HTML)
  && /async function ensureResidentProfile\(res,retry=false\)/.test(HTML)
  && !/api\.github\.com/.test(RESIDENT_RUNTIME_SRC),
  'boot loads only the local manifest and profile details stay interaction-lazy with zero resident GitHub API calls');
ok(/payload=payload\.npc_action==='residentDialogue'\?Object\.assign\(\{\},payload\)/.test(HTML)
  && /ALLOWED_CLIENT_FIELDS/.test(RESIDENT_DIALOGUE_SRC)
  && /FORBIDDEN_CLIENT_FIELDS/.test(RESIDENT_DIALOGUE_SRC),
  'Bound dialogue omits analytics identity and the Worker rejects every field outside the narrow request contract');
ok(/const bound=res\.bound&&res\.bound\.repoRecord/.test(HTML)
  && /boundHome:res\.bound\?\{repo:res\.bound\.repo/.test(HTML)
  && /if\(LOW_END\|\|!res\.bound\) return null/.test(HTML),
  'active residents anchor to real repo entrances while Starlight home truth and LOW_END prop limits remain intact');
ok(/chatEl\.addEventListener\('keydown'/.test(HTML)
  && /event\.key==='Escape'/.test(HTML)
  && /chatPreviousFocus/.test(HTML)
  && /residentProfileRetry/.test(HTML),
  'resident dialogue includes focus trap/restore, Escape close, and explicit retry chrome');
ok(/test_resident_profiles\.py/.test(REFRESH_WORKFLOW)
  && /validate_resident_profiles\.py/.test(REFRESH_WORKFLOW)
  && /scan_public_artifacts\.py/.test(REFRESH_WORKFLOW),
  'daily publication is gated by resident determinism, schema, and public-safety checks');

group('AURI market oracle — grounded market KB + read-only crypto MCP');
const marketActionSrc=(HTML.match(/function marketActionQuestion\(q\)\{[\s\S]*?(?=\nfunction marketQuestion)/)||[''])[0];
const marketDetectorSrc=(HTML.match(/function marketQuestion\(q\)\{[\s\S]*?return domain\|\|tickerMetric\|\|marketActionQuestion\(s\); \}/)||[''])[0];
const explicitMarketSrc=(HTML.match(/function explicitMarketQuestion\(q\)\{[^\n]*\}/)||[''])[0];
ok(!!marketActionSrc, 'AURI market-action classifier is extractable');
ok(!!marketDetectorSrc, 'AURI market-question classifier is extractable');
ok(!!explicitMarketSrc, 'AURI explicit-market classifier is extractable');
if(marketActionSrc&&marketDetectorSrc&&explicitMarketSrc){
  const isMarket=new Function(`${marketActionSrc}; ${marketDetectorSrc}; return marketQuestion;`)();
  const isExplicit=new Function(`${marketActionSrc}; ${explicitMarketSrc}; return explicitMarketQuestion;`)();
  ok(isMarket('AAPL 현재 주가') && isMarket('AAPL price') && isMarket('ADAUSDT 24h change') && isMarket('ETH 1일 캔들')
    && isMarket('Should I buy AAPL?') && isMarket('Buy 10 AAPL'), 'stock, crypto, and ticker-only trade/advice questions route to AURI');
  ok(!isMarket('React 19 useEffect 문서') && !isMarket('How do I open a file in React?')
    && !isMarket('Why is Node.js memory usage high?') && !isMarket('Docker volume documentation'), 'ordinary technical open/high/volume questions do not enter the market KB');
  ok(isExplicit('Microsoft stock price') && isExplicit('Microsoft MSFT.US price') && isExplicit('Should I buy Microsoft?')
    && !isExplicit('Azure 가격 알려줘') && !isExplicit('How do I open a CSV file in React?'), 'explicit market language or a suffixed stock ticker can override a simultaneous technical handoff');
}
ok(/async function marketResidentAsk\(res,q\)[\s\S]*?npc:'market'[\s\S]*?trace:data\.trace/.test(npcBlock), 'AURI sends market questions to the market KB and preserves source traces');
ok(/function marketFollowup\(q\)\{ if\(!_marketThread\) return false;[\s\S]*?yesterday/.test(npcBlock)
  &&/const marketIntent=res\.oracle==='market'&&!boundCue&&marketQuestion\(q\), handoff=scholarHandoffKind\(q\)/.test(npcBlock)
  &&/if\(marketIntent&&\(!handoff\|\|explicitMarketQuestion\(q\)\)\)\{ await marketResidentAsk\(res,q\); return; \}/.test(npcBlock)
  &&/if\(res\.oracle==='market' && !boundCue && marketFollowup\(q\)\)\{ await marketResidentAsk\(res,q\); return; \}/.test(npcBlock)
  &&/async function marketResidentAsk\(res,q\)\{[\s\S]*?_marketThread=false;[\s\S]*?if\(data\.message\)\{[\s\S]*?_marketThread=true/.test(npcBlock)
  &&/if\(handoff\)\{ if\(res\.oracle==='market'\)\{ cancelMarketRequest\(\); _marketThread=false; \} if\(_maybeScholarHandoff\(q\)\) return; \}/.test(npcBlock)
  &&/!boundCue && marketLocalIntent\(q\)\)\{ marketResidentLocalSay\(res,q\); return; \}[\s\S]*?!boundCue && marketFollowup\(q\)/.test(npcBlock)
  &&/\^\(\?:\[A-Z\]\{1,5\}/.test(npcBlock)
  &&/_resHist=\[\]; _marketThread=false/.test(HTML), 'AURI keeps follow-up context only after a successful market response and clears it on handoff, failure, or chat switch');
ok(/function cancelMarketRequest\(\)\{ _marketRequestSeq\+\+;[\s\S]*?_marketAbort\.abort\(\)/.test(npcBlock)
  &&/requestSeq!==_marketRequestSeq\|\|!activeNpc\|\|activeNpc\.res!==res\|\|chatEl\.classList\.contains\('hidden'\)/.test(npcBlock)
  &&/if\(activeNpc!==npc\)\{ cancelMarketRequest\(\);/.test(HTML)
  &&/function closeChat\(\)\{ cancelMarketRequest\(\);/.test(HTML), 'switching or closing chat aborts and generation-gates late AURI responses');
ok(/function _socialResident\(L\)\{ return !!L && !L\.res\.oracle; \}/.test(npcBlock)
  &&/const P=RESIDENTS_LIVE\.filter\(_socialResident\)/.test(npcBlock)
  &&/if\(!_socialResident\(seed\)\) return null/.test(npcBlock), 'the market easter egg stays outside ambient circles and group chat');
ok(/return RESIDENTS\.filter\(r=>!r\.easterEgg&&/.test(HTML), 'the Village Chronicle does not advertise the easter-egg resident');
ok(/market:\s*\{[\s\S]*?kb: env\.MARKET_KB_NAME \|\| "repolis-market-kb"[\s\S]*?ks: env\.MARKET_KS_NAME/.test(WORKER), 'AURI reads one dedicated market knowledge base');
ok(/MARKET_LONGBRIDGE_ACCESS_TOKEN/.test(WORKER)
  &&/headers\[`?\$\{authKs\}-header-name1`?\] = "Authorization"/.test(WORKER)
  &&/headers\[`?\$\{authKs\}-header-value1`?\]/.test(WORKER), 'Longbridge OAuth stays server-side and is forwarded with Azure query-time control headers');
const cryptoMcpBlock=(WORKER.match(/const CRYPTO_MCP_TOOLS = \[[\s\S]*?\n\];/)||[''])[0];
ok(/name: "crypto_spot_quotes"/.test(cryptoMcpBlock) && /name: "crypto_candles"/.test(cryptoMcpBlock), 'the crypto adapter exposes quote and OHLCV read tools');
ok(!/place_order|submit_order|withdraw|transfer|account_balance|positions/.test(cryptoMcpBlock), 'the crypto MCP tool surface contains no account, transfer, position, or order capability');
ok(/new URL\(request\.url\)\.pathname === CRYPTO_MCP_PATH/.test(WORKER) && /async function cryptoMcpHandler\(/.test(WORKER), 'the Worker serves the stateless crypto MCP endpoint');
ok(/function cryptoProductCandidates\([\s\S]*?const suffix = \[\.\.\.CRYPTO_QUOTES\]/.test(WORKER), 'a symbol that already carries its quote asset keeps it, and a bare asset gets the requested one');
ok(/rpc\.method === "ping"/.test(WORKER) && /Array\.isArray\(input\)/.test(WORKER) && /if \(notification\) return null/.test(WORKER), 'the MCP endpoint handles ping, JSON-RPC batches, and notification no-response semantics');
ok(/const CRYPTO_MCP_BATCH_MAX = 3/.test(WORKER)
  &&/input\.length > CRYPTO_MCP_BATCH_MAX/.test(WORKER)
  &&/for \(const rpc of \(batch \? input : \[input\]\)\)/.test(WORKER), 'unauthenticated MCP batches are capped and dispatched sequentially');
ok(/if \(e\?\.name === "AbortError" \|\| signal\.aborted\) throw e/.test(WORKER), 'quote timeouts propagate as MCP errors instead of successful unavailable documents');
ok(/function unknownCryptoProduct\(e\)/.test(WORKER)
  &&/if \(!unknownCryptoProduct\(e\)\) throw e/.test(WORKER)
  &&/e instanceof McpInputError/.test(WORKER), 'only unknown-product responses become unavailable candidates; rate limits, outages, and network errors stay tool errors');
ok(/latestState = latest\?\.closed \? "closed" : "open and provisional"/.test(WORKER) && /retrieved \$\{retrievedAt\}/.test(WORKER), 'open candles are labeled provisional with an actual retrieval timestamp');
ok(/function marketBoundary\([\s\S]*?market_read_only/.test(WORKER)
  &&/function marketContextFollowup\(/.test(WORKER)
  &&/marketBoundary\(question, lang, history\)/.test(WORKER)
  &&/if \(chat && who !== "market"\)/.test(WORKER)
  &&/if \(who === "market"\) return json\(\{ fallback: true, reason: "market sources unavailable" \}/.test(WORKER)
  &&/function marketNotice\(/.test(WORKER), 'market answers are read-only, never fall back to stale model knowledge, and carry an investment disclaimer');
ok(/String\(body\.speaker \|\| ""\)\.toLowerCase\(\) === "auri"/.test(WORKER)
  &&/reason: "market_oracle_requires_grounding"/.test(WORKER), 'generic resident AI actions reject AURI so every AI market answer must use the guarded KB route');
const marketGuardSrc=(WORKER.match(/function marketContextFollowup\(question\)[\s\S]*?(?=\nfunction marketNotice)/)||[''])[0];
ok(!!marketGuardSrc, 'market guard functions are extractable');
if(marketGuardSrc){
  const guard=new Function(`${marketGuardSrc}; return marketBoundary;`)();
  ok(guard('Do you recommend BTC?','en',[]) && guard('Which stock do you recommend?','en',[])
    && guard('Is Microsoft stock a good investment?','en',[]) && guard('Can you trade BTC for me?','en',[])
    && guard('What is the best stock to buy?','en',[]) && guard('Pick a stock for me','en',[])
    && guard('BTC 투자해도 돼?','ko',[]) && guard('BTC 매수 주문 부탁해','ko',[]) && guard('주식 뭐 사는 게 좋아?','ko',[]), 'common recommendation and order wording is blocked before retrieval');
  ok(guard('What about ETH?','en',[{role:'user',text:'Should I buy BTC?'}])
    && guard('And ETH?','en',[{role:'user',text:'Should I buy BTC?'}]), 'advice intent is inherited by terse context-only market follow-ups');
  ok(!guard('BTCUSDT 24h change','en',[]), 'factual quote questions still reach the grounded market KB');
}

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
ok(/if\(opts&&opts\.handoff&&!repositoryAtelierActive\(\)\)[\s\S]*?startScholarHandoff\(kind\)/.test(HTML),
  'exterior chat messages can render a specialist handoff while Atelier chat keeps room ownership');
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
ok(/async function _aiPlayerChat\(res,q,opts\)\{/.test(npcBlock)
  && /npc_action:'residentDialogue', resident_id:res\.id, authority_digest:res\.bound\.authorityDigest/.test(npcBlock)
  && /payload\.history=opts\.last\.slice\(-6\)/.test(npcBlock),
  '_aiPlayerChat sends only server-authorized identity/digest plus a six-turn bounded history');
ok(!/payload\.(?:profile|bound_memories|repo|system|messages)=/.test(npcBlock),
  'resident chat never sends client-owned profile, Bound payload, repo identity, or role/system text');
ok(/const last=_resHistWindow\(\); _resHistPush\('visitor',q\)/.test(npcBlock) && /_resHistPush\(res\.id,c\)/.test(npcBlock), 'residentSay snapshots history then records both the question and the reply, so a follow-up keeps context');
ok(/const ctx=base\.concat\(\[\{who:pres\.id,text:mainLine\}\]\)/.test(npcBlock) && /_aiPlayerChat\(other,q,\{last:ctx\}\)/.test(npcBlock),
  "groupSay feeds the 2nd resident the primary's answer as bounded history without client-authored prompt controls");
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
ok(/const rb=VISITOR\.returning, news=hasFreshness\(\)/.test(HTML)
  && /if\(rb&&cityMode!=='portal'&&!_reqFocus\)\{ setTimeout\(\(\)=>\{ try\{ showWave\(_welcomeBackLine\(\),3600\)/.test(HTML)
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
ok(/const _RES_FAV=\{ sol:\{ko:'볕 잘 드는 실험 자리'/.test(npcBlock) && /auri:\{ko:'데이터 공방 뒤의 작은 장부방'/.test(npcBlock), 'each of the nine residents has a persona-fitting favourite place');
ok(/function _resFavPhase\(res\)\{[\s\S]*?res&&res\.id/.test(npcBlock) && /function _resFavSpot\(L\)\{ if\(L\._fav\) return L\._fav;/.test(npcBlock) && /_resFavPhase\(L\.res\)/.test(npcBlock), '_resFavSpot resolves a reload-stable deterministic haunt phase');
ok(/if\(L\.res\.id==='noa' && typeof HEARTH!=='undefined' && HEARTH\)/.test(npcBlock), 'Noa\'s cherished haunt remains the campfire');
ok(/function _resFavLine\(L\)\{ const f=L\._fav, ?d=f\?\(LANG==='ko'\?f\.ko:f\.en\):''/.test(npcBlock), '_resFavLine speaks fondly of that spot, weaving in its descriptor');
ok(/if\(!L\._atHome && tt>=\(L\._favCd\|\|0\) && Math\.random\(\)<0\.3\)\{ const f=_resFavSpot\(L\);/.test(npcBlock) && /L\._toFav=true; L\._favCd=tt\+42\+Math\.random\(\)\*44;/.test(npcBlock), 'now and then (cooldown-gated) a wandering resident heads for their haunt instead of a random waypoint');
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

group('Starlight Row — nine resident homes + visible home/work routines');
const homesBlock=(npcBlock.match(/Starlight Row — one real cottage[\s\S]*?resident visuals/)||[''])[0];
const homeLandscapeBlock=(homesBlock.match(/function buildResidentQuarterLandscape\(q\)[\s\S]*?function buildResidentQuarter\(\)/)||[''])[0];
const homeAngles=Array.from({length:9},(_,i)=>i/9*Math.PI*2+Math.PI/36);
const homeRadii=homeAngles.map(a=>Math.hypot(130+Math.cos(a)*13,130+Math.sin(a)*13));
const homeEntranceGap=Math.min(...homeAngles.map(a=>{ const d=Math.abs(Math.atan2(Math.sin(a-Math.PI*1.25),Math.cos(a-Math.PI*1.25))); return 2*13*Math.sin(d/2); }));
const broadAngles=[0.05,0.66,1.25,1.86,2.48,4.48,5.04,5.58,6.04];
const broadVisualMax=Math.max(...broadAngles.map((a,i)=>Math.hypot(130+Math.cos(a)*19.2,130+Math.sin(a)*19.2)+1.58*(0.9+(i%3)*0.08)));
const canopyPostSeatGap=Math.hypot(-1.25-(-0.95),3.2-(2.1*1.04+0.06+0.38));
const canopyOuterRadius=Math.hypot(2.35/2,2.1*1.04+0.06+0.24+0.82/2);
const minWindowCanopyGap=(2.92*0.94+0.05-0.14/2)-(2.35*0.94+0.98/2);
ok(homesBlock.length>0, 'resident-quarter geometry block is extractable');
ok(/const RES_QUARTER_SITE=Object\.freeze\(\{x:130,z:130,reserve:42\}\)/.test(HTML)
  &&/RES_HOME_RING=13, RES_HOME_ANGLE_OFFSET=Math\.PI\/36/.test(homesBlock)
  &&Math.min(...homeRadii)>165&&Math.max(...homeRadii)<205, 'all nine homes occupy the north-east outer clearing inside the 205-unit map radius');
ok(/i\/n\*Math\.PI\*2\+RES_HOME_ANGLE_OFFSET/.test(homesBlock)
  &&/i\/RESIDENTS\.length\*Math\.PI\*2\+RES_HOME_ANGLE_OFFSET/.test(homesBlock)
  &&homeEntranceGap>3.15, 'the nine-cottage ring leaves the town-facing entrance axis outside every cottage collider');
ok(/overflow\.some\(s=>Math\.hypot\(s\.x-RES_QUARTER_SITE\.x,s\.z-RES_QUARTER_SITE\.z\)<RES_QUARTER_SITE\.reserve\)/.test(HTML)
  &&/overflow\.length=0; const qa=Math\.atan2\(RES_QUARTER_SITE\.z,RES_QUARTER_SITE\.x\)/.test(HTML), 'public-town overflow slots redistribute around the reserved residential clearing');
ok(/new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(5,3\.2,4\.2\)[\s\S]*?roofHip=new THREE\.InstancedMesh\(new THREE\.ConeGeometry\(3\.8,2\.1,4\)/.test(homesBlock)
  &&/roofGable=new THREE\.InstancedMesh\(_gableHomeRoofGeometry\(\)/.test(homesBlock)
  &&/roofHex=new THREE\.InstancedMesh\(new THREE\.ConeGeometry\(3\.55,2\.3,6\)/.test(homesBlock)
  &&/new THREE\.InstancedMesh\(new THREE\.PlaneGeometry\(0\.84,0\.98\)/.test(homesBlock), 'walls, roofs, and sixteen windows stay draw-batched');
ok(/const RES_HOME_STYLES=Object\.freeze\(\{[\s\S]*?sol:\{roof:'hip'\}[\s\S]*?jun:\{roof:'gable',chimney:true\}[\s\S]*?nari:\{roof:'hex',canopy:true,boxes:true\}/.test(homesBlock)
  &&/roofCounts=\{hip:0,gable:0,hex:0\}; styles\.forEach\(s=>roofCounts\[s\.roof\]\+\+\)/.test(homesBlock), 'resident IDs deterministically resolve to three bounded roof-style batches');
ok(/function _gableHomeRoofGeometry\(\)[\s\S]*?g\.setIndex\(\[0,1,2,4,3,5/.test(homesBlock)
  &&/const hard=g\.toNonIndexed\(\); g\.dispose\(\);[\s\S]*?hard\.computeVertexNormals\(\); hard\.computeBoundingSphere\(\)/.test(homesBlock), 'gable cottages duplicate hard-face vertices before computing normals and bounds');
ok(/for\(let i=0;i<RESIDENTS\.length;i\+\+\)[\s\S]*?RESIDENT_HOMES\.push\(home\)/.test(homesBlock)
  &&/signTexture\('🏠 '\+\(res\[LANG\]\|\|res\.ko\)\.name,res\.color\)/.test(homesBlock), 'the roster truthfully creates one colored, named cottage per resident');
ok(/_addResidentQuarterCollider\(\{x:wx,z:wz,r:3\.15,_residentHome:res\.id\}\)/.test(homesBlock)
  &&/function _addResidentQuarterCollider\(c\)\{\s*RES_QUARTER_COLLIDERS\.push\(c\); EXTRA_COLLIDERS\.push\(c\); COLLIDERS\.push\(c\)/.test(homesBlock), 'every cottage and landscape obstacle joins resident-target and player collision registries');
ok(/q\.add\(yard,body,roofHip,roofGable,roofHex,door,windows,shutters,transoms,windowBoxes\)/.test(homesBlock)
  &&/if\(!LOW_END\) q\.add\(canopies,canopyPosts,chimneys,finials\)/.test(homesBlock)
  &&/batches:LOW_END\?6:10/.test(homesBlock)&&/if\(!LOW_END\) makeGlowFlowers/.test(homesBlock)
  &&!/PointLight|fetch\(|_npcFetch|npcModelCall/.test(homesBlock), 'LOW_END keeps core style batches, drops four optional batches, and adds no light, network, or model call');
ok(/new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(0\.22,0\.94,0\.1\)/.test(homesBlock)
  &&/new THREE\.InstancedMesh\(new THREE\.PlaneGeometry\(0\.58,0\.34\),winMat,RESIDENTS\.length\)/.test(homesBlock)
  &&/new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(1\.0,0\.22,0\.34\)/.test(homesBlock)
  &&/facadeZ=2\.1\*wallZ\+0\.06/.test(homesBlock), 'shutters, transoms, and selected window boxes remain one batch each and sit outside scaled facades');
ok(/new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(2\.35,0\.14,0\.82\)/.test(homesBlock)
  &&/new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(0\.14,1,0\.14\)/.test(homesBlock)
  &&/new THREE\.OctahedronGeometry\(0\.25,0\)/.test(homesBlock), 'desktop canopies, support posts, and roof finials stay shared and instanced');
ok(/const sp=_homeLocal\(lx,lz,rot,0,Math\.max\(2\.58,facadeZ\+0\.34\)\)/.test(homesBlock)
  &&/board\.position\.set\(sp\.x,3\.72\*height,sp\.z\)/.test(homesBlock)
  &&canopyPostSeatGap>0.6&&canopyOuterRadius<3.15&&minWindowCanopyGap>0, 'signs clear gable facades and canopy assemblies clear windows, seats, and cottage collision');
ok(/roofStyles:roofCounts,shutters:RESIDENTS\.length\*4,transoms:RESIDENTS\.length,windowBoxes:boxCount/.test(homesBlock)
  &&/style:style\.roof,details:\{canopy:!LOW_END&&!!style\.canopy,boxes:!!style\.boxes,chimney:!LOW_END&&!!style\.chimney,finial:!LOW_END\}/.test(homesBlock), 'debug state reports truthful style and rendered detail counts on every quality tier');
ok(/SEATS\.push\(\{x:seat\.x,z:seat\.z,rot:rot\+Math\.PI,pos:new THREE\.Vector3\(seat\.x,0,seat\.z\),_residentHome:res\.id\}/.test(homesBlock)
  &&/if\(L\._atHome\)\{ if\(s\._residentHome!==L\.res\.id\) continue; \} else if\(s\._residentHome\) continue/.test(npcBlock)
  &&/function _coRestSeats\(L,W\)\{ if\(L\._atHome\|\|W\._atHome\) return null/.test(npcBlock), 'at-home residents use only their own porch seat and never leak into friend co-rest pairing');
ok(/home:homeRec\?\{x:homeRec\.porch\.x,z:homeRec\.porch\.z\}[\s\S]*?work:\{x:work\.x,z:work\.z\}/.test(npcBlock)
  &&/const h=L\.work\|\|L\.home/.test(npcBlock), 'each resident keeps a real cottage home while cherished haunts remain tied to the work district');
ok(/if\(!hub\)\{ const base=_resFavPhase\(res\),golden=Math\.PI\*\(3-Math\.sqrt\(5\)\)/.test(npcBlock)
  &&/_RES_WORK_SPOTS\.some\(p=>Math\.hypot\(p\.x-x,p\.z-z\)<6\)/.test(npcBlock), 'missing public-town districts receive deterministic separated fallback work anchors');
ok(/function _syncResidentRoutine\(tt\)[\s\S]*?p==='night'\|\|prev==='night'/.test(npcBlock)
  &&/wantHome=_residentRoutinePart==='night'/.test(npcBlock)
  &&/L\._commute\?RES_MOVE\.commuteSpd:L\._wspd,dt,!!L\._commute/.test(npcBlock), 'night/day transitions stagger purposeful collision-aware home/work commutes');
ok(/if\(!force&&\(L\._joy\|\|L\._joinWalk\|\|L\._stroll\|\|L\._pNear\|\|L\._rest\)\) return false/.test(npcBlock)
  &&/if\(L\._commute&&L\._pNear\)\{ moving=false; \}/.test(npcBlock)
  &&/else if\(!_festival && !inConv && !chatBound && !hidden && NPC_CFG\.motionEnabled\)/.test(npcBlock), 'commuting starts and pauses behind every stronger resident owner');
ok(/function _resolveResidentQuarterColliders\(p\)/.test(npcBlock)
  &&/if\(avoid\) resolveColliders\(g\.position\); else _resolveResidentQuarterColliders\(g\.position\)/.test(npcBlock), 'every resident movement mode respects quarter colliders while long commutes retain full town collision');
ok(homeLandscapeBlock.length>0, 'resident-quarter landscape block is extractable');
ok(/const n=RESIDENTS\.length, perHome=LOW_END\?3:5, commonN=LOW_END\?10:18/.test(homeLandscapeBlock)
  &&/new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(1\.1,0\.55,0\.45\)/.test(homeLandscapeBlock)
  &&/new THREE\.InstancedMesh\(new THREE\.CylinderGeometry\(0\.34,0\.39,0\.09,10\)/.test(homeLandscapeBlock), 'all nine homes receive draw-batched hedges, stepping stones, and bounded flower beds');
ok(/side\?-2\.4:2\.4,3\.0/.test(homeLandscapeBlock)&&/seatHedgeGap:0\.6/.test(homeLandscapeBlock), 'front hedges leave a measured clear gap around every porch seat');
ok(/const broadA=LOW_END\?\[0\.05,1\.28,2\.38,4\.82,5\.82\]/.test(homeLandscapeBlock)
  &&/const cypressA=LOW_END\?\[1\.72,5\.18\]/.test(homeLandscapeBlock)
  &&/broadA\.forEach\(\(a,i\)=>\{ const r=19\.2/.test(homeLandscapeBlock)
  &&/shrubN=LOW_END\?10:18/.test(homeLandscapeBlock)&&broadVisualMax<205, 'LOW_END keeps a reduced tree perimeter and the full broadleaf canopy stays inside the map radius');
ok(/const entranceA=Math\.PI\*1\.25/.test(homeLandscapeBlock)
  &&/if\(d>0\.48\) shrubAngles\.push\(a\)/.test(homeLandscapeBlock), 'the town-facing entrance remains open through the perimeter hedge');
ok(/lampN=LOW_END\?2:4/.test(homeLandscapeBlock)
  &&/const a=i\/lampN\*Math\.PI\*2,r=5\.25/.test(homeLandscapeBlock)
  &&/new THREE\.InstancedMesh\(new THREE\.BoxGeometry\(0\.13,2\.1,0\.13\)/.test(homeLandscapeBlock)
  &&!/PointLight|fetch\(|_npcFetch|npcModelCall/.test(homeLandscapeBlock), 'shared-garden lanterns avoid the 225° taxi entrance and add no point light, network, or model cost');
ok(/L\._commute=null; L\._rt=null; L\._toFav=false; L\._toBond=false/.test(npcBlock)
  &&/L\._routineAt=now\+1\+i\*\(LOW_END\?1\.4:0\.8\)/.test(npcBlock), 'festival ownership clears stale routes and staggers a fresh home/work evaluation on release');
ok(/case 'homes': return RES_QUARTER\?/.test(HTML)
  &&/\{id:'homes',\s+ico:'🏘️', key:'lmHomes'\}/.test(HTML)
  &&/\{id:'homes',ico:'🏘️'\}/.test(HTML)
  &&/LM\.push\(\[RES_QUARTER_POS\.x,RES_QUARTER_POS\.z,'🏘️'\]\)/.test(HTML)
  &&/lmDriveHomes:/.test(HTML)&&/lmArriveHomes:/.test(HTML), 'map, Station, taxi, Passport, and bilingual arrival copy expose the new quarter');
ok(/window\.__residentQuarter=/.test(HTML)&&/window\.__goHome=/.test(HTML)&&/window\.__goWork=/.test(HTML)
  &&/window\.__homeCollision=/.test(HTML)&&/window\.__finishCommute=/.test(HTML)&&/window\.__frameHomes=/.test(HTML)
  &&/window\.__frameHome=/.test(HTML), 'debug hooks inspect, collide, drive, finish, and frame quarter-wide or individual residential routines');

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

group("maintainers' night watch — quiet upkeep becomes a truthful three-house lantern route");
const watchSelectorSrc = (HTML.match(/\/\*NIGHT_WATCH_SELECTOR:START\*\/([\s\S]*?)\/\*NIGHT_WATCH_SELECTOR:END\*\//) || [, ''])[1];
ok(watchSelectorSrc.length > 0, 'night-watch selector block is extractable from index.html');
let quietRepoWatchPick = null;
if (watchSelectorSrc) {
  try { quietRepoWatchPick = new Function(`${watchSelectorSrc}\nreturn quietRepoWatchPick;`)(); }
  catch (e) { console.log('  ✗ night-watch selector harness: ' + e.message); }
}
ok(typeof quietRepoWatchPick === 'function', 'night-watch selector loads without browser globals');
if (quietRepoWatchPick) {
  const fixture = [
    {repo:'quiet-one',stars:0,forks:0,pushed:'2026-08-10T00:00:00Z',archived:false,fork:false},
    {repo:'quiet-two',stars:1,forks:0,pushed:'2026-08-01T00:00:00Z',archived:false,fork:false},
    {repo:'quiet-three',stars:0,forks:1,pushed:'2026-07-01T00:00:00Z',archived:false,fork:false},
    {repo:'crowded',stars:999,forks:80,pushed:'2026-08-11T00:00:00Z',archived:false,fork:false},
    {repo:'stale',stars:0,forks:0,pushed:'2020-01-01T00:00:00Z',archived:false,fork:false},
    {repo:'archived',stars:0,forks:0,pushed:'2026-08-11T00:00:00Z',archived:true,fork:false},
    {repo:'fork-copy',stars:0,forks:0,pushed:'2026-08-11T00:00:00Z',archived:false,fork:true}
  ];
  const a = quietRepoWatchPick(fixture, 'keeper', '2026-08-11');
  const b = quietRepoWatchPick(fixture, 'keeper', '2026-08-11');
  const names = a && a.stops ? a.stops.map(r => r.repo) : [];
  ok(!!a && names.length === 3 && new Set(names).size === 3, 'watch yields exactly three distinct repo houses');
  ok(JSON.stringify(names) === JSON.stringify(b.stops.map(r => r.repo)) && a.id === b.id, 'same town + date yields the same watch deterministically');
  ok(['quiet-one','quiet-two','quiet-three'].every(name => names.includes(name)), 'recent low-star upkeep outranks a popular fresh repo and a quiet stale repo');
  ok(a.facts.length === 3 && a.facts.every((f, i) => f.repo === a.stops[i].repo && f.ageDays >= 0 && f.stars <= 1),
    'every stop carries aligned, factual age/star evidence for the UI');
  ok(!names.includes('archived') && !names.includes('fork-copy'), 'normal selection excludes archived repos and forks');
  ok(quietRepoWatchPick([{repo:'a'},{repo:'b'}], 'tiny', '2026-08-11') === null, 'a town with fewer than three houses reports the watch unavailable');
  ok(quietRepoWatchPick([
    {repo:'a',stars:0,pushed:'2026-08-10',archived:false,fork:false},
    {repo:'b',stars:0,pushed:'2026-08-09',archived:false,fork:false},
    {repo:'fork',stars:0,pushed:'2026-08-08',archived:false,fork:true}
  ], 'ineligible', '2026-08-11') === null, 'forks never backfill a watch with fewer than three eligible originals');
  ok(quietRepoWatchPick([
    {repo:'a',stars:0,pushed:'2020-01-01',archived:false,fork:false},
    {repo:'b',stars:0,pushed:'2020-01-02',archived:false,fork:false},
    {repo:'c',stars:0,pushed:'2020-01-03',archived:false,fork:false}
  ], 'stale', '2026-08-11') === null, 'repos untouched for more than two years do not qualify as maintained');
  const ownerWatch = quietRepoWatchPick(trailRepos, 'hyeonsangjeon', '2026-08-11');
  ok(!!ownerWatch && ownerWatch.stops.length === 3 && ownerWatch.facts.every(f => Number.isFinite(f.ageDays)),
    'the shipped owner town produces a complete watch with finite maintenance facts');
}
const watchBlock = (HTML.match(/Maintainers' Night Watch:[\s\S]*?\/\* ---- 🔭 Observatory modal/) || [''])[0];
ok(/id=["']lanternWatchHud["']/.test(HTML) && /id=["']obsNightWatchStart["']/.test(HTML), 'responsive watch HUD + Observatory launch action are present');
ok(/#lanternWatchHud\.hidden\s*\{[^}]*visibility:hidden/.test(HTML), 'inactive watch HUD is removed from focus/accessibility visibility');
ok(/#lanternWatchHud\s*\{\s*left:12px;\s*bottom:calc\(100px \+ env\(safe-area-inset-bottom,0px\)\)/.test(HTML),
  'touch watch HUD sits above the bottom interaction prompt and safe area');
ok(/#starTrailHud \.stClose,\s*#lanternWatchHud \.stClose,\s*#repoRouteHud \.stClose\s*\{\s*width:44px;\s*height:44px/.test(HTML),
  'all three route close controls meet the 44px coarse-pointer target');
ok(/function startLanternWatch\(\)[\s\S]*?if\(STAR_TRAIL\) endStarTrail\(\)[\s\S]*?setTimeOfDay\(true\)[\s\S]*?setNav\(LANTERN_WATCH\.stops\[0\]\)/.test(watchBlock),
  'watch launch owns the route, turns on night, and guides to the first quiet repo');
ok(/function startStarTrail\(\)[\s\S]{0,140}if\(LANTERN_WATCH\) endLanternWatch\(\)/.test(HTML),
  'starting the constellation reciprocally releases any active night watch');
ok(/function buildLanternWatchVisuals\(\)/.test(watchBlock) && /new THREE\.SpriteMaterial/.test(watchBlock)
  && /new THREE\.RingGeometry/.test(watchBlock) && /moteCount=LOW_END\?4:8/.test(watchBlock),
  'watch uses bounded LOW_END-aware lantern sprites, motes, and ground rings');
ok(!/new THREE\.(PointLight|SpotLight|DirectionalLight)/.test(watchBlock), 'lanterns add no scene lights (performance ceiling)');
ok(/function updateLanternWatch\(t\)[\s\S]*?V\.group\.visible=isNight[\s\S]*?document\.hidden[\s\S]*?if\(REDUCED\) return/.test(watchBlock),
  'lantern motion is night-only, hidden-tab safe, and respects reduced motion');
ok(/function _removeLanternWatchVisuals\(\)[\s\S]*?o\.geometry\.dispose\(\)[\s\S]*?m\.dispose\(\)/.test(watchBlock),
  'ending or replaying the watch disposes its geometry and materials');
ok(/function openCard\(repo\)[\s\S]{0,130}lanternWatchVisit\(repo\)/.test(HTML), 'opening the current repo house advances the watch');
ok(/addStamp\(['"]nightwatch['"],celebrate\)/.test(watchBlock) && /if\(celebrate\) _auroraBoost=Math\.max\(_auroraBoost,12\)/.test(watchBlock)
  && /if\(!REDUCED&&isNight\) popSparkle/.test(watchBlock),
  'completion always awards the stamp while transient particles/aurora stay night- and motion-safe');
ok(/\{id:['"]nightwatch['"],\s+ico:['"]🏮['"],\s+key:['"]lmNightWatch['"]\}/.test(HTML), 'passport catalog includes the Keeper of Quiet Repos stamp');
ok((HTML.match(/watchKicker:\s*['"]/g) || []).length >= 2 && (HTML.match(/watchComplete:\s*['"]/g) || []).length >= 2
  && (HTML.match(/lmNightWatch:\s*['"]/g) || []).length >= 2, 'watch launch/progress/reward copy has Korean + English parity');
ok(/window\.__lanternWatchPlan=/.test(HTML) && /window\.__lanternWatchStart=/.test(HTML)
  && /window\.__lanternWatchNext=/.test(HTML) && /window\.__lanternWatchEnd=/.test(HTML), '?dbg watch plan/start/advance/end hooks are present');
ok(/updateLanternWatch\(clock\.elapsedTime\)/.test(HTML), 'the main world loop updates active night-watch lanterns');

group('one colossal deterministic World Tree Pillar supports the village');
const memorialTreeBlock = (HTML.match(/\/\*MEMORIAL_TREE:START\*\/([\s\S]*?)\/\*MEMORIAL_TREE:END\*\//) || [, ''])[1];
const worldTreeChronicleBlock = (HTML.match(/\/\*WORLD_TREE_CHRONICLE:START\*\/([\s\S]*?)\/\*WORLD_TREE_CHRONICLE:END\*\//) || [, ''])[1];
const visualLodBlock = (HTML.match(/\/\*VISUAL_LOD:START\*\/([\s\S]*?)\/\*VISUAL_LOD:END\*\//) || [, ''])[1];
const staticInstanceBlock = (HTML.match(/\/\*STATIC_INSTANCES:START\*\/([\s\S]*?)\/\*STATIC_INSTANCES:END\*\//) || [, ''])[1];
const buildingLodPrototypeBlock = (HTML.match(/\/\*BUILDING_LOD_PROTOTYPE:START\*\/([\s\S]*?)\/\*BUILDING_LOD_PROTOTYPE:END\*\//) || [, ''])[1];
const buildingLodReadabilityMatch = HTML.match(/(function _buildingLodReadabilityGeometry\(repo\)\{([\s\S]*?)\n\})\nfunction _buildingLodSilhouetteGeometry/) || [];
const buildingLodReadabilitySource = buildingLodReadabilityMatch[1] || '';
const buildingLodReadabilityBlock = buildingLodReadabilityMatch[2] || '';
const buildingLodUpdateBlock = (HTML.match(/function _updateBuildingLodPrototype\(frame,force=false\)\{([\s\S]*?)\n\}\nfunction _syncBuildingLodFacade/) || [, ''])[1];
const worldTreeBloomPrepBlock = (HTML.match(/function _prepareWorldTreeBloom\(\)\{([\s\S]*?)\n\}\nfunction _renderWorldTreeFrame/) || [, ''])[1];
const worldTreeBloomProjectionBlock = (HTML.match(/function _updateWorldTreeBloomProjection\(\)\{([\s\S]*?)\n\}\nfunction _captureWorldTreeBloomProjection/) || [, ''])[1];
ok(memorialTreeBlock.length > 0, 'world-tree procedural block is extractable from index.html');
ok(worldTreeChronicleBlock.length > 0, 'World Tree Chronicle interaction block is extractable from index.html');
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
ok(/world-tree-state\.js\?v=world-tree-phase2-v1/.test(HTML)
  &&/hero\.runtime\.nodes\['living-system'\]\.scale\.setScalar\(WORLD_TREE_GROWTH\.scale\)/.test(memorialTreeBlock)
  &&/const collider=\{x,z,r:11\.6,_memorialTree:true\}/.test(memorialTreeBlock)
  &&/growthScale:WORLD_TREE_GROWTH\.scale/.test(memorialTreeBlock),
  'bounded generated-state growth scales the living silhouette while preserving the established root collider and factory');
ok(/function makeWorldTreeSapFlow\(\)/.test(HTML)
  &&/new THREE\.Points\(geometry,material\)/.test(HTML)
  &&/WORLD_TREE_SAP_MODE==='travel'/.test(HTML)
  &&/if\(finished\)\{ flow\.finished=true/.test(HTML)
  &&/function _setWorldTreeSapVisible\(visible\)/.test(HTML)
  &&/_setWorldTreeSapVisible\(requestedTreeVisible&&!treeOff\)/.test(HTML)
  &&/MEMORIAL_TREE\.requestedVisible=false; _setWorldTreeSapVisible\(false\)/.test(HTML)
  &&/updateWorldTreeSapFlow\(clock\.elapsedTime\)/.test(HTML),
  'one batched point signal travels from the tree to every repo once, then settles without an infinite animation');
ok(/id="worldTreeTrigger"[\s\S]*?aria-haspopup="dialog"[\s\S]*?aria-keyshortcuts="Enter Space"/.test(HTML)
  &&/id="worldTreeModal" role="dialog" aria-modal="true" aria-labelledby="worldTreeTitle"/.test(HTML)
  &&/worldTreeAtScreen\(cx,cy\)/.test(HTML)
  &&/\(e\.code==='Enter'\|\|e\.code==='Space'\)&&nearWorldTree&&!nearNpc/.test(HTML),
  'World Tree supports named pointer, touch, Enter, and Space activation through the existing landmark controls');
ok(/worldTreeModal\.addEventListener\('keydown',event=>\{ if\(event\.key==='Escape'\)/.test(worldTreeChronicleBlock)
  &&/event\.key!=='Tab'/.test(worldTreeChronicleBlock)
  &&/WORLD_TREE_UI\.previousFocus=source\|\|document\.activeElement\|\|worldTreeTrigger/.test(worldTreeChronicleBlock)
  &&/previous&&previous\.isConnected&&!previous\.hidden\?previous:fallback/.test(worldTreeChronicleBlock)
  &&/actBtn\.addEventListener\('click',\(\)=>\{ if\(modalOpen\) return; doAct\(actBtn\); \}\)/.test(HTML)
  &&/if\(event\.target===worldTreeModal\) closeWorldTreeChronicle\(\)/.test(worldTreeChronicleBlock),
  'Chronicle traps focus, closes by Escape or backdrop, and restores the originating trigger');
ok(/worldTreeRootSearchWrap\.hidden=total<10/.test(worldTreeChronicleBlock)
  &&/worldTreeRootsEmpty/.test(worldTreeChronicleBlock)
  &&(worldTreeChronicleBlock.match(/empty\.setAttribute\('role','listitem'\)/g)||[]).length===2
  &&/role="status" aria-live="polite"/.test(HTML),
  'Roots stays quiet when empty and only exposes an accessible search when the generated list is large');
ok((HTML.match(/worldTreeTitle:/g)||[]).length===2
  &&(HTML.match(/worldTreeRootsEmpty:/g)||[]).length===2
  &&(HTML.match(/worldTreeSapStale:/g)||[]).length===2,
  'Chronicle, Roots, and sap-flow states have Korean and English parity');
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
ok(buildingLodReadabilityBlock.length > 0
  && ['cabin','cottage','house','shop','tower','villa','manor','mansion'].every(kind=>buildingLodReadabilityBlock.includes(`'${kind}'`))
  && ['flat','gable','hip','mansard','barrel','shed','aframe','gambrel'].every(roof=>buildingLodReadabilityBlock.includes(`'${roof}'`)),
  'mid readability geometry covers every supported building kind and roof while unknown typologies retain the full fallback');
ok(/'yard-plot'/.test(buildingLodReadabilityBlock) && /'yard-hedge'/.test(buildingLodReadabilityBlock) && /'path-stone'/.test(buildingLodReadabilityBlock)
  && /const plotR=Math\.max\(1,spec\.yardRadius\?\?spec\.w\)/.test(buildingLodReadabilityBlock)
  && /'plinth'/.test(buildingLodReadabilityBlock) && /'door-panel'/.test(buildingLodReadabilityBlock) && /'door-lantern'/.test(buildingLodReadabilityBlock)
  && /'facade-cornice'/.test(buildingLodReadabilityBlock) && /'facade-belt-course'/.test(buildingLodReadabilityBlock) && /'facade-quoin'/.test(buildingLodReadabilityBlock)
  && /'window-frame'/.test(buildingLodReadabilityBlock) && /'window-sill'/.test(buildingLodReadabilityBlock) && /'window-shutter'/.test(buildingLodReadabilityBlock)
  && /'window-box'/.test(buildingLodReadabilityBlock) && /'window-box-bloom'/.test(buildingLodReadabilityBlock)
  && /'roof-gutter'/.test(buildingLodReadabilityBlock) && /'roof-downpipe'/.test(buildingLodReadabilityBlock)
  && /const pipeBottom=\.1,pipeTop=spec\.topH\+\.08,pipeH=pipeTop-pipeBottom,pipeY=\(pipeTop\+pipeBottom\)\*\.5/.test(buildingLodReadabilityBlock)
  && /entrance-\$\{spec\.kind\}-portico/.test(buildingLodReadabilityBlock)
  && /roof-\$\{spec\.roof\}-chimney/.test(buildingLodReadabilityBlock) && /'roof-flat-tech'/.test(buildingLodReadabilityBlock) && /'roof-aframe-ridge'/.test(buildingLodReadabilityBlock),
  'mid architectural geometry restores the parcel, lived-in facade depth, drainage, entrances, and roof cues in one draw');
ok(/geometry\.setIndex\(indices\)/.test(buildingLodReadabilityBlock)
  && /geometry\.userData=\{sources:\[\.\.\.sources\],kind:spec\.kind,roof:spec\.roof\}/.test(buildingLodReadabilityBlock)
  && !/Math\.random/.test(buildingLodReadabilityBlock), 'mid readability is compact indexed vertex-color geometry with deterministic feature diagnostics');
if(buildingLodReadabilitySource){
  class LodMockGeometry { constructor(){ this.attributes={}; this.userData={}; } setIndex(a){ this.index={array:Uint16Array.from(a),count:a.length}; } setAttribute(n,a){ this.attributes[n]=a; } computeBoundingBox(){} computeBoundingSphere(){} }
  class LodMockAttribute { constructor(a,itemSize){ this.array=Float32Array.from(a); this.itemSize=itemSize; this.count=a.length/itemSize; } }
  class LodMockColor { constructor(v){ const n=Number(v)>>>0; this.r=((n>>>16)&255)/255; this.g=((n>>>8)&255)/255; this.b=(n&255)/255; } }
  const buildReadability=new Function('THREE',`${buildingLodReadabilitySource}; return _buildingLodReadabilityGeometry;`)({BufferGeometry:LodMockGeometry,Float32BufferAttribute:LodMockAttribute,Color:LodMockColor});
  const kinds=['cabin','cottage','house','shop','tower','villa','manor','mansion'],roofs=['flat','gable','hip','mansard','barrel','shed','aframe','gambrel'],tier={cabin:0,cottage:1,house:2,shop:2,tower:3,villa:3,manor:4,mansion:5};
  let covered=0,maxBytes=0,deterministic=true,features=true;
  for(const kind of kinds) for(const roof of roofs){ const shop=kind==='shop',spec={kind,roof,tier:tier[kind],w:8,h:8,d:8,topH:shop?10:8,topW:shop?5:8,wall:0xd9b77e,roofColor:0xa8563b,accent:0x7290b8,entranceColor:0xc89043,
      yardRadius:9.4,yardColor:0x86c069,hedgeColor:0x5d9e46,rich:.78,fancy:.66,flags:3,stars:2};
    const a=buildReadability({_lodSpec:spec}),b=buildReadability({_lodSpec:spec}),src=a.userData.sources,entrance=kind==='cabin'||kind==='cottage'?'entrance-cottage-awning':`entrance-${kind}-${kind==='house'?'porch':kind==='shop'?'awning':kind==='tower'?'hood':kind==='villa'?'balcony':'portico'}`;
    const roofCue=roof==='flat'?'roof-flat-tech':roof==='aframe'?'roof-aframe-ridge':`roof-${roof}-chimney`,bytes=a.index.array.byteLength+a.attributes.position.array.byteLength+a.attributes.color.array.byteLength;
    const common=['yard-plot','yard-hedge','path-stone','plinth','door','door-panel','door-lantern','facade-cornice','window-frame','window-sill',entrance,roofCue,'metric-star','metric-banner','garden-bed'];
    features&&=common.every(name=>src.includes(name))&&(tier[kind]<2||src.includes('facade-quoin'))&&(tier[kind]<3||(src.includes('window-box')&&src.includes('window-box-bloom')))
      &&a.attributes.position.count===a.attributes.color.count&&!a.attributes.normal&&Array.from(a.attributes.position.array).every(Number.isFinite);
    deterministic&&=JSON.stringify(src)===JSON.stringify(b.userData.sources)&&Buffer.from(a.index.array.buffer).equals(Buffer.from(b.index.array.buffer))&&Buffer.from(a.attributes.position.array.buffer).equals(Buffer.from(b.attributes.position.array.buffer))&&Buffer.from(a.attributes.color.array.buffer).equals(Buffer.from(b.attributes.color.array.buffer));
    maxBytes=Math.max(maxBytes,bytes); covered++;
  }
  ok(covered===64&&features&&maxBytes<=48000, 'all 64 supported kind/roof combinations build finite compact one-draw architecture under the per-house byte ceiling');
  ok(deterministic, 'all supported mid readability combinations are byte-deterministic');
}
ok(/function _withBuildingLodPrivateRandom\(fn\)/.test(buildingLodPrototypeBlock)
  && /finally \{ Math\.random=globalRandom; \}/.test(buildingLodPrototypeBlock)
  && /memoryBudget:5\*1024\*1024/.test(buildingLodPrototypeBlock)
  && /proxy-memory-budget-exceeded/.test(buildingLodPrototypeBlock), '2C-A constructors consume private RNG and enforce a five-megabyte proxy budget for full 100-repository towns');
ok(/fullEnter:280,fullLeave:240,midEnter:\(LOW_END\|\|IS_MOBILE\)\?60:48,midLeave:\(LOW_END\|\|IS_MOBILE\)\?48:36,settle:3,cadence:8,minDwellFrames:24/.test(buildingLodPrototypeBlock)
  && /detailScale:\(LOW_END\|\|IS_MOBILE\)\?1:\(repo\._lodSpec\.tier>=4\?\.82:repo\._lodSpec\.tier===3\?\.92:1\)/.test(buildingLodPrototypeBlock)
  && /const fullEnter=th\.fullEnter\*entry\.detailScale,fullLeave=th\.fullLeave\*entry\.detailScale/.test(buildingLodPrototypeBlock)
  && /entry\.pendingCount>=BUILDING_LOD_PROTO\.thresholds\.settle/.test(buildingLodUpdateBlock)
  && !/(?:traverse|Box3|new THREE|sort\()/.test(buildingLodUpdateBlock), 'desktop grand homes retain detail longer while LOW_END and the allocation-free hysteresis path stay bounded');
ok(/const functional=new THREE\.Group\(\),full=new THREE\.Group\(\),mid=new THREE\.Group\(\),far=new THREE\.Group\(\),active=new THREE\.Group\(\)/.test(buildingLodPrototypeBlock)
  && /repo\._lodPrototype=entry/.test(buildingLodPrototypeBlock)
  && /repo\._body=body/.test(HTML) && /repo\._windows=\[\]/.test(HTML) && /repo\._group=g; repo\._pos=/.test(HTML), '2C-A preserves stable functional and action references under the existing repository root');
ok(/attribute float aLit; attribute float aJitter; attribute float aActivity/.test(buildingLodPrototypeBlock)
  && /geometry\.setAttribute\('uv',new THREE\.Float32BufferAttribute\(uvs,2\)\)/.test(buildingLodPrototypeBlock)
  && /varying vec2 vWindowUv/.test(buildingLodPrototypeBlock)
  && /float mullion=max\(vx,vy\)/.test(buildingLodPrototypeBlock)
  && /BUILDING_LOD_NIGHT\.value=night\?1:0/.test(HTML)
  && /_syncBuildingLodFacade\(repo\)/.test(HTML)
  && /THREE\.UniformsUtils\.clone\(THREE\.UniformsLib\.fog\)/.test(buildingLodPrototypeBlock)
  && (buildingLodPrototypeBlock.match(/fog:true/g)||[]).length===2
  && /originalSign:repo\._sign/.test(buildingLodPrototypeBlock), 'one shared facade shader preserves live day/night panes, reflected glass, cross mullions, and exact sign/emblem textures');
ok(/varying vec3 vViewPos/.test(buildingLodPrototypeBlock)
  && /cross\(dFdx\(vViewPos\),dFdy\(vViewPos\)\)/.test(buildingLodPrototypeBlock)
  && /extensions:\{derivatives:true\}/.test(buildingLodPrototypeBlock)
  && !/readabilityGeometry\.computeVertexNormals/.test(buildingLodPrototypeBlock), 'screen-space derivatives give compact boxes crisp face shading without a normal attribute');
ok(/const midReadability=new THREE\.Mesh\(readabilityGeometry,silhouetteMaterial\)/.test(buildingLodPrototypeBlock)
  && (buildingLodPrototypeBlock.match(/mid\.add\(midReadability\)/g)||[]).length===1
  && !/far\.add\(midReadability\)|full\.add\(midReadability\)/.test(buildingLodPrototypeBlock)
  && /window\.__buildingLodPrototypeReadabilityDelta=/.test(HTML),
  'mid readability reuses the shared fog/night material and adds at most one draw without changing full or far groups');
ok(/silhouetteGeometry=_buildingLodSilhouetteGeometry\(repo,false,false\),farVisualGeometry=_buildingLodSilhouetteGeometry\(repo,true,true\)/.test(buildingLodPrototypeBlock)
  && /resources\.geometries\.add\(farVisualGeometry\)/.test(buildingLodPrototypeBlock)
  && /new THREE\.Mesh\(farVisualGeometry,silhouetteMaterial\)/.test(buildingLodPrototypeBlock)
  && /new THREE\.Mesh\(silhouetteGeometry,shadowMaterial\)/.test(buildingLodPrototypeBlock)
  && /function _buildingLodSilhouetteGeometry\(repo,withParcel=false,withColor=true\)/.test(buildingLodPrototypeBlock)
  && /if\(withColor\) geometry\.setAttribute\('color'/.test(buildingLodPrototypeBlock)
  && !/geometry\.setAttribute\('normal',new THREE\.Float32BufferAttribute\(normals,3\)\)/.test(buildingLodPrototypeBlock)
  && /if\(withParcel\)[\s\S]*?'yard-plot'[\s\S]*?'yard-hedge'/.test(buildingLodPrototypeBlock)
  && (buildingLodPrototypeBlock.match(/const plotR=Math\.max\(1,spec\.yardRadius\?\?spec\.w\)/g)||[]).length===2
  && /CylinderGeometry\(plotR,plotR,\.03,12\)[\s\S]*?makeTranslation\(0,\.015,0\)/.test(buildingLodPrototypeBlock)
  && /facadeGeometry,readabilityGeometry,silhouetteGeometry,farVisualGeometry/.test(buildingLodPrototypeBlock)
  && /readability:\{bytes:_buildingLodGeometryBytes\(e\.readabilityGeometry\),sources:e\.readabilityGeometry\.userData\.sources\.slice\(\)\}/.test(HTML)
  && /parcel:\{radius:e\.repo\._lodSpec\.yardRadius,ringOuter:e\.repo\._ring\.geometry\.parameters\.outerRadius,glowRadius:e\.repo\._glowPool\.geometry\.parameters\.radius\}/.test(HTML)
  && /farVisual:\{bytes:_buildingLodGeometryBytes\(e\.farVisualGeometry\),sources:e\.farVisualGeometry\.userData\.sources\.slice\(\)\},shadowSources:e\.silhouetteGeometry\.userData\.sources\.slice\(\)/.test(HTML)
  && /capacityAtBudget:Math\.floor\(BUILDING_LOD_PROTO\.memoryBudget\/perEntryBytes\)/.test(HTML)
  && /resources\?\.geometries\.forEach\(geometry=>geometry\.dispose\(\)\)/.test(buildingLodPrototypeBlock),
  'far parcel visuals stay separate from slim shadow proxies; all architecture bytes share one owned disposal budget');
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
ok(/gain=MEMORIAL_TREE\.growth\.energyGain/.test(memorialTreeBlock)
  && /if\(isNight\)\{ m\.bark\.emissive\.setHex\(0x4f240c\); m\.bark\.emissiveIntensity=0\.14; m\.ornamentEnergy\.emissiveIntensity=\(1\.9\+Math\.sin\(elapsed\*2\.3\)\*0\.08\)\*gain; m\.amberLeaf\.emissiveIntensity=0\.58\*gain; m\.cyanLeaf\.emissiveIntensity=0\.78\*gain/.test(memorialTreeBlock)
  && /if\(REDUCED\)\{ m\.energy\.emissiveIntensity=1\.3\*gain; MEMORIAL_TREE\.light\.intensity=18/.test(memorialTreeBlock)
  && /else \{ m\.bark\.emissive\.setHex\(0x603016\)/.test(memorialTreeBlock)
  && /m\.energy\.emissiveIntensity=0\.28\*gain; m\.ornamentEnergy\.emissiveIntensity=0\.36\*gain; m\.amberLeaf\.emissiveIntensity=0\.28\*gain; m\.cyanLeaf\.emissiveIntensity=0\.34\*gain/.test(memorialTreeBlock)
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
  && /const CAMERA_FOCUS=new THREE\.Vector3\(\), CAMERA_RESOLVED_TARGET=new THREE\.Vector3\(\)/.test(HTML)
  && /CAMERA_FOLLOW_TARGET\.set\(/.test(clearSightBlock)
  && /camera\.position\.lerp\(CAMERA_RESOLVED_TARGET,0\.12\)/.test(clearSightUpdate)
  && !/camera\.position\.lerp\(new THREE\.Vector3/.test(HTML), 'camera follow reuses fixed focus, desired, and resolved vectors per frame');
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
