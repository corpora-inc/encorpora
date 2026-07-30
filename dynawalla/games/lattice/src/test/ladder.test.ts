// **"It stays way too easy way too long."**
//
// The founder played for ten minutes doing it perfectly and saw `2 + 0` over and
// over, finding a 2; then `3 + 0`, finding a 3. The cause was one line: the game
// asked the host for a domain and never for a difficulty, so it played whatever
// rung the host's own ladder was standing on — rung 0 at the start of a session.
//
// These cases hold the three rules that replaced it: a floor because the bottom
// of the ladder has no factor tree in it, a ceiling because `MAX_TARGET` is 999,
// and a position that moves on what the child achieved.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  BARREN,
  CEILING,
  CLIMB,
  FALL,
  FLOOR,
  Ladder,
  MAX_DRAWS,
  OFFSETS,
  OPENING,
  RUNG,
  RUNGS,
  clampToBand,
  rungOf,
} from "../game/ladder.ts"
import { MIN_TARGET } from "../game/resonance.ts"
import { createStubHost, toUnit } from "../stubHost.ts"

test("a session opens on the floor, and the floor is not the bottom of the ladder", () => {
  // The whole fix, in one assertion. `counterweight` opens on rung 1 because its
  // defect was the opposite one; THE LATTICE cannot, because a rung whose answers
  // are 1..3 has nothing to decompose.
  const ladder = new Ladder()
  assert.equal(ladder.at, OPENING)
  assert.equal(OPENING, FLOOR)
  assert.equal(rungOf(FLOOR), 16, "the floor moved off the rung it was measured on")
  assert.ok(FLOOR > 0, "the game opens at the bottom of the ladder, where 2 + 0 lives")
  // On the host's wire this is read as a fraction and not as a ladder index —
  // `toUnit` only reads 1 and above as an index, and the band never reaches 1.
  assert.ok(CEILING < 1, "a request of exactly 1 is read as the BOTTOM of the ladder")
  assert.equal(toUnit(FLOOR), FLOOR)
  assert.equal(toUnit(CEILING), CEILING)
})

test("the floor is where the host's answers can first carry a factor tree", () => {
  // The request is only worth making if the other end honours it, and the point
  // of the floor is the *answers* it produces rather than the number itself.
  const host = createStubHost({ seed: 0x51ee, reducedMotion: true })
  let big = 0
  const n = 300
  for (let i = 0; i < n; i++) {
    const q = host.next({ domain: "add", difficulty: FLOOR, maxDifficulty: CEILING })
    if (Number(q.answer) >= MIN_TARGET) big += 1
  }
  assert.ok(big / n > 0.75, `only ${big}/${n} floor answers reached ${MIN_TARGET}`)
  // And the bottom of the ladder, for contrast: this is what the game used to get.
  const bottom = createStubHost({ seed: 0x51ee, reducedMotion: true })
  let tiny = 0
  for (let i = 0; i < n; i++) {
    if (Number(bottom.next({ domain: "add", difficulty: 0 }).answer) < MIN_TARGET) tiny += 1
  }
  assert.ok(tiny / n > 0.9, `the bottom rung produced ${n - tiny}/${n} usable answers`)
})

test("the ceiling never lets the stream past what a resonator can put on its face", () => {
  const host = createStubHost({ seed: 0xce111, reducedMotion: true })
  const ladder = new Ladder()
  for (let i = 0; i < 40; i++) ladder.opened()
  assert.equal(ladder.at, CEILING, "forty resonators did not peg the ceiling")
  for (const request of ladder.requests("add")) {
    assert.ok(request.difficulty <= CEILING + 1e-9, `a request at ${request.difficulty}`)
    assert.equal(request.maxDifficulty, CEILING)
    // The host floors a ceiling rather than rounding it, so the rung served can
    // never be above the one named.
    assert.ok(rungOf(request.difficulty) <= rungOf(CEILING))
  }
  // And the other end honours it, on the rung it *reports serving* rather than on
  // the number it was handed — a ceiling that the pool can be answered over is not
  // a ceiling, and `question.difficulty` is the only place the truth appears.
  for (let i = 0; i < 60; i++) {
    const q = host.next({ domain: "add", difficulty: CEILING, maxDifficulty: CEILING })
    assert.ok(
      rungOf(q.difficulty) <= rungOf(CEILING),
      `a request capped at rung ${rungOf(CEILING)} was answered from rung ${rungOf(q.difficulty)}`,
    )
  }
  // A request that names only a ceiling is still a request: the host's own
  // position must come down to it. This is `items.next`'s gate, and a stub that
  // ignored it would model the ceiling half of the wire with nothing.
  // `difficulty: 10` and not `1`: on the ladder-index scale 10 is the top, and `1`
  // is `toUnit`'s one ambiguous value, read as the *bottom*. Which is why THE
  // LATTICE speaks the fraction scale — nothing in its band can be misread.
  const high = createStubHost({ seed: 0xce111, reducedMotion: true, difficulty: 10 })
  assert.equal(high.position(), RUNGS - 1)
  assert.equal(toUnit(1), 0, "1 stopped being read as the bottom of the ladder")
  high.next({ domain: "add", maxDifficulty: FLOOR })
  assert.equal(
    high.servedRungs().at(-1),
    rungOf(FLOOR),
    "a ceiling-only request was served from above the ceiling",
  )
})

test("the position moves on resonators and refusals, and on nothing else", () => {
  const ladder = new Ladder()
  ladder.opened()
  assert.ok(Math.abs(ladder.at - (FLOOR + CLIMB)) < 1e-9)
  ladder.opened()
  ladder.opened()
  const climbed = ladder.at
  assert.ok(Math.abs(climbed - (FLOOR + 3 * CLIMB)) < 1e-9)
  // Down further than up: one refusal undoes more than one resonator.
  ladder.refused()
  assert.ok(Math.abs(ladder.at - (climbed - FALL)) < 1e-9)
  assert.ok(FALL > CLIMB, "a refusal costs less than a resonance earns")
  // And a hundred requests move nothing at all — this is not a clock.
  const still = ladder.at
  for (let i = 0; i < 100; i++) ladder.requests("add")
  assert.equal(ladder.at, still, "asking for a question moved the ladder")
})

test("no run of refusals can push the game below its own floor", () => {
  const ladder = new Ladder()
  for (let i = 0; i < 50; i++) ladder.refused()
  assert.equal(ladder.at, FLOOR, "a struggling child was handed a target with no factors in it")
  for (let i = 0; i < 200; i++) ladder.opened()
  assert.equal(ladder.at, CEILING)
})

test("47 + 25 arrives within a handful of resonators", () => {
  // The founder's own example. `dw.add.regroup.add-multidigit` is rung 30 of the
  // shipped ladder — two-digit addition with a carry — and the question is how
  // long a child who is doing well has to wait for it.
  const ladder = new Ladder()
  let opens = 0
  while (rungOf(ladder.at) < 30 && opens < 100) {
    ladder.opened()
    opens += 1
  }
  assert.ok(opens <= 6, `it took ${opens} resonators to reach rung 30`)
  assert.ok(opens >= 3, `rung 30 arrived after ${opens} resonators, which is not a climb`)
})

test("an arming walks outward, nearest rung first, and never repeats one", () => {
  const ladder = new Ladder()
  for (let i = 0; i < 5; i++) ladder.opened() // somewhere in the middle of the band
  const rungs = ladder.requests("add").map((r) => rungOf(r.difficulty))
  assert.equal(rungs[0], rungOf(ladder.at), "the first draw was not at the game's own position")
  assert.equal(new Set(rungs).size, rungs.length, "the same rung was drawn twice in one arming")
  // Six draws and no more, because `next` is synchronous and the refill is not:
  // an arming that fired every offset in one frame ran the host's pool dry and
  // started being handed clones with an empty id, whose answers it then drops.
  assert.equal(rungs.length, MAX_DRAWS, `an arming would spend ${rungs.length} items`)
  assert.ok(MAX_DRAWS < 8, "an arming can drain the reserve a flush guarantees")
  // Six rungs out at most, which is inside the host's own flush band of 0.1 — a
  // walk that reached further would discard the prefetch pool every question.
  for (const rung of rungs) {
    assert.ok(
      Math.abs(rung - rungOf(ladder.at)) <= Math.max(...OFFSETS),
      `a request ${rung - rungOf(ladder.at)} rungs from the position`,
    )
  }
  assert.ok(Math.max(...OFFSETS) * RUNG < 0.1, "the walk is wider than the host's flush band")
  // Nearest first, all the way down: this is what makes the walk a search around
  // where the child is rather than a hop to whichever rung reads roundest.
  const here = rungOf(ladder.at)
  let reach = 0
  for (const rung of rungs) {
    const away = Math.abs(rung - here)
    assert.ok(away >= reach, `the walk went ${away} rungs out and then back to ${reach}`)
    reach = away
  }
})

test("a rung that has never produced anything is tried last, not first", () => {
  // Ten of the thirty-two rungs in the band generate nothing this game can use —
  // `dw.mul.scale.times-power-of-ten` answers 1050 to 921,700,000. Paying an item
  // to find that out again on every single question is four items per resonator
  // instead of two, and every item is a slot in the host's prefetch pool.
  const ladder = new Ladder()
  for (let i = 0; i < 5; i++) ladder.opened()
  const first = ladder.requests("add").map((r) => rungOf(r.difficulty))
  const dead = first[0] as number
  assert.equal(dead, rungOf(ladder.at))
  // One miss is not enough to write a rung off; three are.
  ladder.drew(dead, false)
  assert.equal(
    rungOf((ladder.requests("add")[0] as { difficulty: number }).difficulty),
    dead,
    "a single unlucky draw wrote a rung off",
  )
  ladder.drew(dead, false)
  ladder.drew(dead, false)
  ladder.drew(dead, false)
  assert.ok(ladder.yieldOf(dead) < BARREN, `yield ${ladder.yieldOf(dead)} after four misses`)
  const after = ladder.requests("add").map((r) => rungOf(r.difficulty))
  assert.equal(after.length, MAX_DRAWS)
  assert.ok(
    !after.includes(dead),
    `the barren rung ${dead} was still being paid for while ${OFFSETS.length} live ones were free`,
  )
  // Every rung it *did* offer is one of the offsets, and the nearest ones at that
  // — demoting a rung must not turn the walk into a hop across the band.
  const candidates = OFFSETS.map((o) => rungOf(clampToBand(ladder.at + o * RUNG)))
  for (const rung of after) {
    assert.ok(candidates.includes(rung), `the walk invented rung ${rung}`)
  }
  // A rung that pays keeps its place, and one miss does not demote it.
  const good = first[1] as number
  ladder.drew(good, true)
  assert.ok(ladder.yieldOf(good) >= BARREN)
  assert.ok(ladder.requests("add").map((r) => rungOf(r.difficulty)).includes(good))
})

test("an arming that lands somewhere else takes the position with it", () => {
  // What makes FLOOR and CEILING a hint rather than a dependency: the shipped
  // ladder will grow, and a game pinned to a rung index would go quietly barren.
  const ladder = new Ladder()
  const target = clampToBand(FLOOR + 4 * RUNG)
  ladder.landed(target)
  assert.equal(ladder.at, target)
  ladder.landed(-5)
  assert.equal(ladder.at, FLOOR, "a landing below the band was not clamped")
  ladder.landed(Number.NaN)
  assert.equal(ladder.at, OPENING, "a landing that is not a number poisoned the position")
})

test("the ladder is the length the host says it is", () => {
  assert.equal(RUNGS, 66)
  assert.equal(rungOf(0), 0)
  assert.equal(rungOf(1), RUNGS - 1)
  assert.equal(clampToBand(0), FLOOR)
  assert.equal(clampToBand(1), CEILING)
})
