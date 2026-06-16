// Monetization — shared "paywall moment" primitive for every Corpán pack.
//
// Packs gate at natural interaction boundaries via createPaywallGate; the host
// reads entitlement from injected globals and listens for `corpan:request-unlock`.
// See ./README.md for the pack-author wiring contract.

export { createPaywallGate } from "./src/paywallGate"
export { createDailyQuota } from "./src/dailyQuota"
export type { DailyQuotaOptions } from "./src/dailyQuota"
export { QUOTAS, getQuota } from "./src/quotas"
export type { QuotaConfig, QuotaSurface } from "./src/quotas"

export type {
  EntitlementSnapshot,
  Hardness,
  GateMode,
  GateConfig,
  PaywallGate,
  PaywallRequestDetail,
  DailyLockedDetail,
  StorageLike,
  RegisteredGate,
  GateRegistry,
} from "./src/types"
