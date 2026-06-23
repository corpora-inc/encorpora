package com.corpora.corpan

import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import androidx.webkit.WebViewCompat

/**
 * Launcher trampoline that guarantees a usable Android System WebView exists
 * before the Tauri/wry stack is ever created.
 *
 * Why this exists: on devices where the System WebView package is missing,
 * disabled, or mid-update by the Play Store, wry's startup webview/version
 * probe aborts the whole process from native code (release builds are
 * `panic = "abort"`, see src-tauri/Cargo.toml) before any UI exists. The
 * field signature is:
 *
 *   abort <- wry::webview_version <- tauri_runtime_wry::Wry::init
 *         <- tauri::app::Builder::build <- corpan_lib::run
 *
 * It cannot be caught: `prevent_exit()` only intercepts the teardown
 * `process::exit`, and `panic = "abort"` skips unwinding. Nor can it be gated
 * from inside MainActivity.onCreate, because WryActivity.onCreate registers
 * WryLifecycleObserver, which synchronously fires Rust.create()/wryCreate()
 * and starts the native build that aborts — by the time super.onCreate()
 * returns, the abort is already racing on the native thread.
 *
 * So we put the check in front of MainActivity entirely. This is a plain
 * android.app.Activity (no AppCompat theme requirement, translucent theme in
 * the manifest) so the happy path renders nothing — it forwards to
 * MainActivity and finishes. Only the missing-WebView path shows a dialog.
 */
class LaunchGateActivity : Activity() {
    companion object {
        private const val TAG = "LaunchGate"
        // Canonical AOSP/Google System WebView provider. Deep-linking to it in
        // the store is the most common remedy; if the device uses a different
        // provider the store search still lands the user somewhere useful.
        private const val WEBVIEW_PACKAGE = "com.google.android.webview"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (isWebViewUsable()) {
            // MainActivity is launchMode=singleTask, so a plain start either
            // creates the single instance or reuses the existing one (e.g.
            // relaunch from the home icon after a WebView update) — no extra
            // intent flags needed.
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        Log.e(TAG, "No usable Android System WebView — showing guidance instead of letting wry abort the process")
        showWebViewUnavailableDialog()
    }

    private fun isWebViewUsable(): Boolean {
        return try {
            // Non-throwing across API levels via the support lib. Returns null
            // when no provider is currently selected/enabled, which is exactly
            // the condition that makes wry abort downstream.
            WebViewCompat.getCurrentWebViewPackage(this) != null
        } catch (t: Throwable) {
            // Any failure to even resolve the provider means we can't run.
            Log.e(TAG, "WebView provider lookup failed", t)
            false
        }
    }

    private fun showWebViewUnavailableDialog() {
        AlertDialog.Builder(this)
            .setTitle("Android System WebView needed")
            .setMessage(
                "Corpán needs Android System WebView to run, but it appears to be " +
                    "missing, disabled, or updating on this device.\n\n" +
                    "Please enable or update Android System WebView, then reopen Corpán."
            )
            .setCancelable(false)
            .setPositiveButton("Update") { _, _ ->
                openWebViewInStore()
                finish()
            }
            .setNegativeButton("Close") { _, _ -> finish() }
            .show()
    }

    private fun openWebViewInStore() {
        try {
            startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$WEBVIEW_PACKAGE"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (_: ActivityNotFoundException) {
            try {
                startActivity(
                    Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=$WEBVIEW_PACKAGE")
                    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            } catch (t: Throwable) {
                Log.e(TAG, "Could not open store for WebView update", t)
            }
        }
    }
}
