import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/*
 * Which disclosure an account overlay opens on (the IA v2 spec, §0): inside
 * the Privacy and Billing overlays the panels are disclosures, one open at a
 * time, never addresses. A legacy address (`/account/privacy/consent`,
 * `/account/billing/records`, `/consent`) writes the panel here on its one
 * hop, as features/pay/store.ts does for pay, and the overlay opens on it.
 * The overlay keeps it current as the reader opens and closes panels, so a
 * refresh shows the same one. Keyed by account; kept for this tab
 * (sessionStorage), and nothing here is sent anywhere.
 */

export const PRIVACY_PANELS = [
  "consent",
  "export",
  "delete",
  "retention",
  "measurement",
  "documents",
] as const;
export type PrivacyPanelId = (typeof PRIVACY_PANELS)[number];
export type BillingPanelId = "receipts";

export type AccountPanels = {
  privacy: PrivacyPanelId | null;
  billing: BillingPanelId | null;
};

const NONE: AccountPanels = { privacy: null, billing: null };

type PanelsState = {
  accounts: Record<string, AccountPanels>;
  setPanel: <K extends keyof AccountPanels>(
    account: string,
    overlay: K,
    panel: AccountPanels[K],
  ) => void;
};

const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch (error) {
      console.warn("The open account panel wasn't restored", error);
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch (error) {
      console.warn("The open account panel wasn't kept for this tab", error);
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch (error) {
      console.warn("The open account panel wasn't cleared", error);
    }
  },
}));

export const usePanelsStore = create<PanelsState>()(
  persist(
    (set) => ({
      accounts: {},
      setPanel: (account, overlay, panel) =>
        set((state) => ({
          accounts: {
            ...state.accounts,
            [account]: {
              ...(state.accounts[account] ?? NONE),
              [overlay]: panel,
            },
          },
        })),
    }),
    {
      name: "amp.account-panels.v1",
      storage,
      version: 1,
      partialize: (state) => ({ accounts: state.accounts }),
    },
  ),
);

/** A privacy panel id from a legacy address's last part, or null. */
export function privacyPanel(value: unknown): PrivacyPanelId | null {
  return typeof value === "string" &&
    (PRIVACY_PANELS as readonly string[]).includes(value)
    ? (value as PrivacyPanelId)
    : null;
}

/** Outside React (a legacy hop): open `overlay` on `panel` next time. */
export function setPanel<K extends keyof AccountPanels>(
  account: string,
  overlay: K,
  panel: AccountPanels[K],
) {
  usePanelsStore.getState().setPanel(account, overlay, panel);
}

/** The panel an account's overlay has open, and the way to change it. */
export function usePanel<K extends keyof AccountPanels>(
  account: string,
  overlay: K,
) {
  const panel = usePanelsStore(
    (state) => (state.accounts[account] ?? NONE)[overlay],
  );
  const set = usePanelsStore((state) => state.setPanel);
  return [
    panel,
    (next: AccountPanels[K]) => set(account, overlay, next),
  ] as const;
}
