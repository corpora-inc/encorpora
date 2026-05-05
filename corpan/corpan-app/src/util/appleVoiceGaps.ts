// Apple iOS voice catalog gaps for languages we ship in Corpán.
//
// `AVSpeechSynthesizer` on iOS exposes a smaller voice set than macOS
// `NSSpeechSynthesizer`. The codes below are languages that Corpán
// supports but for which Apple does NOT ship a voice on a typical
// iOS install — so the conventional "Install voices" guidance is
// misleading: the voice doesn't exist to install.
//
// Verified empirically against `getVoices()` on a current iOS build:
// see `__corpanDebug.dumpVoices()` in `main.tsx`.
//
// Add/remove codes when Apple ships new voices (or pulls existing ones).
// Match is by lang-code equality OR by base lang-tag, so listing `pa-Arab`
// and `pa-Guru` separately is intentional — both Punjabi scripts are
// independently selectable as learning languages.
//
// NOTE: Serbian (`sr`) is NOT in this list because the runtime shim in
// `serbianFallback.ts` transliterates Cyrillic → Latin and routes
// playback through the Croatian voice automatically. Users get audible,
// near-correct pronunciation without ever seeing an empty-voice state.

export const APPLE_IOS_VOICE_GAPS: ReadonlySet<string> = new Set([
    "ne",        // Nepali
    "lt",        // Lithuanian (macOS has Onda; iOS does not)
    "gu",        // Gujarati
    "ur",        // Urdu
    "sw",        // Swahili
    "pa-Arab",   // Punjabi (Shahmukhi)
    "pa-Guru",   // Punjabi (Gurmukhi)
]);

/** True iff Apple iOS lacks a built-in voice for this learner language. */
export function isAppleIOSVoiceGap(code: string): boolean {
    if (APPLE_IOS_VOICE_GAPS.has(code)) return true;
    const base = code.split("-")[0];
    return APPLE_IOS_VOICE_GAPS.has(base);
}
