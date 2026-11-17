import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthSession } from "../../auth";
import { qk } from "../../lib/keys";
import { queryClient } from "../../lib/query-client";
import { useSessionOrNull } from "../../lib/session";

/**
 * Where practicing as a profile returns (docs/design/ia.md, "Places and
 * modes"): the place the mode was started from ("Back to Grade 5 Math"),
 * one per account on this device. Practicing as a profile is the account's
 * current learner being one of its profiles (learner-store.ts); this is the
 * mode's one other fact, never a query string (amp/AGENTS.md, "URLs name
 * screens, not state"). Written when the mode starts (practice-mode.ts
 * `practiceAs`), cleared when it ends.
 */
type ModeReturns = { returns: Record<string, string> };

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch (error) {
      console.warn("Where practice returns isn't restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      console.warn("Where practice returns isn't kept", error);
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch (error) {
      console.warn("Where practice returns isn't cleared", error);
    }
  },
}));

/** A school student's session keeps nothing on a shared device. */
const kept = (accountId: string) => !accountId.startsWith("school:");

export const useModeReturns = create<ModeReturns>()(
  persist(() => ({ returns: {} }), {
    name: "amp.mode-return",
    storage,
    version: 1,
    partialize: (state) => ({
      returns: Object.fromEntries(
        Object.entries(state.returns).filter(([account]) => kept(account)),
      ),
    }),
  }),
);

/** The signed-in account, from the session's one owner (the Query cache). */
const activeAccount = () =>
  queryClient.getQueryData<AuthSession | null>(qk.session())?.accountId ?? null;

/** Records where the mode returns (null: nowhere but the adult's own). */
export function setModeReturn(
  from: string | null,
  accountId: string | null = activeAccount(),
) {
  if (!accountId) return;
  useModeReturns.setState((state) => {
    const returns = { ...state.returns };
    if (from) returns[accountId] = from;
    else delete returns[accountId];
    return { returns };
  });
}

/** Where the account's mode returns, outside React. */
export function modeReturn(
  accountId: string | null = activeAccount(),
): string | null {
  return accountId
    ? (useModeReturns.getState().returns[accountId] ?? null)
    : null;
}

/** Where the signed-in account's mode returns. */
export function useModeReturn(): string | null {
  const accountId = useSessionOrNull()?.accountId ?? null;
  return useModeReturns((state) =>
    accountId ? (state.returns[accountId] ?? null) : null,
  );
}
