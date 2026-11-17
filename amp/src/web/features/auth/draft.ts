import { create } from "zustand";

/** A sign-in's failure as it came back (app/third-party-returns.ts
 * `signInReturn`): its code, and the provider when one sent it. */
export type AuthArrival = { error: string; provider?: string };

/** The email typed on one sign-in screen, carried to the next (for example
 * from sign-up to sign-in when the address already has an account), and a
 * returned failure for the screen to show once. Memory only: never stored
 * or put in a URL. */
export const useAuthDraft = create<{
  email: string;
  notice: string;
  arrival: AuthArrival | null;
  setEmail: (email: string) => void;
  carry: (email: string, notice: string) => void;
  takeNotice: () => string;
  arrive: (arrival: AuthArrival) => void;
  takeArrival: () => AuthArrival | null;
}>((set, get) => ({
  email: "",
  notice: "",
  arrival: null,
  setEmail: (email) => set({ email }),
  carry: (email, notice) => set({ email, notice }),
  takeNotice: () => {
    const notice = get().notice;
    if (notice) set({ notice: "" });
    return notice;
  },
  arrive: (arrival) => set({ arrival }),
  takeArrival: () => {
    const arrival = get().arrival;
    if (arrival) set({ arrival: null });
    return arrival;
  },
}));
