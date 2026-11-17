import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DesignTheme, DesignWidth } from "./search";

/** The gallery's width and theme: this viewer's own, kept on this device.
 * An older `/design?width=…&theme=…` link still opens at them. */
type DesignView = { width?: DesignWidth; theme?: DesignTheme };

export const useDesignView = create<
  DesignView & { set: (change: DesignView) => void }
>()(
  persist((set) => ({ set: (change) => set(change) }), {
    name: "amp.design-view",
    storage: createJSONStorage(() => ({
      getItem: (name) => {
        try {
          return localStorage.getItem(name);
        } catch (error) {
          console.warn("The gallery's width and theme weren't restored", error);
          return null;
        }
      },
      setItem: (name, value) => {
        try {
          localStorage.setItem(name, value);
        } catch (error) {
          console.warn("The gallery's width and theme weren't kept", error);
        }
      },
      removeItem: (name) => {
        try {
          localStorage.removeItem(name);
        } catch (error) {
          console.warn("The gallery's width and theme weren't cleared", error);
        }
      },
    })),
    partialize: ({ width, theme }) => ({ width, theme }),
  }),
);
