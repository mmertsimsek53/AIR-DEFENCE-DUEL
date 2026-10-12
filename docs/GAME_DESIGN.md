# Air Defence Duel — game design

Status: first outline from Mert, 9 Oct 2026. Everything below "Open questions" is still to be decided.

## Platforms
1. iOS first; work on it until finalised.
2. Then Android, same game.

## Tech stack (decided 9 Oct — same as AirlineRoom)
- Game screen: Mert's prototype 3D scene (three.js) inside a native app shell — same scene on iOS and later Android (decided 9 Oct, after the first SceneKit build looked too plain).
- iOS shell: Swift. Android shell later: Kotlin. Same server.
- Sign-in: Firebase Auth (email/password + Sign in with Apple) — identity only.
- Server: TypeScript on Node.js, on Render (Frankfurt, Starter), auto-deploys on push. Authoritative: timers, money, matchmaking, hit results.
- Live updates: WebSockets.
- Database: Neon Postgres, separate live and dev branches.
- Code: private GitHub repo, pushed after every change.
- Server-down alerts: UptimeRobot.

## Core idea
- A duel: two cities, each with defence and attack systems.
- Each player has a **budget** to spend on:
  - building defence systems
  - building attack systems
  - upgrades
  - research & development
- Upgrades can be bought while playing.
- **Every missile costs money.** Upgrades are bought turn by turn.

## Game modes
1. **Duel** (build first): live 1v1, turn based, described below.
2. **Simulation** (later): base-building mode like Clash of Clans.

## Online & matchmaking (decided 9 Oct)
- Online only, no pass-and-play.
- Players choose when to play; matched with someone of similar XP ranking.

## Turn structure
1. **Setup — 120 s, once at the start of the match:** both players set up everything (build, place, upgrade, research).
2. **Turns, one player at a time — 60 s:** the active player either defines an attack and presses **GO**, or waits and saves money. If the 60 s run out before GO, nothing launches and the turn passes to the other player.
3. **Defence:** the defending player works live to stop the incoming strike, aiming and guiding their defences.

## Money (decided 9 Oct)
- Same fixed income for every player every turn.
- Economy upgrades raise your own per-turn income.

## End of match (decided 9 Oct)
- A player concedes (accepts the loss), or a city is destroyed.
- City health bar: every hit on homes or buildings lowers it; at zero the city is destroyed.
- Disconnect: 60 s to come back, then the absent player loses.

## Menus & upgrades (decided 9 Oct)
- Three upgrade menus: **Defensive upgrades** · **Offensive upgrades** · **Economy** (storage, logistics, per-turn income increase).
- No research in Duel mode: every weapon is available from the start; the limit is money (never enough to buy everything).
- Real system names are used (Mert's decision; re-check before public App Store release).
- Weapons range from the simplest (guns, MANPADS, drones) to the top end. Catalogue: `docs/WEAPONS_CATALOG.md`.

## Turkish systems (decided 9 Oct)
- Turkish systems are added to the v1 list alongside the others (Korkut, Sungur, ALKA, Koral, Hisar-A+, Hisar-O+, Siper; Kargu-2, Akıncı, TRG-300, SOM, Tayfun).

## Critical buildings, surveillance, radar (decided 9 Oct — first version to try, then adjust)
- The city has critical buildings; hitting one disrupts a function.
- Surveillance UAVs reveal where the enemy's important buildings are. Once revealed, a building stays visible for the rest of the match.
- Buildings are hidden from the enemy until revealed.

| Building | If hit |
|---|---|
| Command centre | Your next turn is shortened (60 s → 30 s) |
| Radar sites | That radar's coverage is lost until repaired |
| Power plant | Lasers (ALKA, Iron Beam) and Koral off; radar range drops |
| Ammunition depot | Missiles stored above ground are lost |
| Missile factory | No new missiles next turn |
| Airbase | Your UAVs can't take off next turn |
| Financial district / port | Income drops for a few turns |

- Damaged buildings repair themselves after a few turns, or faster if you pay.
- Surveillance UAVs (e.g. TB2 scouting, Anka, Global Hawk) reveal buildings under their path. Cheap = low, slow, easy to shoot down; expensive = high, sees more. Unrevealed → you can only aim at the city in general.
- Radars: 3 levels each for **range** (earlier warning), **identification** (threat type vs "unknown"), **decoy detection** (how soon fakes are marked). Real radar names per level (e.g. Kalkan → EL/M-2084 → AN/TPY-2).

## Defence missile restock (decided 9 Oct)
- Each missile defence has a standing order "keep N spare" (default: one full reload). At the start of each of your own turns the game buys missiles back up to that level automatically, as far as money allows (not while the factory is down). Change it any time.

## Live attack (decided 9 Oct)
- On your turn you buy/upgrade, then tap START ATTACK. The battle starts on the enemy city and you send weapons one at a time: pick a weapon, tap where it starts (outside the city), tap where it should hit. It launches at once. Per-turn launch capacity still applies. End attack when done; the battle plays out. (Online: the live window closes after the turn length.)
- Start distance: missiles 12–40 km, drones/UAVs up to their normal range. Precise weapons hit the tapped point (or a revealed building within 0.6 km); unguided ones land around it (drone ~0.5 km, Grad salvo ~1.5 km).
- Auto attack sends everything ready at the best known target in one go. The AI attacks in one go.

## Strike direction & scout paths (decided 9 Oct; drawn routes now unused in the live attack)
- The attacker draws freehand on the enemy city map. Strike route: start far out, go around as wanted, end at the city. Drones, decoys and UAVs follow it exactly; cruise missiles follow a smoothed version (no sharp turns); rockets, ballistic and hypersonic missiles only take its direction. Each scout UAV gets its own freehand path. Default without a route: straight from the north (±20°).
- Low flyers lift over the hills outside the city (visual).
- "Top up all" fills every magazine and every spare stock to its standing order in one tap; magazines also refill from the depot at the start of your own turn.

## Practice (decided 9 Oct)
- No AI stand-in for matchmaking: you wait for a real online opponent.
- Separate **Sandbox training** against an AI opponent. No clock in training (decided 9 Oct): setup ends with "I'm done", a turn ends with GO or "Done, no attack". Online duels keep the clock.

## Progression (decided 9 Oct)
- Every duel starts from zero (budget, systems, research).
- Only XP carries over; it is used for matchmaking.

## What the prototype already has
- 3D daytime city (three.js), radar, command dock with tabs.
- Threat types: ballistic missiles, cruise missiles, drones, UAVs, decoys.
- Pass-and-play on one screen (pass screen between players), strike report ("Strike repelled").

## Open questions
- How much XP for a win / loss / concession?
- Starting budget, money per turn, prices of each missile / defence / upgrade.

## Chief duel (decided 11 Oct 2026, Mert) — replaces the city health bar; base mode paused
- **Goal:** kill the enemy chief. Each city has **8 identical hideouts**, visible to both sides; the chief is secretly in one. Any weapon that lands on the chief's hideout wins the match. A hit on an empty hideout destroys it and both sides know it was empty.
- **Chief:** placed free during setup (random by default); moved on your own turn for **$30M**, as often as you like. The enemy is not told.
- **Mini recon drones** ($0.5M, up to 4 per turn, no launcher): fly to a hideout, hover 5 s, report whether the chief is inside. Can be sent any time; defences shoot at them. They are small and low: radar sees them only within 6 km and hit chances against them are 60% of a normal drone's. The defender sees which hideout was checked.
- **Taking down the defence:** a battery reveals itself when it fires; a hit of 20+ damage within 0.3 km destroys it (precise weapons aimed near a revealed battery lock onto it).
- **Decoys:** the defender sees only what a contact looks like (drone-like / missile-like), never whether it is a decoy; only the attacker knows. Gerbera (drone-like) and the new MALD missile decoy ($0.3M, cruise-like; launcher $30M, 4 per turn). Radar decoy detection is gone.
- **No upgrades** (battery levels, offence, economy, radar). Fixed: radar 150 km, threat type at 60 km, 10 protected storage slots, 2 reloads per strike, buildings down 3 turns.
- Unchanged: $600M start, +$120M per turn, every weapon costs its price, live attack, critical buildings and their effects, surveillance UAVs reveal critical buildings.
- The duel city uses the Blender building models (lite versions packed into `web/models.js`): HQ L7 = command centre, Radar L4, Power L4, Treasury L8 = financial district, TNT Plant L7 = ammunition depot, and a new hideout model. Factory and airbase keep their old models for now.

## Layouts, TB2 survey, fire control (decided 11 Oct 2026, Mert)
- **20 city layouts**; each match picks one per player at random and shuffles which building stands where (7 critical buildings + 8 hideouts). Nothing sits on fixed plots any more.
- **Everything starts hidden**, hideouts included. The enemy city is under cloud until surveyed.
- **TB2 survey** (the duel's only scout): flies one lap round the enemy city and photographs a sector on arrival and every quarter lap (4 of 12 sectors ≈ a third of the city). Everything standing in a photographed sector becomes known (hideouts, buildings, batteries). Defences fire at it, but on automatic fire each battery takes only one shot per flight, at 30% of its normal UAV hit chance, and only when nothing else is coming; a defender who taps the TB2 makes every battery keep firing. Reusable if it gets home.
- **Fire control:** small systems (guns, MANPADS, lasers, EW, missiles under 40 km) always fire automatically. Big missile systems (40 km+) have an Auto / Manual switch; on Manual they fire only at contacts the defender taps.
- **German systems removed** (Gepard, IRIS-T SLM). New Turkish / American / Russian systems will be added after Mert approves their numbers.

## Shorter matches, a job for every weapon (11 Oct 2026, Mert: "150 rounds is too much")
- Batteries take cumulative damage: 20 within 0.3 km destroys one (≈3 Shahed or 5 Kargu hits, one hit from any rocket/missile).
- TB2 survey lap photographs half the city (6 of 12 sectors). Recon drones: seen within 4 km, hit chance × 0.5. Moving the chief: $50M.
- Armed UAVs drop on the point they are sent to (not random), so they can hit batteries and hideouts.
- Every weapon's job is written in its card in the Attack tab.
- AI vs AI: median about 31 turns in total (≈15 each), 6–80 over 16 games (was up to 150+).

## Aksungur survey and Akıncı air patrol (decided 11 Oct 2026, Mert)
- The survey UAV is the **TAI Aksungur** ($25M, reusable): one lap photographs half the enemy city. Ground defences cannot reach it.
- The defender can add up to 2 **Akıncı air patrols** ($40M each, stay all match) circling over their own city at a random radius, height and direction each strike. An enemy survey UAV that comes within 1.2 km may be shot down: 1 Bozdoğan air-to-air missile per patrol per strike, $1M, 60% hit. Measured: one patrol downs an Aksungur about 28% of the time, two about 45%.
- The Akıncı is no longer an attack weapon (Mert: "akinci no need for attacking").

## Defence limit (decided 11 Oct 2026, Mert)
- Before a match the player chooses a **defence limit per player: 4 / 6 / 8 / no limit** (default 6). It applies to both sides (the AI too) and counts ground defence systems; Akıncı air patrols keep their own maximum of 2. Selling a system frees a slot.

## No cloud (11 Oct 2026, Mert)
- The enemy city itself is always visible (streets, river, houses). Hideouts, critical buildings and defences stay hidden until an Aksungur survey photographs their sector.

## Defence draft (decided 11 Oct 2026, Mert) — replaces the defence limit option
- In setup each player picks **2 short-range, 2 medium-range, 2 long-range and 1 top-level** system, free (first load included). Picks can be swapped during setup; after setup no defence can be added and a destroyed one is not replaced. Akıncı air patrols are also chosen in setup.
- Money then goes only on attack weapons, drones (Aksungur, recon, decoys) and defence ammunition.
- Levels: short — ZU-23-2, Korkut, Phalanx C-RAM, Stinger, Igla-S, Sungur, Avenger, ALKA, Gökberk, İhtar · medium — Pantsir-S1, Tunguska, Gürz, Tor-M2, Hisar-A+, Iron Dome, Iron Beam, Koral · long — Hisar-O+, NASAMS, Buk-M3, David's Sling, Siper, S-300 · top — Patriot PAC-3, S-400, S-500, THAAD.
- AI vs AI: median 21 turns in total, 12–41 over 16 games.

## Lives (decided 11 Oct 2026, Mert: a Shahed should not destroy a building in one shot)
- Hideouts and critical buildings have **40 lives**; defence systems **20**. Each hit takes its warhead damage (Shahed 8, Kargu 4, guided rockets 20–25, cruise 50–60, ballistic 80, hypersonic 100).
- A hideout at 0 is destroyed: chief inside → the attacker wins; empty → both sides know. Damage to hideouts stays between turns.
- A critical building at 0 is knocked out for 3 turns, then comes back with full lives (or pay to repair now).
- Remaining lives show on the labels (your own buildings, and enemy ones you have found) and on battery tags.

## Breaking the defence: anti-radiation weapons (decided 11 Oct 2026, Mert: "without hypersonic I cannot open any gap")
- **Akbaba** anti-radiation missile: launcher $60M, $1.5M each, 4 per turn, 8 s flight. Homes on any enemy defence whose radar is on (it fired this strike) within 50 km; one hit (25) destroys a defence. Defences hit it at 20% of their normal chance. If nothing fires it lands on the aim point.
- **Harop** loitering drone: $3M, no launcher, 2 per turn. Flies to the aim point, circles up to 60 s and dives on the first defence that switches on its radar (25 damage). Hit at 20% of normal (drone).
- Passive systems give nothing to home on: Stinger, Igla-S, Sungur, Avenger (infra-red) and ALKA, Gökberk, Iron Beam (lasers). Jammers (Koral, İhtar) give themselves away when they jam.
- A defence that runs out of missiles with no reloads left announces it ("out of missiles for this strike"); the attacker sees it on known batteries.
- Measured: 2 Akbabas destroy a lone Pantsir 7 times in 10. AI vs AI median 10 turns (5–14).

## Setup planner (11 Oct 2026, Mert)
- The match opens in the 3D city. Defence → **Place your defence** opens a top view of your city with the defence list on the left (tabs per level + air patrol). Tap a system, then an empty spot; tap a placed one to remove it; tap a hideout to move the chief there. Range circles show coverage. **Done · start the duel** (all 7 placed) ends setup and returns to 3D for turn 1.

## Done 12 Oct 2026 — fewer labels, shorter lists
1. **No text during the war:** threats show only as coloured boxes (no names). Building labels show only on the City / Chief tabs, own ammo tags only on the Defence tab, enemy battery tags only on the Attack tab — never during a strike.
2. **Short list** (`DUEL_DEFENCES` / `DUEL_ATTACKS` in core/src/data.ts; other systems stay for My Base mode):
   - Short: Korkut (TR), Sungur (TR), Stinger (US), Igla-S (RU)
   - Medium: Hisar-A+ (TR), Gürz (TR), Pantsir-S1 (RU), Iron Dome (IL)
   - Long: Hisar-O+ (TR), Siper Blok-1 (TR, 100 km, $300M), NASAMS (US), S-300 (RU)
   - Top: Siper Blok-2 (TR, 150 km, ballistic 60%, $420M), Siper Blok-3 (TR, 180 km, ballistic 85%, hypersonic 30%, $520M), Patriot (US), S-400 (RU)
   - Find: Aksungur, mini recon · Drones & decoys: Kargu, Alpagu (new: $0.6M, 4/turn, damage 12, precise), Shahed, MALD · Rockets & anti-radar: TRG-300, Akbaba, HIMARS, Harop · Missiles: SOM, Tayfun, Tomahawk, Kinzhal · UAV: TB2

## Saturation — 12 Oct 2026 (Mert: "make Tayfun and Tomahawk useful by tiring the defences with cheaper attacks first")
- **Time on target:** a planned strike launches slow weapons first so everything reaches the city within 4 s. In a live strike the player times it.
- **Guidance channels:** a battery guides at most 1 interceptor at a time (short / medium range) or 2 (long range / top level).
- **Swamped radar:** more contacts in a battery's range than it handles (2 short/medium, 4 long/top) cost 6 hit-chance points each, up to −36.
- Duel only (My Base raids unchanged). Simulated, 40 strikes per mix vs both AI defence sets: 2 Tayfun + 30 Shahed + 12 MALD gets the Tayfun through 49–78% (was 6–19%); Tomahawk with the same cover 23–48% (was 4–11%); 30 Shahed alone 57–66%; lone Tayfun / Kinzhal unchanged. AI v AI median 7 turns (was 9).

