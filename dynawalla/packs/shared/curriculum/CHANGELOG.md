# Changelog — `@dynawalla/curriculum`

The mathematics packs import: the skill graph, the generator families, the
executable mal-rules, the counting-board contrast pair and the `CG-*` gates.

**Consumers to rebuild on change:** every pack that generates or judges an item.
Consumption is build-time source vendoring, so a change here does not reach an
installed pack until that pack is rebuilt and republished.

## 0.1.0 — Unreleased

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
