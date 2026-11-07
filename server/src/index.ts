// Air Defence Duel game server: pairs players, runs the missile duel's turns and decides every hit.
// Each phone flies its own missile and streams where it is; the server passes that on to the other phone,
// and decides impacts and interceptions itself so both players always see the same result.
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { applyImpact, alive, BLAST, dist3, SIDES, TARGETS, type Pos, type Side } from './duel.js';

const PORT = Number(process.env.PORT || 8787);

type Player = { ws: WebSocket; name: string; code: string; match?: Match; side?: Side };
type Match = {
  players: [Player, Player];
  hp: number[][];
  round: number;
  atk: Side;
  phase: 'flying' | 'result' | 'over';
  lastMissile?: Pos;          // the attacker's latest reported position, for interception checks
  ready: Set<Side>;
};

const waiting = new Map<string, Player>();      // one waiting player per invite code ('' = anyone)
const send = (p: Player, msg: object) => { if (p.ws.readyState === WebSocket.OPEN) p.ws.send(JSON.stringify(msg)); };
const both = (m: Match, msg: object) => m.players.forEach(p => send(p, msg));
const other = (m: Match, p: Player) => m.players[p.side === 0 ? 1 : 0];

function startMatch(a: Player, b: Player) {
  const [red, blue] = Math.random() < .5 ? [a, b] : [b, a];
  const m: Match = { players: [red, blue], hp: [0, 1].map(() => TARGETS.map(() => 100)), round: 0, atk: 1, phase: 'result', ready: new Set() };
  red.match = blue.match = m; red.side = 0; blue.side = 1;
  m.players.forEach(p => send(p, { t: 'match', you: p.side, names: [red.name, blue.name] }));
  nextRound(m);
}

function nextRound(m: Match) {
  m.round++; m.atk = m.atk === 0 ? 1 : 0; m.phase = 'flying'; m.lastMissile = undefined; m.ready.clear();
  both(m, { t: 'round', n: m.round, atk: m.atk, hp: m.hp });
}

function result(m: Match, msg: object) {
  const def = (1 - m.atk) as Side, over = alive(m.hp, def) === 0 ? m.atk : null;
  m.phase = over == null ? 'result' : 'over';
  both(m, { t: 'result', hp: m.hp, over, ...msg });
}

function onMessage(p: Player, raw: string) {
  let msg: any; try { msg = JSON.parse(raw); } catch { return; }
  if (msg.t === 'hello') {
    if (p.match) return;
    p.name = String(msg.name || 'Player').slice(0, 20); p.code = String(msg.code || '').slice(0, 12).toUpperCase();
    const o = waiting.get(p.code);
    if (o && o !== p && o.ws.readyState === WebSocket.OPEN) { waiting.delete(p.code); startMatch(o, p); }
    else { waiting.set(p.code, p); send(p, { t: 'wait', code: p.code }); }
    return;
  }
  const m = p.match; if (!m) return;
  const atk = p.side === m.atk;
  switch (msg.t) {
    case 'launch': case 'ilaunch':                          // pass launches on, so the other phone plays the animation
      if (m.phase === 'flying') send(other(m, p), msg); break;
    case 's':                                               // live position of my craft
      if (m.phase !== 'flying') break;
      if (atk && msg.o) m.lastMissile = { x: +msg.o.x, y: +msg.o.y, alt: +msg.o.alt };
      send(other(m, p), msg); break;
    case 'impact':                                          // attacker: my missile reached the ground here
      if (!atk || m.phase !== 'flying') break;
      { const r = applyImpact(m.hp, (1 - m.atk) as Side, +msg.x, +msg.y); result(m, { kind: r.hit ? 'hit' : 'miss', why: r.why, x: +msg.x, y: +msg.y }); }
      break;
    case 'off':                                             // attacker: my missile left the map
      if (atk && m.phase === 'flying') result(m, { kind: 'off', why: 'The missile flew off the map.' }); break;
    case 'det': {                                           // defender: my interceptor went off here
      if (atk || m.phase !== 'flying') break;
      const blast = { x: +msg.x, y: +msg.y, alt: +msg.alt }, d = m.lastMissile ? dist3(blast, m.lastMissile) : Infinity;
      if (d <= BLAST) result(m, { kind: 'intercept', why: `Intercepted! The blast went off ${Math.round(d * 10)} m from the missile.`, blast, missile: m.lastMissile });
      else send(other(m, p), { t: 'det', ...blast });       // a miss: the attacker sees the blast and flies on
      break;
    }
    case 'ready':                                           // both tapped "Next round"
      if (m.phase !== 'result') break;
      m.ready.add(p.side!); if (m.ready.size === 2) nextRound(m); break;
  }
}

function onClose(p: Player) {
  if (waiting.get(p.code) === p) waiting.delete(p.code);
  const m = p.match; if (!m) return;
  const o = other(m, p);
  if (m.phase !== 'over') send(o, { t: 'left', why: `${p.name} left the game.` });
  m.phase = 'over'; o.match = undefined;
}

const http = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); return; }
  res.writeHead(200, { 'content-type': 'text/plain' }); res.end(`Air Defence Duel server — ${waiting.size} waiting`);
});
const wss = new WebSocketServer({ server: http, path: '/duel' });
wss.on('connection', ws => {
  const p: Player = { ws, name: 'Player', code: '' };
  ws.on('message', d => onMessage(p, d.toString()));
  ws.on('close', () => onClose(p));
});
// Phones that vanish without closing (lost signal) are dropped by a ping every 20 s.
const alivePing = new WeakSet<WebSocket>();
wss.on('connection', ws => { alivePing.add(ws); ws.on('pong', () => alivePing.add(ws)); });
setInterval(() => wss.clients.forEach(ws => { if (!alivePing.has(ws)) return ws.terminate(); alivePing.delete(ws); ws.ping(); }), 20000);

http.listen(PORT, () => console.log(`duel server on :${PORT} (${SIDES.map(s => s.name).join(' vs ')})`));
