package com.corpora.tauri.subscriptions

import android.app.Activity
import android.content.Intent
import android.net.Uri
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@TauriPlugin
class SubscriptionsPlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun showManageSubscriptions(invoke: Invoke) {
        // Play Billing subscription-management lives in the Play Store app.
        // Deep-link to the per-package subscriptions page so the user lands
        // on Corpan's subs, not the generic account page.
        val uri = Uri.parse(
            "https://play.google.com/store/account/subscriptions?package=${activity.packageName}"
        )
        val intent = Intent(Intent.ACTION_VIEW, uri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            // Prefer the Play Store app if available — falls back to browser otherwise.
            setPackage("com.android.vending")
        }
        try {
            activity.startActivity(intent)
            invoke.resolve()
        } catch (e: Exception) {
            // Retry without the Play Store package hint (e.g. device without Play Store).
            val fallback = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            try {
                activity.startActivity(fallback)
                invoke.resolve()
            } catch (e2: Exception) {
                invoke.reject("Failed to open subscription management: ${e2.message}")
            }
        }
    }
}
