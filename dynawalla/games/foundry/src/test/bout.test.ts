// The rules of the match, with nothing drawn.
//
// Every case here drives the real `Bout` against a scripted host, so what is
// being asserted is the thing that actually runs on a tablet rather than a
// model of it. No `Math.random` anywhere: the host is a fixed list and the
// bout's own `Rng` is seeded with a literal.

import assert from "node:assert/strict"
import { test } from "node:test"

import type { Host, Question } from "../contract.ts"
import {
  Bout,
  fallsToBeat,
  normalizeDifficulty,
  promptDigits,
  slapPeriodFor,
  SLAP_COUNT,
  type BoutEvent,
} from "../game/bout.ts"

type Report = { questionId: string; correct: boolean; ms: number; answered: string }

type Rig = {
  bout: Bout
  events: BoutEvent[]
  reports: Report[]
  haptics: string[]
  transitions: string[]
}

/** A host that serves a fixed script, so a case is about the rules and nothing else. */
function rig(questions: Question[], options: { transition?: boolean } = {}): Rig {
  const events: BoutEvent[] = []
  const reports: Report[] = []
  const haptics: string[] = []
  const transitions: string[] = []
  let i = 0
  const host: Host = {
    next() {
      const q = questions[Math.min(i, questions.length - 1)] as Question
      i++
      return { ...q, id: `${q.id}#${i}` }
    },
    report(r) {
      reports.push(r)
    },
    haptic(k) {
      haptics.push(k)
    },
    prefersReducedMotion() {
      return false
    },
    ...(options.transition
      ? {
          transition(kind: string, label?: string) {
            transitions.push(`${kind}:${label ?? ""}`)
          },
        }
      : {}),
  }
  const bout = new Bout({ host, seed: 0x51ee7, onEvent: (e) => events.push(e) })
  return { bout, events, reports, haptics, transitions }
}

function q(answer: number, prompt = "10 + 10", distractors: string[] = []): Question {
  return { id: "q", prompt, answer: String(answer), distractors, domain: "add", difficulty: 0 }
}

/**
 * Advance the bout by `seconds` at 60Hz.
 *
 * Never in one big tick: `Bout.tick` clamps a step to a quarter-second on
 * purpose, so a test that handed it a whole four-second window would be testing
 * the clamp rather than the count.
 */
function run(bout: Bout, seconds: number): void {
  const steps = Math.ceil(seconds * 60)
  for (let i = 0; i < steps; i++) bout.tick(seconds / steps)
}

/** Run the lockup out so the fall is live. */
function toPin(bout: Bout): void {
  for (let i = 0; i < 60 && bout.phase !== "pin"; i++) bout.tick(0.05)
  assert.equal(bout.phase, "pin")
}

/** Play the current beat out until the next fall is ready to be taken. */
function toLockup(bout: Bout): void {
  for (let i = 0; i < 200 && bout.phase !== "lockup"; i++) bout.tick(0.05)
}

test("normalizeDifficulty accepts the host's 0..1 and defends against a raw ladder index", () => {
  assert.equal(normalizeDifficulty(0), 0)
  assert.equal(normalizeDifficulty(0.5), 0.5)
  assert.equal(normalizeDifficulty(1), 1)
  assert.equal(normalizeDifficulty(10), 1)
  assert.equal(normalizeDifficulty(5.5), 0.5)
  assert.equal(normalizeDifficulty(-3), 0)
  assert.equal(normalizeDifficulty(Number.NaN), 0)
})

test("promptDigits counts digits and ignores everything else", () => {
  assert.equal(promptDigits("47 + 26"), 4)
  assert.equal(promptDigits("4003 − 87"), 6)
  assert.equal(promptDigits(""), 0)
})

test("the count is a function of the work and of nothing else", () => {
  const short = slapPeriodFor(3, 2, 0)
  const long = slapPeriodFor(6, 6, 0)
  assert.ok(long > short, "a longer sum and a longer escape must buy more count")
  // The canon asked for four seconds. A single-digit sum with a short escape
  // lands there; a four-digit borrow gets nearly twice as much.
  assert.ok(short * SLAP_COUNT > 3.5 && short * SLAP_COUNT < 5.2, `${short * SLAP_COUNT}s`)
  assert.ok(long * SLAP_COUNT > 6.5)
  // The ladder lifts the tempo, but only slightly, and never below the floor.
  assert.ok(slapPeriodFor(5, 4, 1) < slapPeriodFor(5, 4, 0))
  assert.ok(slapPeriodFor(5, 4, 1) > slapPeriodFor(5, 4, 0) * 0.8)
  assert.ok(slapPeriodFor(0, 0, 1) >= 1.05)
})

test("an exact total is an escape, reported correct with the target", () => {
  const r = rig([q(24, "40 − 16")])
  toPin(r.bout)
  const { a, b } = r.bout.fall.plates
  const rep = { x: 0, y: 0 }
  for (let y = 0; y * b <= 24; y++) {
    if ((24 - y * b) % a === 0) {
      rep.y = y
      rep.x = (24 - y * b) / a
      break
    }
  }
  for (let i = 0; i < rep.y; i++) r.bout.tap("b")
  for (let i = 0; i < rep.x; i++) r.bout.tap("a")
  assert.equal(r.bout.phase, "kickout")
  assert.equal(r.reports.length, 1)
  assert.equal(r.reports[0]?.correct, true)
  assert.equal(r.reports[0]?.answered, "24")
  assert.equal(r.bout.beltPlates, 1)
  assert.ok(r.events.some((e) => e.kind === "escape"))
})

test("one over the target loses the fall at once, and reports the overshoot", () => {
  const r = rig([q(20, "12 + 8")])
  toPin(r.bout)
  // Mashing the heavy plate: 7, 14, and then 21 — one over, and the bar comes
  // down. This is the property that makes the game a decomposition rather than
  // a button: the wrestling reflex loses instantly.
  r.bout.fall.plates = { a: 3, b: 7, x: 2, y: 2, taps: 4 }
  r.bout.fall.minTaps = 4
  r.bout.tap("b")
  r.bout.tap("b")
  assert.equal(r.bout.phase, "pin")
  r.bout.tap("b")
  assert.equal(r.bout.phase, "pinfall")
  const pinfall = r.events.find((e) => e.kind === "pinfall")
  assert.ok(pinfall && pinfall.kind === "pinfall" && pinfall.reason === "overshot")
  assert.equal(r.reports.length, 1)
  assert.equal(r.reports[0]?.correct, false)
  assert.equal(r.reports[0]?.answered, "21")
  assert.equal(r.bout.beltPlates, 0, "a lost fall must never take a plate off the belt")
})

test("a dead position ends the fall immediately rather than running the count out", () => {
  // Target 24 with plates 4 and 7 is the canonical dead end: 7+7+7 = 21, and
  // three cannot be made. The bout must say so on the third tap.
  const r = rig([q(24)])
  toPin(r.bout)
  // Force the pair rather than hoping the chooser picked it: this case is about
  // what the rule does, not about what the chooser prefers.
  r.bout.fall.plates = { a: 4, b: 7, x: 6, y: 0, taps: 6 }
  r.bout.fall.minTaps = 6
  // 24 = 4·6 is the *only* escape here, because 7y ≡ 24 (mod 4) forces y to
  // zero. Four fours is fine; one seven is already fatal.
  r.bout.tap("a")
  r.bout.tap("a")
  assert.equal(r.bout.phase, "pin")
  r.bout.tap("b")
  assert.equal(r.bout.phase, "pinfall")
  const pinfall = r.events.find((e) => e.kind === "pinfall")
  assert.ok(pinfall && pinfall.kind === "pinfall" && pinfall.reason === "stuck")
  assert.equal(r.reports[0]?.answered, "15")
})

test("the third slap ends the fall, and only the third", () => {
  const r = rig([q(240, "180 + 60")])
  toPin(r.bout)
  const p = r.bout.fall.slapPeriod
  run(r.bout, p + 0.01)
  assert.equal(r.bout.fall.slaps, 1)
  assert.equal(r.bout.phase, "pin")
  run(r.bout, p)
  assert.equal(r.bout.fall.slaps, 2)
  assert.equal(r.bout.phase, "pin")
  run(r.bout, p)
  assert.equal(r.bout.phase, "pinfall")
  const pinfall = r.events.find((e) => e.kind === "pinfall")
  assert.ok(pinfall && pinfall.kind === "pinfall" && pinfall.reason === "counted-out")
  assert.equal(r.reports[0]?.answered, "", "an untouched bar is not an answer of zero")
})

test("a mal-rule total is waved off — it costs count, never the fall", () => {
  const r = rig([q(24, "40 − 16", ["12", "36"])])
  toPin(r.bout)
  r.bout.fall.plates = { a: 6, b: 12, x: 2, y: 1, taps: 3 }
  r.bout.fall.minTaps = 2
  r.bout.tap("b") // 12 — the smaller-from-larger answer
  assert.equal(r.bout.phase, "pin", "a false finish must never end a fall")
  const wave = r.events.find((e) => e.kind === "false-finish")
  assert.ok(wave && wave.kind === "false-finish" && wave.value === 12)
  assert.ok(r.bout.fall.advance > 0, "the wave-off has to cost count")
  assert.equal(r.reports.length, 0)
  // And it only fires once for the same value.
  const before = r.events.filter((e) => e.kind === "false-finish").length
  r.bout.fall.load = 0
  r.bout.tap("b")
  assert.equal(r.events.filter((e) => e.kind === "false-finish").length, before)
})

test("a wave-off can never itself land the third slap", () => {
  const r = rig([q(24, "40 − 16", ["12"])])
  toPin(r.bout)
  r.bout.fall.plates = { a: 6, b: 12, x: 2, y: 1, taps: 3 }
  const window = r.bout.fall.slapPeriod * SLAP_COUNT
  // Wind the count to a hair before the end, then spring the trap.
  r.bout.fall.elapsed = window - 0.05
  r.bout.tap("b")
  assert.equal(r.bout.phase, "pin")
  assert.ok(r.bout.fall.elapsed + r.bout.fall.advance < window)
})

test("recovering from a wave-off is what earns the biggest reaction", () => {
  const r = rig([q(24, "40 − 16", ["12"])])
  toPin(r.bout)
  r.bout.fall.plates = { a: 6, b: 12, x: 2, y: 1, taps: 3 }
  r.bout.tap("b") // 12, waved off
  r.bout.tap("a") // 18
  r.bout.tap("a") // 24 — out
  const escape = r.events.find((e) => e.kind === "escape")
  assert.ok(escape && escape.kind === "escape")
  assert.equal(escape.repaired, true)
  assert.ok(escape.tier >= 2, "a repair is a tier-2 event by design")
})

test("exactly one report per served item, ever", () => {
  const r = rig([q(20, "12 + 8")])
  toPin(r.bout)
  r.bout.fall.plates = { a: 5, b: 10, x: 2, y: 1, taps: 3 }
  r.bout.tap("b")
  r.bout.tap("b")
  assert.equal(r.bout.phase, "kickout")
  assert.equal(r.reports.length, 1)
  // Taps during the celebration must not load, spend or report anything.
  r.bout.tap("a")
  r.bout.tap("b")
  assert.equal(r.reports.length, 1)
  assert.equal(r.bout.fall.load, 20)
})

test("a question the pool could not serve is playable and is never reported", () => {
  const r = rig([{ ...q(0, ""), id: "" }])
  toPin(r.bout)
  assert.equal(r.bout.fall.questionId, "")
  assert.ok(r.bout.fall.target >= 1, "an unservable item must still cut a playable fall")
  run(r.bout, r.bout.fall.slapPeriod * SLAP_COUNT + 0.05)
  assert.equal(r.bout.phase, "pinfall")
  assert.equal(r.reports.length, 0)
})

test("the belt only ever grows, across escapes and pinfalls alike", () => {
  const r = rig([q(20, "12 + 8")])
  let seen = 0
  for (let round = 0; round < 12; round++) {
    toPin(r.bout)
    r.bout.fall.plates = { a: 5, b: 10, x: 2, y: 1, taps: 3 }
    if (round % 3 === 0) {
      // Lose it on the count.
      run(r.bout, r.bout.fall.slapPeriod * SLAP_COUNT + 0.05)
    } else {
      r.bout.tap("b")
      r.bout.tap("b")
    }
    assert.ok(r.bout.beltPlates >= seen, "the belt regressed")
    seen = r.bout.beltPlates
    toLockup(r.bout)
  }
  assert.ok(seen >= 8)
})

test("a stopping point is offered only after a challenger is beaten", () => {
  const r = rig([q(20, "12 + 8")], { transition: true })
  const needed = fallsToBeat(0)
  for (let i = 0; i < needed; i++) {
    toPin(r.bout)
    r.bout.fall.plates = { a: 5, b: 10, x: 2, y: 1, taps: 3 }
    r.bout.tap("b")
    r.bout.tap("b")
    toLockup(r.bout)
  }
  assert.equal(r.transitions.length, 1)
  assert.ok(r.transitions[0]?.startsWith("level:"))
  assert.equal(r.bout.challengersBeaten, 1)
})

test("no stopping point is ever offered after a lost fall", () => {
  const r = rig([q(20, "12 + 8")], { transition: true })
  for (let round = 0; round < 10; round++) {
    toPin(r.bout)
    run(r.bout, r.bout.fall.slapPeriod * SLAP_COUNT + 0.05)
    toLockup(r.bout)
  }
  assert.equal(r.transitions.length, 0)
})

test("losing three falls hands the bout over without touching the belt", () => {
  const r = rig([q(20, "12 + 8")])
  toPin(r.bout)
  r.bout.fall.plates = { a: 5, b: 10, x: 2, y: 1, taps: 3 }
  r.bout.tap("b")
  r.bout.tap("b")
  const platesAfterEscape = r.bout.beltPlates
  const firstChallenger = r.bout.challenger
  for (let round = 0; round < SLAP_COUNT; round++) {
    toLockup(r.bout)
    toPin(r.bout)
    run(r.bout, r.bout.fall.slapPeriod * SLAP_COUNT + 0.05)
  }
  assert.notEqual(r.bout.challenger, firstChallenger)
  assert.equal(r.bout.beltPlates, platesAfterEscape)
  assert.equal(r.bout.lost, 0)
})

test("the crowd never touches a rule: heat moves, the count does not", () => {
  const r = rig([q(20, "12 + 8")])
  toPin(r.bout)
  const period = r.bout.fall.slapPeriod
  r.bout.fall.plates = { a: 5, b: 10, x: 2, y: 1, taps: 3 }
  const before = r.bout.heat
  r.bout.tap("b")
  r.bout.tap("b")
  assert.ok(r.bout.heat > before)
  toLockup(r.bout)
  toPin(r.bout)
  assert.equal(r.bout.fall.slapPeriod, period, "heat must not change the clock")
})

test("a tap during the lockup skips the takedown and is never spent", () => {
  const r = rig([q(20, "12 + 8")])
  assert.equal(r.bout.phase, "lockup")
  r.bout.tap("a")
  assert.equal(r.bout.fall.load, 0)
  r.bout.tick(0.001)
  assert.equal(r.bout.phase, "pin")
})

test("haptics fire on every slap and on the escape", () => {
  const r = rig([q(20, "12 + 8")])
  toPin(r.bout)
  r.bout.fall.plates = { a: 5, b: 10, x: 2, y: 1, taps: 3 }
  run(r.bout, r.bout.fall.slapPeriod + 0.02)
  assert.ok(r.haptics.includes("medium"))
  r.bout.tap("b")
  r.bout.tap("b")
  assert.ok(r.haptics.includes("success"))
})

test("fallsToBeat grows with wins and then levels off", () => {
  assert.equal(fallsToBeat(0), 4)
  assert.ok(fallsToBeat(3) > fallsToBeat(0))
  assert.equal(fallsToBeat(9), fallsToBeat(4))
})

test("losing a bout never raises the price of the next one", () => {
  const r = rig([q(20, "12 + 8")])
  const before = r.bout.toBeat
  // Drop three straight falls: a new challenger walks out.
  for (let round = 0; round < SLAP_COUNT; round++) {
    toPin(r.bout)
    run(r.bout, r.bout.fall.slapPeriod * SLAP_COUNT + 0.05)
    toLockup(r.bout)
  }
  assert.equal(r.bout.challengersBeaten, 0)
  assert.equal(r.bout.toBeat, before, "the demand escalated on a defeat")
})

test("an over-the-target mal-rule total is named rather than merely refused", () => {
  // Every mal-rule this domain has for a *difference* comes out larger than the
  // difference, so the over-the-target case is the only diagnosis a subtraction
  // fall can ever produce. 52 − 27 is 25; 35 is smaller-from-larger.
  const named = rig([q(25, "52 − 27", ["35", "79"])])
  toPin(named.bout)
  named.bout.fall.plates = { a: 5, b: 30, x: 5, y: 0, taps: 5 }
  named.bout.tap("a") // 5
  assert.equal(named.bout.phase, "pin")
  named.bout.tap("b") // 35 — over, and it is a value with a name
  assert.equal(named.bout.phase, "pinfall")
  const hit = named.events.filter((e) => e.kind === "pinfall")
  assert.equal(hit.length, 1)
  assert.ok(hit[0]?.kind === "pinfall" && hit[0].reason === "overshot" && hit[0].diagnosed)
  assert.equal(named.reports[0]?.answered, "35", "the diagnosis is what gets reported")

  // And an overshoot onto a value nobody produces is not dressed up as one.
  const plain = rig([q(25, "52 − 27", ["35", "79"])])
  toPin(plain.bout)
  plain.bout.fall.plates = { a: 5, b: 10, x: 1, y: 2, taps: 3 }
  plain.bout.tap("b") // 10
  plain.bout.tap("b") // 20
  plain.bout.tap("b") // 30 — over, unnamed
  const miss = plain.events.find((e) => e.kind === "pinfall")
  assert.ok(miss && miss.kind === "pinfall" && miss.diagnosed === false)
  assert.equal(plain.reports[0]?.answered, "30")
})
