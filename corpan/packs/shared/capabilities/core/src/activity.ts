// The wire types are NOT re-declared here. This file re-exports the one
// authoritative contract (R2/R3): corpan-app/src/contentPacks/activityContract.ts,
// vendored into shared/capabilities/core via the same sync-contract.mjs
// mechanism as the SDK copies (activity-contract.md §5). Capability consumers
// import `@shared/capabilities/core` and never hand-copy types.

export type {
  ItemRef,
  ItemRefKind,
  ModelNeed,
  ActivitySpec,
  ActivityResult,
  ActivityItemResult,
  ActivityOutcome,
  ActivityDetail,
  ActivityForm,
  ActivityTypeMeta,
  Strand,
  AbandonReason,
  JourneyHostApi,
  ActivityResultEventDetail,
  PackActivityDeclaration,
} from "./activityContract" // synced copy
export { itemRefKey, parseItemRef, ACTIVITY_TYPES } from "./activityContract"
