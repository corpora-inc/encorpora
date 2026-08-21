// A LEVEL-UP MUST NOT KILL A LIVE QUESTION.
//
// The founder: "sometimes a level up can happen when a math problem is active
// and you can never activate the answer after that." The screenshot is LV 9 at
// 1:25 with `5 + 4` on the field and the orbs `8`, `9`, `10` still glowing —
// nothing is missing from the picture, and nothing the child does to them
// registers.
//
// The word that matters is SOMETIMES. This is a race between two things that
// are each fine on their own: bullet time keeps the world running inside a
// CORE, so gems are still collected there, and `gain` used to open the upgrade
// panel from the middle of that physics step. `pickCard` then returned the game
// to "play" — the only mode it knew — and "core" was gone with the question
// still open. `questTick` runs only in "core", so nothing turned the ring or
// tested a strike ever again.
//
// So the test is the race, not the happy path: a level is earned at several
// points across a question's life and the question has to survive every one of
// them. The sequences below are the real orderings from `game.ts`, driven
// through the real `LevelUps`.

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

import { LevelUps, type Mode } from "./levelup.ts"

const GAME = readFileSync(fileURLToPath(new URL("./game.ts", import.meta.url)), "utf8")

/**
 * The frame loop, as `game.ts` runs it: the sim steps, then the panel opens if
 * it may. Returns whether the cards opened on this frame.
 */
function frame(levels: LevelUps, mode: Mode): boolean {
  return levels.take(mode)
}

test("a level earned inside a CORE does not take the screen", () => {
  const levels = new LevelUps()
  // The diver swims into a core. The question is open and bullet time is on.
  let mode: Mode = "core"
  levels.earned() // a gem crossed a level, mid-question
  assert.equal(frame(levels, mode), false, "the cards opened over a live question")
  // Several more frames of the child thinking about 5 + 4.
  for (let i = 0; i < 120; i++) {
    assert.equal(frame(levels, mode), false, `the cards opened on frame ${i} of the question`)
  }
  assert.equal(levels.waiting, 1, "the level was dropped instead of banked")

  // The child touches an orb; `closeQuestion` puts the game back in play.
  mode = "play"
  assert.equal(frame(levels, mode), true, "the banked level never opened after the question")
  assert.equal(levels.waiting, 0)
})

test("the level is banked wherever in the question it is earned", () => {
  // Immediately, mid-window, and on the last frame before the strike.
  for (const offset of [0, 1, 30, 119, 120]) {
    const levels = new LevelUps()
    for (let i = 0; i <= 120; i++) {
      if (i === offset) levels.earned()
      assert.equal(
        frame(levels, "core"),
        false,
        `earned at frame ${offset}: the panel opened at frame ${i}, mid-question`,
      )
    }
    assert.equal(levels.waiting, 1, `earned at frame ${offset}: the level was lost`)
    assert.equal(frame(levels, "play"), true, `earned at frame ${offset}: it never opened`)
  }
})

test("two levels from one gem are two panels, one after the other", () => {
  // `gain`'s loop can cross two thresholds on a single pickup. It used to call
  // `levelUp` twice in a row, and the second `showCards` replaced the first
  // three cards before the child had touched one of them.
  const levels = new LevelUps()
  levels.earned()
  levels.earned()
  assert.equal(frame(levels, "play"), true, "the first panel did not open")
  // The panel is up; the mode is "levelup" until a card is picked.
  assert.equal(frame(levels, "levelup"), false, "the second panel opened over the first")
  assert.equal(levels.waiting, 1)
  // Card picked, back in play.
  assert.equal(frame(levels, "play"), true, "the second panel was swallowed")
  assert.equal(levels.waiting, 0)
})

test("a level earned in the RIFT waits for the run to come back", () => {
  const levels = new LevelUps()
  levels.earned()
  for (const mode of ["rift", "rift", "rift"] as Mode[]) {
    assert.equal(frame(levels, mode), false, "the cards opened over the rift's questions")
  }
  assert.equal(frame(levels, "play"), true)
})

test("nothing opens in the modes with no run in them", () => {
  for (const mode of ["title", "over", "paused"] as Mode[]) {
    const levels = new LevelUps()
    levels.earned()
    assert.equal(frame(levels, mode), false, `the cards opened in "${mode}"`)
    assert.equal(levels.waiting, 1, `the level was spent in "${mode}"`)
  }
})

test("an empty queue opens nothing, however long the game runs", () => {
  const levels = new LevelUps()
  for (let i = 0; i < 600; i++) assert.equal(frame(levels, "play"), false)
  assert.equal(levels.waiting, 0)
})

test("a new run owes nothing", () => {
  const levels = new LevelUps()
  levels.earned()
  levels.earned()
  levels.clear()
  assert.equal(levels.waiting, 0)
  assert.equal(frame(levels, "play"), false, "last run's levels opened in this one")
})

/* ------------------------------------------------- and that game.ts uses it */

/** The body of a method of `Game`, by brace matching rather than by grep. */
function methodBody(src: string, name: string): string {
  const at = src.search(new RegExp(`^  (?:private )?${name}\\(`, "m"))
  assert.notEqual(at, -1, `Game.${name} is gone — this test is about nothing`)
  const open = src.indexOf("{", at)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++
    else if (src[i] === "}") {
      depth--
      if (depth === 0) return src.slice(open + 1, i)
    }
  }
  throw new Error(`Game.${name} does not close`)
}

test("the physics step never opens the panel itself", () => {
  const gain = methodBody(GAME, "gain")
  assert.ok(
    gain.includes("this.levels.earned()"),
    "`gain` no longer banks the level through the queue",
  )
  assert.ok(
    !/this\.levelUp\(\)/.test(gain),
    "`gain` calls `levelUp()` from inside the physics step again — that is the founder's " +
      "dead CORE, exactly: the panel takes the screen mid-question and the mode never " +
      "comes back to it",
  )
})

test("the panel opens from the frame loop, through the queue, and nowhere else", () => {
  const calls = [...GAME.matchAll(/this\.levelUp\(\)/g)]
  assert.equal(
    calls.length,
    1,
    `\`levelUp()\` is called from ${calls.length} places; it may only be called from the ` +
      `frame loop, guarded by the queue`,
  )
  assert.ok(
    /this\.levels\.take\(this\.mode\)\)\s*this\.levelUp\(\)/.test(GAME),
    "the one call is no longer guarded by `levels.take(this.mode)`",
  )
})

test("only levelUp puts the game into the card panel", () => {
  const setters = [...GAME.matchAll(/this\.mode = "levelup"/g)]
  assert.equal(
    setters.length,
    1,
    "something other than `levelUp()` moves the game into the card panel",
  )
  assert.ok(
    methodBody(GAME, "levelUp").includes('this.mode = "levelup"'),
    "the one place that enters the panel is not `levelUp`",
  )
})

test("a question is still only ever ended by closeQuestion", () => {
  // The other half of the founder's bug: `closeQuestion` is guarded on the mode
  // being "core", so anything that changed the mode out from under a live
  // question silently disabled the close as well.
  const close = methodBody(GAME, "closeQuestion")
  assert.ok(close.includes('if (this.mode !== "core") return'), "the guard changed")
  assert.ok(close.includes("this.orbs.length = 0"), "the orbs are no longer cleared on close")
  const tick = methodBody(GAME, "questTick")
  assert.ok(tick.includes("this.closeQuestion(null)"), "the thinking clock no longer closes it")
})

test("a question cannot be orphaned by dying inside a CORE either", () => {
  // The other way the founder's symptom could be produced: `die()` sets the
  // mode to "rift" and does not clear `this.q` or `this.orbs`, so a run that
  // came back from the rift would have a ring of dead orbs on the field for
  // exactly the same reason. It cannot happen — a CORE is bullet time, not
  // safety, but damage is only ever applied in "play" — and this is what keeps
  // it that way.
  const hurt = methodBody(GAME, "hurt")
  assert.ok(
    hurt.includes('if (this.invuln > 0 || this.mode !== "play") return'),
    "`hurt` no longer refuses to hurt outside play — a child can now be killed " +
      "mid-question, and `die` leaves the question open behind the rift",
  )
  assert.ok(hurt.includes("this.die()"), "`hurt` no longer leads to `die`")
  const deaths = [...GAME.matchAll(/this\.die\(\)/g)]
  assert.equal(
    deaths.length,
    1,
    `\`die()\` is reached from ${deaths.length} places; only \`hurt\` may reach it, because ` +
      `only \`hurt\` checks the mode first`,
  )
})

test("the run's own reset empties the queue", () => {
  assert.ok(
    methodBody(GAME, "reset").includes("this.levels.clear()"),
    "a level banked in the last run opens over the start of the next one",
  )
})
