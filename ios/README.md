# Residue iOS Companion (`ResiduePhone`)

Native SwiftUI companion app for the Residue desktop. The phone:

1. Signs into the same Residue account as the desktop (`/api/auth/login`).
2. Auto-binds to the desktop study session as soon as the same-account user
   clicks **Start Session** on their laptop. The phone polls
   `/api/phone/active-session` and uses `/api/pair/auto` to bind without a
   6-digit code. The legacy 6-digit `PairView` + `/api/pair/claim` path is
   preserved as a manual fallback (e.g. when the phone is signed into a
   different desktop user).
3. Tracks `UIApplication` lifecycle (foreground / background) during the
   session and posts each transition to `/api/phone/event`. The desktop's
   `ProductivityTracker` subtracts a real-time penalty for every unlock.
4. (Optional) Uses Apple **ScreenTime / FamilyControls** to capture
   per-category app usage during the session.
5. **When the laptop ends the session**, the phone automatically runs the
   **Zetic Melange `Steve/Qwen3.5-2B` LLM fully on-device** (Apple Neural
   Engine via `ZeticMLangeLLMModel`) to generate a natural-language
   distraction report. The same `SessionView` "On-device distraction report"
   section displays the result, and only the rendered summary travels back
   to the desktop — the prompt and per-app log never leave the phone. The
   desktop POSTs the same summary into the existing Fetch.ai
   `CorrelationAgent` (and best-effort `Orchestrator`) so the user's
   personal acoustic-state model learns from phone-distraction signals on
   every session. The "Generate distraction report" button is preserved as
   a manual fallback.

## On-device vs cloud separation (Zetic Melange track)

| Responsibility                                          | Where it runs        |
| ------------------------------------------------------- | -------------------- |
| Distraction report generation (Qwen3.5-2B inference)    | **iPhone** (ANE)     |
| ScreenTime per-category aggregation                     | **iPhone**           |
| `UIApplication` lifecycle counting                      | **iPhone**           |
| Auth, pairing, event ferrying, report storage           | Cloud (Next.js)      |

This satisfies the Zetic track's "core functionality directly on-device" rule:
the actual distraction analysis (the LLM call) is fully local; the cloud is a
thin pairing/relay layer.

## Project layout

```
ios/ResiduePhone/
  project.yml                    # XcodeGen project definition
  ResiduePhone/
    ResiduePhoneApp.swift        # @main + DI
    RootView.swift               # AuthView ↔ SessionView routing (PairView retained as manual fallback)
    AuthView.swift               # Email/password sign-in & sign-up
    PairView.swift               # 6-digit pairing code entry (manual fallback)
    SessionView.swift            # Live counters + "Generate report" button
    SessionStore.swift           # ObservableObject app state
    ResidueAPI.swift             # Backend client
    ActiveSessionPoller.swift    # Polls /api/phone/active-session for auto-bind / auto-report
    AppLifecycleMonitor.swift    # UIApplication notifications → events
    ScreenTimeUsage.swift        # FamilyControls/DeviceActivity wrapper
    MelangeReportGenerator.swift # ZeticMLangeLLMModel host
    Config.swift                 # Reads Info.plist for keys + base URL
    Info.plist
    ResiduePhone.entitlements    # com.apple.developer.family-controls
```

## Setup on a Mac

1. Install [XcodeGen](https://github.com/yonaskolb/XcodeGen):
   ```bash
   brew install xcodegen
   ```
2. Generate the Xcode project:
   ```bash
   cd ios/ResiduePhone
   xcodegen generate
   open ResiduePhone.xcodeproj
   ```
   (Alternatively, you can create a new iOS App target manually in Xcode and
   drag the `ResiduePhone/` folder into it.)
3. Set your **Apple Team ID** under Signing & Capabilities for the
   `ResiduePhone` target. Family Controls capability is already declared in
   `ResiduePhone.entitlements` — toggle it off if you don't want to provision
   it for your team.
4. Add the **ZETIC Melange** Swift Package per ZETIC's instructions:
   - File → Add Package Dependencies…
   - URL: `https://github.com/zetic-ai/ZeticMLangeiOS.git`
   - Dependency Rule → **Exact Version 1.6.0**
   - Add the `ZeticMLange` library product to the `ResiduePhone` target.
   - (XcodeGen users: this is already declared in `project.yml`, so re-running
     `xcodegen generate` will pick it up.)
5. Open `ResiduePhone/Info.plist` and fill in:
   - `RESIDUE_BASE_URL` — the address of your Residue desktop server (e.g.
     `http://192.168.1.42:3000` or the public deployment URL).
   - `MELANGE_PERSONAL_KEY` — your Melange Dashboard personal key
     (https://melange.zetic.ai/).
   - `MELANGE_DISTRACTION_MODEL_KEY` — defaults to `Steve/Qwen3.5-2B`.
     Override if you upload a different LLM to your Melange workspace.

> **Tip.** Don't commit your `MELANGE_PERSONAL_KEY` to source control. For
> local development, leave the value blank in `Info.plist` and inject it via
> a build-time `.xcconfig` overlay or scheme env var.

6. Build to a **physical iPhone** (Apple Neural Engine + ScreenTime APIs are
   not available on the Simulator). The app will register with the desktop on
   first launch, then behave as a passive distraction tracker until the user
   opens it again to tap **Generate distraction report**.

## End-to-end flow

1. On the desktop: sign in → click **Start Session**.
2. On the phone: open Residue → sign in with the **same account**. Within
   ~5 seconds (one `ActiveSessionPoller` tick) the phone auto-binds to the
   desktop session via `/api/pair/auto` — no 6-digit code to type.
3. Use your phone normally during the study session. Each time the device
   unlocks, the desktop's `ProductivityTracker` subtracts a real-time
   penalty.
4. When you're done, click **End Session** on the desktop. The desktop
   POSTs `/api/session/stop`, the phone's poller sees the
   `currentlyStudying: true → false` transition, and `SessionStore`
   automatically calls `generateReport()`. The Qwen3.5-2B model loads on
   first use (the user-supplied download progress callback drives the UI),
   runs locally on the Apple Neural Engine, and the rendered summary:
   - is shown in `SessionView`'s "On-device distraction report" section,
   - is POSTed to `/api/phone/report` so the desktop's pairing panel
     renders it,
   - is fed (server-side) into the existing Fetch.ai `CorrelationAgent`
     (and best-effort `Orchestrator`) so the user's personal acoustic-state
     model improves on every session.

The manual **Generate distraction report** button on the phone is
preserved as a fallback.

## Notes & limitations

- **Background tracking is best-effort.** iOS will throttle backgrounded apps;
  the design pattern here uses *foreground* transitions of the Residue
  companion as the distraction signal, plus optional ScreenTime aggregation
  for per-category breakdowns.
- **ScreenTime needs Family Controls approval** from Apple before App Store
  distribution. The development entitlement is fine for testing.
- **First Melange call downloads the model.** Expect a few hundred MB on first
  launch over Wi-Fi; subsequent runs reuse the cached model.
