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

The founder owns **`dynawalla.com`** (GitHub org `dynawalla`, repo
`dynawalla/dynawalla.com`, all five commits authored from his address in 2015, a dormant
lion's-mane nootropic page; domain expires 2027-07-15). Two things to fix before the name
carries a product for children:

1. **Live subdomain-takeover vector.** The A/MX/TXT records point at
   `dynawalla.com.herokudns.com`, which **no longer resolves**. Anyone who claims that
   Heroku hostname serves content on our domain.
2. **A public repo tying the name to supplement health claims** should be archived or
   scrubbed. It is one search away from a product aimed at seven-year-olds.

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
