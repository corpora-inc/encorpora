# ADR-0006 — Typed-TS curriculum authoring with exact rational arithmetic

**Status:** Accepted

## Context

Curriculum can be authored as data (JSON/YAML/spreadsheet) or as typed source. Exercises
can be generated with ordinary JavaScript numbers or with exact integer/rational
arithmetic.

Both choices are effectively permanent: skill ids are mastery keys on learner devices
and are immutable forever, and a generator's arithmetic model determines whether its
answers are right.

## Decision

1. **Curriculum is authored as typed TypeScript modules** under
   `dynawalla/curriculum/`, compiled to a deterministic hash-stamped SQLite artifact.
   Not JSON, not a spreadsheet, not a CMS.
2. **Generators use exact integer/rational arithmetic only.** No IEEE floats in any
   generator or checker. A lint bans bare float ops in `curriculum/` and `engine/`.
3. **Generation is seeded, pure and platform-stable**: an own PRNG (FNV-1a +
   mulberry32) with pinned known-answer vectors, never `Math.random`, no `Intl` inside
   generation, no key-order assumptions.
4. **Prompts are structured, never rendered strings.** `Exercise.prompt` is a
   `PromptSpec` — `{ key: LocKey, slots }` — so one template key translated once serves
   every seeded instance forever.

## Consequences

- Typed source means the compiler enforces the schema, refactors are mechanical, and the
  validator gates can `import` the graph rather than parse it. It also means curriculum
  edits go through the same review gate as code, which is the point.
- **Float arithmetic would be a silent correctness bug, not a flaky one.**
  `0.1 + 0.2 !== 0.3` marks correct decimal work *wrong*, deterministically, so no
  flaky-test detector will ever surface it. The lint is the only guard, and a
  suppression comment inside those two directories should be treated as a review blocker
  ([RISKS.md](../RISKS.md) R-21).
- Platform stability matters because generators run in a WebView on iOS, Android and
  desktop. Any nondeterminism produces different exercises per device and makes a bug
  report irreproducible. Gate C-16 pins output hashes on macOS **and** Linux CI.
- Structured prompts make localization cost scale with **template count**, not content
  volume. That is what makes five locales affordable across ~160 skills and thousands of
  generated instances. Gate C-19 lints that no `Exercise.prompt` is a bare string.
- Ids are `dw.<domain>.<cluster>.<slug>` and **immutable forever**. A rename means
  minting a new id and marking the old one `deprecated` with `supersededBy`. Grade is
  **not** in the id — Singapore teaches fraction-of-a-whole at P2, CCSS starts fractions
  at grade 3, and England mandates 12×12 tables by Y4; all three agree on the spine and
  disagree on timing by 1–2 years. Progression gates on prerequisites, never on grade.
