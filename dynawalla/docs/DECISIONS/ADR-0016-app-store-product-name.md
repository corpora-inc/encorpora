# ADR-0016 — App Store product name

**Status:** Proposed — awaiting founder
**Needed before:** the ASC app record is created in M1

## Context

The working name is **"Dynawalla: Apprentice of Numbers"**. Before an app record exists,
two checks are cheap and afterwards they are very expensive:

1. A trademark search on the name.
2. An availability check on both stores — App Store names are unique per territory, and
   the Play listing title competes in the same search space.

Some of the identifiers involved are literally immutable:

- The Play **package name** is locked by the first uploaded AAB and cannot be changed
  without Google support (`X-03`).
- The App Store **SKU** is immutable.
- The **bundle id** `inc.corpora.dynawalla` is locked by founder decision #6 and, once
  submitted, by the store.

The store *display name* can be changed later, but not cheaply: it carries the SEO and
the word-of-mouth.

## Decision required

Confirm the product name, or supply a different one, before M1 creates the app records.

## Consequences

- The bundle id does not have to match the display name and will not be changed by this
  decision. `inc.corpora.dynawalla` stands regardless.
- If the name changes after launch, the bundle id, package name and SKU stay as they
  are, which leaves a permanent mismatch between the identifier and the product — livable
  but confusing forever.
- A five-minute check now, or a rename negotiation with two stores later.
