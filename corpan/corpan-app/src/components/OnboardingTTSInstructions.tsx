// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructions.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
    OnboardingTTSInstructionsLanguageSection,
    type LangMode,
} from "./OnboardingTTSInstructionsLanguageSection";

import { OnboardingHeader, STEPS } from "./OnboardingHeader";

/* -------------------------------- Samples (not UI text) -------------------------------- */
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
    return {
        name: "device",
        link: "https://en.wikipedia.org/wiki/Speech_synthesis#Personal_computers",
    };
}

function baseLang(tag: string) {
    const t = tag.toLowerCase();
    const i = t.indexOf("-");
    return i === -1 ? t : t.slice(0, i);
}
function sampleFor(lang: string) {
    return SAMPLES[lang] || SAMPLES[baseLang(lang)] || SAMPLES["en"];
}

/* -------------------------------- Component -------------------------------- */

const CURRENT_STEP_IDX = 1; // learning=0, TTS=1, levels=2, domains=3, socials=4

export function OnboardingTTSInstructions() {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const languages = useSettingsStore((s) => s.languages);
    const dir = useSettingsStore((s) => s.dir);

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

    // Refresh voices (hot updates while user installs/enables packs)
    async function refresh() {
        try {
            const raw = await getVoices({});
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

    // Actions
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
        try {
            await invoke("plugin:tts|speak", {
                args: {
                    text,
                    language: voice.language,
                    rate,
                    voiceId: voice.id,
                },
            });
        } catch {
            try {
                await createVoiceTTS(voice.language)(text, rate);
            } catch {
                // icon-only UI; swallow
            }
        }
    }

    const stepLabels = useMemo(
        () =>
            STEPS.map((s, i) =>
                i === CURRENT_STEP_IDX
                    ? t("onboarding.ttsStepTitle", { defaultValue: s.label })
                    : t(`onboarding.${s.key}`, { defaultValue: s.label })
            ),
        [t]
    );

    const langs =
        (languages && languages.length
            ? languages
            : Array.from(new Set(voices.map((v) => baseLang(v.language))))) || [];

    function voicesForLang(code: string): VoiceInfo[] {
        const filtered = voices.filter((v) => {
            const L = v.language.toLowerCase();
            const c = code.toLowerCase();
            const matches =
                L === c || L.startsWith(c + "-") || baseLang(L) === baseLang(c);
            if (!matches) return false;
            if (!showHQOnly) return true;
            return (
                v.quality === "enhanced" ||
                v.quality === "high" ||
                v.quality === "very_high"
            );
        });

        const unique = uniqBy(filtered, (v) => `${v.id}|${v.language}`);
        return sortVoicesForLanguage(unique, code);
    }

    // We generally allow proceeding even if no voices yet; user can install later.
    const canNext = true;

    return (
        <section
            id="onboarding-scroll"
            className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto overscroll-contain bg-white md:bg-gray-50"
            style={{
                WebkitOverflowScrolling: "touch",
                // keep L/R safe-area on the scrollport
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
                // no top/bottom safe-area here (top on header, bottom on main)
            }}
            dir={dir()}
        >
            {/* Shared sticky header with blur */}
            <OnboardingHeader
                title={t("onboarding.textToSpeechSetup", {
                    defaultValue: "Text-to-speech setup",
                })}
                steps={stepLabels}
                currentIndex={CURRENT_STEP_IDX}
                onBack={() => setStep(2)} // keep your existing step indices
                onNext={() => setStep(4)}
                canNext={canNext}
                backAria={t("common.back", { defaultValue: "Back" })}
                nextAria={t("common.next", { defaultValue: "Next" })}
            />

            {/* Top actions / controls */}
            <div className="mx-auto w-full max-w-5xl px-3 pt-6">
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

            {/* Main voice picker list (fills to bottom; safe-area bottom padding here) */}
            <main
                className="flex-1 min-h-0"
                style={{
                    paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
                }}
            >
                <div className="mx-auto w-full max-w-5xl px-3">
                    {langs.map((code) => {
                        const list = voicesForLang(code);
                        const pref =
                            voicePrefs[code] ?? { ids: [], mode: "cycle" as LangMode };
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
                                onPreviewAny={(voice) => speakExact(voice, sample, 0.9)}
                                previewSampleText={sample}
                                isRTL={isRTL(code)}
                            />
                        );
                    })}
                </div>
            </main>
        </section>
    );
}
