import { describe, expect, it } from 'vitest';
import { RULES, aiStep, command, createMatch, tick, viewFor, incomeFor } from '../src';

const run = (m: ReturnType<typeof createMatch>, seconds: number) => { for (let i = 0; i < seconds * 10; i++) { aiStep(m); tick(m, 0.1); } };

describe('setup and turns', () => {
  it('starts in setup with the starting budget and seven hidden buildings', () => {
    const m = createMatch(1, ['A', 'B']);
    expect(m.phase).toBe('setup');
    expect(m.players[0].budget).toBe(RULES.startBudget);
    expect(m.players[0].buildings).toHaveLength(7);
    expect(viewFor(m, 1).enemy.buildings).toHaveLength(0);
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

  it('refuses to shop outside your turn and when broke', () => {
    const m = createMatch(4, ['A', 'B']);
    expect(command(m, 0, { c: 'buyBattery', sys: 'patriot', pad: 0 }).ok).toBe(true);
    expect(command(m, 0, { c: 'buyBattery', sys: 'zu23', pad: 1 }).ok).toBe(false); // $0 left
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    expect(command(m, 1, { c: 'buyBattery', sys: 'zu23', pad: 1 }).ok).toBe(false); // not B's turn
  });

  it('economy upgrade raises income', () => {
    const m = createMatch(5, ['A', 'B']);
    const p = m.players[0];
    expect(incomeFor(p)).toBe(120);
    command(m, 0, { c: 'upgradeEconomy', track: 'income' });
    expect(incomeFor(p)).toBe(140);
  });
});

describe('strikes', () => {
  it('an undefended city takes Shahed damage', () => {
    const m = createMatch(6, ['A', 'B']);
    command(m, 0, { c: 'buyLauncher', weapon: 'shahed' });
    command(m, 0, { c: 'buyUnits', weapon: 'shahed', n: 10 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'shahed', n: 10 }], scouts: [] }).ok).toBe(true);
    run(m, 120);
    expect(m.players[1].health).toBeLessThan(RULES.cityHealth);
    expect(m.players[1].health).toBeGreaterThan(RULES.cityHealth - 81);
  });

  it('guns shoot down drones and cost money per burst', () => {
    let stopped = 0;
    for (let seed = 10; seed < 15; seed++) {
      const m = createMatch(seed, ['A', 'B']);
      command(m, 0, { c: 'buyLauncher', weapon: 'shahed' });
      command(m, 0, { c: 'buyUnits', weapon: 'shahed', n: 10 });
      for (const pad of [0, 1, 2, 3, 4, 5]) command(m, 1, { c: 'buyBattery', sys: 'korkut', pad });
      command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
      command(m, 0, { c: 'go', strikes: [{ weapon: 'shahed', n: 10 }], scouts: [] });
      run(m, 120);
      stopped += m.lastReport!.stopped;
      expect(m.players[1].spent).toBeGreaterThan(240); // 6 × Korkut + bursts
    }
    expect(stopped).toBeGreaterThan(20); // most of 50 drones
  });

  it('cannot aim precise weapons at hidden buildings; a scout reveals them and they stay revealed', () => {
    const m = createMatch(7, ['A', 'B']);
    command(m, 0, { c: 'buyScout', scout: 'globalhawk' });
    command(m, 0, { c: 'buyLauncher', weapon: 'som' });
    command(m, 0, { c: 'buyUnits', weapon: 'som', n: 1 });
    command(m, 0, { c: 'endSetup' }); command(m, 1, { c: 'endSetup' });
    const hidden = m.players[1].buildings[0].uid;
    expect(command(m, 0, { c: 'go', strikes: [{ weapon: 'som', n: 1, target: hidden }], scouts: [] }).ok).toBe(false);
    command(m, 0, { c: 'go', strikes: [], scouts: [{ scout: 'globalhawk', path: [{ x: -4, z: 0 }, { x: 4, z: 0 }] }] });
    run(m, 200);
    const seen = viewFor(m, 0).enemy.buildings.length;
    expect(seen).toBeGreaterThan(3);
    expect(m.players[0].scouts.globalhawk).toBe(1); // came home
  });

  it('Patriot stops most ballistic missiles', () => {
    let stopped = 0, launched = 0;
    for (let seed = 20; seed < 30; seed++) {
      const m = createMatch(seed, ['A', 'B']);
      command(m, 0, { c: 'buyLauncher', weapon: 'iskander' });
      command(m, 0, { c: 'buyUnits', weapon: 'iskander', n: 2 });
      command(m, 1, { c: 'buyBattery', sys: 'patriot', pad: 0 });
      m.players[1].radar.range = 3; m.players[1].radar.decoy = 3;
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
    expect(m.turnNo).toBeGreaterThan(4);
    // Report how it went (helps tuning).
    (globalThis as unknown as { console: { log: (s: string) => void } }).console.log(`turns ${m.turnNo}, phase ${m.phase}, health ${m.players.map(p => p.health).join(' / ')}, budgets ${m.players.map(p => Math.round(p.budget)).join(' / ')}`);
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
    for (const t of m.battle!.threats) expect(t.path[0].x).toBeGreaterThan(200);
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
