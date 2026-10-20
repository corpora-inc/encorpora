// The only tracked file under gen/: `tauri android init` keeps an existing
// MainActivity and regenerates the rest of the project around it.
//
// Phones are portrait-only; tablets rotate freely. The policy is applied
// before the window is created, and again when a foldable or resizable
// window changes its smallest width.
package inc.corpora.amp

import android.content.pm.ActivityInfo
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    applyOrientationPolicy(resources.configuration)
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    applyOrientationPolicy(newConfig)
  }

  private fun applyOrientationPolicy(configuration: Configuration) {
    val orientation =
      if (configuration.smallestScreenWidthDp < TABLET_SMALLEST_WIDTH_DP) {
        ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
      } else {
        ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
      }
    if (requestedOrientation != orientation) requestedOrientation = orientation
  }

  private companion object {
    const val TABLET_SMALLEST_WIDTH_DP = 600
  }
}
