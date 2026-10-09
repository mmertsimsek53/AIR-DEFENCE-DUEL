import SwiftUI

/// Strike planned in the Attack tab before pressing GO.
struct StrikePlan {
    var counts: [String: Int] = [:]
    var targets: [String: Int] = [:]      // weapon → enemy building uid (precise weapons)
    var scouts: [String: Int] = [:]       // scout id → path index (see scoutPaths); absent = not flying
    var isEmpty: Bool { counts.values.allSatisfy { $0 == 0 } && scouts.isEmpty }
}

let scoutPaths: [(name: String, a: (Double, Double), b: (Double, Double))] = [
    ("North → South", (0, -5), (0, 5)), ("West → East", (-5, 0), (5, 0)),
    ("NW → SE", (-4, -4), (4, 4)), ("NE → SW", (4, -4), (-4, 4)),
]

enum PanelTab: String, CaseIterable { case defence = "Defence", attack = "Attack", upgrades = "Upgrades", city = "City" }

struct GameScreen: View {
    @EnvironmentObject var engine: Engine
    @StateObject private var city = CityScene()
    @State private var choice: CityScene.Shown = .home
    @State private var tab: PanelTab = .defence
    @State private var placing: String?
    @State private var plan = StrikePlan()
    @State private var panelOpen = true
    @State private var confirmConcede = false

    var body: some View {
        let v = engine.view!
        let shown = shownCity(v)
        GeometryReader { geo in
            ZStack {
                CityView(city: city).ignoresSafeArea()
                TagsLayer(view: v, city: city, shown: shown, placing: placing) { pad in
                    if let sys = placing, engine.send(["c": "buyBattery", "sys": sys, "pad": pad]) {
                        engine.say("\(engine.catalogue.defence(sys)?.name ?? sys) deployed.")
                        placing = nil
                    }
                }
                .allowsHitTesting(true)

                VStack(spacing: 0) {
                    TopBar(view: v, onMenu: { confirmConcede = true })
                    Spacer(minLength: 0)
                    BottomBar(view: v, shown: shown, choice: $choice, placing: $placing, onResetCamera: { city.resetCamera() })
                }
                .padding(.horizontal, 10).padding(.vertical, 6)

                if canShop(v) {
                    HStack(spacing: 0) {
                        Spacer()
                        if panelOpen {
                            SidePanel(view: v, tab: $tab, placing: $placing, plan: $plan, choice: $choice, onGo: launch)
                                .frame(width: min(400, geo.size.width * 0.46))
                                .transition(.move(edge: .trailing))
                        }
                    }
                    .padding(.top, 54).padding(.bottom, 6).padding(.trailing, 6)
                    VStack {
                        HStack { Spacer(); Button { withAnimation(.snappy) { panelOpen.toggle() } } label: { Image(systemName: panelOpen ? "sidebar.trailing" : "sidebar.trailing").padding(8).background(Circle().fill(Theme.panel)) } }
                        Spacer()
                    }
                    .padding(.top, 58).padding(.trailing, panelOpen ? min(400, geo.size.width * 0.46) + 12 : 10)
                }

                if v.phase == "battle", let b = v.battle { BattleBar(view: v, battle: b) }
                if v.phase == "turn" && !v.myTurn { WaitingCard(view: v) }
                if v.phase == "report", let r = v.report { ReportCard(view: v, report: r) }
                if v.phase == "over" { GameOverCard(view: v) }
                if let t = engine.toast {
                    VStack { Text(t.text).font(.callout.weight(.semibold)).padding(.horizontal, 14).padding(.vertical, 8).background(Capsule().fill(t.bad ? Theme.danger.opacity(0.92) : Color.black.opacity(0.8))).padding(.top, 60); Spacer() }
                        .transition(.opacity).allowsHitTesting(false)
                }
            }
        }
        .onAppear { engine.onEvents = { [weak city] e in city?.handle(e) } }
        .onChange(of: v.time) { _, _ in
            city.sync(view: v, shown: shown, placing: placing != nil, selectedPad: nil)
            city.syncBattle(v.battle)
        }
        .onChange(of: v.phase) { old, new in
            if new == "turn" && v.myTurn { plan = StrikePlan(); choice = .home }
            if new == "battle" { placing = nil }
            if old == "battle" { city.clearDynamic() }
        }
        .confirmationDialog("Match", isPresented: $confirmConcede) {
            Button("Accept defeat (concede)", role: .destructive) { engine.send(["c": "concede"]) }
            Button("Leave to main menu", role: .destructive) { engine.quit() }
        } message: { Text("Conceding ends the duel as a loss.") }
    }

    private func canShop(_ v: GameView) -> Bool { v.phase == "setup" || (v.phase == "turn" && v.myTurn) }

    private func shownCity(_ v: GameView) -> CityScene.Shown {
        if let b = v.battle, v.phase == "battle" || v.phase == "report" { return b.iDefend ? .home : .enemy }
        return choice
    }

    private func launch() {
        let v = engine.view!
        var strikes: [[String: Any]] = []
        for (w, n) in plan.counts where n > 0 {
            var s: [String: Any] = ["weapon": w, "n": n]
            if let t = plan.targets[w], v.enemy.buildings.contains(where: { $0.uid == t }) { s["target"] = t }
            strikes.append(s)
        }
        var scouts: [[String: Any]] = []
        for (s, i) in plan.scouts {
            let p = scoutPaths[i]
            scouts.append(["scout": s, "path": [["x": p.a.0, "z": p.a.1], ["x": p.b.0, "z": p.b.1]]])
        }
        if engine.send(["c": "go", "strikes": strikes, "scouts": scouts]) { plan = StrikePlan() }
    }
}

// ---------- top bar ----------

struct TopBar: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    let onMenu: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            CityCard(name: view.me.name, health: view.me.health, tint: Theme.friend, extra: "\(money(view.me.budget)) · +\(money(view.me.income))/turn")
            Spacer()
            PhasePill(view: view)
            Spacer()
            HStack(alignment: .top, spacing: 8) {
                CityCard(name: view.enemy.name, health: view.enemy.health, tint: Theme.danger, extra: "\(view.enemy.buildings.count)/7 targets known")
                RadarScope(view: view).frame(width: 92, height: 92)
                Button(action: onMenu) { Image(systemName: "line.3.horizontal").padding(8).background(Circle().fill(Theme.panel)) }
            }
        }
    }
}

struct CityCard: View {
    let name: String, health: Double, tint: Color, extra: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack { Text(name.uppercased()).font(.system(size: 15, weight: .heavy, design: .rounded)).foregroundStyle(tint); Spacer(); Text("\(Int(health))").font(.system(.caption, design: .monospaced).weight(.bold)) }
            ProgressView(value: max(0, health), total: 1000).tint(health > 500 ? Theme.money : health > 250 ? Theme.threat : Theme.danger)
            Text(extra).font(.system(size: 11, design: .monospaced)).foregroundStyle(Theme.money)
        }
        .padding(8).frame(width: 190)
        .background(RoundedRectangle(cornerRadius: 8).fill(Theme.panel))
        .overlay(alignment: .top) { Rectangle().fill(tint).frame(height: 2).clipShape(RoundedRectangle(cornerRadius: 1)) }
    }
}

struct PhasePill: View {
    let view: GameView
    var body: some View {
        let (title, sub) = text
        VStack(spacing: 1) {
            Text(title).font(.system(size: 13, weight: .heavy, design: .rounded)).tracking(1.5)
            HStack(spacing: 6) {
                if view.phase != "battle" && view.phase != "over" { Text("\(view.secondsLeft)s").font(.system(.title3, design: .monospaced).weight(.bold)).foregroundStyle(view.secondsLeft <= 10 ? Theme.danger : .white) }
                if !sub.isEmpty { Text(sub).font(.caption2).foregroundStyle(Theme.dim) }
            }
        }
        .padding(.horizontal, 14).padding(.vertical, 6)
        .background(Capsule().fill(Theme.panel))
    }
    var text: (String, String) {
        switch view.phase {
        case "setup": return ("SETUP", "build your city")
        case "turn": return view.myTurn ? ("YOUR TURN \(view.turnNo)", "attack or save money" + (view.weatherBad ? " · bad weather" : "")) : ("ENEMY TURN", "")
        case "battle": return view.battle?.iDefend == true ? ("INCOMING STRIKE", "defend!") : ("STRIKE IN PROGRESS", "")
        case "report": return ("STRIKE REPORT", "")
        default: return ("MATCH OVER", "")
        }
    }
}

/// Wide-area radar: everything your radar has detected, out to its range.
struct RadarScope: View {
    let view: GameView
    var body: some View {
        Canvas { ctx, size in
            let r = min(size.width, size.height) / 2
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - r, y: c.y - r, width: 2 * r, height: 2 * r)), with: .color(Color(red: 0.02, green: 0.08, blue: 0.08).opacity(0.9)))
            for f in [0.33, 0.66, 1.0] { ctx.stroke(Path(ellipseIn: CGRect(x: c.x - r * f, y: c.y - r * f, width: 2 * r * f, height: 2 * r * f)), with: .color(Theme.friend.opacity(0.3)), lineWidth: 0.7) }
            guard let b = view.battle else { return }
            let range = b.iDefend ? max(20, view.me.radarRange) : 300
            for t in b.threats {
                let d = hypot(t.x, t.z)
                guard d <= range * 1.05 else { continue }
                let p = CGPoint(x: c.x + t.x / range * r, y: c.y + t.z / range * r)
                let col = Color(uiColor: ThreatStyle.color(t.cls == nil ? nil : (t.decoy ? "decoy" : t.looksLike)))
                ctx.fill(Path(ellipseIn: CGRect(x: p.x - 2, y: p.y - 2, width: 4, height: 4)), with: .color(col))
            }
            ctx.fill(Path(ellipseIn: CGRect(x: c.x - 2, y: c.y - 2, width: 4, height: 4)), with: .color(Theme.friend))
        }
        .overlay(alignment: .bottom) {
            Text(view.battle?.iDefend == false ? "300 km" : "\(Int(view.me.radarRange)) km").font(.system(size: 8, design: .monospaced)).foregroundStyle(Theme.dim).offset(y: 10)
        }
    }
}

// ---------- tags over the 3D scene ----------

struct TagsLayer: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    let city: CityScene
    let shown: CityScene.Shown
    let placing: String?
    let onPad: (Int) -> Void

    var body: some View {
        ZStack(alignment: .topLeading) {
            Color.clear.allowsHitTesting(false)
            // Free pads while placing a battery.
            if shown == .home, placing != nil {
                let taken = Set(view.me.batteries.map(\.pad))
                ForEach(view.me.pads.filter { !taken.contains($0.id) }) { p in
                    if let pt = city.screenPoint(x: p.x, y: 0, z: p.z) {
                        Button { onPad(p.id) } label: { Circle().fill(Theme.friend.opacity(0.25)).overlay(Circle().stroke(Theme.friend, lineWidth: 2)).frame(width: 40, height: 40) }
                            .position(pt)
                    }
                }
            }
            // Critical buildings.
            let buildings = shown == .home ? view.me.buildings : view.enemy.buildings
            ForEach(buildings) { b in
                if let pt = city.screenPoint(x: b.x, y: 0.7, z: b.z) {
                    HStack(spacing: 3) {
                        Image(systemName: BuildingStyle.icon(b.kind)).font(.system(size: 9, weight: .bold))
                        Text(b.down > 0 ? "\(b.name) · down \(b.down)" : b.name).font(.system(size: 9, weight: .semibold))
                        if shown == .home, b.revealed == true { Image(systemName: "eye.fill").font(.system(size: 8)).foregroundStyle(Theme.danger) }
                    }
                    .padding(.horizontal, 5).padding(.vertical, 2)
                    .background(Capsule().fill((b.down > 0 ? Theme.danger : Color(uiColor: BuildingStyle.color(b.kind))).opacity(0.85)))
                    .foregroundStyle(.black)
                    .position(pt)
                    .allowsHitTesting(false)
                }
            }
            // Contacts during a strike: tap = priority, long-press = hold fire.
            if let b = view.battle {
                ForEach(b.threats) { t in
                    if let pt = city.screenPoint(x: t.x, y: max(0.06, t.alt * CityScene.yScale), z: t.z) {
                        ThreatTag(t: t, defending: b.iDefend)
                            .position(pt)
                            .onTapGesture { if b.iDefend { engine.send(["c": "priority", "uid": t.uid]) } }
                            .onLongPressGesture { if b.iDefend { engine.send(["c": "holdThreat", "uid": t.uid]) } }
                    }
                }
            }
        }
    }
}

struct ThreatTag: View {
    let t: ThreatView
    let defending: Bool
    var body: some View {
        let col = Color(uiColor: ThreatStyle.color(t.cls == nil ? nil : (t.decoy ? "decoy" : t.looksLike)))
        ZStack {
            RoundedRectangle(cornerRadius: 2).stroke(col, lineWidth: 2).frame(width: 20, height: 20)
            if t.priority { RoundedRectangle(cornerRadius: 3).stroke(.white, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2])).frame(width: 28, height: 28) }
            if t.engaged > 0 { Circle().stroke(Theme.friend, lineWidth: 2).frame(width: 14, height: 14) }
            Text(t.decoy ? "DECOY" : t.hold ? "\(t.name) · HOLD" : t.name)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .padding(.horizontal, 3)
                .background(Color.black.opacity(0.65))
                .foregroundStyle(t.hold ? Theme.dim : .white)
                .fixedSize()
                .offset(x: 0, y: -19)
        }
        .frame(width: 44, height: 44)
        .contentShape(Rectangle())
        .opacity(t.hold ? 0.55 : 1)
    }
}

// ---------- bottom bar ----------

struct BottomBar: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    let shown: CityScene.Shown
    @Binding var choice: CityScene.Shown
    @Binding var placing: String?
    let onResetCamera: () -> Void
    var body: some View {
        HStack(spacing: 8) {
            if view.phase == "setup" || view.phase == "turn" {
                Picker("City", selection: $choice) { Text("My city").tag(CityScene.Shown.home); Text("Enemy city").tag(CityScene.Shown.enemy) }
                    .pickerStyle(.segmented).frame(width: 200)
            }
            Button(action: onResetCamera) { Image(systemName: "camera.metering.center.weighted").padding(7).background(Circle().fill(Theme.panel)) }
            if let p = placing {
                HStack(spacing: 6) {
                    Text("Tap a free pad for \(engine.catalogue.defence(p)?.name ?? p)").font(.caption.weight(.semibold))
                    Button("Cancel") { placing = nil }.font(.caption.weight(.bold))
                }
                .padding(.horizontal, 10).padding(.vertical, 6).background(Capsule().fill(Theme.friend.opacity(0.25)))
            }
            if let l = view.log.last, view.phase != "battle" { Text(l.text).font(.system(size: 11)).foregroundStyle(Theme.dim).lineLimit(1) }
            Spacer()
        }
    }
}

// ---------- battle ----------

struct BattleBar: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    let battle: BattleView
    var body: some View {
        VStack {
            Spacer()
            HStack(alignment: .bottom, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(battle.iDefend ? "DEFEND" : "WATCHING YOUR STRIKE").font(.system(size: 12, weight: .heavy, design: .rounded)).foregroundStyle(battle.iDefend ? Theme.danger : Theme.friend)
                    Text("Contacts \(battle.threats.count) · stopped \(battle.stats.stopped) · hits \(battle.stats.hits) · damage \(Int(battle.stats.damage))")
                        .font(.system(size: 11, design: .monospaced))
                    if battle.iDefend {
                        Text("Tap a contact = priority · long-press = hold fire").font(.system(size: 10)).foregroundStyle(Theme.dim)
                    }
                }
                .padding(8).background(RoundedRectangle(cornerRadius: 8).fill(Theme.panel))
                if battle.iDefend {
                    Toggle(isOn: Binding(get: { view.me.autoFire }, set: { engine.send(["c": "setAutoFire", "on": $0]) })) {
                        Text("Auto-fire").font(.caption.weight(.bold))
                    }
                    .toggleStyle(.button).tint(view.me.autoFire ? Theme.money : Theme.danger)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(view.me.batteries) { b in
                                Button { engine.send(["c": "holdBattery", "uid": b.uid]) } label: {
                                    VStack(spacing: 1) {
                                        Text(b.name).font(.system(size: 10, weight: .bold)).lineLimit(1)
                                        Text(b.load > 0 ? (b.reloading > 0 ? "reloading" : "\(b.ammo)/\(b.load)") : "∞")
                                            .font(.system(size: 10, design: .monospaced))
                                            .foregroundStyle(b.load > 0 && b.ammo == 0 ? Theme.danger : Theme.money)
                                        if b.holdFire { Text("HOLD").font(.system(size: 8, weight: .heavy)).foregroundStyle(Theme.danger) }
                                    }
                                    .frame(width: 74).padding(5)
                                    .background(RoundedRectangle(cornerRadius: 6).fill(Color(uiColor: DefenceStyle.color(b.sys)).opacity(b.holdFire ? 0.1 : 0.22)))
                                }
                                .buttonStyle(.plain)
                            }
                            Text("Reloads \(view.me.reloadsLeft)").font(.system(size: 10, design: .monospaced)).foregroundStyle(Theme.dim)
                        }
                    }
                    .frame(maxWidth: 420)
                }
                Spacer()
            }
            .padding(.horizontal, 10).padding(.bottom, 44)
        }
    }
}

struct WaitingCard: View {
    let view: GameView
    var body: some View {
        VStack {
            Spacer()
            HStack(spacing: 8) {
                ProgressView()
                Text("\(view.enemy.name) is planning a strike… \(view.secondsLeft)s").font(.callout.weight(.semibold))
            }
            .padding(.horizontal, 16).padding(.vertical, 10).background(Capsule().fill(Theme.panel))
            .padding(.bottom, 50)
        }
        .allowsHitTesting(false)
    }
}

struct ReportCard: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    let report: Report
    var body: some View {
        let iAttacked = (view.battle?.iDefend == false)
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea()
            VStack(spacing: 10) {
                Text(iAttacked ? (report.damage > 0 ? "STRIKE LANDED" : "STRIKE STOPPED") : (report.damage > 0 ? "CITY HIT" : "STRIKE REPELLED"))
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .foregroundStyle((iAttacked ? report.damage > 0 : report.damage == 0) ? Theme.money : Theme.danger)
                Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 4) {
                    row("Contacts launched", "\(report.launched)")
                    row("Stopped", "\(report.stopped)")
                    row("Hits", "\(report.hits)")
                    row("City damage", "\(Int(report.damage))")
                    row("Interceptors fired", "\(report.interceptorsUsed) (\(money(report.defenceSpent)))")
                    row("Strike cost", money(report.attackSpent))
                    if !report.knockedOut.isEmpty { row("Knocked out", report.knockedOut.joined(separator: ", ")) }
                }
                .font(.system(size: 13, design: .monospaced))
                Button("Continue") { engine.send(["c": "continue"]) }.buttonStyle(.borderedProminent).tint(Theme.friend).foregroundStyle(.black)
                Text("Next turn in \(view.secondsLeft)s").font(.caption2).foregroundStyle(Theme.dim)
            }
            .padding(.vertical, 24).padding(.horizontal, 24)
            .frame(width: 420)
            .background(RoundedRectangle(cornerRadius: 20).fill(Color(white: 0.13)))
        }
    }
    private func row(_ a: String, _ b: String) -> some View { GridRow { Text(a).foregroundStyle(Theme.dim); Text(b) } }
}

struct GameOverCard: View {
    @EnvironmentObject var engine: Engine
    let view: GameView
    var body: some View {
        ZStack {
            Color.black.opacity(0.5).ignoresSafeArea()
            VStack(spacing: 12) {
                Text(view.iWon ? "VICTORY" : "DEFEAT").font(.system(size: 40, weight: .heavy, design: .rounded)).foregroundStyle(view.iWon ? Theme.money : Theme.danger)
                Text(reason).foregroundStyle(Theme.dim)
                Text("Your city \(Int(view.me.health)) · \(view.enemy.name) \(Int(view.enemy.health))").font(.system(.callout, design: .monospaced))
                HStack {
                    Button("Play again") { engine.newSandbox(name: view.me.name) }.buttonStyle(.borderedProminent).tint(Theme.friend).foregroundStyle(.black)
                    Button("Main menu") { engine.quit() }.buttonStyle(.bordered)
                }
            }
            .padding(.vertical, 24).padding(.horizontal, 24)
            .frame(width: 420)
            .background(RoundedRectangle(cornerRadius: 20).fill(Color(white: 0.13)))
        }
    }
    var reason: String {
        switch view.endReason {
        case "conceded": return view.iWon ? "\(view.enemy.name) accepted defeat." : "You accepted defeat."
        case "destroyed": return view.iWon ? "\(view.enemy.name)'s city is destroyed." : "Your city is destroyed."
        default: return ""
        }
    }
}
