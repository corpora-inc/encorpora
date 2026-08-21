// Theme.
//
// ADR-0005: applied synchronously at module load via a store subscription that
// toggles one class on <html>. Not an effect — an effect runs after the first
// paint, which is the flash of the wrong theme, and it makes the theme depend
// on component mount order. Importing this module is what applies the theme,
// so `main.tsx` imports it before it renders anything.
//
// The stored preference is device scoped on purpose, not namespaced by
// profileId (ADR-0018): which materials the screen is cut from is a property
// of the tablet in the room, not of the child holding it.

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { durable } from "./persist.ts"
import { deviceKey } from "./profile.ts"

export type ThemeMode = "system" | "light" | "dark"
export type Theme = "light" | "dark"

/** The modes, in the order they are offered. Also the whitelist for a stored
    value: anything else came from a newer build and resolves to no theme. */
export const THEME_MODES: readonly ThemeMode[] = ["system", "light", "dark"]

export const DARK_CLASS = "dw-dark"

const STORAGE_KEY = deviceKey("theme")

/** Pure: what the mode plus the platform preference actually resolve to. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): Theme {
  if (mode === "system") return systemPrefersDark ? "dark" : "light"
  return mode
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: STORAGE_KEY,
      storage: durable,
      // A stored mode from a newer build is not a mode this build can resolve,
      // and `resolveTheme` would return it verbatim as a class name that
      // matches no rule — a screen painted in neither theme.
      merge: (persisted, current) => {
        const stored = (persisted as Partial<ThemeState> | undefined)?.mode
        return { ...current, mode: THEME_MODES.find((mode) => mode === stored) ?? "system" }
      },
    },
  ),
)

/** Toggle exactly one class. Anything else is a second source of truth. */
function paint(theme: Theme, root: Element): void {
  root.classList.toggle(DARK_CLASS, theme === "dark")
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  const root = document.documentElement

  const apply = () => paint(resolveTheme(useThemeStore.getState().mode, media.matches), root)

  apply()
  useThemeStore.subscribe(apply)
  media.addEventListener("change", apply)
}
