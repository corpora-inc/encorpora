import {
  useSettingsStore,
  ALL_TEXT_SIZES,
  TextSizeType,
} from "@/store/settings";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export function TextSizeAdjuster() {
  const textSize = useSettingsStore((s) => s.textSize);
  const setTextSize = useSettingsStore((s) => s.setTextSize);
  const { t } = useTranslation();
  const dir = useSettingsStore((s) => s.dir);

  return (
    <div className="py-4" dir={dir()}>
      <div className="mb-3 font-semibold text-sm">{t("settings.textSize")}</div>
      <div className="flex flex-wrap gap-2" id="text-size-adjuster">
        {ALL_TEXT_SIZES.map((size) => (
          <Button
            key={size}
            variant={textSize === size ? "default" : "outline"}
            onClick={() => setTextSize(size as TextSizeType)}
            className="capitalize"
          >
            {t(`settings.${size}` as any) || size}
          </Button>
        ))}
      </div>
    </div>
  );
}
