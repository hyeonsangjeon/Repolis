// Repolis realtime server — minimal Node + ws implementation.
//
// Two uses:
//   • Local testing:   npm i ws && node scripts/dev_realtime.mjs
//                      then open the world with ?rt=ws://localhost:1999
//   • Self-hosting:    deploy this to any Node host that allows WebSockets
//                      (Render / Railway / Fly.io / a VPS) and point Repolis at
//                      wss://your-host  via ?rt= or localStorage 'repolisRT'.
//
// It speaks the exact same JSON protocol as party/repolis.js (PartyKit), so the
// browser client doesn't care which backend you use.
//
// Protocol:
//   client -> { t:'join', id, name, x, z, yaw, color }
//   client -> { t:'pos',  id, x, z, yaw }
//   server -> { t:'welcome', peers:[...], live, today, total }
//   server -> { t:'join', peer, live, today, total }
//   server -> { t:'pos', id, x, z, yaw }
//   server -> { t:'leave', id, live }

import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 1999;
const wss = new WebSocketServer({ port: PORT });

const peers = new Map(); // ws -> peer
let today = new Date().toISOString().slice(0, 10);
const todaySet = new Set(); // unique guest ids seen today
const allSet = new Set();   // unique guest ids all-time ("visitors to date"); in-memory only — restarts reset it (PartyKit persists)

function rollDay() {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== today) { today = d; todaySet.clear(); }
}
function broadcast(obj, except) {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c !== except && c.readyState === 1) c.send(s);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }

    if (m.t === "join") {
      rollDay();
      const peer = {
        id: String(m.id || ""),
        name: String(m.name || "Guest").slice(0, 24),
        x: +m.x || 0, z: +m.z || 0, yaw: +m.yaw || 0,
        color: m.color,
      };
      peers.set(ws, peer);
      todaySet.add(peer.id);
      allSet.add(peer.id);
      const others = [...peers.values()].filter((p) => p !== peer);
      ws.send(JSON.stringify({ t: "welcome", peers: others, live: peers.size, today: todaySet.size, total: allSet.size }));
      broadcast({ t: "join", peer, live: peers.size, today: todaySet.size, total: allSet.size }, ws);
    } else if (m.t === "pos") {
      const p = peers.get(ws);
      if (!p) return;
      p.x = +m.x || 0; p.z = +m.z || 0; p.yaw = +m.yaw || 0;
      broadcast({ t: "pos", id: p.id, x: p.x, z: p.z, yaw: p.yaw }, ws);
    }
  });
  ws.on("close", () => {
    const p = peers.get(ws);
    if (p) { peers.delete(ws); broadcast({ t: "leave", id: p.id, live: peers.size }); }
  });
  ws.on("error", () => { try { ws.close(); } catch (e) {} });
});

console.log("Repolis realtime server listening on ws://localhost:" + PORT);
