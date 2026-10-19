import { create } from "zustand";
/** Unsubmitted child input exists only in this tab's memory, after consent.
 * `learnerId` remembers a learner already saved, so a retried enrollment
 * claim never creates a second learner. Editing the name forgets it. */
export const useDraft = create<{
  owner: string | null;
  name: string;
  learnerId: string | null;
  set: (owner: string, name: string) => void;
  saved: (owner: string, learnerId: string) => void;
  clear: () => void;
}>((set) => ({
  owner: null,
  name: "",
  learnerId: null,
  set: (owner, name) => set({ owner, name, learnerId: null }),
  saved: (owner, learnerId) =>
    set((state) => (state.owner === owner ? { learnerId } : {})),
  clear: () => set({ owner: null, name: "", learnerId: null }),
}));
export const clearOnboardingDraft = () => useDraft.getState().clear();
