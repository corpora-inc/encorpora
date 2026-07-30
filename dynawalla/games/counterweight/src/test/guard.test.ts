// **THERE IS NO CLOCK ON THE ANSWER, AND WHAT IS LEFT IS NOT ONE EITHER.**
//
// Two founder reports on the same game, six weeks apart:
//
//   1. "this one is stressful and rushed and sometimes the timing is sort of
//      impossible" — against `timingForBout()`: 13.0 s at the first opponent,
//      1.1 s less at every one after, down to a 7.6 s floor, while the very same
//      counter escalated the arithmetic to four digits. Measured on this
//      package's solver bot, a player thinking at the house table's own p90 held
//      **0 of 78 rounds**.
//   2. "the action is rushed by the timer going down" — against the *fixed*,
//      item-derived window that replaced it, which gave `43 + 25` 14.5 s and
//      `5,001 − 2,798` 47.0 s and was proved sufficient by the same bot.
//
// The second report is the interesting one, because the window it was about was
// generous, monotone and measured. It says the length was never the problem: a
// visible draining countdown is an anxiety cue **however much time it grants**.
//
// So the round has no length at all. `guard.ts` is what is left — an abandonment
// guard — and each case here holds one of the three properties that make it not a
// clock: it measures silence, it is derived from the item, and it is never drawn.

import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  ABANDON_FACTOR,
  comprehensionSeconds,
  guardMsFor,
  MIN_GUARD_SECONDS,
  needsRegrouping,
  STRIKE_SECONDS,
  SUSTAINABLE_STRIKE_SECONDS,
  widestColumn,
} from "../game/guard.ts"
import { planStrikes } from "../game/places.ts"
import { BASE_STRAIN, BLEED_PER_SEC, impulseFor, Strain } from "../game/strain.ts"
import { Rng } from "../core/rng.ts"
import { createStubHost } from "../stubHost.ts"

const HERE = dirname(fileURLToPath(import.meta.url))

/** Every column operation the seven live curriculum rows can produce. */
function ladderItems(): Array<{ prompt: string; answer: number; level: number }> {
  const out: Array<{ prompt: string; answer: number; level: number }> = []
  for (let level = 0; level < 8; level++) {
    const host = createStubHost({ seed: 0x51ee, level, reducedMotion: true })
    for (let i = 0; i < 300; i++) {
      const q = host.next({ domain: "add" })
      out.push({ prompt: q.prompt, answer: Number(q.answer), level })
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// It is not a countdown, anywhere.
// ---------------------------------------------------------------------------

/** Every production `.ts` file in the pack — `src/test/` excluded. */
function productionFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "test") walk(full)
      } else if (entry.name.endsWith(".ts")) out.push(full)
    }
  }
  walk(join(HERE, ".."))
  return out
}

/**
 * A file with its comments taken out.
 *
 * The history of the press window is written down all over this pack on purpose,
 * so a scan for its identifiers has to look at the code and not at the prose.
 */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ")
}

test("nothing named a window or a press limit survives anywhere in the source", () => {
  // **The deletion, held open.** `pressMsFor`, `MIN_PRESS_SECONDS`,
  // `MAX_PRESS_SECONDS` and `motorSeconds` were the window's whole surface, and
  // `game/window.ts` was its home. None of them may come back under any name, in
  // any file — an earlier version of this case scanned `guard.ts` alone, and
  // putting `pressMsFor` back in `bout.ts` sailed straight past it.
  assert.ok(
    !readdirSync(join(HERE, "..", "game")).includes("window.ts"),
    "game/window.ts is back — the press window came with it",
  )
  const files = productionFiles()
  assert.ok(files.length >= 15, `only ${files.length} production files — this scan has gone stale`)
  for (const file of files) {
    const code = codeOf(readFileSync(file, "utf8"))
    for (const banned of ["pressMsFor", "MIN_PRESS_SECONDS", "MAX_PRESS_SECONDS", "motorSeconds"]) {
      assert.ok(!code.includes(banned), `${file} has ${banned} in it — the press window is back`)
    }
  }
})

test("nothing in render/ can read the guard, so nothing can draw it", () => {
  // **The third property, held structurally.** A guard the child can watch is a
  // countdown with a different name. `Bout` exposes `guardMs` and `idle` for the
  // rules and for these tests; the renderer may not touch either, and it no
  // longer has a `progress` to read.
  const render = join(HERE, "..", "render")
  const files = readdirSync(render).filter((f) => f.endsWith(".ts"))
  assert.ok(files.length >= 4, `only ${files.length} files in render/ — this scan has gone stale`)
  for (const file of files) {
    const src = readFileSync(join(render, file), "utf8")
    for (const banned of ["guardMs", ".idle", ".progress", "pressMs"]) {
      assert.ok(
        !src.includes(banned),
        `render/${file} reads \`${banned}\` — the countdown is being drawn again`,
      )
    }
  }
})

// ---------------------------------------------------------------------------
// It is derived from the item, and monotone in it.
// ---------------------------------------------------------------------------

test("the guard is monotone non-decreasing in the item's width", () => {
  const rng = new Rng(0x7c31)
  const byWidth = new Map<number, { min: number; max: number }>()
  for (let i = 0; i < 6000; i++) {
    const a = rng.int(1, 9999)
    const b = rng.int(1, 9999)
    const item = { prompt: `${a} + ${b}`, answer: a + b }
    const ms = guardMsFor(item)
    const w = widestColumn(item)
    const seen = byWidth.get(w) ?? { min: Infinity, max: -Infinity }
    byWidth.set(w, { min: Math.min(seen.min, ms), max: Math.max(seen.max, ms) })
  }
  const widths = [...byWidth.keys()].sort((x, y) => x - y)
  assert.ok(widths.length >= 4, "the sample never reached four columns")
  for (let i = 1; i < widths.length; i++) {
    const lower = byWidth.get(widths[i - 1] as number)
    const upper = byWidth.get(widths[i] as number)
    assert.ok(lower && upper)
    assert.ok(
      upper.min >= lower.max,
      `${widths[i]} columns can get ${upper.min} ms where ${widths[i - 1]} columns gets ${lower.max} ms`,
    )
  }
})

test("regrouping is never worth less patience than not regrouping", () => {
  const rng = new Rng(0x2288)
  let plain = 0
  let carried = 0
  for (let i = 0; i < 4000; i++) {
    const a = rng.int(10, 99)
    const b = rng.int(10, 99)
    if (a + b >= 100) continue
    const item = { prompt: `${a} + ${b}`, answer: a + b }
    if (needsRegrouping(item.prompt)) carried = Math.max(carried, guardMsFor(item))
    else plain = Math.max(plain, guardMsFor(item))
  }
  assert.ok(plain > 0 && carried > 0, "the sample missed one of the two cases")
  assert.ok(carried >= plain, `a regrouping sum got ${carried} ms against ${plain} ms without`)
})

test("the guard is a pure function of the item and of nothing else", () => {
  // The structural claim. `guardMsFor` takes one argument; call it a thousand
  // times, out of order, interleaved with other items, and it cannot drift —
  // which is exactly what a scale counter, a run clock or a tempo would do.
  const items = ladderItems()
  const first = new Map<string, number>()
  for (const item of items) {
    const key = `${item.prompt}=${item.answer}`
    const ms = guardMsFor(item)
    const seen = first.get(key)
    if (seen === undefined) first.set(key, ms)
    else assert.equal(ms, seen, `${key} answered ${ms} ms after answering ${seen} ms`)
  }
  // And again, in reverse, after everything else has been through it.
  for (const item of [...items].reverse()) {
    assert.equal(guardMsFor(item), first.get(`${item.prompt}=${item.answer}`))
  }
})

// ---------------------------------------------------------------------------
// It clears the thinking, at every width the curriculum can serve.
// ---------------------------------------------------------------------------

test("the guard clears the p90 of the arithmetic on every item in the pack", () => {
  // **What the window could not claim.** A limit sized at the p90 fires on the
  // child the p90 describes. This one is a multiple of it — and because any hand
  // on the rack refills it, a child who has started can never meet it at all, so
  // the only thing it has to clear is a *pause*.
  const items = ladderItems()
  let worst = { prompt: "", ratio: Infinity, level: -1 }
  for (const item of items) {
    const ratio = guardMsFor(item) / 1000 / comprehensionSeconds(item)
    if (ratio < worst.ratio) worst = { prompt: item.prompt, ratio, level: item.level }
  }
  assert.ok(
    worst.ratio >= ABANDON_FACTOR,
    `${worst.prompt} (rung ${worst.level}) gets only ${worst.ratio.toFixed(2)}× its own p90`,
  )
  assert.ok(ABANDON_FACTOR >= 2, "one p90 of silence is a guard that fires on a slow child")
})

test("the guard is longer than the whole window it replaced, at every width", () => {
  // The window was `comprehension + columns × 5 × 0.35`, clamped to [9, 52], and
  // it was a ceiling on the entire round. The guard is longer than that *and* it
  // refills, so no item in the pack is more urgent than it was before.
  for (const item of ladderItems()) {
    const columns = Math.max(1, Math.min(4, widestColumn(item)))
    const oldWindowSeconds = Math.max(
      9,
      Math.min(52, comprehensionSeconds(item) + columns * 5 * STRIKE_SECONDS),
    )
    assert.ok(
      guardMsFor(item) / 1000 >= oldWindowSeconds,
      `${item.prompt} gets ${guardMsFor(item) / 1000}s of silence against a ${oldWindowSeconds}s window`,
    )
  }
})

test("the whole plan a correct player strikes never shears the steel", () => {
  // Not a comfort figure. A blow outside the resonance window costs `BASE_STRAIN`
  // and the beam bleeds `BLEED_PER_SEC`, so anything faster than their ratio
  // accumulates strain until the beam shears — which would mean the game shearing
  // a child for executing a correct plan. Proved by playing it, not by reading
  // the constants.
  assert.ok(
    STRIKE_SECONDS >= SUSTAINABLE_STRIKE_SECONDS,
    `${STRIKE_SECONDS}s per strike is faster than the steel bleeds (${SUSTAINABLE_STRIKE_SECONDS}s)`,
  )
  assert.equal(SUSTAINABLE_STRIKE_SECONDS, BASE_STRAIN / BLEED_PER_SEC)
  assert.equal(impulseFor(STRIKE_SECONDS * 1000), BASE_STRAIN)

  // The longest plan this rack can be asked for, struck at a child's cadence.
  // Found rather than asserted: five blows on each of the low places and whatever
  // is left on the thousands pillar, which has nothing above it.
  let longest = 0
  for (let delta = -19999; delta <= 19999; delta++) {
    longest = Math.max(longest, planStrikes(delta).length)
  }
  assert.ok(longest >= 20, `the worst plan is only ${longest} strikes`)
  const steel = new Strain({ shearAt: 34 })
  for (let i = 0; i < longest; i++) {
    steel.strike()
    steel.advance(STRIKE_SECONDS * 1000)
    assert.equal(steel.isSheared, false, `the steel sheared on blow ${i + 1} of a correct plan`)
  }
})

test("comprehension is monotone, so nothing can cancel out inside the guard", () => {
  const widths: Array<{ prompt: string; answer: number }> = [
    { prompt: "3 + 4", answer: 7 },
    { prompt: "43 + 25", answer: 68 },
    { prompt: "473 + 168", answer: 641 },
    { prompt: "6253 + 5710", answer: 11963 },
  ]
  for (let i = 1; i < widths.length; i++) {
    const lower = widths[i - 1] as { prompt: string; answer: number }
    const upper = widths[i] as { prompt: string; answer: number }
    assert.ok(comprehensionSeconds(upper) >= comprehensionSeconds(lower))
    assert.ok(guardMsFor(upper) >= guardMsFor(lower))
  }
})

test("a prompt this cannot read gets the longer silence, never the shorter", () => {
  // Guessing in the child's favour is the only direction this may be wrong in.
  assert.equal(needsRegrouping("a bag of 47 marbles and one of 25"), true)
  assert.equal(needsRegrouping("43 + 25"), false)
  assert.equal(needsRegrouping("47 + 25"), true)
  assert.equal(needsRegrouping("52 − 27"), true)
  assert.equal(needsRegrouping("58 − 27"), false)
})

test("the floor holds, and it is what a one-digit fact gets", () => {
  assert.equal(guardMsFor({ prompt: "1 + 1", answer: 2 }), MIN_GUARD_SECONDS * 1000)
  assert.ok(
    MIN_GUARD_SECONDS * 1000 > ABANDON_FACTOR * comprehensionSeconds({ prompt: "1 + 1", answer: 2 }) * 1000,
    "the floor stopped binding on the narrowest item, so nothing here is measured",
  )
})

test("no prompt can pin an item open, however malformed", () => {
  // **There is no `MAX_GUARD_SECONDS`, and this is why one is not needed.** The
  // ceiling is `columnsOf`'s clamp: anything wider than the table is treated as
  // the widest row the table has, so the longest silence anything can ask for is
  // the four-column-with-regrouping figure and nothing else.
  const widest = guardMsFor({ prompt: "5001 − 2798", answer: 2203 })
  assert.equal(widest, 80_000, "the widest item in the pack stopped getting 80 s")
  for (const absurd of [
    { prompt: "123456789 + 987654321", answer: 1111111110 },
    { prompt: "9999999999999 − 1", answer: 9999999999998 },
    { prompt: "a bag of dates and a bag of figs", answer: 0 },
  ]) {
    assert.ok(
      guardMsFor(absurd) <= widest,
      `"${absurd.prompt}" asked for ${guardMsFor(absurd) / 1000}s, past the table's own widest row`,
    )
  }
})

test("the published figures are the figures", () => {
  // The before/after table in `guard.ts`'s header, asserted — because a comment
  // nobody checks is how the old window's documented floor came to be
  // arithmetically impossible without anybody noticing.
  const cases: Array<[string, number, number]> = [
    ["3 + 4", 7, 30],
    ["43 + 25", 68, 30],
    ["47 + 25", 72, 30],
    ["473 + 168", 641, 46],
    ["5001 − 2798", 2203, 80],
  ]
  for (const [prompt, answer, seconds] of cases) {
    assert.equal(guardMsFor({ prompt, answer }) / 1000, seconds, prompt)
  }
})
