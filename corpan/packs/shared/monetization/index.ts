// Monetization — shared "paywall moment" primitive for every Corpán pack.
//
// Packs gate at natural interaction boundaries via createPaywallGate; the host
// reads entitlement from injected globals and listens for `corpan:request-unlock`.
// See ./README.md for the pack-author wiring contract.

export { createPaywallGate } from "./src/paywallGate"

export type {
  EntitlementSnapshot,
  Hardness,
  GateMode,
  GateConfig,
  PaywallGate,
  PaywallRequestDetail,
  DailyLockedDetail,
  StorageLike,
} from "./src/types"
