# Air Defence Duel — numbers sheet (draft v1, 9 Oct 2026)

All money in **$M (game millions)**. Game prices are compressed from real prices so cheap things still cost something; the real price order and the "cheap drone vs expensive interceptor" gap are kept. Everything here is a first guess to try on the phone and tune.

## 1. Match

| Item | Value |
|---|---|
| Setup (once, both players at the same time) | 120 s |
| Turn (attack or wait) | 60 s; timeout → no launch, turn passes |
| Battle (live defence) | runs until every threat has hit or been stopped, usually 40–90 s |
| Distance between cities | 300 km (game) |
| Disconnect grace | 60 s, then loss |
| City health | 1,000 |
| Starting budget | $600M |
| Income per turn (same for everyone) | $120M, paid at the start of your own turn |
| Upkeep | none in v1 (keeps it simple; add later if money piles up) |

Target match length: about 8–12 turns each (~25–35 min).

## 2. Defence systems

Battery = launcher/gun + its first full load. Shot = one interceptor (or one gun burst). Hit % = chance that one shot kills that threat.

| System | Battery $M | Shot $M | Load | Range km | Drone | Decoy* | UAV | Rocket | Cruise | Ballistic | Hypersonic | Special |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ZU-23-2 | 10 | 0.01 | ∞ | 2.5 | 35 | 35 | 15 | – | 5 | – | – | Cheapest |
| Gepard | 30 | 0.02 | ∞ | 4 | 55 | 55 | 30 | – | 15 | – | – | |
| Korkut | 40 | 0.03 | ∞ | 4 | 65 | 65 | 35 | 10 | 25 | – | – | Airburst |
| Stinger | 15 | 0.4 | 4 | 5 | 70 | 70 | 60 | – | 30 | – | – | |
| Sungur | 25 | 0.35 | 4 | 8 | 75 | 75 | 65 | – | 35 | – | – | |
| ALKA (laser) | 50 | 0 | ∞ | 1 | 90 | 90 | 40 | – | – | – | – | Needs power; 1.5 s per target |
| Iron Beam (laser) | 90 | 0 | ∞ | 8 | 90 | 90 | 50 | 70 | 20 | – | – | Needs power; 2 s per target; bad weather −50% (random, 1 in 5 turns) |
| Koral (EW) | 80 | 0 | ∞ | 150 | 15 | 15 | 40 | – | – | – | – | Needs power; not a kill: drones lost / UAVs turned back; enemy cruise accuracy −20% |
| Pantsir-S1 | 110 | 0.15 | 12 | 20 | 80 | 80 | 85 | 40 | 75 | – | – | Gun + missiles |
| Hisar-A+ | 120 | 0.5 | 4 | 15 | 80 | 80 | 88 | – | 85 | – | – | |
| Iron Dome | 150 | 0.06 | 20 | 70 | 80 | 20 | 60 | 90 | 60 | – | – | Skips threats that will miss the city (saves shots) |
| IRIS-T SLM | 180 | 0.45 | 8 | 40 | 85 | 85 | 92 | 40 | 90 | – | – | |
| Hisar-O+ | 200 | 0.7 | 6 | 40 | 85 | 85 | 92 | – | 88 | – | – | |
| David's Sling | 300 | 1.0 | 8 | 150 | – | 85 | 85 | 85 | 85 | 60 | – | |
| Siper | 380 | 1.5 | 8 | 150 | – | 85 | 95 | – | 88 | 45 | – | |
| S-400 | 450 | 1.5 | 8 | 250 | – | 85 | 95 | – | 70 | 65 | 10 | Low cruise −20% (flies under) |
| Patriot PAC-3 MSE | 600 | 4.0 | 8 | 60 | – | 85 | 90 | 60 | 85 | 90 | 35 | Best vs ballistic |

\*Decoy: hit % is the same as the threat it imitates. The real cost is the wasted shot. Radar decoy detection (section 5) stops you firing at it.

Reloads during a battle come from the depot and are limited by **Logistics** (section 6).

## 3. Attack weapons

Unit = one weapon in stock. Launcher = bought once; it sets how many can fly per turn. Damage = city health lost on a hit. Precise weapons can target a **revealed** building; others land on the city in general.

| Weapon | Unit $M | Launcher $M | Per turn per launcher | Speed (battle time to city) | Damage | Precise | Notes |
|---|---|---|---|---|---|---|---|
| Gerbera decoy | 0.05 | 10 | 10 | slow, 70 s | 0 | – | Looks like a drone or cruise missile |
| Shahed-136 | 0.1 | 15 | 10 | slow, 70 s | 8 | – | Swarm; drains interceptors |
| Kargu-2 | 0.08 | 10 | 8 | slow, 40 s (launched near the city) | 4 | yes | Small; hits a revealed building |
| BM-21 Grad | 1.5 per 40-rocket salvo | 20 | 1 salvo | fast, 20 s | 3 per rocket | – | Unguided: about half land in empty areas |
| TRG-300 | 0.6 | 40 | 4 | fast, 18 s | 25 | yes | |
| HIMARS (GMLRS) | 0.3 | 60 | 6 | fast, 18 s | 20 | yes | |
| Bayraktar TB2 | 15 (reusable) | – | – | slow, 60 s | 4 × 10 (MAM-L, 0.1 each) | yes | Comes back if it survives; also scouts |
| Bayraktar Akıncı | 40 (reusable) | – | – | medium, 45 s, high | 2 × 45 (SOM-J) or 8 × 10 | yes | Comes back if it survives; also scouts |
| SOM | 1.2 | 50 | 2 | medium, 35 s, low | 50 | yes | Low-flying cruise |
| Tomahawk | 2.0 | 60 | 2 | medium, 35 s, low | 60 | yes | Low-flying cruise |
| Tayfun | 3.5 | 90 | 2 | very fast, 12 s | 80 | yes | Ballistic |
| Iskander-M | 3.0 | 90 | 2 | very fast, 12 s | 80 | yes | Ballistic; releases 2 decoys near the end |
| Kinzhal | 8.0 | 150 | 1 | hypersonic, 6 s | 100 | yes | Top threat; only PAC-3 has a real chance |

UAVs (TB2, Akıncı) take off from your **airbase**.

## 4. Surveillance UAVs

| UAV | Price $M (reusable) | Altitude | Reveals | Shot-down risk |
|---|---|---|---|---|
| Bayraktar TB2 (scout) | 15 | medium | buildings within 5 km of its path | high |
| TAI Anka | 30 | medium-high | within 10 km | medium |
| RQ-4 Global Hawk | 90 | very high | within 25 km | only long-range SAMs (Siper, S-400, Patriot, David's Sling) |

- You draw the flight path in your turn; revealed buildings stay visible for the rest of the match.
- Until a building is revealed, precise weapons can only aim at the city in general.

## 5. Radar

You start with one free basic radar site. Each track upgrades separately.

| Level | Range (warning) | Identification | Decoy detection | Upgrade $M |
|---|---|---|---|---|
| 0 (start, Kalkan) | 80 km | "unknown" until 20 km | never | – |
| 1 (EL/M-2084) | 130 km | type shown at 50 km | marked at 30 km | 40 per track |
| 2 | 180 km | type shown at 100 km | marked at 70 km | 80 per track |
| 3 (AN/TPY-2) | 250 km | type shown on detection | marked on detection | 140 per track |

- Extra radar site: $50M (backup if one is hit).
- More range = more seconds to react.

## 6. Upgrade menus

**Defensive upgrades** (per battery)

| Upgrade | L2 | L3 |
|---|---|---|
| Hit chance +8 pts and load +25% | 50% of battery price | 100% of battery price |

**Offensive upgrades** (per weapon type, all units of that type)

| Upgrade | Effect per level | Cost L1 / L2 / L3 $M |
|---|---|---|
| Warhead | damage +15% | 40 / 80 / 140 |
| Guidance | precise weapons: miss chance −10 pts; unguided: share landing in the city +10 pts | 40 / 80 / 140 |
| Low observable | enemy hit % −5 pts | 60 / 120 / 200 |
| Extra launch capacity | +50% per turn per launcher | 30 / 60 / 100 |

**Economy**

| Upgrade | L1 | L2 | L3 |
|---|---|---|---|
| Income | +$20M/turn · $100M | +$40M/turn · $180M | +$60M/turn · $280M |
| Underground storage (protected slots; start 10) | 20 · $60M | 35 · $120M | 50 · $200M |
| Logistics (reloads per battle; start 2) | 4 · $50M | 6 · $100M | 9 · $180M |
| Repair crews (repair time; start 3 turns) | 2 turns · $60M | 1 turn · $120M | – |

## 7. Critical buildings

A hit of 20+ damage on a revealed building knocks it out until repaired. Every hit also lowers city health.

| Building | Effect while knocked out | Repair now $M |
|---|---|---|
| Command centre | your next turn 30 s instead of 60 s | 40 |
| Radar site | that radar's coverage lost | 30 |
| Power plant | lasers and Koral off; radar range −30% | 50 |
| Ammunition depot | stock above protected slots is lost (once, when hit) | 40 |
| Missile factory | can't buy new missiles/rockets next turn | 40 |
| Airbase | UAVs can't take off | 30 |
| Financial district / port | income −30% | 50 |

## 8. XP & matchmaking

| Item | Value |
|---|---|
| Starting XP | 1,000 |
| Win | +30 (+10 bonus if your city health > 500) |
| Loss | −20 |
| Concede / disconnect loss | −25 |
| Matching | within ±100 XP; widens by 50 every 15 s of waiting |

## 9. Quick feel check (starting $600M)

- **Defence-heavy:** Patriot $600M = whole budget, nothing else. Too all-in — shows the "can't fix everything" rule.
- **Balanced:** Korkut 40 + Pantsir 110 + Iron Dome 150 + Hisar-O+ 200 + radar range L1 40 = $540M, $60M left for attack launchers.
- **Attack rush:** Shahed launcher 15 + 10 Shaheds 1 + Tomahawk launcher 60 + 4 Tomahawks 8 + Korkut 40 + Stinger 15 = $139M, rest saved for the next turns.
