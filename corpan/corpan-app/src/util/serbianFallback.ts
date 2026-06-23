// Deterministic Serbian Cyrillic → Latin (Gajica) transliteration shim,
// used at TTS speak-time to route Serbian playback through a Croatian
// voice on platforms where Apple/Google haven't shipped a Serbian voice
// (currently iOS — Android has Milena natively, so the shim won't
// trigger there because a `sr` voice is in the available list).
//
// One-to-one bijection — same map used server-side in
// `dja/cor/management/commands/romanize_sr.py` to fill the
// `cor_translation.romanization` column.
//
// Removable as a unit: when Apple ships a Serbian voice, the
// availability-driven gate in `speak.ts` will skip this path
// automatically. To delete the shim entirely, drop this file and the
// `maybeApplySerbianFallback` call in `createVoiceTTS{,Concurrent}`.

import type { VoiceInfo } from "@/util/tts-voices";

const SR_CYR_TO_LAT_SIMPLE: Record<string, string> = {
    "А": "A", "а": "a",
    "Б": "B", "б": "b",
    "В": "V", "в": "v",
    "Г": "G", "г": "g",
    "Д": "D", "д": "d",
    "Ђ": "Đ", "ђ": "đ",
    "Е": "E", "е": "e",
    "Ж": "Ž", "ж": "ž",
    "З": "Z", "з": "z",
    "И": "I", "и": "i",
    "Ј": "J", "ј": "j",
    "К": "K", "к": "k",
    "Л": "L", "л": "l",
    "М": "M", "м": "m",
    "Н": "N", "н": "n",
    "О": "O", "о": "o",
    "П": "P", "п": "p",
    "Р": "R", "р": "r",
    "С": "S", "с": "s",
    "Т": "T", "т": "t",
    "Ћ": "Ć", "ћ": "ć",
    "У": "U", "у": "u",
    "Ф": "F", "ф": "f",
    "Х": "H", "х": "h",
    "Ц": "C", "ц": "c",
    "Ч": "Č", "ч": "č",
    "Ш": "Š", "ш": "š",
};

const SR_DIGRAPH_LOWER: Record<string, string> = {
    "љ": "lj", "њ": "nj", "џ": "dž",
};

// Title vs all-caps disambiguation: if the next char in the run is
// also an uppercase Cyrillic letter, treat the digraph as part of an
// all-caps word; otherwise use Title-cased ("Lj" not "LJ").
const SR_DIGRAPH_UPPER: Record<string, [string, string]> = {
    "Љ": ["Lj", "LJ"],
    "Њ": ["Nj", "NJ"],
    "Џ": ["Dž", "DŽ"],
};

export function transliterateSerbianCyrillicToLatin(text: string): string {
    let out = "";
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch in SR_DIGRAPH_LOWER) {
            out += SR_DIGRAPH_LOWER[ch];
        } else if (ch in SR_DIGRAPH_UPPER) {
            const [title, upper] = SR_DIGRAPH_UPPER[ch];
            const next = i + 1 < text.length ? text[i + 1] : "";
            const nextIsUpperCyr = !!next
                && next === next.toUpperCase()
                && next in SR_CYR_TO_LAT_SIMPLE;
            out += nextIsUpperCyr ? upper : title;
        } else if (ch in SR_CYR_TO_LAT_SIMPLE) {
            out += SR_CYR_TO_LAT_SIMPLE[ch];
        } else {
            out += ch;
        }
    }
    return out;
}

/**
 * If we're about to speak Serbian text but no Serbian voice is available
 * in the OS voice list, transliterate Cyrillic → Latin (Gajica) and swap
 * the lang tag to Croatian. Returns the (possibly rewritten) text and
 * lang tag, plus a debug flag.
 *
 * Triggers when:
 *   - langPrefix's base tag is "sr"
 *   - no voice with base lang "sr" exists in the provided voice list
 *
 * Skips otherwise — so on Android (Milena is preinstalled) and on a
 * future iOS that ships a Serbian voice, this is a no-op.
 */
export function maybeApplySerbianFallback(
    text: string,
    langPrefix: string,
    availableVoices: VoiceInfo[],
): { text: string; langPrefix: string; applied: boolean } {
    const base = langPrefix.split("-")[0].toLowerCase();
    if (base !== "sr") return { text, langPrefix, applied: false };

    const hasSerbian = availableVoices.some(
        (v) => (v.language || "").toLowerCase().split("-")[0] === "sr",
    );
    if (hasSerbian) return { text, langPrefix, applied: false };

    return {
        text: transliterateSerbianCyrillicToLatin(text),
        langPrefix: "hr",
        applied: true,
    };
}
