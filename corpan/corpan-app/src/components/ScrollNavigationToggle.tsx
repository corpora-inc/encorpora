import { useSettingsStore } from "@/store/settings";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "react-i18next";

export function ScrollNavigationToggle() {
  const scrollNavigationEnabled = useSettingsStore((s) => s.scrollNavigationEnabled);
  const setScrollNavigationEnabled = useSettingsStore((s) => s.setScrollNavigationEnabled);
  const { t } = useTranslation();

  return (
    <div
      className="w-full flex gap-3 py-3"
    >
      <label
        htmlFor="toggle-scroll-navigation"
        className="text-foreground text-sm font-medium select-none"
        style={{ minWidth: 0, flex: 1 }}
      >
        {t("settings.scrollNavigation")}
      </label>
      <Switch
        id="toggle-scroll-navigation"
        checked={scrollNavigationEnabled}
        onCheckedChange={setScrollNavigationEnabled}
      />
    </div>
  );
}
