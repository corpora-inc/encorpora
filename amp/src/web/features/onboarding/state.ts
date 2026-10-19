import { create } from "zustand";
/** Unsubmitted child input exists only in this tab's memory, after consent.
 * `learnerId` remembers a learner already saved, so a retried enrollment
 * claim never creates a second learner. Editing the name forgets it. */
export const useDraft = create<{
  owner: string | null;
  name: string;
  learnerId: string | null;
  /** Birth year stored with `learnerId`. */
  year: number | null;
  set: (owner: string, name: string) => void;
  saved: (owner: string, learnerId: string, year: number) => void;
  clear: () => void;
}>((set) => ({
  owner: null,
  name: "",
  learnerId: null,
  year: null,
  set: (owner, name) => set({ owner, name, learnerId: null, year: null }),
  saved: (owner, learnerId, year) =>
    set((state) => (state.owner === owner ? { learnerId, year } : {})),
  clear: () => set({ owner: null, name: "", learnerId: null, year: null }),
}));
export const clearOnboardingDraft = () => useDraft.getState().clear();
