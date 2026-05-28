import { create } from "zustand"

/**
 * Corpán Plus paywall sheet state. Opened by:
 *   - the `corpan:request-unlock` window event (reader hit end of free preview,
 *     Library "Unlock with Plus", etc.)
 *   - the onboarding Plus pitch
 * The sheet itself reuses <SubscriptionOffer /> for the actual purchase flow.
 */
export type PaywallSurface =
  | "reader_eof_free"
  | "library_unlock"
  | "onboarding_pitch"
  | "other"

export type PaywallContext = {
  surface: PaywallSurface
  /** Book title to name in the subhead, if the trigger knows it. */
  bookTitle?: string
  bookId?: string
  language?: string
}

type PaywallState = {
  open: boolean
  context: PaywallContext | null
  openPaywall: (context: PaywallContext) => void
  closePaywall: () => void
}

export const usePaywallStore = create<PaywallState>((set) => ({
  open: false,
  context: null,
  openPaywall: (context) => set({ open: true, context }),
  closePaywall: () => set({ open: false, context: null }),
}))
