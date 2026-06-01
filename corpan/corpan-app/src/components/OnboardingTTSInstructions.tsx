// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructions.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import type { OnboardingStepProps } from "@/onboarding/types";

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
    defaultVoiceIdsForLang,
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
import { OnboardingTTSConfidentVoice } from "./OnboardingTTSConfidentVoice";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { OnboardingShell } from "@/onboarding/OnboardingShell";
import { VoiceInstallGuideModal } from "./VoiceInstallGuideModal";
import { Button } from "@/components/ui/button";
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

/** Stable signature of a voice set, order-independent, for change detection. */
function voicesSignature(list: ExtendedVoiceInfo[] | null): string {
    if (!list) return "";
    return list
        .map((v) => `${v.id}|${v.language}`)
        .sort()
        .join(",");
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

/* -------------------------------- Skeleton -------------------------------- */

/**
 * A placeholder that mirrors the OnboardingTTSConfidentVoice row's footprint.
 * Rendered per-language while `list_voices` is still resolving, so the async
 * voices result fills the rows IN PLACE — the body height never changes and
 * nothing gets pushed around / re-centered when the data arrives.
 */
function ConfidentVoiceSkeleton() {
    return (
        <div
            className="rounded-2xl border border-border bg-card/60 p-3.5 shadow-sm"
            aria-hidden="true"
        >
            <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-40 animate-pulse rounded bg-muted/70" />
                </div>
            </div>
        </div>
    );
}

/* -------------------------------- Component -------------------------------- */

export function OnboardingTTSInstructions({ onAdvance, onBack }: OnboardingStepProps = {}) {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setPreferredEngine = useSettingsStore((s) => s.setPreferredEngine);
    const languages = useSettingsStore((s) => s.languages);
    // Calibrated speech rate from the comfort question — used so the voice
    // preview is heard at the user's chosen speed (not a fixed default).
    const rate = useSettingsStore((s) => s.rate);

    const voicePrefs = useSettingsStore((s) => s.voicePrefs);
    const toggleVoiceSelection = useSettingsStore((s) => s.toggleVoiceSelection);

    const { t } = useTranslation();
    const os = useMemo(() => detectOSFromUA(), []);

    const [phase, setPhase] = useState<Phase>(
        os === "android" ? { kind: "loading" } : { kind: "ready" },
    );
    // Brief "✓ Voices ready!" flash after a successful auto-recovery.
    const [recoveryFlash, setRecoveryFlash] = useState(false);

    // Apple-only interstitial that teaches the Settings tap-path for voices.
    const [showVoiceGuide, setShowVoiceGuide] = useState(false);

    const [voices, setVoices] = useState<ExtendedVoiceInfo[] | null>(null);
    const [engineStatus, setEngineStatus] = useState<TtsEngineStatus | null>(null);
    const [engineStatusReady, setEngineStatusReady] = useState(os !== "android");

    // Refs: read-only snapshots that don't trigger effect re-runs.
    const phaseRef = useRef<Phase>(phase);
    phaseRef.current = phase;
    const inFlightRef = useRef(false);
    const pendingRunRef = useRef(false);
    // Latest voices snapshot for the polling effect to diff against without
    // re-subscribing on every change. A dedicated guard prevents overlapping
    // polls (native list_voices can be slow on Android).
    const voicesRef = useRef<ExtendedVoiceInfo[] | null>(voices);
    voicesRef.current = voices;
    const pollInFlightRef = useRef(false);

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

    // Lightly poll the installed voices while the setup screen is open so a
    // voice the user just installed appears on its own — without backing out
    // and re-entering the screen. visibilitychange covers the clean
    // return-from-Settings case, but iOS often surfaces a freshly downloaded
    // voice a beat later (and without a visibility flip when the download
    // happens in-app), so a gentle poll closes the gap. We only setVoices when
    // the voice SET actually changed, so steady state causes zero re-renders
    // (no audio/preview churn).
    useEffect(() => {
        if (phase.kind !== "ready") return;
        let cancelled = false;
        const interval = window.setInterval(async () => {
            // Don't fight an in-flight diagnose, and don't stack polls.
            if (inFlightRef.current || pollInFlightRef.current) return;
            pollInFlightRef.current = true;
            try {
                const raw = await getVoices({});
                if (cancelled) return;
                const list = uniqBy(
                    raw as ExtendedVoiceInfo[],
                    (v) => `${v.id}|${v.language}`,
                );
                if (voicesSignature(list) !== voicesSignature(voicesRef.current)) {
                    console.info(
                        "[onboardingTTS] voice set changed on poll — refreshing list",
                    );
                    setVoices(list);
                }
            } catch (e) {
                console.warn("[onboardingTTS] voice poll failed", e);
            } finally {
                pollInFlightRef.current = false;
            }
        }, 3000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase.kind]);

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
        // Engine-driven: advance to the next graph node (Plus pitch). Legacy
        // fallback advances to the old wizard's Finish step (5).
        ;(onAdvance ?? (() => setStep(5)))()
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

    // The auto-picked SET per language — every voice at the best tier present
    // (all premium, else all enhanced, else whatever). Badged "Recommended" in
    // the power-user grid; also the default selection. More good voices = more
    // variety, and the learner sees how many they have.
    const recommendedByLang = useMemo(() => {
        const map: Record<string, string[]> = {};
        for (const code of langs) {
            map[code] = defaultVoiceIdsForLang(voicesForLang(code) || [], code);
        }
        return map;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [langs, voices, os]);

    // The full SET of voices to surface in the confident default — the user's
    // current selection if they've chosen, else the auto-picked top tier. The
    // confident row leads with the COUNT ("3 voices ready") because the key
    // signal for the average user is that they HAVE good voices and how many.
    function shownVoicesForLang(code: string): VoiceInfo[] {
        const list = voicesForLang(code) || [];
        const ids = voicePrefs[code]?.ids ?? [];
        const selected = ids.length ? list.filter((v) => ids.includes(v.id)) : [];
        const pool = selected.length
            ? selected
            : list.filter((v) => recommendedByLang[code]?.includes(v.id));
        return sortVoicesWithLangBias(pool, code);
    }

    // Auto-pick the single best region-appropriate voice per language so TTS
    // "just works" out of the box — the single-language beginner never has to
    // know what a voice even is, and multi-language stacks get the correct
    // dialect (pt-PT not pt-BR, a Taiwan voice for zh-Hant, etc.). Fires once,
    // and only for languages the user hasn't already chosen for.
    const autoPicked = useRef(false);
    useEffect(() => {
        if (autoPicked.current) return;
        const ready = phase.kind === "ready" && voices !== null && !recoveryFlash;
        if (!ready) return;
        for (const code of langs) {
            const alreadyChosen = (voicePrefs[code]?.ids ?? []).length > 0;
            if (alreadyChosen) continue;
            const defaults = defaultVoiceIdsForLang(voicesForLang(code) || [], code);
            if (defaults.length) setSelectionForLang(code, defaults);
        }
        autoPicked.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase.kind, voices, recoveryFlash]);

    // Power-user grid disclosure ("Choose voices" / "Customize").
    const [showPicker, setShowPicker] = useState(false);

    async function openInstaller() {
        await deepLinkToVoiceInstall({ preferGoogle: true, engineStatus });
    }
    // Apple platforms: there's no way to deep-link into Voices, so show an
    // interstitial that teaches the exact tap-path BEFORE opening Settings.
    // Other platforms open settings directly.
    function openSettings() {
        if (os === "ios" || os === "macos") {
            setShowVoiceGuide(true);
        } else {
            void openTtsSettings();
        }
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
        // (Engine-ready-but-voices-still-loading no longer renders here — the
        //  phaseB layout shows immediately with per-language skeleton rows that
        //  fill in place, avoiding a loading→content layout jerk.)
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

    // Render the real layout as soon as the engine is ready — even before
    // `list_voices` resolves. The per-language rows show skeletons until their
    // voices arrive (then fill IN PLACE), so the body never changes height /
    // re-centers when the async voices query returns. No loading→content swap.
    const showPhaseB = phase.kind === "ready" && !recoveryFlash;

    // The whole screen is ONE scroll surface (OnboardingShell scrolls; the
    // footer Continue stays pinned). No inner scrollers, no height caps — long
    // voice lists simply flow and the page scrolls. Top-aligned so the
    // loading→voices swap grows downward instead of re-centering.

    const renderLanguageSection = (code: string, bare: boolean) => {
        const list = voicesForLang(code);
        if (list === null) return null;
        const pref = voicePrefs[code] ?? { ids: [], mode: "cycle" as const };
        const sample = sampleFor(code);
        // Empty-voice CTA: install (Android) vs Apple-feedback (iOS-gap langs)
        // vs nothing. Mutually exclusive — the section branches on whichever set.
        const isIOS = os === "ios" || os === "macos";
        const isGap = isIOS && isAppleIOSVoiceGap(code);
        return (
            <OnboardingTTSInstructionsLanguageSection
                key={code}
                code={code}
                voices={list}
                selectedIds={pref.ids}
                recommendedIds={recommendedByLang[code]}
                onToggleSelect={(voiceId) => toggleVoiceSelection(code, voiceId)}
                onPreviewAny={(voice) => speakExact(voice, sample, rate)}
                isRTL={isRTL(code)}
                bare={bare}
                onInstallVoiceData={
                    os === "android" ? () => void handleInstallForLang(code) : undefined
                }
                onSendAppleFeedback={isGap ? () => void openAppleFeedback() : undefined}
            />
        );
    };

    // Case 1/2: the calm, confident "your voice for {lang}" row per language.
    // Shows the auto-picked region-appropriate voice + Play; nudges to Settings
    // when only a low-quality voice exists, or to install when there's none.
    const renderConfidentVoice = (code: string) => {
        const list = voicesForLang(code);
        // Voices for this language haven't resolved yet — hold the row's space
        // with a skeleton so the real data fills IN PLACE (no layout jerk).
        if (list === null) return <ConfidentVoiceSkeleton key={code} />;
        const sample = sampleFor(code);
        const isIOS = os === "ios" || os === "macos";
        const isGap = isIOS && isAppleIOSVoiceGap(code);
        return (
            <OnboardingTTSConfidentVoice
                key={code}
                code={code}
                voices={shownVoicesForLang(code)}
                isRTL={isRTL(code)}
                onPreview={(voice) => speakExact(voice, sample, rate)}
                onInstallVoiceData={
                    os === "android" ? () => void handleInstallForLang(code) : undefined
                }
                onSendAppleFeedback={isGap ? () => void openAppleFeedback() : undefined}
                onAddBetterVoice={openSettings}
            />
        );
    };

    return (
        <OnboardingShell
            canBack
            onBack={onBack ?? (() => setStep(3))}
            maxWidthClass="max-w-3xl"
            footer={
                <Button className="w-full !h-12" aria-label="Continue" onClick={onAdvance ?? (() => setStep(5))}>
                    {t("onboarding.continue")}
                </Button>
            }
        >
            <VoiceInstallGuideModal
                open={showVoiceGuide}
                onOpenChange={setShowVoiceGuide}
                isMac={os === "macos"}
                onConfirm={() => {
                    setShowVoiceGuide(false);
                    void openTtsSettings();
                }}
            />

            <h1 className="text-center text-2xl font-bold text-foreground sm:text-3xl">
                {t("onboarding.textToSpeechSetup", { defaultValue: "Set up the voice" })}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
                {t("onboarding.ttsIntro", {
                    defaultValue: "Corpán reads aloud. Tap a voice to hear it at your speed.",
                })}
            </p>

            <div className="mt-5 w-full">
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
                            {/* Case 1/2 — the calm, confident default: one row per
                                language with the auto-picked region-appropriate
                                voice + Play-to-test. Single voices flow on phone;
                                a grid keeps multi-language stacks tidy on tablet. */}
                            <div
                                className={
                                    langs.length === 1
                                        // Single language → one centered, capped card (not
                                        // flush-left in a half-width grid cell).
                                        ? "mx-auto w-full max-w-md"
                                        : "grid grid-cols-1 gap-3 sm:grid-cols-2"
                                }
                            >
                                {langs.map((code) => renderConfidentVoice(code))}
                            </div>

                            {/* Case 3 — power-user disclosure. Hidden by default;
                                reveals the full per-language grid with select-all
                                + per-voice toggles for region/quality overrides. */}
                            <div className="mt-5">
                                <button
                                    type="button"
                                    onClick={() => setShowPicker((s) => !s)}
                                    aria-expanded={showPicker}
                                    className="mx-auto flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-[0.99]"
                                >
                                    <SlidersHorizontal size={15} className="text-purple-600" />
                                    <span>
                                        {t("onboarding.confident.chooseVoices", {
                                            defaultValue: "Choose voices",
                                        })}
                                    </span>
                                    <ChevronDown
                                        size={16}
                                        className={[
                                            "text-muted-foreground transition-transform",
                                            showPicker ? "rotate-180" : "",
                                        ].join(" ")}
                                    />
                                </button>

                                <AnimatePresence initial={false}>
                                    {showPicker ? (
                                        <motion.div
                                            key="picker"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.22, ease: "easeOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-4">
                                                <div className="mb-4 flex justify-center">
                                                    <OnboardingTTSInstructionsHeaderActions
                                                        os={os}
                                                        onOpenInstaller={openInstaller}
                                                        onOpenSettings={openSettings}
                                                        onSmartSelect={smartSelectAll}
                                                        canSmartSelect={canSmartSelect}
                                                        engineStatus={engineStatus}
                                                        engineStatusReady={engineStatusReady}
                                                    />
                                                </div>
                                                {langs.map((code) => renderLanguageSection(code, false))}
                                            </div>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </OnboardingShell>
    );
}
