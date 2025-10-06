import { useTheme } from "./ThemeProvider";
import { Switch } from "./ui/switch";

const ThemeToggle = () => {
  const { setTheme, theme } = useTheme();

  const toggleTheme = () => {
    if (theme === "dark") setTheme("light");
    if (theme === "light") setTheme("dark");
  };

  return (
    <div className="flex items-center justify-between space-x-2">
      <p className="sr-only">Toggle theme</p>
      <p className="font-medium text-sm">Turn on {theme === "dark" ? "light" : "dark"} mode</p>
      <Switch
        id="toggle-theme"
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
      />
    </div>
  );
};

export default ThemeToggle;
