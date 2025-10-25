// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructionsLanguageSection.tsx
import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, Circle, Volume2, Venus, Mars, User, ChevronDown, ChevronRight } from "lucide-react";
import type { VoiceInfo } from "@/util/tts-voices";
import { useTranslation } from "react-i18next";

/* ----------------------------- Types ----------------------------- */

type Props = {
    code: string; // e.g., "es-AR", "zh-CN-u-sd-cnln"
    voices: VoiceInfo[];
    selectedIds: string[];
    onToggleSelect: (voiceId: string) => void;
    onPreviewAny: (voice: VoiceInfo) => void | Promise<void>;
    previewSampleText: string; // kept for API compatibility (not used here)
    isRTL: boolean;
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

// Normalize casing & avoid "zh--CN"
function normalizeTagCasing(tag: string) {
    const [base, ...extParts] = tag.split("-u-");
    const parts = base.split("-").filter(Boolean);
    if (!parts.length) return tag;

    const lang = parts[0].toLowerCase();

    let i = 1;
    let script: string | undefined;
    let region: string | undefined;

    if (parts[i] && parts[i].length === 4) {
        const s = parts[i];
        script = s[0].toUpperCase() + s.slice(1).toLowerCase();
        i++;
    }
    if (parts[i] && (parts[i].length === 2 || parts[i].length === 3)) {
        region = parts[i].toUpperCase();
        i++;
    }

    const rest = parts.slice(i);
    const rebuiltParts: string[] = [lang];
    if (script) rebuiltParts.push(script);
    if (region) rebuiltParts.push(region);
    if (rest.length) rebuiltParts.push(...rest);

    const rebuilt = rebuiltParts.join("-");
    return extParts.length ? `${rebuilt}-u-${extParts.join("-u-")}` : rebuilt;
}
function stripUnicodeExtensions(tag: string) {
    return tag.replace(/-u-.*/i, "");
}

// translations-first label
function resolveDialectLabel(fullTag: string, trDial: (k: string) => string) {
    const normFull = normalizeTagCasing(fullTag);
    const base = stripUnicodeExtensions(normFull);

    const v1 = trDial(normFull);
    if (v1) return v1;

    const v2 = trDial(base);
    if (v2) return v2;

    const parts = base.split("-");
    const lang = parts[0];
    const script = parts[1]?.length === 4 ? parts[1] : undefined;
    const region = script ? parts[2] : parts[1];

    if (script) {
        const v3a = trDial(`${lang}-${script}`);
        if (v3a) return v3a;
    }
    if (region) {
        const v3b = trDial(`${lang}-${region}`);
        if (v3b) return v3b;
    }

    const v4 = trDial(lang);
    if (v4) return v4;

    if (base === "zh-Hans") return "Chinese (Simplified)";
    if (base === "zh-Hant") return "Chinese (Traditional)";
    return base;
}

/* ----------------------------- UI bits ----------------------------- */

const QUALITY_LEVEL = {
    very_high: 4,
    premium: 4,
    high: 3,
    enhanced: 3,
    normal: 2,
    default: 2,
    low: 1,
    very_low: 1,
} as const;
type QualityKey = keyof typeof QUALITY_LEVEL;

function QualityIcon({ q }: { q?: VoiceInfo["quality"] }) {
    const level = q ? QUALITY_LEVEL[(q as QualityKey)] ?? 0 : 0;
    return (
        <div className="inline-flex items-end gap-[2px]" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
                <span
                    key={i}
                    className={`inline-block h-3 w-1 rounded-sm ${i < level ? "bg-emerald-600 dark:bg-emerald-400" : "bg-gray-300 dark:bg-slate-600"}`}
                />
            ))}
        </div>
    );
}

function GenderIcon({ g }: { g?: VoiceInfo["gender"] }) {
    // console.warn(g);
    if (g === "female") return <Venus size={14} className="text-gray-600 dark:text-slate-300" />;
    if (g === "male") return <Mars size={14} className="text-gray-600 dark:text-slate-300" />;
    return <User size={14} className="text-gray-400 dark:text-slate-500" />;
}

function VoiceCard({
    v,
    checked,
    onToggle,
    onPreview,
    isRTL,
    ariaPreview,
    prettyLang,
    isHighlighted,
}: {
    v: VoiceInfo;
    checked: boolean;
    onToggle: () => void;
    onPreview: () => void;
    isRTL: boolean;
    ariaPreview: string;
    prettyLang: string;
    isHighlighted: boolean;
}) {
    const highlightCls = isHighlighted ? "ring-2 ring-black/50 dark:ring-white/40 animate-pulse" : "";
    // console.warn(v);
    return (
        <div
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    onToggle();
                }
            }}
            onClick={onToggle}
            className={[
                "cursor-pointer rounded-lg border p-3 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-black dark:shadow-none dark:focus-visible:ring-white/70",
                checked
                    ? "border-black ring-2 ring-black/30 dark:border-input dark:ring-white/40 dark:bg-input/60"
                    : "border-gray-200 hover:bg-gray-50 dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
                highlightCls,
            ].join(" ")}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{v.name || v.id}</div>
                    <div className="text-xs text-gray-600 dark:text-slate-400">{prettyLang}</div>
                </div>

                <div
                    className={[
                        "shrink-0 rounded-full border p-1.5",
                        checked
                            ? "bg-black border-black text-white dark:bg-input/70 dark:border-input dark:text-white"
                            : "bg-background border-gray-300 text-gray-800 dark:bg-input/30 dark:border-input dark:text-slate-100",
                    ].join(" ")}
                    aria-hidden
                >
                    {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <QualityIcon q={v.quality} />
                {v.engine ? (
                    <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                        {v.engine}
                    </span>
                ) : null}
                <GenderIcon g={v.gender} />
            </div>

            <div className="mt-2 flex items-center gap-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // don’t toggle when previewing
                        onPreview();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-background px-2.5 py-1.5 text-xs font-medium text-gray-900 shadow-sm hover:bg-gray-50 hover:cursor-pointer dark:border-input dark:bg-input/30 dark:text-slate-100 dark:hover:bg-input/50"
                    dir={isRTL ? "rtl" : "ltr"}
                    aria-label={ariaPreview}
                >
                    <Volume2 size={14} className="text-black dark:text-white" />
                </button>
                <div className="truncate text-[11px] text-gray-500 dark:text-slate-400">{v.id}</div>
            </div>
        </div>
    );
}

/* ----------------------------- Section ----------------------------- */

export function OnboardingTTSInstructionsLanguageSection({
    code,
    voices,
    selectedIds,
    onToggleSelect,
    onPreviewAny,
    previewSampleText: _previewSampleText, // intentionally unused here
    isRTL,
}: Props) {
    const { t } = useTranslation();

    const trDial = (key: string) =>
        (t(`dialects.${key}`, { defaultValue: "" }) as unknown as string) || "";

    // unique by (id|language)
    const voicesUnique = useMemo(
        () => uniqBy(voices, (v) => `${v.id}|${v.language}`),
        [voices]
    );

    // display order: quality desc, then name asc
    const voicesSorted = useMemo(() => {
        const score = (q?: VoiceInfo["quality"]) => {
            if (!q) return 0;
            const v = QUALITY_LEVEL[q as QualityKey];
            return typeof v === "number" ? v : 0;
        };
        return [...voicesUnique].sort((a, b) => {
            const qa = score(a.quality);
            const qb = score(b.quality);
            if (qb !== qa) return qb - qa; // higher quality first
            const an = a.name || a.id;
            const bn = b.name || b.id;
            return an.localeCompare(bn, undefined, { sensitivity: "base", numeric: true });
        });
    }, [voicesUnique]);

    // pretty labels
    const sectionLabel = resolveDialectLabel(code, trDial);
    const voicesWithPretty = useMemo(
        () =>
            voicesSorted.map((v) => ({
                ...v,
                __prettyLang: resolveDialectLabel(v.language || code, trDial),
            })),
        [voicesSorted, code]
    );

    // rotation index (one tap = one voice; allows overlaps)
    const [cycleIdx, setCycleIdx] = useState(0);

    // slow highlight per tapped/previewed voice
    const [highlight, setHighlight] = useState<Record<string, number>>({});
    const HIGHLIGHT_MS = 2000;

    // collapsed by default
    const [open, setOpen] = useState(false);

    // sequence follows UI order; only selected voices, fallback to first
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
    const sequence: VoiceInfo[] = useMemo(() => {
        const filtered = voicesWithPretty.filter((v) => selectedSet.has(v.id));
        if (filtered.length > 0) return filtered;
        return voicesWithPretty[0] ? [voicesWithPretty[0] as VoiceInfo] : [];
    }, [voicesWithPretty, selectedSet]);

    // clamp/reset index when sequence changes
    useEffect(() => {
        if (cycleIdx >= sequence.length) setCycleIdx(0);
    }, [sequence.length, cycleIdx]);

    // highlight helper
    const flash = (voiceId: string) => {
        setHighlight((prev) => {
            const nextVersion = (prev[voiceId] ?? 0) + 1;
            const next = { ...prev, [voiceId]: nextVersion };
            window.setTimeout(() => {
                setHighlight((cur) => {
                    if (cur[voiceId] === nextVersion) {
                        const { [voiceId]: _removed, ...rest } = cur;
                        return rest;
                    }
                    return cur;
                });
            }, HIGHLIGHT_MS);
            return next;
        });
    };

    function playNextOnce() {
        if (!sequence.length) return;
        const v = sequence[cycleIdx];
        flash(v.id);
        try {
            onPreviewAny(v); // allow overlap; don't await
        } finally {
            setCycleIdx((i) => (sequence.length ? (i + 1) % sequence.length : 0));
        }
    }

    const headerPreviewAria = "Preview next";
    const perCardPreviewAria = "Preview";

    const selectedCount = useMemo(
        () => voicesWithPretty.filter((v) => selectedIds.includes(v.id)).length,
        [voicesWithPretty, selectedIds]
    );

    const sectionId = `tts-lang-${code.replace(/[^a-z0-9]/gi, "_")}`;
    const hasVoices = voicesWithPretty.length > 0;

    return (
        <div
            className={[
                "mt-3 overflow-hidden rounded-xl border bg-white shadow-sm",
                hasVoices ? "border-gray-200" : "border-amber-300",
            ].join(" ")}
        >
            {/* Header: toggle + label + counts + preview (one row) */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-controls={sectionId}
                aria-expanded={open}
                className="w-full"
            >
                <div
                    className={[
                        "flex items-center justify-between gap-2 px-3 py-2 sm:px-4 border-b",
                        hasVoices ? "bg-gray-50 border-gray-200" : "bg-amber-50/70 border-amber-200",
                    ].join(" ")}
                >
                    {/* Left: chevron + label */}
                    <div className="flex min-w-0 items-center gap-2">
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span
                            className={[
                                "truncate text-sm font-semibold tracking-wide sm:text-base",
                                hasVoices ? "text-gray-900" : "text-amber-900",
                            ].join(" ")}
                        >
                            {sectionLabel}
                        </span>
                        {!hasVoices && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-[1px] text-[11px] font-medium text-amber-900">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                                {t("onboarding.noVoices", { defaultValue: "No voices" })}
                            </span>
                        )}
                    </div>

                    {/* Right: counts + preview button */}
                    <div className="flex items-center gap-2">
                        <span
                            className={[
                                "rounded-full px-2 py-[2px] text-xs font-semibold",
                                hasVoices
                                    ? "border border-gray-900 bg-gray-900 text-white"
                                    : "border border-amber-600 bg-amber-600 text-white",
                            ].join(" ")}
                        >
                            {selectedCount}/{voicesWithPretty.length}
                        </span>
                        <button
                            type="button"
                            disabled={!hasVoices}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (hasVoices) playNextOnce();
                            }}
                            className={[
                                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm",
                                "focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                                hasVoices
                                    ? "bg-white text-gray-800 hover:bg-gray-50"
                                    : "bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed",
                            ].join(" ")}
                            dir={isRTL ? "rtl" : "ltr"}
                            aria-label={headerPreviewAria}
                        >
                            <Volume2 size={14} className={hasVoices ? "text-purple-700" : "text-gray-500"} />
                        </button>
                    </div>
                </div>
            </button>

            {/* Body: grid of voices (collapsed by default) */}
            <div id={sectionId} hidden={!open}>
                {hasVoices ? (
                    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
                        {voicesWithPretty.map((v) => {
                            const checked = selectedIds.includes(v.id);
                            return (
                                <VoiceCard
                                    key={`${v.id}|${v.language}`}
                                    v={v}
                                    checked={checked}
                                    onToggle={() => onToggleSelect(v.id)}
                                    onPreview={() => {
                                        flash(v.id);
                                        onPreviewAny(v);
                                    }}
                                    isRTL={isRTL}
                                    ariaPreview={perCardPreviewAria}
                                    prettyLang={(v as any).__prettyLang}
                                    isHighlighted={highlight[v.id] != null}
                                />
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-4">
                        <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed border-amber-200 text-amber-700 sm:h-24 text-xs">
                            {t("onboarding.noVoicesHint", { defaultValue: "Install voices to enable this language." })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
