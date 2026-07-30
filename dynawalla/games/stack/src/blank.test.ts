// The blank glyph, and the reveal that quietly stopped filling it in.
//
// MONUMENT is the fleet's reference implementation for the founder's rule about a
// miss: *complete the sum in front of them*, in the accent colour, with the sweep
// held. Every other game was pointed at this one.
//
// It looked for a literal `"?"`. The curriculum writes `□` (U+25A1, pinned as
// `BLANK` in `dynawalla-app/src/packs/items.ts`, whose docblock says in as many
// words that it is not `?` and not `___`). When `dw.alg.equality.missing-addend`
// went active the host began serving `47 + □ = 68`, and `String.replace` — which
// returns the string UNCHANGED when it matches nothing — made three things fail
// without throwing:
//
//   1. the reveal substituted nothing, so the child saw the card again with the
//      box still empty;
//   2. the blank was never drawn in the accent, so it did not read as a blank;
//   3. `needsRegrouping` could not parse the statement and fell through to its
//      fail-open branch, handing every blank item the long allowance unmeasured.
//
// Only (3) failed safely. This file is the gate on all three.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import { BLANK, fillBlank, hasBlank } from "./blank.ts"
import { needsRegrouping } from "./game/guard.ts"

test("the box, and the two glyphs kept for history, are all blanks", () => {
  for (const g of ["□", "?", "_"]) {
    assert.ok(hasBlank(`47 + ${g} = 68`), `${g} was not recognised as a blank`)
    assert.equal(fillBlank(`47 + ${g} = 68`, "21"), "47 + 21 = 68")
  }
  assert.ok(!hasBlank("47 + 21 = 68"))
  assert.equal(fillBlank("12 + 5", "17"), "12 + 5", "a prompt with no blank is returned untouched")
})

test("only the first blank is filled, which is every card the host can write", () => {
  assert.equal(fillBlank("□ + □ = 8", "4"), "4 + □ = 8")
})

test("an answer containing a $ is not mangled by replacement patterns", () => {
  // `String.replace` interprets `$&` and `$1` inside a STRING replacement. The
  // fix uses a replacer function, so it cannot. Answers are numerals today; this
  // is here so they can stop being numerals safely.
  assert.equal(fillBlank("47 + □ = 68", "$&"), "47 + $& = 68")
})

test("a blank statement is now MEASURED for regrouping, not waved through", () => {
  // The whole point of substituting the answer back in: `47 + □ = 68` has no
  // second operand until it is filled, and `47 + 21` needs no regrouping. Before
  // the fix this could not be parsed at all and returned `true` — the fail-open
  // branch — so a child answering these got the long silence whether they needed
  // it or not, and the measurement the guard exists to make was never made.
  assert.equal(needsRegrouping({ prompt: "47 + □ = 68", answer: "21" }), false)
  // And one that genuinely does carry still says so.
  assert.equal(needsRegrouping({ prompt: "47 + □ = 72", answer: "25" }), true)
  // Unchanged for prompts without a blank.
  assert.equal(needsRegrouping({ prompt: "47 + 21", answer: "68" }), false)
  assert.equal(needsRegrouping({ prompt: "47 + 25", answer: "72" }), true)
})

test("the HUD substitutes the shared blank, not a hardcoded question mark", () => {
  // A wiring assertion, and it earns its keep: every other test in this file
  // exercises `blank.ts`, so reverting `hud.ts` alone to `replace("?", …)` would
  // leave all of them green while the reveal went back to showing an empty box.
  // The HUD needs a DOM to test directly; the call site is what actually broke,
  // so the call site is what is pinned. Same shape as `games/slice`'s wiring test.
  const hud = readFileSync(new URL("./ui/hud.ts", import.meta.url), "utf8")
  assert.ok(
    !/replace\(\s*"\?"/u.test(hud),
    "hud.ts is matching a literal \"?\" again — blank statements will render with an empty box",
  )
  const uses = [...hud.matchAll(/replace\(\s*BLANK\b/gu)].length
  assert.equal(uses, 3, `hud.ts should substitute BLANK at 3 sites, found ${String(uses)}`)
})

test("the guard reads the shared blank too", () => {
  const guard = readFileSync(new URL("./game/guard.ts", import.meta.url), "utf8")
  assert.ok(!/includes\(\s*"\?"/u.test(guard), "guard.ts is testing for a literal \"?\" again")
  assert.ok(guard.includes("fillBlank("), "guard.ts no longer fills the blank via blank.ts")
})

test("BLANK is stateless, so sharing one regex across call sites is safe", () => {
  // A `/g` or `/y` regex carries `lastIndex` between calls and would make the
  // second substitution on a frame miss. This one must not.
  assert.equal(BLANK.global, false)
  assert.equal(BLANK.sticky, false)
  assert.ok(BLANK.test("□"))
  assert.ok(BLANK.test("□"), "a second test on the same regex disagreed with the first")
})
