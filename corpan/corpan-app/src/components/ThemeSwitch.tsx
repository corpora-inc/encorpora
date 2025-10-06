import { useTheme } from "./ThemeProvider";
import { Switch } from "./ui/switch";
import { useTranslation } from "react-i18next";

const ThemeToggle = () => {
  const { setTheme, theme } = useTheme();
  const { t } = useTranslation();

  const toggleTheme = () => {
    if (theme === "dark") setTheme("light");
    if (theme === "light") setTheme("dark");
  };

  return (
    <div className="flex items-center justify-between space-x-2">
      <p className="sr-only">{t("settings.themeMode")}</p>
      <p className="font-medium text-sm">
        {theme === "dark" ? t("settings.turnOnLightMode") : t("settings.turnOnDarkMode")}
      </p>
      <Switch
        id="toggle-theme"
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
      />
    </div>
  );
};

export default ThemeToggle;
