# Repolis realtime — Cloudflare Workers backend

This is an alternative to the PartyKit backend in `../party/`. It deploys the
**same** realtime server (presence + 현재/오늘/누적 visitor counters) straight to
your own Cloudflare account with the official `wrangler` CLI — handy because
PartyKit's hosted login/deploy has been flaky.

It runs on the **free** Workers plan: SQLite-backed Durable Objects, no credit
card required (you get ~100k requests/day — plenty for a portfolio).

## Deploy (2 commands)

```bash
cd cloudflare
npx wrangler login      # opens Cloudflare's own login in your browser → Allow
npx wrangler deploy     # prints your URL, e.g. https://repolis-rt.<you>.workers.dev
```

(First time only: create a free account at https://dash.cloudflare.com — no card.)

## Turn it on for every visitor

Take the deployed URL and use its `wss://` form, then set it as `RT_DEFAULT`
in `../index.html` (near the realtime block) and push:

```js
const RT_DEFAULT='wss://repolis-rt.<you>.workers.dev';
```

Now the HUD badge shows **🟢 현재 · 오늘 · 누적** for everyone, and visitors see
each other's avatars. With `RT_DEFAULT` empty the site just runs solo (🟢 1).

## Local test (no login)

```bash
cd cloudflare
npx wrangler dev        # serves ws://localhost:8787
```

Then open the site pointed at it:
`http://localhost:8910/index.html?rt=ws://localhost:8787`

## Notes

- `today` / `total` are stored in the Durable Object's SQLite, so they survive
  restarts. `live` is the count of currently-open sockets.
- "today" uses the UTC date.
- Same JSON-over-WebSocket protocol as `../party/repolis.js` and
  `../scripts/dev_realtime.mjs`, so the client is identical across all three.
