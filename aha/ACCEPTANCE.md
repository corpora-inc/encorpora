# Native acceptance evidence

Android 36 arm64 emulator acceptance used the actual Tauri host and app-private SQLite database, not the browser IPC fixture.

- Correct and incorrect first answers, assisted hints, and immutable attempts survived force-stop/relaunch.
- Disputing an unanswered item prevented stale presentation from resuming after restart.
- An in-place APK upgrade retained the learner and three existing attempts. Subsequent answers wrote compact projection-only checkpoints and presentation sessions without copied history.
- Another force-stop/relaunch reconstructed all evidence; the next checkpoint matched an independent replay of the native attempt ledger.
- The exported native backup SHA-256 checksum independently verified. No uncaught WebView errors occurred.
- Android ELF load/RELRO segments and APK ZIP alignment passed 16 KiB checks.

The accepted debug APK combined controller source `2e5d4b5278b22c5028ba5b7adf2b459a329d7053` with native SDK host source `7480c0a968651b206c699a2b8fca1a93e2d3a3d3`. Its SHA-256 is `f12ba0008bb14930de38c8e6f891358960b49cb40338aecdee4b43be569f46ee`. This is emulator evidence, not a signed store release.

iOS simulator acceptance used an iPhone 17 simulator running iOS 26.5, built with Xcode 27 and SDK 27. XCTest drove the actual bundled WKWebView interface; an independent read-only SQLite observer checked the native records. No browser IPC fixture was used.

- Incorrect and correct answers each created one independently graded native attempt. A hinted correct answer persisted assistance and did not earn independent credit.
- Terminate/relaunch restored all three attempts and did not resume the answered question.
- Quarantining an unanswered question survived another terminate/relaunch without adding mastery evidence.
- Native Export backup produced a JSON backup whose SHA-256 checksum and three attempts independently verified. The backup was not restored or sent to an external recipient.
- The persisted checkpoint contained no copied attempt history; the presentation session omitted learner state.
- Public Free2Z client configuration was present. The real registered SDK host completed its signed-out session IPC before local profile initialization. This does not verify authenticated sessions, inference, or settlement.

The accepted simulator source was controller/native integration `a24b044dbfd2cc99f545618eb5cacbf8433e6302` plus the tracked iOS executable-name fix `29a5b7b6de8c52686ad25fc9f27378303d96738e` (#831). The preserved simulator app ZIP SHA-256 is `d3bf85faa4325596b0e8545c81e423318ffeb8b95eb350832a18f4ebd699e665`.

The simulator artifact used debug native code with bundled `tauri/custom-protocol` assets and ad hoc simulator signing. Its test application-identifier and Keychain access-group entitlements enabled the actual SDK secure store; an unsigned build had correctly failed with `storage_unavailable`. The generated Xcode project was reconciled with the tracked template, and its build phase reused the explicitly compiled Rust archive because the standalone Tauri CLI build expected an unavailable matching simulator runtime. This is simulator acceptance, not verification of the release workflow or distribution signing.

The original Unicode executable crashed during Wry framework discovery before app initialization. Disabling debug dylibs did not resolve it. Keeping the executable `aha` and visible display name `¡AHA!` resolved startup with debug dylibs enabled, as encoded in #831.

No sign-in, paid requests, purchases, device data wipes, or other-app interactions were performed. Live Free2Z authentication, authoritative grant verification, metered inference and settlement remain unverified. Physical-device acceptance, signed release-workflow verification, processed TestFlight availability and Google Play internal-track availability remain required. See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) for service prerequisites.
