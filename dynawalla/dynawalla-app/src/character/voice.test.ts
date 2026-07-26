// The Dynawalla is a register, and a register is testable: how often he speaks,
// whether he repeats himself, and what he is structurally incapable of saying.
//
// The last one is the important one. `M-16` forbids any learner-facing string
// from naming a misconception or a defect, and MISSION forbids the flat praise
// pool ("Perfect / Nice / Brilliant") that the in-repo precedent resolves to.
// Both are asserted over the whole corpus rather than over the lines a test
// happened to trigger, so adding a thirteenth fragment cannot slip past them.

import { test } from "node:test"
import assert from "node:assert/strict"

import { strings } from "../app/strings.ts"
import {
  consider,
  corpus,
  QUIET_CARDS,
  SILENT,
  UTTERANCE_BUDGET,
  type Observation,
  type VoiceState,
} from "./voice.ts"

const CLOSED: Observation = { kind: "closed", apertures: 20 }
const REPAIRED: Observation = { kind: "repaired", apertures: null }

/** Speak as often as he is willing to, offered something on every card. */
function session(offers: readonly Observation[]): string[] {
  let state: VoiceState = SILENT
  const heard: string[] = []
  offers.forEach((observation, card) => {
    const { state: next, utterance } = consider(state, observation, card, (card * 0.37) % 1)
    state = next
    if (utterance !== null) heard.push(utterance.line)
  })
  return heard
}

test("he speaks three to five times in a session, and no more", () => {
  const offers = Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? CLOSED : REPAIRED))
  const heard = session(offers)
  assert.ok(heard.length >= 3 && heard.length <= 5, `he spoke ${String(heard.length)} times`)
  assert.equal(heard.length, UTTERANCE_BUDGET)
})

test("he never repeats himself within a session", () => {
  const offers = Array.from({ length: 200 }, () => CLOSED)
  const heard = session(offers)
  assert.equal(new Set(heard).size, heard.length)
})

test("silence is the default: an ordinary card gets nothing", () => {
  // Nothing is offered on an ordinary card at all — `respond` returns a null
  // observation — and offering him one anyway on the card right after he spoke
  // still gets silence.
  const first = consider(SILENT, CLOSED, 10, 0.1)
  assert.notEqual(first.utterance, null)
  for (let gap = 1; gap < QUIET_CARDS; gap++) {
    assert.equal(consider(first.state, REPAIRED, 10 + gap, 0.1).utterance, null)
  }
  assert.notEqual(consider(first.state, REPAIRED, 10 + QUIET_CARDS, 0.1).utterance, null)
})

test("a silent consideration spends nothing", () => {
  const spent = consider(SILENT, CLOSED, 0, 0.1).state
  const quiet = consider(spent, REPAIRED, 1, 0.1)
  assert.equal(quiet.utterance, null)
  assert.deepEqual(quiet.state, spent, "a refusal changed the state")
})

test("the slot is filled, never left standing", () => {
  const heard = session(Array.from({ length: 40 }, () => ({ kind: "closed", apertures: 20 }) as const))
  for (const line of heard) assert.equal(/\{\{/.test(line), false, line)
})

test("M-16: no line names a misconception, a mistake or the child's defect", () => {
  const banned =
    /\b(wrong|mistake|error|incorrect|bug|misconception|failed?|bad|silly|oops|careless)\b/i
  for (const line of corpus()) assert.equal(banned.test(line), false, line)
})

test("no line is flat praise — every one says something that happened", () => {
  const cheerleader =
    /\b(great|good job|well done|awesome|amazing|perfect|nice|brilliant|excellent|super|fantastic|keep it up)\b/i
  for (const line of corpus()) assert.equal(cheerleader.test(line), false, line)
  // Nor an exclamation anywhere: the register is dry, and an exclamation mark
  // is the single fastest way out of it.
  for (const line of corpus()) assert.equal(line.includes("!"), false, line)
})

test("he does not address the child as a subject", () => {
  // "You saw that" is about what happened. "You are clever" is a verdict on a
  // person, and this product does not issue those.
  for (const line of corpus()) {
    assert.equal(/\byou are\b|\byou're\b|\byour \w+ is\b/i.test(line), false, line)
  }
})

test("PR-2.11's slice: twelve fragments over three observation types", () => {
  assert.equal(Object.keys(strings.dynawalla).length, 3)
  assert.equal(corpus().length, 12)
  assert.equal(new Set(corpus()).size, 12, "two fragments are the same line")
})

test("the lines fit the three lines the band reserves at 320 px", () => {
  // The band is a **fixed** height and the character may not change it, so the
  // constraint runs the other way: the fragments have to fit the room.
  //
  // Measured, not guessed. At 320 px — the narrowest width this app ships to —
  // the text column is 160 px, and the longest fragment
  // ("What you borrowed, you spent. It did not stay behind.", 53 characters)
  // renders as exactly three lines in the inscription face at `text-xs`. The
  // bound below leaves a little room and no more; a fragment past it clips
  // rather than growing the band, which is the correct failure but is still a
  // failure. This is also the rule for the five locales at PR-1.6: translate to
  // fit, do not lengthen the band.
  for (const line of corpus()) {
    const rendered = line.replace("{{apertures}}", "180")
    assert.ok(rendered.length <= 58, `${String(rendered.length)} chars: ${rendered}`)
  }
})
