// THE MANUAL HAS TO SPEAK THE GAME'S OWN LANGUAGE.
//
// The report:
//
//   "The instructions need to define the terms sometimes. I don't know what 'the
//    fall' is on the grapple foundry for example."
//
// It was right. The manual said "One over the answer and the fall is lost" and
// never once said what a fall was. A `fall`, a `pin`, a `kick out`, the `count`,
// being `waved off` and the `belt` are all things this game made up, and a child
// who does not know them cannot use any of the rules that mention them.
//
// These assertions are deliberately shallow — prose cannot be unit-tested — but
// they are not vacuous. Each one fails if a definition is deleted, and the last
// one fails if a new banner is added to `mount.ts` without a line in the manual
// saying what a child is looking at.

import assert from "node:assert/strict"
import { test } from "node:test"

import { BANNER_WORDS, INVENTED_TERMS, SECTIONS, SUMMARY, TITLE } from "../manual.ts"

const ALL = [...SUMMARY, ...SECTIONS.flatMap((s) => [s.heading, ...s.lines])]
const TEXT = ALL.join("\n")
const LOWER = TEXT.toLowerCase()

test("the game has a title and something to say before the first tap", () => {
  assert.equal(TITLE, "THE GRAPPLE FOUNDRY")
  assert.ok(SUMMARY.length >= 2, "the splash is too short to make the first move from")
  assert.ok(SECTIONS.length >= 6, "the manual lost a section")
})

test("every term this game invented is used somewhere in the manual", () => {
  for (const term of INVENTED_TERMS) {
    assert.ok(LOWER.includes(term), `the manual never mentions "${term}"`)
  }
})

test("the terms a child cannot guess are defined where they are first used", () => {
  // A definition here means: the line that introduces the word also says what the
  // word means. Checked by requiring the introducing phrase, because that is the
  // thing that was missing — the words themselves were all present before.
  const definitions: Array<[string, RegExp]> = [
    ["pin", /being held down like this is called a pin/i],
    ["fall", /that one try is called a fall/i],
    ["kick out", /getting free like that is called a kick out/i],
    ["bar", /the bar is the iron rod lying across your chest/i],
    ["pedals", /the two pedals are the big squares at the bottom/i],
    ["board", /that is the sign hanging above the ring/i],
    ["count", /those three slaps are called the count/i],
    ["referee", /the referee is the person kneeling beside you/i],
    ["waved off", /that is called being waved off/i],
    ["belt", /that strip is your belt/i],
  ]
  for (const [term, pattern] of definitions) {
    assert.match(TEXT, pattern, `"${term}" is used but never explained`)
  }
})

test("a term is explained no later than the line that first uses it", () => {
  // Order matters more than presence. "It costs you count" three sections above
  // "Those three slaps are called the count" is the same bug with the fix filed
  // in the wrong place, and a child does not scroll back.
  const firstUse = (needle: RegExp | string): number =>
    ALL.findIndex((line) =>
      typeof needle === "string" ? line.toLowerCase().includes(needle) : needle.test(line),
    )

  const pairs: Array<[string, string, RegExp]> = [
    ["pin", "pin", /called a pin/i],
    ["fall", "fall", /called a fall/i],
    ["kick out", "kick out", /called a kick out/i],
    ["count", "count", /called the count/i],
    ["belt", "belt", /your belt/i],
    ["waved off", "waved off", /called being waved off/i],
  ]
  for (const [term, use, definition] of pairs) {
    const used = firstUse(use)
    const defined = firstUse(definition)
    assert.ok(used >= 0, `"${term}" is not in the manual at all`)
    assert.ok(defined >= 0, `"${term}" is never defined`)
    assert.ok(
      defined <= used,
      `"${term}" is first used on line ${used} and only explained on line ${defined}`,
    )
  }
})

test("every word the game shouts at a child is explained in the manual", () => {
  // These are drawn on a banner half the ring wide, at the moment a fall ends. A
  // child reading THREE with no idea what it refers to has been told off in a
  // language nobody taught them.
  for (const word of BANNER_WORDS) {
    assert.ok(TEXT.includes(word), `the game prints "${word}" and the manual never mentions it`)
  }
})

test("the manual is written in short sentences and never says how well you are doing", () => {
  // The house rule for this age: short lines, and nothing that characterises the
  // child. "You are doing great" and "you keep getting this wrong" are both out.
  for (const line of ALL) {
    const sentences = line.split(/(?<=[.!?])\s+/).filter(Boolean)
    for (const s of sentences) {
      const words = s.trim().split(/\s+/).length
      assert.ok(words <= 26, `too long for a seven-year-old (${words} words): ${JSON.stringify(s)}`)
    }
  }
  for (const banned of ["stupid", "silly", "easy", "just ", "obviously", "simply", "of course"]) {
    assert.equal(
      LOWER.includes(banned),
      false,
      `the manual says ${JSON.stringify(banned)} — that is a judgement, not an instruction`,
    )
  }
})
