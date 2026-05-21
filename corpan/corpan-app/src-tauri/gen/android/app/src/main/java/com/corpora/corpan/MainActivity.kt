package com.corpora.corpan

import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Lightweight back-press handler to prevent ANR in onBackPressed
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        finish()
      }
    })
  }

  override val handleBackNavigation: Boolean = false

  override fun onDestroy() {
    // Defensive WebView teardown to avoid destroyFunctor SIGSEGV
    // (Android framework bug on WebView destruction)
    try {
      cleanupWebViews(window.decorView as? ViewGroup)
    } catch (_: Throwable) {
      // Best-effort; don't let cleanup crash the teardown path
    }
    super.onDestroy()
  }

  private fun cleanupWebViews(viewGroup: ViewGroup?) {
    if (viewGroup == null) return
    for (i in viewGroup.childCount - 1 downTo 0) {
      val child = viewGroup.getChildAt(i)
      if (child is WebView) {
        child.stopLoading()
        child.loadUrl("about:blank")
        // Signal the renderer to flush pending GPU work before we tear down
        // the Surface/BufferQueue. Shrinks (does not close) the libgui
        // FenceMonitor mutex-after-destroy race that abort()s the process
        // with "pthread_mutex_lock called on a destroyed mutex".
        child.onPause()
        viewGroup.removeView(child)
        child.destroy()
      } else if (child is ViewGroup) {
        cleanupWebViews(child)
      }
    }
  }
}
