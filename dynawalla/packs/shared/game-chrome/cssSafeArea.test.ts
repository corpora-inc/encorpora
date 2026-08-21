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
  SHAPES,
  auditStylesheet,
  type Shape,
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

/* ── auditStylesheet: the fleet gate's engine ────────────────────────────── */

/** One shape, so a failure names one screen and not ten. */
const NAV: Shape = {
  name: "the founder's phone, portrait",
  w: 393,
  h: 851,
  insets: { top: 24, right: 0, bottom: 48, left: 0 },
}

const audit = (css: string): string[] =>
  auditStylesheet(css, [NAV]).map((v) => `${v.rule}: ${v.message}`)

test("a clean stylesheet audits clean", () => {
  assert.deepEqual(
    audit(`.hud {
      position: absolute;
      bottom: calc(6px + var(--dw-safe-bottom, env(safe-area-inset-bottom, 0px)));
      left: 50%;
    }`),
    [],
  )
})

test("a bare env() is reported wherever it appears", () => {
  const bad = audit(`.hud { position: absolute; bottom: max(6px, env(safe-area-inset-bottom)); }`)
  // TWO reports, and both are wanted: the rule reaches for env() at all, AND the
  // number it actually resolves to puts the element inside the navigation bar.
  // The first says what to change; the second says what it costs a child.
  assert.equal(bad.length, 2, bad.join(" | "))
  assert.match(bad[0] as string, /read directly/)
  assert.match(bad[1] as string, /resolves to 6px, inside the 48px bottom inset/)
})

test("an element hugging ONE edge without paying is reported — the ABYSSAL BLOOM defect", () => {
  // This is the shape of the bug that had no `env()` in it to search for.
  const bad = audit(`.badge { position: absolute; left: 50%; bottom: 6px; }`)
  assert.equal(bad.length, 1, bad.join(" | "))
  assert.match(bad[0] as string, /bottom: 6px resolves to 6px, inside the 48px bottom inset/)
})

test("an element pinned to BOTH ends of an axis is full-bleed and is left alone", () => {
  // Full-bleed is the entire reason `viewport-fit=cover` is set. The water, the
  // light shafts and the particles should run under the rounded corners.
  assert.deepEqual(audit(`.layer { position: absolute; top: 0; bottom: 0; left: 0; right: 0; }`), [])
})

test("a centred element is not accused, because a percentage is declined not guessed", () => {
  // `left: 50%` is centring. Calling it 0px would flag every centred element in
  // the fleet, which is how the first version of this check produced 139 reports
  // for one pack.
  assert.deepEqual(audit(`.mid { position: absolute; left: 50%; top: 50%; }`), [])
})

test("a shorthand in a media query that throws the safe area away is caught", () => {
  // MONUMENT's defect: `padding: 8px` is a SHORTHAND and resets all four
  // longhands, including the three declared above it.
  const css = `
    .tools {
      padding-bottom: max(12px, var(--dw-safe-bottom, env(safe-area-inset-bottom, 0px)));
      padding-left: max(12px, var(--dw-safe-left, env(safe-area-inset-left, 0px)));
    }
    @media (max-width: 420px) { .tools { padding: 8px; } }`
  const bad = audit(css)
  assert.ok(bad.length >= 1, "the shorthand reset was not noticed")
  assert.match(bad.join("\n"), /padding-bottom resolves to 8px .* the bottom inset there is 48px/)
  // …and the same stylesheet WITHOUT the media query is clean, so the report is
  // about the reset and not about the rule above it.
  assert.deepEqual(audit(css.slice(0, css.indexOf("@media"))), [])
})

test("a full-bleed box whose padding starts the text inside the inset is caught", () => {
  // CLAIM's `.cl-card`: `inset: 0` with a flat `padding: 20px`, so the words
  // start 20px in — under a 24px status bar.
  const bad = audit(`.card { position: fixed; top: 0; right: 0; bottom: 0; left: 0; padding: 20px; }`)
  assert.match(bad.join("\n"), /contents start 20px in — inside the 24px top inset/)
  assert.match(bad.join("\n"), /contents start 20px in — inside the 48px bottom inset/)
})

test("an exemption silences a rule, and an empty one does not", () => {
  assert.deepEqual(
    audit(`.badge { --dw-safe-exempt: "inside .card, which is position:relative"; position: absolute; bottom: 6px; }`),
    [],
  )
  for (const excuse of ['""', '"ok"', '"fine"', '"n/a"', '"see above"']) {
    // An empty reason and a two-letter one are the same evasion. The reason IS
    // the mechanism — nobody types "this sits inside the navigation bar" — so a
    // token that could not possibly be an argument does not buy the exemption.
    const bad = audit(`.badge { --dw-safe-exempt: ${excuse}; position: absolute; bottom: 6px; }`)
    assert.equal(bad.length, 1, `${excuse} bought an exemption: ${bad.join(" | ")}`)
    assert.match(bad[0] as string, /reason is empty or too short/)
  }
})

test("a custom property the GAME publishes is a lower bound, not an error", () => {
  // HORDE publishes `--hz-chrome-top` from JavaScript. The audit cannot know it,
  // and treating it as zero is the LOWER BOUND of a length: a rule that clears
  // the inset with the term at zero clears it whatever the term turns out to be.
  assert.deepEqual(
    audit(`.top { position: absolute; left: 0; right: 0;
      top: calc(var(--dw-safe-top, env(safe-area-inset-top, 0px)) + var(--hz-chrome-top)); }`),
    [],
  )
  // …and the lower bound still catches a rule that is short.
  const bad = audit(`.top { position: absolute; left: 0; right: 0;
    top: calc(4px + var(--hz-chrome-top) + 0 * var(--dw-safe-top, env(safe-area-inset-top, 0px))); }`)
  assert.match(bad.join("\n"), /the top inset there is 24px/)
})

test("a font-relative length is a lower bound too, so a correct rule is not accused", () => {
  // MONUMENT's `.mn-combo` is `calc(max(18%, …) + 2.9em)`, and the first version
  // of the tokeniser read `2.9em` as `2.9` followed by an identifier and threw.
  assert.deepEqual(
    audit(`.combo { position: absolute; left: 0; right: 0;
      top: calc(var(--dw-safe-top, env(safe-area-inset-top, 0px)) + 2.9em); }`),
    [],
  )
})

test("a rule that SUBTRACTS the safe area is not read as a promise to exceed it", () => {
  // SPLITBEAT caps its settings panel with
  // `max-height: calc(100% - safe-top - 113px - safe-bottom)`. That is correct,
  // and an earlier version of this check reported the resulting HEIGHT as an
  // inset violation — a gate that cries wolf about a correct rule is a gate
  // somebody switches off.
  assert.deepEqual(
    audit(`.panel { position: absolute; right: 8px;
      top: calc(var(--dw-safe-top, env(safe-area-inset-top, 0px)) + 40px);
      max-height: calc(100% - var(--dw-safe-top, env(safe-area-inset-top, 0px))
        - 113px - var(--dw-safe-bottom, env(safe-area-inset-bottom, 0px))); }`),
    [],
  )
})

test("one wrong declaration is reported ONCE, by the shape that proves it", () => {
  const many = auditStylesheet(`.badge { position: absolute; left: 50%; bottom: 6px; }`, SHAPES)
  assert.equal(
    many.length,
    1,
    `ten shapes produced ${many.length} copies of one defect: ${many.map((v) => v.message).join(" | ")}`,
  )
  assert.match(many[0]?.message ?? "", /founder's phone/)
})

test("a static-only rule with no position is not the safe area's business", () => {
  assert.deepEqual(audit(`.row { padding: 2px 7px; margin-top: 3px; }`), [])
})

test("the media parser understands the queries this fleet actually writes", () => {
  // HORDE's tall-screen breakpoint is `(max-aspect-ratio: 4/5)`, and
  // Number.parseFloat("4/5") is 4 — so a ratio has to be handled before the
  // length path, not after it.
  const css = `.a { top: 0px } @media (max-aspect-ratio: 4/5) { .a { top: 9px } }`
  const rules = parseCss(css)
  assert.equal(lengthOf(rules, ".a", "top", { w: 393, h: 851 }, new Map()), 9)
  assert.equal(lengthOf(rules, ".a", "top", { w: 851, h: 393 }, new Map()), 0)
  const orient = parseCss(`.b { left: 1px } @media (orientation: landscape) { .b { left: 2px } }`)
  assert.equal(lengthOf(orient, ".b", "left", { w: 851, h: 393 }, new Map()), 2)
  assert.equal(lengthOf(orient, ".b", "left", { w: 393, h: 851 }, new Map()), 1)
})
