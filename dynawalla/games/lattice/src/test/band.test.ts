// **"'The lattice' is complete broken farce. 'The ring floats in the middle
// with sum' — there is no fucking ring it says 'no resonator - sweep on'."**
//
// The founder, on a fresh profile, on the shipped 0.3.10 build. He is quoting
// the manual against the screen, and both of them were telling the truth: the
// manual describes a resonator hanging in the middle of the lattice with a
// problem on its face, and the arena was drawing `NO RESONATOR — SWEEP ON`
// because it had one.
//
// ## What it was
//
// Not the hint work. PR 739 (the six-stage factor tree) and PR 762 (one husk at
// t=0, the gentler ramp, the live divisor marking) both landed on top of this
// and neither caused it. It was the host, three days before either of them:
//
//     9de8cef16  fix(dynawalla/host): a pack's difficulty is a hint clamped
//                to ±1 rung of the host's band  (#735)
//
// From that commit a pack's `difficulty` is a **hint**, honoured within
// `HINT_BAND` — one rung — of where the host's own evidence stands, and clamped
// there otherwise. The host's evidence is `progress`, and `progress` opens at
// rung 0 on every session of every fresh profile.
//
// THE LATTICE's floor is rung 16. It asked for rung 16 and it was served rung 1:
// answers of two to six. Nothing under twelve can carry a factor tree, so
// `isResonant` refused all six draws of the arming, `arm` set `stalled`, and the
// HUD drew the line the founder read out.
//
// **And it could not clear.** The only thing that moves the host's `progress` is
// a report; the only thing that produces a report is a resonator opening; and
// there was no resonator. The rearm two and a half seconds later drew from rung
// 1 again, and so did every one after it, for as long as the child sat there.
//
// TREBUCHET had the identical defect for three releases and PR 771 built the way
// out: `minDifficulty`, a **capability** rather than a hint — the pack stating
// what it can physically put on the screen — honoured absolutely, above the
// host's band as well as below it, and never moving the child's ladder. THE
// LATTICE's floor is exactly that kind of claim and had simply never been
// stated. See `game/ladder.ts`, `Request.minDifficulty`.
//
// ## Why the suite did not catch it
//
// Two hundred and seven tests passed throughout. `stubHost.ts` calls itself a
// model of the wire and did not model the band: it served whatever rung it was
// asked for, so the one thing that was wrong was the one thing nothing could
// see. It models it now, by default, and `band: false` is the opt-out for the
// two cases that are measuring the pack's own ladder in isolation.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Arena, REARM_MS } from "../game/arena.ts"
import { CEILING, FLOOR, Ladder, rungOf } from "../game/ladder.ts"
import { CALM_OPENINGS } from "../game/opening.ts"
import { MIN_TARGET } from "../game/resonance.ts"
import { HINT_BAND, createStubHost } from "../stubHost.ts"
import { playCarefully } from "./harness.ts"

const FRAME_MS = 16

/** A fresh profile: the host's own ladder standing on rung 0, like every launch. */
function freshProfile(seed: number, watch?: { asks: Array<number | null> }) {
  return createStubHost({
    seed,
    reducedMotion: true,
    onDraw: (d) => watch?.asks.push(d.bottom),
  })
}

test("every request states the floor the pack cannot draw beneath", () => {
  const ladder = new Ladder()
  for (const at of [0, 5, 20, 60]) {
    for (let i = 0; i < at; i++) ladder.opened()
    for (const request of ladder.requests("add")) {
      assert.equal(
        request.minDifficulty,
        FLOOR,
        "a request went out without the pack's render floor on it",
      )
      // It is a capability and not a position: it does not move with the
      // pack's own ladder, because what the pack can draw does not.
      assert.ok(request.minDifficulty <= request.difficulty + 1e-9)
      assert.ok(request.minDifficulty <= request.maxDifficulty)
    }
  }
})

test("the founder's screen: a fresh profile is served nothing this game can be about", () => {
  // The defect, isolated at the wire, with no arena in it. This is what the pack
  // was handed on every draw of every arming for as long as the child sat there.
  const host = freshProfile(0x1a771ce)
  assert.equal(host.position(), 0, "a fresh profile did not open at the bottom of the ladder")
  let usable = 0
  const n = 400
  for (let i = 0; i < n; i++) {
    // Exactly what the pack sent before PR 771's channel was used: a difficulty
    // and a ceiling, and no statement of what it cannot draw beneath.
    const q = host.next({ domain: "add", difficulty: FLOOR, maxDifficulty: CEILING })
    if (Number(q.answer) >= MIN_TARGET) usable += 1
  }
  assert.equal(usable, 0, `${usable}/${n} draws were usable, so the band is not being modelled`)
  assert.ok(
    host.servedRungs().every((r) => r <= HINT_BAND),
    "a request for rung 16 was served from above the host's own band",
  )

  // And with the floor stated, on the same host, on the same seed.
  const fixed = freshProfile(0x1a771ce)
  let big = 0
  for (let i = 0; i < n; i++) {
    const q = fixed.next({
      domain: "add",
      difficulty: FLOOR,
      maxDifficulty: CEILING,
      minDifficulty: FLOOR,
    })
    if (Number(q.answer) >= MIN_TARGET) big += 1
  }
  assert.ok(big / n > 0.75, `only ${big}/${n} draws reached ${MIN_TARGET} with the floor stated`)
  assert.ok(
    fixed.servedRungs().every((r) => r >= rungOf(FLOOR)),
    "the floor was not honoured above the host's own band",
  )
  // The floor is a capability, so it must not have promoted anybody: the host's
  // model of where this child stands is exactly where `judge` left it.
  assert.equal(fixed.position(), 0, "stating a render floor moved the child's ladder")
})

test("a fresh profile gets a ring, and it is there before the child touches anything", () => {
  // The whole report, through the real arena and the real rearm.
  for (const seed of [0x1a771ce, 0x0c105, 0x5eed, 0xbea7, 0x9a11]) {
    const host = freshProfile(seed)
    const arena = new Arena(host, new Rng(seed ^ 0x51de), {
      width: 900,
      height: 700,
      // A first sitting. Nobody who has never played has an `experience`.
      experience: 0,
    })
    arena.begin(0)
    const res = arena.resonator
    assert.ok(res, `seed ${seed.toString(16)}: no ring on the first frame of a first sitting`)
    assert.equal(arena.stalled, false, `seed ${seed.toString(16)}: the arena opened stalled`)
    assert.ok(
      res.target >= MIN_TARGET,
      `seed ${seed.toString(16)}: the first ring asked for ${res.target}`,
    )
  }
})

test("and the ring keeps coming back, for a whole sitting, from rung nought", () => {
  // The deadlock, which is the part that made it a farce rather than a bad
  // opening: nothing could clear the stall, because clearing it needed a report
  // and a report needed the thing that was missing.
  //
  // Five minutes, from a fresh profile, played properly.
  const frames = Math.round((5 * 60 * 1000) / FRAME_MS)
  for (const seed of [0x1a771ce, 0x5eed]) {
    const host = freshProfile(seed)
    const arena = new Arena(host, new Rng(seed ^ 0x51de), {
      width: 900,
      height: 700,
      experience: CALM_OPENINGS,
    })
    arena.begin(0)
    const played = playCarefully(arena, frames, FRAME_MS)
    assert.ok(
      played.targets.length > 20,
      `seed ${seed.toString(16)}: only ${played.targets.length} rings in five minutes`,
    )
    assert.ok(
      played.longestGapMs <= 3 * REARM_MS,
      `seed ${seed.toString(16)}: ${(played.longestGapMs / 1000).toFixed(1)}s with no ring`,
    )
    // And the child climbed. A floor that pinned the stream at the floor forever
    // would pass everything above this and still be the wrong game.
    assert.ok(
      host.position() > rungOf(FLOOR),
      `seed ${seed.toString(16)}: five minutes of perfect play left the host on rung ` +
        `${host.position()}`,
    )
  }
})
