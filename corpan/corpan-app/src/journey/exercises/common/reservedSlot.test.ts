// Guards the GLOBAL no-reflow invariant (feed-ux): feedback that appears when a
// learner answers must never add flow height to a card — it fills space that
// was reserved up-front (ReservedSlot) or floats as an overlay. jsdom does no
// layout, so pixel reflow can't be measured; instead we prove the STRUCTURE:
//   1. a reserved slot ALWAYS carries a min-height (executed, pure), and
//   2. every exercise that reveals content on answer routes it through
//      ReservedSlot, and the host's answer panel is a non-flow float.
// A regression (a bare on-answer reveal that shoves the tiles) trips this.

import { test } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import path from "node:path"
import fs from "node:fs"
import { reservedSlotClass } from "./reservedSlotClass.ts"

const here = path.dirname(fileURLToPath(import.meta.url))
const exDir = path.resolve(here, "..")
const feedDir = path.resolve(here, "../../feed")
const read = (p: string) => fs.readFileSync(p, "utf8")

test("a reserved slot always pins a min-height (empty or full)", () => {
  // Default and custom both carry a min-h-* floor — that fixed floor is what
  // keeps the box the same size before and after its content appears.
  assert.match(reservedSlotClass(), /\bmin-h-\d/)
  assert.match(reservedSlotClass("min-h-12"), /\bmin-h-12\b/)
  assert.match(reservedSlotClass("min-h-9", "text-sm"), /min-h-9/)
  assert.match(reservedSlotClass("min-h-9", "text-sm"), /text-sm/)
})

// Exercises whose feedback appears on answer must reserve it via ReservedSlot.
for (const file of [
  "ChoicePick.tsx",
  "ListenPick.tsx",
  "ListenType.tsx",
  "Cloze.tsx",
  "WordOrder.tsx",
  "FlipRecall.tsx",
]) {
  test(`${file} reserves its on-answer feedback (imports + uses ReservedSlot)`, () => {
    const src = read(path.join(exDir, file))
    assert.match(src, /import \{ ReservedSlot \} from "\.\/common\/ReservedSlot\.tsx"/, `${file} must import ReservedSlot`)
    assert.match(src, /<ReservedSlot/, `${file} must render a ReservedSlot`)
  })
}

test("ScaffoldHint offers are wrapped in a ReservedSlot, never bare below tiles", () => {
  // The old shape rendered the hint as a bare conditional sibling that pushed
  // the tiles on a first miss. It must now sit inside a reserved slot.
  for (const file of ["ChoicePick.tsx", "ListenPick.tsx", "ListenType.tsx", "Cloze.tsx", "WordOrder.tsx"]) {
    const src = read(path.join(exDir, file))
    // The OLD bare shape gated the hint inline on the live mode + miss count in
    // one ternary — that ternary shipped the ScaffoldHint straight into flow.
    // The reserved shape splits the live gate (outer) from the miss gate
    // (inside ReservedSlot), so this inline signature must be gone.
    assert.doesNotMatch(
      src,
      /mode === "live" && props\.scaffold\.misses === 1/,
      `${file} still renders a bare (un-reserved) ScaffoldHint gate`,
    )
    assert.match(src, /<ReservedSlot[^>]*>[\s\S]*?<ScaffoldHint/, `${file} must wrap ScaffoldHint in a ReservedSlot`)
  }
})

test("TypeInput reserves the scaffold hint line (fills in place)", () => {
  const src = read(path.join(exDir, "common/TypeInput.tsx"))
  assert.match(src, /min-h-\d[^"]*"[^>]*data-testid="journey-type-hint"/, "hint line must have a reserved min-height")
})

test("host answer-reveal is a non-flow float, not a flow panel", () => {
  const src = read(path.join(feedDir, "ActivityCardHost.tsx"))
  // The showAnswer block must be absolutely positioned (overlay) so it never
  // shifts the interactive region on a double-miss fail.
  const idx = src.indexOf("{showAnswer ?")
  assert.ok(idx > 0, "showAnswer block present")
  const block = src.slice(idx, idx + 400)
  assert.match(block, /\babsolute\b/, "showAnswer must be an absolute float, not a flow child")
  assert.match(block, /pointer-events-none/, "showAnswer float should not trap taps")
})
