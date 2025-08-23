// tts.ts
// Priority:
// 1) Preferred named voice from SPEAKER_MAP if present
// 2) Any other compatible language voice
// 3) If none: DO NOT use browser default — fall back to native invoke()
// 4) If Web Speech API missing or errors: native invoke()

import { invoke } from "@tauri-apps/api/core";

export const BROWSER_TTS = "speechSynthesis" in window;

export const SPEAKER_MAP: Record<string, string> = {
    en: "Tessa",
    es: "Mónica",
    zh: "Meijia",
    ar: "Majed",
    ru: "Milena",
    fr: "Amélie",
    ja: "Kyoko",
    it: "Alice",
    de: "Anna",
    pt: "Luciana",
    hi: "Lekha",
    fa: "Dariush",
    ko: "Yuna",
};

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

export function createVoiceTTS(langPrefix: string) {
    function getAllVoices(): SpeechSynthesisVoice[] {
        try {
            return "speechSynthesis" in window ? window.speechSynthesis.getVoices() || [] : [];
        } catch {
            return [];
        }
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = () => {
            console.log(`[TTS:${langPrefix}] voiceschanged fired`);
        };
    }

    return async function speak(text: string, rate: number = 0.7) {
        const preferredName = SPEAKER_MAP[langPrefix];
        console.log(`[TTS:${langPrefix}] speaking: "${text}"`);

        if ("speechSynthesis" in window) {
            try {
                const voices = getAllVoices();
                console.log(
                    `[TTS:${langPrefix}] available voices:`,
                    voices.map((v) => `${v.name} (${v.lang}${(v as any).default ? ", default" : ""})`)
                );

                // Explicit narrowing – never returns a string
                const named: SpeechSynthesisVoice | undefined = preferredName
                    ? voices.find((v) => v.name === preferredName && isLangCompatible(v.lang, langPrefix))
                    : undefined;

                const compatible: SpeechSynthesisVoice | undefined =
                    named ? undefined : voices.find((v) => isLangCompatible(v.lang, langPrefix));

                // If we found a browser voice, use it.
                if (named || compatible) {
                    const chosen: SpeechSynthesisVoice = (named ?? compatible)!;
                    const utter = new SpeechSynthesisUtterance(text);
                    utter.voice = chosen;
                    utter.lang = chosen.lang || langPrefix;
                    utter.rate = rate;
                    console.log(
                        `[TTS:${langPrefix}] using ${named ? "preferred" : "compatible"} voice: ${chosen.name} (${chosen.lang})`
                    );
                    window.speechSynthesis.speak(utter);
                    return;
                }

                // No compatible browser voice → go native immediately
                console.warn(
                    `[TTS:${langPrefix}] no compatible browser voice; falling back to native invoke('plugin:tts|speak'), ${rate}`
                );
                await invoke("plugin:tts|speak", {
                    text,
                    language: langPrefix, // e.g. "fa" — native side should resolve fa / fa-IR
                    rate,
                });
                return;
            } catch (err) {
                console.warn(`[TTS:${langPrefix}] Web Speech API error; falling back to native`, err);
                // fall through to native below
            }
        }

        // Web Speech not available at all → native
        try {
            console.warn(`[TTS:${langPrefix}] no Web Speech; invoking native plugin ${rate}`);
            await invoke("plugin:tts|speak", {
                text,
                language: langPrefix,
                rate,
            });
        } catch (err) {
            console.error(`[TTS:${langPrefix}] Native TTS invocation failed`, err);
        }
    };
}
