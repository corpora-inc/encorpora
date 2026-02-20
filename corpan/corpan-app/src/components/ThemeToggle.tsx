import { Sun, Monitor, Moon } from "lucide-react";
import { useSettingsStore, type Theme } from "@/store/settings";
import { useTranslation } from "react-i18next";

const OPTIONS: { value: Theme; Icon: typeof Sun; labelKey: string }[] = [
  { value: "light", Icon: Sun, labelKey: "settings.themeLight" },
  { value: "system", Icon: Monitor, labelKey: "settings.themeSystem" },
  { value: "dark", Icon: Moon, labelKey: "settings.themeDark" },
];

export function ThemeToggle() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const { t } = useTranslation();

  return (
    <div className="w-full flex justify-end">
      <div className="inline-flex rounded-md border border-border p-1 gap-1">
        {OPTIONS.map(({ value, Icon, labelKey }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition cursor-pointer",
                active
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              ].join(" ")}
              aria-pressed={active}
            >
              <Icon size={14} />
              <span>{t(labelKey, { defaultValue: value })}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
