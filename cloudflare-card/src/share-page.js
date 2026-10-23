/* cloudflare-card/src/share-page.js — the HTML a shared /u/<login> link answers with.
 *
 * Link previews read Open Graph tags without running scripts, and after a redirect they would read the town's fixed
 * tags, so the Worker answers 200 with the card's own tags and sends people on with a meta refresh and
 * location.replace. Every value is HTML-escaped; the page holds the login and public card facts, nothing else.
 */

export const SITE_URL_DEFAULT = 'https://hyeonsangjeon.github.io/Repolis/';

/* The town's own preview (the og: tags in index.html), shown whenever a card cannot be. */
export const SITE_PREVIEW = Object.freeze({
  title: 'Repolis — the City of Repos',
  description: 'Public GitHub repos become a walkable 3D town. Traffic shapes the buildings, residents live there, and Gitber drives you to the right project.',
  image: 'assets/social-preview.png',
  width: 1280,
  height: 640,
  alt: 'Repolis — a living 3D town where public GitHub repos become traffic-shaped buildings and Gitber drives visitors to the right project.',
});

const COPY = Object.freeze({
  en: Object.freeze({
    locale: 'en_US',
    description: stats => `${stats} — walk this town of public GitHub repositories in Repolis.`,
    going: name => `Opening ${name} in Repolis…`,
    go: 'Go to the town',
    missing: 'This page is not part of Repolis.',
    home: 'Open Repolis',
  }),
  ko: Object.freeze({
    locale: 'ko_KR',
    description: stats => `${stats} — Repolis에서 이 공개 레포 마을을 걸어 보세요.`,
    going: name => `${name} — 마을로 이동하는 중…`,
    go: '마을로 가기',
    missing: 'Repolis에 없는 페이지예요.',
    home: 'Repolis 열기',
  }),
});

export function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* The configured site as an absolute http(s) URL ending in '/', without query or fragment. */
export function siteUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      url.search = '';
      url.hash = '';
      if (!url.pathname.endsWith('/')) url.pathname += '/';
      return url.href;
    }
  } catch (error) { /* fall through */ }
  return SITE_URL_DEFAULT;
}

/* Where a person following the link lands: the town for this login, marked as arriving from a card. */
export function townUrl(site, login) {
  const url = new URL(siteUrl(site));
  url.searchParams.set('user', login);
  url.searchParams.set('ref', 'card');
  return url.href;
}

const STYLE = 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1b29;color:#fff6e3;'
  + 'font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}a{color:#f2b84b}main{padding:24px;text-align:center}';

function meta(attribute, key, value) {
  return `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}">`;
}

function previewTags({ title, description, url, image, width, height, alt, locale }) {
  return [
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Repolis'),
    meta('property', 'og:locale', locale),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    url ? meta('property', 'og:url', url) : '',
    meta('property', 'og:image', image),
    meta('property', 'og:image:width', String(width)),
    meta('property', 'og:image:height', String(height)),
    meta('property', 'og:image:alt', alt),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', alt),
  ].join('');
}

function plainPreview(site, locale) {
  return { ...SITE_PREVIEW, image: new URL(SITE_PREVIEW.image, siteUrl(site)).href, locale };
}

/* The /u/<login> page. `card` is { name, stats, image } for a town with a card, or null for the plain preview. */
export function sharePage({ origin, login, lang = 'en', site, card = null }) {
  const copy = COPY[lang] || COPY.en;
  const target = townUrl(site, login);
  const pageUrl = `${origin}/u/${encodeURIComponent(login)}${lang === 'ko' ? '?lang=ko' : ''}`;
  const preview = card
    ? { title: card.name, description: copy.description(card.stats), image: card.image, width: 1200, height: 630,
      alt: `${card.name} — ${card.stats}`, locale: copy.locale }
    : plainPreview(site, copy.locale);
  const name = card ? card.name : 'Repolis';
  // JSON keeps the string a JS literal; '<' is escaped so the value can never close the script element.
  const script = JSON.stringify(target).replace(/</g, '\\x3c');
  return '<!doctype html>'
    + `<html lang="${lang === 'ko' ? 'ko' : 'en'}"><head><meta charset="utf-8">`
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + `<title>${escapeHtml(card ? `${card.name} · Repolis` : preview.title)}</title>`
    + meta('name', 'description', preview.description)
    + `<link rel="canonical" href="${escapeHtml(pageUrl)}">`
    + previewTags({ ...preview, url: pageUrl })
    + `<meta http-equiv="refresh" content="${escapeHtml(`0; url=${target}`)}">`
    + `<style>${STYLE}</style></head>`
    + `<body><main><p>${escapeHtml(copy.going(name))}</p><p><a href="${escapeHtml(target)}">${escapeHtml(copy.go)}</a></p></main>`
    + `<script>location.replace(${script})</script></body></html>`;
}

/* The 404 page for an invalid login or an unknown path: the plain preview and a link to the town. */
export function notFoundPage({ site, lang = 'en' }) {
  const copy = COPY[lang] || COPY.en;
  const home = siteUrl(site);
  return '<!doctype html>'
    + `<html lang="${lang === 'ko' ? 'ko' : 'en'}"><head><meta charset="utf-8">`
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
    + `<title>${escapeHtml(SITE_PREVIEW.title)}</title>`
    + meta('name', 'description', SITE_PREVIEW.description)
    + previewTags({ ...plainPreview(site, copy.locale), url: home })
    + `<style>${STYLE}</style></head>`
    + `<body><main><p>${escapeHtml(copy.missing)}</p><p><a href="${escapeHtml(home)}">${escapeHtml(copy.home)}</a></p></main></body></html>`;
}
