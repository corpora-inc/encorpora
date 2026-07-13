// src/util/speak.ts
// Strategy:
// - Prefer native TTS on macOS/iOS/Android when running in Tauri.
// - Otherwise, fall back to the browser Web Speech API.
// - If a voiceId is provided, we try to use that exact voice on native and browser paths.
//
// Contract to native plugin (Rust):
//   invoke("plugin:tts|speak", { text, language, rate, voice_id?: string })

import { invoke } from "@tauri-apps/api/core";

import { getVoicesCached } from "@/util/tts-voices";
import { maybeApplySerbianFallback } from "@/util/serbianFallback";
import { beginUtterance, endUtterance } from "@/util/audioManager";

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

async function speakBrowser(
    text: string,
    langPrefix: string,
    rate: number,
    voiceId?: string,
    utteranceId?: number,
) {
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

    // Browser is the one backend that gives us a REAL completion signal —
    // wire it to the audio manager so waitForActiveUtterance() can return as
    // soon as playback actually ends, rather than riding out the estimate.
    if (utteranceId !== undefined) {
        utter.onend = () => endUtterance(utteranceId);
        utter.onerror = () => endUtterance(utteranceId);
    }

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

        // Register with the audio manager SYNCHRONOUSLY, before ANY await —
        // per audioManager.ts's beginUtterance() contract. This must be the
        // first statement in the function: a fire-and-forget `void
        // speak(...)` caller (e.g. a reward TTS followed synchronously by an
        // advance decision — settle() → waitForActiveUtterance()) needs the
        // utterance already visible the instant this call returns control,
        // not after an `await`. Estimate from the raw text/rate; native has
        // no true completion event (see audioManager.ts) so this drives an
        // estimate regardless, and browser upgrades it to a real one via
        // utter.onend below.
        const handle = beginUtterance(text, rate);

        // Apply per-language fallback shims (currently: Serbian Cyrillic →
        // Croatian voice on platforms without a Serbian voice). Self-disables
        // when the OS exposes a native voice for the source language.
        const { text: outText, langPrefix: outLang } =
            await applyFallbackShims(text, langPrefix, voiceId);

        // 1) Prefer native on macOS/iOS/Android when in Tauri (UA-based).
        try {
            if (await preferNativeTTS()) {
                await speakNative(outText, outLang, rate, voiceId);
                return;
            }
        } catch (err) {
            nativeErr = err;
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${outLang}] Native TTS failed; falling back to browser`, err);
        }

        // 2) Otherwise, try browser Web Speech.
        try {
            await speakBrowser(outText, outLang, rate, voiceId, handle.id);
            return;
        } catch (err) {
            browserErr = err;
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${outLang}] Browser Web Speech failed`, err);
        }

        // Both paths failed — nothing is actually playing, so stop tracking it
        // rather than making an app-initiated advance wait out the estimate.
        endUtterance(handle.id);

        // Surface a noisy signal so the UI layer can react.
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
        // Register SYNCHRONOUSLY, before any await — see the matching comment
        // in createVoiceTTS() above. Concurrent playback can overlap with
        // other utterances by design, so it doesn't take over "the"
        // active-utterance slot the same way the sequential speak() does —
        // but it still counts as audible speech for waitForActiveUtterance()
        // callers, so track it the same way, estimated from the raw text.
        const handle = beginUtterance(text, rate);

        const { text: outText, langPrefix: outLang } =
            await applyFallbackShims(text, langPrefix, voiceId);

        // 1) Prefer native concurrent on macOS/iOS/Android when in Tauri.
        try {
            if (await preferNativeTTS()) {
                return await speakNativeConcurrent(outText, outLang, rate, voiceId);
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${outLang}] Native concurrent failed; falling back to browser`, err);
        }

        // 2) Fallback to browser (sequential - browser doesn't support concurrent easily).
        try {
            await speakBrowser(outText, outLang, rate, voiceId, handle.id);
            return `browser_${Date.now()}`;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${outLang}] Browser TTS failed`, err);
            endUtterance(handle.id);
            return `error_${Date.now()}`;
        }
    };
}

/**
 * Apply any per-language text/lang fallback shims at the bottom of the
 * speak path. Each shim is self-gated by runtime voice availability, so
 * adding/removing one is local to its module — no surface-area changes
 * up-stack.
 *
 * Currently applied:
 *   - Serbian Cyrillic → Latin + langPrefix → "hr" when no `sr-*` voice
 *     is in the OS voice list (Apple iOS today; auto-disables when Apple
 *     ships a Serbian voice or on Android where Milena is preinstalled).
 *
 * The shim runs even when an explicit `voiceId` is set. The alias-aware
 * voice matcher will list Croatian voices under the Serbian section, so
 * users can (and will) pick one — at which point the Croatian voice
 * still needs Latin text, not Cyrillic. The shim's gate is voice
 * availability, not whether the caller specified an id.
 */
async function applyFallbackShims(
    text: string,
    langPrefix: string,
    _voiceId: string | undefined,
): Promise<{ text: string; langPrefix: string }> {
    let voices;
    try {
        voices = await getVoicesCached({ maxAgeMs: 30_000 });
    } catch {
        // If we can't enumerate voices, skip shims rather than risk
        // a worse outcome.
        return { text, langPrefix };
    }

    const sr = maybeApplySerbianFallback(text, langPrefix, voices);
    if (sr.applied) return { text: sr.text, langPrefix: sr.langPrefix };

    return { text, langPrefix };
}

/**
 * Stop any in-flight speech immediately (browser + native). Called when the
 * Journey feed advances so a card's audio never bleeds into the next card
 * ("hearing the last exercise on the next one"). Safe/no-op when nothing plays.
 */
export async function stopSpeech(): Promise<void> {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
    try {
        await invoke("plugin:tts|stop");
    } catch {
        // native stop unavailable on some builds; ignore
    } finally {
        // Whatever was tracked as "active" just got cut — clear it so a
        // subsequent waitForActiveUtterance() doesn't ride out a now-silent
        // estimate.
        endUtterance();
    }
}
