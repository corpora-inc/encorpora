import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthSession } from "./auth";
import { qk } from "./lib/keys";
import { queryClient } from "./lib/query-client";
import { useSessionOrNull } from "./lib/session";

/**
 * The current learner: one canonical value per account on this device
 * (amp/AGENTS.md, "Canonical global state"). A screen whose address names a
 * learner (`/practice/<learner>`, `/family/<family>/kids/<learner>`) is that
 * learner's; its route loader writes the name here once the navigation is
 * real (never for a preload). Screens that name nobody read this choice.
 * The only other writers are a person's own choices (the place switcher, a
 * family row, starting a place).
 *
 * Keyed by account, so another account on this device never sees this
 * one's learner: each account reads only its own entry. A convenience
 * only: the server still decides which learners an account may access.
 *
 * Read it with `useCurrentLearner()` in a component, `currentLearner()`
 * outside React; write it with `selectLearner()`.
 */
type LearnerState = {
  /** Each account's current learner on this device, by account id. */
  learners: Record<string, string>;
  select: (accountId: string, learnerId: string | null) => void;
};

// Storage can be unavailable (private windows, blocked site data); the app
// then works for the session without remembering the choice.
const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.warn("Learner choice not read", error);
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

/** A school student's session ends with them on a shared device: their
 * choice (their one learner, named by their address anyway) lives in memory
 * only, never in this device's storage. */
const kept = (accountId: string) => !accountId.startsWith("school:");

export const useLearnerStore = create<LearnerState>()(
  persist(
    (set) => ({
      learners: {},
      select: (accountId, learnerId) =>
        set((state) => {
          if (!accountId) return state;
          if ((state.learners[accountId] ?? null) === learnerId) return state;
          const learners = { ...state.learners };
          if (learnerId) learners[accountId] = learnerId;
          else delete learners[accountId];
          return { learners };
        }),
    }),
    {
      name: "amp.learner",
      storage,
      version: 2,
      partialize: (state) => ({
        learners: Object.fromEntries(
          Object.entries(state.learners).filter(([account]) => kept(account)),
        ),
      }),
      // Version 1 held one id for whichever account chose it. Nobody can
      // say whose it was, so it is dropped: every account starts from its
      // own default, never another account's learner.
      migrate: (saved, version) =>
        (version >= 2 && saved && typeof saved === "object"
          ? saved
          : { learners: {} }) as LearnerState,
    },
  ),
);

/** The signed-in account, from the session's one owner (the Query cache). */
const activeAccount = () =>
  queryClient.getQueryData<AuthSession | null>(qk.session())?.accountId ?? null;

/** An account's current learner (the signed-in one's by default). */
export function currentLearner(
  accountId: string | null = activeAccount(),
): string | null {
  return accountId
    ? (useLearnerStore.getState().learners[accountId] ?? null)
    : null;
}

/** Makes a learner the account's current one (the signed-in account's by
 * default); null puts the choice down. */
export function selectLearner(
  learnerId: string | null,
  accountId: string | null = activeAccount(),
) {
  if (accountId) useLearnerStore.getState().select(accountId, learnerId);
}

/** The signed-in account's current learner on this device, or null. */
export function useCurrentLearner(): string | null {
  const accountId = useSessionOrNull()?.accountId ?? null;
  return useLearnerStore((state) =>
    accountId ? (state.learners[accountId] ?? null) : null,
  );
}
