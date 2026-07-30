// THE LADDER, AND THE THING THAT MOVES IT.
//
// `PACING_AUDIT_2026-07.md`, root cause three: "escalation runs on the wall clock,
// ignoring whether the child is getting anything right — HORDE: `difficulty = 1 +
// floor(runT / 88)`, so a child who has missed EVERY question meets three-digit
// addition at minute eleven purely for surviving." The well-paced games are the ones
// indexed on achievement instead.
//
// THE GAVEL has one line that moves its intensity and it is called once per settled
// lot. This file holds four things about it:
//
//   1. it moves on lots, and nothing else can move it;
//   2. flawless play actually reaches the top — the failure mode this test caught in
//      development was the opposite one, and it was silent;
//   3. struggling comes back down, faster than it went up;
//   4. everything the intensity is spent on is monotone in it, and none of it is a
//      comprehension window, because there is no clock to put one in.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  LOT_STEP_SECONDS,
  MAX_BID_DIGITS,
  MAX_MARGIN,
  MAX_TABLET_VALUE,
  MAX_TABLETS,
  MIN_NUMERAL_PX,
  MIN_TABLETS,
  PROMPT_MAX_CHARS,
  SPEC,
  ladderScale,
  observe,
  revealHoldMs,
  rungCannotDraw,
  settleAfterLot,
  tabletCount,
  tabletValue,
  trapChance,
  tryParseBid,
} from "../game/ladder.ts"
import { seedSuccess } from "../../../../packs/shared/game-pacing/index.ts"
import { promptPx } from "../render/layout.ts"
import { MASHES, PERFECT, play } from "./harness.ts"

const q = (over: Partial<Parameters<typeof tabletValue>[0]> = {}) => ({
  id: "q",
  prompt: "12 + 5",
  answer: "17",
  distractors: [],
  domain: "add",
  difficulty: 0.4,
  ...over,
})

test("flawless play reaches the top of the ladder, and does not sprint there", () => {
  const sitting = play(PERFECT, 60, 0x2718)
  assert.ok(
    sitting.game.intensity > 0.95,
    `sixty flawless lots left the run at intensity ${sitting.game.intensity.toFixed(3)} — ` +
      "a child who never made a mistake was held near the easiest content in the product",
  )
  // …but not in four lots. `SECOND_GRADE_FLOW`'s climb constants are tuned for a
  // per-frame delta and this controller is stepped once per lot, so the shared
  // `climbBoost` crossed the whole curriculum ladder in about four answers.
  const early = play(PERFECT, 6, 0x2718)
  assert.ok(
    early.game.intensity < 0.75,
    `six lots reached intensity ${early.game.intensity.toFixed(3)} — that is a jump, not a climb`,
  )
})

test("a run that is going badly comes back down, and comes down faster", () => {
  const good = play(PERFECT, 40, 0x2718)
  const bad = play(MASHES, 40, 0x2718)
  assert.ok(bad.game.intensity < 0.2, `mashing sat at intensity ${bad.game.intensity.toFixed(3)}`)
  assert.ok(good.game.intensity > bad.game.intensity + 0.6)

  // Symmetry, from the constants rather than from a comment: relief is not earned.
  const fromTop = settleAfterLot(1, 0)
  const fromBottom = settleAfterLot(0, 1)
  assert.ok(1 - fromTop > fromBottom, "the ladder climbs faster than it relents")
})

test("nothing but a settled lot can move the intensity", () => {
  // `settleAfterLot` is the only door, and it takes no clock: the step is a constant.
  const once = settleAfterLot(0.5, 1)
  const again = settleAfterLot(0.5, 1)
  assert.equal(once, again)
  assert.ok(LOT_STEP_SECONDS > 0)
  // Marking, typing and un-marking a tablet a hundred times is not an achievement.
  const sitting = play(PERFECT, 8, 0x1)
  const before = sitting.game.intensity
  for (let i = 0; i < 100; i++) {
    sitting.game.tapTablet(0)
    sitting.game.pressDigit(7)
    sitting.game.backspace()
  }
  assert.equal(sitting.game.intensity, before)
})

test("the controller is never told how long the child took", () => {
  // A bonus for a quick answer is a clock in a different hat: think for longer and the
  // room gets easier, so a careful child is quietly demoted. `observe` takes two
  // arguments and neither of them is a duration.
  assert.equal(observe.length, 2)
  assert.equal(observe(0.5, true), observe(0.5, true))
  assert.ok(observe(0.5, true) > 0.5)
  assert.ok(observe(0.5, false) < 0.5)
  // …which only works because a correct answer is FULL evidence here. Left at the
  // shared spec's 0.55, flawless play scores exactly `strugglingBelow` forever and the
  // ladder never leaves the floor.
  assert.equal(SPEC.laboredScore, 1)
  assert.ok(SPEC.laboredScore > SPEC.strugglingBelow)
  let success = seedSuccess(SPEC)
  for (let i = 0; i < 12; i++) success = observe(success, true)
  assert.ok(success > SPEC.thrivingAbove, `a dozen correct answers reached only ${success.toFixed(3)}`)
})

test("everything the intensity is spent on is monotone in it, and none of it is a clock", () => {
  let lastTablets = 0
  let lastTrap = -1
  for (let i = 0; i <= 100; i++) {
    const x = i / 100
    const tablets = tabletCount(x)
    assert.ok(tablets >= MIN_TABLETS && tablets <= MAX_TABLETS)
    assert.ok(tablets >= lastTablets, `the room shrank between ${String(x)} and the step before`)
    lastTablets = tablets

    const trap = trapChance(x)
    assert.ok(trap >= 0 && trap <= 0.5)
    if (x >= 0.12) {
      assert.ok(trap >= lastTrap, "the trap rate went backwards")
      lastTrap = trap
    } else {
      assert.equal(trap, 0, "the bottom of the ladder served a lot nobody can profit from")
    }
  }
})

test("the reveal after the hammer is the only duration in the game, and it has a floor", () => {
  // It is a hold on an answer already given, never a window to answer in — so it is
  // allowed to shorten as the run climbs, which is the opposite of what FOUNDRY's
  // `tempo = 1.06 − 0.16·difficulty` did to its comprehension window.
  const calm = revealHoldMs(0)
  const hard = revealHoldMs(1)
  assert.ok(calm > hard, "the patient reveal at the bottom of the ladder is missing")
  assert.ok(hard >= 900, `the reveal collapsed to ${String(hard)}ms and would tear the room down`)
})

test("difficulty goes out on the unambiguous 1..10 scale", () => {
  // `game-host` reads a value under 1 as a fraction and 1..10 as a ladder index, and
  // resolves the one value both scales claim — exactly 1 — as the BOTTOM. POLARITY
  // sent a fraction that reached 1 after fifteen strata and meant the top; it was
  // served the easiest content in the product for the rest of the run.
  assert.equal(ladderScale(0), 1)
  assert.equal(ladderScale(1), 10)
  assert.ok(ladderScale(0.5) > 1)
  const sitting = play(PERFECT, 40, 0x2718)
  const ask = sitting.game.askShape()
  assert.ok((ask.difficulty ?? 0) > 9, `a run at the top asked for ${String(ask.difficulty)}`)
})

test("a tablet carries a whole non-negative price, or the question is refused", () => {
  assert.equal(tabletValue(q()), 17)
  assert.equal(tabletValue(q({ answer: "0" })), 0)
  assert.equal(tabletValue(q({ answer: "1/2" })), null)
  assert.equal(tabletValue(q({ answer: "2.5" })), null)
  assert.equal(tabletValue(q({ answer: "-4" })), null)
  assert.equal(tabletValue(q({ answer: String(MAX_TABLET_VALUE) })), MAX_TABLET_VALUE)
  assert.equal(tabletValue(q({ answer: String(MAX_TABLET_VALUE + 1) })), null)
  assert.equal(tabletValue(q({ answer: " 17 " })), 17)
  assert.equal(tabletValue(q({ prompt: "1".repeat(PROMPT_MAX_CHARS + 1) })), null)
  assert.equal(tryParseBid("007"), 7)
  assert.equal(tryParseBid(""), null)
  assert.equal(tryParseBid("1e3"), null)
  // The paddle has to hold the offer as well as the bid, and the offer sits up to
  // `MAX_MARGIN` above the highest tablet.
  assert.ok(String(MAX_TABLET_VALUE + MAX_MARGIN).length <= MAX_BID_DIGITS)
})

test("the whole live ladder fits on a tablet, including the rung that used to cap it", () => {
  // `dw.mul.multidigit.times-one-digit` is active and reaches `4827 × 6 = 28962`. At the
  // old 9,999 ceiling that item was refused — and, because the refusal was misread as a
  // fact about the RUNG, it capped the stream below its own ordinate and took 21 of the
  // shipped ladder's 66 rungs out of the run, including all three rungs of
  // `dw.add.regroup.subtract-across-zero`, whose answers fit a tablet perfectly.
  assert.equal(tabletValue(q({ prompt: "4827 × 6", answer: "28962" })), 28962)
  assert.equal(tabletValue(q({ prompt: "9999 × 9", answer: "89991" })), 89991)
})

test("a refusal that is a fact about the rung caps it; an item-level refusal never does", () => {
  // Two rung facts, both constants of this game: a prompt wider than a tablet, and an
  // answer that is not a whole number at all. A fraction rung emits fractions forever.
  assert.equal(rungCannotDraw(q({ answer: "1/2" })), true)
  assert.equal(rungCannotDraw(q({ answer: "2.5" })), true)
  assert.equal(rungCannotDraw(q({ prompt: "1".repeat(PROMPT_MAX_CHARS + 1) })), true)

  // Everything else is a fact about the ITEM. The pair below comes from the SAME rung,
  // and capping on the first one is what deleted a third of the ladder.
  assert.equal(rungCannotDraw(q()), false)
  assert.equal(rungCannotDraw(q({ prompt: "4827 × 6", answer: "99999999" })), false)
  assert.equal(rungCannotDraw(q({ prompt: "1023 × 2", answer: "2046" })), false)
  // A negative comes from a signed rung that also emits positives, so it is an item too.
  assert.equal(rungCannotDraw(q({ answer: "-4" })), false)
  assert.equal(tabletValue(q({ answer: "-4" })), null)

  assert.equal(rungCannotDraw(q({ answer: "1/2", id: "" })), false)
})

test("the widest prompt a tablet will accept still prints at the legibility floor", () => {
  // `polarity` shipped `LABEL_MAX_CHARS = 8` with a comment saying eight characters
  // "still fits the cell without squeezing". They overflowed it by about 60% and
  // nothing measured. This checks the constant against the renderer.
  const widest = "1".repeat(PROMPT_MAX_CHARS)
  const size = promptPx(widest, 132, 42)
  assert.ok(
    size >= MIN_NUMERAL_PX,
    `the widest accepted prompt prints at ${String(size)}px, under the ${String(MIN_NUMERAL_PX)}px floor`,
  )
  // …and it fits. 0.63em per digit is the face's measured advance.
  assert.ok(PROMPT_MAX_CHARS * size * 0.63 <= 132 - 16 + 1, "the widest prompt runs off the tablet")
  // A short prompt is drawn large, because a child reading `7 + 5` should not be
  // reading it at the size a four-digit column sum needs.
  assert.ok(promptPx("7 + 5", 132, 42) > size)
})
