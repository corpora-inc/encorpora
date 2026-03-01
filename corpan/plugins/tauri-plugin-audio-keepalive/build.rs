const COMMANDS: &[&str] = &[
    "start_audio_keepalive",
    "stop_audio_keepalive",
    "update_now_playing",
    "pause_audio_keepalive",
    "resume_audio_keepalive",
    "register_listener",
    "remove_listener",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
