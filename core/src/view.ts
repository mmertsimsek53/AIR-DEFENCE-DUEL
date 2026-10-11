// What one player is allowed to see. The server will send exactly this; the sandbox uses it too.
import { BUILDINGS, CITY_RADIUS, RULES, attack, defence } from './data';
import { batteryLoad, incomeFor, launchCap, radarRange, storedUnits, topUpNeeds } from './match';
import type { Match, PlayerIndex } from './types';

export function viewFor(m: Match, pi: PlayerIndex) {
  const me = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
  const bt = m.battle;
  const iDefend = bt?.defender === pi;
  const caps: Record<string, number> = {};
  for (const id of Object.keys({ ...me.launchers, ...me.stock })) caps[id] = launchCap(me, id);
  // Hideouts are numbered 1–8 in plot order, the same for both players.
  const hideNo = (p: typeof me) => new Map(p.buildings.filter(b => b.kind === 'hideout').map((b, i) => [b.uid, i + 1]));
  const myNo = hideNo(me), foeNo = hideNo(foe);
  return {
    phase: m.phase,
    time: m.time,
    secondsLeft: Math.max(0, Math.ceil(m.phaseEndsAt - m.time)),
    timed: m.timed !== false || m.phase === 'report',
    myTurn: m.phase === 'turn' && m.active === pi,
    active: m.active,
    turnNo: m.turnNo,
    radius: m.cityRadius ?? CITY_RADIUS, raid: !!m.raid,
    weatherBad: m.weatherBad,
    winner: m.winner, endReason: m.endReason, iWon: m.winner === pi,
    me: {
      name: me.name, budget: me.budget, income: incomeFor(me), ready: me.ready,
      chief: me.chief, chiefNo: myNo.get(me.chief) ?? 0, inspected: me.inspected, chiefMove: RULES.chiefMove,
      intel: me.intel.map(x => ({ ...x, no: foeNo.get(x.uid) ?? 0 })), surveyed: me.surveyed, patrols: me.patrols,
      pads: me.pads, scars: me.scars,
      batteries: me.batteries.map(b => ({ ...b, load: batteryLoad(b), name: defence(b.sys).name })),
      buildings: me.buildings.map(b => ({ uid: b.uid, kind: b.kind, x: b.x, z: b.z, down: b.down, revealed: b.revealed, no: myNo.get(b.uid), name: nameOfBuilding(b.kind, myNo.get(b.uid)) })),
      interceptors: me.interceptors, launchers: me.launchers, stock: me.stock, scouts: me.scouts, launched: me.launched, caps,
      radarRange: radarRange(me),
      storage: { used: storedUnits(me), safe: RULES.storage },
      autoFire: me.autoFire, reloadsLeft: me.reloadsLeft, restock: me.restock, lastRestock: me.lastRestock,
      topUpCost: Object.entries(topUpNeeds(me)).reduce((s, [k, n]) => s + Math.max(0, n) * defence(k).shot, 0),
    },
    enemy: {
      name: foe.name, scars: foe.scars,
      hideoutsLeft: foe.buildings.filter(b => b.kind === 'hideout' && b.down < 99).length,
      buildings: foe.buildings.filter(b => b.revealed).map(b => ({ uid: b.uid, kind: b.kind, x: b.x, z: b.z, down: b.down, no: foeNo.get(b.uid), name: nameOfBuilding(b.kind, foeNo.get(b.uid)) })),
      batteries: foe.batteries.filter(b => b.revealed).map(b => ({ uid: b.uid, sys: b.sys, name: defence(b.sys).name, x: foe.pads[b.pad].x, z: foe.pads[b.pad].z })),
    },
    battle: bt && {
      attacker: bt.attacker, defender: bt.defender, iDefend, time: bt.time, bearing: bt.bearing, route: iDefend ? undefined : bt.route, live: !!bt.live, open: !!bt.open,
      threats: bt.threats.filter(t => t.alive && t.delay <= 0 && (!iDefend || t.detected)).map(t => {
        const isDecoy = t.cls === 'decoy' || t.weapon === 'decoy';
        // The defender only ever sees what a contact looks like (once identified); decoys are never unmasked in the duel.
        const shownCls = !iDefend ? t.cls : !t.identified ? null : isDecoy && !t.decoyMarked ? t.looksLike : t.cls;
        return {
          uid: t.uid, x: t.x, z: t.z, alt: t.alt,
          cls: shownCls,
          looksLike: t.looksLike,
          name: !iDefend ? nameOf(t.weapon, t.isScout) : !t.identified ? 'Unknown' : isDecoy && !t.decoyMarked ? (threatName[t.looksLike] ?? 'Unknown') : isDecoy ? 'Decoy' : nameOf(t.weapon, t.isScout),
          decoy: iDefend ? t.decoyMarked : isDecoy,
          priority: t.priority, hold: t.hold, engaged: t.engaged, scout: t.isScout, recon: !iDefend && t.weapon === 'recon', hovering: t.hover != null,
          eta: Math.round(Math.hypot(t.x, t.z) / Math.max(0.01, Math.hypot(t.x, t.z) > 20 ? t.speed : t.speedIn)),
        };
      }),
      interceptors: bt.interceptors.map(i => ({ uid: i.uid, sys: i.sys, x: i.x, z: i.z, alt: i.alt })),
      patrols: (bt.patrols ?? []).map(p => ({ uid: p.uid, x: p.x, z: p.z, alt: p.alt, missiles: p.missiles })),
      stats: bt.stats,
    },
    report: m.phase === 'report' ? m.lastReport : undefined,
    log: m.log.slice(-8),
  };
}

const threatName: Record<string, string> = { drone: 'Drone', ballistic: 'Ballistic', cruise: 'Cruise', uav: 'UAV', rocket: 'Rocket', hypersonic: 'Hypersonic' };

function nameOfBuilding(kind: string, no?: number): string {
  const n = BUILDINGS.find(x => x.kind === kind)!.name;
  return kind === 'hideout' ? `${n} ${no ?? ''}`.trim() : n;
}

function nameOf(id: string, isScout: boolean): string {
  if (isScout) return 'Surveillance UAV';
  if (id === 'decoy') return 'Decoy';
  try { return attack(id).name; } catch { return id; }
}
