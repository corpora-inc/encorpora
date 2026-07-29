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
  cadenceFor,
  choicesFor,
  binaryOperator,
  climbRungs,
  climbWithinMs,
  createItemService,
  DESCENT_RATIO,
  descentOf,
  isQuick,
  itemPace,
  ladder,
  normalizeMinus,
  openStaircase,
  pickRung,
  rungWeights,
  SPREAD_ABOVE,
  SPREAD_BELOW,
  STEP_OPEN,
  STEP_START,
  STEP_TRACK,
} from "./items.ts"
import type { Rung, Staircase } from "./items.ts"
import type { PromptSlot } from "./curriculum.ts"
import {
  activeNodes,
  allNodes,
  familyById,
  FORM_FREE_ENTRY,
  promptOperator,
  promptRegistry,
  SLOT_BOTTOM,
  SLOT_TOP,
} from "./curriculum.ts"

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
  // Not the same ordinate: with the pack no longer naming a difficulty the host
  // serves from its own spread around where it was left (`rungWeights`). What
  // must hold is that it is still *there* — within the spread of the rung the
  // pack drove it to, and not back at the bottom of the ladder.
  const span = ladder().length - 1
  const drove = item.difficulty ?? -1
  const served = after.difficulty ?? -1
  assert.ok(
    served >= drove - (SPREAD_BELOW + 1) / span && served <= drove + SPREAD_ABOVE / span,
    `the pack left the child at ${drove.toFixed(3)} and the host served ${served.toFixed(3)}`,
  )

  service.judge({
    packId: "dynawalla.stack",
    itemId: after.id,
    response: "definitely wrong",
    latencyMs: 1000,
  })
  // Exactly the opening stride: nothing has been answered yet, so the staircase
  // is still where `openStaircase` puts it.
  assert.equal(
    service.position(),
    top - descentOf(openStaircase()),
    "the ladder did not step down from the pack's position by the opening stride",
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
    // this used to be. All four glyphs, because `[+−]` was itself a statement
    // that this product only adds and subtracts.
    assert.match(
      item.prompt,
      /^-?\d[\d ,.]*\s[+−×÷]\s-?\d/u,
      `${item.skillId} drew the prompt "${item.prompt}"`,
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
    const at = rungs.length === 1 ? 0 : i / (rungs.length - 1)
    const item = service.next({ packId: "dynawalla.fuse", difficulty: at })
    assert.ok(item)
    const rung = rungs[i]
    assert.ok(rung)
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
    assert.equal(
      item.operator,
      glyph === "−" ? "-" : glyph,
      `${item.skillId} declares ${glyph} and reported operator "${String(item.operator)}"`,
    )
  }
})

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
    expected += ascentOf(stair, 1)
    stair = advanceStaircase(stair, 1, 1)
  }
  assert.equal(service.position(), Math.floor(expected))
  for (let i = 0; i < 3; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: "definitely wrong",
      latencyMs: 1_000,
    })
    expected -= descentOf(stair)
    stair = advanceStaircase(stair, -1, null)
  }
  assert.equal(
    service.position(),
    Math.floor(expected),
    "three misses did not cost exactly three strides",
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

test("down is four times up once the child is bracketed, which is what 80% correct means", () => {
  // Kaernbach's weighted up/down rule: a staircase converges on the proportion
  // `p` correct when up:down is `(1 − p) : p`. The founder asked for "80%+
  // correct", so the ratio is 1:4 and `DESCENT_RATIO` is that four. Asserted as
  // the ratio rather than as two magnitudes, because the magnitudes are the
  // child's own pace and the ratio is the thing that fixes the accuracy.
  // Derived, not restated: `p / (1 − p)` at the accuracy the founder named. A
  // test that compared `descentOf / ascentOf` to `DESCENT_RATIO` would pass at
  // any value of `DESCENT_RATIO` at all, including the 1 this replaced.
  // As the whole ratio `right : asked` rather than as 0.8, because `0.8 / (1 −
  // 0.8)` is 4.000000000000001 and a test that is right about the mathematics and
  // wrong about binary floats is a test somebody deletes.
  const RIGHT = 4
  const ASKED = 5
  assert.equal(
    DESCENT_RATIO,
    RIGHT / (ASKED - RIGHT),
    `a staircase with this ratio converges on ` +
      `${((DESCENT_RATIO / (1 + DESCENT_RATIO)) * 100).toFixed(0)}% correct, not ` +
      `${((RIGHT / ASKED) * 100).toFixed(0)}%`,
  )
  const settled: Staircase = { step: STEP_TRACK, lastDir: 1, reversed: true, pace: 1 }
  assert.equal(descentOf(settled) / ascentOf(settled, 1), DESCENT_RATIO)
  // And in a slower child's currency: a child whose correct answers are worth a
  // quarter of a rung each falls a quarter as far, so the *ratio* — and with it
  // the accuracy the search converges on — is the same for them.
  const deliberate: Staircase = { ...settled, pace: 0.25 }
  assert.equal(descentOf(deliberate) / ascentOf(deliberate, 0.25), DESCENT_RATIO)
  assert.equal(descentOf(deliberate), descentOf(settled) / 4)

  // Before the bracket closes it is symmetric. The first miss is the move that
  // *closes* the bracket and must be the size of the moves that opened it —
  // four times an opening stride of four rungs is sixteen, which is the lurch in
  // the other direction.
  const opening = openStaircase()
  assert.equal(descentOf(opening), ascentOf(opening, 1))
})

test("a child who is right four times in five settles, and stays settled", () => {
  // The founder's target, end to end: "maybe where they are getting 80%+
  // correct". A staircase at the 1:4 ratio has zero expected drift at exactly
  // 80%, so a child answering in that pattern must come to rest somewhere and
  // stay there — not creep to the top, and not slide to the floor.
  const rungs = ladder()
  const top = rungs.length - 1
  const walked: number[] = []
  const service = createItemService({ profileId: "p80", record: noRecord, rungs })
  for (let answered = 0; answered < 500; answered++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    // Right on four of every five, in a fixed pattern rather than at random, so
    // the assertion is about the rule and not about a seed.
    const right = answered % 5 !== 4
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: right ? service.reveal(item.id) : "definitely wrong",
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
    walked.push(service.position())
  }
  const tail = walked.slice(400)
  const low = Math.min(...tail)
  const high = Math.max(...tail)
  assert.ok(low > 0, `an 80%-correct child slid to rung ${String(low)}`)
  assert.ok(high < top, `an 80%-correct child crept to the top (rung ${String(high)} of ${String(top)})`)
  // Settled means the last hundred answers cover a handful of rungs, not the
  // ladder. Anything wider is a walk, not a level.
  assert.ok(
    high - low <= 2 * (SPREAD_BELOW + SPREAD_ABOVE),
    `an 80%-correct child's last hundred answers ranged over rungs ${String(low)}..${String(high)}`,
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

  // At the top: quick answers pile up, then one miss must cost the same as it
  // would have cost the moment the top was reached. Credit above the top is not
  // credit — it is clamped away — and a child who kept playing after arriving
  // must not have bought themselves a free miss.
  const top = rungs.length - 1
  /** Climbs to the top, answers `extra` more, misses once, and says where it is. */
  const missAtTop = (profileId: string, extra: number): number => {
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
    const missed = at.next({ packId: "dynawalla.siege" })
    assert.ok(missed)
    at.judge({
      packId: "dynawalla.siege",
      itemId: missed.id,
      response: "definitely wrong",
      latencyMs: 1_000,
    })
    return at.position()
  }
  const straightAway = missAtTop("top-0", 0)
  const afterLingering = missAtTop("top-20", 20)
  assert.ok(straightAway < top, "a miss at the top of the ladder cost nothing at all")
  assert.equal(
    afterLingering,
    straightAway,
    `twenty quick answers at the top banked credit that a miss then paid for: the child who ` +
      `missed straight away fell to ${String(straightAway)} and the one who lingered to ` +
      `${String(afterLingering)}`,
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

test("the spread puts about a fifth of questions above the child's rung, which is what 80% is made of", () => {
  const p = shares(20, 40)
  const below = p.slice(0, 20).reduce((a, b) => a + b, 0)
  const above = p.slice(21).reduce((a, b) => a + b, 0)
  // A fifth above: paired with near-perfect accuracy below the rung, ~90% at it
  // and ~60% one above, this mix measures out at ~83% correct, which is the
  // founder's "80%+ correct" arrived at from the content side while the staircase
  // arrives at it from the search side.
  assert.ok(above > 0.15 && above < 0.25, `${(above * 100).toFixed(1)}% of questions are harder`)
  // A rung the child cannot do is rare: two above is a twentieth.
  assert.ok((p[22] as number) < 0.07, `two rungs up is ${((p[22] as number) * 100).toFixed(1)}%`)
  // And there are real easier questions in the stream — "we could still throw in
  // some single digit problems".
  assert.ok(below > 0.3, `only ${(below * 100).toFixed(1)}% of questions are easier`)

  // Consecutive questions differ: the chance two independent draws land on the
  // same rung is Σp², and a spread that fails this is a point in disguise.
  const same = p.reduce((a, b) => a + b * b, 0)
  assert.ok(same < 0.3, `two questions running land on the same rung ${(same * 100).toFixed(1)}% of the time`)
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
  // The threshold is not taste: it is the size of the bottom rung's own declared
  // closed set, read off the curriculum. Serving one rung, *however* well, cannot
  // produce more distinct questions than the rung has in it — so exceeding it is
  // proof that the neighbours were reached, and it is a number that cannot be
  // satisfied by any amount of shuffling.
  const bottom = rungs.find((rung) => rung.node.id === "dw.add.facts.add-within-ten")?.node.generator
    .closedFactSet?.[0]
  assert.ok(typeof bottom === "number" && bottom > 0, "the bottom rung declares no closed set")
  assert.ok(
    prompts.size > bottom,
    `twenty questions at the floor drew ${String(prompts.size)} distinct prompts and the bottom ` +
      `rung's closed set holds ${String(bottom)} — so nothing outside it was served: ` +
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
  // The guard that the mixing cannot quietly become "any rung at all". Over a
  // long session with a child who is right four times in five, every question
  // must have come from within the kernel of the position at the time.
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
    worstBelow = Math.max(worstBelow, centre - served)
    worstAbove = Math.max(worstAbove, served - centre)
    const right = answered % 5 !== 4
    service.judge({
      packId: "dynawalla.truedraw",
      itemId: item.id,
      response: right ? service.reveal(item.id) : "definitely wrong",
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
  }
  assert.ok(worstAbove <= SPREAD_ABOVE, `a question came ${String(worstAbove)} rungs above the child`)
  assert.ok(worstBelow <= SPREAD_BELOW, `a question came ${String(worstBelow)} rungs below the child`)
  // And it really did use the width, rather than serving the centre forever.
  assert.equal(worstAbove, SPREAD_ABOVE, "the spread never once reached its own ceiling")
  assert.equal(worstBelow, SPREAD_BELOW, "the spread never once reached its own floor")
})
