import SwiftUI
import WebKit

// The game itself is the web scene in Web/ (built from /web: three.js city + the shared rules engine),
// shown full-screen and fully offline. Native code stays thin: later it adds sign-in, the server link and the store.

@main
struct AirDefenceDuelApp: App {
    var body: some Scene {
        WindowGroup {
            GameWebView()
                .ignoresSafeArea()
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
                .background(Color(red: 0.66, green: 0.77, blue: 0.86))
        }
    }
}

struct GameWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Forward page errors and console.log to the Xcode console.
        let bridge = """
        (function(){
          const post = (k, m) => { try { webkit.messageHandlers.log.postMessage(k + ': ' + m); } catch (e) {} };
          addEventListener('error', e => post('error', e.message + ' @' + e.lineno));
          const l = console.log; console.log = (...a) => { post('log', a.join(' ')); l(...a); };
        })();
        """
        config.userContentController.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController.add(context.coordinator, name: "log")
        // The player's base is saved as a file in the app's own storage and handed to the page at start.
        if let saved = BaseStore.load(), let data = try? JSONEncoder().encode(saved), let lit = String(data: data, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: "window.__savedBase = \(lit);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        config.userContentController.add(context.coordinator, name: "save")

        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif

        if let index = Bundle.main.url(forResource: "index", withExtension: "html") {
            var url = index
            // `-demo` launch argument: the AI plays both sides (testing and screenshots).
            if ProcessInfo.processInfo.arguments.contains("-demo"),
               var c = URLComponents(url: index, resolvingAgainstBaseURL: false) {
                c.queryItems = [URLQueryItem(name: "demo", value: "1")]
                url = c.url ?? index
            }
            web.loadFileURL(url, allowingReadAccessTo: index.deletingLastPathComponent())
        }
        return web
    }

    func updateUIView(_ web: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "save", let json = message.body as? String { BaseStore.save(json); return }
            print("[web]", message.body)
        }
    }
}

/// Saves the base JSON (from the web game) in Application Support.
enum BaseStore {
    private static var url: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("base.json")
    }
    static func save(_ json: String) { try? json.write(to: url, atomically: true, encoding: .utf8) }
    static func load() -> String? { try? String(contentsOf: url, encoding: .utf8) }
}
