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
  assert.match(workCss, /\.dw-verdict-well\s*\{[^}]*min-height/)
  assert.match(slate, /dw-verdict-well/)
  const well = /dw-verdict-well[\s\S]*?<\/div>/.exec(slate)
  assert.ok(well !== null)
  assert.ok(
    !/\{feedback\s*(!==|===)\s*null\s*\?[\s\S]{0,40}<div/.test(slate),
    "the well itself is behind a conditional",
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

test("touch targets are big enough for a child's finger", () => {
  // ≥2 cm. `min-h-19` is 4.75 rem = 76 px = 2.0 cm at the 96 dpi CSS reference.
  const target = /min-h-(\d+)/.exec(keypad)
  assert.ok(target !== null)
  const rem = Number(target[1]) * 0.25
  assert.ok(rem * 16 >= 75, `keypad targets are ${String(rem * 16)} px, under the 2 cm floor`)
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

test("the practice surface costs fourteen strings and no status copy", () => {
  // Every string is five translations. This is the check that stops the count
  // creeping, and the list is here so adding one is a visible decision.
  //
  // Seven are text alternatives (`Q-10`), each replacing something announced as
  // nothing at all: the verdict well was the empty string after a correct
  // answer, the operators were `aria-hidden` so an item read as "95 19", and the
  // counting board was twenty `aria-hidden` circles.
  assert.deepEqual(Object.keys(strings.practice).sort(), [
    "answer",
    "boardCloses",
    "boardPlace",
    "boardSpare",
    "boardSum",
    "check",
    "correct",
    "delete",
    "done",
    "keepGoing",
    "minus",
    "next",
    "plus",
    "rebuild",
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
  const well = /dw-verdict-well[\s\S]*?\n {8}<\/div>/.exec(slate)
  assert.ok(well !== null, "the verdict well is not where this test thinks it is")
  assert.match(well[0], /sr-only">\{strings\.practice\.correct\}/)
  assert.match(well[0], /sr-only">\{strings\.practice\.answer\}/)

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
