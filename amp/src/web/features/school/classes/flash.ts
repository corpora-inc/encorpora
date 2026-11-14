import { create } from "zustand";

/** A confirmation carried to the next screen (an import lands on Students
 * with "8 students added"). Shown once, as a toast, then gone. */
export const useFlash = create<{
  message: string;
  show: (message: string) => void;
  clear: () => void;
}>((set) => ({
  message: "",
  show: (message) => set({ message }),
  clear: () => set({ message: "" }),
}));
