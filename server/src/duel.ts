// Missile duel rules the server decides on: where the targets are, how much damage an impact does,
// and whether an interceptor's blast caught the missile. Must match prototype/missile-duel-3d.html.

export const SIDES = [
  { name: 'Red', city: { x: 200, y: 280 } },
  { name: 'Blue', city: { x: 1400, y: 280 } },
] as const;
export const TARGETS = ['Command HQ', 'Radar station', 'Power plant', 'Fuel depot', 'Treasury', 'Oil field'] as const;
const T_RING = 60;           // targets sit 600 m from their city centre and 600 m from each other
export const BLAST = 28;     // interceptor blast reach, map units (1 unit = 10 m)

export type Pos = { x: number; y: number; alt: number };
export type Side = 0 | 1;

export function tPos(side: Side, k: number) {
  const c = SIDES[side].city, a = (k * 60 + 30) * Math.PI / 180, f = side ? -1 : 1;
  return { x: c.x + Math.cos(a) * T_RING * f, y: c.y + Math.sin(a) * T_RING };
}

// 100 within 50 m, falling to 0 at 400 m.
export const damageAt = (d: number) => d <= 5 ? 100 : Math.max(0, Math.round(100 * (1 - (d - 5) / 35)));

export const dist3 = (p: Pos, q: Pos) => Math.hypot(p.x - q.x, p.y - q.y, p.alt - q.alt);

// The attack missile came down at (x, y): damage every live target of the defending side, closest hits hardest.
export function applyImpact(hp: number[][], def: Side, x: number, y: number) {
  const hits: string[] = [];
  TARGETS.forEach((name, k) => {
    if (hp[def][k] <= 0) return;
    const p = tPos(def, k), dmg = Math.min(hp[def][k], damageAt(Math.hypot(x - p.x, y - p.y)));
    if (dmg > 0) { hp[def][k] -= dmg; hits.push(`${name} −${dmg}` + (hp[def][k] <= 0 ? ' (destroyed)' : ` (${hp[def][k]} left)`)); }
  });
  if (hits.length) return { hit: true, why: 'Hit: ' + hits.join(', ') + '.' };
  let best = Infinity, name = '';
  TARGETS.forEach((n, k) => { if (hp[def][k] <= 0) return; const p = tPos(def, k), d = Math.hypot(x - p.x, y - p.y); if (d < best) { best = d; name = n; } });
  return { hit: false, why: `Missed — it came down ${Math.round(best * 10)} m from the ${name}.` };
}

export const alive = (hp: number[][], side: Side) => hp[side].filter(h => h > 0).length;
