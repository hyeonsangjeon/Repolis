// Repolis realtime server (PartyKit) — multiplayer presence + live/today counters.
//
// PartyKit gives a free, globally-hosted WebSocket room, which is what a static
// GitHub Pages site needs (Pages itself can't run a socket server).
//
// Deploy:
//   1) npm install -g partykit         (or use: npx partykit ...)
//   2) from this folder:  npx partykit deploy
//   3) it prints a host like  repolis.<your-name>.partykit.dev
//   4) point Repolis at it — open the site with
//        ?rt=wss://repolis.<your-name>.partykit.dev/parties/main/world
//      or run once in the browser console:
//        localStorage.setItem('repolisRT','wss://repolis.<your-name>.partykit.dev/parties/main/world')
//
// Protocol (JSON over WS), shared with scripts/dev_realtime.mjs:
//   client -> { t:'join', id, name, x, z, yaw, color }
//   client -> { t:'pos',  id, x, z, yaw }
//   server -> { t:'welcome', peers:[...], live, today, total }
//   server -> { t:'join', peer, live, today, total }
//   server -> { t:'pos', id, x, z, yaw }
//   server -> { t:'leave', id, live }

export default class Repolis {
  constructor(room) {
    this.room = room;
    this.peers = new Map(); // connectionId -> peer
  }

  todayKey() {
    return "uv:" + new Date().toISOString().slice(0, 10);
  }

  // Count a guest as a unique visitor for today AND all-time ("visitors to date").
  // Both are persisted in room storage, so the cumulative total survives restarts.
  async bumpCounts(gid) {
    const dkey = this.todayKey();
    const day = (await this.room.storage.get(dkey)) || {};
    if (!day[gid]) { day[gid] = 1; await this.room.storage.put(dkey, day); }
    const all = (await this.room.storage.get("uv:all")) || {};
    if (!all[gid]) { all[gid] = 1; await this.room.storage.put("uv:all", all); }
    return { today: Object.keys(day).length, total: Object.keys(all).length };
  }

  async onMessage(raw, sender) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }

    if (m.t === "join") {
      const peer = {
        id: String(m.id || sender.id),
        name: String(m.name || "Guest").slice(0, 24),
        x: +m.x || 0, z: +m.z || 0, yaw: +m.yaw || 0,
        color: m.color,
      };
      this.peers.set(sender.id, peer);
      const { today, total } = await this.bumpCounts(peer.id);
      const live = this.peers.size;
      const others = [...this.peers.entries()]
        .filter(([cid]) => cid !== sender.id)
        .map(([, p]) => p);
      sender.send(JSON.stringify({ t: "welcome", peers: others, live, today, total }));
      this.room.broadcast(JSON.stringify({ t: "join", peer, live, today, total }), [sender.id]);
    } else if (m.t === "pos") {
      const p = this.peers.get(sender.id);
      if (!p) return;
      p.x = +m.x || 0; p.z = +m.z || 0; p.yaw = +m.yaw || 0;
      this.room.broadcast(
        JSON.stringify({ t: "pos", id: p.id, x: p.x, z: p.z, yaw: p.yaw }),
        [sender.id]
      );
    }
  }

  onClose(conn) { this.gone(conn); }
  onError(conn) { this.gone(conn); }

  gone(conn) {
    const p = this.peers.get(conn.id);
    if (!p) return;
    this.peers.delete(conn.id);
    this.room.broadcast(JSON.stringify({ t: "leave", id: p.id, live: this.peers.size }));
  }
}
