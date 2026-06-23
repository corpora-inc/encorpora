// encorpora/corpan/corpan-app/src/components/VoiceCard.tsx
import { Check, Play, Venus, Mars, User, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { VoiceInfo } from "@/util/tts-voices";

/* ------------------------------ Quality ------------------------------ */

// Display tier (1..4). Mirrors the engine's raw quality strings; Apple
// "enhanced" and Android "high"/"very_high" are the top tiers.
const QUALITY_LEVEL: Record<string, number> = {
    very_high: 4,
    premium: 4,
    high: 3,
    enhanced: 3,
    normal: 2,
    default: 2,
    low: 1,
    very_low: 1,
};

export function qualityLevel(q?: VoiceInfo["quality"]): number {
    return q ? QUALITY_LEVEL[q] ?? 0 : 0;
}

/** Four ascending bars; filled up to the voice's quality tier. */
function QualityBars({ q }: { q?: VoiceInfo["quality"] }) {
    const level = qualityLevel(q);
    return (
        <span className="inline-flex items-end gap-[2px]" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
                <span
                    key={i}
                    className={[
                        "inline-block w-[3px] rounded-full transition-colors",
                        i === 0 ? "h-1.5" : i === 1 ? "h-2" : i === 2 ? "h-2.5" : "h-3",
                        i < level ? "bg-emerald-500" : "bg-muted-foreground/25",
                    ].join(" ")}
                />
            ))}
        </span>
    );
}

function GenderGlyph({ g }: { g?: VoiceInfo["gender"] }) {
    if (g === "female") return <Venus size={13} className="text-muted-foreground/80" />;
    if (g === "male") return <Mars size={13} className="text-muted-foreground/80" />;
    return <User size={13} className="text-muted-foreground/60" />;
}

/* ------------------------------ Card ------------------------------ */

export type VoiceCardProps = {
    voice: VoiceInfo;
    /** Pretty, localized language/dialect label (e.g. "Spanish (Mexico)"). */
    prettyLang: string;
    selected: boolean;
    /** True for the auto-picked, highest-quality voice(s) — shows a quiet badge. */
    recommended?: boolean;
    /** Pulse accent right after a preview is fired. */
    speaking?: boolean;
    onToggle: () => void;
    onPreview: () => void;
    isRTL: boolean;
};

/**
 * A single selectable voice. The whole card is the selection target; a distinct
 * round play button previews without toggling. Selection reads as a calm filled
 * check + brand-tinted surface, not a heavy ring — premium, low-noise.
 */
export function VoiceCard({
    voice,
    prettyLang,
    selected,
    recommended = false,
    speaking = false,
    onToggle,
    onPreview,
    isRTL,
}: VoiceCardProps) {
    const { t } = useTranslation();
    const title = voice.name || voice.id;

    return (
        <div
            role="checkbox"
            aria-checked={selected}
            aria-label={title}
            tabIndex={0}
            onClick={onToggle}
            onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggle();
                }
            }}
            className={[
                "group relative flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-start transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70",
                selected
                    ? "border-purple-300 bg-purple-50/70 shadow-sm dark:border-purple-700/60 dark:bg-purple-950/30"
                    : "border-border bg-card hover:border-purple-200 hover:bg-accent/40 dark:hover:border-purple-900/60",
            ].join(" ")}
        >
            {/* Preview — round, brand-tinted; the obvious "hear it" affordance. */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onPreview();
                }}
                aria-label={t("onboarding.voicePreviewAria", {
                    defaultValue: "Preview {{name}}",
                    name: title,
                })}
                dir={isRTL ? "rtl" : "ltr"}
                className={[
                    "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 active:scale-95",
                    "bg-purple-600 text-white shadow-sm hover:bg-purple-700",
                ].join(" ")}
            >
                <Play size={16} className="ms-[1px] fill-current" />
                {speaking ? (
                    <span className="absolute inset-0 animate-ping rounded-full bg-purple-400/50" aria-hidden />
                ) : null}
            </button>

            {/* Identity + meta. Name may wrap (never truncate to "D…"). The
                "Recommended" sparkle sits to the LEFT of the name so it never
                crowds it; the region/dialect + quality + gender wrap freely so
                the useful detail stays visible. */}
            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                    {recommended ? (
                        <Sparkles
                            size={13}
                            className="mt-[3px] shrink-0 fill-current text-purple-500"
                            aria-label={t("onboarding.voiceRecommended", { defaultValue: "Recommended" })}
                        />
                    ) : null}
                    <span className="text-sm font-semibold leading-snug text-foreground break-words">
                        {title}
                    </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <QualityBars q={voice.quality} />
                    <GenderGlyph g={voice.gender} />
                    <span className="break-words">{prettyLang}</span>
                    {voice.engine ? (
                        <span className="rounded border border-border bg-muted/60 px-1 py-[1px] text-[10px] leading-none">
                            {voice.engine}
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Selection indicator */}
            <span
                aria-hidden
                className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all",
                    selected
                        ? "border-purple-600 bg-purple-600 text-white"
                        : "border-input bg-background text-transparent group-hover:border-purple-300",
                ].join(" ")}
            >
                <Check size={14} strokeWidth={3} />
            </span>
        </div>
    );
}
