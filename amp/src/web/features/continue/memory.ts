import { payState, usePayStore } from "../pay/store";
/* "Continue with AMP" for one learner leaves for Stripe and comes back. The
   pay store (features/pay/store.ts) remembers, for this tab, who it was for
   and the screen it was opened from, so the flow's confirmation puts the
   person back where they were, with the learner's access active, and then
   offers to add a name. These are its older names, kept for their callers.
   Nothing here is sent anywhere. */

export type Continuation = {
  accountId: string;
  learnerId: string;
  /** The app path the pause was on. */
  returnTo: string;
  /** `paying` until access is active; then `naming` until it is offered. */
  stage: "paying" | "naming";
  savedAt: number;
};

export function rememberContinuation(
  value: Omit<Continuation, "savedAt" | "stage"> & {
    stage?: Continuation["stage"];
  },
) {
  usePayStore.getState().open(value.accountId, value);
}

export function readContinuation(accountId: string): Continuation | null {
  const opener = payState(accountId).opener;
  return opener ? { accountId, ...opener } : null;
}

/** Access is active: what remains is the optional name. */
export function continuationPaid(accountId: string) {
  const current = readContinuation(accountId);
  if (current) usePayStore.getState().paid(accountId);
  return current;
}

export function forgetContinuation(accountId: string) {
  usePayStore.getState().forgetOpener(accountId);
}
