# Native acceptance evidence

Android 36 arm64 emulator acceptance used the actual Tauri host and app-private SQLite database, not the browser IPC fixture.

- Correct and incorrect first answers, assisted hints, and immutable attempts survived force-stop/relaunch.
- Disputing an unanswered item prevented stale presentation from resuming after restart.
- An in-place APK upgrade retained the learner and three existing attempts. Subsequent answers wrote compact projection-only checkpoints and presentation sessions without copied history.
- Another force-stop/relaunch reconstructed all evidence; the next checkpoint matched an independent replay of the native attempt ledger.
- The exported native backup SHA-256 checksum independently verified. No uncaught WebView errors occurred.
- Android ELF load/RELRO segments and APK ZIP alignment passed 16 KiB checks.

The accepted debug APK combined controller source `2e5d4b5278b22c5028ba5b7adf2b459a329d7053` with native SDK host source `7480c0a968651b206c699a2b8fca1a93e2d3a3d3`. Its SHA-256 is `f12ba0008bb14930de38c8e6f891358960b49cb40338aecdee4b43be569f46ee`. This is emulator evidence, not a signed store release.

No sign-in, paid requests, purchases, device data wipes, or other-app interactions were performed. Live Free2Z authentication, authoritative grant verification, metered inference and settlement remain unverified. iOS runtime acceptance, physical-device installation, processed TestFlight availability and Google Play internal-track availability remain required. See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) for service prerequisites.
