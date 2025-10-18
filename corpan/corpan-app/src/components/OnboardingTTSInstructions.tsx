// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructions.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";

import {
    detectOSFromUA,
    getVoices,
    sortVoicesWithLangBias,
    deepLinkToVoiceInstall,
    openTtsSettings,
    type VoiceInfo,
} from "@/util/tts-voices";

import { createVoiceTTS } from "@/util/speak";
import { isRTL } from "@/util/convert";
import { useSettingsStore } from "@/store/settings";

import { OnboardingTTSInstructionsHeaderActions } from "./OnboardingTTSInstructionsHeaderActions";
import { OnboardingTTSInstructionsLanguageSection } from "./OnboardingTTSInstructionsLanguageSection";
import { OnboardingHeader, STEPS } from "./OnboardingHeader";

/* -------------------------------- Samples (not UI text) -------------------------------- */
const SAMPLES: Record<string, string> = {
    en: "I'm looking forward to learning with you.",
    es: "¡Estoy deseando aprender contigo!",
    fr: "J'ai hâte d'apprendre avec vous.",
    de: "Ich freue mich darauf, mit Ihnen zu lernen.",
    it: "Non vedo l'ora di imparare con te.",
    ru: "Я с нетерпением жду возможности учиться вместе с вами.",
    ko: "당신과 함께 배우기를 고대하고 있습니다.",
    ja: "あなたと一緒に学ぶことを楽しみにしています。",
    zh: "我期待着与你一起学习。",
    pt: "Estou ansioso para aprender com você.",
    tr: "Seninle öğrenmeyi dört gözle bekliyorum.",
    ar: "متحمس للتعلم معك.",
    hi: "मैं आपके साथ सीखने के लिए उत्सुक हूँ।",
    vi: "Tôi mong được học cùng bạn.",
    pl: "Nie mogę się doczekać nauki z tobą.",
    hu: "Alig várom, hogy tanulhassak veled.",
    fa: "سبوس دارم با شما یاد بگیرم.",
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
    const toggleVoiceSelection = useSettingsStore((s) => s.toggleVoiceSelection);

    const { t } = useTranslation();
    const os = useMemo(() => detectOSFromUA(), []);
    const [voices, setVoices] = useState<VoiceInfo[]>([]);

    const visibleRef = useRef(true);
    const pollTimer = useRef<number | null>(null);

    // Refresh voices (hot updates while user installs/enables packs)
    async function refresh() {
        const raw = await getVoices({});
        const list = uniqBy(raw, (v) => `${v.id}|${v.language}`);
        setVoices(list);
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

    async function speakExact(voice: VoiceInfo, text: string, rate = 0.9) {
        console.warn("speakExact", voice.id);
        try {
            // IMPORTANT: plugin expects { args: { ... , voice_id } }
            await invoke("plugin:tts|speak", {
                args: {
                    text,
                    language: voice.language,
                    rate,
                    voice_id: voice.id,
                },
            });
        } catch {
            try {
                await createVoiceTTS(voice.language)(text, rate);
            } catch {
                /* noop */
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
        // NO filtering by quality here — show everything the native layer allowed.
        const compatible = voices.filter((v) => {
            const L = (v.language || "").toLowerCase();
            const c = code.toLowerCase();
            return L === c || L.startsWith(c + "-") || baseLang(L) === baseLang(c);
        });
        const unique = uniqBy(compatible, (v) => `${v.id}|${v.language}`);
        // Stable, helpful order: exact/base matches & higher quality float up, but everything stays visible.
        return sortVoicesWithLangBias(unique, code);
    }

    return (
        <section
            id="onboarding-scroll"
            className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto overscroll-contain bg-white md:bg-gray-50"
            style={{
                WebkitOverflowScrolling: "touch",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
            }}
            dir={dir()}
        >
            <OnboardingHeader
                title={t("onboarding.textToSpeechSetup", { defaultValue: "Text-to-speech setup" })}
                steps={stepLabels}
                currentIndex={CURRENT_STEP_IDX}
                onBack={() => setStep(2)}
                onNext={() => setStep(4)}
                canNext={true}
            >
                <OnboardingTTSInstructionsHeaderActions
                    os={os}
                    onOpenInstaller={openInstaller}
                    onOpenSettings={openSettings}
                />
            </OnboardingHeader>

            {/* Content below header (no extra offset needed; header height is measured) */}
            <main
                className="flex-1 min-h-0"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
                <div className="mx-auto w-full max-w-5xl px-3">
                    {langs.map((code) => {
                        const list = voicesForLang(code);
                        const pref = voicePrefs[code] ?? { ids: [], mode: "cycle" as const };
                        const sample = sampleFor(code);

                        return (
                            <OnboardingTTSInstructionsLanguageSection
                                key={code}
                                code={code}
                                voices={list}
                                selectedIds={pref.ids}
                                onToggleSelect={(voiceId) => toggleVoiceSelection(code, voiceId)}
                                onPreviewAny={(voice) => speakExact(voice, sample, 0.9)}
                                previewSampleText={sample}
                                isRTL={isRTL(code)}
                            />
                        );
                    })}
                </div>
                <div className="h-8"
                    style={{
                        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
                    }}
                />
            </main>
        </section>
    );
}
