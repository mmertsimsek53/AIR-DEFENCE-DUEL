import { describe, expect, it } from 'vitest';
import { baseCommand, baseTick, baseView, buildingType, canPlaceAt, newBase, storageCap, BUILDING_TYPES } from '../src';

const T0 = 1_800_000_000_000;

describe('military base', () => {
  it('starts with an HQ, a construction team and producers, all fitting the grid without overlaps', () => {
    const b = newBase('Mert', T0);
    const v = baseView(b, T0);
    expect(v.hq).toBe(1);
    expect(v.builders).toBe(1);
    for (const x of b.buildings) expect(canPlaceAt(b, x.type, x.x, x.y, x.id)).toBe(true);
  });

  it('produces resources over time up to the storage cap', () => {
    const b = newBase('Mert', T0);
    const g0 = b.res.gold;
    baseTick(b, T0 + 60_000); // 1 minute
    expect(b.res.gold).toBeGreaterThan(g0);
    baseTick(b, T0 + 100 * 3_600_000);
    expect(b.res.gold).toBe(storageCap(b).gold);
  });

  it('builds with a timer, one job per construction team, and speed-up finishes it', () => {
    const b = newBase('Mert', T0);
    expect(baseCommand(b, { c: 'place', type: 'fueldepot', x: 0, y: 0 }, T0).ok).toBe(true);
    expect(baseCommand(b, { c: 'place', type: 'explosives', x: 0, y: 4 }, T0).ok).toBe(false); // team busy
    const well = b.buildings.find(x => x.type === 'fueldepot')!;
    expect(well.build).toBeTruthy();
    baseTick(b, T0 + 14_000); expect(well.level).toBe(0);
    baseTick(b, T0 + 15_001); expect(well.level).toBe(1);
    expect(baseCommand(b, { c: 'upgrade', id: well.id }, T0 + 11_000).ok).toBe(true);
    expect(baseCommand(b, { c: 'speedUp', id: well.id }, T0 + 12_000).ok).toBe(true);
    expect(well.level).toBe(2);
  });

  it('respects HQ gates: locked buildings and level caps', () => {
    const b = newBase('Mert', T0);
    b.res.gold = 1e6; b.res.petrol = 1e6; b.res.explosives = 1e6;
    expect(baseCommand(b, { c: 'place', type: 'def_patriot', x: 0, y: 0 }, T0).ok).toBe(false);
    const zu = b.buildings.find(x => x.type === 'def_zu23')!;
    expect(baseCommand(b, { c: 'upgrade', id: zu.id }, T0).ok).toBe(true);  // L2 allowed at HQ1
    baseCommand(b, { c: 'speedUp', id: zu.id }, T0);
    expect(baseCommand(b, { c: 'upgrade', id: zu.id }, T0).ok).toBe(false); // L3 needs HQ2
  });

  it('every building type has sane numbers', () => {
    for (const t of BUILDING_TYPES) { expect(t.counts).toHaveLength(10); expect(t.size).toBeGreaterThan(1); expect(buildingType(t.id)).toBe(t); }
  });
});
