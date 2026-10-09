import { expect, it } from 'vitest';
import { buildingSlots, padLayout, UNITS_PER_KM, riverDist, LANDMARK } from '../src';

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
