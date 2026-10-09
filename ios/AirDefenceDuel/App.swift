import SwiftUI

@main
struct AirDefenceDuelApp: App {
    @StateObject private var engine = Engine()
    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(engine)
                .preferredColorScheme(.dark)
                .statusBarHidden()
                .persistentSystemOverlays(.hidden)
                .onAppear {
                    DefenceStyle.configure(engine.catalogue)
                    if ProcessInfo.processInfo.arguments.contains("-demo") { engine.newSandbox(name: "Demo") }
                }
        }
    }
}

struct RootView: View {
    @EnvironmentObject var engine: Engine
    var body: some View {
        if engine.view != nil { GameScreen() } else { StartView() }
    }
}

enum Theme {
    static let panel = Color(red: 0.03, green: 0.06, blue: 0.1).opacity(0.86)
    static let panel2 = Color(red: 0.05, green: 0.09, blue: 0.14)
    static let line = Color(red: 0.47, green: 0.75, blue: 0.82).opacity(0.28)
    static let friend = Color(red: 0.44, green: 0.89, blue: 1)
    static let money = Color(red: 0.62, green: 1, blue: 0.77)
    static let threat = Color(red: 1, green: 0.7, blue: 0.25)
    static let danger = Color(red: 1, green: 0.35, blue: 0.31)
    static let dim = Color(red: 0.53, green: 0.63, blue: 0.67)
}

struct StartView: View {
    @EnvironmentObject var engine: Engine
    @AppStorage("playerName") private var name = ""
    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(red: 0.02, green: 0.05, blue: 0.1), Color(red: 0.05, green: 0.12, blue: 0.2)], startPoint: .top, endPoint: .bottom).ignoresSafeArea()
            VStack(spacing: 18) {
                Text("AIR DEFENCE DUEL").font(.system(size: 40, weight: .heavy, design: .rounded)).tracking(3).foregroundStyle(Theme.friend)
                Text("Build your defences. Strike their city. Every missile costs money.").font(.callout).foregroundStyle(Theme.dim)
                HStack(spacing: 10) {
                    Text("Commander").foregroundStyle(Theme.dim)
                    TextField("Your name", text: $name).textFieldStyle(.roundedBorder).frame(width: 200).submitLabel(.done)
                }
                HStack(spacing: 14) {
                    Button { engine.newSandbox(name: name.isEmpty ? "You" : name) } label: {
                        Label("Sandbox training vs AI", systemImage: "scope").font(.headline).padding(.horizontal, 22).padding(.vertical, 12)
                    }
                    .buttonStyle(.borderedProminent).tint(Theme.friend.opacity(0.9)).foregroundStyle(.black)
                    VStack(spacing: 2) {
                        Label("Online duel", systemImage: "person.2.fill").font(.headline)
                        Text("Coming with the server").font(.caption2)
                    }
                    .padding(.horizontal, 22).padding(.vertical, 8)
                    .background(RoundedRectangle(cornerRadius: 10).stroke(Theme.line))
                    .foregroundStyle(Theme.dim)
                }
                Text("Setup 2 min · turns 1 min · first to zero city health loses").font(.caption).foregroundStyle(Theme.dim)
            }
            .padding()
        }
    }
}
