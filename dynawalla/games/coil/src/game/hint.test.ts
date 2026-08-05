// THE HINT, AND THE THREE THINGS IT IS NOT ALLOWED TO BE.
//
// *"needs more hints, hints don't fit on mobile."*
//
// Three properties are gated here and each of them is a thing the founder has
// already ruled out somewhere in this fleet:
//
//   1. **It cannot cost anything and it cannot read the child.** The quiet
//      before the first picture is a pure function of the ITEM and monotone
//      non-decreasing in it — a demand that needs more change buys more silence,
//      never less. Nothing about how the child is doing goes in.
//   2. **The clock never states the answer.** Time alone reaches `FREE_STAGES`
//      and stops. The picture that pins the exact joint is something a child
//      asks for with a thumb.
//   3. **It has to be true.** `planFor` is the live marker, and a marker that
//      points at the wrong link is worse than no marker: a child who follows it
//      gets slag. So it is followed, exhaustively, on every demand the game can
//      serve — crack where it says, cut where it says, and the piece that comes
//      away must BE the demand.

import assert from "node:assert/strict"
import test from "node:test"

import {
  FREE_STAGES,
  HINT_DWELL_MS,
  HINT_DWELL_PER_BREAK_MS,
  HINT_STAGES,
  firstHintMs,
  planFor,
  scheduledStage,
} from "./hint.ts"
import { breakAt, breaksNeeded, canBreak, coilOf, suffixValue, valueOf } from "./place.ts"

test("the quiet is pure in the item and never shortens as the item hardens", () => {
  // The law THE LATTICE holds its own hint to, asserted the same way: not by
  // reading the implementation but by walking the whole range.
  let previous = -1
  for (let breaks = 0; breaks <= 24; breaks++) {
    const ms = firstHintMs({ breaks })
    assert.ok(
      ms >= previous,
      `a demand needing ${String(breaks)} breaks got ${String(ms)}ms of quiet, less than the one before it`,
    )
    assert.equal(ms, firstHintMs({ breaks }), "firstHintMs is not pure")
    previous = ms
  }
  assert.equal(firstHintMs({ breaks: 0 }), HINT_DWELL_MS)
  assert.equal(firstHintMs({ breaks: 2 }), HINT_DWELL_MS + HINT_DWELL_PER_BREAK_MS * 2)
  // Nonsense in, silence out — never a hint that arrives instantly.
  assert.ok(firstHintMs({ breaks: Number.NaN }) >= HINT_DWELL_MS)
  assert.ok(firstHintMs({ breaks: -5 }) >= HINT_DWELL_MS)
})

test("a child who is getting on with it never sees a hint at all", () => {
  const item = { breaks: 2 }
  const first = firstHintMs(item)
  for (const ms of [0, 100, 1_000, first - 1]) {
    assert.equal(scheduledStage(ms, item), 0, `a hint appeared after ${String(ms)}ms of stillness`)
  }
  assert.equal(scheduledStage(first, item), 1)
  assert.equal(scheduledStage(-1, item), 0)
  assert.equal(scheduledStage(Number.NaN, item), 0)
})

test("the clock stops short of the picture that states the answer", () => {
  // `mount.ts` caps the schedule at `FREE_STAGES`; what is asserted here is that
  // the cap is in the right place. Stage 3 puts a ghost of the jaws on the joint
  // to cut at, which IS the answer, so the free stages must end before it.
  assert.ok(FREE_STAGES < HINT_STAGES, "every stage is free, so the clock states the answer")
  assert.equal(FREE_STAGES, 2, "the free stages no longer end where THE PLACE begins")
})

test("the marker points at a link that can actually be opened", () => {
  // A marker pointing at a bead — which cannot be cracked — would be an
  // instruction a child cannot follow.
  for (let coil = 1; coil <= 400; coil++) {
    for (const demand of [1, 7, 9, 25, 48, 96, coil]) {
      if (demand > coil) continue
      const links = coilOf(coil)
      const plan = planFor(links, demand)
      if (plan.breakIndex < 0) continue
      assert.ok(
        canBreak(links, plan.breakIndex),
        `coil ${String(coil)}, demand ${String(demand)}: the marker points at link ${String(plan.breakIndex)}, which cannot be opened`,
      )
      assert.equal(plan.aim, plan.breakIndex, "the jaws are sent somewhere other than the link to open")
    }
  }
})

test("following the marker takes exactly the demand — every reachable demand", () => {
  // The one that matters. Crack where it says, as many times as it says, then
  // cut where it says, and measure the piece that came away. If the marker is
  // ever wrong the child following it drops slag, loses lane cells, and is
  // punished for taking help — which is the thing this whole feature must not do.
  let checked = 0
  for (let coil = 1; coil <= 220; coil++) {
    for (let demand = 0; demand <= coil; demand++) {
      let links = coilOf(coil)
      if (breaksNeeded(links, demand) < 0) continue
      let guard = 0
      let plan = planFor(links, demand)
      while (plan.breaks > 0) {
        assert.ok(plan.breakIndex >= 0, `coil ${String(coil)} demand ${String(demand)}: breaks needed, no link named`)
        const before = suffixValue(links, plan.cut)
        links = breakAt(links, plan.breakIndex)
        // A break buys resolution, never a different amount. The plan must not
        // be steering the child into changing what they are holding.
        assert.equal(
          valueOf(links),
          coil,
          `coil ${String(coil)} demand ${String(demand)}: opening a link changed the chain's value`,
        )
        assert.ok(before >= 0)
        plan = planFor(links, demand)
        guard++
        assert.ok(guard <= 64, `coil ${String(coil)} demand ${String(demand)}: the marker never converges`)
      }
      assert.equal(
        suffixValue(links, plan.cut),
        demand,
        `coil ${String(coil)} demand ${String(demand)}: the joint the marker names is worth ${String(suffixValue(links, plan.cut))}`,
      )
      checked++
    }
  }
  // A guard on the guard: a loop that silently skipped everything would pass
  // every assertion above it.
  assert.ok(checked > 20_000, `only ${String(checked)} demands were actually followed`)
})

test("the marker agrees with the game's own count of the change needed", () => {
  for (let coil = 1; coil <= 300; coil++) {
    for (const demand of [3, 12, 25, 47, 99, 150]) {
      if (demand > coil) continue
      const links = coilOf(coil)
      assert.equal(
        planFor(links, demand).breaks,
        breaksNeeded(links, demand),
        `coil ${String(coil)}, demand ${String(demand)}: the marker and breaksNeeded disagree`,
      )
    }
  }
})

test("a demand already sitting on the tail asks for no change at all", () => {
  // `72 − 25` is the worked example in the manual and the founder's own sticking
  // point: the tail is two beads, so the marker must name a drum to open.
  const seventyTwo = coilOf(72)
  const twentyFive = planFor(seventyTwo, 25)
  assert.ok(twentyFive.breaks > 0, "25 came off a coil of 72 with no change, which is not possible")
  assert.equal(seventyTwo[twentyFive.breakIndex], 1, "the marker named something other than a ten")

  // And the counterpart: two ones ARE on the tail, so nothing needs opening.
  const two = planFor(seventyTwo, 2)
  assert.equal(two.breaks, 0)
  assert.equal(two.breakIndex, -1)
  assert.equal(suffixValue(seventyTwo, two.cut), 2)
})
