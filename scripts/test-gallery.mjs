/* Hermetic fixtures for the city gallery: assets/gallery.js, data/gallery.json, gallery.html and its issue templates.
 * No network, clock, storage or random source: the page's static copy and the consent list are read from disk. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GALLERY_COPY, GALLERY_LIMITS, GALLERY_SCHEMA, GALLERY_VERSION, galleryLang, galleryRemovalRequestUrl, galleryText,
  galleryTownLinks, parseGalleryLogin, validateGallery,
} from '../assets/gallery.js';

let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const SRC = read('assets/gallery.js');
const PAGE = read('gallery.html');
const LIST = JSON.parse(read('data/gallery.json'));
const JOIN = read('.github/ISSUE_TEMPLATE/gallery-join.md');
const REMOVAL = read('.github/ISSUE_TEMPLATE/gallery-removal.md');

const PROJECT = 'https://github.com/hyeonsangjeon/Repolis';
const PAGES = 'https://hyeonsangjeon.github.io/Repolis/';
const CARD = 'https://repolis-card.wingnut0310.workers.dev/';
const OWNERS = ['hyeonsangjeon'];
const list = (...towns) => ({ schema: GALLERY_SCHEMA, version: GALLERY_VERSION, towns });

check(!/\bwindow\b|\bdocument\b|fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|Date\.now|new Date|Math\.random|navigator\./.test(SRC),
  'the gallery rules never read the DOM, network, storage, wall clock, random source or navigator');
check(Object.isFrozen(GALLERY_LIMITS) && GALLERY_LIMITS.maxTowns === 48 && GALLERY_SCHEMA === 'repolis.gallery' && GALLERY_VERSION === 1,
  'the published list is schema repolis.gallery v1 with at most 48 towns');

/* ---- the shipped consent list ---- */
const shipped = validateGallery(LIST, { owners: OWNERS, projectUrl: PROJECT });
check(shipped.ok && shipped.errors.length === 0, `data/gallery.json is valid (${shipped.errors.join(', ')})`);
check(shipped.towns[0].login === 'hyeonsangjeon' && shipped.towns[0].kind === 'owner', 'the first town is the Repolis author’s own');
check(shipped.towns.every(town => town.kind === 'owner' || /^https:\/\/github\.com\/hyeonsangjeon\/Repolis\/issues\/\d+$/.test(town.consent)),
  'every other listed town points at the opt-in issue that account opened');
check(Object.isFrozen(shipped) && Object.isFrozen(shipped.towns) && shipped.towns.every(Object.isFrozen), 'validation hands back frozen towns');

/* ---- validation fixtures ---- */
const consented = { login: 'octocat', consent: `${PROJECT}/issues/321` };
const owner = { login: 'hyeonsangjeon', consent: 'owner' };
check(validateGallery(list(owner, consented), { owners: OWNERS, projectUrl: PROJECT }).towns.map(town => town.kind).join() === 'owner,consented',
  'the owner and an opt-in issue are both accepted');
const reject = (raw, reason, message) => {
  const result = validateGallery(raw, { owners: OWNERS, projectUrl: PROJECT });
  check(!result.ok && result.errors.some(error => error.includes(reason)), message);
  return result;
};
reject(null, 'not-an-object', 'a missing list is rejected');
reject({ ...list(owner), schema: 'repolis.other' }, 'schema', 'another schema is rejected');
reject({ ...list(owner), version: 2 }, 'version', 'another version is rejected');
reject({ ...list(owner), note: 'x' }, 'top-level-keys', 'unknown top-level fields are rejected');
reject(list(), 'towns', 'an empty list is rejected');
reject(list(owner, { ...consented, avatar: 'https://example.com/a.png' }), 'keys', 'towns carry only login and consent');
reject(list(owner, { login: '-bad', consent: `${PROJECT}/issues/2` }), 'login', 'an invalid GitHub login is rejected');
const duplicate = reject(list(owner, consented, { login: 'OctoCat', consent: `${PROJECT}/issues/9` }), 'duplicate', 'a case-insensitive duplicate is rejected');
check(duplicate.towns.length === 2, 'the valid towns before a rejected entry still render');
reject(list(owner, { login: 'octocat', consent: 'owner' }), 'consent', '"owner" consent belongs to the site owner only');
reject(list(owner, { login: 'octocat', consent: 'https://github.com/someone/else/issues/3' }), 'consent', 'consent from another repository is rejected');
reject(list(owner, { login: 'octocat', consent: `${PROJECT}/pull/3` }), 'consent', 'a pull request is not an opt-in issue');
reject(list(owner, { login: 'octocat', consent: '' }), 'consent', 'a town without consent is rejected');
const crowd = Array.from({ length: GALLERY_LIMITS.maxTowns + 2 }, (_, index) => ({ login: `user${index}`, consent: `${PROJECT}/issues/${index + 1}` }));
const capped = reject(list(...crowd), 'too-many-towns', 'more than 48 towns is rejected');
check(capped.towns.length === GALLERY_LIMITS.maxTowns, 'and only the first 48 could ever render');
check(validateGallery(list({ login: 'forkowner', consent: 'owner' }), { owners: ['hyeonsangjeon', 'ForkOwner'], projectUrl: PROJECT }).ok,
  'a fork’s own town owner may list itself as "owner"');

/* ---- links ---- */
const live = galleryTownLinks('OctoCat', { pagesBase: `${PAGES}gallery.html?lang=ko#x`, cardBase: CARD, projectUrl: PROJECT });
check(live.login === 'octocat' && live.walkUrl === `${PAGES}?user=octocat&ref=gallery`, 'walking opens ?user=<login>&ref=gallery from the site root');
check(live.shareUrl === `${CARD}u/octocat` && live.cardSvg === `${CARD}card/octocat.svg`, 'the canonical site shares /u/<login> and shows the README card');
check(live.readmeHtml === `<a href="${PAGES}?user=octocat&ref=profile-readme"><img src="${CARD}card/octocat.svg" alt="Walk @octocat's GitHub town in Repolis" width="600"></a>`,
  'the README card is the same portal the town’s own “Put this town on my GitHub profile” copies');
check(live.joinUrl === `${PROJECT}/issues/new?template=gallery-join.md&title=Gallery%3A+add+%40octocat`
  && live.removalUrl === `${PROJECT}/issues/new?template=gallery-removal.md&title=Gallery%3A+remove+%40octocat`,
  'join and removal open the matching issue templates with the login in the title');
check(galleryTownLinks('octocat', { pagesBase: PAGES, cardBase: CARD, lang: 'ko' }).cardSvg === `${CARD}card/octocat.svg?lang=ko`,
  'the Korean page asks for the Korean card');
const fork = galleryTownLinks('octocat', { pagesBase: 'https://forkowner.github.io/Repolis/gallery.html', cardBase: '', projectUrl: PROJECT });
check(fork.cardSvg === '' && fork.shareUrl === 'https://forkowner.github.io/Repolis/?user=octocat&ref=gallery'
  && fork.readmeHtml.includes('https://forkowner.github.io/Repolis/assets/banner.svg'), 'without a card service the links stay on the site and draw no card');
check(galleryTownLinks('octocat', { cardBase: 'http://insecure.example/' }).cardSvg === '', 'a non-https card service is ignored');
check(galleryTownLinks('octocat', { projectUrl: 'https://evil.example/x/y' }).joinUrl.startsWith(`${PROJECT}/issues/new?`),
  'issue links never leave GitHub');
check(galleryRemovalRequestUrl(PROJECT) === `${PROJECT}/issues/new?template=gallery-removal.md&title=Gallery%3A+remove+%40`,
  'the disclaimer’s removal link needs no login');
assert.throws(() => galleryTownLinks('bad login', { pagesBase: PAGES }), /invalid-github-login/); checks++;

/* ---- the maker's input ---- */
const parsed = value => parseGalleryLogin(value);
check(parsed('octocat').ok && parsed('octocat').login === 'octocat' && !parsed('octocat').fromRepo, 'a login makes that city');
check(parsed('@OctoCat').login === 'octocat' && parsed('github.com/octocat').login === 'octocat'
  && parsed('https://github.com/octocat').login === 'octocat', 'an @login or a profile URL makes that city');
check(parsed('octocat/Hello-World').fromRepo && parsed('https://github.com/octocat/Hello-World').login === 'octocat',
  'a repository or its URL makes the owner’s city');
check(['', '   ', 'two words', 'https://example.com/octocat', 'octo?cat', '../octocat', null].every(value => !parsed(value).ok),
  'empty, spaced, foreign-host, query and traversal inputs are refused');

/* ---- language and copy ---- */
check(galleryLang('?lang=ko', 'en-US') === 'ko' && galleryLang('?lang=en', 'ko-KR') === 'en' && galleryLang('', 'ko-KR') === 'ko'
  && galleryLang('?lang=fr', 'de') === 'en', '?lang= wins, then a Korean browser, then English');
const enKeys = Object.keys(GALLERY_COPY.en).sort();
check(enKeys.join() === Object.keys(GALLERY_COPY.ko).sort().join() && enKeys.every(key => GALLERY_COPY.en[key] && GALLERY_COPY.ko[key]),
  'Korean and English carry the same non-empty copy keys');
check(GALLERY_COPY.ko.disclaimer === '공개 GitHub 메타데이터만 사용 · 제휴·추천 아님 · 본인 요청 시 제외'
  && GALLERY_COPY.en.disclaimer === 'Public GitHub metadata only · Not an endorsement or affiliation · Removed on request',
  'the page states the agreed disclaimer line in both languages');
check(galleryText('ko', 'fromRepo', { login: 'octocat' }) === '레포 주인 @octocat의 도시를 보여 줍니다.' && galleryText('xx', 'walk') === 'Walk this city',
  'copy fills {login} and falls back to English');
assert.throws(() => galleryText('en', 'nope'), /unknown gallery copy key/); checks++;

/* ---- the static page ---- */
const staticCopy = [...PAGE.matchAll(/data-t="(\w+)">([^<]*)</g)];
check(staticCopy.length >= 15 && staticCopy.every(([, key, text]) => GALLERY_COPY.en[key] === text),
  'every pre-rendered English string matches the copy table, so the page reads the same before its script runs');
check(PAGE.includes(`<title>${GALLERY_COPY.en.title}</title>`) && PAGE.includes(`<meta name="description" content="${GALLERY_COPY.en.description}" />`),
  'title and description come from the same copy');
check(PAGE.indexOf('<script src="repolis.config.js"></script>') > 0 && PAGE.indexOf('<script src="repolis.config.js"></script>') < PAGE.indexOf('<script type="module">')
  && PAGE.includes("from './assets/gallery.js?v=gallery-v1'"), 'the page reads the fork-aware config before importing the rules');
check(PAGE.includes("fetch('data/gallery.json'") && (PAGE.match(/fetch\(/g) || []).length === 1, 'the page makes exactly one data request: the consent list');
check(!/sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|services\.analytics|track\(/.test(PAGE), 'the page sends no telemetry and stores nothing');
check(PAGE.includes('template=gallery-removal.md') && PAGE.includes('rel="noopener"'), 'the removal path is on the page before any script runs');
check(!/innerHTML|insertAdjacentHTML|document\.write/.test(PAGE), 'logins reach the page only through textContent and attributes');

/* ---- consent and removal templates ---- */
check(/^---\nname: Add my town to the city gallery\n[\s\S]*?\ntitle: "Gallery: add @"\n---/.test(JOIN) && /consent/.test(JOIN) && /not an endorsement/.test(JOIN),
  'the join template records consent from the account itself and repeats the disclaimer');
check(/^---\nname: Remove my town from the city gallery\n[\s\S]*?\ntitle: "Gallery: remove @"\n---/.test(REMOVAL) && /no reason is needed/.test(REMOVAL),
  'the removal template needs no reason');

console.log(`Gallery: ${checks} rule, consent-list, page and template checks passed`);
