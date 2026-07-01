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
//   server -> { t:'welcome', peers:[...], live, today, total, entriesToday, entriesTotal }
//   server -> { t:'join', peer, live, today, total, entriesToday, entriesTotal }
//   server -> { t:'pos', id, x, z, yaw }
//   server -> { t:'leave', id, live }
//
// Counters: `today` and `total` (unique visitors today / all-time) are kept in
// the Durable Object's SQLite storage, so they survive restarts. `live` is the
// number of currently-open sockets (in memory; naturally resets to 0 only when
// the room is empty and the object evicts).

const ENTRY_SEED_MULTIPLIER = 3.7;
const COUNTER_BASIS = "UTC day / world unique guest / entry joins";

export class RepolisRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.sessions = new Map(); // ws -> peer
    this.ready = false;        // schema + counters initialised?
    // Kill switch: a monthly cap on NEW connections so a traffic spike or abuse
    // can never push the bill past the included Workers Paid allowance. Tunable
    // from wrangler.toml / the dashboard via REPOLIS_MONTHLY_CAP ("0" disables it).
    this.cap = Math.max(0, parseInt((env && env.REPOLIS_MONTHLY_CAP) || "", 10) || 5000000);
    this.reqMonth = this.monthKey();
    this.reqCount = 0;
    this.reqDirty = 0;
    try {
      this.state.blockConcurrencyWhile(async () => {
        try {
          const saved = await this.state.storage.get("reqCount:" + this.reqMonth);
          if (typeof saved === "number") this.reqCount = saved;
        } catch (e) { /* storage unavailable — start from 0, cap still enforced in memory */ }
      });
    } catch (e) { /* ignore */ }
    this.ensureSchema();       // guarded — never throws (storage may be over quota)
  }

  // Create the schema + rollup counter tables and, once, backfill them from any
  // pre-existing `seen` history. Wrapped so a storage outage (e.g. the free-tier
  // "rows read / day" limit being exhausted ANYWHERE on the account — it is a
  // shared pool across all Durable Objects) cannot crash the room: realtime
  // multiplayer and the in-memory live count keep working, and the persistent
  // today/total counters simply resume once storage is writable again.
  ensureSchema() {
    if (this.ready) return true;
    try {
      // One unique row per (guest, UTC-day).
      this.sql.exec("CREATE TABLE IF NOT EXISTS seen (gid TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (gid, day))");
      // O(1) rollups so the hot join path never scans `seen`:
      //   daily_count.n = unique guests for that UTC-day; stat['total'] = distinct guests all-time.
      this.sql.exec("CREATE TABLE IF NOT EXISTS daily_count (day TEXT PRIMARY KEY, n INTEGER NOT NULL)");
      this.sql.exec("CREATE TABLE IF NOT EXISTS entry_count (day TEXT PRIMARY KEY, n INTEGER NOT NULL)");
      this.sql.exec("CREATE TABLE IF NOT EXISTS stat (k TEXT PRIMARY KEY, v INTEGER NOT NULL)");
      this.backfillOnce();
      this.seedEntriesOnce();
      this.ready = true;
      return true;
    } catch (e) {
      return false; // storage unavailable — degrade gracefully, retry on the next call
    }
  }

  // Seed the rollup counters from historical `seen` rows exactly once: the only
  // remaining full scan, and only on the first healthy startup after this version
  // ships (afterwards stat['total'] exists, so it is skipped forever).
  backfillOnce() {
    if (this.sql.exec("SELECT v FROM stat WHERE k = 'total' LIMIT 1").toArray().length) return;
    if (!this.sql.exec("SELECT 1 FROM seen LIMIT 1").toArray().length) {
      this.sql.exec("INSERT OR IGNORE INTO stat (k, v) VALUES ('total', 0)");
      return;
    }
    const total = this.sql.exec("SELECT COUNT(DISTINCT gid) AS n FROM seen").one().n;
    this.sql.exec("INSERT OR REPLACE INTO stat (k, v) VALUES ('total', ?)", total);
    for (const r of this.sql.exec("SELECT day, COUNT(*) AS n FROM seen GROUP BY day").toArray())
      this.sql.exec("INSERT OR REPLACE INTO daily_count (day, n) VALUES (?, ?)", r.day, r.n);
  }

  // `entries_total` is an estimated historical entry counter. We do not have
  // app-lifetime page-load history in this DO, so the first value is seeded once
  // from the current all-time unique visitor count, then real joins increment it.
  seedEntriesOnce() {
    if (this.sql.exec("SELECT v FROM stat WHERE k = 'entries_total' LIMIT 1").toArray().length) return;
    const total = Number((this.sql.exec("SELECT v FROM stat WHERE k = 'total' LIMIT 1").toArray()[0] || {}).v) || 0;
    this.sql.exec("INSERT OR IGNORE INTO stat (k, v) VALUES ('entries_total', ?)", Math.round(total * ENTRY_SEED_MULTIPLIER));
  }

  today() {
    return new Date().toISOString().slice(0, 10); // UTC day
  }

  monthKey() {
    return new Date().toISOString().slice(0, 7); // YYYY-MM (UTC)
  }

  // Snapshot of the monthly counter for the /__usage monitor endpoint.
  usage() {
    const m = this.monthKey();
    if (m !== this.reqMonth) { this.reqMonth = m; this.reqCount = 0; this.reqDirty = 0; }
    return {
      month: this.reqMonth,
      count: this.reqCount,
      cap: this.cap,
      pct: this.cap ? +((this.reqCount / this.cap) * 100).toFixed(2) : 0,
      live: this.sessions.size,
    };
  }

  readCounts(day = this.today()) {
    const today = (this.sql.exec("SELECT n FROM daily_count WHERE day = ?", day).toArray()[0] || {}).n;
    const total = (this.sql.exec("SELECT v FROM stat WHERE k = 'total'").toArray()[0] || {}).v;
    const entriesToday = (this.sql.exec("SELECT n FROM entry_count WHERE day = ?", day).toArray()[0] || {}).n;
    const entriesTotal = (this.sql.exec("SELECT v FROM stat WHERE k = 'entries_total'").toArray()[0] || {}).v;
    return {
      today: Number(today) || 0,
      total: Number(total) || 0,
      entriesToday: Number(entriesToday) || 0,
      entriesTotal: Number(entriesTotal) || 0,
    };
  }

  counterSnapshot() {
    const base = this.usage();
    const day = this.today();
    if (!this.ensureSchema()) {
      return { ...base, ok: false, day, today: null, total: null, entriesToday: null, entriesTotal: null, basis: COUNTER_BASIS };
    }
    try {
      return { ...base, ok: true, day, ...this.readCounts(day), basis: COUNTER_BASIS, entrySeedMultiplier: ENTRY_SEED_MULTIPLIER };
    } catch (e) {
      return { ...base, ok: false, day, today: null, total: null, entriesToday: null, entriesTotal: null, basis: COUNTER_BASIS };
    }
  }

  // Count one new connection. Returns false once the monthly cap is reached so the
  // caller can refuse cheaply. O(1): an in-memory counter flushed to storage only
  // every 500 hits (one row write per 500); the month key resets it for free.
  allow() {
    const m = this.monthKey();
    if (m !== this.reqMonth) { this.reqMonth = m; this.reqCount = 0; this.reqDirty = 0; }
    if (this.cap && this.reqCount >= this.cap) return false;
    this.reqCount++;
    if (++this.reqDirty >= 500) {
      this.reqDirty = 0;
      try { this.state.storage.put("reqCount:" + this.reqMonth, this.reqCount); } catch (e) { /* best-effort */ }
    }
    return true;
  }

  // Record this guest for today + all-time, then return both counts. O(1): a few
  // single-row indexed lookups instead of scanning `seen` on every join. The old
  // `SELECT COUNT(DISTINCT gid) FROM seen` ran a FULL table scan per connection,
  // which (as the table grew + reconnects accumulated) exhausted the free-tier
  // rows-read budget and took the room — and the live counter — offline. Returns
  // null counts when storage is unavailable so the caller can still serve presence.
  counts(gid, countEntry = true) {
    if (!this.ensureSchema()) return { today: null, total: null, entriesToday: null, entriesTotal: null };
    try {
      const day = this.today();
      if (countEntry) {
        this.sql.exec("INSERT INTO entry_count (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1", day);
        this.sql.exec("INSERT INTO stat (k, v) VALUES ('entries_total', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1");
      }
      if (gid) {
        const seenToday = this.sql.exec("SELECT 1 FROM seen WHERE gid = ? AND day = ? LIMIT 1", gid, day).toArray().length;
        if (!seenToday) {
          this.sql.exec("INSERT OR IGNORE INTO seen (gid, day) VALUES (?, ?)", gid, day);
          this.sql.exec("INSERT INTO daily_count (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1", day);
          // Brand-new guest ever? PK index seeks straight to this gid's rows (0-few), not a scan.
          const seenEver = this.sql.exec("SELECT 1 FROM seen WHERE gid = ? AND day <> ? LIMIT 1", gid, day).toArray().length;
          if (!seenEver)
            this.sql.exec("INSERT INTO stat (k, v) VALUES ('total', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1");
        }
      }
      return this.readCounts(day);
    } catch (e) {
      return { today: null, total: null, entriesToday: null, entriesTotal: null };
    }
  }

  fetch(req) {
    const url = new URL(req.url);
    // Lightweight usage monitor — no socket, no table scan. Check spend headroom:
    //   curl https://repolis-rt.<sub>.workers.dev/__usage
    if (url.pathname.endsWith("/__usage")) {
      return new Response(JSON.stringify(this.counterSnapshot()), { headers: { "content-type": "application/json" } });
    }
    if (req.headers.get("Upgrade") !== "websocket") {
      return new Response("Repolis realtime OK", { status: 200 });
    }
    // Kill switch: once the monthly cap is hit, refuse new sockets cheaply. Already
    // open sockets keep working; presence/counters are unaffected.
    if (!this.allow()) {
      return new Response("Repolis realtime paused — monthly safety cap reached.", { status: 503 });
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
        const countEntry = !this.sessions.has(ws);
        this.sessions.set(ws, peer);
        const { today, total, entriesToday, entriesTotal } = this.counts(peer.id, countEntry);
        const live = this.sessions.size;
        const stats = { live };
        if (today != null) stats.today = today;   // omitted while storage is over quota
        if (total != null) stats.total = total;   // → client keeps its last shown value
        if (entriesToday != null) stats.entriesToday = entriesToday;
        if (entriesTotal != null) stats.entriesTotal = entriesTotal;
        const others = [...this.sessions.values()].filter((p) => p !== peer);
        ws.send(JSON.stringify({ t: "welcome", peers: others, ...stats }));
        this.broadcast({ t: "join", peer, ...stats }, ws);
      } else if (m.t === "pos") {
        const p = this.sessions.get(ws);
        if (!p) return;
        p.x = +m.x || 0; p.z = +m.z || 0; p.yaw = +m.yaw || 0;
        this.broadcast({ t: "pos", id: p.id, x: p.x, z: p.z, yaw: p.yaw }, ws);
      } else if (m.t === "wave") {
        const p = this.sessions.get(ws);
        if (!p) return;
        this.broadcast({ t: "wave", id: p.id, to: String(m.to || "").slice(0, 40) }, ws);
      } else if (m.t === "emote") {
        const p = this.sessions.get(ws);
        if (!p) return;
        this.broadcast({ t: "emote", id: p.id, kind: String(m.kind || "").slice(0, 16) }, ws);
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
    const isWS = req.headers.get("Upgrade") === "websocket";
    const isUsage = url.pathname.endsWith("/__usage");
    if (!isWS && !isUsage) {
      return new Response("Repolis realtime server — connect over WebSocket.", { status: 200 });
    }
    // Everyone shares one room; the last path segment names it (default "world").
    // /__usage always reports the shared "world" room.
    const room = isUsage ? "world" : (url.pathname.split("/").filter(Boolean).pop() || "world");
    const id = env.REPOLIS_ROOM.idFromName(room);
    return env.REPOLIS_ROOM.get(id).fetch(req);
  },
};
