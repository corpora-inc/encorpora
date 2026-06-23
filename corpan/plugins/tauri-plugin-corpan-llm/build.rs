const COMMANDS: &[&str] = &[
    "llm_status",
    "llm_load",
    "llm_chat",
    "llm_stop",
    "llm_unload",
    "llm_query_pack_db",
];

fn main() {
    // Pure-Rust plugin: every command AND the llama.cpp inference runtime live in
    // Rust and run on all platforms (incl. iOS/Android) on a dedicated actor
    // thread (see src/state.rs). We deliberately do NOT register native iOS
    // (Swift) / Android (Kotlin) plugin code — no `.ios_path()` / `.android_path()`
    // — so there is no Swift/Kotlin to keep in sync and no `run_mobile_plugin`
    // bridge. The `ios/` and `android/` dirs remain only as reference scaffolding
    // and are not compiled.
    tauri_plugin::Builder::new(COMMANDS).build();
}
