// TEN MINUTES, MEASURED.
//
// > "'the lattice' has a lot of potential but it stays way too easy way too long
// > .. I must have played for 10 minutes and I'm doing it perfectly and I'm
// > seeing 2+0 over and over again, finding a 2 .. then 3+0 and finding a 3 ..
// > the 'real game' never seems to come where I have eg the example 47+25 ... and
// > I must collect 2*2*2*3*3 ... those level of problem should come fairly
// > quickly ... 2*2*4 = 8+4 ... some variety .. it's just stuck on 2+0 and 0+3,
// > 2+1 forever."
//
// This file is that report, as a measurement. A bot that does the arithmetic
// perfectly plays the real arena through the real physics against a host that
// models the shipped difficulty wire — sixty-six rungs, a request honoured as a
// point, and the host's own staircase moving on `report` when the game names
// nothing — and the assertions are about *what it was asked*.
//
// **What it looked like before.** Run against the shipped code, over five seeds:
//
//     draws 270, of which named a difficulty: 0
//     rungs served: min 0, median 29, max 50
//     targets with a factor tree: 42%,  prime: 21%
//     first targets: 5  7  10  16  10  24  16  27  34  34  48 …
//     the arena had no question at all for about 500 of the 600 seconds
//
// The last line is the part nobody had reported, because nobody had got there:
// the host's own staircase carried the game up past rung 47, where every answer
// is four or five digits, `isAskable` refused all eight draws, and the arena
// stalled — permanently, because there was no retry, leaving the previous
// resonator hanging with its id already spent.
//
// **And after**, on the same five seeds:
//
//     draws 1650, of which named a difficulty: 1650
//     rungs served: min 16, median 45, max 47
//     targets with a factor tree: 82%,  prime: 15%
//     first targets: 36  40  60  98  75  193  156  175  370 …
//     the arena was without a question for 8 seconds in 3,000
//
// Every number below is checked against a threshold well inside those margins,
// so this file fails on a regression rather than on noise.

import assert from "node:assert/strict"
import { test } from "node:test"

import { Rng } from "../core/rng.ts"
import { Arena, REARM_MS } from "../game/arena.ts"
import { primeFactors } from "../game/factor.ts"
import { CEILING, FLOOR, RUNGS, rungOf } from "../game/ladder.ts"
import { CALM_OPENINGS } from "../game/opening.ts"
import { MIN_TARGET, MIN_TILES, isSmooth } from "../game/resonance.ts"
import { createStubHost, type StubHost } from "../stubHost.ts"
import { grindToPrimes, playCarefully, rig } from "./harness.ts"

const FRAME_MS = 16
/** Ten minutes, the length of the sitting in the report. */
const TEN_MINUTES = Math.round((10 * 60 * 1000) / FRAME_MS)
const SEEDS = [0x1a771ce, 0x0c105, 0x5eed, 0xbea7, 0x9a11]

type Draw = { asked: number | null; ceiling: number | null; rung: number; id: string }

function sit(seed: number, frames = TEN_MINUTES) {
  const draws: Draw[] = []
  const skipped: string[] = []
  const host: StubHost = createStubHost({
    seed,
    reducedMotion: true,
    onDraw: (d) => draws.push(d),
    onSkip: (id) => skipped.push(id),
  })
  const arena = new Arena(host, new Rng(seed ^ 0x51de), { width: 900, height: 700, experience: CALM_OPENINGS })
  arena.begin(0)
  const played = playCarefully(arena, frames, FRAME_MS)
  return { host, arena, draws, skipped, ...played }
}

test("every single draw names a difficulty and a ceiling", () => {
  // The defect itself, and the only assertion here that would have failed on the
  // shipped code no matter how the thresholds were set: it named neither, ever.
  const { draws } = sit(SEEDS[0] as number, 4000)
  assert.ok(draws.length > 20, `only ${draws.length} draws`)
  const silent = draws.filter((d) => d.asked === null)
  assert.deepEqual(silent, [], `${silent.length} of ${draws.length} draws asked for nothing`)
  for (const draw of draws) {
    assert.ok(draw.ceiling !== null, "a draw named no ceiling")
    assert.ok(
      (draw.asked as number) >= FLOOR - 1e-9 && (draw.asked as number) <= CEILING + 1e-9,
      `a draw asked for ${String(draw.asked)}, outside the band`,
    )
  }
})

test("the very first question of a session already has a factor tree in it", () => {
  // "I'm seeing 2+0 over and over again, finding a 2." Not any more, on any seed:
  // the game's floor is a rung whose answers can be decomposed.
  for (const seed of SEEDS) {
    const { arena } = sit(seed, 1)
    const res = arena.resonator
    assert.ok(res, `seed ${seed.toString(16)} armed nothing`)
    assert.ok(
      res.target >= MIN_TARGET,
      `seed ${seed.toString(16)} opened on ${res.target}, which is smaller than ${MIN_TARGET}`,
    )
    const tiles = primeFactors(res.target)
    assert.ok(
      tiles.length >= MIN_TILES,
      `seed ${seed.toString(16)} opened on ${res.target} = ${tiles.join("·")}, which is not a tree`,
    )
    assert.ok(isSmooth(res.target), `${res.target} needs a mote nobody can read`)
  }
})

test("ten minutes of perfect play is spent on the real game, not below it", () => {
  let targets: number[] = []
  let withoutQuestionMs = 0
  const rungs: number[] = []
  for (const seed of SEEDS) {
    const played = sit(seed)
    targets = targets.concat(played.targets)
    withoutQuestionMs += played.withoutQuestionMs
    rungs.push(...played.host.servedRungs())
    // **Not `arena.stalled` on the final frame.** That is what this line used to
    // be, and it cannot tell the two failures apart: it is true of a
    // two-and-a-half-second rearm that is about to close and false of an arena
    // that was empty for nine minutes and happened to arm on the last one. The
    // longest single gap is the number that means something, and a gap longer
    // than a couple of rearms is a band the game cannot draw from.
    assert.ok(
      played.longestGapMs <= 3 * REARM_MS,
      `seed ${seed.toString(16)} went ${(played.longestGapMs / 1000).toFixed(1)}s with no ring on ` +
        `the screen, which is more than three rearms`,
    )
    // The host's own ladder ends inside the band too, because every request the
    // game makes moves it — a pack that drove the stream out of its own reach and
    // left it there is the shape of the defect at the other end of this fix.
    const position = played.host.position()
    assert.ok(
      position >= rungOf(FLOOR) && position <= rungOf(CEILING),
      `seed ${seed.toString(16)} left the host standing on rung ${position}`,
    )
    // And the game's second stage was there from the opening question, not after
    // a warm-up: `firstTreeMs` is the frame the first real factor tree arrived on.
    assert.equal(
      played.firstTreeMs,
      FRAME_MS,
      `the first target with a factor tree in it arrived at ${String(played.firstTreeMs)}ms`,
    )
  }
  assert.ok(targets.length > 400, `only ${targets.length} resonators over ${SEEDS.length} sittings`)

  // Measured at 84%; the rest are the rationed wall and the fallback tier.
  const trees = targets.filter(
    (t) => t >= MIN_TARGET && primeFactors(t).length >= MIN_TILES,
  ).length
  assert.ok(
    trees / targets.length > 0.7,
    `only ${((trees / targets.length) * 100).toFixed(0)}% of targets had a factor tree — was 42%`,
  )

  // Nothing under twelve, ever. This is the founder's "finding a 2".
  const small = targets.filter((t) => t < MIN_TARGET)
  assert.deepEqual(small, [], `targets below ${MIN_TARGET} were still being asked for`)

  // And every mote a hold needs is one the game will actually draw. Three-digit
  // answers are 65% factor trees and only 37% *readable* ones, so over ten
  // minutes at the top of the band this is the difference between holds made of
  // motes a child recognises and holds with a 397 in them.
  const unreadable = targets.filter((t) => primeFactors(t).length > 1 && !isSmooth(t))
  assert.deepEqual(
    unreadable.map((t) => `${t}=${primeFactors(t).join("·")}`),
    [],
    "a hold needed a mote larger than the game draws",
  )

  // The arena is essentially never without something to answer. Roughly 500 of
  // every 600 seconds before the ladder existed; 2.5 seconds in 3,000 now, on
  // one seed of five, against a host that models `HINT_BAND`. The budget is
  // twelve, which is four rearms across five ten-minute sittings.
  assert.ok(
    withoutQuestionMs < 12_000,
    `the arena had no question for ${(withoutQuestionMs / 1000).toFixed(1)}s across five sittings`,
  )

  // And no rung below the floor was ever served — not even once, not even while
  // the game was walking outward looking for something usable.
  const belowFloor = rungs.filter((r) => r < rungOf(FLOOR))
  assert.deepEqual(belowFloor, [], `${belowFloor.length} draws came from below the floor`)
  const aboveCeiling = rungs.filter((r) => r > rungOf(CEILING))
  assert.deepEqual(aboveCeiling, [], `${aboveCeiling.length} draws came from above the ceiling`)
})

test("the sitting climbs: the twentieth question is bigger work than the first", () => {
  // "those level of problem should come fairly quickly." Compare the opening
  // three targets of a sitting against three from further in, over every seed, so
  // one lucky draw cannot carry the claim in either direction.
  let opening = 0
  let later = 0
  let openingTiles = 0
  let laterTiles = 0
  for (const seed of SEEDS) {
    const { targets } = sit(seed, 30_000)
    assert.ok(targets.length > 30, `only ${targets.length} targets`)
    for (const t of targets.slice(0, 3)) {
      opening += t
      openingTiles += primeFactors(t).length
    }
    for (const t of targets.slice(20, 23)) {
      later += t
      laterTiles += primeFactors(t).length
    }
  }
  // Measured: about 800 → about 9,500 over five seeds' worth of three targets.
  assert.ok(
    later > opening * 3,
    `the target went from ${opening} to ${later} over twenty resonators — it is not climbing`,
  )
  // The *hold* deliberately does not grow with it, and that is worth an assertion
  // rather than a hope. What gets harder is the arithmetic — a two-digit sum
  // becomes a three-digit one — while the tree stays three to five motes, because
  // a hold is a thing a child has to fly around and collect and `BANK_CAPACITY` is
  // twelve. A design where both grew would put a nine-mote hold behind a
  // three-digit sum and the round would take a minute of flying.
  const perTarget = (n: number) => n / (3 * SEEDS.length)
  assert.ok(
    perTarget(openingTiles) >= MIN_TILES,
    `the opening hold averaged ${perTarget(openingTiles).toFixed(1)} tiles`,
  )
  assert.ok(
    perTarget(laterTiles) >= MIN_TILES && perTarget(laterTiles) <= 7,
    `the twentieth hold averaged ${perTarget(laterTiles).toFixed(1)} tiles, which is a lot of flying`,
  )
})

test("and there is variety: the sitting is not one rung over and over", () => {
  // "some variety .. it's just stuck on 2+0 and 0+3, 2+1 forever."
  const { host, targets } = sit(SEEDS[2] as number, 30_000)
  const rungs = new Set(host.servedRungs())
  assert.ok(rungs.size >= 8, `a whole sitting drew from only ${rungs.size} rungs`)
  const distinct = new Set(targets)
  assert.ok(
    distinct.size > targets.length * 0.6,
    `${distinct.size} distinct targets out of ${targets.length} — the stream repeats itself`,
  )
  // And the holds are not all the same shape either.
  const shapes = new Set(targets.map((t) => primeFactors(t).join("·")))
  assert.ok(shapes.size > 20, `only ${shapes.size} distinct factor trees in a sitting`)
})

test("a question the child was never shown is closed, not left hanging", () => {
  // An arming draws until it finds a target with a factor tree in it, so most
  // draws are discarded. Reported as wrong they would be MISSes on questions
  // nobody saw; left alone they would sit open in the host's ledger forever.
  const { host, draws, skipped, targets } = sit(SEEDS[1] as number, 20_000)
  assert.ok(draws.length > targets.length, "no draw was ever discarded, so this proves nothing")
  assert.ok(skipped.length > 0, "discarded draws were never skipped")
  const open = host.openItems()
  // What may still be open: the resonator currently on the board, and at most the
  // handful whose answers were reported. Nothing else.
  assert.ok(
    open.length <= 2,
    `${open.length} of ${draws.length} drawn questions were left open in the ledger`,
  )
  // Exactly: every draw is either the one the resonator took or one that was
  // closed. `>=` would have been an identity nothing could violate.
  assert.equal(
    skipped.length + targets.length,
    draws.length,
    `${draws.length} draws, ${targets.length} used, ${skipped.length} skipped — ` +
      `${draws.length - targets.length - skipped.length} went nowhere`,
  )
})

test("a barren band is an arena with something to shoot, not an empty screen", () => {
  // **The fresh profile.** The real host warms its prefetch pool at *its* own
  // position, which for a brand new profile is rung 0 — answers of one to three —
  // and the first request this game makes flushes that pool down to a reserve of
  // eight of them. So the first arming of the first session can be six draws of
  // `2 + 0`, nothing resonant, nothing the fallback tier will take either, and a
  // stall on the very first frame — before `arm` has reached the line that puts
  // anything on the screen at all.
  //
  // A host that only ever serves the bottom of the ladder, whatever is asked for,
  // is exactly that situation held still.
  const bottom = createStubHost({ seed: 0x60770, reducedMotion: true })
  const stuck: StubHost = {
    ...bottom,
    next: () => bottom.next({ difficulty: 0 }),
  }
  const arena = new Arena(stuck, new Rng(0x60770), { width: 900, height: 700, experience: CALM_OPENINGS })
  const events = arena.begin(0)

  assert.equal(arena.stalled, true, "the bottom of the ladder armed a resonator")
  assert.ok(events.some((e) => e.kind === "stalled"), "the stall was not announced")
  assert.equal(arena.resonator, null, "a stall left a resonator hanging")
  // And the thing that makes "the arena stays playable" true rather than a comment.
  assert.ok(
    arena.bodies.length > 0,
    "a child's first session opened on an empty grid with nothing to shoot",
  )
  assert.ok(
    arena.bodies.some((b) => !b.prime),
    "the field had no husk on it, so there was nothing to crack",
  )
  // The passive layer works on it: grind it down and the tile bar fills.
  grindToPrimes(arena)
  const mote = arena.bodies[0]
  assert.ok(mote)
  assert.equal(arena.touch(mote.id)[0]?.kind, "sweep")
  assert.equal(arena.bank.size, 1)
  // Nothing is reported, because nobody asked anything.
  assert.deepEqual(arena.enter(1000), [], "a resonator that does not exist answered something")

  // And it keeps asking. The wait is real but it is a wait, not a session.
  assert.deepEqual(arena.rearm(10), [], "the arena re-armed before its own wait was up")
  arena.step(120)
  arena.step(120)
  let waited = 240
  let armed = false
  for (let i = 0; i < 200 && !armed; i++) {
    waited += 120
    arena.step(120)
    armed = arena.rearm(waited).some((e) => e.kind === "arrive" || e.kind === "stalled")
  }
  assert.ok(armed, "the arena stopped asking for a question altogether")
  assert.ok(waited < 10_000, `it waited ${waited}ms before asking again`)
})

test("the game learns from the rung that answered, not the rung it asked for", () => {
  // **`host.next` does not serve what you asked for.** It serves the pooled
  // question *closest* to the request, and the pool was stocked for whatever came
  // before — measured against the real adapter, 104 of 175 draws came from a rung
  // other than the one named, by as much as nineteen. `question.difficulty` is
  // where the truth is, and `items.ts` says so in as many words: "the pack is told
  // what it got and not what it asked for."
  //
  // Learning from the request instead writes live rungs off as barren and snaps
  // the position onto a rung the child never saw, which breaks all three of the
  // mechanisms this fix is built on.
  const STALE = 21
  // `band: false`, and it is the one thing this case needs off: it is a
  // statement about the PACK's ladder — that `landed()` follows the rung that
  // answered — and it works by forcing every answer to come from one rung. A
  // host that then clamped that rung into its own band would be answering from a
  // rung of its choosing, and there would be nothing left to measure.
  const inner = createStubHost({ seed: 0x57a1e, reducedMotion: true, band: false })
  const asked: number[] = []
  const stale: StubHost = {
    ...inner,
    next: (request) => {
      asked.push(request?.difficulty ?? -1)
      // Every request answered from one rung, whatever was named — the shape of a
      // pool stocked before the game started driving.
      return inner.next({ ...request, difficulty: STALE / (RUNGS - 1) })
    },
  }
  const arena = new Arena(stale, new Rng(0x57a1e), { width: 900, height: 700, experience: CALM_OPENINGS })
  arena.begin(0)
  assert.ok(arena.resonator, "the stale host armed nothing")
  assert.ok(asked.length > 0)
  assert.ok(
    asked.some((a) => rungOf(a) !== STALE),
    "the game never asked for anything other than the rung it got, so this proves nothing",
  )

  // The position followed the content, not the request.
  assert.equal(
    arena.ladder.rung,
    STALE,
    `the game thinks it is on rung ${arena.ladder.rung} while every question came from ${STALE}`,
  )
  // And the barren tally was charged against the rung that answered. The rungs it
  // *asked* for were never actually tried, so none of them may have been written
  // off — a rung with no record reads as a full yield of 1.
  for (const difficulty of asked) {
    const rung = rungOf(difficulty)
    if (rung === STALE) continue
    assert.equal(
      arena.ladder.yieldOf(rung),
      1,
      `rung ${rung} was scored on an item that came from rung ${STALE}`,
    )
  }
})

test("a second wrong hold in the same ring is not a second wrong answer", () => {
  // The id is spent on the first assertion and nothing after it is reported, so
  // moving the position on every subsequent one would let a child who keeps
  // bumping the ring walk the whole band down in about seven seconds — with the
  // game's idea of where they are drifting away from the host's over questions the
  // host never received.
  const { arena, reports } = rig(0x2ce2)
  const res = arena.resonator
  assert.ok(res)
  grindToPrimes(arena)
  const wrong = arena.bodies.filter((b) => b.prime && b.value !== res.target)
  assert.ok(wrong.length >= 2, "not enough loose primes to be wrong twice")

  // Off the floor first, or the clamp hides the whole effect.
  for (let i = 0; i < 4; i++) arena.ladder.opened()
  const before = arena.ladder.at
  arena.touch((wrong[0] as { id: number }).id)
  arena.enter(1000)
  const afterFirst = arena.ladder.at
  assert.ok(afterFirst < before, "a refusal did not move the ladder at all")
  assert.equal(reports.length, 1)

  // Three more trips into the same ring, each with a genuinely wrong hold.
  for (let i = 0; i < 3; i++) {
    arena.step(1000)
    const mote = arena.bodies.find((b) => b.prime && b.value !== res.target)
    if (!mote) break
    arena.touch(mote.id)
    arena.enter(2000 + i * 1000)
  }
  assert.equal(reports.length, 1, "the same question was answered to the host twice")
  assert.equal(
    arena.ladder.at,
    afterFirst,
    "bumping a ring whose id was already spent walked the ladder down again",
  )
})

test("a question with no id is not a question, however answerable it looks", () => {
  // The host hands one back when its prefetch pool has run dry: a clone of the
  // last question with the id blanked. `report` on it is then dropped at the far
  // end — so a child would work out `47 + 25`, assemble `2·2·2·3·3`, open the ring
  // and have the whole thing recorded nowhere. `MAX_DRAWS` is why the pool should
  // never empty; this is why an empty one is not silent damage if it does.
  const inner = createStubHost({ seed: 0x0117e55, reducedMotion: true })
  const dry: StubHost = {
    ...inner,
    // Perfectly resonant, and unreportable.
    next: (request) => ({ ...inner.next(request), id: "", answer: "72" }),
  }
  const arena = new Arena(dry, new Rng(0x0117e55), { width: 900, height: 700, experience: CALM_OPENINGS })
  const events = arena.begin(0)
  assert.equal(arena.resonator, null, "a resonator was armed on a question with no id")
  assert.ok(events.some((e) => e.kind === "stalled"), "the arena took it and said nothing")
  assert.ok(arena.bodies.length > 0, "and it still left the child an empty screen")
})

test("a host with no skip is still a host this game runs on", () => {
  // `skip` is feature-detected, like `transition`. A runtime older than the one
  // that grew it must not be a pack that throws on its first arming.
  const bare = createStubHost({ seed: 0x0b4e, reducedMotion: true })
  const { skip, ...rest } = bare
  void skip
  const arena = new Arena(rest as unknown as StubHost, new Rng(0x0b4e), {
    width: 900,
    height: 700,
    experience: CALM_OPENINGS,
  })
  arena.begin(0)
  assert.ok(arena.resonator, "a host without skip armed nothing")
  const played = playCarefully(arena, 4000, FRAME_MS)
  assert.ok(played.targets.length > 2, `only ${played.targets.length} resonators`)
})

test("the wall still comes round, and it is never a hunt for a 2", () => {
  // Primeness is the property this whole game stands on and it must not have been
  // filtered out of existence — but "find the 2" is what ten minutes of it felt
  // like, so it is rationed and it has a floor.
  let walls = 0
  let total = 0
  for (const seed of SEEDS) {
    const { targets } = sit(seed, 30_000)
    total += targets.length
    for (const t of targets) {
      if (primeFactors(t).length !== 1) continue
      walls += 1
      assert.ok(t >= 13, `a resonator asked for the prime ${t}`)
    }
  }
  assert.ok(walls > 0, "the wall was filtered out of the game entirely")
  assert.ok(
    walls / total < 0.3,
    `${((walls / total) * 100).toFixed(0)}% of resonators were a hunt for one mote`,
  )
})
