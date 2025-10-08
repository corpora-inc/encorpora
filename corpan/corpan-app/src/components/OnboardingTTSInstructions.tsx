// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructions.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRightCircle, ArrowLeftCircle } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

import {
    detectOSFromUA,
    getVoices,
    sortVoicesForLanguage,
    deepLinkToVoiceInstall,
    openTtsSettings,
    type VoiceInfo,
} from "@/util/tts-voices";

import { createVoiceTTS } from "@/util/speak";
import { isRTL } from "@/util/convert";
import { useSettingsStore } from "@/store/settings";

import { OnboardingTTSInstructionsHeaderActions } from "./OnboardingTTSInstructionsHeaderActions";
import { OnboardingTTSInstructionsLanguageSection, type LangMode } from "./OnboardingTTSInstructionsLanguageSection";

// -------------------- Spoken samples (not visible UI text) --------------------
const SAMPLES: Record<string, string> = {
    en: "Hello!",
    es: "¡Hola!",
    fr: "Bonjour !",
    de: "Hallo!",
    it: "Ciao!",
    ru: "Здравствуйте!",
    ko: "안녕하세요!",
    ja: "こんにちは！",
    zh: "你好！",
    pt: "Olá!",
    tr: "Merhaba!",
    ar: "مرحبًا!",
    hi: "नमस्ते!",
    vi: "Xin chào!",
    pl: "Cześć!",
    hu: "Szia!",
    fa: "سلام!",
};

// Small utility to ensure stable uniqueness across sources
function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of arr) {
        const k = key(item);
        if (!seen.has(k)) {
            seen.add(k);
            out.push(item);
        }
    }
    return out;
}

function platformDocLink() {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) {
        return {
            name: "Android",
            link: "https://support.google.com/accessibility/android/answer/6006983?hl=en",
        };
    }
    if (/iPad|iPhone|iPod/.test(ua)) {
        return { name: "iOS", link: "https://support.apple.com/en-us/111798" };
    }
    if (/macintosh|mac os/i.test(ua)) {
        return { name: "macOS", link: "https://support.apple.com/en-us/111798" };
    }
    if (/windows/i.test(ua)) {
        return {
            name: "Windows",
            link: "https://support.microsoft.com/en-us/windows/chapter-1-introducing-narrator-7fe8fd72-541f-4536-7658-bfc37ddaf9c6",
        };
    }
    return { name: "device", link: "https://en.wikipedia.org/wiki/Speech_synthesis#Personal_computers" };
}

function baseLang(tag: string) {
    const t = tag.toLowerCase();
    const i = t.indexOf("-");
    return i === -1 ? t : t.slice(0, i);
}
function sampleFor(lang: string) {
    return SAMPLES[lang] || SAMPLES[baseLang(lang)] || SAMPLES["en"];
}

export function OnboardingTTSInstructions() {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const languages = useSettingsStore((s) => s.languages);
    const dir = useSettingsStore((s) => s.dir);

    // Per-stack voice prefs + helpers
    const voicePrefs = useSettingsStore((s) => s.voicePrefs);
    const setVoiceMode = useSettingsStore((s) => s.setVoiceMode);
    const toggleVoiceSelection = useSettingsStore((s) => s.toggleVoiceSelection);

    const { t } = useTranslation();
    const platform = useMemo(() => platformDocLink(), []);
    const os = useMemo(() => detectOSFromUA(), []);
    const [voices, setVoices] = useState<VoiceInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHQOnly, setShowHQOnly] = useState(false);

    const visibleRef = useRef(true);
    const pollTimer = useRef<number | null>(null);

    // -------- Data refresh / hot updates --------
    async function refresh() {
        try {
            const raw = await getVoices({});
            // De-duplicate across potential multiple sources (plugin + web)
            const list = uniqBy(raw, (v) => `${v.id}|${v.language}`);
            setVoices(list);
            setLoading(false);
        } catch {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
        function onVisibility() {
            visibleRef.current = document.visibilityState !== "hidden";
            if (visibleRef.current) refresh();
        }
        document.addEventListener("visibilitychange", onVisibility);
        pollTimer.current = window.setInterval(() => {
            if (visibleRef.current) refresh();
        }, 4000);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            if (pollTimer.current) window.clearInterval(pollTimer.current);
        };
    }, []);

    // -------- Actions --------
    async function openInstaller() {
        await deepLinkToVoiceInstall();
    }
    async function openSettings() {
        await openTtsSettings();
    }
    function openGuide() {
        openUrl(platform.link);
    }

    async function speakExact(voice: VoiceInfo, text: string, rate = 0.9) {
        console.log("Speak exact", { voice, text, rate });
        try {
            await invoke("plugin:tts|speak", {
                args: {
                    text,
                    language: voice.language,
                    rate,
                    voiceId: voice.id,
                }
            });
        } catch {
            try {
                await createVoiceTTS(voice.language)(text, rate);
            } catch {
                // icon-only UI; no alert needed
            }
        }
    }

    const langs =
        (languages && languages.length
            ? languages
            : Array.from(new Set(voices.map((v) => baseLang(v.language))))) || [];

    function voicesForLang(code: string): VoiceInfo[] {
        const filtered = voices.filter((v) => {
            const L = v.language.toLowerCase();
            const c = code.toLowerCase();
            const matches = L === c || L.startsWith(c + "-") || baseLang(L) === baseLang(c);
            if (!matches) return false;
            if (!showHQOnly) return true;
            return v.quality === "enhanced" || v.quality === "high" || v.quality === "very_high";
        });

        // Extra safety: de-dupe within the section too
        const unique = uniqBy(filtered, (v) => `${v.id}|${v.language}`);
        return sortVoicesForLanguage(unique, code);
    }

    return (
        <div className="flex flex-col h-full w-full pt-safe my-3">
            {/* Header nav */}
            <div
                className="w-full max-w-5xl mx-auto flex flex-row items-center justify-between py-4 px-3 fixed"
                style={{ minHeight: 72 }}
            >
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md p-3 shadow transition border"
                    onClick={() => setStep(2)}
                    tabIndex={0}
                    aria-label={t("onboarding.welcome")}
                    title={t("onboarding.welcome")}
                >
                    <ArrowLeftCircle size={26} />
                </button>

                <div
                    className="flex-1 text-center text-sm sm:text-base font-semibold text-gray-800 select-none px-2"
                    style={{ letterSpacing: 0.2 }}
                    dir={dir()}
                >
                    {t("onboarding.textToSpeechSetup")}
                </div>

                <button
                    className="flex items-center justify-center rounded-md p-3 shadow transition bg-black hover:bg-gray-900 text-white border border-purple-400"
                    onClick={() => setStep(4)}
                    tabIndex={0}
                    aria-label={t("onboarding.reonboard")}
                    title={t("onboarding.reonboard")}
                >
                    <ArrowRightCircle size={26} />
                </button>
            </div>

            {/* Top actions */}
            <div className="w-full max-w-5xl mx-auto px-3 pt-20">
                <OnboardingTTSInstructionsHeaderActions
                    os={os}
                    loading={loading}
                    totalCount={voices.length}
                    showHQOnly={showHQOnly}
                    onToggleHQ={() => setShowHQOnly((v) => !v)}
                    onRefresh={refresh}
                    onOpenInstaller={openInstaller}
                    onOpenSettings={openSettings}
                    onOpenGuide={openGuide}
                />
            </div>

            {/* Main voice picker */}
            <div className="flex-1 overflow-y-auto">
                <div className="w-full max-w-5xl mx-auto px-3 pb-16">
                    {langs.map((code) => {
                        const list = voicesForLang(code);
                        const pref = voicePrefs[code] ?? { ids: [], mode: "cycle" as LangMode };
                        const sample = sampleFor(code);

                        return (
                            <OnboardingTTSInstructionsLanguageSection
                                key={code}
                                code={code}
                                voices={list}
                                selectedIds={pref.ids}
                                mode={pref.mode}
                                onToggleSelect={(voiceId) => toggleVoiceSelection(code, voiceId)}
                                onChangeMode={(m) => setVoiceMode(code, m)}
                                onPreviewAny={(voice) => {
                                    console.log("Preview voice", voice);
                                    speakExact(voice, sample, 0.9)
                                }}
                                previewSampleText={sample}
                                isRTL={isRTL(code)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
