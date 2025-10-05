// src/util/speakWithStackPrefs.ts
// Selects a voiceId from the active stack's voicePrefs for the given language,
// honoring random/sequence settings, then calls TTS with that voiceId.
// Falls back to a region-hinted language if there are no prefs,
// or if none of the preferred IDs are currently available.

import { createVoiceTTS } from "@/util/speak";
import { useSettingsStore } from "@/store/settings";
import { getVoices } from "@/util/tts-voices";

const REGION_HINT: Record<string, string> = {
    en: "en-US",
    es: "es-MX",
    "zh-Hant": "zh-TW",
    "zh-Hans": "zh-CN",
};

function preferRegion(tag: string): string {
    if (REGION_HINT[tag]) return REGION_HINT[tag];
    const base = tag.split("-")[0];
    return REGION_HINT[base] ?? tag;
}

/**
 * Speak using active stack prefs:
 *  - If prefs exist for `uiCode` or its base, pick voiceId via random/sequence and send it to TTS.
 *  - If no prefs or none are available, fallback to a region-hinted lang tag without a voiceId.
 */
export async function speakWithStackPrefs(uiCode: string, text: string, rate: number) {
    const state = useSettingsStore.getState();
    const { voicePrefs, nextVoiceId } = state;

    const base = uiCode.split("-")[0];

    // Merge exact + base ids (exact first), and decide which "langKey" drives the mode/cycle index.
    const exactPref = voicePrefs[uiCode];
    const basePref = voicePrefs[base];

    const exactIds = exactPref?.ids ?? [];
    const baseIds = basePref?.ids ?? [];
    const mergedPrefIds = Array.from(new Set([...exactIds, ...baseIds]));

    const langKeyForMode = exactPref ? uiCode : base; // which entry's mode we honor
    const mode = (exactPref?.mode ?? basePref?.mode) || "cycle";

    if (mergedPrefIds.length === 0) {
        // No prefs → better default region tag, no explicit voiceId
        const regioned = preferRegion(uiCode);
        await createVoiceTTS(regioned)(text, rate);
        return;
    }

    // Validate against currently available voices to avoid passing orphaned IDs.
    // (This also lets us speak in the browser with voiceURI if native isn't available.)
    const available = await getVoices({});
    const availableIdsSet = new Set(available.map((v) => v.id));

    // Intersect preferred ids with available.
    const pool = mergedPrefIds.filter((id) => availableIdsSet.has(id));
    if (pool.length === 0) {
        // None of the preferred IDs exist right now → regioned fallback without voiceId
        const regioned = preferRegion(uiCode);
        await createVoiceTTS(regioned)(text, rate);
        return;
    }

    // Pick the id according to mode
    let chosenId: string | undefined;
    if (mode === "random") {
        chosenId = pool[Math.floor(Math.random() * pool.length)];
    } else {
        // Use store's cycle pointer so it's consistent across calls
        chosenId = nextVoiceId(langKeyForMode, pool);
    }

    // Speak with the explicit voiceId; keep uiCode as-is (voiceId wins on native paths)
    await createVoiceTTS(uiCode)(text, rate, chosenId);
}
