const COMMANDS: &[&str] = &[
    "play",
    "pause",
    "resume",
    "stop",
    "set_volume",
    "register_listener",
    "remove_listener",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
