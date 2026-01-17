// tts-voices.ts
// Frontend helpers for Corpán voice onboarding:
// - Deep link to OS voice settings / install panels via the Tauri plugin
// - Enumerate native voices (Android/iOS/macOS) with browser fallback
// - Optional sorting with language bias (NO filtering here)

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
    networkRequired?: boolean; // Android-only: voice requires network
}

export type TtsEngineInfo = {
    packageName: string;
    label?: string | null;
    isSystem?: boolean;
};

export type TtsEngineStatus = {
    supported: boolean;
    defaultEngine?: string | null;
    engines: TtsEngineInfo[];
    googleInstalled: boolean;
    googleDefault: boolean;
};

type VoiceCacheKey = "nativeFirst" | "browserFirst";

const DEFAULT_VOICES_CACHE_MS = 30_000;
const GOOGLE_TTS_PACKAGE = "com.google.android.tts";
const voicesCache: Record<VoiceCacheKey, { voices: VoiceInfo[]; at: number } | null> = {
    nativeFirst: null,
    browserFirst: null,
};
const voicesInFlight: Record<VoiceCacheKey, Promise<VoiceInfo[]> | null> = {
    nativeFirst: null,
    browserFirst: null,
};

// ---------------------------- Env helpers -----------------------------

type UAOS = "macos" | "ios" | "android" | "other";

/**
 * Detect OS with robust iOS detection for modern iPads
 * iPadOS 13+ often reports as "Macintosh" to get desktop sites
 */
export function detectOSFromUA(): UAOS {
    if (typeof navigator === "undefined") return "other";

    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const maxTouchPoints = navigator.maxTouchPoints || 0;

    // Check for explicit iOS identifiers (iPhone, iPod, legacy iPad)
    if (/iPhone|iPod/i.test(ua) || /iPad/i.test(ua)) {
        return "ios";
    }

    // Modern iPad detection: MacIntel + touch support = iPad masquerading as desktop
    if (/Mac/i.test(platform) && maxTouchPoints > 1) {
        return "ios";
    }

    // Android (excluding ChromeOS)
    if (/Android/i.test(ua) && !/CrOS/i.test(ua)) {
        return "android";
    }

    // Real macOS (Mac without touch, and not an iPad)
    if (/Mac/i.test(platform) && maxTouchPoints <= 1) {
        return "macos";
    }

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

async function awaitBrowserVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
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

/** Enumerate native voices (Android/iOS/macOS). Falls back to [] if the command is unavailable. */
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
        // console.warn("[TTS] list_voices failed; returning []", e);
        return [];
    }
}

/** Open the OS screen where the user can manage/download TTS voices. */
export async function openTtsSettings(): Promise<boolean> {
    try {
        await invoke("plugin:tts|open_tts_settings");
        return true;
    } catch (e) {
        // console.warn("[TTS] open_tts_settings failed", e);
        return false;
    }
}

/** Open Apple's Feedback Assistant app (macOS/iOS). Returns true if successful. */
export async function openAppleFeedback(): Promise<boolean> {
    const os = detectOSFromUA();
    if (os !== "macos" && os !== "ios") {
        return false; // Only available on Apple platforms
    }

    try {
        // Call our custom Tauri command that uses the 'open' command
        await invoke("open_apple_feedback");
        return true;
    } catch (err) {
        console.warn("[TTS] Failed to open Apple Feedback app:", err);
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

/** Android-only: enumerate installed engines and default engine status. */
export async function getTtsEngineStatus(): Promise<TtsEngineStatus | null> {
    if (detectOSFromUA() !== "android") return null;
    try {
        const res = await invoke<TtsEngineStatus>("plugin:tts|get_tts_engine_status");
        return res ?? null;
    } catch {
        return null;
    }
}

/** Android-only: open the Play Store listing for a TTS engine package. */
export async function openTtsEngineStore(packageName: string): Promise<boolean> {
    if (!packageName) return false;
    try {
        const ok = await invoke<boolean>("plugin:tts|open_tts_engine_store", { packageName });
        return !!ok;
    } catch {
        return false;
    }
}

/** “Deep link” helper: best-effort voice install/settings path for the platform. */
export async function deepLinkToVoiceInstall(opts?: {
    preferGoogle?: boolean;
    engineStatus?: TtsEngineStatus | null;
}): Promise<void> {
    const os = detectOSFromUA();
    const preferGoogle = opts?.preferGoogle ?? true;

    if (os === "android" && preferGoogle) {
        const status = opts?.engineStatus ?? (await getTtsEngineStatus());
        if (status?.supported) {
            if (!status.googleInstalled) {
                const launched = await openTtsEngineStore(GOOGLE_TTS_PACKAGE);
                if (launched) return;
            }
            if (status.googleInstalled && !status.googleDefault) {
                await openTtsSettings();
                return;
            }
        }
    }

    const launched = await installTtsDataIfSupported();
    if (!launched) {
        await openTtsSettings();
    }
}

// --------------------------- Voice utilities --------------------------

/**
 * Sort voices with an optional language **bias** (no filtering):
 * - exact tag > base match > others
 * - higher quality first
 * - then stable by name/id
 */
export function sortVoicesWithLangBias(voices: VoiceInfo[], langBias?: string): VoiceInfo[] {
    const want = langBias || "";
    return [...voices].sort((a, b) => {
        if (want) {
            const lA = langMatchScore(a.language, want);
            const lB = langMatchScore(b.language, want);
            if (lA !== lB) return lB - lA;
        }
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

// --------------------------- Public API -------------------------------

async function fetchVoices(opts?: { preferBrowser?: boolean }): Promise<VoiceInfo[]> {
    const { preferBrowser } = opts ?? {};

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
        // swallow and return whatever we have
    }

    return voices;
}

export async function getVoicesCached(opts?: {
    langBias?: string;
    preferBrowser?: boolean;
    maxAgeMs?: number;
    forceRefresh?: boolean;
}): Promise<VoiceInfo[]> {
    const { langBias, preferBrowser, maxAgeMs, forceRefresh } = opts ?? {};
    const key: VoiceCacheKey = preferBrowser ? "browserFirst" : "nativeFirst";
    const now = Date.now();
    const maxAge = maxAgeMs ?? DEFAULT_VOICES_CACHE_MS;

    if (!forceRefresh) {
        const cached = voicesCache[key];
        if (cached && now - cached.at < maxAge) {
            return sortVoicesWithLangBias(cached.voices, langBias);
        }
    }

    const pending = voicesInFlight[key];
    if (pending) {
        const voices = await pending;
        return sortVoicesWithLangBias(voices, langBias);
    }

    const request = fetchVoices({ preferBrowser }).then((voices) => {
        voicesCache[key] = { voices, at: Date.now() };
        voicesInFlight[key] = null;
        return voices;
    });
    voicesInFlight[key] = request;

    const voices = await request;
    return sortVoicesWithLangBias(voices, langBias);
}

/**
 * High-level “get voices” API for the UI:
 * - Try native first (Android/iOS/macOS).
 * - On failure or empty, fallback to Web Speech (if available).
 * - **No filtering** here; optional `langBias` only affects ordering.
 */
export async function getVoices(opts?: { langBias?: string; preferBrowser?: boolean }): Promise<VoiceInfo[]> {
    const { langBias, preferBrowser } = opts ?? {};
    const voices = await fetchVoices({ preferBrowser });
    return sortVoicesWithLangBias(voices, langBias);
}

/**
 * Minimal “do we have *any* voices?” helper:
 * - If none yet, punt user to install flow and return whatever’s present afterward.
 * - **No filtering**; caller can decide what to show.
 */
export async function ensureVoicesAvailable(langBias?: string): Promise<VoiceInfo[]> {
    let voices = await getVoices({ langBias });
    if (voices.length > 0) return voices;

    await deepLinkToVoiceInstall();
    return getVoices({ langBias });
}
