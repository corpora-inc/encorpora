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

test("the slate reservation in CSS matches the ladder it was computed from", () => {
  // Written in two languages, so they can drift. One numeral column per digit
  // the ladder can write, plus one for the operator gutter.
  const declared = /--dw-slate-columns:\s*(\d+)/.exec(workCss)
  assert.ok(declared !== null, "work.css declares no --dw-slate-columns")
  assert.equal(Number(declared[1]), SLATE_COLUMNS + 1)
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

test("the practice surface costs seven strings and no status copy", () => {
  // Every string is five translations. This is the check that stops the count
  // creeping, and the list is here so adding one is a visible decision.
  assert.deepEqual(Object.keys(strings.practice).sort(), [
    "answer",
    "check",
    "delete",
    "done",
    "keepGoing",
    "next",
    "rebuild",
  ])
})
