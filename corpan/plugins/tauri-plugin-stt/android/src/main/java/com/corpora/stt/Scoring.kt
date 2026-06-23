package com.corpora.stt

import java.text.Normalizer
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Scoring math ported from `ios/Sources/STTPlugin.swift`. Goal: same
 * inputs → same numeric outputs on both platforms so the pack-side UI
 * is platform-agnostic.
 *
 * Phase 1 covers the single-pass (constrained-only) path. Dual-decode
 * `freeVsConstrainedSimilarity` collapses to 1.0 here, matching the
 * iOS Phase 1.
 */
object Scoring {

    /**
     * Normalize for compare: NFC, lowercase, strip punctuation/symbols,
     * then map number words → digits per language so "cuatro" and "4"
     * compare equal. Mirrors `STTPlugin.swift` `normalize`.
     */
    fun normalize(s: String, lang: String? = null): String {
        if (s.isEmpty()) return s
        val nfc = Normalizer.normalize(s, Normalizer.Form.NFC)
        val lower = nfc.lowercase()
        val sb = StringBuilder(lower.length)
        for (c in lower) {
            val type = Character.getType(c).toByte().toInt()
            val isPunctOrSymbol = when (type) {
                Character.CONNECTOR_PUNCTUATION.toInt(),
                Character.DASH_PUNCTUATION.toInt(),
                Character.START_PUNCTUATION.toInt(),
                Character.END_PUNCTUATION.toInt(),
                Character.INITIAL_QUOTE_PUNCTUATION.toInt(),
                Character.FINAL_QUOTE_PUNCTUATION.toInt(),
                Character.OTHER_PUNCTUATION.toInt(),
                Character.MATH_SYMBOL.toInt(),
                Character.CURRENCY_SYMBOL.toInt(),
                Character.MODIFIER_SYMBOL.toInt(),
                Character.OTHER_SYMBOL.toInt(),
                Character.CONTROL.toInt(),
                Character.FORMAT.toInt(),
                Character.UNASSIGNED.toInt() -> true
                else -> false
            }
            if (!isPunctOrSymbol) sb.append(c)
        }
        val collapsed = sb.toString()
            .replace(Regex("\\s+"), " ")
            .trim()

        val key = lang?.lowercase()
        val dict = if (key != null) numberWordToDigit[key] else null
        if (dict.isNullOrEmpty() || collapsed.isEmpty()) return collapsed
        return collapsed.split(' ').joinToString(" ") { w -> dict[w] ?: w }
    }

    /**
     * Whisper transcribes Spanish "cuatro" as the digit "4" but the
     * pack's expected text is the word. Mapping both to "4" lets the
     * comparison succeed. Ported 1:1 from `STTPlugin.swift`.
     */
    private val numberWordToDigit: Map<String, Map<String, String>> = mapOf(
        "en" to mapOf(
            "zero" to "0", "one" to "1", "two" to "2", "three" to "3", "four" to "4",
            "five" to "5", "six" to "6", "seven" to "7", "eight" to "8", "nine" to "9",
            "ten" to "10", "eleven" to "11", "twelve" to "12", "thirteen" to "13",
            "fourteen" to "14", "fifteen" to "15", "sixteen" to "16",
            "seventeen" to "17", "eighteen" to "18", "nineteen" to "19",
            "twenty" to "20", "thirty" to "30", "forty" to "40", "fifty" to "50",
            "sixty" to "60", "seventy" to "70", "eighty" to "80", "ninety" to "90",
            "hundred" to "100", "thousand" to "1000",
        ),
        "es" to mapOf(
            "cero" to "0", "uno" to "1", "una" to "1", "dos" to "2", "tres" to "3",
            "cuatro" to "4", "cinco" to "5", "seis" to "6", "siete" to "7",
            "ocho" to "8", "nueve" to "9", "diez" to "10", "once" to "11",
            "doce" to "12", "trece" to "13", "catorce" to "14", "quince" to "15",
            "dieciséis" to "16", "dieciseis" to "16", "diecisiete" to "17",
            "dieciocho" to "18", "diecinueve" to "19", "veinte" to "20",
            "treinta" to "30", "cuarenta" to "40", "cincuenta" to "50",
            "sesenta" to "60", "setenta" to "70", "ochenta" to "80",
            "noventa" to "90", "cien" to "100", "ciento" to "100", "mil" to "1000",
        ),
        "fr" to mapOf(
            "zéro" to "0", "zero" to "0", "un" to "1", "une" to "1", "deux" to "2",
            "trois" to "3", "quatre" to "4", "cinq" to "5", "six" to "6", "sept" to "7",
            "huit" to "8", "neuf" to "9", "dix" to "10", "onze" to "11", "douze" to "12",
            "treize" to "13", "quatorze" to "14", "quinze" to "15", "seize" to "16",
            "vingt" to "20", "trente" to "30", "quarante" to "40", "cinquante" to "50",
            "soixante" to "60", "cent" to "100", "mille" to "1000",
        ),
        "it" to mapOf(
            "zero" to "0", "uno" to "1", "una" to "1", "due" to "2", "tre" to "3",
            "quattro" to "4", "cinque" to "5", "sei" to "6", "sette" to "7",
            "otto" to "8", "nove" to "9", "dieci" to "10", "undici" to "11",
            "dodici" to "12", "tredici" to "13", "quattordici" to "14",
            "quindici" to "15", "sedici" to "16", "diciassette" to "17",
            "diciotto" to "18", "diciannove" to "19", "venti" to "20",
            "trenta" to "30", "quaranta" to "40", "cinquanta" to "50",
            "sessanta" to "60", "settanta" to "70", "ottanta" to "80",
            "novanta" to "90", "cento" to "100", "mille" to "1000",
        ),
        "de" to mapOf(
            "null" to "0", "eins" to "1", "ein" to "1", "eine" to "1", "zwei" to "2",
            "drei" to "3", "vier" to "4", "fünf" to "5", "funf" to "5", "sechs" to "6",
            "sieben" to "7", "acht" to "8", "neun" to "9", "zehn" to "10", "elf" to "11",
            "zwölf" to "12", "zwolf" to "12", "dreizehn" to "13", "vierzehn" to "14",
            "fünfzehn" to "15", "funfzehn" to "15", "sechzehn" to "16",
            "siebzehn" to "17", "achtzehn" to "18", "neunzehn" to "19",
            "zwanzig" to "20", "dreißig" to "30", "dreissig" to "30",
            "vierzig" to "40", "fünfzig" to "50", "funfzig" to "50",
            "sechzig" to "60", "siebzig" to "70", "achtzig" to "80", "neunzig" to "90",
            "hundert" to "100", "tausend" to "1000",
        ),
        "pt" to mapOf(
            "zero" to "0", "um" to "1", "uma" to "1", "dois" to "2", "duas" to "2",
            "três" to "3", "tres" to "3", "quatro" to "4", "cinco" to "5",
            "seis" to "6", "sete" to "7", "oito" to "8", "nove" to "9", "dez" to "10",
            "onze" to "11", "doze" to "12", "treze" to "13", "catorze" to "14",
            "quatorze" to "14", "quinze" to "15", "dezesseis" to "16",
            "dezasseis" to "16", "dezessete" to "17", "dezassete" to "17",
            "dezoito" to "18", "dezenove" to "19", "dezanove" to "19",
            "vinte" to "20", "trinta" to "30", "quarenta" to "40", "cinquenta" to "50",
            "cinquénta" to "50", "sessenta" to "60", "setenta" to "70",
            "oitenta" to "80", "noventa" to "90", "cem" to "100", "cento" to "100",
            "mil" to "1000",
        ),
    )

    /**
     * True if a transcribed word is pure-digit OR is a known number
     * word in the language's number-word dict. Such words have
     * unreliable per-word probabilities under the constrained decode
     * — Whisper might emit either form (digit or spelled), and
     * `prefixTokens` forces whichever the expected text uses, so the
     * per-word probability reflects "did the audio match this
     * specific surface form?" rather than "did the user say the
     * right number?"
     *
     * Used to filter `wordProbs` before computing the acoustic score.
     * Transcript scoring still catches numerals via the existing
     * `diez` ↔ `10` normalization — this only opts the acoustic
     * layer out of the digit/word ambiguity.
     *
     * Implementation: reuse `normalize()`, which already maps
     * number-words to digits per language. If the result is pure
     * digits, the word was either a digit already or a number word
     * that normalized to one — either way, uncertain.
     */
    fun isUncertainNumeralWord(word: String, lang: String?): Boolean {
        if (word.isEmpty()) return false
        val normalized = normalize(word, lang).replace(" ", "")
        if (normalized.isEmpty()) return false
        return normalized.all { it.isDigit() }
    }

    fun levenshteinSimilarity(a: String, b: String): Float {
        if (a.isEmpty() && b.isEmpty()) return 1f
        val n = a.length
        val m = b.length
        if (n == 0 || m == 0) return 0f
        var prev = IntArray(m + 1) { it }
        var curr = IntArray(m + 1)
        for (i in 1..n) {
            curr[0] = i
            for (j in 1..m) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                curr[j] = min(min(prev[j] + 1, curr[j - 1] + 1), prev[j - 1] + cost)
            }
            val tmp = prev; prev = curr; curr = tmp
        }
        val dist = prev[m].toFloat()
        return max(0f, 1f - dist / max(n, m).toFloat())
    }

    fun wordLevenshteinSimilarity(a: String, b: String): Float {
        val aw = a.split(' ').filter { it.isNotEmpty() }
        val bw = b.split(' ').filter { it.isNotEmpty() }
        if (aw.isEmpty() && bw.isEmpty()) return 1f
        if (aw.isEmpty() || bw.isEmpty()) return 0f
        val n = aw.size
        val m = bw.size
        var prev = FloatArray(m + 1) { it.toFloat() }
        var curr = FloatArray(m + 1)
        for (i in 1..n) {
            curr[0] = i.toFloat()
            for (j in 1..m) {
                curr[j] = if (aw[i - 1] == bw[j - 1]) prev[j - 1]
                else 1f + min(min(prev[j], curr[j - 1]), prev[j - 1])
            }
            val tmp = prev; prev = curr; curr = tmp
        }
        return max(0f, 1f - prev[m] / max(n, m).toFloat())
    }

    /**
     * Combined char + word similarity, matching the Swift `combinedSim`
     * helper in `computeScores`.
     */
    fun combinedSim(a: String, b: String): Float {
        val charSim = levenshteinSimilarity(a, b)
        val aHasSpaces = a.contains(' ')
        val bHasSpaces = b.contains(' ')
        if (!aHasSpaces && !bHasSpaces) return charSim
        val wordSim = wordLevenshteinSimilarity(a, b)
        return min(charSim, wordSim)
    }

    data class AcousticRamp(
        val avgZero: Float, val avgOne: Float,
        val minZero: Float, val minOne: Float,
        val textFloor: Float,
    )

    private val highResRamp = AcousticRamp(
        avgZero = 0.55f, avgOne = 0.95f,
        minZero = 0.30f, minOne = 0.85f,
        textFloor = 0.50f,
    )
    private val lowResRamp = AcousticRamp(
        avgZero = 0.45f, avgOne = 0.90f,
        minZero = 0.20f, minOne = 0.75f,
        textFloor = 0.50f,
    )
    private val smallModelRamp = AcousticRamp(
        avgZero = 0.40f, avgOne = 0.85f,
        minZero = 0.20f, minOne = 0.75f,
        textFloor = 0.50f,
    )

    private val lowResourceLangs = setOf(
        "te", "ta", "bn", "ml", "mr", "gu", "pa", "ur", "fa",
        "kn", "si", "ne", "or", "as",
    )

    fun pickAcousticRamp(modelName: String?, baseLang: String): AcousticRamp {
        val name = modelName?.lowercase() ?: ""
        if (name.contains("ggml-tiny") || name.contains("ggml-base")) {
            return smallModelRamp
        }
        return if (lowResourceLangs.contains(baseLang)) lowResRamp else highResRamp
    }

    /**
     * Overlay pack-supplied scoring overrides on top of the native
     * ramp picked by `pickAcousticRamp`. Each non-null field replaces
     * the corresponding slot; null fields leave the native default.
     * Mirrors `applyScoringOverlay` in `STTPlugin.swift`.
     */
    fun applyScoringOverlay(
        base: AcousticRamp,
        avgZero: Float?,
        avgOne: Float?,
        minZero: Float?,
        minOne: Float?,
        textFloor: Float?,
    ): AcousticRamp = AcousticRamp(
        avgZero = avgZero ?: base.avgZero,
        avgOne = avgOne ?: base.avgOne,
        minZero = minZero ?: base.minZero,
        minOne = minOne ?: base.minOne,
        textFloor = textFloor ?: base.textFloor,
    )

    fun stdev(values: List<Float>): Float {
        if (values.size < 2) return 0f
        val mean = values.average().toFloat()
        var sum = 0f
        for (v in values) {
            val d = v - mean
            sum += d * d
        }
        return sqrt(sum / values.size).toFloat()
    }

    data class Scores(
        val transcript: Float,
        val likelihood: Float,
        val acoustic: Float,
        val overall: Float,
        val earlyExitMessage: String?,
    )

    /**
     * Pack-supplied overlay on top of the native ramp + compression
     * threshold. Plain nullable Floats — keeps `Scoring.kt` a pure
     * math module with no dep on `app.tauri.annotation.InvokeArg`.
     * The Tauri-bound `ScoringParamsArg` in `SttPlugin.kt` is adapted
     * to this shape at the call site.
     */
    data class ScoringOverlay(
        val avgZero: Float? = null,
        val avgOne: Float? = null,
        val minZero: Float? = null,
        val minOne: Float? = null,
        val textFloor: Float? = null,
        val compressionThreshold: Float? = null,
    )

    /**
     * @param tokenLogprobStdev computed from per-token logprobs
     * @param noSpeechProb max across segments
     * @param compressionRatio max across segments (0 if not available)
     * @param temperature max across segments (0 for greedy / single-pass)
     */
    fun computeScores(
        wordProbs: List<Float>,
        avgLogprob: Float,
        normalizedTranscript: String,
        normalizedExpected: String,
        modelName: String?,
        baseLang: String,
        tokenLogprobStdev: Float,
        noSpeechProb: Float,
        compressionRatio: Float,
        temperature: Float,
        scoringOverrides: ScoringOverlay? = null,
    ): Scores {
        if (noSpeechProb > 0.5f) {
            return Scores(
                transcript = 0f, likelihood = 0f, acoustic = 0f, overall = 0f,
                earlyExitMessage = "Couldn't hear you — try again with the mic closer.",
            )
        }

        val transcriptScore =
            if (normalizedExpected.isEmpty()) 0f
            else combinedSim(normalizedTranscript, normalizedExpected)

        val avgWordProb = if (wordProbs.isEmpty()) 0f
        else wordProbs.sum() / wordProbs.size
        val minWordProb = wordProbs.minOrNull() ?: 0f

        val nativeRamp = pickAcousticRamp(modelName, baseLang)
        val ramp = if (scoringOverrides == null) nativeRamp else applyScoringOverlay(
            base = nativeRamp,
            avgZero = scoringOverrides.avgZero,
            avgOne = scoringOverrides.avgOne,
            minZero = scoringOverrides.minZero,
            minOne = scoringOverrides.minOne,
            textFloor = scoringOverrides.textFloor,
        )

        var acoustic: Float = if (wordProbs.isEmpty()) {
            // Fallback to avgLogprob ramp.
            max(0f, min(1f, (avgLogprob + 1.5f) / 1.5f))
        } else {
            val avgAcoustic = max(0f, min(1f,
                (avgWordProb - ramp.avgZero) / max(0.001f, ramp.avgOne - ramp.avgZero)))
            val minAcoustic = max(0f, min(1f,
                (minWordProb - ramp.minZero) / max(0.001f, ramp.minOne - ramp.minZero)))
            0.6f * avgAcoustic + 0.4f * minAcoustic
        }

        if (tokenLogprobStdev > 0.8f) acoustic *= 0.5f
        if (temperature > 0f) acoustic *= 0.8f

        val likelihood = max(0f, min(1f, 1f + avgLogprob))

        var overall: Float = if (normalizedExpected.isEmpty()) acoustic
        else transcriptScore * (ramp.textFloor + (1f - ramp.textFloor) * acoustic)

        val isLowRes = lowResourceLangs.contains(baseLang)
        val nativeCompressionThreshold = if (isLowRes) 3.5f else 2.4f
        val compressionThreshold =
            scoringOverrides?.compressionThreshold ?: nativeCompressionThreshold
        if (compressionRatio > compressionThreshold) {
            overall = min(overall, 0.4f)
        }

        return Scores(
            transcript = transcriptScore,
            likelihood = likelihood,
            acoustic = acoustic,
            overall = overall,
            earlyExitMessage = null,
        )
    }

    /** Whisper's 99 supported language codes. */
    val supportedLanguages: Set<String> = setOf(
        "en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt", "tr",
        "pl", "ca", "nl", "ar", "sv", "it", "id", "hi", "fi", "vi",
        "he", "uk", "el", "ms", "cs", "ro", "da", "hu", "ta", "no",
        "th", "ur", "hr", "bg", "lt", "la", "mi", "ml", "cy", "sk",
        "te", "fa", "lv", "bn", "sr", "az", "sl", "kn", "et", "mk",
        "br", "eu", "is", "hy", "ne", "mn", "bs", "kk", "sq", "sw",
        "gl", "mr", "pa", "si", "km", "sn", "yo", "so", "af", "oc",
        "ka", "be", "tg", "sd", "gu", "am", "yi", "lo", "uz", "fo",
        "ht", "ps", "tk", "nn", "mt", "sa", "lb", "my", "bo", "tl",
        "mg", "as", "tt", "haw", "ln", "ha", "ba", "jw", "su",
    )

    fun toBaseLang(language: String): String {
        return language.substringBefore('-').lowercase()
    }
}
