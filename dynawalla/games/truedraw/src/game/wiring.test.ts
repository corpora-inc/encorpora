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
const STATEMENT = strip(read("./statement.ts"))
const DEALER = strip(read("./dealer.ts"))

const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1

test("A LAPSE GOES TO host.skip AND NEVER TO host.report", () => {
  // The regression this exists for is not hypothetical: this pack was one of the six
  // named in the SDK as having reported timeouts as `{ correct: false, answered: "" }`,
  // which is filed as a MISS and steps the ladder DOWN for a child who was still
  // thinking. There is exactly one `report` and exactly one `skip`, and the `skip` is
  // in the else of the guard.
  assert.equal(count(MOUNT, "host.report("), 1, "a new report call appeared in mount.ts")
  assert.equal(count(MOUNT, "host.skip?.("), 1, "the skip call is gone or duplicated")
  assert.ok(MOUNT.includes("reportsToCurriculum(event.outcome)"), "the report is unguarded again")
  const settled = MOUNT.slice(MOUNT.indexOf('case "settled"'))
  const guard = settled.indexOf("reportsToCurriculum(")
  const report = settled.indexOf("host.report(")
  const skip = settled.indexOf("host.skip?.(")
  assert.ok(guard !== -1 && guard < report, "the report is no longer behind the guard")
  assert.ok(report < skip, "the skip is not in the else branch of the guard")
  // And nothing reports an empty string on purpose, which is the shape of the bug.
  assert.ok(
    !/answered:\s*""/.test(MOUNT),
    "mount.ts reports a literal empty answer, which the host files as a miss",
  )
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

test("a lapse reaches skip and never reaches report, end to end", () => {
  const reports: string[] = []
  const skips: string[] = []
  const host = createStubHost({
    seed: 5,
    onReport: (r) => reports.push(`${r.questionId}:${String(r.correct)}:${r.answered}`),
    onSkip: (id) => skips.push(id),
  })
  // The harness drives the round machine, and the mount's reporting is the thing under
  // test — so the reporting rule is applied here exactly as `mount.ts` applies it.
  const result = playRun(host, 6, alwaysWait, { limit: 20 })
  for (const event of result.events) {
    if (event.kind !== "settled") continue
    if (event.outcome === "lapse") skips.push(event.statement.questionId)
    else reports.push(event.statement.questionId)
  }
  assert.ok(skips.length > 15, `only ${String(skips.length)} lapses in twenty rounds`)
  assert.equal(reports.length, 0, `a lapse was reported: ${reports.join(",")}`)
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
