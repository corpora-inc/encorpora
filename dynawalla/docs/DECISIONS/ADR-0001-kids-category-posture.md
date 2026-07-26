# ADR-0001 — Apple Kids Category and Play under-13 target audience

**Status:** Accepted — 2026-07-25, for the engineering constraints and the deferral
mechanism. **The category election itself is Deferred to submission** (`G-01`).

## Context

Apple Guideline 1.3 states that an app placed in the Kids Category must "continue to
meet these guidelines in subsequent updates, **even if you decide to deselect the
category**." It is a one-way door. Google Play's target-audience declaration carries the
Families Policy with it.

The founder's position:

> "I like Apple kids category. I think it's worth it to stay clean. We are privacy
> focused anyways and we don't want third party garbage and such anyways. I'm not sure
> about link outs and stuff ... maybe 3+/4+ without the kids category is enough. Whatever
> Corpan is is fine .. we don't have a parental consent for external links (github, our
> website ...) ... no third party ads/analytics etc .. links though 🤷‍♂️"

That splits cleanly into a settled part and an open part, and this ADR records them
separately so the settled part stops being re-litigated.

## Decision

### Locked now, unconditionally, independent of any category election

- **No third-party advertising SDK.**
- **No third-party analytics SDK.** All instrumentation is on-device; there is no
  telemetry endpoint and no server profile.
- **No third-party SDK of the kind the Kids Category forbids**, and every dependency
  addition is a compliance decision rather than a build decision.
- **No AAID / IMEI / MAC / phone number transmitted, no precise location collected.**

These are the founder's stated preference regardless of category, so they are product
invariants and not V1 choices. `G-05` and `G-06` enforce them mechanically via the CI
dependency audit, cross-checked against the submitted Play Data safety declaration.
Nothing downstream needs to wait for the election to build against them.

### The open variable is external links

Apple's Kids Category requires a parental gate before a link out of the app and before a
purchase. Corpán today links out to GitHub and the website with no gate. That is the only
part of the strict posture Dynawalla does not already satisfy by construction, and it is
the part the founder flagged.

### Decision: build the gate, defer the election

**Build a parental-gate primitive in M1's shell and route every external link and every
purchase entry point through it** (`G-08`, [ADR-0005](ADR-0005-shell-and-routing.md)).

The observation that makes this cheap: **for a mathematics app, an arithmetic challenge
is the canonical Apple-acceptable parental gate.** The gate is literally the product.
Other apps pay a real UX tax and a real implementation cost for a mechanism unrelated to
anything else they do; here it is a rendering of a component the app already has, in a
visual language it already speaks.

With the gate shipped and no third-party SDKs present, **the Kids Category remains
electable at submission time with zero rework** — and so does plain Education with a 4+
rating. The decision is reversible by construction because the expensive half is built
either way.

### Final election is deferred to submission

Specifically, **until monetization is wired**. Play's Families Policy and Apple's Kids
Category both constrain how purchases may be surfaced to children, and
[ADR-0013](ADR-0013-monetization-model.md) now sets a direction (free tier plus a
subscription) whose purchase surface does not exist yet. Electing a category before that
surface is in hand means deciding the interaction twice.

### Default if nothing changes

**Match Corpán's existing App Store category and age rating.** The founder's "whatever
Corpan is is fine" is the recorded default.

`TODO(store-recon)` — a store reconnaissance is in flight to confirm what Corpán is
actually categorised and rated as today, on both stores. The specific category and rating
values are deliberately **not written here**, because guessing them and then treating the
guess as a decision is exactly how a one-way door gets walked through by accident.

## Consequences, including the ones that cost something

- **A parental gate in front of every link-out is friction for adults too.** A parent who
  wants the privacy policy or the GitHub repo solves an arithmetic problem first. That is
  the tax, it is small, and it is paid on every link forever.
- **The gate's arithmetic has to be beyond the app's own target range**, or the children
  being taught grades 1–5 arithmetic will walk straight through the thing that exists to
  exclude them. This is a genuine and slightly absurd tension unique to this product: our
  users are being trained on the exact skill the gate uses as its filter. The gate must
  therefore sit above the V1 band and be re-checked whenever the curriculum's ceiling
  moves.
- **Electing in locks the constraint set forever**, through any future pivot, including
  one where an analytics SDK or an ad-supported tier would have been the obvious answer.
  Nothing in the plan currently depends on that relaxation, but a future product might.
- **Electing out is only rational with an explicit statement of what would then be
  permitted.** Taking the Education/4+ route while keeping every Kids Category constraint
  voluntarily is all of the cost and none of the discovery — strictly worse than electing
  in. If the election goes that way, record what relaxes.
- **Deferring has a cost of its own:** store listing copy, the age-band selection (Kids
  Category requires 5-and-under / 6-8 / 9-11) and any Teacher Approved positioning are
  written against an undecided posture, so some listing work may be done twice.
- Either way, the declarations must be consistent with actual behaviour and with the CI
  dependency audit (`G-07`).

## Notes for whoever closes this

Do not let the election be decided implicitly by a store submission. Submitting M1's
build without a recorded election **is** choosing, and it is the branch that cannot be
undone. `G-01` is met when the election is written into this ADR before the first
submission — not when someone clicks a category picker.
