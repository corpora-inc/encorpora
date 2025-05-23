import { useSettingsStore } from "@/store/settings";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { BROWSER_TTS } from "@/util/speak";
import { TranslationKey } from "@/store/translations";

const BUTTONS = [
    { label: "Slow", value: 0.5 },
    { label: "Normal", value: 1.0 },
    { label: "Fast", value: 1.25 }
];

export function RateAdjuster() {
    const rate = useSettingsStore(s => s.rate);
    const setRate = useSettingsStore(s => s.setRate);

    const t = useSettingsStore(s => s.t);
    const speech_rate = useSettingsStore(s => s.t("Speech Rate"));
    const dir = useSettingsStore(s => s.dir());

    // Keep slider and rate in sync
    const sliderValue = useMemo(() => [rate], [rate]);

    // tauri-plugin-tts doesn't have a rate option right now
    if (!BROWSER_TTS) {
        return null;
    }

    return (
        <div className="mt-1 w-full">
            <div className="mb-3 font-semibold text-sm" dir={dir}>{speech_rate}</div>
            <div className="flex gap-2 mb-3" dir={dir}>
                {BUTTONS.map(btn => (
                    <Button
                        key={btn.label}
                        size="sm"
                        variant={Math.abs(rate - btn.value) < 0.03 ? "default" : "outline"}
                        className="rounded-full text-xs px-4 py-1"
                        onClick={() => setRate(btn.value)}
                    >
                        {/* {btn.label} */}
                        {t(btn.label as TranslationKey)}
                    </Button>
                ))}
            </div>
            <div className="flex items-center gap-4" dir={dir}>
                <span className="text-xs text-gray-500 min-w-[45px]">0.01</span>
                <Slider
                    value={sliderValue}
                    min={0}
                    max={1.5}
                    step={0.005}
                    className="flex-1"
                    onValueChange={([v]) => setRate(Number(v.toFixed(3)))}
                    dir={dir}
                />
                <span className="text-xs text-gray-500 min-w-[45px] text-right">1.5</span>
            </div>
            <div className="mt-1 text-xs text-gray-400 text-center" dir={dir}>
                {rate === 1.0
                    ? t("Normal")
                    : rate < 1.0
                        ? `${t("Slower")} (${rate.toFixed(2)}x)`
                        : `${t("Faster")} (${rate.toFixed(2)}x)`
                }
            </div>
        </div>
    );
}
