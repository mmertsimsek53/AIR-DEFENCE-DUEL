import { describe, expect, it } from 'vitest';
import { RULES, aiStep, command, createMatch, tick, viewFor, incomeFor, sectorOf } from '../src';
import type { Match, PlayerIndex } from '../src';

const run = (m: ReturnType<typeof createMatch>, seconds: number) => { for (let i = 0; i < seconds * 10; i++) { aiStep(m); tick(m, 0.1); } };
const hideoutsOf = (m: Match, pi: PlayerIndex) => m.players[pi].buildings.filter(b => b.kind === 'hideout');
/** Put a player's chief in the hideout farthest from a point (keeps random hits from ending a test early). */
const hideChiefFrom = (m: Match, pi: PlayerIndex, x: number, z: number) => {
  m.players[pi].chief = hideoutsOf(m, pi).sort((a, b) => Math.hypot(b.x - x, b.z - z) - Math.hypot(a.x - x, a.z - z))[0].uid;
};

describe('setup and turns', () => {
  it('starts in setup with seven buildings and eight hideouts, all hidden; the chief is secret', () => {
    const m = createMatch(1, ['A', 'B']);
    expect(m.phase).toBe('setup');
    expect(m.players[0].budget).toBe(RULES.startBudget);
    expect(m.players[0].buildings).toHaveLength(7 + RULES.hideouts);
    const seen = viewFor(m, 1).enemy;
    expect(seen.buildings).toHaveLength(0); // everything is hidden until surveyed
    expect(JSON.stringify(seen)).not.toContain('chief');
    expect(hideoutsOf(m, 0).some(h => h.uid === m.players[0].chief)).toBe(true);
  });

  it('moves to turn 1 after 120 s and pays income at the start of a turn', () => {
    const m = createMatch(2, ['A', 'B']);
    tick(m, RULES.setupSeconds + 0.1);
    expect(m.phase).toBe('turn');
    expect(m.active).toBe(0);
    expect(m.players[0].budget).toBe(RULES.startBudget + RULES.income);
  });

  it('skips the turn when the 60 s run out', () => {
    const m = createMatch(3, ['A', 'B']);
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    expect(m.phase).toBe('turn');
    tick(m, RULES.turnSeconds + 0.2);
    expect(m.active).toBe(1);
  });

  it('defence draft: 2 short, 2 medium, 2 long, 1 top, free, setup only; money only for weapons and ammo', () => {
    const m = createMatch(4, ['A', 'B']);
    const ok = (sys: string, pad: number) => command(m, 0, { c: 'buyBattery', sys, pad }).ok;
    expect(ok('patriot', 0)).toBe(true);
    expect(ok('s400', 1)).toBe(false);               // one top-level system
    expect(ok('korkut', 2) && ok('stinger', 3)).toBe(true);
    expect(ok('zu23', 4)).toBe(false);               // two short-range
    expect(ok('pantsir', 5) && ok('hisara', 6) && ok('siper', 7) && ok('s300', 8)).toBe(true);
    expect(m.players[0].budget).toBe(RULES.startBudget); // picks are free
    command(m, 0, { c: 'sellBattery', uid: m.players[0].batteries[1].uid }); // swap during setup
    expect(ok('zu23', 4)).toBe(true);
    expect(command(m, 0, { c: 'buyUnits', weapon: 'tayfun', n: 999 }).ok).toBe(false); // broke
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    expect(ok('igla', 9)).toBe(false);               // no defences after setup
    expect(command(m, 0, { c: 'sellBattery', uid: m.players[0].batteries[0].uid }).ok).toBe(false);
    expect(command(m, 0, { c: 'buyInterceptors', sys: 'patriot', n: 2 }).ok).toBe(true); // ammunition is still bought
  });

  it('income is fixed; there are no upgrades', () => {
    const m = createMatch(5, ['A', 'B']);
    expect(incomeFor(m.players[0])).toBe(RULES.income);
    expect(command(m, 0, { c: 'upgradeEconomy', track: 'income' } as never).ok).toBe(false);
  });

  it('the chief is placed free in setup and moved for money on your own turn', () => {
    const m = createMatch(8, ['A', 'B']);
    const [h1, h2, h3] = hideoutsOf(m, 0).filter(h => h.uid !== m.players[0].chief);
    expect(command(m, 0, { c: 'placeChief', uid: h1.uid }).ok).toBe(true);
    expect(m.players[0].chief).toBe(h1.uid);
    expect(m.players[0].budget).toBe(RULES.startBudget);
    expect(command(m, 0, { c: 'moveChief', uid: h2.uid }).ok).toBe(false); // not during setup
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    const before = m.players[0].budget;
    expect(command(m, 0, { c: 'moveChief', uid: h2.uid }).ok).toBe(true);
    expect(m.players[0].budget).toBe(before - RULES.chiefMove);
    expect(command(m, 1, { c: 'moveChief', uid: hideoutsOf(m, 1).find(h => h.uid !== m.players[1].chief)!.uid }).ok).toBe(false); // not B's turn
    expect(command(m, 0, { c: 'placeChief', uid: h3.uid }).ok).toBe(false); // placing free is setup only
  });
});

describe('strikes', () => {
  it('an undefended city takes Shahed damage', () => {
    const m = createMatch(6, ['A', 'B']);
    command(m, 0, { c: 'buyLauncher', weapon: 'shahed' });
    command(m, 0, { c: 'buyUnits', weapon: 'shahed', n: 10 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    hideChiefFrom(m, 1, 0, 0);
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'shahed', n: 10 }], scouts: [] }).ok).toBe(true);
    run(m, 120);
    expect(m.lastReport!.hits).toBeGreaterThan(0);
    expect(m.players[1].scars.length).toBeGreaterThan(0);
  });

  it('guns shoot down drones and cost money per burst', () => {
    let stopped = 0;
    for (let seed = 10; seed < 15; seed++) {
      const m = createMatch(seed, ['A', 'B']);
      command(m, 0, { c: 'buyLauncher', weapon: 'shahed' });
      command(m, 0, { c: 'buyUnits', weapon: 'shahed', n: 10 });
      for (const [sys, pad] of [['korkut', 0], ['phalanx', 1], ['gurz', 2], ['tunguska', 3]] as const) command(m, 1, { c: 'buyBattery', sys, pad });
      command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
      command(m, 0, { c: 'go', strikes: [{ weapon: 'shahed', n: 10 }], scouts: [] });
      run(m, 120);
      stopped += m.lastReport!.stopped;
      expect(m.players[1].spent).toBeGreaterThan(0); // gun bursts cost money
    }
    expect(stopped).toBeGreaterThan(20); // most of 50 drones
  });

  it('cannot aim precise weapons at hidden buildings; an Aksungur survey lap photographs half the city', () => {
    const m = createMatch(7, ['A', 'B']);
    command(m, 0, { c: 'buyScout', scout: 'aksungur' });
    command(m, 0, { c: 'buyLauncher', weapon: 'som' });
    command(m, 0, { c: 'buyUnits', weapon: 'som', n: 1 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    const hidden = m.players[1].buildings[0].uid;
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'som', n: 1, target: hidden }], scouts: [] }).ok).toBe(false);
    command(m, 0, { c: 'go', strikes: [], scouts: [{ scout: 'aksungur', path: [{ x: -4, z: 0 }, { x: 4, z: 0 }] }] });
    run(m, 200);
    expect(m.players[0].surveyed).toHaveLength(RULES.surveyPerPass);
    const sectors = new Set(m.players[0].surveyed);
    const known = viewFor(m, 0).enemy.buildings;
    expect(known.every(b => sectors.has(sectorOf(b.x, b.z)))).toBe(true);
    expect(m.players[0].scouts.aksungur).toBe(1); // came home
  });

  it('ground defences cannot reach the Aksungur; an Akıncı air patrol sometimes shoots it down', () => {
    const fly = (seed: number, patrols: number) => {
      const m = createMatch(seed, ['A', 'B']);
      command(m, 0, { c: 'buyScout', scout: 'aksungur' });
      for (const [sys, pad] of [['siper', 0], ['korkut', 2]] as const) command(m, 1, { c: 'buyBattery', sys, pad });
      for (let i = 0; i < patrols; i++) command(m, 1, { c: 'buyPatrol' });
      command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
      command(m, 0, { c: 'go', strikes: [], scouts: [{ scout: 'aksungur', path: [{ x: -4, z: 0 }, { x: 4, z: 0 }] }] });
      run(m, 200);
      return m.players[0].scouts.aksungur > 0;
    };
    let lost0 = 0, lost2 = 0;
    for (let seed = 300; seed < 330; seed++) { if (!fly(seed, 0)) lost0++; if (!fly(seed, 2)) lost2++; }
    expect(lost0).toBe(0);
    expect(lost2).toBeGreaterThan(3);
    expect(lost2).toBeLessThan(27);
    const m = createMatch(1, ['A', 'B']);
    expect(command(m, 0, { c: 'buyPatrol' }).ok).toBe(true);
    expect(command(m, 0, { c: 'buyPatrol' }).ok).toBe(true);
    expect(command(m, 0, { c: 'buyPatrol' }).ok).toBe(false); // at most 2
    expect(m.players[0].budget).toBe(RULES.startBudget - 2 * RULES.patrolPrice);
  });

  it('big systems can be set to manual fire and then only fire at tapped contacts', () => {
    const m = createMatch(12, ['A', 'B']);
    command(m, 1, { c: 'buyBattery', sys: 'korkut', pad: 0 });
    command(m, 1, { c: 'buyBattery', sys: 'hisaro', pad: 1 });
    const [gun, sam] = m.players[1].batteries;
    expect(command(m, 1, { c: 'setManual', uid: gun.uid, on: true }).ok).toBe(false); // small: always automatic
    expect(command(m, 1, { c: 'setManual', uid: sam.uid, on: true }).ok).toBe(true);
    command(m, 0, { c: 'buyLauncher', weapon: 'som' }); command(m, 0, { c: 'buyUnits', weapon: 'som', n: 2 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    command(m, 0, { c: 'go', strikes: [{ weapon: 'som', n: 2 }], scouts: [] });
    run(m, 25);
    expect(sam.ammo).toBe(6); // manual and nothing tapped: it held fire
  });

  it('Patriot stops most ballistic missiles', () => {
    let stopped = 0, launched = 0;
    for (let seed = 20; seed < 30; seed++) {
      const m = createMatch(seed, ['A', 'B']);
      command(m, 0, { c: 'buyLauncher', weapon: 'iskander' });
      command(m, 0, { c: 'buyUnits', weapon: 'iskander', n: 2 });
      command(m, 1, { c: 'buyBattery', sys: 'patriot', pad: 0 });
      command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
      command(m, 0, { c: 'go', strikes: [{ weapon: 'iskander', n: 2 }], scouts: [] });
      run(m, 60);
      stopped += m.lastReport!.stopped; launched += 2;
    }
    expect(stopped / launched).toBeGreaterThan(0.6);
  });
});

describe('full sandbox match', () => {
  it('two AIs finish a match, everything stays finite', () => {
    const m = createMatch(42, ['AI 1', 'AI 2'], [true, true]);
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 60 * 60 * 10) { aiStep(m); tick(m, 0.1); }
    for (const p of m.players) { expect(Number.isFinite(p.budget)).toBe(true); expect(p.budget).toBeGreaterThanOrEqual(0); }
    expect(m.turnNo).toBeGreaterThan(2);
    // Report how it went (helps tuning).
    (globalThis as unknown as { console: { log: (s: string) => void } }).console.log(`turns ${m.turnNo}, phase ${m.phase}, winner ${m.winner} (${m.endReason}), hideouts left ${m.players.map(p => p.buildings.filter(b => b.kind === 'hideout' && b.down < 99).length).join(' / ')}, budgets ${m.players.map(p => Math.round(p.budget)).join(' / ')}`);
  });
});

describe('standing restock order', () => {
  it('tops up spare interceptors at the start of your turn and can be changed', () => {
    const m = createMatch(9, ['A', 'B']);
    command(m, 0, { c: 'buyBattery', sys: 'hisara', pad: 0 });
    expect(m.players[0].restock.hisara).toBe(4);
    command(m, 0, { c: 'setRestock', sys: 'hisara', n: 8 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    expect(m.players[0].interceptors.hisara).toBe(8);
    expect(m.players[0].lastRestock).toEqual({ n: 8, cost: 4, short: false });
  });
});

describe('strike direction', () => {
  it('threats come from the chosen side', () => {
    const m = createMatch(31, ['A', 'B']);
    command(m, 0, { c: 'buyLauncher', weapon: 'shahed' });
    command(m, 0, { c: 'buyUnits', weapon: 'shahed', n: 10 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    command(m, 0, { c: 'go', strikes: [{ weapon: 'shahed', n: 10 }], scouts: [], bearing: 0 }); // from the east (+x)
    for (const t of m.battle!.threats) expect(t.path[0].x).toBeGreaterThan(18);
  });
});

describe('drawn routes and top-up', () => {
  it('drones follow the drawn route; ballistic missiles ignore it', () => {
    const m = createMatch(41, ['A', 'B']);
    command(m, 0, { c: 'buyLauncher', weapon: 'shahed' }); command(m, 0, { c: 'buyUnits', weapon: 'shahed', n: 2 });
    command(m, 0, { c: 'buyLauncher', weapon: 'iskander' }); command(m, 0, { c: 'buyUnits', weapon: 'iskander', n: 1 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    const route = [{ x: 30, z: 0 }, { x: 20, z: 10 }, { x: 10, z: -10 }, { x: 3, z: 0 }];
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'shahed', n: 2 }, { weapon: 'iskander', n: 1 }], scouts: [], route }).ok).toBe(true);
    const drone = m.battle!.threats.find(t => t.weapon === 'shahed')!;
    const isk = m.battle!.threats.find(t => t.weapon === 'iskander')!;
    expect(drone.path.length).toBeGreaterThan(20);
    expect(drone.path.some(p => Math.abs(p.x - 20) < 0.5 && Math.abs(p.z - 10) < 0.5)).toBe(true);
    expect(isk.path).toHaveLength(2);
    expect(m.battle!.bearing).toBeCloseTo(0, 5); // from the east
  });

  it('Top up fills magazines and spares in one go', () => {
    const m = createMatch(42, ['A', 'B']);
    command(m, 0, { c: 'buyBattery', sys: 'hisara', pad: 0 });
    m.players[0].batteries[0].ammo = 1;
    expect(command(m, 0, { c: 'topUp' }).ok).toBe(true);
    expect(m.players[0].batteries[0].ammo).toBe(4);
    expect(m.players[0].interceptors.hisara).toBe(4);
    expect(command(m, 0, { c: 'topUp' }).ok).toBe(false); // already full
  });
});

describe('untimed sandbox', () => {
  it('setup and turns wait for the player when the clock is off', () => {
    const m = createMatch(51, ['A', 'B'], [false, false], { timed: false });
    tick(m, 500);
    expect(m.phase).toBe('setup');
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    tick(m, 500);
    expect(m.phase).toBe('turn');
    expect(m.active).toBe(0);
  });
});

describe('live attack', () => {
  it('launches one by one from a chosen start to a chosen aim point, then ends', () => {
    const m = createMatch(61, ['A', 'B'], [false, false], { timed: false });
    command(m, 0, { c: 'buyLauncher', weapon: 'tomahawk' }); command(m, 0, { c: 'buyUnits', weapon: 'tomahawk', n: 3 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    hideChiefFrom(m, 1, 0, 1);
    expect(command(m, 0, { c: 'go', strikes: [], scouts: [], live: true }).ok).toBe(true);
    expect(command(m, 0, { c: 'fire', weapon: 'tomahawk', from: { x: 1, z: 1 }, to: { x: 0, z: 0 } }).ok).toBe(false); // start inside the city
    expect(command(m, 0, { c: 'fire', weapon: 'tomahawk', from: { x: 30, z: 0 }, to: { x: 2, z: 1 } }).ok).toBe(true);
    expect(command(m, 0, { c: 'fire', weapon: 'tomahawk', from: { x: 0, z: 30 }, to: { x: -2, z: 1 } }).ok).toBe(true);
    expect(command(m, 0, { c: 'fire', weapon: 'tomahawk', from: { x: 0, z: 30 }, to: { x: -2, z: 1 } }).ok).toBe(false); // 2 per turn
    const ts = m.battle!.threats;
    expect(ts).toHaveLength(2);
    expect(ts[0].path[0].x).toBeGreaterThan(20);           // started on the east side
    expect(ts[1].path[0].z).toBeGreaterThan(20);           // started on the south side
    tick(m, 120);
    expect(m.phase).toBe('battle');                        // still open until the attacker ends it
    command(m, 0, { c: 'endAttack' });
    tick(m, 1);
    expect(m.phase).toBe('report');
  });
});

describe('defence limit', () => {
  it('a chosen limit caps batteries for both players; selling frees a slot', () => {
    const m = createMatch(13, ['A', 'B'], [false, false], { maxBatteries: 2 });
    expect(command(m, 0, { c: 'buyBattery', sys: 'zu23', pad: 0 }).ok).toBe(true);
    expect(command(m, 0, { c: 'buyBattery', sys: 'zu23', pad: 1 }).ok).toBe(true);
    expect(command(m, 0, { c: 'buyBattery', sys: 'zu23', pad: 2 }).ok).toBe(false);
    expect(command(m, 1, { c: 'buyBattery', sys: 'zu23', pad: 0 }).ok).toBe(true);
    command(m, 0, { c: 'sellBattery', uid: m.players[0].batteries[0].uid });
    expect(command(m, 0, { c: 'buyBattery', sys: 'zu23', pad: 2 }).ok).toBe(true);
    expect(createMatch(14, ['A', 'B']).maxBatteries).toBeUndefined();
  });
});

describe('chief, hideouts, recon drones and decoys', () => {
  const ready = (seed: number) => {
    const m = createMatch(seed, ['A', 'B'], [false, false], { timed: false });
    command(m, 0, { c: 'buyUnits', weapon: 'recon', n: 4 });
    for (const b of m.players[1].buildings) if (b.kind === 'hideout') b.revealed = true; // as if surveyed
    return m;
  };
  const start = (m: Match) => { command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' }); };

  it('a recon drone hovers over a hideout and reports whether the chief is inside', () => {
    const m = ready(71); start(m);
    const hs = hideoutsOf(m, 1), chief = m.players[1].chief, empty = hs.find(h => h.uid !== chief)!;
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'recon', n: 1, target: chief }, { weapon: 'recon', n: 1, target: empty.uid }], scouts: [] }).ok).toBe(true);
    run(m, 120);
    const intel = m.players[0].intel;
    expect(intel.find(x => x.uid === chief)?.found).toBe(true);
    expect(intel.find(x => x.uid === empty.uid)?.found).toBe(false);
    expect(m.players[1].inspected).toContain(chief);       // the defender saw it hover there
    expect(m.phase).not.toBe('over');                       // recon drones do no damage
  });

  it('recon drones must be sent to a standing hideout', () => {
    const m = ready(72); start(m);
    const crit = m.players[1].buildings.find(b => b.kind !== 'hideout')!;
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'recon', n: 1 }], scouts: [] }).ok).toBe(false);
    crit.revealed = true;
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'recon', n: 1, target: crit.uid }], scouts: [] }).ok).toBe(false);
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'recon', n: 5, target: hideoutsOf(m, 1)[0].uid }], scouts: [] }).ok).toBe(false); // 4 per turn
  });

  it('guns shoot recon drones down', () => {
    let lost = 0;
    for (let seed = 80; seed < 85; seed++) {
      const m = ready(seed);
      for (const pad of [0, 1, 2, 3, 4, 5]) command(m, 1, { c: 'buyBattery', sys: 'korkut', pad });
      start(m);
      const targets = hideoutsOf(m, 1).slice(0, 4);
      command(m, 0, { c: 'go', strikes: targets.map(h => ({ weapon: 'recon', n: 1, target: h.uid })), scouts: [] });
      run(m, 120);
      lost += 4 - m.players[0].intel.length;
    }
    expect(lost).toBeGreaterThan(5);
  });

  it('hitting the chief\'s hideout wins; hitting an empty one destroys it and tells the attacker', () => {
    const m = ready(91);
    command(m, 0, { c: 'buyLauncher', weapon: 'tomahawk' }); command(m, 0, { c: 'buyUnits', weapon: 'tomahawk', n: 2 });
    start(m);
    const chief = m.players[1].chief, empty = hideoutsOf(m, 1).find(h => h.uid !== chief)!;
    m.rng = 5; // a seed where the empty-hideout strike does not miss
    command(m, 0, { c: 'go', strikes: [{ weapon: 'tomahawk', n: 1, target: empty.uid }], scouts: [] });
    run(m, 90);
    if (empty.down >= 99) {
      expect(m.players[0].intel.find(x => x.uid === empty.uid)?.found).toBe(false);
      expect(viewFor(m, 0).enemy.hideoutsLeft).toBe(RULES.hideouts - 1);
    }
    expect(m.phase).not.toBe('over');
    // Straight onto the chief.
    m.players[1].buildings.filter(b => b.kind === 'hideout').forEach(h => { if (h.uid !== chief) h.down = 99; });
    const t = { weapon: 'tomahawk', n: 1, target: chief };
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 12) {
      if (m.phase === 'report') command(m, 0, { c: 'continue' });
      if (m.phase === 'turn' && m.active === 1) command(m, 1, { c: 'wait' });
      if (m.phase === 'turn' && m.active === 0) { m.players[0].stock.tomahawk = 1; command(m, 0, { c: 'go', strikes: [t], scouts: [] }); }
      run(m, 60);
    }
    expect(m.phase).toBe('over');
    expect(m.winner).toBe(0);
    expect(m.endReason).toBe('chief');
  });

  it('the defender never sees which contacts are decoys', () => {
    const m = ready(95);
    command(m, 0, { c: 'buyLauncher', weapon: 'mald' }); command(m, 0, { c: 'buyUnits', weapon: 'mald', n: 4 });
    command(m, 0, { c: 'buyLauncher', weapon: 'tomahawk' }); command(m, 0, { c: 'buyUnits', weapon: 'tomahawk', n: 2 });
    start(m);
    command(m, 0, { c: 'go', strikes: [{ weapon: 'mald', n: 4 }, { weapon: 'tomahawk', n: 2 }], scouts: [] });
    let sawClose = false;
    for (let i = 0; i < 400 && m.phase === 'battle'; i++) {
      tick(m, 0.1);
      const v = viewFor(m, 1).battle;
      for (const t of v?.threats ?? []) {
        expect(t.decoy).toBe(false);
        if (t.cls) { expect(t.cls).toBe('cruise'); sawClose = true; }
      }
      const a = viewFor(m, 0).battle;
      if (a) expect(a.threats.filter(t => t.decoy).length).toBe(a.threats.filter(t => t.name.includes('MALD')).length);
    }
    expect(sawClose).toBe(true);
  });

  it('a precise hit on a revealed battery destroys it', () => {
    const m = ready(97);
    command(m, 0, { c: 'buyLauncher', weapon: 'tayfun' }); command(m, 0, { c: 'buyUnits', weapon: 'tayfun', n: 2 });
    command(m, 1, { c: 'buyBattery', sys: 'zu23', pad: 3 });
    start(m);
    hideChiefFrom(m, 1, m.players[1].pads[3].x, m.players[1].pads[3].z);
    m.players[1].batteries[0].revealed = true;
    m.players[1].batteries[0].holdFire = true;
    const pad = m.players[1].pads[3];
    command(m, 0, { c: 'go', strikes: [], scouts: [], live: true });
    command(m, 0, { c: 'fire', weapon: 'tayfun', from: { x: 30, z: 0 }, to: { x: pad.x + 0.3, z: pad.z } });
    command(m, 0, { c: 'fire', weapon: 'tayfun', from: { x: 30, z: 0 }, to: { x: pad.x + 0.3, z: pad.z } });
    command(m, 0, { c: 'endAttack' });
    run(m, 60);
    expect(m.players[1].batteries).toHaveLength(0);
  });

  it('hideouts have 40 lives: drones chip away, a cruise missile destroys one', () => {
    const m = ready(98);
    command(m, 0, { c: 'buyLauncher', weapon: 'kargu' }); command(m, 0, { c: 'buyUnits', weapon: 'kargu', n: 8 });
    start(m);
    const chief = m.players[1].chief, h = hideoutsOf(m, 1).find(x => x.uid !== chief)!;
    command(m, 0, { c: 'go', strikes: [], scouts: [], live: true });
    for (let i = 0; i < 3; i++) command(m, 0, { c: 'fire', weapon: 'kargu', from: { x: 20, z: 0 }, to: { x: h.x, z: h.z } });
    command(m, 0, { c: 'endAttack' });
    run(m, 60);
    expect(h.down).toBe(0);               // three Kargus (4 each) are not enough
    expect(h.hp).toBeLessThan(40);
    expect(viewFor(m, 0).enemy.buildings.find(b => b.uid === h.uid)?.hp).toBe(h.hp);
  });
});
