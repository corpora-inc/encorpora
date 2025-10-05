import { useMemo } from "react";
import { SignalHigh, SignalMedium, SignalLow, Circle } from "lucide-react";
import type { VoiceQuality } from "@/util/tts-voices";
import { useTranslation } from "react-i18next";

/**
 * Icon-only quality indicator.
 * Colors:
 *  - High/Enhanced → emerald
 *  - Normal/Default → gray
 *  - Low → amber
 */
export function QualityGlyph({ quality }: { quality?: VoiceQuality }) {
    const { t } = useTranslation();

    const { Icon, cls, labelKey } = useMemo(() => {
        switch (quality) {
            case "very_high":
            case "high":
            case "enhanced":
                return {
                    Icon: SignalHigh,
                    cls: "text-emerald-600",
                    labelKey: "tts.quality.high", // e.g. "High / Enhanced"
                };
            case "normal":
            case "default":
                return { Icon: SignalMedium, cls: "text-gray-600", labelKey: "tts.quality.normal" };
            case "low":
            case "very_low":
                return { Icon: SignalLow, cls: "text-amber-600", labelKey: "tts.quality.low" };
            default:
                return { Icon: Circle, cls: "text-gray-400", labelKey: "tts.quality.unknown" };
        }
    }, [quality]);

    return (
        <span
            className={`inline-flex items-center justify-center rounded-full bg-white/60 ${cls}`}
            title={t(labelKey)}
            aria-label={t(labelKey)}
        >
            <Icon size={14} />
        </span>
    );
}
