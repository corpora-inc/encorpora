# 27. iOS

## What it is

iOS is the largest target Corpán ships to by user count, and the
target that has driven the most platform-specific work in the
codebase. The app's bundle id is `com.corpora.corpan`, the
development team is `F9AV5HKF6N` (Corpora Inc), the minimum
deployment target is iOS 16.0, and the app is built through
Tauri's iOS path (section 04) which compiles the Rust binary to a
static library, links it into an Xcode project, and produces a
signed `.ipa` for App Store submission.

The Tauri iOS integration is generated. The source of truth for
the Xcode project is `corpan-app/src-tauri/ios/project.yml`, an
XcodeGen file that the regen script (`scripts/ios-gen.sh`) plays
into `gen/apple/` on every build. Hand-edits to the generated
project are overwritten; everything platform-specific lives in
the template.

## How it fits

iOS sits at the same Tauri seam as every other platform (section
04). Above it: the React tree, the packs, the catalog. Below it:
the Swift native plugins that wrap the platform APIs (STT, TTS,
IAP, audio keepalive, radio streaming, subscriptions). The
plugins themselves are shared with Android by Cargo path
(section 05's path-deps) and only diverge in their `ios/` and
`android/` subdirectories.

The user-facing surface is everything inside the WebView plus a
handful of OS integrations the WebView cannot do itself: the
lock screen Now Playing UI, AirPods hardware controls, Bluetooth
remote controls, system TTS voices, microphone access for the
pronunciation coach, in-app purchase flows, and the Apple
Feedback Assistant deep link (section 04's
`open_apple_feedback` command).

## Files and entry points

- `corpan/corpan-app/src-tauri/tauri.conf.json`: the iOS section
  pins `minimumSystemVersion: "16.0"`, the development team
  (`F9AV5HKF6N`), and the project template path
  (`src-tauri/ios/project.yml`).
- `corpan/corpan-app/src-tauri/ios/project.yml`: the XcodeGen
  definition. Bundle prefix `com.corpora.corpan`, deployment
  target 16.0, source paths into `Sources`, `Externals`,
  `corpan_iOS`, `assets`, `LaunchScreen.storyboard`, and
  `Corpan.storekit`.
- `corpan/corpan-app/src-tauri/ios/Corpan.storekit`: the StoreKit
  test configuration. Drives in-app purchase testing in
  Simulator and on TestFlight before the products are live on
  App Store Connect.
- `corpan/corpan-app/src-tauri/ios/ExportOptions.plist`: the
  Xcode `xcodebuild -exportArchive` settings (signing style,
  team id, upload symbols).
- `corpan/corpan-app/src-tauri/ios/corpan_iOS/`: the iOS-specific
  template files (`Info.plist`, `corpan_iOS.entitlements`,
  `PrivacyInfo.xcprivacy`, `LaunchScreen.storyboard`, app
  icons).
- `corpan/corpan-app/scripts/ios-gen.sh`: the regen script.
  Cleans `gen/apple/`, pre-copies template files, runs
  `npx tauri ios init --ci`, verifies `LD_RUNPATH_SEARCH_PATHS`
  includes `/usr/lib/swift`, and patches the StoreKit scheme
  reference XcodeGen misses.
- `corpan/corpan-app/src-tauri/gen/apple/`: the generated
  Xcode project. **Do not edit.** `ios-gen.sh` rewrites it.
- `corpan/plugins/tauri-plugin-*/ios/`: the Swift sources for
  each plugin's iOS half (section 05). The STT plugin lives at
  `corpan/plugins/tauri-plugin-stt/ios/Sources/`.
- `corpan/corpan-app/test_feedback_app.swift`,
  `test_ns_voices.swift`, `test_voices.swift`: standalone Swift
  scratch files used to probe the iOS Feedback Assistant URL
  schemes and the available TTS voice list during development.
- `corpan/APP_RELEASE_0_11_3.md`: the punch-list-style runbook
  for the iOS half of a release.

## How it works

### The regen path

The iOS Xcode project is **not** committed in a hand-edited state.
Instead, `ios-gen.sh` rebuilds `gen/apple/` from
`src-tauri/ios/project.yml` and the template files. The flow:

1. `./scripts/ios-gen.sh --clean` wipes `gen/apple/`.
2. The script pre-copies `Corpan.storekit` and
   `corpan_iOS.entitlements` from the template directory into
   the to-be-generated location, so XcodeGen sees them as
   sources to include.
3. `npx tauri ios init --ci` runs, which invokes XcodeGen
   against `project.yml`. The result is a complete Xcode
   project in `gen/apple/`.
4. The script verifies that the generated build settings
   include `/usr/lib/swift` in `LD_RUNPATH_SEARCH_PATHS` (a
   Tauri quirk; the iOS Swift runtime needs it on the rpath).
5. The script patches the StoreKit scheme reference in the
   generated `.xcscheme` because XcodeGen does not write it.

`CFBundleShortVersionString` and `CFBundleVersion` auto-inject
from `tauri.conf.json.version`. Never hardcode the version in
`project.yml`; the version source is `tauri.conf.json`.

### The Swift plugins

Each Tauri plugin that needs native iOS behavior has an
`ios/Sources/` directory with Swift files that conform to the
Tauri plugin protocol. The plugin's `mobile.rs` (section 05)
registers the iOS half via `tauri::ios_plugin_binding!`:

```rust
#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_stt);
```

The Swift side implements the methods the Rust plugin declares
(`prepare`, `startSession`, `stopSession`, etc.). Wire-format
strictness applies on both sides; the `availableMemoryMB`
rename war story in section 05 is the iOS half of that contract.

### Capabilities the app needs

A small set of iOS capabilities are enabled on the app target
through `project.yml` settings and `corpan_iOS.entitlements`:

- **In-App Purchase** (for `tauri-plugin-iap` and
  `tauri-plugin-subscriptions`).
- **Background Audio** (for `tauri-plugin-audio-keepalive`, so
  narration playback survives lock-screen and app-background).
- **Microphone** (for `tauri-plugin-stt`'s pronunciation coach).
- **Speech Recognition** (when the iOS-native
  `SFSpeechRecognizer` fallback path is in use).

Each capability is also reflected in `Info.plist`'s usage
strings (`NSMicrophoneUsageDescription`, etc.). Apple's App
Review rejects builds whose usage strings do not honestly
describe the use.

### PrivacyInfo.xcprivacy

Apple requires `PrivacyInfo.xcprivacy` since iOS 17. Corpán's
declaration (per the runbook):

- `NSPrivacyTracking = false` (no third-party tracking SDKs).
- `NSPrivacyCollectedDataTypes = []` (Corpán core collects
  nothing user-identifying).
- `NSPrivacyAccessedAPITypes` lists the Required Reason APIs
  the app touches: `UserDefaults` (`CA92.1`), `DiskSpace`
  (`E174.1`), `FileTimestamp` (`C617.1`).

The file is committed at
`src-tauri/ios/corpan_iOS/PrivacyInfo.xcprivacy`.

### In-app purchase

`tauri-plugin-iap` and `tauri-plugin-subscriptions` are the two
plugins that make IAP work. The StoreKit test configuration at
`Corpan.storekit` defines:

- `corpan.sub.monthly` and `corpan.sub.annual` as subscriptions
  in the `corpan_premium_access` group.
- Sample non-subscription products (per-book purchases).

`corpan/infra/IAP_SETUP_RUNBOOK.md` is the canonical runbook for
registering products on App Store Connect; the shadow-launch
strategy (register the products, ship them inactive, switch on
later) is described there.

### Apple Feedback Assistant

The `open_apple_feedback` command in `lib.rs:1232` (section 04)
opens the Feedback Assistant app or falls back to the Apple
Support app or the web feedback form, in that order. This is
how the in-app "Send feedback" button gets the user into the
real Apple feedback path during the beta program; without it,
TestFlight users have no obvious path to file a structured bug
report.

The trick this command encodes: try several URL schemes in
order, fall through silently on each `Err`, return success on
the first one that opens. The result is a button that does
the right thing on every iOS device regardless of which feedback
apps are installed.

### App Store submission

The submission flow on a developer's machine:

1. `cd corpan/corpan-app && ./scripts/ios-gen.sh --clean` to
   regenerate the Xcode project from the template.
2. `npm run tauri ios build` to compile Rust, run Vite, link
   the static lib into the Xcode target, and produce a release
   archive.
3. `xcodebuild -exportArchive -exportOptionsPlist
   src-tauri/ios/ExportOptions.plist` to produce the `.ipa`.
4. Upload via Xcode's Organizer, Transporter, or
   `xcrun altool`. TestFlight processes the build; the team
   beta-tests; submission for App Store review follows.

`RELEASE_NOTES_*.md` at the repo root carry the per-version
"What's new" copy in 30+ locales (sample from `RELEASE_NOTES_0.13.1.md`
above). The release notes ship with the binary; one block per
locale, headline-first.

## Common operations

1. **Regenerate the Xcode project.**
   `cd corpan/corpan-app && ./scripts/ios-gen.sh --clean`.
2. **Build for the simulator.**
   `npm run tauri ios dev`. Vite serves the React tree; the
   Tauri-built binary runs in Simulator with hot reload.
3. **Build for a device or TestFlight.**
   `npm run tauri ios build`. Produces an archive in Xcode's
   archive directory; upload from there.
4. **Test IAP without live products.** Run on the simulator
   with the StoreKit Configuration `Corpan.storekit` active.
   StoreKit simulates the purchase flow against the
   configuration.
5. **Verify a build's bundle version.**
   `defaults read $(pwd)/gen/apple/build/<config>/corpan.app/Info.plist
   CFBundleShortVersionString`. Confirms the auto-inject from
   `tauri.conf.json.version` landed.
6. **Capture an iOS-only log from a running app.**
   `xcrun simctl spawn booted log stream --predicate 'process
   == "corpan"' --level debug` while the simulator is running.

## Why we built it this way

XcodeGen plus the regen script is the choice that makes the
iOS project plain text. Without it, the source of truth for
"what is the Xcode project" is a hand-edited `.xcodeproj`
binary that nobody reviews; with it, the source is a YAML file
that diffs cleanly and that can be edited by any tool. The
cost (a regen step in the build) is invisible because the
script runs in CI.

Tauri's iOS target instead of a custom Swift app is the choice
that lets the React tree ship to iOS at all. The alternative
(rewrite the UI in SwiftUI) would double the engineering
investment and split the codebase; the Tauri path means the
same `MainExperience.tsx` (section 06) runs on iOS, Android,
and desktop.

The strict-no-edit rule on `gen/apple/` is the discipline that
keeps the iOS project regeneratable. Once a hand-edit lands in
`gen/`, the next regen wipes it; without the rule, every
maintainer learns this the hard way. The template directory is
the place to put platform changes that need to persist.

The capability declarations and `PrivacyInfo.xcprivacy` are not
optional. Apple's App Review rejects builds whose declared
behavior does not match what the app does; keeping the
declarations honest (and short) is the smallest discipline that
keeps reviews short.

## To go deeper

- `corpan/APP_RELEASE_0_11_3.md` for the canonical iOS release
  punch list.
- `corpan/infra/IAP_SETUP_RUNBOOK.md` for App Store Connect
  product registration.
- Apple's "App Distribution" docs at
  `developer.apple.com/documentation/Xcode/distributing-your-app-for-beta-testing-and-releases`.
- XcodeGen at `github.com/yonaskolb/XcodeGen` for the
  `project.yml` reference.
- Section 04 for the Tauri runtime story; section 05 for the
  Swift plugin shape; section 28 for the Android counterpart.
