// tts.ts
// Strategy:
// - If we're running in Tauri *and* UA says macOS, iOS, or Android → use the native TTS plugin.
// - Otherwise → use the browser Web Speech API (pick the first compatible voice for the langPrefix).
//
// Notes:
// - No named voice preferences; users pick voices at the OS level.
// - Native plugin contract: invoke("plugin:tts|speak", { text, language, rate })
// - This version avoids importing @tauri-apps/api/os; it relies on navigator.userAgent.

import { invoke } from "@tauri-apps/api/core";

type UAOS = "macos" | "ios" | "android" | "other";

function detectOSFromUA(): UAOS {
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "";

    // iOS (including iPadOS Safari)
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    // Android
    if (/Android/i.test(ua)) return "android";
    // macOS (avoid misclassifying iOS Safari on iPad that sometimes reports "Mac")
    if (/Macintosh/i.test(ua) && !/Mobile\/\w+ Safari/i.test(ua)) return "macos";
    return "other";
}

async function preferNativeTTS(): Promise<boolean> {
    // Only prefer native if we're in Tauri *and* UA is macOS/iOS/Android
    const os = detectOSFromUA();
    return os === "macos" || os === "ios" || os === "android";
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
    const voicesNow = window.speechSynthesis.getVoices();
    if (voicesNow && voicesNow.length > 0) return voicesNow;

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

async function speakNative(text: string, langPrefix: string, rate: number) {
    await invoke("plugin:tts|speak", {
        text,
        language: langPrefix, // e.g. 'fa' or 'fa-IR' resolved natively
        rate,
    });
}

async function speakBrowser(text: string, langPrefix: string, rate: number) {
    if (!BROWSER_TTS) throw new Error("Web Speech API not available");

    const voices = await awaitVoices();
    const compatible = voices.find((v) => isLangCompatible(v.lang, langPrefix));

    const utter = new SpeechSynthesisUtterance(text);
    if (compatible) {
        utter.voice = compatible;
        utter.lang = compatible.lang || langPrefix;
    } else {
        // No compatible voice—still set lang; browser may fallback reasonably.
        utter.lang = langPrefix;
    }
    utter.rate = rate;

    window.speechSynthesis.speak(utter);
}

export function createVoiceTTS(langPrefix: string) {
    if (BROWSER_TTS) {
        window.speechSynthesis.onvoiceschanged = () => {
            // eslint-disable-next-line no-console
            console.log(`[TTS:${langPrefix}] voiceschanged (${window.speechSynthesis.getVoices().length} voices)`);
        };
    }

    return async function speak(text: string, rate: number = 0.7) {
        // 1) Prefer native on macOS/iOS/Android when in Tauri (UA-based).
        try {
            if (await preferNativeTTS()) {
                // eslint-disable-next-line no-console
                console.log(`[TTS:${langPrefix}] Using native TTS plugin`);
                await speakNative(text, langPrefix, rate);
                return;
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${langPrefix}] Native-preference check failed; will try browser`, err);
        }

        // 2) Otherwise, try browser Web Speech.
        try {
            // eslint-disable-next-line no-console
            console.log(`[TTS:${langPrefix}] Using browser Web Speech API`);
            await speakBrowser(text, langPrefix, rate);
            return;
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn(`[TTS:${langPrefix}] Browser TTS failed`, err);
        }
    };
}
