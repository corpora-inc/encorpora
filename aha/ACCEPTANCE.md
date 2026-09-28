# Native acceptance evidence

## September 28 SDK upgrade acceptance

The app source merged in [#843](https://github.com/corpora-inc/encorpora/pull/843)
(commit `fddee28b093ef881ec6f872acaef20465e45e679`) passed 99 application tests,
both controller browser suites, 16 native tests, strict Clippy, and iOS cross-checks.
The browser suites use explicit synthetic native IPC; they do not establish live
Free2Z authentication or billing acceptance.

Both updated native applications were then built and installed over their existing
isolated test installations. The iOS simulator reopened the current lesson and
preserved all 12 existing local records across terminate/relaunch. The Android
emulator upgrade preserved all 17 existing local records and relaunched the
native interface. Both screens were visually inspected. These were upgrade and
startup checks; the broader learning/backup journeys below were not repeated.
The iOS simulator build used the same explicit Rust archive and ad hoc signing
approach described below. No tracked build template was overridden.

Neither check signed in, sent paid AI requests, purchased credits, or wiped data.
Private evidence is retained outside the public repository. Store delivery and
physical installations are tracked separately in [RELEASE.md](RELEASE.md).

## Earlier full native learning journeys

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

No sign-in, paid requests, purchases, device data wipes, or other-app interactions were performed. Live Free2Z authentication, authoritative grant verification, metered inference and settlement remain unverified. Physical-device and live-service acceptance remain required. Store processing and tester availability are recorded separately in [RELEASE.md](RELEASE.md). See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) for service prerequisites.

## Physical-device follow-through

Record the actual store build and device before testing; an upload or selected
beta audience is not an installation result. Keep account, authentication and
receipt identifiers in the private runbook.

1. Install/update through the existing TestFlight or Play internal audience.
   Open local practice, submit a wrong answer and a correct answer, use a hint,
   then terminate/relaunch. Confirm progress survives and assisted work does not
   earn independent fluency credit. Background time must not count as active work.
2. After the backend's paid-readiness checkpoint and reconciliation of the shared
   authorized test allowance, connect Free2Z through the native system browser.
   Confirm the callback, reported persistence mode, current balance, enforced
   allowance and model availability. Restart and check the session again.
3. Generate one lesson and verify its learning record and settled charge. Test
   recovery within the remaining allowance using the original request identity;
   a recovered completed answer must not trigger another paid model invocation.
   Preserve unresolved settlement rather than reporting it as free usage.
4. Verify a saved curiosity answer survives restart and sign-out reports the
   native result accurately. Do not infer these live outcomes from fixture tests.

Record observed pass/fail results separately for Android and iOS. This procedure
is pending execution on physical devices; it is not additional acceptance evidence.
