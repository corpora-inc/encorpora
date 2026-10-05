use std::{env, fs, path::PathBuf};

fn main() {
    println!("cargo:rerun-if-env-changed=AHA_FREE2Z_CLIENT_ID");
    println!("cargo:rerun-if-changed=android/oauth-intent.xml");
    // Do not trust NDK detection alone: our NDK 28 diagnostic still produced
    // 4 KiB ELF LOAD segments without an explicit application link policy.
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("android") {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
        println!("cargo:rustc-link-arg=-Wl,-z,common-page-size=16384");
        tauri_plugin::mobile::update_android_manifest(
            "AHA FREE2Z AUTH",
            "activity",
            include_str!("android/oauth-intent.xml").to_owned(),
        )
        .expect("AHA OAuth callback could not be registered");
        status_bar_follows_theme();
    }
    tauri_build::build()
}

const DEFAULT_EDGE_TO_EDGE: &str = "    enableEdgeToEdge()\n";
const LIGHT_STATUS_BAR: &str = "    enableEdgeToEdge(statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT))\n";
const LIGHT_STATUS_BAR_IMPORTS: &str =
    "import android.graphics.Color\nimport androidx.activity.SystemBarStyle\n";

/// The studio follows the system theme, and the template's bare `enableEdgeToEdge()` already picks
/// dark status-bar icons in light mode and light icons in dark mode, so the clock stays readable on
/// either paper. A project generated before that (#868 forced dark icons) is restored to the
/// template here; fresh `tauri android init` output (CI, every release) is left untouched.
fn status_bar_follows_theme() {
    println!("cargo:rerun-if-env-changed=TAURI_ANDROID_PROJECT_PATH");
    println!("cargo:rerun-if-env-changed=WRY_ANDROID_PACKAGE");
    let (Some(project), Ok(package)) = (
        env::var_os("TAURI_ANDROID_PROJECT_PATH"),
        env::var("WRY_ANDROID_PACKAGE"),
    ) else {
        return; // A plain `cargo build`/`check` for Android outside the Tauri CLI.
    };
    let mut path = PathBuf::from(project).join("app/src/main/java");
    path.extend(package.split('.'));
    path.push("MainActivity.kt");
    println!("cargo:rerun-if-changed={}", path.display());
    let Ok(source) = fs::read_to_string(&path) else {
        return;
    };
    if !source.contains(LIGHT_STATUS_BAR) {
        return;
    }
    let restored = source
        .replacen(LIGHT_STATUS_BAR, DEFAULT_EDGE_TO_EDGE, 1)
        .replacen(LIGHT_STATUS_BAR_IMPORTS, "", 1);
    fs::write(&path, restored).unwrap_or_else(|e| panic!("cannot write {}: {e}", path.display()));
}
