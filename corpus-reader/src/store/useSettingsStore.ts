import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../components/react-reader/settings/SettingsComponent";

interface SettingsState {
  settings: Settings;
  setSettings: (partial: Partial<Settings>) => void;
  resetSettings: () => void;
}

// Function to detect mobile devices
const isMobileDevice = (): boolean => {
  if (typeof window === "undefined") return false;

  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 1024
  );
};

// Default settings values with mobile-specific defaults
const getInitialSettings = (): Settings => ({
  fontSize: 100,
  fontFamily: "sans-serif",
  fontWeight: "400",
  lineHeight: 1.5,
  textAlign: isMobileDevice() ? "left" : "justify",
  spread: isMobileDevice() ? "none" : "auto",
  theme: "light",
});

const initialSettings: Settings = getInitialSettings();

// Persistent settings store using zustand
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      setSettings: (partial: Partial<Settings>) => {
        const newSettings = { ...get().settings, ...partial };
        set({ settings: newSettings });
      },
      resetSettings: () => {
        set({ settings: getInitialSettings() });
      },
    }),
    {
      name: "reader-settings",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
