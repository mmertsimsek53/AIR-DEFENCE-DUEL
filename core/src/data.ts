// Catalogue and tuning numbers. Source of truth: docs/NUMBERS.md (draft v1).
// Money is in $M. Distances in km. Times in seconds.

export type ThreatClass = 'drone' | 'decoy' | 'uav' | 'rocket' | 'cruise' | 'ballistic' | 'hypersonic';
export const THREAT_CLASSES: ThreatClass[] = ['drone', 'decoy', 'uav', 'rocket', 'cruise', 'ballistic', 'hypersonic'];

export type DefenceKind = 'gun' | 'sam' | 'laser' | 'ew';

export interface DefenceSpec {
  id: string;
  name: string;
  kind: DefenceKind;
  price: number;          // battery, includes first full load
  shot: number;           // $M per interceptor / gun burst (lasers 0)
  load: number;           // magazine (0 = unlimited: guns, lasers, EW)
  range: number;          // km
  hit: Partial<Record<ThreatClass, number>>; // % per shot
  needsPower?: boolean;
  dwell?: number;         // lasers: seconds on target per kill attempt
  fireEvery?: number;     // seconds between shots/bursts
  interceptorSpeed?: number; // km/s
  skipsMisses?: boolean;  // Iron Dome: ignores threats that will land outside the city
  lowCruisePenalty?: number; // S-400: hit % minus this vs low cruise
  weatherHit?: boolean;   // Iron Beam: bad weather halves hit %
  role: string;
}

const d = (s: DefenceSpec) => s;

export const DEFENCES: DefenceSpec[] = [
  d({ id: 'zu23', name: 'ZU-23-2', kind: 'gun', price: 10, shot: 0.01, load: 0, range: 2.5, fireEvery: 0.5, hit: { drone: 35, decoy: 35, uav: 15, cruise: 5 }, role: 'Twin 23 mm gun. Cheapest drone defence.' }),
  d({ id: 'gepard', name: 'Gepard', kind: 'gun', price: 30, shot: 0.02, load: 0, range: 4, fireEvery: 0.5, hit: { drone: 55, decoy: 55, uav: 30, cruise: 15 }, role: 'Radar-guided twin 35 mm gun.' }),
  d({ id: 'korkut', name: 'Korkut', kind: 'gun', price: 40, shot: 0.03, load: 0, range: 4, fireEvery: 0.5, hit: { drone: 65, decoy: 65, uav: 35, rocket: 10, cruise: 25 }, role: '35 mm airburst gun. Shreds drone swarms.' }),
  d({ id: 'stinger', name: 'Stinger', kind: 'sam', price: 15, shot: 0.4, load: 4, range: 5, fireEvery: 1.5, interceptorSpeed: 0.7, hit: { drone: 70, decoy: 70, uav: 60, cruise: 30 }, role: 'Shoulder-fired IR missile.' }),
  d({ id: 'sungur', name: 'Sungur', kind: 'sam', price: 25, shot: 0.35, load: 4, range: 8, fireEvery: 1.5, interceptorSpeed: 0.75, hit: { drone: 75, decoy: 75, uav: 65, cruise: 35 }, role: 'Vehicle-mounted short-range IR missile.' }),
  d({ id: 'alka', name: 'ALKA', kind: 'laser', price: 50, shot: 0, load: 0, range: 1, dwell: 1.5, needsPower: true, hit: { drone: 90, decoy: 90, uav: 40 }, role: 'Laser. Burns down drones. Needs power.' }),
  d({ id: 'ironbeam', name: 'Iron Beam', kind: 'laser', price: 90, shot: 0, load: 0, range: 8, dwell: 2, needsPower: true, weatherHit: true, hit: { drone: 90, decoy: 90, uav: 50, rocket: 70, cruise: 20 }, role: 'High-energy laser. Near-free shots; weather hurts it.' }),
  d({ id: 'koral', name: 'Koral', kind: 'ew', price: 80, shot: 0, load: 0, range: 150, needsPower: true, hit: { drone: 15, decoy: 15, uav: 40 }, role: 'Electronic warfare. Drones lost, UAVs turned back, cruise accuracy down.' }),
  d({ id: 'pantsir', name: 'Pantsir-S1', kind: 'sam', price: 110, shot: 0.15, load: 12, range: 20, fireEvery: 1, interceptorSpeed: 1.0, hit: { drone: 80, decoy: 80, uav: 85, rocket: 40, cruise: 75 }, role: 'Gun + missile short-range system.' }),
  d({ id: 'hisara', name: 'Hisar-A+', kind: 'sam', price: 120, shot: 0.5, load: 4, range: 15, fireEvery: 1.5, interceptorSpeed: 0.9, hit: { drone: 80, decoy: 80, uav: 88, cruise: 85 }, role: 'Low-altitude missile. Workhorse against cruise missiles.' }),
  d({ id: 'irondome', name: 'Iron Dome', kind: 'sam', price: 150, shot: 0.06, load: 20, range: 70, fireEvery: 0.7, interceptorSpeed: 1.2, skipsMisses: true, hit: { drone: 80, decoy: 20, uav: 60, rocket: 90, cruise: 60 }, role: 'Rocket killer. Ignores rockets that will miss the city.' }),
  d({ id: 'irist', name: 'IRIS-T SLM', kind: 'sam', price: 180, shot: 0.45, load: 8, range: 40, fireEvery: 1.2, interceptorSpeed: 1.3, hit: { drone: 85, decoy: 85, uav: 92, rocket: 40, cruise: 90 }, role: 'Medium range. Excellent against cruise missiles.' }),
  d({ id: 'hisaro', name: 'Hisar-O+', kind: 'sam', price: 200, shot: 0.7, load: 6, range: 40, fireEvery: 1.2, interceptorSpeed: 1.3, hit: { drone: 85, decoy: 85, uav: 92, cruise: 88 }, role: 'Medium-altitude missile. Kills UAVs before they fire.' }),
  d({ id: 'davidsling', name: "David's Sling", kind: 'sam', price: 300, shot: 1.0, load: 8, range: 150, fireEvery: 1.5, interceptorSpeed: 2.0, hit: { decoy: 85, uav: 85, rocket: 85, cruise: 85, ballistic: 60 }, role: 'Heavy rockets, cruise and short-range ballistic.' }),
  d({ id: 'siper', name: 'Siper', kind: 'sam', price: 380, shot: 1.5, load: 8, range: 150, fireEvery: 1.5, interceptorSpeed: 2.0, hit: { decoy: 85, uav: 95, cruise: 88, ballistic: 45 }, role: 'Long-range area defence. Limited ballistic capability.' }),
  d({ id: 's400', name: 'S-400', kind: 'sam', price: 450, shot: 1.5, load: 8, range: 250, fireEvery: 1.5, interceptorSpeed: 2.2, lowCruisePenalty: 20, hit: { decoy: 85, uav: 95, cruise: 70, ballistic: 65, hypersonic: 10 }, role: 'Very long range. Low cruise missiles slip under it.' }),
  d({ id: 'patriot', name: 'Patriot PAC-3 MSE', kind: 'sam', price: 600, shot: 4.0, load: 8, range: 60, fireEvery: 1.2, interceptorSpeed: 2.5, hit: { decoy: 85, uav: 90, rocket: 60, cruise: 85, ballistic: 90, hypersonic: 35 }, role: 'Hit-to-kill. The answer to ballistic missiles.' }),
];

export interface AttackSpec {
  id: string;
  name: string;
  cls: ThreatClass;
  unit: number;           // $M per unit (reusable UAVs: price of the airframe)
  launcher: number;       // $M, bought once (0 = flies from the airbase)
  perTurn: number;        // units per launcher per turn
  flight: number;         // seconds from launch to the city
  damage: number;         // per hit; for armed UAVs per munition
  precise: boolean;
  low?: boolean;          // low-flying cruise
  reusable?: boolean;     // UAVs come back
  munitions?: number;     // armed UAV: munitions carried
  munitionCost?: number;  // $M per munition (charged at launch)
  salvo?: number;         // Grad: rockets per unit
  scatter?: number;       // unguided: share that lands inside the city (0..1)
  decoysAtEnd?: number;   // Iskander: decoys released near the end
  imitates?: ThreatClass; // decoy looks like this
  role: string;
}

const a = (s: AttackSpec) => s;

export const ATTACKS: AttackSpec[] = [
  a({ id: 'gerbera', name: 'Gerbera decoy', cls: 'decoy', unit: 0.05, launcher: 10, perTurn: 10, flight: 70, damage: 0, precise: false, imitates: 'drone', role: 'Looks like a drone. Wastes enemy interceptors.' }),
  a({ id: 'shahed', name: 'Shahed-136', cls: 'drone', unit: 0.1, launcher: 15, perTurn: 10, flight: 70, damage: 8, precise: false, scatter: 0.9, role: 'Cheap swarm drone. Drains interceptors.' }),
  a({ id: 'kargu', name: 'Kargu-2', cls: 'drone', unit: 0.08, launcher: 10, perTurn: 8, flight: 40, damage: 4, precise: true, role: 'Small loitering drone. Hits a revealed building.' }),
  a({ id: 'grad', name: 'BM-21 Grad', cls: 'rocket', unit: 1.5, launcher: 20, perTurn: 1, flight: 20, damage: 3, precise: false, salvo: 40, scatter: 0.5, role: '40-rocket salvo. Unguided; about half land in empty areas.' }),
  a({ id: 'trg300', name: 'TRG-300', cls: 'rocket', unit: 0.6, launcher: 40, perTurn: 4, flight: 18, damage: 25, precise: true, role: 'Guided 300 mm rocket.' }),
  a({ id: 'himars', name: 'HIMARS GMLRS', cls: 'rocket', unit: 0.3, launcher: 60, perTurn: 6, flight: 18, damage: 20, precise: true, role: 'GPS-guided rockets, six per pod.' }),
  a({ id: 'tb2', name: 'Bayraktar TB2', cls: 'uav', unit: 15, launcher: 0, perTurn: 99, flight: 60, damage: 10, precise: true, reusable: true, munitions: 4, munitionCost: 0.1, role: 'Armed UAV, 4 MAM-L. Comes back if it survives.' }),
  a({ id: 'akinci', name: 'Bayraktar Akıncı', cls: 'uav', unit: 40, launcher: 0, perTurn: 99, flight: 45, damage: 45, precise: true, reusable: true, munitions: 2, munitionCost: 1.0, role: 'Heavy UAV, 2 SOM-J. Comes back if it survives.' }),
  a({ id: 'som', name: 'SOM', cls: 'cruise', unit: 1.2, launcher: 50, perTurn: 2, flight: 35, damage: 50, precise: true, low: true, role: 'Low-flying Turkish cruise missile.' }),
  a({ id: 'tomahawk', name: 'Tomahawk', cls: 'cruise', unit: 2.0, launcher: 60, perTurn: 2, flight: 35, damage: 60, precise: true, low: true, role: 'Low-flying cruise missile.' }),
  a({ id: 'tayfun', name: 'Tayfun', cls: 'ballistic', unit: 3.5, launcher: 90, perTurn: 2, flight: 12, damage: 80, precise: true, role: 'Turkish ballistic missile.' }),
  a({ id: 'iskander', name: 'Iskander-M', cls: 'ballistic', unit: 3.0, launcher: 90, perTurn: 2, flight: 12, damage: 80, precise: true, decoysAtEnd: 2, role: 'Ballistic; releases two decoys near the end.' }),
  a({ id: 'kinzhal', name: 'Kinzhal', cls: 'hypersonic', unit: 8.0, launcher: 150, perTurn: 1, flight: 6, damage: 100, precise: true, role: 'Hypersonic. Only Patriot has a real chance.' }),
];

export interface ScoutSpec { id: string; name: string; price: number; altitude: 'medium' | 'high' | 'very high'; reveal: number; flight: number; onlyLongRange?: boolean; role: string }

export const SCOUTS: ScoutSpec[] = [
  { id: 'tb2s', name: 'Bayraktar TB2 (scout)', price: 15, altitude: 'medium', reveal: 1.5, flight: 60, role: 'Reveals buildings close to its path. Easy to shoot down.' },
  { id: 'anka', name: 'TAI Anka', price: 30, altitude: 'high', reveal: 3, flight: 50, role: 'Wider view, harder to hit.' },
  { id: 'globalhawk', name: 'RQ-4 Global Hawk', price: 90, altitude: 'very high', reveal: 8, flight: 45, onlyLongRange: true, role: 'Sees almost everything. Only long-range SAMs reach it.' },
];
export const LONG_RANGE_SAMS = ['davidsling', 'siper', 's400', 'patriot'];
// Hit % against scouts: medium = UAV %, high = UAV % − 25, very high = only long-range SAMs at UAV %.

// Game-world distances. Real ranges are kept for long-range systems; the city is small so short systems guard districts.
export const CITY_RADIUS = 6;
export const SPAWN_DISTANCE = 300;

export const RULES = {
  setupSeconds: 120,
  turnSeconds: 60,
  turnSecondsCommandHit: 30,
  disconnectSeconds: 60,
  cityHealth: 1000,
  startBudget: 600,
  income: 120,
  knockoutDamage: 20,
  buildingHitRadius: 0.4, // km: an unguided hit this close to a building counts on it
  badWeatherChance: 0.2,
  visualRange: 15,        // km: what you see with no working radar
};

export const RADAR_LEVELS = {
  range: [80, 130, 180, 250],
  identify: [20, 50, 100, Infinity],     // km: type shown inside this distance
  decoy: [0, 30, 70, Infinity],          // km: decoys marked inside this distance (0 = never)
  cost: [0, 40, 80, 140],                // upgrade to that level, per track
  names: ['Kalkan', 'EL/M-2084', 'EL/M-2084 MMR', 'AN/TPY-2'],
};
export const EXTRA_RADAR_PRICE = 50;
export const POWER_RADAR_PENALTY = 0.3;

export const DEF_UPGRADE = { hitBonus: 8, loadBonus: 0.25, costFactor: [0, 0, 0.5, 1.0] }; // index = level reached

export const OFF_UPGRADES = {
  warhead: { label: 'Warhead', effect: 'Damage +15% per level', cost: [40, 80, 140] },
  guidance: { label: 'Guidance', effect: 'Fewer misses per level', cost: [40, 80, 140] },
  stealth: { label: 'Low observable', effect: 'Enemy hit chance −5 pts per level', cost: [60, 120, 200] },
  capacity: { label: 'Launch capacity', effect: '+50% launches per turn per level', cost: [30, 60, 100] },
} as const;
export type OffUpgradeId = keyof typeof OFF_UPGRADES;

export const ECONOMY = {
  income: { label: 'Income', values: [0, 20, 40, 60], cost: [100, 180, 280] },
  storage: { label: 'Underground storage', values: [10, 20, 35, 50], cost: [60, 120, 200] },
  logistics: { label: 'Logistics', values: [2, 4, 6, 9], cost: [50, 100, 180] },
  repair: { label: 'Repair crews', values: [3, 2, 1], cost: [60, 120] },
} as const;
export type EconomyId = keyof typeof ECONOMY;

export type BuildingKind = 'command' | 'radar' | 'power' | 'depot' | 'factory' | 'airbase' | 'finance' | 'structure';
export const BUILDINGS: { kind: BuildingKind; name: string; effect: string; repairNow: number }[] = [
  { kind: 'command', name: 'Command centre', effect: 'Next turn 30 s instead of 60 s', repairNow: 40 },
  { kind: 'radar', name: 'Radar site', effect: "That radar's coverage is lost", repairNow: 30 },
  { kind: 'power', name: 'Power plant', effect: 'Lasers and Koral off; radar range −30%', repairNow: 50 },
  { kind: 'depot', name: 'Ammunition depot', effect: 'Stock above the protected slots is lost', repairNow: 40 },
  { kind: 'factory', name: 'Missile factory', effect: "Can't buy missiles or rockets", repairNow: 40 },
  { kind: 'airbase', name: 'Airbase', effect: "UAVs can't take off", repairNow: 30 },
  { kind: 'finance', name: 'Financial district', effect: 'Income −30%', repairNow: 50 },
  { kind: 'structure', name: 'Building', effect: 'No special effect', repairNow: 0 },
];
export const FINANCE_PENALTY = 0.3;

export const XP = { start: 1000, win: 30, bigWinBonus: 10, bigWinHealth: 500, loss: -20, concede: -25, window: 100, widenEvery: 15, widenBy: 50 };

export const defence = (id: string) => DEFENCES.find(s => s.id === id)!;
export const attack = (id: string) => ATTACKS.find(s => s.id === id)!;
export const scout = (id: string) => SCOUTS.find(s => s.id === id)!;
