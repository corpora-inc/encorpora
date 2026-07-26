# ADR-0015 — Developer-account topology

**Status:** Proposed — awaiting founder
**Needed before:** the ASC and Play app records are created in M1

## Context

Dynawalla can ship under the same Apple developer team and Google Play developer account
as Corpán, or under separate accounts.

Same-account is **assumed throughout the current plan**, and it is why only two
credentials are genuinely new: the provisioning profile (profiles bind to one explicit
bundle id, no wildcard spans both `com.corpora.*` and `inc.corpora.*`, and wildcards
cannot carry IAP) and the Android upload keystore (deliberately separate so one
compromised key does not risk two shipping apps). The Apple Distribution certificate and
the Play service account are reused.

## Options

**A. Same accounts as Corpán.** Reuses the distribution certificate and the Play service
account. Requires an explicit per-app permission grant for the service account on the new
Play app record — it does **not** inherit (`G-09`). Consequences: the two apps compete
for the same App Store Featured and Play Teacher Approved nominations, share a
policy-violation blast radius (an enforcement action against one account affects both),
and share the account's DSA trader status.

**B. Separate accounts.** Isolates the policy blast radius and the nomination pools.
Costs a second Apple Developer Program enrolment and a second Play developer account,
new certificates, new service-account plumbing, a second set of store secrets and
environments, and duplicated tax/banking/trader setup.

## Consequences

- **Reversing after the app record exists means a new record and orphaning any installed
  base.** This is effectively a one-way door once M1 submits.
- Under **A**, everything in [STORE.md](../STORE.md) as written holds. Under **B**, the
  reusable release workflow needs a second credential set per platform and the
  environment list doubles.
- Under either option, a **new AWS secret `dynawalla/store/credentials`** is created
  rather than widening the existing Corpán secret, which a live purchase-verify lambda
  reads.
- Under either option, no credential value ever enters this repository (`G-11`).
