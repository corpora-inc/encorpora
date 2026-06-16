package com.corpora.haptics

import android.app.Activity
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
internal class ImpactArgs {
    var style: String = "medium"
}

@TauriPlugin
class HapticsPlugin(private val activity: Activity) : Plugin(activity) {

    private val vibrator: Vibrator? by lazy { resolveVibrator() }

    private fun resolveVibrator(): Vibrator? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val mgr = activity.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)
                    as? VibratorManager
                mgr?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                activity.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
        } catch (t: Throwable) {
            android.util.Log.w("Haptics", "Vibrator unavailable: ${t.message}")
            null
        }
    }

    @Command
    fun impact(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(ImpactArgs::class.java)
        } catch (e: Exception) {
            invoke.reject("Invalid args: ${e.message}")
            return
        }

        val vib = vibrator
        if (vib == null || !vib.hasVibrator()) {
            // No vibrator hardware — fire-and-forget, treat as success.
            invoke.resolve()
            return
        }

        try {
            when (args.style) {
                "light" -> oneShot(vib, predefined = effectTick(), fallbackMs = 20L)
                "heavy" -> oneShot(vib, predefined = effectHeavyClick(), fallbackMs = 50L)
                "success" -> waveform(vib, longArrayOf(0, 20, 60, 20))
                "warning" -> waveform(vib, longArrayOf(0, 30, 80, 30))
                // "medium" and any unknown value
                else -> oneShot(vib, predefined = effectClick(), fallbackMs = 35L)
            }
        } catch (t: Throwable) {
            android.util.Log.w("Haptics", "Vibrate failed: ${t.message}")
        }

        // Fire-and-forget — always resolve, never block.
        invoke.resolve()
    }

    private fun effectTick(): Int? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) VibrationEffect.EFFECT_TICK else null

    private fun effectClick(): Int? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) VibrationEffect.EFFECT_CLICK else null

    private fun effectHeavyClick(): Int? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) VibrationEffect.EFFECT_HEAVY_CLICK else null

    /** Prefer a predefined effect (API 29+); otherwise a one-shot of [fallbackMs]. */
    private fun oneShot(vib: Vibrator, predefined: Int?, fallbackMs: Long) {
        if (predefined != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            vib.vibrate(VibrationEffect.createPredefined(predefined))
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vib.vibrate(
                VibrationEffect.createOneShot(fallbackMs, VibrationEffect.DEFAULT_AMPLITUDE)
            )
        } else {
            @Suppress("DEPRECATION")
            vib.vibrate(fallbackMs)
        }
    }

    private fun waveform(vib: Vibrator, timings: LongArray) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vib.vibrate(VibrationEffect.createWaveform(timings, -1))
        } else {
            @Suppress("DEPRECATION")
            vib.vibrate(timings, -1)
        }
    }
}
