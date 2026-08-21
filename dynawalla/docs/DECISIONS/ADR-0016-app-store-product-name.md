# ADR-0016 — App Store product name

**Status:** Accepted — founder, 2026-07-27
**Decided:** the product name is **Dynawalla**. Bundle id `inc.corpora.dynawalla`.

> "name is Dynawalla. inc.corpora.dynawalla" — founder, 2026-07-27

The working name "Dynawalla: Apprentice of Numbers" is **dropped**. The name is the
bare word, matching the bundle id and the domain the founder already owns.

**This was ratified after the App Store Connect record already existed**, so it records
reality rather than authorising it. The App Store SKU is immutable and is now set; the
subtitle, not the name, is where any descriptive phrase belongs from here.

The two counsel-grade collision vectors below (**Dynamo Maths**; **Physics Wallah**'s
"family of 'wallah' marks") are **not** resolved by this decision and are not resolved by
the record existing. They remain open items for counsel, and the paid clearance search is
still advisable. So are the two hygiene items — the dangling DNS records on the owned
domain, and the public repo tying the name to dietary-supplement health claims.

## Context

Before an app record existed, two checks were cheap and afterwards they are very
expensive:

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

## The decision that was required, and how it resolved

Confirm the product name, or supply a different one, before M1 creates the app records.
**Resolved 2026-07-27: Dynawalla.**

**Founder's expectation, 2026-07-25:**

> "I doubt anyone has Dynawalla but you should be able to check."

So the working name stands unless a check says otherwise, and the founder has explicitly
asked for the check rather than asserting the name is clear.

## What the checks found — 2026-07-25

The founder's expectation holds up. The ADR stays **Proposed** anyway, because two of the
findings are counsel questions and one is a hygiene problem that should be fixed before
the name carries a children's product.

**Identifier availability**

- `inc.corpora.dynawalla`: **0 matches** across Apple bundle ids; **404** on Play.
- **Honest limit:** both queries are **account-scoped**. Neither store exposes a *global*
  availability check, so a third party could be holding the identifier and we would only
  discover it at registration.
- **App Store product-name availability cannot be tested read-only** on either store. It
  is checked at reservation time, which is the moment it stops being cheap.

**Third-party use of "Dynawalla": none found anywhere**

0 apps via iTunes Search; no companies; npm 404; PyPI 404; every major TLD free; no
`DYNAWALLA` trademark. The live `DYNAWALL` registration 7020156 is Class 6 construction
materials — no goods overlap.

**We already own the name, and it has baggage**

The founder owns the matching domain (registered 2015, dormant, expires 2027-07-15). Two
things to fix before the name carries a product for children:

1. **Dangling DNS records on a domain we own need clearing.** Details are deliberately
   **not committed to this public repository** — publishing an unremediated hosting
   misconfiguration is publishing the exploit. The founder has the specifics out of band;
   this line exists so the work is tracked, not so it is reproducible. Remove this note
   once the records are cleared.
2. **A public repo tying the name to dietary-supplement health claims** should be archived
   or scrubbed. It is one search away from a product aimed at seven-year-olds.

**Two collision vectors for a founder-and-counsel call**

- **Dynamo Maths** (`dynamomaths.co.uk`) — a live UK children's mathematics intervention,
  ages 6–11, dyscalculia focus. Shared `Dyna-` prefix, same customers, same subject.
  **This is the one an attorney circles.**
- **Physics Wallah** won an ex-parte Delhi High Court injunction asserting rights over a
  *"family of trademarks using the suffix 'wallah'"*. Relevant **only if India is a launch
  market** — and worth knowing before, not after, that decision.

**Caveat, stated plainly:** USPTO, Justia, TMview and WIPO all bot-blocked the search.
This is **strong negative evidence gathered from a mirror, not a first-party clearance
search.** A paid clearance search before filing remains advisable, and this ADR should
not be read as clearing the name.

## Consequences

- The bundle id does not have to match the display name and will not be changed by this
  decision. `inc.corpora.dynawalla` stands regardless.
- If the name changes after launch, the bundle id, package name and SKU stay as they
  are, which leaves a permanent mismatch between the identifier and the product — livable
  but confusing forever.
- A five-minute check now, or a rename negotiation with two stores later.
