const COMMANDS: &[&str] = &[
    "prepare",
    "start_session",
    "stop_session",
    "cancel_session",
    "is_available",
    "get_status",
    "wipe_model",
    "install_model",
    "validate_model",
    "list_installed",
    "unload",
    "register_listener",
    "remove_listener",
];

fn main() {
    // Without explicit rerun-if-changed directives, Cargo treats this
    // build.rs as having no source dependencies — meaning it'll skip
    // rebuilding the plugin on subsequent invocations even when the
    // Swift / Kotlin sources changed. That manifested in the wild as
    // hours of `tauri ios dev` rebuilds that all reused a stale plugin
    // binary; new fields added to Swift Encodable payloads silently
    // never reached the JS side. Explicitly track the ios/ and
    // android/ trees so any source edit forces a recompile.
    println!("cargo:rerun-if-changed=ios");
    println!("cargo:rerun-if-changed=android/src");
    println!("cargo:rerun-if-changed=android/build.gradle.kts");
    println!("cargo:rerun-if-changed=android/AndroidManifest.xml");
    println!("cargo:rerun-if-changed=build.rs");

    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
