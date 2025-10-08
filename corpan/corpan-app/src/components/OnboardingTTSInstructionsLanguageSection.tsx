// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructionsLanguageSection.tsx
import { memo, useMemo } from "react";
import { CheckCircle2, Circle, Volume2, Venus, Mars, User } from "lucide-react";
import type { VoiceInfo } from "@/util/tts-voices";
import { useTranslation } from "react-i18next";

/* ----------------------------- Types ----------------------------- */

// Kept for compatibility with callers; UI always cycles.
export type LangMode = "cycle" | "random";

type Props = {
    code: string; // grouping tag (e.g., "en", "es-AR", "zh-CN-u-sd-cnln")
    voices: VoiceInfo[];
    selectedIds: string[];
    mode: LangMode; // ignored visually
    onToggleSelect: (voiceId: string) => void;
    onChangeMode: (m: LangMode) => void; // unused (we force 'cycle' upstream)
    onPreviewAny: (voice: VoiceInfo) => void;
    previewSampleText: string;
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

// Normalizes casing (lang lower, Script Title, REGION upper). We DO NOT strip
// extensions for translation lookups; only for the last-ditch fallback.
function normalizeTagCasing(tag: string) {
    const [base, ...extParts] = tag.split("-u-");
    const parts = base.split("-");
    if (!parts.length) return tag;

    const lang = parts[0].toLowerCase();
    let script: string | undefined;
    let region: string | undefined;
    let rest: string[] = [];

    if (parts[1]?.length === 4) {
        script = parts[1][0].toUpperCase() + parts[1].slice(1).toLowerCase();
        region = parts[2]?.toUpperCase();
        rest = parts.slice(3);
    } else {
        region = parts[1]?.toUpperCase();
        rest = parts.slice(2);
    }
    const rebuilt = [lang, script, region, ...rest.filter(Boolean)].join("-");
    return extParts.length ? `${rebuilt}-u-${extParts.join("-u-")}` : rebuilt;
}

function stripUnicodeExtensions(tag: string) {
    return tag.replace(/-u-.*/i, "");
}

/**
 * Translation-first dialect label resolution (single namespace: "common"):
 *  1) common:dialects.<fullTag>         e.g., zh-CN-u-sd-cnln
 *  2) common:dialects.<baseTag>         e.g., zh-CN
 *  3) common:dialects.<lang-Script>     e.g., zh-Hans
 *     common:dialects.<lang-REGION>     e.g., es-AR
 *  4) common:dialects.<lang>            e.g., es
 *  5) fallback: normalized base tag, with tiny zh-Hans/Hant special-case
 */
function resolveDialectLabel(fullTag: string, trDial: (k: string) => string) {
    const normFull = normalizeTagCasing(fullTag);
    const base = stripUnicodeExtensions(normFull);

    // 1) exact full tag
    const v1 = trDial(normFull);
    if (v1) return v1;

    // 2) base without extensions
    const v2 = trDial(base);
    if (v2) return v2;

    // 3) lang + script/region
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

    // 4) language-only
    const v4 = trDial(lang);
    if (v4) return v4;

    // 5) final fallback
    if (base === "zh-Hans") return "Chinese (Simplified)";
    if (base === "zh-Hant") return "Chinese (Traditional)";
    return base;
}

/* ----------------------------- UI bits ----------------------------- */

const QUALITY_LEVEL = {
    very_high: 4,
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
                    className={`inline-block h-3 w-1 rounded-sm ${i < level ? "bg-emerald-600" : "bg-gray-300"
                        }`}
                />
            ))}
        </div>
    );
}

function GenderIcon({ g }: { g?: VoiceInfo["gender"] }) {
    if (g === "female") return <Venus size={14} className="text-gray-600" />;
    if (g === "male") return <Mars size={14} className="text-gray-600" />;
    return <User size={14} className="text-gray-400" />;
}

function VoiceCard({
    v,
    checked,
    onToggle,
    onPreview,
    isRTL,
    ariaPreview,
    prettyLang,
}: {
    v: VoiceInfo;
    checked: boolean;
    onToggle: () => void;
    onPreview: () => void;
    isRTL: boolean;
    ariaPreview: string;
    prettyLang: string;
}) {
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
                "cursor-pointer rounded-lg border p-3 shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400",
                checked
                    ? "border-purple-500 ring-2 ring-purple-200"
                    : "border-gray-200 hover:bg-gray-50",
            ].join(" ")}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-gray-900">
                        {v.name || v.id}
                    </div>
                    <div className="text-xs text-gray-600">{prettyLang}</div>
                </div>

                <div
                    className={[
                        "shrink-0 rounded-full border p-1.5",
                        checked
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "bg-white border-gray-300 text-gray-800",
                    ].join(" ")}
                    aria-hidden
                >
                    {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
                <QualityIcon q={v.quality} />
                {v.engine ? (
                    <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800">
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
                    className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50 hover:cursor-pointer"
                    dir={isRTL ? "rtl" : "ltr"}
                    aria-label={ariaPreview}
                    title={ariaPreview}
                >
                    <Volume2 size={14} className="text-purple-700" />
                </button>
                <div className="truncate text-[11px] text-gray-500">{v.id}</div>
            </div>
        </div>
    );
}

/* ----------------------------- Section ----------------------------- */

export const OnboardingTTSInstructionsLanguageSection = memo(function Section({
    code,
    voices,
    selectedIds,
    // mode, onChangeMode kept for API compatibility — UI always cycles
    mode: _mode,
    onChangeMode: _onChangeMode,
    onToggleSelect,
    onPreviewAny,
    previewSampleText,
    isRTL,
}: Props) {
    const { t } = useTranslation();

    // Simple local accessor into *one* namespace ("common") under "dialects.*"
    // Casting to string keeps TS quiet without polluting TFunction types.
    const trDial = (key: string) =>
        (t(`dialects.${key}`, { defaultValue: "" }) as unknown as string) || "";

    const voicesUnique = useMemo(
        () => uniqBy(voices, (v) => `${v.id}|${v.language}`),
        [voices]
    );

    // Section header label (translations-first)
    const sectionLabel = useMemo(
        () => resolveDialectLabel(code, trDial),
        [code] // trDial stable enough; depends only on t instance
    );

    // Per-voice pretty labels (translations-first)
    const voicesWithPretty = useMemo(
        () =>
            voicesUnique.map((v) => ({
                ...v,
                __prettyLang: resolveDialectLabel(v.language || code, trDial),
            })),
        [voicesUnique, code]
    );

    const previewVoice =
        voicesWithPretty.find((v) => selectedIds.includes(v.id)) || voicesWithPretty[0];

    return (
        <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
            {/* Header row: language label + count + preview */}
            <div className="flex flex-col gap-3 border-b bg-gray-50 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tracking-wide text-gray-900 sm:text-base">
                        {sectionLabel}
                    </span>
                    <span className="rounded-full border border-gray-900 bg-gray-900 px-2 py-1 text-xs font-semibold text-white">
                        {voicesWithPretty.length}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => previewVoice && onPreviewAny(previewVoice)}
                        className="inline-flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 hover:cursor-pointer disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                        disabled={!previewVoice}
                        dir={isRTL ? "rtl" : "ltr"}
                        aria-label={t("onboarding.previewSample", { defaultValue: "Preview sample" })}
                        title={t("onboarding.previewSample", { defaultValue: "Preview sample" })}
                    >
                        <Volume2 size={16} className="text-purple-700" />
                    </button>
                </div>
            </div>

            {/* Grid of voices */}
            {voicesWithPretty.length === 0 ? (
                <div className="p-6">
                    <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed text-gray-400 sm:h-28" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
                    {voicesWithPretty.map((v) => {
                        const checked = selectedIds.includes(v.id);
                        return (
                            <VoiceCard
                                key={`${v.id}|${v.language}`}
                                v={v}
                                checked={checked}
                                onToggle={() => onToggleSelect(v.id)}
                                onPreview={() => onPreviewAny(v)}
                                isRTL={isRTL}
                                ariaPreview={t("onboarding.preview", { defaultValue: "Preview" })}
                                prettyLang={(v as any).__prettyLang}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
});
