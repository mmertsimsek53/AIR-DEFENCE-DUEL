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

/** 20 fixed city layouts (km): each is 15 spread-out spots, the first 7 for the critical buildings and the
 *  last 8 for the hideouts. Every match picks one layout per player at random. */
export const LAYOUT_COUNT = 20;
let layoutCache: Point[][] | undefined;
export function cityLayouts(): Point[][] {
  if (layoutCache) return layoutCache;
  const pads = padLayout().map(p => ({ x: p.x * UNITS_PER_KM, z: p.z * UNITS_PER_KM }));
  const cands: Point[] = [];
  for (let gx = -16; gx <= 16; gx++) for (let gz = -16; gz <= 16; gz++) {
    const x = gx * 5.5, z = gz * 5.5, r = Math.hypot(x, z);
    if (r < 16 || r > 92) continue;
    if (riverDist(x, z) < 14) continue;
    if (Math.hypot(x - LANDMARK.x, z - LANDMARK.z) < 16) continue;
    if (pads.some(p => Math.hypot(p.x - x, p.z - z) < 12)) continue;
    cands.push({ x, z });
  }
  const out: Point[][] = [];
  for (let k = 0; k < LAYOUT_COUNT; k++) {
    let a = 9301 + k * 49297; // small deterministic generator per layout
    const rand = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    const pick: Point[] = [];
    let guard = 0;
    while (pick.length < 15 && guard++ < 5000) {
      const c = cands[Math.floor(rand() * cands.length)];
      if (pick.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 20)) continue; // keep spots apart
      pick.push(c);
    }
    out.push(pick.map(p => ({ x: toKm(p.x), z: toKm(p.z) })));
  }
  return (layoutCache = out);
}

/** The city split into 12 survey sectors: 4 inner (within 3 km) and 8 outer. */
export const SURVEY_SECTORS = 12;
export const SECTOR_INNER_KM = 3;
export function sectorOf(x: number, z: number): number {
  const a = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
  return Math.hypot(x, z) < SECTOR_INNER_KM ? Math.floor(a / (Math.PI / 2)) % 4 : 4 + (Math.floor(a / (Math.PI / 4)) % 8);
}
