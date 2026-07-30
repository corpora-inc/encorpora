# Changelog — `@dynawalla/curriculum`

The mathematics packs import: the skill graph, the generator families, the
executable mal-rules, the counting-board contrast pair and the `CG-*` gates.

**Consumers to rebuild on change:** every pack that generates or judges an item.
Consumption is build-time source vendoring, so a change here does not reach an
installed pack until that pack is rebuilt and republished.

## 0.1.0 — Unreleased

### "Easy" means `4 + 5`, not the nine smallest facts

The founder, after an hour with four different games:

> "it seems like another game that is wayyyyyyyyyyyyy over weighted to 2 plus
>  fucking zero. if i see 2 plus 0 a-fucking-gain I'm going to scream and break my
>  phone. **easy also means 4+5 not just 2+0 over and over again for an hour.**"

`dw.add.facts.add-within-ten` L0 declared `closedFactSet: [9, 20, 65, 45]`. Level 0
was `{0..3}²` minus `0 + 0` — **nine problems**, every operand 0, 1, 2 or 3 — and it
is the bottom rung of the whole product, so every game's difficulty floor parked on
it. `4 + 5` was not reachable there. Neither was `6 + 3`, `7 + 2` or `5 + 5`.

Nothing was broken. The row declared nine, reached nine, overran nothing and passed
every gate; the brief it was written to asked for the trivial identities and said
not to skip them, which was right. The level table answered by making them the
whole floor.

- **Five rows re-levelled, `rev` bumped, ids untouched.** Every one of them still
  teaches what its id says; only which slice of it each rung serves changed. There
  is no per-level durable state on any device to orphan — `@dynawalla/engine` is
  unwired, `dynawalla-app/src/learner/record.ts` stores two integers, and the ladder
  position is session-scoped — which is why this is a `rev` and not a new id. If a
  `FactKey` of the form `skill:…#L3#free-entry` existed anywhere, it would be.

  | row | was | is |
  |---|---|---|
  | `dw.add.facts.add-within-ten` | 9, 20, 65, 45 | **65, 45, 45** |
  | `dw.add.facts.subtract-within-ten` | 9, 20, 65, 45 | **65, 45, 45** |
  | `dw.add.facts.add-across-ten` | 15, 26, 36 | **26, 33, 36** |
  | `dw.add.facts.subtract-across-ten` | 15, 26, 36 | **26, 33, 36** |
  | `dw.mul.facts.tables-within-five` | 8, 15, 35, 16 | **24, 35, 16** |

- **The within-ten ramp is the scaffold, not the sum ceiling.** All three rungs draw
  from the whole within-ten table; what comes away is the ten-frame and the
  identities. The argument is a coefficient this package already had:
  `numberFacts/constants.ts` prices range at **0.05 a unit** and the drawn frame at
  **−0.35**, so the entire distance from `2 + 1` to `9 + 1` is what the frame is
  worth by itself. With ten counters on the screen `7 + 2` is the same act as
  `2 + 1`. Two rungs spent walking the ceiling from three to five bought 0.10 of a
  logit and paid for it with a nine-item floor.
- **The identities are a share, not a level.** Twenty of level 0's sixty-five facts
  have a zero in them, so a child on the bottom rung meets one about every third
  question. `numberFacts.test.ts` still names `0 + 1`, `1 + 0`, `n − 0` and `n − n`
  individually — and now names `4 + 5`, `6 + 3`, `7 + 2` and `5 + 5` beside them,
  because the first test passed throughout the hour the founder is describing.
- **The multiplicative floor had the same defect and takes the other route.**
  `tables-within-five` L0 was `{0,1,2}²` minus `0 × 0` — eight products, four of them
  `× 0`, flagged as "it reads repetitive" by its own author. Here the factor knob is
  *real* gradation: this family prices it at 0.15 a step against `number-facts`' 0.05,
  because one more in a factor is a whole further table. So the ramp by table is kept
  and only its empty first rung is gone; L0 is now the tables to four, twenty-four
  products of which nine need a table.
- **No `b` on the ladder moved.** Each row's anchor absorbed the re-level, so L0 of
  every touched row lands on exactly the number it landed on before: −3.00, −2.85,
  −1.60, −1.55, −1.20. The ladder is three rungs shorter (66 → 63) and every rung
  above the fact rows is where it was.
- **`MIN_RUNG_VARIANTS = 24`, in `promotionBlockers.ts`** — the bound CG-10's two
  regimes left between them. An open parameter space answers to the 975-problem
  floor; a closed set answers to its own declaration; nobody asked whether the
  declaration was big enough to be a rung. It is a bound on the *level table* and
  never on the declaration — a set genuinely closed at nine must not be a whole
  level, and writing a bigger number beside it fails CG-10's overrun check.
  `SMALL_RUNG_LEVELS` names the one exempt level, `tables-within-five L2`
  (`{2..5}²`, sixteen products, the top of its row and ladder position 14 of 63);
  deleting it would open a 0.45-logit hole in the one strand a child climbs one
  table at a time. `ladder.test.ts` asserts the list in both directions and prints
  every active level's width, so the next nine-item floor is named by a failing
  build rather than by a child.
- **`numberFacts.test.ts` gained the χ² uniformity check it never had.**
  `timesTable` and `signedInt` both measure the shape of their draw; the family that
  serves the floor did not, so a draw weighted towards the front of the enumeration
  would have put `0 + 1` and `0 + 2` at the top of every session with every other
  test in the file green. Ten draws per cell, exact rationals, all twelve bound
  levels. Root-reachability sampling went from 200 seeds to 1,500 for the same
  reason the floor widened: on a sixty-five-fact set, 200 draws miss a named fact
  about one time in twenty, and `3 − 0` was missing the first time it ran.
- **Measured, at the floor rung, 30 questions:** 8.7 → **24.1** distinct prompts.
  Through the host's own reflected kernel at rung 0: 17.4 → **25.9**. The four
  easiest rungs held 58 problems between them, with 43% of a beginner's questions on
  the nine; they hold 220, none of them under 45.

**Known and not fixed here, because it is outside this change's tree:**
`dynawalla-app/src/packs/items.test.ts` proves the beginner's spread by asserting
that 20 questions draw more distinct prompts than the bottom rung's declared closed
set holds. That technique only works while the bottom rung is smaller than the
sample, and it no longer is — 19 distinct of 20, against a rung of 65. The test's
claim still holds (four rungs served, 19 of 20 distinct); its proof needs a fixed
threshold instead. It will not go red on this pull request: the `dynawalla_app` CI
filter covers `dynawalla/curriculum/` and not `dynawalla/packs/shared/curriculum/`,
which is the same gap the comment above `dynawalla_curriculum` describes one filter
over.

### The operator is drawn, and seven rows go active

The blocker the section below named is fixed on the other side of the boundary:
`dynawalla-app/src/packs/items.ts` reads `promptOperator(key)` and has no
fallback, so a multiplication is drawn as a multiplication. The rows that were
waiting on nothing else are `active`.

- **Seven rows promoted, by a `status` flip and nothing else.** Four of `mul` —
  both fact rows, `multidigit.times-one-digit` and `multidigit.times-two-digit` —
  and `dw.div.facts.division-facts`, `dw.div.whole.divide-exact` and
  `dw.div.whole.zero-in-the-quotient`. No generator, no level table and no
  parameter changed; the snapshot file gains their hashes and loses none.
- **`NUMERAL_WIDTH_BLOCKED_LEVELS`, and it is why `48,826 × 82,726` is still not
  reachable.** Promoting `dw.mul.scale.times-power-of-ten` and
  `dw.mul.multidigit.long-multiplication` turned `games/polarity`'s own sweep of
  the shipping ladder red: its numeral cell holds eight characters, it refuses an
  answer it cannot print, and those rows reach nine and ten
  (`544,080,000`; `2,367,541,946`). Declining is per-item and the host serves by
  rung, so a level where every item is too wide is not a graceful degradation — it
  is a Seal Bearer that asks nothing. The rows are right and the ceiling is the
  program's stated one; what is missing is a pack that widens its numeral or caps
  its stream with the `next({ maxDifficulty })` seam `packs/sdk` already has. Both
  rows stay `draft` until one does.
- **`OPERATOR_BLOCKED_TEMPLATES` is gone**, replaced by
  `MISSTATED_QUESTION_TEMPLATES` — the defect one level down, which the operator
  fix does not touch. A correct operator is not a stated question:
  `dw.prompt.long-div.remainder` draws `129 ÷ 2` and wants 1, and the three
  `missing-operand` templates draw `1 + 10` and want 9. The new list is *measured*
  — `render/prompts.test.ts` applies the declared operator to the two operands the
  host would read and compares the result with the canonical answer in exact
  rationals — so it names a template a human reading of the ids would not.
- **`dw.div.facts.division-facts`' difficulty table was wrong** and no gate could
  see it: CG-9's difficulty check runs over `activeNodes`, so a draft row's table
  is unchecked. It was authored `[−0.55, −0.15, 0.15]` against a family that
  spaces those parameters 0.70 and 0.45. Restated as what the parameters compute.
- **`gates.test.ts` runs the healthy-graph case at `INCREMENTAL_SEEDS`.** Its
  fixture sampled forty seeds, and CG-9 counts distinct items *in the sample* — so
  a level declaring `minVariants: 80` could not pass it however good its generator
  is. The fixture had become a lower standard than the gate it stands for.

Still blocked, and each on something this change does not touch:
`SIGNED_BLOCKED_SKILLS` (the four `int` rows wait on `answer:integer-signed`, a
pack's keypad), `FRACTION_ANSWER_BLOCKED_SKILLS` (`answerText` cannot write a
fraction, so `dw.div.whole.quotient-and-remainder` and every `frac` row would be
served as nothing), the CG-10 levels, and the `ns` compare-and-order rows, whose
templates declare no operator at all.

**Known, and not fixed here: an installed pack's clock is narrower than the new
top rungs.** The host paces an item by the wider of the cadence table and the
node's `fluencyTarget.p50Ms`. Games do not — they compute a window from the
prompt's digit width alone, and `games/beam` caps it at 44 s — so a child on
`dw.mul.multidigit.times-two-digit`, whose declared median is 25 s, gets a window
narrower than the work inside a beam wave. Nothing is scored against them (beam
calls `host.skip()` on expiry and documents that a timeout is not a wrong answer),
but the top of the ladder is hard to finish in packs whose timing tables were
measured on column addition. Those tables are a pack's to widen, and they are the
same packs `NUMERAL_WIDTH_BLOCKED_LEVELS` is waiting on.

### The ceiling: the tables, the quotients, and arithmetic below zero

The graph reached `4,003 − 87` and stopped. `mul` had no fact rows at all, `div`
had no floor under long division, and there was no integer arithmetic anywhere —
so the program's stated span, "`0 + 1` to `48,826 × 82,726`", was missing its top
two thirds. `48,826 × 82,726` was not merely unauthored: `multidigit-mul` capped
the multiplier at three digits, so no parameter object could describe it.

- **A new family, `gen.arith.times-table`.** The tables and their inverses, `0 × 1`
  through `144 ÷ 12`, drawn uniformly from an enumerated closed set. Multiplication
  and division are one family because `48 ÷ 6` is `6 × 8` read backwards, exactly as
  `15 − 8` is `8 + 7` read backwards in `gen.arith.number-facts`.
  `gen.arith.multidigit-mul` is bounded by a digit count and cannot express "the
  tables to five"; its walkthrough at one digit by one digit announces a partial
  product and then announces it again as the answer.
- **Three fact rows.** `dw.mul.facts.tables-within-five`,
  `dw.mul.facts.tables-to-twelve` and `dw.div.facts.division-facts`, from −1.20 up
  to 0.15, sitting between the hardest addition fact (−1.25) and the first written
  multiplication (0.25). Each declares `closedFactSet` — the reconciliation with
  CG-10 that the addition floor established, applied to the content the old `mul.ts`
  said the floor forbade outright.
- **A new family, `gen.arith.signed-int`, and a seventh domain, `int`.** Four rows:
  `3 − 9` as the on-ramp, then adding, subtracting and multiplying signed numbers.
  Levels are bounded by magnitude and capped at twenty, because past twenty this is
  column arithmetic wearing a sign and column arithmetic has a family; what these
  rows teach is which way the answer points.
- **`AnswerSchema.integer.signed`, and `answer:integer-signed`.** The first answers
  in this program that go below zero. A separate renderer id rather than a flag,
  because a digit keypad handed `(−7) + 4` is not the blank card CG-8 usually
  catches — it is a card that looks answerable and marks a correct child wrong.
  CG-8 reads it through the new `answerRendererIdFor(schema)`.
- **`multidigit-mul` reaches five digits by five**, and a new row,
  `dw.mul.multidigit.long-multiplication`, whose top level is `48,826 × 82,726`.
  No existing level's output moves, so `familyRev` does not turn over.
- **Two CG-10 blockers cleared by widening, not by argument.**
  `dw.mul.scale.times-power-of-ten` L0 went from 90 problems to 1,800 and
  `dw.div.whole.divide-exact` L0 from 720 to 7,200. Both were bounded by a digit
  count that nothing about the content asked to be small, which is precisely the
  case `closedFactSet` must not be used for.
- **`PromptTemplateDeclaration.operator`, and `promptOperator(key)`.** The glyph
  every question is written with, as data the curriculum owns. It exists because
  the only thing that draws a question today — `dynawalla-app/src/packs/items.ts` —
  picks the operator with `promptKey.endsWith(".sub") ? "−" : "+"`, so every
  template that is not a subtraction is drawn as an **addition**. `7 × 8` would
  reach a child as `7 + 8`.
- **`OPERATOR_BLOCKED_TEMPLATES` and `SIGNED_BLOCKED_SKILLS`** join
  `CG10_BLOCKED_LEVELS` in `promotionBlockers.ts`, each asserted against what the
  graph measures rather than maintained by hand. The first is why the
  multiplication and division rows are still `draft` after their generators, their
  fact floors and their variant spaces were all finished; `render/prompts.test.ts`
  found two entries a human reading of the list had missed
  (`dw.prompt.missing-operand.sub-unknown` is a subtraction whose key ends
  `".sub-unknown"`, so the host draws it with a plus too).
- **`fluencyTarget.p50Ms` on eight more rows**, each with the reason on it. The
  host takes the wider of the cadence table's p90 and 2.5× this median, and the
  table was measured on column addition: `47 × 23` is two digits wide and would
  otherwise climb only under 14 s, which is narrower than the work.
- **`generators/shared/uniformity.ts`.** χ² over a closed set, in exact rationals,
  with the tail bound squared so no square root ever happens. The closure tests
  cannot see a generator that reaches all 121 facts and asks for `2 × 2` twenty
  times as often as `9 × 8`.


### The floor: `gen.arith.number-facts`, and a ladder that starts at `0 + 1`

The easiest thing this library could give a child was `plus(2, 2, 0)` — a
two-digit column sum. There was no first grade in it and no kindergarten at all,
so a five-year-old opening the product met second-grade column arithmetic on the
first card, and a struggling second grader sliding down the ladder hit that same
card and stopped.

- **A new family, `gen.arith.number-facts`.** A fact is bounded by a **value**
  (`within twenty, crossing ten`) and a column is bounded by a **width**
  (`two-digit minuend, one borrow`, which is `94 − 6` as readily as `15 − 8`), so
  there is no parameter of `gen.arith.column-op` that means "within twenty". The
  column family's digit-wise machinery does in fact run at one column — only
  `MIN_DIGITS = 2` stops it — but its walkthrough is a walk down the columns and
  all three of its mal-rules are bugs in that walk, neither of which is what a
  child does to get `3 + 5`. The two families are siblings.
- **Four active rows, `dw.add.facts.*`**, at difficulties −3.00 up to −1.25,
  entirely below the previous floor of −0.90: sums within ten, differences within
  ten, and each of those across ten. Level 0 of the first two is the trivial set —
  `0 + 1`, `1 + 0`, `n − 0`, `n − n` — because a bottom rung that is still a small
  challenge is not a bottom rung. Only `0 + 0` is excluded, and only because an
  empty frame is not a question.
- **The column rows now consume the fact rows.** A carry happens exactly when a
  column sum crosses ten and a borrow exactly when a difference does, so
  `cap.arith.sums-across-ten` and its three siblings make the ladder continuous
  through CG-6 rather than through an editorial ordering. `dw.add.column.*` and
  `dw.add.regroup.*` gain a `rev` and a prerequisite; no id moved.
- **A fifth representation, `ten-frame`**, declared and unbuilt like the other
  four. The counting board is a *place-value* board and handing it `2 + 3` would
  draw a structure the item is not about, on the screen of the child least able to
  tell the difference. The lowest three levels of each within-ten row emit the
  spec; the rows list it as `optional`, because a `required` representation with
  no renderer is the curriculum row CG-8 exists to stop.
- **`GeneratorBinding.closedFactSet`, and CG-10's substituted check.** There are
  thirty-six additions within ten and there is no thirty-seventh, so CG-10's
  variant-space floor of 975 — derived from a model of generators that do not
  close — would forbid teaching number facts at all. A level that declares its
  closed size is measured against that declaration instead, and the substituted
  check is the sharper one: it fails when the generator reaches a problem the row
  says does not exist, which the floor could never have seen. CG-7 checks the
  declaration lines up with the level table and does not undercut `minVariants`.
- **`graph/ladder.test.ts`.** The active graph has exactly one root, every active
  row climbs from it, and `activeNodes()` is already in prerequisite order — the
  order a game walks. Before this change the active graph had two roots and both
  were two-digit column arithmetic, which every gate in the set passed.

### Eight generator families across five new domains

The library taught addition and subtraction and nothing else. It now generates
place value, comparison and ordering, rounding and estimation, multi-digit
multiplication, long division, fraction equivalence, fraction arithmetic and
missing-operand equations — `gen.number.place-value-decompose`,
`gen.number.compare-order`, `gen.number.round-estimate`,
`gen.arith.multidigit-mul`, `gen.arith.long-div`, `gen.frac.equivalence-simplify`,
`gen.frac.arith` and `gen.arith.missing-operand` — over the five new domains `ns`,
`mul`, `div`, `frac` and `alg`.

- **Two answer schemas the judge was missing**: `fraction` (with the per-skill
  `equivalence` decision, so `2/4` is the same answer as `1/2` everywhere except
  on the skill that teaches simplifying) and `choice` (with the drawn options on
  the schema, since a renderer is handed the schema and nothing else).
- **Thirteen new mal-rules** wired to the new families — the table goes from 3 to
  16 — each ≥95% divergent under CG-12, grouped once rather than re-filtered per
  card on the path CG-17 budgets.
- **CG-8 gained its missing half.** It checked the answer schema and the
  representations and said nothing about the *question*, so a family could emit a
  prompt template nobody could draw — an answer entry with nothing above it.
  `render/prompts.ts` is the second registry, read off generated items rather than
  off a declaration a family makes about itself.
- **CG-11 now runs `schemaDefect` over generated output**, so a `choice` item
  carrying two options of the same value fails the gate instead of reaching a
  screen.
- **`graph/promotionBlockers.ts`** names, per row, what stands between the 30
  draft rows and `active` — and `families.property.test.ts` asserts the list in
  both directions, so a row that slips under CG-10's floor must be named and a
  generator widened past it must be struck off.
- **Every renderer and prompt declaration reads `implemented: false`.** They were
  satisfied by the host's practice loop; ADR-0022 deleted it, and no pack has
  landed a replacement, so nothing in this repository draws a curriculum item
  today. `--strict-renderers` fails on that, which is correct — a release in which
  nothing draws a question is not a release — and the first pack renderer is what
  clears it.

### Relocation

Relocated from `dynawalla/curriculum/src` so that packs — which are the product —
can import it without reaching into the host app's tree. The mathematics is
unchanged: every committed CG-16 output hash still matches, on the same 10,000-item
full sweep.

- The library moved to `packs/shared/curriculum/src`. `dynawalla/curriculum/`
  keeps the devDependencies, the commands and the `dw-curriculum` CLI, and holds
  one temporary compatibility re-export for the host app's existing import.
- **The counting-board contrast pair** (`src/board/`) joined the library, with the
  column-item reader it needs. It was in the host app, which ships no content —
  the one piece of the contrast pair's guarantee that lived where it could be lost.
  Its tests here drive the mal-rule's own executable output rather than a
  hand-written wrong answer, over 3,177 real contrast cards.
- **`src/boundary.test.ts`**: no import escapes the library, no bare specifiers, no
  `node:` builtin and no DOM on the runtime surface. A pack bundle can take this
  package as-is.
- **An empty lint root now fails CG-16, CG-19 and M-05** instead of passing. A
  moved or misspelled root scanned nothing and reported clean.
