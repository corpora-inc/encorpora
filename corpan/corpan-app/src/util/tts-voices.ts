// tts-voices.ts
// Frontend helpers for Corpán voice onboarding:
// - Deep link to OS voice settings / install panels via the Tauri plugin
// - Enumerate native voices (Android/iOS/macOS) with browser fallback
// - Filter/sort voices by language and quality

import { invoke } from "@tauri-apps/api/core";

// ------------------------------- Types --------------------------------

export type VoiceQuality =
    | "default"        // Apple AVSpeech: default
    | "enhanced"       // Apple AVSpeech: enhanced
    | "very_low"       // Android Voice.QUALITY_*
    | "low"
    | "normal"
    | "high"
    | "very_high";

export type VoiceGender = "male" | "female" | "unspecified";

export interface VoiceInfo {
    id: string;
    name?: string | null;
    language: string; // BCP-47 (e.g., "en-US")
    gender?: VoiceGender;
    quality?: VoiceQuality;
    engine?: string | null; // Android engine package; otherwise null/undefined
}

// ---------------------------- Env helpers -----------------------------

type UAOS = "macos" | "ios" | "android" | "other";

export function detectOSFromUA(): UAOS {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    if (/Macintosh/i.test(ua) && !/Mobile\/\w+ Safari/i.test(ua)) return "macos";
    return "other";
}

export function baseLang(tag: string | null | undefined): string {
    if (!tag) return "";
    const t = tag.toLowerCase();
    const i = t.indexOf("-");
    return i === -1 ? t : t.slice(0, i);
}

function langMatchScore(voiceLang: string | undefined, want: string): number {
    if (!voiceLang || !want) return 0;
    const v = voiceLang.toLowerCase();
    const w = want.toLowerCase();
    if (v === w) return 3;
    const b = baseLang(w);
    if (v === b || v.startsWith(b + "-")) return 2;
    return 0;
}

function qualityRank(q?: VoiceQuality): number {
    switch (q) {
        case "very_high": return 6;
        case "high": return 5;
        case "enhanced": return 4;
        case "normal": return 3;
        case "default": return 2;
        case "low": return 1;
        case "very_low": return 0;
        default: return 2; // unknown → treat as "default-ish"
    }
}

// ------------------------ Web Speech fallback ------------------------

export const BROWSER_TTS = (() => {
    try {
        return typeof window !== "undefined" && "speechSynthesis" in window;
    } catch {
        return false;
    }
})();

async function awaitBrowserVoices(timeoutMs = 600): Promise<SpeechSynthesisVoice[]> {
    if (!BROWSER_TTS) return [];
    const existing = window.speechSynthesis.getVoices();
    if (existing && existing.length > 0) return existing;

    return new Promise((resolve) => {
        let done = false;
        const finish = (v: SpeechSynthesisVoice[]) => {
            if (done) return;
            done = true;
            resolve(v);
        };
        const timer = setTimeout(() => finish(window.speechSynthesis.getVoices() || []), timeoutMs);
        const handler = () => {
            clearTimeout(timer);
            window.speechSynthesis.removeEventListener("voiceschanged", handler);
            finish(window.speechSynthesis.getVoices() || []);
        };
        window.speechSynthesis.addEventListener("voiceschanged", handler);
        window.speechSynthesis.getVoices(); // nudge
    });
}

/** Map Web Speech voices to our VoiceInfo shape (best-effort; limited metadata). */
export async function listVoicesBrowser(): Promise<VoiceInfo[]> {
    const voices = await awaitBrowserVoices();
    return voices.map((v) => ({
        id: v.voiceURI || `${v.name}:${v.lang}`,
        name: v.name,
        language: v.lang || "",
        engine: "web-speech",
        // gender/quality are not exposed by Web Speech; leave undefined
    }));
}

// ------------------------- Native (plugin) calls ----------------------

/** Enumerate native voices (Android/iOS/macOS). Falls back to [] if plugin/command is unavailable. */
export async function listVoicesNative(): Promise<VoiceInfo[]> {
    try {
        // Rust normalizes iOS (object envelope) vs Android/mac (array) to an array,
        // so we can request an array directly here.
        const res = await invoke<VoiceInfo[]>("plugin:tts|list_voices");
        if (Array.isArray(res)) return res;
        // Safety net in case of an older iOS build returning { voices: [...] }
        const maybe = (res as unknown as { voices?: VoiceInfo[] })?.voices;
        return Array.isArray(maybe) ? maybe : [];
    } catch (e) {
        console.warn("[TTS] list_voices failed; returning []", e);
        return [];
    }
}

/** Open the OS screen where the user can manage/download TTS voices. */
export async function openTtsSettings(): Promise<boolean> {
    try {
        await invoke("plugin:tts|open_tts_settings");
        return true;
    } catch (e) {
        console.warn("[TTS] open_tts_settings failed", e);
        return false;
    }
}

/**
 * Android-only: request the engine to install/download voice data.
 * Returns true if an activity was launched; false otherwise (including non-Android).
 */
export async function installTtsDataIfSupported(): Promise<boolean> {
    try {
        const ok = await invoke<boolean>("plugin:tts|install_tts_data_if_supported");
        return !!ok;
    } catch {
        return false;
    }
}

/**
 * “Deep link” helper:
 * - Try programmatic install (Android) first.
 * - If unsupported or not launched, open the settings screen instead.
 */
export async function deepLinkToVoiceInstall(): Promise<void> {
    const launched = await installTtsDataIfSupported();
    if (!launched) {
        await openTtsSettings();
    }
}

// --------------------------- Voice utilities --------------------------

/** Sort voices for a given language preference: exact tag > base match; higher quality first; stable by name/id. */
export function sortVoicesForLanguage(voices: VoiceInfo[], langTag: string): VoiceInfo[] {
    const want = langTag || "";
    return [...voices].sort((a, b) => {
        const lA = langMatchScore(a.language, want);
        const lB = langMatchScore(b.language, want);
        if (lA !== lB) return lB - lA;

        const qA = qualityRank(a.quality);
        const qB = qualityRank(b.quality);
        if (qA !== qB) return qB - qA;

        const nA = (a.name ?? a.id).toLowerCase();
        const nB = (b.name ?? b.id).toLowerCase();
        if (nA < nB) return -1;
        if (nA > nB) return 1;
        return 0;
    });
}

/** Filter voices compatible with a language prefix (e.g., "fa" should match "fa-IR"). */
export function filterVoicesByLangPrefix(voices: VoiceInfo[], langPrefix: string): VoiceInfo[] {
    const p = (langPrefix || "").toLowerCase();
    if (!p) return voices;
    return voices.filter((v) => {
        const L = (v.language || "").toLowerCase();
        return L === p || L.startsWith(p + "-") || baseLang(L) === p;
    });
}

/**
 * High-level “get voices” API for the UI:
 * - Try native first (Android/iOS/macOS).
 * - On failure or empty, fallback to Web Speech (if available).
 * - Optional `langPrefix` lets you pre-filter to the target language family.
 */
export async function getVoices(opts?: { langPrefix?: string; preferBrowser?: boolean }): Promise<VoiceInfo[]> {
    const { langPrefix, preferBrowser } = opts ?? {};

    let voices: VoiceInfo[] = [];
    try {
        if (preferBrowser) {
            voices = await listVoicesBrowser();
            if (voices.length === 0) voices = await listVoicesNative();
        } else {
            voices = await listVoicesNative();
            if (voices.length === 0) voices = await listVoicesBrowser();
        }
    } catch {
        // swallow; we’ll return whatever we have
    }

    if (langPrefix) {
        voices = filterVoicesByLangPrefix(voices, langPrefix);
    }
    return voices;
}

// --------------------------- Quick UX helpers --------------------------

/**
 * Launch the right OS UI for installing/enabling TTS voices, with light guidance:
 * - On Android: try the engine’s “install TTS data” activity; fallback to TTS settings.
 * - On iOS/macOS: open Spoken Content / Accessibility or app settings (best-effort).
 */
export async function guideUserToInstallVoices(): Promise<void> {
    await deepLinkToVoiceInstall();
}

/**
 * Minimal “is there at least one compatible voice?” check for a language.
 * If none, opens install/settings UI and returns the post-action list (for the UI to re-check).
 */
export async function ensureVoicesForLanguage(langPrefix: string): Promise<VoiceInfo[]> {
    let voices = await getVoices({ langPrefix });
    if (voices.length > 0) return voices;

    await guideUserToInstallVoices();
    // Give the OS a moment (user may come back later); the caller can re-poll as needed.
    // We just return the current list immediately.
    return getVoices({ langPrefix });
}
