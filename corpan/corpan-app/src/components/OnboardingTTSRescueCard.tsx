import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
    MicOff,
    Download,
    AlertTriangle,
    Languages,
    PackageX,
    ChevronDown,
    ChevronRight,
    Copy,
    Check,
    type LucideIcon,
} from "lucide-react";

import type { TtsDiagnosis, TtsHealthProbe } from "@/util/tts-voices";
import { Button } from "./ui/button";

/* ---------- Tone palette (semantic per diagnosis) ---------- */

type Tone = "amber" | "blue" | "rose" | "slate";

const TONE: Record<Tone, { surface: string; iconBg: string; iconFg: string; ring: string }> = {
    amber: {
        surface:
            "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30",
        iconBg: "bg-amber-100 dark:bg-amber-900/60",
        iconFg: "text-amber-700 dark:text-amber-300",
        ring: "ring-amber-200/60 dark:ring-amber-900/60",
    },
    blue: {
        surface:
            "border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/30",
        iconBg: "bg-sky-100 dark:bg-sky-900/60",
        iconFg: "text-sky-700 dark:text-sky-300",
        ring: "ring-sky-200/60 dark:ring-sky-900/60",
    },
    rose: {
        surface:
            "border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30",
        iconBg: "bg-rose-100 dark:bg-rose-900/60",
        iconFg: "text-rose-700 dark:text-rose-300",
        ring: "ring-rose-200/60 dark:ring-rose-900/60",
    },
    slate: {
        surface:
            "border-border bg-card",
        iconBg: "bg-muted",
        iconFg: "text-muted-foreground",
        ring: "ring-muted",
    },
};

/* ---------- Diagnosis-specific spec ---------- */

type DiagnosisSpec = {
    icon: LucideIcon;
    tone: Tone;
    headingKey: string;
    headingDefault: string;
    detailKey: string;
    detailDefault: string;
    buttonKey: string;
    buttonDefault: string;
};

const SPEC_BY_DIAGNOSIS: Record<string, DiagnosisSpec> = {
    engine_disabled_user: {
        icon: MicOff,
        tone: "amber",
        headingKey: "onboarding.ttsRescue.engineDisabledUser.heading",
        headingDefault: "Google Text-to-Speech is disabled",
        detailKey: "onboarding.ttsRescue.engineDisabledUser.detail",
        detailDefault:
            "We'll take you straight to the system page to turn it back on. One tap and you're done.",
        buttonKey: "onboarding.ttsRescue.engineDisabledUser.button",
        buttonDefault: "Enable Google TTS",
    },
    engine_not_installed: {
        icon: Download,
        tone: "blue",
        headingKey: "onboarding.ttsRescue.engineNotInstalled.heading",
        headingDefault: "Install Google Text-to-Speech",
        detailKey: "onboarding.ttsRescue.engineNotInstalled.detail",
        detailDefault:
            "Google's voice engine gives you the best quality across every language Corpán supports. It's free.",
        buttonKey: "onboarding.ttsRescue.engineNotInstalled.button",
        buttonDefault: "Install from Play Store",
    },
    no_engine: {
        icon: PackageX,
        tone: "rose",
        headingKey: "onboarding.ttsRescue.noEngine.heading",
        headingDefault: "No voice engine found",
        detailKey: "onboarding.ttsRescue.noEngine.detail",
        detailDefault:
            "Your device has no text-to-speech engine installed. Install Google Text-to-Speech to continue.",
        buttonKey: "onboarding.ttsRescue.noEngine.button",
        buttonDefault: "Install Google TTS",
    },
    no_voice_data: {
        icon: Languages,
        tone: "blue",
        headingKey: "onboarding.ttsRescue.noVoiceData.heading",
        headingDefault: "Voice data needs downloading",
        detailKey: "onboarding.ttsRescue.noVoiceData.detail",
        detailDefault:
            "Your engine is ready, but the voice data for your languages hasn't been downloaded yet.",
        buttonKey: "onboarding.ttsRescue.noVoiceData.button",
        buttonDefault: "Download voices",
    },
    engine_hung: {
        icon: AlertTriangle,
        tone: "amber",
        headingKey: "onboarding.ttsRescue.engineHung.heading",
        headingDefault: "The voice engine isn't responding",
        detailKey: "onboarding.ttsRescue.engineHung.detail",
        detailDefault:
            "Sometimes the system TTS service gets stuck. Tap below to try again — it usually clears up.",
        buttonKey: "onboarding.ttsRescue.engineHung.button",
        buttonDefault: "Try again",
    },
};

/* ---------- Component ---------- */

type Props = {
    diagnosis: TtsDiagnosis;
    probe: TtsHealthProbe;
    onPrimary: () => void;
    onSkip: () => void;
    busy?: boolean;
    /** Optional secondary action (e.g. "Open TTS settings" alongside install). */
    secondary?: { label: string; onClick: () => void };
    /** Children rendered below detail/before buttons (e.g. a per-language list for `no_voice_data`). */
    children?: ReactNode;
};

/* ---------- Human-readable engine state ---------- */

const STATE_COPY: Record<string, { en: string; key: string }> = {
    enabled: { en: "Enabled", key: "onboarding.ttsRescue.state.enabled" },
    default: { en: "Enabled (system default)", key: "onboarding.ttsRescue.state.default" },
    disabled: { en: "Disabled", key: "onboarding.ttsRescue.state.disabled" },
    disabled_user: {
        en: "Disabled by user (or by Samsung Device Care)",
        key: "onboarding.ttsRescue.state.disabledUser",
    },
    disabled_until_used: {
        en: "Disabled until used",
        key: "onboarding.ttsRescue.state.disabledUntilUsed",
    },
    not_installed: { en: "Not installed", key: "onboarding.ttsRescue.state.notInstalled" },
};

export function OnboardingTTSRescueCard({
    diagnosis,
    probe,
    onPrimary,
    onSkip,
    busy = false,
    secondary,
    children,
}: Props) {
    const { t } = useTranslation();
    const [diagOpen, setDiagOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const spec =
        SPEC_BY_DIAGNOSIS[diagnosis as string] ?? SPEC_BY_DIAGNOSIS.engine_hung;
    const tone = TONE[spec.tone];
    const Icon = spec.icon;

    const heading = t(spec.headingKey, { defaultValue: spec.headingDefault });
    const detail = t(spec.detailKey, { defaultValue: spec.detailDefault });
    const buttonLabel = t(spec.buttonKey, { defaultValue: spec.buttonDefault });
    const skipLabel = t("onboarding.ttsRescue.skipForNow", {
        defaultValue: "Skip — set up later in Settings",
    });

    // Surface the current state of Google TTS in plain language so the user
    // can verify what we see vs. what they expect.
    const googleEntry = probe.engines?.find(
        (e) => e.packageName === "com.google.android.tts",
    );
    const googleStateRaw = googleEntry?.enabledState;
    const googleStateCopy = googleStateRaw ? STATE_COPY[googleStateRaw] : undefined;
    const googleStateText = googleStateCopy
        ? t(googleStateCopy.key, { defaultValue: googleStateCopy.en })
        : googleStateRaw ?? null;
    const showGoogleStateLine =
        diagnosis === "engine_disabled_user" ||
        diagnosis === "engine_not_installed" ||
        diagnosis === "no_engine";

    const copyDiagnostics = async () => {
        try {
            const blob = JSON.stringify(probe, null, 2);
            await navigator.clipboard.writeText(blob);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard may be unavailable */
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={[
                "mx-auto w-full max-w-md rounded-2xl border p-6 shadow-sm",
                tone.surface,
            ].join(" ")}
            role="region"
            aria-live="polite"
        >
            {/* Icon */}
            <div
                className={[
                    "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
                    tone.iconBg,
                ].join(" ")}
                aria-hidden
            >
                <Icon size={28} className={tone.iconFg} />
            </div>

            {/* Heading */}
            <h2 className="text-center text-xl font-semibold text-foreground">
                {heading}
            </h2>

            {/* Detail */}
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
                {detail}
            </p>

            {/* Ground-truth current state — removes "but I already enabled it!" ambiguity */}
            {showGoogleStateLine && googleStateText ? (
                <p className="mt-3 text-center text-xs text-muted-foreground/80">
                    {t("onboarding.ttsRescue.currentState", {
                        defaultValue: "Currently: {{state}}",
                        state: googleStateText,
                    })}
                </p>
            ) : null}

            {/* Optional inline content (e.g. per-language install list) */}
            {children ? <div className="mt-4">{children}</div> : null}

            {/* Primary CTA */}
            <div className="mt-6 flex flex-col gap-2">
                <Button
                    type="button"
                    size="lg"
                    onClick={onPrimary}
                    disabled={busy}
                    className="h-12 w-full text-base font-semibold"
                >
                    {busy
                        ? t("onboarding.ttsRescue.working", { defaultValue: "Working…" })
                        : buttonLabel}
                </Button>

                {secondary ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={secondary.onClick}
                        disabled={busy}
                        className="h-11 w-full"
                    >
                        {secondary.label}
                    </Button>
                ) : null}

                <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    onClick={onSkip}
                    disabled={busy}
                    className="h-10 w-full text-sm text-muted-foreground hover:text-foreground"
                >
                    {skipLabel}
                </Button>
            </div>

            {/* Diagnostics expander (small, low-emphasis) */}
            <button
                type="button"
                onClick={() => setDiagOpen((v) => !v)}
                className="mt-5 flex w-full items-center justify-center gap-1 text-[11px] text-muted-foreground/70 hover:text-muted-foreground"
                aria-expanded={diagOpen}
                aria-controls="tts-rescue-diagnostics"
            >
                {diagOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {t("onboarding.ttsRescue.diagnostics.toggle", {
                    defaultValue: "Diagnostics",
                })}
            </button>
            {diagOpen ? (
                <div
                    id="tts-rescue-diagnostics"
                    className="mt-2 rounded-lg border border-border/60 bg-background/60 p-2"
                >
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-snug text-muted-foreground">
                        {JSON.stringify(probe, null, 2)}
                    </pre>
                    <button
                        type="button"
                        onClick={copyDiagnostics}
                        className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground shadow-sm hover:bg-accent"
                    >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                        {copied
                            ? t("onboarding.ttsRescue.diagnostics.copied", {
                                defaultValue: "Copied",
                            })
                            : t("onboarding.ttsRescue.diagnostics.copyButton", {
                                defaultValue: "Copy",
                            })}
                    </button>
                </div>
            ) : null}
        </motion.div>
    );
}
