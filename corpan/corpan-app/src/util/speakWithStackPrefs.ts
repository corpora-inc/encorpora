// Select a voiceId from the active stack's voicePrefs for the given uiCode,
// honoring random/sequence; fall back to speaking by language if no preferred
// IDs are currently available.

import { createVoiceTTS, createVoiceTTSConcurrent } from "@/util/speak";
import { useSettingsStore } from "@/store/settings";
import { getVoicesCached } from "@/util/tts-voices";
import { incrementSegmentCounter } from "@/util/analytics";

/**
 * Helper to get the voice ID to use based on stack preferences.
 * Returns undefined if no preferred voice is available.
 */
async function getPreferredVoiceId(uiCode: string): Promise<string | undefined> {
    const state = useSettingsStore.getState();
    const { voicePrefs, nextVoiceId } = state;

    const base = uiCode.split("-")[0];

    // Prefer exact prefs; fall back to base-language prefs
    const exactPref = voicePrefs[uiCode];
    const basePref = voicePrefs[base];

    const exactIds = exactPref?.ids ?? [];
    const baseIds = basePref?.ids ?? [];
    const mergedPrefIds = Array.from(new Set([...exactIds, ...baseIds]));

    if (mergedPrefIds.length === 0) {
        return undefined;
    }

    // Validate against currently available voices (native first, browser fallback)
    const available = await getVoicesCached({ maxAgeMs: 30_000 });
    const availableIds = new Set(available.map((v) => v.id));
    const pool = mergedPrefIds.filter((id) => availableIds.has(id));

    if (pool.length === 0) {
        return undefined;
    }

    // Use the exact entry's mode if present; otherwise base
    const langKeyForMode = exactPref ? uiCode : base;
    return nextVoiceId(langKeyForMode, pool);
}

export async function speakWithStackPrefs(uiCode: string, text: string, rate: number) {
    incrementSegmentCounter(uiCode);
    const chosenId = await getPreferredVoiceId(uiCode);
    await createVoiceTTS(uiCode)(text, rate, chosenId);
}

/**
 * Speak concurrently using the synthesizer pool (allows overlapping audio on macOS/iOS).
 * On Android, falls back to sequential playback due to platform limitations.
 * Returns an utterance ID for tracking completion.
 */
export async function speakConcurrentWithStackPrefs(uiCode: string, text: string, rate: number): Promise<string> {
    incrementSegmentCounter(uiCode);
    const chosenId = await getPreferredVoiceId(uiCode);
    return await createVoiceTTSConcurrent(uiCode)(text, rate, chosenId);
}
