import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";

const ThemeToggle =() => {
  const { setTheme, theme } = useTheme();

  const toggleTheme = () => {
    if (theme === "dark") setTheme("light");
    if (theme === "light") setTheme("dark");
  };

  return (
    <Button size='icon'  onClick={toggleTheme} className="rounded-full">
      {theme === "dark" ? (
        <Sun className=" scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      ) : (
        <Moon className="scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
      )}
    </Button>
  );
}

export default  ThemeToggle