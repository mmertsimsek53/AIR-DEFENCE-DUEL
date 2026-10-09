import Foundation

// Mirrors core/src/view.ts (what one player may see) and the catalogue from core/src/bundle.ts.

struct GameView: Decodable {
    let phase: String            // setup | turn | battle | report | over
    let time: Double
    let secondsLeft: Int
    let myTurn: Bool
    let active: Int
    let turnNo: Int
    let weatherBad: Bool
    let winner: Int?
    let endReason: String?
    let iWon: Bool
    let me: Me
    let enemy: Enemy
    let battle: BattleView?
    let report: Report?
    let log: [LogLine]

    struct Me: Decodable {
        let name: String
        let budget: Double
        let health: Double
        let income: Double
        let ready: Bool
        let pads: [Pad]
        let batteries: [Battery]
        let buildings: [Building]
        let interceptors: [String: Int]
        let launchers: [String: Int]
        let stock: [String: Int]
        let scouts: [String: Int]
        let launched: [String: Int]
        let caps: [String: Int]
        let offUp: [String: [String: Int]]
        let econ: [String: Int]
        let radar: Radar
        let radarRange: Double
        let radarNames: [String]
        let storage: Storage
        let autoFire: Bool
        let reloadsLeft: Int
    }
    struct Enemy: Decodable {
        let name: String
        let health: Double
        let buildings: [Building]
        let batteries: [EnemyBattery]
    }
    struct Pad: Decodable, Identifiable { let id: Int; let x: Double; let z: Double }
    struct Battery: Decodable, Identifiable {
        let uid: Int; let sys: String; let pad: Int; let level: Int; let ammo: Int; let load: Int
        let reloading: Double; let holdFire: Bool; let revealed: Bool; let kills: Int
        let upgradeCost: Double?; let name: String
        var id: Int { uid }
    }
    struct EnemyBattery: Decodable, Identifiable { let uid: Int; let sys: String; let name: String; let x: Double; let z: Double; var id: Int { uid } }
    struct Building: Decodable, Identifiable {
        let uid: Int; let kind: String; let x: Double; let z: Double; let down: Int; let revealed: Bool?; let name: String
        var id: Int { uid }
    }
    struct Radar: Decodable { let range: Int; let identify: Int; let decoy: Int }
    struct Storage: Decodable { let used: Int; let safe: Int }
    struct LogLine: Decodable, Hashable { let time: Double; let text: String }
}

struct BattleView: Decodable {
    let attacker: Int
    let defender: Int
    let iDefend: Bool
    let time: Double
    let threats: [ThreatView]
    let interceptors: [InterceptorView]
    let stats: Stats
    struct Stats: Decodable { let launched: Int; let stopped: Int; let hits: Int; let damage: Double; let interceptorsUsed: Int; let defenceSpent: Double; let attackSpent: Double }
}

struct ThreatView: Decodable, Identifiable {
    let uid: Int
    let x: Double; let z: Double; let alt: Double
    let cls: String?
    let looksLike: String
    let name: String
    let decoy: Bool
    let priority: Bool
    let hold: Bool
    let engaged: Int
    let scout: Bool
    let eta: Int
    var id: Int { uid }
}

struct InterceptorView: Decodable, Identifiable { let uid: Int; let sys: String; let x: Double; let z: Double; let alt: Double; var id: Int { uid } }

struct Report: Decodable {
    let attacker: Int
    let launched: Int; let stopped: Int; let hits: Int; let damage: Double
    let interceptorsUsed: Int; let defenceSpent: Double; let attackSpent: Double
    let knockedOut: [String]
    let revealed: Int
}

// Battle events (core/src/types.ts BattleEvent).
struct BattleEvent: Decodable {
    let t: String
    let x: Double?; let z: Double?; let alt: Double?
    let fx: Double?; let fz: Double?; let tx: Double?; let tz: Double?
    let sys: String?; let kill: Bool?; let damage: Double?; let building: Int?
    let text: String?; let tone: String?; let cls: String?
}

// ---------- catalogue ----------

struct Catalogue: Decodable {
    let defences: [DefenceSpec]
    let attacks: [AttackSpec]
    let scouts: [ScoutSpec]
    let radar: RadarTable
    let extraRadar: Double
    let offUpgrades: [String: Track]
    let economy: [String: EconTrack]
    let buildings: [BuildingSpec]
    let cityRadius: Double

    struct DefenceSpec: Decodable, Identifiable {
        let id: String; let name: String; let kind: String; let price: Double; let shot: Double; let load: Int
        let range: Double; let hit: [String: Double]; let role: String; let needsPower: Bool?
    }
    struct AttackSpec: Decodable, Identifiable {
        let id: String; let name: String; let cls: String; let unit: Double; let launcher: Double; let perTurn: Int
        let flight: Double; let damage: Double; let precise: Bool; let reusable: Bool?; let munitions: Int?; let munitionCost: Double?
        let salvo: Int?; let role: String
    }
    struct ScoutSpec: Decodable, Identifiable { let id: String; let name: String; let price: Double; let altitude: String; let reveal: Double; let role: String }
    struct RadarTable: Decodable { let range: [Double]; let identify: [Double]; let decoy: [Double]; let cost: [Double]; let names: [String] }
    struct Track: Decodable { let label: String; let effect: String; let cost: [Double] }
    struct EconTrack: Decodable { let label: String; let values: [Double]; let cost: [Double] }
    struct BuildingSpec: Decodable { let kind: String; let name: String; let effect: String; let repairNow: Double }

    func defence(_ id: String) -> DefenceSpec? { defences.first { $0.id == id } }
    func attack(_ id: String) -> AttackSpec? { attacks.first { $0.id == id } }
}

let threatOrder = ["drone", "decoy", "uav", "rocket", "cruise", "ballistic", "hypersonic"]
let threatLabel: [String: String] = ["drone": "Drone", "decoy": "Decoy", "uav": "UAV", "rocket": "Rocket", "cruise": "Cruise", "ballistic": "Ballistic", "hypersonic": "Hypersonic"]

func money(_ v: Double) -> String {
    if abs(v) >= 100 { return "$\(Int(v.rounded()))M" }
    if abs(v) >= 1 { return String(format: "$%.1fM", v) }
    if v == 0 { return "$0" }
    return String(format: "$%.0fk", v * 1000)
}
