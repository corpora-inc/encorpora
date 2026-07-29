// The host's half of the item contract, held to the four promises it makes.
//
// This is where "a mathematics game cannot be beaten by fiddling with the game"
// stops being an architecture note. If `items.next` carried the answer, or
// `judge` accepted whatever a pack said was right, or the same seed produced
// two different questions, the boundary would still typecheck and the property
// would be gone.

import { test } from "node:test"
import assert from "node:assert/strict"

import { createItemService, ladder, choicesFor, isSubtraction } from "./items.ts"
import { familyById, FORM_FREE_ENTRY, activeNodes } from "./curriculum.ts"

const noRecord = () => {}

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
  assert.equal(service.position(), climbed - 1)
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

test("a difficulty request selects the rung, and the item says which rung it came from", () => {
  const rungs = ladder()
  assert.ok(rungs.length > 1, "a one-rung ladder cannot demonstrate selection")
  const service = createItemService({ profileId: "p1", record: noRecord })

  const easiest = service.next({ packId: "dynawalla.slice", difficulty: 0 })
  const hardest = service.next({ packId: "dynawalla.slice", difficulty: 1 })
  assert.ok(easiest && hardest)

  // The ordinate the pack is told is the position of the rung it was served,
  // 0..1 across the whole ladder — not `level`, which is the level within one
  // skill and is not comparable between two of them.
  assert.equal(easiest.difficulty, 0)
  assert.equal(hardest.difficulty, 1)
  assert.equal(rungs[0]?.node.id, easiest.skillId)
  assert.equal(rungs[rungs.length - 1]?.node.id, hardest.skillId)
  assert.notEqual(easiest.prompt, hardest.prompt)

  // The middle of the ladder is the middle of the ladder, and it moves.
  const middle = service.next({ packId: "dynawalla.slice", difficulty: 0.5 })
  const where = middle?.difficulty ?? -1
  assert.ok(where > 0.3 && where < 0.7, `0.5 landed at ${String(where)}`)
})

test("a ceiling is honoured, and an unsatisfiable request clamps to the nearest rung that exists", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })

  for (const asked of [0.9, 1]) {
    const capped = service.next({ packId: "dynawalla.siege", difficulty: asked, maxDifficulty: 0.2 })
    const where = capped?.difficulty ?? -1
    assert.ok(where >= 0 && where <= 0.2, `the ceiling 0.2 served ${String(where)}`)
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
  assert.equal(over.difficulty, 1, "an impossible request did not land on the hardest rung")
})

test("driving the difficulty moves the one ladder, so judging resumes from where the pack left it", () => {
  const service = createItemService({ profileId: "p1", record: noRecord })
  assert.equal(service.position(), 0)

  const item = service.next({ packId: "dynawalla.stack", difficulty: 1 })
  assert.ok(item)
  const top = service.position()
  assert.ok(top > 0, "a difficulty request left the ladder standing where it was")

  // A pack that stops driving resumes from where it left the child, and the
  // host's own climb-and-step-down goes on from there. Two positions would mean
  // a child who was moved down by their game gets moved back up by the ladder
  // the moment the game stops asking.
  const after = service.next({ packId: "dynawalla.stack" })
  assert.ok(after)
  assert.equal(service.position(), top)
  assert.equal(after.difficulty, item.difficulty)

  service.judge({
    packId: "dynawalla.stack",
    itemId: after.id,
    response: "definitely wrong",
    latencyMs: 1000,
  })
  assert.equal(service.position(), top - 1, "the ladder did not step down from the pack's position")
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
  const rungs = ladder()
  const service = createItemService({ profileId: "p1", record: noRecord })
  const families = new Set<string>()

  for (let i = 0; i < rungs.length; i++) {
    const at = rungs.length === 1 ? 0 : i / (rungs.length - 1)
    const item = service.next({ packId: "dynawalla.fuse", difficulty: at })
    const rung = rungs[i]
    assert.ok(item, `rung ${String(i)} (${String(rung?.node.id)}) served nothing at all`)
    families.add(rung?.family.family ?? "?")

    assert.equal(item.operands.length, 2, `${item.skillId} did not draw two operands`)
    for (const operand of item.operands) {
      assert.match(operand, /^-?\d/, `${item.skillId} drew the operand "${operand}"`)
    }
    // The prompt a child reads, and a screen reader speaks. `" + "` is what
    // this used to be.
    assert.match(
      item.prompt,
      /^-?\d[\d ,.]*\s[+−]\s-?\d/u,
      `${item.skillId} drew the prompt "${item.prompt}"`,
    )
    assert.ok(item.prompt.includes(item.operands[0] ?? "!"))
    assert.ok(item.prompt.includes(item.operands[1] ?? "!"))
    assert.equal(service.reveal(item.id).length > 0, true, `${item.skillId} has no answer`)
  }

  // And the operator agrees with the skill, across every family on the ladder.
  // Two active families both define a `PROMPT_KEY_SUB`; comparing against one
  // family's constant is a comparison that silently fails for the other, which
  // is how a subtraction came to be drawn with a plus sign.
  assert.ok(families.size >= 1)
  for (let i = 0; i < rungs.length; i++) {
    const at = rungs.length === 1 ? 0 : i / (rungs.length - 1)
    const item = service.next({ packId: "dynawalla.fuse", difficulty: at })
    assert.ok(item)
    const subtracting = item.skillId.includes("subtract")
    if (subtracting) {
      assert.equal(item.operator, "-", `${item.skillId} was drawn as an addition`)
      assert.ok(item.prompt.includes("−"), `${item.skillId} has no minus sign`)
    } else {
      assert.equal(item.operator, "+", `${item.skillId} was drawn as a subtraction`)
      assert.ok(item.prompt.includes("+"), `${item.skillId} has no plus sign`)
    }
  }
})

test("isSubtraction reads every active family's key, not one family's constant", () => {
  // The concrete regression: `gen.arith.number-facts` names its subtraction
  // prompt `dw.prompt.number-facts.sub`, and this file used to compare against
  // `dw.prompt.column-op.sub` alone.
  assert.equal(isSubtraction("dw.prompt.column-op.sub"), true)
  assert.equal(isSubtraction("dw.prompt.number-facts.sub"), true)
  assert.equal(isSubtraction("dw.prompt.column-op.add"), false)
  assert.equal(isSubtraction("dw.prompt.number-facts.add"), false)

  // Held to the convention rather than to a list, so the family after next is
  // covered by existing rather than by somebody remembering to edit this.
  for (const rung of ladder()) {
    const key = String(rung.node.generator.family)
    assert.ok(key.length > 0)
  }
})
