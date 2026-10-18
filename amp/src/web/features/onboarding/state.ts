import { create } from "zustand";
/** Unsubmitted child input exists only in this tab's memory, after consent. */
export const useDraft = create<{
  owner: string | null;
  name: string;
  set: (owner: string, name: string) => void;
  clear: () => void;
}>((set) => ({
  owner: null,
  name: "",
  set: (owner, name) => set({ owner, name }),
  clear: () => set({ owner: null, name: "" }),
}));
export const clearOnboardingDraft = () => useDraft.getState().clear();
