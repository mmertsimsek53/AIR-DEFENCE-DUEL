// Sandbox training opponent. Simple and readable on purpose: it buys a layered defence, hunts the chief with
// recon drones (covered by decoys and cheap drones), and strikes the hideout once the chief is found.
// It moves its own chief when an enemy recon drone has checked the hideout the chief is in. It defends with auto-fire.
import { ATTACKS, RULES, defence } from './data';
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
  const layers = r < 0.5 ? ['korkut', 'pantsir', 'irondome', 'hisara'] : ['zu23', 'sungur', 'hisaro', 'irondome'];
  for (const sys of layers) { const pad = freePad(p, defence(sys).range < 10); if (pad != null) buy(m, pi, { c: 'buyBattery', sys, pad }); }
  buy(m, pi, { c: 'buyLauncher', weapon: 'shahed' });
  buy(m, pi, { c: 'buyUnits', weapon: 'shahed', n: 10 });
  buy(m, pi, { c: 'buyLauncher', weapon: 'gerbera' });
  buy(m, pi, { c: 'buyUnits', weapon: 'gerbera', n: 10 });
  buy(m, pi, { c: 'buyUnits', weapon: 'recon', n: 4 });
  buy(m, pi, { c: 'buyScout', scout: 'aksungur' });
  buy(m, pi, { c: 'buyPatrol' });
  buy(m, pi, { c: 'buyLauncher', weapon: 'kargu' });
  buy(m, pi, { c: 'buyUnits', weapon: 'kargu', n: 8 });
  buy(m, pi, { c: 'buyLauncher', weapon: 'som' });
  buy(m, pi, { c: 'buyUnits', weapon: 'som', n: 2 });
  buy(m, pi, { c: 'endSetup' });
}

function shop(m: Match, pi: PlayerIndex) {
  const p = m.players[pi];
  // Hide the chief again if an enemy recon drone checked its hideout.
  if (p.inspected.includes(p.chief)) {
    const others = p.buildings.filter(b => b.kind === 'hideout' && b.down < 99 && b.uid !== p.chief);
    if (others.length) buy(m, pi, { c: 'moveChief', uid: others[Math.floor(nextRandom(m) * others.length) % others.length].uid });
  }
  // Keep one reload of interceptors in the depot for every missile battery.
  for (const b of p.batteries) {
    const s = defence(b.sys); if (s.load === 0) continue;
    const have = p.interceptors[s.id] ?? 0;
    if (have < s.load && p.budget > s.shot * s.load + 40) buy(m, pi, { c: 'buyInterceptors', sys: s.id, n: s.load - have });
  }
  // Grow the defence once rich.
  if (p.budget > 450 && p.batteries.length < 8) {
    const choice = ['hisaro', 'hisaro', 'davidsling', 'siper'][Math.floor(nextRandom(m) * 4)];
    const pad = freePad(p, false); if (pad != null) buy(m, pi, { c: 'buyBattery', sys: choice, pad });
  }
  if (!(p.scouts.aksungur > 0) && p.surveyed.length < 12 && p.budget > 80) buy(m, pi, { c: 'buyScout', scout: 'aksungur' });
  if (p.budget > 300 && !(p.launchers.tayfun > 0)) buy(m, pi, { c: 'buyLauncher', weapon: 'tayfun' });
  // Spend savings on more strike capacity, so a found chief can be hit hard.
  if (p.budget > 400 && (p.launchers.som ?? 0) < 3) buy(m, pi, { c: 'buyLauncher', weapon: 'som' });
  if (p.budget > 500 && (p.launchers.tayfun ?? 0) < 2) buy(m, pi, { c: 'buyLauncher', weapon: 'tayfun' });
  if (p.budget > 450 && (p.launchers.mald ?? 0) < 1) buy(m, pi, { c: 'buyLauncher', weapon: 'mald' });
  // Restock attack weapons (recon drones need no launcher).
  for (const w of ATTACKS) {
    if (w.reusable || !(w.noLauncher || p.launchers[w.id] > 0)) continue;
    const cap = launchCap(p, w.id), have = p.stock[w.id] ?? 0;
    if (have < cap && p.budget > w.unit * (cap - have) + 60) buy(m, pi, { c: 'buyUnits', weapon: w.id, n: cap - have });
  }
}

const pt = (x: number, z: number) => ({ x, z });
/** A launch point out to one side, beyond the city. */
const outside = (m: Match) => { const a = nextRandom(m) * Math.PI * 2; return pt(Math.cos(a) * 30, Math.sin(a) * 30); };

/** Live attack, like a player: recon drones first; if one finds the chief, the precise weapons follow in the same attack. */
function attackTurn(m: Match, pi: PlayerIndex) {
  const p = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
  const standing = foe.buildings.filter(b => b.kind === 'hideout' && b.revealed && b.down < 99);
  const known = (uid: number) => p.intel.find(x => x.uid === uid);
  // Unchecked first, then the ones checked longest ago (the chief may have moved).
  const toCheck = standing.slice().sort((a, b) => (known(a.uid)?.turn ?? -1) - (known(b.uid)?.turn ?? -1));
  const left = (id: string) => Math.min(p.stock[id] ?? 0, launchCap(p, id) - (p.launched[id] ?? 0));
  const anything = ATTACKS.some(w => left(w.id) > 0) || (p.scouts.aksungur ?? 0) > 0;
  if (!anything || !command(m, pi, { c: 'go', strikes: [], scouts: [], live: true }).ok) { command(m, pi, { c: 'wait' }); return; }
  const fire = (weapon: string, to: { x: number; z: number }) => command(m, pi, { c: 'fire', weapon, from: outside(m), to }).ok;
  // Too many known defences: spend this turn's precise weapons taking them down (recon drones would just be shot).
  const bats = foe.batteries.filter(b => b.revealed).map(b => foe.pads[b.pad]);
  if (bats.length > 2) {
    // Precise weapons and drone swarms on the known batteries (damage adds up: about 3 Shaheds or 5 Kargus kill one).
    let k = 0;
    for (const w of ATTACKS) if ((w.precise || w.id === 'shahed') && !w.recon && !w.reusable) for (let n = left(w.id); n > 0; n--) fire(w.id, bats[Math.floor(k++ / 3) % bats.length]);
  } else for (let i = 0; i < Math.min(left('recon'), toCheck.length); i++) fire('recon', toCheck[i]);
  // Cheap drones and decoys keep the defence busy (aimed into the city).
  // Cheap drones and decoys wait for a find; with no recon flying they go now to keep the defence busy.
  if (!(p.stock.recon > 0) || !standing.length) for (const id of ['shahed', 'gerbera', 'mald']) for (let n = left(id); n > 0; n--) fire(id, standing[n % Math.max(1, standing.length)] ?? pt(0, 0));
  if (p.surveyed.length < 12 && (p.scouts.aksungur ?? 0) > 0) command(m, pi, { c: 'fire', scout: 'aksungur', from: outside(m), to: pt(0, 0) });
  liveTurn = m.turnNo;
}

let liveTurn = -1;
/** While its own live attack is open: strike a hideout the moment a recon drone finds the chief; end when recon is done. */
function liveStep(m: Match, pi: PlayerIndex) {
  const bt = m.battle!, p = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
  const found = foe.buildings.find(b => b.kind === 'hideout' && b.down < 99 && p.intel.some(x => x.uid === b.uid && x.found && x.turn === m.turnNo));
  if (found) {
    for (const w of ATTACKS) {
      if (w.recon || w.reusable) continue; // everything left goes at the chief: precise weapons, plus drones and decoys to soak up the defence
      for (let n = Math.min(p.stock[w.id] ?? 0, launchCap(p, w.id) - (p.launched[w.id] ?? 0)); n > 0; n--) {
        const a = nextRandom(m) * Math.PI * 2;
        command(m, pi, { c: 'fire', weapon: w.id, from: pt(Math.cos(a) * 30, Math.sin(a) * 30), to: pt(found.x, found.z) });
      }
    }
  }
  const reconFlying = bt.threats.some(t => t.alive && t.weapon === 'recon');
  if ((!reconFlying && bt.time > 3) || bt.time > 90 || liveTurn !== m.turnNo) command(m, pi, { c: 'endAttack' });
}

/** Call every frame from the host. Acts for every AI player when it is its move. */
export function aiStep(m: Match) {
  m.players.forEach((p, i) => {
    const pi = i as PlayerIndex;
    if (!p.isAI) return;
    if (m.phase === 'setup' && !p.ready) setup(m, pi);
    if (m.phase === 'battle' && m.battle?.defender === pi) p.autoFire = true;
    if (m.phase === 'battle' && m.battle?.attacker === pi && m.battle.open) liveStep(m, pi);
    if (m.phase === 'turn' && m.active === pi) {
      if (turnSeen !== m.turnNo) { turnSeen = m.turnNo; turnSeenAt = m.time; }
      if (m.time - turnSeenAt >= THINK_SECONDS) { shop(m, pi); attackTurn(m, pi); }
    }
  });
}

void RULES;
