/**
 * createVoiceTTS: Generic factory for a speak(text) function
 * that picks only high-quality voices for the given lang prefix
 * and then randomizes among them on each call.
 */
function createVoiceTTS(langPrefix: string) {
    let candidateVoices: SpeechSynthesisVoice[] = [];

    // Build the shortlist of “premium” voices
    function refreshVoices() {
        const all = window.speechSynthesis.getVoices().filter((v): v is SpeechSynthesisVoice => {
            return (
                v != null &&
                typeof v.lang === "string" &&
                v.lang.startsWith(langPrefix)
            );
        });

        // First, try to pick only local “system” or named premium voices
        const premium = all.filter((v) =>
            v.localService || /Neural|Enhanced|Premium/i.test(v.name)
        );

        if (premium.length > 0) {
            console.log("HAVE PREMIUM VOICES", premium);
            candidateVoices = premium;
        } else {
            // Fallback to any Korean voices
            console.log("NO PREMIUM VOICES", all);
            candidateVoices = all;
        }

        console.log(
            `[TTS:${langPrefix}] candidate voices:`,
            candidateVoices.map((v) => `${v.name} (${v.lang})`)
        );
    }

    // Ensure list is fresh whenever voice data changes
    speechSynthesis.onvoiceschanged = refreshVoices;
    // Also run once at startup (in case voices are already loaded)
    refreshVoices();

    return function speak(text: string) {
        console.log(`[TTS:${langPrefix}] speaking: ${text}`);
        if (candidateVoices.length === 0) {
            console.warn(`[TTS:${langPrefix}] No voices found for ${langPrefix}`);
            return;
        }

        // // Pick a random voice from the shortlist
        // const v = candidateVoices[
        //     Math.floor(Math.random() * candidateVoices.length)
        // ];

        // pick Yuna for ko-KR and pick a random one for en-US
        const v = candidateVoices.find((v) => v.name === "Yuna") ||
            candidateVoices.find((v) => v.name === "Samantha") ||
            // candidateVoices.find((v) => v.name === "Kathy") ||
            // candidateVoices.find((v) => v.name === "Shelley") ||
            candidateVoices[
            Math.floor(Math.random() * candidateVoices.length)
            ];

        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = v;
        utter.lang = v.lang;
        utter.rate = 0.5;
        console.log(`[TTS:${langPrefix}] speaking with ${v.name}`);
        speechSynthesis.speak(utter);
    };
}

// Export two instances:
export const speakKO = createVoiceTTS("ko");
export const speakEN = createVoiceTTS("en");
