// Sandbox training opponent. Simple and readable on purpose: it buys a layered defence, scouts first,
// then hits revealed buildings and swarms with cheap drones. It defends with auto-fire.
import { DEFENCES, ATTACKS, ECONOMY, RADAR_LEVELS, defence } from './data';
import { command, launchCap } from './match';
import { nextRandom } from './rng';
import type { Match, PlayerIndex, PlayerState } from './types';

const THINK_SECONDS = 3;
let turnSeenAt = -1, turnSeen = -1;

function buy(m: Match, pi: PlayerIndex, cmd: Parameters<typeof command>[2]) { return command(m, pi, cmd).ok; }

function freePad(p: PlayerState, inner: boolean): number | undefined {
  const pads = p.pads.filter(x => (inner ? x.id < 6 : x.id >= 6) && !p.batteries.some(b => b.pad === x.id));
  return pads[0]?.id ?? p.pads.find(x => !p.batteries.some(b => b.pad === x.id))?.id;
}

function setup(m: Match, pi: PlayerIndex) {
  const p = m.players[pi];
  const r = nextRandom(m);
  const layers = r < 0.5 ? ['korkut', 'pantsir', 'irondome', 'hisara'] : ['gepard', 'sungur', 'hisaro', 'irondome'];
  for (const sys of layers) { const pad = freePad(p, defence(sys).range < 10); if (pad != null) buy(m, pi, { c: 'buyBattery', sys, pad }); }
  buy(m, pi, { c: 'upgradeRadar', track: 'range' });
  buy(m, pi, { c: 'buyLauncher', weapon: 'shahed' });
  buy(m, pi, { c: 'buyUnits', weapon: 'shahed', n: 10 });
  buy(m, pi, { c: 'buyScout', scout: 'tb2s' });
  buy(m, pi, { c: 'buyLauncher', weapon: 'som' });
  buy(m, pi, { c: 'buyUnits', weapon: 'som', n: 2 });
  buy(m, pi, { c: 'endSetup' });
}

function shop(m: Match, pi: PlayerIndex) {
  const p = m.players[pi];
  // Keep one reload of interceptors in the depot for every missile battery.
  for (const b of p.batteries) {
    const s = defence(b.sys); if (s.load === 0) continue;
    const have = p.interceptors[s.id] ?? 0;
    if (have < s.load && p.budget > s.shot * s.load + 40) buy(m, pi, { c: 'buyInterceptors', sys: s.id, n: s.load - have });
  }
  if (p.econ.income === 0 && p.budget > 260) buy(m, pi, { c: 'upgradeEconomy', track: 'income' });
  if (p.radar.decoy === 0 && p.budget > 200) buy(m, pi, { c: 'upgradeRadar', track: 'decoy' });
  // Grow the defence once rich.
  if (p.budget > 450 && p.batteries.length < 8) {
    const choice = ['irist', 'hisaro', 'davidsling', 'siper'][Math.floor(nextRandom(m) * 4)];
    const pad = freePad(p, false); if (pad != null) buy(m, pi, { c: 'buyBattery', sys: choice, pad });
  }
  if (p.budget > 300 && !(p.launchers.tayfun > 0)) buy(m, pi, { c: 'buyLauncher', weapon: 'tayfun' });
  // Restock attack weapons.
  for (const w of ATTACKS) {
    if (w.reusable || !(p.launchers[w.id] > 0)) continue;
    const cap = launchCap(p, w.id), have = p.stock[w.id] ?? 0;
    if (have < cap && p.budget > w.unit * (cap - have) + 60) buy(m, pi, { c: 'buyUnits', weapon: w.id, n: cap - have });
  }
}

function attackTurn(m: Match, pi: PlayerIndex) {
  const p = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
  const revealed = foe.buildings.filter(b => b.revealed && b.down === 0);
  const strikes: { weapon: string; n: number; target?: number }[] = [];
  const scouts: { scout: string; path: { x: number; z: number }[] }[] = [];
  if (revealed.length < 3 && (p.scouts.tb2s ?? 0) > 0) {
    const a = nextRandom(m) * Math.PI;
    scouts.push({ scout: 'tb2s', path: [{ x: Math.cos(a) * 4, z: Math.sin(a) * 4 }, { x: -Math.cos(a) * 4, z: -Math.sin(a) * 4 }] });
  }
  const order = ['factory', 'command', 'power', 'radar', 'finance', 'depot', 'airbase'];
  revealed.sort((x, y) => order.indexOf(x.kind) - order.indexOf(y.kind));
  let ti = 0;
  for (const w of ATTACKS) {
    const n = Math.min(p.stock[w.id] ?? 0, launchCap(p, w.id));
    if (n <= 0 || w.reusable) continue;
    if (w.precise && revealed.length) {
      for (let i = 0; i < n; i++) strikes.push({ weapon: w.id, n: 1, target: revealed[ti++ % revealed.length].uid });
    } else strikes.push({ weapon: w.id, n });
  }
  if (strikes.length || scouts.length) {
    if (command(m, pi, { c: 'go', strikes, scouts }).ok) return;
  }
  command(m, pi, { c: 'wait' });
}

/** Call every frame from the host. Acts for every AI player when it is its move. */
export function aiStep(m: Match) {
  m.players.forEach((p, i) => {
    const pi = i as PlayerIndex;
    if (!p.isAI) return;
    if (m.phase === 'setup' && !p.ready) setup(m, pi);
    if (m.phase === 'battle' && m.battle?.defender === pi) p.autoFire = true;
    if (m.phase === 'turn' && m.active === pi) {
      if (turnSeen !== m.turnNo) { turnSeen = m.turnNo; turnSeenAt = m.time; }
      if (m.time - turnSeenAt >= THINK_SECONDS) { shop(m, pi); attackTurn(m, pi); }
    }
  });
}

// Silence "unused" for catalogue imports kept for future tuning.
void DEFENCES; void ECONOMY; void RADAR_LEVELS;
