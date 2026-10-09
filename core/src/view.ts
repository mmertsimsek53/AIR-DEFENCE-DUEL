// What one player is allowed to see. The server will send exactly this; the sandbox uses it too.
import { BUILDINGS, ECONOMY, RADAR_LEVELS, attack, defence } from './data';
import { batteryLoad, incomeFor, launchCap, radarRange, storedUnits, topUpNeeds, upgradeBatteryCost } from './match';
import type { Match, PlayerIndex } from './types';

export function viewFor(m: Match, pi: PlayerIndex) {
  const me = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
  const bt = m.battle;
  const iDefend = bt?.defender === pi;
  const caps: Record<string, number> = {};
  for (const id of Object.keys({ ...me.launchers, ...me.stock })) caps[id] = launchCap(me, id);
  return {
    phase: m.phase,
    time: m.time,
    secondsLeft: Math.max(0, Math.ceil(m.phaseEndsAt - m.time)),
    timed: m.timed !== false || m.phase === 'report',
    myTurn: m.phase === 'turn' && m.active === pi,
    active: m.active,
    turnNo: m.turnNo,
    weatherBad: m.weatherBad,
    winner: m.winner, endReason: m.endReason, iWon: m.winner === pi,
    me: {
      name: me.name, budget: me.budget, health: me.health, income: incomeFor(me), ready: me.ready,
      pads: me.pads, scars: me.scars,
      batteries: me.batteries.map(b => ({ ...b, load: batteryLoad(b), upgradeCost: upgradeBatteryCost(b), name: defence(b.sys).name })),
      buildings: me.buildings.map(b => ({ uid: b.uid, kind: b.kind, x: b.x, z: b.z, down: b.down, revealed: b.revealed, name: BUILDINGS.find(x => x.kind === b.kind)!.name })),
      interceptors: me.interceptors, launchers: me.launchers, stock: me.stock, scouts: me.scouts, launched: me.launched, caps,
      offUp: me.offUp, econ: me.econ, radar: me.radar, radarRange: radarRange(me),
      radarNames: RADAR_LEVELS.names,
      storage: { used: storedUnits(me), safe: ECONOMY.storage.values[me.econ.storage] },
      autoFire: me.autoFire, reloadsLeft: me.reloadsLeft, restock: me.restock, lastRestock: me.lastRestock,
      topUpCost: Object.entries(topUpNeeds(me)).reduce((s, [k, n]) => s + Math.max(0, n) * defence(k).shot, 0),
    },
    enemy: {
      name: foe.name, health: foe.health, scars: foe.scars,
      buildings: foe.buildings.filter(b => b.revealed).map(b => ({ uid: b.uid, kind: b.kind, x: b.x, z: b.z, down: b.down, name: BUILDINGS.find(x => x.kind === b.kind)!.name })),
      batteries: foe.batteries.filter(b => b.revealed).map(b => ({ uid: b.uid, sys: b.sys, name: defence(b.sys).name, x: foe.pads[b.pad].x, z: foe.pads[b.pad].z })),
    },
    battle: bt && {
      attacker: bt.attacker, defender: bt.defender, iDefend, time: bt.time, bearing: bt.bearing, route: iDefend ? undefined : bt.route, live: !!bt.live, open: !!bt.open,
      threats: bt.threats.filter(t => t.alive && t.delay <= 0 && (!iDefend || t.detected)).map(t => {
        const isDecoy = t.cls === 'decoy' || t.weapon === 'decoy';
        // A defender who has identified a decoy but not yet unmasked it sees what it imitates.
        const shownCls = !iDefend ? t.cls : !t.identified ? null : isDecoy && !t.decoyMarked ? t.looksLike : t.cls;
        return {
          uid: t.uid, x: t.x, z: t.z, alt: t.alt,
          cls: shownCls,
          looksLike: t.looksLike,
          name: !iDefend ? nameOf(t.weapon, t.isScout) : !t.identified ? 'Unknown' : isDecoy && !t.decoyMarked ? (threatName[t.looksLike] ?? 'Unknown') : isDecoy ? 'Decoy' : nameOf(t.weapon, t.isScout),
          decoy: iDefend ? t.decoyMarked : isDecoy,
          priority: t.priority, hold: t.hold, engaged: t.engaged, scout: t.isScout,
          eta: Math.round(Math.hypot(t.x, t.z) / Math.max(0.01, Math.hypot(t.x, t.z) > 20 ? t.speed : t.speedIn)),
        };
      }),
      interceptors: bt.interceptors.map(i => ({ uid: i.uid, sys: i.sys, x: i.x, z: i.z, alt: i.alt })),
      stats: bt.stats,
    },
    report: m.phase === 'report' ? m.lastReport : undefined,
    log: m.log.slice(-8),
  };
}

const threatName: Record<string, string> = { drone: 'Drone', ballistic: 'Ballistic', cruise: 'Cruise', uav: 'UAV', rocket: 'Rocket', hypersonic: 'Hypersonic' };

function nameOf(id: string, isScout: boolean): string {
  if (isScout) return 'Surveillance UAV';
  if (id === 'decoy') return 'Decoy';
  try { return attack(id).name; } catch { return id; }
}
