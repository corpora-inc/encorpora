import { invoke } from "@tauri-apps/api/core";

export const BROWSER_TTS = "speechSynthesis" in window;

const SPEAKER_MAP: Record<string, string> = {
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

export function createVoiceTTS(langPrefix: string) {
    let candidateVoices: SpeechSynthesisVoice[] = [];

    function refreshVoices() {
        if (!("speechSynthesis" in window)) return;

        const all = window.speechSynthesis.getVoices();
        candidateVoices = all.filter(
            (v): v is SpeechSynthesisVoice =>
                typeof v.lang === "string" && v.lang.toLowerCase().startsWith(langPrefix.toLowerCase())
        );

        const logList = candidateVoices.map(v => `${v.name} (${v.lang})`);
        console.log(`[TTS:${langPrefix}] candidate voices:`, logList.length ? logList : "(none)");
    }

    if ("speechSynthesis" in window) {
        speechSynthesis.onvoiceschanged = refreshVoices;
        refreshVoices();
    }

    return async function speak(text: string, rate: number = 0.7) {
        console.log(`[TTS:${langPrefix}] speaking: ${text}`);

        if ("speechSynthesis" in window && candidateVoices.length > 0) {
            let voice =
                candidateVoices.find(v => v.name === SPEAKER_MAP[langPrefix]) ??
                candidateVoices[Math.floor(Math.random() * candidateVoices.length)];

            const utter = new SpeechSynthesisUtterance(text);
            utter.voice = voice;
            utter.lang = voice.lang;
            utter.rate = rate;

            console.log(`[TTS:${langPrefix}] using voice: ${voice.name} (${voice.lang})`);
            speechSynthesis.speak(utter);
        } else {
            console.warn(`[TTS:${langPrefix}] falling back to native invoke('speak')`);
            try {
                await invoke("plugin:tts|speak", {
                    text,
                    language: langPrefix,
                });
            } catch (err) {
                console.error("Native TTS invocation failed", err);
            }
        }
    };
}
