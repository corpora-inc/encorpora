// Capability-module core — the Journey activity ABI, one import away.
//
// `@shared/capabilities/core` is how capability modules and their consumers
// get the contract types + itemRefKey/parseItemRef/ACTIVITY_TYPES without
// hand-copying anything: ./src/activityContract.ts is a GENERATED copy of the
// authoritative corpan-app/src/contentPacks/activityContract.ts, refreshed by
// `node packs/sdk/sync-contract.mjs` (CI drift-checked with --check).
// See docs/journey/specs/capability-modules.md §1.
//
// Alongside the synced contract this package carries the capability-module
// contract itself (CapabilityHandle/CapabilityModule, §2), the
// CapabilityHostApi slice + the fleet's one copy of the STT types (§2.1),
// and the result plumbing every module shares (§2.3).
//
// The mock host is dev/test only — import it from
// `@shared/capabilities/core/mock`, never from here.

export * from "./src/activity"
export * from "./src/capability"
export * from "./src/hostSlice"
export * from "./src/result"
