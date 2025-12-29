const COMMANDS: &[&str] = &[
    "speak",
    "stop",
    "open_tts_settings",
    "install_tts_data_if_supported",
    "list_voices",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
