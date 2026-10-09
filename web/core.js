"use strict";
(() => {
  // src/data.ts
  var d = (s) => s;
  var DEFENCES = [
    d({ id: "zu23", name: "ZU-23-2", kind: "gun", price: 10, shot: 0.01, load: 0, range: 2.5, fireEvery: 0.5, hit: { drone: 35, decoy: 35, uav: 15, cruise: 5 }, role: "Twin 23 mm gun. Cheapest drone defence." }),
    d({ id: "gepard", name: "Gepard", kind: "gun", price: 30, shot: 0.02, load: 0, range: 4, fireEvery: 0.5, hit: { drone: 55, decoy: 55, uav: 30, cruise: 15 }, role: "Radar-guided twin 35 mm gun." }),
    d({ id: "korkut", name: "Korkut", kind: "gun", price: 40, shot: 0.03, load: 0, range: 4, fireEvery: 0.5, hit: { drone: 65, decoy: 65, uav: 35, rocket: 10, cruise: 25 }, role: "35 mm airburst gun. Shreds drone swarms." }),
    d({ id: "stinger", name: "Stinger", kind: "sam", price: 15, shot: 0.4, load: 4, range: 5, fireEvery: 1.5, interceptorSpeed: 0.7, hit: { drone: 70, decoy: 70, uav: 60, cruise: 30 }, role: "Shoulder-fired IR missile." }),
    d({ id: "sungur", name: "Sungur", kind: "sam", price: 25, shot: 0.35, load: 4, range: 8, fireEvery: 1.5, interceptorSpeed: 0.75, hit: { drone: 75, decoy: 75, uav: 65, cruise: 35 }, role: "Vehicle-mounted short-range IR missile." }),
    d({ id: "alka", name: "ALKA", kind: "laser", price: 50, shot: 0, load: 0, range: 1, dwell: 1.5, needsPower: true, hit: { drone: 90, decoy: 90, uav: 40 }, role: "Laser. Burns down drones. Needs power." }),
    d({ id: "ironbeam", name: "Iron Beam", kind: "laser", price: 90, shot: 0, load: 0, range: 8, dwell: 2, needsPower: true, weatherHit: true, hit: { drone: 90, decoy: 90, uav: 50, rocket: 70, cruise: 20 }, role: "High-energy laser. Near-free shots; weather hurts it." }),
    d({ id: "koral", name: "Koral", kind: "ew", price: 80, shot: 0, load: 0, range: 150, needsPower: true, hit: { drone: 15, decoy: 15, uav: 40 }, role: "Electronic warfare. Drones lost, UAVs turned back, cruise accuracy down." }),
    d({ id: "pantsir", name: "Pantsir-S1", kind: "sam", price: 110, shot: 0.15, load: 12, range: 20, fireEvery: 1, interceptorSpeed: 1, hit: { drone: 80, decoy: 80, uav: 85, rocket: 40, cruise: 75 }, role: "Gun + missile short-range system." }),
    d({ id: "hisara", name: "Hisar-A+", kind: "sam", price: 120, shot: 0.5, load: 4, range: 15, fireEvery: 1.5, interceptorSpeed: 0.9, hit: { drone: 80, decoy: 80, uav: 88, cruise: 85 }, role: "Low-altitude missile. Workhorse against cruise missiles." }),
    d({ id: "irondome", name: "Iron Dome", kind: "sam", price: 150, shot: 0.06, load: 20, range: 70, fireEvery: 0.7, interceptorSpeed: 1.2, skipsMisses: true, hit: { drone: 80, decoy: 20, uav: 60, rocket: 90, cruise: 60 }, role: "Rocket killer. Ignores rockets that will miss the city." }),
    d({ id: "irist", name: "IRIS-T SLM", kind: "sam", price: 180, shot: 0.45, load: 8, range: 40, fireEvery: 1.2, interceptorSpeed: 1.3, hit: { drone: 85, decoy: 85, uav: 92, rocket: 40, cruise: 90 }, role: "Medium range. Excellent against cruise missiles." }),
    d({ id: "hisaro", name: "Hisar-O+", kind: "sam", price: 200, shot: 0.7, load: 6, range: 40, fireEvery: 1.2, interceptorSpeed: 1.3, hit: { drone: 85, decoy: 85, uav: 92, cruise: 88 }, role: "Medium-altitude missile. Kills UAVs before they fire." }),
    d({ id: "davidsling", name: "David's Sling", kind: "sam", price: 300, shot: 1, load: 8, range: 150, fireEvery: 1.5, interceptorSpeed: 2, hit: { decoy: 85, uav: 85, rocket: 85, cruise: 85, ballistic: 60 }, role: "Heavy rockets, cruise and short-range ballistic." }),
    d({ id: "siper", name: "Siper", kind: "sam", price: 380, shot: 1.5, load: 8, range: 150, fireEvery: 1.5, interceptorSpeed: 2, hit: { decoy: 85, uav: 95, cruise: 88, ballistic: 45 }, role: "Long-range area defence. Limited ballistic capability." }),
    d({ id: "s400", name: "S-400", kind: "sam", price: 450, shot: 1.5, load: 8, range: 250, fireEvery: 1.5, interceptorSpeed: 2.2, lowCruisePenalty: 20, hit: { decoy: 85, uav: 95, cruise: 70, ballistic: 65, hypersonic: 10 }, role: "Very long range. Low cruise missiles slip under it." }),
    d({ id: "patriot", name: "Patriot PAC-3 MSE", kind: "sam", price: 600, shot: 4, load: 8, range: 60, fireEvery: 1.2, interceptorSpeed: 2.5, hit: { decoy: 85, uav: 90, rocket: 60, cruise: 85, ballistic: 90, hypersonic: 35 }, role: "Hit-to-kill. The answer to ballistic missiles." })
  ];
  var a = (s) => s;
  var ATTACKS = [
    a({ id: "gerbera", name: "Gerbera decoy", cls: "decoy", unit: 0.05, launcher: 10, perTurn: 10, flight: 70, damage: 0, precise: false, imitates: "drone", role: "Looks like a drone. Wastes enemy interceptors." }),
    a({ id: "shahed", name: "Shahed-136", cls: "drone", unit: 0.1, launcher: 15, perTurn: 10, flight: 70, damage: 8, precise: false, scatter: 0.9, role: "Cheap swarm drone. Drains interceptors." }),
    a({ id: "kargu", name: "Kargu-2", cls: "drone", unit: 0.08, launcher: 10, perTurn: 8, flight: 40, damage: 4, precise: true, role: "Small loitering drone. Hits a revealed building." }),
    a({ id: "grad", name: "BM-21 Grad", cls: "rocket", unit: 1.5, launcher: 20, perTurn: 1, flight: 20, damage: 3, precise: false, salvo: 40, scatter: 0.5, role: "40-rocket salvo. Unguided; about half land in empty areas." }),
    a({ id: "trg300", name: "TRG-300", cls: "rocket", unit: 0.6, launcher: 40, perTurn: 4, flight: 18, damage: 25, precise: true, role: "Guided 300 mm rocket." }),
    a({ id: "himars", name: "HIMARS GMLRS", cls: "rocket", unit: 0.3, launcher: 60, perTurn: 6, flight: 18, damage: 20, precise: true, role: "GPS-guided rockets, six per pod." }),
    a({ id: "tb2", name: "Bayraktar TB2", cls: "uav", unit: 15, launcher: 0, perTurn: 99, flight: 60, damage: 10, precise: true, reusable: true, munitions: 4, munitionCost: 0.1, role: "Armed UAV, 4 MAM-L. Comes back if it survives." }),
    a({ id: "akinci", name: "Bayraktar Ak\u0131nc\u0131", cls: "uav", unit: 40, launcher: 0, perTurn: 99, flight: 45, damage: 45, precise: true, reusable: true, munitions: 2, munitionCost: 1, role: "Heavy UAV, 2 SOM-J. Comes back if it survives." }),
    a({ id: "som", name: "SOM", cls: "cruise", unit: 1.2, launcher: 50, perTurn: 2, flight: 35, damage: 50, precise: true, low: true, role: "Low-flying Turkish cruise missile." }),
    a({ id: "tomahawk", name: "Tomahawk", cls: "cruise", unit: 2, launcher: 60, perTurn: 2, flight: 35, damage: 60, precise: true, low: true, role: "Low-flying cruise missile." }),
    a({ id: "tayfun", name: "Tayfun", cls: "ballistic", unit: 3.5, launcher: 90, perTurn: 2, flight: 12, damage: 80, precise: true, role: "Turkish ballistic missile." }),
    a({ id: "iskander", name: "Iskander-M", cls: "ballistic", unit: 3, launcher: 90, perTurn: 2, flight: 12, damage: 80, precise: true, decoysAtEnd: 2, role: "Ballistic; releases two decoys near the end." }),
    a({ id: "kinzhal", name: "Kinzhal", cls: "hypersonic", unit: 8, launcher: 150, perTurn: 1, flight: 6, damage: 100, precise: true, role: "Hypersonic. Only Patriot has a real chance." })
  ];
  var SCOUTS = [
    { id: "tb2s", name: "Bayraktar TB2 (scout)", price: 15, altitude: "medium", reveal: 1.5, flight: 60, role: "Reveals buildings close to its path. Easy to shoot down." },
    { id: "anka", name: "TAI Anka", price: 30, altitude: "high", reveal: 3, flight: 50, role: "Wider view, harder to hit." },
    { id: "globalhawk", name: "RQ-4 Global Hawk", price: 90, altitude: "very high", reveal: 8, flight: 45, onlyLongRange: true, role: "Sees almost everything. Only long-range SAMs reach it." }
  ];
  var LONG_RANGE_SAMS = ["davidsling", "siper", "s400", "patriot"];
  var CITY_RADIUS = 6;
  var SPAWN_DISTANCE = 300;
  var RULES = {
    setupSeconds: 120,
    turnSeconds: 60,
    turnSecondsCommandHit: 30,
    disconnectSeconds: 60,
    cityHealth: 1e3,
    startBudget: 600,
    income: 120,
    knockoutDamage: 20,
    buildingHitRadius: 0.4,
    // km: an unguided hit this close to a building counts on it
    badWeatherChance: 0.2,
    visualRange: 15
    // km: what you see with no working radar
  };
  var RADAR_LEVELS = {
    range: [80, 130, 180, 250],
    identify: [20, 50, 100, Infinity],
    // km: type shown inside this distance
    decoy: [0, 30, 70, Infinity],
    // km: decoys marked inside this distance (0 = never)
    cost: [0, 40, 80, 140],
    // upgrade to that level, per track
    names: ["Kalkan", "EL/M-2084", "EL/M-2084 MMR", "AN/TPY-2"]
  };
  var EXTRA_RADAR_PRICE = 50;
  var POWER_RADAR_PENALTY = 0.3;
  var DEF_UPGRADE = { hitBonus: 8, loadBonus: 0.25, costFactor: [0, 0, 0.5, 1] };
  var OFF_UPGRADES = {
    warhead: { label: "Warhead", effect: "Damage +15% per level", cost: [40, 80, 140] },
    guidance: { label: "Guidance", effect: "Fewer misses per level", cost: [40, 80, 140] },
    stealth: { label: "Low observable", effect: "Enemy hit chance \u22125 pts per level", cost: [60, 120, 200] },
    capacity: { label: "Launch capacity", effect: "+50% launches per turn per level", cost: [30, 60, 100] }
  };
  var ECONOMY = {
    income: { label: "Income", values: [0, 20, 40, 60], cost: [100, 180, 280] },
    storage: { label: "Underground storage", values: [10, 20, 35, 50], cost: [60, 120, 200] },
    logistics: { label: "Logistics", values: [2, 4, 6, 9], cost: [50, 100, 180] },
    repair: { label: "Repair crews", values: [3, 2, 1], cost: [60, 120] }
  };
  var BUILDINGS = [
    { kind: "command", name: "Command centre", effect: "Next turn 30 s instead of 60 s", repairNow: 40 },
    { kind: "radar", name: "Radar site", effect: "That radar's coverage is lost", repairNow: 30 },
    { kind: "power", name: "Power plant", effect: "Lasers and Koral off; radar range \u221230%", repairNow: 50 },
    { kind: "depot", name: "Ammunition depot", effect: "Stock above the protected slots is lost", repairNow: 40 },
    { kind: "factory", name: "Missile factory", effect: "Can't buy missiles or rockets", repairNow: 40 },
    { kind: "airbase", name: "Airbase", effect: "UAVs can't take off", repairNow: 30 },
    { kind: "finance", name: "Financial district", effect: "Income \u221230%", repairNow: 50 }
  ];
  var FINANCE_PENALTY = 0.3;
  var defence = (id) => DEFENCES.find((s) => s.id === id);
  var attack = (id) => ATTACKS.find((s) => s.id === id);
  var scout = (id) => SCOUTS.find((s) => s.id === id);

  // src/rng.ts
  function nextRandom(state) {
    let t = state.rng = state.rng + 1831565813 | 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // src/geometry.ts
  var UNITS_PER_KM = 106 / CITY_RADIUS;
  var toKm = (u) => Math.round(u / UNITS_PER_KM * 1e3) / 1e3;
  var RIVER = { x: -16, z: 0, angle: 0.38 };
  var RC = Math.cos(RIVER.angle);
  var RS = Math.sin(RIVER.angle);
  var riverDist = (x, z) => Math.abs((x - RIVER.x) * RC - (z - RIVER.z) * RS);
  var LANDMARK = { x: -44, z: -26 };
  function padLayout() {
    const pads = [];
    for (const [r, n, off] of [[22, 6, 0.5], [50, 8, 0.2], [84, 10, 0.35]]) {
      for (let i = 0; i < n; i++) {
        const a2 = off + i * Math.PI * 2 / n;
        const x = Math.cos(a2) * r, z = Math.sin(a2) * r;
        if (riverDist(x, z) < 10) continue;
        pads.push({ id: pads.length, x: toKm(x), z: toKm(z) });
      }
    }
    return pads;
  }
  function buildingSlots() {
    const pads = padLayout().map((p) => ({ x: p.x * UNITS_PER_KM, z: p.z * UNITS_PER_KM }));
    const cands = [];
    for (let gx = -8; gx <= 8; gx++) for (let gz = -8; gz <= 8; gz++) {
      const x = gx * 11, z = gz * 11, r = Math.hypot(x, z);
      if (r < 18 || r > 90) continue;
      if (riverDist(x, z) < 15) continue;
      if (Math.hypot(x - LANDMARK.x, z - LANDMARK.z) < 18) continue;
      if (pads.some((p) => Math.hypot(p.x - x, p.z - z) < 13)) continue;
      cands.push({ x, z });
    }
    const out = [cands[0]];
    while (out.length < 16 && out.length < cands.length) {
      let best = cands[0], bestD = -1;
      for (const c of cands) {
        const d2 = Math.min(...out.map((o) => Math.hypot(o.x - c.x, o.z - c.z)));
        if (d2 > bestD) {
          bestD = d2;
          best = c;
        }
      }
      out.push(best);
    }
    return out.map((p) => ({ x: toKm(p.x), z: toKm(p.z) }));
  }

  // src/match.ts
  var MISSILE_CLASSES = ["rocket", "cruise", "ballistic", "hypersonic"];
  var REPORT_SECONDS = 6;
  var RELOAD_SECONDS = 5;
  var CHEAP_THREATS = ["drone", "decoy"];
  var EXPENSIVE_SHOT = 1;
  var rnd = (m) => nextRandom(m);
  var uid = (m) => m.nextUid++;
  var dist = (a2, b) => Math.hypot(a2.x - b.x, a2.z - b.z);
  var round = (v) => Math.round(v * 1e3) / 1e3;
  var other = (p) => p === 0 ? 1 : 0;
  var SLOTS = buildingSlots();
  function freeSpot(m, p) {
    const free = SLOTS.filter((s) => !p.buildings.some((b) => dist(b, s) < 0.05));
    if (!free.length) return void 0;
    return free[Math.floor(rnd(m) * free.length) % free.length];
  }
  function addBuilding(m, p, kind) {
    const spot = freeSpot(m, p);
    if (!spot) return void 0;
    const b = { uid: uid(m), kind, x: spot.x, z: spot.z, down: 0, revealed: false, battleDamage: 0 };
    p.buildings.push(b);
    return b;
  }
  function newPlayer(index, name, isAI) {
    return {
      index,
      name,
      isAI,
      budget: RULES.startBudget,
      health: RULES.cityHealth,
      pads: padLayout(),
      scars: [],
      batteries: [],
      buildings: [],
      interceptors: {},
      launchers: {},
      stock: {},
      scouts: {},
      launched: {},
      offUp: {},
      econ: { income: 0, storage: 0, logistics: 0, repair: 0 },
      radar: { range: 0, identify: 0, decoy: 0 },
      autoFire: true,
      reloadsLeft: 0,
      spent: 0,
      conceded: false,
      ready: false
    };
  }
  function createMatch(seed, names, ai = [false, false]) {
    const m = {
      version: 1,
      rng: seed | 0,
      time: 0,
      phase: "setup",
      phaseEndsAt: RULES.setupSeconds,
      active: 0,
      turnNo: 0,
      weatherBad: false,
      players: [newPlayer(0, names[0], ai[0]), newPlayer(1, names[1], ai[1])],
      nextUid: 1,
      log: []
    };
    for (const p of m.players) for (const b of BUILDINGS) addBuilding(m, p, b.kind);
    return m;
  }
  var working = (p, kind) => p.buildings.some((b) => b.kind === kind && b.down === 0);
  var powerOn = (p) => working(p, "power");
  function incomeFor(p) {
    const base = RULES.income + ECONOMY.income.values[p.econ.income];
    return working(p, "finance") ? base : round(base * (1 - FINANCE_PENALTY));
  }
  function radarRange(p) {
    if (!working(p, "radar")) return RULES.visualRange;
    const r = RADAR_LEVELS.range[p.radar.range];
    return powerOn(p) ? r : r * (1 - POWER_RADAR_PENALTY);
  }
  function launchCap(p, weapon) {
    const w = attack(weapon);
    if (w.reusable) return p.stock[weapon] ?? 0;
    const cap = (p.offUp[weapon]?.capacity ?? 0) * 0.5 + 1;
    return Math.floor((p.launchers[weapon] ?? 0) * w.perTurn * cap);
  }
  function storedUnits(p) {
    let n = 0;
    for (const k in p.interceptors) n += p.interceptors[k];
    for (const k in p.stock) if (!attack(k).reusable) n += p.stock[k];
    return n;
  }
  function batteryLoad(b) {
    const s = defence(b.sys);
    return Math.round(s.load * (1 + DEF_UPGRADE.loadBonus * (b.level - 1)));
  }
  function upgradeBatteryCost(b) {
    if (b.level >= 3) return null;
    return round(defence(b.sys).price * DEF_UPGRADE.costFactor[b.level + 1]);
  }
  function spend(p, amount) {
    if (amount > p.budget + 1e-9) return false;
    p.budget = round(p.budget - amount);
    p.spent = round(p.spent + amount);
    return true;
  }
  function log(m, text) {
    m.log.push({ time: round(m.time), text });
    if (m.log.length > 60) m.log.shift();
  }
  function canShop(m, p) {
    return m.phase === "setup" || m.phase === "turn" && m.active === p;
  }
  var fail = (error) => ({ ok: false, error });
  var ok = { ok: true };
  function command(m, pi, cmd) {
    const p = m.players[pi];
    if (m.phase === "over") return fail("The match is over.");
    if (cmd.c === "concede") {
      p.conceded = true;
      finish(m, other(pi), "conceded");
      return ok;
    }
    if (cmd.c === "setAutoFire" || cmd.c === "priority" || cmd.c === "holdThreat" || cmd.c === "holdBattery") {
      if (cmd.c === "setAutoFire") {
        p.autoFire = cmd.on;
        return ok;
      }
      if (cmd.c === "holdBattery") {
        const b = p.batteries.find((x) => x.uid === cmd.uid);
        if (!b) return fail("No such battery.");
        b.holdFire = !b.holdFire;
        return ok;
      }
      const bt = m.battle;
      if (!bt || bt.defender !== pi) return fail("Only the defender can do that during a strike.");
      const t = bt.threats.find((x) => x.uid === cmd.uid && x.alive && x.detected);
      if (!t) return fail("Contact lost.");
      if (cmd.c === "priority") {
        t.priority = !t.priority;
        if (t.priority) t.hold = false;
      } else {
        t.hold = !t.hold;
        if (t.hold) t.priority = false;
      }
      return ok;
    }
    if (cmd.c === "continue") {
      if (m.phase === "report") {
        startTurn(m, other(m.lastReport.attacker));
        return ok;
      }
      return fail("Nothing to continue.");
    }
    if (cmd.c === "endSetup") {
      if (m.phase !== "setup") return fail("Setup is over.");
      p.ready = true;
      if (m.players.every((q) => q.ready)) startTurn(m, 0);
      return ok;
    }
    if (cmd.c === "wait") {
      if (m.phase !== "turn" || m.active !== pi) return fail("Not your turn.");
      log(m, `${p.name} holds fire and saves money.`);
      startTurn(m, other(pi));
      return ok;
    }
    if (cmd.c === "go") {
      if (m.phase !== "turn" || m.active !== pi) return fail("Not your turn.");
      return launch(m, pi, cmd.strikes, cmd.scouts);
    }
    if (!canShop(m, pi)) return fail("You can buy only during setup or your own turn.");
    const factoryUp = working(p, "factory");
    switch (cmd.c) {
      case "buyBattery": {
        const s = DEFENCES.find((x) => x.id === cmd.sys);
        if (!s) return fail("Unknown system.");
        if (!p.pads.some((x) => x.id === cmd.pad)) return fail("No such pad.");
        if (p.batteries.some((b) => b.pad === cmd.pad)) return fail("That pad is taken.");
        if (!spend(p, s.price)) return fail("Not enough budget.");
        p.batteries.push({ uid: uid(m), sys: s.id, pad: cmd.pad, level: 1, ammo: s.load, cooldown: 0, reloading: 0, holdFire: false, revealed: false, kills: 0, dwell: 0 });
        return ok;
      }
      case "upgradeBattery": {
        const b = p.batteries.find((x) => x.uid === cmd.uid);
        if (!b) return fail("No such battery.");
        const cost = upgradeBatteryCost(b);
        if (cost == null) return fail("Already at the top level.");
        if (!spend(p, cost)) return fail("Not enough budget.");
        b.level++;
        b.ammo = Math.min(batteryLoad(b), b.ammo + Math.round(defence(b.sys).load * DEF_UPGRADE.loadBonus));
        return ok;
      }
      case "sellBattery": {
        const i = p.batteries.findIndex((x) => x.uid === cmd.uid);
        if (i < 0) return fail("No such battery.");
        const b = p.batteries[i];
        p.budget = round(p.budget + defence(b.sys).price * 0.5);
        p.batteries.splice(i, 1);
        return ok;
      }
      case "buyInterceptors": {
        const s = DEFENCES.find((x) => x.id === cmd.sys);
        if (!s || s.load === 0) return fail("That system needs no interceptors.");
        if (!factoryUp) return fail("Missile factory is knocked out.");
        const n = Math.max(1, Math.floor(cmd.n));
        if (!spend(p, s.shot * n)) return fail("Not enough budget.");
        p.interceptors[s.id] = (p.interceptors[s.id] ?? 0) + n;
        return ok;
      }
      case "buyLauncher": {
        const w = ATTACKS.find((x) => x.id === cmd.weapon);
        if (!w || w.reusable) return fail("No launcher needed.");
        if (!spend(p, w.launcher)) return fail("Not enough budget.");
        p.launchers[w.id] = (p.launchers[w.id] ?? 0) + 1;
        return ok;
      }
      case "buyUnits": {
        const w = ATTACKS.find((x) => x.id === cmd.weapon);
        if (!w) return fail("Unknown weapon.");
        if (!w.reusable && !factoryUp) return fail("Missile factory is knocked out.");
        const n = Math.max(1, Math.floor(cmd.n));
        if (!spend(p, w.unit * n)) return fail("Not enough budget.");
        p.stock[w.id] = (p.stock[w.id] ?? 0) + n;
        return ok;
      }
      case "buyScout": {
        const s = SCOUTS.find((x) => x.id === cmd.scout);
        if (!s) return fail("Unknown UAV.");
        if (!spend(p, s.price)) return fail("Not enough budget.");
        p.scouts[s.id] = (p.scouts[s.id] ?? 0) + 1;
        return ok;
      }
      case "upgradeOffence": {
        const w = ATTACKS.find((x) => x.id === cmd.weapon);
        const tr = OFF_UPGRADES[cmd.track];
        if (!w || !tr) return fail("Unknown upgrade.");
        const lv = p.offUp[w.id]?.[cmd.track] ?? 0;
        if (lv >= 3) return fail("Already at the top level.");
        if (!spend(p, tr.cost[lv])) return fail("Not enough budget.");
        p.offUp[w.id] = { ...p.offUp[w.id], [cmd.track]: lv + 1 };
        return ok;
      }
      case "upgradeEconomy": {
        const tr = ECONOMY[cmd.track];
        if (!tr) return fail("Unknown upgrade.");
        const lv = p.econ[cmd.track];
        if (lv >= tr.cost.length) return fail("Already at the top level.");
        if (!spend(p, tr.cost[lv])) return fail("Not enough budget.");
        p.econ[cmd.track] = lv + 1;
        return ok;
      }
      case "upgradeRadar": {
        const lv = p.radar[cmd.track];
        if (lv >= 3) return fail("Already at the top level.");
        if (!spend(p, RADAR_LEVELS.cost[lv + 1])) return fail("Not enough budget.");
        p.radar[cmd.track] = lv + 1;
        return ok;
      }
      case "buyRadarSite": {
        if (!freeSpot(m, p)) return fail("No free plot left in the city.");
        if (!spend(p, EXTRA_RADAR_PRICE)) return fail("Not enough budget.");
        addBuilding(m, p, "radar");
        return ok;
      }
      case "repairNow": {
        const b = p.buildings.find((x) => x.uid === cmd.uid);
        if (!b || b.down === 0) return fail("Nothing to repair.");
        const cost = BUILDINGS.find((x) => x.kind === b.kind).repairNow;
        if (!spend(p, cost)) return fail("Not enough budget.");
        b.down = 0;
        return ok;
      }
    }
    return fail("Unknown command.");
  }
  function startTurn(m, who) {
    m.phase = "turn";
    m.active = who;
    m.turnNo++;
    m.battle = void 0;
    const p = m.players[who];
    for (const b of p.buildings) if (b.down > 0) b.down--;
    const commandHit = !working(p, "command");
    p.budget = round(p.budget + incomeFor(p));
    p.launched = {};
    m.weatherBad = rnd(m) < RULES.badWeatherChance;
    m.phaseEndsAt = m.time + (commandHit ? RULES.turnSecondsCommandHit : RULES.turnSeconds);
    log(m, `Turn ${m.turnNo}: ${p.name}. +$${incomeFor(p)}M income.${commandHit ? " Command centre down: 30 s." : ""}`);
  }
  function finish(m, winner, reason) {
    m.phase = "over";
    m.winner = winner;
    m.endReason = reason;
    m.battle = void 0;
    log(m, `${m.players[winner].name} wins (${reason}).`);
  }
  function launch(m, pi, strikes, scouts) {
    const att = m.players[pi], def = m.players[other(pi)];
    const airbase = working(att, "airbase");
    const want = {};
    for (const s of strikes) {
      const w = ATTACKS.find((x) => x.id === s.weapon);
      if (!w) return fail("Unknown weapon.");
      const n = Math.floor(s.n);
      if (n <= 0) continue;
      if (w.cls === "uav" && !airbase) return fail("Airbase is knocked out: UAVs cannot take off.");
      want[w.id] = (want[w.id] ?? 0) + n;
      if (s.target != null && !def.buildings.some((b) => b.uid === s.target && b.revealed)) return fail("That target has not been revealed.");
    }
    for (const id in want) {
      if ((att.stock[id] ?? 0) < want[id]) return fail(`Not enough ${attack(id).name} in stock.`);
      if (want[id] > launchCap(att, id)) return fail(`${attack(id).name}: launch capacity is ${launchCap(att, id)} this turn.`);
    }
    const wantScouts = {};
    for (const s of scouts) {
      if (!SCOUTS.some((x) => x.id === s.scout)) return fail("Unknown UAV.");
      if (!airbase) return fail("Airbase is knocked out: UAVs cannot take off.");
      wantScouts[s.scout] = (wantScouts[s.scout] ?? 0) + 1;
      if ((att.scouts[s.scout] ?? 0) < wantScouts[s.scout]) return fail(`No ${scout(s.scout).name} available.`);
      if (s.path.length < 1) return fail("Draw a path for the UAV.");
    }
    if (Object.keys(want).length === 0 && scouts.length === 0) return fail("Nothing to launch.");
    let munitionCost = 0;
    for (const id in want) {
      const w = attack(id);
      if (w.munitionCost) munitionCost += w.munitionCost * (w.munitions ?? 0) * want[id];
    }
    if (!spend(att, munitionCost)) return fail("Not enough budget for the UAV munitions.");
    const bt = {
      attacker: pi,
      defender: other(pi),
      time: 0,
      threats: [],
      interceptors: [],
      events: [],
      stats: { launched: 0, stopped: 0, hits: 0, damage: 0, interceptorsUsed: 0, defenceSpent: 0, attackSpent: munitionCost },
      over: false
    };
    m.battle = bt;
    m.phase = "battle";
    def.reloadsLeft = ECONOMY.logistics.values[def.econ.logistics];
    for (const b of def.batteries) {
      b.cooldown = 0;
      b.reloading = 0;
      b.dwell = 0;
      b.dwellTarget = void 0;
      topUp(def, b);
    }
    for (const b of def.buildings) b.battleDamage = 0;
    for (const s of strikes) {
      const w = attack(s.weapon);
      const n = Math.floor(s.n);
      if (n <= 0) continue;
      att.stock[w.id] -= n;
      att.launched[w.id] = (att.launched[w.id] ?? 0) + n;
      for (let i = 0; i < n; i++) {
        if (w.salvo) for (let r = 0; r < w.salvo; r++) spawnStrike(m, bt, att, def, w.id, s.target, rnd(m) * 4);
        else spawnStrike(m, bt, att, def, w.id, s.target, rnd(m) * 8);
      }
      bt.stats.attackSpent = round(bt.stats.attackSpent + (w.reusable ? 0 : w.unit * n));
    }
    for (const s of scouts) {
      att.scouts[s.scout]--;
      spawnScout(m, bt, s.scout, s.path);
    }
    bt.stats.launched = bt.threats.length;
    log(m, `${att.name} launches ${bt.threats.length} contacts at ${def.name}.`);
    return ok;
  }
  function topUp(p, b) {
    const s = defence(b.sys);
    if (s.load === 0) return;
    const need = batteryLoad(b) - b.ammo;
    if (need <= 0) return;
    const have = p.interceptors[s.id] ?? 0;
    const n = Math.min(need, have);
    b.ammo += n;
    p.interceptors[s.id] = have - n;
  }
  function spawnPoint(m, d2 = SPAWN_DISTANCE) {
    const a2 = -Math.PI / 2 + (rnd(m) - 0.5) * (Math.PI / 3);
    return { x: round(Math.cos(a2) * d2), z: round(Math.sin(a2) * d2) };
  }
  function randomCityPoint(m, inside) {
    const a2 = rnd(m) * Math.PI * 2;
    const r = inside ? Math.sqrt(rnd(m)) * CITY_RADIUS : CITY_RADIUS + 0.5 + rnd(m) * 4;
    return { x: round(Math.cos(a2) * r), z: round(Math.sin(a2) * r) };
  }
  function baseThreat(m) {
    return {
      uid: uid(m),
      weapon: "",
      cls: "drone",
      looksLike: "drone",
      isScout: false,
      path: [],
      leg: 0,
      speed: 0,
      speedIn: 0,
      x: 0,
      z: 0,
      alt: 0,
      peakAlt: 0,
      traveled: 0,
      total: 0,
      delay: 0,
      alive: true,
      landed: false,
      landsInCity: false,
      damage: 0,
      precise: false,
      low: false,
      detected: false,
      identified: false,
      decoyMarked: false,
      priority: false,
      hold: false,
      engaged: 0,
      ewChecked: false,
      returning: false,
      munitions: 0,
      dropCooldown: 0,
      revealRadius: 0,
      spawnedDecoys: false,
      stealth: 0
    };
  }
  var TERMINAL = 20;
  function setSpeeds(t, from, flight) {
    const d2 = Math.hypot(from.x, from.z);
    const inner = Math.min(TERMINAL, d2), outer = d2 - inner;
    if (outer > 0) {
      t.speed = outer / (flight / 2);
      t.speedIn = inner / (flight / 2);
    } else {
      t.speed = t.speedIn = d2 / flight;
    }
  }
  var speedNow = (t) => Math.hypot(t.x, t.z) > TERMINAL ? t.speed : t.speedIn;
  var SPAWN_DIST = { kargu: 30, grad: 40, himars: 80, trg300: 100 };
  var PEAK = { drone: 0.3, decoy: 0.3, uav: 5, rocket: 12, cruise: 0.05, ballistic: 80, hypersonic: 25 };
  function spawnStrike(m, bt, att, def, weapon, target, delay) {
    const w = attack(weapon);
    const up = att.offUp[weapon] ?? {};
    const start = spawnPoint(m, SPAWN_DIST[weapon] ?? SPAWN_DISTANCE);
    const t = baseThreat(m);
    t.weapon = weapon;
    t.cls = w.cls;
    t.looksLike = w.imitates ?? w.cls;
    t.delay = delay;
    t.precise = w.precise;
    t.low = !!w.low;
    t.stealth = (up.stealth ?? 0) * 5;
    t.damage = round(w.damage * (1 + 0.15 * (up.warhead ?? 0)));
    t.peakAlt = PEAK[w.cls];
    let aim;
    const tb = target != null ? def.buildings.find((b) => b.uid === target) : void 0;
    if (w.cls === "decoy") {
      aim = randomCityPoint(m, true);
      t.landsInCity = false;
    } else if (w.precise) {
      let miss = Math.max(0, 0.1 - 0.1 * (up.guidance ?? 0));
      if (w.cls === "cruise" && def.batteries.some((b) => b.sys === "koral") && powerOn(def)) miss += 0.2;
      if (rnd(m) < miss) {
        aim = randomCityPoint(m, rnd(m) < 0.5);
      } else if (tb) {
        aim = { x: tb.x, z: tb.z };
        t.targetBuilding = tb.uid;
      } else aim = randomCityPoint(m, true);
    } else {
      const share = Math.min(1, (w.scatter ?? 1) + 0.1 * (up.guidance ?? 0));
      aim = randomCityPoint(m, rnd(m) < share);
    }
    t.landsInCity = w.cls !== "decoy" && Math.hypot(aim.x, aim.z) <= CITY_RADIUS;
    if (w.cls === "uav") {
      t.munitions = w.munitions ?? 0;
      t.path = [start, tb ? { x: tb.x, z: tb.z } : randomCityPoint(m, true), start];
      t.targetBuilding = tb?.uid;
    } else t.path = [start, aim];
    t.x = start.x;
    t.z = start.z;
    setSpeeds(t, start, w.flight);
    t.total = dist(t.path[0], t.path[1]);
    bt.threats.push(t);
  }
  function spawnScout(m, bt, id, path) {
    const s = scout(id);
    const start = spawnPoint(m);
    const t = baseThreat(m);
    t.weapon = id;
    t.cls = "uav";
    t.looksLike = "uav";
    t.isScout = true;
    t.delay = rnd(m) * 3;
    t.peakAlt = s.altitude === "medium" ? 5 : s.altitude === "high" ? 9 : 18;
    t.revealRadius = s.reveal;
    t.path = [start, ...path.map((p) => ({ x: round(p.x), z: round(p.z) })), start];
    t.x = start.x;
    t.z = start.z;
    setSpeeds(t, start, s.flight);
    t.total = dist(start, t.path[1]);
    bt.threats.push(t);
  }
  var STEP = 0.1;
  function tick(m, dt) {
    let left = dt;
    while (left > 1e-9) {
      const s = Math.min(STEP, left);
      step(m, s);
      left -= s;
    }
  }
  function step(m, dt) {
    m.time = round(m.time + dt);
    if (m.phase === "setup" && m.time >= m.phaseEndsAt) startTurn(m, 0);
    else if (m.phase === "turn" && m.time >= m.phaseEndsAt) {
      log(m, `${m.players[m.active].name} ran out of time.`);
      startTurn(m, other(m.active));
    } else if (m.phase === "report" && m.time >= m.phaseEndsAt) startTurn(m, other(m.lastReport.attacker));
    else if (m.phase === "battle" && m.battle) battleStep(m, m.battle, dt);
  }
  function emit(bt, e) {
    bt.events.push(e);
    if (bt.events.length > 400) bt.events.shift();
  }
  function hitChance(m, def, b, t) {
    const s = defence(b.sys);
    let cls = t.cls;
    if (t.isScout) {
      const sc = scout(t.weapon);
      if (sc.onlyLongRange && !LONG_RANGE_SAMS.includes(s.id)) return 0;
      let p2 = s.hit.uav ?? 0;
      if (p2 === 0) return 0;
      if (sc.altitude === "high" && s.range < 40) p2 -= 25;
      return clampHit(p2 + (b.level - 1) * 8);
    }
    if (t.weapon === "decoy") cls = "decoy";
    let p = s.hit[cls] ?? 0;
    if (p === 0) return 0;
    if (s.lowCruisePenalty && t.low) p -= s.lowCruisePenalty;
    if (s.weatherHit && m.weatherBad) p *= 0.5;
    p += (b.level - 1) * 8 - t.stealth;
    return clampHit(p);
  }
  var clampHit = (p) => Math.max(0, Math.min(98, p));
  function batteryReady(def, b) {
    const s = defence(b.sys);
    if (b.holdFire) return false;
    if (s.needsPower && !powerOn(def)) return false;
    return true;
  }
  function battleStep(m, bt, dt) {
    const att = m.players[bt.attacker], def = m.players[bt.defender];
    bt.time = round(bt.time + dt);
    const rr = radarRange(def);
    const idR = working(def, "radar") ? RADAR_LEVELS.identify[def.radar.identify] : 5;
    const decoyR = working(def, "radar") ? RADAR_LEVELS.decoy[def.radar.decoy] : 0;
    for (const t of bt.threats) {
      if (!t.alive) continue;
      if (t.delay > 0) {
        t.delay -= dt;
        continue;
      }
      moveThreat(m, bt, att, def, t, dt);
      if (!t.alive) continue;
      const r = Math.hypot(t.x, t.z);
      if (!t.detected && r <= rr) t.detected = true;
      if (t.detected && !t.identified && r <= idR) t.identified = true;
      if (t.detected && !t.decoyMarked && (t.cls === "decoy" || t.weapon === "decoy") && decoyR > 0 && r <= decoyR) t.decoyMarked = true;
      if (!t.ewChecked) {
        const ew = def.batteries.find((b) => b.sys === "koral" && batteryReady(def, b) && dist(def.pads[b.pad], t) <= defence("koral").range);
        if (ew) {
          t.ewChecked = true;
          const p = (defence("koral").hit[t.cls] ?? 0) / 100;
          if (p > 0 && rnd(m) < p) {
            if (t.cls === "uav") {
              t.returning = true;
              t.munitions = 0;
              turnBack(t);
              emit(bt, { t: "msg", text: `Koral turned back a ${t.isScout ? "scout" : "UAV"}.`, tone: "good" });
            } else {
              kill(bt, t, def, ew);
            }
          }
        }
      }
    }
    for (const b of def.batteries) {
      const s = defence(b.sys);
      if (s.kind === "ew") continue;
      if (b.reloading > 0) {
        b.reloading -= dt;
        if (b.reloading <= 0) {
          topUp(def, b);
          b.reloading = 0;
        }
        continue;
      }
      if (b.cooldown > 0) {
        b.cooldown -= dt;
        continue;
      }
      if (!batteryReady(def, b)) continue;
      if (s.load > 0 && b.ammo <= 0) {
        if ((def.interceptors[s.id] ?? 0) > 0 && def.reloadsLeft > 0) {
          def.reloadsLeft--;
          b.reloading = RELOAD_SECONDS;
        }
        continue;
      }
      const pad = def.pads[b.pad];
      const target = pickTarget(m, bt, def, b, pad);
      if (!target) {
        if (s.kind === "laser") {
          b.dwell = 0;
          b.dwellTarget = void 0;
        }
        continue;
      }
      fire(m, bt, def, b, pad, target, dt);
    }
    for (const it of bt.interceptors) {
      const t = bt.threats.find((x) => x.uid === it.target);
      if (!t || !t.alive) {
        it.target = -1;
        continue;
      }
      const dx = t.x - it.x, dz = t.z - it.z, da = t.alt - it.alt;
      const d3 = Math.hypot(dx, dz, da);
      const move = Math.max(it.speed, speedNow(t) * 1.5) * dt;
      if (d3 <= move) {
        t.engaged = Math.max(0, t.engaged - 1);
        const b = def.batteries.find((x) => x.uid === it.battery);
        const p = b ? hitChance(m, def, b, t) : 0;
        if (rnd(m) * 100 < p) kill(bt, t, def, b);
        else emit(bt, { t: "miss", x: t.x, z: t.z, alt: t.alt });
        it.target = -1;
      } else {
        it.x += dx / d3 * move;
        it.z += dz / d3 * move;
        it.alt += da / d3 * move;
      }
    }
    bt.interceptors = bt.interceptors.filter((i) => i.target >= 0);
    if (def.health <= 0) {
      def.health = 0;
      finish(m, bt.attacker, "destroyed");
      return;
    }
    if (bt.threats.every((t) => !t.alive) && bt.interceptors.length === 0) endBattle(m, bt);
  }
  function turnBack(t) {
    const home = t.path[0];
    t.path = [{ x: t.x, z: t.z }, home];
    t.leg = 0;
    t.traveled = 0;
    t.total = dist(t.path[0], t.path[1]);
  }
  function moveThreat(m, bt, att, def, t, dt) {
    let move = speedNow(t) * dt;
    while (move > 0 && t.alive) {
      const a3 = t.path[t.leg], b2 = t.path[t.leg + 1];
      if (!b2) break;
      const legLen2 = dist(a3, b2);
      const left = legLen2 - t.traveled;
      if (move < left) {
        t.traveled += move;
        move = 0;
      } else {
        move -= left;
        t.traveled = 0;
        t.leg++;
        arrive(m, bt, att, def, t);
      }
    }
    if (!t.alive) return;
    const a2 = t.path[t.leg], b = t.path[t.leg + 1] ?? a2;
    const legLen = dist(a2, b) || 1;
    const u = Math.min(1, t.traveled / legLen);
    t.x = round(a2.x + (b.x - a2.x) * u);
    t.z = round(a2.z + (b.z - a2.z) * u);
    if (t.cls === "rocket" || t.cls === "ballistic" || t.cls === "hypersonic" || t.weapon === "decoy") t.alt = round(t.peakAlt * 4 * u * (1 - u) + (t.cls === "hypersonic" ? 2 * (1 - u) : 0));
    else if (t.cls === "cruise") t.alt = 0.05;
    else t.alt = t.peakAlt;
    if (t.weapon === "iskander" && !t.spawnedDecoys && u > 0.6) {
      t.spawnedDecoys = true;
      for (let i = 0; i < (attack("iskander").decoysAtEnd ?? 0); i++) {
        const d2 = baseThreat(m);
        d2.weapon = "decoy";
        d2.cls = "decoy";
        d2.looksLike = "ballistic";
        d2.peakAlt = t.alt;
        const aim = randomCityPoint(m, true);
        d2.path = [{ x: t.x, z: t.z }, aim];
        d2.x = t.x;
        d2.z = t.z;
        d2.alt = t.alt;
        d2.total = dist(d2.path[0], aim);
        d2.speed = t.speed;
        d2.speedIn = t.speedIn;
        d2.detected = t.detected;
        d2.identified = t.identified;
        bt.threats.push(d2);
      }
    }
    if ((t.isScout || t.cls === "uav") && Math.hypot(t.x, t.z) < CITY_RADIUS + 3) {
      const rr = t.isScout ? t.revealRadius : 1;
      for (const bd of def.buildings) if (!bd.revealed && dist(bd, t) <= rr) {
        bd.revealed = true;
        emit(bt, { t: "reveal", building: bd.uid });
      }
      for (const bb of def.batteries) if (!bb.revealed && dist(def.pads[bb.pad], t) <= rr) bb.revealed = true;
    }
    if (!t.isScout && t.cls === "uav" && t.leg === 1 && !t.returning && t.munitions > 0) {
      t.dropCooldown -= dt;
      if (t.dropCooldown <= 0 && t.traveled < 0.5) {
        t.dropCooldown = 2;
        t.munitions--;
        const w = attack(t.weapon);
        const up = att.offUp[t.weapon] ?? {};
        const tb = t.targetBuilding != null ? def.buildings.find((x) => x.uid === t.targetBuilding) : void 0;
        const pt = tb && rnd(m) > 0.1 ? { x: tb.x, z: tb.z } : randomCityPoint(m, true);
        impact(m, bt, def, pt, round(w.damage * (1 + 0.15 * (up.warhead ?? 0))), tb && pt.x === tb.x && pt.z === tb.z ? tb.uid : void 0);
        if (t.munitions === 0) {
          t.leg = 1;
          t.traveled = 0;
        }
      }
      if (t.munitions > 0) t.traveled = Math.min(t.traveled, 0.4);
    }
  }
  function arrive(m, bt, att, def, t) {
    const last = t.leg >= t.path.length - 1;
    if (t.cls === "uav" || t.isScout) {
      if (last) {
        t.alive = false;
        t.landed = true;
        if (t.isScout) att.scouts[t.weapon] = (att.scouts[t.weapon] ?? 0) + 1;
        else att.stock[t.weapon] = (att.stock[t.weapon] ?? 0) + 1;
        return;
      }
      const a2 = t.path[t.leg], b = t.path[t.leg + 1];
      t.total = dist(a2, b);
      return;
    }
    t.alive = false;
    t.landed = true;
    if (t.cls === "decoy" || t.weapon === "decoy") return;
    const pt = t.path[t.path.length - 1];
    if (!t.landsInCity) {
      emit(bt, { t: "impact", x: pt.x, z: pt.z, damage: 0 });
      return;
    }
    let bUid = t.targetBuilding;
    if (bUid == null) {
      const near = def.buildings.find((b) => dist(b, pt) <= RULES.buildingHitRadius);
      bUid = near?.uid;
    }
    impact(m, bt, def, pt, t.damage, bUid);
  }
  function impact(m, bt, def, pt, damage, buildingUid) {
    def.health = round(def.health - damage);
    def.scars.push({ x: pt.x, z: pt.z, d: damage });
    if (def.scars.length > 300) def.scars.shift();
    bt.stats.hits++;
    bt.stats.damage = round(bt.stats.damage + damage);
    emit(bt, { t: "impact", x: pt.x, z: pt.z, damage, building: buildingUid });
    if (buildingUid == null) return;
    const b = def.buildings.find((x) => x.uid === buildingUid);
    if (!b) return;
    if (!b.revealed) {
      b.revealed = true;
      emit(bt, { t: "reveal", building: b.uid });
    }
    b.battleDamage += damage;
    if (b.down === 0 && b.battleDamage >= RULES.knockoutDamage) {
      b.down = ECONOMY.repair.values[def.econ.repair];
      const name = BUILDINGS.find((x) => x.kind === b.kind).name;
      emit(bt, { t: "knockout", building: b.uid, kind: b.kind });
      emit(bt, { t: "msg", text: `${name} knocked out.`, tone: "bad" });
      if (b.kind === "depot") loseSurfaceStock(def);
    }
  }
  function loseSurfaceStock(p) {
    const safe = ECONOMY.storage.values[p.econ.storage];
    let extra = storedUnits(p) - safe;
    while (extra > 0) {
      let bestKey = "", bestN = 0, isInt = false;
      for (const k in p.interceptors) if (p.interceptors[k] > bestN) {
        bestKey = k;
        bestN = p.interceptors[k];
        isInt = true;
      }
      for (const k in p.stock) if (!attack(k).reusable && p.stock[k] > bestN) {
        bestKey = k;
        bestN = p.stock[k];
        isInt = false;
      }
      if (!bestKey) break;
      if (isInt) p.interceptors[bestKey]--;
      else p.stock[bestKey]--;
      extra--;
    }
  }
  function kill(bt, t, def, b) {
    t.alive = false;
    bt.stats.stopped++;
    if (b) b.kills++;
    emit(bt, { t: "kill", x: t.x, z: t.z, alt: t.alt, cls: t.cls });
  }
  function pickTarget(m, bt, def, b, pad) {
    const s = defence(b.sys);
    let best, bestScore = Infinity;
    for (const t of bt.threats) {
      if (!t.alive || t.delay > 0 || !t.detected || t.hold) continue;
      if (dist(pad, t) > s.range) continue;
      if (hitChance(m, def, b, t) <= 0) continue;
      if (!t.priority) {
        if (!def.autoFire) continue;
        if (t.decoyMarked) continue;
        if (s.skipsMisses && !t.landsInCity && MISSILE_CLASSES.includes(t.cls)) continue;
        if (s.shot >= EXPENSIVE_SHOT && CHEAP_THREATS.includes(t.looksLike) && t.identified) continue;
        if (s.kind === "sam" && t.engaged >= 1) continue;
      } else if (s.kind === "sam" && t.engaged >= 2) continue;
      const r = Math.hypot(t.x, t.z);
      const score = (t.priority ? -1e6 : 0) + r / Math.max(0.01, speedNow(t));
      if (score < bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }
  function fire(m, bt, def, b, pad, t, dt) {
    const s = defence(b.sys);
    b.revealed = true;
    if (s.kind === "laser") {
      if (b.dwellTarget !== t.uid) {
        b.dwellTarget = t.uid;
        b.dwell = 0;
      }
      b.dwell += dt;
      if (b.dwell >= (s.dwell ?? 1.5)) {
        const k = rnd(m) * 100 < hitChance(m, def, b, t);
        emit(bt, { t: "laser", sys: s.id, fx: pad.x, fz: pad.z, tx: t.x, tz: t.z, alt: t.alt, kill: k });
        if (k) kill(bt, t, def, b);
        b.dwell = 0;
        b.dwellTarget = void 0;
      }
      return;
    }
    if (s.kind === "gun") {
      if (def.budget < s.shot) {
        b.cooldown = 1;
        return;
      }
      def.budget = round(def.budget - s.shot);
      def.spent = round(def.spent + s.shot);
      bt.stats.defenceSpent = round(bt.stats.defenceSpent + s.shot);
      b.cooldown = s.fireEvery ?? 0.5;
      const k = rnd(m) * 100 < hitChance(m, def, b, t);
      emit(bt, { t: "gun", sys: s.id, fx: pad.x, fz: pad.z, tx: t.x, tz: t.z, alt: t.alt, kill: k });
      if (k) kill(bt, t, def, b);
      return;
    }
    b.ammo--;
    b.cooldown = s.fireEvery ?? 1.5;
    t.engaged++;
    bt.stats.interceptorsUsed++;
    bt.stats.defenceSpent = round(bt.stats.defenceSpent + s.shot);
    const it = { uid: uid(m), battery: b.uid, sys: s.id, target: t.uid, x: pad.x, z: pad.z, alt: 0.05, speed: s.interceptorSpeed ?? 1 };
    bt.interceptors.push(it);
    emit(bt, { t: "launch", uid: it.uid, sys: s.id, x: pad.x, z: pad.z });
  }
  function endBattle(m, bt) {
    bt.over = true;
    const def = m.players[bt.defender];
    m.lastReport = {
      attacker: bt.attacker,
      ...bt.stats,
      knockedOut: def.buildings.filter((b) => b.battleDamage >= RULES.knockoutDamage && b.down > 0).map((b) => BUILDINGS.find((x) => x.kind === b.kind).name),
      revealed: def.buildings.filter((b) => b.revealed).length
    };
    m.phase = "report";
    m.phaseEndsAt = m.time + REPORT_SECONDS;
    log(m, `Strike over: ${bt.stats.stopped} stopped, ${bt.stats.hits} hits, ${bt.stats.damage} damage.`);
  }
  function drainEvents(m) {
    if (!m.battle) return [];
    const e = m.battle.events;
    m.battle.events = [];
    return e;
  }

  // src/ai.ts
  var THINK_SECONDS = 3;
  var turnSeenAt = -1;
  var turnSeen = -1;
  function buy(m, pi, cmd) {
    return command(m, pi, cmd).ok;
  }
  function freePad(p, inner) {
    const pads = p.pads.filter((x) => (inner ? x.id < 6 : x.id >= 6) && !p.batteries.some((b) => b.pad === x.id));
    return pads[0]?.id ?? p.pads.find((x) => !p.batteries.some((b) => b.pad === x.id))?.id;
  }
  function setup(m, pi) {
    const p = m.players[pi];
    const r = nextRandom(m);
    const layers = r < 0.5 ? ["korkut", "pantsir", "irondome", "hisara"] : ["gepard", "sungur", "hisaro", "irondome"];
    for (const sys of layers) {
      const pad = freePad(p, defence(sys).range < 10);
      if (pad != null) buy(m, pi, { c: "buyBattery", sys, pad });
    }
    buy(m, pi, { c: "upgradeRadar", track: "range" });
    buy(m, pi, { c: "buyLauncher", weapon: "shahed" });
    buy(m, pi, { c: "buyUnits", weapon: "shahed", n: 10 });
    buy(m, pi, { c: "buyScout", scout: "tb2s" });
    buy(m, pi, { c: "buyLauncher", weapon: "som" });
    buy(m, pi, { c: "buyUnits", weapon: "som", n: 2 });
    buy(m, pi, { c: "endSetup" });
  }
  function shop(m, pi) {
    const p = m.players[pi];
    for (const b of p.batteries) {
      const s = defence(b.sys);
      if (s.load === 0) continue;
      const have = p.interceptors[s.id] ?? 0;
      if (have < s.load && p.budget > s.shot * s.load + 40) buy(m, pi, { c: "buyInterceptors", sys: s.id, n: s.load - have });
    }
    if (p.econ.income === 0 && p.budget > 260) buy(m, pi, { c: "upgradeEconomy", track: "income" });
    if (p.radar.decoy === 0 && p.budget > 200) buy(m, pi, { c: "upgradeRadar", track: "decoy" });
    if (p.budget > 450 && p.batteries.length < 8) {
      const choice = ["irist", "hisaro", "davidsling", "siper"][Math.floor(nextRandom(m) * 4)];
      const pad = freePad(p, false);
      if (pad != null) buy(m, pi, { c: "buyBattery", sys: choice, pad });
    }
    if (p.budget > 300 && !(p.launchers.tayfun > 0)) buy(m, pi, { c: "buyLauncher", weapon: "tayfun" });
    for (const w of ATTACKS) {
      if (w.reusable || !(p.launchers[w.id] > 0)) continue;
      const cap = launchCap(p, w.id), have = p.stock[w.id] ?? 0;
      if (have < cap && p.budget > w.unit * (cap - have) + 60) buy(m, pi, { c: "buyUnits", weapon: w.id, n: cap - have });
    }
  }
  function attackTurn(m, pi) {
    const p = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
    const revealed = foe.buildings.filter((b) => b.revealed && b.down === 0);
    const strikes = [];
    const scouts = [];
    if (revealed.length < 3 && (p.scouts.tb2s ?? 0) > 0) {
      const a2 = nextRandom(m) * Math.PI;
      scouts.push({ scout: "tb2s", path: [{ x: Math.cos(a2) * 4, z: Math.sin(a2) * 4 }, { x: -Math.cos(a2) * 4, z: -Math.sin(a2) * 4 }] });
    }
    const order = ["factory", "command", "power", "radar", "finance", "depot", "airbase"];
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
      if (command(m, pi, { c: "go", strikes, scouts }).ok) return;
    }
    command(m, pi, { c: "wait" });
  }
  function aiStep(m) {
    m.players.forEach((p, i) => {
      const pi = i;
      if (!p.isAI) return;
      if (m.phase === "setup" && !p.ready) setup(m, pi);
      if (m.phase === "battle" && m.battle?.defender === pi) p.autoFire = true;
      if (m.phase === "turn" && m.active === pi) {
        if (turnSeen !== m.turnNo) {
          turnSeen = m.turnNo;
          turnSeenAt = m.time;
        }
        if (m.time - turnSeenAt >= THINK_SECONDS) {
          shop(m, pi);
          attackTurn(m, pi);
        }
      }
    });
  }

  // src/view.ts
  function viewFor(m, pi) {
    const me = m.players[pi], foe = m.players[pi === 0 ? 1 : 0];
    const bt = m.battle;
    const iDefend = bt?.defender === pi;
    const caps = {};
    for (const id of Object.keys({ ...me.launchers, ...me.stock })) caps[id] = launchCap(me, id);
    return {
      phase: m.phase,
      time: m.time,
      secondsLeft: Math.max(0, Math.ceil(m.phaseEndsAt - m.time)),
      myTurn: m.phase === "turn" && m.active === pi,
      active: m.active,
      turnNo: m.turnNo,
      weatherBad: m.weatherBad,
      winner: m.winner,
      endReason: m.endReason,
      iWon: m.winner === pi,
      me: {
        name: me.name,
        budget: me.budget,
        health: me.health,
        income: incomeFor(me),
        ready: me.ready,
        pads: me.pads,
        scars: me.scars,
        batteries: me.batteries.map((b) => ({ ...b, load: batteryLoad(b), upgradeCost: upgradeBatteryCost(b), name: defence(b.sys).name })),
        buildings: me.buildings.map((b) => ({ uid: b.uid, kind: b.kind, x: b.x, z: b.z, down: b.down, revealed: b.revealed, name: BUILDINGS.find((x) => x.kind === b.kind).name })),
        interceptors: me.interceptors,
        launchers: me.launchers,
        stock: me.stock,
        scouts: me.scouts,
        launched: me.launched,
        caps,
        offUp: me.offUp,
        econ: me.econ,
        radar: me.radar,
        radarRange: radarRange(me),
        radarNames: RADAR_LEVELS.names,
        storage: { used: storedUnits(me), safe: ECONOMY.storage.values[me.econ.storage] },
        autoFire: me.autoFire,
        reloadsLeft: me.reloadsLeft
      },
      enemy: {
        name: foe.name,
        health: foe.health,
        scars: foe.scars,
        buildings: foe.buildings.filter((b) => b.revealed).map((b) => ({ uid: b.uid, kind: b.kind, x: b.x, z: b.z, down: b.down, name: BUILDINGS.find((x) => x.kind === b.kind).name })),
        batteries: foe.batteries.filter((b) => b.revealed).map((b) => ({ uid: b.uid, sys: b.sys, name: defence(b.sys).name, x: foe.pads[b.pad].x, z: foe.pads[b.pad].z }))
      },
      battle: bt && {
        attacker: bt.attacker,
        defender: bt.defender,
        iDefend,
        time: bt.time,
        threats: bt.threats.filter((t) => t.alive && t.delay <= 0 && (!iDefend || t.detected)).map((t) => {
          const isDecoy = t.cls === "decoy" || t.weapon === "decoy";
          const shownCls = !iDefend ? t.cls : !t.identified ? null : isDecoy && !t.decoyMarked ? t.looksLike : t.cls;
          return {
            uid: t.uid,
            x: t.x,
            z: t.z,
            alt: t.alt,
            cls: shownCls,
            looksLike: t.looksLike,
            name: !iDefend ? nameOf(t.weapon, t.isScout) : !t.identified ? "Unknown" : isDecoy && !t.decoyMarked ? threatName[t.looksLike] ?? "Unknown" : isDecoy ? "Decoy" : nameOf(t.weapon, t.isScout),
            decoy: iDefend ? t.decoyMarked : isDecoy,
            priority: t.priority,
            hold: t.hold,
            engaged: t.engaged,
            scout: t.isScout,
            eta: Math.round(Math.hypot(t.x, t.z) / Math.max(0.01, Math.hypot(t.x, t.z) > 20 ? t.speed : t.speedIn))
          };
        }),
        interceptors: bt.interceptors.map((i) => ({ uid: i.uid, sys: i.sys, x: i.x, z: i.z, alt: i.alt })),
        stats: bt.stats
      },
      report: m.phase === "report" ? m.lastReport : void 0,
      log: m.log.slice(-8)
    };
  }
  var threatName = { drone: "Drone", ballistic: "Ballistic", cruise: "Cruise", uav: "UAV", rocket: "Rocket", hypersonic: "Hypersonic" };
  function nameOf(id, isScout) {
    if (isScout) return "Surveillance UAV";
    if (id === "decoy") return "Decoy";
    try {
      return attack(id).name;
    } catch {
      return id;
    }
  }

  // src/bundle.ts
  var match;
  var HUMAN = 0;
  var api = {
    newSandbox(seed, name, demo) {
      match = createMatch(seed, [name || "You", "Training AI"], [!!demo, true]);
    },
    cmd(json) {
      if (!match) return JSON.stringify({ ok: false, error: "No match." });
      return JSON.stringify(command(match, HUMAN, JSON.parse(json)));
    },
    tick(dt) {
      if (!match) return;
      aiStep(match);
      tick(match, dt);
    },
    view() {
      return match ? JSON.stringify(viewFor(match, HUMAN)) : "null";
    },
    events() {
      return match ? JSON.stringify(drainEvents(match)) : "[]";
    },
    catalogue() {
      return JSON.stringify({
        defences: DEFENCES,
        attacks: ATTACKS,
        scouts: SCOUTS,
        rules: RULES,
        radar: { ...RADAR_LEVELS, identify: RADAR_LEVELS.identify.map((v) => v === Infinity ? 9999 : v), decoy: RADAR_LEVELS.decoy.map((v) => v === Infinity ? 9999 : v) },
        extraRadar: EXTRA_RADAR_PRICE,
        offUpgrades: OFF_UPGRADES,
        economy: ECONOMY,
        buildings: BUILDINGS,
        defUpgrade: DEF_UPGRADE,
        cityRadius: CITY_RADIUS
      });
    },
    // Direct (no JSON) access for the in-app web game, which runs in the same JS context.
    viewRaw() {
      return match ? viewFor(match, HUMAN) : null;
    },
    cmdRaw(cmd) {
      return match ? command(match, HUMAN, cmd) : { ok: false, error: "No match." };
    },
    eventsRaw() {
      return match ? drainEvents(match) : [];
    },
    catalogueRaw() {
      return {
        defences: DEFENCES,
        attacks: ATTACKS,
        scouts: SCOUTS,
        rules: RULES,
        radar: RADAR_LEVELS,
        extraRadar: EXTRA_RADAR_PRICE,
        offUpgrades: OFF_UPGRADES,
        economy: ECONOMY,
        buildings: BUILDINGS,
        defUpgrade: DEF_UPGRADE,
        cityRadius: CITY_RADIUS,
        longRange: LONG_RANGE_SAMS
      };
    },
    geo() {
      return { unitsPerKm: UNITS_PER_KM, river: RIVER, landmark: LANDMARK, slots: buildingSlots(), pads: padLayout() };
    },
    quit() {
      match = void 0;
    },
    save() {
      return match ? JSON.stringify(match) : "";
    },
    load(json) {
      try {
        match = JSON.parse(json);
        return true;
      } catch {
        return false;
      }
    }
  };
  globalThis.ADD = api;
})();
