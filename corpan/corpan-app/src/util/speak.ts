// src/util/speak.ts
// Strategy:
// - Prefer native TTS on macOS/iOS/Android when running in Tauri.
// - Otherwise, fall back to the browser Web Speech API.
// - If a voiceId is provided, we try to use that exact voice on native and browser paths.
//
// Contract to native plugin (Rust):
//   invoke("plugin:tts|speak", { text, language, rate, voice_id?: string })

import { invoke } from "@tauri-apps/api/core";

type UAOS = "macos" | "ios" | "android" | "other";

function detectOSFromUA(): UAOS {
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Android/i.test(ua)) return "android";
    if (/Macintosh/i.test(ua) && !/Mobile\/\w+ Safari/i.test(ua)) return "macos";
    return "other";
}

async function preferNativeTTS(): Promise<boolean> {
    try {
        // If @tauri-apps/api is present, we're in Tauri; otherwise this will throw.
        // We still gate on UA platform to avoid invoking native where it can't exist.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const os = detectOSFromUA();
        return os === "macos" || os === "ios" || os === "android";
    } catch {
        return false;
    }
}

export const BROWSER_TTS = (() => {
    try {
        return typeof window !== "undefined" && "speechSynthesis" in window;
    } catch {
        return false;
    }
})();

function baseLang(tag: string | undefined | null): string {
    if (!tag) return "";
    const t = tag.toLowerCase();
    const i = t.indexOf("-");
    return i === -1 ? t : t.slice(0, i);
}

function isLangCompatible(voiceLang: string | undefined, prefix: string): boolean {
    if (!voiceLang) return false;
    const v = voiceLang.toLowerCase();
    const p = prefix.toLowerCase();
    return v === p || v.startsWith(p + "-") || baseLang(v) === p;
}

// Wait briefly for voices to populate (common on some browsers)
async function awaitVoices(timeoutMs = 500): Promise<SpeechSynthesisVoice[]> {
    if (!BROWSER_TTS) return [];
    const now = window.speechSynthesis.getVoices();
    if (now && now.length > 0) return now;

    return new Promise((resolve) => {
        let done = false;
        const finish = (result: SpeechSynthesisVoice[]) => {
            if (done) return;
            done = true;
            resolve(result);
        };

        const timer = setTimeout(() => {
            finish(window.speechSynthesis.getVoices() || []);
        }, timeoutMs);

        const handler = () => {
            clearTimeout(timer);
            window.speechSynthesis.removeEventListener("voiceschanged", handler);
            finish(window.speechSynthesis.getVoices() || []);
        };

        window.speechSynthesis.addEventListener("voiceschanged", handler);
        // Trigger loading
        window.speechSynthesis.getVoices();
    });
}

async function speakNative(text: string, langPrefix: string, rate: number, voiceId?: string) {
    // console.warn("speaking natively", voiceId)
    await invoke("plugin:tts|speak", {

        args: {
            text,
            language: langPrefix, // e.g. 'fa' or 'fa-IR' resolved natively
            rate,
            voice_id: voiceId,
        }
    });
}

/**
 * Speak concurrently using the synthesizer pool (allows overlapping audio on macOS/iOS).
 * On Android, falls back to sequential playback due to platform limitations.
 * Returns an utterance ID for tracking completion.
 */
async function speakNativeConcurrent(text: string, langPrefix: string, rate: number, voiceId?: string): Promise<string> {
    const result = await invoke<{ utteranceId: string }>("plugin:tts|speak_concurrent", {
        args: {
            text,
            language: langPrefix,
            rate,
            voice_id: voiceId,
        }
    });
    return result.utteranceId;
}

async function speakBrowser(text: string, langPrefix: string, rate: number, voiceId?: string) {
    if (!BROWSER_TTS) throw new Error("Web Speech API not available");

    const voices = await awaitVoices();

    let chosen: SpeechSynthesisVoice | undefined;

    if (voiceId) {
        // Try to match by stable voiceURI first; fall back to name match.
        chosen =
            voices.find((v) => v.voiceURI === voiceId) ||
            voices.find((v) => (v as any)?.name === voiceId);
    }

    if (!chosen) {
        // Language-based fallback
        chosen = voices.find((v) => isLangCompatible(v.lang, langPrefix));
    }

    const utter = new SpeechSynthesisUtterance(text);
    if (chosen) {
        utter.voice = chosen;
        utter.lang = chosen.lang || langPrefix;
    } else {
        utter.lang = langPrefix;
    }
    utter.rate = rate;

    window.speechSynthesis.speak(utter);
}

/**
 * Factory returning a `speak` function that prefers native TTS and supports an optional `voiceId`.
 * Usage: createVoiceTTS("en-US")(text, 0.9, "com.apple....")
 */
export function createVoiceTTS(langPrefix: string) {
    if (BROWSER_TTS) {
        // light debug hook; safe no-op if unused
        window.speechSynthesis.onvoiceschanged = () => {
            // eslint-disable-next-line no-console
            // console.log(`[TTS:${langPrefix}] voiceschanged (${window.speechSynthesis.getVoices().length} voices)`);
        };
    }

    return async function speak(text: string, rate: number = 0.7, voiceId?: string) {
        let nativeErr: unknown = null;
        let browserErr: unknown = null;

        // 1) Prefer native on macOS/iOS/Android when in Tauri (UA-based).
        try {
            if (await preferNativeTTS()) {
                await speakNative(text, langPrefix, rate, voiceId);
                return;
            }
        } catch (err) {
            nativeErr = err;
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${langPrefix}] Native TTS failed; falling back to browser`, err);
        }

        // 2) Otherwise, try browser Web Speech.
        try {
            await speakBrowser(text, langPrefix, rate, voiceId);
            return;
        } catch (err) {
            browserErr = err;
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${langPrefix}] Browser Web Speech failed`, err);
        }

        // Both paths failed — surface a noisy signal so the UI layer can react.
        // eslint-disable-next-line no-console
        console.error(
            `[TTS:${langPrefix}] All speech paths failed`,
            { nativeErr, browserErr, voiceId },
        );
        if (typeof window !== "undefined") {
            try {
                window.dispatchEvent(
                    new CustomEvent("corpan:tts-failure", {
                        detail: {
                            lang: langPrefix,
                            voiceId,
                            nativeErr: String(nativeErr ?? ""),
                            browserErr: String(browserErr ?? ""),
                            at: Date.now(),
                        },
                    }),
                );
            } catch {
                /* dispatchEvent may throw in unusual environments; ignore */
            }
        }
    };
}

/**
 * Factory returning a concurrent `speak` function that allows overlapping audio.
 * On macOS/iOS: true concurrent playback via synthesizer pool.
 * On Android: sequential playback (platform limitation) but returns utterance ID.
 * Returns an utterance ID for tracking completion.
 * Usage: createVoiceTTSConcurrent("en-US")(text, 0.9, "com.apple....") => Promise<string>
 */
export function createVoiceTTSConcurrent(langPrefix: string) {
    return async function speakConcurrent(text: string, rate: number = 0.7, voiceId?: string): Promise<string> {
        // 1) Prefer native concurrent on macOS/iOS/Android when in Tauri.
        try {
            if (await preferNativeTTS()) {
                return await speakNativeConcurrent(text, langPrefix, rate, voiceId);
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${langPrefix}] Native concurrent failed; falling back to browser`, err);
        }

        // 2) Fallback to browser (sequential - browser doesn't support concurrent easily).
        try {
            await speakBrowser(text, langPrefix, rate, voiceId);
            return `browser_${Date.now()}`;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${langPrefix}] Browser TTS failed`, err);
            return `error_${Date.now()}`;
        }
    };
}
