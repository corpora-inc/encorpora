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

    // Back press backgrounds the task (Home-style) instead of finish()ing
    // the Activity. finish() makes tao's event loop terminate and call
    // std::process::exit(), which runs __cxa_finalize — every C++ static
    // destructor across libhwui / libgui / vendor libs — on the loop
    // thread while the RenderThread, Mali GPU workers, and vendor
    // singletons are still live. Those teardowns abort the process with
    // "pthread_mutex_lock called on a destroyed mutex" (HardwareBitmap-
    // Uploader, hwui CommonPool), segfault in Surface::connect on a dead
    // BufferQueue, or crash in a vendor dtor (e.g. Vivo camera singleton).
    // Keeping the process resident avoids the graceful C++ shutdown
    // entirely; Android later reclaims us via SIGKILL, which runs no
    // destructors and is race-free.
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        moveTaskToBack(true)
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
