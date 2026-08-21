import { useSettingsStore } from "@/store/settings";
import { Slider } from "@/components/ui/slider";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const PRESETS: { key: "slow" | "normal" | "fast"; value: number }[] = [
  { key: "slow", value: 0.5 },
  { key: "normal", value: 1.0 },
  { key: "fast", value: 1.25 },
];

export function RateAdjuster() {
  const rate = useSettingsStore((s) => s.rate);
  const setRate = useSettingsStore((s) => s.setRate);

  const { t } = useTranslation();
  const dir = useSettingsStore((s) => s.dir());

  // Keep slider and rate in sync.
  const sliderValue = useMemo(() => [rate], [rate]);

  // Which preset (if any) the current rate lands on — drives the segmented
  // control's active state without a second piece of state.
  const activePreset = PRESETS.find((p) => Math.abs(rate - p.value) < 0.03)?.key;

  return (
    <div className="mt-1 w-full">
      <div className="mb-2 font-semibold text-sm" dir={dir}>
        {t("settings.speechRate")}
      </div>
      <SegmentedControl<"slow" | "normal" | "fast">
        value={activePreset ?? ("" as "slow")}
        onChange={(k) => setRate(PRESETS.find((p) => p.key === k)!.value)}
        ariaLabel={t("settings.speechRate")}
        dir={dir}
        options={PRESETS.map((p) => ({
          value: p.key,
          label: t(`settings.${p.key}` as any),
        }))}
      />
      <div className="mt-3 flex items-center gap-3" dir={dir}>
        <span className="text-xs text-muted-foreground tabular-nums min-w-[34px]">
          0.1
        </span>
        <Slider
          value={sliderValue}
          min={0.1}
          max={1.5}
          step={0.005}
          className="flex-1"
          onValueChange={([v]) => setRate(Number(v.toFixed(3)))}
          dir={dir}
        />
        <span className="text-xs text-muted-foreground tabular-nums min-w-[34px] text-right">
          {rate.toFixed(2)}x
        </span>
      </div>
    </div>
  );
}
