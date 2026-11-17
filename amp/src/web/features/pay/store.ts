import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { appReturn } from "../spaces/returns";

/*
 * The pay flow's client state, one owner (docs/architecture/web-app.md):
 * the screen and the learner live in the path (`/pay/<learner>`); what the
 * parent has chosen there (the method tab, the plan, the program) lives
 * here, keyed by account and learner. Switching is state, never a new URL
 * or history entry, and a refresh shows the same choices.
 * It is kept for this tab (sessionStorage): a refresh restores it, another
 * tab starts fresh. Nothing here is sent anywhere, and no billing name is
 * stored (docs/funded-campaign.md: names never go to browser storage).
 */

export type PayInterval = "year" | "month";
export type CheckoutKind = "learner" | "enrollment";

export type PayMethod = "card" | "esa";

export type EsaStep = "program" | "plan" | "name";

/** What one learner's flow has chosen. */
export type LearnerChoice = {
  /** The tab: card, or education funds. */
  method?: PayMethod;
  /** The education-funds step shown (its stepper). */
  esaStep?: EsaStep;
  interval?: PayInterval;
  /** The education-funds program (`programId`, e.g. `az-esa`). */
  program?: string;
};

/** Where the flow was opened from, and how far the purchase got: the
 * screen it returns to, and whether access is active (`naming`: the
 * optional name is all that remains, AfterPurchase). */
export type Opener = {
  learnerId: string;
  returnTo: string;
  stage: "paying" | "naming";
  savedAt: number;
};

/** A Stripe Checkout this tab opened: the one fact its return needs that
 * Stripe's return address can't carry (an enrollment checkout names no
 * learner; docs/stripe.md). */
export type OpenCheckout = {
  learnerId: string;
  kind: CheckoutKind;
  /** The overlay it was opened from (address.ts), where the return lands. */
  base: string;
  savedAt: number;
};

/** Stripe's return, read once from its address and kept here. */
export type CheckoutReturn = {
  learnerId: string;
  kind: CheckoutKind;
  checkoutId: string;
  savedAt: number;
};

type AccountPay = {
  learners: Record<string, LearnerChoice>;
  opener?: Opener;
  checkout?: OpenCheckout;
  returned?: CheckoutReturn;
};

type PayState = {
  accounts: Record<string, AccountPay>;
  choose: (account: string, learner: string, choice: LearnerChoice) => void;
  open: (account: string, opener: Omit<Opener, "savedAt" | "stage"> & {
    stage?: Opener["stage"];
  }) => void;
  paid: (account: string) => void;
  forgetOpener: (account: string) => void;
  checkoutOpened: (account: string, checkout: Omit<OpenCheckout, "savedAt">) => void;
  checkoutReturned: (account: string, value: Omit<CheckoutReturn, "savedAt">) => void;
};

/** Long enough for a slow checkout; short enough that an old one is gone. */
export const PAY_MEMORY_MS = 3 * 60 * 60 * 1000;

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("The pay flow's choices weren't kept for this tab", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("The pay flow's choices weren't cleared", error);
    }
  },
}));

const update = (
  state: PayState,
  account: string,
  change: (current: AccountPay) => Partial<AccountPay>,
) => {
  const current = state.accounts[account] ?? { learners: {} };
  return {
    accounts: { ...state.accounts, [account]: { ...current, ...change(current) } },
  };
};

export const usePayStore = create<PayState>()(
  persist(
    (set) => ({
      accounts: {},
      choose: (account, learner, choice) =>
        set((state) =>
          update(state, account, (current) => ({
            learners: {
              ...current.learners,
              [learner]: { ...current.learners[learner], ...choice },
            },
          })),
        ),
      open: (account, opener) =>
        set((state) =>
          update(state, account, () => ({
            opener: {
              learnerId: opener.learnerId,
              returnTo: appReturn(opener.returnTo) ?? "/",
              stage: opener.stage ?? "paying",
              savedAt: Date.now(),
            },
          })),
        ),
      paid: (account) =>
        set((state) =>
          update(state, account, (current) =>
            current.opener ? { opener: { ...current.opener, stage: "naming" } } : {},
          ),
        ),
      forgetOpener: (account) =>
        set((state) => update(state, account, () => ({ opener: undefined }))),
      checkoutOpened: (account, checkout) =>
        set((state) =>
          update(state, account, () => ({
            checkout: { ...checkout, savedAt: Date.now() },
          })),
        ),
      checkoutReturned: (account, value) =>
        set((state) =>
          update(state, account, () => ({
            returned: { ...value, savedAt: Date.now() },
          })),
        ),
    }),
    {
      name: "amp.pay.v1",
      storage,
      version: 1,
      partialize: (state) => ({ accounts: state.accounts }),
    },
  ),
);

const fresh = <T extends { savedAt: number }>(value: T | undefined) =>
  value && Date.now() - value.savedAt <= PAY_MEMORY_MS ? value : undefined;

/** One account's state, outside React (route guards, the Stripe return). */
export function payState(account: string): AccountPay {
  const value = usePayStore.getState().accounts[account] ?? { learners: {} };
  return {
    learners: value.learners,
    opener: fresh(value.opener),
    checkout: fresh(value.checkout),
    returned: fresh(value.returned),
  };
}

/** A learner's choices so far. */
export function useLearnerChoice(account: string, learner: string) {
  return usePayStore(
    (state) => state.accounts[account]?.learners[learner] ?? EMPTY,
  );
}
const EMPTY: LearnerChoice = {};

/** Where this learner's flow returns: the screen it was opened from. */
export function useOpener(account: string, learner: string) {
  const opener = usePayStore((state) => state.accounts[account]?.opener);
  const live = fresh(opener);
  return live?.learnerId === learner ? live : undefined;
}

/** The return this tab read from Stripe for this learner, if any. */
export function useCheckoutReturn(account: string, learner: string) {
  const value = fresh(usePayStore((state) => state.accounts[account]?.returned));
  return value?.learnerId === learner ? value : undefined;
}

/**
 * The billing name typed so far. In memory only: a refresh starts again
 * from the learner's name, and a name never reaches browser storage.
 */
export const useInvoiceDraft = create<{
  names: Record<string, string>;
  setName: (key: string, name: string) => void;
  clear: (key: string) => void;
}>((set) => ({
  names: {},
  setName: (key, name) =>
    set((state) => ({ names: { ...state.names, [key]: name } })),
  clear: (key) =>
    set((state) => {
      const { [key]: _gone, ...rest } = state.names;
      return { names: rest };
    }),
}));
export const draftKey = (account: string, learner: string) =>
  `${account}:${learner}`;
