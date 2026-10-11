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
  const layers = r < 0.5 ? ['korkut', 'pantsir', 'irondome', 'hisara'] : ['gepard', 'sungur', 'hisaro', 'irondome'];
  for (const sys of layers) { const pad = freePad(p, defence(sys).range < 10); if (pad != null) buy(m, pi, { c: 'buyBattery', sys, pad }); }
  buy(m, pi, { c: 'buyLauncher', weapon: 'shahed' });
  buy(m, pi, { c: 'buyUnits', weapon: 'shahed', n: 10 });
  buy(m, pi, { c: 'buyLauncher', weapon: 'gerbera' });
  buy(m, pi, { c: 'buyUnits', weapon: 'gerbera', n: 10 });
  buy(m, pi, { c: 'buyUnits', weapon: 'recon', n: 4 });
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
    const choice = ['irist', 'hisaro', 'davidsling', 'siper'][Math.floor(nextRandom(m) * 4)];
    const pad = freePad(p, false); if (pad != null) buy(m, pi, { c: 'buyBattery', sys: choice, pad });
  }
  if (p.budget > 300 && !(p.launchers.tayfun > 0)) buy(m, pi, { c: 'buyLauncher', weapon: 'tayfun' });
  // Restock attack weapons (recon drones need no launcher).
  for (const w of ATTACKS) {
    if (w.reusable || !(w.noLauncher || p.launchers[w.id] > 0)) continue;
    const cap = launchCap(p, w.id), have = p.stock[w.id] ?? 0;
    if (have < cap && p.budget > w.unit * (cap - have) + 60) buy(m, pi, { c: 'buyUnits', weapon: w.id, n: cap - have });
  }
}

function attackTurn(m: Match, pi: PlayerIndex) {
  const p = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
  const standing = foe.buildings.filter(b => b.kind === 'hideout' && b.down < 99);
  const known = (uid: number) => p.intel.find(x => x.uid === uid);
  const found = standing.find(h => known(h.uid)?.found);
  // Unchecked first, then the ones checked longest ago (the chief may have moved).
  const toCheck = standing.filter(h => !known(h.uid)?.found)
    .sort((a, b) => (known(a.uid)?.turn ?? -1) - (known(b.uid)?.turn ?? -1));
  const strikes: { weapon: string; n: number; target?: number }[] = [];
  const left = (id: string) => Math.min(p.stock[id] ?? 0, launchCap(p, id));
  if (found) {
    // Everything precise goes at the chief's hideout; cheap drones and decoys soak up the defence.
    for (const w of ATTACKS) { const n = left(w.id); if (n > 0 && !w.reusable && w.precise && !w.recon) strikes.push({ weapon: w.id, n, target: found.uid }); }
  } else {
    const n = Math.min(left('recon'), toCheck.length);
    for (let i = 0; i < n; i++) strikes.push({ weapon: 'recon', n: 1, target: toCheck[i].uid });
    // A ballistic gamble on an unchecked hideout now and then.
    if (toCheck.length && left('tayfun') > 0 && nextRandom(m) < 0.3) strikes.push({ weapon: 'tayfun', n: 1, target: toCheck[toCheck.length - 1].uid });
  }
  for (const id of ['shahed', 'gerbera', 'mald']) { const n = left(id); if (n > 0) strikes.push({ weapon: id, n }); }
  if (strikes.length && command(m, pi, { c: 'go', strikes, scouts: [] }).ok) return;
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

void RULES;
