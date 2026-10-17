import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** The learner currently using the app: one value for every screen, kept on
 * this device across reloads. A convenience only — the server still decides
 * which learners an account may access. */
type LearnerState = {
  learnerId: string | null;
  select: (learnerId: string | null) => void;
};

// Storage can be unavailable (private windows, blocked site data); the app
// then works for the session without remembering the choice.
const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn("Learner choice not saved", error);
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn("Learner choice not cleared", error);
    }
  },
}));

export const useLearnerStore = create<LearnerState>()(
  persist(
    (set) => ({
      learnerId: null,
      select: (learnerId) => set({ learnerId }),
    }),
    { name: "amp.learner", storage, version: 1 },
  ),
);
