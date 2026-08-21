// CAN A CHILD READ WHAT THIS GAME WRITES DOWN?
//
// Everything below is computed from the composite. See `legibility.ts` for the
// grounds and for the table of what these measured before anything moved.

import assert from "node:assert/strict"
import test from "node:test"

import { MIN_TEXT, readables, shipped, worst } from "./legibility.ts"

test("every readable thing in the alley clears 4.5:1 on the ground it is set on", () => {
  const rows = readables()
  assert.ok(rows.length >= 16, "the audit lost rows; every piece of type belongs in it")
  for (const r of rows) {
    assert.ok(
      worst(r) >= MIN_TEXT,
      `${r.name} measures ${worst(r).toFixed(2)}:1 against its own ground`,
    )
  }
})

test("the rule of the game was the least legible type on the screen", () => {
  // The defect, pinned. `SHEAR OFF THE LIT NUMBER` is the whole instruction this
  // pack has and it was set in `BONE_DIM` at 0.85 on the lit recess. If a change
  // ever puts it back, this fails rather than the founder finding it again.
  const before = shipped().find((r) => r.name === '"SHEAR OFF THE LIT NUMBER"')
  assert.ok(before)
  assert.ok(worst(before) < 2.6, `the rule already measured ${worst(before).toFixed(2)}:1`)
  const after = readables().find((r) => r.name === '"SHEAR OFF THE LIT NUMBER"')
  assert.ok(after)
  assert.ok(
    worst(after) > worst(before) * 2,
    `the rule went from ${worst(before).toFixed(2)}:1 to ${worst(after).toFixed(2)}:1, which is not a fix`,
  )
})

test("every ink that moved was failing before it moved", () => {
  // The guard against a change that repainted something already fine — which is
  // how a legibility pass turns into a restyle nobody asked for.
  for (const before of shipped()) {
    assert.ok(
      worst(before) < MIN_TEXT,
      `${before.name} already measured ${worst(before).toFixed(2)}:1, so changing its ink was not a legibility fix`,
    )
    const after = readables().find((r) => r.name === before.name)
    assert.ok(after, `${before.name} left the audit`)
    assert.ok(
      worst(after) > worst(before),
      `${before.name} did not get better: ${worst(before).toFixed(2)} → ${worst(after).toFixed(2)}`,
    )
  }
})

test("the furnace's own heat is not what was turned down", () => {
  // The founder's rule is that legibility is won by sparsening the field, never
  // by sanding the effects. Both furnace labels sit on the panel's ember
  // gradient, and that gradient is unchanged — which is exactly why the two
  // labels still measure differently at the two heights they are drawn at. If
  // somebody "fixes" this by flattening the gradient, these stop differing.
  const rows = readables()
  const top = rows.find((r) => r.name === '"FURNACE", something to melt')
  const bottom = rows.find((r) => r.name === "the slag count, some")
  assert.ok(top && bottom)
  assert.ok(
    worst(top) > worst(bottom),
    "the two furnace labels measure the same, so the ember gradient has been flattened",
  )
})
