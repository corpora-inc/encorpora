# 28. Android

## What it is

Android is the second platform Corpán ships to, and the one where
the runtime's roughest edges live. The Tauri Android target wraps
the same Rust binary that powers iOS and desktop, but the Android
WebView and the Android lifecycle introduce specific failure
modes that the iOS path does not. The Android exit prevention
code (section 04's worked example) is one such mode; the
vendored `ndk-context` fork is another.

Kotlin is the native language on this side of the seam. Each
Tauri plugin that has Android behavior carries a Kotlin
implementation under its `android/` directory; the Rust
`mobile.rs` reaches it through
`api.register_android_plugin("com.corpora.<plugin>", "<KotlinClass>")`.
Section 05 walks the bridge through the STT plugin.

## How it fits

Android is at the same Tauri seam every platform is at (section
04). The differences from iOS are in the platform-native code
and the OS lifecycle. The same React tree, the same packs, the
same `MainExperience.tsx`. The platform-specific work is
contained to:

- Plugin Kotlin sources (`corpan/plugins/<name>/android/`).
- Android-specific manifest entries
  (`com.android.vending.BILLING`, microphone permission, etc.).
- The vendored `ndk-context` fork and the
  `prevent_exit` discipline in `lib.rs:1314` (section 04).
- The Gradle build setup (compileSdk, ndk version, Java/Kotlin
  17 toolchain).
- The release signing key (`upload-keystore.jks`).
- The Play Store metadata and screenshots.

## Files and entry points

- `corpan/corpan-app/src-tauri/gen/android/`: the generated
  Android Gradle project. **Do not edit by hand;**
  `patch-android.sh` regenerates the platform-version pins on
  every run, and other parts come from
  `npx tauri android init`.
- `corpan/corpan-app/scripts/patch-android.sh`: the idempotent
  post-init patch. Pins `compileSdk=36`, `targetSdk=36`,
  `ndkVersion=28.2.13676358`, Java/Kotlin 17 source/target
  language version, and the source-target-deprecation suppressor.
  Safe to re-run.
- `corpan/corpan-app/src-tauri/upload-keystore.jks`: the release
  signing key for Play Store uploads. **Not** in git (the
  `.gitignore` excludes it); copies live on the machines that
  ship release builds.
- `corpan/corpan-app/src-tauri/Cargo.toml:53` `[patch.crates-io]`
  `ndk-context = { path = "vendor/ndk-context" }`: the vendored
  fork (section 04) that removes the upstream `assert!` that
  killed the process on Activity re-init.
- `corpan/plugins/<name>/android/`: the Kotlin sources for each
  plugin's Android half. The STT plugin's Kotlin lives at
  `corpan/plugins/tauri-plugin-stt/android/src/main/java/
  com/corpora/stt/SttPlugin.kt` (the `register_android_plugin`
  call in `mobile.rs:18` names it).
- `RELEASE_NOTES_0.12.7_ANDROID.md`: the Android-specific
  release notes block (sometimes the iOS and Android cuts have
  different headline copy).
- `corpan/CLAUDE.md` "Android" section: notes the
  `com.android.vending.BILLING` permission requirement and the
  upload-keystore path.

## How it works

### The Tauri Android target

`npx tauri android init` (run once per checkout) generates the
Gradle project at `src-tauri/gen/android/`. Subsequent builds run
through Gradle:

- `npm run tauri android dev` runs the binary in the emulator
  or on a connected device with hot-reloaded React.
- `npm run tauri android build` produces a signed AAB (Android
  App Bundle) and APK in `gen/android/app/build/outputs/`.

The Rust side compiles to a shared object (`.so`) per ABI
(arm64-v8a, armeabi-v7a, x86_64) and gets bundled into the AAB
through Gradle's NDK integration. The WebView is the system
WebView; Tauri does not bundle a browser.

### `patch-android.sh`

The post-init patch is the file most likely to need to change
when Android tooling moves. As of the v0.11.3 punch list:

```
compileSdk = 36
targetSdk = 36
ndkVersion = 28.2.13676358
sourceCompatibility = JavaVersion.VERSION_17
targetCompatibility = JavaVersion.VERSION_17
kotlinOptions { jvmTarget = "17" }
```

Plus a suppressor for the source/target deprecation warning
Gradle emits on every build. The script is idempotent (re-running
it produces the same diff); it does **not** currently touch
`AndroidManifest.xml`, so manifest changes that Tauri's
`tauri.conf.json` does not surface require hand-edits in the
gen directory or template-layer fixes.

The version numbers in the patch float with the Android
ecosystem. The release punch list flags them for re-validation
on each release; bumping the targetSdk above the current Play
Store requirement is the usual trigger.

### The Kotlin plugin side

Each plugin's `android/` directory is a small Gradle library
project. The class registered by name (`SttPlugin` for the STT
plugin) extends Tauri's plugin base and exposes methods named
exactly as the Rust side calls them (`prepare`,
`startSession`, `stopSession`, etc.). Wire-format strictness
applies on this side too; the camelCase field names on the
JSON wire have to match what the Kotlin data classes declare
(section 05's `availableMemoryMB` rename story is the same on
both halves).

The STT plugin's Kotlin code drives whisper.cpp via JNI: the C
library is built as part of the plugin's Gradle build, the JNI
glue calls into it, the Kotlin layer exposes the typed API
Tauri sees. Audio is captured through `AudioRecord` (at 16 kHz
mono, the rate whisper.cpp expects) and streamed into the
model.

### The `BILLING` permission

`tauri-plugin-iap` contributes the
`com.android.vending.BILLING` permission to the merged
`AndroidManifest.xml`. The permission is what lets the app
talk to the Play Store's billing client; without it, IAP
queries fail at runtime.

The current punch list flags that
`patch-android.sh` does **not** today verify the merged
`AndroidManifest.xml` includes the BILLING permission. The
runbook step is to read the regenerated manifest after a clean
`tauri android init` and confirm; if the merge does not pick it
up automatically, the plugin's `android/src/main/AndroidManifest.xml`
needs the explicit declaration.

### Release signing

Play Store uploads must be signed with the release keystore at
`src-tauri/upload-keystore.jks`. The keystore is **not** in
git; the machines that ship release builds (Jeff's laptop, the
Spark for some pipeline-driven builds) keep their own copies.
Losing the keystore means losing the ability to ship updates;
the keystore is backed up out of band.

The signing config lives in `gen/android/app/build.gradle.kts`,
which `tauri android init` writes; the keystore password and
key alias live in `gradle.properties` (also gitignored). A
fresh machine setting up release builds copies the keystore
and `gradle.properties` into place before the first
`tauri android build`.

### Play Store metadata

`RELEASE_NOTES_<version>_ANDROID.md` carries the per-version
Play Store "What's new" copy in the same 30+ locale shape as
the iOS notes (section 27). Screenshots and feature graphics
live under `corpan-assets/marketing/` (section 24); Play
Console review checks for ratings prompts, content rating, and
data safety declarations. The data-safety form mirrors the
iOS `PrivacyInfo.xcprivacy` declarations.

## Common operations

1. **Initialize an Android project for a fresh checkout.**
   `cd corpan/corpan-app && npx tauri android init`. Then
   `./scripts/patch-android.sh`.
2. **Build for the emulator.**
   `npm run tauri android dev`. Hot reload on the React side.
3. **Build a release AAB.**
   `npm run tauri android build`. Output in
   `gen/android/app/build/outputs/bundle/release/`. Upload to
   Play Console.
4. **Inspect a logcat trace from the device.**
   `adb logcat | grep -i 'corpan\|RustStdoutStderr'`. The
   `prevent_exit` log lines, JNI errors, and any Kotlin
   exceptions land here.
5. **Test IAP without live products.** Configure a Play
   Console license test account and add `corpan.sub.monthly` /
   `corpan.sub.annual` as test SKUs. The Play billing client
   honors test SKU prices.
6. **Confirm the vendored ndk-context fork is in use.**
   `cargo tree -p ndk-context` from
   `corpan-app/src-tauri/` should resolve to the local
   `vendor/ndk-context` path, not crates.io.

## Why we built it this way

The vendored `ndk-context` fork plus the `prevent_exit`
discipline are the response to a real shipped crash on real
devices. Section 04 walks the chain of failures; the short
version is that upstream Tauri's lifecycle was killing the
process in a way that ran C++ destructors over live OS state,
and the workaround is to never exit. Documenting both the fix
and the rationale next to the code is the only practice that
prevents a future contributor from "cleaning up" the unused
event handler and re-shipping the crash.

The regen-script approach mirrors iOS (section 27). The
generated Gradle project is rebuilt from a small set of
template files and a patch script; `gen/android/` is not the
source of truth, the templates and the patch are.

Whisper on CPU via NEON instead of NNAPI is the configuration
the pronunciation coach ships with. NNAPI is available in
principle, but the gain for the model sizes the coach uses is
small and the configuration complexity is high; the v0.12.6
shipped configuration is "Pronunciation coach on Android CPU,
whisper.cpp" per `PIPELINE_STATE`.

The Play Console requirements (data safety, content rating,
ratings prompts) are honest declarations of what the app does;
keeping them honest is what keeps reviews fast. Section 27's
iOS counterparts mirror this.

## To go deeper

- `corpan/APP_RELEASE_0_11_3.md` for the cross-platform
  release punch list; Android-specific items live alongside
  the iOS ones.
- `RELEASE_NOTES_0.12.7_ANDROID.md` for an Android-specific
  release-notes example.
- Tauri's Android docs at `v2.tauri.app/develop/mobile/android/`.
- Android's WebView documentation at
  `developer.android.com/reference/android/webkit/WebView`.
- Section 04 for the prevent_exit story; section 05 for the
  Kotlin / Swift plugin shape; section 27 for the iOS
  counterpart.
