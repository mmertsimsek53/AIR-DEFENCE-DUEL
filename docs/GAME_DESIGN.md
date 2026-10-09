# Air Defence Duel — game design

Status: first outline from Mert, 9 Oct 2026. Everything below "Open questions" is still to be decided.

## Platforms
1. iOS first; work on it until finalised.
2. Then Android, same game.

## Core idea
- A duel: two cities, each with defence and attack systems.
- Each player has a **budget** to spend on:
  - building defence systems
  - building attack systems
  - upgrades
  - research & development
- Upgrades can be bought while playing.
- **Every missile costs money.** Upgrades are bought turn by turn.

## Turn structure
1. **Setup — 60 s:** both players set up everything (build, place, upgrade, research).
2. **Attack planning — 30 s each:** each player defines their attack, then presses **GO**.
3. **Defence:** the defending player works live to stop the incoming strike, aiming and guiding their defences.

## What the prototype already has
- 3D daytime city (three.js), radar, command dock with tabs.
- Threat types: ballistic missiles, cruise missiles, drones, UAVs, decoys.
- Pass-and-play on one screen (pass screen between players), strike report ("Strike repelled").

## Open questions
- Online play against another person, or same phone pass-and-play, or both? (Online needs a server.)
- Is there a computer opponent for solo play?
- How does a match end — city destroyed, number of rounds, money run out?
- How does money come in each turn — fixed income, more for successful hits/defences?
- Starting budget, and prices of each missile / defence / upgrade.
- What does research unlock — new weapon types, better accuracy, cheaper missiles?
- Do both players attack in the same round (both define attacks, then both defend), or alternate?
- What happens when a timer runs out — auto-GO with what's set?
