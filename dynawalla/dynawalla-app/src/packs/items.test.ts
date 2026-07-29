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
  cadenceFor,
  choicesFor,
  binaryOperator,
  climbRungs,
  climbWithinMs,
  createItemService,
  isQuick,
  itemPace,
  ladder,
  normalizeMinus,
} from "./items.ts"
import type { Rung } from "./items.ts"
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
    assert.equal(
      service.position(),
      step + 1,
      `${item.prompt} is ${String(width)} digits wide, its published median is ` +
        `${String(median)} ms, it was answered correctly in exactly that, and the ladder ` +
        `did not move off rung ${String(step)}`,
    )
  }
})

test("a two-digit regrouping answered a millisecond past the median still climbs", () => {
  // The median is the median: half of the children answering at the expected
  // pace are on the slow side of it. A gate cut at 6,000 ms sent every one of
  // them back down the ladder for being average.
  const rungs = ladder().filter((rung) => rung.node.id === "dw.add.regroup.subtract-multidigit")
  assert.ok(rungs.length > 1)
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })

  const item = service.next({ packId: "dynawalla.siege" })
  assert.ok(item)
  assert.equal(widthOf(item.operands), 2, `${item.prompt} is not the two-digit rung`)
  service.judge({
    packId: "dynawalla.siege",
    itemId: item.id,
    response: service.reveal(item.id),
    latencyMs: 6_001,
  })
  assert.equal(service.position(), 1, `${item.prompt} in 6,001 ms did not climb`)
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
    assert.equal(service.position(), 1, "a broken clock stopped a correct answer climbing")
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
  const rungs = ladder().filter((rung) => rung.node.id === "dw.add.facts.add-within-ten")
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
  assert.equal(climbed, 1)

  const second = service.next({ packId: "dynawalla.siege" })
  assert.ok(second)
  service.judge({
    packId: "dynawalla.siege",
    itemId: second.id,
    response: service.reveal(second.id),
    // Five minutes on a single-digit fact. Nobody's p90.
    latencyMs: 300_000,
  })
  assert.equal(service.position(), climbed, "one slow answer jumped a whole rung")

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

test("an answer at the published median is worth exactly one rung, and a miss costs exactly one", () => {
  // The descent rule is unchanged and is founder direction; what is checked here
  // is that it composes with the climb rule rather than fighting it.
  //
  // Six answers, each taking exactly as long as the table says that class takes.
  // Not quick, not slow: expected. Expected is one rung — the middle regime —
  // and the fact that `high` is exactly 6 rather than something larger is the
  // assertion that the speedcuber bonus does not leak into ordinary pace.
  const rungs = ladder()
  const service = createItemService({ profileId: "p1", record: noRecord, rungs })
  for (let i = 0; i < 6; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: service.reveal(item.id),
      latencyMs: publishedP50Ms(widthOf(item.operands)),
    })
  }
  const high = service.position()
  assert.equal(high, 6)
  for (let i = 0; i < 3; i++) {
    const item = service.next({ packId: "dynawalla.siege" })
    assert.ok(item)
    service.judge({
      packId: "dynawalla.siege",
      itemId: item.id,
      response: "definitely wrong",
      latencyMs: 1_000,
    })
  }
  assert.equal(service.position(), high - 3, "three misses did not cost exactly three rungs")
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
  assert.ok(
    quick.answers >= Math.ceil(quick.top / 2.5),
    `${String(quick.top)} rungs in ${String(quick.answers)} answers is more than 2.5 rungs an ` +
      `answer, and 2.5 is the widest p90/p50 the cadence table publishes`,
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
  // One slow-and-right answer: some fraction of a rung, and still rung 0.
  service.judge({
    packId: "dynawalla.siege",
    itemId: item.id,
    response: service.reveal(item.id),
    latencyMs: A_FULL_MINUTE_MS,
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

  // At the top: quick answers pile up, then one miss must cost exactly one rung
  // rather than being absorbed by banked credit.
  const top = rungs.length - 1
  for (let i = 0; i < 200 && service.position() < top; i++) {
    const next = service.next({ packId: "dynawalla.siege" })
    assert.ok(next)
    service.judge({
      packId: "dynawalla.siege",
      itemId: next.id,
      response: service.reveal(next.id),
      latencyMs: A_SPEEDCUBER_MS,
    })
  }
  assert.equal(service.position(), top)
  for (let i = 0; i < 5; i++) {
    const next = service.next({ packId: "dynawalla.siege" })
    assert.ok(next)
    service.judge({
      packId: "dynawalla.siege",
      itemId: next.id,
      response: service.reveal(next.id),
      latencyMs: A_SPEEDCUBER_MS,
    })
  }
  const missedAtTop = service.next({ packId: "dynawalla.siege" })
  assert.ok(missedAtTop)
  service.judge({
    packId: "dynawalla.siege",
    itemId: missedAtTop.id,
    response: "definitely wrong",
    latencyMs: 1_000,
  })
  assert.equal(
    service.position(),
    top - 1,
    "five quick answers at the top banked credit that a miss then paid for",
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
