import {
  ATTACKS, BUILDINGS, CITY_RADIUS, DEFENCES, DUEL_ATTACKS, DUEL_DEFENCES, PASSIVE_SYSTEMS, TIER_NAMES, DEF_UPGRADE, ECONOMY, EXTRA_RADAR_PRICE, FINANCE_PENALTY,
  LONG_RANGE_SAMS, POWER_RADAR_PENALTY, RADAR_LEVELS, RULES, SCOUTS, SPAWN_DISTANCE,
  attack, defence, scout, type BuildingKind, type ThreatClass,
} from './data';
import { nextRandom } from './rng';
import { LAYOUT_COUNT, SURVEY_SECTORS, cityLayouts, padLayout, sectorOf } from './geometry';
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
const R = (m: Match) => m.cityRadius ?? CITY_RADIUS;
export { hideouts };
export const HP_SCALE = 10; // raid damage multiplier: weapon damage × 10 = structure strength lost
const uid = (m: Match) => m.nextUid++;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const round = (v: number) => Math.round(v * 1000) / 1000;
const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

// ---------- creation ----------

const SPOTS = cityLayouts().flat(); // every spot of every layout: room for extra buildings (radar sites)

function freeSpot(m: Match, p: PlayerState): Point | undefined {
  const free = SPOTS.filter(s => !p.buildings.some(b => dist(b, s) < 1));
  if (!free.length) return undefined;
  return free[Math.floor(rnd(m) * free.length) % free.length];
}

function addBuilding(m: Match, p: PlayerState, kind: BuildingKind, at?: Point): Building | undefined {
  const spot = at ?? freeSpot(m, p);
  if (!spot) return undefined;
  const b: Building = { uid: uid(m), kind, x: spot.x, z: spot.z, down: 0, revealed: false, battleDamage: 0, hp: RULES.buildingLives, maxHp: RULES.buildingLives };
  p.buildings.push(b);
  return b;
}

function newPlayer(index: PlayerIndex, name: string, isAI: boolean): PlayerState {
  return {
    index, name, isAI, budget: RULES.startBudget, health: RULES.cityHealth,
    pads: padLayout(), scars: [], batteries: [], buildings: [], interceptors: {}, launchers: {}, stock: {}, scouts: {},
    launched: {}, offUp: {}, econ: { income: 0, storage: 0, logistics: 0, repair: 0 },
    radar: { range: 0, identify: 0, decoy: 0 }, autoFire: true, reloadsLeft: 0, spent: 0, conceded: false, ready: false, restock: {},
    chief: -1, intel: [], inspected: [], layout: 0, surveyed: [], patrols: 0,
  };
}

export function createMatch(seed: number, names: [string, string], ai: [boolean, boolean] = [false, false], opts: { timed?: boolean; maxBatteries?: number } = {}): Match {
  const m: Match = {
    version: 1, rng: seed | 0, time: 0, phase: 'setup', phaseEndsAt: RULES.setupSeconds, active: 0, turnNo: 0,
    weatherBad: false, players: [newPlayer(0, names[0], ai[0]), newPlayer(1, names[1], ai[1])], nextUid: 1, log: [], timed: opts.timed !== false,
  };
  if (opts.maxBatteries && opts.maxBatteries > 0) m.maxBatteries = Math.floor(opts.maxBatteries);
  for (const p of m.players) {
    // One of the 20 layouts, its spots shuffled: 7 critical buildings, then 8 identical hideouts. All hidden until surveyed.
    p.layout = Math.floor(rnd(m) * LAYOUT_COUNT) % LAYOUT_COUNT;
    const spots = cityLayouts()[p.layout].slice();
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(rnd(m) * (i + 1)) % (i + 1); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    let k = 0;
    for (const b of BUILDINGS) if (b.kind !== 'structure' && b.kind !== 'hideout') addBuilding(m, p, b.kind, spots[k++]);
    for (let i = 0; i < RULES.hideouts; i++) addBuilding(m, p, 'hideout', spots[k++]);
    const hs = p.buildings.filter(b => b.kind === 'hideout');
    p.chief = hs[Math.floor(rnd(m) * hs.length) % hs.length].uid;
  }
  return m;
}

// ---------- helpers ----------

const working = (p: PlayerState, kind: BuildingKind) => p.buildings.some(b => b.kind === kind && b.down === 0);
const powerOn = (p: PlayerState) => working(p, 'power');

export function incomeFor(p: PlayerState): number {
  const base = RULES.income;
  return working(p, 'finance') ? base : round(base * (1 - FINANCE_PENALTY));
}

export function radarRange(p: PlayerState, raid = false): number {
  if (!working(p, 'radar')) return RULES.visualRange;
  const r = raid ? RADAR_LEVELS.range[p.radar.range] : RULES.radarRange;
  return powerOn(p) ? r : r * (1 - POWER_RADAR_PENALTY);
}

export function launchCap(p: PlayerState, weapon: string): number {
  const w = attack(weapon);
  if (w.reusable) return p.stock[weapon] ?? 0;
  if (w.noLauncher) return w.perTurn;
  return (p.launchers[weapon] ?? 0) * w.perTurn;
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

/** Big missile systems may be switched to manual fire; small ones always fire automatically. */
export const canBeManual = (sys: string) => { const s = defence(sys); return !!s && s.kind === 'sam' && s.range >= RULES.bigSamRange; };

const hideouts = (p: PlayerState) => p.buildings.filter(b => b.kind === 'hideout');
const intact = (b: Building) => b.down < 99;

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
  if (cmd.c === 'setManual') {
    const b = p.batteries.find(x => x.uid === cmd.uid); if (!b) return fail('No such battery.');
    if (!canBeManual(b.sys)) return fail('Small systems always fire automatically.');
    b.manual = !!cmd.on; return ok;
  }
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

  if (cmd.c === 'fire' || cmd.c === 'endAttack') {
    const bt = m.battle;
    if (m.phase !== 'battle' || !bt || bt.attacker !== pi) return fail('You can launch only during your own attack.');
    if (!bt.open) return fail('The attack is over.');
    if (cmd.c === 'endAttack') { bt.open = false; return ok; }
    return fireOne(m, bt, cmd);
  }
  if (cmd.c === 'continue') {
    if (m.phase === 'report') { if (m.raid) { m.phase = 'over'; m.winner = m.lastReport!.attacker; return ok; } startTurn(m, other(m.lastReport!.attacker)); return ok; }
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
    return launch(m, pi, cmd.strikes, cmd.scouts, cmd.bearing, cmd.route, cmd.live);
  }

  if (cmd.c === 'topUp') {
    if (!canShop(m, pi)) return fail('You can buy only during setup or your own turn.');
    if (!working(p, 'factory')) return fail('Missile factory is knocked out.');
    const r = topUpAll(p);
    if (r.n === 0) return fail(r.short ? 'Not enough money to top up.' : 'Everything is already full.');
    return ok;
  }
  if (cmd.c === 'placeChief' || cmd.c === 'moveChief') {
    const h = p.buildings.find(b => b.uid === cmd.uid && b.kind === 'hideout');
    if (!h || !intact(h)) return fail('Pick one of your standing hideouts.');
    if (h.uid === p.chief) return fail('Your chief is already there.');
    if (cmd.c === 'placeChief') { if (m.phase !== 'setup') return fail('After setup, moving the chief costs money: use Move.'); p.chief = h.uid; return ok; }
    if (m.phase !== 'turn' || m.active !== pi) return fail('You can move the chief only on your own turn.');
    if (!spend(p, RULES.chiefMove)) return fail('Not enough budget.');
    p.chief = h.uid; p.inspected = [];
    log(m, `${p.name} moved their chief.`);
    return ok;
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
      const draft = !m.raid;
      if (draft && !DUEL_DEFENCES.includes(s.id)) return fail('That system is not in the duel.');
      if (draft && m.phase !== 'setup') return fail('Defences are chosen in setup. Now your money goes on attack weapons, drones and defence missiles.');
      if (draft) {
        const have = p.batteries.filter(b => defence(b.sys).tier === s.tier).length, max = RULES.draftPicks[s.tier];
        if (have >= max) return fail(`You already picked ${max} ${TIER_NAMES[s.tier].toLowerCase()} system${max > 1 ? 's' : ''}. Remove one to pick another.`);
      }
      if (p.batteries.some(b => b.pad === cmd.pad)) return fail('That pad is taken.');
      if (m.maxBatteries && p.batteries.length >= m.maxBatteries) return fail(`Defence limit reached: ${m.maxBatteries} systems per player in this match. Sell one to place another.`);
      if (!draft && !spend(p, s.price)) return fail('Not enough budget.'); // duel picks are free (first load included)
      p.batteries.push({ uid: uid(m), sys: s.id, pad: cmd.pad, level: 1, ammo: s.load, cooldown: 0, reloading: 0, holdFire: false, revealed: false, kills: 0, dwell: 0 });
      if (s.load > 0 && p.restock[s.id] == null) p.restock[s.id] = s.load; // default: keep one full reload spare
      return ok;
    }
    case 'sellBattery': {
      const i = p.batteries.findIndex(x => x.uid === cmd.uid); if (i < 0) return fail('No such battery.');
      const b = p.batteries[i];
      if (!m.raid) { if (m.phase !== 'setup') return fail('Defences can only be changed in setup.'); }
      else p.budget = round(p.budget + defence(b.sys).price * 0.5);
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
      if (!m.raid && !DUEL_ATTACKS.includes(cmd.weapon)) return fail('That weapon is not in the duel.');
      const w = ATTACKS.find(x => x.id === cmd.weapon); if (!w || w.reusable || w.noLauncher) return fail('No launcher needed.');
      if (!spend(p, w.launcher)) return fail('Not enough budget.');
      p.launchers[w.id] = (p.launchers[w.id] ?? 0) + 1;
      return ok;
    }
    case 'buyUnits': {
      if (!m.raid && !DUEL_ATTACKS.includes(cmd.weapon)) return fail('That weapon is not in the duel.');
      const w = ATTACKS.find(x => x.id === cmd.weapon); if (!w) return fail('Unknown weapon.');
      if (!w.reusable && !factoryUp) return fail('Missile factory is knocked out.');
      const n = Math.max(1, Math.floor(cmd.n));
      if (!spend(p, w.unit * n)) return fail('Not enough budget.');
      p.stock[w.id] = (p.stock[w.id] ?? 0) + n;
      return ok;
    }
    case 'buyPatrol': {
      if (m.raid) return fail('No air patrols here.');
      if (m.phase !== 'setup') return fail('Air patrols are chosen in setup.');
      if (p.patrols >= RULES.patrolMax) return fail(`At most ${RULES.patrolMax} air patrols.`);
      if (!spend(p, RULES.patrolPrice)) return fail('Not enough budget.');
      p.patrols++;
      return ok;
    }
    case 'buyScout': {
      const s = SCOUTS.find(x => x.id === cmd.scout); if (!s) return fail('Unknown UAV.');
      if (!spend(p, s.price)) return fail('Not enough budget.');
      p.scouts[s.id] = (p.scouts[s.id] ?? 0) + 1;
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
      b.down = 0; b.hp = b.maxHp;
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
  for (const b of p.buildings) if (b.down > 0 && b.down < 99) { b.down--; if (b.down === 0) b.hp = b.maxHp; }
  const commandHit = !working(p, 'command');
  p.budget = round(p.budget + incomeFor(p));
  autoRestock(p);
  for (const b of p.batteries) topUp(p, b);
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

/** Cost of filling every magazine and every spare stock up to its standing order. */
export function topUpNeeds(p: PlayerState): Record<string, number> {
  const need: Record<string, number> = {};
  for (const b of p.batteries) { const s = defence(b.sys); if (s.load > 0) need[s.id] = (need[s.id] ?? 0) + (batteryLoad(b) - b.ammo); }
  for (const sys in need) need[sys] += Math.max(0, (p.restock[sys] ?? 0) - (p.interceptors[sys] ?? 0));
  return need;
}
function topUpAll(p: PlayerState): { n: number; cost: number; short: boolean } {
  let n = 0, cost = 0, short = false;
  const need = topUpNeeds(p);
  for (const sys in need) {
    const s = defence(sys), want = need[sys]; if (want <= 0) continue;
    const afford = Math.min(want, Math.floor((p.budget + 1e-9) / s.shot)); if (afford < want) short = true; if (afford <= 0) continue;
    p.budget = round(p.budget - afford * s.shot); p.spent = round(p.spent + afford * s.shot);
    p.interceptors[sys] = (p.interceptors[sys] ?? 0) + afford; n += afford; cost = round(cost + afford * s.shot);
  }
  for (const b of p.batteries) topUp(p, b);
  return { n, cost, short };
}

function finish(m: Match, winner: PlayerIndex, reason: Match['endReason']) {
  m.phase = 'over';
  m.winner = winner;
  m.endReason = reason;
  m.battle = undefined;
  log(m, `${m.players[winner].name} wins (${reason}).`);
}

// ---------- launching a strike ----------

function cleanPath(pts: Point[] | undefined): Point[] | undefined {
  if (!Array.isArray(pts) || pts.length < 2) return undefined;
  const out = pts.slice(0, 300).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.z))
    .map(p => ({ x: round(Math.max(-300, Math.min(300, p.x))), z: round(Math.max(-300, Math.min(300, p.z))) }));
  return out.length >= 2 ? out : undefined;
}

function launch(m: Match, pi: PlayerIndex, strikes: { weapon: string; n: number; target?: number }[], scouts: { scout: string; path: Point[] }[], bearing?: number, rawRoute?: Point[], live?: boolean): CommandResult {
  const route = cleanPath(rawRoute);
  if (route) bearing = Math.atan2(route[0].z, route[0].x); // the route's first point is where the strike comes from
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
    if (w.recon && !def.buildings.some(b => b.uid === s.target && b.kind === 'hideout' && intact(b))) return fail('Send each recon drone to a standing hideout.');
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
    if (!Array.isArray(s.path) || s.path.length < 1) return fail('Draw a path for the UAV.');
  }
  if (!live && Object.keys(want).length === 0 && scouts.length === 0) return fail('Nothing to launch.');

  // Munitions on armed UAVs are paid at launch.
  let munitionCost = 0;
  for (const id in want) { const w = attack(id); if (w.munitionCost) munitionCost += w.munitionCost * (w.munitions ?? 0) * want[id]; }
  if (!spend(att, munitionCost)) return fail('Not enough budget for the UAV munitions.');

  const bt: Battle = {
    attacker: pi, defender: other(pi), route, live: !!live, open: !!live, bearing: Number.isFinite(bearing) ? (bearing as number) : NORTH, time: 0, threats: [], interceptors: [], events: [],
    stats: { launched: 0, stopped: 0, hits: 0, damage: 0, interceptorsUsed: 0, defenceSpent: 0, attackSpent: munitionCost },
    over: false,
  };
  m.battle = bt;
  m.phase = 'battle';
  def.reloadsLeft = m.raid ? ECONOMY.logistics.values[def.econ.logistics] : RULES.reloads;
  bt.patrols = [];
  for (let i = 0; i < def.patrols; i++) { // each patrol circles at its own radius, height and direction, new every strike
    const r = round(1.5 + rnd(m) * 3.5), a = rnd(m) * Math.PI * 2, w = (rnd(m) < 0.5 ? -1 : 1) * (0.12 + rnd(m) * 0.08);
    bt.patrols.push({ uid: uid(m), r, a, w, x: round(Math.cos(a) * r), z: round(Math.sin(a) * r), alt: round(4 + rnd(m) * 5), missiles: RULES.patrolMissiles, cooldown: 0 });
  }
  def.inspected = [];
  for (const b of def.batteries) { b.cooldown = 0; b.reloading = 0; b.dwell = 0; b.dwellTarget = undefined; b.emitted = false; b.dry = false; topUp(def, b); }
  for (const b of def.buildings) b.battleDamage = 0;

  // Duel: time on target. Slow weapons launch first so the whole strike reaches the city together.
  const maxFlight = Math.max(0, ...strikes.filter(s => s.n >= 1).map(s => attack(s.weapon).flight));
  for (const s of strikes) {
    const w = attack(s.weapon); const n = Math.floor(s.n); if (n <= 0) continue;
    const lead = m.raid ? 0 : maxFlight - w.flight, spread = m.raid ? 8 : RULES.totSpread;
    att.stock[w.id] -= n;
    att.launched[w.id] = (att.launched[w.id] ?? 0) + n;
    for (let i = 0; i < n; i++) {
      if (w.salvo) for (let r = 0; r < w.salvo; r++) spawnStrike(m, bt, att, def, w.id, s.target, rnd(m) * 4);
      else spawnStrike(m, bt, att, def, w.id, s.target, lead + rnd(m) * spread);
    }
    bt.stats.attackSpent = round(bt.stats.attackSpent + (w.reusable ? 0 : w.unit * n));
  }
  for (const s of scouts) { att.scouts[s.scout]--; spawnScout(m, bt, s.scout, s.path); }
  bt.stats.launched = bt.threats.length;
  log(m, `${att.name} launches ${bt.threats.length} contacts at ${def.name}.`);
  return ok;
}

function fireOne(m: Match, bt: Battle, cmd: { weapon?: string; scout?: string; from: Point; to: Point }): CommandResult {
  const att = m.players[bt.attacker], def = m.players[bt.defender];
  const ok_ = (p: Point) => p && Number.isFinite(p.x) && Number.isFinite(p.z);
  if (!ok_(cmd.from) || !ok_(cmd.to)) return fail('Pick a start and an aim point.');
  if (Math.hypot(cmd.from.x, cmd.from.z) < R(m) + 0.5) return fail('Start outside the target area.');
  const airbase = working(att, 'airbase');
  if (cmd.scout) {
    if (!SCOUTS.some(s => s.id === cmd.scout)) return fail('Unknown UAV.');
    if ((att.scouts[cmd.scout] ?? 0) <= 0) return fail(`No ${scout(cmd.scout).name} available.`);
    if (!airbase) return fail('Airbase is knocked out: UAVs cannot take off.');
    att.scouts[cmd.scout]--; spawnScout(m, bt, cmd.scout, [cmd.from, cmd.to]); bt.stats.launched++;
    return ok;
  }
  const w = ATTACKS.find(x => x.id === cmd.weapon); if (!w) return fail('Unknown weapon.');
  if ((att.stock[w.id] ?? 0) <= 0) return fail(`No ${w.name} in stock.`);
  if (w.recon && !def.buildings.some(b => b.kind === 'hideout' && b.revealed && intact(b) && dist(b, cmd.to) <= 0.6)) return fail('Aim the recon drone at a hideout you have found (survey their city with the Aksungur first).');
  if (w.cls === 'uav' && !airbase) return fail('Airbase is knocked out: UAVs cannot take off.');
  if (!w.reusable && (att.launched[w.id] ?? 0) >= launchCap(att, w.id)) return fail(`${w.name}: all launchers have fired this turn.`);
  const munitions = w.munitionCost ? w.munitionCost * (w.munitions ?? 0) : 0;
  if (!spend(att, munitions)) return fail('Not enough budget for the UAV munitions.');
  att.stock[w.id]--; att.launched[w.id] = (att.launched[w.id] ?? 0) + 1;
  const before = bt.threats.length;
  if (w.salvo) for (let r = 0; r < w.salvo; r++) spawnStrike(m, bt, att, def, w.id, undefined, rnd(m) * 2, cmd.from, cmd.to);
  else spawnStrike(m, bt, att, def, w.id, undefined, 0, cmd.from, cmd.to);
  bt.stats.launched += bt.threats.length - before;
  bt.stats.attackSpent = round(bt.stats.attackSpent + munitions + (w.reusable ? 0 : w.unit));
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
  const r = inside ? Math.sqrt(rnd(m)) * R(m) : R(m) + 0.5 + rnd(m) * 4;
  return { x: round(Math.cos(a) * r), z: round(Math.sin(a) * r) };
}

function baseThreat(m: Match): Threat {
  return {
    uid: uid(m), weapon: '', cls: 'drone', looksLike: 'drone', isScout: false, path: [], leg: 0, speed: 0,
    speedIn: 0, x: 0, z: 0, alt: 0, peakAlt: 0, traveled: 0, total: 0, delay: 0, alive: true, landed: false, landsInCity: false,
    damage: 0, precise: false, low: false, detected: false, identified: false, decoyMarked: false, priority: false,
    hold: false, engaged: 0, ewChecked: false, returning: false, munitions: 0, dropLeg: 1, dropCooldown: 0, revealRadius: 0,
    spawnedDecoys: false, stealth: 0,
  };
}

const TERMINAL = 20; // km: the last 20 km take half the flight time

const MISSILE_START = 2 * TERMINAL; // missiles fly at one steady speed, launched 40 km out

function setSpeeds(t: Threat, from: Point, flight: number, flies: ThreatClass = t.cls) {
  // Everything flies at one steady speed: no slowing down near the city.
  void flies;
  const d = Math.hypot(from.x, from.z);
  t.speed = t.speedIn = d / flight;
}
const speedNow = (t: Threat) => (Math.hypot(t.x, t.z) > TERMINAL ? t.speed : t.speedIn);

/** Even spacing along a polyline. */
function resample(pts: Point[], step: number): Point[] {
  const out: Point[] = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = dist(a, b); let d = step - carry;
    while (d <= L) { out.push({ x: a.x + (b.x - a.x) * d / L, z: a.z + (b.z - a.z) * d / L }); d += step; }
    carry = L - (d - step);
  }
  const last = pts[pts.length - 1]; if (dist(out[out.length - 1], last) > step * 0.3) out.push(last);
  return out;
}
/** Corner cutting: each pass rounds every corner. */
function chaikin(pts: Point[], passes: number): Point[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const q: Point[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) { const a = p[i], b = p[i + 1]; q.push({ x: a.x * .75 + b.x * .25, z: a.z * .75 + b.z * .25 }, { x: a.x * .25 + b.x * .75, z: a.z * .25 + b.z * .75 }); }
    q.push(p[p.length - 1]); p = q;
  }
  return p;
}
/** How a weapon follows a drawn route: drones/UAVs exactly, cruise missiles smoothed (no sharp turns), rockets/ballistic not at all. */
function routeWaypoints(cls: ThreatClass, route: Point[] | undefined, m: Match): Point[] {
  if (!route || cls === 'rocket' || cls === 'ballistic' || cls === 'hypersonic') return [];
  const jitter = () => (rnd(m) - 0.5) * 0.6;
  const pts = cls === 'cruise' ? chaikin(resample(route, 3), 3) : resample(route, 0.6);
  const j = { x: jitter(), z: jitter() };
  return pts.map(p => ({ x: round(p.x + j.x), z: round(p.z + j.z) }));
}
/** Start far out, beyond the route's first point. */
function routeStart(route: Point[], wantDist: number): Point {
  const p0 = route[0], p1 = route[1];
  let dx = p0.x - p1.x, dz = p0.z - p1.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const extra = Math.max(0, wantDist - Math.hypot(p0.x, p0.z));
  return { x: round(p0.x + dx * extra), z: round(p0.z + dz * extra) };
}

const SPAWN_DIST: Record<string, number> = { kargu: 20, recon: 20, akbaba: 30, grad: 40, himars: 80, trg300: 100 };
const PEAK: Record<ThreatClass, number> = { drone: 0.3, decoy: 0.3, uav: 5, rocket: 12, cruise: 0.05, ballistic: 80, hypersonic: 25 };

function spawnStrike(m: Match, bt: Battle, att: PlayerState, def: PlayerState, weapon: string, target: number | undefined, delay: number, from?: Point, to?: Point) {
  const w = attack(weapon);
  const flies = w.imitates ?? w.cls; // decoys fly like what they imitate
  const want = MISSILE_CLASSES.includes(flies) ? Math.min(SPAWN_DIST[weapon] ?? MISSILE_START, MISSILE_START) : SPAWN_DIST[weapon] ?? SPAWN_DISTANCE;
  const via = from ? [] : routeWaypoints(flies, bt.route, m);
  let start: Point;
  if (from) { // chosen start: same direction, distance kept between 12 km and the weapon's normal launch distance
    const r = Math.hypot(from.x, from.z) || 1, d = Math.max(12, Math.min(want, r));
    start = { x: round(from.x / r * d), z: round(from.z / r * d) };
  } else start = via.length ? routeStart(bt.route!, want) : spawnPoint(m, want);
  const t = baseThreat(m);
  t.weapon = weapon; t.cls = w.cls; t.looksLike = w.imitates ?? w.cls; t.delay = delay;
  t.precise = w.precise; t.low = !!w.low || flies === 'cruise';
  t.damage = w.damage;
  t.peakAlt = PEAK[flies];
  let aim: Point;
  const near = to ? def.buildings.filter(b => b.revealed && intact(b) && dist(b, to) <= 0.6).sort((a, b) => dist(a, to) - dist(b, to))[0] : undefined;
  const tb = near ?? (target != null ? def.buildings.find(b => b.uid === target) : undefined);
  const nearBat = to && !near && !m.raid ? def.batteries.filter(b => b.revealed && dist(def.pads[b.pad], to) <= 0.6).sort((a, b) => dist(def.pads[a.pad], to) - dist(def.pads[b.pad], to))[0] : undefined;
  const around = (p: Point, r: number): Point => { const a = rnd(m) * Math.PI * 2, d = Math.sqrt(rnd(m)) * r; return { x: round(p.x + Math.cos(a) * d), z: round(p.z + Math.sin(a) * d) }; };
  if (w.cls === 'decoy') { aim = to ? around(to, 1) : randomCityPoint(m, true); t.landsInCity = false; }
  else if (to && w.precise) {
    const miss = (w.recon ? 0 : 0.1) + (w.cls === 'cruise' && def.batteries.some(b => b.sys === 'koral') && powerOn(def) ? 0.2 : 0);
    if (rnd(m) < miss) { const a = rnd(m) * Math.PI * 2, d = 1 + rnd(m) * 1.5; aim = { x: round(to.x + Math.cos(a) * d), z: round(to.z + Math.sin(a) * d) }; }
    else if (tb) { aim = { x: tb.x, z: tb.z }; t.targetBuilding = tb.uid; }
    else if (nearBat) { const pd = def.pads[nearBat.pad]; aim = { x: pd.x, z: pd.z }; }
    else aim = { x: round(to.x), z: round(to.z) };
  } else if (to) aim = around(to, w.salvo ? 1.5 : 0.5);
  else if (w.precise) {
    let miss = w.recon ? 0 : 0.1;
    if (w.cls === 'cruise' && def.batteries.some(b => b.sys === 'koral') && powerOn(def)) miss += 0.2;
    if (rnd(m) < miss) { aim = randomCityPoint(m, rnd(m) < 0.5); }
    else if (tb) { aim = { x: tb.x, z: tb.z }; t.targetBuilding = tb.uid; }
    else aim = randomCityPoint(m, true);
  } else {
    const share = Math.min(1, w.scatter ?? 1);
    aim = randomCityPoint(m, rnd(m) < share);
  }
  t.landsInCity = w.cls !== 'decoy' && Math.hypot(aim.x, aim.z) <= R(m);
  if (w.cls === 'uav') {
    t.munitions = w.munitions ?? 0;
    t.path = [start, ...via, tb ? { x: tb.x, z: tb.z } : to ? { x: round(to.x), z: round(to.z) } : randomCityPoint(m, true), start];
    t.dropLeg = t.path.length - 2;
    t.targetBuilding = tb?.uid;
  } else t.path = [start, ...via, aim];
  t.x = start.x; t.z = start.z;
  setSpeeds(t, { x: from ? want : Math.hypot(start.x, start.z), z: 0 }, w.flight, flies); // a closer start means a shorter flight at the same speed
  if (MISSILE_CLASSES.includes(flies)) t.peakAlt = Math.min(t.peakAlt, Math.hypot(start.x, start.z) * 0.3); // arc height fits the flight
  t.total = dist(t.path[0], t.path[1]);
  bt.threats.push(t);
}

const SURVEY_LAP = 24; // orbit points per lap (a multiple of RULES.surveyPerPass)

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
  t.revealRadius = m.raid ? s.reveal : 0;
  if (m.raid) t.path = [start, ...resample(path.map(p => ({ x: round(p.x), z: round(p.z) })), 0.6), start];
  else { // duel survey: one lap around the city at 3.5 km, photographing a sector every quarter lap
    const a0 = Math.atan2(dz, dx), orbit: Point[] = [];
    for (let i = 0; i <= SURVEY_LAP; i++) { const a = a0 + (i / SURVEY_LAP) * Math.PI * 2; orbit.push({ x: round(Math.cos(a) * 3.5), z: round(Math.sin(a) * 3.5) }); }
    t.path = [start, ...orbit, start];
  }
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
  const clock = m.timed !== false;
  if (m.phase === 'setup' && clock && m.time >= m.phaseEndsAt) startTurn(m, 0);
  else if (m.phase === 'turn' && clock && m.time >= m.phaseEndsAt) { log(m, `${m.players[m.active].name} ran out of time.`); startTurn(m, other(m.active)); }
  else if (m.phase === 'report' && !m.raid && m.time >= m.phaseEndsAt) startTurn(m, other(m.lastReport!.attacker));
  else if (m.phase === 'battle' && m.battle) battleStep(m, m.battle, dt);
}

function emit(bt: Battle, e: BattleEvent) { bt.events.push(e); if (bt.events.length > 400) bt.events.shift(); }

function hitChance(m: Match, def: PlayerState, b: Battery, t: Threat): number {
  const s = defence(b.sys);
  let cls: ThreatClass = t.cls;
  if (t.isScout) {
    const sc = scout(t.weapon);
    if (!m.raid && t.weapon === 'aksungur') return 0; // too high for ground defences; only an air patrol can get it
    if (sc.onlyLongRange && !LONG_RANGE_SAMS.includes(s.id)) return 0;
    let p = s.hit.uav ?? 0; if (p === 0) return 0;
    if (sc.altitude === 'high' && s.range < 40) p -= 25;
    if (!m.raid) p *= RULES.surveyHitFactor;
    return clampHit(p + (b.level - 1) * 8);
  }
  if (t.weapon === 'decoy') cls = 'decoy';
  let p = s.hit[cls] ?? 0;
  if (p === 0) return 0;
  if (s.lowCruisePenalty && t.low) p -= s.lowCruisePenalty;
  if (s.weatherHit && m.weatherBad) p *= 0.5;
  if (t.weapon === 'recon') p *= RULES.reconHitFactor;
  if (t.weapon === 'akbaba' || t.weapon === 'harop') p *= RULES.armHitFactor;
  p += (b.level - 1) * 8;
  if (!m.raid) { // swamped radar: too many contacts in range spoil every shot
    const s2 = defence(b.sys), extra = (b.contacts ?? 0) - (RULES.swampFree[s2.tier] ?? 2);
    if (extra > 0) p -= Math.min(RULES.swampCap, extra * RULES.swampPenalty);
  }
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
  const rr = radarRange(def, !!m.raid);
  const radarUp = working(def, 'radar');
  const idR = !radarUp ? 5 : m.raid ? RADAR_LEVELS.identify[def.radar.identify] : RULES.identifyRange;
  const decoyR = radarUp && m.raid ? RADAR_LEVELS.decoy[def.radar.decoy] : 0; // duel: only the attacker knows which are decoys

  // Move threats.
  for (const t of bt.threats) {
    if (!t.alive) continue;
    if (t.delay > 0) { t.delay -= dt; continue; }
    moveThreat(m, bt, att, def, t, dt);
    if (bt.chiefDown) { finish(m, bt.attacker, 'chief'); return; }
    if (!t.alive) continue;
    const r = Math.hypot(t.x, t.z);
    if (!t.detected && r <= (t.weapon === 'recon' ? Math.min(rr, RULES.reconDetect) : rr)) t.detected = true;
    if (t.detected && !t.identified && r <= idR) t.identified = true;
    if (t.detected && !t.decoyMarked && (t.cls === 'decoy' || t.weapon === 'decoy') && decoyR > 0 && r <= decoyR) t.decoyMarked = true;
    // Electronic warfare: each jammer (Koral, İhtar) gets one roll as the contact enters its range.
    for (const ew of def.batteries) {
      const es = defence(ew.sys);
      if (es.kind !== 'ew' || t.ewBy?.includes(ew.uid) || !batteryReady(def, ew) || dist(def.pads[ew.pad], t) > es.range) continue;
      (t.ewBy ??= []).push(ew.uid); ew.emitted = true; ew.revealed = true;
      const p = (es.hit[t.cls] ?? 0) / 100;
      if (p > 0 && !t.returning && rnd(m) < p) {
        if (t.cls === 'uav') { t.returning = true; t.munitions = 0; turnBack(t); emit(bt, { t: 'msg', text: `${es.name} turned back a ${t.isScout ? 'scout' : 'UAV'}.`, tone: 'good' }); }
        else { kill(bt, t, def, ew); break; }
      }
    }
  }

  patrolStep(m, bt, def, dt);

  // Count the contacts inside each battery's range (swamped radar, duel only).
  if (!m.raid) for (const b of def.batteries) {
    const pad = def.pads[b.pad], rng = defence(b.sys).range; let n = 0;
    for (const t of bt.threats) if (t.alive && t.delay <= 0 && t.detected && dist(pad, t) <= rng) n++;
    b.contacts = n;
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
      else if (!b.dry) { b.dry = true; emit(bt, { t: 'msg', text: `${s.name} is out of missiles for this strike.`, tone: 'info' }); }
      continue;
    }
    const pad = def.pads[b.pad];
    if (!m.raid && s.kind === 'sam' && bt.interceptors.filter(i => i.battery === b.uid && i.target >= 0).length >= (RULES.channels[s.tier] ?? 1)) continue; // guidance channels full
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

  if (bt.open && m.timed !== false && bt.time >= RULES.turnSeconds) bt.open = false;
  if (!bt.open && bt.threats.every(t => !t.alive) && bt.interceptors.length === 0) endBattle(m, bt);
}

/** Akıncı air patrols circle over the city; an enemy survey UAV that comes within range may be shot down. */
function patrolStep(m: Match, bt: Battle, def: PlayerState, dt: number) {
  for (const pa of bt.patrols ?? []) {
    pa.a += pa.w * dt; pa.x = round(Math.cos(pa.a) * pa.r); pa.z = round(Math.sin(pa.a) * pa.r);
    if (pa.cooldown > 0) { pa.cooldown -= dt; continue; }
    if (pa.missiles <= 0) continue;
    const t = bt.threats.find(q => q.alive && q.delay <= 0 && q.isScout && !q.returning && dist(q, pa) <= RULES.patrolRange);
    if (!t || def.budget < RULES.patrolShot) continue;
    def.budget = round(def.budget - RULES.patrolShot); def.spent = round(def.spent + RULES.patrolShot);
    bt.stats.defenceSpent = round(bt.stats.defenceSpent + RULES.patrolShot);
    pa.missiles--; pa.cooldown = 3;
    const k = rnd(m) * 100 < RULES.patrolHit;
    emit(bt, { t: 'aam', fx: pa.x, fz: pa.z, falt: pa.alt, tx: t.x, tz: t.z, talt: t.alt, kill: k });
    if (k) { kill(bt, t, def); emit(bt, { t: 'msg', text: 'Akıncı air patrol shot down a survey UAV.', tone: 'good' }); }
    else emit(bt, { t: 'msg', text: 'Akıncı air patrol fired at a survey UAV and missed.', tone: 'info' });
  }
}

function turnBack(t: Threat) {
  const home = t.path[0];
  t.path = [{ x: t.x, z: t.z }, home];
  t.leg = 0; t.traveled = 0; t.total = dist(t.path[0], t.path[1]);
}

function moveThreat(m: Match, bt: Battle, att: PlayerState, def: PlayerState, t: Threat, dt: number) {
  if (t.hover != null) { // recon drone over its hideout, or a Harop loitering
    t.hover -= dt;
    if (t.weapon === 'harop') { if (lockOn(def, t)) return; if (t.hover <= 0) { t.hover = undefined; t.alive = false; t.landed = true; impact(m, bt, def, { x: t.x, z: t.z }, t.damage); } return; }
    if (t.hover <= 0) reconDone(m, bt, att, def, t);
    return;
  }
  if (attack(t.weapon)?.arm && t.locked == null) lockOn(def, t);
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
  // UAVs (survey and armed) finish their mission once they are heading home and clear of the city, instead of flying all the way back.
  if ((t.isScout || t.cls === 'uav') && t.leg >= t.path.length - 2 && (t.leg > 0 || t.returning) && Math.hypot(t.x, t.z) > R(m) + 3) {
    t.alive = false; t.landed = true;
    if (t.isScout) att.scouts[t.weapon] = (att.scouts[t.weapon] ?? 0) + 1; else att.stock[t.weapon] = (att.stock[t.weapon] ?? 0) + 1;
    return;
  }
  const a = t.path[t.leg], b = t.path[t.leg + 1] ?? a;
  const legLen = dist(a, b) || 1;
  const u = Math.min(1, t.traveled / legLen);
  t.x = round(a.x + (b.x - a.x) * u); t.z = round(a.z + (b.z - a.z) * u);
  // Altitude profile.
  if (t.cls === 'rocket' || t.cls === 'ballistic' || t.cls === 'hypersonic' || t.weapon === 'decoy') t.alt = round(t.peakAlt * 4 * u * (1 - u) + (t.cls === 'hypersonic' ? 2 * (1 - u) : 0));
  else if (t.cls === 'cruise' || t.looksLike === 'cruise') t.alt = 0.05;
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
  if ((t.isScout || t.cls === 'uav') && Math.hypot(t.x, t.z) < R(m) + 3) {
    const rr = t.isScout ? t.revealRadius : 1;
    for (const bd of def.buildings) if (!bd.revealed && dist(bd, t) <= rr) { bd.revealed = true; emit(bt, { t: 'reveal', building: bd.uid }); }
    for (const bb of def.batteries) if (!bb.revealed && dist(def.pads[bb.pad], t) <= rr) bb.revealed = true;
  }
  // Armed UAVs drop munitions while over the target area.
  if (!t.isScout && t.cls === 'uav' && t.leg === t.dropLeg && !t.returning && t.munitions > 0) {
    t.dropCooldown -= dt;
    if (t.dropCooldown <= 0 && t.traveled < 0.5) {
      t.dropCooldown = 2;
      t.munitions--;
      const w = attack(t.weapon);
      const tb = t.targetBuilding != null ? def.buildings.find(x => x.uid === t.targetBuilding) : undefined;
      const aimAt = t.path[t.dropLeg] ?? { x: 0, z: 0 }; // the point the UAV was sent to
      const pt = tb && rnd(m) > 0.1 ? { x: tb.x, z: tb.z } : { x: round(aimAt.x + (rnd(m) - 0.5) * 0.2), z: round(aimAt.z + (rnd(m) - 0.5) * 0.2) };
      impact(m, bt, def, pt, w.damage, tb && pt.x === tb.x && pt.z === tb.z ? tb.uid : undefined);
      if (t.munitions === 0) { t.leg = t.dropLeg; t.traveled = 0; }
    }
    if (t.munitions > 0) t.traveled = Math.min(t.traveled, 0.4); // loiter over the target until empty
  }
}

function arrive(m: Match, bt: Battle, att: PlayerState, def: PlayerState, t: Threat) {
  const last = t.leg >= t.path.length - 1;
  // Survey photos: one on arriving over the city, then evenly round the lap (RULES.surveyPerPass per lap).
  if (t.isScout && !m.raid && t.leg >= 1 && (t.leg - 1) % (SURVEY_LAP / RULES.surveyPerPass) === 0 && t.leg - 1 < SURVEY_LAP) surveySector(m, bt, att, def);
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
  if (t.weapon === 'harop' && t.locked == null && last) { t.hover = attack('harop').loiter ?? 60; t.alt = 0.4; return; }
  if (t.weapon === 'recon') {
    if (!last) { const a = t.path[t.leg], b = t.path[t.leg + 1]; t.total = dist(a, b); return; }
    t.hover = RULES.reconHover; t.alt = 0.15;
    if (t.targetBuilding != null && !def.inspected.includes(t.targetBuilding)) def.inspected.push(t.targetBuilding); return; }
  t.alive = false; t.landed = true;
  if (t.cls === 'decoy' || t.weapon === 'decoy') return;
  const pt = t.path[t.path.length - 1];
  if (!t.landsInCity) { emit(bt, { t: 'impact', x: pt.x, z: pt.z, damage: 0 }); return; }
  let bUid = t.targetBuilding;
  if (bUid == null) { const near = def.buildings.filter(b => intact(b) && dist(b, pt) <= (b.r ?? RULES.buildingHitRadius)).sort((a, b) => dist(a, pt) - dist(b, pt))[0]; bUid = near?.uid; }
  impact(m, bt, def, pt, t.damage, bUid);
}

function impact(m: Match, bt: Battle, def: PlayerState, pt: Point, damage: number, buildingUid?: number) {
  if (m.raid) { raidImpact(m, bt, def, pt, damage, buildingUid); return; }
  for (const bb of def.batteries.filter(x => dist(def.pads[x.pad], pt) <= RULES.batteryHitRadius)) {
    bb.damage = (bb.damage ?? 0) + damage;
    if (bb.damage >= RULES.batteryKillDamage) {
      def.batteries = def.batteries.filter(x => x !== bb);
      emit(bt, { t: 'msg', text: `${defence(bb.sys).name} destroyed.`, tone: 'bad' });
    }
  }
  def.scars.push({ x: pt.x, z: pt.z, d: damage });
  if (def.scars.length > 300) def.scars.shift();
  bt.stats.hits++; bt.stats.damage = round(bt.stats.damage + damage);
  emit(bt, { t: 'impact', x: pt.x, z: pt.z, damage, building: buildingUid });
  if (buildingUid == null) return;
  const b = def.buildings.find(x => x.uid === buildingUid); if (!b) return;
  if (b.kind === 'hideout') { hitHideout(m, bt, def, b, damage); return; }
  if (!b.revealed) { b.revealed = true; emit(bt, { t: 'reveal', building: b.uid }); }
  if (b.down > 0) return; // already knocked out
  b.battleDamage += damage;
  b.hp = Math.max(0, (b.hp ?? RULES.buildingLives) - damage);
  if (b.hp <= 0) {
    b.down = RULES.repairTurns;
    const name = BUILDINGS.find(x => x.kind === b.kind)!.name;
    emit(bt, { t: 'knockout', building: b.uid, kind: b.kind });
    emit(bt, { t: 'msg', text: `${name} knocked out.`, tone: 'bad' });
    if (b.kind === 'depot') loseSurfaceStock(def);
  }
}

/** Raid damage: structures lose strength (damage × HP_SCALE); big warheads also hurt neighbours. */
function raidImpact(m: Match, bt: Battle, def: PlayerState, pt: Point, damage: number, buildingUid?: number) {
  def.scars.push({ x: pt.x, z: pt.z, d: damage }); if (def.scars.length > 300) def.scars.shift();
  bt.stats.hits++; bt.stats.damage = round(bt.stats.damage + damage);
  emit(bt, { t: 'impact', x: pt.x, z: pt.z, damage, building: buildingUid });
  const hurt = (b: Building, amount: number) => {
    if (b.hp == null || b.down >= 99) return;
    if (!b.revealed) { b.revealed = true; emit(bt, { t: 'reveal', building: b.uid }); }
    b.hp = Math.max(0, b.hp - amount);
    if (b.hp <= 0) {
      b.down = 99;
      emit(bt, { t: 'knockout', building: b.uid, kind: b.kind });
      emit(bt, { t: 'msg', text: `${b.name ?? 'Building'} destroyed.`, tone: 'good' });
      if (b.kind === 'depot') loseSurfaceStock(def);
    }
  };
  const direct = buildingUid != null ? def.buildings.find(x => x.uid === buildingUid) : undefined;
  if (direct) hurt(direct, damage * HP_SCALE);
  if (damage >= 40) for (const b of def.buildings) if (b !== direct && dist(b, pt) <= 0.6) hurt(b, damage * HP_SCALE * 0.5);
  def.health = def.buildings.reduce((s, b) => s + (b.hp ?? 0), 0);
}

/** A hideout loses lives with each hit; at zero it is destroyed: chief inside → the attacker wins; empty → both sides know it was empty. */
function hitHideout(m: Match, bt: Battle, def: PlayerState, h: Building, damage: number) {
  if (!intact(h)) return;
  const att = m.players[bt.attacker], chief = def.chief === h.uid;
  h.hp = Math.max(0, (h.hp ?? RULES.buildingLives) - damage);
  if (h.hp > 0) { emit(bt, { t: 'msg', text: `A hideout was hit: ${h.hp}/${h.maxHp ?? RULES.buildingLives} left.`, tone: 'info' }); return; }
  h.down = 99;
  emit(bt, { t: 'hideout', building: h.uid, chief });
  if (chief) { bt.chiefDown = true; return; }
  setIntel(att, h.uid, false, m.turnNo);
  emit(bt, { t: 'msg', text: 'A hideout was destroyed. It was empty.', tone: 'info' });
}

/** A survey TB2 photographs one more sector of the enemy city: everything standing in it becomes known. */
function surveySector(m: Match, bt: Battle, att: PlayerState, def: PlayerState) {
  const hidden: number[] = [];
  for (let s = 0; s < SURVEY_SECTORS; s++) if (!att.surveyed.includes(s)) hidden.push(s);
  if (!hidden.length) return;
  const sec = hidden[Math.floor(rnd(m) * hidden.length) % hidden.length];
  att.surveyed.push(sec);
  for (const b of def.buildings) if (!b.revealed && sectorOf(b.x, b.z) === sec) { b.revealed = true; emit(bt, { t: 'reveal', building: b.uid }); }
  for (const b of def.batteries) if (sectorOf(def.pads[b.pad].x, def.pads[b.pad].z) === sec) b.revealed = true;
  emit(bt, { t: 'survey', sector: sec });
}

/** Anti-radiation: lock on to the nearest enemy defence whose radar is on (it fired this strike) and dive at it. */
function lockOn(def: PlayerState, t: Threat): boolean {
  let best: Battery | undefined, bd = RULES.armSeeker;
  for (const b of def.batteries) { if (!b.emitted) continue; const d = dist(def.pads[b.pad], t); if (d < bd) { bd = d; best = b; } }
  if (!best) return false;
  const pad = def.pads[best.pad];
  t.locked = best.uid; t.hover = undefined; t.landsInCity = true; t.targetBuilding = undefined;
  t.path = [{ x: t.x, z: t.z }, { x: pad.x, z: pad.z }]; t.leg = 0; t.traveled = 0; t.total = dist(t.path[0], t.path[1]);
  if (t.weapon === 'harop') { t.speed = t.speedIn = Math.max(t.speed, 1.5); } // the dive is fast
  return true;
}

function setIntel(p: PlayerState, uid: number, found: boolean, turn: number) {
  p.intel = p.intel.filter(x => x.uid !== uid);
  p.intel.push({ uid, found, turn });
}

/** A recon drone finished hovering: it reports whether the chief is in that hideout. */
function reconDone(m: Match, bt: Battle, att: PlayerState, def: PlayerState, t: Threat) {
  t.alive = false; t.landed = true; t.hover = undefined;
  const h = t.targetBuilding != null ? def.buildings.find(b => b.uid === t.targetBuilding) : undefined;
  if (!h || !intact(h)) return;
  const found = def.chief === h.uid;
  setIntel(att, h.uid, found, m.turnNo);
  emit(bt, { t: 'intel', building: h.uid, found });
}

function loseSurfaceStock(p: PlayerState) {
  const safe = RULES.storage;
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
      if (t.isScout && !m.raid && t.firedBy?.includes(b.uid)) continue; // automatic fire: one shot per battery at a survey TB2
      if (!def.autoFire || b.manual) continue;
      if (t.decoyMarked) continue;
      if (s.skipsMisses && !t.landsInCity && MISSILE_CLASSES.includes(t.cls)) continue;
      if (s.shot >= EXPENSIVE_SHOT && CHEAP_THREATS.includes(t.looksLike) && t.identified) continue;
      if (s.kind === 'sam' && t.engaged >= 1) continue;
    } else if (s.kind === 'sam' && t.engaged >= 2) continue;
    // Soonest to arrive first; priority contacts jump the queue.
    const r = Math.hypot(t.x, t.z);
    const score = (t.priority ? -1e6 : 0) + (t.isScout ? 1e4 : 0) + r / Math.max(0.01, speedNow(t)); // a survey UAV only when nothing else is coming
    if (score < bestScore) { bestScore = score; best = t; }
  }
  return best;
}

function fire(m: Match, bt: Battle, def: PlayerState, b: Battery, pad: Pad, t: Threat, dt: number) {
  const s = defence(b.sys);
  b.revealed = true;
  if (!PASSIVE_SYSTEMS.includes(b.sys)) b.emitted = true;
  if (t.isScout && s.kind !== 'laser') (t.firedBy ??= []).push(b.uid);
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
    knockedOut: def.buildings.filter(b => b.kind !== 'hideout' && b.battleDamage > 0 && b.down > 0 && b.down < 99).map(b => BUILDINGS.find(x => x.kind === b.kind)!.name),
    revealed: def.buildings.filter(b => b.revealed && b.kind !== 'hideout').length,
  };
  if (m.raid) {
    const max = def.buildings.reduce((s, b) => s + (b.maxHp ?? 0), 0), left = def.buildings.reduce((s, b) => s + (b.hp ?? 0), 0);
    const destroyedPct = max > 0 ? Math.round(100 * (1 - left / max)) : 0;
    const hqDown = def.buildings.some(b => b.kind === 'command' && b.down >= 99);
    m.lastReport.raid = { destroyedPct, hqDown, stars: (destroyedPct >= 50 ? 1 : 0) + (hqDown ? 1 : 0) + (destroyedPct >= 100 ? 1 : 0) };
    m.lastReport.knockedOut = def.buildings.filter(b => b.down >= 99).map(b => b.name ?? 'Building');
  }
  m.phase = 'report';
  m.phaseEndsAt = m.time + REPORT_SECONDS;
  log(m, `Strike over: ${bt.stats.stopped} stopped, ${bt.stats.hits} hits, ${bt.stats.damage} damage.`);
}

export function drainEvents(m: Match): BattleEvent[] {
  if (!m.battle) return [];
  const e = m.battle.events; m.battle.events = []; return e;
}
