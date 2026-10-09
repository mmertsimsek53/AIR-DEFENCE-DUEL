// City layout shared by the rules and the 3D scene. The scene works in "units" (the prototype's scale:
// city radius 106 units = 6 km); the rules work in km.
import { CITY_RADIUS } from './data';
import type { Pad, Point } from './types';

export const UNITS_PER_KM = 106 / CITY_RADIUS;
const toKm = (u: number) => Math.round((u / UNITS_PER_KM) * 1000) / 1000;

// The river through the city (units). Nothing is built on it.
export const RIVER = { x: -16, z: 0, angle: 0.38 };
const RC = Math.cos(RIVER.angle), RS = Math.sin(RIVER.angle);
export const riverDist = (x: number, z: number) => Math.abs((x - RIVER.x) * RC - (z - RIVER.z) * RS);

// Decorative landmark (mosque) — never a target.
export const LANDMARK = { x: -44, z: -26 };

/** Defence pads: three rings, as in the prototype (units 22 / 50 / 84). */
export function padLayout(): Pad[] {
  const pads: Pad[] = [];
  for (const [r, n, off] of [[22, 6, 0.5], [50, 8, 0.2], [84, 10, 0.35]] as const) {
    for (let i = 0; i < n; i++) {
      const a = off + (i * Math.PI * 2) / n;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (riverDist(x, z) < 10) continue;
      pads.push({ id: pads.length, x: toKm(x), z: toKm(z) });
    }
  }
  return pads;
}

/** Plots where critical buildings can stand (km). Same for every city; unused plots are plazas. */
export function buildingSlots(): Point[] {
  const pads = padLayout().map(p => ({ x: p.x * UNITS_PER_KM, z: p.z * UNITS_PER_KM }));
  const cands: Point[] = [];
  for (let gx = -8; gx <= 8; gx++) for (let gz = -8; gz <= 8; gz++) {
    const x = gx * 11, z = gz * 11, r = Math.hypot(x, z);
    if (r < 18 || r > 90) continue;
    if (riverDist(x, z) < 15) continue;
    if (Math.hypot(x - LANDMARK.x, z - LANDMARK.z) < 18) continue;
    if (pads.some(p => Math.hypot(p.x - x, p.z - z) < 13)) continue;
    cands.push({ x, z });
  }
  // Spread 16 plots out: greedy farthest-point, starting from a fixed plot.
  const out: Point[] = [cands[0]];
  while (out.length < 16 && out.length < cands.length) {
    let best = cands[0], bestD = -1;
    for (const c of cands) {
      const d = Math.min(...out.map(o => Math.hypot(o.x - c.x, o.z - c.z)));
      if (d > bestD) { bestD = d; best = c; }
    }
    out.push(best);
  }
  return out.map(p => ({ x: toKm(p.x), z: toKm(p.z) }));
}
