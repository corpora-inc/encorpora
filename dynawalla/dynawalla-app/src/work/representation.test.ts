// The two representations this bundle draws from a `RepSpec`.
//
// A representation is the one part of a card that can be *wrong without being
// incorrect*: a number line whose index sits a tick off its label, or a beam
// that tips the wrong way, teaches the opposite of the item it illustrates and
// no answer check will notice. So the checks here are geometry and words, and
// the drawing itself is looked at in a real browser
// (`tools/drive-schemas.mjs`), which is the only place a mis-drawn line shows.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { strings } from "../app/strings.ts"
import {
  exact,
  fractionRational,
  repSpecDefect,
  REP_BALANCE_SCALE,
  REP_NUMBER_LINE,
  V1_REPRESENTATIONS,
} from "./curriculum.ts"
import type { Rational, RepSpec } from "./curriculum.ts"
import { writeLinePosition, MIXED_GAP } from "./notation.ts"
import {
  representationDefect,
  CONTRAST_REPRESENTATIONS,
  DRAWABLE_REPRESENTATIONS,
  RENDERED_REPRESENTATIONS,
} from "./representations.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (relative: string): string => fs.readFileSync(path.join(here, relative), "utf8")

const numberLine = read("ui/NumberLine.tsx")
const balance = read("ui/BalanceScale.tsx")
const dispatch = read("ui/Representation.tsx")
const workCss = read("work.css")
// The browser driver. Two claims below are geometry, which no regex over a
// component can hold: they are measured in `drive-schemas.mjs`, and what is
// asserted here is that the measurement is still in it.
const driver = read("../../tools/drive-schemas.mjs")

const spec = (rep: string, params: Record<string, number>): RepSpec => ({ rep, params })

// ── the specs a renderer will accept ────────────────────────────────────────

test("a number line spec is four integers, and every way of being wrong is named", () => {
  assert.equal(repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 4, mark: 3 }), null)
  assert.equal(repSpecDefect(REP_NUMBER_LINE, { from: 2, to: 5, denominator: 1, mark: 3 }), null)

  // Every param is a safe integer. A representation is drawing rather than
  // arithmetic, but the numbers it draws are the numbers the answer is made of,
  // and a `0.30000000000000004` tick label is ADR-0006's float bug wearing a hat.
  assert.match(
    repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 3, mark: 0.5 }) ?? "",
    /not a safe integer/,
  )
  assert.match(repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 4 }) ?? "", /missing mark/)
  assert.match(
    repSpecDefect(REP_NUMBER_LINE, { from: 3, to: 1, denominator: 4, mark: 0 }) ?? "",
    /backwards/,
  )
  assert.match(
    repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 4, mark: 9 }) ?? "",
    /off the line/,
  )
  // A line a child can read. Twelve ticks is a fraction wall; sixty is a
  // hairbrush, and at 320 px the labels collide long before that.
  assert.match(
    repSpecDefect(REP_NUMBER_LINE, { from: 0, to: 10, denominator: 8, mark: 3 }) ?? "",
    /more than 24 intervals/,
  )
})

test("a balance spec is two amounts, and neither of them is negative", () => {
  assert.equal(repSpecDefect(REP_BALANCE_SCALE, { left: 12, right: 12 }), null)
  assert.match(repSpecDefect(REP_BALANCE_SCALE, { left: -1, right: 2 }) ?? "", /negative/)
  assert.match(repSpecDefect(REP_BALANCE_SCALE, { left: 1 }) ?? "", /missing right/)
})

test("the app draws two of the four V1 representations, and says which", () => {
  // CURRICULUM.md fixes four. Two are drawn from a `RepSpec`, one is the LOCATE
  // contrast built from an exercise, and the gear train is declared and not
  // built — it carries multiples, factors and LCM, and none of that content
  // exists, so there is nothing to check a renderer against.
  assert.deepEqual([...DRAWABLE_REPRESENTATIONS].sort(), ["balance-scale", "number-line"])
  assert.deepEqual([...CONTRAST_REPRESENTATIONS], ["counting-board"])
  for (const rep of RENDERED_REPRESENTATIONS) {
    assert.ok(V1_REPRESENTATIONS.includes(rep), `${rep} is not one of the four V1 representations`)
  }
})

test("an id nothing renders is a defect, not a blank space", () => {
  assert.match(representationDefect(spec("gear-train", {})) ?? "", /no renderer/)
  assert.equal(representationDefect(spec(REP_NUMBER_LINE, { from: 0, to: 1, denominator: 2, mark: 1 })), null)
  // …and a bad spec on a good id is still a defect.
  assert.match(
    representationDefect(spec(REP_BALANCE_SCALE, { left: 1, right: -1 })) ?? "",
    /negative/,
  )
})

test("every id the app claims to draw has a case in the one place that draws it", () => {
  // `representations.ts` carries the list because a Node test can import it and
  // cannot import JSX. A `RepId` in the list with no case in `Representation.tsx`
  // is a blank space on a child's screen and a green gate.
  for (const rep of DRAWABLE_REPRESENTATIONS) {
    assert.ok(dispatch.includes(rep) || dispatch.includes(constantFor(rep)), `nothing draws ${rep}`)
  }
})

function constantFor(rep: string): string {
  return rep === "number-line" ? "REP_NUMBER_LINE" : rep === "balance-scale" ? "REP_BALANCE_SCALE" : rep
}

// ── the geometry ────────────────────────────────────────────────────────────

test("the line's intervals are flex, never a percentage of a float", () => {
  // Where a number *sits* is the whole thing this representation teaches, so a
  // fifteenth of a line has to be a fifteenth of a line. `flex-1` spacers between
  // zero-width tick columns make the browser do the division exactly; a
  // `left: ${(mark / intervals) * 100}%` puts a float on the one path that must
  // not have one, and cannot be written at all under this CSP.
  assert.match(numberLine, /className="flex-1"/, "the intervals are not equal flex spacers")
  assert.match(numberLine, /relative w-0/, "a tick with width pushes its neighbours")
  assert.ok(!/%`/.test(numberLine), "the line positions something by percentage")

  // No division anywhere in the component, not just the one literal
  // `/ intervals` this guard used to name. It was written against a string the
  // file never contained while `String(from + i / denominator)` — a float
  // division, on the tick labels — sat eleven lines away from it. A binary `/`
  // is spaced under this repo's formatter and a Tailwind fraction (`w-1/2`) is
  // not, so what is rejected is a spaced slash outside a comment.
  const code = numberLine.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const divide = /\S \/ \S/.exec(code)
  assert.equal(divide, null, `the line divides to place something: ${String(divide?.[0])}`)
})

test("whole ticks and part ticks differ by height, and the index by shape", () => {
  // CG-18: nothing solvable by colour alone. A line where every tick is the same
  // height is a ruler with no units on it.
  assert.match(numberLine, /whole \? "bg-line-strong h-3[^"]*" : "bg-line-strong h-1\.5/)
  assert.match(numberLine, /dw-line-index/)
  const shape = /\.dw-line-index\s*\{([\s\S]*?)\n {2}\}/.exec(workCss)
  assert.ok(shape !== null, "work.css has no .dw-line-index")
  assert.match(shape[1] ?? "", /border-top:\s*\d+px solid/, "the index is not a shape, only a colour")
})

test("the beam has three positions and no fourth", () => {
  // A beam whose angle tracked the difference would invite reading the size of
  // the gap off a picture that is not to scale. The idea is binary: the two
  // sides hold the same amount, or they do not.
  const angles = [...workCss.matchAll(/\.dw-beam-(left|right)\s*\{[^}]*rotate\((-?[\d.]+)deg\)/g)]
  assert.equal(angles.length, 2, "the beam has grown a third tilt or lost one")
  assert.equal(Number(angles[0]?.[2]), -Number(angles[1]?.[2]), "the two tilts are not mirror images")

  // The pans counter-rotate by exactly the beam's angle, about the point they
  // hang from — so they stay upright and stay attached without a single offset
  // being computed. The first cut positioned them by hand and they missed the
  // beam by a visible margin at 358 px.
  const pans = [...workCss.matchAll(/\.dw-beam-(left|right) \.dw-pan\s*\{[^}]*rotate\((-?[\d.]+)deg\)/g)]
  assert.equal(pans.length, 2, "the pans do not counter-rotate")
  for (const [side, angle] of pans.map((m) => [m[1], Number(m[2])])) {
    const beam = angles.find((m) => m[1] === side)
    assert.equal(angle, -Number(beam?.[2]), `the ${String(side)} pan does not hang level`)
  }
  assert.match(workCss, /\.dw-pan\s*\{[^}]*transform-origin:\s*50% 0/)
  assert.match(balance, /className="dw-pan/, "the pan carries no counter-rotation class")
  assert.match(balance, /left === right \? "level" : left > right \? "left" : "right"/)
})

test("the heavier pan goes down, which is the only thing the scale is for", () => {
  // This shipped backwards, and the mirror-image assertion above is equally
  // true of the correct pair and its inverse — so the *sign* is asserted here,
  // derived rather than copied out of the file it is checking.
  //
  // CSS `rotate(a)` is `x' = x·cos a − y·sin a, y' = x·sin a + y·cos a` in a
  // space where y grows downward, so it turns clockwise on screen. The beam's
  // origin is `50% 0`, putting its left end at `x = −L, y = 0`; under
  // `rotate(a)` that end moves to `y' = −L·sin a`. A positive angle therefore
  // gives a *smaller* y, and a smaller y is higher up the screen.
  //
  // `BalanceScale.tsx` names the state `left > right` "left", and
  // `strings.practice.balanceLeft` says the left pan is *lower*. Lower means a
  // larger y at the left end, which means `sin a < 0`, which means the angle on
  // `.dw-beam-left` is negative. The pan's counter-rotation is the negation of
  // whatever the beam does, which the test above already pins.
  const angleOf = (side: "left" | "right"): number => {
    const match = new RegExp(`\\.dw-beam-${side}\\s*\\{[^}]*rotate\\((-?[\\d.]+)deg\\)`).exec(workCss)
    assert.ok(match !== null, `work.css has no .dw-beam-${side}`)
    return Number(match[1])
  }
  assert.ok(
    angleOf("left") < 0,
    "the left-heavy beam turns anticlockwise, which lifts the left end — the heavier pan rises",
  )
  assert.ok(
    angleOf("right") > 0,
    "the right-heavy beam turns clockwise, which lifts the right end — the heavier pan rises",
  )
  // The state the sign is derived from: change either of these and the
  // derivation above stops holding, so they are asserted together.
  assert.match(balance, /tilt === "left" \? "dw-beam-left"/)
  assert.equal(strings.practice.balanceLeft, "The left pan is lower.")
  assert.equal(strings.practice.balanceRight, "The right pan is lower.")
  // …and the drawn geometry is measured in a browser, which is the only place
  // this can be checked rather than argued: `tools/drive-schemas.mjs` reads the
  // two pans' `getBoundingClientRect().top` on `balance-left` and
  // `balance-right` and fails when the heavier one is not the lower one.
  assert.match(driver, /panTops/, "the driver no longer measures the pans")
})

test("reduced motion stops the beam rather than shortening its swing", () => {
  // A branch, not a degradation. `work.css`'s reduced block must turn the
  // transition off outright, so the beam arrives already tilted.
  const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n {2}\}/.exec(workCss)
  assert.ok(reduced !== null)
  assert.match(reduced[1] ?? "", /\.dw-beam,\n\s*\.dw-pan\s*\{\s*transition:\s*none/)
})

// ── the words ───────────────────────────────────────────────────────────────

test("both representations carry their whole meaning in words", () => {
  // `Q-10` and CG-18. The counting board is the precedent: it shipped as twenty
  // `aria-hidden` circles with "which board closes" carried by colour, and it
  // cost seven strings to put right afterwards.
  for (const [name, source] of [
    ["NumberLine.tsx", numberLine],
    ["BalanceScale.tsx", balance],
  ] as const) {
    assert.match(source, /role="img"/, `${name} is not a labelled picture`)
    assert.match(source, /aria-label=\{/, `${name} has no text alternative`)
  }
  assert.match(numberLine, /strings\.practice\.lineAlt/)
  assert.match(balance, /strings\.practice\.balanceAlt/)
  // The tilt is *said*, not only drawn. Without this, which pan is lower is
  // carried by a CSS rotation, which assistive technology does not expose at all.
  for (const key of ["balanceLevel", "balanceLeft", "balanceRight"] as const) {
    assert.ok(balance.includes(`strings.practice.${key}`), `the scale never says ${key}`)
  }
})

test("a written position means, to the answer layer, the number it is", () => {
  // The round trip that matters, and the one that was broken: whatever
  // `writeLinePosition` writes, `fractionRational` — the function the whole
  // answer layer reads a mixed number with — has to give back the position that
  // was asked for. It is checked over every spec `repSpecDefect` admits inside a
  // sweep, rather than at three hand-picked points, because the failure was a
  // *sign* convention and hand-picked points were all non-negative.
  //
  // `-3 1/4` was what a quarter to the right of `-3` used to be written as, and
  // `fractionRational` reads that as `-3 − 1/4` = `-13/4`. The position is
  // `-11/4`. Half a unit out, in the one notation a child would type back.
  const parse = (written: string): Rational => {
    const mixed = new RegExp(`^(-?\\d+)${MIXED_GAP}(-?\\d+)/(\\d+)$`).exec(written)
    if (mixed !== null) {
      return fractionRational({
        kind: "fraction",
        whole: BigInt(mixed[1] ?? "0"),
        num: BigInt(mixed[2] ?? "0"),
        den: BigInt(mixed[3] ?? "1"),
      })
    }
    const bare = /^(-?\d+)\/(\d+)$/.exec(written)
    if (bare !== null) {
      return fractionRational({ kind: "fraction", num: BigInt(bare[1] ?? "0"), den: BigInt(bare[2] ?? "1") })
    }
    assert.match(written, /^-?\d+$/, `a position nothing can read back: ${written}`)
    return exact.rational(BigInt(written))
  }

  let checked = 0
  for (let from = -4; from <= 4; from++) {
    for (let to = from + 1; to <= from + 6; to++) {
      for (const denominator of [1, 2, 3, 4, 5, 8, 12]) {
        for (let mark = 0; mark <= (to - from) * denominator; mark++) {
          if (repSpecDefect(REP_NUMBER_LINE, { from, to, denominator, mark }) !== null) continue
          const written = writeLinePosition(from, mark, denominator)
          const expected = exact.rational(BigInt(from) * BigInt(denominator) + BigInt(mark), BigInt(denominator))
          assert.ok(
            exact.eq(parse(written), expected),
            `${written} at from=${String(from)} mark=${String(mark)}/${String(denominator)} is not ${exact.toString(expected)}`,
          )
          checked += 1
        }
      }
    }
  }
  // The sweep is 3,393 positions today. The floor is here so a change to
  // `repSpecDefect` that quietly refuses most of them cannot turn this into a
  // test that passes by checking nothing.
  assert.ok(checked > 3000, `only ${String(checked)} positions were checked`)

  // The three the driver reads off the screen, pinned by hand.
  assert.equal(writeLinePosition(0, 3, 4), "3/4")
  assert.equal(writeLinePosition(2, 3, 1), "5")
  assert.equal(writeLinePosition(0, 5, 3), `1${MIXED_GAP}2/3`)
  // …and the negative origin, written the way the answer layer reads it.
  assert.equal(writeLinePosition(-3, 1, 4), `-2${MIXED_GAP}3/4`)
  assert.equal(writeLinePosition(-3, 0, 4), "-3")
  assert.equal(writeLinePosition(-1, 1, 4), "-3/4")
})

test("the line says where the index is, in the notation the answer is written in", () => {
  // A child hears "Marked at 3/4", not a description of a picture — and the
  // fraction they hear is the fraction they would type.
  assert.match(numberLine, /at: writeLinePosition\(from, mark, denominator\)/)
  assert.equal(writeLinePosition(0, 3, 4), "3/4")
  for (const slot of ["from", "to", "parts", "at"]) {
    assert.ok(strings.practice.lineAlt.includes(`{{${slot}}}`), `lineAlt never says ${slot}`)
  }
  for (const slot of ["left", "right", "state"]) {
    assert.ok(strings.practice.balanceAlt.includes(`{{${slot}}}`), `balanceAlt never says ${slot}`)
  }
})

test("neither representation sets an inline style", () => {
  // `style-src 'self'` with no `unsafe-inline`. A `style={{…}}` prop is silently
  // dropped in the WebView and works perfectly in a dev browser — which is why
  // the index's triangle and the beam's tilt are classes in `work.css`.
  for (const [name, source] of [
    ["NumberLine.tsx", numberLine],
    ["BalanceScale.tsx", balance],
    ["Representation.tsx", dispatch],
  ] as const) {
    assert.ok(!/style=\{/.test(source), `${name} sets an inline style`)
  }
})

test("a spec a renderer cannot draw draws nothing at all", () => {
  // A mis-drawn number line is worse than an absent one, because a child would
  // read it. Both components refuse before they draw, and the dispatch refuses
  // again — belt and braces, because either one could be the only caller.
  assert.match(numberLine, /if \(defect !== null\) return null/)
  assert.match(balance, /if \(defect !== null\) return null/)
  assert.match(dispatch, /if \(representationDefect\(spec\) !== null\) return null/)
})
