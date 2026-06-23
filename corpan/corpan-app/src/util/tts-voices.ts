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
    | "premium"        // Apple AVSpeech: premium (the top Apple tier)
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

/* -------------------- Health probe types (Android rescue UX) -------------------- */

/** Stable mirror of Android `PackageManager.COMPONENT_ENABLED_STATE_*`. */
export type EnabledStateName =
    | "enabled"
    | "default"
    | "disabled"
    | "disabled_user"
    | "disabled_until_used"
    | "not_installed"
    | string; // forward-compatible

export type ProbeEngineInfo = {
    packageName: string;
    label?: string | null;
    enabledState: EnabledStateName;
    manifestEnabled: boolean;
    isInstalled: boolean;
    /** Has TTS_SERVICE intent that 3rd-party apps can bind to (Samsung's SMT is "private" → false). */
    isBindable?: boolean;
    /** True iff package is enabled AND bindable. */
    isUsable: boolean;
};

/** High-level diagnosis used by onboarding to pick a rescue card. */
export type TtsDiagnosis =
    | "ready"
    | "engine_disabled_user"
    | "engine_disabled"
    | "engine_not_installed"
    | "no_voice_data"
    | "no_engine"
    | "engine_hung"
    | string;

export type TtsHealthProbe = {
    supported: boolean;
    initState: "ready" | "pending" | "failed" | string;
    currentEngine?: string | null;
    voiceCount: number;
    voicesEmpty: boolean;
    defaultEngine?: string | null;
    engines: ProbeEngineInfo[];
    googleInstalled: boolean;
    googleEnabled: boolean;
    googleDefault: boolean;
    diagnosis: TtsDiagnosis;
    ready: boolean;
};

export type RecoverResult = {
    recovered: boolean;
    engine?: string | null;
    diagnosis?: TtsDiagnosis;
    voiceCount?: number;
    alreadyHealthy?: boolean;
};

export type BindEngineResult = {
    ok: boolean;
    reason?: "not_installed" | "disabled_user" | "disabled" | "bind_timeout" | "not_supported" | string;
    engine?: string | null;
    voiceCount?: number;
};

export type InstallVoiceDataStatus =
    | "already_installed"
    | "launched_install_flow"
    | "not_supported"
    | "engine_not_ready";

export class TtsTimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TtsTimeoutError";
    }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new TtsTimeoutError(`${label} timed out after ${ms}ms`)), ms);
        promise.then(
            (v) => {
                clearTimeout(timer);
                resolve(v);
            },
            (e) => {
                clearTimeout(timer);
                reject(e);
            }
        );
    });
}

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

/**
 * Cross-tag aliases used when a learner-language code doesn't match what
 * platforms publish for voices. Score 1 (lower than base match) so a real
 * direct match always wins.
 *
 *   yue-Hant-HK  → also accept Apple/Google `zh-HK` and `yue-HK` voices
 *   sr           → fall back to Croatian (`hr`) when no Serbian voice exists
 *                  (mutually intelligible; better than English fallback)
 *   no  ↔ nb     → Apple ships Norwegian as `nb-NO` (Bokmål); learners
 *                  pick the generic ISO 639-1 `no`. Two-way alias so the
 *                  voice section lights up regardless of which side users
 *                  configure.
 *   tl  ↔ fil    → we ship Tagalog as the ISO 639-1 `tl`, but Android TTS
 *                  publishes the Filipino voice as `fil-PH`/`fil` (ISO 639-2).
 *                  Two-way alias so a `tl` learner picks up an on-device
 *                  `fil` voice (and vice-versa) instead of falling back to a
 *                  generic voice. iOS ships neither, so the Apple-gap path is
 *                  unaffected.
 */
const LANG_ALIASES: Record<string, string[]> = {
    "yue-hant-hk": ["yue", "yue-hk", "zh-hk"],
    sr: ["hr"],
    no: ["nb"],
    nb: ["no"],
    tl: ["fil"],
    fil: ["tl"],
};

/**
 * Pull the script (4-letter, e.g. `Hant`) and region (2-letter or 3-digit,
 * e.g. `PT`, `419`) subtags out of a BCP-47 tag, lowercased. Tolerates the
 * Unicode `-u-` extension and mixed casing (`zh-Hant-HK`, `pt-br`, `yue-HK`).
 */
function tagParts(tag: string): { lang: string; script?: string; region?: string } {
    const base = tag.toLowerCase().split("-u-")[0];
    const parts = base.split("-").filter(Boolean);
    const out: { lang: string; script?: string; region?: string } = { lang: parts[0] ?? "" };
    for (let i = 1; i < parts.length; i++) {
        const p = parts[i];
        if (!out.script && p.length === 4 && /^[a-z]{4}$/.test(p)) out.script = p;
        else if (!out.region && (p.length === 2 || /^[0-9]{3}$/.test(p))) out.region = p;
    }
    return out;
}

/**
 * Some learner tags imply a script the platform encodes only via region, and
 * vice-versa. Normalize both sides so a `zh-Hant` learner matches a `zh-TW`
 * voice (Taiwan ⇒ Traditional) and a `zh-Hans` learner matches `zh-CN`.
 * Returns the region set that the script implies, if any.
 */
const SCRIPT_IMPLIED_REGIONS: Record<string, Set<string>> = {
    // Traditional Chinese ships from Taiwan / Hong Kong / Macau.
    hant: new Set(["tw", "hk", "mo"]),
    // Simplified Chinese ships from the mainland / Singapore.
    hans: new Set(["cn", "sg"]),
};
function regionImpliedScript(region?: string): string | undefined {
    if (!region) return undefined;
    if (SCRIPT_IMPLIED_REGIONS.hant.has(region)) return "hant";
    if (SCRIPT_IMPLIED_REGIONS.hans.has(region)) return "hans";
    return undefined;
}

/**
 * Score how well a voice's language tag matches what the learner wants.
 *
 *   3  exact tag match (`pt-PT` voice for `pt-PT`)
 *   2  base-language match WITH a matching region/script refinement (the
 *      learner asked for a specific dialect AND the voice is that dialect:
 *      `pt-PT`→Portugal voice, `zh-Hant`→a Taiwan/HK voice, `en-GB`→a UK voice)
 *   1  plain base-language match (right language, dialect not specified or not
 *      aligned — still usable, just not region-perfect)
 *   1  cross-tag alias (e.g. `sr`→`hr`)
 *   0  no match
 *
 * The region/script awareness is what makes the *default* auto-pick correct
 * without the user touching anything: pt-PT outranks pt-BR for a pt-PT learner.
 */
export function langMatchScore(voiceLang: string | undefined, want: string): number {
    if (!voiceLang || !want) return 0;
    const v = voiceLang.toLowerCase();
    const w = want.toLowerCase();
    if (v === w) return 3;

    const vp = tagParts(v);
    const wp = tagParts(w);
    const b = wp.lang;

    // Plain base-language relationship (e.g. voice `pt-BR` vs want `pt-PT`).
    const baseMatches = vp.lang === b;
    if (baseMatches) {
        const wantScript = wp.script ?? regionImpliedScript(wp.region);
        const wantRegion = wp.region;
        const voiceScript = vp.script ?? regionImpliedScript(vp.region);
        const voiceRegion = vp.region;

        // The learner specified a dialect (region and/or script).
        const learnerSpecific = !!(wantRegion || wantScript);
        if (learnerSpecific) {
            const scriptOk = wantScript ? voiceScript === wantScript : true;
            const regionOk = wantRegion ? voiceRegion === wantRegion : true;
            // Region-perfect (or script-perfect when only script was asked) → 2.
            // When the learner gave BOTH and only the script lines up (e.g.
            // zh-Hant want, zh-TW voice has no explicit script but Taiwan
            // implies Hant), the implied-script path above already covers it.
            if ((wantScript && scriptOk && (!wantRegion || regionOk)) ||
                (!wantScript && wantRegion && regionOk)) {
                return 2;
            }
            // Right language, wrong dialect (pt-BR voice for a pt-PT learner).
            return 1;
        }
        // Learner didn't specify a dialect → any same-language voice is fine.
        return 1;
    }

    const aliases = LANG_ALIASES[w] ?? LANG_ALIASES[b];
    if (aliases) {
        for (const a of aliases) {
            if (v === a || v.startsWith(a + "-")) return 1;
        }
    }
    return 0;
}

function qualityRank(q?: VoiceQuality): number {
    switch (q) {
        case "premium": return 7;  // Apple top tier — must outrank everything
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
        // so we can request an array directly here. 8s timeout protects against a
        // wedged engine that never resolves (the original Android bug).
        const res = await withTimeout(
            invoke<VoiceInfo[]>("plugin:tts|list_voices"),
            8000,
            "list_voices",
        );
        if (Array.isArray(res)) return res;
        // Safety net in case of an older iOS build returning { voices: [...] }
        const maybe = (res as unknown as { voices?: VoiceInfo[] })?.voices;
        return Array.isArray(maybe) ? maybe : [];
    } catch (e) {
        if (e instanceof TtsTimeoutError) {
            console.warn("[TTS] list_voices timed out", e);
        }
        // console.warn("[TTS] list_voices failed; returning []", e);
        return [];
    }
}

/* -------------------- Health probe / rescue helpers (Android) -------------------- */

const SYNTHETIC_READY_PROBE: TtsHealthProbe = {
    supported: false,
    initState: "ready",
    currentEngine: null,
    voiceCount: 0,
    voicesEmpty: false,
    defaultEngine: null,
    engines: [],
    googleInstalled: false,
    googleEnabled: false,
    googleDefault: false,
    diagnosis: "ready",
    ready: true,
};

/**
 * Diagnose engine health, install state, voice availability. Used by the
 * onboarding rescue UX to pick a single recovery card. On non-Android this
 * always resolves to a synthetic `ready` probe.
 */
export async function probeTtsHealth(): Promise<TtsHealthProbe> {
    if (detectOSFromUA() !== "android") return SYNTHETIC_READY_PROBE;
    try {
        const res = await withTimeout(
            invoke<TtsHealthProbe>("plugin:tts|probe_tts_health"),
            8000,
            "probe_tts_health",
        );
        return res ? correctDiagnosis(res) : SYNTHETIC_READY_PROBE;
    } catch (e) {
        console.warn("[TTS] probe_tts_health failed", e);
        return {
            ...SYNTHETIC_READY_PROBE,
            supported: true,
            initState: "failed",
            diagnosis: "engine_hung",
            ready: false,
        };
    }
}

/**
 * JS-side diagnosis re-derivation, anchored on Google's state. The Kotlin
 * probe used to trust "anyOtherUsable" which is misleading on Samsung — SMT
 * advertises TTS_SERVICE but blocks 3rd-party binding ("private engine"). If
 * Google is uninstalled, SMT existing doesn't actually help us, so the right
 * call is "engine_not_installed", not "engine_hung".
 *
 * Safe to apply whether the Kotlin side is up-to-date or not.
 */
function correctDiagnosis(probe: TtsHealthProbe): TtsHealthProbe {
    const initOk = probe.initState === "ready";
    const voicesOk = !probe.voicesEmpty;
    const googleInstalled = probe.googleInstalled;
    const googleUsable = probe.googleEnabled;

    let diagnosis: TtsDiagnosis;
    if (initOk && voicesOk) {
        diagnosis = "ready";
    } else if (googleInstalled && !googleUsable) {
        diagnosis = "engine_disabled_user";
    } else if (!googleInstalled) {
        diagnosis = "engine_not_installed";
    } else if (initOk && !voicesOk) {
        diagnosis = "no_voice_data";
    } else {
        diagnosis = "engine_hung";
    }

    return diagnosis === probe.diagnosis ? probe : { ...probe, diagnosis };
}

/**
 * Try, in order, to bind to: current engine (if usable), Google TTS, any other
 * usable engine. Returns the outcome.
 */
export async function tryAutoRecover(): Promise<RecoverResult> {
    if (detectOSFromUA() !== "android") {
        return { recovered: true, alreadyHealthy: true };
    }
    try {
        const res = await withTimeout(
            invoke<RecoverResult>("plugin:tts|try_auto_recover"),
            10_000,
            "try_auto_recover",
        );
        return res ?? { recovered: false };
    } catch (e) {
        console.warn("[TTS] try_auto_recover failed", e);
        return { recovered: false, diagnosis: "engine_hung" };
    }
}

/**
 * Bind to a specific engine package (Android only). Returns success or a typed reason.
 */
export async function bindEngine(packageName: string): Promise<BindEngineResult> {
    if (detectOSFromUA() !== "android") {
        return { ok: false, reason: "not_supported" };
    }
    if (!packageName) return { ok: false, reason: "not_supported" };
    try {
        // Tauri 2 expects struct-arg commands to be wrapped in `{ args: ... }`.
        const res = await withTimeout(
            invoke<BindEngineResult>("plugin:tts|bind_engine", {
                args: { packageName },
            }),
            10_000,
            "bind_engine",
        );
        return res ?? { ok: false, reason: "bind_timeout" };
    } catch (e) {
        console.warn("[TTS] bind_engine failed", e);
        return { ok: false, reason: "bind_timeout" };
    }
}

/**
 * Open the system "App info" page for a TTS engine package. The user lands one
 * tap away from the **Enable** button — primary recovery for `engine_disabled_user`.
 */
export async function openTtsEngineAppDetails(packageName: string): Promise<boolean> {
    if (!packageName) return false;
    try {
        const ok = await invoke<boolean>("plugin:tts|open_app_details", {
            args: { packageName },
        });
        return !!ok;
    } catch (e) {
        console.warn("[TTS] open_app_details rejected:", e);
        return false;
    }
}

/**
 * Per-language voice data installation. On Android, calls setLanguage; if data
 * is missing, fires the engine's own `INSTALL_TTS_DATA` activity.
 */
export async function installVoiceData(language: string): Promise<InstallVoiceDataStatus> {
    if (detectOSFromUA() !== "android") return "not_supported";
    if (!language) return "not_supported";
    try {
        const res = await invoke<{ status: InstallVoiceDataStatus }>(
            "plugin:tts|install_voice_data_for_language",
            { args: { language } },
        );
        return res?.status ?? "not_supported";
    } catch (e) {
        console.warn("[TTS] install_voice_data_for_language failed", e);
        return "not_supported";
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
        const ok = await invoke<boolean>("plugin:tts|open_tts_engine_store", {
            args: { packageName },
        });
        return !!ok;
    } catch (e) {
        console.warn("[TTS] open_tts_engine_store failed", e);
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

/** Public, shared quality ranking (mirrors the internal `qualityRank`). */
export function voiceQualityRank(q?: VoiceQuality): number {
    return qualityRank(q);
}

/**
 * True iff a quality tier counts as a "good" voice — enhanced/premium or the
 * Android high/very_high tiers. This is the line between "just confirm and go"
 * (case 1) and "go add a better voice" (case 2): compact/default/low voices
 * sound robotic enough that we nudge the learner toward Settings.
 */
export function isGoodQuality(q?: VoiceQuality): boolean {
    return qualityRank(q) >= 4; // enhanced | high | very_high
}

/**
 * The single most appropriate voice for a language, region/script-aware:
 *   1. best language match (region/script-correct beats wrong-dialect)
 *   2. then highest quality
 *   3. then stable by name
 * Returns null when there are no candidates. `voices` may be the full list;
 * non-matching voices are filtered out.
 */
export function pickBestVoiceForLang(voices: VoiceInfo[], want: string): VoiceInfo | null {
    const matches = voices.filter((v) => langMatchScore(v.language, want) > 0);
    if (!matches.length) return null;
    return sortVoicesWithLangBias(matches, want)[0] ?? null;
}

/**
 * The default selection for a language: ALL voices at the best quality tier
 * present — every premium voice if any premium exist, else every enhanced
 * (high/very_high) voice, else whatever is available. More voices is better
 * (the sampler rotates across them for variety), and we want the learner to
 * SEE how many good voices they have, so we select the whole top tier rather
 * than a single pick. Region-biased order. Returns [] when there are none.
 */
export function defaultVoiceIdsForLang(voices: VoiceInfo[], want: string): string[] {
    const matches = voices.filter((v) => langMatchScore(v.language, want) > 0);
    if (!matches.length) return [];
    const maxRank = Math.max(...matches.map((v) => qualityRank(v.quality)));
    const topTier = matches.filter((v) => qualityRank(v.quality) === maxRank);
    return sortVoicesWithLangBias(topTier, want).map((v) => v.id);
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
