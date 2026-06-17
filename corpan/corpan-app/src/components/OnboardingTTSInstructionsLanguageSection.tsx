// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructionsLanguageSection.tsx
import { useState, useMemo, useRef } from "react";
import { Volume2, Download, MessageSquare } from "lucide-react";
import type { VoiceInfo } from "@/util/tts-voices";
import { useTranslation } from "react-i18next";
import { VoiceCard, qualityLevel } from "./VoiceCard";
import { resolveDialectLabel } from "./voiceDialectLabel";

/* ----------------------------- Types ----------------------------- */

type Props = {
    code: string; // e.g., "es-AR", "zh-CN-u-sd-cnln"
    voices: VoiceInfo[];
    selectedIds: string[];
    onToggleSelect: (voiceId: string) => void;
    onPreviewAny: (voice: VoiceInfo) => void | Promise<void>;
    isRTL: boolean;
    /**
     * IDs that were auto-selected as the highest-quality recommendation. Used to
     * mark them with a quiet "Recommended" badge so the calm default is legible.
     */
    recommendedIds?: string[];
    /**
     * Single-language mode: render WITHOUT the per-language header chrome (the
     * parent screen supplies the title). Multi-language mode shows a quiet
     * header per language so stacked sections stay legible.
     */
    bare?: boolean;
    /** Android-only: when set, the empty-state shows a "Download voices" button. */
    onInstallVoiceData?: () => void;
    /**
     * iOS/macOS-only: when set, the empty-state shows the Apple-gap copy
     * (no voice will help — Apple doesn't ship one) plus a "Send Apple
     * Feedback" CTA. Mutually exclusive with `onInstallVoiceData`.
     */
    onSendAppleFeedback?: () => void;
};

/* ----------------------------- Helpers ----------------------------- */

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

/* ----------------------------- Section ----------------------------- */

/**
 * One language's voices, rendered as a single flat surface — no accordion, no
 * inner scroller, no height cap. The whole onboarding screen is the one scroll
 * surface (see OnboardingShell); long voice lists simply flow and the page
 * scrolls, with the footer Continue pinned. A responsive grid keeps density
 * graceful from phone (1 col) to tablet/desktop (2–3 cols).
 */
export function OnboardingTTSInstructionsLanguageSection({
    code,
    voices,
    selectedIds,
    onToggleSelect,
    onPreviewAny,
    isRTL,
    recommendedIds,
    bare = false,
    onInstallVoiceData,
    onSendAppleFeedback,
}: Props) {
    const { t } = useTranslation();

    const trDial = (key: string) =>
        (t(`dialects.${key}`, { defaultValue: "" }) as unknown as string) || "";
    const trLang = (key: string) =>
        (t(`languages.${key}`, { defaultValue: "" }) as unknown as string) || "";

    const voicesUnique = useMemo(
        () => uniqBy(voices, (v) => `${v.id}|${v.language}`),
        [voices]
    );

    // Display order: quality desc, then name asc.
    const voicesSorted = useMemo(() => {
        return [...voicesUnique].sort((a, b) => {
            const qa = qualityLevel(a.quality);
            const qb = qualityLevel(b.quality);
            if (qb !== qa) return qb - qa;
            const an = a.name || a.id;
            const bn = b.name || b.id;
            return an.localeCompare(bn, undefined, { sensitivity: "base", numeric: true });
        });
    }, [voicesUnique]);

    const sectionLabel = resolveDialectLabel(code, trDial, trLang);
    const voicesWithPretty = useMemo(
        () =>
            voicesSorted.map((v) => ({
                ...v,
                __prettyLang: resolveDialectLabel(v.language || code, trDial, trLang),
            })),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [voicesSorted, code]
    );

    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const recommendedSet = useMemo(() => new Set(recommendedIds ?? []), [recommendedIds]);

    // Which voice last fired a preview — drives the brief speaking pulse.
    const [speakingId, setSpeakingId] = useState<string | null>(null);
    const speakTimer = useRef<number | null>(null);
    function fireSpeaking(id: string) {
        setSpeakingId(id);
        if (speakTimer.current) window.clearTimeout(speakTimer.current);
        speakTimer.current = window.setTimeout(() => setSpeakingId(null), 1400);
    }

    // "Preview selected" cycles through the chosen voices (fallback: first).
    const cycleRef = useRef(0);
    const previewSequence = useMemo(() => {
        const chosen = voicesWithPretty.filter((v) => selectedSet.has(v.id));
        if (chosen.length) return chosen;
        return voicesWithPretty[0] ? [voicesWithPretty[0]] : [];
    }, [voicesWithPretty, selectedSet]);

    function previewNext() {
        if (!previewSequence.length) return;
        const idx = cycleRef.current % previewSequence.length;
        const v = previewSequence[idx];
        cycleRef.current = idx + 1;
        fireSpeaking(v.id);
        void onPreviewAny(v);
    }

    const hasVoices = voicesWithPretty.length > 0;
    const selectedCount = useMemo(
        () => voicesWithPretty.filter((v) => selectedSet.has(v.id)).length,
        [voicesWithPretty, selectedSet]
    );
    // Apple iOS gap (informational) vs Android missing voices (actionable).
    const isAppleGap = !hasVoices && !!onSendAppleFeedback;

    /* ---------- Empty states ---------- */

    if (!hasVoices) {
        if (isAppleGap) {
            return (
                <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-purple-200 bg-gradient-to-b from-purple-50 to-card px-5 py-6 text-center dark:border-purple-900/50 dark:from-purple-950/30 dark:to-card">
                    {!bare ? (
                        <span className="text-sm font-semibold text-foreground">{sectionLabel}</span>
                    ) : null}
                    <span className="text-sm font-semibold text-purple-900 dark:text-purple-200">
                        {t("onboarding.appleNoVoiceTitle", {
                            defaultValue: "Apple doesn't ship a {{lang}} voice yet",
                            lang: sectionLabel,
                        })}
                    </span>
                    <span className="max-w-sm text-xs leading-relaxed text-purple-800/80 dark:text-purple-300/80">
                        {t("onboarding.appleNoVoiceBody", {
                            defaultValue:
                                "A quick note to Apple's accessibility team helps make the case. {{lang}} works natively on Android in the meantime.",
                            lang: sectionLabel,
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
            <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 px-5 py-6 text-center dark:border-amber-800/60 dark:bg-amber-950/20">
                {!bare ? (
                    <span className="text-sm font-semibold text-foreground">{sectionLabel}</span>
                ) : null}
                <span className="text-sm text-amber-800 dark:text-amber-200">
                    {t("onboarding.noVoicesHint", {
                        defaultValue: "Install voices to enable this language.",
                    })}
                </span>
                {onInstallVoiceData ? (
                    <button
                        type="button"
                        onClick={onInstallVoiceData}
                        className="mt-1 inline-flex h-10 items-center gap-2 rounded-full border border-amber-400 bg-amber-100 px-4 text-sm font-medium text-amber-900 shadow-sm transition hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 active:scale-[0.99] dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
                    >
                        <Download size={16} />
                        {t("onboarding.ttsRescue.installVoicesForLang", {
                            defaultValue: "Download voices for {{lang}}",
                            lang: sectionLabel,
                        })}
                    </button>
                ) : null}
            </div>
        );
    }

    /* ---------- Voices ---------- */

    const grid = (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {voicesWithPretty.map((v) => (
                <VoiceCard
                    key={`${v.id}|${v.language}`}
                    voice={v}
                    prettyLang={(v as { __prettyLang: string }).__prettyLang}
                    selected={selectedSet.has(v.id)}
                    recommended={recommendedSet.has(v.id)}
                    speaking={speakingId === v.id}
                    onToggle={() => onToggleSelect(v.id)}
                    onPreview={() => {
                        fireSpeaking(v.id);
                        void onPreviewAny(v);
                    }}
                    isRTL={isRTL}
                />
            ))}
        </div>
    );

    // Single-language: no per-language header (parent owns the title).
    if (bare) {
        return <div className="mt-1">{grid}</div>;
    }

    // Multi-language: quiet header per language, then the grid. No nesting.
    return (
        <section className="mt-6 first:mt-2">
            <div className="mb-2.5 flex items-center justify-between gap-3 px-0.5">
                <div className="flex min-w-0 items-baseline gap-2">
                    <h2 className="truncate text-base font-semibold text-foreground">{sectionLabel}</h2>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground">
                        {t("onboarding.voiceSelectedCount", {
                            defaultValue: "{{count}} of {{total}}",
                            count: selectedCount,
                            total: voicesWithPretty.length,
                        })}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={previewNext}
                    dir={isRTL ? "rtl" : "ltr"}
                    aria-label={t("onboarding.voicePreviewSelected", { defaultValue: "Preview selected" })}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground shadow-sm transition hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-95"
                >
                    <Volume2 size={14} className="text-purple-600" />
                    {t("onboarding.voicePreviewSelected", { defaultValue: "Preview selected" })}
                </button>
            </div>
            {grid}
        </section>
    );
}
