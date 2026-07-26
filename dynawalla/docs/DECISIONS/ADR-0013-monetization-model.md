# ADR-0013 — Monetization model

**Status:** Accepted (direction) — 2026-07-25. **Implementation deferred**; the packaging
and pricing decision is not made and blocks launch if it is still open past M9 (`G-02`).

## Context

This decision is product identity and it is externally constrained. Apple requires a
parental gate on purchasing in the Kids Category; Play's Families Policy restricts how
purchases are surfaced to children; and an explicit App ID is mandatory for in-app
purchase, which is why no wildcard provisioning profile can be used.

It also decides real engineering: whether the `iap` and `subscriptions` plugins are
wired at all, whether Corpán's never-block-an-offline-subscriber policy is adopted, and
whether M6's "optional challenge run" may ever sit adjacent to a purchase surface.

## Decision — direction

The founder's answer:

> "I'm not sure about monetization really. I think ultimately we try something like
> Corpan (although that hasn't worked in the slightest) .. you get a generous free tier
> and it's fun and cool. But if you want unlimited exercises and unlimited access to
> everything then you pay a subscription price. But, our run rate is low because we
> design so basically everything runs offline with no big server overhead."

Recorded as the direction (option **E**, a free tier plus **C**):

1. **A generous free tier**, and a **subscription** that unlocks unlimited exercises and
   full access.
2. **Offline-first architecture keeps marginal cost per user near zero.** There is no
   server profile, no telemetry endpoint, no model hosting and no content CDN in V1
   ([ADR-0003](ADR-0003-no-downloadable-packs-v1.md),
   [ADR-0012](ADR-0012-ota-curriculum-deferral.md)). The free tier can therefore be
   genuinely generous rather than a nag: nobody on it is costing anything to serve, so
   there is no cost argument for making it unpleasant.
3. **Adopt Corpán's never-block-an-offline-subscriber policy.** The implementation to
   copy is real and lives at `corpan/corpan-app/src/store/entitlements.ts` (durable
   `lastKnownSubscription` + `lastVerifiedAt`, persisted, re-seeded into the live
   `subscription` on launch through the store's `merge`) with the grace window in
   `corpan/corpan-app/src/contentPacks/purchase.ts` (`SUBSCRIPTION_GRACE_MS = 48 * 60 *
   60 * 1000`). Downgrade happens **only** on a definitive online `not_owned` past that
   grace; offline or inconclusive keeps the entitlement. The stated priority is to prefer
   letting a stale entitlement persist over ever blocking a real paying user who is
   offline.
4. **Nothing about packaging or price is decided.** What "generous" means in exercises,
   content or features, what the subscription costs, whether there is a trial, and
   whether a family plan exists are all open.

## The open risk this direction carries

The founder's own assessment of the model being copied is that it **"hasn't worked in the
slightest."** That is recorded here rather than smoothed over, because copying a model
wholesale copies the result.

"Generous free tier plus subscription" is a **direction, not a validated design**. It has
no evidence behind it in this company beyond one product where it underperformed, and
adopting it by default means the second product inherits the first product's unexamined
pricing and packaging assumptions along with its architecture. Pricing and packaging need
their own evidence pass before launch — at minimum: what specifically is behind the
paywall, why a parent would pay for it, and what the free tier's ceiling is in terms a
parent can understand before they hit it. [RISKS.md](../RISKS.md) R-45 carries this.

This ADR being `Accepted (direction)` explicitly does **not** close that question.

## Consequences that apply to any paid option

- Every purchase surface sits behind the `<ParentalGate>` shipped in M1 (`G-08`), and the
  category interaction is [ADR-0001](ADR-0001-kids-category-posture.md): Play's Families
  Policy and Apple's Kids Category both constrain how a purchase may be surfaced to a
  child, which is why the category election is deferred until the purchase surface
  exists.
- Purchase surfaces must never be adjacent to a failure or a challenge outcome. The
  negative example is documented: reviewers logged 16 membership ads in a 19-minute
  Prodigy session, which drew an FTC complaint alleging manipulative upselling to
  children.
- No "purchased absolution" — paying may never undo a wrong answer, restore a lost
  thing, or skip work. That is in [MISSION.md](../MISSION.md) as a forbidden mechanic and
  it constrains the design space of any paid tier.
- IAP requires the explicit App ID and a non-wildcard provisioning profile, which is
  already how [STORE.md](../STORE.md) plans the signing identity.

## The tension nobody should discover at M9

**"Unlimited exercises" implies the free tier has an exercise limit, and a daily exercise
cap is a stopping mechanism imposed by billing rather than by the child.**
[MISSION.md](../MISSION.md) forbids play-by-appointment and grinding gates, and requires
designed stopping points with equal-weight "Done" and "Keep going" (`P-10`). A free-tier
cap that ends a child's session mid-flow is close enough to play-by-appointment to be
worth naming now rather than arguing about under launch pressure.

The resolution space — cap **breadth** (skills, chambers, curriculum range) rather than
**session length**; or gate the parent report, additional chambers and advanced content;
or make the free tier time-unlimited and content-bounded — is deferred with the rest of
packaging. What is decided is that a free-tier limit which cuts a willing child off
mid-session is not an acceptable shape, because the product's stated ethics already
forbid it.
