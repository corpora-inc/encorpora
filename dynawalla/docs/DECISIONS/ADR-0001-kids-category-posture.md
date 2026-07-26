# ADR-0001 — Apple Kids Category and Play under-13 target audience

**Status:** Accepted — 2026-07-25, for the engineering constraints and the deferral
mechanism. **The category election itself is Deferred to submission** (`G-01`), and the
**age-band choice inside it is an open founder decision** — see "The age bands do not span
the product's scope" below, which couples this ADR to
[ADR-0002](ADR-0002-v1-scope-cut.md).

**Amended 2026-07-25:** the parental-gate reasoning in the first revision was inverted and
is corrected below; the store-reconnaissance placeholders are filled with verified data.

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

#### The gate must not be arithmetic — corrected 2026-07-25

An earlier revision of this ADR claimed that "for a mathematics app an arithmetic
challenge *is* the canonical parental gate, so it costs us almost nothing." **That is
backwards and it is recorded here so it is not re-derived.**

Apple's canonical illustrated parental gate *is* a maths problem — which is exactly why a
mathematics app cannot use one. A grade-4 child solves `6 × 7` faster than their parent
does. Being a maths app makes an arithmetic gate **useless**, not free: the app spends
every session training the precise skill the gate uses as its filter, and it succeeds at
it. There is no "set the arithmetic above the curriculum band" fix either, because the
band moves upward as the child improves and the gate would have to outrun its own users.

**The real barrier for a six-year-old is reading load, not arithmetic.** So:

- **Non-curricular challenge.** Viable shapes: type the current four-digit year; type a
  spelled-out multi-syllable word shown on screen; press-and-hold-and-drag for N seconds.
- **Randomized.** A fixed challenge is memorised within a week — by a child who is, by
  design, good at noticing patterns.
- **Non-persistent across sessions.** Passing once does not unlock the app's gates for
  later launches.
- **Voiceover prompt paired with it if the 5-and-under band is ever elected**, where even
  the reading-load barrier is doing something different than intended.

#### Where a gate is required

Link-outs; **the privacy-policy link if it is implemented as an external URL** — render
it as an in-app screen instead and the requirement disappears; any purchase, paywall or
price display; Restore Purchases; the parent dashboard; and anything that emails or
shares a child's work.

**Treat permission prompts (microphone, push) as requiring a gate too.** This appears in
Apple's 2019 Kids Category announcement but not in the current Guideline 1.3 text, which
makes it reviewer-discretion territory. It is cheap to just do.

**Play imposes no general parental-gate mandate.** Build **one** component and use it on
both platforms; do not fork the behaviour per store.

With the gate shipped and no third-party SDKs present, **the Kids Category remains
electable at submission time with zero rework** — and so does plain Education with a 4+
rating. The decision is reversible by construction because the expensive half is built
either way.

### The age bands do not span the product's scope

This is new information and it **couples this ADR to
[ADR-0002](ADR-0002-v1-scope-cut.md)**. It was not previously recorded in either.

| Store | Bands | Selection |
|---|---|---|
| Apple Kids Category | 5-and-under · 6-8 · **9-11** | **Exactly one** |
| Play target audience | 5-and-under · 6-8 · **9-12** · 13-15 · 16-17 · 18+ | Multi-select |

The founder-stated scope — grades 1–6 plus intro pre-algebra — spans roughly **ages
6–12**. **Apple has no band above 9-11.** Play's 9-12 covers the range; Apple's does not.

ADR-0002's proposed cut to grades 1–5 lands **exactly inside Apple's 9-11 ceiling**.
Grade 6 plus pre-algebra pushes past it. So the scope decision and the category decision
are the same decision viewed from two sides, and neither ADR could see that until now.

Options, **not decided**:

- **(a) Declare 9-11 and accept the top-end skew.** The listing then reads as a 9–11
  product while the curriculum starts at grade 1, which is a discovery and expectation
  cost at the young end.
- **(b) Two SKUs**, split by band. Doubles the store surface, the review exposure, the
  release pipeline and the support burden, for one product.
- **(c) Skip the Kids Category.** **This is a trap, not an escape.** Guideline 2.3.8
  reserves "For Kids" / "For Children" metadata *to* the Kids Category, and 5.1.4(b)
  forbids child-implying metadata *outside* it. For a grade-school mathematics app that
  is close to unworkable — the honest description of the product is the metadata the
  guideline forbids.

This is a founder decision and it is **not yet made**.

### Final election is deferred to submission

Specifically, **until monetization is wired**. Play's Families Policy and Apple's Kids
Category both constrain how purchases may be surfaced to children, and
[ADR-0013](ADR-0013-monetization-model.md) now sets a direction (free tier plus a
subscription) whose purchase surface does not exist yet. Electing a category before that
surface is in hand means deciding the interaction twice.

### Default if nothing changes

**Match Corpán's existing App Store category and age rating.** The founder's "whatever
Corpan is is fine" is the recorded default. Store reconnaissance returned 2026-07-25 and
that default is now a specific posture rather than a placeholder:

| | Corpán, verified live |
|---|---|
| Bundle id / SKU | `com.corpora.corpan` |
| Categories | **EDUCATION** (primary) / **REFERENCE** (secondary) |
| Age rating | **4+**, all content declarations `NONE` |
| `kidsAgeBand` | `null` |
| `isOrEverWasMadeForKids` | **`false`** |
| Apple Team ID | `F9AV5HKF6N` |

**All four Corpora apps** — Corpán, Homeschool Offline, Yìjīng, PaKO A1 — are 4+, in
Education or Lifestyle, and **none has ever been in the Kids Category**. So "match
Corpán" means Education / 4+ / no Kids Category, and there is **no in-house precedent to
inherit** for a Kids Category submission: it would be the first, and every process step
would be new.

### The one-way door is a readable API field

`isOrEverWasMadeForKids` on `/v1/apps/{id}` is the **API-visible, permanent expression of
Apple's "even if you decide to deselect the category" rule**. It is not a setting that
gets toggled back; it records that the app was *ever* made for kids, and it is queryable.

That is the concrete irreversibility this ADR keeps warning about, and it means the
election is verifiable after the fact rather than a matter of recollection. Corpán's is
`false` today. Dynawalla's first submission decides its value forever.

## Consequences, including the ones that cost something

- **A parental gate in front of every link-out is friction for adults too**, and it is
  paid on every link forever. It is also a real component with real cost — a randomized,
  non-persistent, non-curricular challenge is not something the app already has lying
  around. The earlier "it is nearly free because we are a maths app" framing was wrong in
  both directions: the gate is neither free nor allowed to be arithmetic.
- **Routing the privacy policy through an in-app screen rather than an external URL
  removes one gate entirely**, and is the cheapest single decision in this whole area.
- **Electing in locks the constraint set forever**, through any future pivot, including
  one where an analytics SDK or an ad-supported tier would have been the obvious answer.
  Nothing in the plan currently depends on that relaxation, but a future product might.
- **Electing out is only rational with an explicit statement of what would then be
  permitted.** Taking the Education/4+ route while keeping every Kids Category constraint
  voluntarily is all of the cost and none of the discovery — strictly worse than electing
  in. Note that it does **not** buy freedom in the listing: 2.3.8 and 5.1.4(b) still
  forbid child-implying metadata outside the category, so "skip it and describe the
  product honestly" is not an available combination. If the election goes that way,
  record what actually relaxes.
- **Deferring has a cost of its own:** store listing copy, the age-band selection and any
  Teacher Approved positioning are written against an undecided posture, so some listing
  work may be done twice.
- **The band question outlives the election.** Even electing in leaves the 9-11 ceiling
  versus a grades 1–6 scope unresolved, which is why it is written up above as a founder
  decision in its own right rather than as a listing detail.
- Either way, the declarations must be consistent with actual behaviour and with the CI
  dependency audit (`G-07`).

## Notes for whoever closes this

Do not let the election be decided implicitly by a store submission. Submitting M1's
build without a recorded election **is** choosing, and it is the branch that cannot be
undone. `G-01` is met when the election is written into this ADR before the first
submission — not when someone clicks a category picker.
