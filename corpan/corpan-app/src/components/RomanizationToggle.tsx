import { useSettingsStore } from "@/store/settings";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

export function RomanizationToggle() {
  const showRomanization = useSettingsStore((s) => s.showRomanization);
  const setShowRomanization = useSettingsStore((s) => s.setShowRomanization);
  const { t } = useTranslation();

  return (
    <div
      className="w-full flex gap-3 py-3"
      // style={{ maxWidth: 250 }}
    >
      <label
        htmlFor="toggle-romanization"
        className=" text-sm font-medium select-none"
        style={{ minWidth: 0, flex: 1 }}
      >
        {t("settings.showRomanization")}
      </label>
      <Switch
        id="toggle-romanization"
        checked={showRomanization}
        onCheckedChange={setShowRomanization}
      />
    </div>
  );
}
