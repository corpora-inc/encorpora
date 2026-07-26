# Changelog — `@dynawalla/curriculum`

The mathematics packs import: the skill graph, the generator families, the
executable mal-rules, the counting-board contrast pair and the `CG-*` gates.

**Consumers to rebuild on change:** every pack that generates or judges an item.
Consumption is build-time source vendoring, so a change here does not reach an
installed pack until that pack is rebuilt and republished.

## 0.1.0 — Unreleased

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
