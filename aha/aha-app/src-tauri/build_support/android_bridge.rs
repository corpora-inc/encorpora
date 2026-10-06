//! The native bridge `build.rs` adds to the generated Android MainActivity (see `native_bridge` in
//! build.rs for why). Pure text patching, so `cargo test --lib` covers it (src/lib.rs includes this
//! file under test).

pub const DEFAULT_EDGE_TO_EDGE: &str = "    enableEdgeToEdge()\n";
pub const LIGHT_STATUS_BAR: &str = "    enableEdgeToEdge(statusBarStyle = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT))\n";
pub const LIGHT_STATUS_BAR_IMPORTS: &str =
    "import android.graphics.Color\nimport androidx.activity.SystemBarStyle\n";
pub const ACTIVITY_CLASS: &str = "class MainActivity : TauriActivity() {\n";
/// Markers on the first line of this bridge and of the #917 one (system bars only), and the start of
/// the classes appended at the end of the file. A previously patched project is restored to the
/// template before the current bridge is applied, so an existing `gen/android` stays current.
const BRIDGE_MARKERS: [&str; 2] = ["// AHA native bridge", "// AHA system-bars bridge"];
const BRIDGE_END: &str = "\n  }\n\n";
const BRIDGE_CLASSES_START: &str = "\n/** Status-bar and navigation-bar icons";
pub const BRIDGE: &str = r#"  // AHA native bridge (added by aha/aha-app/src-tauri/build.rs; src/ui/systemBars.ts and
  // src/ui/keyboard.ts call it).
  override fun onWebViewCreate(webView: android.webkit.WebView) {
    webView.addJavascriptInterface(AhaSystemBars(this), "ahaSystemBars")
    AhaKeyboard.attach(this, webView)
  }
"#;
pub const BRIDGE_CLASS: &str = r#"
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
  /** IME animations in flight. One can start before the last one ends (a quick close and reopen). */
  private var animations = 0

  /** The keyboard's current overlap with the bottom of the window, device px. */
  @android.webkit.JavascriptInterface
  fun height(): Int = height

  private fun publish(px: Int, settled: Boolean) {
    if (px == height) return
    height = px
    webView.evaluateJavascript("window.__ahaKeyboard&&window.__ahaKeyboard($px,$settled)", null)
  }

  /** The keyboard has finished moving: the last frame, marked settled even if its height is unchanged. */
  private fun settle(px: Int) {
    height = px
    webView.evaluateJavascript("window.__ahaKeyboard&&window.__ahaKeyboard($px,true)", null)
  }

  companion object {
    private val IME = androidx.core.view.WindowInsetsCompat.Type.ime()

    fun attach(activity: android.app.Activity, webView: android.webkit.WebView) {
      activity.window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
      val keyboard = AhaKeyboard(webView)
      webView.addJavascriptInterface(keyboard, "ahaKeyboard")
      androidx.core.view.ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
        if (keyboard.animations == 0) keyboard.publish(insets.getInsets(IME).bottom, true)
        val withoutIme = androidx.core.view.WindowInsetsCompat.Builder(insets)
          .setInsets(IME, androidx.core.graphics.Insets.NONE)
          .build()
        androidx.core.view.ViewCompat.onApplyWindowInsets(view, withoutIme)
      }
      androidx.core.view.ViewCompat.setWindowInsetsAnimationCallback(
        webView,
        object : androidx.core.view.WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
          override fun onPrepare(animation: androidx.core.view.WindowInsetsAnimationCompat) {
            if (animation.typeMask and IME != 0) keyboard.animations++
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
            keyboard.animations = maxOf(0, keyboard.animations - 1)
            if (keyboard.animations > 0) return
            val insets = androidx.core.view.ViewCompat.getRootWindowInsets(webView) ?: return
            keyboard.settle(insets.getInsets(IME).bottom)
          }
        },
      )
    }
  }
}
"#;

/// Patches the template MainActivity source with the current bridge. Earlier versions (#868's light
/// status bar, #917's system-bars bridge, a stale copy of this one) are restored to the template
/// first. `Ok(None)` when the source already carries exactly the current bridge; `Err` when it no
/// longer matches the template this patches.
pub fn patch_main_activity(original: &str) -> Result<Option<String>, String> {
    let source = without_bridge(original)?
        .replacen(LIGHT_STATUS_BAR, DEFAULT_EDGE_TO_EDGE, 1)
        .replacen(LIGHT_STATUS_BAR_IMPORTS, "", 1);
    if source.matches(ACTIVITY_CLASS).count() != 1
        || source.matches(DEFAULT_EDGE_TO_EDGE).count() != 1
        || source.contains("onWebViewCreate")
    {
        return Err(
            "no longer matches the Tauri template this build patches; update build.rs".into(),
        );
    }
    let patched =
        source.replacen(ACTIVITY_CLASS, &format!("{ACTIVITY_CLASS}{BRIDGE}\n"), 1) + BRIDGE_CLASS;
    Ok((patched != original).then_some(patched))
}

/// The source with any earlier version of this bridge taken out: the override block inserted after
/// the class line, and the classes appended at the end of the file.
fn without_bridge(source: &str) -> Result<String, String> {
    let Some(at) = BRIDGE_MARKERS.iter().filter_map(|m| source.find(m)).min() else {
        return Ok(source.to_owned());
    };
    let drift = || {
        "carries an AHA bridge build.rs cannot remove; regenerate it with `tauri android init`"
            .to_owned()
    };
    let start = source[..at].rfind('\n').map_or(0, |i| i + 1);
    let end = source[at..]
        .find(BRIDGE_END)
        .map(|i| at + i + BRIDGE_END.len())
        .ok_or_else(drift)?;
    let classes = source
        .rfind(BRIDGE_CLASSES_START)
        .filter(|&c| c >= end)
        .ok_or_else(drift)?;
    Ok(format!("{}{}", &source[..start], &source[end..classes]))
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEMPLATE: &str = "package inc.corpora.aha\n\nimport android.os.Bundle\nimport androidx.activity.enableEdgeToEdge\n\nclass MainActivity : TauriActivity() {\n  override fun onCreate(savedInstanceState: Bundle?) {\n    enableEdgeToEdge()\n    super.onCreate(savedInstanceState)\n  }\n}\n";
    /// #917's bridge, exactly as that build.rs inserted it.
    const BRIDGE_917: &str = "  // AHA system-bars bridge (added by aha/aha-app/src-tauri/build.rs; src/ui/systemBars.ts calls it).\n  override fun onWebViewCreate(webView: android.webkit.WebView) {\n    webView.addJavascriptInterface(AhaSystemBars(this), \"ahaSystemBars\")\n  }\n";
    const CLASS_917: &str = "\n/** Status-bar and navigation-bar icons contrast with the theme the WebView actually renders. */\nprivate class AhaSystemBars(private val activity: android.app.Activity) {\n}\n";

    fn current() -> String {
        patch_main_activity(TEMPLATE)
            .unwrap()
            .expect("the template is patched")
    }

    #[test]
    fn patches_the_template_once() {
        let patched = current();
        assert!(patched.contains("AhaKeyboard.attach(this, webView)"));
        assert!(patched.contains("SOFT_INPUT_ADJUST_RESIZE"));
        assert!(patched.ends_with(BRIDGE_CLASS));
        assert_eq!(
            patch_main_activity(&patched),
            Ok(None),
            "a current project is left alone"
        );
    }

    #[test]
    fn upgrades_earlier_patches() {
        let from_917 = TEMPLATE.replacen(
            ACTIVITY_CLASS,
            &format!("{ACTIVITY_CLASS}{BRIDGE_917}\n"),
            1,
        ) + CLASS_917;
        assert_eq!(patch_main_activity(&from_917).unwrap(), Some(current()));
        let from_868 = TEMPLATE
            .replacen(DEFAULT_EDGE_TO_EDGE, LIGHT_STATUS_BAR, 1)
            .replacen(
                "import android.os.Bundle\n",
                &format!("import android.os.Bundle\n{LIGHT_STATUS_BAR_IMPORTS}"),
                1,
            );
        assert_eq!(patch_main_activity(&from_868).unwrap(), Some(current()));
        let stale = current().replacen(
            "AhaKeyboard.attach(this, webView)",
            "AhaKeyboard.attachOld(this, webView)",
            1,
        );
        assert_eq!(
            patch_main_activity(&stale).unwrap(),
            Some(current()),
            "a stale copy of this bridge is replaced"
        );
    }

    #[test]
    fn refuses_template_drift() {
        assert!(
            patch_main_activity(&TEMPLATE.replace("enableEdgeToEdge()", "enableEdgeToEdge(x)"))
                .is_err()
        );
        assert!(
            patch_main_activity(&TEMPLATE.replace(
                "class MainActivity : TauriActivity() {",
                "class MainActivity : AppCompatActivity() {"
            ))
            .is_err()
        );
        let truncated = current();
        let truncated = &truncated[..truncated.find(BRIDGE_CLASSES_START).unwrap()];
        assert!(
            patch_main_activity(truncated).is_err(),
            "a bridge without its classes is drift"
        );
    }
}
