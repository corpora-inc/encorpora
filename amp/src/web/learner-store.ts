import type { FamilySummary } from "../family/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** The learner currently using the app: one value for every screen, kept on
 * this device across reloads. A convenience only — the server still decides
 * which learners an account may access. */
type LearnerState = {
  learnerId: string | null;
  family: FamilySummary | null;
  identity: string | null;
  revision: number;
  setIdentity: (identity: string | null) => void;
  acceptFamily: (family: FamilySummary | null) => void;
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
    (set, get) => ({
      family: null,
      identity: null,
      revision: 0,
      setIdentity: (identity) => {
        if (get().identity !== identity)
          set({ identity, family: null, revision: get().revision + 1 });
      },
      acceptFamily: (family) => set({ family, revision: get().revision + 1 }),
      learnerId: null,
      select: (learnerId) => set({ learnerId }),
    }),
    {
      name: "amp.learner",
      storage,
      version: 1,
      partialize: (state) => ({ learnerId: state.learnerId }),
    },
  ),
);
