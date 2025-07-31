import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Settings } from "../components/react-reader/settings/SettingsComponent";

interface SettingsState {
  settings: Settings;
  setSettings: (partial: Partial<Settings>) => void;
}

// Default settings values
const initialSettings: Settings = {
  fontSize: 100,
  fontFamily: "sans-serif",
  fontWeight: "400",
  lineHeight: 1.5,
  textAlign: "justify",
  spread: "auto",
  theme: "light",
};

// Persistent settings store using zustand
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      setSettings: (partial: Partial<Settings>) => {
        const newSettings = { ...get().settings, ...partial };
        set({ settings: newSettings });
      },
    }),
    {
      name: "reader-settings",
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);