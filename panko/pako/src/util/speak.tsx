// /**
//  * createKoreanTTS: initializes and returns a `speak` function
//  * that uses the highest-quality available Korean voice in the
//  * current browser/OS environment.
//  */
// export function createKoreanTTS() {
//     let bestVoice: SpeechSynthesisVoice | null = null;

//     // Score voices by premium status and local availability
//     function scoreVoice(v: SpeechSynthesisVoice) {
//         let score = 0;
//         if (/(Enhanced|Neural)/i.test(v.name)) score += 2; // premium voices
//         if (v.localService) score += 1;                    // offline/system voices
//         return score;
//     }

//     // Select the best ko-KR voice whenever voices list updates
//     function selectBestVoice() {
//         let voices = speechSynthesis
//             .getVoices()
//             .filter(v => v.lang === 'ko-KR');
//         if (voices.length === 0) return;
//         voices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
//         voices = voices.filter(v => scoreVoice(v) > 2);
//         // bestVoice = voices[0];
//         // get random choice of voices

//         const randomIndex = Math.floor(Math.random() * voices.length);
//         bestVoice = voices[randomIndex];
//         console.log(`Best voice KO: ${bestVoice?.name}: score: ${scoreVoice(bestVoice)}`);
//     }

//     // Re-run selection when browser loads or updates voices
//     speechSynthesis.onvoiceschanged = selectBestVoice;
//     selectBestVoice();

//     // The returned speak function
//     return function speak(text: string) {
//         // if (!bestVoice) selectBestVoice();
//         selectBestVoice()
//         const u = new SpeechSynthesisUtterance(text);
//         u.voice = bestVoice;
//         u.lang = 'ko-KR';
//         speechSynthesis.speak(u);
//     };
// }

// export function createEnglishTTS() {
//     let bestVoice: SpeechSynthesisVoice | null = null;

//     // Score voices by premium status and local availability
//     function scoreVoice(v: SpeechSynthesisVoice) {
//         let score = 0;
//         if (/(Enhanced|Neural)/i.test(v.name)) score += 2; // premium voices
//         if (v.localService) score += 1;                    // offline/system voices
//         return score;
//     }

//     // Select the best en-US voice whenever voices list updates
//     function selectBestVoice() {
//         const voices = speechSynthesis
//             .getVoices()
//             .filter(v => v.lang === 'en-US');
//         if (voices.length === 0) return;
//         voices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
//         // bestVoice = voices[0];
//         const randomIndex = Math.floor(Math.random() * voices.length);
//         bestVoice = voices[randomIndex];
//         console.log(`Best voice EN: ${bestVoice?.name} score: ${scoreVoice(bestVoice)}`);
//     }

//     // Re-run selection when browser loads or updates voices
//     speechSynthesis.onvoiceschanged = selectBestVoice;
//     selectBestVoice();

//     // The returned speak function
//     return function speak(text: string) {
//         selectBestVoice()
//         const u = new SpeechSynthesisUtterance(text);
//         u.voice = bestVoice;
//         u.lang = 'en-US';
//         speechSynthesis.speak(u);
//     };
// }

// export const speakKO = createKoreanTTS();
// export const speakEN = createEnglishTTS();

// src/util/speak.ts

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
        if (candidateVoices.length === 0) {
            console.warn(`[TTS:${langPrefix}] No voices found for ${langPrefix}`);
            return;
        }

        // Pick a random voice from the shortlist
        const v = candidateVoices[
            Math.floor(Math.random() * candidateVoices.length)
        ];

        const utter = new SpeechSynthesisUtterance(text);
        utter.voice = v;
        utter.lang = v.lang;
        console.log(`[TTS:${langPrefix}] speaking with ${v.name}`);
        speechSynthesis.speak(utter);
    };
}

// Export two instances:
export const speakKO = createVoiceTTS("ko");
export const speakEN = createVoiceTTS("en");
