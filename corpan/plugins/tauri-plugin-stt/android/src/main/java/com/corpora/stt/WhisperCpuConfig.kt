package com.corpora.stt

import android.util.Log
import java.io.BufferedReader
import java.io.FileReader

/**
 * Detects how many "high-performance" CPU cores this device has and
 * uses that count as the `n_threads` ggml should fan out across.
 *
 * Adapted directly from whisper.cpp's own `examples/whisper.android/lib/.../WhisperCpuConfig.kt`.
 * The point isn't just throughput — it's avoiding the crash family
 * where ggml workers get scheduled across performance + efficiency
 * clusters and read torn memory between them. Snapdragon 8 Elite has
 * 2 prime + 6 perf + 4 efficiency cores; we want 8, not 12.
 *
 * Two heuristics, fall through in order:
 *
 *   1. `/sys/.../cpufreq/cpuinfo_max_freq` per CPU → bin by max
 *      frequency, drop the slowest bucket. The fastest buckets are
 *      the prime + perf cores.
 *
 *   2. `/proc/cpuinfo` "CPU variant" → bin by variant id. Same idea
 *      using a different signal (ARM core type) when the cpufreq
 *      tree is locked down.
 *
 *   3. `Runtime.availableProcessors() - 4` floor — assume 4
 *      efficiency cores on modern phones.
 *
 *   4. `coerceAtLeast(2)` — never go below 2 threads.
 */
object WhisperCpuConfig {
    private const val TAG = "Whisper"

    val preferredThreadCount: Int by lazy {
        val n = CpuInfo.getHighPerfCpuCount().coerceAtLeast(2)
        Log.i(TAG, "preferredThreadCount = $n (perf-core detection)")
        n
    }
}

private class CpuInfo(private val lines: List<String>) {
    fun getHighPerfCpuCount(): Int = try {
        getHighPerfCpuCountByFrequencies()
    } catch (e: Exception) {
        Log.d("Whisper", "couldn't read CPU frequencies, falling back to variant", e)
        getHighPerfCpuCountByVariant()
    }

    private fun getHighPerfCpuCountByFrequencies(): Int =
        countHighPerfCores(
            getCpuValues("processor") { getMaxCpuFrequency(it.toInt()) }
        )

    private fun getHighPerfCpuCountByVariant(): Int =
        countHighPerfCores(
            getCpuValues("CPU variant") { it.substringAfter("0x").toInt(radix = 16) }
        )

    private fun getCpuValues(property: String, mapper: (String) -> Int): List<Int> =
        lines.asSequence()
            .filter { it.startsWith(property) }
            .map { mapper(it.substringAfter(':').trim()) }
            .sorted()
            .toList()

    /**
     * Count cores that are "high performance" enough to fan compute
     * across. The upstream whisper.cpp algorithm was
     * `countDroppingMin()` — drop the slowest bucket — which assumed
     * a classic ARM big.LITTLE split (4 big @ 2.8 GHz + 4 little @
     * 1.8 GHz, big/little ratio ~1.5x).
     *
     * That algorithm produces wrong answers on modern Qualcomm
     * Snapdragon 8 Gen 3 / 8 Elite, which have NO efficiency cluster
     * — all 8 cores are "big," split into 2 prime @ ~4.5 GHz and 6
     * perf @ ~3.5 GHz. The naive "drop the slowest" call drops the
     * 6 perf cores, leaving just 2 prime — which is WORSE than using
     * all 8. Whisper Small on 2 threads = >90 s; on 8 threads it's
     * the expected sub-5 s.
     *
     * Heuristic: only drop the slowest bucket when it's actually
     * efficiency-tier-slow (>1.5x ratio to the fastest). Otherwise
     * keep all cores.
     */
    private fun countHighPerfCores(values: List<Int>): Int {
        if (values.isEmpty()) return 0
        val max = values.max()
        val min = values.min()
        // No spread at all → all cores look equivalent → use all.
        if (min <= 0 || max == min) return values.size
        val ratio = max.toDouble() / min.toDouble()
        // <1.5x spread → modern Qualcomm-style all-big topology.
        // Use every core.
        if (ratio < 1.5) return values.size
        // ≥1.5x spread → classic big.LITTLE → drop the efficiency
        // bucket.
        return values.count { it > min }
    }

    companion object {
        fun getHighPerfCpuCount(): Int = try {
            readCpuInfo().getHighPerfCpuCount()
        } catch (e: Exception) {
            Log.d("Whisper", "couldn't read /proc/cpuinfo", e)
            (Runtime.getRuntime().availableProcessors() - 4).coerceAtLeast(0)
        }

        private fun readCpuInfo() = CpuInfo(
            BufferedReader(FileReader("/proc/cpuinfo")).useLines { it.toList() }
        )

        private fun getMaxCpuFrequency(cpuIndex: Int): Int {
            val path = "/sys/devices/system/cpu/cpu${cpuIndex}/cpufreq/cpuinfo_max_freq"
            return BufferedReader(FileReader(path)).use { it.readLine() }.toInt()
        }
    }
}
