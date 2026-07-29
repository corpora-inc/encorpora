// The small print on a game's card, as pure functions.
//
// Here rather than inside `Catalog.tsx` for one reason: `.tsx` cannot be tested
// in this runner. Node's type stripper does not read JSX and there is no DOM,
// so anything living in the component is held only by `tsc` — and "Grades ?–?"
// and "NaN+" are both type-correct. These are the two lines a parent reads to
// decide whether a game is for their child, so they are worth an assertion.
//
// The shared rule in both: **a fact that is missing is drawn as nothing, never
// as a guess and never as a placeholder.** A pack record written before either
// field existed is on a device today.

import { fill, strings } from "../app/strings.ts"

/** The band a game is written for, or nothing at all — never "Grades ?–?". */
export function gradeLabel(grades: readonly [number, number] | null): string | null {
  if (grades === null) return null
  const [from, to] = grades
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return fill(strings.catalog.grades, { from, to })
}

/**
 * The youngest age the game's *hands* are written for, or nothing at all.
 *
 * A floor, drawn "and up": `8+`, never `6–10`. There is no ceiling to draw
 * because every game's mathematics adapts upward without bound, so a range
 * would print a promise the product does not make.
 *
 * **Guidance, not a gate.** Nothing reads this to lock, hide, dim or reorder a
 * pack — it is one more piece of small print in the same type as the version,
 * and a five-year-old's parent seeing `8+` is being told the game may be
 * frustrating, not that it is shut.
 */
export function minAgeLabel(minAge: number | null): string | null {
  if (minAge === null || !Number.isInteger(minAge) || minAge <= 0) return null
  return fill(strings.catalog.minAge, { age: minAge })
}
