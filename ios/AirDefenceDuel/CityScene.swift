import SceneKit
import SwiftUI
import UIKit

/// The 3D city. 1 scene unit = 1 km. North is −z (threats arrive from there). Heights are shown at 1/4 scale
/// so ballistic arcs stay on screen.
@MainActor
final class CityScene: NSObject, ObservableObject {
    enum Shown: Equatable { case home, enemy }

    let scene = SCNScene()
    weak var scnView: SCNView?
    let cameraNode = SCNNode()
    private let world = SCNNode()        // rebuilt when the shown city changes
    private let dynamic = SCNNode()      // threats, interceptors, effects
    private var shownKey = ""
    private var padNodes: [Int: SCNNode] = [:]
    private var batteryNodes: [Int: SCNNode] = [:]
    private var buildingNodes: [Int: SCNNode] = [:]
    private var threatNodes: [Int: SCNNode] = [:]
    private var interceptorNodes: [Int: SCNNode] = [:]
    private var rangeNodes: [Int: SCNNode] = [:]
    private(set) var shown: Shown = .home
    static let yScale = 0.25

    override init() {
        super.init()
        scene.background.contents = UIColor(red: 0.66, green: 0.77, blue: 0.86, alpha: 1)
        scene.fogStartDistance = 25
        scene.fogEndDistance = 70
        scene.fogColor = UIColor(red: 0.66, green: 0.77, blue: 0.86, alpha: 1)

        let cam = SCNCamera()
        cam.fieldOfView = 50
        cam.zNear = 0.05
        cam.zFar = 400
        cameraNode.camera = cam
        scene.rootNode.addChildNode(cameraNode)
        resetCamera()

        let sun = SCNNode()
        sun.light = SCNLight()
        sun.light!.type = .directional
        sun.light!.intensity = 1100
        sun.light!.castsShadow = true
        sun.light!.shadowMode = .deferred
        sun.light!.shadowColor = UIColor(white: 0, alpha: 0.35)
        sun.eulerAngles = SCNVector3(-0.9, 0.6, 0)
        scene.rootNode.addChildNode(sun)
        let amb = SCNNode()
        amb.light = SCNLight()
        amb.light!.type = .ambient
        amb.light!.intensity = 450
        scene.rootNode.addChildNode(amb)

        let ground = SCNNode(geometry: SCNPlane(width: 400, height: 400))
        ground.geometry!.firstMaterial!.diffuse.contents = UIColor(red: 0.55, green: 0.62, blue: 0.48, alpha: 1)
        ground.eulerAngles.x = -.pi / 2
        scene.rootNode.addChildNode(ground)

        scene.rootNode.addChildNode(world)
        scene.rootNode.addChildNode(dynamic)
    }

    func resetCamera() {
        cameraNode.position = SCNVector3(0, 7.5, 11)
        cameraNode.look(at: SCNVector3(0, 0, -1))
    }

    // ---------- the city ----------

    /// Rebuilds the static city when switching between home and enemy, or when buildings/batteries change.
    func sync(view v: GameView, shown s: Shown, placing: Bool, selectedPad: Int?) {
        let key = "\(s)|\(s == .home ? v.me.name : v.enemy.name)"
        if key != shownKey {
            shownKey = key
            shown = s
            world.childNodes.forEach { $0.removeFromParentNode() }
            padNodes = [:]; batteryNodes = [:]; buildingNodes = [:]; rangeNodes = [:]
            buildBlocks(seed: key.hashValue == 0 ? 1 : abs(key.hashValue) % 100_000 + 1,
                        avoid: s == .home ? v.me.buildings.map { CGPoint(x: $0.x, y: $0.z) } + v.me.pads.map { CGPoint(x: $0.x, y: $0.z) } : [])
            clearDynamic()
        }
        if s == .home {
            for p in v.me.pads where padNodes[p.id] == nil {
                let n = padNode(); n.position = SCNVector3(p.x, 0.01, p.z); world.addChildNode(n); padNodes[p.id] = n
            }
            let taken = Set(v.me.batteries.map(\.pad))
            for (id, n) in padNodes {
                let free = !taken.contains(id)
                n.isHidden = !(placing && free) && selectedPad != id
                n.geometry?.firstMaterial?.emission.contents = selectedPad == id ? UIColor.white : UIColor(red: 0.4, green: 0.9, blue: 1, alpha: 1)
            }
            syncBatteries(v.me.batteries.map { ($0.uid, $0.sys, v.me.pads[$0.pad].x, v.me.pads[$0.pad].z, $0.holdFire) })
            syncBuildings(v.me.buildings, all: true)
        } else {
            syncBatteries(v.enemy.batteries.map { ($0.uid, $0.sys, $0.x, $0.z, false) })
            syncBuildings(v.enemy.buildings, all: false)
        }
    }

    private func buildBlocks(seed: Int, avoid: [CGPoint]) {
        var r = UInt64(seed)
        func rnd() -> Double { r = r &* 6364136223846793005 &+ 1442695040888963407; return Double((r >> 33) % 10_000) / 10_000 }
        let blocks = SCNNode()
        let colors: [UIColor] = [UIColor(white: 0.86, alpha: 1), UIColor(white: 0.78, alpha: 1), UIColor(red: 0.85, green: 0.8, blue: 0.72, alpha: 1), UIColor(red: 0.7, green: 0.74, blue: 0.8, alpha: 1)]
        let mats = colors.map { c -> SCNMaterial in let m = SCNMaterial(); m.diffuse.contents = c; return m }
        var placed = 0
        while placed < 420 {
            let a = rnd() * .pi * 2, d = sqrt(rnd()) * 6.2
            let x = cos(a) * d, z = sin(a) * d
            if avoid.contains(where: { hypot($0.x - x, $0.y - z) < 0.45 }) { continue }
            let core = max(0.2, 1 - d / 6.5)
            let w = 0.12 + rnd() * 0.18, h = 0.04 + rnd() * 0.35 * core * core + (rnd() < 0.05 * core ? 0.4 : 0)
            let box = SCNBox(width: w, height: h, length: w * (0.7 + rnd() * 0.6), chamferRadius: 0)
            box.firstMaterial = mats[Int(rnd() * Double(mats.count)) % mats.count]
            let n = SCNNode(geometry: box)
            n.position = SCNVector3(x, h / 2, z)
            n.eulerAngles.y = Float(rnd() * .pi)
            blocks.addChildNode(n)
            placed += 1
        }
        let flat = blocks.flattenedClone()
        flat.castsShadow = true
        world.addChildNode(flat)
        // Roads: two crossing avenues and a ring road.
        let road = UIColor(white: 0.42, alpha: 1)
        for ang in [0.0, .pi / 2] {
            let n = SCNNode(geometry: SCNPlane(width: 0.12, height: 13))
            n.geometry!.firstMaterial!.diffuse.contents = road
            n.eulerAngles = SCNVector3(-Float.pi / 2, Float(ang), 0); n.position.y = 0.003
            world.addChildNode(n)
        }
        let ring = SCNNode(geometry: SCNTube(innerRadius: 6.35, outerRadius: 6.45, height: 0.004))
        ring.geometry!.firstMaterial!.diffuse.contents = road
        world.addChildNode(ring)
    }

    private func padNode() -> SCNNode {
        let t = SCNTorus(ringRadius: 0.32, pipeRadius: 0.025)
        t.firstMaterial!.diffuse.contents = UIColor(red: 0.4, green: 0.9, blue: 1, alpha: 1)
        t.firstMaterial!.emission.contents = UIColor(red: 0.4, green: 0.9, blue: 1, alpha: 1)
        let n = SCNNode(geometry: t)
        n.runAction(.repeatForever(.sequence([.fadeOpacity(to: 0.35, duration: 0.6), .fadeOpacity(to: 1, duration: 0.6)])))
        return n
    }

    private func syncBatteries(_ list: [(Int, String, Double, Double, Bool)]) {
        let ids = Set(list.map(\.0))
        for (id, n) in batteryNodes where !ids.contains(id) { n.removeFromParentNode(); batteryNodes[id] = nil; rangeNodes[id]?.removeFromParentNode(); rangeNodes[id] = nil }
        for (uid, sys, x, z, hold) in list {
            if batteryNodes[uid] == nil {
                let n = Self.batteryModel(sys)
                n.position = SCNVector3(x, 0, z)
                world.addChildNode(n)
                batteryNodes[uid] = n
                let range = DefenceStyle.range[sys] ?? 0
                if range > 0, range <= 20 {
                    let ring = SCNNode(geometry: SCNTube(innerRadius: range - 0.03, outerRadius: range, height: 0.004))
                    ring.geometry!.firstMaterial!.diffuse.contents = DefenceStyle.color(sys).withAlphaComponent(0.55)
                    ring.geometry!.firstMaterial!.emission.contents = DefenceStyle.color(sys).withAlphaComponent(0.4)
                    ring.position = SCNVector3(x, 0.006, z)
                    world.addChildNode(ring)
                    rangeNodes[uid] = ring
                }
            }
            batteryNodes[uid]?.opacity = hold ? 0.45 : 1
        }
    }

    static func batteryModel(_ sys: String) -> SCNNode {
        let c = DefenceStyle.color(sys)
        let n = SCNNode()
        let base = SCNNode(geometry: SCNBox(width: 0.32, height: 0.08, length: 0.42, chamferRadius: 0.02))
        base.geometry!.firstMaterial!.diffuse.contents = UIColor(red: 0.33, green: 0.38, blue: 0.3, alpha: 1)
        base.position.y = 0.04
        n.addChildNode(base)
        let kind = DefenceStyle.kind[sys] ?? "sam"
        let top: SCNNode
        switch kind {
        case "gun":
            top = SCNNode(geometry: SCNCylinder(radius: 0.025, height: 0.3))
            top.eulerAngles.x = -0.9
            top.position = SCNVector3(0, 0.16, -0.05)
        case "laser":
            top = SCNNode(geometry: SCNCylinder(radius: 0.07, height: 0.16))
            top.position = SCNVector3(0, 0.16, 0)
        case "ew":
            top = SCNNode(geometry: SCNBox(width: 0.26, height: 0.2, length: 0.04, chamferRadius: 0))
            top.position = SCNVector3(0, 0.2, 0)
            top.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 3)))
        default:
            top = SCNNode(geometry: SCNBox(width: 0.26, height: 0.12, length: 0.34, chamferRadius: 0.01))
            top.eulerAngles.x = -0.5
            top.position = SCNVector3(0, 0.17, 0)
        }
        top.geometry!.firstMaterial!.diffuse.contents = c
        top.geometry!.firstMaterial!.emission.contents = c.withAlphaComponent(0.35)
        n.addChildNode(top)
        n.castsShadow = true
        return n
    }

    private func syncBuildings(_ list: [GameView.Building], all: Bool) {
        let ids = Set(list.map(\.uid))
        for (id, n) in buildingNodes where !ids.contains(id) { n.removeFromParentNode(); buildingNodes[id] = nil }
        for b in list {
            if buildingNodes[b.uid] == nil {
                let n = Self.buildingModel(b.kind)
                n.position = SCNVector3(b.x, 0, b.z)
                world.addChildNode(n)
                buildingNodes[b.uid] = n
            }
            let n = buildingNodes[b.uid]!
            let down = b.down > 0
            if (n.value(forKey: "down") as? Bool) != down {
                n.setValue(down, forKey: "down")
                n.enumerateChildNodes { c, _ in c.geometry?.firstMaterial?.multiply.contents = down ? UIColor(white: 0.25, alpha: 1) : UIColor.white }
            }
        }
    }

    static func buildingModel(_ kind: String) -> SCNNode {
        let n = SCNNode()
        func part(_ g: SCNGeometry, _ c: UIColor, _ p: SCNVector3) { g.firstMaterial!.diffuse.contents = c; let x = SCNNode(geometry: g); x.position = p; n.addChildNode(x) }
        let c = BuildingStyle.color(kind)
        switch kind {
        case "command":
            part(SCNBox(width: 0.5, height: 0.45, length: 0.5, chamferRadius: 0.02), c, SCNVector3(0, 0.225, 0))
            part(SCNSphere(radius: 0.14), UIColor.white, SCNVector3(0, 0.5, 0))
        case "radar":
            part(SCNCylinder(radius: 0.04, height: 0.4), UIColor(white: 0.6, alpha: 1), SCNVector3(0, 0.2, 0))
            let dish = SCNNode(geometry: SCNCone(topRadius: 0.22, bottomRadius: 0.02, height: 0.1))
            dish.geometry!.firstMaterial!.diffuse.contents = c
            dish.position = SCNVector3(0, 0.42, 0); dish.eulerAngles.x = 0.8
            let spin = SCNNode(); spin.addChildNode(dish); n.addChildNode(spin)
            spin.runAction(.repeatForever(.rotateBy(x: 0, y: .pi * 2, z: 0, duration: 4)))
        case "power":
            part(SCNCylinder(radius: 0.15, height: 0.4), c, SCNVector3(-0.18, 0.2, 0))
            part(SCNCylinder(radius: 0.15, height: 0.4), c, SCNVector3(0.18, 0.2, 0))
            part(SCNBox(width: 0.3, height: 0.15, length: 0.3, chamferRadius: 0), UIColor(white: 0.5, alpha: 1), SCNVector3(0, 0.075, 0.3))
        case "depot":
            for i in 0..<3 { part(SCNBox(width: 0.18, height: 0.1, length: 0.5, chamferRadius: 0.03), c, SCNVector3(Double(i - 1) * 0.22, 0.05, 0)) }
        case "factory":
            part(SCNBox(width: 0.6, height: 0.2, length: 0.4, chamferRadius: 0), c, SCNVector3(0, 0.1, 0))
            part(SCNCylinder(radius: 0.04, height: 0.45), UIColor(white: 0.4, alpha: 1), SCNVector3(0.2, 0.22, -0.1))
        case "airbase":
            let rw = SCNNode(geometry: SCNPlane(width: 0.16, height: 1.1))
            rw.geometry!.firstMaterial!.diffuse.contents = UIColor(white: 0.3, alpha: 1)
            rw.eulerAngles.x = -.pi / 2; rw.position.y = 0.005; n.addChildNode(rw)
            part(SCNBox(width: 0.25, height: 0.1, length: 0.2, chamferRadius: 0.02), c, SCNVector3(0.25, 0.05, 0))
        default: // finance
            part(SCNBox(width: 0.14, height: 0.8, length: 0.14, chamferRadius: 0), c, SCNVector3(0, 0.4, 0))
            part(SCNBox(width: 0.12, height: 0.6, length: 0.12, chamferRadius: 0), c, SCNVector3(0.18, 0.3, 0.05))
            part(SCNBox(width: 0.12, height: 0.5, length: 0.12, chamferRadius: 0), c, SCNVector3(-0.15, 0.25, 0.1))
        }
        n.castsShadow = true
        return n
    }

    // ---------- battle ----------

    func clearDynamic() {
        dynamic.childNodes.forEach { $0.removeFromParentNode() }
        threatNodes = [:]; interceptorNodes = [:]
    }

    func syncBattle(_ b: BattleView?) {
        guard let b else { if !threatNodes.isEmpty || !interceptorNodes.isEmpty { for n in threatNodes.values { n.removeFromParentNode() }; for n in interceptorNodes.values { n.removeFromParentNode() }; threatNodes = [:]; interceptorNodes = [:] }; return }
        var seen = Set<Int>()
        for t in b.threats {
            seen.insert(t.uid)
            let n = threatNodes[t.uid] ?? {
                let n = Self.threatModel(t)
                dynamic.addChildNode(n); threatNodes[t.uid] = n
                return n
            }()
            let p = SCNVector3(t.x, max(0.06, t.alt * Self.yScale), t.z)
            let old = n.position
            n.position = p
            let dx = p.x - old.x, dy = p.y - old.y, dz = p.z - old.z
            if dx * dx + dy * dy + dz * dz > 1e-8 { n.look(at: SCNVector3(p.x + dx, p.y + dy, p.z + dz)) }
        }
        for (id, n) in threatNodes where !seen.contains(id) { n.removeFromParentNode(); threatNodes[id] = nil }
        var seenI = Set<Int>()
        for i in b.interceptors {
            seenI.insert(i.uid)
            let n = interceptorNodes[i.uid] ?? {
                let g = SCNSphere(radius: 0.05)
                g.firstMaterial!.diffuse.contents = UIColor.white
                g.firstMaterial!.emission.contents = DefenceStyle.color(i.sys)
                let n = SCNNode(geometry: g)
                dynamic.addChildNode(n); interceptorNodes[i.uid] = n
                return n
            }()
            n.position = SCNVector3(i.x, i.alt * Self.yScale, i.z)
            puff(at: n.position)
        }
        for (id, n) in interceptorNodes where !seenI.contains(id) { n.removeFromParentNode(); interceptorNodes[id] = nil }
    }

    static func threatModel(_ t: ThreatView) -> SCNNode {
        let look = t.cls ?? "unknown"
        let c = ThreatStyle.color(t.cls == nil ? nil : (t.decoy ? "decoy" : t.looksLike))
        let g: SCNGeometry
        switch t.scout ? "uav" : look {
        case "drone", "decoy": g = SCNBox(width: 0.22, height: 0.05, length: 0.16, chamferRadius: 0.01)
        case "uav": g = SCNBox(width: 0.5, height: 0.04, length: 0.14, chamferRadius: 0.01)
        case "rocket": g = SCNCapsule(capRadius: 0.025, height: 0.22)
        case "cruise": g = SCNCapsule(capRadius: 0.04, height: 0.36)
        case "ballistic", "hypersonic": g = SCNCone(topRadius: 0, bottomRadius: 0.07, height: 0.42)
        default: g = SCNSphere(radius: 0.09)
        }
        g.firstMaterial!.diffuse.contents = c
        g.firstMaterial!.emission.contents = c.withAlphaComponent(0.6)
        let body = SCNNode(geometry: g)
        if g is SCNCapsule || g is SCNCone { body.eulerAngles.x = -.pi / 2 } // point along −z (look(at:) faces −z)
        let n = SCNNode()
        n.addChildNode(body)
        return n
    }

    private var puffBudget = 0
    private func puff(at p: SCNVector3) {
        puffBudget += 1
        guard puffBudget % 3 == 0 else { return }
        let s = SCNNode(geometry: SCNSphere(radius: 0.03))
        s.geometry!.firstMaterial!.diffuse.contents = UIColor(white: 0.95, alpha: 0.8)
        s.geometry!.firstMaterial!.lightingModel = .constant
        s.position = p
        dynamic.addChildNode(s)
        s.runAction(.sequence([.group([.fadeOut(duration: 1.2), .scale(to: 2.5, duration: 1.2)]), .removeFromParentNode()]))
    }

    func handle(_ events: [BattleEvent]) {
        for e in events {
            switch e.t {
            case "kill": burst(SCNVector3(e.x ?? 0, (e.alt ?? 0) * Self.yScale, e.z ?? 0), color: .orange, size: 0.35)
            case "impact":
                let big = (e.damage ?? 0) > 0
                burst(SCNVector3(e.x ?? 0, 0.05, e.z ?? 0), color: big ? UIColor(red: 1, green: 0.35, blue: 0.1, alpha: 1) : UIColor(white: 0.7, alpha: 1), size: big ? 0.25 + min(0.6, (e.damage ?? 0) / 100) : 0.2)
                if big { smoke(SCNVector3(e.x ?? 0, 0.05, e.z ?? 0)) }
            case "miss": burst(SCNVector3(e.x ?? 0, (e.alt ?? 0) * Self.yScale, e.z ?? 0), color: UIColor(white: 0.9, alpha: 1), size: 0.12)
            case "gun", "laser":
                let a = SCNVector3(e.fx ?? 0, 0.18, e.fz ?? 0), b = SCNVector3(e.tx ?? 0, (e.alt ?? 0) * Self.yScale, e.tz ?? 0)
                beam(from: a, to: b, color: e.t == "laser" ? UIColor(red: 1, green: 0.3, blue: 0.85, alpha: 1) : UIColor(red: 1, green: 0.85, blue: 0.3, alpha: 1), width: e.t == "laser" ? 0.02 : 0.008)
                if e.kill == true { burst(b, color: .orange, size: 0.25) }
            case "launch": burst(SCNVector3(e.x ?? 0, 0.1, e.z ?? 0), color: UIColor(white: 1, alpha: 1), size: 0.1)
            default: break
            }
        }
    }

    private func burst(_ p: SCNVector3, color: UIColor, size: CGFloat) {
        let g = SCNSphere(radius: size)
        g.firstMaterial!.diffuse.contents = color
        g.firstMaterial!.emission.contents = color
        g.firstMaterial!.lightingModel = .constant
        let n = SCNNode(geometry: g)
        n.position = p
        n.scale = SCNVector3(0.2, 0.2, 0.2)
        dynamic.addChildNode(n)
        n.runAction(.sequence([.group([.scale(to: 1.4, duration: 0.45), .fadeOut(duration: 0.6)]), .removeFromParentNode()]))
    }

    private func smoke(_ p: SCNVector3) {
        let g = SCNSphere(radius: 0.18)
        g.firstMaterial!.diffuse.contents = UIColor(white: 0.2, alpha: 0.7)
        g.firstMaterial!.lightingModel = .constant
        let n = SCNNode(geometry: g)
        n.position = p
        dynamic.addChildNode(n)
        n.runAction(.sequence([.group([.moveBy(x: 0.2, y: 0.8, z: 0, duration: 4), .scale(to: 3, duration: 4), .fadeOut(duration: 4)]), .removeFromParentNode()]))
    }

    private func beam(from a: SCNVector3, to b: SCNVector3, color: UIColor, width: CGFloat) {
        let d = SCNVector3(b.x - a.x, b.y - a.y, b.z - a.z)
        let len = CGFloat(sqrt(d.x * d.x + d.y * d.y + d.z * d.z))
        guard len > 0.01 else { return }
        let g = SCNCylinder(radius: width, height: len)
        g.firstMaterial!.diffuse.contents = color
        g.firstMaterial!.emission.contents = color
        g.firstMaterial!.lightingModel = .constant
        let n = SCNNode(geometry: g)
        n.position = SCNVector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
        n.look(at: b, up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 1, 0))
        dynamic.addChildNode(n)
        n.runAction(.sequence([.fadeOut(duration: 0.25), .removeFromParentNode()]))
    }

    // ---------- screen positions for SwiftUI overlays ----------

    func screenPoint(x: Double, y: Double, z: Double) -> CGPoint? {
        guard let v = scnView else { return nil }
        let p = v.projectPoint(SCNVector3(x, y, z))
        guard p.z > 0, p.z < 1 else { return nil }
        let pt = CGPoint(x: CGFloat(p.x), y: CGFloat(p.y))
        guard v.bounds.insetBy(dx: -20, dy: -20).contains(pt) else { return nil }
        return pt
    }
}

struct CityView: UIViewRepresentable {
    let city: CityScene
    func makeUIView(context: Context) -> SCNView {
        let v = SCNView()
        v.scene = city.scene
        v.pointOfView = city.cameraNode
        v.allowsCameraControl = true
        v.defaultCameraController.interactionMode = .orbitTurntable
        v.defaultCameraController.maximumVerticalAngle = 80
        v.defaultCameraController.minimumVerticalAngle = 8
        v.antialiasingMode = .multisampling2X
        v.preferredFramesPerSecond = 60
        v.rendersContinuously = true
        v.backgroundColor = .clear
        city.scnView = v
        return v
    }
    func updateUIView(_ v: SCNView, context: Context) {}
}

// ---------- colours ----------

enum DefenceStyle {
    static var range: [String: Double] = [:]
    static var kind: [String: String] = [:]
    static func configure(_ c: Catalogue) { for d in c.defences { range[d.id] = d.range; kind[d.id] = d.kind } }
    static func color(_ sys: String) -> UIColor {
        switch kind[sys] ?? "sam" {
        case "gun": return UIColor(red: 1, green: 0.75, blue: 0.3, alpha: 1)
        case "laser": return UIColor(red: 1, green: 0.37, blue: 0.82, alpha: 1)
        case "ew": return UIColor(red: 0.84, green: 1, blue: 0.36, alpha: 1)
        default:
            let r = range[sys] ?? 10
            if r >= 100 { return UIColor(red: 0.6, green: 0.55, blue: 1, alpha: 1) }
            if r >= 40 { return UIColor(red: 0.3, green: 0.66, blue: 1, alpha: 1) }
            return UIColor(red: 0.44, green: 0.89, blue: 1, alpha: 1)
        }
    }
}

enum ThreatStyle {
    static func color(_ cls: String?) -> UIColor {
        switch cls {
        case "drone": return UIColor(red: 1, green: 0.88, blue: 0.4, alpha: 1)
        case "decoy": return UIColor(red: 0.6, green: 0.65, blue: 0.69, alpha: 1)
        case "uav": return UIColor(red: 0.77, green: 0.55, blue: 1, alpha: 1)
        case "rocket": return UIColor(red: 1, green: 0.6, blue: 0.4, alpha: 1)
        case "cruise": return UIColor(red: 1, green: 0.54, blue: 0.24, alpha: 1)
        case "ballistic": return UIColor(red: 1, green: 0.35, blue: 0.31, alpha: 1)
        case "hypersonic": return UIColor(red: 1, green: 0.2, blue: 0.5, alpha: 1)
        default: return UIColor.white
        }
    }
}

enum BuildingStyle {
    static func color(_ kind: String) -> UIColor {
        switch kind {
        case "command": return UIColor(red: 0.85, green: 0.25, blue: 0.25, alpha: 1)
        case "radar": return UIColor(red: 0.3, green: 0.85, blue: 0.95, alpha: 1)
        case "power": return UIColor(red: 0.95, green: 0.8, blue: 0.2, alpha: 1)
        case "depot": return UIColor(red: 0.45, green: 0.55, blue: 0.3, alpha: 1)
        case "factory": return UIColor(red: 0.65, green: 0.45, blue: 0.3, alpha: 1)
        case "airbase": return UIColor(red: 0.5, green: 0.6, blue: 0.75, alpha: 1)
        default: return UIColor(red: 0.35, green: 0.75, blue: 0.55, alpha: 1)
        }
    }
    static func icon(_ kind: String) -> String {
        switch kind {
        case "command": return "star.fill"
        case "radar": return "dot.radiowaves.left.and.right"
        case "power": return "bolt.fill"
        case "depot": return "shippingbox.fill"
        case "factory": return "hammer.fill"
        case "airbase": return "airplane"
        default: return "dollarsign.circle.fill"
        }
    }
}
