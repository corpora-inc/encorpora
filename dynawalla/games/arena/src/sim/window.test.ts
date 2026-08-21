// THE SILENCE GUARD, held to the four things it claims.
//
// It is derived from the item. It is monotone non-decreasing in the item's
// difficulty. Nothing about the run can reach it. And it is never a countdown.
//
// The first three are properties of `window.ts` and are asserted here over the
// whole cross product the table can express. The fourth is a property of the
// WORLD, and lives in `sim.test.ts` where a real scheduler can be flown.

import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"

import {
  ABANDON_FACTOR,
  MAX_COLUMNS,
  MAX_GUARD_SECONDS,
  MIN_GUARD_SECONDS,
  comprehensionSeconds,
  guardSeconds,
  invitesPaper,
  needsRegrouping,
  opOf,
  widestColumn,
  type Item,
} from "./window.ts"

/** An item as the host hands it over: two strings and nothing else. */
const it = (prompt: string, answer: string): Item => ({ prompt, answer })

/**
 * The house cadence table's own anchors, plus the two the founder named.
 *
 * `docs/EXPERIENCE_DESIGN.md`, p50/p90:
 *
 *     single-digit fact           2.8s / 6s
 *     two-digit with regrouping     6s / 14s
 *     the `5,001 − 2,798` class    16s / 40s
 *
 * The guard is sized off the **p90** column — see the module note — so the
 * expectations below are `ABANDON_FACTOR ×` those rows.
 */
const ANCHORS: Array<{ item: Item; p90: number; note: string }> = [
  { item: it("7 + 5", "12"), p90: 6, note: "TABLE ROW: single-digit fact, 2.8s/6s" },
  { item: it("47 + 25", "72"), p90: 14, note: "TABLE ROW: two-digit with regrouping, 6s/14s" },
  { item: it("5001 − 2798", "2203"), p90: 40, note: "TABLE ROW: the 5,001 − 2,798 class, 16s/40s" },
  { item: it("43 + 25", "68"), p90: 11, note: "interpolated: two digits, no regrouping" },
  { item: it("473 + 168", "641"), p90: 23, note: "interpolated: three digits with regrouping" },
  { item: it("34801 ÷ 37", "941"), p90: 60, note: "extrapolated: the item the founder named" },
]

test("every anchor of the house cadence table lands where the table says", () => {
  const rows: string[] = []
  for (const { item, p90, note } of ANCHORS) {
    const got = comprehensionSeconds(item)
    const guard = guardSeconds(item)
    rows.push(
      `  ${item.prompt.padEnd(14)} p90 ${String(got).padStart(3)}s  guard ${String(guard).padStart(4)}s   (${note})`,
    )
    assert.equal(got, p90, `${item.prompt} was scored at ${got}s against the table's ${p90}s — ${note}`)
  }
  console.log("[measured] the guard, per item class:\n" + rows.join("\n"))
})

/**
 * The whole point, stated as the number he asked for.
 *
 * "invite the kid to take out a piece of paper and work it out for 10 minutes for
 * the points". `ABANDON_FACTOR` is derived from this rather than tuned toward it:
 * ten times the 60s p90 of five-column long division is ten minutes.
 */
test("the hardest thing ARENA serves gets the founder's ten minutes, and it is derived", () => {
  assert.equal(guardSeconds(it("34801 ÷ 37", "941")), 600, "34801 ÷ 37 does not get ten minutes")
  assert.equal(
    ABANDON_FACTOR * comprehensionSeconds(it("34801 ÷ 37", "941")),
    600,
    "the ten minutes is a coincidence of the clamps rather than the factor times the p90",
  )
  assert.equal(MAX_GUARD_SECONDS, 600, `the longest silence anything can ask for is ${MAX_GUARD_SECONDS}s`)
  // …and nothing can reach past it, however wide the prompt.
  assert.equal(
    guardSeconds(it("123456789012 ÷ 987654321", "124")),
    MAX_GUARD_SECONDS,
    "a twelve-column prompt escaped the table's last row",
  )
})

/**
 * The invariant, over the whole cross product rather than at three points.
 *
 * `docs/PACING_AUDIT_2026-07.md`: "`window(d)` must be MONOTONE NON-DECREASING in
 * item difficulty. A harder question may never get less time than an easier one."
 *
 * Difficulty here has three axes the table can express — column count, whether a
 * column regroups, and whether the operation is a partial-product one — and the
 * assertion walks all of them.
 */
test("more columns is never less time, and regrouping is never less time than not", () => {
  // Column count, plain addition, no carry anywhere: 1 + 1, 11 + 11, 111 + 111…
  let prev = 0
  for (let n = 1; n <= 8; n++) {
    const operand = "1".repeat(n)
    const answer = "2".repeat(n)
    const got = comprehensionSeconds(it(`${operand} + ${operand}`, answer))
    assert.ok(got >= prev, `${n} columns got ${got}s against ${n - 1} columns' ${prev}s`)
    prev = got
  }

  // Regrouping never buys less. Same width, carry vs no carry, every width.
  for (let n = 1; n <= 6; n++) {
    const plainA = "1".repeat(n)
    const plainB = "1".repeat(n)
    const carryA = "9".repeat(n)
    const carryB = "9".repeat(n)
    const plain = comprehensionSeconds(it(`${plainA} + ${plainB}`, String(Number(plainA) + Number(plainB))))
    const carry = comprehensionSeconds(it(`${carryA} + ${carryB}`, String(Number(carryA) + Number(carryB))))
    assert.ok(carry >= plain, `at ${n} columns, regrouping got ${carry}s against ${plain}s for not regrouping`)
  }

  // The table's own internal condition, which is what makes the two axes compose:
  // a regrouping item at n columns may never outrank a PLAIN item at n + 1.
  for (let n = 1; n < MAX_COLUMNS; n++) {
    const carryA = "9".repeat(n)
    const carry = comprehensionSeconds(it(`${carryA} + ${carryA}`, String(Number(carryA) * 2)))
    const widerA = "1".repeat(n + 1)
    const wider = comprehensionSeconds(it(`${widerA} + ${widerA}`, "2".repeat(n + 1)))
    assert.ok(
      carry <= wider,
      `${n} columns with a carry (${carry}s) outranks ${n + 1} plain columns (${wider}s) — the two axes do not compose`,
    )
  }

  // And a partial-product operation is never cheaper than the same width of
  // addition. `12 × 34` is four single-digit products and a two-column sum.
  for (let n = 2; n <= 5; n++) {
    const a = "1".repeat(n)
    const add = comprehensionSeconds(it(`${a} + ${a}`, "2".repeat(n)))
    const mul = comprehensionSeconds(it(`${a} × ${a}`, "9".repeat(n)))
    const div = comprehensionSeconds(it(`${a} ÷ ${a}`, "1"))
    assert.ok(mul >= add, `${n}-column × got ${mul}s against ${n}-column + at ${add}s`)
    assert.ok(div >= add, `${n}-column ÷ got ${div}s against ${n}-column + at ${add}s`)
  }
})

/**
 * `MAX_COLUMNS` is a literal, so that indexing the tables with it narrows in
 * TypeScript. This is what stops the literal drifting away from the rows it names
 * — read off the tables' own reach rather than restated.
 */
test("MAX_COLUMNS names the last row of both tables, and the clamp is what bounds the guard", () => {
  // The last row the tables have: one more column must produce the same answer.
  const at = (n: number): number =>
    comprehensionSeconds(it(`${"9".repeat(n)} + ${"9".repeat(n)}`, "1"))
  assert.ok(at(MAX_COLUMNS) > at(MAX_COLUMNS - 1), `column ${MAX_COLUMNS} is not a row of its own`)
  assert.equal(at(MAX_COLUMNS + 1), at(MAX_COLUMNS), `column ${MAX_COLUMNS + 1} found a row past the table's last`)
  assert.equal(at(MAX_COLUMNS + 6), at(MAX_COLUMNS), "a very wide prompt escaped the clamp")
  // And the ceiling is that row times the factor, not an independent constant.
  assert.equal(MAX_GUARD_SECONDS, ABANDON_FACTOR * at(MAX_COLUMNS))
})

test("the guard is never under its floor, and never over the table's last row", () => {
  const probes = [
    it("1 + 1", "2"),
    it("", ""),
    it("what is the biggest?", "0"),
    it("factor of 48", "6"),
    it("less than 1000", "412"),
    it("0 − 0", "0"),
  ]
  for (const p of probes) {
    const g = guardSeconds(p)
    assert.ok(g >= MIN_GUARD_SECONDS, `"${p.prompt}" got ${g}s, under the ${MIN_GUARD_SECONDS}s floor`)
    assert.ok(g <= MAX_GUARD_SECONDS, `"${p.prompt}" got ${g}s, over the ${MAX_GUARD_SECONDS}s ceiling`)
  }
})

/**
 * A prompt this cannot read gets the LONGER silence, always.
 *
 * The only direction these classifiers are allowed to be wrong in.
 */
test("an item this cannot parse is treated as the harder one, never the easier", () => {
  const unreadable = [
    it("factor of 48", "6"),
    it("less than 1000", "412"),
    it("Ali has 4 bags of 12 apples. How many apples?", "48"),
    it("2 + 3 + 4", "9"),
    it("x + 17 = 42", "25"),
  ]
  for (const p of unreadable) {
    assert.equal(needsRegrouping(p), true, `"${p.prompt}" was assumed not to need regrouping`)
    // …and it is never cheaper than the plain reading of the same width.
    const width = widestColumn(p)
    const plainOfSameWidth = comprehensionSeconds(it(`${"1".repeat(width)} + ${"1".repeat(width)}`, "2".repeat(width)))
    assert.ok(
      comprehensionSeconds(p) >= plainOfSameWidth,
      `"${p.prompt}" got less time than plain addition of the same width`,
    )
  }
})

test("the operator is read from the glyph, including the typographic minus", () => {
  assert.equal(opOf("7 + 5"), "add")
  assert.equal(opOf("7 - 5"), "sub")
  assert.equal(opOf("7 − 5"), "sub", "the curriculum's own U+2212 minus was not recognised")
  assert.equal(opOf("7 × 5"), "mul")
  assert.equal(opOf("7 ÷ 5"), "div")
  assert.equal(opOf("34801 / 37"), "div", "the founder writes it with a slash")
  assert.equal(opOf("factor of 48"), "other")
})

/**
 * The width is the OPERANDS'. `runner`'s finding, and the reason it matters is the
 * easiest item in the product: counting `7 + 5 = 12`'s two-digit answer put a
 * single-digit fact in the two-column row at 14 s against the table's own 6 s.
 */
test("the width is the operands', and the answer is only a fallback", () => {
  assert.equal(widestColumn(it("7 + 5", "12")), 1, "a single-digit fact was measured by its two-digit answer")
  assert.equal(widestColumn(it("999 + 1", "1000")), 3)
  assert.equal(widestColumn(it("34801 ÷ 37", "941")), 5)
  // Nothing to measure in the prompt, so the answer stands in.
  assert.equal(widestColumn(it("factor of forty-eight", "6")), 1)
  assert.equal(widestColumn(it("how many hundreds?", "1200")), 4)
  assert.equal(comprehensionSeconds(it("7 + 5", "12")), 6, "the single-digit fact is not on the table's own row")
})

/**
 * The paper invitation appears where paper is plausible and nowhere else.
 *
 * The HUD prints `NO TIMER · USE PAPER` above the prompt on these and `RESONANCE`
 * on the rest. Telling a child to fetch a pencil for `7 + 5` is the patronising
 * version of the same idea, so the threshold is the row the cadence table itself
 * marks at a 40-second p90.
 */
test("the paper invitation appears on long work, and never on a fact", () => {
  for (const p of [it("7 + 5", "12"), it("43 + 25", "68"), it("47 + 25", "72"), it("473 + 168", "641")]) {
    assert.equal(invitesPaper(p), false, `"${p.prompt}" told a child to go and get paper`)
  }
  for (const p of [it("5001 − 2798", "2203"), it("34801 ÷ 37", "941"), it("718 × 89", "63902")]) {
    assert.equal(invitesPaper(p), true, `"${p.prompt}" is long work and the child was not told they may use paper`)
  }
})

/**
 * **The decoupling, stated structurally.**
 *
 * `games/runner/src/game/comprehension.ts` asserts its own purity by reading its
 * own source, and it is the right instrument: a test that merely checks two calls
 * agree passes the moment somebody adds an optional `intensity` argument with a
 * default. The invariant is that there is NOTHING IN SCOPE that could tell this
 * module about the run, and the only way to assert that is over the text.
 */
test("nothing about the run is in scope in window.ts — asserted over its source", () => {
  const src = readFileSync(new URL("./window.ts", import.meta.url), "utf8")

  const imports = src.match(/^\s*import\b.*$/gm) ?? []
  assert.deepEqual(
    imports,
    [],
    `window.ts imports something: ${JSON.stringify(imports)}. It must be able to see the item and nothing else.`,
  )

  // Strip the comment block, which legitimately discusses every one of these by
  // name while explaining why none of them may appear in the code.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*\*.*$/gm, "")

  for (const forbidden of [
    "intensity",
    "worldIntensity",
    "rung",
    "ladderPosition",
    "depth",
    "mass",
    "speed",
    "surge",
    "overdrive",
    "success",
    "resonanceCount",
    "elapsed",
    "playTime",
    "performance",
    "Date",
  ]) {
    assert.ok(
      !new RegExp(`\\b${forbidden}\\b`).test(code),
      `window.ts's CODE mentions \`${forbidden}\` — the window must be a function of the item alone`,
    )
  }

  // And the two functions the world calls take exactly one argument.
  assert.equal(guardSeconds.length, 1, "guardSeconds takes more than the item")
  assert.equal(comprehensionSeconds.length, 1, "comprehensionSeconds takes more than the item")
  assert.equal(invitesPaper.length, 1, "invitesPaper takes more than the item")
})
