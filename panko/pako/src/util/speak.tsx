import { invoke } from "@tauri-apps/api/core";

/**
 * createVoiceTTS: Generic factory for a speak(text) function
 * that picks only high-quality voices for the given lang prefix
 * and then randomizes among them on each call. Falls back to
 * Tauri invoke('speak') if the Web Speech API isn’t available.
 */
function createVoiceTTS(langPrefix: string) {
    let candidateVoices: SpeechSynthesisVoice[] = [];

    function refreshVoices() {
        const all = window.speechSynthesis
            .getVoices()
            .filter((v): v is SpeechSynthesisVoice =>
                typeof v.lang === "string" && v.lang.startsWith(langPrefix)
            );

        const premium = all.filter(
            (v) => v.localService || /Neural|Enhanced|Premium/i.test(v.name)
        );

        candidateVoices = premium.length > 0 ? premium : all;

        console.log(
            `[TTS:${langPrefix}] candidate voices:`,
            candidateVoices.map((v) => `${v.name} (${v.lang})`)
        );
    }

    // Only wire up the Web Speech listeners if it's supported
    if ("speechSynthesis" in window) {
        speechSynthesis.onvoiceschanged = refreshVoices;
        refreshVoices();
    }

    return async function speak(text: string) {
        console.log(`[TTS:${langPrefix}] speaking: ${text}`);

        // If Web Speech is available and we have voices, use it
        if (
            "speechSynthesis" in window &&
            candidateVoices.length > 0
        ) {
            const voice =
                candidateVoices.find((v) => v.name === "Yuna") ||
                candidateVoices.find((v) => v.name === "Samantha") ||
                candidateVoices[
                Math.floor(Math.random() * candidateVoices.length)
                ];

            const utter = new SpeechSynthesisUtterance(text);
            utter.voice = voice;
            utter.lang = voice.lang;
            utter.rate = 0.5;
            console.log(`[TTS:${langPrefix}] speaking with ${voice.name}`);
            speechSynthesis.speak(utter);
        } else {
            // Fallback to native mobile TTS via Tauri
            console.warn(
                `[TTS:${langPrefix}] falling back to native invoke('speak')`
            );
            try {
                await invoke("plugin:tts|speak", { text });
            } catch (err) {
                console.error("Native TTS invocation failed", err);
            }
        }
    };
}

// Export two instances:
export const speakKO = createVoiceTTS("ko");
export const speakEN = createVoiceTTS("en");
