// encorpora/corpan/corpan-app/src/components/OnboardingTTSConfidentVoice.tsx
import { useMemo, useRef, useState } from "react";
import { Play, Download, MessageSquare, Settings, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type VoiceInfo, isGoodQuality } from "@/util/tts-voices";
import { qualityLevel } from "./VoiceCard";
import { resolveDialectLabel } from "./voiceDialectLabel";

/* ------------------------------ Quality bars (compact) ------------------------------ */

function QualityBars({ q }: { q?: VoiceInfo["quality"] }) {
    const level = qualityLevel(q);
    return (
        <span className="inline-flex items-end gap-[2px]" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
                <span
                    key={i}
                    className={[
                        "inline-block w-[3px] rounded-full",
                        i === 0 ? "h-1.5" : i === 1 ? "h-2" : i === 2 ? "h-2.5" : "h-3",
                        i < level ? "bg-emerald-500" : "bg-muted-foreground/25",
                    ].join(" ")}
                />
            ))}
        </span>
    );
}

/* ------------------------------ Types ------------------------------ */

type Props = {
    code: string;
    /** All voices ready for this language (the user's selection, or the
     *  auto-picked top tier). The row leads with the COUNT; voices[0] is the
     *  best/lead voice used for the Play preview + quality readout. */
    voices: VoiceInfo[];
    isRTL: boolean;
    onPreview: (voice: VoiceInfo) => void | Promise<void>;
    /** Android-only: open the per-language voice-data installer. */
    onInstallVoiceData?: () => void;
    /** iOS/macOS gap-language: send Apple feedback (no voice will ever appear). */
    onSendAppleFeedback?: () => void;
    /** Open device Settings / installer to add a better (premium/enhanced) voice. */
    onAddBetterVoice?: () => void;
};

/* ------------------------------ Component ------------------------------ */

/**
 * The CALM DEFAULT for one language. The key signal for the average user is
 * simply: you HAVE voices, and how many — more is better, especially when they
 * are enhanced/premium. So the row leads with the count ("3 voices ready"),
 * not a single name. Three shapes, in priority order:
 *
 *  1. We have good (enhanced/premium/high) voices → confident row: the count,
 *     a sparkle, quality bars, the lead voice + "+N more", and a big Play.
 *  2. We have only low-quality voices → still show the count, plus a quiet
 *     "Add a higher-quality voice" nudge toward Settings.
 *  3. We have no voice at all → the install / Apple-gap CTA.
 *
 * The full per-voice grid lives behind the parent's "Choose voices" disclosure.
 */
export function OnboardingTTSConfidentVoice({
    code,
    voices,
    isRTL,
    onPreview,
    onInstallVoiceData,
    onSendAppleFeedback,
    onAddBetterVoice,
}: Props) {
    const { t } = useTranslation();
    const trDial = (key: string) =>
        (t(`dialects.${key}`, { defaultValue: "" }) as unknown as string) || "";

    const best = voices[0] ?? null;
    const count = voices.length;

    const langLabel = useMemo(() => resolveDialectLabel(code, trDial), [code, t]);
    const voiceDialect = useMemo(
        () => (best ? resolveDialectLabel(best.language || code, trDial) : ""),
        [best, code, t],
    );

    const [speaking, setSpeaking] = useState(false);
    const speakTimer = useRef<number | null>(null);
    // Each Play tap cycles to the next selected voice (loops) so the learner
    // hears the variety across all their voices — not just the first one.
    const cycleRef = useRef(0);
    function fireSpeaking() {
        setSpeaking(true);
        if (speakTimer.current) window.clearTimeout(speakTimer.current);
        speakTimer.current = window.setTimeout(() => setSpeaking(false), 1400);
    }

    /* ---------- No voice at all (case 3 — go get voices) ---------- */
    if (!best) {
        const isAppleGap = !!onSendAppleFeedback;
        if (isAppleGap) {
            return (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-purple-200 bg-gradient-to-b from-purple-50 to-card px-5 py-6 text-center dark:border-purple-900/50 dark:from-purple-950/30 dark:to-card">
                    <span className="text-sm font-semibold text-foreground">{langLabel}</span>
                    <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                        {t("onboarding.appleNoVoiceTitle", {
                            defaultValue: "Apple doesn't ship a {{lang}} voice yet",
                            lang: langLabel,
                        })}
                    </span>
                    <span className="max-w-sm text-xs leading-relaxed text-purple-800/80 dark:text-purple-300/80">
                        {t("onboarding.appleNoVoiceBody", {
                            defaultValue:
                                "A quick note to Apple's accessibility team helps make the case. {{lang}} works natively on Android in the meantime.",
                            lang: langLabel,
                        })}
                    </span>
                    <button
                        type="button"
                        onClick={onSendAppleFeedback}
                        dir={isRTL ? "rtl" : "ltr"}
                        className="mt-1 inline-flex h-10 items-center gap-2 rounded-full bg-purple-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 active:scale-[0.99]"
                    >
                        <MessageSquare size={16} />
                        {t("onboarding.sendAppleFeedback", { defaultValue: "Send Apple Feedback" })}
                    </button>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 px-5 py-6 text-center dark:border-amber-800/60 dark:bg-amber-950/20">
                <span className="text-sm font-semibold text-foreground">{langLabel}</span>
                <span className="text-sm text-amber-800 dark:text-amber-200">
                    {t("onboarding.confident.noVoiceFor", {
                        defaultValue: "No {{lang}} voice yet — add one to hear it read aloud.",
                        lang: langLabel,
                    })}
                </span>
                <button
                    type="button"
                    onClick={onInstallVoiceData ?? onAddBetterVoice}
                    className="mt-1 inline-flex h-10 items-center gap-2 rounded-full border border-amber-400 bg-amber-100 px-4 text-sm font-medium text-amber-900 shadow-sm transition hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-[0.99] dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                >
                    <Download size={16} />
                    {t("onboarding.ttsRescue.installVoicesForLang", {
                        defaultValue: "Download voices for {{lang}}",
                        lang: langLabel,
                    })}
                </button>
            </div>
        );
    }

    /* ---------- Confident pick (case 1) — possibly low quality (case 2 nudge) ---------- */
    const good = isGoodQuality(best.quality);
    const leadName = best.name || best.id;
    // "Lead voice + N more" so the learner sees there's variety without a grid.
    const namesLine =
        count > 1
            ? `${leadName} ${t("onboarding.confident.andMore", {
                  defaultValue: "+{{count}} more",
                  count: count - 1,
              })}`
            : leadName;
    const countLabel =
        count === 1
            ? t("onboarding.confident.voiceCountOne", { defaultValue: "1 voice ready" })
            : t("onboarding.confident.voiceCountMany", {
                  defaultValue: "{{count}} voices ready",
                  count,
              });

    return (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-3.5 shadow-sm dark:border-purple-800/50 dark:bg-purple-950/25">
            <div className="flex items-center gap-3">
                {/* Big, obvious Play-to-test — cycles through the selected voices. */}
                <button
                    type="button"
                    onClick={() => {
                        const v = voices[cycleRef.current % voices.length] ?? best;
                        cycleRef.current = (cycleRef.current + 1) % voices.length;
                        fireSpeaking();
                        void onPreview(v);
                    }}
                    aria-label={t("onboarding.voicePreviewAria", {
                        defaultValue: "Preview {{name}}",
                        name: leadName,
                    })}
                    dir={isRTL ? "rtl" : "ltr"}
                    className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white shadow-sm transition hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-95"
                >
                    <Play size={18} className="ms-[1px] fill-current" />
                    {speaking ? (
                        <span className="absolute inset-0 animate-ping rounded-full bg-purple-400/50" aria-hidden />
                    ) : null}
                </button>

                <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-purple-700/80 dark:text-purple-300/80">
                        {langLabel}
                    </div>
                    {/* COUNT is the hero — "you have N voices". */}
                    <div className="mt-0.5 flex items-center gap-1.5">
                        {good ? (
                            <Sparkles
                                size={14}
                                className="shrink-0 fill-current text-purple-500"
                                aria-hidden
                            />
                        ) : null}
                        <span className="truncate text-base font-semibold text-foreground">
                            {countLabel}
                        </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <QualityBars q={best.quality} />
                        <span className="truncate">{namesLine}</span>
                        <span className="break-words">{voiceDialect}</span>
                    </div>
                </div>
            </div>

            {/* Case 2 nudge: usable voices, but none are premium/enhanced → invite a better one. */}
            {!good && onAddBetterVoice ? (
                <button
                    type="button"
                    onClick={onAddBetterVoice}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-purple-200 bg-card px-4 py-2 text-xs font-medium text-purple-700 shadow-sm transition hover:bg-purple-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-[0.99] dark:border-purple-800/60 dark:text-purple-200 dark:hover:bg-purple-950/40"
                >
                    <Settings size={14} />
                    {t("onboarding.confident.addBetter", {
                        defaultValue: "Add a higher-quality voice",
                    })}
                </button>
            ) : null}
        </div>
    );
}
