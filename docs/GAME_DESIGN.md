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
