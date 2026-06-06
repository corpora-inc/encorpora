// Command surface for the asr-native plugin. Mirrors the canonical command
// names in `corpan-asr-contract::commands` (the FROZEN contract). Native STT
// is out-of-process — NO XCFramework/static-lib link step is needed (unlike
// tauri-plugin-stt's whisper.cpp), so this build.rs stays minimal.
const COMMANDS: &[&str] = &[
    "capabilities",
    "is_available",
    "ensure",
    "start_session",
    "stop_session",
    "cancel_session",
    "register_listener",
    "remove_listener",
];

fn main() {
    // Track the native source trees so a Swift/Kotlin edit forces a recompile
    // (the stale-plugin trap documented in tauri-plugin-stt's build.rs).
    println!("cargo:rerun-if-changed=ios");
    println!("cargo:rerun-if-changed=android/src");
    println!("cargo:rerun-if-changed=build.rs");

    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
