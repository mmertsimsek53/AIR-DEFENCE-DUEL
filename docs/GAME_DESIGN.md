# Air Defence Duel — game design

Status: first outline from Mert, 9 Oct 2026. Everything below "Open questions" is still to be decided.

## Platforms
1. iOS first; work on it until finalised.
2. Then Android, same game.

## Tech stack (decided 9 Oct — same as AirlineRoom)
- iOS app: native Swift. Android later: native Kotlin on the same server.
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
- A fixed amount drops into each budget every turn.

## End of match (decided 9 Oct)
- A player concedes (accepts the loss), or a city is destroyed.
- Disconnect: 60 s to come back, then the absent player loses.

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
- What does research unlock — new weapon types, better accuracy, cheaper missiles?
- Is there a computer opponent while waiting for a match?
