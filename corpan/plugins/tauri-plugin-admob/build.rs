const COMMANDS: &[&str] = &[
    "init_admob",
    "load_interstitial",
    "show_interstitial",
    "load_rewarded",
    "show_rewarded",
    "show_banner",
    "hide_banner",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
