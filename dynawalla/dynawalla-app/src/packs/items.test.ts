// The host's half of the item contract, held to the four promises it makes.
//
// This is where "a mathematics game cannot be beaten by fiddling with the game"
// stops being an architecture note. If `items.next` carried the answer, or
// `judge` accepted whatever a pack said was right, or the same seed produced
// two different questions, the boundary would still typecheck and the property
// would be gone.

import { test } from "node:test"
import assert from "node:assert/strict"

import {
  advanceStaircase,
  ascentOf,
  ABOVE_RATIO,
  bandOf,
  BLANK,
  blankPosition,
  drawStatement,
  cadenceFor,
  choicesFor,
  binaryOperator,
  climbRungs,
  climbWithinMs,
  createItemService,
  DESCENT_FAR,
  DESCENT_NEAR,
  descentOf,
  HINT_BAND,
  isQuick,
  itemPace,
  ladder,
  LOST_AT,
  noteRecent,
  normalizeMinus,
  operandsOf,
  openStaircase,
  pickRung,
  PROMOTE_AT,
  recentAccuracy,
  RECENT_WINDOW,
  rungWeights,
  SIT_AT,
  SPREAD_ABOVE,
  SPREAD_BELOW,
  STEP_OPEN,
  STEP_START,
  STEP_TRACK,
} from "./items.ts"
import type { Band, ItemService, Recent, Rung, Staircase } from "./items.ts"
import type { PromptBlank, PromptSlot } from "./curriculum.ts"
import {
  activeNodes,
  allNodes,
  familyById,
  FORM_FREE_ENTRY,
  promptBlank,
  promptOperator,
  promptRegistry,
  SLOT_BOTTOM,
  SLOT_TOP,
} from "./curriculum.ts"

const noRecord = () => {}

/**
 * Walk a service up to a rung the way a child does: by being right, at the pace
 * the item's own class publishes.
 *
 * There is no other way in, and since issue 733 there is deliberately no other way
 * in — a `difficulty` is a hint clamped to `HINT_BAND` rungs of where the host
 * already stands, so a test that wants the host on rung 20 has to put it there
 * with evidence. Which is the point: it is the same route a child takes.
 */
function climbTo(service: ItemService, rung: number, packId = "dynawalla.fuse"): void {
  for (let guard = 0; guard < 400 && service.position() < rung; guard++) {
    const item = service.next({ packId })
    assert.ok(item)
    service.judge({
      packId,
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
  }
  assert.ok(
    service.position() >= rung,
    `400 correct answers at the published median did not reach rung ${String(rung)} — the ladder ` +
      `stopped at ${String(service.position())}`,
  )
}

test("the ladder is every generatable binding, easiest first, and it is not empty", () => {
  const rungs = ladder()
  assert.ok(rungs.length > 0, "the shipped graph generates nothing at all")
  for (const rung of rungs) {
    assert.ok(rung.level >= 0)
    assert.equal(rung.family.family, rung.node.generator.family)
  }
  // Every active node with a registered family is represented, so a pack asking
  // for a skill the graph ships can always be served.
  const covered = new Set(rungs.map((rung) => rung.node.id))
  for (const node of activeNodes()) {
    if (familyById(node.generator.family)) {
      assert.ok(covered.has(node.id), `${node.id} is in the graph and not on the ladder`)
    }
  }
})

test("an item carries the question and never the answer", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  const item = service.next({ packId: "dynawalla.fuse" })
  assert.ok(item, "no item was served")

  // The whole payload, enumerated. A field added here that happens to contain
  // the canonical value is the failure this asserts against.
  //
  // `prompt` and `operands` are excluded because they ARE the question, and a
  // single-digit fact legitimately puts its own answer among them: `0 + 3` has
  // the canonical `3` written on its face. Scanning them was sound only while
  // every operand was four digits long, and it started reporting a leak the
  // moment the curriculum grew a rung below that.
  const canonical = service.reveal(item.id)
  assert.ok(canonical.length > 0)
  const rest: Record<string, unknown> = { ...item }
  for (const key of ["choices", "prompt", "operands"]) delete rest[key]
  const serialised = JSON.stringify(rest)
  assert.ok(
    !serialised.includes(`"${canonical}"`),
    `the served item names the canonical answer outside the question: ${serialised}`,
  )

  assert.equal(item.operands.length, 2)
  assert.ok(item.prompt.includes(item.operands[0] ?? "!"))
  assert.ok(item.operator === "+" || item.operator === "-")
  assert.equal(item.answerKind, "integer")
})

test("a closed list is a choice: four options, the answer among them", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  for (let i = 0; i < 40; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    const canonical = service.reveal(item.id)
    const texts = (item.choices ?? []).map((choice) => choice.text)
    assert.equal(texts.length, 4, `${String(texts.length)} option(s) for ${item.prompt}`)
    assert.ok(texts.includes(canonical), `${item.prompt} does not offer ${canonical}`)
    assert.equal(new Set(texts).size, texts.length, "a repeated option is not a distractor")
    for (const text of texts) assert.match(text, /^\d+(\.\d+)?$/)
  }
})

test("the curriculum judges, and the attempt is recorded before the answer comes back", () => {
  const recorded: { packId: string; correct: boolean }[] = []
  const service = createItemService({
    profileId: "p1",
    record: (outcome) => recorded.push(outcome),
  })

  const right = service.next({ packId: "dynawalla.siege" })
  assert.ok(right)
  const canonical = service.reveal(right.id)
  const verdict = service.judge({
    packId: "dynawalla.siege",
    itemId: right.id,
    response: canonical,
    latencyMs: 1200,
  })
  assert.equal(verdict.correct, true)
  assert.equal(verdict.canonical, canonical)
  assert.deepEqual(recorded, [{ packId: "dynawalla.siege", correct: true }])

  const wrong = service.next({ packId: "dynawalla.siege" })
  assert.ok(wrong)
  const wrongVerdict = service.judge({
    packId: "dynawalla.siege",
    itemId: wrong.id,
    response: "999999",
    latencyMs: 900,
  })
  assert.equal(wrongVerdict.correct, false)
  assert.equal(wrongVerdict.canonical, service.reveal(wrong.id))
  assert.equal(recorded.length, 2)
  assert.equal(recorded[1]?.correct, false)

  // Reporting the same item twice does not record it twice. A pack that
  // double-reports a chip would otherwise inflate a child's record, and the
  // record only ever rises.
  service.judge({ packId: "dynawalla.siege", itemId: wrong.id, response: "1", latencyMs: 5 })
  assert.equal(recorded.length, 2)
})

test("a choice id answers as the value it carries", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  const item = service.next({ packId: "dynawalla.siege" })
  assert.ok(item)
  const canonical = service.reveal(item.id)
  const choice = (item.choices ?? []).find((entry) => entry.text === canonical)
  assert.ok(choice, "the canonical value is not among the choices")
  const verdict = service.judge({
    packId: "dynawalla.siege",
    itemId: item.id,
    response: choice.id,
    latencyMs: 700,
  })
  assert.equal(verdict.correct, true)
})

test("an unparseable response is wrong, not a crash", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  const item = service.next({ packId: "dynawalla.fuse" })
  assert.ok(item)
  const verdict = service.judge({
    packId: "dynawalla.fuse",
    itemId: item.id,
    response: "  ",
    latencyMs: 10,
  })
  assert.equal(verdict.correct, false)
})

test("two learners get two streams; one learner gets the same stream twice", () => {
  const first = createItemService({ profileId: "p1", record: noRecord })
  const again = createItemService({ profileId: "p1", record: noRecord })
  const other = createItemService({ profileId: "p2", record: noRecord })

  const a = first.next({ packId: "dynawalla.fuse" })
  const b = again.next({ packId: "dynawalla.fuse" })
  const c = other.next({ packId: "dynawalla.fuse" })
  assert.ok(a && b && c)
  assert.equal(a.prompt, b.prompt, "the same learner and pack must be reproducible")
  assert.notEqual(a.prompt, c.prompt, "two learners are sharing a stream")
})

test("the ladder climbs on a fast correct answer and steps down on a wrong one", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  assert.equal(service.position(), 0)

  for (let i = 0; i < 3; i++) {
    const item = service.next({ packId: "dynawalla.fuse" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.fuse",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: 800,
    })
  }
  const climbed = service.position()
  assert.ok(climbed > 0, "three fast correct answers did not move the ladder")

  const item = service.next({ packId: "dynawalla.fuse" })
  assert.ok(item)
  // Not `"0"`. On the easiest rungs the curriculum now ships, zero is a
  // perfectly good answer — `3 − 3` — so a test that used it as a stand-in for
  // "wrong" was climbing the ladder while asserting it had stepped down.
  service.judge({
    packId: "dynawalla.fuse",
    itemId: item.id,
    response: "definitely wrong",
    latencyMs: 200,
  })
  // Down, by the staircase's current stride rather than by a fixed rung — see
  // `STEP_START`. The exact arithmetic is pinned on the pure functions below
  // ("the staircase opens wide…"); what is asserted here is that the service
  // composes them in the right direction and that a miss is never free.
  const dropped = service.position()
  assert.ok(dropped < climbed, `a miss left the child on rung ${String(dropped)}`)
  assert.ok(
    climbed - dropped <= STEP_START,
    `one miss cost ${String(climbed - dropped)} rungs, and the opening stride is ${String(
      STEP_START,
    )}`,
  )
})

test("a pack may ask for a skill it covers, and an unknown one is not an error", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  const named = service.next({ packId: "dynawalla.fuse", skillId: "dw.add.regroup.add-multidigit" })
  assert.ok(named)
  assert.equal(named.skillId, "dw.add.regroup.add-multidigit")
  assert.equal(named.operator, "+")

  const unknown = service.next({ packId: "dynawalla.fuse", skillId: "dw.not.a.skill" })
  assert.ok(unknown, "an unknown skill must fall back to the ladder, not fail")
})

test("judging or revealing an item nobody served is refused", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  assert.throws(() => service.reveal("made-up"))
  assert.throws(() =>
    service.judge({ packId: "x", itemId: "made-up", response: "1", latencyMs: 1 }),
  )
})

test("choices are stable for an exercise, so a redraw does not move the right slab", () => {
  const node = activeNodes()[0]
  assert.ok(node)
  const family = familyById(node.generator.family)
  assert.ok(family)
  const params = family.paramSchema.validate(node.generator.params[0])
  assert.ok(params.ok)
  const exercise = family.generate({
    skillId: node.id,
    level: 0,
    seed: 4242,
    params: params.value,
    forms: [FORM_FREE_ENTRY],
  })
  assert.deepEqual(choicesFor(exercise, 0), choicesFor(exercise, 0))
})

test("a difficulty request selects a rung inside the host's band, and the item says which rung it came from", () => {
  const rungs = ladder()
  const span = rungs.length - 1
  assert.ok(span > 2 * HINT_BAND, "the ladder is too short to tell a band from the whole of it")
  const service = createItemService({ profileId: "p1", record: noRecord })
  assert.equal(service.position(), 0, "a fresh service does not start on rung 0")

  const easiest = service.next({ packId: "dynawalla.slice", difficulty: 0 })
  const hardest = service.next({ packId: "dynawalla.slice", difficulty: 1 })
  assert.ok(easiest && hardest)

  // The ordinate the pack is told is the position of the rung it was served,
  // 0..1 across the whole ladder — not `level`, which is the level within one
  // skill and is not comparable between two of them. And it is the rung it was
  // *served*: this service stands on rung 0 with no evidence about the child at
  // all, so a request for the top of the ladder is honoured as far as the band
  // reaches and stops there. Before issue 733 the second line of this test asserted
  // `1`, and a pack could put a beginner on the hardest rung the curriculum has
  // by asking.
  assert.equal(easiest.difficulty, 0)
  assert.equal(hardest.difficulty, HINT_BAND / span)
  assert.equal(rungs[0]?.node.id, easiest.skillId)
  assert.equal(rungs[HINT_BAND]?.node.id, hardest.skillId)

  // The request still selects *within* the band, in both directions, and the
  // band moves with the child rather than with the ladder. Walked up on the
  // host's own evidence first, because a band around rung 0 has only one side.
  climbTo(service, 20)
  const where = service.position()
  const low = service.next({ packId: "dynawalla.slice", difficulty: 0 })
  const high = service.next({ packId: "dynawalla.slice", difficulty: 1 })
  assert.ok(low && high)
  assert.equal(Math.round((low.difficulty ?? -1) * span), where - HINT_BAND)
  assert.equal(Math.round((high.difficulty ?? -1) * span), where + HINT_BAND)
  assert.notEqual(low.prompt, high.prompt)
})

test("a ceiling is honoured, and an unsatisfiable request clamps to the nearest rung that exists", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })

  // Every ceiling from 0 to 1 in hundredths, not two of them at one value. The
  // ceiling used to round rather than floor, so whether it was honoured depended
  // on where `cap × span` fell — 0.2 on a 43-rung ladder rounded down and passed,
  // and the same code on a 59-rung ladder served 0.203. A cap is honoured at every
  // cap or the word means nothing.
  for (let hundredths = 0; hundredths <= 100; hundredths++) {
    const cap = hundredths / 100
    for (const asked of [0, 0.5, 0.9, 1]) {
      const capped = service.next({ packId: "dynawalla.siege", difficulty: asked, maxDifficulty: cap })
      const where = capped?.difficulty ?? -1
      assert.ok(
        where >= 0 && where <= cap,
        `the ceiling ${String(cap)} served ${String(where)} for a request of ${String(asked)}`,
      )
    }
  }

  // The curriculum has no rung below its easiest, so a request under the floor
  // cannot be satisfied as asked. It clamps to the bottom of what exists rather
  // than failing — a pack built against a curriculum with easier content must
  // still be playable — and the pack can SEE the clamp, because the ordinate
  // that comes back is the one it got and not the one it asked for.
  const under = service.next({ packId: "dynawalla.siege", difficulty: -5 })
  assert.ok(under)
  assert.equal(under.difficulty, 0, "an impossible request did not land on the easiest rung")
  const over = service.next({ packId: "dynawalla.siege", difficulty: 99 })
  assert.ok(over)
  // The nearest satisfiable request, and since issue 733 what is satisfiable is the
  // band as well as the ladder: this service stands on rung 0, so the nearest
  // rung it can be asked for is `HINT_BAND` above it. Worth noting because a
  // request of 99 is not hypothetical — `beam` sends `2 + Math.round(level × 7)`
  // and `stack` sends a floor number, on scales that were never 0..1, and every
  // one of them used to arrive as "the hardest rung in the curriculum, please".
  assert.equal(
    over.difficulty,
    HINT_BAND / (ladder().length - 1),
    "an impossible request did not land on the hardest rung the band allows",
  )
})

test("driving the difficulty does not move the ladder: the pack proposes and the band disposes", () => {
  // This test asserted the *opposite* until issue 733, and the sentence it asserted —
  // "driving the difficulty moves the one ladder" — is the defect written down
  // as a property. `next()` used to apply a request by rewriting the whole rung
  // of `progress`, keeping only the banked fraction, so a pack that drives
  // difficulty every question overwrote the band's climb before the band could
  // serve a single item from it. ARENA measured `host pos 22 → 26 → 22`, every
  // question, on the real scheduler. Seventeen of the twenty-seven shipping
  // packs drive difficulty and not one of them reads `position()`, so for
  // seventeen games the founder's 85/95 rule was computed and then discarded.
  const rungs = ladder()
  const span = rungs.length - 1
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  climbTo(service, 20)
  const where = service.position()

  const item = service.next({ packId: "dynawalla.stack", difficulty: 1 })
  assert.ok(item)
  assert.equal(service.position(), where, "a difficulty request moved the host's rung")
  // Honoured, as far as the band reaches: the pack asked for the top and got one
  // rung up, which is a game shaping the texture of a question.
  assert.equal(Math.round((item.difficulty ?? -1) * span), where + HINT_BAND)

  // And a pack that stops driving is served from the host's own spread around
  // the host's own rung — which is where the child was the whole time, because
  // nothing the pack asked for was ever written into it.
  const after = service.next({ packId: "dynawalla.stack" })
  assert.ok(after)
  assert.equal(service.position(), where)
  const served = Math.round((after.difficulty ?? -1) * span)
  assert.ok(
    served >= where - SPREAD_BELOW && served <= where + SPREAD_ABOVE,
    `the host stands on rung ${String(where)} and served rung ${String(served)}`,
  )

  // And judging goes on from the host's rung, whatever the pack asked for on the
  // way in. This child climbed on a clean window, so one miss costs them nothing
  // — see `PROMOTE_AT`, "a miss inside a sustained window costs nothing" — and
  // what the assertion is really about is that they are still standing where the
  // *evidence* put them and not where `difficulty: 1` did.
  service.judge({
    packId: "dynawalla.stack",
    itemId: after.id,
    response: "definitely wrong",
    latencyMs: 1000,
  })
  assert.equal(
    service.position(),
    where,
    "a miss inside a sustained window moved the ladder off the rung the evidence put it on",
  )
})

test("the founder's rule: a pack asking for the top while the child sustains 60% is served the child's rung", () => {
  // > "you only progress when sustaining >~95% ... if you are getting 85% you
  // > are at the right level. if you are less than ~75% its too hard."
  //
  // The rule, from the pack's side of the boundary. A child is walked up to a
  // real rung on their own evidence, then starts getting three in five right —
  // under the founder's floor at every rung — while the pack goes on asking for
  // the hardest content the curriculum has, every single question. What the
  // child is *served* has to follow the child down.
  const rungs = ladder()
  const span = rungs.length - 1
  const service = createItemService({ profileId: "p-60", record: noRecord, rungs })
  climbTo(service, 20)
  const started = service.position()
  assert.ok(started >= 20)

  let highest = 0
  let everStood = 0
  for (let answered = 0; answered < 300; answered++) {
    const standing = service.position()
    everStood = Math.max(everStood, standing)
    const item = service.next({ packId: "dynawalla.arena", difficulty: 1 })
    assert.ok(item)
    const served = Math.round((item.difficulty ?? 0) * span)
    assert.ok(
      served <= standing + HINT_BAND,
      `the child stands on rung ${String(standing)}, the pack asked for rung ${String(span)}, ` +
        `and rung ${String(served)} was served`,
    )
    highest = Math.max(highest, served)
    const right = answered % 5 < 3
    service.judge({
      packId: "dynawalla.arena",
      itemId: item.id,
      response: right ? service.reveal(item.id) : "definitely wrong",
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
  }
  // Walked down off a level they cannot sit on, with the pack asking for the top
  // the entire way. Under the old rule every one of those 300 questions was rung
  // 76 — the hardest thing in the curriculum, handed to a child getting three in
  // five right, forever.
  assert.ok(
    service.position() < started - 5,
    `a child sustaining 60% was left on rung ${String(service.position())} having started on ` +
      `rung ${String(started)}`,
  )
  assert.ok(
    highest <= everStood + HINT_BAND,
    `the pack asked for rung ${String(span)} and reached rung ${String(highest)}, and the highest ` +
      `rung the child ever stood on was ${String(everStood)}`,
  )
  // Said again as a number a person can check against the ladder: asking for the
  // hardest rung in the curriculum, three hundred times, never got half way to it.
  // Guarded on the ladder's size, because this form of the claim is the only one
  // in this test that a shorter curriculum could falsify on correct code.
  assert.ok(span >= 44, `a ${String(span)}-rung ladder is too short for the claim below`)
  assert.ok(
    2 * highest < span,
    `the pack asked for rung ${String(span)} on every one of 300 questions and reached rung ` +
      `${String(highest)} of ${String(span)}`,
  )
})

test("the founder's rule, the other way: a pack asking for rung 2 cannot hold a child who sustains 95%", () => {
  // The converse, and it matters as much: a game whose own ladder is pinned low
  // — `merge-idle` at depth 1, `stack` on floor 1 — must not be able to park a
  // fluent child on the easiest content in the curriculum. The child is pulled
  // up by their own evidence and the pack's request is dragged up with them.
  const rungs = ladder()
  const span = rungs.length - 1
  const service = createItemService({ profileId: "p-95", record: noRecord, rungs })
  const packRung = 2

  let lowest = span
  for (let answered = 0; answered < 200; answered++) {
    const standing = service.position()
    const item = service.next({ packId: "dynawalla.stack", difficulty: packRung / span })
    assert.ok(item)
    const served = Math.round((item.difficulty ?? 0) * span)
    assert.ok(
      served >= standing - HINT_BAND,
      `the child stands on rung ${String(standing)} and was served rung ${String(served)}`,
    )
    if (standing > packRung) lowest = Math.min(lowest, served)
    service.judge({
      packId: "dynawalla.stack",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
  }
  assert.ok(
    service.position() > 20,
    `a child who was right every time was held at rung ${String(service.position())} by a pack ` +
      `asking for rung ${String(packRung)}`,
  )
  assert.ok(
    lowest > packRung,
    `the pack asked for rung ${String(packRung)} and was still being served rung ` +
      `${String(lowest)} after the child had climbed past it`,
  )
})

test("the ARENA pattern: a pack asking for its own number every question no longer resets the climb", () => {
  // The measurement in issue 733, as a test. ARENA derives its difficulty from its
  // own game state — the depth of the arena — and asks for it on every draw. The
  // host's position was observed going 22 → 26 → 22 → 26 → 22: the band climbed
  // on the evidence, `next()` wrote the pack's rung back over it, and the child
  // spent the session on a ladder the pack was holding still.
  //
  // Here the pack pins its number *below* the child and asks for it every
  // question while the child answers every one correctly. The host's rung must
  // never once move on a `next()`, and it must never be reset to the pack's.
  const rungs = ladder()
  const span = rungs.length - 1
  const service = createItemService({ profileId: "p-arena", record: noRecord, rungs })
  const packRung = 4

  const walked: number[] = []
  for (let answered = 0; answered < 150; answered++) {
    const before = service.position()
    const item = service.next({ packId: "dynawalla.arena", difficulty: packRung / span })
    assert.ok(item)
    assert.equal(
      service.position(),
      before,
      `drawing a question with a difficulty of ${String(packRung)}/${String(span)} moved the host ` +
        `from rung ${String(before)} to rung ${String(service.position())}`,
    )
    walked.push(service.position())
    service.judge({
      packId: "dynawalla.arena",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
  }

  // A child who is never wrong never steps down, so the walk is monotonic — and
  // that is precisely the property the sawtooth broke.
  assert.ok(walked.length === 150)
  for (let i = 1; i < walked.length; i++) {
    assert.ok(
      (walked[i] as number) >= (walked[i - 1] as number),
      `the host stood on rung ${String(walked[i - 1])} and then on rung ${String(walked[i])} ` +
        `without a single wrong answer between them`,
    )
  }
  assert.ok(
    service.position() > 4 * packRung,
    `a child who was right 150 times running finished on rung ${String(service.position())} with ` +
      `a pack asking for rung ${String(packRung)}`,
  )
})

test("the banked fraction survives a pack that names a difficulty on every question", () => {
  // The property the rule this replaced kept by hand, and the reason it kept it.
  // A child who is right every time and slow every time earns a *fraction* of a
  // rung per answer — in the tail regime an item's own p90 over the latency —
  // and it is carried in the fraction of `progress` until it adds up to a rung.
  // Overwriting the whole number on every draw is what deleted it, over and over,
  // and that child never moved at all.
  //
  // Nothing is written to `progress` by a request now, so the fraction and the
  // rung both survive; this holds the property from the outside, where a future
  // author who reintroduces a write can see it fail.
  //
  // **The child is walked off rung 0 first, and the request names a different
  // rung, and both of those are load-bearing.** An earlier draft of this test ran
  // the whole thing at rung 0 asking for rung 0, and it passed with the fix
  // reverted — at an anchor of 0 the old `progress = index + (progress −
  // Math.floor(progress))` is the identity, so it exercised the one arrangement
  // in which the deleted write does nothing. A test that passes against the code
  // it was written to reject is worse than no test, because it is counted.
  const rungs = ladder()
  const span = rungs.length - 1
  assert.ok(span > 8)
  const service = createItemService({ profileId: "p-slow", record: noRecord, rungs })
  climbTo(service, 5)
  const from = service.position()
  let answers = 0
  while (service.position() <= from && answers < 200) {
    // A rung below the child, every question, which is what a game whose own
    // ladder is pinned lower than the host's does all session.
    const item = service.next({ packId: "dynawalla.truedraw", difficulty: 0 })
    assert.ok(item)
    answers += 1
    service.judge({
      packId: "dynawalla.truedraw",
      itemId: item.id,
      // Ten times the widest published median: deep in the tail, so no single
      // answer is worth anything close to a whole rung.
      response: service.reveal(item.id),
      latencyMs: 10 * P50_WIDEST_PUBLISHED_MS,
    })
  }
  assert.ok(
    service.position() > from,
    `a slow-and-correct child with a pack naming a difficulty every question never got off rung ` +
      `${String(from)} in ${String(answers)} answers`,
  )
  // And it was banked rather than bought: more than one answer went into it, so
  // what moved the child was the accumulated fraction and not one whole stride.
  assert.ok(
    answers > 1,
    "the first answer in the slow tail was worth a whole rung, so this proves nothing about the fraction",
  )
})

test("a ceiling below the child still pins the ladder, which is the one way a pack still drives it", () => {
  // The boundary of the clamp, asserted so that nobody reads the tests above as
  // saying more than they do. `maxDifficulty` is not a hint and is not banded: it
  // is a pack declaring what it can physically draw, and a pack whose ceiling
  // sits below the child's rung both gets served at its ceiling *and* pulls the
  // host's ladder down to it — exactly as it did before the band existed, and
  // deliberately, because a position standing above content the pack can never
  // test the child on is a fiction, and because handing a game a rung it cannot
  // render is how PR 694 happened.
  //
  // The cost is real and is worth stating plainly: a pack that pins its ceiling
  // to its own request has opted out of the clamp entirely. `counterweight` does
  // exactly that (`games/counterweight/src/game/ladder.ts`, `difficulty: rung,
  // maxDifficulty: rung`), and `balance`, `horde`, `merge-idle`, `polarity`,
  // `gavel` and `lattice` all carry a standing ceiling that dilutes it. Widening
  // what those games can draw is pack work; it cannot be done from here without
  // serving a game a question it cannot put on the screen.
  const rungs = ladder()
  const span = rungs.length - 1
  const service = createItemService({ profileId: "p-ceiling", record: noRecord, rungs })
  climbTo(service, 20)
  assert.ok(service.position() >= 20)

  const pinned = 3
  const item = service.next({
    packId: "dynawalla.counterweight",
    difficulty: pinned / span,
    maxDifficulty: pinned / span,
  })
  assert.ok(item)
  assert.equal(Math.round((item.difficulty ?? -1) * span), pinned, "the ceiling was not honoured")
  assert.equal(
    service.position(),
    pinned,
    "a ceiling under the child's rung no longer pins the ladder — that is a change to what " +
      "`maxDifficulty` means, not to what `difficulty` means",
  )
})

test("every rung on the ladder draws a question with numbers in it", () => {
  // The test that was missing. `items.ts` read its operands out of two slots it
  // named — `top` and `bottom` — and `slotText(undefined)` returns "". So when
  // the curriculum grew a second active family whose slots are called `first`
  // and `second`, the six easiest rungs in the product rendered as " + " with
  // no numbers, and nothing anywhere said so: not a throw, not a log, not a
  // failing test. A child on the easiest content would have been shown a blank
  // question and asked to answer it.
  //
  // Every rung, not a sample: the rung this would next catch is by definition
  // one nobody thought to name.
  // Addressed by building the service on the one rung under test rather than by
  // asking for a `difficulty`. Since issue 733 a difficulty is a hint clamped to
  // `HINT_BAND` rungs of where the host's own evidence stands, so it cannot
  // address the ladder at all — and it never should have been the way to,
  // because `deps.rungs` says which rung exactly and a request only ever said
  // roughly. A sweep that could be made to skip rungs by a change in the host's
  // ladder policy was a sweep in name.
  const rungs = ladder()
  const families = new Set<string>()

  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i]
    assert.ok(rung !== undefined)
    const service = createItemService({ profileId: "p1", record: noRecord, rungs: [rung] })
    const item = service.next({ packId: "dynawalla.fuse" })
    assert.ok(item, `rung ${String(i)} (${String(rung.node.id)}) served nothing at all`)
    families.add(rung.family.family)

    assert.equal(item.operands.length, 2, `${item.skillId} did not draw two operands`)
    for (const operand of item.operands) {
      assert.match(operand, /^-?\d/, `${item.skillId} drew the operand "${operand}"`)
    }
    // The prompt a child reads, and a screen reader speaks. `" + "` is what
    // this used to be. All four glyphs, because `[+−]` was itself a statement
    // that this product only adds and subtracts — and one of three shapes, because
    // the curriculum can now put the unknown *inside* the expression and say so.
    // The shape asserted is the one the rung's own template declares, so a rung
    // drawn in the wrong shape fails here rather than passing a looser pattern.
    const shape = declaredBlanksOf(rung)
    assert.equal(
      shape.size,
      1,
      `${item.skillId} L${String(rung.level)} emits templates with ${String(shape.size)} different blank ` +
        `positions (${[...shape].join(", ")}) — a rung whose question changes shape cannot be checked here`,
    )
    assert.match(
      item.prompt,
      STATEMENT_SHAPE[[...shape][0] as PromptBlank],
      `${item.skillId} declares blank "${[...shape][0] as string}" and drew the prompt "${item.prompt}"`,
    )
    assert.ok(item.prompt.includes(item.operands[0] ?? "!"))
    assert.ok(item.prompt.includes(item.operands[1] ?? "!"))
    assert.equal(service.reveal(item.id).length > 0, true, `${item.skillId} has no answer`)
  }

  // And the operator agrees with **what the template declares**, across every
  // family on the ladder.
  //
  // This assertion used to read `item.skillId.includes("subtract") ? "-" : "+"`,
  // and that is the same guess the renderer was making, written down a second
  // time. It passed on `dw.mul.facts.tables-to-twelve` — a row whose id contains
  // no "subtract" — by asserting the multiplication was drawn with a plus sign.
  // A test that agrees with the defect is worse than no test, because it is
  // counted as coverage.
  assert.ok(families.size >= 1)
  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i]
    assert.ok(rung)
    const service = createItemService({ profileId: "p2", record: noRecord, rungs: [rung] })
    const item = service.next({ packId: "dynawalla.fuse" })
    assert.ok(item)
    const declared = declaredOperatorsOf(rung)
    assert.equal(
      declared.size,
      1,
      `${item.skillId} L${String(rung.level)} emits templates with ${String(declared.size)} different ` +
        `operators (${[...declared].join(", ")}) — a rung whose question changes shape cannot be checked here`,
    )
    const glyph = [...declared][0] as string
    assert.ok(
      item.prompt.includes(` ${glyph} `),
      `${item.skillId} declares ${glyph} and drew "${item.prompt}"`,
    )
    // `Item.operator` is reported for a plain `a OP b` and **withheld** on a blank
    // statement, where the two numerals are not the operands of the glyph between
    // them: on `□ × 15 = 165` they are 15 and the *product* 165, and a pack handed
    // `operator: "×"` alongside them could compute 2,475 and be reasonable about it.
    // `form` carries the distinction a pack would branch on.
    if ([...declaredBlanksOf(rung)][0] === "none") {
      assert.equal(
        item.operator,
        glyph === "−" ? "-" : glyph,
        `${item.skillId} declares ${glyph} and reported operator "${String(item.operator)}"`,
      )
      assert.equal(item.form, "binary-op", item.skillId)
    } else {
      assert.equal(
        item.operator,
        undefined,
        `${item.skillId} draws "${item.prompt}" and still reports operator ` +
          `"${String(item.operator)}" over two numerals that are not its operands`,
      )
      assert.equal(item.form, "value", item.skillId)
    }
  }
})

test("drawStatement writes the three shapes, and the box is U+25A1", () => {
  // The shapes as strings, which is the only form a reviewer can check against a card.
  assert.equal(drawStatement("15", "165", "×", "first"), "□ × 15 = 165")
  assert.equal(drawStatement("47", "68", "+", "second"), "47 + □ = 68")
  assert.equal(drawStatement("47", "68", "−", "first"), "□ − 47 = 68")
  assert.equal(drawStatement("93", "47", "−", "second"), "93 − □ = 47")
  // And a question with no blank is byte-for-byte what it was before this existed.
  // Every active row in the product but one is this branch.
  assert.equal(drawStatement("473", "641", "+", "none"), "473 + 641")

  // The code point, not the shape of the character. U+2610 BALLOT BOX is what the
  // curriculum's prose writes (`☐`) and it is **not** what any pack in the fleet
  // tokenises — `games/balance/src/adapter.ts:60` accepts `□`, `?` and `_` and
  // nothing else — so the two must not be confusable by eye here.
  assert.equal(BLANK, "□")
  assert.notEqual(BLANK, "☐")
  // Whitespace-delimited, because that is how the one pack that parses a statement
  // finds it. `___` fails this, and so does `□×15`.
  assert.deepEqual(drawStatement("15", "165", "×", "first").split(" "), [BLANK, "×", "15", "=", "165"])
})

test("the blank position is a table read with no fallback, and every operator has one", () => {
  assert.equal(blankPosition("dw.prompt.missing-operand.mul-unknown"), "first")
  assert.equal(blankPosition("dw.prompt.missing-operand.sub-unknown-minuend"), "first")
  assert.equal(blankPosition("dw.prompt.missing-operand.add-unknown"), "second")
  assert.equal(blankPosition("dw.prompt.missing-operand.sub-unknown"), "second")
  assert.equal(blankPosition("dw.prompt.column-op.add"), "none")
  assert.equal(blankPosition("dw.prompt.nothing.at-all"), null)
  assert.equal(blankPosition(""), null)

  // The pairing `next()` depends on. It reads the operator and the blank with two
  // calls, and a key that answered one and not the other would let a statement be
  // drawn with its box missing — so every key the operator lookup answers, the blank
  // lookup answers too, over the whole registry rather than over the seven lines above.
  let blanks = 0
  for (const entry of promptRegistry) {
    const key = String(entry.id)
    assert.notEqual(blankPosition(key), null, `${key} has no blank position`)
    if (binaryOperator(key) === null) continue
    const blank = blankPosition(key)
    if (blank !== "none") blanks += 1
  }
  assert.ok(blanks >= 4, `only ${String(blanks)} binary template(s) declare a blank`)
})

test("the founder's card is drawn, exactly, by the renderer the graph uses", () => {
  // > "maybe to prevent the calculator (or at least make it so that you have to
  // > understand the problem to use it correctly) we could use blanks in an equation
  // > `___ × 15 = 165`"
  //
  // `dw.alg.equality.missing-factor` is **active** now. It was draft when this test was
  // written, because `games/balance` could not build a board for a product it did not know
  // yet, and the row came off `PACK_STATEMENT_BLOCKED_SKILLS` when COUNTERPOISE PR 724
  // rebuilt its tokeniser around signed `product`/`quotient`/`countOf` terms. The status
  // line below is the tripwire that made this comment get revisited rather than rot.
  //
  // It still drives `ladder([node])` rather than the shipped ladder, and deliberately: the
  // claim is about one specific card, and picking it out of a 77-rung ladder by difficulty
  // would make the assertion depend on where the row happens to sit.
  //
  // Pinned on a seed rather than swept, because the assertion is about a specific card:
  // the box **opens** the statement, the 15 is the known factor, the 165 is the given
  // product, and the answer is the factor and not the product. Three of those four could
  // be wrong in a way a swept "some equation was drawn" check would pass.
  const node = allNodes.find((candidate) => String(candidate.id) === "dw.alg.equality.missing-factor")
  assert.ok(node !== undefined)
  assert.equal(node.status, "active", "missing-factor left the ladder without this test being revisited")
  const rung = ladder([node]).find((candidate) => candidate.level === 1)
  assert.ok(rung !== undefined)
  const exercise = rung.family.generate({
    skillId: rung.node.id,
    level: rung.level,
    seed: 4124,
    params: rung.params,
    forms: rung.node.generator.forms,
  })
  const [a = "", b = ""] = operandsOf(exercise)
  const operator = binaryOperator(exercise.prompt.key)
  const blank = blankPosition(exercise.prompt.key)
  assert.ok(operator !== null && blank !== null)
  assert.equal(drawStatement(a, b, operator.glyph, blank), "□ × 15 = 165")
  assert.equal(exercise.answer.canonical.kind, "integer")
  assert.equal(
    exercise.answer.canonical.kind === "integer" ? exercise.answer.canonical.value.n : 0n,
    11n,
    "the card asks for the missing factor and wants something other than 11",
  )
})

test("every blank statement the shipped ladder draws is a true equation, read back off the string", () => {
  // The assertion that would have caught the operator defect, the misstatement defect
  // and a wrong blank position, all three, and it is the one that matters: take the
  // string a child reads, put the revealed answer in the box, and check the equation is
  // true — parsed back out of the prompt rather than rebuilt from the parts that made
  // it. A renderer that agreed with itself and with nothing else fails here.
  //
  // Held over the whole ladder rather than over the one row that has a blank today, so
  // the next row promoted is covered by this existing.
  // One service per rung, for the reason given on the sweep above: a
  // `difficulty` is a hint clamped to the host's band since issue 733 and does not
  // address the ladder. `deps.rungs` does, exactly.
  const rungs = ladder()
  let statements = 0
  // Cards where the answer is the number already printed on the far side. Counted, so
  // that the one exception below is known to be *exercised* rather than merely written:
  // a branch nothing reaches is a branch that has stopped meaning anything.
  let halvings = 0

  for (let i = 0; i < rungs.length; i++) {
    const rung = rungs[i]
    assert.ok(rung !== undefined)
    const service = createItemService({ profileId: "p1", record: noRecord, rungs: [rung] })
    // Thirty-two draws a rung rather than eight. The halving coincidence the
    // exception below is written for arrives about one item in nine on one row,
    // and eight draws of one row is not enough of it to be *exercised* — see the
    // `halvings > 0` assertion at the end, which is what noticed.
    for (let repeat = 0; repeat < 32; repeat++) {
      const item = service.next({ packId: "dynawalla.balance" })
      assert.ok(item)
      if (!item.prompt.includes(BLANK)) continue
      statements += 1
      const revealed = service.reveal(item.id)
      const sides = item.prompt.split(" = ")
      assert.equal(sides.length, 2, `"${item.prompt}" is a blank statement with no single equals sign`)
      const tokens = (sides[0] ?? "").split(" ")
      assert.equal(tokens.length, 3, `"${item.prompt}" has a left side this cannot read: ${tokens.join("|")}`)
      const [left = "", glyph = "", right = ""] = tokens
      assert.equal(
        [left, right].filter((token) => token === BLANK).length,
        1,
        `"${item.prompt}" does not have exactly one box on its left side`,
      )
      const value = (token: string): bigint => BigInt(token === BLANK ? revealed : token)
      const stated =
        glyph === "+"
          ? value(left) + value(right)
          : glyph === "−"
            ? value(left) - value(right)
            : glyph === "×"
              ? value(left) * value(right)
              : (() => {
                  assert.fail(`"${item.prompt}" is written with the glyph "${glyph}"`)
                })()
      assert.equal(
        stated,
        BigInt(sides[1] ?? ""),
        `"${item.prompt}" with ${revealed} in the box claims ${String(stated)} = ${String(sides[1])}`,
      )
      // And the answer is not simply the other side of the card, which is the shape of
      // the failure this whole change is about: a missing factor whose "answer" is the
      // product reads perfectly and is wrong.
      //
      // With one exception, and it is arithmetic rather than a waiver. On `a − □ = c` the
      // answer *is* `c` exactly when `a = 2c` — `12 − □ = 6` wants 6 — and that is a
      // halving fact, not a card asking the wrong question. It arrives about one item in
      // nine on `dw.alg.equality.missing-subtrahend`, which went active with the pack fix
      // that let COUNTERPOISE build a board for a signed blank. So the coincidence is
      // allowed and *checked*: where the answer equals the printed result, the card must
      // be a subtraction whose minuend is twice it. Every other glyph, and every other
      // minuend, still fails.
      if (revealed === sides[1]) {
        halvings += 1
        assert.equal(glyph, "−", `"${item.prompt}" wants the number already printed on it`)
        assert.equal(right, BLANK, `"${item.prompt}" wants the number already printed on it`)
        assert.equal(
          value(left),
          2n * BigInt(sides[1] ?? ""),
          `"${item.prompt}" wants the number already printed on it and is not a halving fact`,
        )
      }
    }
  }
  assert.ok(statements >= 8, `only ${String(statements)} blank statement(s) were drawn by the shipped ladder`)
  assert.ok(
    halvings > 0,
    "no card drew an answer equal to its printed result, so the halving exception above is unreachable — " +
      "if the ladder no longer serves a missing subtrahend, delete it",
  )
})

test("a missing addend is judged on the addend, and adding the whole card is the diagnosed mistake", () => {
  // The end-to-end claim, on the row that is now active: a child who reads
  // `9 + □ = 18` and answers 9 is right, a child who answers 27 — every number on the
  // card added up, `mis.alg.add-all-numbers`, one of the two best-evidenced errors in
  // elementary algebra — is wrong *and named*, and a child who answers the printed
  // total is wrong and **not** named, because this shape does not instantiate
  // `mis.alg.equals-as-operator` and a diagnosis nobody earned is worse than none.
  //
  // Without the blank this row drew `9 + 18` and wanted 9, so the child who answered 27
  // was reading the card correctly and was marked wrong — and the child making the
  // diagnosed mistake was marked right. That is what is being fixed, and this is it
  // stated as three verdicts.
  const node = allNodes.find((candidate) => String(candidate.id) === "dw.alg.equality.missing-addend")
  assert.ok(node !== undefined)
  assert.equal(node.status, "active")
  const rung = ladder([node]).find((candidate) => candidate.level === 0)
  assert.ok(rung !== undefined)

  let judged = 0
  for (let seed = 0; seed < 12; seed++) {
    const service = createItemService({ profileId: `learner-${String(seed)}`, record: noRecord, rungs: [rung] })
    const item = service.next({ packId: "dynawalla.balance" })
    assert.ok(item)
    const sides = item.prompt.split(" = ")
    const known = (sides[0] ?? "").split(" ")[0] ?? ""
    const total = sides[1] ?? ""
    const correct = service.reveal(item.id)
    assert.notEqual(correct, total, `"${item.prompt}" wants the number already printed on it`)
    const addAll = String(BigInt(known) + BigInt(total))
    assert.notEqual(addAll, correct, `"${item.prompt}" — the mal-rule agrees with the answer`)

    const right = service.judge({ packId: "dynawalla.balance", itemId: item.id, response: correct, latencyMs: 4000 })
    assert.equal(right.correct, true, `"${item.prompt}" marked ${correct} wrong`)
    assert.equal(right.canonical, correct)

    // One attempt per item, so each verdict needs its own service on the same seeded
    // profile — `judge` spends the attempt, which is what makes returning the canonical
    // value safe at all.
    const replay = (response: string) => {
      const again = createItemService({ profileId: `learner-${String(seed)}`, record: noRecord, rungs: [rung] })
      const same = again.next({ packId: "dynawalla.balance" })
      assert.ok(same && same.prompt === item.prompt, "the same seeded profile drew a different card")
      return again.judge({ packId: "dynawalla.balance", itemId: same.id, response, latencyMs: 4000 })
    }

    const diagnosed = replay(addAll)
    assert.equal(diagnosed.correct, false, `"${item.prompt}" accepted ${addAll}`)
    assert.equal(
      diagnosed.diagnosis,
      "mis.alg.add-all-numbers",
      `"${item.prompt}" answered ${addAll} was not diagnosed: ${String(diagnosed.diagnosis)}`,
    )

    const echoedTotal = replay(total)
    assert.equal(echoedTotal.correct, false, `"${item.prompt}" accepted the printed total ${total}`)
    assert.equal(
      echoedTotal.diagnosis,
      undefined,
      `"${item.prompt}" answered ${total} was diagnosed ${String(echoedTotal.diagnosis)} — this shape does not ` +
        `instantiate that rule, and a named misconception the child does not hold aims a repair at nothing`,
    )
    judged += 1
  }
  assert.equal(judged, 12)
})

/**
 * The three statement shapes, as the patterns a drawn prompt has to match.
 *
 * Written out per position rather than as one permissive alternation, because a
 * pattern that accepted all three would pass a missing-addend drawn as a plain sum —
 * which is the entire defect `PromptBlank` exists to close. The box is spelled as its
 * code point so that a copy-paste of U+2610 BALLOT BOX, which no pack in the fleet
 * tokenises, fails here.
 */
const STATEMENT_SHAPE: Readonly<Record<PromptBlank, RegExp>> = {
  none: /^-?\d[\d ,.]*\s[+−×÷]\s-?\d/u,
  first: /^□\s[+−×÷]\s-?\d[\d ,.]*\s=\s-?\d/u,
  second: /^-?\d[\d ,.]*\s[+−×÷]\s□\s=\s-?\d/u,
}

/**
 * The blank positions a rung's own templates declare, read off the curriculum.
 *
 * The sibling of `declaredOperatorsOf`, and generated rather than guessed for the same
 * reason: a level may emit more than one template and which one a seed draws is not
 * something a caller can know without drawing it.
 */
function declaredBlanksOf(rung: Rung): ReadonlySet<PromptBlank> {
  const blanks = new Set<PromptBlank>()
  for (let seed = 1; seed <= 20; seed++) {
    const exercise = rung.family.generate({
      skillId: rung.node.id,
      level: rung.level,
      seed,
      params: rung.params,
      forms: rung.node.generator.forms,
    })
    const blank = promptBlank(String(exercise.prompt.key))
    assert.ok(blank !== null, `${rung.node.id} emits ${exercise.prompt.key}, which declares no blank position`)
    blanks.add(blank)
  }
  return blanks
}

/**
 * The operator glyphs a rung's own templates declare, read off the curriculum.
 *
 * The generator is run rather than the key guessed: `gen.number.compare-order`
 * emits two templates from one level, and which one a seed draws is not something
 * a caller can know without drawing it.
 */
function declaredOperatorsOf(rung: Rung): ReadonlySet<string> {
  const glyphs = new Set<string>()
  for (let seed = 1; seed <= 20; seed++) {
    const exercise = rung.family.generate({
      skillId: rung.node.id,
      level: rung.level,
      seed,
      params: rung.params,
      forms: rung.node.generator.forms,
    })
    const operator = promptOperator(String(exercise.prompt.key))
    assert.ok(operator !== null, `${rung.node.id} emits ${exercise.prompt.key}, which nothing declares`)
    glyphs.add(operator)
  }
  return glyphs
}

test("binaryOperator is a table read with no fallback, and the table is the curriculum's", () => {
  // The four glyphs, and the two spellings each one has: `glyph` is typography a
  // child reads and `protocol` is what `Item.operator` is typed as. The minus is
  // the pair that differ, and it is the reason this is a map and not a cast.
  assert.deepEqual(binaryOperator("dw.prompt.column-op.add"), { glyph: "+", protocol: "+" })
  assert.deepEqual(binaryOperator("dw.prompt.number-facts.sub"), { glyph: "−", protocol: "-" })
  assert.deepEqual(binaryOperator("dw.prompt.times-table.mul"), { glyph: "×", protocol: "×" })
  assert.deepEqual(binaryOperator("dw.prompt.long-div.quotient"), { glyph: "÷", protocol: "÷" })

  // A hyphen is not a minus sign. Written out as a code point so that a copy-paste
  // of the wrong character into `OPERATOR_GLYPH` fails here.
  assert.equal(binaryOperator("dw.prompt.column-op.sub")?.glyph, "−")
  assert.equal(binaryOperator("dw.prompt.times-table.mul")?.glyph, "×")
  assert.equal(binaryOperator("dw.prompt.times-table.div")?.glyph, "÷")

  // No fallback, in either direction. An unregistered key and a template that is
  // not a binary operation both return null — never a plus sign, which is the
  // whole defect: the old rule answered "+" to every question it did not
  // recognise, including questions that had no operator in them at all.
  assert.equal(binaryOperator("dw.prompt.nothing.at-all"), null)
  assert.equal(binaryOperator("dw.prompt.place-value.digit-value"), null)
  assert.equal(binaryOperator("dw.prompt.compare-order.greater"), null)
  assert.equal(binaryOperator(""), null)

  // And it is the curriculum's table rather than a second copy of it, over the
  // whole registry rather than the four lines above — so a template added
  // tomorrow is covered by this existing, not by somebody remembering to edit it.
  let binary = 0
  for (const entry of promptRegistry) {
    const declared = promptOperator(String(entry.id))
    const drawn = binaryOperator(String(entry.id))
    if (declared === "none") {
      assert.equal(drawn, null, `${entry.id} is not a binary operation and this file drew one`)
      continue
    }
    binary += 1
    assert.equal(drawn?.glyph, declared, `${entry.id} declares ${String(declared)} and this file draws ${drawn?.glyph}`)
    // And the protocol spelling, which is the half of the pair that is *not* the
    // identity: `Item.operator` types the minus as an ASCII hyphen and the other
    // three as their typographic glyphs. Asserted here so that a fifth operator
    // added to `PromptOperator` cannot reach the wire mistyped.
    assert.equal(
      drawn?.protocol,
      declared === "−" ? "-" : declared,
      `${entry.id} declares ${String(declared)} and reports operator "${String(drawn?.protocol)}"`,
    )
  }
  assert.ok(binary >= 20, `only ${String(binary)} binary templates checked — the registry shrank`)
})

test("a multiplication is drawn as a multiplication, and a division as a division", () => {
  // The regression, stated as the thing a child would have seen.
  //
  // Before the operator was read off the template that declares it,
  // `dw.mul.facts.tables-to-twelve` reached a child as **`5 + 7`, with 35 as the
  // answer they had to give**, and `dw.div.facts.division-facts` as `12 + 3`
  // wanting 4. Both cards read perfectly, both are answerable, and both mark a
  // correct child wrong — which is why no blank-screen check and no reviewer
  // caught them.
  //
  // Driven off `ladder([node])` and an explicit rung list so that it holds whether
  // or not these rows are active: the day somebody demotes one, this must still
  // fail rather than quietly stop testing anything.
  const cases: readonly { id: string; glyph: string; operator: string }[] = [
    { id: "dw.mul.facts.tables-to-twelve", glyph: "×", operator: "×" },
    { id: "dw.mul.multidigit.long-multiplication", glyph: "×", operator: "×" },
    { id: "dw.div.facts.division-facts", glyph: "÷", operator: "÷" },
    { id: "dw.div.whole.divide-exact", glyph: "÷", operator: "÷" },
    { id: "dw.add.facts.subtract-within-ten", glyph: "−", operator: "-" },
    { id: "dw.add.column.add-no-regroup", glyph: "+", operator: "+" },
  ]

  for (const expected of cases) {
    const node = allNodes.find((candidate) => String(candidate.id) === expected.id)
    assert.ok(node, `${expected.id} is gone from the graph`)
    const rungs = ladder([node])
    assert.ok(rungs.length > 0, `${expected.id} generates nothing`)
    const service = createItemService({ profileId: "p-operator", record: noRecord, rungs })
    for (let i = 0; i < 6; i++) {
      const item = service.next({ packId: "dynawalla.fuse" })
      assert.ok(item, `${expected.id} served nothing`)
      assert.equal(item.operator, expected.operator, `${expected.id} drew "${item.prompt}"`)
      assert.ok(
        item.prompt.includes(` ${expected.glyph} `),
        `${expected.id} drew "${item.prompt}" and not a ${expected.glyph}`,
      )
      // The plus sign is the specific wrong answer, so it is named.
      if (expected.glyph !== "+") {
        assert.ok(!item.prompt.includes("+"), `${expected.id} drew "${item.prompt}" with a plus sign in it`)
      }
      // And the question the string states is the question the answer answers.
      const [left = "", right = ""] = item.operands
      const answer = service.reveal(item.id)
      const a = BigInt(left.replace(/[^-0-9]/gu, ""))
      const bb = BigInt(right.replace(/[^-0-9]/gu, ""))
      const want =
        expected.glyph === "+" ? a + bb : expected.glyph === "−" ? a - bb : expected.glyph === "×" ? a * bb : a / bb
      assert.equal(
        answer,
        want.toString(),
        `${expected.id} drew "${item.prompt}" and wants ${answer}, which is not what that string asks`,
      )
    }
  }
})

test("every division a row that promises exactness serves does divide exactly", () => {
  // The founder, on the level he was thrown to: "you are asked to do like 87364/9
  // or something super treacherous". `87364 ÷ 9` is `9707.11…`, which is not exact,
  // and the two rows whose names promise exactness would be broken if they served
  // it. They do not: `gen.arith.long-div` draws the quotient and multiplies it back,
  // so the dividend is a product by construction. Pinned here rather than assumed,
  // because "divide-exact served an inexact division" is a bug a child cannot even
  // report — they would simply be marked wrong for the right answer.
  //
  // What the founder was almost certainly shown is the same *shape*: five digits
  // over one, which is `divide-exact` L1 and `zero-in-the-quotient` L1 — rungs 40
  // and 48 of the 66 the ladder has. Legal, and exactly the "racing you to
  // impossible mode" this file's gate exists to stop.
  for (const id of ["dw.div.whole.divide-exact", "dw.div.whole.zero-in-the-quotient"]) {
    const node = allNodes.find((candidate) => String(candidate.id) === id)
    assert.ok(node, `${id} is gone from the graph`)
    for (const rung of ladder([node])) {
      const service = createItemService({ profileId: `exact-${id}`, record: noRecord, rungs: [rung] })
      for (let i = 0; i < 200; i++) {
        const item = service.next({ packId: "dynawalla.fuse" })
        assert.ok(item, `${id} L${String(rung.level)} served nothing`)
        const [left = "", right = ""] = item.operands
        const dividend = BigInt(left.replace(/[^-0-9]/gu, ""))
        const divisor = BigInt(right.replace(/[^-0-9]/gu, ""))
        assert.notEqual(divisor, 0n, `${id} L${String(rung.level)} drew "${item.prompt}"`)
        assert.equal(
          dividend % divisor,
          0n,
          `${id} L${String(rung.level)} drew "${item.prompt}", which leaves ` +
            `${String(dividend % divisor)} over — a row named for exact division served an ` +
            `inexact one, and the child who answers ${String(dividend / divisor)} is marked wrong`,
        )
      }
    }
  }
})

test("a template that is not a binary operation is refused, loudly, rather than drawn as a sum", () => {
  // `dw.ns.place.digit-value` names a place with a `term` slot, and the renderer
  // put a plus sign between a number and that term's loc key: a child would have
  // read **`295 + dw.term.place.hundreds`** and been asked for 200. There is no
  // operator to draw there at all, and `promptOperator` says so by declaring the
  // template `none` — so nothing is served and the console says which row and why.
  const errors: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(" "))
  }
  try {
    for (const id of ["dw.ns.place.digit-value", "dw.ns.compare.whole-numbers"]) {
      const node = allNodes.find((candidate) => String(candidate.id) === id)
      assert.ok(node, `${id} is gone from the graph`)
      const rungs = ladder([node])
      assert.ok(rungs.length > 0)
      const service = createItemService({ profileId: "p-none", record: noRecord, rungs })
      assert.equal(service.next({ packId: "dynawalla.fuse" }), null, `${id} was served as a binary operation`)
    }
  } finally {
    console.error = original
  }
  assert.equal(errors.length, 2, `expected one refusal per row, got ${String(errors.length)}`)
  for (const message of errors) {
    assert.match(message, /does not declare as a binary operation/u, message)
  }
})

test("an answer this file cannot write as text is refused rather than served unanswerable", () => {
  // `dw.div.whole.quotient-and-remainder` answers `54 1/9`, and `answerText`
  // returns null for a fraction — so `reveal` was an empty string, `choicesFor`
  // returned nothing, and `judge` scored every response wrong. A complete-looking
  // card nobody can pass.
  const node = allNodes.find((candidate) => String(candidate.id) === "dw.div.whole.quotient-and-remainder")
  assert.ok(node)
  const rungs = ladder([node])
  assert.ok(rungs.length > 0)
  const errors: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    errors.push(args.map((arg) => String(arg)).join(" "))
  }
  try {
    const service = createItemService({ profileId: "p-frac", record: noRecord, rungs })
    assert.equal(service.next({ packId: "dynawalla.fuse" }), null)
  } finally {
    console.error = original
  }
  assert.equal(errors.length, 1)
  assert.match(errors[0] ?? "", /cannot write as text/u)
})

test("a minus a child writes with the glyph the card is written with is accepted", () => {
  // The host draws U+2212 in every prompt. `rational.parseRational` reads
  // `/^[+-]?\d+$/` and throws on U+2212, and `judge` scores a throw as wrong — so
  // a pack echoing the card's own glyph back, or a keypad whose minus key is the
  // one on the card, marks every correct negative answer wrong in silence.
  assert.equal(normalizeMinus("−7"), "-7")
  assert.equal(normalizeMinus("7"), "7")
  assert.equal(normalizeMinus("-7"), "-7")

  // End to end, on a row that can actually be got wrong this way. The graph has
  // no active signed row — see `SIGNED_BLOCKED_SKILLS` — so this is driven on the
  // draft one, which is the point: the parse has to be right before the row is
  // promoted, not after.
  const node = allNodes.find((candidate) => String(candidate.id) === "dw.int.arith.subtract-past-zero")
  assert.ok(node)
  const rungs = ladder([node])
  const service = createItemService({ profileId: "p-signed", record: noRecord, rungs })
  let checked = 0
  for (let i = 0; i < 20 && checked < 3; i++) {
    const item = service.next({ packId: "dynawalla.fuse" })
    assert.ok(item)
    const canonical = service.reveal(item.id)
    if (!canonical.startsWith("-")) continue
    checked += 1
    const verdict = service.judge({
      packId: "dynawalla.fuse",
      itemId: item.id,
      response: canonical.replace("-", "−"),
      latencyMs: 3000,
    })
    assert.equal(verdict.correct, true, `answering "${canonical.replace("-", "−")}" to "${item.prompt}" was wrong`)
  }
  assert.equal(checked, 3, "the signed row never produced a negative answer to check")
})

test("a signed row is offered four choices, not padded down to a coin toss", () => {
  // The near-miss padding skipped every negative candidate, which is right on a row
  // whose answers cannot go below zero and deletes most of the closed list on a row
  // whose answers routinely do. A game laying four slabs on a wall draws an empty
  // one for a missing choice, and an empty slab is a wrong answer a child cannot
  // read.
  //
  // Measured over every signed row and every level rather than one row and a
  // handful of items, because the shortfall is uneven: without
  // `AnswerSchema.integer.signed` read here, `dw.int.arith.multiply-signed` came up
  // short on **90 of 180** sampled items, some of them offering a single option.
  const signedRows = [
    "dw.int.arith.subtract-past-zero",
    "dw.int.arith.add-signed",
    "dw.int.arith.subtract-signed",
    "dw.int.arith.multiply-signed",
  ]
  let sawNegativeChoice = false
  let sampled = 0
  for (const id of signedRows) {
    const node = allNodes.find((candidate) => String(candidate.id) === id)
    assert.ok(node, `${id} is gone from the graph`)
    for (const rung of ladder([node])) {
      for (let seed = 1; seed <= 60; seed++) {
        const exercise = rung.family.generate({
          skillId: rung.node.id,
          level: rung.level,
          seed,
          params: rung.params,
          forms: rung.node.generator.forms,
        })
        const choices = choicesFor(exercise, 0)
        sampled += 1
        assert.equal(
          choices.length,
          4,
          `${id} L${String(rung.level)} seed ${String(seed)} offered ${String(choices.length)} choices: ` +
            choices.map((choice) => choice.text).join(", "),
        )
        if (choices.some((choice) => choice.text.startsWith("-"))) sawNegativeChoice = true
      }
    }
  }
  assert.ok(sampled >= 400, `only ${String(sampled)} signed items sampled`)
  assert.ok(sawNegativeChoice, "no wrong answer below zero was ever offered on a row that answers below zero")
})

// ---------------------------------------------------------------------------
// The ladder's climb rule, against the cadence table it is supposed to obey.
//
// Every millisecond quoted below is read off `docs/EXPERIENCE_DESIGN.md` by hand
// and written out as a literal. Nothing here calls `cadenceFor` or
// `climbWithinMs` to decide what it expects — a test that asks the fix what the
// answer is and then agrees with it measures nothing, and this repo has shipped
// several of those.
//
// | class                     | p50    | p90  |
// |---------------------------|--------|------|
// | single-digit fact         |  2.8 s |  6 s |
// | two-digit with regrouping |    6 s | 14 s |
// | three-digit               |   11 s | 27 s |
// | the `5,001 − 2,798` class |   16 s | 40 s |
const P50_BY_WIDTH: Readonly<Record<number, number>> = { 1: 2_800, 2: 6_000, 3: 11_000, 4: 16_000 }
/** The widest published median. Beyond four digits the table says nothing. */
const P50_WIDEST_PUBLISHED_MS = 16_000

const ACROSS_ZERO = "dw.add.regroup.subtract-across-zero"

function widthOf(operands: readonly string[]): number {
  let widest = 0
  for (const operand of operands) {
    const digits = operand.replace(/[^0-9]/g, "").length
    if (digits > widest) widest = digits
  }
  return widest
}

/** What the table says the median is for an item that wide. */
function publishedP50Ms(width: number): number {
  return P50_BY_WIDTH[width] ?? P50_WIDEST_PUBLISHED_MS
}

test("the `5,001 − 2,798` rungs are reachable: answering them at the published median climbs", () => {
  // The three levels of the hardest node that ships, on their own ladder so the
  // climb is observable rather than clamped at the top of the full one.
  const rungs = ladder().filter((rung) => rung.node.id === ACROSS_ZERO)
  assert.equal(rungs.length, 3, "the across-zero node no longer has three rungs")
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  assert.equal(service.position(), 0)

  for (let step = 0; step < rungs.length - 1; step++) {
    const before = service.position()
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    const width = widthOf(item.operands)
    const median = publishedP50Ms(width)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: service.reveal(item.id),
      // Exactly the median. Not "fast" — expected. Half of the children who
      // answer this question correctly take at least this long.
      latencyMs: median,
    })
    assert.ok(
      service.position() > before || before === rungs.length - 1,
      `${item.prompt} is ${String(width)} digits wide, its published median is ` +
        `${String(median)} ms, it was answered correctly in exactly that, and the ladder ` +
        `did not move off rung ${String(before)}`,
    )
  }
  assert.equal(service.position(), rungs.length - 1, "the hardest node's top rung is unreachable")
})

test("a two-digit regrouping answered a millisecond past the median still climbs", () => {
  // The median is the median: half of the children answering at the expected
  // pace are on the slow side of it. A gate cut at 6,000 ms sent every one of
  // them back down the ladder for being average.
  const rungs = ladder().filter((rung) => rung.node.id === "dw.add.regroup.subtract-multidigit")
  assert.ok(rungs.length > 1)
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })

  // Named rather than drawn from the spread, so the item under test is the
  // two-digit rung on every run and not four times in five — a named difficulty
  // is a point, which is what `items.ts` says it is.
  const item = service.next({ packId: "dynawalla.siege", difficulty: 0 })
  assert.ok(item)
  assert.equal(widthOf(item.operands), 2, `${item.prompt} is not the two-digit rung`)
  service.judge({
    packId: "dynawalla.siege",
    itemId: item.id,
    response: service.reveal(item.id),
    latencyMs: 6_001,
  })
  assert.ok(service.position() > 0, `${item.prompt} in 6,001 ms did not climb`)
  // And it is a *whole* stride, not a fraction of one: 6,001 ms is a millisecond
  // into the second half of the expected band, not into the slow tail.
  assert.equal(
    climbRungs({ digits: 2, fluencyP50Ms: undefined, latencyMs: 6_001 }),
    1,
    "a millisecond past the two-digit median is being scored as the slow tail",
  )
})

test("a child who answers every question correctly at its own published median reaches the top", () => {
  // End to end over the shipped ladder. This is the founder's sentence as a
  // test: "if they are just crushing double digits for a nice little while then
  // the triple digits come in."
  const rungs = ladder()
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  const top = rungs.length - 1

  const seen: string[] = []
  for (let answered = 0; answered < 200 && service.position() < top; answered++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    const before = service.position()
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
    if (service.position() === before) seen.push(`${item.prompt} (rung ${String(before)})`)
  }
  assert.equal(
    service.position(),
    top,
    `the ladder stalled at rung ${String(service.position())} of ${String(top)}; ` +
      `these questions were answered correctly at their published median and did not climb: ` +
      `${seen.slice(0, 5).join(", ")}`,
  )
})

test("no rung's climb window is narrower than that rung's own expected time", () => {
  // The invariant the defect violated, held over every rung in the shipped
  // ladder rather than over the four the table names.
  for (const rung of ladder()) {
    const service = createItemService({ profileId: "p1", record: noRecord, rungs: [rung] })
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item, `${rung.node.id}#L${String(rung.level)} served nothing`)
    const width = widthOf(item.operands)
    const window = climbWithinMs(width, rung.node.fluencyTarget?.p50Ms)
    assert.ok(window !== null, `${item.prompt} has no climb window at all`)
    assert.ok(
      window > publishedP50Ms(width),
      `${rung.node.id}#L${String(rung.level)} draws ${item.prompt}, ${String(width)} digits ` +
        `wide, whose published median is ${String(publishedP50Ms(width))} ms — and it climbs ` +
        `only under ${String(window)} ms`,
    )
    // And a node that declares its own median may only widen the window, never
    // narrow it. `dw.mul.*` declares 15 s and `dw.div.*` 18 s; those rows are
    // draft today and this is the guard that stops the same defect arriving
    // with them.
    const declared = rung.node.fluencyTarget?.p50Ms
    if (declared !== undefined) {
      assert.ok(
        window > declared,
        `${rung.node.id} declares a ${String(declared)} ms median and climbs only under ` +
          `${String(window)} ms`,
      )
    }
  }
})

test("every node in the graph, draft included, gets a window wider than its declared median", () => {
  for (const node of allNodes) {
    const declared = node.fluencyTarget?.p50Ms
    if (declared === undefined) continue
    for (let width = 1; width <= 6; width++) {
      const window = climbWithinMs(width, declared)
      assert.ok(window !== null && window > declared, `${node.id} at ${String(width)} digits`)
    }
  }
})

test("the cadence table is the only thing the climb window is derived from", () => {
  // The four published rows, restated as the assertion that the two lines in
  // `items.ts` actually pass through them.
  assert.deepEqual(cadenceFor(1), { p50Ms: 2_800, p90Ms: 6_000 })
  assert.deepEqual(cadenceFor(2), { p50Ms: 6_000, p90Ms: 14_000 })
  assert.deepEqual(cadenceFor(3), { p50Ms: 11_000, p90Ms: 27_000 })
  assert.deepEqual(cadenceFor(4), { p50Ms: 16_000, p90Ms: 40_000 })
  // A width that is not a width is not a class, and is never silently "easy".
  assert.equal(cadenceFor(0), null)
  assert.equal(cadenceFor(-1), null)
  assert.equal(climbWithinMs(0, undefined), null)
})

test("an unclassifiable item promotes and says so, rather than pinning a child in silence", () => {
  // A prompt with no numerals in it, on a node that declares no fluency target.
  // No family ships one today; the next one might, and the failure mode must be
  // a line in the log rather than a child who answers correctly all afternoon
  // and never moves.
  const base = ladder().find((rung) => rung.node.id === ACROSS_ZERO)
  assert.ok(base)
  assert.equal(base.node.fluencyTarget, undefined, "the chosen node now declares a median")

  const wordless = {
    ...base,
    family: {
      ...base.family,
      generate: (request: Parameters<typeof base.family.generate>[0]) => {
        const exercise = base.family.generate(request)
        return {
          ...exercise,
          prompt: {
            key: exercise.prompt.key,
            slots: {
              [SLOT_TOP]: { kind: "term", key: "dw.term.the-larger" } as unknown as PromptSlot,
              [SLOT_BOTTOM]: { kind: "term", key: "dw.term.the-smaller" } as unknown as PromptSlot,
            },
          },
        }
      },
    },
  } as typeof base

  const warnings: string[] = []
  const realWarn = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "))
  try {
    const service = createItemService({
      profileId: "p1",
      record: noRecord,
      rungs: [wordless, wordless],
    })
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    assert.equal(widthOf(item.operands), 0, `${item.prompt} still has numerals in it`)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: service.reveal(item.id),
      // Four minutes. Unclassifiable must mean generous, not punitive.
      latencyMs: 240_000,
    })
    assert.equal(service.position(), 1, "an unclassifiable item refused to promote")
  } finally {
    console.warn = realWarn
  }
  assert.ok(
    warnings.some((line) => line.includes(ACROSS_ZERO) && line.includes("fluencyTarget")),
    `nothing was said about it: ${JSON.stringify(warnings)}`,
  )
})

test("a latency that is not a measurement promotes and says so", () => {
  // `NaN <= 40000` is `false`. A pack with a broken clock would otherwise pin a
  // child to the bottom rung with nothing on the console at all.
  const warnings: string[] = []
  const realWarn = console.warn
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(" "))
  try {
    const service = createItemService({ profileId: "p1", record: noRecord })
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: Number.NaN,
    })
    assert.ok(service.position() > 0, "a broken clock stopped a correct answer climbing")
    // And it is worth a whole stride, not a fraction: an unmeasurable clock is
    // never a reason to pay a child less than the expected band.
    assert.equal(
      climbRungs({ digits: 1, fluencyP50Ms: undefined, latencyMs: Number.NaN }),
      1,
      "a broken clock is being scored as the slow tail",
    )
  } finally {
    console.warn = realWarn
  }
  assert.ok(
    warnings.some((line) => line.includes("not a measurement")),
    `nothing was said about it: ${JSON.stringify(warnings)}`,
  )
})

test("a correct answer from the slow tail never costs a rung, never jumps one, and enough of them promote", () => {
  // This test used to be called "…holds the rung", and holding is the thing the
  // founder ruled out: "if the person is 100% right but slow, we could still
  // slowly move up." So the claim is now three-part, and the middle part is
  // what stops "slowly" from quietly becoming "immediately".
  //
  // Note what the old version could not tell apart: a slow answer worth zero
  // and a slow answer worth a twentieth of a rung both leave `position()`
  // where it was after one answer. Only the third part below separates them,
  // and only the third part fails against the rule this replaced.
  // The whole ladder, not one node's four rungs: with a stride that opens at
  // `STEP_START` a filtered ladder is at its own ceiling within two answers, and
  // a clamp is not a measurement of anything.
  const rungs = ladder()
  assert.ok(rungs.length > 1)
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  const first = service.next({ packId: "dynawalla.siege" })
  assert.ok(first)
  service.judge({
    packId: "dynawalla.siege",
    itemId: first.id,
    response: service.reveal(first.id),
    latencyMs: 2_800,
  })
  const climbed = service.position()
  assert.ok(climbed > 0)

  const second = service.next({ packId: "dynawalla.siege" })
  assert.ok(second)
  service.judge({
    packId: "dynawalla.siege",
    itemId: second.id,
    response: service.reveal(second.id),
    // Five minutes on a single-digit fact. Nobody's p90.
    latencyMs: 300_000,
  })
  // Never costs a rung.
  assert.ok(
    service.position() >= climbed,
    `a slow correct answer cost a rung: ${String(climbed)} → ${String(service.position())}`,
  )
  // Never jumps one, *relative to the stride it was taken at* — which is the
  // claim that survives now that the search step is separate from what the
  // answer was worth. A slow answer buys strictly less of the same stride than
  // an expected-pace one, at every stride, so "slowly" cannot quietly become
  // "immediately" however wide the search happens to be open.
  for (const stair of [openStaircase(), { ...openStaircase(), step: STEP_TRACK }]) {
    const slow = ascentOf(stair, climbRungs({ digits: 1, latencyMs: 300_000 }))
    const expected = ascentOf(stair, climbRungs({ digits: 1, latencyMs: 2_800 }))
    assert.ok(
      slow < expected,
      `a five-minute answer moved ${String(slow)} rungs and an on-median one ${String(expected)}`,
    )
    assert.ok(slow > 0, "a five-minute correct answer moved nothing at all")
  }

  // And now the same answer, again and again. A child working at this pace all
  // afternoon is still working; a ladder that never moves for them is the
  // product telling them they are not.
  for (let i = 0; i < 60; i++) {
    const next = service.next({ packId: "dynawalla.siege" })
    assert.ok(next)
    service.judge({
      packId: "dynawalla.siege",
      itemId: next.id,
      response: service.reveal(next.id),
      latencyMs: 300_000,
    })
  }
  assert.ok(
    service.position() > climbed,
    `sixty correct answers in a row left the child on rung ${String(service.position())}, ` +
      `where one answer had already put them — slow and right is still right`,
  )
})

test("no run of wrong answers can push a child below the easiest rung the curriculum has", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  for (let i = 0; i < 30; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item, `the floor stopped serving questions after ${String(i)} misses`)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: "definitely wrong",
      latencyMs: 1_000,
    })
    assert.ok(service.position() >= 0, `the ladder went to ${String(service.position())}`)
  }
  assert.equal(service.position(), 0)
  assert.ok(service.next({ packId: "dynawalla.siege" }), "the floor is not serving questions")
})

test("an answer at the published median is worth a whole stride, and the bonus does not leak into it", () => {
  // Six answers, each taking exactly as long as the table says that class takes.
  // Not quick, not slow: expected. Expected is worth exactly one stride — the
  // middle regime — and the assertion is that six of them come to exactly the
  // sum of the first six strides rather than to anything larger, which is what
  // the speedcuber bonus leaking into ordinary pace would look like.
  const rungs = ladder()
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  let stair = openStaircase()
  let recent: Recent = []
  let expected = 0
  for (let i = 0; i < 6; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
    recent = noteRecent(recent, true)
    assert.equal(bandOf(recent), "climb", "six right in a row is not a sustained window")
    expected += ascentOf(stair, 1)
    stair = advanceStaircase(stair, 1, 1)
  }
  assert.equal(service.position(), Math.floor(expected))

  // Then three misses, which walk the window down through every band below the
  // gate: 6/7 is still inside the sitting band and must cost **nothing at all**,
  // 6/8 is under it and costs a stride, and 6/9 is decisive. The bands are read
  // here rather than assumed, because what this test is for is that the service
  // *composes* the window and the stride — the bands themselves are pinned at
  // their edges in "the four bands are the founder's sentence".
  //
  // Three and not more: six misses put this child through the floor of the ladder,
  // and two numbers that are both clamped to rung 0 agree about nothing.
  const climbed = service.position()
  const seen: Band[] = []
  for (let i = 0; i < 3; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: "definitely wrong",
      latencyMs: 1_000,
    })
    recent = noteRecent(recent, false)
    const band = bandOf(recent)
    seen.push(band)
    if (band !== "climb" && band !== "sit") {
      expected -= descentOf(stair, band)
      stair = advanceStaircase(stair, -1, null)
    } else {
      // Nothing is subtracted, and this is the assertion rather than an omission:
      // a miss whose window is still sustaining costs the child nothing. It is the
      // direct answer to "will just ream your ass if you get a few right", and it
      // is the one branch a rewrite would most easily drop.
      assert.equal(
        service.position(),
        climbed,
        `a miss inside a window still reading ${band} cost the child ` +
          `${String(climbed - service.position())} rungs — one miss is evidence about an item, ` +
          `not about a level`,
      )
      stair = advanceStaircase(stair, 0, null)
    }
  }
  assert.deepEqual(
    seen,
    ["sit", "slip", "lost"],
    "three misses after six right did not walk the window through the founder's bands",
  )
  assert.ok(expected > 0, "the arithmetic under test fell through the floor and is being clamped")
  assert.equal(
    service.position(),
    Math.floor(expected),
    "the misses did not cost exactly what their bands say they cost",
  )
})

// ---------------------------------------------------------------------------
// Calibration: find the level quickly, then track it gently.
//
// The founder's report, and the apparent contradiction in it:
//
//   "it's way too quick to go from 0+1 to 1269/9. We need to find the users level
//    more gently!"
//   "We need to sort of quickly find the players level .. maybe where they are
//    getting 80%+ correct but slowly"
//
// The search is quick; the content does not lurch. See `STEP_START` in `items.ts`.

test("the staircase opens wide, shrinks with every answer, and halves at a reversal", () => {
  const open = openStaircase()
  assert.equal(open.step, STEP_START, "the search does not open at the opening stride")
  assert.equal(open.reversed, false)
  assert.equal(open.lastDir, 0)

  // Never wrong: the stride shrinks toward `STEP_OPEN` and stops there, because a
  // child who has not been bracketed has not given the evidence that would let
  // the search slow below the rate this file has always climbed at.
  let straight = open
  const strides: number[] = []
  for (let i = 0; i < 40; i++) {
    strides.push(straight.step)
    straight = advanceStaircase(straight, 1, 1)
  }
  for (let i = 1; i < strides.length; i++) {
    assert.ok(
      (strides[i] as number) < (strides[i - 1] as number) + 1e-12,
      `the stride grew at answer ${String(i)}: ${String(strides[i - 1])} → ${String(strides[i])}`,
    )
  }
  // Converges on the floor from above and never goes under it: the decay is
  // geometric, so it approaches rather than arrives, and the floor is the thing
  // that must be exact in the direction that matters.
  assert.ok(
    straight.step >= STEP_OPEN,
    `the stride fell under its floor: ${String(straight.step)} < ${String(STEP_OPEN)}`,
  )
  assert.ok(
    straight.step - STEP_OPEN < 1e-4,
    `forty right answers left the stride at ${String(straight.step)}, not ${String(STEP_OPEN)}`,
  )
  assert.equal(straight.reversed, false, "a child who was never wrong was treated as bracketed")

  // A reversal is the moment the level is bracketed: an extra halving, and the
  // stride's floor drops from `STEP_OPEN` to `STEP_TRACK`.
  const before = advanceStaircase(advanceStaircase(open, 1, 1), 1, 1)
  const after = advanceStaircase(before, -1, null)
  assert.equal(after.reversed, true, "a direction change did not bracket the child")
  assert.ok(
    after.step < before.step / 2,
    `a reversal took the stride from ${String(before.step)} to ${String(after.step)}, which is ` +
      `not a halving on top of the per-answer decay`,
  )
  let settled = after
  for (let i = 0; i < 40; i++) settled = advanceStaircase(settled, 1, 1)
  assert.ok(
    Math.abs(settled.step - STEP_TRACK) < 1e-6,
    `a bracketed child's stride settled at ${String(settled.step)}, not ${String(STEP_TRACK)}`,
  )
})

// ---------------------------------------------------------------------------
// The founder's band: sit at 85%, climb only above 95%, leave under 75%.
//
// > "i think there is a principle here. you only progress when sustaining >~95%
// >  ... if you are getting 85% you are at the right level. if you are less than
// >  ~75% its too hard. Volta right now will just ream your ass if you get a few
// >  right!"
//
// See `PROMOTE_AT` in `items.ts` for why this is a windowed gate and not a
// Kaernbach ratio, and `RECENT_WINDOW` for where forty comes from.

/** A window of `hits` correct answers out of `seen`, which is all `bandOf` reads. */
function window(hits: number, seen: number): Recent {
  const bits: boolean[] = []
  for (let i = 0; i < seen; i++) bits.push(i < hits)
  return bits
}

test("the three thresholds are the three numbers the founder named", () => {
  // Restated deliberately, because these three are the founder's ruling and not a
  // derivation — a test that recomputed them from the code would be asserting that
  // the code equals itself. What is checked is that they are in the right order
  // with a real dead band between them, which is the property a future edit would
  // break by nudging one of them past another.
  assert.equal(PROMOTE_AT, 0.95, "the founder said progress needs sustained ~95%")
  assert.equal(SIT_AT, 0.85, "the founder said 85% is the right level")
  assert.equal(LOST_AT, 0.75, "the founder said under ~75% is too hard")
  assert.ok(LOST_AT < SIT_AT && SIT_AT < PROMOTE_AT, "the bands are not ordered")
  // In whole points, because 0.95 − 0.85 in binary floats is 0.09999999999999998
  // and a test that is right about the rule and wrong about floats gets deleted.
  assert.ok(
    Math.round(PROMOTE_AT * 100) - Math.round(SIT_AT * 100) >= 10,
    `the dead band between sitting and climbing is ${((PROMOTE_AT - SIT_AT) * 100).toFixed(0)} ` +
      `points wide — with no dead band the ladder has one threshold again, which is the whole ` +
      `defect this replaced`,
  )
})

test("the window is the width the dead band needs, and it is derived not chosen", () => {
  // A Bernoulli estimate over N answers has standard error √(p(1−p)/N). For the
  // dead band between `SIT_AT` and `PROMOTE_AT` to hold a child still rather than
  // be crossed by noise, that error must be no wider than half the band, measured
  // at the middle of the band. Derived from the two thresholds, so nudging either
  // one fails this until the window is recomputed.
  const middle = (SIT_AT + PROMOTE_AT) / 2
  const halfBand = (PROMOTE_AT - SIT_AT) / 2
  const needed = (middle * (1 - middle)) / (halfBand * halfBand)
  assert.ok(
    RECENT_WINDOW >= needed,
    `a window of ${String(RECENT_WINDOW)} measures accuracy to ` +
      `${(Math.sqrt((middle * (1 - middle)) / RECENT_WINDOW) * 100).toFixed(1)} points, and half ` +
      `the dead band is ${(halfBand * 100).toFixed(1)} — the band is narrower than the ` +
      `measurement, so the ladder wanders instead of sitting. It needs at least ` +
      `${String(Math.ceil(needed))} answers`,
  )
  // And not wastefully longer than it needs to be: a window is answers a miss is
  // held against a child, so every answer past the derivation is a cost.
  assert.ok(
    RECENT_WINDOW <= 2 * needed,
    `a window of ${String(RECENT_WINDOW)} is more than twice the ${String(Math.ceil(needed))} ` +
      `the dead band needs, and the surplus is answers a child is held down for`,
  )
})

test("the window is a window: it forgets, and its denominator is what was seen", () => {
  // The two ways a running estimate is got wrong, both of which would break the
  // rule in a direction nothing else here would catch.
  assert.equal(recentAccuracy([]), null, "an empty window has no accuracy to report")
  assert.equal(bandOf([]), "sit", "with no evidence at all the ladder must hold still")
  // Divided by what was seen: four right out of four is 100% and climbs. Padding
  // the denominator to `RECENT_WINDOW` would read this child as 10%.
  assert.equal(recentAccuracy(window(4, 4)), 1)
  assert.equal(bandOf(window(4, 4)), "climb")
  // It forgets. A full window plus one answer is still `RECENT_WINDOW` long, and
  // the answer that fell off the front is the oldest one.
  let recent: Recent = window(0, RECENT_WINDOW)
  assert.equal(recent.length, RECENT_WINDOW)
  for (let i = 0; i < RECENT_WINDOW; i++) recent = noteRecent(recent, true)
  assert.equal(recent.length, RECENT_WINDOW, "the window grew past its own length")
  assert.equal(recentAccuracy(recent), 1, "a full window of misses never aged out")
  // One more answer than the window holds, from empty.
  let filling: Recent = []
  for (let i = 0; i <= RECENT_WINDOW; i++) filling = noteRecent(filling, i > 0)
  assert.equal(filling.length, RECENT_WINDOW)
  assert.equal(recentAccuracy(filling), 1, "the one miss at the start did not age out")
})

test("the four bands are the founder's sentence, at their exact edges", () => {
  // Every boundary, in whole answers out of `RECENT_WINDOW`, so an off-by-one in
  // any comparison shows up here. Written as counts rather than as ratios because
  // `38 / 40` is exactly 0.95 and `0.95` written out is not always.
  const misses = (k: number) => window(RECENT_WINDOW - k, RECENT_WINDOW)
  assert.equal(bandOf(misses(0)), "climb", "a perfect window does not climb")
  assert.equal(bandOf(misses(2)), "climb", "two misses in forty is 95% and must still climb")
  assert.equal(bandOf(misses(3)), "sit", "three misses in forty is 92.5% and is not sustaining 95%")
  assert.equal(bandOf(misses(6)), "sit", "six misses in forty is 85% and is the right level")
  assert.equal(bandOf(misses(7)), "slip", "seven misses in forty is 82.5% and is under the band")
  assert.equal(bandOf(misses(10)), "slip", "ten misses in forty is 75% and is not yet decisive")
  assert.equal(bandOf(misses(11)), "lost", "eleven misses in forty is 72.5% and is too hard")
  assert.equal(bandOf(misses(RECENT_WINDOW)), "lost")
})

test("a few right by being lucky cannot climb, which is the report this fixes", () => {
  // > "you get a few right just by being lucky and all of a sudden you are asked
  // >  to do like 87364/9"
  //
  // Four lucky taps in a row are 100% and do climb — nothing can tell them apart
  // from four answers a child knew, and the stride is what bounds how far they
  // go. What must not survive is the *fifth* answer: under the rule this replaced,
  // one miss cost a rung and the next correct answer bought it straight back, so a
  // guesser at one-in-four rode the noise upward. Now the miss is in the window.
  let recent: Recent = []
  for (let i = 0; i < 4; i++) recent = noteRecent(recent, true)
  assert.equal(bandOf(recent), "climb", "four right in a row is not evidence of anything at all")
  recent = noteRecent(recent, false)
  assert.equal(bandOf(recent), "slip", "one miss in five is 80% and the climb must stop dead")
  // And it stays stopped: the child cannot buy the climb back with one answer, or
  // with ten. `PROMOTE_AT` over a window with a miss in it needs the window full.
  for (let i = 0; i < 10; i++) {
    recent = noteRecent(recent, true)
    assert.notEqual(
      bandOf(recent),
      "climb",
      `a single miss was bought back after ${String(i + 1)} correct answers — the window is ` +
        `${String(recent.length)} long, and 95% of it does not admit a miss until it is ` +
        `${String(Math.ceil(1 / (1 - PROMOTE_AT)))} long`,
    )
  }
  // It comes back, when it has genuinely been sustained.
  for (let i = 0; i < RECENT_WINDOW; i++) recent = noteRecent(recent, true)
  assert.equal(bandOf(recent), "climb", "a child who did sustain 95% is still not allowed to climb")
})

test("demotion is readier than promotion, and under 75% it is not a contest", () => {
  // The founder asked for demotion to be readier and for under-75% to be
  // decisive. Both are properties of the *gate*, not of the step size, so both are
  // computed from the binomial over the window rather than read off a constant.
  //
  // See the table on `PROMOTE_AT` in `items.ts`; this is that table, derived.
  const choose = (n: number, k: number) => {
    let lg = 0
    for (let i = 1; i <= k; i++) lg += Math.log(n - k + i) - Math.log(i)
    return lg
  }
  /** P(band | true accuracy p), over a full window. */
  const spread = (p: number) => {
    const out: Record<Band, number> = { climb: 0, sit: 0, slip: 0, lost: 0 }
    for (let k = 0; k <= RECENT_WINDOW; k++) {
      // `p` of exactly 1 puts a `log(0)` in the k > 0 terms, which is the child
      // requirement 5 is about — spelled out rather than left as a `NaN`.
      const q =
        p === 1
          ? k === 0
            ? 1
            : 0
          : Math.exp(
              choose(RECENT_WINDOW, k) + k * Math.log(1 - p) + (RECENT_WINDOW - k) * Math.log(p),
            )
      out[bandOf(window(RECENT_WINDOW - k, RECENT_WINDOW))] += q
    }
    return out
  }
  // At the bottom of the sitting band, down must be much readier than up.
  const atFloor = spread(SIT_AT)
  const down = atFloor.slip + atFloor.lost
  assert.ok(
    down > 5 * atFloor.climb,
    `at ${(SIT_AT * 100).toFixed(0)}% correct the ladder reads climb on ` +
      `${(atFloor.climb * 100).toFixed(1)}% of answers and down on ${(down * 100).toFixed(1)}% — ` +
      `that is not readier down than up`,
  )
  // And at the too-hard threshold it is not a contest: essentially every answer
  // moves the child down, and a large share of them decisively.
  const tooHard = spread(LOST_AT)
  assert.ok(
    tooHard.slip + tooHard.lost > 0.85,
    `at ${(LOST_AT * 100).toFixed(0)}% correct only ` +
      `${((tooHard.slip + tooHard.lost) * 100).toFixed(1)}% of answers move the child down`,
  )
  assert.ok(
    tooHard.lost > 0.25,
    `at ${(LOST_AT * 100).toFixed(0)}% correct the decisive branch fires on only ` +
      `${(tooHard.lost * 100).toFixed(1)}% of answers, so "too hard" is being left at the ` +
      `same rate as "a bit hard"`,
  )
  assert.ok(
    tooHard.climb < 0.01,
    `at ${(LOST_AT * 100).toFixed(0)}% correct the ladder still climbs on ` +
      `${(tooHard.climb * 100).toFixed(1)}% of answers — "will just ream your ass" is what that ` +
      `feels like`,
  )
  // The other end: a child who is never wrong is never held. This is the property
  // requirement 5 turns on — the gate must not be in a perfect child's way.
  assert.equal(spread(1).climb, 1, "a child at 100% is not climbing on every single answer")
  // And the drift changes sign inside the founder's band, which is what makes the
  // settled accuracy land in it from either direction. Weighted by the step sizes,
  // which is the whole of the arithmetic: up is one stride and down is one or
  // `DESCENT_FAR`.
  const drift = (p: number) => {
    const s = spread(p)
    return s.climb - s.slip * DESCENT_NEAR - s.lost * DESCENT_FAR
  }
  assert.ok(drift(SIT_AT) < 0, `a child at ${(SIT_AT * 100).toFixed(0)}% is drifting upward`)
  assert.ok(
    drift(PROMOTE_AT) > 0,
    `a child at ${(PROMOTE_AT * 100).toFixed(0)}% is not drifting upward`,
  )
})

test("the two descent weights are one stride and the Kaernbach weight for 75%", () => {
  // `DESCENT_FAR` is `LOST_AT / (1 − LOST_AT)`: the up:down ratio at which a
  // classical weighted staircase has zero drift at the accuracy the founder called
  // too hard, so below it the ladder is driven down rather than drifting. Derived
  // from `LOST_AT`, so a test that compared `DESCENT_FAR` to itself — which is the
  // shape PR 699's own ratio assertion originally had — cannot pass here.
  // As the whole ratio rather than as 0.75, because `0.75 / (1 − 0.75)` in binary
  // floats is a thing nobody should have to reason about.
  const RIGHT = 3
  const ASKED = 4
  assert.equal(LOST_AT, RIGHT / ASKED, "LOST_AT is not the three-in-four the weight is built on")
  assert.equal(
    DESCENT_FAR,
    RIGHT / (ASKED - RIGHT),
    `the decisive descent is the weight for ` +
      `${((DESCENT_FAR / (1 + DESCENT_FAR)) * 100).toFixed(0)}% correct, not ` +
      `${(LOST_AT * 100).toFixed(0)}%`,
  )
  assert.equal(DESCENT_NEAR, 1, "a level that is wrong is not left at the rate it was entered")
  assert.ok(DESCENT_FAR > DESCENT_NEAR, "too hard is not left faster than a bit hard")

  const settled: Staircase = { step: STEP_TRACK, lastDir: 1, reversed: true, pace: 1 }
  assert.equal(descentOf(settled, "slip") / ascentOf(settled, 1), DESCENT_NEAR)
  assert.equal(descentOf(settled, "lost") / ascentOf(settled, 1), DESCENT_FAR)
  // And in a slower child's currency: a child whose correct answers are worth a
  // quarter of a rung each falls a quarter as far, so the ratios are the same for
  // them and they are not parked below the quick child who knows as much.
  const deliberate: Staircase = { ...settled, pace: 0.25 }
  assert.equal(descentOf(deliberate, "lost") / ascentOf(deliberate, 0.25), DESCENT_FAR)
  assert.equal(descentOf(deliberate, "lost"), descentOf(settled, "lost") / 4)

  // Before the bracket closes both are one stride. The first miss is the move that
  // *closes* the bracket and must be the size of the moves that opened it —
  // `DESCENT_FAR` times an opening stride of four rungs is twelve, which is the
  // lurch in the other direction.
  const opening = openStaircase()
  assert.equal(
    descentOf(opening, "lost"),
    ascentOf(opening, 1),
    `the first miss costs ${String(descentOf(opening, "lost"))} rungs against an opening stride ` +
      `of ${String(ascentOf(opening, 1))} — the move that closes the bracket must be the size of ` +
      `the moves that opened it, or one slip throws a child down the ladder`,
  )
  assert.equal(
    descentOf(opening, "slip"),
    ascentOf(opening, 1),
    `the first miss in the slip band costs ${String(descentOf(opening, "slip"))} rungs against ` +
      `an opening stride of ${String(ascentOf(opening, 1))}`,
  )
})

test("a sit holds the rung, decays the stride, and is not a reversal", () => {
  // The third direction, which the rule this replaced did not have. A child in the
  // dead band must not move, must not have their bracket disturbed by standing
  // still, and must not still be carrying an opening stride when they leave.
  const climbing = advanceStaircase(advanceStaircase(openStaircase(), 1, 1), 1, 1)
  const sat = advanceStaircase(climbing, 0, 1)
  assert.equal(sat.lastDir, climbing.lastDir, "holding still changed the child's direction")
  assert.equal(sat.reversed, climbing.reversed, "holding still closed the bracket")
  assert.ok(sat.step < climbing.step, "the stride did not decay while the child sat")
  // A sit after a sit is still not a reversal, however many there are, and the
  // stride still lands on its floor rather than under it.
  let long = sat
  for (let i = 0; i < 60; i++) long = advanceStaircase(long, 0, 1)
  assert.equal(long.lastDir, 1)
  assert.equal(long.reversed, false)
  assert.ok(Math.abs(long.step - STEP_OPEN) < 1e-6, `sitting left the stride at ${String(long.step)}`)
  // The next real move after a long sit is still the move it would have been: down
  // from a climb is a reversal, and it brackets.
  const after = advanceStaircase(long, -1, null)
  assert.equal(after.reversed, true, "the reversal after a sit did not close the bracket")
})

test("a child at 90% sits, a child at 80% is walked down, and both stay in the founder's band", () => {
  // The band, end to end, through the real service. Two children in fixed
  // patterns rather than at random, so the assertions are about the rule and not
  // about a seed: nine right in ten is inside the sitting band and must come to
  // rest, four right in five is under its floor and must be walked off it. The
  // rule this replaced walked *both* of them to 80% and called it done.
  const rungs = ladder()
  const top = rungs.length - 1
  const walkOf = (profileId: string, rightWhen: (n: number) => boolean) => {
    const walked: number[] = []
    const service = createItemService({ profileId, record: noRecord, rungs })
    for (let answered = 0; answered < 600; answered++) {
      const item = service.next({ packId: "dynawalla.siege" })
      assert.ok(item)
      const right = rightWhen(answered)
      service.judge({
        packId: "dynawalla.siege",
        itemId: item.id,
        response: right ? service.reveal(item.id) : "definitely wrong",
        latencyMs: publishedP50Ms(widthOf(item.operands)),
      })
      walked.push(service.position())
    }
    return walked
  }

  // 90%: inside the dead band, so it settles and stays — not the top, not the
  // floor, and a handful of rungs wide.
  const ninety = walkOf("p90", (n) => n % 10 !== 9).slice(500)
  const low = Math.min(...ninety)
  const high = Math.max(...ninety)
  assert.ok(low > 0, `a 90%-correct child slid to rung ${String(low)}`)
  assert.ok(
    high < top,
    `a 90%-correct child crept to the top (rung ${String(high)} of ${String(top)})`,
  )
  assert.ok(
    high - low <= 2 * (SPREAD_BELOW + SPREAD_ABOVE),
    `a 90%-correct child's last hundred answers ranged over rungs ${String(low)}..${String(high)}`,
  )

  // 80%: under the sitting band at every rung, so there is nowhere for this child
  // to come to rest and the ladder must keep walking them down. This is the
  // assertion that would have passed under the old rule for the wrong reason — a
  // 1:4 Kaernbach staircase has zero drift at exactly 80% and parked them
  // mid-ladder, at the accuracy the founder says is too low.
  const eighty = walkOf("p80", (n) => n % 5 !== 4)
  assert.ok(
    (eighty.at(-1) as number) < 3,
    `a child who is right four times in five — under the founder's floor at every rung — was ` +
      `parked at rung ${String(eighty.at(-1))} instead of being walked down`,
  )
})

// ---------------------------------------------------------------------------
// The three regimes.
//
// Founder ruling, verbatim: "if it takes a long time to get the right answer
// then we should tend to stay at the same level .. if the person is 100% right
// but slow, we could still slowly move up. But, a speedcuber should move up very
// fast." Holding was therefore wrong, and this block is that sentence as three
// tests plus the two things the mechanism must not break — a guesser, and the
// floor.
//
// The published p90 column, read off `docs/EXPERIENCE_DESIGN.md` by hand like
// the p50 column above. Nothing below calls `itemPace` or `climbRungs` to decide
// what it expects.
//
// | class                     | p50    | p90  |
// |---------------------------|--------|------|
// | single-digit fact         |  2.8 s |  6 s |
// | two-digit with regrouping |    6 s | 14 s |
// | three-digit               |   11 s | 27 s |
// | the `5,001 − 2,798` class |   16 s | 40 s |
const P90_WIDEST_PUBLISHED_MS = 40_000

/**
 * A latency that is in the slow tail of *every* rung that ships, by hand.
 *
 * The widest published p90 is 40 s. The most generous median any node in the
 * graph declares is `dw.div.*` at 18 s, and a declared median widens to 45 s.
 * A minute is past both, so one minute per question is the slow tail of every
 * question in the product — including `0 + 3` — without this test re-deriving
 * the window from the code under test.
 */
const A_FULL_MINUTE_MS = 60_000

/**
 * A latency that is quick for every rung that ships, by hand.
 *
 * The narrowest published median is 2.8 s and a declared median can only widen
 * it, so the quickest any item's quick mark can be is a fraction of 2.8 s. Two
 * hundred milliseconds is under any fraction of it that a human clock could
 * report — a child who has the fact and does not compute it.
 */
const A_SPEEDCUBER_MS = 200

/** Answers correctly at a fixed pace until the top, or until it gives up. */
function runChild(latencyMs: number, limit: number) {
  const rungs = ladder()
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  const top = rungs.length - 1
  let answers = 0
  while (answers < limit && service.position() < top) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs,
    })
    answers += 1
  }
  return { rung: service.position(), top, answers, elapsedMs: answers * latencyMs }
}

test("regime 2: a child who is right every single time and slow every single time still climbs", () => {
  // THE test. Before this rule, a correct answer past the item's p90 held the
  // rung, so this child — one minute a question, never once wrong — sat on rung
  // 0 for as long as they played and the product had nothing to say about it.
  // "if the person is 100% right but slow, we could still slowly move up."
  const slow = runChild(A_FULL_MINUTE_MS, 400)
  assert.ok(
    slow.rung > 0,
    `four hundred correct answers in a row left the child on rung ${String(slow.rung)} of ` +
      `${String(slow.top)}. Being unhurried is not being wrong, and this is the child the ` +
      `product exists for`,
  )
  // And they get all the way there, given the afternoon.
  assert.equal(
    slow.rung,
    slow.top,
    `the slow child stalled at rung ${String(slow.rung)} of ${String(slow.top)} after ` +
      `${String(slow.answers)} correct answers`,
  )
  // **And the accuracy gate is not in their way at all.** This is the number PR
  // 672 brought from 33 hours to 87 answers and PR 699 measured at 126 on the
  // 66-rung ladder, and a promotion gate is the kind of change that would quietly
  // add a warm-up to it. A child who is never wrong is at 100%, which is over
  // `PROMOTE_AT` from their very first answer, so the gate must cost them exactly
  // nothing — pinned as a count, because "not much slower" is how a regression of
  // this shape ships.
  assert.ok(
    slow.answers <= 2 * slow.top,
    `a perfect child took ${String(slow.answers)} answers to climb ${String(slow.top)} rungs. ` +
      `Being unhurried already costs them a fraction of a rung an answer; the accuracy gate must ` +
      `cost them nothing on top of it, because 100% clears ${String(PROMOTE_AT)} on answer one`,
  )
  // Structurally, not just numerically: at no point in that climb was the window
  // anything but `climb`, so there is no path by which the gate could have held
  // them. A window of nothing but correct answers is 100% at every length.
  let perfect: Recent = []
  for (let i = 0; i < 3 * RECENT_WINDOW; i++) {
    perfect = noteRecent(perfect, true)
    assert.equal(
      bandOf(perfect),
      "climb",
      `after ${String(i + 1)} correct answers in a row the gate stopped reading climb`,
    )
  }
})

test("regime 1 beats regime 2: the same ladder, quick, takes far fewer answers than slow", () => {
  // "slowly" is the load-bearing word in the ruling — slow-and-correct must
  // climb, and must not climb at the pace of a child who has the fact. A rule
  // that promoted everyone equally would pass the test above and fail the
  // product.
  const quick = runChild(A_SPEEDCUBER_MS, 400)
  const slow = runChild(A_FULL_MINUTE_MS, 400)
  assert.equal(quick.rung, quick.top)
  assert.equal(slow.rung, slow.top)
  assert.ok(
    quick.answers * 4 < slow.answers,
    `the speedcuber took ${String(quick.answers)} answers to the top and the slow child took ` +
      `${String(slow.answers)} — those are not different speeds`,
  )
})

test("regime 1: a speedcuber does not walk every rung", () => {
  // "a speedcuber should move up very fast." Two-sided: more than one rung per
  // answer, and not an unbounded number of them — the cap is the table's own
  // p90/p50 spread, 40/16 = 2.5 at its widest row.
  const quick = runChild(A_SPEEDCUBER_MS, 400)
  assert.equal(quick.rung, quick.top)
  assert.ok(
    quick.answers < quick.top,
    `${String(quick.top)} rungs took ${String(quick.answers)} answers at ${String(
      A_SPEEDCUBER_MS,
    )} ms each — that is one rung per answer or worse, and a child who answers in a fifth of a ` +
      `second is not being told anything by this ladder`,
  )
  // Bounded, and the bound is the two numbers it is made of: what one answer can
  // be worth (2.5, the table's widest published p90/p50) times the widest the
  // search ever opens (`STEP_START`). Not 2.5 alone — during calibration the
  // stride is deliberately wider than one rung, which is the "quickly find the
  // players level" half of the founder's report. What must not exist is an
  // unbounded rate.
  assert.ok(
    quick.answers >= Math.ceil(quick.top / (2.5 * STEP_START)),
    `${String(quick.top)} rungs in ${String(quick.answers)} answers is more than ` +
      `${String(2.5 * STEP_START)} rungs an answer, which is the widest published p90/p50 ` +
      `times the widest the search ever opens`,
  )
  // And once the search has settled — which for a child who is never wrong means
  // a stride of `STEP_OPEN` — the rate is back inside 2.5 an answer, so the
  // calibration boost is a boost and not a new baseline.
  const settled: Staircase = { step: STEP_OPEN, lastDir: 1, reversed: false, pace: 2.5 }
  assert.ok(
    ascentOf(settled, climbRungs({ digits: 1, latencyMs: A_SPEEDCUBER_MS, quickRun: 99 })) <= 2.5,
    "a settled speedcuber is still climbing more than the table's widest spread per answer",
  )
})

/** The rate for a single answer, with no run of quick answers behind it. */
function rateAt(digits: number, fluencyP50Ms: number | undefined, latencyMs: number): number {
  return climbRungs({ digits, fluencyP50Ms, latencyMs })
}

/** The rate for a child who has already been quick often enough to earn it. */
function sustainedRateAt(
  digits: number,
  fluencyP50Ms: number | undefined,
  latencyMs: number,
): number {
  return climbRungs({ digits, fluencyP50Ms, latencyMs, quickRun: 99 })
}

test("regime 3: the climb rate decays with lateness, and is never zero", () => {
  // Read against the published single-digit row — p50 2.8 s, p90 6 s — on a node
  // that declares no fluency target of its own, so the numbers below are the
  // table's and nothing else's.
  assert.equal(rateAt(1, undefined, 6_000), 1, "the p90 itself is a whole rung")
  assert.equal(rateAt(1, undefined, 12_000), 0.5, "twice the p90 is half a rung")
  assert.equal(rateAt(1, undefined, 60_000), 0.1, "ten times the p90 is a tenth of a rung")

  // A child at ten times the expected time is not demonstrating what a child at
  // one and a half times is, and a step function would say they were.
  let previous = Infinity
  for (const late of [6_001, 9_000, 12_000, 24_000, 60_000, 600_000]) {
    const rate = rateAt(1, undefined, late)
    assert.ok(rate < previous, `${String(late)} ms was not worth less than the answer before it`)
    assert.ok(rate > 0, `${String(late)} ms was worth nothing at all — that is a hold`)
    previous = rate
  }
})

test("the expected band is one rung, and its edges are the item's own", () => {
  // The middle regime, at both of its boundaries, in published numbers. The
  // quick mark of a single-digit fact is 2.8 s compressed by the table's widest
  // spread — 2,800 × 2/5 = 1,120 ms — and its tail is the published p90.
  assert.equal(sustainedRateAt(1, undefined, 1_120), 1)
  assert.equal(sustainedRateAt(1, undefined, 2_800), 1)
  assert.equal(sustainedRateAt(1, undefined, 6_000), 1)
  assert.ok(sustainedRateAt(1, undefined, 1_119) > 1, "a millisecond inside the mark is not quick")
  assert.ok(sustainedRateAt(1, undefined, 6_001) < 1, "a millisecond into the tail is a whole rung")

  // And the run is counted at the same mark that pays, which is the seam a
  // rewrite would most easily get wrong: an answer that counts toward the run
  // but is not worth the bonus, or the reverse, would let a child be quick
  // forever and never earn it.
  assert.equal(isQuick(1, undefined, 1_119), true)
  assert.equal(isQuick(1, undefined, 1_120), false)
  assert.equal(isQuick(1, undefined, 2_800), false, "the published median is not quick")
  assert.equal(isQuick(1, undefined, Number.NaN), false, "a broken clock is not evidence of speed")

  // Every rung on the shipped ladder has the same shape: quick < median < tail,
  // and answering at the pace the table publishes for that width is never a
  // demotion-by-slowness — it is worth a whole rung or better, on every rung,
  // which is the invariant the constant this replaced violated on half of them.
  for (const rung of ladder()) {
    const service = createItemService({ profileId: "p1", record: noRecord, rungs: [rung] })
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    const width = widthOf(item.operands)
    const declared = rung.node.fluencyTarget?.p50Ms
    const pace = itemPace(width, declared)
    assert.ok(pace, `${rung.node.id} has no pace at all`)
    assert.ok(
      pace.quickMs < pace.medianMs && pace.medianMs < pace.tailMs,
      `${rung.node.id} paces at ${JSON.stringify(pace)}`,
    )
    assert.ok(
      rateAt(width, declared, publishedP50Ms(width)) >= 1,
      `${rung.node.id} draws ${item.prompt} and treats ${String(publishedP50Ms(width))} ms — ` +
        `the published median for a ${String(width)}-digit item — as less than a whole rung`,
    )
  }
})

test("a declared fluency target only ever widens the pace, at both ends", () => {
  // The pre-existing guard, extended to the quick mark. `dw.mul.*` declares a
  // 15 s median and `dw.div.*` an 18 s one: read through the column model alone,
  // a two-digit multiplication would be "slow" at 14 s and "quick" at 2.4 s. A
  // node's own data must be able to move both marks outward and neither inward.
  for (const node of allNodes) {
    const declared = node.fluencyTarget?.p50Ms
    if (declared === undefined) continue
    for (let width = 1; width <= 6; width++) {
      const table = itemPace(width, undefined)
      const paced = itemPace(width, declared)
      assert.ok(paced && table, `${node.id} at ${String(width)} digits has no pace`)
      assert.ok(
        paced.quickMs >= table.quickMs,
        `${node.id} declares ${String(declared)} ms and that NARROWED the quick mark at ` +
          `${String(width)} digits, from ${String(table.quickMs)} to ${String(paced.quickMs)}`,
      )
      assert.ok(paced.tailMs >= table.tailMs, `${node.id} narrowed the tail at ${String(width)}`)
      // And a child answering in exactly the time the node itself declares is
      // never in the tail: a node's own median cannot make its own items slow.
      assert.ok(
        rateAt(width, declared, declared) >= 1,
        `${node.id} declares ${String(declared)} ms and then treats an answer taking exactly ` +
          `that long as slow, at ${String(width)} digits`,
      )
      // Both marks, stated as what a child experiences rather than as one
      // number being no smaller than another — which two marks derived from the
      // same expression will always satisfy, whether or not the declared median
      // is read at all. The spread is the table's widest published p90/p50,
      // 40/16, so two fifths of a declared median is as quick as its own tail is
      // slow.
      // Annotated because `assert.ok` is an assertion signature, and a `const`
      // inferred after one in the same block trips TS7022.
      const asQuickAsDeclaredAllows: number = Math.floor((declared * 2) / 5) - 1
      assert.ok(
        sustainedRateAt(width, declared, asQuickAsDeclaredAllows) > 1,
        `${node.id} declares a ${String(declared)} ms median, and an answer in ` +
          `${String(asQuickAsDeclaredAllows)} ms — under two fifths of it — is not quick to it ` +
          `at ${String(width)} digits. A node's own data cannot make its own items harder to be ` +
          `quick at than the table's`,
      )
      assert.ok(
        rateAt(width, declared, Math.floor((declared * 5) / 2)) >= 1,
        `${node.id} declares a ${String(declared)} ms median and puts two and a half times it ` +
          `in the slow tail at ${String(width)} digits`,
      )
    }
  }
})

/**
 * A child touching one of the four slabs at random, instantly, for a whole
 * session. Seeded, so the same guesser guesses the same way on every run.
 */
function guessSession(seed0: number, answers: number) {
  const rungs = ladder()
  const service = createItemService({ profileId: `guesser-${String(seed0)}`, record: noRecord, rungs })
  let seed = seed0
  // The high bits: the low bits of a linear congruential stream have a period
  // of four, which for a four-slab grid is not a guesser, it is a metronome.
  const pick = (n: number) => {
    seed = (seed * 1_103_515_245 + 12_345) & 0x7fff_ffff
    return Math.floor(seed / 65_536) % n
  }
  let highest = 0
  let lucky = 0
  let sum = 0
  for (let i = 0; i < answers; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    const choices = item.choices ?? []
    assert.equal(choices.length, 4, "the grid is not four slabs and the arithmetic is wrong")
    const guess = choices[pick(choices.length)]
    assert.ok(guess)
    if (guess.text === service.reveal(item.id)) lucky += 1
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      // Instantly. A guesser is quick by definition — they are not computing.
      response: guess.id,
      latencyMs: 1,
    })
    highest = Math.max(highest, service.position())
    sum += service.position()
  }
  return { top: rungs.length - 1, finished: service.position(), highest, lucky, mean: sum / answers }
}

test("a guesser does not climb, however fast the guessing is", () => {
  // A closed list is four slabs, so a child touching one at random is right one
  // time in four and wrong three. A miss costs a whole rung, so the only way
  // guessing pays is if a lucky tap can be worth more than a rung — which is
  // exactly what the speedcuber's rate is, and exactly why it is not handed out
  // for one quick answer. See `QUICK_RUN_FOR_BONUS`: with no run required, this
  // guesser reached rung 26 of 35.
  //
  // Six sessions, six hundred questions each. One session is a coin-toss story;
  // the drift is the claim.
  let worstFinish = 0
  let worstReach = 0
  let top = 0
  for (const seed of [13, 7_932, 15_851, 23_770, 31_689, 39_608]) {
    const run = guessSession(seed, 600)
    top = run.top
    assert.ok(run.lucky > 0, "the guesser never once guessed right, so this proves nothing")
    assert.ok(
      run.mean < 2,
      `a guesser spent 600 questions an average of ${run.mean.toFixed(2)} rungs up the ladder`,
    )
    worstFinish = Math.max(worstFinish, run.finished)
    worstReach = Math.max(worstReach, run.highest)
  }
  assert.ok(
    worstFinish <= top / 8,
    `guessing at random finished as high as rung ${String(worstFinish)} of ${String(top)}`,
  )
  assert.ok(
    worstReach <= top / 4,
    `a guesser reached rung ${String(worstReach)} of ${String(top)} along the way — luck is ` +
      `buying real progress, and the speedcuber's rate is what a guesser is spending`,
  )
})

test("the tail cannot underflow the floor or overflow the top", () => {
  // The clamps, against the fractional carry specifically: a child sitting on a
  // fraction of a rung above the floor is still not allowed below it, and a
  // child at the top does not bank credit they could spend on a miss.
  const rungs = ladder()
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  const item = service.next({ packId: "dynawalla.siege" })
  assert.ok(item)
  // One slow-and-right answer: some fraction of a rung, and still rung 0. Ten
  // minutes rather than one, because the opening stride multiplies whatever the
  // answer was worth and a minute times four rungs is no longer a fraction.
  service.judge({
    packId: "dynawalla.siege",
    itemId: item.id,
    response: service.reveal(item.id),
    latencyMs: 10 * A_FULL_MINUTE_MS,
  })
  assert.equal(service.position(), 0)
  const missed = service.next({ packId: "dynawalla.siege" })
  assert.ok(missed)
  service.judge({
    packId: "dynawalla.siege",
    itemId: missed.id,
    response: "definitely wrong",
    latencyMs: 1_000,
  })
  assert.equal(service.position(), 0, "a fraction of a rung above the floor fell through it")

  // At the top: quick answers pile up, and the credit they earn above the top is
  // not credit — it is clamped away. A child who kept playing after arriving must
  // not have bought themselves immunity from falling.
  //
  // The claim used to be an exact equality between a child who missed straight
  // away and one who lingered twenty answers. It cannot be, now: the window is
  // what decides the direction, so the lingerer needs more misses than the
  // newcomer to fall out of the sitting band and the two arms are not comparing
  // the same number of descending answers. What survives the change — and is the
  // thing the clamp is actually for — is that no amount of lingering buys a child
  // out of falling. Delete the clamp and the lingerer's banked credit absorbs
  // every miss below, and this test fails.
  const top = rungs.length - 1
  /** Climbs to the top, answers `extra` more, then misses until it moves. */
  const missAtTop = (profileId: string, extra: number): { rung: number; misses: number } => {
    const at = createItemService({ profileId, record: noRecord, rungs })
    for (let i = 0; i < 200 && at.position() < top; i++) {
      const next = at.next({ packId: "dynawalla.siege" })
      assert.ok(next)
      at.judge({
        packId: "dynawalla.siege",
        itemId: next.id,
        response: at.reveal(next.id),
        latencyMs: A_SPEEDCUBER_MS,
      })
    }
    assert.equal(at.position(), top, `${profileId} never reached the top`)
    for (let i = 0; i < extra; i++) {
      const next = at.next({ packId: "dynawalla.siege" })
      assert.ok(next)
      at.judge({
        packId: "dynawalla.siege",
        itemId: next.id,
        response: at.reveal(next.id),
        latencyMs: A_SPEEDCUBER_MS,
      })
    }
    // Then misses, one at a time, until the ladder moves. A perfect window means
    // the first few cost nothing by design (see `PROMOTE_AT`), so what is counted
    // is how many it takes and where it lands — not that the very first one bites.
    let misses = 0
    while (misses < 3 * RECENT_WINDOW && at.position() >= top) {
      const missed = at.next({ packId: "dynawalla.siege" })
      assert.ok(missed)
      at.judge({
        packId: "dynawalla.siege",
        itemId: missed.id,
        response: "definitely wrong",
        latencyMs: 1_000,
      })
      misses += 1
    }
    return { rung: at.position(), misses }
  }
  const straightAway = missAtTop("top-0", 0)
  const afterLingering = missAtTop("top-20", 20)
  assert.ok(
    straightAway.rung < top,
    `${String(straightAway.misses)} misses at the top of the ladder cost nothing at all`,
  )
  assert.ok(
    afterLingering.rung < top,
    `twenty quick answers at the top banked credit that ${String(afterLingering.misses)} misses ` +
      `then could not pay for: the child who missed straight away fell to ` +
      `${String(straightAway.rung)} and the one who lingered is still on rung ` +
      `${String(afterLingering.rung)} of ${String(top)}`,
  )
  // And the lingering bought at most the window: twenty extra correct answers can
  // delay the fall by no more than the answers it takes to age them out, because
  // there is no other store of credit anywhere in the rule.
  assert.ok(
    afterLingering.misses <= straightAway.misses + RECENT_WINDOW,
    `lingering twenty answers at the top delayed the fall by ` +
      `${String(afterLingering.misses - straightAway.misses)} misses, which is more than the ` +
      `${String(RECENT_WINDOW)}-answer window can account for — something is banking credit`,
  )
})

test("a latency past what the table has a class for is still classified, never unbounded", () => {
  // Six digits is off the end of the published table, and the fitted line is
  // what says how long it should take. What must not happen is a wide item
  // becoming unclassifiable and every answer on it — including a guessed one —
  // being worth a whole rung by default.
  const wide = itemPace(6, undefined)
  assert.ok(wide, "a six-digit item has no pace, so the fitted line stopped fitting")
  assert.ok(wide.tailMs > P90_WIDEST_PUBLISHED_MS, "a six-digit item is not slower than a 4-digit")
  assert.ok(rateAt(6, undefined, 600_000) < 0.2, "ten minutes on one question is not a rung")
})

// ---------------------------------------------------------------------------
// A rung is served as a distribution, not as a point.
//
// "we don't have to be at one level only 'mixed triple and double' .. we could
//  still throw in some single digit problems but it should change the
//  probabilities of harder and easier problems more smoothly."
//
// See `rungWeights` in `items.ts` for the shape and the arithmetic behind the
// two ratios.

/** The kernel as a share of its own mass, which is what a child experiences. */
function shares(centre: number, span: number): number[] {
  const weights = rungWeights(centre, span)
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((w) => w / total)
}

test("the spread is centred, asymmetric, and reaches both ways", () => {
  const span = 40
  const p = shares(20, span)
  // Every rung inside the spread carries mass and every rung outside it carries
  // none: the point of a truncated kernel is that a rung the child cannot do is
  // not merely unlikely, it is absent.
  for (let i = 0; i < p.length; i++) {
    const offset = i - 20
    const inside = offset >= -SPREAD_BELOW && offset <= SPREAD_ABOVE
    assert.equal(
      (p[i] as number) > 0,
      inside,
      `rung ${String(i)} (offset ${String(offset)}) has share ${String(p[i])}`,
    )
  }
  // The mode is the centre, and it is not the majority — a rung that carried more
  // than half the mass would be a point with a rumour of a spread around it.
  const centre = p[20] as number
  for (let i = 0; i < p.length; i++) {
    if (i !== 20) assert.ok((p[i] as number) < centre, `rung ${String(i)} outweighs the centre`)
  }
  assert.ok(centre < 0.5, `the centre carries ${(centre * 100).toFixed(1)}% of the mass`)
  // Monotone away from the centre in both directions, so there is no distance at
  // which the shape changes its mind.
  for (let d = 1; d < SPREAD_BELOW; d++) {
    assert.ok((p[20 - d] as number) > (p[20 - d - 1] as number), `below is not monotone at ${String(d)}`)
  }
  for (let d = 1; d < SPREAD_ABOVE; d++) {
    assert.ok((p[20 + d] as number) > (p[20 + d + 1] as number), `above is not monotone at ${String(d)}`)
  }
  // Easier is likelier than harder at the same distance. Being served a rung
  // below your level is a fluency rep; being served one above it is being stuck.
  for (let d = 1; d <= SPREAD_ABOVE; d++) {
    assert.ok(
      (p[20 - d] as number) > (p[20 + d] as number),
      `offset −${String(d)} is not likelier than +${String(d)}`,
    )
  }
})

test("the spread's upward reach fits under the promotion gate, with margin", () => {
  const p = shares(20, 40)
  const below = p.slice(0, 20).reduce((a, b) => a + b, 0)
  const above = p.slice(21).reduce((a, b) => a + b, 0)
  const twoAbove = p[22] as number

  // **The constraint that fixes `ABOVE_RATIO`, and the reason it moved from 0.35.**
  // Content two rungs above where a child is standing is the part of the mix a
  // child at their own level plausibly cannot do at all. `PROMOTE_AT` gives them
  // `1 − PROMOTE_AT` of head-room. If the two-above share is bigger than the
  // head-room, a child who is right about everything else measures under the gate
  // and can never climb again, at any level, forever — a deadlock, not a tuning
  // risk. At `ABOVE_RATIO` 0.35 the share was 5.2% against 5.0% of head-room,
  // which is on the wrong side of it.
  const headroom = 1 - PROMOTE_AT
  assert.ok(
    twoAbove < headroom,
    `two rungs up is ${(twoAbove * 100).toFixed(1)}% of the stream and the promotion gate leaves ` +
      `${(headroom * 100).toFixed(1)}% of head-room, so a child who is perfect on everything ` +
      `else measures ${((1 - twoAbove) * 100).toFixed(1)}% and is frozen out of climbing forever`,
  )
  // With margin, because "cannot do at all" is an idealisation and the real number
  // moves. A factor of one and a half is what `ABOVE_RATIO` 0.25 buys.
  assert.ok(
    twoAbove * 1.5 < headroom,
    `two rungs up is ${(twoAbove * 100).toFixed(1)}% against ${(headroom * 100).toFixed(1)}% of ` +
      `head-room — inside the gate, but with nothing in hand`,
  )
  // Stated the other way as well, because the deadlock is what the shares mean and
  // a reader should not have to do the division: a fluent child who fails only the
  // two-above items must clear the gate.
  assert.ok(
    1 - twoAbove >= PROMOTE_AT,
    `a child perfect except two rungs up measures ${((1 - twoAbove) * 100).toFixed(1)}%`,
  )

  // Still a real reach upward, though: the stretch item has to exist.
  assert.ok(above > 0.1, `only ${(above * 100).toFixed(1)}% of questions are harder`)
  assert.ok(twoAbove > 0.01, `two rungs up is ${(twoAbove * 100).toFixed(1)}% — that is absent`)
  // And there are real easier questions in the stream — "we could still throw in
  // some single digit problems".
  assert.ok(below > 0.3, `only ${(below * 100).toFixed(1)}% of questions are easier`)

  // Consecutive questions differ: the chance two independent draws land on the
  // same rung is Σp², and a spread that fails this is a point in disguise. This is
  // the cost of narrowing the upward reach — it concentrates the centre — and is
  // why the reach is narrowed as far as the gate needs and no further.
  const same = p.reduce((a, b) => a + b * b, 0)
  assert.ok(same < 0.3, `two questions running land on the same rung ${(same * 100).toFixed(1)}% of the time`)
})

test("the at-level mix does not put a child under the founder's floor", () => {
  // The distribution read as an accuracy. Against the accuracy a child plausibly
  // has at each offset — near everything below level, ~90% at it, ~60% one above,
  // ~30% two above — a child standing exactly at their own level measures this
  // much, and it has to be inside the founder's 85–95% band. At `ABOVE_RATIO` 0.35
  // it was 85.4%: on the floor of the band with nothing to spare, so any pessimism
  // about the two harder offsets put the content mix alone under his floor.
  const byOffset: Record<number, number> = { [-3]: 0.98, [-2]: 0.98, [-1]: 0.98, 0: 0.9, 1: 0.6, 2: 0.3 }
  const p = shares(20, 40)
  let measured = 0
  for (let offset = -SPREAD_BELOW; offset <= SPREAD_ABOVE; offset++) {
    measured += (p[20 + offset] as number) * (byOffset[offset] as number)
  }
  assert.ok(
    measured > SIT_AT,
    `a child standing at their own level measures ${(measured * 100).toFixed(1)}% on this mix, ` +
      `and the founder's floor is ${(SIT_AT * 100).toFixed(0)}% — the content alone is enough to ` +
      `demote them`,
  )
  assert.ok(
    measured - SIT_AT > 0.02,
    `a child at their own level measures ${(measured * 100).toFixed(1)}%, which is on the floor ` +
      `of the band rather than inside it`,
  )
  assert.ok(
    measured < PROMOTE_AT,
    `a child at their own level measures ${(measured * 100).toFixed(1)}% and would be promoted ` +
      `off it — the mix is easier than the level it claims to be`,
  )
  // And the ratio it takes to get there, so the number in the doc table is pinned
  // from the test side too.
  assert.equal(ABOVE_RATIO, 0.25)
})

test("the spread reflects at the ends of the ladder rather than piling onto them", () => {
  const span = 40
  // At the floor there is nowhere below to go. Clipping would pile the whole
  // downward tail onto rung 0 — which on `add-within-ten` L0 is a set of NINE
  // items, and is why the founder believed the questions were hardcoded. The
  // mass goes the only other way it can.
  const floorShares = shares(0, span)
  assert.ok(
    (floorShares[0] as number) < 0.5,
    `a child at the floor gets ${((floorShares[0] as number) * 100).toFixed(1)}% of their ` +
      `questions from one rung`,
  )
  assert.ok(
    (floorShares[3] as number) > 0,
    "the spread at the floor does not reach the fourth rung, so the neighbours are unused",
  )
  // Nothing is lost and nothing is invented: the reflected kernel carries exactly
  // the mass the untruncated one does.
  const total = (centre: number) => rungWeights(centre, span).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total(0) - total(20)) < 1e-12, "mass is not conserved at the floor")
  assert.ok(Math.abs(total(span) - total(20)) < 1e-12, "mass is not conserved at the top")
  // And at the top it reflects downward, so a child at the hardest rung the
  // product has still gets a mixed stream rather than that rung forever.
  const topShares = shares(span, span)
  assert.ok((topShares[span] as number) < 0.5, "a child at the top is served one rung")
  assert.ok((topShares[span - 3] as number) > 0, "the spread at the top does not reach downward")

  // A ladder narrower than the kernel still normalises rather than leaving a
  // hole: reflection is iterated, so `-3` on a two-rung ladder comes back inside.
  for (let narrow = 0; narrow <= 4; narrow++) {
    const weights = rungWeights(0, narrow)
    assert.equal(weights.length, narrow + 1)
    assert.ok(
      weights.reduce((a, b) => a + b, 0) > 0,
      `a ${String(narrow + 1)}-rung ladder has no weight anywhere`,
    )
    for (const w of weights) assert.ok(Number.isFinite(w) && w >= 0, "a weight is not a weight")
  }
})

test("pickRung is a draw from those weights and cannot fall off either end", () => {
  const span = 30
  const counts = new Array<number>(span + 1).fill(0)
  const draws = 20_000
  for (let i = 0; i < draws; i++) {
    const rung = pickRung(15, span, i / draws)
    assert.ok(rung >= 0 && rung <= span, `pickRung returned ${String(rung)}`)
    counts[rung] = (counts[rung] as number) + 1
  }
  // Sweeping the unit interval reproduces the weights it was built from.
  const p = shares(15, span)
  for (let i = 0; i <= span; i++) {
    assert.ok(
      Math.abs((counts[i] as number) / draws - (p[i] as number)) < 0.005,
      `rung ${String(i)} drew ${String(counts[i])} of ${String(draws)}, expected share ${String(p[i])}`,
    )
  }
  // The ends of the stream, which is where an off-by-one lives.
  assert.ok(pickRung(0, span, 0) >= 0)
  assert.ok(pickRung(span, span, 1) <= span)
  assert.ok(pickRung(0, 0, 0.999) === 0, "a one-rung ladder served something other than its rung")
})

test("a beginner sees far more than nine distinct questions, without any closed set being inflated", () => {
  // The founder: "I've gotten 10 correct in a row fast and I still get 2+0=1".
  // `dw.add.facts.add-within-ten` L0 declares `closedFactSet: [9, …]` — nine
  // items, honestly, and CG-10 exists so that a small honest set is not dressed
  // up as a generator. So the fix is not to inflate it; it is that a child on the
  // bottom rung is served its neighbours too.
  const rungs = ladder()
  const service = createItemService({ profileId: "beginner", record: noRecord, rungs })
  const prompts = new Set<string>()
  const skills = new Set<string>()
  // Twenty questions with no answers at all, so the ladder never moves and this
  // is purely what the spread does for a child standing on rung 0.
  for (let i = 0; i < 20; i++) {
    const item = service.next({ packId: "dynawalla.truedraw" })
    assert.ok(item)
    prompts.add(item.prompt)
    skills.add(`${item.skillId}#${String(item.level)}`)
  }
  // This assertion measures VARIETY, and `skills.size` below it measures spread.
  //
  // It used to do both at once, by comparing against the size of the bottom
  // rung's own declared closed set: serving one rung cannot produce more
  // distinct questions than the rung has in it, so exceeding that count proved
  // the neighbours were reached. That was a good technique and widening the
  // floor is what retired it — the rung held nine problems and now holds
  // sixty-five, so twenty draws can no longer out-count it however well the
  // spread is working. The "neighbours were reached" claim did not weaken; it
  // simply lives in the `skills.size >= 3` assertion below, which states it
  // directly instead of inferring it from a counting argument.
  //
  // 17 of 20 is a floor on repetition, not taste. The founder played an hour of
  // a nine-item rung and filed it as one star; the point of this number is that
  // a child sees a different question nearly every time.
  assert.ok(
    prompts.size >= 17,
    `twenty questions at the floor drew only ${String(prompts.size)} distinct prompts: ` +
      `${[...prompts].join(", ")}`,
  )
  assert.ok(
    skills.size >= 3,
    `twenty questions at the floor came from ${String(skills.size)} rung(s): ` +
      `${[...skills].join(", ")} — the floor is still a point`,
  )
  // And they are all still first-grade facts, not a stretch into column
  // arithmetic: the spread is narrow, it is only not a point.
  for (const key of skills) assert.match(key, /^dw\.add\.facts\./, `the floor reached ${key}`)
})

test("the stream a child is served stays inside the spread of where the ladder stands", () => {
  // The guard that the mixing cannot quietly become "any rung at all". Over a long
  // session, every question must have come from a rung the kernel of the position
  // at the time actually gives weight to.
  //
  // Read off `rungWeights` rather than off `±SPREAD_ABOVE / SPREAD_BELOW`, because
  // the kernel *reflects* at the ends of the ladder: at rung 0 the downward tail
  // comes back up, so a child at the floor is legitimately served rung 3 — which is
  // three above them, and is the whole point of reflecting rather than clipping.
  // The old form of this assertion only held because the child it used settled
  // mid-ladder; a child who ends up at the floor made it fail on correct code.
  const rungs = ladder()
  const span = rungs.length - 1
  const service = createItemService({ profileId: "p-spread", record: noRecord, rungs })
  let worstBelow = 0
  let worstAbove = 0
  for (let answered = 0; answered < 400; answered++) {
    const centre = service.position()
    const item = service.next({ packId: "dynawalla.truedraw" })
    assert.ok(item)
    const served = Math.round((item.difficulty ?? 0) * span)
    assert.ok(
      (rungWeights(centre, span)[served] ?? 0) > 0,
      `the child was standing on rung ${String(centre)} and was served rung ${String(served)}, ` +
        `which that position's kernel gives no weight to at all`,
    )
    worstBelow = Math.max(worstBelow, centre - served)
    worstAbove = Math.max(worstAbove, served - centre)
    const right = answered % 10 !== 9
    service.judge({
      packId: "dynawalla.truedraw",
      itemId: item.id,
      response: right ? service.reveal(item.id) : "definitely wrong",
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
  }
  // And it really did use the width, rather than serving the centre forever.
  assert.ok(worstAbove >= SPREAD_ABOVE, "the spread never once reached its own ceiling")
  assert.ok(worstBelow >= SPREAD_BELOW, "the spread never once reached its own floor")
})
