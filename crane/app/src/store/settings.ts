import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "../i18n/index.ts";
import { jsonStorage } from "../lib/storage.ts";

export type Theme = "system" | "light" | "dark";

interface Settings {
  equipment: string | null;
  theme: Theme;
  lang: Lang;
  /** On-device assistant: off by default. */
  assistant: boolean;
  setEquipment(id: string | null): void;
  setTheme(theme: Theme): void;
  setAssistant(on: boolean): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      equipment: null,
      theme: "system",
      lang: "en",
      assistant: false,
      setEquipment: (equipment) => set({ equipment }),
      setTheme: (theme) => set({ theme }),
      setAssistant: (assistant) => set({ assistant }),
    }),
    {
      name: "crane.settings",
      storage: jsonStorage,
      version: 2,
      // v1 kept a role (trainee/operator/inspector); the app now has one level and no role setting.
      migrate: (persisted) => {
        const { role: _role, ...rest } = (persisted ?? {}) as Record<string, unknown>;
        return rest as unknown as Settings;
      },
    },
  ),
);

export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === "system") delete el.dataset.theme;
  else el.dataset.theme = theme;
}
