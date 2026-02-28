const COMMANDS: &[&str] = &[
    "start_audio_keepalive",
    "stop_audio_keepalive",
    "update_now_playing",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
