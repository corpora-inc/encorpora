/**
 * The CSS model, held to the behaviours three packs' safe-area tests rely on.
 *
 * This file matters more than it looks. If the evaluator is wrong, every
 * assertion built on it is vacuous in the same quiet way the substring search it
 * replaced was — the suite goes green and the currency is still under the clock.
 * So the cascade, the shorthand expansion, the `var()` fallback and the one rule
 * that gives the module its name are each pinned here.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  envReadDirectly,
  evalLength,
  expandBox,
  lengthOf,
  paddingOf,
  parseCss,
  type EvalCtx,
} from "./cssSafeArea.ts"

const vars = (o: Record<string, string>): Map<string, string> => new Map(Object.entries(o))
const ctx = (o: Record<string, string> = {}, w = 400, h = 800, pct = 0): EvalCtx => ({
  vars: vars(o),
  vp: { w, h },
  pct,
})

test("env(safe-area-inset-*) is ZERO, fallback and all", () => {
  // The reason the module exists. A rule that reaches for env() inside a pack
  // frame gets nothing, not even the fallback the author wrote next to it.
  assert.equal(evalLength("env(safe-area-inset-top)", ctx()), 0)
  assert.equal(evalLength("env(safe-area-inset-bottom, 34px)", ctx()), 0)
  assert.equal(evalLength("calc(env(safe-area-inset-top) + 20px)", ctx()), 20)
  assert.equal(evalLength("max(10px, env(safe-area-inset-left))", ctx()), 10)
})

test("a published custom property beats the env() behind it", () => {
  const raw = "calc(var(--x-safe-top, env(safe-area-inset-top, 0px)) + 8px)"
  assert.equal(evalLength(raw, ctx()), 8, "unpublished: falls through to a zero env()")
  assert.equal(evalLength(raw, ctx({ "--x-safe-top": "24px" })), 32)
  // …including when the true inset IS zero, which is the case a missing write
  // is indistinguishable from until a child picks up a notched phone.
  assert.equal(evalLength(raw, ctx({ "--x-safe-top": "0px" })), 8)
})

test("calc, min, max, clamp and the viewport units", () => {
  assert.equal(evalLength("calc(10px + 2 * 5px)", ctx()), 20)
  assert.equal(evalLength("calc((10px + 6px) / 2)", ctx()), 8)
  assert.equal(evalLength("min(30px, 12px)", ctx()), 12)
  assert.equal(evalLength("clamp(10px, 4vmin, 20px)", ctx({}, 400, 800)), 16)
  assert.equal(evalLength("clamp(10px, 1vmin, 20px)", ctx({}, 400, 800)), 10)
  assert.equal(evalLength("10vw", ctx({}, 400, 800)), 40)
  assert.equal(evalLength("10vh", ctx({}, 400, 800)), 80)
  assert.equal(evalLength("5vmax", ctx({}, 400, 800)), 40)
  assert.equal(evalLength("50%", ctx({}, 400, 800, 300)), 150)
})

test("an expression the evaluator does not understand throws rather than guessing", () => {
  assert.throws(() => evalLength("anchor-size(10px)", ctx()), /does not know the function/)
  assert.throws(() => evalLength("var(--nope)", ctx()), /neither published nor given a fallback/)
})

test("a padding shorthand overwrites all four longhands", () => {
  // The second defect in SIEGE, as a unit: three safe-area longhands declared
  // above, one `padding: 8px` below, and the safe area is gone on every
  // landscape phone.
  assert.deepEqual(expandBox("1px 2px 3px 4px"), {
    top: "1px",
    right: "2px",
    bottom: "3px",
    left: "4px",
  })
  assert.deepEqual(expandBox("1px 2px"), { top: "1px", right: "2px", bottom: "1px", left: "2px" })
  assert.deepEqual(expandBox("calc(1px + 2px) 3px"), {
    top: "calc(1px + 2px)",
    right: "3px",
    bottom: "calc(1px + 2px)",
    left: "3px",
  })

  const rules = parseCss(`
    .a { padding: 20px; padding-bottom: 48px; padding-left: 47px; }
    @media (max-height: 619px) { .a { padding: 8px; } }
  `)
  const tall = paddingOf(rules, ".a", { w: 400, h: 800 }, new Map())
  assert.equal(tall.bottom, 48)
  const short = paddingOf(rules, ".a", { w: 800, h: 400 }, new Map())
  assert.equal(short.bottom, 8, "the shorthand did not reset the longhand")
  assert.equal(short.left, 8)
})

test("document order decides between equal selectors, and @keyframes never enters the cascade", () => {
  const rules = parseCss(`
    /* a comment { with braces } must not confuse the parser */
    .a { top: 10px; }
    .a { top: 20px; }
    @keyframes spin { 0% { top: 999px; } 100% { top: 999px; } }
  `)
  assert.equal(lengthOf(rules, ".a", "top", { w: 400, h: 800 }, new Map()), 20)
})

test("a media query only applies at the viewports it matches", () => {
  const rules = parseCss(`
    .a { left: 10px; }
    @media (max-width: 360px) { .a { left: 4px; } }
    @media (min-width: 900px) and (min-height: 620px) { .a { left: 30px; } }
    @media (prefers-reduced-motion: reduce) { .a { left: 999px; } }
  `)
  const at = (w: number, h: number): number => lengthOf(rules, ".a", "left", { w, h }, new Map())
  assert.equal(at(320, 568), 4)
  assert.equal(at(400, 800), 10)
  assert.equal(at(1180, 820), 30)
  assert.equal(at(1180, 400), 10, "an `and` query matched on one condition alone")
})

test("a custom property declared on the element wins for the viewport it was declared at", () => {
  // How a breakpoint changes a pad without a shorthand going near the safe area.
  const rules = parseCss(`
    .a { --pad: 20px; padding: 0 0 calc(var(--x-safe-bottom, env(safe-area-inset-bottom, 0px)) + var(--pad)) 0; }
    @media (max-height: 619px) { .a { --pad: 8px; } }
  `)
  const published = vars({ "--x-safe-bottom": "48px" })
  assert.equal(paddingOf(rules, ".a", { w: 400, h: 800 }, published).bottom, 68)
  assert.equal(paddingOf(rules, ".a", { w: 800, h: 400 }, published).bottom, 56)
})

test("a selector in a comma list is found", () => {
  const rules = parseCss(`.a, .b { top: 7px; }`)
  assert.equal(lengthOf(rules, ".b", "top", { w: 400, h: 800 }, new Map()), 7)
})

test("envReadDirectly names every env() that is not a var() fallback", () => {
  assert.deepEqual(
    envReadDirectly(
      `.a { top: var(--mn-safe-top, env(safe-area-inset-top, 0px)); }`,
      "--mn-safe-",
    ),
    [],
  )
  const bad = envReadDirectly(`.a { bottom: max(10px, env(safe-area-inset-bottom)); }`, "--mn-safe-")
  assert.equal(bad.length, 1)
  assert.match(bad[0] as string, /read directly/)
  // A comment discussing env() is not a rule.
  assert.deepEqual(envReadDirectly(`/* env(safe-area-inset-top) */ .a { top: 0 }`, "--mn-safe-"), [])
})
