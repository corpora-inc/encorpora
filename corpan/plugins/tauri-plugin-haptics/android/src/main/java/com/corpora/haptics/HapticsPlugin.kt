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
            // Use a real one-shot with strong amplitude rather than the
            // predefined EFFECT_* tokens — on many phones (notably Samsung) the
            // predefined "click/tick" effects are barely perceptible and respect
            // a system touch-feedback toggle that's often off, so a deliberate
            // reveal haptic goes unfelt. A duration + amplitude one-shot is
            // reliably felt across devices.
            when (args.style) {
                "light" -> strongOneShot(vib, ms = 18L, amplitude = 110)
                "heavy" -> strongOneShot(vib, ms = 55L, amplitude = 255)
                "success" -> waveform(vib, longArrayOf(0, 35, 60, 55))
                "warning" -> waveform(vib, longArrayOf(0, 45, 80, 70))
                // "medium" and any unknown value
                else -> strongOneShot(vib, ms = 32L, amplitude = 190)
            }
        } catch (t: Throwable) {
            android.util.Log.w("Haptics", "Vibrate failed: ${t.message}")
        }

        // Fire-and-forget — always resolve, never block.
        invoke.resolve()
    }

    /** A deliberately-felt one-shot: [ms] long at [amplitude] (1..255), honoring
     *  amplitude control where the device supports it. */
    private fun strongOneShot(vib: Vibrator, ms: Long, amplitude: Int) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val amp =
                if (vib.hasAmplitudeControl()) amplitude.coerceIn(1, 255)
                else VibrationEffect.DEFAULT_AMPLITUDE
            vib.vibrate(VibrationEffect.createOneShot(ms, amp))
        } else {
            @Suppress("DEPRECATION")
            vib.vibrate(ms)
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
