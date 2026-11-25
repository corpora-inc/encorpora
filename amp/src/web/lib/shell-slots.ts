import { useEffect } from "react";
import { create } from "zustand";

/**
 * The one app frame's shared state (`app/AppShell.tsx`): whether its drawer
 * is open, and the places a screen may put its own controls without
 * owning the frame: the bar's tools slot (practice's topic and calculator),
 * the drawer's settings slot (practice adjustments) and the drawer's actions
 * slot (a raised hand while no session runs). Screens portal into these, so
 * their state stays theirs and the frame never remounts.
 */
type ShellSlots = {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  tools: HTMLElement | null;
  setTools: (element: HTMLElement | null) => void;
  drawerSettings: HTMLElement | null;
  setDrawerSettings: (element: HTMLElement | null) => void;
  /** Under the drawer's destinations: what the screen can do that is not a
   * place to go. Null while the drawer is closed. */
  drawerActions: HTMLElement | null;
  setDrawerActions: (element: HTMLElement | null) => void;
  /** The screen shows its own first-practice action (a day-0 hero), so the
   * bar's Practice steps back: one Practice per screen. */
  heroAction: boolean;
  setHeroAction: (hero: boolean) => void;
};

export const useShellSlots = create<ShellSlots>()((set) => ({
  drawerOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  tools: null,
  setTools: (tools) => set({ tools }),
  drawerSettings: null,
  setDrawerSettings: (drawerSettings) => set({ drawerSettings }),
  drawerActions: null,
  setDrawerActions: (drawerActions) => set({ drawerActions }),
  heroAction: false,
  setHeroAction: (heroAction) => set({ heroAction }),
}));

/** While `active`, the screen's own hero action stands in for the bar's
 * Practice, which holds its place hidden. */
export function useHeroAction(active: boolean) {
  useEffect(() => {
    if (!active) return;
    useShellSlots.getState().setHeroAction(true);
    return () => useShellSlots.getState().setHeroAction(false);
  }, [active]);
}

/** The bar's tools slot while the frame shows practice; otherwise null. */
export const useShellTools = () => useShellSlots((state) => state.tools);
/** The open drawer's settings slot; null while the drawer is closed. */
export const useShellDrawerSettings = () =>
  useShellSlots((state) => state.drawerSettings);
/** The open drawer's actions slot; null while the drawer is closed. */
export const useShellDrawerActions = () =>
  useShellSlots((state) => state.drawerActions);
export const closeShellDrawer = () =>
  useShellSlots.getState().setDrawerOpen(false);
