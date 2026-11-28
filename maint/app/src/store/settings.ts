import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStorage } from "@appkit/storage.ts";

export type Theme = "system" | "light" | "dark";

interface Settings {
  theme: Theme;
  /** The level jobs start at; null: the pack's first (most guidance). */
  level: string | null;
  /** The unit everything is filtered to, until another is opened. */
  activeUnit: string | null;
  /** On-device model as an interface only; off by default and never required. */
  model: boolean;
  /**
   * The hub sign-in on this screen (development tokens; a deployment signs in
   * through its gateway instead). The one place the app keeps who reviews.
   */
  hubToken: string | null;
  setHubToken(t: string | null): void;
  setTheme(t: Theme): void;
  setLevel(l: string): void;
  setActiveUnit(id: string | null): void;
  setModel(on: boolean): void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: "system",
      level: null,
      activeUnit: null,
      model: false,
      hubToken: null,
      setHubToken: (hubToken) => set({ hubToken }),
      setTheme: (theme) => set({ theme }),
      setLevel: (level) => set({ level }),
      setActiveUnit: (activeUnit) => set({ activeUnit }),
      setModel: (model) => set({ model }),
    }),
    { name: "maint.settings", storage: jsonStorage, version: 2, migrate: (p) => p as Settings },
  ),
);

export function applyTheme(theme: Theme): void {
  const el = document.documentElement;
  if (theme === "system") delete el.dataset.theme;
  else el.dataset.theme = theme;
}
