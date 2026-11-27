import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Lang } from "../i18n/index.ts";
import type { Role } from "../engine/types.ts";
import { jsonStorage } from "../lib/storage.ts";

export type Theme = "system" | "light" | "dark";

interface Settings {
  /** null until the first-run question is answered. */
  role: Role | null;
  equipment: string | null;
  theme: Theme;
  lang: Lang;
  /** On-device assistant: off by default. */
  assistant: boolean;
  setRole(role: Role): void;
  setEquipment(id: string | null): void;
  setTheme(theme: Theme): void;
  setAssistant(on: boolean): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      role: null,
      equipment: null,
      theme: "system",
      lang: "en",
      assistant: false,
      setRole: (role) => set({ role }),
      setEquipment: (equipment) => set({ equipment }),
      setTheme: (theme) => set({ theme }),
      setAssistant: (assistant) => set({ assistant }),
    }),
    { name: "crane.settings", storage: jsonStorage, version: 1 },
  ),
);

export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === "system") delete el.dataset.theme;
  else el.dataset.theme = theme;
}
