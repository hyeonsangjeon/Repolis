// Pure rules for gallery.html: the hand-written consent list in data/gallery.json, each town's links, and the page copy.
// No network, storage, clock or telemetry here; the page fetches the list once and only renders what this accepts.
import { GITHUB_LOGIN_RE, parseRepoPortalInput } from './repo-portal.js';
import { createCardShareUrl, createTownReadmePortal } from './town-postcard.js';

export const GALLERY_SCHEMA = 'repolis.gallery';
export const GALLERY_VERSION = 1;
export const GALLERY_LIMITS = Object.freeze({ maxTowns: 48 });

const TOWN_KEYS = Object.freeze(['consent', 'login']);
const DEFAULT_PAGES_BASE = 'https://hyeonsangjeon.github.io/Repolis/';
const DEFAULT_PROJECT_URL = 'https://github.com/hyeonsangjeon/Repolis';

function lowerLogin(value) {
  return String(value || '').trim().toLowerCase();
}

function projectRoot(projectUrl) {
  let url;
  try { url = new URL(String(projectUrl || DEFAULT_PROJECT_URL)); }
  catch (error) { url = new URL(DEFAULT_PROJECT_URL); }
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || parts.length !== 2) url = new URL(DEFAULT_PROJECT_URL);
  return `https://github.com/${url.pathname.split('/').filter(Boolean).join('/')}`;
}

// Consent is either the site owner's own listing or the opt-in issue that account opened on this repository.
function consentIssueRe(projectUrl) {
  const root = projectRoot(projectUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${root}/issues/[1-9][0-9]{0,6}$`);
}

export function validateGallery(raw, { owners = [], projectUrl = DEFAULT_PROJECT_URL } = {}) {
  const errors = [];
  const towns = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Object.freeze({ ok: false, towns: Object.freeze([]), errors: Object.freeze(['not-an-object']) });
  if (raw.schema !== GALLERY_SCHEMA) errors.push('schema');
  if (raw.version !== GALLERY_VERSION) errors.push('version');
  const keys = Object.keys(raw).sort().join(',');
  if (keys !== 'schema,towns,version') errors.push('top-level-keys');
  const list = Array.isArray(raw.towns) ? raw.towns : [];
  if (!Array.isArray(raw.towns) || list.length === 0) errors.push('towns');
  if (list.length > GALLERY_LIMITS.maxTowns) errors.push('too-many-towns');

  const ownerSet = new Set(owners.map(lowerLogin).filter(login => GITHUB_LOGIN_RE.test(login)));
  const issueRe = consentIssueRe(projectUrl);
  const seen = new Set();
  list.slice(0, GALLERY_LIMITS.maxTowns).forEach((entry, index) => {
    const where = `towns[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { errors.push(`${where}:shape`); return; }
    if (Object.keys(entry).sort().join(',') !== TOWN_KEYS.join(',')) { errors.push(`${where}:keys`); return; }
    const login = typeof entry.login === 'string' ? entry.login : '';
    const id = login.toLowerCase();
    if (!GITHUB_LOGIN_RE.test(login)) { errors.push(`${where}:login`); return; }
    if (seen.has(id)) { errors.push(`${where}:duplicate`); return; }
    const owner = entry.consent === 'owner';
    if (owner ? !ownerSet.has(id) : !(typeof entry.consent === 'string' && issueRe.test(entry.consent))) {
      errors.push(`${where}:consent`); return;
    }
    seen.add(id);
    towns.push(Object.freeze({ login, consent: entry.consent, kind: owner ? 'owner' : 'consented' }));
  });
  return Object.freeze({ ok: errors.length === 0, towns: Object.freeze(towns), errors: Object.freeze(errors) });
}

function pagesRoot(pagesBase) {
  let root;
  try { root = new URL(String(pagesBase || DEFAULT_PAGES_BASE)); }
  catch (error) { root = new URL(DEFAULT_PAGES_BASE); }
  if (!/^https?:$/.test(root.protocol)) root = new URL(DEFAULT_PAGES_BASE);
  root.search = '';
  root.hash = '';
  root.pathname = root.pathname.replace(/[^/]*$/, '');
  return root;
}

function issueUrl(projectUrl, template, title) {
  const url = new URL(`${projectRoot(projectUrl)}/issues/new`);
  url.searchParams.set('template', template);
  url.searchParams.set('title', title);
  return url.href;
}

// The disclaimer's removal path, before any login is known.
export function galleryRemovalRequestUrl(projectUrl = DEFAULT_PROJECT_URL) {
  return issueUrl(projectUrl, 'gallery-removal.md', 'Gallery: remove @');
}

// Every link a gallery tile or the maker shows. cardBase is services.card: empty on forks and locally, so cards fall back to text.
export function galleryTownLinks(login, { pagesBase = DEFAULT_PAGES_BASE, cardBase = '', projectUrl = DEFAULT_PROJECT_URL, lang = 'en' } = {}) {
  const id = lowerLogin(login);
  if (!GITHUB_LOGIN_RE.test(id)) throw new TypeError('invalid-github-login');
  const root = pagesRoot(pagesBase);
  const walk = new URL(root.href);
  walk.searchParams.set('user', id);
  walk.searchParams.set('ref', 'gallery');
  const cardShare = createCardShareUrl(id, cardBase);
  const portal = createTownReadmePortal(id, root.href, cardBase);
  const cardSvg = portal.live ? portal.bannerUrl + (lang === 'ko' ? '?lang=ko' : '') : '';
  return Object.freeze({
    login: id,
    walkUrl: walk.href,
    shareUrl: cardShare || walk.href,
    cardSvg,
    readmeHtml: portal.html,
    joinUrl: issueUrl(projectUrl, 'gallery-join.md', `Gallery: add @${id}`),
    removalUrl: issueUrl(projectUrl, 'gallery-removal.md', `Gallery: remove @${id}`),
  });
}

// The maker accepts what the town's launchpad accepts; a repository or repository URL makes its owner's city.
export function parseGalleryLogin(value) {
  const parsed = parseRepoPortalInput(typeof value === 'string' ? value : '');
  if (!parsed || parsed.ok !== true) return Object.freeze({ ok: false, reason: (parsed && parsed.reason) || 'empty' });
  const login = lowerLogin(parsed.kind === 'repo' ? parsed.owner : parsed.user);
  if (!GITHUB_LOGIN_RE.test(login)) return Object.freeze({ ok: false, reason: 'shape' });
  return Object.freeze({ ok: true, login, fromRepo: parsed.kind === 'repo' });
}

export function galleryLang(search = '', navigatorLanguage = '') {
  const requested = new URLSearchParams(String(search || '')).get('lang');
  if (requested === 'ko' || requested === 'en') return requested;
  return /^ko\b/i.test(String(navigatorLanguage || '')) ? 'ko' : 'en';
}

export const GALLERY_COPY = Object.freeze({
  en: Object.freeze({
    title: 'Repolis city gallery',
    description: 'GitHub towns as city cards. Type a GitHub login to make yours, walk it in 3D, and put it on your profile.',
    heading: 'Your GitHub, as a city',
    lead: 'Type a GitHub login. Its public repos become a city card you can walk in 3D and pin to a profile README.',
    disclaimer: 'Public GitHub metadata only · Not an endorsement or affiliation · Removed on request',
    removalLink: 'Ask for removal',
    inputLabel: 'GitHub login, owner/repo, or repository URL',
    inputPlaceholder: 'octocat',
    makeButton: 'Show my city',
    invalid: 'Enter a GitHub login such as octocat, or an owner/repo.',
    fromRepo: 'Showing the city of the repository owner, @{login}.',
    cardAlt: 'City card of @{login}, built from public GitHub metadata',
    cardLoading: 'Drawing the card…',
    cardUnavailable: 'The card image is not available here. The town itself still opens.',
    noCardService: 'Card images are drawn by the canonical site only. The town itself still opens.',
    walk: 'Walk this city',
    copyShare: 'Copy share link',
    copyReadme: 'Copy README card',
    join: 'Ask to join the gallery',
    joinNote: 'Joining opens a GitHub issue from your account; that issue is your consent.',
    copied: 'Copied.',
    copyFailed: 'Copy failed. Select the text below instead.',
    galleryHeading: 'Cities in the gallery',
    galleryNote: 'Listed with each account’s consent. The first town belongs to the Repolis author.',
    galleryEmpty: 'No cities are listed here yet.',
    ownerBadge: 'Repolis author',
    backToTown: 'Back to Repolis',
    repository: 'GitHub repository',
    template: 'Use the template',
    langSwitch: '한국어',
  }),
  ko: Object.freeze({
    title: 'Repolis 도시 갤러리',
    description: 'GitHub 계정이 도시 카드가 됩니다. 아이디를 입력해 내 도시를 만들고, 3D로 걷고, 프로필에 붙여 보세요.',
    heading: '내 GitHub가 도시가 됩니다',
    lead: 'GitHub 아이디를 입력하세요. 공개 레포가 3D로 걸을 수 있는 도시 카드가 되고, 프로필 README에도 붙일 수 있습니다.',
    disclaimer: '공개 GitHub 메타데이터만 사용 · 제휴·추천 아님 · 본인 요청 시 제외',
    removalLink: '제외 요청',
    inputLabel: 'GitHub 아이디, owner/repo 또는 레포 주소',
    inputPlaceholder: 'octocat',
    makeButton: '내 도시 보기',
    invalid: 'octocat 같은 GitHub 아이디나 owner/repo를 입력하세요.',
    fromRepo: '레포 주인 @{login}의 도시를 보여 줍니다.',
    cardAlt: '공개 GitHub 메타데이터로 만든 @{login}의 도시 카드',
    cardLoading: '카드를 그리는 중…',
    cardUnavailable: '여기서는 카드 이미지를 불러오지 못했습니다. 마을은 그대로 열 수 있습니다.',
    noCardService: '카드 이미지는 공식 사이트에서만 그립니다. 마을은 그대로 열 수 있습니다.',
    walk: '이 도시 걷기',
    copyShare: '공유 링크 복사',
    copyReadme: 'README 카드 복사',
    join: '갤러리에 올려 달라고 요청',
    joinNote: '요청하면 내 계정으로 GitHub 이슈가 열립니다. 그 이슈가 동의 기록입니다.',
    copied: '복사했습니다.',
    copyFailed: '복사하지 못했습니다. 아래 글을 직접 선택해 주세요.',
    galleryHeading: '갤러리의 도시들',
    galleryNote: '각 계정의 동의를 받아 올립니다. 첫 도시는 Repolis 만든 사람의 도시입니다.',
    galleryEmpty: '아직 올라온 도시가 없습니다.',
    ownerBadge: 'Repolis 제작자',
    backToTown: 'Repolis로 돌아가기',
    repository: 'GitHub 저장소',
    template: '템플릿 쓰기',
    langSwitch: 'English',
  }),
});

export function galleryText(lang, key, values = {}) {
  const table = GALLERY_COPY[lang === 'ko' ? 'ko' : 'en'];
  const text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : GALLERY_COPY.en[key];
  if (typeof text !== 'string') throw new RangeError(`unknown gallery copy key: ${key}`);
  return text.replace(/\{(\w+)\}/g, (match, name) => (Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match));
}
