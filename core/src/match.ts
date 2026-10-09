import {
  ATTACKS, BUILDINGS, CITY_RADIUS, DEFENCES, DEF_UPGRADE, ECONOMY, EXTRA_RADAR_PRICE, FINANCE_PENALTY,
  LONG_RANGE_SAMS, OFF_UPGRADES, POWER_RADAR_PENALTY, RADAR_LEVELS, RULES, SCOUTS, SPAWN_DISTANCE,
  attack, defence, scout, type BuildingKind, type ThreatClass,
} from './data';
import { nextRandom } from './rng';
import { buildingSlots, padLayout } from './geometry';
import type {
  Battery, Battle, BattleEvent, Building, Command, CommandResult, Interceptor, Match, Pad, PlayerIndex,
  PlayerState, Point, Threat,
} from './types';

const MISSILE_CLASSES: ThreatClass[] = ['rocket', 'cruise', 'ballistic', 'hypersonic'];
const REPORT_SECONDS = 6;
const RELOAD_SECONDS = 5;
const CHEAP_THREATS: ThreatClass[] = ['drone', 'decoy'];
const EXPENSIVE_SHOT = 1.0; // auto-fire never spends a shot this dear on drones/decoys (priority overrides)

const rnd = (m: Match) => nextRandom(m);
const uid = (m: Match) => m.nextUid++;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const round = (v: number) => Math.round(v * 1000) / 1000;
const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

// ---------- creation ----------

const SLOTS = buildingSlots();

function freeSpot(m: Match, p: PlayerState): Point | undefined {
  const free = SLOTS.filter(s => !p.buildings.some(b => dist(b, s) < 0.05));
  if (!free.length) return undefined;
  return free[Math.floor(rnd(m) * free.length) % free.length];
}

function addBuilding(m: Match, p: PlayerState, kind: BuildingKind): Building | undefined {
  const spot = freeSpot(m, p);
  if (!spot) return undefined;
  const b: Building = { uid: uid(m), kind, x: spot.x, z: spot.z, down: 0, revealed: false, battleDamage: 0 };
  p.buildings.push(b);
  return b;
}

function newPlayer(index: PlayerIndex, name: string, isAI: boolean): PlayerState {
  return {
    index, name, isAI, budget: RULES.startBudget, health: RULES.cityHealth,
    pads: padLayout(), scars: [], batteries: [], buildings: [], interceptors: {}, launchers: {}, stock: {}, scouts: {},
    launched: {}, offUp: {}, econ: { income: 0, storage: 0, logistics: 0, repair: 0 },
    radar: { range: 0, identify: 0, decoy: 0 }, autoFire: true, reloadsLeft: 0, spent: 0, conceded: false, ready: false, restock: {},
  };
}

export function createMatch(seed: number, names: [string, string], ai: [boolean, boolean] = [false, false]): Match {
  const m: Match = {
    version: 1, rng: seed | 0, time: 0, phase: 'setup', phaseEndsAt: RULES.setupSeconds, active: 0, turnNo: 0,
    weatherBad: false, players: [newPlayer(0, names[0], ai[0]), newPlayer(1, names[1], ai[1])], nextUid: 1, log: [],
  };
  for (const p of m.players) for (const b of BUILDINGS) addBuilding(m, p, b.kind);
  return m;
}

// ---------- helpers ----------

const working = (p: PlayerState, kind: BuildingKind) => p.buildings.some(b => b.kind === kind && b.down === 0);
const powerOn = (p: PlayerState) => working(p, 'power');

export function incomeFor(p: PlayerState): number {
  const base = RULES.income + ECONOMY.income.values[p.econ.income];
  return working(p, 'finance') ? base : round(base * (1 - FINANCE_PENALTY));
}

export function radarRange(p: PlayerState): number {
  if (!working(p, 'radar')) return RULES.visualRange;
  const r = RADAR_LEVELS.range[p.radar.range];
  return powerOn(p) ? r : r * (1 - POWER_RADAR_PENALTY);
}

export function launchCap(p: PlayerState, weapon: string): number {
  const w = attack(weapon);
  if (w.reusable) return p.stock[weapon] ?? 0;
  const cap = (p.offUp[weapon]?.capacity ?? 0) * 0.5 + 1;
  return Math.floor((p.launchers[weapon] ?? 0) * w.perTurn * cap);
}

export function storedUnits(p: PlayerState): number {
  let n = 0;
  for (const k in p.interceptors) n += p.interceptors[k];
  for (const k in p.stock) if (!attack(k).reusable) n += p.stock[k];
  return n;
}

export function batteryLoad(b: Battery): number {
  const s = defence(b.sys);
  return Math.round(s.load * (1 + DEF_UPGRADE.loadBonus * (b.level - 1)));
}

export function upgradeBatteryCost(b: Battery): number | null {
  if (b.level >= 3) return null;
  return round(defence(b.sys).price * DEF_UPGRADE.costFactor[b.level + 1]);
}

function spend(p: PlayerState, amount: number): boolean {
  if (amount > p.budget + 1e-9) return false;
  p.budget = round(p.budget - amount);
  p.spent = round(p.spent + amount);
  return true;
}

function log(m: Match, text: string) {
  m.log.push({ time: round(m.time), text });
  if (m.log.length > 60) m.log.shift();
}

function canShop(m: Match, p: PlayerIndex): boolean {
  return m.phase === 'setup' || (m.phase === 'turn' && m.active === p);
}

// ---------- commands ----------

const fail = (error: string): CommandResult => ({ ok: false, error });
const ok: CommandResult = { ok: true };

export function command(m: Match, pi: PlayerIndex, cmd: Command): CommandResult {
  const p = m.players[pi];
  if (m.phase === 'over') return fail('The match is over.');
  if (cmd.c === 'concede') { p.conceded = true; finish(m, other(pi), 'conceded'); return ok; }

  // Battle-time controls (defender only).
  if (cmd.c === 'setAutoFire' || cmd.c === 'priority' || cmd.c === 'holdThreat' || cmd.c === 'holdBattery') {
    if (cmd.c === 'setAutoFire') { p.autoFire = cmd.on; return ok; }
    if (cmd.c === 'holdBattery') {
      const b = p.batteries.find(x => x.uid === cmd.uid); if (!b) return fail('No such battery.');
      b.holdFire = !b.holdFire; return ok;
    }
    const bt = m.battle;
    if (!bt || bt.defender !== pi) return fail('Only the defender can do that during a strike.');
    const t = bt.threats.find(x => x.uid === cmd.uid && x.alive && x.detected); if (!t) return fail('Contact lost.');
    if (cmd.c === 'priority') { t.priority = !t.priority; if (t.priority) t.hold = false; }
    else { t.hold = !t.hold; if (t.hold) t.priority = false; }
    return ok;
  }

  if (cmd.c === 'continue') {
    if (m.phase === 'report') { startTurn(m, other(m.lastReport!.attacker)); return ok; }
    return fail('Nothing to continue.');
  }
  if (cmd.c === 'endSetup') {
    if (m.phase !== 'setup') return fail('Setup is over.');
    p.ready = true;
    if (m.players.every(q => q.ready)) startTurn(m, 0);
    return ok;
  }
  if (cmd.c === 'wait') {
    if (m.phase !== 'turn' || m.active !== pi) return fail('Not your turn.');
    log(m, `${p.name} holds fire and saves money.`);
    startTurn(m, other(pi));
    return ok;
  }
  if (cmd.c === 'go') {
    if (m.phase !== 'turn' || m.active !== pi) return fail('Not your turn.');
    return launch(m, pi, cmd.strikes, cmd.scouts, cmd.bearing);
  }

  if (cmd.c === 'setRestock') {
    const s = DEFENCES.find(x => x.id === cmd.sys); if (!s || s.load === 0) return fail('That system needs no missiles.');
    p.restock[s.id] = Math.max(0, Math.min(99, Math.floor(cmd.n)));
    return ok;
  }
  if (!canShop(m, pi)) return fail('You can buy only during setup or your own turn.');
  const factoryUp = working(p, 'factory');

  switch (cmd.c) {
    case 'buyBattery': {
      const s = DEFENCES.find(x => x.id === cmd.sys); if (!s) return fail('Unknown system.');
      if (!p.pads.some(x => x.id === cmd.pad)) return fail('No such pad.');
      if (p.batteries.some(b => b.pad === cmd.pad)) return fail('That pad is taken.');
      if (!spend(p, s.price)) return fail('Not enough budget.');
      p.batteries.push({ uid: uid(m), sys: s.id, pad: cmd.pad, level: 1, ammo: s.load, cooldown: 0, reloading: 0, holdFire: false, revealed: false, kills: 0, dwell: 0 });
      if (s.load > 0 && p.restock[s.id] == null) p.restock[s.id] = s.load; // default: keep one full reload spare
      return ok;
    }
    case 'upgradeBattery': {
      const b = p.batteries.find(x => x.uid === cmd.uid); if (!b) return fail('No such battery.');
      const cost = upgradeBatteryCost(b); if (cost == null) return fail('Already at the top level.');
      if (!spend(p, cost)) return fail('Not enough budget.');
      b.level++; b.ammo = Math.min(batteryLoad(b), b.ammo + Math.round(defence(b.sys).load * DEF_UPGRADE.loadBonus));
      return ok;
    }
    case 'sellBattery': {
      const i = p.batteries.findIndex(x => x.uid === cmd.uid); if (i < 0) return fail('No such battery.');
      const b = p.batteries[i];
      p.budget = round(p.budget + defence(b.sys).price * 0.5);
      p.batteries.splice(i, 1);
      return ok;
    }
    case 'buyInterceptors': {
      const s = DEFENCES.find(x => x.id === cmd.sys); if (!s || s.load === 0) return fail('That system needs no interceptors.');
      if (!factoryUp) return fail('Missile factory is knocked out.');
      const n = Math.max(1, Math.floor(cmd.n));
      if (!spend(p, s.shot * n)) return fail('Not enough budget.');
      p.interceptors[s.id] = (p.interceptors[s.id] ?? 0) + n;
      return ok;
    }
    case 'buyLauncher': {
      const w = ATTACKS.find(x => x.id === cmd.weapon); if (!w || w.reusable) return fail('No launcher needed.');
      if (!spend(p, w.launcher)) return fail('Not enough budget.');
      p.launchers[w.id] = (p.launchers[w.id] ?? 0) + 1;
      return ok;
    }
    case 'buyUnits': {
      const w = ATTACKS.find(x => x.id === cmd.weapon); if (!w) return fail('Unknown weapon.');
      if (!w.reusable && !factoryUp) return fail('Missile factory is knocked out.');
      const n = Math.max(1, Math.floor(cmd.n));
      if (!spend(p, w.unit * n)) return fail('Not enough budget.');
      p.stock[w.id] = (p.stock[w.id] ?? 0) + n;
      return ok;
    }
    case 'buyScout': {
      const s = SCOUTS.find(x => x.id === cmd.scout); if (!s) return fail('Unknown UAV.');
      if (!spend(p, s.price)) return fail('Not enough budget.');
      p.scouts[s.id] = (p.scouts[s.id] ?? 0) + 1;
      return ok;
    }
    case 'upgradeOffence': {
      const w = ATTACKS.find(x => x.id === cmd.weapon); const tr = OFF_UPGRADES[cmd.track];
      if (!w || !tr) return fail('Unknown upgrade.');
      const lv = p.offUp[w.id]?.[cmd.track] ?? 0; if (lv >= 3) return fail('Already at the top level.');
      if (!spend(p, tr.cost[lv])) return fail('Not enough budget.');
      p.offUp[w.id] = { ...p.offUp[w.id], [cmd.track]: lv + 1 };
      return ok;
    }
    case 'upgradeEconomy': {
      const tr = ECONOMY[cmd.track]; if (!tr) return fail('Unknown upgrade.');
      const lv = p.econ[cmd.track]; if (lv >= tr.cost.length) return fail('Already at the top level.');
      if (!spend(p, tr.cost[lv])) return fail('Not enough budget.');
      p.econ[cmd.track] = lv + 1;
      return ok;
    }
    case 'upgradeRadar': {
      const lv = p.radar[cmd.track]; if (lv >= 3) return fail('Already at the top level.');
      if (!spend(p, RADAR_LEVELS.cost[lv + 1])) return fail('Not enough budget.');
      p.radar[cmd.track] = lv + 1;
      return ok;
    }
    case 'buyRadarSite': {
      if (!freeSpot(m, p)) return fail('No free plot left in the city.');
      if (!spend(p, EXTRA_RADAR_PRICE)) return fail('Not enough budget.');
      addBuilding(m, p, 'radar');
      return ok;
    }
    case 'repairNow': {
      const b = p.buildings.find(x => x.uid === cmd.uid); if (!b || b.down === 0) return fail('Nothing to repair.');
      const cost = BUILDINGS.find(x => x.kind === b.kind)!.repairNow;
      if (!spend(p, cost)) return fail('Not enough budget.');
      b.down = 0;
      return ok;
    }
  }
  return fail('Unknown command.');
}

// ---------- turns ----------

function startTurn(m: Match, who: PlayerIndex) {
  m.phase = 'turn';
  m.active = who;
  m.turnNo++;
  m.battle = undefined;
  const p = m.players[who];
  for (const b of p.buildings) if (b.down > 0) b.down--;
  const commandHit = !working(p, 'command');
  p.budget = round(p.budget + incomeFor(p));
  autoRestock(p);
  p.launched = {};
  m.weatherBad = rnd(m) < RULES.badWeatherChance;
  m.phaseEndsAt = m.time + (commandHit ? RULES.turnSecondsCommandHit : RULES.turnSeconds);
  log(m, `Turn ${m.turnNo}: ${p.name}. +$${incomeFor(p)}M income.${commandHit ? ' Command centre down: 30 s.' : ''}`);
}

/** Standing order: top up spare interceptors to the chosen level, as far as money allows. */
function autoRestock(p: PlayerState) {
  let n = 0, cost = 0, short = false;
  if (!working(p, 'factory')) { p.lastRestock = { n: 0, cost: 0, short: true }; return; }
  for (const sys in p.restock) {
    if (!p.batteries.some(b => b.sys === sys)) continue;
    const s = defence(sys), need = p.restock[sys] - (p.interceptors[sys] ?? 0);
    if (need <= 0) continue;
    const afford = Math.min(need, Math.floor((p.budget + 1e-9) / s.shot));
    if (afford < need) short = true;
    if (afford <= 0) continue;
    p.budget = round(p.budget - afford * s.shot); p.spent = round(p.spent + afford * s.shot);
    p.interceptors[sys] = (p.interceptors[sys] ?? 0) + afford;
    n += afford; cost = round(cost + afford * s.shot);
  }
  p.lastRestock = { n, cost, short };
}

function finish(m: Match, winner: PlayerIndex, reason: Match['endReason']) {
  m.phase = 'over';
  m.winner = winner;
  m.endReason = reason;
  m.battle = undefined;
  log(m, `${m.players[winner].name} wins (${reason}).`);
}

// ---------- launching a strike ----------

function launch(m: Match, pi: PlayerIndex, strikes: { weapon: string; n: number; target?: number }[], scouts: { scout: string; path: Point[] }[], bearing?: number): CommandResult {
  const att = m.players[pi], def = m.players[other(pi)];
  const airbase = working(att, 'airbase');
  // Check everything first so a bad order launches nothing.
  const want: Record<string, number> = {};
  for (const s of strikes) {
    const w = ATTACKS.find(x => x.id === s.weapon); if (!w) return fail('Unknown weapon.');
    const n = Math.floor(s.n); if (n <= 0) continue;
    if (w.cls === 'uav' && !airbase) return fail('Airbase is knocked out: UAVs cannot take off.');
    want[w.id] = (want[w.id] ?? 0) + n;
    if (s.target != null && !def.buildings.some(b => b.uid === s.target && b.revealed)) return fail('That target has not been revealed.');
  }
  for (const id in want) {
    if ((att.stock[id] ?? 0) < want[id]) return fail(`Not enough ${attack(id).name} in stock.`);
    if (want[id] > launchCap(att, id)) return fail(`${attack(id).name}: launch capacity is ${launchCap(att, id)} this turn.`);
  }
  const wantScouts: Record<string, number> = {};
  for (const s of scouts) {
    if (!SCOUTS.some(x => x.id === s.scout)) return fail('Unknown UAV.');
    if (!airbase) return fail('Airbase is knocked out: UAVs cannot take off.');
    wantScouts[s.scout] = (wantScouts[s.scout] ?? 0) + 1;
    if ((att.scouts[s.scout] ?? 0) < wantScouts[s.scout]) return fail(`No ${scout(s.scout).name} available.`);
    if (s.path.length < 1) return fail('Draw a path for the UAV.');
  }
  if (Object.keys(want).length === 0 && scouts.length === 0) return fail('Nothing to launch.');

  // Munitions on armed UAVs are paid at launch.
  let munitionCost = 0;
  for (const id in want) { const w = attack(id); if (w.munitionCost) munitionCost += w.munitionCost * (w.munitions ?? 0) * want[id]; }
  if (!spend(att, munitionCost)) return fail('Not enough budget for the UAV munitions.');

  const bt: Battle = {
    attacker: pi, defender: other(pi), bearing: Number.isFinite(bearing) ? (bearing as number) : NORTH, time: 0, threats: [], interceptors: [], events: [],
    stats: { launched: 0, stopped: 0, hits: 0, damage: 0, interceptorsUsed: 0, defenceSpent: 0, attackSpent: munitionCost },
    over: false,
  };
  m.battle = bt;
  m.phase = 'battle';
  def.reloadsLeft = ECONOMY.logistics.values[def.econ.logistics];
  for (const b of def.batteries) { b.cooldown = 0; b.reloading = 0; b.dwell = 0; b.dwellTarget = undefined; topUp(def, b); }
  for (const b of def.buildings) b.battleDamage = 0;

  for (const s of strikes) {
    const w = attack(s.weapon); const n = Math.floor(s.n); if (n <= 0) continue;
    att.stock[w.id] -= n;
    att.launched[w.id] = (att.launched[w.id] ?? 0) + n;
    for (let i = 0; i < n; i++) {
      if (w.salvo) for (let r = 0; r < w.salvo; r++) spawnStrike(m, bt, att, def, w.id, s.target, rnd(m) * 4);
      else spawnStrike(m, bt, att, def, w.id, s.target, rnd(m) * 8);
    }
    bt.stats.attackSpent = round(bt.stats.attackSpent + (w.reusable ? 0 : w.unit * n));
  }
  for (const s of scouts) { att.scouts[s.scout]--; spawnScout(m, bt, s.scout, s.path); }
  bt.stats.launched = bt.threats.length;
  log(m, `${att.name} launches ${bt.threats.length} contacts at ${def.name}.`);
  return ok;
}

function topUp(p: PlayerState, b: Battery) {
  const s = defence(b.sys); if (s.load === 0) return;
  const need = batteryLoad(b) - b.ammo; if (need <= 0) return;
  const have = p.interceptors[s.id] ?? 0; const n = Math.min(need, have);
  b.ammo += n; p.interceptors[s.id] = have - n;
}

const NORTH = -Math.PI / 2;
function spawnPoint(m: Match, d = SPAWN_DISTANCE): Point {
  const a = (m.battle?.bearing ?? NORTH) + (rnd(m) - 0.5) * (Math.PI / 4.5); // from the chosen side, ±20°
  return { x: round(Math.cos(a) * d), z: round(Math.sin(a) * d) };
}

function randomCityPoint(m: Match, inside: boolean): Point {
  const a = rnd(m) * Math.PI * 2;
  const r = inside ? Math.sqrt(rnd(m)) * CITY_RADIUS : CITY_RADIUS + 0.5 + rnd(m) * 4;
  return { x: round(Math.cos(a) * r), z: round(Math.sin(a) * r) };
}

function baseThreat(m: Match): Threat {
  return {
    uid: uid(m), weapon: '', cls: 'drone', looksLike: 'drone', isScout: false, path: [], leg: 0, speed: 0,
    speedIn: 0, x: 0, z: 0, alt: 0, peakAlt: 0, traveled: 0, total: 0, delay: 0, alive: true, landed: false, landsInCity: false,
    damage: 0, precise: false, low: false, detected: false, identified: false, decoyMarked: false, priority: false,
    hold: false, engaged: 0, ewChecked: false, returning: false, munitions: 0, dropCooldown: 0, revealRadius: 0,
    spawnedDecoys: false, stealth: 0,
  };
}

const TERMINAL = 20; // km: the last 20 km take half the flight time

const MISSILE_START = 2 * TERMINAL; // missiles fly at one steady speed, launched 40 km out

function setSpeeds(t: Threat, from: Point, flight: number) {
  const d = Math.hypot(from.x, from.z);
  if (MISSILE_CLASSES.includes(t.cls)) { t.speed = t.speedIn = d / flight; return; }
  const inner = Math.min(TERMINAL, d), outer = d - inner;
  if (outer > 0) { t.speed = outer / (flight / 2); t.speedIn = inner / (flight / 2); }
  else { t.speed = t.speedIn = d / flight; }
}
const speedNow = (t: Threat) => (Math.hypot(t.x, t.z) > TERMINAL ? t.speed : t.speedIn);

const SPAWN_DIST: Record<string, number> = { kargu: 30, grad: 40, himars: 80, trg300: 100 };
const PEAK: Record<ThreatClass, number> = { drone: 0.3, decoy: 0.3, uav: 5, rocket: 12, cruise: 0.05, ballistic: 80, hypersonic: 25 };

function spawnStrike(m: Match, bt: Battle, att: PlayerState, def: PlayerState, weapon: string, target: number | undefined, delay: number) {
  const w = attack(weapon);
  const up = att.offUp[weapon] ?? {};
  const start = spawnPoint(m, MISSILE_CLASSES.includes(w.cls) ? Math.min(SPAWN_DIST[weapon] ?? MISSILE_START, MISSILE_START) : SPAWN_DIST[weapon] ?? SPAWN_DISTANCE);
  const t = baseThreat(m);
  t.weapon = weapon; t.cls = w.cls; t.looksLike = w.imitates ?? w.cls; t.delay = delay;
  t.precise = w.precise; t.low = !!w.low; t.stealth = (up.stealth ?? 0) * 5;
  t.damage = round(w.damage * (1 + 0.15 * (up.warhead ?? 0)));
  t.peakAlt = PEAK[w.cls];
  let aim: Point;
  const tb = target != null ? def.buildings.find(b => b.uid === target) : undefined;
  if (w.cls === 'decoy') { aim = randomCityPoint(m, true); t.landsInCity = false; }
  else if (w.precise) {
    let miss = Math.max(0, 0.1 - 0.1 * (up.guidance ?? 0));
    if (w.cls === 'cruise' && def.batteries.some(b => b.sys === 'koral') && powerOn(def)) miss += 0.2;
    if (rnd(m) < miss) { aim = randomCityPoint(m, rnd(m) < 0.5); }
    else if (tb) { aim = { x: tb.x, z: tb.z }; t.targetBuilding = tb.uid; }
    else aim = randomCityPoint(m, true);
  } else {
    const share = Math.min(1, (w.scatter ?? 1) + 0.1 * (up.guidance ?? 0));
    aim = randomCityPoint(m, rnd(m) < share);
  }
  t.landsInCity = w.cls !== 'decoy' && Math.hypot(aim.x, aim.z) <= CITY_RADIUS;
  if (w.cls === 'uav') {
    t.munitions = w.munitions ?? 0;
    t.path = [start, tb ? { x: tb.x, z: tb.z } : randomCityPoint(m, true), start];
    t.targetBuilding = tb?.uid;
  } else t.path = [start, aim];
  t.x = start.x; t.z = start.z;
  setSpeeds(t, start, w.flight);
  if (MISSILE_CLASSES.includes(w.cls)) t.peakAlt = Math.min(t.peakAlt, Math.hypot(start.x, start.z) * 0.3); // arc height fits the flight
  t.total = dist(t.path[0], t.path[1]);
  bt.threats.push(t);
}

function spawnScout(m: Match, bt: Battle, id: string, path: Point[]) {
  const s = scout(id);
  // Enter along the drawn line: come in from far out, beyond its first point.
  const p0 = path[0], p1 = path[1] ?? { x: 0, z: 0 };
  let dx = p0.x - p1.x, dz = p0.z - p1.z; const len = Math.hypot(dx, dz);
  if (len < 0.01) { const a = m.battle?.bearing ?? NORTH; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= len; dz /= len; }
  const start = { x: round(p0.x + dx * SPAWN_DISTANCE), z: round(p0.z + dz * SPAWN_DISTANCE) };
  const t = baseThreat(m);
  t.weapon = id; t.cls = 'uav'; t.looksLike = 'uav'; t.isScout = true; t.delay = rnd(m) * 3;
  t.peakAlt = s.altitude === 'medium' ? 5 : s.altitude === 'high' ? 9 : 18;
  t.revealRadius = s.reveal;
  t.path = [start, ...path.map(p => ({ x: round(p.x), z: round(p.z) })), start];
  t.x = start.x; t.z = start.z;
  setSpeeds(t, start, s.flight);
  t.total = dist(start, t.path[1]);
  bt.threats.push(t);
}

// ---------- battle simulation ----------

const STEP = 0.1;

export function tick(m: Match, dt: number) {
  let left = dt;
  while (left > 1e-9) {
    const s = Math.min(STEP, left);
    step(m, s);
    left -= s;
  }
}

function step(m: Match, dt: number) {
  m.time = round(m.time + dt);
  if (m.phase === 'setup' && m.time >= m.phaseEndsAt) startTurn(m, 0);
  else if (m.phase === 'turn' && m.time >= m.phaseEndsAt) { log(m, `${m.players[m.active].name} ran out of time.`); startTurn(m, other(m.active)); }
  else if (m.phase === 'report' && m.time >= m.phaseEndsAt) startTurn(m, other(m.lastReport!.attacker));
  else if (m.phase === 'battle' && m.battle) battleStep(m, m.battle, dt);
}

function emit(bt: Battle, e: BattleEvent) { bt.events.push(e); if (bt.events.length > 400) bt.events.shift(); }

function hitChance(m: Match, def: PlayerState, b: Battery, t: Threat): number {
  const s = defence(b.sys);
  let cls: ThreatClass = t.cls;
  if (t.isScout) {
    const sc = scout(t.weapon);
    if (sc.onlyLongRange && !LONG_RANGE_SAMS.includes(s.id)) return 0;
    let p = s.hit.uav ?? 0; if (p === 0) return 0;
    if (sc.altitude === 'high' && s.range < 40) p -= 25;
    return clampHit(p + (b.level - 1) * 8);
  }
  if (t.weapon === 'decoy') cls = 'decoy';
  let p = s.hit[cls] ?? 0;
  if (p === 0) return 0;
  if (s.lowCruisePenalty && t.low) p -= s.lowCruisePenalty;
  if (s.weatherHit && m.weatherBad) p *= 0.5;
  p += (b.level - 1) * 8 - t.stealth;
  return clampHit(p);
}
const clampHit = (p: number) => Math.max(0, Math.min(98, p));

function batteryReady(def: PlayerState, b: Battery): boolean {
  const s = defence(b.sys);
  if (b.holdFire) return false;
  if (s.needsPower && !powerOn(def)) return false;
  return true;
}

function battleStep(m: Match, bt: Battle, dt: number) {
  const att = m.players[bt.attacker], def = m.players[bt.defender];
  bt.time = round(bt.time + dt);
  const rr = radarRange(def);
  const idR = working(def, 'radar') ? RADAR_LEVELS.identify[def.radar.identify] : 5;
  const decoyR = working(def, 'radar') ? RADAR_LEVELS.decoy[def.radar.decoy] : 0;

  // Move threats.
  for (const t of bt.threats) {
    if (!t.alive) continue;
    if (t.delay > 0) { t.delay -= dt; continue; }
    moveThreat(m, bt, att, def, t, dt);
    if (!t.alive) continue;
    const r = Math.hypot(t.x, t.z);
    if (!t.detected && r <= rr) t.detected = true;
    if (t.detected && !t.identified && r <= idR) t.identified = true;
    if (t.detected && !t.decoyMarked && (t.cls === 'decoy' || t.weapon === 'decoy') && decoyR > 0 && r <= decoyR) t.decoyMarked = true;
    // Electronic warfare: one roll as the contact enters Koral range.
    if (!t.ewChecked) {
      const ew = def.batteries.find(b => b.sys === 'koral' && batteryReady(def, b) && dist(def.pads[b.pad], t) <= defence('koral').range);
      if (ew) {
        t.ewChecked = true;
        const p = (defence('koral').hit[t.cls] ?? 0) / 100;
        if (p > 0 && rnd(m) < p) {
          if (t.cls === 'uav') { t.returning = true; t.munitions = 0; turnBack(t); emit(bt, { t: 'msg', text: `Koral turned back a ${t.isScout ? 'scout' : 'UAV'}.`, tone: 'good' }); }
          else { kill(bt, t, def, ew); }
        }
      }
    }
  }

  // Defences.
  for (const b of def.batteries) {
    const s = defence(b.sys);
    if (s.kind === 'ew') continue;
    if (b.reloading > 0) { b.reloading -= dt; if (b.reloading <= 0) { topUp(def, b); b.reloading = 0; } continue; }
    if (b.cooldown > 0) { b.cooldown -= dt; continue; }
    if (!batteryReady(def, b)) continue;
    if (s.load > 0 && b.ammo <= 0) {
      if ((def.interceptors[s.id] ?? 0) > 0 && def.reloadsLeft > 0) { def.reloadsLeft--; b.reloading = RELOAD_SECONDS; }
      continue;
    }
    const pad = def.pads[b.pad];
    const target = pickTarget(m, bt, def, b, pad);
    if (!target) { if (s.kind === 'laser') { b.dwell = 0; b.dwellTarget = undefined; } continue; }
    fire(m, bt, def, b, pad, target, dt);
  }

  // Interceptors in flight.
  for (const it of bt.interceptors) {
    const t = bt.threats.find(x => x.uid === it.target);
    if (!t || !t.alive) { it.target = -1; continue; }
    const dx = t.x - it.x, dz = t.z - it.z, da = t.alt - it.alt;
    const d3 = Math.hypot(dx, dz, da);
    const move = Math.max(it.speed, speedNow(t) * 1.5) * dt; // game time is compressed: interceptors keep up with what they chase
    if (d3 <= move) {
      t.engaged = Math.max(0, t.engaged - 1);
      const b = def.batteries.find(x => x.uid === it.battery);
      const p = b ? hitChance(m, def, b, t) : 0;
      if (rnd(m) * 100 < p) kill(bt, t, def, b);
      else emit(bt, { t: 'miss', x: t.x, z: t.z, alt: t.alt });
      it.target = -1;
    } else { it.x += (dx / d3) * move; it.z += (dz / d3) * move; it.alt += (da / d3) * move; }
  }
  bt.interceptors = bt.interceptors.filter(i => i.target >= 0);

  if (def.health <= 0) { def.health = 0; finish(m, bt.attacker, 'destroyed'); return; }
  if (bt.threats.every(t => !t.alive) && bt.interceptors.length === 0) endBattle(m, bt);
}

function turnBack(t: Threat) {
  const home = t.path[0];
  t.path = [{ x: t.x, z: t.z }, home];
  t.leg = 0; t.traveled = 0; t.total = dist(t.path[0], t.path[1]);
}

function moveThreat(m: Match, bt: Battle, att: PlayerState, def: PlayerState, t: Threat, dt: number) {
  let move = speedNow(t) * dt;
  while (move > 0 && t.alive) {
    const a = t.path[t.leg], b = t.path[t.leg + 1];
    if (!b) break;
    const legLen = dist(a, b);
    const left = legLen - t.traveled;
    if (move < left) { t.traveled += move; move = 0; }
    else { move -= left; t.traveled = 0; t.leg++; arrive(m, bt, att, def, t); }
  }
  if (!t.alive) return;
  const a = t.path[t.leg], b = t.path[t.leg + 1] ?? a;
  const legLen = dist(a, b) || 1;
  const u = Math.min(1, t.traveled / legLen);
  t.x = round(a.x + (b.x - a.x) * u); t.z = round(a.z + (b.z - a.z) * u);
  // Altitude profile.
  if (t.cls === 'rocket' || t.cls === 'ballistic' || t.cls === 'hypersonic' || t.weapon === 'decoy') t.alt = round(t.peakAlt * 4 * u * (1 - u) + (t.cls === 'hypersonic' ? 2 * (1 - u) : 0));
  else if (t.cls === 'cruise') t.alt = 0.05;
  else t.alt = t.peakAlt;
  // Iskander decoys near the end.
  if (t.weapon === 'iskander' && !t.spawnedDecoys && u > 0.6) {
    t.spawnedDecoys = true;
    for (let i = 0; i < (attack('iskander').decoysAtEnd ?? 0); i++) {
      const d = baseThreat(m);
      d.weapon = 'decoy'; d.cls = 'decoy'; d.looksLike = 'ballistic'; d.peakAlt = t.alt;
      const aim = randomCityPoint(m, true);
      d.path = [{ x: t.x, z: t.z }, aim]; d.x = t.x; d.z = t.z; d.alt = t.alt;
      d.total = dist(d.path[0], aim); d.speed = t.speed; d.speedIn = t.speedIn; d.detected = t.detected; d.identified = t.identified;
      bt.threats.push(d);
    }
  }
  // Scouts and UAVs reveal what's under them.
  if ((t.isScout || t.cls === 'uav') && Math.hypot(t.x, t.z) < CITY_RADIUS + 3) {
    const rr = t.isScout ? t.revealRadius : 1;
    for (const bd of def.buildings) if (!bd.revealed && dist(bd, t) <= rr) { bd.revealed = true; emit(bt, { t: 'reveal', building: bd.uid }); }
    for (const bb of def.batteries) if (!bb.revealed && dist(def.pads[bb.pad], t) <= rr) bb.revealed = true;
  }
  // Armed UAVs drop munitions while over the target area.
  if (!t.isScout && t.cls === 'uav' && t.leg === 1 && !t.returning && t.munitions > 0) {
    t.dropCooldown -= dt;
    if (t.dropCooldown <= 0 && t.traveled < 0.5) {
      t.dropCooldown = 2;
      t.munitions--;
      const w = attack(t.weapon);
      const up = att.offUp[t.weapon] ?? {};
      const tb = t.targetBuilding != null ? def.buildings.find(x => x.uid === t.targetBuilding) : undefined;
      const pt = tb && rnd(m) > 0.1 ? { x: tb.x, z: tb.z } : randomCityPoint(m, true);
      impact(m, bt, def, pt, round(w.damage * (1 + 0.15 * (up.warhead ?? 0))), tb && pt.x === tb.x && pt.z === tb.z ? tb.uid : undefined);
      if (t.munitions === 0) { t.leg = 1; t.traveled = 0; }
    }
    if (t.munitions > 0) t.traveled = Math.min(t.traveled, 0.4); // loiter over the target until empty
  }
}

function arrive(m: Match, bt: Battle, att: PlayerState, def: PlayerState, t: Threat) {
  const last = t.leg >= t.path.length - 1;
  if (t.cls === 'uav' || t.isScout) {
    if (last) {
      t.alive = false; t.landed = true;
      if (t.isScout) att.scouts[t.weapon] = (att.scouts[t.weapon] ?? 0) + 1;
      else att.stock[t.weapon] = (att.stock[t.weapon] ?? 0) + 1;
      return;
    }
    const a = t.path[t.leg], b = t.path[t.leg + 1];
    t.total = dist(a, b);
    return;
  }
  t.alive = false; t.landed = true;
  if (t.cls === 'decoy' || t.weapon === 'decoy') return;
  const pt = t.path[t.path.length - 1];
  if (!t.landsInCity) { emit(bt, { t: 'impact', x: pt.x, z: pt.z, damage: 0 }); return; }
  let bUid = t.targetBuilding;
  if (bUid == null) { const near = def.buildings.find(b => dist(b, pt) <= RULES.buildingHitRadius); bUid = near?.uid; }
  impact(m, bt, def, pt, t.damage, bUid);
}

function impact(m: Match, bt: Battle, def: PlayerState, pt: Point, damage: number, buildingUid?: number) {
  def.health = round(def.health - damage);
  def.scars.push({ x: pt.x, z: pt.z, d: damage });
  if (def.scars.length > 300) def.scars.shift();
  bt.stats.hits++; bt.stats.damage = round(bt.stats.damage + damage);
  emit(bt, { t: 'impact', x: pt.x, z: pt.z, damage, building: buildingUid });
  if (buildingUid == null) return;
  const b = def.buildings.find(x => x.uid === buildingUid); if (!b) return;
  if (!b.revealed) { b.revealed = true; emit(bt, { t: 'reveal', building: b.uid }); }
  b.battleDamage += damage;
  if (b.down === 0 && b.battleDamage >= RULES.knockoutDamage) {
    b.down = ECONOMY.repair.values[def.econ.repair];
    const name = BUILDINGS.find(x => x.kind === b.kind)!.name;
    emit(bt, { t: 'knockout', building: b.uid, kind: b.kind });
    emit(bt, { t: 'msg', text: `${name} knocked out.`, tone: 'bad' });
    if (b.kind === 'depot') loseSurfaceStock(def);
  }
}

function loseSurfaceStock(p: PlayerState) {
  const safe = ECONOMY.storage.values[p.econ.storage];
  let extra = storedUnits(p) - safe;
  while (extra > 0) {
    let bestKey = '', bestN = 0, isInt = false;
    for (const k in p.interceptors) if (p.interceptors[k] > bestN) { bestKey = k; bestN = p.interceptors[k]; isInt = true; }
    for (const k in p.stock) if (!attack(k).reusable && p.stock[k] > bestN) { bestKey = k; bestN = p.stock[k]; isInt = false; }
    if (!bestKey) break;
    if (isInt) p.interceptors[bestKey]--; else p.stock[bestKey]--;
    extra--;
  }
}

function kill(bt: Battle, t: Threat, def: PlayerState, b?: Battery) {
  t.alive = false;
  bt.stats.stopped++;
  if (b) b.kills++;
  emit(bt, { t: 'kill', x: t.x, z: t.z, alt: t.alt, cls: t.cls });
}

function pickTarget(m: Match, bt: Battle, def: PlayerState, b: Battery, pad: Pad): Threat | undefined {
  const s = defence(b.sys);
  let best: Threat | undefined, bestScore = Infinity;
  for (const t of bt.threats) {
    if (!t.alive || t.delay > 0 || !t.detected || t.hold) continue;
    if (dist(pad, t) > s.range) continue;
    if (hitChance(m, def, b, t) <= 0) continue;
    if (!t.priority) {
      if (!def.autoFire) continue;
      if (t.decoyMarked) continue;
      if (s.skipsMisses && !t.landsInCity && MISSILE_CLASSES.includes(t.cls)) continue;
      if (s.shot >= EXPENSIVE_SHOT && CHEAP_THREATS.includes(t.looksLike) && t.identified) continue;
      if (s.kind === 'sam' && t.engaged >= 1) continue;
    } else if (s.kind === 'sam' && t.engaged >= 2) continue;
    // Soonest to arrive first; priority contacts jump the queue.
    const r = Math.hypot(t.x, t.z);
    const score = (t.priority ? -1e6 : 0) + r / Math.max(0.01, speedNow(t));
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

function fire(m: Match, bt: Battle, def: PlayerState, b: Battery, pad: Pad, t: Threat, dt: number) {
  const s = defence(b.sys);
  b.revealed = true;
  if (s.kind === 'laser') {
    if (b.dwellTarget !== t.uid) { b.dwellTarget = t.uid; b.dwell = 0; }
    b.dwell += dt;
    if (b.dwell >= (s.dwell ?? 1.5)) {
      const k = rnd(m) * 100 < hitChance(m, def, b, t);
      emit(bt, { t: 'laser', sys: s.id, fx: pad.x, fz: pad.z, tx: t.x, tz: t.z, alt: t.alt, kill: k });
      if (k) kill(bt, t, def, b);
      b.dwell = 0; b.dwellTarget = undefined;
    }
    return;
  }
  if (s.kind === 'gun') {
    if (def.budget < s.shot) { b.cooldown = 1; return; }
    def.budget = round(def.budget - s.shot); def.spent = round(def.spent + s.shot);
    bt.stats.defenceSpent = round(bt.stats.defenceSpent + s.shot);
    b.cooldown = s.fireEvery ?? 0.5;
    const k = rnd(m) * 100 < hitChance(m, def, b, t);
    emit(bt, { t: 'gun', sys: s.id, fx: pad.x, fz: pad.z, tx: t.x, tz: t.z, alt: t.alt, kill: k });
    if (k) kill(bt, t, def, b);
    return;
  }
  // SAM: interceptors were paid for when bought; count the value used.
  b.ammo--;
  b.cooldown = s.fireEvery ?? 1.5;
  t.engaged++;
  bt.stats.interceptorsUsed++;
  bt.stats.defenceSpent = round(bt.stats.defenceSpent + s.shot);
  const it: Interceptor = { uid: uid(m), battery: b.uid, sys: s.id, target: t.uid, x: pad.x, z: pad.z, alt: 0.05, speed: s.interceptorSpeed ?? 1 };
  bt.interceptors.push(it);
  emit(bt, { t: 'launch', uid: it.uid, sys: s.id, x: pad.x, z: pad.z });
}

function endBattle(m: Match, bt: Battle) {
  bt.over = true;
  const def = m.players[bt.defender];
  m.lastReport = {
    attacker: bt.attacker, ...bt.stats,
    knockedOut: def.buildings.filter(b => b.battleDamage >= RULES.knockoutDamage && b.down > 0).map(b => BUILDINGS.find(x => x.kind === b.kind)!.name),
    revealed: def.buildings.filter(b => b.revealed).length,
  };
  m.phase = 'report';
  m.phaseEndsAt = m.time + REPORT_SECONDS;
  log(m, `Strike over: ${bt.stats.stopped} stopped, ${bt.stats.hits} hits, ${bt.stats.damage} damage.`);
}

export function drainEvents(m: Match): BattleEvent[] {
  if (!m.battle) return [];
  const e = m.battle.events; m.battle.events = []; return e;
}
