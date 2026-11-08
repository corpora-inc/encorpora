import { create } from "zustand";

/**
 * The one app frame's shared state (`app/AppShell.tsx`): whether its drawer
 * is open, and the two places a screen may put its own controls without
 * owning the frame: the bar's tools slot (practice's topic and calculator)
 * and the drawer's settings slot (practice adjustments). Screens portal into
 * these, so their state stays theirs and the frame never remounts.
 */
type ShellSlots = {
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  tools: HTMLElement | null;
  setTools: (element: HTMLElement | null) => void;
  drawerSettings: HTMLElement | null;
  setDrawerSettings: (element: HTMLElement | null) => void;
};

export const useShellSlots = create<ShellSlots>()((set) => ({
  drawerOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  tools: null,
  setTools: (tools) => set({ tools }),
  drawerSettings: null,
  setDrawerSettings: (drawerSettings) => set({ drawerSettings }),
}));

/** The bar's tools slot while the frame shows practice; otherwise null. */
export const useShellTools = () => useShellSlots((state) => state.tools);
/** The open drawer's settings slot; null while the drawer is closed. */
export const useShellDrawerSettings = () =>
  useShellSlots((state) => state.drawerSettings);
export const closeShellDrawer = () =>
  useShellSlots.getState().setDrawerOpen(false);
