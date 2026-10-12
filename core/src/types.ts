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
  manual?: boolean;       // big systems only: fire only at contacts the player taps
  damage?: number;        // duel: damage taken so far (destroyed at RULES.batteryKillDamage)
  dry?: boolean;          // out of missiles with no reloads left for this strike
  emitted?: boolean;
  contacts?: number;      // duel: contacts inside its range this moment (swamped radar)      // its radar was on during this strike (it fired): anti-radiation weapons can home on it
}

export interface Building extends Point {
  uid: number;
  kind: BuildingKind;
  down: number;           // turns until repaired (0 = working)
  revealed: boolean;      // the enemy knows where it is
  battleDamage: number;
  // Base raids: every structure has strength and a footprint.
  hp?: number; maxHp?: number; r?: number; name?: string; baseType?: string; size?: number; level?: number;
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
  chief: number;                         // uid of the hideout the chief is in (secret)
  intel: { uid: number; found: boolean; turn: number }[]; // what your recon drones / strikes learned about the enemy hideouts
  inspected: number[];                   // your hideouts an enemy recon drone checked in the last strike (you saw it hover)
  layout: number;                        // which of the city layouts this player's city uses
  surveyed: number[];                    // enemy city sectors your survey UAVs have photographed
  patrols: number;                       // Akıncı air patrols over your own city
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
  ewBy?: number[];         // jammers that already had their roll at this contact
  returning: boolean;      // UAV turned back / going home
  munitions: number;
  dropLeg: number;         // armed UAV: the path leg that ends over its target
  dropCooldown: number;
  revealRadius: number;
  spawnedDecoys: boolean;
  stealth: number;
  hover?: number;          // recon drone: seconds left hovering over its hideout
  locked?: number;         // anti-radiation: uid of the battery it is diving on
  firedBy?: number[];      // survey TB2: batteries that already took their one automatic shot at it
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
  | { t: 'msg'; text: string; tone: 'good' | 'bad' | 'info' }
  | { t: 'aam'; fx: number; fz: number; falt: number; tx: number; tz: number; talt: number; kill: boolean } // air patrol fires at a survey UAV
  | { t: 'survey'; sector: number }                    // a TB2 photographed a sector of the enemy city
  | { t: 'intel'; building: number; found: boolean } // a recon drone finished checking a hideout
  | { t: 'hideout'; building: number; chief: boolean }; // a hideout was hit

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
  chiefDown?: boolean;     // the defender's chief was killed during this strike
  patrols?: Patrol[];      // the defender's Akıncı air patrols during this strike
}

export interface Patrol { uid: number; r: number; a: number; w: number; x: number; z: number; alt: number; missiles: number; cooldown: number }

export type Phase = 'setup' | 'turn' | 'battle' | 'report' | 'over';

export interface Match {
  version: 1;
  rng: number;
  time: number;
  phase: Phase;
  phaseEndsAt: number;
  timed?: boolean;          // false = no setup/turn clock (sandbox); missing = timed
  maxBatteries?: number;    // defence limit per player chosen for this match (missing = no limit)
  raid?: { grid: number };  // a single strike on a military base (no turns); grid = the defender's base size in tiles
  cityRadius?: number;      // km; defaults to the old city radius
  active: PlayerIndex;       // whose turn (the attacker in a battle)
  turnNo: number;
  weatherBad: boolean;
  players: [PlayerState, PlayerState];
  battle?: Battle;
  lastReport?: BattleReport;
  winner?: PlayerIndex;
  endReason?: 'destroyed' | 'conceded' | 'disconnected' | 'chief';
  nextUid: number;
  log: { time: number; text: string }[];
}

export interface BattleReport {
  attacker: PlayerIndex;
  launched: number; stopped: number; hits: number; damage: number;
  interceptorsUsed: number; defenceSpent: number; attackSpent: number;
  knockedOut: string[];
  revealed: number;
  raid?: { destroyedPct: number; hqDown: boolean; stars: number };
}

// Commands a player sends. The engine checks every one.
export type Command =
  | { c: 'buyBattery'; sys: string; pad: number }
  | { c: 'sellBattery'; uid: number }
  | { c: 'buyInterceptors'; sys: string; n: number }
  | { c: 'setRestock'; sys: string; n: number }
  | { c: 'topUp' }
  | { c: 'buyLauncher'; weapon: string }
  | { c: 'buyUnits'; weapon: string; n: number }
  | { c: 'buyScout'; scout: string }
  | { c: 'buyPatrol' }                  // Akıncı air patrol over your own city
  | { c: 'placeChief'; uid: number }   // setup: choose the chief's hideout (free)
  | { c: 'moveChief'; uid: number }    // own turn: move the chief ($30M)
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
  | { c: 'setManual'; uid: number; on: boolean } // big systems: manual (only tapped contacts) or automatic fire
  | { c: 'endSetup' }
  | { c: 'continue' };

export type CommandResult = { ok: true } | { ok: false; error: string };
