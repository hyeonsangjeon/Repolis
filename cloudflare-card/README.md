# Repolis city card — Cloudflare Worker `repolis-card`

A shared `?user=<login>` town should preview as **that person's city**, not as the site's fixed banner. Link previews
(Slack, Discord, X, KakaoTalk, LinkedIn, Facebook) read Open Graph tags without running scripts and read the town's
fixed tags after a redirect, so a share link has to answer with its own tags. This Worker does that and draws the
card image. The town itself never depends on it: if the Worker is down, only links that point at it lose their preview.

It is separate from the grounding Worker [`../cloudflare-taxi`](../cloudflare-taxi) (`repolis-taxi`) and the realtime
Worker [`../cloudflare`](../cloudflare) (`repolis-rt`). The canonical site points public-town share links and the
profile README card at it through `services.card` in `repolis.config.js`; forks keep Pages links and the self-hosted
banner.

## Routes

| Request | Answer |
|---|---|
| `GET /u/<login>` | `200` HTML. `og:title` is the city plaque name from `assets/homecoming.js` (`homecomingCityName`), `og:image` is the absolute `/card/<login>.png?d=YYYYMMDD` (UTC day), `twitter:card=summary_large_image`. People move on to `<SITE_URL>?user=<login>&ref=card` by `meta refresh` and `location.replace`. |
| `GET /card/<login>.png` | `200` 1200×630 PNG, `Cache-Control: public, max-age=86400, s-maxage=86400`, kept 24 h in the Cache API. The only query read is `d=`; a missing, malformed or out-of-range value (not yesterday, today or tomorrow in UTC) becomes today. |
| `GET /card/<login>.svg` | `200` 600×300 SVG for a GitHub profile README, `Cache-Control: max-age=86400`. Any failure answers `200` with `assets/banner.svg`. |
| invalid login, any other path | `404` HTML with the site's own preview (`assets/social-preview.png`). |

`lang=ko` on any of the three asks for the Korean card (`octo의 파이썬 연구소 도시`); English is the default. A login
must match the town's GitHub login rule (`GITHUB_LOGIN_RE` in `assets/repo-portal.js`). Only `GET` and `HEAD` are
answered.

**The minimum answer.** Whatever fails — GitHub, KV, the rate limit or the renderer — `/u/<login>` still answers `200`
with the site's preview and the move on to the town, the PNG route answers `200` with a pre-rendered plain card
(`src/generic-card.png`), and the SVG route answers `200` with `assets/banner.svg`. A platform outage of Cloudflare
itself is outside this guarantee.

## Data, privacy and limits

- **GitHub once a day per login.** The Worker asks the same page the town asks for:
  `GET https://api.github.com/users/<login>/repos?per_page=100&sort=pushed`. It projects it with the town's own
  functions (`projectPublicRepos`, the portable city state's reference day, `classifyRepoZone`) and keeps only the
  `summarizeCityCard` output from `assets/city-card.js`. KV stores that summary under `card:v1:<login, lowercased>` for
  24 h. An unknown login, a town with no public repository, or a GitHub error (any status but 200, a timeout after 8 s,
  more than 2 MiB, malformed JSON) stores the empty summary for 1 h and answers with the plain card. The raw GitHub
  response is never stored. A KV read failure answers with the plain card without asking GitHub.
- **Public data only.** The endpoint lists public repositories only, and the Worker also drops any row marked private.
  No e-mail address, avatar, follower count or profile field is read, drawn or stored.
- **Token.** With `GITHUB_TOKEN` set, the request carries it to `api.github.com` only (redirects are not followed).
  Without it, requests are anonymous (60 an hour per Cloudflare egress address — fine for `wrangler dev`, not for
  production). If GitHub answers `401` (an expired or revoked token), the Worker asks once more without it and logs
  `token-rejected`, so an expired token degrades to anonymous instead of breaking every new card.
- **Rate limit.** A *new render* — a login KV has not seen yet, or a PNG the cache does not hold — costs one unit of a
  per-address allowance of 30 a minute (`CARD_RATE_LIMIT`, keyed by `CF-Connecting-IP`). Past it, the request gets the
  plain card with `Cache-Control: no-store`. The binding was chosen over a KV or Durable Object counter because it needs
  no storage write and no network round trip; it counts per Cloudflare location and is eventually consistent, which is
  enough for a soft bound on GitHub requests and CPU. Without the binding (tests, a fork) an isolate-local fixed window
  applies the same limit.
- **Logs.** One line per request: `{"evt":"card","route":…,"result":…,"reason":…}` — never a login, an address or a
  URL. Persisted Workers Logs are turned off in `wrangler.toml` because invocation logs would record request URLs, and
  with them logins; watch the aggregate lines live with `npx wrangler tail`.
- **The Cache API does nothing on `*.workers.dev`.** Cloudflare only gives Workers a functional cache on a custom domain
  or route. Until one is attached, every PNG request is a render (and counts against the rate limit); the `max-age`
  still lets crawlers and browsers keep the image. KV keeps GitHub at one request per login a day either way.

## Measured CPU time (why the paid plan)

A PNG cache miss costs one glyph-path SVG build and one rasterization by `@resvg/resvg-wasm`. Measured on 2026-10-21
on an Apple M4 (macOS) with the locked dependencies; Cloudflare's servers will differ, so compare with the CPU time the
dashboard reports after the first deploy.

| What | CPU time |
|---|---|
| WebAssembly start, once per isolate (`npm run measure:cpu`) | 18–23 ms |
| One render request, Node (`npm run measure:cpu`, 40 runs each: 71 or 100 houses, English or Korean) | median 24–27 ms, p95 27–50 ms, max 59 ms |
| Rasterization alone, Node | median 23–27 ms, p95 27–40 ms |
| One render request in `wrangler dev` (workerd), wall time with local KV and cache | median 33 ms over 22 renders (20 within 31–37 ms, one 56 ms, the first 99 ms with the WebAssembly start) |

Workers Free allows 10 ms of CPU per request, so a render needs **Workers Paid** (30 s by default). The bundle is
2,787 KiB (1,078 KiB gzip), within both plans' size limits.

## Deploy (owner)

All names below are fixed by this repository; nothing here is account-specific except the KV id.

1. **Plan.** In the Cloudflare dashboard, switch the account to **Workers Paid** ($5/month): Workers & Pages → Plans.
2. **Install and sign in.**
   ```bash
   cd cloudflare-card
   npm ci
   npx wrangler login        # skip if this machine already deploys repolis-taxi
   ```
3. **KV namespace.** Create it, then replace `REPLACE_WITH_CARD_KV_ID` in `wrangler.toml` with the printed id and commit
   that one-line change (a KV id is not a secret):
   ```bash
   npx wrangler kv namespace create CARD_KV
   ```
4. **GitHub token.** github.com → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** →
   Generate new token: name `repolis-card`, expiration **90 days**, resource owner your account, repository access
   **Public repositories** (read-only), no additional permissions. Store it only as a Worker secret, and set a reminder
   to rotate it before it expires (repeat this step with a new token, then delete the old one on GitHub):
   ```bash
   npx wrangler secret put GITHUB_TOKEN
   ```
5. **Deploy.**
   ```bash
   npx wrangler deploy       # prints https://repolis-card.<your-subdomain>.workers.dev
   ```
6. **Check with curl** (replace the host):
   ```bash
   CARD=https://repolis-card.<your-subdomain>.workers.dev
   curl -s "$CARD/u/hyeonsangjeon" | grep -oE '<meta (property|name)="(og:title|og:image|twitter:card)"[^>]*>'
   curl -sI "$CARD/card/hyeonsangjeon.png?d=$(date -u +%Y%m%d)" | grep -iE '^HTTP|content-type|cache-control'
   curl -sI "$CARD/card/hyeonsangjeon.svg" | grep -iE '^HTTP|content-type|cache-control'
   curl -s -o /dev/null -w '%{http_code}\n' "$CARD/u/-not-a-login-"     # 404
   npx wrangler tail                                                    # aggregate log lines, no logins
   ```
   Expect `og:title` = `Python Lab City of hyeonsangjeon` (or the town's current plaque), `image/png` with
   `s-maxage=86400`, `image/svg+xml` with `max-age=86400`, and `404`. Then read the Worker's CPU time under
   Workers & Pages → `repolis-card` → Metrics.

## Local development

```bash
cd cloudflare-card
npm ci
npx wrangler dev           # http://localhost:8787/u/<login>, KV, cache and rate limit simulated locally
```

`wrangler dev` asks GitHub anonymously unless `cloudflare-card/.dev.vars` (gitignored) holds `GITHUB_TOKEN=…`.

| Test | Where | Needs |
|---|---|---|
| `node scripts/test-city-card-worker.mjs` (repository root, part of `scripts/check-hermetic.sh`) | routes, login rule, `d=` normalization, HTML/OG escaping, KV and cache keys, KV holding only the summary, the 1 h negative cache, `200` on every failure, the rate limit, log lines without logins, the glyph vocabulary, the `wrangler.toml` contract | Node only |
| `npm run test:local` | real PNG renders of fixed cards, SHA-256 pinned; `src/generic-card.png` reproduces byte for byte | `npm ci` |
| `npm run measure:cpu` | the CPU table above | `npm ci` |

## Card text: glyph outlines, not fonts

The Worker has no font. `src/glyphs/noto-sans-kr.json` holds SVG outlines of a fixed vocabulary at the card's four
weights (500, 600, 700, 800): printable ASCII, `★ · …`, and every Korean string the card and the city plaque can show
(district names, card copy, city types, the plaque's Korean language names). `src/glyph-text.js` replaces the card's
`<text>` writer through the `drawText` option of `cityCardSvg`, placing glyphs side by side from `cityCardTextRuns`.

- There is no kerning or shaping; precomposed Hangul and the card's Latin text do without. `…` is drawn as three
  baseline periods instead of the font's centered CJK ellipsis.
- A character outside the vocabulary is drawn as its accent-free ASCII form, otherwise as `-`. A Korean card whose text
  would need such a character (for example a non-ASCII language name) is drawn in English instead.
- `cityCardTextRuns` lays text out with an estimated width. Noto Sans KR's bold Latin and digits are up to 8% wider
  than that estimate (the top-house rows of the owner card), so such a run is scaled down just enough to fit its slot.
- The README SVG keeps `<text>`: browsers render it with their own fonts.

The outlines come from **Noto Sans KR** (Version 2.004), © 2014-2021 Adobe, with Reserved Font Name "Source", licensed
under the **SIL Open Font License 1.1** ([`src/glyphs/OFL.txt`](src/glyphs/OFL.txt)). The JSON is a Modified Version
under that license: it keeps the copyright, ships with the license and does not use the reserved name. Rebuild it after
any change to the card or plaque copy (the hermetic test fails until you do):

```bash
curl -fL -o NotoSansKR-wght.ttf \
  https://raw.githubusercontent.com/google/fonts/b38c5c93af322c45f633e17ac440ec1e6c94d489/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf
python3 cloudflare-card/scripts/build_glyphs.py --font NotoSansKR-wght.ttf      # needs fontTools; checks SHA-256 194018e6…e252
(cd cloudflare-card && npm run build:generic-card && npm run test:local)        # re-render the plain card, then re-pin
```

## Files

| Path | Role |
|---|---|
| `wrangler.toml` | `repolis-card`, `CARD_KV`, `CARD_RATE_LIMIT`, `SITE_URL`, module rules, logs off |
| `src/index.js` | Entry: wires `@resvg/resvg-wasm`, the glyphs, the plain card and `assets/banner.svg` into `src/worker.js` |
| `src/worker.js` | Routes, KV, Cache API, rate limit, fallbacks; imports no npm package |
| `src/town-card.js` | GitHub request → town projection → card summary; plaque name from a summary; `d=` |
| `src/share-page.js` | `/u/<login>` and 404 HTML |
| `src/glyph-text.js` | Glyph-path text layer |
| `src/rate-limit.js` | `CARD_RATE_LIMIT` plus the isolate fallback |
| `src/generic-card.js`, `src/generic-card.png` | The plain card and its pre-rendered PNG |
| `src/glyphs/` | Generated outlines and the OFL |
| `scripts/` | `card-vocabulary.mjs`, `build_glyphs.py`, `build-generic-card.mjs`, `measure-cpu.mjs` |
| `test/render-png.local.mjs` | Local pinned PNG hashes |

Dependencies live only here: `@resvg/resvg-wasm` (MPL-2.0, bundled at deploy) and `wrangler` (dev), pinned exactly in
`package.json` and `package-lock.json`. The site stays a zero-build static app; `node_modules` here is never needed to
serve it or to run the hermetic gate.
