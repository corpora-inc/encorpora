// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructions.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";

import {
    detectOSFromUA,
    getVoices,
    getTtsEngineStatus,
    sortVoicesWithLangBias,
    deepLinkToVoiceInstall,
    openTtsSettings,
    openTtsEngineStore,
    openTtsEngineAppDetails,
    openAppleFeedback,
    probeTtsHealth,
    tryAutoRecover,
    installVoiceData,
    langMatchScore,
    type VoiceInfo,
    type TtsEngineStatus,
    type TtsHealthProbe,
    type TtsDiagnosis,
} from "@/util/tts-voices";
import { isAppleIOSVoiceGap } from "@/util/appleVoiceGaps";

import { createVoiceTTS } from "@/util/speak";
import { isRTL } from "@/util/convert";
import { useSettingsStore } from "@/store/settings";

import { OnboardingTTSInstructionsHeaderActions } from "./OnboardingTTSInstructionsHeaderActions";
import { OnboardingTTSInstructionsLanguageSection } from "./OnboardingTTSInstructionsLanguageSection";
import { OnboardingHeader, STEPS } from "./OnboardingHeader";
import { OnboardingTTSRescueCard } from "./OnboardingTTSRescueCard";
import {
    OnboardingTTSProbing,
    OnboardingTTSReadyConfirm,
} from "./OnboardingTTSPhaseStates";

const GOOGLE_TTS_PACKAGE = "com.google.android.tts";

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
    bn: "আমি আপনার সাথে শেখার জন্য উন্মুখ।",
    vi: "Tôi mong được học cùng bạn.",
    pl: "Nie mogę się doczekać nauki z tobą.",
    hu: "Alig várom, hogy tanulhassak veled.",
    fa: "سبوس دارم با شما یاد بگیرم.",
    th: "ฉันตั้งตารอที่จะได้เรียนรู้กับคุณ",
    id: "Saya menantikan untuk belajar bersama Anda.",
    ta: "நான் உங்களுடன் கற்கவும் ஆவலாக காத்திருக்கிறேன்.",
    te: "నేను మీతో నేర్చుకోవడానికి ఎదురు చూస్తున్నాను.",
    kn: "ನಾನು ನಿಮ್ಮೊಂದಿಗೆ ಕಲಿಯಲು ಎದುರು ನೋಡುತ್ತಿದ್ದೇನೆ.",
    mr: "मी तुमच्यासोबत शिकण्यासाठी उत्सुक आहे.",
    gu: "હું તમારી સાથે શીખવા માટે આતુર છું.",
    "pa-Guru": "ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਸਿੱਖਣ ਲਈ ਉਤਸੁਕ ਹਾਂ.",
    "pa-Arab": "میں تہاڈے نال سکھن لئی اتسک ہاں.",
    ur: "میں آپ کے ساتھ سیکھنے کا منتظر ہوں۔",
    ne: "म तपाईंसँग सिक्न उत्सुक छु।",
    "pt-PT": "Estou ansioso por aprender consigo.",
    hr: "Veselim se učenju s tobom.",
    sr: "Радујем се учењу са тобом.",
    uk: "Я з нетерпінням чекаю, щоб вчитися з тобою.",
    bg: "С нетърпение очаквам да уча с теб.",
    ro: "Abia aștept să învăț cu tine.",
    ca: "Tinc moltes ganes d'aprendre amb tu.",
    "yue-Hant-HK": "我好期待同你一齊學習。",
    cs: "Těším se, až se s tebou budu učit.",
    lt: "Su nekantrumu laukiu, kada galėsiu mokytis su tavimi.",
    sk: "Teším sa, že sa budem s tebou učiť.",
    sl: "Veselim se, da se bom učil s teboj.",
};

type ExtendedVoiceInfo = VoiceInfo & {
    networkRequired?: boolean;
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

/* -------------------------------- Phase machine types -------------------------------- */

type Phase =
    | { kind: "loading" }                                    // probe + auto-recover in flight
    | { kind: "ready"; engine?: string | null }              // Phase B
    | { kind: "rescue"; probe: TtsHealthProbe; busy: boolean }; // diagnosis card

// STEPS = [learning(0), packs(1), tts(2), socials(3)]
const CURRENT_STEP_IDX = 2;

function fallbackProbe(diagnosis: TtsDiagnosis): TtsHealthProbe {
    return {
        supported: true,
        initState: "failed",
        currentEngine: null,
        voiceCount: 0,
        voicesEmpty: true,
        defaultEngine: null,
        engines: [],
        googleInstalled: false,
        googleEnabled: false,
        googleDefault: false,
        diagnosis,
        ready: false,
    };
}

/* -------------------------------- Component -------------------------------- */

export function OnboardingTTSInstructions() {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setPreferredEngine = useSettingsStore((s) => s.setPreferredEngine);
    const languages = useSettingsStore((s) => s.languages);
    const dir = useSettingsStore((s) => s.dir);

    const voicePrefs = useSettingsStore((s) => s.voicePrefs);
    const toggleVoiceSelection = useSettingsStore((s) => s.toggleVoiceSelection);

    const { t } = useTranslation();
    const os = useMemo(() => detectOSFromUA(), []);

    const [phase, setPhase] = useState<Phase>(
        os === "android" ? { kind: "loading" } : { kind: "ready" },
    );
    // Brief "✓ Voices ready!" flash after a successful auto-recovery.
    const [recoveryFlash, setRecoveryFlash] = useState(false);

    const [voices, setVoices] = useState<ExtendedVoiceInfo[] | null>(null);
    const [engineStatus, setEngineStatus] = useState<TtsEngineStatus | null>(null);
    const [engineStatusReady, setEngineStatusReady] = useState(os !== "android");

    // Refs: read-only snapshots that don't trigger effect re-runs.
    const phaseRef = useRef<Phase>(phase);
    phaseRef.current = phase;
    const inFlightRef = useRef(false);
    const pendingRunRef = useRef(false);

    /**
     * Refresh voices + engine status. Returns whether the voices list was
     * successfully populated — caller can use this to detect "engine reports
     * ready but list_voices threw/timed out" and react accordingly.
     */
    async function refreshVoices(): Promise<boolean> {
        let voicesOk = false;
        try {
            const raw = await getVoices({});
            const list = uniqBy(raw as ExtendedVoiceInfo[], (v) => `${v.id}|${v.language}`);
            setVoices(list);
            voicesOk = true;
        } catch (e) {
            console.warn("[onboardingTTS] refreshVoices: getVoices failed", e);
        }
        if (os === "android") {
            try {
                const status = await getTtsEngineStatus();
                setEngineStatus(status);
            } catch (e) {
                console.warn("[onboardingTTS] refreshVoices: engine status failed", e);
            } finally {
                setEngineStatusReady(true);
            }
        }
        return voicesOk;
    }

    /**
     * Run a full health probe + one auto-recovery attempt, then update phase.
     * Errors at any stage land us on a rescue card rather than a stuck loader.
     * Concurrent calls are deferred (one re-run is queued).
     */
    async function runDiagnose() {
        if (inFlightRef.current) {
            pendingRunRef.current = true;
            return;
        }
        inFlightRef.current = true;
        try {
            // Non-Android: TTS is reliable; skip the diagnose machinery.
            if (os !== "android") {
                await refreshVoices();
                setPhase({ kind: "ready" });
                return;
            }

            const wasRescue = phaseRef.current.kind === "rescue";
            // Avoid skeleton flicker when re-probing from "ready".
            setPhase((p) => (p.kind === "ready" ? p : { kind: "loading" }));

            // 1. Initial probe.
            let probe: TtsHealthProbe;
            try {
                probe = await probeTtsHealth();
            } catch (e) {
                console.warn("[onboardingTTS] probe failed", e);
                setPhase({ kind: "rescue", probe: fallbackProbe("engine_hung"), busy: false });
                return;
            }

            if (probe.diagnosis === "ready" && !probe.voicesEmpty) {
                await refreshVoices();
                setPhase({ kind: "ready", engine: probe.currentEngine });
                if (wasRescue) setRecoveryFlash(true);
                return;
            }

            // 2. Try one silent auto-recovery.
            let recovered = false;
            let recoveredEngine: string | null = null;
            try {
                const recover = await tryAutoRecover();
                recovered = recover.recovered;
                recoveredEngine = recover.engine ?? null;
            } catch (e) {
                console.warn("[onboardingTTS] auto-recover failed", e);
            }

            if (recovered) {
                if (recoveredEngine && recoveredEngine !== probe.defaultEngine) {
                    setPreferredEngine(recoveredEngine);
                }
                await refreshVoices();
                setPhase({ kind: "ready", engine: recoveredEngine });
                setRecoveryFlash(true);
                return;
            }

            // 3. Re-probe to get the freshest post-recovery diagnosis.
            let probe2 = probe;
            try {
                probe2 = await probeTtsHealth();
            } catch (e) {
                console.warn("[onboardingTTS] re-probe failed", e);
            }

            if (probe2.diagnosis === "ready" && !probe2.voicesEmpty) {
                await refreshVoices();
                setPhase({ kind: "ready", engine: probe2.currentEngine });
                setRecoveryFlash(true);
                return;
            }

            setPhase({ kind: "rescue", probe: probe2, busy: false });
        } finally {
            inFlightRef.current = false;
            // If a visibility/foreground event arrived while we were in flight,
            // honor it now with one queued re-run.
            if (pendingRunRef.current) {
                pendingRunRef.current = false;
                void runDiagnose();
            }
        }
    }

    // Initial probe + auto-recover on mount.
    useEffect(() => {
        void runDiagnose();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Re-probe when the user returns from system Settings. Always run the full
    // diagnose: a "refresh voices" optimization misses catastrophic state
    // changes (engine uninstalled / disabled while we were on a different
    // step). runDiagnose self-short-circuits cheaply when state is unchanged.
    useEffect(() => {
        function onVisibility() {
            if (document.visibilityState === "hidden") return;
            void runDiagnose();
        }
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-clear the brief "Voices ready!" celebration after 800ms.
    useEffect(() => {
        if (!recoveryFlash) return;
        const timer = window.setTimeout(() => setRecoveryFlash(false), 800);
        return () => window.clearTimeout(timer);
    }, [recoveryFlash]);

    // If the engine reports ready but we haven't been able to populate the
    // voice list (list_voices threw / timed out), keep retrying — and after a
    // bounded number of attempts fall back to a rescue card. Without this the
    // user would see Phase B with no language sections (empty page).
    const voicesRetryRef = useRef(0);
    useEffect(() => {
        if (phase.kind !== "ready" || voices !== null) {
            voicesRetryRef.current = 0;
            return;
        }
        if (voicesRetryRef.current >= 3) {
            setPhase({ kind: "rescue", probe: fallbackProbe("engine_hung"), busy: false });
            return;
        }
        voicesRetryRef.current += 1;
        const delay = 500 * voicesRetryRef.current;
        const timer = window.setTimeout(() => void refreshVoices(), delay);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase.kind, voices]);

    /* ---------- Rescue actions ---------- */

    function setBusy(busy: boolean) {
        setPhase((p) => (p.kind === "rescue" ? { ...p, busy } : p));
    }

    async function handleEnableGoogleTts() {
        setBusy(true);
        try {
            await openTtsEngineAppDetails(GOOGLE_TTS_PACKAGE);
        } finally {
            setBusy(false);
        }
    }

    async function handleInstallGoogleTts() {
        setBusy(true);
        try {
            await openTtsEngineStore(GOOGLE_TTS_PACKAGE);
        } finally {
            setBusy(false);
        }
    }

    async function handleInstallVoices() {
        setBusy(true);
        try {
            // Install voice data for the first language with no available voice.
            // The engine's UI will surface a language picker / progress.
            for (const code of langs) {
                // Best-effort: try any of the user's languages. The engine's UI
                // typically lets the user pick which one to download.
                const status = await installVoiceData(code);
                if (status === "launched_install_flow") break;
            }
        } finally {
            setBusy(false);
        }
    }

    async function handleEngineHungRetry() {
        setBusy(true);
        try {
            await runDiagnose();
        } finally {
            setBusy(false);
        }
    }

    function handleSkip() {
        // Advance past TTS to the final Finish step. STEPS = [learning(0),
        // packs(1), tts(2), socials(3)] → wizard indices are shifted by 2
        // (welcome + pickPrimary precede the visible stepper), so Finish
        // lives at wizard step 5.
        setStep(5);
    }

    function primaryActionFor(diagnosis: TtsDiagnosis): {
        action: () => Promise<void> | void;
        secondary?: { label: string; onClick: () => void };
    } {
        switch (diagnosis) {
            case "engine_disabled_user":
                return { action: handleEnableGoogleTts };
            case "engine_not_installed":
                return { action: handleInstallGoogleTts };
            case "no_engine":
                return {
                    action: handleInstallGoogleTts,
                    secondary: {
                        label: t("onboarding.ttsRescue.openTtsSettings", {
                            defaultValue: "Open TTS settings",
                        }),
                        onClick: () => void openTtsSettings(),
                    },
                };
            case "no_voice_data":
                return { action: handleInstallVoices };
            case "engine_hung":
                return { action: handleEngineHungRetry };
            default:
                return { action: handleEngineHungRetry };
        }
    }

    /* ---------- Phase B (voice selection) helpers — preserved from previous impl ---------- */

    async function speakExact(voice: VoiceInfo, text: string, rate = 0.9) {
        try {
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
                    : t(`onboarding.${s.key}`, { defaultValue: s.label }),
            ),
        [t],
    );

    const langs = languages;

    function voicesForLang(code: string): ExtendedVoiceInfo[] | null {
        if (!voices) return null;
        // Use the alias-aware matcher: handles `no` ↔ `nb-NO`, `yue-Hant-HK`
        // ↔ `yue-HK`/`zh-HK`, etc. — keeps all per-language matching going
        // through one rule rather than re-implementing it in each caller.
        const compatible = voices.filter((v) => langMatchScore(v.language, code) > 0);
        const unique = uniqBy(compatible, (v) => `${v.id}|${v.language}`);
        return sortVoicesWithLangBias(unique, code);
    }

    const canSmartSelect = useMemo(
        () => langs.every((code) => (voicesForLang(code) || []).length > 0),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [langs, voices, os],
    );

    function setSelectionForLang(code: string, desiredIds: string[]) {
        const current = new Set((voicePrefs[code]?.ids ?? []).slice());
        const desired = new Set(desiredIds);
        for (const id of current) {
            if (!desired.has(id)) toggleVoiceSelection(code, id);
        }
        for (const id of desired) {
            if (!current.has(id)) toggleVoiceSelection(code, id);
        }
    }

    function smartSelectAll() {
        for (const code of langs) {
            const allIds = (voicesForLang(code) || []).map((v) => v.id);
            setSelectionForLang(code, allIds);
        }
    }

    async function openInstaller() {
        await deepLinkToVoiceInstall({ preferGoogle: true, engineStatus });
    }
    async function openSettings() {
        await openTtsSettings();
    }

    async function handleInstallForLang(code: string) {
        await installVoiceData(code);
    }

    if (!langs || !langs.length) {
        return null;
    }

    /* ---------- Render ---------- */

    const renderRescueOrPhaseA = () => {
        if (phase.kind === "loading") {
            return <OnboardingTTSProbing />;
        }
        // Engine ready but voices not yet populated (list_voices is retrying).
        // Show the loading skeleton rather than an empty page.
        if (phase.kind === "ready" && voices === null && !recoveryFlash) {
            return <OnboardingTTSProbing />;
        }
        if (phase.kind === "ready" && recoveryFlash) {
            return <OnboardingTTSReadyConfirm engine={phase.engine ?? null} />;
        }
        if (phase.kind === "rescue") {
            const spec = primaryActionFor(phase.probe.diagnosis);
            return (
                <OnboardingTTSRescueCard
                    diagnosis={phase.probe.diagnosis}
                    probe={phase.probe}
                    onPrimary={() => void spec.action()}
                    onSkip={handleSkip}
                    busy={phase.busy}
                    secondary={spec.secondary}
                />
            );
        }
        return null;
    };

    const showPhaseB = phase.kind === "ready" && !recoveryFlash && voices !== null;

    return (
        <section
            id="onboarding-scroll"
            className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto overscroll-contain bg-background md:bg-muted"
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
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
                canNext={true}
            >
                {showPhaseB ? (
                    <OnboardingTTSInstructionsHeaderActions
                        os={os}
                        onOpenInstaller={openInstaller}
                        onOpenSettings={openSettings}
                        onSmartSelect={smartSelectAll}
                        canSmartSelect={canSmartSelect}
                        engineStatus={engineStatus}
                        engineStatusReady={engineStatusReady}
                    />
                ) : null}
            </OnboardingHeader>

            <main
                className="flex-1 min-h-0"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
                <div className="mx-auto w-full max-w-5xl px-3">
                    <AnimatePresence mode="wait">
                        {!showPhaseB ? (
                            <motion.div
                                key={phase.kind + (phase.kind === "ready" && recoveryFlash ? "-flash" : "")}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.18 }}
                            >
                                {renderRescueOrPhaseA()}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="phaseB"
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                                {langs.map((code) => {
                                    const list = voicesForLang(code);
                                    const pref = voicePrefs[code] ?? { ids: [], mode: "cycle" as const };
                                    const sample = sampleFor(code);
                                    if (list === null) return null;

                                    // Empty-voice CTA: pick install (Android) vs Apple-feedback
                                    // (iOS-gap langs) vs nothing. Mutually exclusive — the
                                    // section component branches on whichever is set.
                                    const isIOS = os === "ios" || os === "macos";
                                    const isGap = isIOS && isAppleIOSVoiceGap(code);

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
                                            onInstallVoiceData={
                                                os === "android" ? () => void handleInstallForLang(code) : undefined
                                            }
                                            onSendAppleFeedback={
                                                isGap ? () => void openAppleFeedback() : undefined
                                            }
                                        />
                                    );
                                })}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div
                    className="h-8"
                    style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
                />
            </main>
        </section>
    );
}
