# ADR-0013 — Monetization model

**Status:** Proposed — awaiting founder
**Deferring past M7 is fine. Deferring past M9 blocks launch (`G-02`).**

## Context

This decision is product identity and it is externally constrained. Apple requires a
parental gate on purchasing in the Kids Category; Play's Families Policy restricts how
purchases are surfaced to children; and an explicit App ID is mandatory for in-app
purchase, which is why no wildcard provisioning profile can be used.

It also decides real engineering: whether the `iap` and `subscriptions` plugins are
wired at all, whether Corpán's never-block-an-offline-subscriber policy is adopted, and
whether M6's "optional challenge run" may ever sit adjacent to a purchase surface.

## Options

**A. Free, no monetization.** Simplest compliance posture; no IAP plugins; no
entitlement layer. No revenue.

**B. One-time purchase (paid up front, or a single unlock).** No subscription lifecycle,
no renewal edge cases, no offline-entitlement problem of any consequence. Weakest fit for
content that grows over years.

**C. Subscription.** Requires the full entitlement layer. If chosen, adopt Corpán's
policy verbatim: a durable Plus snapshot with optimistic merge seeding on launch, and
downgrade **only** on a definitive online `not_owned` past a 48-hour grace — never block
a real offline subscriber.

**D. School and district license.** A different sales motion, a different support
burden, and probably a different distribution channel (Apple School Manager / Play
managed distribution). Largely orthogonal to the client work but it changes what a
"profile" means.

**E. Hybrid** — a free tier plus one of B/C/D.

## Consequences that apply to any paid option

- Every purchase surface sits behind the `<ParentalGate>` shipped in M1 (`G-08`).
- Purchase surfaces must never be adjacent to a failure or a challenge outcome. The
  negative example is documented: reviewers logged 16 membership ads in a 19-minute
  Prodigy session, which drew an FTC complaint alleging manipulative upselling to
  children.
- No "purchased absolution" — paying may never undo a wrong answer, restore a lost
  thing, or skip work. That is in [MISSION.md](../MISSION.md) as a forbidden mechanic and
  it constrains the design space of any paid tier.
- IAP requires the explicit App ID and a non-wildcard provisioning profile, which is
  already how [STORE.md](../STORE.md) plans the signing identity.

## Note

If the answer is A (free), say so explicitly and record it — an unrecorded "free for
now" leaves the IAP plumbing question open at M10, which is exactly the launch-pressure
retrofit this program is trying to avoid everywhere else.
