// The claims a browser makes that a unit test cannot see — asserted against the
// source, because the failure modes are all silent.
//
// A reflowing slate, a verdict that pushes the keypad down, a reduced-motion
// branch that still travels, an emphasised "Keep going" next to a plain "Done":
// none of these throw, none fail a type check, and a code reviewer reading a
// diff cannot see any of them either. Every one is a rule this program wrote
// down, so every one gets a mechanical check here and a look in a real browser
// in the PR.

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { SLATE_COLUMNS } from "./ladder.ts"
import { strings } from "../app/strings.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const read = (relative: string): string => fs.readFileSync(path.join(here, relative), "utf8")

const workCss = read("work.css")
const practice = read("../screens/Practice.tsx")
const plate = read("ui/Plate.tsx")
const slate = read("ui/ProblemSlate.tsx")
const keypad = read("ui/Keypad.tsx")
const board = read("ui/CountingBoardCard.tsx")
const tokens = read("../design/tokens.css")
const well = read("ui/VerdictWell.tsx")
const cell = read("ui/EntryCell.tsx")
const fraction = read("ui/FractionAnswer.tsx")
const choice = read("ui/ChoiceAnswer.tsx")
const grid = read("ui/ColumnGrid.tsx")
const answerSurface = read("ui/AnswerSurface.tsx")

test("the slate reservation in CSS matches the ladder it was computed from", () => {
  // Written in two languages, so they can drift. One numeral column per digit
  // the ladder can write, plus one for the operator gutter.
  const declared = /--dw-slate-columns:\s*(\d+)/.exec(workCss)
  assert.ok(declared !== null, "work.css declares no --dw-slate-columns")
  assert.equal(Number(declared[1]), SLATE_COLUMNS + 1)
})

test("the slate reservation actually binds — a width, not a minimum", () => {
  // It shipped as `min-width` and never bound: the operator row sized the box
  // past it, so the slate measured 115.22 px on a two-digit rung against
  // 140.72 px on a four-digit one — `Q-01`'s reflow. Two halves: the box is
  // declared, and nothing in the flow can outgrow it.
  const rule = /\.dw-slate\s*\{([\s\S]*?)\n {2}\}/.exec(workCss)
  assert.ok(rule !== null, "work.css has no .dw-slate rule")
  // Declarations only. The comment explaining why it is not a `min-width` says
  // "min-width", and a test that reads prose rather than CSS is a test that
  // fails on its own explanation.
  const body = (rule[1] ?? "").replace(/\/\*[\s\S]*?\*\//g, "")
  assert.match(body, /(?<!min-)width:\s*calc\(var\(--dw-slate-columns\)/)
  assert.ok(!/min-width/.test(body), "the reservation is a minimum again, and minimums do not bind")

  // …and the operator is positioned, not laid out. In the flow it is the thing
  // that sized the box.
  const operatorRow = /<span className="absolute[^"]*"[\s\S]{0,80}OPERATOR\[problem\.op\]/.exec(slate)
  assert.ok(operatorRow !== null, "the slate's operator is back in the flow")
})

test("the verdict row is in the layout before there is a verdict", () => {
  // Feedback changes what is in the well, never whether the well exists. A
  // conditionally rendered verdict is the reflow the design rules forbid.
  //
  // There is one well and four answer surfaces. It moved out of `ProblemSlate`
  // when the fraction, choice and column surfaces arrived, because four copies
  // of a live region is four chances to ship one that announces nothing — which
  // is a thing that has already happened here once.
  assert.match(workCss, /\.dw-verdict-well\s*\{[^}]*min-height/)
  assert.match(well, /dw-verdict-well/)
  assert.ok(
    !/\{feedback\s*(!==|===)\s*null\s*\?[\s\S]{0,40}<div/.test(well),
    "the well itself is behind a conditional",
  )
  // …and every surface that can hold an answer mounts it, unconditionally.
  for (const [name, source] of [
    ["ProblemSlate.tsx", slate],
    ["AnswerSurface.tsx", answerSurface],
  ] as const) {
    assert.match(source, /<VerdictWell feedback=\{feedback\} \/>/, `${name} does not mount the well`)
  }
  // Exactly one of the two is on any given card. The slate owns `integer` — the
  // answer is written on the same numeral columns the problem is — and every
  // other schema gets the statement alone plus an `AnswerSurface`. Drawing the
  // full slate on a column card left an empty brass answer rule between the
  // subtraction bar and the grid, and a *second* live region under it.
  assert.match(practice, /card\.exercise\.schema\.kind === "integer" \|\| entry === null \? \(/)
  assert.match(practice, /<ProblemStatement key=\{card\.exercise\.exerciseId\}/)
  assert.match(answerSurface, /schema\.kind === "fraction" \?/)
  assert.ok(
    !/<VerdictWell/.test(read("ui/ColumnGrid.tsx")),
    "the grid carries a second verdict well",
  )
})

test("input settles a reaction; the clock does not", () => {
  // The whole of the headline bug, as a shape. `settleNow()` on the first line
  // of every input handler is protection for the child — nobody waits on an
  // animation. Routing the hold timer through the same door was not: the hold
  // is 420 ms and the MECHANISM is 1800, so the app's own auto-advance killed
  // every reaction above SEAT at about a quarter of its budget, mid-motion.
  // Measured at 38 → 594 ms of an 1800 ms tier, in the real app.
  //
  // Two entry points, and the timer takes the one that does not settle.
  assert.match(practice, /setTimeout\(autoAdvance, hold\)/, "the hold timer calls something else")
  assert.ok(
    !/setTimeout\(next\b/.test(practice),
    "the hold timer is routed through `next`, which settles the reaction",
  )

  // …and `next` is still what a finger and a key get.
  assert.match(practice, /onPress=\{next\}/, "the Next plate no longer settles")
  assert.match(practice, /else next\(\)/, "Enter no longer settles")

  const storeSource = read("store.ts")
  const body = (name: string): string =>
    new RegExp(`\\n  ${name}: \\([^)]*\\) => \\{([\\s\\S]*?)\\n  \\},`).exec(storeSource)?.[1] ?? ""
  assert.match(body("press"), /^\s*settleReactions\(\)/, "press does not settle first")
  assert.match(body("commitAnswer"), /^\s*settleReactions\(\)/, "commitAnswer does not settle first")
  assert.ok(
    !/settleReactions\(\)/.test(body("autoAdvance")),
    "the auto-advance settles the reaction it was supposed to let play",
  )
})

test("the keypad is disabled while a verdict shows, not unmounted", () => {
  // Unmounting it pulls the action row up the screen at the exact moment the
  // child is looking at their answer.
  assert.match(practice, /disabled=\{feedback !== null\}/)
  assert.ok(
    !/feedback === null \? \(\s*<Keypad/.test(practice),
    "the keypad is conditionally rendered on feedback",
  )
})

test("reduced motion is a branch with no travel in it", () => {
  const reduced = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n {2}\}/.exec(workCss)
  assert.ok(reduced !== null, "work.css has no reduced-motion branch")
  const stillName = /animation-name:\s*([a-z-]+)/.exec(reduced[1] ?? "")?.[1]
  assert.ok(stillName !== undefined)
  assert.notEqual(stillName, "dw-seat-in", "reduced motion reuses the travelling keyframes")

  const keyframes = new RegExp(`@keyframes ${stillName}\\s*\\{([\\s\\S]*?)\\n  \\}`).exec(workCss)
  assert.ok(keyframes !== null, `work.css has no @keyframes ${stillName}`)
  assert.ok(!/transform/.test(keyframes[1] ?? ""), "the reduced-motion keyframes still move the card")
})

test("the stopping point offers two plates and emphasises neither", () => {
  // `P-10`. There is exactly one control shape on this surface and no
  // emphasised variant to reach for, which is what makes equal weight
  // structural rather than a thing someone eyeballs in a screenshot.
  const stopping = /session\.stopping \? \(([\s\S]*?)<\/>/.exec(practice)
  assert.ok(stopping !== null, "the stopping point is not where this test thinks it is")
  const branch = stopping[1] ?? ""
  assert.equal((branch.match(/<Plate\b/g) ?? []).length, 2, "the stopping point is not exactly two plates")
  assert.match(branch, /strings\.practice\.done/)
  assert.match(branch, /strings\.practice\.keepGoing/)
  assert.ok(
    !/className=|variant=|primary|emphas/i.test(branch),
    "a stopping plate is styled differently from its pair",
  )
  // …and there is no such prop to pass. A declaration, not a mention: the
  // component's own comment explains why the variant does not exist.
  assert.ok(
    !/\b(variant|primary|emphasis|tone)\s*[?:]/.test(plate),
    "Plate.tsx has grown an emphasised variant",
  )
})

test("touch targets are big enough for a child's finger, at every viewport height", () => {
  // ≥2 cm on the diagonal, computed from the vertical scale rather than read
  // off one class name. The key height now comes down under 720 px of viewport
  // height so the surface fits a short phone at all, and the thing that must
  // hold across that change is the target, not the number.
  //
  // Width is the constraint that makes the short one legal: at 320 px — the
  // narrowest width this app ships to — the frame leaves 248 px for three
  // columns and two 8 px gaps, so a key is 77 px across. The diagonal is what
  // a finger lands on.
  assert.match(keypad, /min-h-\[var\(--dw-key-height\)\]/, "the keypad names its own height again")

  const heights = [...tokens.matchAll(/--dw-key-height:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16)
  assert.ok(heights.length >= 2, "the vertical scale has no short-viewport key height")

  // The narrowest a key can be: 320 px, less the frame's 16 px each side, less
  // the roomiest recess padding in the scale, less two 8 px gaps, over three
  // columns. Conservative on purpose — the short rungs pad *less*, so their
  // keys are wider than this — and derived from the stylesheet rather than
  // pinned, so a change to the padding scale is a change to this number.
  const pads = [...tokens.matchAll(/--dw-frame-pad:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16)
  const width = (320 - 2 * 16 - 2 * Math.max(...pads) - 2 * 8) / 3

  // 2 cm at the 96 dpi CSS reference is 75.6 px.
  for (const height of heights) {
    const diagonal = Math.hypot(width, height)
    assert.ok(
      diagonal >= 75.6,
      `a ${String(Math.round(width))} × ${String(height)} key is ${String(Math.round(diagonal))} px on the diagonal, under 2 cm`,
    )
  }
})

test("the commit control is reachable without scrolling, at any viewport height", () => {
  // Measured in a browser by `bench-reactions.mjs`; asserted here as the
  // mechanism that makes it true, because the failure is silent. At 320 × 568
  // and 360 × 640 the document was 878 px and the Check plate's bottom edge sat
  // at 833 — below the fold at both — so a child on a small phone scrolled to
  // submit every single answer. Two halves: the surface comes down a scale on
  // shorter viewports until it fits, and the plate that ends a card is pinned
  // to the viewport rather than to the end of the stack.
  assert.match(practice, /sticky bottom-\[var\(--safe-bottom\)\]/, "the action row is not pinned")
  // Above the home indicator, not under it.
  assert.ok(!/sticky bottom-0\b/.test(practice), "the action row is pinned under the safe-area inset")
  // …and it carries a ground, or the keypad scrolls through it.
  const pinned = /className="([^"]*sticky[^"]*)"/.exec(practice)?.[1] ?? ""
  assert.match(pinned, /bg-ground-sunk/, "the pinned row is transparent")

  // Every metric on the vertical budget comes down at every rung. One that does
  // not is how the budget stops adding up: the first cut of this scale left the
  // lintel out and 320 × 568 missed by five pixels, which is the same failure
  // as missing by two hundred.
  const rungs = ["max-height: 900px", "max-height: 720px", "max-height: 620px"]
  const shrinking = [
    "--dw-frame-pad",
    "--dw-stack-gap",
    "--dw-stack-gap-tight",
    "--dw-surface-pad",
    "--dw-lintel-pad",
  ]
  for (const rung of rungs) {
    const block = new RegExp(`@media \\(${rung}\\) \\{([^}]*)\\}`).exec(tokens)?.[1]
    assert.ok(block !== undefined, `the vertical scale has no ${rung} rung`)
    for (const token of shrinking) {
      assert.match(block, new RegExp(`${token}:`), `${token} does not come down at ${rung}`)
    }
  }
  // The two shortest rungs also give up type and target size, which the roomier
  // one does not have to.
  for (const rung of ["max-height: 720px", "max-height: 620px"]) {
    const block = new RegExp(`@media \\(${rung}\\) \\{([^}]*)\\}`).exec(tokens)?.[1] ?? ""
    for (const token of ["--dw-band-height", "--dw-key-height", "--dw-numeral-size"]) {
      assert.match(block, new RegExp(`${token}:`), `${token} does not come down at ${rung}`)
    }
  }
})

test("Enter belongs to the card, even from inside the answer", () => {
  // The trap, as a shape. Every cell of a multi-field answer is a `<button>`,
  // and the screen's Enter handler skips buttons because Enter on a plate is
  // that plate's activation — so a keyboard user who tabbed into a numerator was
  // *inside the answer with no way out*. One attribute separates the two, and
  // every entry control carries it.
  assert.match(practice, /element instanceof HTMLButtonElement && !element\.hasAttribute\("data-dw-entry"\)/)
  assert.match(practice, /!isControl\(document\.activeElement\)/)
  for (const [name, source] of [
    ["EntryCell.tsx", cell],
    ["ChoiceAnswer.tsx", choice],
  ] as const) {
    assert.match(source, /data-dw-entry=/, `${name} is a control Enter cannot escape`)
  }
  // The plates do not carry it, or Enter on "Keep going" would advance twice.
  assert.ok(!/data-dw-entry/.test(plate), "the plate claims to be part of the answer")
})

test("keyboard and keypad take the same table, so a key cannot work in one and not the other", () => {
  // The screen used to spell out three keys and know nothing about the other
  // two. It is one function in `entry.ts` now: digits, the decimal separator
  // (`.` and the `,` a European layout has instead), the fraction bar, delete
  // and clear.
  assert.match(practice, /entryKeyFromKeyboard\(event\.key\)/)
  assert.ok(!/event\.key === "Backspace"/.test(practice), "the screen still owns its own key table")
  assert.ok(!/glyphFromKey/.test(practice))
})

test("focus is visible on every cell a child can reach, and the current one is named", () => {
  // Two things, both needed: `focus-visible` is where the keyboard is, and
  // `aria-current` is where the *keypad* is writing.
  for (const [name, source] of [
    ["EntryCell.tsx", cell],
    ["ChoiceAnswer.tsx", choice],
  ] as const) {
    assert.match(source, /focus-visible:outline-2/, `${name} has no visible focus ring`)
    assert.match(source, /outline-\[var\(--dw-focus\)\]/, `${name} rings in something other than the token`)
    assert.match(source, /currentTarget\.focus\(\)/, `${name} leaves focus behind on a tap`)
    assert.match(source, /onFocus=/, `${name} does not follow Tab`)
  }
})

test("an answer cell is a target a child can hit, at every viewport height", () => {
  // Computed from the same vertical scale the keypad's floor is. A fraction cell
  // and a column cell are the smallest things a finger has to land on here.
  assert.match(cell, /min-h-\[var\(--dw-cell-height\)\]/)
  assert.match(cell, /min-w-\[var\(--dw-cell-width\)\]/)
  const heights = [...tokens.matchAll(/--dw-cell-height:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16)
  const widths = [...tokens.matchAll(/--dw-cell-width:\s*([\d.]+)rem/g)].map((m) => Number(m[1]) * 16)
  assert.equal(heights.length, widths.length)
  assert.ok(heights.length >= 3, "the cell scale does not come down with the rest of the surface")

  // The width is set by how many columns must fit inside 320 px, so the two
  // constraints are checked together: a hittable diagonal, and six columns that
  // fit at the narrowest width this app ships to.
  for (const [i, height] of heights.entries()) {
    const width = widths[i] ?? 0
    assert.ok(
      Math.hypot(width, height) >= 40,
      `a ${String(width)} × ${String(height)} cell is under the floor`,
    )
    assert.ok(6 * width + 5 * 4 <= 320 - 2 * 16, `six columns of ${String(width)} px do not fit in 320 px`)
  }
})

test("a grid wider than the frame scrolls inside its own box", () => {
  // `MAX_DIGITS` is 6 today. The page body must never scroll sideways, so the
  // one thing that can outgrow the frame carries its own overflow.
  assert.match(grid, /overflow-x-auto/)
  assert.match(grid, /w-fit/, "the grid stretches instead of scrolling")
})

test("input is bound on pointerdown, not click", () => {
  // A click resolves ~100 ms after the finger lands. Every keypress budget in
  // EXPERIENCE_DESIGN is written against the frame the finger is in.
  assert.match(keypad, /onPointerDown/)
  assert.match(plate, /onPointerDown/)
  // …and a keyboard still works, because keyboards send no pointer events.
  assert.match(keypad, /event\.detail === 0/)
  assert.match(plate, /event\.detail !== 0/)
})

test("no inline style anywhere on the surface — the CSP forbids it outright", () => {
  // `style-src 'self'` with no `unsafe-inline`. A `style={{…}}` prop is silently
  // dropped in the WebView and works perfectly in a dev browser.
  for (const [name, source] of [
    ["Practice.tsx", practice],
    ["Plate.tsx", plate],
    ["ProblemSlate.tsx", slate],
    ["Keypad.tsx", keypad],
    ["CountingBoardCard.tsx", board],
    ["VerdictWell.tsx", well],
    ["EntryCell.tsx", cell],
    ["FractionAnswer.tsx", fraction],
    ["ChoiceAnswer.tsx", choice],
    ["ColumnGrid.tsx", grid],
    ["AnswerSurface.tsx", answerSurface],
  ] as const) {
    assert.ok(!/style=\{/.test(source), `${name} sets an inline style`)
  }
})

test("nothing on the surface names a misconception to a child", () => {
  // `M-16`. The ids are internal; a learner-facing string that says
  // "borrow-across-zero", "mistake", "error" or "wrong" is a bug.
  const banned = /mis\.|misconception|mal-?rule|mistake|incorrect|wrong/i
  for (const [key, value] of Object.entries(strings.practice)) {
    assert.ok(!banned.test(value), `strings.practice.${key} names a defect: ${value}`)
  }
  // The board renders the misconception's *consequence*, never its name.
  assert.ok(!/misconception/.test(board.split("*/").slice(1).join("*/")), "the board renders a rule id")
})

test("the practice surface costs twenty-four strings and no status copy", () => {
  // Every string is five translations. This is the check that stops the count
  // creeping, and the list is here so adding one is a visible decision.
  //
  // Sixteen of the twenty-four are text alternatives (`Q-10`), each replacing
  // something announced as nothing at all: the well was the empty string after a
  // correct answer, the operators were `aria-hidden` so an item read as "95 19",
  // the counting board was twenty `aria-hidden` circles, a fraction read as
  // "3 4", a grid as loose digits, a number line and a scale as nothing.
  //
  // One of the ten added here is read by a child rather than by a screen reader:
  // `nextField`, on the key that moves from a numerator to a denominator. Still
  // no status copy, no encouragement, no narration.
  assert.deepEqual(Object.keys(strings.practice).sort(), [
    "answer",
    "balanceAlt",
    "balanceLeft",
    "balanceLevel",
    "balanceRight",
    "boardCloses",
    "boardPlace",
    "boardSpare",
    "boardSum",
    "check",
    "correct",
    "delete",
    "denominator",
    "done",
    "keepGoing",
    "lineAlt",
    "minus",
    "next",
    "nextField",
    "numerator",
    "plus",
    "rebuild",
    "regroup",
    "wholePart",
  ])
})

test("every representation on this surface has a text alternative", () => {
  // `Q-10`, from the first representation authored. The board was `role`-less
  // divs of `aria-hidden` spans: bare place numerals, no counts, nothing saying
  // which plate rebuilds the number, and "this one is right" carried by
  // `text-seat` versus `text-strike`. Colour is not an alternative.
  assert.match(board, /role="img"/)
  assert.match(board, /aria-label=\{plateLabel\(/)
  for (const key of ["boardSum", "boardPlace", "boardSpare", "boardCloses"] as const) {
    assert.ok(board.includes(`strings.practice.${key}`), `the board never reads ${key}`)
  }

  // Both verdict states put something non-visual in the live region. An
  // `aria-hidden` mark and a bare number announce "" and "2203" respectively,
  // and `line-through` is not exposed to assistive technology at all.
  assert.match(well, /role="status"/)
  assert.match(well, /sr-only">\{strings\.practice\.correct\}/)
  assert.match(well, /sr-only">\{strings\.practice\.answer\}/)

  // The three answer surfaces the slate cannot hold. A fraction is two numbers
  // in a stack and reads as "3 4" without a name on each cell; a column grid is
  // a row of loose digits; a closed list of numbers is four unnamed buttons with
  // no count and no way to hear which is chosen.
  assert.match(cell, /aria-label=\{label\}/, "an answer cell has no name")
  assert.match(cell, /"aria-current"/, "nothing says which cell the keypad writes into")
  for (const key of ["numerator", "denominator", "wholePart"] as const) {
    assert.ok(fraction.includes(`strings.practice.${key}`), `the fraction never names its ${key}`)
  }
  assert.match(grid, /aria-label=\{strings\.practice\.regroup\}/)
  assert.match(grid, /placeLabel\(column, schema\.decimalPlaces\)/, "grid cells are not named by place")
  assert.match(choice, /role="radiogroup"/)
  assert.match(choice, /role="radio"/)
  assert.match(choice, /aria-checked=\{chosen\}/, "nothing says which option is chosen")
  // …and chosen is not carried by colour: the option is inset and edged.
  assert.match(choice, /chosen\s*\n?\s*\? "border-line-strong border-l-4/)

  // The operator is spoken, not just drawn. Hidden with nothing in its place,
  // `95 − 19` reads as "95 19".
  assert.match(slate, /sr-only">\{OPERATOR_WORD\[problem\.op\]\}/)
  assert.match(board, /sr-only">\{strings\.practice\.minus\}/)
})

test("being right is a visible event on the answer row, not a mark beside it", () => {
  // `energy(SLIP) < energy(SEAT)` was structurally inverted: correct was an 8 px
  // `aria-hidden` lozenge held 420 ms, wrong stopped the app, printed the answer,
  // waited, and — when diagnosed — handed over the only illustration in the
  // product. PR-2.6 closes it properly; the answer row seating is what this build
  // can honestly do, and it must not quietly go away.
  assert.match(workCss, /\.dw-seated\s*\{/)
  assert.match(slate, /seated \? "dw-seated"/)
  assert.match(slate, /border-seat/)
  // No layout in it. A seated answer that changes a size moves the keypad.
  const seatedRule = /\.dw-seated\s*\{([\s\S]*?)\n {2}\}/.exec(workCss)
  assert.ok(seatedRule !== null)
  assert.ok(
    !/(^|[^-])(width|height|padding|margin|border-width|font-size):/.test(seatedRule[1] ?? ""),
    "the seated state changes the box",
  )

  // …and it survives the dark recut. `ground-sunk` is `basalt-950` under
  // `.dw-dark`, the same basalt as the surface the slate sits on, so a recess
  // drawn with it is invisible in dark — the bug that ate the subtraction bar,
  // found in a screenshot and nowhere else.
  assert.ok(
    !/background-color:\s*var\(--dw-ground-/.test(seatedRule[1] ?? ""),
    "the seated recess is drawn with a ground that collapses in dark",
  )
  assert.match(seatedRule[1] ?? "", /background-color:\s*var\(--dw-seat-ground\)/)
  assert.match(tokens, /:root\s*\{[\s\S]*?--dw-seat-ground:/)
  assert.match(tokens, /\.dw-dark\s*\{[\s\S]*?--dw-seat-ground:/)
})
