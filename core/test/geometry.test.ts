import { describe, expect, it } from 'vitest';
import { buildingSlots, cityLayouts, LAYOUT_COUNT, padLayout, sectorOf, UNITS_PER_KM, riverDist, LANDMARK } from '../src';

it('pads and building plots fit the city and keep clear of each other, the river and the landmark', () => {
  const pads = padLayout(), slots = buildingSlots();
  expect(pads.length).toBeGreaterThanOrEqual(18); // 24 minus the ones on the river
  expect(slots).toHaveLength(16);
  for (const s of slots) {
    const x = s.x * UNITS_PER_KM, z = s.z * UNITS_PER_KM;
    expect(Math.hypot(x, z)).toBeLessThanOrEqual(91);
    expect(riverDist(x, z)).toBeGreaterThanOrEqual(15);
    expect(Math.hypot(x - LANDMARK.x, z - LANDMARK.z)).toBeGreaterThanOrEqual(18);
    for (const p of pads) expect(Math.hypot(p.x - s.x, p.z - s.z) * UNITS_PER_KM).toBeGreaterThanOrEqual(12.9);
  }
});

describe('city layouts and survey sectors', () => {
  it('has 20 layouts of 15 spread-out spots inside the city, clear of pads and the river', () => {
    const L = cityLayouts();
    expect(L).toHaveLength(LAYOUT_COUNT);
    for (const lay of L) {
      expect(lay).toHaveLength(15);
      for (const p of lay) { expect(Math.hypot(p.x, p.z)).toBeLessThan(5.3); expect(riverDist(p.x * UNITS_PER_KM, p.z * UNITS_PER_KM)).toBeGreaterThan(13); }
    }
    expect(new Set(L.map(l => JSON.stringify(l))).size).toBe(LAYOUT_COUNT);
  });
  it('maps points to 12 sectors', () => {
    expect(sectorOf(1, 0.1)).toBe(0);
    expect(sectorOf(-1, -0.1)).toBe(2);
    expect(sectorOf(5, 0.1)).toBe(4);
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7].map(i => sectorOf(Math.cos(i * Math.PI / 4 + 0.2) * 5, Math.sin(i * Math.PI / 4 + 0.2) * 5))).size).toBe(8);
  });
});
