import { useSettingsStore } from "@/store/settings";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowRightCircle, ArrowLeftCircle, ExternalLink, Volume2 } from "lucide-react";
import { useMemo } from "react";
import { ScrollIndicatorWrapper } from "./ScrollIndicatorWrapper";
import { createVoiceTTS } from "@/util/speak";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/util/convert";

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
    vi: "Xin chào! Đây là âm thanh của tiếng Việt.",
    pl: "Cześć! Tak brzmi język polski.",
    hu: "Szia! Így hangzik a magyar.",
    fa: "سلام! این صدای زبان فارسی است.",
};

function getPlatformInfo() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        return {
            name: "Android",
            link: "https://support.google.com/accessibility/android/answer/6006983?hl=en", // Select to Speak official guide
        };
    }
    if (/iPad|iPhone|iPod/.test(ua)) {
        return {
            name: "iOS",
            link: "https://support.apple.com/en-us/111798", // How iPhone/iPad speaks text
        };
    }
    if (/macintosh|mac os/i.test(ua)) {
        return {
            name: "macOS",
            link: "https://support.apple.com/en-us/111798", // Also covers Mac
        };
    }
    if (/windows/i.test(ua)) {
        return {
            name: "Windows",
            link: "https://support.microsoft.com/en-us/windows/chapter-1-introducing-narrator-7fe8fd72-541f-4536-7658-bfc37ddaf9c6", // Narrator (Windows TTS)
        };
    }
    return {
        name: "your device",
        link: "https://en.wikipedia.org/wiki/Speech_synthesis#Personal_computers",
    };
}

export function OnboardingTTSInstructions() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const { t } = useTranslation()
    const dir = useSettingsStore(s => s.dir);
    const platform = useMemo(() => getPlatformInfo(), []);
    const languages = useSettingsStore(s => s.languages);

    const getSample = (code: string) =>
        SAMPLES[code] || SAMPLES[code.split("-")[0]] || SAMPLES["en"];

    const speak = (text: string, lang: string) => {
        try {
            createVoiceTTS(lang)(text);
        } catch (e) {
            alert("Unable to speak. TTS error.");
        }
    };

    return (
        <div className="flex flex-col h-full w-full pt-safe my-3">
            {/* Header nav always on top */}
            <div className="w-full max-w-xl mx-auto flex flex-row items-center justify-between py-5 px-2"
                style={{ height: 100 }}
            >
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md p-3 shadow transition border"
                    onClick={() => setStep(2)}
                    tabIndex={0}
                >
                    <ArrowLeftCircle size={30} />
                </button>
                <div
                    className="flex-1 text-center text-sm font-semibold text-gray-800 select-none px-2"
                    style={{ letterSpacing: 0.25 }}
                    dir={dir()}
                >
                    {t("onboarding.textToSpeechSetup")}
                </div>
                {/* Make NEXT the prominent action: Purple styling */}
                <button
                    // className="flex items-center justify-center bg-white border-2 border-purple-700 hover:bg-purple-50 text-purple-700 hover:text-purple-800 rounded-md font-semibold text-lg shadow-lg px-5 py-4 gap-1 transition"
                    className="flex items-center justify-center rounded-md p-3 shadow transition bg-black hover:bg-gray-900 text-white border border-purple-400"
                    onClick={() => setStep(4)}
                    tabIndex={0}
                >
                    <ArrowRightCircle size={30} />
                </button>
            </div>

            {/* Main scrollable content with scroll indicators */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0 w-full overflow-y-auto mb-10">
                <ScrollIndicatorWrapper
                    className="w-full max-w-xl flex flex-col items-center mx-auto"
                >
                    <div className="flex flex-col gap-7 max-w-lg w-full items-center mt-10">
                        <div className="text-lg text-gray-800 text-center select-none" dir={dir()}>
                            {t("settings.testTts")}
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
                                        rounded-md
                                        bg-gray-100 hover:bg-purple-50
                                        border border-gray-200
                                        text-base font-semibold text-gray-800
                                        shadow-sm
                                        transition
                                        min-w-[140px]
                                        justify-center
                                    "
                                    dir={isRTL(code) ? "rtl" : "ltr"}
                                >
                                    <Volume2 size={20} className="text-purple-700" />
                                    <span className="truncate max-w-[100px]">
                                        {getSample(code.split("-")[0])}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="text-lg text-gray-800 text-center select-none" dir={dir()}>
                            {t("onboarding.ttsPoorQualityNote")}
                        </div>
                        {/* Normal link for TTS setup instructions */}
                        <div className="text-center">
                            <button
                                className="inline-flex items-center gap-1 text-purple-700 underline hover:text-purple-900 text-base font-medium mb-10"
                                style={{ padding: 0, background: "none", border: "none" }}
                                onClick={() => openUrl(platform.link)}
                                tabIndex={0}
                                dir={dir()}
                            >
                                {t("onboarding.howToSetupTtsOn") + " " + platform.name}
                                <ExternalLink
                                    style={{ width: 18, height: 18, minWidth: 18, minHeight: 18 }}
                                    size={18}
                                />
                            </button>
                        </div>
                    </div>
                </ScrollIndicatorWrapper>
            </div>
        </div>
    );
}
