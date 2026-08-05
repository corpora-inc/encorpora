/**
 * The drift, in numbers.
 *
 * Every assertion in here was mutation-tested — broken on purpose, watched to
 * fail, restored — because the last generator in this lineage shipped a test
 * that passed with the feature switched off. The two that matter most are
 * "`advance` actually moves the matrix" and "right and wrong move it in
 * opposite directions"; both fail loudly if `Groove.step` is emptied.
 */

import assert from "node:assert/strict"
import { test } from "node:test"

import { BARS_PER_MUTATION, Groove } from "./evolve.ts"
import { MAX_OPENNESS, MIN_AFFINITY, expectedNotes, leanAffinity, type GrooveSpec } from "./groove.ts"
import { MODES } from "./modes.ts"
import { pickSoundscape, type Soundscape } from "./soundscape.ts"

/** The four grids PULSE actually plays, opening to endgame. */
const GRIDS: readonly { name: string; spec: GrooveSpec }[] = [
  { name: "quarters", spec: { beatsPerBar: 4, divs: [1], density: 0.65 } },
  { name: "eighths", spec: { beatsPerBar: 4, divs: [1, 2], density: 0.34 } },
  { name: "triplets", spec: { beatsPerBar: 4, divs: [1, 3], density: 0.28 } },
  { name: "everything", spec: { beatsPerBar: 4, divs: [1, 2, 3, 4], density: 0.12 } },
]

const EIGHTHS = GRIDS[1]!.spec

const scapes = (n: number): Soundscape[] =>
  Array.from({ length: n }, (_, i) => pickSoundscape(i * 2654435761))

/** A groove that has already been shown the grid it is going to be asked about. */
const grooveOn = (scape: Soundscape, spec: GrooveSpec, seed?: number): Groove => {
  const g = new Groove(scape, seed)
  g.matrix(spec)
  return g
}

const play = (g: Groove, bars: number): void => {
  for (let b = 0; b < bars; b += BARS_PER_MUTATION) g.advance(BARS_PER_MUTATION)
}

/**
 * Instants the groove now favours more than the seed did, minus the ones it
 * favours less. The one number that says which way a groove has been steered.
 *
 * Measured on AFFINITY rather than on `p`, deliberately: `p` is renormalised
 * against a fixed budget, so raising one instant lowers every other and the
 * count would be near zero by construction whatever happened.
 */
const netOpened = (g: Groove, spec: GrooveSpec, threshold = 0.12): number => {
  const now = g.matrix(spec)
  const seed = g.seedMatrix(spec)
  let net = 0
  for (let i = 1; i < now.length; i++) {
    const delta = (now[i]?.affinity ?? 0) - (seed[i]?.affinity ?? 0)
    if (delta >= threshold) net++
    else if (delta <= -threshold) net--
  }
  return net
}

// ── the seam in `groove.ts` ──────────────────────────────────────────────────

test("a lean moves an instant inside the range the mode already allowed it", () => {
  // The bounds hold by construction, not by clamping — which is why a drifted
  // matrix passes the same invariants an undrifted one does.
  assert.equal(leanAffinity(0.6, 0), 0.6)
  assert.equal(leanAffinity(0.6, 1), 1)
  assert.equal(leanAffinity(0.6, -1), MIN_AFFINITY)
  assert.equal(leanAffinity(1, 1), 1, "a full lean on a full instant cannot overshoot")
  assert.equal(leanAffinity(MIN_AFFINITY, -1), MIN_AFFINITY, "nor undershoot")
  for (const a of [MIN_AFFINITY, 0.5, 0.8, 1]) {
    for (const b of [-1, -0.4, 0, 0.4, 1, 5, -5, Number.NaN]) {
      const out = leanAffinity(a, b)
      assert.ok(out >= MIN_AFFINITY - 1e-12 && out <= 1 + 1e-12, `a=${a} b=${b} gave ${out}`)
    }
  }
})

test("no drift a groove can reach ever deletes an instant or forces one", () => {
  for (const scape of scapes(24)) {
    for (const { name, spec } of GRIDS) {
      const g = grooveOn(scape, spec)
      // Every kind of pressure at once, for a long time.
      for (let i = 0; i < 120; i++) {
        if (i % 3 === 0) g.agree()
        if (i % 5 === 0) g.makeRoom()
        g.advance(BARS_PER_MUTATION)
        for (const s of g.matrix(spec)) {
          assert.ok(
            s.affinity >= MIN_AFFINITY - 1e-9 && s.affinity <= 1 + 1e-9,
            `${scape.modeId} ${name}: affinity ${s.affinity} at beat ${s.beat}`,
          )
          assert.ok(Number.isFinite(s.p) && s.p >= 0 && s.p <= 1, `p=${s.p}`)
        }
        assert.equal(g.matrix(spec)[0]?.p, 1, "the downbeat is never negotiable")
      }
    }
  }
})

// ── job 1: it drifts, slowly, and it comes home ──────────────────────────────

test("the matrix is NOT the same bar forever — it moves, and only on `advance`", () => {
  const g = grooveOn(pickSoundscape(7), EIGHTHS)
  const first = g.matrix(EIGHTHS).map((s) => s.p)
  play(g, 40)
  const later = g.matrix(EIGHTHS).map((s) => s.p)
  const moved = first.filter((p, i) => Math.abs(p - (later[i] ?? 0)) > 1e-6).length
  assert.ok(moved >= 3, `only ${moved} of ${first.length} instants moved in 40 bars`)
})

test("a groove goes somewhere over minutes, and never off the edge", () => {
  // The founder's rate: a child notices over minutes, not bars. So the walk has
  // to be small at a phrase, real at a minute, and BOUNDED at an hour — a drift
  // that keeps growing is a groove that eventually has nothing to do with the
  // key the app is in.
  //
  // The bound here is held by the ±1 clamp in `nudge` and NOT by the tether:
  // this test still passes with the decay deleted, which is why the tether has
  // a test of its own that does not.
  const at = (bars: number): number => {
    let total = 0
    for (const scape of scapes(40)) {
      const g = grooveOn(scape, EIGHTHS)
      play(g, bars)
      total += g.distanceFromSeed(EIGHTHS)
    }
    return total / 40
  }
  const phrase = at(4)
  const minute = at(24)
  const nineMinutes = at(192)
  const hour = at(1536)

  assert.ok(phrase < 0.015, `one phrase already moved ${phrase.toFixed(4)} — that is not "slowly"`)
  assert.ok(minute > phrase * 1.8, `a minute (${minute.toFixed(4)}) barely beat a phrase (${phrase.toFixed(4)})`)
  assert.ok(nineMinutes > minute * 1.4, `nine minutes (${nineMinutes.toFixed(4)}) barely beat one (${minute.toFixed(4)})`)
  assert.ok(hour < nineMinutes * 1.4, `an hour ran away to ${hour.toFixed(4)} from ${nineMinutes.toFixed(4)}`)
  assert.ok(hour < 0.12, `an hour of drift reached ${hour.toFixed(4)}, which is a different game`)
})

test("the walk is TETHERED: a shape fades once nothing is holding it there", () => {
  /**
   * "There is sort of the seed but it should be able to go almost anywhere."
   * Anywhere is the excursion; the seed is what it falls back to.
   *
   * **The obvious test of this is vacuous and it was written first.** Counting
   * an instant's crossings back through its seed value, or bounding how far the
   * matrix gets in an hour, both PASS with the decay deleted — because
   * `nudge` clamps a lean to ±1, and a clamped zero-mean walk is already
   * bounded and already crosses zero. Those assertions are true and they are
   * not evidence.
   *
   * What only the tether can produce is a walk whose SIGNED total returns to
   * zero. The wander is zero-mean, so it cannot undo a run of right answers; it
   * can only scatter around it. Twenty right answers push the total to about
   * +4, and after two hundred bars of nobody answering anything it is the decay
   * and only the decay that brings it back. Measured with the decay removed:
   * 37% of the shape survives. With it: 15%.
   */
  const total = (g: Groove): number =>
    g.matrix(EIGHTHS).slice(1).reduce((sum, s) => sum + g.leanAt(s.beat), 0)

  let earned = 0
  let left = 0
  const runs = 60
  for (const scape of scapes(runs)) {
    const g = grooveOn(scape, EIGHTHS)
    for (let i = 0; i < 20; i++) {
      g.agree()
      g.advance(BARS_PER_MUTATION)
    }
    earned += total(g)
    play(g, 200)
    left += total(g)
  }
  assert.ok(earned / runs > 2, `twenty right answers only reached ${(earned / runs).toFixed(2)} of lean`)
  assert.ok(
    left / earned < 0.25,
    `${((left / earned) * 100).toFixed(0)}% of an earned shape was still there 200 bars later — nothing is pulling it home`,
  )

  // And it really does travel while it is out there: the mode's affinity range
  // is 0.65 wide, so an instant that has moved a third of it is audibly else.
  let travelled = 0
  for (const scape of scapes(20)) {
    const g = grooveOn(scape, EIGHTHS)
    for (let bar = 0; bar < 2000; bar += BARS_PER_MUTATION) {
      g.advance(BARS_PER_MUTATION)
      const now = g.matrix(EIGHTHS)
      const seed = g.seedMatrix(EIGHTHS)
      for (let i = 1; i < now.length; i++) {
        travelled = Math.max(travelled, Math.abs((now[i]?.affinity ?? 0) - (seed[i]?.affinity ?? 0)))
      }
    }
  }
  assert.ok(travelled > 0.3, `the furthest any instant ever got was ${travelled.toFixed(3)}`)
})

test("the groove keeps finding new favourites, and does so about once a minute", () => {
  // The audible number. Which three instants is the bar leaning on? At 88 BPM a
  // phrase is 11 s, so 100 phrases is about eighteen minutes of play.
  const favourites = (g: Groove): string =>
    g
      .matrix(EIGHTHS)
      .map((s, i) => [i, s.p] as const)
      .slice(1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([i]) => i)
      .sort((a, b) => a - b)
      .join("/")

  let distinct = 0
  let changes = 0
  const runs = 40
  for (const scape of scapes(runs)) {
    const g = grooveOn(scape, EIGHTHS)
    const seen = new Set<string>()
    let previous = ""
    for (let i = 0; i < 100; i++) {
      g.advance(BARS_PER_MUTATION)
      const now = favourites(g)
      seen.add(now)
      if (previous !== "" && now !== previous) changes++
      previous = now
    }
    distinct += seen.size
  }
  assert.ok(distinct / runs >= 5, `only ${(distinct / runs).toFixed(1)} distinct favoured sets in 18 minutes`)
  assert.ok(changes / runs >= 8, `the bar changed its mind only ${(changes / runs).toFixed(1)} times in 18 minutes`)
  assert.ok(changes / runs <= 60, `${(changes / runs).toFixed(1)} changes in 18 minutes is not "slowly"`)
})

test("nothing lands mid-phrase: the matrix is frozen between `advance` calls", () => {
  // The guarantee PULSE's phrase cache is built on, and the guarantee that a
  // bar a child is two beats into cannot become a different bar.
  const g = grooveOn(pickSoundscape(21), EIGHTHS)
  play(g, 60)
  const before = JSON.stringify(g.matrix(EIGHTHS))
  const revision = g.revision
  g.agree()
  g.agree()
  g.makeRoom()
  g.retune(pickSoundscape(999))
  g.advance(1) // less than BARS_PER_MUTATION: banked, not spent
  assert.equal(JSON.stringify(g.matrix(EIGHTHS)), before, "something moved without a mutation")
  assert.equal(g.revision, revision, "the revision moved without the matrix")
  g.advance(BARS_PER_MUTATION)
  assert.notEqual(JSON.stringify(g.matrix(EIGHTHS)), before, "the boundary did not spend what was banked")
  assert.equal(g.revision, revision + 1)
})

test("the same seed is the same session, and two seeds are two sessions", () => {
  const fingerprint = (seed: number): string => {
    const g = grooveOn(pickSoundscape(3), EIGHTHS, seed)
    const out: string[] = []
    for (let i = 0; i < 40; i++) {
      if (i % 4 === 0) g.agree()
      if (i % 7 === 0) g.makeRoom()
      g.advance(BARS_PER_MUTATION)
      out.push(g.matrix(EIGHTHS).map((s) => s.p.toFixed(6)).join(","))
    }
    return out.join("|")
  }
  assert.equal(fingerprint(1234), fingerprint(1234), "the same seed must replay exactly")
  let diverged = 0
  for (let s = 0; s < 60; s++) if (fingerprint(s) !== fingerprint(s + 1)) diverged++
  assert.equal(diverged, 60, "two different seeds gave the same session")
})

test("the drift rate does not depend on how fine the grid is", () => {
  // A stage with twenty-three movable instants must not evolve eight times more
  // slowly than one with three, or the child who got good gets a static game.
  const reach = (spec: GrooveSpec): number => {
    let total = 0
    for (const scape of scapes(30)) {
      const g = grooveOn(scape, spec)
      play(g, 200)
      let moved = 0
      const now = g.matrix(spec)
      const seed = g.seedMatrix(spec)
      for (let i = 1; i < now.length; i++) {
        if (Math.abs((now[i]?.affinity ?? 0) - (seed[i]?.affinity ?? 0)) >= 0.1) moved++
      }
      total += moved / Math.max(1, now.length - 1)
    }
    return total / 30
  }
  const coarse = reach(GRIDS[0]!.spec)
  for (const { name, spec } of GRIDS.slice(1)) {
    const fine = reach(spec)
    assert.ok(
      fine > coarse * 0.8 && fine < coarse * 1.25,
      `${name} moved ${(fine * 100).toFixed(1)}% of its instants and quarters moved ${(coarse * 100).toFixed(1)}%`,
    )
  }
})

test("the downbeat is never handed to the walk at all", () => {
  // Belt AND braces, and both are needed for different reasons. `grooveMatrix`
  // forces the downbeat's probability to 1, so a lean on it would be inert
  // rather than dangerous — but every mutation event spent on an instant that
  // cannot move is a mutation event the rest of the bar did not get, which is
  // the drift quietly running an eighth slower than it says it does.
  for (const scape of scapes(20)) {
    for (const { name, spec } of GRIDS) {
      const g = grooveOn(scape, spec)
      for (let i = 0; i < 200; i++) {
        if (i % 3 === 0) g.agree()
        if (i % 4 === 0) g.makeRoom()
        g.advance(BARS_PER_MUTATION)
        assert.equal(g.leanAt(0), 0, `${scape.modeId} ${name}: something moved the downbeat`)
      }
    }
  }
})

// ── job 2: right and wrong, in opposite directions ───────────────────────────

test("right ADDS and wrong REMOVES — on every grid PULSE plays", () => {
  for (const { name, spec } of GRIDS) {
    let rightWins = 0
    let rightNet = 0
    let wrongNet = 0
    const runs = 200
    for (let s = 0; s < runs; s++) {
      const scape = pickSoundscape(s * 2654435761)
      const right = grooveOn(scape, spec)
      const wrong = grooveOn(scape, spec)
      for (let i = 0; i < 8; i++) {
        right.agree()
        right.advance(BARS_PER_MUTATION)
        wrong.makeRoom()
        wrong.advance(BARS_PER_MUTATION)
      }
      const r = netOpened(right, spec)
      const w = netOpened(wrong, spec)
      rightNet += r
      wrongNet += w
      if (r > w) rightWins++
    }
    assert.ok(rightNet / runs > 0.8, `${name}: eight right answers netted only ${(rightNet / runs).toFixed(2)} instants`)
    assert.ok(wrongNet / runs < -0.8, `${name}: eight wrong answers netted ${(wrongNet / runs).toFixed(2)}`)
    assert.ok(rightWins >= 190, `${name}: right beat wrong in only ${rightWins} of ${runs} runs`)
  }
})

test("being right never hands a child a busier bar", () => {
  // The whole reason right ADDS an instant rather than a note. If this ever
  // fails, correctness has started buying difficulty, which is a punishment
  // wearing a reward's clothes.
  for (const { name, spec } of GRIDS) {
    for (const scape of scapes(60)) {
      const g = grooveOn(scape, spec)
      const before = expectedNotes(g.seedMatrix(spec))
      for (let i = 0; i < 12; i++) {
        g.agree()
        g.advance(BARS_PER_MUTATION)
      }
      assert.ok(
        Math.abs(expectedNotes(g.matrix(spec)) - before) < 1e-9,
        `${name} ${scape.modeId}: twelve right answers changed the bar from ${before.toFixed(3)} to ${expectedNotes(g.matrix(spec)).toFixed(3)} notes`,
      )
    }
  }
})

test("being wrong leaves room — a little, briefly, and never more than a quarter", () => {
  for (const { name, spec } of GRIDS) {
    for (const scape of scapes(30)) {
      const g = grooveOn(scape, spec)
      const seed = expectedNotes(g.seedMatrix(spec))
      // Everything wrong, over and over. The worst a child could ever do.
      for (let i = 0; i < 30; i++) {
        g.makeRoom()
        g.advance(BARS_PER_MUTATION)
      }
      const worst = expectedNotes(g.matrix(spec))
      assert.ok(worst < seed, `${name} ${scape.modeId}: a miss made no room at all`)
      assert.ok(
        worst >= seed * (1 - MAX_OPENNESS) - 1e-6,
        `${name} ${scape.modeId}: the bar thinned to ${worst.toFixed(3)} from ${seed.toFixed(3)} — past the cap`,
      )
      assert.ok(g.openness <= 1 + 1e-9, "openness ran past its own ceiling")
    }
  }
})

test("the room a miss makes comes back WITHOUT the child earning it", () => {
  // A miss is the teaching moment, so the recovery must be on the clock. A
  // groove that only closed up again on a right answer would be a groove
  // holding a mistake against a child.
  for (const scape of scapes(30)) {
    const g = grooveOn(scape, EIGHTHS)
    g.makeRoom()
    g.advance(BARS_PER_MUTATION)
    const opened = g.openness
    assert.ok(opened > 0.3, `a miss opened only ${opened.toFixed(3)}`)
    // Six more phrases and nothing but silence from the child.
    play(g, 24)
    assert.ok(g.openness < opened * 0.25, `still ${g.openness.toFixed(3)} open six phrases later`)
  }
})

test("wrong never touches the pulse — only decoration backs off", () => {
  // "Space to think", not a hole in the beat. On a grid with subdivisions, what
  // a miss takes down must be an offbeat.
  const spec = GRIDS[3]!.spec
  let onBeatHits = 0
  let offBeatHits = 0
  for (const scape of scapes(60)) {
    const g = grooveOn(scape, spec)
    const seed = g.seedMatrix(spec)
    for (let i = 0; i < 6; i++) {
      g.makeRoom()
      g.advance(BARS_PER_MUTATION)
    }
    const now = g.matrix(spec)
    for (let i = 1; i < now.length; i++) {
      const dropped = (seed[i]?.affinity ?? 0) - (now[i]?.affinity ?? 0)
      if (dropped < 0.2) continue
      if (Math.abs((now[i]?.beat ?? 0) - Math.round(now[i]?.beat ?? 0)) < 1e-6) onBeatHits++
      else offBeatHits++
    }
  }
  assert.ok(offBeatHits > 0, "a miss took nothing down at all")
  assert.ok(
    offBeatHits > onBeatHits * 3,
    `a miss hit ${onBeatHits} beats against ${offBeatHits} offbeats — that is the pulse, not decoration`,
  )
})

// ── job 3's other half: a key change is a modulation, not a restart ──────────

test("a new key keeps the drift, and lands at a phrase boundary", () => {
  const g = grooveOn(pickSoundscape(5), EIGHTHS)
  for (let i = 0; i < 10; i++) {
    g.agree()
    g.advance(BARS_PER_MUTATION)
  }
  /**
   * The walk itself, and not its visible effect on the matrix.
   *
   * Reading the leans out of the matrix does not work here, and the failed
   * attempt is worth recording: `leanAffinity` is bounded by whatever the mode
   * already said about an instant, so a lean of +0.8 on an instant the NEW mode
   * has already put at 1.0 shows up as a change of exactly zero. Two of seven
   * instants did that on the first run of this test, which looked like lost
   * state and was correct behaviour. The state is the leans.
   */
  const walk = (): string =>
    g
      .matrix(EIGHTHS)
      .slice(1)
      .map((s) => g.leanAt(s.beat).toFixed(6))
      .join(",")

  const before = walk()
  assert.ok(
    before.split(",").some((v) => Math.abs(Number(v)) > 0.05),
    "the fixture did not drift, so this proves nothing",
  )

  const next = pickSoundscape(77)
  assert.notEqual(next.modeId, g.soundscape.modeId, "pick a genuinely different key for the fixture")
  const frozen = JSON.stringify(g.matrix(EIGHTHS))
  g.retune(next)
  assert.equal(JSON.stringify(g.matrix(EIGHTHS)), frozen, "a key change landed mid-phrase")

  g.advance(BARS_PER_MUTATION)
  assert.equal(g.soundscape.modeId, next.modeId)

  // The step that landed the key also decays every lean once and wanders one
  // instant, so the claim is that the SHAPE carried across: same signs, same
  // ordering, nothing reset to zero.
  const after = walk().split(",").map(Number)
  const was = before.split(",").map(Number)
  let reset = 0
  let reversed = 0
  for (let i = 0; i < was.length; i++) {
    const w = was[i] ?? 0
    const a = after[i] ?? 0
    if (Math.abs(w) > 0.05 && Math.abs(a) < 0.01) reset++
    if (Math.abs(w) > 0.05 && Math.abs(a) > 0.01 && Math.sign(a) !== Math.sign(w)) reversed++
  }
  assert.equal(reset, 0, `${reset} leans were wiped by the key change (${before} → ${after.join(",")})`)
  assert.ok(reversed <= 1, `${reversed} leans reversed across the key change`)
})

test("every mode in the corpus survives an hour of drift", () => {
  for (const mode of MODES) {
    const scape: Soundscape = { modeId: mode.id, rootHz: 130.81, seed: 11, tension: 0.3 }
    for (const { name, spec } of GRIDS) {
      const g = grooveOn(scape, spec)
      for (let i = 0; i < 300; i++) {
        if (i % 2 === 0) g.agree()
        if (i % 7 === 0) g.makeRoom()
        g.advance(BARS_PER_MUTATION)
      }
      const m = g.matrix(spec)
      assert.equal(m[0]?.p, 1, `${mode.id} ${name}: lost the downbeat`)
      for (const s of m) assert.ok(Number.isFinite(s.p), `${mode.id} ${name}: p=${s.p}`)
      // Every subdivision the stage teaches is still reachable, which is the
      // property `chart.test.ts` holds the other end of.
      for (const div of spec.divs) {
        assert.ok(
          m.some((s) => s.div === div && s.p > 0.02),
          `${mode.id} ${name}: the drift made 1/${div} unreachable`,
        )
      }
    }
  }
})

test("a caller that says something absurd cannot break a groove", () => {
  const g = grooveOn(pickSoundscape(2), EIGHTHS)
  for (const bars of [0, -5, Number.NaN, Infinity, -Infinity]) {
    const before = g.revision
    g.advance(bars)
    assert.equal(g.revision, before, `advance(${bars}) moved the shape`)
  }
  // An enormous jump is bounded work, not a hang, and still a legal matrix.
  g.advance(1e9)
  for (const s of g.matrix(EIGHTHS)) assert.ok(Number.isFinite(s.p) && s.p >= 0 && s.p <= 1)
  assert.ok(g.bars > 0)
})
