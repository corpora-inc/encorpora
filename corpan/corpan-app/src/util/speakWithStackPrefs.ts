// Select a voiceId from the active stack's voicePrefs for the given uiCode,
// honoring random/sequence; fall back to speaking by language if no preferred
// IDs are currently available.

import { createVoiceTTS } from "@/util/speak";
import { useSettingsStore } from "@/store/settings";
import { getVoices } from "@/util/tts-voices";

export async function speakWithStackPrefs(uiCode: string, text: string, rate: number) {
    const state = useSettingsStore.getState();
    const { voicePrefs, nextVoiceId } = state;

    const base = uiCode.split("-")[0];

    // Prefer exact prefs; fall back to base-language prefs
    const exactPref = voicePrefs[uiCode];
    const basePref = voicePrefs[base];

    const exactIds = exactPref?.ids ?? [];
    const baseIds = basePref?.ids ?? [];
    const mergedPrefIds = Array.from(new Set([...exactIds, ...baseIds]));

    // If there are no prefs at all, just speak with language
    console.log("mergedPrefIds", mergedPrefIds);
    if (mergedPrefIds.length === 0) {
        await createVoiceTTS(uiCode)(text, rate);
        return;
    }

    // Validate against currently available voices (native first, browser fallback)
    const available = await getVoices({});
    const availableIds = new Set(available.map((v) => v.id));
    const pool = mergedPrefIds.filter((id) => availableIds.has(id));

    console.warn(pool)
    if (pool.length === 0) {
        // Preferred IDs aren’t installed/available right now; speak by language
        await createVoiceTTS(uiCode)(text, rate);
        return;
    }

    // Use the exact entry’s mode if present; otherwise base
    const langKeyForMode = exactPref ? uiCode : base;
    const chosenId = nextVoiceId(langKeyForMode, pool);

    await createVoiceTTS(uiCode)(text, rate, chosenId);
}
