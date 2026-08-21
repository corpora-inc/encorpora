import { Sun, Monitor, Moon } from "lucide-react";
import { useSettingsStore, type Theme } from "@/store/settings";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslation } from "react-i18next";

const OPTIONS: { value: Theme; Icon: typeof Sun; labelKey: string }[] = [
  { value: "light", Icon: Sun, labelKey: "settings.themeLight" },
  { value: "system", Icon: Monitor, labelKey: "settings.themeSystem" },
  { value: "dark", Icon: Moon, labelKey: "settings.themeDark" },
];

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const dir = useSettingsStore((s) => s.dir);
  const { t } = useTranslation();

  return (
    <SegmentedControl<Theme>
      value={theme}
      onChange={(v) => setTheme(v)}
      ariaLabel={t("settings.theme", { defaultValue: "Theme" })}
      dir={dir()}
      options={OPTIONS.map(({ value, Icon, labelKey }) => ({
        value,
        ariaLabel: t(labelKey, { defaultValue: value }),
        label: (
          <>
            <Icon size={14} className="shrink-0" />
            <span className="truncate">{t(labelKey, { defaultValue: value })}</span>
          </>
        ),
      }))}
    />
  );
}
