# ADR-0015 — Developer-account topology

**Status:** Accepted — 2026-07-25
**Needed before:** the ASC and Play app records are created in M1 (met)

## Context

Dynawalla can ship under the same Apple developer team and Google Play developer account
as Corpán, or under separate accounts.

Same-account is **assumed throughout the current plan**, and it is why only two
credentials are genuinely new: the provisioning profile (profiles bind to one explicit
bundle id, no wildcard spans both `com.corpora.*` and `inc.corpora.*`, and wildcards
cannot carry IAP) and the Android upload keystore (deliberately separate so one
compromised key does not risk two shipping apps). The Apple Distribution certificate and
the Play service account are reused.

## Decision

The founder's answer:

> "Yeah, this is a Corpora project so it can just be the same as Corpan I think."

**Dynawalla ships under the same Corpora Inc Apple developer team and the same Google
Play developer account as Corpán.** Option A. Everything in [STORE.md](../STORE.md) as
written holds.

## The reuse matrix, verified 2026-07-25

Store reconnaissance returned. Everything below was checked with live GET-only API calls;
nothing here is inferred from the plan.

**Reused — no new artifact needed:**

- The **Apple Distribution certificate** (`Apple Distribution: Corpora Inc`, expires
  2027-04-16, team-wide).
- The **ASC API key** — see the correction in [STORE.md](../STORE.md): it does *not* need
  re-minting.
- The **Apple Team ID** `F9AV5HKF6N`.
- The **Play service-account identity** — the identity only, not its access.
- The existing **parameterized tooling**, `corpan/infra/asc/asc_monetization.py` and
  `corpan/infra/play/play_monetization.py`, both already keyed off a bundle-id /
  package-name variable.

**New and mandatory:**

- The **iOS provisioning profile.** Profiles bind to one explicit bundle id; no wildcard
  spans both `com.corpora.*` and `inc.corpora.*`, **and wildcards cannot carry IAP**.
- The **Android upload keystore**, deliberately separate so one compromised key does not
  risk two shipping apps.
- **Play App Signing enrolment.**
- A **new AWS secret path.** Do **not** widen `corpan/content-packs/verify` — a live
  purchase-verify lambda reads it.
- An **explicit per-app Play permission grant** for the service account (`G-09`).

**Proven, not assumed:** the Play service account returns **403** on
`com.corpora.homeschool` and `com.pako.app`. Two sibling apps on the same account are
already invisible to it today. Per-app grants demonstrably do not inherit, so `G-09` is a
real step and not a formality.

## Consequences, accepted as trade-offs

These were the reasons to consider separate accounts. They are now accepted costs, not
open questions.

- **Shared policy-violation blast radius.** An enforcement action against the account —
  a Play policy strike, an Apple account-level suspension — affects **both apps**. Corpán
  is a shipping product with paying subscribers; a Dynawalla compliance mistake can reach
  it. This is the largest cost of the decision and the one most likely to be regretted at
  the exact moment it lands.
- **The two apps compete for the same nominations.** App Store Featured placement and
  Play Teacher Approved are allocated per developer account, so Dynawalla and Corpán are
  in the same pool rather than in two.
- **Shared DSA trader status** and the account's tax, banking and trader declarations.
  One set of facts covers both apps, which is a simplification until one app needs a
  different answer.
- **Reversing after the app record exists means a new record and orphaning any installed
  base.** This is effectively a one-way door once M1 submits, so the acceptance above is
  the real decision, not a provisional one.

## Operational consequences that still apply

- The Play service account requires an **explicit per-app permission grant** on the new
  Dynawalla app record — it does **not** inherit (`G-09`). This is a founder console
  action, not an API call.
- A **new AWS secret `dynawalla/store/credentials`** is created rather than widening the
  existing Corpán secret, which a live purchase-verify lambda reads. Sharing an account
  is not a reason to share a secret.
- No credential value ever enters this repository (`G-11`).
