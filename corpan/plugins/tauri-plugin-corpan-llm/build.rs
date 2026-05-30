const COMMANDS: &[&str] = &[
    "llm_status",
    "llm_load",
    "llm_chat",
    "llm_stop",
    "llm_unload",
    "llm_query_pack_db",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
