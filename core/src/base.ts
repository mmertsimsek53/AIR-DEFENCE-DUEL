// Persistent military base (Clash-of-Clans style). Times are real time (ms timestamps passed in by the host;
// the server will pass its own clock). Numbers are first-draft test values: short timers so a base grows in a session.
import { ATTACKS, DEFENCES, SCOUTS } from './data';

export type Res = 'gold' | 'petrol' | 'explosives' | 'uranium';
export const RESOURCES: Res[] = ['gold', 'petrol', 'explosives', 'uranium'];
export const RES_NAMES: Record<Res, string> = { gold: 'Gold', petrol: 'Petrol', explosives: 'TNT', uranium: 'Uranium' };
/** Two groups (Mert, 9 Oct): Resources = Gold, Petrol · Explosives = TNT, Uranium. The id 'explosives' is TNT. */
export type Cost = Partial<Record<Res, number>>;

export type BuildingCat = 'core' | 'resource' | 'explosive' | 'storage' | 'production' | 'defence' | 'support';

export interface BuildingType {
  id: string;
  name: string;
  cat: BuildingCat;
  size: number;            // tiles, square footprint
  unlock: number;          // HQ level that unlocks it
  maxLevel: number;
  counts: number[];        // how many allowed at HQ 1..10 (index 0 = HQ1)
  cost: Cost;              // level 1; each level ×1.7
  time: number;            // seconds for level 1; each level ×2.5
  hp: number;              // level 1; each level ×1.25
  produces?: { res: Res; perHour: number };  // level 1; each level ×1.35
  stores?: { res: Res; cap: number };        // level 1; each level ×1.6
  sys?: string;            // defence system id (core/src/data.ts)
  role: string;
}

export const TILE_KM = 0.25;                 // one grid tile on the ground
export const gridSize = (hq: number) => 20 + 2 * (Math.max(1, Math.min(10, hq)) - 1);
const upTo = (...c: number[]) => { const out = [...c]; while (out.length < 10) out.push(out[out.length - 1]); return out.slice(0, 10); };
const fromHQ = (unlock: number, ...c: number[]) => upTo(...Array(unlock - 1).fill(0), ...c);

const B = (b: BuildingType) => b;
const CORE_TYPES: BuildingType[] = [
  B({ id: 'hq', name: 'Headquarters', cat: 'core', size: 4, unlock: 1, maxLevel: 10, counts: upTo(1), cost: { gold: 1000 }, time: 30, hp: 1200, stores: { res: 'gold', cap: 1500 }, role: 'Unlocks every building and level. Knocked out: your next turn is shorter.' }),
  B({ id: 'builder', name: 'Builder Yard', cat: 'core', size: 2, unlock: 1, maxLevel: 1, counts: upTo(1, 2, 2, 3, 3, 4, 4, 5), cost: { gold: 500 }, time: 10, hp: 300, role: 'Houses one construction team. Each team builds or upgrades one thing at a time.' }),
  B({ id: 'radar', name: 'Radar Station', cat: 'core', size: 3, unlock: 1, maxLevel: 4, counts: upTo(1, 1, 1, 2, 2, 2, 3), cost: { gold: 400, petrol: 100 }, time: 20, hp: 500, role: 'Detects incoming threats. Higher level: longer range, earlier identification, sees through decoys.' }),
  B({ id: 'power', name: 'Power Plant', cat: 'core', size: 3, unlock: 2, maxLevel: 6, counts: fromHQ(2, 1, 1, 2), cost: { gold: 500, petrol: 200 }, time: 30, hp: 600, role: 'Powers radar, lasers and electronic warfare. Knocked out: they switch off.' }),
];
const RESOURCE_TYPES: BuildingType[] = [
  B({ id: 'treasury', name: 'Treasury', cat: 'resource', size: 3, unlock: 1, maxLevel: 10, counts: upTo(1, 2, 2, 3, 3, 4, 4, 5), cost: { gold: 150, petrol: 50 }, time: 10, hp: 400, produces: { res: 'gold', perHour: 600 }, role: 'Government funding: produces Gold.' }),
  B({ id: 'oilwell', name: 'Oil Well', cat: 'resource', size: 2, unlock: 1, maxLevel: 10, counts: upTo(1, 2, 2, 3, 3, 4, 4, 5), cost: { gold: 200 }, time: 10, hp: 350, produces: { res: 'petrol', perHour: 400 }, role: 'Pumps oil and refines it: produces Petrol, the fuel for every launch.' }),
  B({ id: 'explosives', name: 'TNT Plant', cat: 'explosive', size: 3, unlock: 1, maxLevel: 10, counts: upTo(1, 1, 2, 2, 3, 3, 4), cost: { gold: 300, petrol: 100 }, time: 20, hp: 450, produces: { res: 'explosives', perHour: 250 }, role: 'Makes TNT: the filling of every warhead.' }),
  B({ id: 'uranium', name: 'Uranium Mine', cat: 'explosive', size: 3, unlock: 5, maxLevel: 6, counts: fromHQ(5, 1, 1, 2), cost: { gold: 3000, petrol: 1000 }, time: 120, hp: 600, produces: { res: 'uranium', perHour: 40 }, role: 'Mines and processes uranium for heavy penetrator warheads.' }),
];
const STORAGE_TYPES: BuildingType[] = [
  B({ id: 'goldvault', name: 'Gold Vault', cat: 'resource', size: 3, unlock: 1, maxLevel: 10, counts: upTo(1, 1, 2, 2, 2, 3), cost: { gold: 300 }, time: 15, hp: 600, stores: { res: 'gold', cap: 2500 }, role: 'Stores Gold. Raiders can steal part of it.' }),
  B({ id: 'fueldepot', name: 'Fuel Depot', cat: 'resource', size: 3, unlock: 1, maxLevel: 10, counts: upTo(1, 1, 2, 2, 2, 3), cost: { gold: 300 }, time: 15, hp: 500, stores: { res: 'petrol', cap: 2000 }, role: 'Stores Petrol in tanks.' }),
  B({ id: 'magazine', name: 'TNT Magazine', cat: 'explosive', size: 3, unlock: 1, maxLevel: 10, counts: upTo(1, 1, 1, 2, 2, 2, 3), cost: { gold: 350, petrol: 50 }, time: 20, hp: 700, stores: { res: 'explosives', cap: 1500 }, role: 'Earth-covered bunker storing TNT.' }),
  B({ id: 'uraniumstore', name: 'Uranium Store', cat: 'explosive', size: 2, unlock: 5, maxLevel: 6, counts: fromHQ(5, 1, 1, 1, 2), cost: { gold: 2500, petrol: 500 }, time: 90, hp: 800, stores: { res: 'uranium', cap: 300 }, role: 'Shielded casks storing Uranium.' }),
];
const PRODUCTION_TYPES: BuildingType[] = [
  B({ id: 'missilefactory', name: 'Missile Factory', cat: 'production', size: 3, unlock: 1, maxLevel: 8, counts: upTo(1, 1, 1, 1, 2), cost: { gold: 500, petrol: 100 }, time: 30, hp: 700, role: 'Builds interceptor missiles for your air defences. Knocked out: no new missiles.' }),
  B({ id: 'droneworkshop', name: 'Drone Workshop', cat: 'production', size: 3, unlock: 1, maxLevel: 8, counts: upTo(1, 1, 1, 2, 2, 2, 3), cost: { gold: 400, petrol: 100 }, time: 20, hp: 500, role: 'Builds Shahed and Kargu drones and Gerbera decoys.' }),
  B({ id: 'rocketpark', name: 'Rocket Artillery Park', cat: 'production', size: 3, unlock: 2, maxLevel: 8, counts: fromHQ(2, 1, 1, 2, 2, 2, 3), cost: { gold: 800, petrol: 300 }, time: 40, hp: 600, role: 'Grad, TRG-300 and HIMARS launch vehicles.' }),
  B({ id: 'airfield', name: 'Airfield', cat: 'production', size: 4, unlock: 2, maxLevel: 8, counts: fromHQ(2, 1, 1, 1, 1, 2), cost: { gold: 1200, petrol: 400 }, time: 60, hp: 900, role: 'Runway and hangar for TB2, Akıncı, Anka and Global Hawk. Knocked out: UAVs can\'t take off.' }),
  B({ id: 'cruisesite', name: 'Cruise Missile Site', cat: 'production', size: 3, unlock: 4, maxLevel: 6, counts: fromHQ(4, 1, 1, 1, 2), cost: { gold: 2000, petrol: 700 }, time: 90, hp: 700, role: 'Launch containers for SOM and Tomahawk.' }),
  B({ id: 'silo', name: 'Missile Silo', cat: 'production', size: 3, unlock: 6, maxLevel: 5, counts: fromHQ(6, 1, 1, 2), cost: { gold: 4000, petrol: 1200, uranium: 50 }, time: 180, hp: 1000, role: 'Underground silo for Tayfun, Iskander and (HQ10) Kinzhal.' }),
];
const SUPPORT_TYPES: BuildingType[] = [
  B({ id: 'ammobunker', name: 'Ammunition Bunker', cat: 'support', size: 3, unlock: 2, maxLevel: 6, counts: fromHQ(2, 1, 1, 1, 2), cost: { gold: 600, explosives: 100 }, time: 40, hp: 900, role: 'Protected storage for built weapons and interceptors.' }),
  B({ id: 'rnd', name: 'R&D Centre', cat: 'support', size: 3, unlock: 3, maxLevel: 8, counts: fromHQ(3, 1), cost: { gold: 1500, uranium: 0 }, time: 60, hp: 700, role: 'Research: warheads, guidance, stealth, interceptor accuracy.' }),
  B({ id: 'academy', name: 'Training Academy', cat: 'support', size: 3, unlock: 2, maxLevel: 8, counts: fromHQ(2, 1), cost: { gold: 800, petrol: 100 }, time: 40, hp: 600, role: 'Trains crews: operators, launch teams, engineers.' }),
  B({ id: 'barracks', name: 'Barracks', cat: 'support', size: 3, unlock: 1, maxLevel: 8, counts: upTo(1, 1, 2, 2, 3), cost: { gold: 250 }, time: 15, hp: 500, role: 'Beds for your people. More barracks, bigger crews.' }),
  B({ id: 'repair', name: 'Repair Workshop', cat: 'support', size: 2, unlock: 2, maxLevel: 6, counts: fromHQ(2, 1, 1, 1, 2), cost: { gold: 500, petrol: 100 }, time: 30, hp: 400, role: 'Engineers repair damaged buildings faster.' }),
  B({ id: 'camo', name: 'Camouflage Net', cat: 'support', size: 2, unlock: 3, maxLevel: 3, counts: fromHQ(3, 2, 3, 4, 5, 6), cost: { gold: 300 }, time: 20, hp: 100, role: 'Hides the buildings beside it from scouts until they are hit.' }),
  B({ id: 'decoy', name: 'Decoy HQ', cat: 'support', size: 3, unlock: 4, maxLevel: 3, counts: fromHQ(4, 1, 1, 2), cost: { gold: 800 }, time: 40, hp: 300, role: 'Looks like a real headquarters to scouts. Wastes enemy missiles.' }),
];

// Defences: one building per air-defence system. Unlocks follow the tiers in docs/BASE_DESIGN.md.
const DEF_UNLOCK: Record<string, number> = {
  zu23: 1, stinger: 1, gepard: 2, sungur: 2, korkut: 2, alka: 3, pantsir: 3, hisara: 3, koral: 4, irondome: 4, ironbeam: 5,
  irist: 5, hisaro: 5, davidsling: 7, siper: 7, s400: 8, patriot: 9,
};
const DEFENCE_TYPES: BuildingType[] = DEFENCES.map(d => {
  const u = DEF_UNLOCK[d.id] ?? 1;
  const big = d.range >= 40;
  return B({
    id: 'def_' + d.id, name: d.name, cat: 'defence', size: big ? 3 : 2, unlock: u, maxLevel: 3,
    counts: fromHQ(u, 1, 2, 2, 3, 3, 4),
    cost: { gold: Math.round(d.price * 8), explosives: d.load > 0 ? Math.round(d.price * 0.6) : 0, petrol: Math.round(d.price * 1.5) },
    time: Math.round(15 + d.price * 0.4), hp: 400 + Math.round(d.price * 2), sys: d.id, role: d.role,
  });
});

export const BUILDING_TYPES: BuildingType[] = [...CORE_TYPES, ...RESOURCE_TYPES, ...STORAGE_TYPES, ...PRODUCTION_TYPES, ...SUPPORT_TYPES, ...DEFENCE_TYPES];
export const buildingType = (id: string) => BUILDING_TYPES.find(b => b.id === id);

export const levelCost = (t: BuildingType, level: number): Cost => {
  const k = Math.pow(1.7, level - 1), out: Cost = {};
  for (const r of RESOURCES) { const v = t.cost[r]; if (v) out[r] = Math.round(v * k); }
  return out;
};
export const levelTime = (t: BuildingType, level: number) => Math.round(t.time * Math.pow(2.5, level - 1));
export const levelHp = (t: BuildingType, level: number) => Math.round(t.hp * Math.pow(1.25, level - 1));
export const levelProduction = (t: BuildingType, level: number) => (t.produces ? t.produces.perHour * Math.pow(1.35, level - 1) : 0);
export const levelStorage = (t: BuildingType, level: number) => (t.stores ? t.stores.cap * Math.pow(1.6, level - 1) : 0);
/** Highest level this building may reach at the given HQ level. */
export const maxLevelAt = (t: BuildingType, hq: number) => (t.id === 'hq' ? 10 : Math.max(0, Math.min(t.maxLevel, hq - t.unlock + 2)));
export const countAt = (t: BuildingType, hq: number) => t.counts[Math.max(1, Math.min(10, hq)) - 1] ?? 0;

// ---------- weapons made on the base ----------

/** Which production building makes which weapons (in unlock order: first at building level 1, then 2, 3…). */
export const PRODUCTION: Record<string, string[]> = {
  droneworkshop: ['shahed', 'gerbera', 'kargu'],
  rocketpark: ['grad', 'trg300', 'himars'],
  airfield: ['tb2s', 'tb2', 'anka', 'akinci', 'globalhawk'],
  cruisesite: ['som', 'tomahawk'],
  silo: ['tayfun', 'iskander', 'kinzhal'],
};
const HQ_FOR: Record<string, number> = { iskander: 8, kinzhal: 10 };
/** How many units each production building holds per level. */
const CAPACITY_PER_LEVEL: Record<string, number> = { droneworkshop: 10, rocketpark: 3, airfield: 1, cruisesite: 2, silo: 1 };
const FUEL: Record<string, number> = { drone: 2, decoy: 1, uav: 15, rocket: 3, cruise: 6, ballistic: 10, hypersonic: 14 };

/** Resource cost of one unit. Gold = price, Explosives = warhead, Petrol = fuel, Uranium = heavy warheads. */
export function weaponCost(id: string): Cost {
  const w = ATTACKS.find(a => a.id === id);
  if (w) {
    const salvo = w.salvo ?? 1, munitions = w.munitions ?? 1;
    return {
      gold: Math.max(1, Math.round(w.unit * 10)),
      explosives: Math.round(w.damage * salvo * munitions / 4),
      petrol: (FUEL[w.cls] ?? 2) * (w.salvo ? 4 : 1),
      ...(w.cls === 'ballistic' ? { uranium: 2 } : w.cls === 'hypersonic' ? { uranium: 6 } : {}),
    };
  }
  const sc = SCOUTS.find(x => x.id === id);
  if (sc) return { gold: Math.round(sc.price * 10), petrol: 10 };
  return { gold: 1 };
}
export function producerOf(weapon: string): string | undefined { return Object.keys(PRODUCTION).find(k => PRODUCTION[k].includes(weapon)); }
/** Units this kind of production building can hold in total (all of them, by level). */
export function capacityOf(b: Base, prod: string): number {
  return b.buildings.filter(x => x.type === prod && x.level >= 1).reduce((s, x) => s + x.level * (CAPACITY_PER_LEVEL[prod] ?? 1), 0) + (prod === 'airfield' && b.buildings.some(x => x.type === 'airfield' && x.level >= 1) ? 1 : 0);
}
export function storedOf(b: Base, prod: string): number { return PRODUCTION[prod].reduce((s, w) => s + (b.arsenal?.[w] ?? 0), 0); }
/** Weapon available? (its production building at the right level, and HQ for the heaviest). */
export function canMake(b: Base, weapon: string): { ok: boolean; why?: string } {
  const prod = producerOf(weapon); if (!prod) return { ok: false, why: 'Unknown weapon.' };
  const need = PRODUCTION[prod].indexOf(weapon) + 1, lvl = Math.max(0, ...b.buildings.filter(x => x.type === prod).map(x => x.level));
  const t = buildingType(prod)!;
  if (lvl < 1) return { ok: false, why: `Build a ${t.name} first.` };
  if (lvl < need) return { ok: false, why: `Needs ${t.name} level ${need}.` };
  if ((HQ_FOR[weapon] ?? 0) > hqLevel(b)) return { ok: false, why: `Needs Headquarters level ${HQ_FOR[weapon]}.` };
  return { ok: true };
}

// ---------- state ----------

export interface BaseBuilding {
  id: number;
  type: string;
  level: number;                 // 0 while the first construction runs
  x: number; y: number;          // top-left tile
  build?: { toLevel: number; ends: number; started: number }; // construction in progress (ms timestamps)
}

export interface Base {
  version: 1;
  name: string;
  res: Record<Res, number>;
  buildings: BaseBuilding[];
  nextId: number;
  lastTick: number;              // ms
  xp: number;
  arsenal?: Record<string, number>; // built strike weapons, UAV airframes and scouts
  raids?: { won: number; lost: number };
}

export type BaseCommand =
  | { c: 'place'; type: string; x: number; y: number }
  | { c: 'upgrade'; id: number }
  | { c: 'move'; id: number; x: number; y: number }
  | { c: 'speedUp'; id: number }
  | { c: 'cancel'; id: number }
  | { c: 'produce'; weapon: string; n: number };

export type BaseResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): BaseResult => ({ ok: false, error });

export const hqLevel = (b: Base) => Math.max(1, b.buildings.find(x => x.type === 'hq')?.level ?? 1);

/** Gift so a new commander can raid straight away. */
export const STARTER_ARSENAL: Record<string, number> = { shahed: 6, tb2s: 1 };

export function newBase(name: string, now: number): Base {
  const b: Base = { version: 1, name, res: { gold: 1500, petrol: 600, explosives: 300, uranium: 0 }, buildings: [], nextId: 1, lastTick: now, xp: 1000, arsenal: { ...STARTER_ARSENAL } };
  const g = gridSize(1), mid = Math.floor(g / 2);
  const put = (type: string, x: number, y: number) => b.buildings.push({ id: b.nextId++, type, level: 1, x, y });
  put('hq', mid - 2, mid - 2);
  put('builder', mid + 3, mid - 2);
  put('treasury', mid - 6, mid - 2);
  put('oilwell', mid - 5, mid + 3);
  put('goldvault', mid + 3, mid + 1);
  put('radar', mid - 2, mid - 7);
  put('def_zu23', mid - 1, mid + 4);
  return b;
}

// ---------- capacity, production ----------

export function storageCap(b: Base): Record<Res, number> {
  const hq = hqLevel(b);
  const cap: Record<Res, number> = { gold: 1500 * Math.pow(1.6, hq - 1), petrol: 1000 * Math.pow(1.6, hq - 1), explosives: 600 * Math.pow(1.6, hq - 1), uranium: hq >= 5 ? 100 : 0 };
  for (const x of b.buildings) {
    const t = buildingType(x.type); if (!t?.stores || x.type === 'hq' || x.level < 1) continue;
    cap[t.stores.res] += levelStorage(t, x.level);
  }
  for (const r of RESOURCES) cap[r] = Math.round(cap[r]);
  return cap;
}

export function productionPerHour(b: Base): Record<Res, number> {
  const out: Record<Res, number> = { gold: 0, petrol: 0, explosives: 0, uranium: 0 };
  for (const x of b.buildings) {
    const t = buildingType(x.type); if (!t?.produces || x.level < 1 || x.build) continue; // upgrading producers pause
    out[t.produces.res] += levelProduction(t, x.level);
  }
  return out;
}

export const builders = (b: Base) => b.buildings.filter(x => x.type === 'builder' && x.level >= 1).length;
export const buildersBusy = (b: Base) => b.buildings.filter(x => x.build).length;

/** Advance real time: finish constructions, produce resources. */
export function baseTick(b: Base, now: number) {
  if (now <= b.lastTick) return;
  // Finish constructions in time order, producing in between (so a finished producer counts from then on).
  let t = b.lastTick;
  const done = b.buildings.filter(x => x.build && x.build.ends <= now).sort((p, q) => p.build!.ends - q.build!.ends);
  for (const x of done) { produce(b, x.build!.ends - t); t = x.build!.ends; x.level = x.build!.toLevel; x.build = undefined; }
  produce(b, now - t);
  b.lastTick = now;
}

function produce(b: Base, ms: number) {
  if (ms <= 0) return;
  const per = productionPerHour(b), cap = storageCap(b);
  for (const r of RESOURCES) {
    if (b.res[r] >= cap[r]) continue;                       // full: production waits (never removes loot above the cap)
    b.res[r] = Math.min(cap[r], b.res[r] + per[r] * ms / 3_600_000);
  }
}

// ---------- commands ----------

function fits(b: Base, size: number, x: number, y: number, ignoreId?: number): boolean {
  const g = gridSize(hqLevel(b));
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + size > g || y + size > g) return false;
  return b.buildings.every(o => {
    if (o.id === ignoreId) return true;
    const s = buildingType(o.type)!.size;
    return x + size <= o.x || o.x + s <= x || y + size <= o.y || o.y + s <= y;
  });
}

function canPay(b: Base, cost: Cost) { return RESOURCES.every(r => (cost[r] ?? 0) <= b.res[r] + 1e-9); }
function pay(b: Base, cost: Cost) { for (const r of RESOURCES) b.res[r] -= cost[r] ?? 0; }
function costText(cost: Cost) { return RESOURCES.filter(r => cost[r]).map(r => `${Math.ceil(cost[r]!)} ${RES_NAMES[r]}`).join(', '); }

export function canPlaceAt(b: Base, type: string, x: number, y: number, ignoreId?: number) {
  const t = buildingType(type); return !!t && fits(b, t.size, x, y, ignoreId);
}

export function baseCommand(b: Base, cmd: BaseCommand, now: number): BaseResult {
  baseTick(b, now);
  const hq = hqLevel(b);
  switch (cmd.c) {
    case 'place': {
      const t = buildingType(cmd.type); if (!t) return fail('Unknown building.');
      if (hq < t.unlock) return fail(`Needs Headquarters level ${t.unlock}.`);
      const have = b.buildings.filter(x => x.type === t.id).length;
      if (have >= countAt(t, hq)) return fail(`You have the most ${t.name}s allowed at this HQ level.`);
      if (!fits(b, t.size, cmd.x, cmd.y)) return fail('It doesn\'t fit there.');
      if (buildersBusy(b) >= builders(b) && t.id !== 'builder') return fail('All construction teams are busy.');
      const cost = levelCost(t, 1); if (!canPay(b, cost)) return fail(`Needs ${costText(cost)}.`);
      pay(b, cost);
      const x: BaseBuilding = { id: b.nextId++, type: t.id, level: 0, x: cmd.x, y: cmd.y, build: { toLevel: 1, started: now, ends: now + levelTime(t, 1) * 1000 } };
      b.buildings.push(x);
      return { ok: true };
    }
    case 'upgrade': {
      const x = b.buildings.find(o => o.id === cmd.id); if (!x) return fail('No such building.');
      const t = buildingType(x.type)!;
      if (x.build) return fail('Already under construction.');
      if (x.level >= t.maxLevel) return fail('Already at the top level.');
      if (x.level >= maxLevelAt(t, hq)) return fail(`Upgrade your Headquarters first (needs HQ ${x.level + t.unlock - 1}).`);
      if (buildersBusy(b) >= builders(b)) return fail('All construction teams are busy.');
      const cost = levelCost(t, x.level + 1); if (!canPay(b, cost)) return fail(`Needs ${costText(cost)}.`);
      pay(b, cost);
      x.build = { toLevel: x.level + 1, started: now, ends: now + levelTime(t, x.level + 1) * 1000 };
      return { ok: true };
    }
    case 'move': {
      const x = b.buildings.find(o => o.id === cmd.id); if (!x) return fail('No such building.');
      if (!fits(b, buildingType(x.type)!.size, cmd.x, cmd.y, x.id)) return fail('It doesn\'t fit there.');
      x.x = cmd.x; x.y = cmd.y;
      return { ok: true };
    }
    case 'speedUp': {
      const x = b.buildings.find(o => o.id === cmd.id); if (!x?.build) return fail('Nothing to speed up.');
      const cost = speedUpCost(x, now); if (b.res.gold < cost) return fail(`Needs ${cost} Gold.`);
      b.res.gold -= cost; x.level = x.build.toLevel; x.build = undefined;
      return { ok: true };
    }
    case 'produce': {
      const ok = canMake(b, cmd.weapon); if (!ok.ok) return fail(ok.why!);
      const prod = producerOf(cmd.weapon)!, n = Math.max(1, Math.floor(cmd.n));
      if (storedOf(b, prod) + n > capacityOf(b, prod)) return fail(`No room: ${buildingType(prod)!.name}s hold ${capacityOf(b, prod)} in total. Upgrade or build more.`);
      const one = weaponCost(cmd.weapon), cost: Cost = {}; for (const r of RESOURCES) if (one[r]) cost[r] = one[r]! * n;
      if (!canPay(b, cost)) return fail(`Needs ${costText(cost)}.`);
      pay(b, cost); b.arsenal = b.arsenal ?? {}; b.arsenal[cmd.weapon] = (b.arsenal[cmd.weapon] ?? 0) + n;
      return { ok: true };
    }
    case 'cancel': {
      const x = b.buildings.find(o => o.id === cmd.id); if (!x?.build) return fail('Nothing to cancel.');
      const t = buildingType(x.type)!, cost = levelCost(t, x.build.toLevel);
      for (const r of RESOURCES) b.res[r] += (cost[r] ?? 0) * 0.5; // half back, as in Clash of Clans
      if (x.level === 0) b.buildings = b.buildings.filter(o => o !== x); else x.build = undefined;
      return { ok: true };
    }
  }
  return fail('Unknown command.');
}

/** Gold to finish a construction now: 1 Gold per 2 seconds left, at least 5. */
export const speedUpCost = (x: BaseBuilding, now: number) => (x.build ? Math.max(5, Math.ceil((x.build.ends - now) / 2000)) : 0);

/** What the screen needs, in one object. */
export function baseView(b: Base, now: number) {
  const hq = hqLevel(b);
  return {
    name: b.name, hq, grid: gridSize(hq), res: { ...b.res }, cap: storageCap(b), perHour: productionPerHour(b),
    builders: builders(b), buildersBusy: buildersBusy(b), xp: b.xp,
    buildings: b.buildings.map(x => {
      const t = buildingType(x.type)!;
      return {
        id: x.id, type: x.type, level: x.level, x: x.x, y: x.y, size: t.size, name: t.name, cat: t.cat, sys: t.sys,
        building: x.build ? { toLevel: x.build.toLevel, left: Math.max(0, Math.ceil((x.build.ends - now) / 1000)), total: Math.round((x.build.ends - x.build.started) / 1000), speedUp: speedUpCost(x, now) } : null,
        nextCost: x.level < Math.min(t.maxLevel, maxLevelAt(t, hq)) ? levelCost(t, x.level + 1) : null,
        nextTime: x.level < t.maxLevel ? levelTime(t, x.level + 1) : null,
        maxed: x.level >= t.maxLevel, hqLocked: x.level < t.maxLevel && x.level >= maxLevelAt(t, hq),
        hp: levelHp(t, Math.max(1, x.level)),
      };
    }),
    arsenal: { ...(b.arsenal ?? {}) }, raids: b.raids ?? { won: 0, lost: 0 },
    production: Object.keys(PRODUCTION).map(prod => ({ prod, cap: capacityOf(b, prod), stored: storedOf(b, prod),
      weapons: PRODUCTION[prod].map(w => ({ id: w, cost: weaponCost(w), have: b.arsenal?.[w] ?? 0, ...canMake(b, w) })) })),
    shop: BUILDING_TYPES.map(t => ({ id: t.id, name: t.name, cat: t.cat, size: t.size, unlock: t.unlock, role: t.role, sys: t.sys, cost: levelCost(t, 1), time: levelTime(t, 1),
      have: b.buildings.filter(x => x.type === t.id).length, allowed: countAt(t, hq), locked: hq < t.unlock,
      produces: t.produces ? { res: t.produces.res, perHour: Math.round(levelProduction(t, 1)) } : null, stores: t.stores ? { res: t.stores.res, cap: Math.round(levelStorage(t, 1)) } : null })),
  };
}
