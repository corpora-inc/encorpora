const COMMANDS: &[&str] = &["show_manage_subscriptions"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
