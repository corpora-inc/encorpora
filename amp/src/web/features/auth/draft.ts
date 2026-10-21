import { create } from "zustand";
/** The email typed on one sign-in screen, carried to the next (for example
 * from sign-up to sign-in when the address already has an account). Memory
 * only: never stored or put in a URL. */
export const useAuthDraft = create<{
  email: string;
  notice: string;
  setEmail: (email: string) => void;
  carry: (email: string, notice: string) => void;
  takeNotice: () => string;
}>((set, get) => ({
  email: "",
  notice: "",
  setEmail: (email) => set({ email }),
  carry: (email, notice) => set({ email, notice }),
  takeNotice: () => {
    const notice = get().notice;
    if (notice) set({ notice: "" });
    return notice;
  },
}));
