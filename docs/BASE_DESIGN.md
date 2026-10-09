# Air Defence Duel — military base design (proposal, 9 Oct 2026)

Status: **decided 9 Oct 2026 (see 'Decisions' at the end); building in steps.** Based on how Clash of Clans works (general knowledge of the game), translated to an air-defence / strike setting.

---

## 1. What Clash of Clans does, and what we take from it

| Clash of Clans | How it works there | Our version |
|---|---|---|
| **Town Hall** | Its level gates everything: which buildings exist, how many, their max level | **Headquarters (HQ)** level 1–10 gates every building, count and level |
| **Builders** | Each builder works on one construction or upgrade at a time; upgrades take real time (minutes → days); more builders = more in parallel | **Construction teams**: one team per Builder Yard; each builds/upgrades one structure at a time with a timer |
| **Two resources** (gold, elixir) | Gold → buildings/defences; elixir → troops/research. Mines and collectors produce per hour; storages cap how much you hold | **Funds ($)** → construction & upgrades. **Supplies** → producing weapons, ammunition, research. Produced by buildings per hour; capped by vaults/depots |
| **Raiding** | Attacking steals part of the other base's stored loot | Strikes steal part of the rival's unprotected Funds/Supplies |
| **Barracks + Army Camps** | Barracks train troops; camps set how many you can bring | **Factories** produce weapons; **Launch sites / hangars** set how many you can hold and fire |
| **Laboratory** | Research upgrades troops and spells | **R&D Centre** researches better weapons and defences |
| **Defences** | Cannons, archer towers, air defences… each upgradable, with range and target types | Our 17 real air-defence systems, each a building on the base |
| **Walls** | Slow attackers, shape their path | **Hardened shelters / revetments**: halve damage to what they protect (air threats fly over walls) |
| **Traps** | Hidden until triggered | **Hidden defences**: pop-up MANPADS teams, decoy buildings, camouflage — invisible until they fire or a scout finds them |
| **Clan Castle** | Friends' troops defend you | **Allied battery** (later, with alliances) |
| **Attacks & stars** | Deploy troops at the edge; 1★ 50% destroyed, 1★ Town Hall down, 1★ 100% | Launch weapons one by one (as now); ★ for 50% damage, ★ for HQ knocked out, ★ for 100% |
| **Shield** | After being raided you get hours of protection | Air-defence alert: after a heavy strike your base can't be attacked for some hours |
| **Trophies / leagues** | Win/lose trophies; matchmaking by trophies | Our **XP** decides who you're matched with |
| **Layout editor** | You design your base; layout is the skill | Same: drag buildings anywhere on your base; layout decides what your defences cover |
| **Gems** | Premium currency to finish timers instantly | Optional later (monetisation) |

---

## 2. Buildings

Base = a flat military compound (no city). Grid-based plot, grows with HQ level. Footprints in tiles.

### Core
| Building | Does | Footprint | Unlock (HQ) | Max |
|---|---|---|---|---|
| Headquarters | Gates everything. Knocked out → your next turn is shorter, no new orders | 4×4 | 1 | 1 |
| Builder Yard | Houses one construction team | 2×2 | 1 | 5 |
| Radar Station | Detection range, identification, decoy detection (our radar levels) | 3×3 | 1 | 3 |
| Power Plant | Powers radar, lasers, EW. Down → those switch off | 3×3 | 2 | 2 |
| Command Bunker (hardened) | Protects the HQ crew; HQ damage −50% | 2×2 | 4 | 1 |

### Economy
| Building | Does | Unlock | Max |
|---|---|---|---|
| Finance Office | Produces Funds per hour | 1 | 6 |
| Funds Vault | Stores Funds (part protected from raids) | 1 | 4 |
| Supply Depot | Produces Supplies per hour | 1 | 6 |
| Supply Warehouse | Stores Supplies | 1 | 4 |
| Ammunition Bunker | Protected storage for built weapons and interceptors (our underground storage) | 2 | 3 |

### Production (attack)
| Building | Produces | Unlock | Max |
|---|---|---|---|
| Drone Workshop | Shahed, Kargu, Gerbera decoys | 1 | 3 |
| Rocket Artillery Park | Grad, TRG-300, HIMARS (launch vehicles parked here) | 2 | 3 |
| Cruise Missile Site | SOM, Tomahawk | 4 | 2 |
| Missile Silo | Tayfun, Iskander, Kinzhal | 6 | 2 |
| Airfield + Hangars | TB2, Akıncı, Anka, Global Hawk (armed and scout UAVs) | 2 | 2 |
| Missile Factory | Interceptors for your SAMs | 1 | 2 |

### Defence (our 17 systems)
| Group | Systems | Unlock |
|---|---|---|
| Guns | ZU-23-2, Gepard, Korkut | HQ1–3 |
| MANPADS posts | Stinger, Sungur (can be **hidden**, pop up when firing) | HQ1–2 |
| Lasers & EW | ALKA, Iron Beam, Koral (need power) | HQ3–5 |
| Short range | Pantsir-S1, Hisar-A+, Iron Dome | HQ3–5 |
| Medium | IRIS-T SLM, Hisar-O+, David's Sling | HQ5–7 |
| Long range / ballistic | Siper, S-400, Patriot PAC-3 | HQ7–9 |

### Protection
| Building | Does | Unlock |
|---|---|---|
| Revetment / blast wall | Placed around a building: that building takes −50% damage | 2 |
| Hardened shelter | Protects parked UAVs and launchers from strikes | 3 |
| Camouflage net | The covered building is invisible to scouts until hit | 3 |
| Decoy building | Looks like an HQ/factory to scouts; wastes enemy missiles | 4 |
| Repair Workshop | Engineers repair damaged buildings faster | 2 |

### Research & people
| Building | Does | Unlock |
|---|---|---|
| R&D Centre | Research: warhead, guidance, stealth, interceptor accuracy, radar | 3 |
| Training Academy | Trains crews (see §3); crew level = skill | 2 |
| Barracks | Houses people; capacity limits your crew | 1 |

---

## 3. People (crews)

Clash of Clans only has builders. We add crews so buildings need people to run, and training them matters.

| People | Needed for | Effect of more / better-trained crew |
|---|---|---|
| **Construction team** | Building and upgrading (one job each) | More teams = more jobs at once |
| **Engineers** | Repairs after a strike | Faster repairs; can repair during your turn |
| **Radar operators** | Each radar station | Trained operators identify threats and decoys earlier |
| **Air-defence crews** | Each battery | Trained crews: +hit chance, faster reaction |
| **Drone operators** | Flying drones and UAVs | Number of drones/UAVs you can have in the air at once |
| **Missile launch crews** | Firing rockets/cruise/ballistic | Launches per turn per site |
| **Intelligence analysts** | Scout missions | Bigger reveal radius, see hidden defences |
| **Logistics troops** | Moving ammunition during a battle | Reloads per battle (replaces the Logistics upgrade) |

Each person has a salary (Funds per day) and needs a bed in the Barracks. Training at the Academy takes time and Supplies.

---

## 4. HQ levels (first draft)

| HQ | Base size | Builder Yards | New buildings | Max defence tier |
|---|---|---|---|---|
| 1 | 20×20 | 1 | Finance, Supply, Radar L1, Drone Workshop, Missile Factory, guns, MANPADS | Guns, MANPADS |
| 2 | 22×22 | 2 | Power, Airfield, Rocket Park, Academy, Revetments, Repair Workshop | + Korkut |
| 3 | 24×24 | 2 | R&D, Shelters, Camouflage, lasers | + Pantsir, Hisar-A+ |
| 4 | 26×26 | 3 | Cruise Site, Decoys, Command Bunker | + Iron Dome, Koral |
| 5 | 28×28 | 3 | | + IRIS-T, Hisar-O+ |
| 6 | 30×30 | 4 | Missile Silo (Tayfun) | |
| 7 | 32×32 | 4 | | + David's Sling, Siper |
| 8 | 34×34 | 5 | Silo: Iskander | + S-400 |
| 9 | 36×36 | 5 | | + Patriot |
| 10 | 38×38 | 5 | Silo: Kinzhal | all at max |

---

## 5. How a battle works on a base

- **Attacker**: picks a rival (matched by XP), sees their base (hidden buildings and camouflage stay hidden until scouted), launches weapons one by one, as now: tap where each starts, tap where it should hit.
- **Defender**: their base defends itself automatically with their layout, crews and stock. If the defender is online, they can take over live (priority / hold fire), as now.
- **Result**: stars (★ 50% damage, ★ HQ knocked out, ★ 100%), loot (part of unprotected Funds/Supplies), XP up/down, defender gets a shield for some hours.
- Destroyed buildings are not lost: they are repaired automatically after the battle (as in Clash of Clans); only stock, loot and used weapons are lost.

---

## 6. Decisions needed (Mert)

1. **Persistent base vs per-duel base.** Clash style means your base is kept and grows over days/weeks (timers in real time). Does the base replace the city **permanently** (persistent progression), or does each duel still start from zero?
2. **Attacks: offline or live?** Clash style: you attack bases whose owners are offline and the base defends itself. Keep live duels too (both online), or offline raids only?
3. **Timers.** Real-time build timers (e.g. minutes at HQ1, hours later)? Speed-ups with a premium currency later?
4. **Resources.** One currency ($) or two (Funds + Supplies)?
5. **People.** Is the crew list (§3) right? Anything to add or remove?

Note: a persistent base with offline raids needs the server (accounts, saved bases, timers, matchmaking) before it can be played online. The sandbox can run on the phone first.

---

## Decisions (Mert, 9 Oct 2026)

1. **Base stays.** It grows over time; every duel is fought on your current base. Matchmaking by base level (HQ) and XP.
2. **Resources: Gold, Petrol, Explosives, Uranium.** Gold = money (construction, upgrades, salaries). Petrol = fuel for every launch and sortie. Explosives = warhead filling for every strike weapon and interceptor (real conventional warheads use high explosives such as RDX/TNT). Uranium = heavy/penetrator warheads for top-tier weapons and upgrades.
3. **No walls / revetments** (air war). Camouflage, decoys and shelters stay.
4. **Defence placement by range** is the core of base design: each category covers its own radius, so short-range systems guard buildings, long-range ones cover the whole base.
5. **Attackers investigate first** (scout UAVs reveal buildings and defences), then attack.
6. Build order: Step 1 base rules + building visuals + editor · Step 2 battles on bases (scout → live attack, stars, loot) · Step 3 crews.
