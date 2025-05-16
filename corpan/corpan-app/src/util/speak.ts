import { invoke } from "@tauri-apps/api/core";


// static map of language codes to names
const LANGUAGE_NAMES: Record<string, string> = {
    // was working but then stopped?
    // "en": "Ava",
    // "en": "Daniel",
    "en": "Tessa",
    // "en": "Karen",
    "es": "Mónica",
    "zh": "Meijia",
    "ar": "Majed",
    "ru": "Milena",
    // "it": "Rocko",
    // "fr": "Thomas",
    "fr": "Amélie",
    "ja": "Kyoko",
    "it": "Alice",
    "de": "Anna",
    "pt": "Luciana",
    "hi": "Lekha",
    // Why are these so terrible?
    // "en": "Flo", XXXX
    // "en": "Eddy", XXXX
    //6
    // "Flo (en-GB)"
    // 7
    // "Eddy (en-GB)"
    // 8
    // "Reed (en-GB)"
    // 9
    // "Sandy (en-GB)"
    // 10
    // "Moira (en-IE)"
    // 11
    // "Rishi (en-IN)"
    // 12
    // "Flo (en-US)"
    // 13
    // "Bahh (en-US)"
    // 14
    // "Albert (en-US)"
    // 15
    // "Fred (en-US)"
    // 16
    // "Jester (en-US)"
    // 17
    // "Organ (en-US)"
    // 18
    // "Cellos (en-US)"
    // 19
    // "Zarvox (en-US)"
    // 20
    // "Rocko (en-US)"
    // 21
    // "Shelley (en-US)"
    // 22
    // "Superstar (en-US)"
    // 23
    // "Grandma (en-US)"
    // 24
    // "Eddy (en-US)"
    // 25
    // "Bells (en-US)"
    // 26
    // "Grandpa (en-US)"
    // 27
    // "Trinoids (en-US)"
    // 28
    // "Kathy (en-US)"
    // 29
    // "Reed (en-US)"
    // 30
    // "Boing (en-US)"
    // 31
    // "Whisper (en-US)"
    // 32
    // "Good News (en-US)"
    // 33
    // "Wobble (en-US)"
    // 34
    // "Bad News (en-US)"
    // 35
    // "Bubbles (en-US)"
    // 36
    // "Samantha (en-US)"
    // 37
    // "Sandy (en-US)"
    // 38
    // "Junior (en-US)"
    // 39
    // "Ralph (en-US)"
    // 40
    // "Tessa (en-ZA)"
    // 41
    // "Moira (en-IE)"
    // 42
    // "Tessa (en-ZA)"
    // 43
    // "Karen (en-AU)"
    // 44
    // "Daniel (en-GB)"
    // 45
    // "Rishi (en-IN)"
    // 46
    // "Samantha (en-US)"
    "ko": "Yuna",
}




/**
 * createVoiceTTS: Generic factory for a speak(text) function
 * that picks only high-quality voices for the given lang prefix
 * and then randomizes among them on each call. Falls back to
 * Tauri invoke('speak') if the Web Speech API isn’t available.
 */
export function createVoiceTTS(langPrefix: string) {
    let candidateVoices: SpeechSynthesisVoice[] = [];

    function refreshVoices() {
        const all = window.speechSynthesis
            .getVoices()
            .filter((v): v is SpeechSynthesisVoice =>
                typeof v.lang === "string" && v.lang.startsWith(langPrefix)
            );

        // const premium = all.filter(
        //     (v) => v.localService || /Neural|Enhanced|Premium/i.test(v.name)
        // );

        // candidateVoices = premium.length > 0 ? premium : all;

        candidateVoices = all;
        console.log(`[TTS:${langPrefix}] candidate voices:`, candidateVoices);
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
            // const voice =
            //     candidateVoices.find((v) => v.name === "Yuna") ||
            //     candidateVoices.find((v) => v.name === "Samantha") ||
            //     candidateVoices[
            //     Math.floor(Math.random() * candidateVoices.length)
            //     ];

            // if in LANGUAGE_NAMES, use that
            // candidateVoices = candidateVoices.reverse();
            let voice = candidateVoices.find((v) =>
                v.name === LANGUAGE_NAMES[langPrefix]
            );
            if (!voice) {
                console.warn(
                    `[TTS:${langPrefix}] no voice found for ${LANGUAGE_NAMES[langPrefix]}`
                );
                voice =
                    candidateVoices.find((v) => v.name === "Yuna") ||
                    // candidateVoices.find((v) => v.name === "Samantha") ||
                    // fallback to random
                    candidateVoices[
                    Math.floor(Math.random() * candidateVoices.length)
                    ];
            }
            const utter = new SpeechSynthesisUtterance(text);
            utter.voice = voice;
            utter.lang = voice.lang;
            utter.rate = 0.55;
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
