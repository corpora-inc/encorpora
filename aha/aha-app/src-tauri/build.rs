use std::{env, fs, path::PathBuf};

#[path = "build_support/client_id.rs"]
mod client_id;

fn main() {
    free2z_client_id();
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
        native_bridge();
    }
    tauri_build::build()
}

/// Bakes the public Free2Z client id into the crate as `AHA_FREE2Z_CLIENT_ID_RESOLVED` (empty when
/// unconfigured). The env var alone does not survive `tauri ios build`; see `build_support/client_id.rs`.
fn free2z_client_id() {
    let manifest = PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let file = manifest.join(client_id::FILE);
    println!("cargo:rerun-if-env-changed={}", client_id::ENV_VAR);
    // The directory always exists (its .gitignore is tracked), so watching it never forces a rerun.
    println!(
        "cargo:rerun-if-changed={}",
        file.parent().expect("config directory").display()
    );
    let from_env = env::var(client_id::ENV_VAR).ok();
    let from_file = match fs::read_to_string(&file) {
        Ok(text) => Some(text),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => panic!("cannot read {}: {e}", file.display()),
    };
    let id = client_id::resolve(from_env.as_deref(), from_file.as_deref())
        .unwrap_or_else(|why| panic!("invalid Free2Z client id configuration: {why}"));
    if id.is_none() {
        println!(
            "cargo:warning=No Free2Z client id ({} or {}); this build has sign-in disabled",
            client_id::ENV_VAR,
            client_id::FILE
        );
    }
    println!(
        "cargo:rustc-env={}={}",
        client_id::RESOLVED_VAR,
        id.unwrap_or_default()
    );
}

const DEFAULT_EDGE_TO_EDGE: &str = "    enableEdgeToEdge()\n";
const LIGHT_STATUS_BAR: &str = "    enableEdgeToEdge(statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT))\n";
const LIGHT_STATUS_BAR_IMPORTS: &str =
    "import android.graphics.Color\nimport androidx.activity.SystemBarStyle\n";
const ACTIVITY_CLASS: &str = "class MainActivity : TauriActivity() {\n";
/// Markers on the first line of this bridge and of the #917 one (system bars only), and the start of
/// the classes appended at the end of the file. A previously patched project is restored to the
/// template before the current bridge is applied, so an existing `gen/android` stays current.
const BRIDGE_MARKERS: [&str; 2] = ["// AHA native bridge", "// AHA system-bars bridge"];
const BRIDGE_END: &str = "\n  }\n\n";
const BRIDGE_CLASSES_START: &str = "\n/** Status-bar and navigation-bar icons";
const BRIDGE: &str = r#"  // AHA native bridge (added by aha/aha-app/src-tauri/build.rs; src/ui/systemBars.ts and
  // src/ui/keyboard.ts call it).
  override fun onWebViewCreate(webView: android.webkit.WebView) {
    webView.addJavascriptInterface(AhaSystemBars(this), "ahaSystemBars")
    AhaKeyboard.attach(this, webView)
  }
"#;
const BRIDGE_CLASS: &str = r#"
/** Status-bar and navigation-bar icons contrast with the theme the WebView actually renders. */
private class AhaSystemBars(private val activity: android.app.Activity) {
  @android.webkit.JavascriptInterface
  fun setDark(dark: Boolean) {
    activity.runOnUiThread {
      val bars = androidx.core.view.WindowCompat.getInsetsController(activity.window, activity.window.decorView)
      bars.isAppearanceLightStatusBars = !dark
      bars.isAppearanceLightNavigationBars = !dark
    }
  }
}

/**
 * The software keyboard overlays the page. The window is edge-to-edge and adjustResize, so the
 * system neither resizes nor pans it, and the WebView never sees the IME inset, so it never shrinks
 * its viewport or scrolls the page. The keyboard's height reaches the page instead, as
 * `window.__ahaKeyboard(px, settled)` on every frame of the keyboard's own animation, and the page
 * moves only the answer dock, in step with the keyboard (src/ui/keyboard.ts).
 */
private class AhaKeyboard private constructor(private val webView: android.webkit.WebView) {
  @Volatile private var height = 0
  private var animating = false

  /** The keyboard's current overlap with the bottom of the window, device px. */
  @android.webkit.JavascriptInterface
  fun height(): Int = height

  private fun publish(px: Int, settled: Boolean) {
    if (px == height && !settled) return
    height = px
    webView.evaluateJavascript("window.__ahaKeyboard&&window.__ahaKeyboard($px,$settled)", null)
  }

  companion object {
    private val IME = androidx.core.view.WindowInsetsCompat.Type.ime()

    fun attach(activity: android.app.Activity, webView: android.webkit.WebView) {
      activity.window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
      val keyboard = AhaKeyboard(webView)
      webView.addJavascriptInterface(keyboard, "ahaKeyboard")
      androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
        if (!keyboard.animating) keyboard.publish(insets.getInsets(IME).bottom, true)
        val withoutIme = androidx.core.view.WindowInsetsCompat.Builder(insets)
          .setInsets(IME, androidx.core.graphics.Insets.NONE)
          .build()
        androidx.core.view.ViewCompat.onApplyWindowInsets(view, withoutIme)
      }
      androidx.core.view.ViewCompat.setWindowInsetsAnimationCallback(
        webView,
        object : androidx.core.view.WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
          override fun onPrepare(animation: androidx.core.view.WindowInsetsAnimationCompat) {
            if (animation.typeMask and IME != 0) keyboard.animating = true
          }

          override fun onProgress(
            insets: androidx.core.view.WindowInsetsCompat,
            running: MutableList<androidx.core.view.WindowInsetsAnimationCompat>,
          ): androidx.core.view.WindowInsetsCompat {
            if (running.any { it.typeMask and IME != 0 }) keyboard.publish(insets.getInsets(IME).bottom, false)
            return insets
          }

          override fun onEnd(animation: androidx.core.view.WindowInsetsAnimationCompat) {
            if (animation.typeMask and IME == 0) return
            keyboard.animating = false
            val insets = androidx.core.view.ViewCompat.getRootWindowInsets(webView) ?: return
            keyboard.publish(insets.getInsets(IME).bottom, true)
          }
        },
      )
    }
  }
}
"#;

/// The generated MainActivity gets a small native bridge with two parts.
///
/// System bars: the studio's light/dark theme follows the WebView's `prefers-color-scheme`, but
/// Android WebView does not always agree with the system night mode (a Samsung S26 on Android 16
/// reported light in night mode), and the template's one-shot `enableEdgeToEdge()` picks icons from
/// the system setting at launch and never again. So the frontend reports the scheme it renders, and
/// every change of it, and the icons follow that.
///
/// Keyboard: the keyboard overlays the page (adjustResize under edge-to-edge, with the IME inset kept
/// from the WebView), and its height is pushed to the page on every animation frame, so only the
/// answer dock moves, in step with it. Without this the system panned the window and the page's own
/// dock math moved the dock too: the answer bounced to mid-screen and the problem left the screen.
///
/// The Android project is regenerated by `tauri android init` (CI, every release), so this patches
/// it beside the manifest patch; it panics if the template drifts. A project patched by #868 (forced
/// dark icons) or #917 (the system-bars bridge alone) is restored first.
fn native_bridge() {
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
    let source =
        fs::read_to_string(&path).unwrap_or_else(|e| panic!("cannot read {}: {e}", path.display()));
    let original = source;
    let source = without_bridge(&original, &path)
        .replacen(LIGHT_STATUS_BAR, DEFAULT_EDGE_TO_EDGE, 1)
        .replacen(LIGHT_STATUS_BAR_IMPORTS, "", 1);
    assert!(
        source.matches(ACTIVITY_CLASS).count() == 1
            && source.matches(DEFAULT_EDGE_TO_EDGE).count() == 1
            && !source.contains("onWebViewCreate"),
        "{} no longer matches the Tauri template this build patches; update build.rs",
        path.display()
    );
    let patched =
        source.replacen(ACTIVITY_CLASS, &format!("{ACTIVITY_CLASS}{BRIDGE}\n"), 1) + BRIDGE_CLASS;
    if patched == original {
        return;
    }
    let modified = fs::metadata(&path).and_then(|m| m.modified());
    fs::write(&path, patched).unwrap_or_else(|e| panic!("cannot write {}: {e}", path.display()));
    // Keep the template's timestamp so the watch above does not rerun this script (and rebuild
    // the crate) merely because the script itself rewrote the file.
    let restored = modified.and_then(|modified| {
        fs::File::options()
            .write(true)
            .open(&path)
            .and_then(|f| f.set_modified(modified))
    });
    if let Err(e) = restored {
        println!(
            "cargo:warning=patched {} but could not restore its timestamp ({e}); the next build reruns build.rs once",
            path.display()
        );
    }
}

/// The MainActivity source with any earlier version of this bridge taken out: the override block
/// inserted after the class line, and the classes appended at the end of the file.
fn without_bridge(source: &str, path: &std::path::Path) -> String {
    let Some(at) = BRIDGE_MARKERS.iter().filter_map(|m| source.find(m)).min() else {
        return source.to_owned();
    };
    let drift = || {
        panic!(
            "{} carries an AHA bridge build.rs cannot remove; regenerate it with `tauri android init`",
            path.display()
        )
    };
    let start = source[..at].rfind('\n').map_or(0, |i| i + 1);
    let end = source[at..]
        .find(BRIDGE_END)
        .map(|i| at + i + BRIDGE_END.len())
        .unwrap_or_else(drift);
    let classes = source
        .rfind(BRIDGE_CLASSES_START)
        .filter(|&c| c >= end)
        .unwrap_or_else(drift);
    format!("{}{}", &source[..start], &source[end..classes])
}
