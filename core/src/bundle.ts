// Entry point for the apps (JavaScriptCore on iOS). Exposes a small JSON-in / JSON-out API on globalThis.ADD.
import * as core from './index';
import type { Command, Match } from './types';

let match: Match | undefined;
const HUMAN = 0;

const api = {
  newSandbox(seed: number, name: string, demo?: boolean): void {
    match = core.createMatch(seed, [name || 'You', 'Training AI'], [!!demo, true]);
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
  save(): string { return match ? JSON.stringify(match) : ''; },
  load(json: string): boolean { try { match = JSON.parse(json) as Match; return true; } catch { return false; } },
};

(globalThis as unknown as { ADD: typeof api }).ADD = api;
