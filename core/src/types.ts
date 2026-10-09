import type { BuildingKind, EconomyId, OffUpgradeId, ThreatClass } from './data';

export type PlayerIndex = 0 | 1;
export interface Point { x: number; z: number }

export interface Pad extends Point { id: number }

export interface Battery {
  uid: number;
  sys: string;
  pad: number;
  level: number;          // 1..3
  ammo: number;           // SAMs only
  cooldown: number;
  reloading: number;      // seconds left
  holdFire: boolean;
  revealed: boolean;      // the enemy has seen it (fired, or scouted)
  kills: number;
  dwellTarget?: number;   // lasers
  dwell: number;
}

export interface Building extends Point {
  uid: number;
  kind: BuildingKind;
  down: number;           // turns until repaired (0 = working)
  revealed: boolean;      // the enemy knows where it is
  battleDamage: number;
}

export interface PlayerState {
  index: PlayerIndex;
  name: string;
  isAI: boolean;
  budget: number;
  health: number;
  pads: Pad[];
  scars: { x: number; z: number; d: number }[]; // impact points in this city (for the 3D view)
  batteries: Battery[];
  buildings: Building[];
  interceptors: Record<string, number>; // depot stock per defence system
  launchers: Record<string, number>;
  stock: Record<string, number>;        // attack units / UAV airframes
  scouts: Record<string, number>;
  launched: Record<string, number>;     // this turn, per weapon
  offUp: Record<string, Partial<Record<OffUpgradeId, number>>>;
  econ: Record<EconomyId, number>;      // levels
  radar: { range: number; identify: number; decoy: number };
  autoFire: boolean;
  reloadsLeft: number;
  spent: number;
  conceded: boolean;
  ready: boolean;          // finished setup early
  restock: Record<string, number>;      // standing order: spare interceptors to keep per system (bought at the start of each own turn)
  lastRestock?: { n: number; cost: number; short: boolean };
}

export interface Threat {
  uid: number;
  weapon: string;          // attack or scout id ('decoy' for Iskander decoys)
  cls: ThreatClass;
  looksLike: ThreatClass;
  isScout: boolean;
  path: { x: number; z: number }[]; // waypoints in the defender's frame
  leg: number;
  speed: number;           // km/s beyond 20 km from the city
  speedIn: number;         // km/s inside 20 km (terminal phase: half the flight time is spent here)
  x: number; z: number; alt: number;
  peakAlt: number;
  traveled: number; total: number;
  delay: number;           // seconds until launch
  alive: boolean;
  landed: boolean;
  landsInCity: boolean;
  targetBuilding?: number;
  damage: number;
  precise: boolean;
  low: boolean;
  detected: boolean;
  identified: boolean;
  decoyMarked: boolean;
  priority: boolean;
  hold: boolean;
  engaged: number;         // interceptors in flight at it
  ewChecked: boolean;
  returning: boolean;      // UAV turned back / going home
  munitions: number;
  dropLeg: number;         // armed UAV: the path leg that ends over its target
  dropCooldown: number;
  revealRadius: number;
  spawnedDecoys: boolean;
  stealth: number;
}

export interface Interceptor {
  uid: number;
  battery: number;
  sys: string;
  target: number;
  x: number; z: number; alt: number;
  speed: number;
}

export type BattleEvent =
  | { t: 'launch'; uid: number; sys: string; x: number; z: number }
  | { t: 'gun'; sys: string; fx: number; fz: number; tx: number; tz: number; alt: number; kill: boolean }
  | { t: 'laser'; sys: string; fx: number; fz: number; tx: number; tz: number; alt: number; kill: boolean }
  | { t: 'kill'; x: number; z: number; alt: number; cls: ThreatClass }
  | { t: 'miss'; x: number; z: number; alt: number }
  | { t: 'impact'; x: number; z: number; damage: number; building?: number }
  | { t: 'knockout'; building: number; kind: string }
  | { t: 'reveal'; building: number }
  | { t: 'msg'; text: string; tone: 'good' | 'bad' | 'info' };

export interface Battle {
  attacker: PlayerIndex;
  defender: PlayerIndex;
  bearing: number;         // radians: the side the strike comes from
  route?: Point[];         // drawn strike route (km), first point = where it comes from
  live?: boolean;          // the attacker launches weapons one by one during the battle
  open?: boolean;          // live attack still accepting launches
  time: number;
  threats: Threat[];
  interceptors: Interceptor[];
  events: BattleEvent[];   // since the last drain
  stats: { launched: number; stopped: number; hits: number; damage: number; interceptorsUsed: number; defenceSpent: number; attackSpent: number };
  over: boolean;
}

export type Phase = 'setup' | 'turn' | 'battle' | 'report' | 'over';

export interface Match {
  version: 1;
  rng: number;
  time: number;
  phase: Phase;
  phaseEndsAt: number;
  timed?: boolean;          // false = no setup/turn clock (sandbox); missing = timed
  active: PlayerIndex;       // whose turn (the attacker in a battle)
  turnNo: number;
  weatherBad: boolean;
  players: [PlayerState, PlayerState];
  battle?: Battle;
  lastReport?: BattleReport;
  winner?: PlayerIndex;
  endReason?: 'destroyed' | 'conceded' | 'disconnected';
  nextUid: number;
  log: { time: number; text: string }[];
}

export interface BattleReport {
  attacker: PlayerIndex;
  launched: number; stopped: number; hits: number; damage: number;
  interceptorsUsed: number; defenceSpent: number; attackSpent: number;
  knockedOut: string[];
  revealed: number;
}

// Commands a player sends. The engine checks every one.
export type Command =
  | { c: 'buyBattery'; sys: string; pad: number }
  | { c: 'upgradeBattery'; uid: number }
  | { c: 'sellBattery'; uid: number }
  | { c: 'buyInterceptors'; sys: string; n: number }
  | { c: 'setRestock'; sys: string; n: number }
  | { c: 'topUp' }
  | { c: 'buyLauncher'; weapon: string }
  | { c: 'buyUnits'; weapon: string; n: number }
  | { c: 'buyScout'; scout: string }
  | { c: 'upgradeOffence'; weapon: string; track: OffUpgradeId }
  | { c: 'upgradeEconomy'; track: EconomyId }
  | { c: 'upgradeRadar'; track: 'range' | 'identify' | 'decoy' }
  | { c: 'buyRadarSite' }
  | { c: 'repairNow'; uid: number }
  | { c: 'go'; strikes: { weapon: string; n: number; target?: number }[]; scouts: { scout: string; path: Point[] }[]; bearing?: number; route?: Point[]; live?: boolean }
  | { c: 'fire'; weapon?: string; scout?: string; from: Point; to: Point } // live attack: one launch from a start point to an aim point
  | { c: 'endAttack' } // bearing: radians, direction the strike comes FROM (x = cos, z = sin); default north
  | { c: 'wait' }
  | { c: 'concede' }
  | { c: 'setAutoFire'; on: boolean }
  | { c: 'priority'; uid: number }
  | { c: 'holdThreat'; uid: number }
  | { c: 'holdBattery'; uid: number }
  | { c: 'endSetup' }
  | { c: 'continue' };

export type CommandResult = { ok: true } | { ok: false; error: string };
