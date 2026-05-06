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
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
