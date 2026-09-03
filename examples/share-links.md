# Share links & URL parameters

Repolis is one static page, so every entry point is just a URL. No accounts, no build.

## Share a town

| Link | Opens |
|---|---|
| `https://hyeonsangjeon.github.io/Repolis/` | The owner's generated city snapshot. |
| `https://hyeonsangjeon.github.io/Repolis/?launch=1` | The username launchpad, focused and ready to build a personal preview. |
| `https://hyeonsangjeon.github.io/Repolis/?user=mrdoob` | A town built live from `mrdoob`'s public repos. |
| `https://hyeonsangjeon.github.io/Repolis/?repo=mrdoob/three.js&ref=repo-portal` | The `three.js` building and Repository Atelier before the owner catalog. |
| `https://hyeonsangjeon.github.io/Repolis/?repo=hyeonsangjeon/Repolis&view=atelier` | A covered direct transition into the `Repolis` Repository Atelier, with no exterior-town step. |
| `https://hyeonsangjeon.github.io/Repolis/?repo=owner/repo&view=blueprint&path=src%2Fagents&ref=blueprint` | A confirmation for one exact public Blueprint path; no Tree request starts until Load. |
| `https://hyeonsangjeon.github.io/Repolis/?user=torvalds` | A town built from `torvalds`' public repos. |
| `https://hyeonsangjeon.github.io/Repolis/?user=mrdoob&route=three.js,stats.js&ref=repo-route` | An ordered two-house Repo Route in `mrdoob`'s town. |
| `https://hyeonsangjeon.github.io/Repolis/?user=mrdoob&twin=torvalds&ref=twin-town` | Twin Towns for two users, including shared languages/topics and a reversible visit link. |

`?user=<login>` rebuilds the whole city from any **public** GitHub user (cached in `localStorage`, with a
stale fallback). It activates only for a valid, non-owner username; a bad name shows a friendly "lost"
overlay, and a "go home" button always returns to the owner city. Cross-town taxi driving is disabled in
public mode.

## Share one repository

Paste a username, `owner/repo`, or a GitHub repository root URL into the first screen or **Station**. A
repository becomes:

```text
?repo=<owner>/<repo>&ref=repo-portal
```

The link loads one target first, confirms its public facts, and opens its Repository Atelier after one entry
click. **Copy Repo Portal** produces the same canonical address. **Explore @owner's full town** is an
explicit second step that reuses the existing public-town loader and keeps the target focused.

For an invitation or campaign that should begin with the exhibition itself, use the strict direct form:

```text
?repo=<owner>/<repo>&view=atelier
```

It keeps the loading cover visible, shows a short portal transition after a 1.2-second initialization pause,
and then reuses the same Repository Atelier entry. The intro and exterior town never flash underneath the
transition. Extra query state or a hash disables automatic entry and falls back to the ordinary Portal flow.

Trailing slashes and `.git` are accepted. Non-GitHub hosts, extra paths, query injection, traversal, and
control characters are rejected before any GitHub request. If `repo` and `user` conflict, the repository
owner wins; Portal links never mix `twin`, `growth`, postcard, or repo-card hash state.

Arbitrary public repositories expose stars, forks, language, topics, dates, and issues. GitHub does not
publish their visitor, view, or clone traffic, so Repolis leaves those fields unknown rather than showing
synthetic values. One exact `GET /repos/{owner}/{repo}` request is cached locally for 15 minutes, with a
bounded stale fallback.

## Share a Blueprint landmark

After explicitly loading Repository Blueprint, focus a projected file or folder and choose **Copy Blueprint
Link**. The canonical link contains only the exact public `owner/repo`, fixed `view=blueprint`, one encoded
relative `path`, and fixed `ref=blueprint`.

A recipient confirms the repository and path before **Load public Blueprint** starts the same single bounded
GitHub Tree request. Repolis restores focus only when that exact node exists in the fetched projection. Missing
paths remain unselected; no nearby path, other repository, source content, chat, account, or visitor identity is
substituted into the URL.

## Share a Repo Route

Open repo house cards and choose **Add to Repo Route**. Two or three unique current houses form an ordered
walk:

```text
?user=<login>&route=<repo1>,<repo2>,<repo3>&ref=repo-route
```

The canonical owner town omits `user`. A recipient sees the route names before entry, then the existing
compass, taxi, and cards advance one stop at a time. The draft exists only in the current page; sharing puts
the public repository names in the URL. Duplicate, missing, deleted/private, invalid, or fourth stops fail
soft. `repo`, `focus`, `growth`, or `twin` queries take precedence instead of opening competing experiences.

## Connect two towns

After a personal preview is ready, choose **Connect with a friend**. The same flow is available from
**Twin Towns** in the in-city menu. Repolis loads the second account through the existing public GitHub
REST path and local cache, then creates a link with:

```
?user=<first-login>&twin=<second-login>&ref=twin-town
```

Opening that link compares the two public towns immediately. **Turn toward** swaps the two usernames,
so either recipient can visit the other town and send the bridge back. No login, image upload, or new
backend is involved.

## Publish a persistent town

Use the [Repolis template](https://github.com/new?template_name=Repolis&template_owner=hyeonsangjeon),
enable Actions and Pages, then run **Refresh Repolis data** once. Public metadata uses the built-in
`github.token`; `GH_PAT` is optional and only unlocks cumulative traffic collection.

On `<owner>.github.io`, `repolis.config.js` automatically uses `<owner>` as the town owner and disables
the canonical Repolis AI/realtime endpoints. Set `townOwner` in that one file when using a custom domain.

## Wire a realtime server (optional multiplayer)

Pick any one — they only affect whoever sets them:

```
?rt=wss://your-realtime-server            # URL query
localStorage.setItem('repolisRT','wss://your-realtime-server')
window.REPOLIS_RT = 'wss://your-realtime-server'
```

To enable presence for **every** visitor of your fork, set `services.realtime` in
`repolis.config.js` and push. Deploy a server with `cd cloudflare && npx wrangler deploy`
or `npx partykit deploy`.

## Point the taxi at your own grounding backend (optional)

The "🛰️ AI Foundry Live" mode can target any compatible Worker/function:

- In the chat, choose **AI Foundry Live** and paste your URL, **or**
- set `services.grounded` in `repolis.config.js` to enable it for everyone on your deployment.

Leave it unset and the taxi stays on keyless **Local** search — the site still works fully. See
[`../cloudflare-taxi/README.md`](../cloudflare-taxi/README.md) to deploy your own.

## Language

The UI has a live 🌐 English / 한국어 toggle in the HUD; the choice persists locally. (There is no
`?lang=` parameter — switch it in-app.)
