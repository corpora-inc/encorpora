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
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware"

export type ThemeMode = "system" | "light" | "dark"
export type Theme = "light" | "dark"

export const DARK_CLASS = "dw-dark"

const STORAGE_KEY = "dynawalla.theme"

/** Pure: what the mode plus the platform preference actually resolve to. */
export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): Theme {
  if (mode === "system") return systemPrefersDark ? "dark" : "light"
  return mode
}

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

// Web storage is absent under `node --test` and can be disabled in a WebView.
// Neither is a reason to throw at a child: the preference degrades to
// process lifetime rather than taking the store down with it.
const ephemeral = new Map<string, string>()
const memoryStorage: StateStorage = {
  getItem: (name) => ephemeral.get(name) ?? null,
  setItem: (name, value) => void ephemeral.set(name, value),
  removeItem: (name) => void ephemeral.delete(name),
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof localStorage === "undefined" ? memoryStorage : localStorage,
      ),
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
