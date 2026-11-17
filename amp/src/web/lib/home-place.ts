import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Each account's home on this device: the final address of the place it last
 * opened (a family's Today, a school, its own practice, /start before it has
 * one). One typed store, keyed by account, so two people sharing a browser
 * each go home to their own. Written only when a place is opened (sign-in,
 * the place switcher, the launcher, setup's handoff), never by an effect;
 * read by every "home" link (nav/root.tsx), which goes straight there.
 */
type HomePlace = {
  homes: Record<string, string>;
  setHome: (accountId: string, href: string) => void;
};

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.warn("Your home place couldn’t be read on this device", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn("Your home place wasn’t saved on this device", error);
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn("Your home place wasn’t cleared", error);
    }
  },
}));

/** An address a home may be: a path inside the app, never `/` itself. */
const usable = (href: string) => /^\/(?![/\\])\S+$/.test(href);

export const useHomePlace = create<HomePlace>()(
  persist(
    (set) => ({
      homes: {},
      setHome: (accountId, href) => {
        if (!accountId || !usable(href)) return;
        set((state) =>
          state.homes[accountId] === href
            ? state
            : { homes: { ...state.homes, [accountId]: href } },
        );
      },
    }),
    { name: "amp.home", storage, version: 1 },
  ),
);

/** Records where an account's home is: an event handler's call. */
export const setHome = (accountId: string, href: string) =>
  useHomePlace.getState().setHome(accountId, href);
