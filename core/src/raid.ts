// A raid: one live strike from your base on a rival base. The battle engine (match.ts) runs it; this file turns
// bases into the two sides, builds AI rival bases, and works out stars, loot and XP afterwards.
import { ATTACKS, DEFENCES, SCOUTS, XP, defence, type BuildingKind } from './data';
import {
  BUILDING_TYPES, RESOURCES, TILE_KM, buildingType, countAt, gridSize, hqLevel, levelHp, maxLevelAt, newBase, storageCap,
  type Base, type Res,
} from './base';
import { nextRandom } from './rng';
import type { Battery, Building, Match, Pad, PlayerState } from './types';

const KIND: Record<string, BuildingKind> = {
  hq: 'command', radar: 'radar', power: 'power', ammobunker: 'depot', magazine: 'depot', missilefactory: 'factory',
  airfield: 'airbase', treasury: 'finance', goldvault: 'finance',
};

const centreKm = (g: number, x: number, y: number, size: number) => ({ x: (x + size / 2 - g / 2) * TILE_KM, z: (y + size / 2 - g / 2) * TILE_KM });

function emptyPlayer(index: 0 | 1, name: string, isAI: boolean): PlayerState {
  return {
    index, name, isAI, budget: 0, health: 0, pads: [], scars: [], batteries: [], buildings: [], interceptors: {}, launchers: {}, stock: {},
    scouts: {}, launched: {}, offUp: {}, econ: { income: 0, storage: 0, logistics: 1, repair: 0 }, radar: { range: 0, identify: 0, decoy: 0 },
    autoFire: true, reloadsLeft: 0, spent: 0, conceded: false, ready: true, restock: {},
  };
}

/** The defending side: structures become targets with strength, defence buildings become batteries. */
function defender(b: Base, index: 0 | 1, isAI: boolean): PlayerState {
  const p = emptyPlayer(index, b.name, isAI), g = gridSize(hqLevel(b));
  for (const x of b.buildings) {
    if (x.level < 1) continue; // still under first construction: not on the map yet
    const t = buildingType(x.type)!, c = centreKm(g, x.x, x.y, t.size);
    if (t.sys) {
      const pad: Pad = { id: p.pads.length, x: c.x, z: c.z };
      p.pads.push(pad);
      const s = defence(t.sys);
      const bat: Battery = { uid: 100000 + x.id, sys: t.sys, pad: pad.id, level: Math.min(3, x.level), ammo: Math.round(s.load * (1 + 0.25 * (Math.min(3, x.level) - 1))), cooldown: 0, reloading: 0, holdFire: false, revealed: false, kills: 0, dwell: 0 };
      p.batteries.push(bat);
      if (s.load > 0) p.interceptors[s.id] = (p.interceptors[s.id] ?? 0) + s.load; // one spare reload per battery
      continue;
    }
    const hp = levelHp(t, x.level);
    const bd: Building = { uid: x.id, kind: KIND[x.type] ?? 'structure', x: c.x, z: c.z, down: 0, revealed: false, battleDamage: 0,
      hp, maxHp: hp, r: t.size * TILE_KM / 2 * 1.15, name: t.name, baseType: x.type, size: t.size, level: x.level };
    p.buildings.push(bd);
  }
  const radar = Math.max(0, ...b.buildings.filter(x => x.type === 'radar' && x.level >= 1).map(x => x.level));
  p.radar = { range: Math.min(3, Math.max(0, radar - 1)), identify: Math.min(3, Math.max(0, radar - 1)), decoy: Math.min(3, Math.max(0, radar - 2)) };
  p.health = p.buildings.reduce((s, x) => s + (x.hp ?? 0), 0);
  return p;
}

/** The attacking side: everything in the arsenal can fly in this raid. */
function attacker(b: Base): PlayerState {
  const p = emptyPlayer(0, b.name, false);
  for (const [id, n] of Object.entries(b.arsenal ?? {})) {
    if (n <= 0) continue;
    if (SCOUTS.some(s => s.id === id)) { p.scouts[id] = n; continue; }
    const w = ATTACKS.find(a => a.id === id); if (!w) continue;
    p.stock[id] = n;
    if (!w.reusable) p.launchers[id] = Math.ceil(n / w.perTurn);
  }
  return p;
}

export function createRaid(att: Base, def: Base, seed: number): Match {
  const g = gridSize(hqLevel(def));
  const m: Match = {
    version: 1, rng: seed | 0, time: 0, phase: 'battle', phaseEndsAt: Infinity, active: 0, turnNo: 1, weatherBad: false,
    players: [attacker(att), defender(def, 1, true)], nextUid: 200000, log: [], timed: false,
    raid: { grid: g }, cityRadius: g * TILE_KM / 2,
  };
  m.battle = {
    attacker: 0, defender: 1, bearing: -Math.PI / 2, live: true, open: true, time: 0, threats: [], interceptors: [], events: [],
    stats: { launched: 0, stopped: 0, hits: 0, damage: 0, interceptorsUsed: 0, defenceSpent: 0, attackSpent: 0 }, over: false,
  };
  m.players[1].reloadsLeft = 2;
  return m;
}

// ---------- AI rival bases ----------

/** A rival base at a given HQ level: everything allowed is built, defences spread by their range. */
export function generateBase(hq: number, seed: number, name: string): Base {
  const st = { rng: seed | 0 }, rnd = () => nextRandom(st);
  const b = newBase(name, 0);
  b.buildings = [];
  const g = gridSize(hq), mid = g / 2;
  const occ: boolean[][] = Array.from({ length: g }, () => Array(g).fill(false));
  const free = (x: number, y: number, s: number) => { if (x < 0 || y < 0 || x + s > g || y + s > g) return false; for (let i = x; i < x + s; i++) for (let j = y; j < y + s; j++) if (occ[i][j]) return false; return true; };
  const put = (type: string, level: number, tx: number, ty: number) => {
    const t = buildingType(type)!; const s = t.size;
    for (let r = 0; r < g; r++) for (let k = 0; k < 24; k++) {
      const a = rnd() * Math.PI * 2, x = Math.round(tx + Math.cos(a) * r - s / 2), y = Math.round(ty + Math.sin(a) * r - s / 2);
      if (free(x, y, s)) { for (let i = x; i < x + s; i++) for (let j = y; j < y + s; j++) occ[i][j] = true; b.buildings.push({ id: b.nextId++, type, level, x, y }); return; }
    }
  };
  const lvl = (type: string) => { const t = buildingType(type)!; const top = Math.max(1, maxLevelAt(t, hq)); return Math.max(1, top - (rnd() < 0.5 ? 1 : 0)); };
  put('hq', hq, mid, mid);
  for (const t of BUILDING_TYPES) {
    if (t.id === 'hq' || t.sys || hq < t.unlock) continue;
    for (let i = 0; i < countAt(t, hq); i++) { const a = rnd() * Math.PI * 2, r = (0.15 + rnd() * 0.25) * g; put(t.id, lvl(t.id), mid + Math.cos(a) * r, mid + Math.sin(a) * r); }
  }
  // Defences: short-range ones close to the centre, long-range ones further out; all of them that the HQ allows.
  for (const t of BUILDING_TYPES.filter(x => x.sys && hq >= x.unlock)) {
    const range = defence(t.sys!).range, ring = range < 10 ? 0.18 : range < 50 ? 0.3 : 0.38;
    for (let i = 0; i < countAt(t, hq); i++) { const a = rnd() * Math.PI * 2; put(t.id, lvl(t.id), mid + Math.cos(a) * ring * g, mid + Math.sin(a) * ring * g); }
  }
  const cap = storageCap(b);
  for (const r of RESOURCES) b.res[r] = Math.round(cap[r] * (0.4 + rnd() * 0.4));
  return b;
}

// ---------- after the raid ----------

export interface RaidResult { stars: number; destroyedPct: number; hqDown: boolean; loot: Record<Res, number>; xp: number; used: Record<string, number> }

/** Loot: up to 30% of each stored resource, scaled by how much of the base was destroyed (more if its storages fell). */
export function raidResult(m: Match, att: Base, def: Base): RaidResult {
  const r = m.lastReport?.raid ?? { destroyedPct: 0, hqDown: false, stars: 0 };
  const defP = m.players[1], storagesDown = defP.buildings.filter(x => x.down >= 99 && ['goldvault', 'fueldepot', 'magazine', 'uraniumstore', 'treasury', 'oilwell', 'explosives', 'uranium'].includes(x.baseType ?? '')).length;
  const share = Math.min(0.3, 0.2 * r.destroyedPct / 100 + 0.03 * storagesDown);
  const loot = {} as Record<Res, number>;
  for (const res of RESOURCES) loot[res] = Math.floor(def.res[res] * share);
  const used: Record<string, number> = {};
  const attP = m.players[0];
  for (const [id, n] of Object.entries(att.arsenal ?? {})) {
    const left = SCOUTS.some(s => s.id === id) ? attP.scouts[id] ?? 0 : attP.stock[id] ?? 0;
    // Threats still flying at the end don't come back; reusable UAVs that returned are back in stock already.
    if (n - left > 0) used[id] = n - left;
  }
  const xp = r.stars === 0 ? XP.loss : XP.win + (r.stars === 3 ? XP.bigWinBonus : 0) - (3 - r.stars) * 5;
  return { stars: r.stars, destroyedPct: r.destroyedPct, hqDown: r.hqDown, loot, xp, used };
}

/** Apply a raid to your base: loot in (up to the storage cap), used weapons out, XP. */
export function applyRaid(att: Base, res: RaidResult) {
  const cap = storageCap(att);
  for (const r of RESOURCES) att.res[r] = Math.min(cap[r], att.res[r] + res.loot[r]);
  for (const [id, n] of Object.entries(res.used)) { att.arsenal![id] = Math.max(0, (att.arsenal![id] ?? 0) - n); if (!att.arsenal![id]) delete att.arsenal![id]; }
  att.xp = Math.max(0, att.xp + res.xp);
  att.raids = att.raids ?? { won: 0, lost: 0 };
  if (res.stars > 0) att.raids.won++; else att.raids.lost++;
}

/** The rival base as the attacker may see it: footprints of everything, details only once revealed. */
export function raidMapFor(m: Match) {
  const def = m.players[1];
  return {
    grid: m.raid?.grid ?? 20,
    structures: def.buildings.map(b => ({ uid: b.uid, x: b.x, z: b.z, size: b.size ?? 2, revealed: b.revealed, destroyed: b.down >= 99,
      hpPct: b.maxHp ? Math.round(100 * (b.hp ?? 0) / b.maxHp) : 100, type: b.revealed ? b.baseType : undefined, level: b.revealed ? b.level : undefined, name: b.revealed ? b.name : undefined })),
    defences: def.batteries.map(bt => ({ uid: bt.uid, x: def.pads[bt.pad].x, z: def.pads[bt.pad].z, size: defence(bt.sys).range >= 40 ? 3 : 2, revealed: bt.revealed, sys: bt.revealed ? bt.sys : undefined, level: bt.revealed ? bt.level : undefined })),
  };
}
void DEFENCES;
