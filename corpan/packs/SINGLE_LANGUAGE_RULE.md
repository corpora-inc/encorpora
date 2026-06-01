# Packs must work with a SINGLE-language stack

**Rule (app-wide, 0.16.0+):** a user's language stack may contain exactly ONE
language. No pack may require a second / "target" language. There is no longer
any "add a target language" gate.

**Why:** real users have one-language needs —
- immersion ("I just want to practice my Spanish, don't show me English"),
- a Balinese speaker whose best listed language is Indonesian and who only
  wants Indonesian,
- a young child learning to read/speak their own native language.

## The language model

`hostApi.getStackConfig().languages`:
- `languages[0]` = the user's **primary / native** language (also the UI language).
- `languages[1..]` = optional **target** languages being studied.
- A single-language stack is just `languages === [primary]`.

When `languages.length === 1`, treat that one language as the **content /
practice language**. There is no native gloss — design the experience to be
useful and delightful on its own (reading, listening, pronunciation,
recognition, sentence-building in that one language).

## Canonical pattern (from pronunciation-coach)

Any "pick target vs native" helper should short-circuit for one language:

```ts
if (languages.length <= 1) {
  const only = languages[0]
  const target = only
    ? entry.translations.find(t => t.language_code === only) ?? null
    : null
  return { target, native: null }   // practice the one language, no gloss
}
// …existing multi-language logic…
```

And any `languages.length < 2` gate becomes `< 1` (i.e. only bail when there
is literally no language).

## Per-pack status (0.16.0)

- **pronunciation-coach (Parlometron)** — gate removed; solo + multiplayer
  practise `languages[0]` directly. ✅
- **phrase (MainExperience / "Phrase Flip")** — renders whatever languages are
  in the stack; one language = immersion. ✅ (inherent)
- **juice-squeeze** — one language = rebuild the sentence in that language
  (literacy / word order). ✅
- **quest-ear** — speaks `languages[0]`; no gate. ✅
- **earthgate-reader / stargate-reader** — read a book in one language;
  no gate. ✅ (inherent)
- **world-radio** — stations by language; no gate. ✅ (inherent)
- **hanzipan** — Mandarin only by nature. ✅ (inherent)
- **hover-runner** — was degenerate (it's a translation-match game; matching a
  phrase to itself isn't a game). Redesigned to a single-language
  listening/recognition mode. See pack CHANGELOG.

New packs MUST honor this rule.
