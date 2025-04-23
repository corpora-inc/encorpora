/**
 * createKoreanTTS: initializes and returns a `speak` function
 * that uses the highest-quality available Korean voice in the
 * current browser/OS environment.
 */
export function createKoreanTTS() {
    let bestVoice: SpeechSynthesisVoice | null = null;

    // Score voices by premium status and local availability
    function scoreVoice(v: SpeechSynthesisVoice) {
        let score = 0;
        if (/(Enhanced|Neural)/i.test(v.name)) score += 2; // premium voices
        if (v.localService) score += 1;                    // offline/system voices
        return score;
    }

    // Select the best ko-KR voice whenever voices list updates
    function selectBestVoice() {
        const voices = speechSynthesis
            .getVoices()
            .filter(v => v.lang === 'ko-KR');
        if (voices.length === 0) return;
        voices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
        // bestVoice = voices[0];
        // get random choice of voices

        const randomIndex = Math.floor(Math.random() * voices.length);
        bestVoice = voices[randomIndex];
    }

    // Re-run selection when browser loads or updates voices
    speechSynthesis.onvoiceschanged = selectBestVoice;
    selectBestVoice();

    // The returned speak function
    return function speak(text: string) {
        // if (!bestVoice) selectBestVoice();
        selectBestVoice()
        const u = new SpeechSynthesisUtterance(text);
        u.voice = bestVoice;
        u.lang = 'ko-KR';
        speechSynthesis.speak(u);
    };
}

// // Usage example:
export const speak = createKoreanTTS();
// speakKorean('안녕하세요, 반갑습니다!');
