import Foundation
import JavaScriptCore
import QuartzCore

/// Runs the shared rules engine (core.js, built from core/) inside JavaScriptCore.
/// The same rules will run on the server for online duels; the app only shows state and sends commands.
@MainActor
final class Engine: ObservableObject {
    @Published private(set) var view: GameView?
    @Published var toast: (text: String, bad: Bool)?
    let catalogue: Catalogue
    /// Battle events since the last frame, for the 3D scene's effects.
    var onEvents: (([BattleEvent]) -> Void)?

    private let ctx: JSContext
    private let api: JSValue
    private var link: CADisplayLink?
    private var last: CFTimeInterval = 0
    private let decoder = JSONDecoder()
    private var toastClear: DispatchWorkItem?

    init() {
        ctx = JSContext()!
        ctx.exceptionHandler = { _, e in print("core.js error:", e?.toString() ?? "?") }
        let url = Bundle.main.url(forResource: "core", withExtension: "js")!
        ctx.evaluateScript(try! String(contentsOf: url, encoding: .utf8))
        api = ctx.objectForKeyedSubscript("ADD")
        let cat = api.invokeMethod("catalogue", withArguments: [])!.toString()!
        catalogue = try! JSONDecoder().decode(Catalogue.self, from: Data(cat.utf8))
    }

    /// `-demo` launch argument: the AI plays both sides (for testing and screenshots).
    func newSandbox(name: String) {
        let demo = ProcessInfo.processInfo.arguments.contains("-demo")
        api.invokeMethod("newSandbox", withArguments: [Int.random(in: 1...999_999), name, demo])
        refresh()
        start()
    }

    func quit() {
        link?.invalidate(); link = nil
        view = nil
    }

    /// Sends a command; shows the error as a toast if the rules refuse it.
    @discardableResult
    func send(_ cmd: [String: Any]) -> Bool {
        guard let data = try? JSONSerialization.data(withJSONObject: cmd),
              let json = String(data: data, encoding: .utf8),
              let res = api.invokeMethod("cmd", withArguments: [json])?.toString(),
              let obj = try? JSONSerialization.jsonObject(with: Data(res.utf8)) as? [String: Any] else { return false }
        refresh()
        if obj["ok"] as? Bool == true { return true }
        say(obj["error"] as? String ?? "Not possible.", bad: true)
        return false
    }

    func say(_ text: String, bad: Bool = false) {
        toast = (text, bad)
        toastClear?.cancel()
        let w = DispatchWorkItem { [weak self] in self?.toast = nil }
        toastClear = w
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: w)
    }

    private func start() {
        link?.invalidate()
        last = CACurrentMediaTime()
        let l = CADisplayLink(target: Ticker(self), selector: #selector(Ticker.step))
        l.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
        l.add(to: .main, forMode: .common)
        link = l
    }

    fileprivate func step() {
        let now = CACurrentMediaTime()
        let dt = min(0.1, now - last)
        last = now
        api.invokeMethod("tick", withArguments: [dt])
        if let ev = api.invokeMethod("events", withArguments: [])?.toString(), ev != "[]",
           let list = try? decoder.decode([BattleEvent].self, from: Data(ev.utf8)) {
            onEvents?(list)
            for e in list where e.t == "msg" { say(e.text ?? "", bad: e.tone == "bad") }
        }
        refresh()
    }

    private func refresh() {
        guard let s = api.invokeMethod("view", withArguments: [])?.toString(), s != "null" else { return }
        do { view = try decoder.decode(GameView.self, from: Data(s.utf8)) }
        catch { print("view decode:", error) }
    }
}

/// CADisplayLink holds its target strongly; this breaks the cycle.
private final class Ticker: NSObject {
    weak var engine: Engine?
    init(_ e: Engine) { engine = e }
    @MainActor @objc func step() { engine?.step() }
}
