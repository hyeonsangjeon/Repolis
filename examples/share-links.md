# Share links & URL parameters

Repolis is one static page, so every entry point is just a URL. No accounts, no build.

## Share a town

| Link | Opens |
|---|---|
| `https://hyeonsangjeon.github.io/Repolis/` | The owner's city (62 repos), byte-identical each load. |
| `https://hyeonsangjeon.github.io/Repolis/?user=mrdoob` | A town built live from `mrdoob`'s public repos. |
| `https://hyeonsangjeon.github.io/Repolis/?user=torvalds` | A town built from `torvalds`' public repos. |

`?user=<login>` rebuilds the whole city from any **public** GitHub user (cached in `localStorage`, with a
stale fallback). It activates only for a valid, non-owner username; a bad name shows a friendly "lost"
overlay, and a "go home" button always returns to the owner city. Cross-town taxi driving is disabled in
public mode.

## Wire a realtime server (optional multiplayer)

Pick any one — they only affect whoever sets them:

```
?rt=wss://your-realtime-server            # URL query
localStorage.setItem('repolisRT','wss://your-realtime-server')
window.REPOLIS_RT = 'wss://your-realtime-server'
```

To enable presence for **every** visitor of your fork, set `const RT_DEFAULT='wss://…'` in `index.html`
and push. Deploy a server with `cd cloudflare && npx wrangler deploy` or `npx partykit deploy`.

## Point the taxi at your own grounding backend (optional)

The "🛰️ AI Foundry Live" mode can target any compatible Worker/function:

- In the chat, choose **AI Foundry Live** and paste your URL, **or**
- set `const GROUNDED_DEFAULT='https://your-worker.workers.dev/'` in `index.html` to enable it for everyone.

Leave it unset and the taxi stays on keyless **Local** search — the site still works fully. See
[`../cloudflare-taxi/README.md`](../cloudflare-taxi/README.md) to deploy your own.

## Language

The UI has a live 🌐 English / 한국어 toggle in the HUD; the choice persists locally. (There is no
`?lang=` parameter — switch it in-app.)
