import { useSettingsStore } from "@/store/settings";
import { Slider } from "@/components/ui/slider";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * Adjusts the delay between sentences during autoplay.
 * Range: 300ms - 5000ms (0.3s - 5s)
 */
export function AutoplayDelayAdjuster() {
  const delay = useSettingsStore(s => s.autoplayDelayMs);
  const setDelay = useSettingsStore(s => s.setAutoplayDelayMs);
  const dir = useSettingsStore(s => s.dir());
  const { t } = useTranslation();
  const sliderValue = useMemo(() => [delay], [delay]);
  return (
    <div className="mt-6 w-full">
      <div className="mb-2 font-semibold text-sm" dir={dir}>{t("settings.autoPlayDelay")}</div>
      <div className="flex items-center gap-4" dir={dir}>
        <span className="text-xs text-gray-500 min-w-[50px]">0.3s</span>
        <Slider
          value={sliderValue}
          min={300}
            max={5000}
            step={100}
            className="flex-1"
            onValueChange={([v]) => setDelay(v)}
            dir={dir}
        />
        <span className="text-xs text-gray-500 min-w-[50px] text-right">5s</span>
      </div>
      <div className="mt-1 text-xs text-gray-400 text-center" dir={dir}>
        {(delay / 1000).toFixed(2)}s {t("settings.betweenSentences")}
      </div>
    </div>
  );
}
