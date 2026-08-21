// The seams, guarded at the source.
//
// `cadence.ts`, `ladder.ts`, `gesture.ts` and `reportsToCurriculum` are pure and
// heavily tested, and none of that is worth anything if `mount.ts` stops calling them.
// This file reads the mount as text — a blunt instrument, used deliberately: the
// alternative is a DOM, a canvas and a rAF harness to assert a handful of call sites.
// Every assertion below names the regression it exists to catch.

import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { createStubHost } from "../stub/host.ts"
import { alwaysWait, perfect, playRun } from "../test/harness.ts"
import { reportSettled } from "./report.ts"

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8")

/** Source with every comment stripped, so prose *about* a rule is not the rule. */
const strip = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//")
      return at === -1 ? line : line.slice(0, at)
    })
    .join("\n")

const MOUNT = strip(read("../mount.ts"))
const REPORT = strip(read("./report.ts"))
const STATEMENT = strip(read("./statement.ts"))
const DEALER = strip(read("./dealer.ts"))

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1

test("there is exactly ONE place a settled round crosses the wire", () => {
  // The behaviour is proved against a host further down. What this guards is that a
  // SECOND path does not appear later — a "quick" report added inline in the mount
  // would bypass the branch entirely and nothing about it would look wrong.
  assert.equal(count(MOUNT, "host.report("), 0, "mount.ts reports directly again")
  assert.equal(count(MOUNT, "host.skip"), 0, "mount.ts skips directly again")
  assert.equal(count(MOUNT, "reportSettled(host, event)"), 1, "the one seam is gone or doubled")
  assert.equal(count(REPORT, "host.report("), 1, "report.ts grew a second report call")
  assert.equal(count(REPORT, "host.skip?.("), 1, "report.ts grew a second skip call")
  assert.ok(REPORT.includes("reportsToCurriculum(event.outcome)"), "the report is unguarded")
  // And nothing reports a literal empty answer on purpose, which is the shape of the
  // bug: the SDK files the empty string as a MISS, not as "unanswered".
  assert.ok(!/answered:\s*""/.test(REPORT + MOUNT), "a literal empty answer is being reported")
})

test("THE POINTER LATCH HAS A GUARANTEED RELEASE, and pointerup is not one", () => {
  // The regression, and it is the worst one this rework could ship. The mount latches
  // one pointer id so a second finger cannot be a second verdict. `game-chrome`'s
  // manual installs its pointer swallower as a CAPTURE-phase listener on `globalThis`
  // and stops every event not aimed at its own nodes while it is open — so a finger
  // resting on the glass when a child taps how-to-play never delivers its `pointerup`
  // to this canvas. Without another way out, the latch is held forever and the game
  // goes permanently deaf to touch.
  assert.ok(MOUNT.includes("const releasePointer ="), "the single release path is gone")
  assert.ok(
    MOUNT.includes('canvas.addEventListener("lostpointercapture"'),
    "a lost capture no longer clears the latch",
  )
  const tick = MOUNT.slice(MOUNT.indexOf("const tick ="), MOUNT.indexOf("const liveDrag ="))
  assert.ok(
    /guide\.isOpen[\s\S]{0,200}releasePointer\(\)/.test(tick),
    "the frame loop no longer releases the latch while the manual is open",
  )
  const pause = MOUNT.slice(MOUNT.indexOf("pause(): void {"))
  assert.ok(pause.includes("releasePointer()"), "pause no longer clears the latch")
  // And the manual is checked before a touch is accepted at all.
  const downFn = MOUNT.slice(MOUNT.indexOf("const down ="), MOUNT.indexOf("const move ="))
  assert.ok(downFn.includes("guide.isOpen"), "a touch behind the sheet is accepted as a gesture")
})

test("the window comes from the cadence table, with nothing clamping it", () => {
  // The regression: the ceiling comes back — 3600, or any other number — because
  // fourteen seconds "feels slow". It is the number the repo measured. #657.
  assert.ok(STATEMENT.includes("comprehensionMsFor(text)"), "windowFor stopped asking cadence.ts")
  assert.ok(!/1300\s*\+\s*215/.test(STATEMENT), "the old linear window is back")
  assert.ok(!/Math\.min\(3600/.test(STATEMENT), "the old upper clamp is back")
  const fn = STATEMENT.slice(STATEMENT.indexOf("export function windowFor"))
  const body = fn.slice(0, fn.indexOf("\n}"))
  assert.ok(!body.includes("Math.min"), "something is capping the comprehension window again")
  assert.ok(!body.includes("Math.max"), "something is flooring the comprehension window again")
})

test("THE GAME ASKS FOR A DIFFICULTY on every deal", () => {
  // The regression is the state this pack shipped in: `host.next()` with no argument,
  // forever, so nothing about the stream was adaptive and "it stays on way too easy way
  // too long" was true by construction.
  assert.ok(
    /host\.next\(\{\s*difficulty:/.test(DEALER),
    "dealer.ts is back to calling host.next() with no request",
  )
  assert.equal(count(DEALER, "this.host.next("), 1, "there is more than one way to deal a question")
  assert.ok(DEALER.includes("this.ladder.settle("), "the ladder is no longer moved by an outcome")
})

test("the ladder is moved by every settled outcome, from the one place", () => {
  assert.ok(MOUNT.includes("dealer.settle(event.outcome, event.quickness)"), "the ladder is unwired")
  assert.equal(count(MOUNT, "dealer.settle("), 1)
})

test("the verdict fires on the move, not on the release", () => {
  // The regression: somebody "tidies" the recogniser so a swipe commits at
  // `pointerup`. It would still work and it would feel dead, and the reported latency
  // would include however long the finger loitered after crossing.
  const moveFn = MOUNT.slice(MOUNT.indexOf("const move ="), MOUNT.indexOf("const up ="))
  assert.ok(moveFn.includes("round.verdict(call)"), "the verdict left the move handler")
  const upFn = MOUNT.slice(MOUNT.indexOf("const up ="), MOUNT.indexOf("const cancel ="))
  assert.ok(!upFn.includes("round.verdict("), "a verdict is now being fired on release")
  assert.ok(upFn.includes("round.tap()"), "a tap no longer starts a run")
})

test("a tap is never a verdict, anywhere in the mount", () => {
  // The one thing that would silently put the game back where it started: a child who
  // taps would be voting "keep" without knowing they had voted.
  assert.ok(!/tap\(\)[^\n]*verdict/.test(MOUNT))
  const keys = MOUNT.slice(MOUNT.indexOf("const key ="))
  assert.ok(keys.includes('"ArrowDown"'), "the keyboard cannot keep")
  assert.ok(keys.includes('"ArrowUp"'), "the keyboard cannot toss")
})

// ---------------------------------------------------------------------------
// And the same two claims played rather than read, through the stub host.
// ---------------------------------------------------------------------------

/**
 * Every settled event of a run, routed through the REAL `reportSettled` into a real
 * stub host — which is the whole reason that branch lives in `report.ts` and not
 * inside `mount.ts`.
 *
 * The previous version of this test built the same two arrays and then filled them
 * from its own `if (event.outcome === "lapse")`, because a harness that drives
 * `Round` never touches a `Host`. It therefore asserted its own `if` and passed with
 * the entire routing block deleted from the mount. It was vacuous.
 */
function routeRun(
  seed: number,
  decide: Parameters<typeof playRun>[2],
  options: Parameters<typeof playRun>[3] = {},
): { reports: string[]; skips: string[]; outcomes: readonly string[] } {
  const reports: string[] = []
  const skips: string[] = []
  const host = createStubHost({
    seed,
    onReport: (r) => reports.push(`${r.questionId}|${String(r.correct)}|${r.answered}`),
    onSkip: (id) => skips.push(id),
  })
  const result = playRun(host, seed + 1, decide, options)
  for (const event of result.events) {
    if (event.kind === "settled") reportSettled(host, event)
  }
  return { reports, skips, outcomes: result.outcomes }
}

test("A LAPSE REACHES skip AND NEVER REACHES report — through the real host seam", () => {
  const { reports, skips, outcomes } = routeRun(5, alwaysWait, { limit: 20 })
  assert.ok(outcomes.every((o) => o === "lapse"))
  assert.ok(skips.length > 15, `only ${String(skips.length)} lapses reached items.skip`)
  assert.equal(reports.length, 0, `a lapse was reported: ${reports.join(", ")}`)
})

test("and every performed verdict reaches report, with the value the child asserted", () => {
  // The counterweight: the test above would also pass if `reportSettled` did nothing
  // at all.
  const { reports, skips } = routeRun(15, perfect, { limit: 20, thinkMs: () => 200 })
  assert.ok(reports.length > 15, `only ${String(reports.length)} verdicts reached items.answer`)
  assert.equal(skips.length, 0, `a performed verdict was skipped: ${skips.join(", ")}`)
  // Every one of them is judged correct and carries a parseable numeral — never the
  // empty string, which is the shape of the bug this whole seam exists for.
  for (const line of reports) {
    const [, correct, answered] = line.split("|")
    assert.equal(correct, "true", line)
    assert.ok(answered !== undefined && answered.length > 0 && /^\d+$/.test(answered), line)
  }
})

test("a wrong keep reaches report as a miss carrying the mal-rule value", () => {
  // The format's best property, through the seam: the host records the miss AND names
  // the misconception the child just demonstrated.
  const { reports } = routeRun(25, () => "keep", { limit: 20, thinkMs: () => 200 })
  const misses = reports.filter((line) => line.split("|")[1] === "false")
  assert.ok(misses.length > 0, "a keep-everything bot produced no misses")
  for (const line of misses) {
    const answered = line.split("|")[2]
    assert.ok(answered !== undefined && /^\d+$/.test(answered), `no mal-rule value on ${line}`)
  }
})

test("a wrong toss reaches report as a miss with no misconception invented for it", () => {
  // "I do not believe 47 + 25 = 72" is not a broken procedure with an output, so
  // nothing is named. It is still a miss and it is still sent — which is exactly what
  // the second gesture bought.
  const { reports } = routeRun(35, () => "toss", { limit: 20, thinkMs: () => 200 })
  const misses = reports.filter((line) => line.split("|")[1] === "false")
  assert.ok(misses.length > 0, "a toss-everything bot produced no misses")
  for (const line of misses) {
    assert.equal(line.split("|")[2], "", `a mal-rule was invented for a burn: ${line}`)
  }
})

test("a fast correct player drags the request up the ladder, question by question", () => {
  // The end-to-end version of the founder's complaint. A stub with no `level` follows
  // whatever the game asks for, so this is the whole loop: deal, settle, ask higher.
  const asked: number[] = []
  const host = createStubHost({ seed: 21, onNext: (d) => asked.push(d) })
  playRun(host, 22, perfect, { limit: 30, thinkMs: () => 150 })
  assert.ok(asked.length > 25, `only ${String(asked.length)} deals`)
  const first = asked[0] ?? -1
  const last = asked.at(-1) ?? -1
  assert.ok(first < 0.3, `the first request was already ${first.toFixed(3)}`)
  assert.ok(last > 0.9, `after thirty fast correct calls the game asked for ${last.toFixed(3)}`)
  assert.ok(asked.every((d) => d >= 0 && d < 1), "a request left the legal 0..1 range")
  // Ten fast calls in, and it has already moved a long way. This is the number the
  // founder asked for.
  assert.ok(
    (asked[10] ?? 0) > 0.85,
    `after ten fast correct calls the game was still asking for ${(asked[10] ?? 0).toFixed(3)}`,
  )
})

test("a wrong verdict drags it back down within a question or two", () => {
  const asked: number[] = []
  const host = createStubHost({ seed: 23, onNext: (d) => asked.push(d) })
  // Right eight times fast, then wrong three times.
  let n = 0
  playRun(host, 24, (s) => (n++ < 8 ? (s.truth ? "keep" : "toss") : s.truth ? "toss" : "keep"), {
    limit: 20,
    thinkMs: () => 150,
  })
  const peak = Math.max(...asked)
  const end = asked.at(-1) ?? 1
  assert.ok(end < peak, `the request never came back down from ${peak.toFixed(3)}`)
})
