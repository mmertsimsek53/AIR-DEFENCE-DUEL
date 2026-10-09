import { describe, expect, it } from 'vitest';
import { applyRaid, baseCommand, command, createRaid, generateBase, gridSize, newBase, raidMapFor, raidResult, tick, weaponCost } from '../src';

const T0 = 1_800_000_000_000;

describe('raids', () => {
  it('a generated rival base fits its grid without overlaps and has defences', () => {
    for (const hq of [1, 3, 6, 10]) {
      const b = generateBase(hq, hq * 7, 'Rival');
      const g = gridSize(hq), occ = new Set<string>();
      for (const x of b.buildings) {
        const s = { hq: 4, builder: 2 }[x.type as 'hq'] ?? 0; void s;
      }
      expect(b.buildings.find(x => x.type === 'hq')!.level).toBe(hq);
      expect(b.buildings.some(x => x.type.startsWith('def_'))).toBe(true);
      for (const x of b.buildings) { expect(x.x).toBeGreaterThanOrEqual(0); expect(x.y).toBeGreaterThanOrEqual(0); expect(x.x).toBeLessThan(g); occ.add(x.x + ',' + x.y); }
      expect(occ.size).toBe(b.buildings.length);
    }
  });

  it('weapons cost resources and need their production building', () => {
    const b = newBase('Me', T0); b.arsenal = {};
    expect(weaponCost('tayfun').uranium).toBeGreaterThan(0);
    expect(baseCommand(b, { c: 'produce', weapon: 'shahed', n: 1 }, T0).ok).toBe(false); // no Drone Workshop yet
    b.buildings.push({ id: 999, type: 'droneworkshop', level: 1, x: 0, y: 0 });
    expect(baseCommand(b, { c: 'produce', weapon: 'shahed', n: 5 }, T0).ok).toBe(true);
    expect(baseCommand(b, { c: 'produce', weapon: 'shahed', n: 6 }, T0).ok).toBe(false); // holds 10 at level 1
    expect(b.arsenal!.shahed).toBe(5);
  });

  it('a raid: scout, strike, stars and loot', () => {
    const me = newBase('Me', T0);
    me.arsenal = { tomahawk: 6, tb2s: 1 };
    const rival = generateBase(1, 5, 'Rival');
    const m = createRaid(me, rival, 123);
    const map0 = raidMapFor(m);
    expect(map0.structures.every(s => !s.revealed && !s.type)).toBe(true);
    command(m, 0, { c: 'fire', scout: 'tb2s', from: { x: 0, z: -20 }, to: { x: 0, z: 0 } });
    const hq = m.players[1].buildings.find(b => b.kind === 'command')!;
    for (let i = 0; i < 6; i++) command(m, 0, { c: 'fire', weapon: 'tomahawk', from: { x: 30, z: 0 }, to: { x: hq.x, z: hq.z } });
    command(m, 0, { c: 'endAttack' });
    for (let i = 0; i < 3000 && m.phase === 'battle'; i++) tick(m, 0.1);
    expect(m.phase).toBe('report');
    expect(raidMapFor(m).structures.some(s => s.revealed)).toBe(true);
    const r = raidResult(m, me, rival);
    expect(r.used.tomahawk).toBe(6);
    const goldBefore = me.res.gold;
    applyRaid(me, r);
    expect(me.arsenal!.tomahawk ?? 0).toBe(0);
    expect(me.res.gold).toBeGreaterThanOrEqual(goldBefore);
    command(m, 0, { c: 'continue' });
    expect(m.phase).toBe('over');
  });
});
