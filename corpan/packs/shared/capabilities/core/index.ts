// Capability-module core — the Journey activity ABI, one import away.
//
// `@shared/capabilities/core` is how capability modules and their consumers
// get the contract types + itemRefKey/parseItemRef/ACTIVITY_TYPES without
// hand-copying anything: ./src/activityContract.ts is a GENERATED copy of the
// authoritative corpan-app/src/contentPacks/activityContract.ts, refreshed by
// `node packs/sdk/sync-contract.mjs` (CI drift-checked with --check).
// See docs/journey/specs/capability-modules.md §1.

export * from "./src/activity"
