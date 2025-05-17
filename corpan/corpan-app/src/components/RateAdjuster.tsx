import { useSettingsStore } from "@/store/settings";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";
import { BROWSER_TTS } from "@/util/speak";


const BUTTONS = [
    { label: "Slow", value: 0.5 },
    { label: "Normal", value: 1.0 },
    { label: "Fast", value: 1.25 }
];

export function RateAdjuster() {
    const rate = useSettingsStore(s => s.rate);
    const setRate = useSettingsStore(s => s.setRate);

    // Keep slider and rate in sync
    const sliderValue = useMemo(() => [rate], [rate]);

    // tauri-plugin-tts doesn't have a rate option right now
    if (!BROWSER_TTS) {
        return null;
    }

    return (
        <div className="mt-6 w-full">
            <div className="mb-2 font-semibold text-sm">Speech Rate</div>
            <div className="flex gap-2 mb-3">
                {BUTTONS.map(btn => (
                    <Button
                        key={btn.label}
                        size="sm"
                        variant={Math.abs(rate - btn.value) < 0.03 ? "default" : "outline"}
                        className="rounded-full text-xs px-4 py-1"
                        onClick={() => setRate(btn.value)}
                    >
                        {btn.label}
                    </Button>
                ))}
            </div>
            <div className="flex items-center gap-4">
                <span className="text-xs text-gray-500 min-w-[45px]">0.01</span>
                <Slider
                    value={sliderValue}
                    min={0}
                    max={1.5}
                    step={0.005}
                    className="flex-1"
                    onValueChange={([v]) => setRate(Number(v.toFixed(3)))}
                />
                <span className="text-xs text-gray-500 min-w-[45px] text-right">1.5</span>
            </div>
            <div className="mt-1 text-xs text-gray-400 text-center">
                {rate === 1.0
                    ? "Normal"
                    : rate < 1.0
                        ? `Slower (${rate.toFixed(2)}x)`
                        : `Faster (${rate.toFixed(2)}x)`
                }
            </div>
        </div>
    );
}
