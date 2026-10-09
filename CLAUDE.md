# Air Defence Duel — working rules

Turn-based 1v1 missile duel between two cities. iOS first; Android after iOS is final.
Owner: Mert (non-technical — explain in plain words, give click-by-click steps for accounts).

## Process
- Discuss first: present the plan/figures and wait. Only start coding when Mert explicitly says go.
- One item at a time. Never change anything beyond the agreed item; mention other things, don't fix them.
- After each item: build/check, commit (one commit per item), `git push`.
- Mert does account sign-ups/logins/payments (Apple Developer, Google Play, hosting) when asked.

## Services
- GitHub: github.com/mmertsimsek53/AIR-DEFENCE-DUEL (private).
- Neon: project `airdefenceduel` (young-grass-99096952), Frankfurt, org-divine-bonus-39424766. Branches `live` (default) and `dev` (work here). Connection strings in `server/.env` (gitignored): `DATABASE_URL` = dev, `LIVE_DATABASE_URL` = live. Neon CLI: `npx -y neonctl@2` with Node from `~/.airlineroom-tools/node/bin`.
- Firebase (Auth only, Spark plan): project `air-defence-duel`, email/password + Apple. iOS app `com.mert.airdefenceduel`; `ios/GoogleService-Info.plist` is gitignored (Mert can re-download it from Project settings).

- App Store Connect: app "Air Defence Duel", bundle `com.mert.airdefenceduel`, team 3SK9NJ7M89. TestFlight upload from the command line (bump `CURRENT_PROJECT_VERSION` first):
  ```
  cd ios && xcodebuild -project AirDefenceDuel.xcodeproj -scheme AirDefenceDuel -destination 'generic/platform=iOS' -configuration Release -archivePath build/AirDefenceDuel.xcarchive -allowProvisioningUpdates archive
  xcodebuild -exportArchive -archivePath build/AirDefenceDuel.xcarchive -exportOptionsPlist build/ExportOptions.plist -exportPath build/export -allowProvisioningUpdates
  ```
  (`build/ExportOptions.plist`: method app-store-connect, destination upload, teamID 3SK9NJ7M89.)

## Build & test
- Rules: `cd core && npm run typecheck && npm test`; after any rules change `npm run bundle` (writes `ios/AirDefenceDuel/Resources/core.js`).
- iOS: `cd ios && xcodebuild -project AirDefenceDuel.xcodeproj -scheme AirDefenceDuel -destination 'generic/platform=iOS Simulator' -derivedDataPath build/SimDD build`
- Launch with `-demo` to make the AI play both sides (screenshots via `xcrun simctl io <udid> screenshot`).

## Layout
- `prototype/air-defence-duel.html` — original browser prototype (three.js r128, single file, pass-and-play). Reference only.
- `docs/GAME_DESIGN.md` — the agreed rules. Update it whenever a rule is decided.
- `docs/NUMBERS.md` — every price/stat; `core/src/data.ts` must match it.
- `core/` — shared rules engine (TypeScript, deterministic, no Node APIs). Runs in the iOS app via JavaScriptCore now and on the server later.
- `ios/` — SwiftUI + SceneKit app (landscape, iPhone). Project uses a synchronized folder: new files in `ios/AirDefenceDuel/` are picked up automatically.
