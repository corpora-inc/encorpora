import { useSettingsStore } from "@/store/settings";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowRightCircle, ArrowLeftCircle, ExternalLink } from "lucide-react";
import { useMemo } from "react";

// Detect platform (very simple logic for demo; you can tune this!)
function getPlatformInfo() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        return {
            name: "Android",
            link: "https://support.google.com/accessibility/android/answer/6006983?hl=en", // Official TTS setup
        };
    }
    if (/iPad|iPhone|iPod/.test(ua)) {
        return {
            name: "iOS",
            link: "https://support.apple.com/en-us/HT207180", // Apple TTS (VoiceOver/Speak)
        };
    }
    if (/macintosh|mac os/i.test(ua)) {
        return {
            name: "macOS",
            // link: "https://support.apple.com/guide/mac-help/change-the-voice-your-mac-uses-to-speak-text-mchlp2290/15.0/mac/15.0"
            link: "https://support.apple.com/guide/mac-help/use-text-to-speech-mh27448/mac",
        };
    }
    if (/windows/i.test(ua)) {
        return {
            name: "Windows",
            link: "https://support.microsoft.com/en-us/windows/change-text-to-speech-settings-in-windows-10-70ad17c9-ace5-ecb3-c2e2-3650a7c29957",
        };
    }
    return {
        name: "your device",
        link: "https://en.wikipedia.org/wiki/Speech_synthesis#Personal_computers", // Fallback
    };
}

export function OnboardingTTSInstructions() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const t = useSettingsStore(s => s.t);
    const dir = useSettingsStore(s => s.dir);

    const platform = useMemo(() => getPlatformInfo(), []);

    // Single translation string: Keep it short, to the point.
    // Example English: "If the audio quality is poor, configure text-to-speech (TTS) voices in your device settings."
    // (You might have "TTS voices" as a translation variable if you want a truly short translation set.)

    return (
        <div className="flex flex-col h-full w-full">
            <div className="w-full max-w-xl mx-auto flex flex-row items-center justify-between py-5 px-2">
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 shadow transition"
                    onClick={() => setStep(2)}
                    tabIndex={0}
                >
                    <ArrowLeftCircle size={30} />
                </button>
                <div
                    className="flex-1 text-center text-lg font-semibold text-gray-800 select-none"
                    style={{ letterSpacing: 0.5 }}
                    dir={dir()}
                >
                    {t("Text-to-Speech Setup")}
                </div>
                <button
                    className="flex items-center justify-center bg-black hover:bg-gray-900 text-white rounded-full p-3 shadow transition"
                    onClick={() => setStep(4)}
                    tabIndex={0}
                >
                    <ArrowRightCircle size={30} />
                </button>
            </div>
            <div className="flex-1 w-full flex flex-col items-center justify-center px-20 pb-6">
                <div className="text-lg text-gray-800 text-center mb-5 select-none" dir={dir()}>
                    {t("If audio sounds poor, go to your device's TTS settings and install high-quality voices.")}
                </div>
                <a
                    href={platform.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-purple-700 font-semibold hover:underline transition text-base"
                    onClick={() => {
                        console.log("Opening TTS setup link:", platform.link);
                        openUrl(platform.link)
                    }}
                    dir={dir()}
                >
                    {t("How to set up TTS on")}
                    <ExternalLink className="ml-1 inline" size={18} />
                </a>
            </div>
        </div>
    );
}
