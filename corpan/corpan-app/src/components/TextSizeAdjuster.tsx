import {
  useSettingsStore,
  ALL_TEXT_SIZES,
  TextSizeType,
} from "@/store/settings";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslation } from "react-i18next";

// Visible type ramp: each segment is a single "A" sized to preview the choice,
// so the control reads at a glance and never depends on long localized words
// ("Semi large" / "Muy grande" used to wrap two rows). The size name still
// rides along as the a11y label so screen readers announce the real choice.
const RAMP: { size: TextSizeType; px: number }[] = [
  { size: "small", px: 12 },
  { size: "medium", px: 15 },
  { size: "semi-large", px: 18 },
  { size: "large", px: 22 },
  { size: "extra-large", px: 27 },
];

export function TextSizeAdjuster() {
  const textSize = useSettingsStore((s) => s.textSize);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const { t } = useTranslation();
  const dir = useSettingsStore((s) => s.dir);

  return (
    <div className="py-1" dir={dir()} id="text-size-adjuster">
      <div className="mb-2 font-semibold text-sm">{t("settings.textSize")}</div>
      <SegmentedControl<TextSizeType>
        value={textSize}
        onChange={(v) => setTextSize(v)}
        ariaLabel={t("settings.textSize")}
        dir={dir()}
        options={ALL_TEXT_SIZES.map((size) => {
          const px = RAMP.find((r) => r.size === size)?.px ?? 15;
          return {
            value: size,
            ariaLabel: t(`settings.${size}` as any) || size,
            label: (
              <span
                aria-hidden="true"
                className="font-semibold leading-none"
                style={{ fontSize: px }}
              >
                A
              </span>
            ),
          };
        })}
      />
    </div>
  );
}
