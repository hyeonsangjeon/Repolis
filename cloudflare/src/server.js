// Repolis realtime backend on Cloudflare Workers + Durable Objects.
//
// Why this exists: PartyKit is built ON Cloudflare Durable Objects, but its
// hosted login/deploy site has been throwing 500s. Deploying straight to
// Cloudflare with the official `wrangler` CLI uses Cloudflare's own (reliable)
// login and the free Workers plan — SQLite-backed Durable Objects, no card.
//
// The wire protocol is identical to party/repolis.js and
// scripts/dev_realtime.mjs, so the Repolis client needs ZERO changes: just
// point RT_DEFAULT (in index.html) at the deployed
//   wss://repolis-rt.<your-subdomain>.workers.dev
//
// Protocol (JSON over WS):
//   client -> { t:'join', id, name, x, z, yaw, color }
//   client -> { t:'pos',  id, x, z, yaw }
//   server -> { t:'welcome', peers:[...], live, today, total }
//   server -> { t:'join', peer, live, today, total }
//   server -> { t:'pos', id, x, z, yaw }
//   server -> { t:'leave', id, live }
//
// Counters: `today` and `total` (unique visitors today / all-time) are kept in
// the Durable Object's SQLite storage, so they survive restarts. `live` is the
// number of currently-open sockets (in memory; naturally resets to 0 only when
// the room is empty and the object evicts).

export class RepolisRoom {
  constructor(state, env) {
    this.state = state;
    this.sql = state.storage.sql;
    this.sessions = new Map(); // ws -> peer
    // One unique row per (guest, UTC-day). today = rows for today's date,
    // total = distinct guests across all days. Idempotent on every startup.
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS seen (gid TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (gid, day))"
    );
  }

  today() {
    return new Date().toISOString().slice(0, 10); // UTC day
  }

  // Record this guest for today + all-time, then return both counts.
  counts(gid) {
    const day = this.today();
    if (gid) {
      this.sql.exec("INSERT OR IGNORE INTO seen (gid, day) VALUES (?, ?)", gid, day);
    }
    const today = this.sql.exec("SELECT COUNT(*) AS n FROM seen WHERE day = ?", day).one().n;
    const total = this.sql.exec("SELECT COUNT(DISTINCT gid) AS n FROM seen").one().n;
    return { today, total };
  }

  fetch(req) {
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("Repolis realtime OK", { status: 200 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    this.wire(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  wire(ws) {
    ws.addEventListener("message", (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (e) { return; }

      if (m.t === "join") {
        const peer = {
          id: String(m.id || crypto.randomUUID()),
          name: String(m.name || "Guest").slice(0, 24),
          x: +m.x || 0, z: +m.z || 0, yaw: +m.yaw || 0,
          color: m.color,
        };
        this.sessions.set(ws, peer);
        const { today, total } = this.counts(peer.id);
        const live = this.sessions.size;
        const others = [...this.sessions.values()].filter((p) => p !== peer);
        ws.send(JSON.stringify({ t: "welcome", peers: others, live, today, total }));
        this.broadcast({ t: "join", peer, live, today, total }, ws);
      } else if (m.t === "pos") {
        const p = this.sessions.get(ws);
        if (!p) return;
        p.x = +m.x || 0; p.z = +m.z || 0; p.yaw = +m.yaw || 0;
        this.broadcast({ t: "pos", id: p.id, x: p.x, z: p.z, yaw: p.yaw }, ws);
      }
    });

    const gone = () => {
      const p = this.sessions.get(ws);
      if (!p) return;
      this.sessions.delete(ws);
      this.broadcast({ t: "leave", id: p.id, live: this.sessions.size });
    };
    ws.addEventListener("close", gone);
    ws.addEventListener("error", gone);
  }

  broadcast(obj, except) {
    const s = JSON.stringify(obj);
    for (const ws of this.sessions.keys()) {
      if (ws === except) continue;
      try { ws.send(s); } catch (e) { /* socket already gone */ }
    }
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("Repolis realtime server — connect over WebSocket.", { status: 200 });
    }
    // Everyone shares one room; the last path segment names it (default "world").
    const room = url.pathname.split("/").filter(Boolean).pop() || "world";
    const id = env.REPOLIS_ROOM.idFromName(room);
    return env.REPOLIS_ROOM.get(id).fetch(req);
  },
};
