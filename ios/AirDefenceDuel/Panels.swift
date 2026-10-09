import SwiftUI

struct SidePanel: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    @Binding var tab: PanelTab
    @Binding var placing: String?
    @Binding var plan: StrikePlan
    @Binding var choice: CityScene.Shown
    let onGo: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Picker("", selection: $tab) { ForEach(PanelTab.allCases, id: \.self) { Text($0.rawValue).tag($0) } }
                .pickerStyle(.segmented).padding(8)
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    switch tab {
                    case .defence: DefenceTab(view: view, placing: $placing)
                    case .attack: AttackTab(view: view, plan: $plan, choice: $choice)
                    case .upgrades: UpgradesTab(view: view)
                    case .city: CityTab(view: view)
                    }
                }
                .padding(.horizontal, 10).padding(.bottom, 10)
            }
            footer
        }
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.panel))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.line))
    }

    @ViewBuilder var footer: some View {
        HStack(spacing: 8) {
            Text(money(view.me.budget)).font(.system(.title3, design: .monospaced).weight(.bold)).foregroundStyle(Theme.money)
            Spacer()
            if view.phase == "setup" {
                Button(view.me.ready ? "Waiting for rival…" : "Ready") { engine.send(["c": "endSetup"]) }
                    .buttonStyle(.borderedProminent).tint(Theme.friend).foregroundStyle(.black).disabled(view.me.ready)
            } else {
                Button("Wait · save money") { engine.send(["c": "wait"]) }.buttonStyle(.bordered)
                Button { onGo() } label: { Text("GO").font(.headline.weight(.heavy)).frame(width: 54) }
                    .buttonStyle(.borderedProminent).tint(Theme.danger).disabled(plan.isEmpty)
            }
        }
        .padding(8)
        .background(Theme.panel2.clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 12, bottomTrailingRadius: 12)))
    }
}

// ---------- shared bits ----------

struct Card<Content: View>: View {
    var tint: Color = Theme.friend
    @ViewBuilder let content: Content
    var body: some View {
        VStack(alignment: .leading, spacing: 5) { content }
            .padding(8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.04)))
            .overlay(alignment: .leading) { Rectangle().fill(tint).frame(width: 3).clipShape(RoundedRectangle(cornerRadius: 2)) }
    }
}

struct SmallButton: View {
    let title: String
    var enabled = true
    var tint: Color = Theme.friend
    let action: () -> Void
    var body: some View {
        Button(action: action) { Text(title).font(.system(size: 11, weight: .bold)).padding(.horizontal, 8).padding(.vertical, 4) }
            .buttonStyle(.plain)
            .background(RoundedRectangle(cornerRadius: 5).fill(tint.opacity(enabled ? 0.28 : 0.08)))
            .foregroundStyle(enabled ? .white : Theme.dim)
            .disabled(!enabled)
    }
}

struct SectionTitle: View {
    let text: String
    var body: some View { Text(text.uppercased()).font(.system(size: 11, weight: .heavy, design: .rounded)).tracking(1.2).foregroundStyle(Theme.dim).padding(.top, 4) }
}

struct HitChips: View {
    let hit: [String: Double]
    var body: some View {
        HStack(spacing: 3) {
            ForEach(threatOrder.filter { (hit[$0] ?? 0) > 0 }, id: \.self) { k in
                Text("\(threatLabel[k] ?? k) \(Int(hit[k] ?? 0))%").font(.system(size: 9, weight: .semibold, design: .monospaced))
                    .padding(.horizontal, 4).padding(.vertical, 1)
                    .background(Capsule().fill(Color(uiColor: ThreatStyle.color(k)).opacity(0.25)))
            }
        }
    }
}

// ---------- Defence ----------

struct DefenceTab: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    @Binding var placing: String?
    var body: some View {
        let cat = engine.catalogue
        if !view.me.batteries.isEmpty {
            SectionTitle(text: "Your batteries")
            ForEach(view.me.batteries) { b in
                let s = cat.defence(b.sys)!
                Card(tint: Color(uiColor: DefenceStyle.color(b.sys))) {
                    HStack {
                        Text("\(b.name) · L\(b.level)").font(.system(size: 13, weight: .bold))
                        Spacer()
                        if s.load > 0 { Text("\(b.ammo)/\(b.load) loaded · \(view.me.interceptors[b.sys] ?? 0) in depot").font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.dim) }
                    }
                    HStack(spacing: 6) {
                        if s.load > 0 {
                            SmallButton(title: "+1 reload \(money(s.shot * Double(s.load)))", enabled: view.me.budget >= s.shot * Double(s.load)) {
                                engine.send(["c": "buyInterceptors", "sys": b.sys, "n": s.load])
                            }
                        }
                        if let up = b.upgradeCost { SmallButton(title: "Upgrade \(money(up))", enabled: view.me.budget >= up) { engine.send(["c": "upgradeBattery", "uid": b.uid]) } }
                        SmallButton(title: "Sell +\(money(s.price / 2))", tint: Theme.danger) { engine.send(["c": "sellBattery", "uid": b.uid]) }
                    }
                }
            }
        }
        SectionTitle(text: "Buy a system (then tap a pad)")
        ForEach(cat.defences) { s in
            Button { placing = s.id } label: {
                Card(tint: Color(uiColor: DefenceStyle.color(s.id))) {
                    HStack {
                        Text(s.name).font(.system(size: 13, weight: .bold))
                        Spacer()
                        Text(money(s.price)).font(.system(size: 13, weight: .bold, design: .monospaced)).foregroundStyle(view.me.budget >= s.price ? Theme.money : Theme.danger)
                    }
                    Text(s.role).font(.system(size: 11)).foregroundStyle(Theme.dim).multilineTextAlignment(.leading)
                    HitChips(hit: s.hit)
                    Text("Range \(Int(s.range)) km · " + (s.load > 0 ? "\(s.load) missiles, \(money(s.shot)) each" : s.kind == "gun" ? "\(money(s.shot)) per burst" : "no ammunition") + (s.needsPower == true ? " · needs power" : ""))
                        .font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.dim)
                }
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(placing == s.id ? Theme.friend : .clear, lineWidth: 2))
            }
            .buttonStyle(.plain)
            .disabled(view.me.budget < s.price)
            .opacity(view.me.budget < s.price ? 0.5 : 1)
        }
    }
}

// ---------- Attack ----------

struct AttackTab: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    @Binding var plan: StrikePlan
    @Binding var choice: CityScene.Shown
    var body: some View {
        let cat = engine.catalogue
        let isTurn = view.phase == "turn"
        if isTurn {
            SectionTitle(text: "Plan this turn's strike")
            if view.enemy.buildings.isEmpty {
                Text("No enemy buildings revealed yet. Send a surveillance UAV, or strike the city in general.").font(.system(size: 11)).foregroundStyle(Theme.threat)
            }
        }
        ForEach(cat.attacks) { w in
            let launchers = view.me.launchers[w.id] ?? 0
            let stock = view.me.stock[w.id] ?? 0
            let cap = view.me.caps[w.id] ?? 0
            let reusable = w.reusable == true
            if launchers > 0 || stock > 0 || !isTurn {
                Card(tint: Color(uiColor: ThreatStyle.color(w.cls))) {
                    HStack {
                        Text(w.name).font(.system(size: 13, weight: .bold))
                        Spacer()
                        Text(reusable ? "\(money(w.unit)) airframe" : "\(money(w.unit)) each").font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.money)
                    }
                    Text(w.role).font(.system(size: 11)).foregroundStyle(Theme.dim)
                    Text(reusable ? "In hangar \(stock)" : "Launchers \(launchers) · in stock \(stock) · can fire \(cap)/turn · damage \(Int(w.damage))\(w.salvo != nil ? "×\(w.salvo!)" : "")")
                        .font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.dim)
                    HStack(spacing: 6) {
                        if !reusable { SmallButton(title: "Launcher \(money(w.launcher))", enabled: view.me.budget >= w.launcher) { engine.send(["c": "buyLauncher", "weapon": w.id]) } }
                        if reusable || launchers > 0 {
                            let n = reusable ? 1 : max(1, cap - stock)
                            SmallButton(title: "Buy \(n) · \(money(w.unit * Double(n)))", enabled: view.me.budget >= w.unit * Double(n)) { engine.send(["c": "buyUnits", "weapon": w.id, "n": n]) }
                        }
                    }
                    if isTurn && stock > 0 && (reusable || cap > 0) {
                        let maxN = min(stock, reusable ? stock : cap)
                        HStack(spacing: 8) {
                            Stepper("Launch \(plan.counts[w.id] ?? 0)", value: Binding(get: { plan.counts[w.id] ?? 0 }, set: { plan.counts[w.id] = $0 }), in: 0...maxN)
                                .font(.system(size: 12, weight: .bold))
                            if w.precise {
                                Menu {
                                    Button("City (general)") { plan.targets[w.id] = nil }
                                    ForEach(view.enemy.buildings) { b in Button(b.name + (b.down > 0 ? " (down)" : "")) { plan.targets[w.id] = b.uid } }
                                } label: {
                                    Text(view.enemy.buildings.first { $0.uid == plan.targets[w.id] }?.name ?? "Target: city").font(.system(size: 11, weight: .bold)).lineLimit(1)
                                }
                            }
                        }
                    }
                }
            }
        }
        SectionTitle(text: "Surveillance UAVs")
        ForEach(cat.scouts) { s in
            let have = view.me.scouts[s.id] ?? 0
            Card(tint: Color(uiColor: ThreatStyle.color("uav"))) {
                HStack {
                    Text(s.name).font(.system(size: 13, weight: .bold))
                    Spacer()
                    Text(money(s.price)).font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.money)
                }
                Text(s.role + " Sees \(s.reveal.formatted()) km either side.").font(.system(size: 11)).foregroundStyle(Theme.dim)
                HStack(spacing: 6) {
                    Text("Available \(have)").font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.dim)
                    SmallButton(title: "Buy \(money(s.price))", enabled: view.me.budget >= s.price) { engine.send(["c": "buyScout", "scout": s.id]) }
                    if isTurn && have > 0 {
                        Menu {
                            Button("Don't fly") { plan.scouts[s.id] = nil }
                            ForEach(scoutPaths.indices, id: \.self) { i in Button(scoutPaths[i].name) { plan.scouts[s.id] = i } }
                        } label: { Text(plan.scouts[s.id].map { "Fly " + scoutPaths[$0].name } ?? "Fly: no").font(.system(size: 11, weight: .bold)) }
                    }
                }
            }
        }
        if !isTurn { Text("During setup you can buy launchers, weapons and UAVs. You plan and launch strikes on your turn.").font(.system(size: 11)).foregroundStyle(Theme.dim) }
        else { Button("Look at the enemy city") { choice = .enemy }.font(.system(size: 12, weight: .bold)) }
    }
}

// ---------- Upgrades ----------

struct UpgradesTab: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    @State private var section = 0
    var body: some View {
        let cat = engine.catalogue
        Picker("", selection: $section) { Text("Defensive").tag(0); Text("Offensive").tag(1); Text("Economy").tag(2) }.pickerStyle(.segmented)
        switch section {
        case 0:
            SectionTitle(text: "Radar")
            radarRow("Range", key: "range", level: view.me.radar.range, value: { "\(Int(cat.radar.range[$0])) km" })
            radarRow("Identification", key: "identify", level: view.me.radar.identify, value: { cat.radar.identify[$0] > 999 ? "on detection" : "type at \(Int(cat.radar.identify[$0])) km" })
            radarRow("Decoy detection", key: "decoy", level: view.me.radar.decoy, value: { cat.radar.decoy[$0] == 0 ? "never" : cat.radar.decoy[$0] > 999 ? "on detection" : "at \(Int(cat.radar.decoy[$0])) km" })
            Card {
                HStack { Text("Extra radar site").font(.system(size: 13, weight: .bold)); Spacer(); SmallButton(title: "Build \(money(cat.extraRadar))", enabled: view.me.budget >= cat.extraRadar) { engine.send(["c": "buyRadarSite"]) } }
                Text("Backup if a radar site is knocked out.").font(.system(size: 11)).foregroundStyle(Theme.dim)
            }
            SectionTitle(text: "Batteries")
            if view.me.batteries.isEmpty { Text("Buy defence systems in the Defence tab first.").font(.system(size: 11)).foregroundStyle(Theme.dim) }
            ForEach(view.me.batteries) { b in
                Card(tint: Color(uiColor: DefenceStyle.color(b.sys))) {
                    HStack {
                        Text("\(b.name) · L\(b.level)").font(.system(size: 13, weight: .bold)); Spacer()
                        if let up = b.upgradeCost { SmallButton(title: "L\(b.level + 1) · \(money(up))", enabled: view.me.budget >= up) { engine.send(["c": "upgradeBattery", "uid": b.uid]) } }
                        else { Text("Max").font(.caption).foregroundStyle(Theme.dim) }
                    }
                    Text("Each level: hit chance +8 pts, load +25%").font(.system(size: 10)).foregroundStyle(Theme.dim)
                }
            }
        case 1:
            let owned = cat.attacks.filter { (view.me.launchers[$0.id] ?? 0) > 0 || (view.me.stock[$0.id] ?? 0) > 0 }
            if owned.isEmpty { Text("Buy a launcher or UAV in the Attack tab first.").font(.system(size: 11)).foregroundStyle(Theme.dim) }
            ForEach(owned) { w in
                Card(tint: Color(uiColor: ThreatStyle.color(w.cls))) {
                    Text(w.name).font(.system(size: 13, weight: .bold))
                    ForEach(["warhead", "guidance", "stealth", "capacity"], id: \.self) { k in
                        if let tr = cat.offUpgrades[k], !(k == "capacity" && w.reusable == true) {
                            let lv = view.me.offUp[w.id]?[k] ?? 0
                            HStack {
                                VStack(alignment: .leading, spacing: 0) {
                                    Text("\(tr.label) · L\(lv)").font(.system(size: 12, weight: .semibold))
                                    Text(tr.effect).font(.system(size: 10)).foregroundStyle(Theme.dim)
                                }
                                Spacer()
                                if lv < 3 { SmallButton(title: money(tr.cost[lv]), enabled: view.me.budget >= tr.cost[lv]) { engine.send(["c": "upgradeOffence", "weapon": w.id, "track": k]) } }
                                else { Text("Max").font(.caption).foregroundStyle(Theme.dim) }
                            }
                        }
                    }
                }
            }
        default:
            econRow("income", unit: { "+\(money($0))/turn" })
            econRow("storage", unit: { "\(Int($0)) protected slots" }, note: "Stored now: \(view.me.storage.used) (\(view.me.storage.safe) protected)")
            econRow("logistics", unit: { "\(Int($0)) reloads per strike" })
            econRow("repair", unit: { "\(Int($0)) turns to repair" })
        }
    }

    private func radarRow(_ title: String, key: String, level: Int, value: (Int) -> String) -> some View {
        let cat = engine.catalogue
        return Card {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(title) · L\(level) \(cat.radar.names[level])").font(.system(size: 12, weight: .bold))
                    Text("Now: \(value(level))" + (level < 3 ? " → \(value(level + 1))" : "")).font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.dim)
                }
                Spacer()
                if level < 3 { SmallButton(title: money(cat.radar.cost[level + 1]), enabled: view.me.budget >= cat.radar.cost[level + 1]) { engine.send(["c": "upgradeRadar", "track": key]) } }
                else { Text("Max").font(.caption).foregroundStyle(Theme.dim) }
            }
        }
    }

    private func econRow(_ key: String, unit: (Double) -> String, note: String? = nil) -> some View {
        let tr = engine.catalogue.economy[key]!
        let lv = view.me.econ[key] ?? 0
        return Card(tint: Theme.money) {
            HStack {
                VStack(alignment: .leading, spacing: 1) {
                    Text("\(tr.label) · L\(lv)").font(.system(size: 12, weight: .bold))
                    Text("Now: \(unit(tr.values[lv]))" + (lv < tr.cost.count ? " → \(unit(tr.values[lv + 1]))" : "")).font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.dim)
                    if let note { Text(note).font(.system(size: 10)).foregroundStyle(Theme.dim) }
                }
                Spacer()
                if lv < tr.cost.count { SmallButton(title: money(tr.cost[lv]), enabled: view.me.budget >= tr.cost[lv]) { engine.send(["c": "upgradeEconomy", "track": key]) } }
                else { Text("Max").font(.caption).foregroundStyle(Theme.dim) }
            }
        }
    }
}

// ---------- City ----------

struct CityTab: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    var body: some View {
        SectionTitle(text: "Critical buildings")
        Text("Hidden from the enemy until a UAV flies over or they are hit. An eye means the enemy has found it.").font(.system(size: 11)).foregroundStyle(Theme.dim)
        ForEach(view.me.buildings) { b in
            let spec = engine.catalogue.buildings.first { $0.kind == b.kind }
            Card(tint: Color(uiColor: BuildingStyle.color(b.kind))) {
                HStack {
                    Image(systemName: BuildingStyle.icon(b.kind))
                    Text(b.name).font(.system(size: 13, weight: .bold))
                    if b.revealed == true { Image(systemName: "eye.fill").foregroundStyle(Theme.danger).font(.caption) }
                    Spacer()
                    if b.down > 0 {
                        Text("Down \(b.down) turn\(b.down == 1 ? "" : "s")").font(.caption.weight(.bold)).foregroundStyle(Theme.danger)
                        if let spec { SmallButton(title: "Repair \(money(spec.repairNow))", enabled: view.me.budget >= spec.repairNow) { engine.send(["c": "repairNow", "uid": b.uid]) } }
                    } else { Text("Working").font(.caption).foregroundStyle(Theme.money) }
                }
                if let spec { Text("If hit: \(spec.effect)").font(.system(size: 10)).foregroundStyle(Theme.dim) }
            }
        }
    }
}
