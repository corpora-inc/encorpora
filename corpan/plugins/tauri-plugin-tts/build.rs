const COMMANDS: &[&str] = &[
    "speak",
    "stop",
    "open_tts_settings",
    "install_tts_data_if_supported",
    "list_voices",
    "get_tts_engine_status",
    "open_tts_engine_store",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
