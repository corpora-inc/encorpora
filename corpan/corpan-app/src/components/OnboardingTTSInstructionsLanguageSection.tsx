// encorpora/corpan/corpan-app/src/components/OnboardingTTSInstructionsLanguageSection.tsx
import { memo, useMemo } from "react";
import { Repeat2, Shuffle, CheckCircle2, Circle, Volume2, Venus, Mars, User } from "lucide-react";
import type { VoiceInfo } from "@/util/tts-voices";

export type LangMode = "cycle" | "random";

type Props = {
    code: string;
    voices: VoiceInfo[];
    selectedIds: string[];
    mode: LangMode;
    onToggleSelect: (voiceId: string) => void;
    onChangeMode: (m: LangMode) => void;
    onPreviewAny: (voice: VoiceInfo) => void;
    previewSampleText: string;
    isRTL: boolean;
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

// Compact, typed quality → level mapping
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
                    className={`inline-block w-1 h-3 rounded-sm ${i < level ? "bg-emerald-600" : "bg-gray-300"}`}
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
}: {
    v: VoiceInfo;
    checked: boolean;
    onToggle: () => void;
    onPreview: () => void;
    isRTL: boolean;
}) {
    return (
        <div
            className={`rounded-lg border p-3 flex flex-col gap-2 transition ${checked ? "border-purple-500 ring-2 ring-purple-200" : "border-gray-200"
                }`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                        {v.name || v.id}
                    </div>
                    <div className="text-xs text-gray-600">{v.language}</div>
                </div>

                <button
                    onClick={onToggle}
                    className={`shrink-0 rounded-full border p-1.5 ${checked
                            ? "bg-purple-600 border-purple-600 text-white"
                            : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"
                        }`}
                    aria-pressed={checked}
                >
                    {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </button>
            </div>

            <div className="flex items-center flex-wrap gap-2">
                <QualityIcon q={v.quality} />
                {v.engine ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-100 text-slate-800 border-slate-200">
                        {v.engine}
                    </span>
                ) : null}
                <GenderIcon g={v.gender} />
            </div>

            <div className="flex items-center gap-2 mt-1">
                <button
                    onClick={onPreview}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-white hover:bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-sm"
                    dir={isRTL ? "rtl" : "ltr"}
                    aria-label="Preview"
                    title="Preview"
                >
                    <Volume2 size={14} className="text-purple-700" />
                </button>
                <div className="text-[11px] text-gray-500 truncate">{v.id}</div>
            </div>
        </div>
    );
}

export const OnboardingTTSInstructionsLanguageSection = memo(function Section({
    code,
    voices,
    selectedIds,
    mode,
    onToggleSelect,
    onChangeMode,
    onPreviewAny,
    previewSampleText,
    isRTL,
}: Props) {
    // Extra guard: ensure uniqueness within this section as well
    const voicesUnique = useMemo(
        () => uniqBy(voices, (v) => `${v.id}|${v.language}`),
        [voices]
    );

    const previewVoice =
        voicesUnique.find((v) => selectedIds.includes(v.id)) || voicesUnique[0];

    return (
        <div className="mt-6 bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 sm:p-4 border-b bg-gray-50">
                <div className="flex items-center gap-3">
                    <span className="text-sm sm:text-base font-semibold text-gray-900 tracking-wide">
                        {code.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold border bg-gray-900 text-white border-gray-900">
                        {voicesUnique.length}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onChangeMode("cycle")}
                        className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-sm ${mode === "cycle"
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"
                            }`}
                        aria-pressed={mode === "cycle"}
                        title="Cycle"
                    >
                        <Repeat2 size={14} />
                    </button>

                    <button
                        onClick={() => onChangeMode("random")}
                        className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border text-sm ${mode === "random"
                                ? "bg-gray-900 text-white border-gray-900"
                                : "bg-white hover:bg-gray-50 border-gray-300 text-gray-800"
                            }`}
                        aria-pressed={mode === "random"}
                        title="Random"
                    >
                        <Shuffle size={14} />
                    </button>

                    <button
                        onClick={() => previewVoice && onPreviewAny(previewVoice)}
                        className="inline-flex items-center gap-2 rounded-md border bg-white hover:bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm"
                        disabled={!previewVoice}
                        dir={isRTL ? "rtl" : "ltr"}
                        aria-label="Preview language sample"
                        title="Preview"
                    >
                        <Volume2 size={16} className="text-purple-700" />
                    </button>
                </div>
            </div>

            {voicesUnique.length === 0 ? (
                <div className="p-6">
                    <div className="border-2 border-dashed rounded-lg h-24 sm:h-28 flex items-center justify-center text-gray-400" />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 sm:p-4">
                    {voicesUnique.map((v) => {
                        const checked = selectedIds.includes(v.id);
                        return (
                            <VoiceCard
                                key={`${v.id}|${v.language}`} // composite key to avoid collisions
                                v={v}
                                checked={checked}
                                onToggle={() => onToggleSelect(v.id)}
                                onPreview={() => onPreviewAny(v)}
                                isRTL={isRTL}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
});
