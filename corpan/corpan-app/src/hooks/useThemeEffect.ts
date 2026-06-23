import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";

function applyTheme(theme: string) {
  const shouldBeDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", shouldBeDark);
}

// Apply synchronously on module load — prevents flash of wrong theme
applyTheme(useSettingsStore.getState().theme);

/**
 * Call once in a top-level component (App).
 * Uses a direct Zustand subscription so theme changes never trigger
 * React re-renders — the only DOM work is a single classList.toggle.
 */
export function useThemeEffect() {
  useEffect(() => {
    // Re-apply after hydration (persisted value may differ from default)
    applyTheme(useSettingsStore.getState().theme);

    // Subscribe to store — fires on ANY state change, but applyTheme
    // is just a classList.toggle (effectively free if class didn't change)
    const unsub = useSettingsStore.subscribe((state) => {
      applyTheme(state.theme);
    });

    // OS preference can change while "system" is active
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (useSettingsStore.getState().theme === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", onSystemChange);

    return () => {
      unsub();
      mq.removeEventListener("change", onSystemChange);
    };
  }, []);
}
