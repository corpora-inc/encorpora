# ADR-0024 — The day pass replaces the subscription

**Status:** Accepted — 2026-07-26. **Supersedes
[ADR-0013](ADR-0013-monetization-model.md)** (`Accepted (direction)`, 2026-07-25), which
recorded a generous-free-tier-plus-subscription model under explicit founder uncertainty.

**How strong is this mandate: strong, and stronger than ADR-0013's was.** ADR-0013 opened
with *"I'm not sure about monetization really"* and described the model as *"something
like Corpan (although that hasn't worked in the slightest)"*. This one is a positive,
specific, priced decision with a stated reason and a stated differentiator. It is not a
direction to be filled in later.

## The decision

> "In the free tier **every game is available**. But, at a **natural end of the first
> level or a natural transition (rather than a hard timer)**, they can't play again until
> tomorrow. This way kids can experience all of the games and find one that they really
> love, then on a natural transition we show them a 'pass' — simple, **no subscription, no
> ads**, just **day pass $0.99 or month $7.99 or lifetime $79.99**. This is a
> differentiator .. **like getting a pass to Six Flags or the arcade.**"

Six properties, and each of them is load-bearing:

1. **Every game is playable free.** Nothing is locked at the door, nothing is badged
   "premium", and discovery is unlimited. A child can open all of them on their first
   afternoon. `pass.test.ts` asserts that a cold device with nothing bought opens every
   installed game.
2. **The gate is a natural transition, never a clock.** A game says it reached a stopping
   point — level cleared, run completed, boss down. **There is no timer in the product and
   no timer UI anywhere**, which is also asserted mechanically: the sheet's module may not
   contain `setInterval`, `requestAnimationFrame`, `performance.now` or `setTimeout`.
3. **One gate per game per day.** FUSE ending does not end SIEGE. This is deliberate and
   it is the mechanism by which a child finds the one game they love: unlimited breadth,
   bounded repetition.
4. **The offer appears once, at that transition, and is easy to dismiss.** One obvious tap,
   plus Escape, from every stage.
5. **Lifetime ($79.99) is the headline.** Parents hate subscriptions; a one-time purchase
   is the differentiator, and it is listed first and framed largest.
6. **No dark patterns.** Enumerated below, and tested.

## Why this replaces the subscription rather than sitting beside it

ADR-0013 named a tension it could not resolve and deferred it:

> "*Unlimited exercises* implies the free tier has an exercise limit, and a daily exercise
> cap is a stopping mechanism imposed by billing rather than by the child."

[MISSION.md](../MISSION.md) forbids play-by-appointment and requires designed stopping
points. A cap that cuts a willing child off mid-flow was already ruled an unacceptable
shape. **The day pass dissolves the tension instead of arguing about it**: the free tier's
boundary is not a quantity at all, it is a *place in the game* that the game itself picked,
and the child arrives at it having just finished something. Nothing is interrupted, because
by construction there is nothing in progress.

It also fixes what ADR-0013 was most worried about — copying a model the founder judged to
have *"not worked in the slightest."* A day pass is not that model. It is not a
subscription, it prices a one-time purchase as the headline, and its free tier is bounded
by breadth-per-day rather than by content, which is the resolution shape ADR-0013's own
"tension nobody should discover at M9" section pointed at.

## The mechanism

**`session.transition`** — a new session method on the pack SDK, alongside
`session.settings`, `session.progress` and `session.end`.

```ts
host.transition("level" | "run" | "boss", label?)
```

Three properties of its design, each chosen against an alternative:

- **It is a session method, not a capability.** A pack cannot decline to declare it and
  thereby decline ever to reach a stopping point. Had it been gated, the day pass would be
  enforceable only by a clock — the thing this model exists to avoid.
- **It returns nothing.** The host answers `null` whatever it decides. A pack that could
  read the verdict could branch on whether the child has paid, and a game that plays
  differently for a paying child is exactly what this is not. If the host puts something
  over the frame, the pack learns it the ordinary way, through the `pause` event it
  already handles.
- **It may only follow something the child finished.** Never a defeat, never a failed run,
  never a wrong answer, never a timer. ADR-0013 already forbids a purchase surface next to
  a failure, and the negative example is on the record: reviewers logged 16 membership ads
  in a 19-minute Prodigy session, which drew an FTC complaint alleging manipulative
  upselling to children.

Where the five shipped games send it:

| Game | Stopping point | Why |
|---|---|---|
| FUSE (`merge`) | every level-up | The quota is met and the KEY changes. Literally "the natural end of the first level". |
| SIEGE (`siege`) | every fifth wave held — the boss waves | A single wave is thirty seconds and is not an ending. A boss held is several minutes and the child is already celebrating. **Never on defeat.** |
| FORGE (`forge`) | the quench | The prestige reset *is* the run, and the child chose it. |
| MONUMENT (`stack`) | a new stratum, climbing | Eight floors of tower and the rock changes. Only on the way up. |
| THE SPLIT (`slice`) | a market rush survived | The game has no levels and no ending; the settle after a rush is its only crest. |

A game may send as many as it naturally reaches. The host acts on the first per game per
day and ignores the rest, so no game has to ration them or know which one is special.

## Entitlement, and the one asymmetry

**A wrongly-open pass costs a dollar. A wrongly-closed pass tells a family that already
paid that they did not.** Everything resolves towards open. The policy is copied from
`corpan/corpan-app/src/store/entitlements.ts`, which was rebuilt to eliminate exactly this
failure:

- A **lifetime** pass is never re-examined. No expiry, no clock, no periodic revalidation.
- A **month** pass survives its recorded expiry by a **48-hour grace window**, because a
  renewal is a fact only the store knows and the store is not always reachable. Past the
  grace it closes — an indefinite grace is a free subscription.
- A **day** pass gets no grace, because none is needed: its expiry requires no round trip,
  and extending it would make it a three-day pass.
- **Only a definitive, online `not_owned` clears a pass.** A timeout, an offline device or
  a rejected bridge is `unavailable`, which is logged loudly and changes nothing.

**Entitlements stay local.** [STORE.md](../STORE.md) is explicit that a receipt-validation
backend is one of exactly two things that would break Apple "Data Not Collected" and Play
"nothing collected, nothing shared". There is no server, and this decision does not add one.

**The rest ledger is device-scoped, not per learner.** Per-learner would turn "add a
learner" into an extra play, which makes the profile switcher a hole in the model and
teaches a child to game it. It holds one day at a time and is discarded at local midnight,
so it does not accumulate and there is no history of a child's play to leak.

## The parental gate

Required by Kids Category rules in front of any purchase surface, and here it stands in
front of the **price display** as well — a child at a stopping point sees no money at all.

**The challenge is never arithmetic, and here that is not a preference.** Apple's canonical
gate is a multiplication problem. This is a mathematics app for grades 1–6: the audience is
being trained daily to defeat exactly that challenge, and a gate that teaches a child that
solving sums opens the money screen is worse than no gate. Two forms, randomized and
non-persistent:

- **the current four-digit year**, and
- **a thirteen-letter-or-longer, four-syllable, non-curricular word to transcribe.**

Reading and typing load is the asymmetry that actually exists between a six-year-old and an
adult. TELEVISION, UNIVERSITY, HELICOPTERS and WATERMELONS were in the first draft of the
word list and were cut: a nine-year-old types all four without hesitating.

## No dark patterns — the enumerated list

Banned outright, and `pass.test.ts` holds the copy and the source against it:

no countdown or timer of any kind · no "N plays left" · no fake scarcity · no "only today"
· no guilt copy · no social pressure ("your friends are playing") · no interstitial that
must be watched · no delay before the dismissal becomes usable · no pre-selected plan · no
struck-through price · no "best value" badge · no copy that frames stopping as a loss · no
padlock, dimming or "premium" badge on a game in the grid.

A game that already ended today shows the word **Tomorrow** where **Play** would be, in the
same small type as the version, with its name at full strength and its control working.
That is a fact about the child's day, not a price.

## Billing is a seam, not an implementation

`src/pass/billing.ts` declares three methods — `products`, `buy`, `restore` — and ships
`unwiredBilling`, which charges nobody and grants nothing, reporting `unavailable`. A stub
that pretended to succeed would write a fake receipt into durable storage on a child's
tablet, where the first real store query would have to argue with it.

StoreKit 2 and Play Billing land behind `setBilling()`. The product ids are fixed here and
are **immutable once submitted** — a renamed store SKU is a new product with no history and
no restores, in both stores:

| Pass | Product id | Fallback price |
|---|---|---|
| Day | `inc.corpora.dynawalla.pass.day` | $0.99 |
| Month | `inc.corpora.dynawalla.pass.month` | $7.99 |
| Lifetime | `inc.corpora.dynawalla.pass.lifetime` | $79.99 |

Prices in the table are a **US fallback for a device with no store to ask**. A shipping
build reads the localised price string from the store, because $7.99 is not what a family
in Delhi is charged.

## Consequences

- **`G-02` (packaging and pricing open past M9) is closed.** Both are decided.
- **The category election is now decidable.** [ADR-0001](ADR-0001-kids-category-posture.md)
  deferred it until the purchase surface existed. It exists.
- **IAP needs the explicit App ID and a non-wildcard provisioning profile**, which is
  already how [STORE.md](../STORE.md) plans the signing identity. A **month** product is a
  non-renewing or auto-renewing subscription in store terms even though the product is not
  marketed as one; day and lifetime are non-consumables. That distinction is a store
  configuration detail, not a change to anything above.
- **"No purchased absolution" still holds.** A pass buys more play. It never undoes a wrong
  answer, restores a lost thing, or skips work.
- **R-45** (the monetization model has no evidence behind it) is not closed by this ADR. It
  is a better-argued hypothesis with a real differentiator, and it still has to meet
  parents.
