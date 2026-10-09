// Entry point for the apps (JavaScriptCore on iOS). Exposes a small JSON-in / JSON-out API on globalThis.ADD.
import * as core from './index';
import type { Command, Match } from './types';

let match: Match | undefined;
let base: core.Base | undefined;
const HUMAN = 0;

const api = {
  newSandbox(seed: number, name: string, demo?: boolean): void {
    match = core.createMatch(seed, [name || 'You', 'Training AI'], [!!demo, true], { timed: false }); // sandbox: no clock, you end each phase yourself
  },
  cmd(json: string): string {
    if (!match) return JSON.stringify({ ok: false, error: 'No match.' });
    return JSON.stringify(core.command(match, HUMAN, JSON.parse(json) as Command));
  },
  tick(dt: number): void {
    if (!match) return;
    core.aiStep(match);
    core.tick(match, dt);
  },
  view(): string { return match ? JSON.stringify(core.viewFor(match, HUMAN)) : 'null'; },
  events(): string { return match ? JSON.stringify(core.drainEvents(match)) : '[]'; },
  catalogue(): string {
    return JSON.stringify({
      defences: core.DEFENCES, attacks: core.ATTACKS, scouts: core.SCOUTS, rules: core.RULES,
      radar: { ...core.RADAR_LEVELS, identify: core.RADAR_LEVELS.identify.map(v => (v === Infinity ? 9999 : v)), decoy: core.RADAR_LEVELS.decoy.map(v => (v === Infinity ? 9999 : v)) },
      extraRadar: core.EXTRA_RADAR_PRICE, offUpgrades: core.OFF_UPGRADES, economy: core.ECONOMY, buildings: core.BUILDINGS,
      defUpgrade: core.DEF_UPGRADE, cityRadius: core.CITY_RADIUS,
    });
  },
  // Direct (no JSON) access for the in-app web game, which runs in the same JS context.
  viewRaw() { return match ? core.viewFor(match, HUMAN) : null; },
  cmdRaw(cmd: Command) { return match ? core.command(match, HUMAN, cmd) : { ok: false, error: 'No match.' }; },
  eventsRaw() { return match ? core.drainEvents(match) : []; },
  catalogueRaw() {
    return {
      defences: core.DEFENCES, attacks: core.ATTACKS, scouts: core.SCOUTS, rules: core.RULES, radar: core.RADAR_LEVELS,
      extraRadar: core.EXTRA_RADAR_PRICE, offUpgrades: core.OFF_UPGRADES, economy: core.ECONOMY, buildings: core.BUILDINGS,
      defUpgrade: core.DEF_UPGRADE, cityRadius: core.CITY_RADIUS, longRange: core.LONG_RANGE_SAMS,
    };
  },
  geo() {
    return { unitsPerKm: core.UNITS_PER_KM, river: core.RIVER, landmark: core.LANDMARK, slots: core.buildingSlots(), pads: core.padLayout() };
  },
  quit(): void { match = undefined; },
  // ---------- persistent base ----------
  baseLoad(json: string | null, name: string): void {
    try { if (json) { const b = JSON.parse(json) as core.Base; if (b && b.version === 1 && Array.isArray(b.buildings)) { base = b; core.baseTick(base, Date.now()); return; } } } catch { /* start fresh */ }
    base = core.newBase(name || 'Commander', Date.now());
  },
  baseSave(): string { return base ? JSON.stringify(base) : ''; },
  baseCmd(cmd: core.BaseCommand) { return base ? core.baseCommand(base, cmd, Date.now()) : { ok: false, error: 'No base.' }; },
  baseTick(): void { if (base) core.baseTick(base, Date.now()); },
  baseView() { return base ? core.baseView(base, Date.now()) : null; },
  baseCanPlace(type: string, x: number, y: number, ignore?: number) { return !!base && core.canPlaceAt(base, type, x, y, ignore); },
  save(): string { return match ? JSON.stringify(match) : ''; },
  load(json: string): boolean { try { match = JSON.parse(json) as Match; return true; } catch { return false; } },
};

(globalThis as unknown as { ADD: typeof api }).ADD = api;
