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

Take the deployed URL and use its `wss://` form, then set `services.realtime`
in `../repolis.config.js` and push:

```js
realtime: canonicalServices ? 'wss://repolis-rt.<you>.workers.dev' : '',
```

Now the HUD badge shows **🟢 현재 · 오늘 · 누적** for everyone, and visitors see
each other's avatars. With the configured default empty the site just runs solo (🟢 1).

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
- The room broadcasts an authoritative `{t:'sync', ids, live}` roster every ~15s
  (Durable Object alarm, only while someone's connected). The client drops any
  avatar not in it, so a missed `leave` (network blip / worker eviction) can't
  leave a **ghost avatar** circling forever — it self-heals within one cycle.

## Admin (kick a stray / ghost avatar)

Token-gated endpoints, off by default. Set a secret first (never commit it):

```bash
cd cloudflare
npx wrangler secret put ADMIN_KEY      # paste a strong random value
npx wrangler deploy
```

Then, from a trusted shell:

```bash
BASE=https://repolis-rt.<you>.workers.dev
# who's in the room right now?
curl "$BASE/__admin/peers?key=$ADMIN_KEY"
# force-disconnect someone by display name (or id=), optionally ban ≤1h
curl "$BASE/__admin/kick?key=$ADMIN_KEY&name=Guest-7500&ban=300"
```

`/__admin/peers` returns `{live, peers:[{id,name,x,z,yaw}], bans}`.
`/__admin/kick` closes matching sockets (code 4001), broadcasts a `leave`, and
with `&ban=<secs>` lays a short in-memory ban. Responses: **501** if `ADMIN_KEY`
is unset (fails safe), **403** on a bad key, **400** with no `id`/`name`. The ban
is in-memory (lost on DO eviction) — fine for short nuisance blocks, not a
permanent ban list.
