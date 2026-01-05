const COMMANDS: &[&str] = &["list_game_packs", "get_game_pack_manifest_url"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
