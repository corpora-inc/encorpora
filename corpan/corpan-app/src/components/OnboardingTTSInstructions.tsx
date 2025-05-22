import { useSettingsStore } from "@/store/settings";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowRightCircle, ArrowLeftCircle, ExternalLink, Volume2 } from "lucide-react";
import { useMemo } from "react";
import { ScrollIndicatorWrapper } from "./ScrollIndicatorWrapper";
import { createVoiceTTS } from "@/util/speak"; // (lang) => (text) => void

const SAMPLES: Record<string, string> = {
    en: "Hello! This is what English sounds like.",
    es: "¡Hola! Así suena el español.",
    fr: "Bonjour ! Voici à quoi ressemble le français.",
    de: "Hallo! So klingt Deutsch.",
    it: "Ciao! Ecco come suona l'italiano.",
    ru: "Здравствуйте! Вот как звучит русский язык.",
    ko: "안녕하세요! 이것이 한국어의 소리예요.",
    ja: "こんにちは！これが日本語の音です。",
    zh: "你好！这就是中文的发音。",
    pt: "Olá! É assim que soa o português.",
    tr: "Merhaba! Türkçe böyle duyulur.",
    ar: "مرحبًا! هكذا تبدو اللغة العربية.",
    hi: "नमस्ते! यह हिंदी की आवाज़ है।",
};

function getPlatformInfo() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        return {
            name: "Android",
            link: "https://support.google.com/accessibility/android/answer/6006983?hl=en",
        };
    }
    if (/iPad|iPhone|iPod/.test(ua)) {
        return {
            name: "iOS",
            link: "https://support.apple.com/en-us/HT207180",
        };
    }
    if (/macintosh|mac os/i.test(ua)) {
        return {
            name: "macOS",
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
        link: "https://en.wikipedia.org/wiki/Speech_synthesis#Personal_computers",
    };
}

export function OnboardingTTSInstructions() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const t = useSettingsStore(s => s.t);
    const dir = useSettingsStore(s => s.dir);
    const platform = useMemo(() => getPlatformInfo(), []);
    const languages = useSettingsStore(s => s.languages);

    const getSample = (code: string) =>
        SAMPLES[code] || SAMPLES[code.split("-")[0]] || SAMPLES["en"];

    const speak = (text: string, lang: string) => {
        try {
            createVoiceTTS(lang.split('-')[0])(text);
        } catch (e) {
            alert("Unable to speak. TTS error.");
        }
    };

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header nav always on top */}
            <div className="w-full max-w-xl mx-auto flex flex-row items-center justify-between py-5 px-2">
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 shadow transition"
                    onClick={() => setStep(2)}
                    tabIndex={0}
                >
                    <ArrowLeftCircle size={30} />
                </button>
                <div
                    className="flex-1 text-center text-lg font-semibold text-gray-800 select-none px-2"
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

            {/* Main scrollable content with scroll indicators */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
                <ScrollIndicatorWrapper
                    className="w-full max-w-xl flex flex-col gap-7 items-center px-2 pb-8 mx-auto"
                >
                    <div className="flex flex-col gap-7 max-w-lg w-full items-center">
                        <div className="text-lg text-gray-800 text-center select-none" dir={dir()}>
                            {t("test_tts")}
                        </div>
                        {/* TTS Sample Buttons */}
                        <div className="w-full flex flex-wrap justify-center gap-3">
                            {languages.map((code) => (
                                <button
                                    key={code}
                                    onClick={() => speak(getSample(code), code)}
                                    className="
                                        flex items-center gap-2
                                        px-4 py-3
                                        rounded-xl
                                        bg-gray-100 hover:bg-purple-50
                                        border border-gray-200
                                        text-base font-semibold text-gray-800
                                        shadow-sm
                                        transition
                                        min-w-[140px]
                                        justify-center
                                    "
                                    dir={code === "ar" ? "rtl" : "ltr"}
                                >
                                    <Volume2 size={20} className="text-purple-700" />
                                    <span className="truncate max-w-[100px]">
                                        {getSample(code.split("-")[0])}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="text-lg text-gray-800 text-center select-none" dir={dir()}>
                            {t("If audio sounds poor, go to your device's TTS settings and install high-quality voices.")}
                        </div>
                    </div>
                    <button
                        className="
                            px-5 py-4
                            bg-white
                            border-2 border-purple-700
                            hover:bg-purple-50
                            text-purple-700
                            hover:text-purple-800
                            rounded-2xl font-semibold text-lg shadow-lg
                            flex items-center gap-1 transition justify-center
                        "
                        onClick={() => openUrl(platform.link)}
                        dir={dir()}
                    >
                        {t("How to set up TTS on") + " " + platform.name}
                        <ExternalLink
                            style={{ width: 22, height: 22, minWidth: 22, minHeight: 22 }}
                            size={22} />
                    </button>
                </ScrollIndicatorWrapper>
            </div>
        </div>
    );
}
