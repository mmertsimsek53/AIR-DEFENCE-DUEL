# Air Defence Duel — Weapons Catalogue

Game-design reference built from public, encyclopedia-level sources (Wikipedia, CSIS Missile Threat, manufacturer pages, defence press). Figures are rounded public numbers, not precise specs. Costs vary a lot by source and contract (export deals bundle training, spares and support), so treat every cost as an order of magnitude. "est." = estimate from press/analysts, not official.

**Legend**
- **Tier**: 1 simplest/cheapest … 5 top end.
- **Speed class**: Slow (<250 km/h, drones) · Subsonic (cruise missiles, jets) · Supersonic (Mach 1–5) · Hypersonic (Mach 5+).
- **Cost**: "/rd" per missile or round, "/sys" per battery or vehicle, "/unit" per drone or missile.
- Range = approximate maximum engagement range (defence) or strike range (offence).

---

## A) Air defence

### Tier 1 — Guns and CIWS (cheap per shot, very short range)

| System | Country | Type | Range km | Good against | Weak against / what beats it | Cost (public, est.) | Game role |
|---|---|---|---|---|---|---|---|
| ZU-23-2 | USSR/Russia | Towed twin 23 mm gun, manual aim | ~2.5 | Slow drones, helicopters, low cheap targets; very cheap ammo | No radar, crew-aimed; useless vs fast missiles; short reach | ~$50k–100k /sys est. (export/surplus) | Cheapest starter defence: tiny chance vs drones only |
| Gepard | Germany | Tracked twin 35 mm radar gun | ~4–5 | Shahed-type drones, low aircraft; proven vs drones in Ukraine | Old, ammo supply limited; short range; no use vs ballistic | ~$1–2m /sys used est.; 35 mm rounds cheap | Strong cheap drone killer, short reach |
| Phalanx / C-RAM | USA | 20 mm radar-guided Gatling (naval/land) | ~1.5–2 | Rockets, artillery, mortars, drones, sea-skimming missiles at last moment | Very short range; eats ammo fast; last-ditch only | ~$10–20m /sys est. | "Last-ditch" point defence: protects one spot vs rockets/drones |
| Korkut | Türkiye (Aselsan) | Tracked twin 35 mm, airburst (ATOM) ammo | ~4 | Drones, helicopters, low cruise missiles; airburst rounds | Short range; no high-altitude reach | ~$5–10m /sys est. | Turkish Gepard equivalent, better ammo |
| Skynex | Germany (Rheinmetall) | Networked 35 mm Revolver guns + radar | ~4 | Drone swarms, cruise missiles at close range; cheap AHEAD rounds | Short range; one site covers one area | ~$100m+ /sys est. (whole battery) | Premium gun network, best gun vs swarms |

### Tier 1–2 — MANPADS (shoulder-fired infrared missiles)

| System | Country | Type | Range km | Good against | Weak against | Cost | Game role |
|---|---|---|---|---|---|---|---|
| Stinger (FIM-92) | USA | Shoulder IR missile | ~5–8 | Helicopters, low UAVs, slow drones | Flares/IR counters; can't reach high-flying UAVs or fast missiles | ~$400k /rd (recent US buys, est.) | Mobile cheap-ish point defence |
| Igla-S / Verba | Russia | Shoulder IR missile (Verba multi-band) | ~6 | Low aircraft, helicopters, drones | Same as Stinger; short range | ~$60–150k /rd est. | Cheaper Stinger alternative |
| Mistral 3 | France (MBDA) | IR missile on tripod/vehicle | ~6–8 | Fast low aircraft, drones, some cruise missiles | Short range; one target per shot | ~$300–400k /rd est. | Slightly better MANPADS, higher cost |

### Tier 2–3 — Directed energy and electronic warfare

| System | Country | Type | Range km | Good against | Weak against | Cost | Game role |
|---|---|---|---|---|---|---|---|
| Iron Beam | Israel (Rafael) | High-energy laser (~100 kW class) | up to ~10 (est.) | Drones, rockets, mortars; near-zero cost per shot (~a few $) | Clouds/dust/rain reduce power; needs seconds of dwell per target; can't stop ballistic missiles | System cost undisclosed (est. tens of $m); per shot ~$2–10 | Cheap per-shot drone/rocket killer, weather-dependent |
| ALKA | Türkiye (Roketsan) | Laser + EM jammer combo | ~0.5–1 laser, few km jamming est. | Small drones (hard kill and soft kill) | Very short range; small drones only | Undisclosed | Anti-mini-drone add-on |
| Koral | Türkiye (Aselsan) | Land-based radar EW / jamming system | ~150+ (jamming/detection est.) | Blinds enemy radars, degrades guided weapons and UAV links | Doesn't destroy anything; less effect on inertial/GPS-independent weapons | Undisclosed | Support card: lowers enemy accuracy or detection |

### Tier 2–3 — Short range air defence (SHORAD)

| System | Country | Type | Range km | Good against | Weak against | Cost | Game role |
|---|---|---|---|---|---|---|---|
| Avenger | USA | Humvee with 8 Stingers + MG | ~5–8 | Helicopters, drones, low aircraft | Short range; no radar of its own (basic) | ~$1–2m /sys est. + Stingers | Mobile Stinger battery |
| Sungur | Türkiye (Roketsan) | Vehicle-mounted IR MANPADS-class missiles | ~8 | Drones, helicopters, low aircraft | Short range; IR countermeasures | Undisclosed (est. similar to Stinger rd) | Turkish Avenger equivalent |
| Hisar-A / A+ | Türkiye (Aselsan/Roketsan) | Low-altitude radar SAM on tracked vehicle | ~15 | Aircraft, UAVs, cruise missiles at low altitude | Not for ballistic; limited magazine | Undisclosed (est. $100m-class battery) | Turkish solid short range layer |
| Tor-M2 | Russia | Tracked, own radar, vertical launch | ~15 | Cruise missiles, guided bombs, drones, aircraft; fast reaction | Limited missiles (8–16); not vs ballistic; can be saturated | ~$25m /sys est. | Strong short range all-rounder vs cruise/drone |
| Pantsir-S1 | Russia | Truck with 30 mm guns + missiles | ~20 missile, 4 gun | Drones, cruise missiles, aircraft; guns + missiles on one vehicle | Repeatedly hit by drones/HIMARS in Syria/Libya/Ukraine; saturation | ~$13–15m /sys est. | Hybrid gun+missile, good value, fragile vs swarms |
| Iron Dome | Israel (Rafael) | Radar-guided Tamir interceptors | ~4–70 | Rockets, artillery, mortars, drones, some cruise missiles; only fires at threats heading for protected areas | Can be saturated by large salvos; not vs ballistic missiles | ~$50m /battery est.; Tamir ~$40–100k /rd est. | Rocket shield; cheap interceptors, overwhelmed by mass |

### Tier 3–4 — Medium range

| System | Country | Type | Range km | Good against | Weak against | Cost | Game role |
|---|---|---|---|---|---|---|---|
| NASAMS | Norway/USA | Ground launch AMRAAM (+AIM-9X/ER) | ~25–40 (ER ~50) | Aircraft, cruise missiles, drones; high success rate in Ukraine | Not designed vs ballistic; AMRAAM costly per shot vs cheap drones | ~$1m /rd (AMRAAM est.); battery ~$100m+ | Reliable medium range vs cruise missiles |
| IRIS-T SLM | Germany (Diehl) | Vertical launch IR missile, 360° | ~40 | Cruise missiles, drones, aircraft; very high reported hit rate | Not vs ballistic; costly vs cheap drones | ~$150m /battery est.; ~$400–500k /rd est. | Top-value medium layer vs cruise |
| Buk-M2/M3 | Russia | Tracked radar SAM | ~45–70 | Aircraft, helicopters, cruise missiles | Limited vs ballistic; older radar vs EW; big signature | ~$40–60m /battery est. | Russian medium all-rounder |
| Hisar-O / O+ | Türkiye | Medium radar SAM | ~25 (O+ more, est.) | Aircraft, UAVs, cruise missiles | Not vs ballistic | Undisclosed | Turkish medium layer |
| David's Sling | Israel/USA | Stunner interceptor (hit-to-kill) | ~40–300 | Heavy rockets, cruise missiles, aircraft, short range ballistic missiles | Costly (~$1m /rd); limited numbers | ~$1m /rd est. | Bridge layer: covers rockets → short ballistic |
| SAMP/T (Aster 30) | France/Italy | Vertical launch, 360° | ~120 (aircraft), ~25–35 vs ballistic | Aircraft, cruise missiles, short range ballistic | Expensive; few batteries exist | ~$2m /rd est.; ~$500m+ /battery est. | European upper-medium/low-end BMD |

### Tier 4–5 — Long range and ballistic missile defence

| System | Country | Type | Range km | Good against | Weak against | Cost | Game role |
|---|---|---|---|---|---|---|---|
| Patriot PAC-2 GEM-T | USA | Long range blast-frag missile | ~160 (aircraft), ~20 vs ballistic | Aircraft, cruise missiles, some ballistic | Expensive; ballistic performance below PAC-3 | ~$3–4m /rd est.; battery ~$1bn+ all-in | Long range area defence |
| Patriot PAC-3 MSE | USA | Hit-to-kill interceptor | ~35–60 vs ballistic est. | Ballistic missiles (Iskander-class), cruise missiles; has intercepted Kinzhal (public Ukrainian/US claims) | Very expensive; small magazine; battery costly | ~$4m /rd (US budget est.) up to $7–8m in export deals | Top ballistic/hypersonic interceptor, few shots |
| S-300PMU-2 | USSR/Russia | Long range SAM | ~150–200 | Aircraft, cruise missiles, some ballistic | Older; vulnerable to SEAD, drones, EW | ~$100–300m /battery est. | Older long-range shield |
| S-400 | Russia | Long range SAM (several missile types) | ~40–400 (missile dependent) | Aircraft, cruise, ballistic (short/medium range) | Batteries hit by ATACMS, drones and cruise missiles in Ukraine; radar horizon limits vs low flyers | ~$500m /battery est. (export deals) | Long range "umbrella" with blind spot low |
| Siper | Türkiye (Aselsan/Roketsan) | Long range SAM (Steel Dome layer) | ~100–150+ | Aircraft, cruise missiles, (later blocks) ballistic | New; limited public data | Undisclosed | Turkish long-range layer |
| HQ-9 / HQ-9B | China | Long range SAM | ~200–250 | Aircraft, cruise missiles, some ballistic | Limited combat record | ~$100m+ /battery est. | Chinese S-300/S-400 equivalent |
| Arrow 2 | Israel/USA | Upper-atmosphere blast-frag interceptor | ~90–150 | Medium range ballistic missiles | Expensive (~$3m /rd est.); ballistic only | ~$3m /rd est. | Ballistic missile shield |
| Arrow 3 | Israel/USA | Exo-atmospheric hit-to-kill | ~2,400 (claimed coverage) | Long range ballistic missiles in space | Very expensive (~$2–3.5m /rd est.); only ballistic | ~$2–3.5m /rd est. | Top ballistic layer, intercepts far out |
| THAAD | USA | Endo/exo high-altitude hit-to-kill | ~150–200 | Short/medium/intermediate range ballistic missiles (terminal phase) | ~$12–13m /rd; ballistic only; huge battery cost | ~$12m /rd; ~$1bn+ /battery | Most expensive ballistic killer |

**Radar (optional unit)**: e.g. AN/TPY-2 (THAAD radar), EL/M-2084 (Iron Dome/David's Sling), Aselsan KALKAN. Game use: a radar card that extends detection range/early warning for all defences. Cost: hundreds of $m (TPY-2 ~ $300m est.).

---

## B) Offensive weapons

### Tier 1 — Loitering munitions / kamikaze drones

| System | Country | Type | Range km | Speed | Strong points | Weaknesses / what beats it | Cost | Game role |
|---|---|---|---|---|---|---|---|---|
| Shahed-136 / Geran-2 | Iran / Russia | Long range one-way attack drone | ~1,500–2,500 | Slow (~185 km/h) | Very cheap, mass salvos, saturate defences | Slow, loud, easy for guns/MANPADS/lasers; small warhead (~40–50 kg) | ~$20–50k /unit est. (CSIS used $35k; leaked contracts higher) | Cheap swarm unit that drains interceptors |
| Lancet-3 | Russia (ZALA) | Tactical loitering munition | ~40–70 | Slow | Precise vs vehicles/radars/launchers | Short range; small warhead; EW and guns | ~$35k /unit est. | Short range "launcher hunter" |
| Switchblade 300/600 | USA (AeroVironment) | Tube-launched loitering munition | ~10 / ~40 | Slow | Precise, portable | Short range, small warhead (300); EW | ~$60k (300) / ~$120k (600) est. | Precision strike on defence units nearby |
| Kargu-2 | Türkiye (STM) | Quadcopter loitering munition | ~10 | Slow | Cheap, swarmable, precise | Very short range; tiny warhead; guns/EW/lasers | Undisclosed (est. tens of $k) | Swarm vs guns/SHORAD |

### Tier 1–2 — Decoys

| System | Country | Type | Range km | Speed | Strong points | Weaknesses | Cost | Game role |
|---|---|---|---|---|---|---|---|---|
| ADM-160 MALD / MALD-J | USA (Raytheon) | Air-launched decoy (J = jammer) | ~900 | Subsonic | Looks like an aircraft/missile on radar; makes defenders waste interceptors; J version jams | No warhead | ~$320–500k /unit est. | Fake missile: absorbs interceptors |
| Gerbera / Parodiya type | Russia | Cheap foam/plywood Shahed-look-alike decoy drones | ~600 est. | Slow | Very cheap, mixed into Shahed waves | No (or tiny) warhead | ~$10k /unit est. | Fake drone: drains cheap defences |

### Tier 2–3 — Armed UAVs (reusable)

| System | Country | Type | Range km | Speed | Strong points | Weaknesses | Cost | Game role |
|---|---|---|---|---|---|---|---|---|
| Bayraktar TB2 | Türkiye (Baykar) | MALE armed drone, small guided bombs | ~150 (radio link), 24+ h endurance | Slow (~130–220 km/h) | Cheap, reusable, strong vs short range systems in 2020 wars | Easy prey for medium/long SAMs and EW once defences are ready | ~$5m /unit est. | Reusable striker; dies to Buk/NASAMS-class |
| Bayraktar Akıncı | Türkiye (Baykar) | Heavy UCAV, carries SOM-J and bombs | ~300+ link (satcom more) | Slow/medium (~360 km/h) | Big payload, can launch stand-off missiles | Large radar target for SAMs | ~$20–30m /unit est. | Heavy drone that launches cruise missiles |
| MQ-9 Reaper | USA (General Atomics) | MALE UCAV, Hellfire/GBU | ~1,800 (satcom) | Slow (~370–480 km/h) | Long endurance, precise | Several shot down by Houthi SAMs; costly to lose | ~$30m /unit est. | Expensive reusable striker |
| Orion (Inokhodets) | Russia (Kronstadt) | MALE UCAV | ~250 link | Slow | Russian TB2/Reaper class | Limited numbers, SAMs | Undisclosed (est. ~$5–10m) | Russian armed UAV option |

### Tier 2–3 — Rockets / guided artillery

| System | Country | Type | Range km | Speed | Strong points | Weaknesses | Cost | Game role |
|---|---|---|---|---|---|---|---|---|
| BM-21 Grad | USSR/Russia | 40-tube 122 mm unguided rockets | ~20–40 | Supersonic, ballistic arc | Very cheap, mass salvo | Unguided, inaccurate, short range; Iron Dome/C-RAM | ~$1–2k /rocket est. | Cheap barrage that saturates Iron Dome |
| HIMARS / GMLRS | USA (Lockheed) | GPS-guided rockets (6 per pod) | ~70–80 (ER ~150) | Supersonic, ballistic arc | Accurate, fast, hard to intercept for short range systems | Interceptable by Iron Dome/Pantsir/Tor-class; GPS jamming affects some | ~$150–170k /rocket est.; launcher ~$5m | Precise rocket, mid-cost |
| TRG-300 Kaplan | Türkiye (Roketsan) | Guided 300 mm rocket | ~20–120 | Supersonic | Accurate, heavier warhead | Interceptable by short-medium systems | Undisclosed (est. $200–500k) | Turkish heavy guided rocket |

### Tier 3–4 — Cruise missiles (subsonic, low flying)

| System | Country | Type | Range km | Speed | Strong points | Weaknesses | Cost | Game role |
|---|---|---|---|---|---|---|---|---|
| Tomahawk Block IV/V | USA | Ship/sub/ground-launched cruise missile | ~1,600 | Subsonic (~880 km/h) | Long range, terrain-hugging, precise, 450 kg warhead | Slow; medium SAMs (NASAMS, IRIS-T, Tor) can down it if they see it | ~$2m /rd (US budget est.) | Long range precise cruise |
| Kalibr (3M-14) | Russia | Ship/sub-launched cruise missile | ~1,500–2,500 | Subsonic | Long range, low-level | Shot down in numbers by Ukrainian NASAMS/IRIS-T/fighters | ~$1–2m /rd est. | Russian Tomahawk |
| Storm Shadow / SCALP | UK/France (MBDA) | Air-launched stealthy cruise missile | ~250–550 | Subsonic | Low observable, penetrating warhead (hits bunkers) | Needs aircraft to launch; subsonic | ~$1–3m /rd est. | Stealthy cruise vs hardened targets |
| Taurus KEPD 350 | Germany/Sweden | Air-launched stealthy cruise missile | ~500 | Subsonic | Low observable, tandem bunker-buster warhead | Same as Storm Shadow | ~$1–1.5m /rd est. | European heavy cruise |
| SOM (A/J) | Türkiye (Roketsan) | Air-launched cruise missile (J for F-35/Akıncı) | ~250–500 | Subsonic | Low-level, precise, Turkish | Interceptable by medium SAMs | Undisclosed (est. ~$1m) | Turkish stand-off cruise |

### Tier 4 — Ballistic missiles

| System | Country | Type | Range km | Speed | Strong points | Weaknesses | Cost | Game role |
|---|---|---|---|---|---|---|---|---|
| Scud-B (R-17) | USSR | Old liquid-fuel SRBM | ~300 | Supersonic (Mach ~5 at end) | Big warhead; still needs ballistic defence | Inaccurate (CEP ~ hundreds of m); slow to prepare; Patriot-class intercepts | ~$1m /rd est. | Cheap old ballistic |
| Fateh-110 / 313 | Iran | Solid-fuel guided SRBM | ~300–500 | Supersonic | Accurate for its class, cheap, mass-produced | PAC-3, David's Sling, Arrow 2 intercept | ~$100–500k /rd est. | Cheap modern ballistic |
| ATACMS | USA | GMLRS-pod SRBM (HIMARS/M270) | ~165–300 | Supersonic (Mach 3+) | Fast, precise, cluster or unitary warhead; hit S-400 sites | PAC-3/S-400-class can intercept; small numbers | ~$1.5m /rd est. | Mid-cost precise ballistic |
| Tayfun | Türkiye (Roketsan) | SRBM | ~280–560+ (Block 4 claimed more) | Supersonic/near-hypersonic end | Fast, accurate, Turkish | Long-range BMD (PAC-3, Arrow) | Undisclosed | Turkish top ballistic |
| Iskander-M (9M723) | Russia | Quasi-ballistic SRBM, manoeuvres, decoys | ~400–500 | Hypersonic in end phase (Mach 6–7 claimed) | Fast, manoeuvring, hard to intercept; carries decoys | PAC-3 MSE and SAMP/T have intercepted many | ~$1.5–3m /rd est. | Hard ballistic, needs top defence |

### Tier 5 — Hypersonic

| System | Country | Type | Range km | Speed | Strong points | Weaknesses | Cost | Game role |
|---|---|---|---|---|---|---|---|---|
| Kh-47M2 Kinzhal | Russia | Air-launched ballistic missile (Iskander-derived) | ~1,000–2,000 incl. aircraft (missile ~500–800 est.) | Hypersonic (Mach 10 claimed peak) | Very fast, short warning time | Several intercepted by Patriot PAC-3 in Ukraine (public claims) | ~$4–10m /rd est. | Top-tier fast strike, beaten only by PAC-3 class |
| 3M22 Zircon | Russia | Ship/ground-launched scramjet cruise missile | ~500–1,000 | Hypersonic (Mach 8 claimed) | Very fast, manoeuvring | Limited public combat data; Ukraine claims some intercepts | ~$5–10m /rd est. | Top-tier anti-ship/strike; near-unstoppable |
| Avangard | Russia | Hypersonic glide vehicle on ICBM | Intercontinental | Hypersonic (Mach 20+ claimed) | Strategic, no current defence | Nuclear strategic weapon — not realistic for city duel | n/a | Reference only: do NOT include (too strategic) |

---

## (1) Counter matrix

Which defence tier can realistically engage each threat. ✔ = good, ~ = possible / partial, ✘ = no.

| Threat ↓ / Defence → | Guns/CIWS (T1) | MANPADS (T1–2) | Laser/EW (T2–3) | Short range (Tor, Pantsir, Iron Dome) | Medium (NASAMS, IRIS-T, Buk) | Long range (S-400, Patriot PAC-2, HQ-9) | BMD (PAC-3, Arrow, THAAD) |
|---|---|---|---|---|---|---|---|
| Kamikaze drone | ✔ | ✔ | ✔ | ✔ | ✔ (costly) | ~ (wasteful) | ✘ |
| Decoy | ~ (wastes ammo) | ~ | ✔ | ~ (wastes missile) | ~ (wastes missile) | ~ (wastes missile) | ✘ |
| Armed UAV | ~ (too high) | ~ | ~ | ✔ | ✔ | ✔ | ✘ |
| Rocket / guided rocket | ~ (C-RAM point only) | ✘ | ~ (Iron Beam) | ✔ (Iron Dome) | ~ | ~ | ~ |
| Cruise missile | ~ (last-ditch) | ~ | ✘ | ✔ | ✔ | ✔ | ~ |
| Ballistic missile | ✘ | ✘ | ✘ | ✘ | ~ (David's Sling, SAMP/T) | ~ (S-400, PAC-2) | ✔ |
| Hypersonic | ✘ | ✘ | ✘ | ✘ | ✘ | ~ | ~ (PAC-3 only, low odds) |

Design takeaways:
- Cheap defences beat cheap threats; expensive defences beat expensive threats; using expensive interceptors on cheap drones loses the money war.
- Decoys and swarms work by draining magazines, not by damage.
- Ballistic and hypersonic need the top tier; low-flying cruise missiles slip under long-range radars and are best caught by short/medium systems.

---

## (2) Suggested v1 shortlist

### Defence (10) — cheap to expensive

| # | System | Tier | Counters | Weakness hook |
|---|---|---|---|---|
| 1 | ZU-23-2 | 1 | Drones (low odds) | Nothing else |
| 2 | Gepard | 1 | Drones, UAVs close in | Short range, ammo |
| 3 | Stinger | 1–2 | Drones, UAVs | Can't touch missiles |
| 4 | Iron Beam | 2–3 | Drones, rockets, decoys (near-free shots) | Weather, slow per target |
| 5 | Pantsir-S1 | 2–3 | Drones, UAVs, cruise | Saturated by swarms |
| 6 | Iron Dome | 3 | Rockets, drones, some cruise | Overwhelmed by salvos; no ballistic |
| 7 | IRIS-T SLM | 3 | Cruise missiles, UAVs | Pricey per drone; no ballistic |
| 8 | David's Sling | 4 | Heavy rockets, cruise, short ballistic | Expensive, few missiles |
| 9 | S-400 | 4–5 | UAVs, cruise, ballistic at range | Low-flying cruise slips under; decoys |
| 10 | Patriot PAC-3 MSE | 5 | Ballistic, hypersonic (low odds) | Very expensive, tiny magazine |

### Offence (8) — cheap to expensive

| # | System | Tier | Beats | Beaten by |
|---|---|---|---|---|
| 1 | Gerbera decoy | 1 | Drains any interceptor | No damage |
| 2 | Shahed-136 | 1 | Saturates expensive SAMs | Guns, Stinger, Iron Beam |
| 3 | BM-21 Grad | 1–2 | Cheap mass vs thin defences | Iron Dome, C-RAM |
| 4 | Bayraktar TB2 | 2–3 | Gun/MANPADS-only cities (reusable) | Pantsir, IRIS-T, S-400 |
| 5 | HIMARS GMLRS | 2–3 | Accurate hit on single defence site | Iron Dome, Pantsir |
| 6 | Tomahawk (or Storm Shadow) | 3–4 | Long-range SAMs (flies low) | IRIS-T, NASAMS, Pantsir |
| 7 | Iskander-M | 4 | Anything below BMD tier | PAC-3, David's Sling |
| 8 | Kinzhal | 5 | Everything except PAC-3 | PAC-3 MSE (low odds) |

Rock-paper-scissors core: **cheap swarm** (Shahed/decoy) beats **expensive SAM**; **guns/laser** beat **swarm**; **cruise missile** beats **long-range SAM** by flying low; **short/medium SAM** beats **cruise**; **ballistic** beats **short/medium SAM**; **BMD** beats **ballistic** but is broke-making vs swarms.

---

## (3) Sources

- Wikipedia: ZU-23-2 https://en.wikipedia.org/wiki/ZU-23-2 · Flakpanzer Gepard https://en.wikipedia.org/wiki/Flakpanzer_Gepard · Phalanx CIWS https://en.wikipedia.org/wiki/Phalanx_CIWS · Korkut https://en.wikipedia.org/wiki/Korkut_(air_defense_system) · Skynex https://en.wikipedia.org/wiki/Skynex
- Wikipedia: FIM-92 Stinger https://en.wikipedia.org/wiki/FIM-92_Stinger · 9K338 Igla-S https://en.wikipedia.org/wiki/9K338_Igla-S · 9K333 Verba https://en.wikipedia.org/wiki/9K333_Verba · Mistral https://en.wikipedia.org/wiki/Mistral_(missile)
- Wikipedia: Iron Beam https://en.wikipedia.org/wiki/Iron_Beam · Koral https://en.wikipedia.org/wiki/Koral_electronic_warfare_system · Roketsan (ALKA) https://www.roketsan.com.tr/en
- Wikipedia: Pantsir https://en.wikipedia.org/wiki/Pantsir_missile_system · Tor https://en.wikipedia.org/wiki/Tor_missile_system · Iron Dome https://en.wikipedia.org/wiki/Iron_Dome · Avenger https://en.wikipedia.org/wiki/AN/TWQ-1_Avenger · Hisar https://en.wikipedia.org/wiki/Hisar_(missile)
- Wikipedia: NASAMS https://en.wikipedia.org/wiki/NASAMS · IRIS-T SLM https://en.wikipedia.org/wiki/IRIS-T_SLM · Buk https://en.wikipedia.org/wiki/Buk_missile_system · David's Sling https://en.wikipedia.org/wiki/David%27s_Sling · SAMP/T https://en.wikipedia.org/wiki/SAMP/T
- Wikipedia: Patriot https://en.wikipedia.org/wiki/MIM-104_Patriot · S-300 https://en.wikipedia.org/wiki/S-300_missile_system · S-400 https://en.wikipedia.org/wiki/S-400_missile_system · Siper https://en.wikipedia.org/wiki/Siper_(missile) · HQ-9 https://en.wikipedia.org/wiki/HQ-9 · Arrow https://en.wikipedia.org/wiki/Arrow_(missile_family) · THAAD https://en.wikipedia.org/wiki/Terminal_High_Altitude_Area_Defense
- CSIS Missile Threat (defence systems and missiles): https://missilethreat.csis.org/
- PAC-3 MSE Selected Acquisition Report (DoD, Dec 2023): https://www.esd.whs.mil/portals/54/documents/foid/reading%20room/selected_acquisition_reports/fy_2023_sars/pac-3_mse_msar_dec_2023.pdf
- Patriot cost overview: https://norskluftvern.com/2024/11/18/what-does-the-patriot-air-and-missile-defense-system-cost/
- Shahed-136 cost: https://www.twz.com/news-features/what-does-a-shahed-136-really-cost
- Russian missile costs (Kalibr, Iskander, Kinzhal): https://militarnyi.com/en/articles/from-kalibr-to-kinzhal-how-much-do-russian-missiles-really-cost/
- Siper test (Janes): https://www.janes.com/defence-news/news-detail/turkey-test-fires-siper-long-range-air-defence-system · The Defense Post: https://www.thedefensepost.com/2021/11/09/turkey-test-fires-air-defense-system/ · Daily Sabah: https://www.dailysabah.com/business/defense/turkey-successfully-test-fires-air-defense-missile-siper-rival-to-s-400/amp
- Turkish air defence overview: https://www.strategypage.com/htmw/htada/articles/20230415.aspx
- Wikipedia: Shahed-136 https://en.wikipedia.org/wiki/HESA_Shahed_136 · ZALA Lancet https://en.wikipedia.org/wiki/ZALA_Lancet · Switchblade https://en.wikipedia.org/wiki/AeroVironment_Switchblade · Kargu https://en.wikipedia.org/wiki/STM_Kargu · ADM-160 MALD https://en.wikipedia.org/wiki/ADM-160_MALD
- Wikipedia: Bayraktar TB2 https://en.wikipedia.org/wiki/Baykar_Bayraktar_TB2 · Akıncı https://en.wikipedia.org/wiki/Baykar_Bayraktar_Ak%C4%B1nc%C4%B1 · MQ-9 https://en.wikipedia.org/wiki/General_Atomics_MQ-9_Reaper · Orion https://en.wikipedia.org/wiki/Kronstadt_Orion
- Wikipedia: BM-21 Grad https://en.wikipedia.org/wiki/BM-21_Grad · HIMARS https://en.wikipedia.org/wiki/M142_HIMARS · GMLRS https://en.wikipedia.org/wiki/Guided_Multiple_Launch_Rocket_System · TRG-300 https://en.wikipedia.org/wiki/TRG-300_Kaplan
- Wikipedia: Tomahawk https://en.wikipedia.org/wiki/Tomahawk_(missile) · Kalibr https://en.wikipedia.org/wiki/3M-54_Kalibr · Storm Shadow https://en.wikipedia.org/wiki/Storm_Shadow · Taurus https://en.wikipedia.org/wiki/Taurus_KEPD_350 · SOM https://en.wikipedia.org/wiki/SOM_(missile)
- Wikipedia: Scud https://en.wikipedia.org/wiki/Scud_missile · Fateh-110 https://en.wikipedia.org/wiki/Fateh-110 · ATACMS https://en.wikipedia.org/wiki/MGM-140_ATACMS · Tayfun https://en.wikipedia.org/wiki/Tayfun_(missile) · Iskander https://en.wikipedia.org/wiki/9K720_Iskander
- Wikipedia: Kinzhal https://en.wikipedia.org/wiki/Kh-47M2_Kinzhal · Zircon https://en.wikipedia.org/wiki/3M22_Zircon · Avangard https://en.wikipedia.org/wiki/Avangard_(hypersonic_glide_vehicle)

Note: Wikipedia URLs are listed as the standard article locations; costs from SEO/aggregator sites were not used. Re-check figures before using them as on-screen "real" numbers.
