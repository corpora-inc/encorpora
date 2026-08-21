# ADR-0018 — Multi-child profiles designed in from M2

**Status:** Accepted

## Context

A household product is used by more than one child on one tablet. Retrofitting a profile
dimension onto persisted state means migrating every key, every store, every engine
snapshot and every construction save — after real children have data in them.

## Decision

**All storage is namespaced by `profileId` from M2**, in the same PR that first persists
anything (PR-2.12). The profile *switcher UI* is surfaced at M9; the *data model* is
correct from the first write.

Storage is two-tier: `localStorage` for settings that must be read synchronously at
module load, IndexedDB for the event ring. Both namespaced.

## Consequences

- `Q-12` is testable: three children on one device have fully independent progress,
  verified by a test that cross-reads namespaces **and** by a named person on a real
  device. A test alone would not catch a shared key that only collides at runtime.
- Per-learner state is bounded by construction — sufficient-statistic-shaped skill,
  bug and fact records plus a fixed-size event ring — so N profiles cost N × a bounded
  amount, not N × unbounded growth (`A-15`).
- Dynawalla writes its own small storage adapter and does **not** adopt Corpán's
  storage layer. With a bundled curriculum, no audio assets, no models and bounded state,
  the quota-exhaustion class of failure that justifies Corpán's ~8.6k lines does not
  exist here. If that ever stops being true, revisit — but write the ADR first.
- The parent view (M9) reads across profiles. It is local only: no server account, no
  uploaded profile, no cross-device sync in V1.
