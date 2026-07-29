// The seam, guarded at the source.
//
// `economy.ts` is pure and `economy.test.ts` plays bots against it, and neither
// of those facts is worth anything if `mount.ts` quietly stops calling it. The
// numbers this batch fixed lived inline in a 2,000-line file precisely *because*
// nothing could see them from a test, and the same thing will happen again the
// first time somebody "just tweaks the feel" in the mount.
//
// So this file reads `mount.ts` as text. That is a blunt instrument and it is
// used deliberately: the alternative is a DOM, a canvas, a pointer-event
// harness and a rendering stack, to assert five call sites. Every assertion
// below names the specific regression it exists to catch.

import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const MOUNT = readFileSync(fileURLToPath(new URL("../mount.ts", import.meta.url)), "utf8")

/** Source with `//` line comments stripped, so prose about a rule is not the rule. */
const CODE = MOUNT.split("\n")
  .map((line) => {
    const at = line.indexOf("//")
    return at === -1 ? line : line.slice(0, at)
  })
  .join("\n")

const count = (needle: string): number => CODE.split(needle).length - 1

test("the answer window comes from the cadence table, not from a constant in the mount", () => {
  // The regression: someone re-inlines `4.2 + (difficulty − 1) × 0.2` because
  // forty seconds of lanterns "feels long". It is long. It is the number the
  // repo measured.
  assert.ok(CODE.includes("moteSecondsFor("), "mount.ts no longer asks economy.ts for the window")
  assert.ok(!CODE.includes("MOTE_SECONDS"), "the old flat window constant is back in mount.ts")
  assert.ok(!/4\.2\s*\+/.test(CODE), "the old window formula is back in mount.ts")
})

test("only a bomb can put a lamp out", () => {
  // The regression: `loseLamp()` creeps back into the wrong-answer branch, and
  // never answering becomes the safe play again.
  // Four occurrences: the declaration, the call from `onBomb`, and the two
  // `lampCost(verdict)` loops — which run zero times, for every verdict, so the
  // lantern path and the timeout path cannot put a lamp out at all.
  assert.equal(count("loseLamp()"), 4, "loseLamp is called from somewhere new")
  assert.equal(count("lampCost(verdict); i++) loseLamp()"), 2, "a lamp is spent without asking lampCost")
  const bomb = CODE.slice(CODE.indexOf("function onBomb"))
  assert.ok(bomb.slice(0, bomb.indexOf("\n  }")).includes("loseLamp()"), "a bomb stopped costing a lamp")
})

test("favour after a verdict is economy.ts's decision, not the mount's", () => {
  // The regression: a timeout goes back to `Math.max(1, favour - 1)` while a
  // wrong answer stays at `favour = 1`, and the timeout is cheap again.
  assert.equal(count("favourAfter(verdict, favour)"), 3, "a favour update bypassed favourAfter")
  assert.ok(!/favour\s*=\s*Math\.min\(FAVOUR_MAX/.test(CODE), "the old inline favour climb is back")
  // Scoped to `expireQuestion`: the slow *drain* elsewhere in the frame loop is
  // a different mechanism and legitimately steps favour down by one.
  const expire = CODE.slice(CODE.indexOf("function expireQuestion"))
  const body = expire.slice(0, expire.indexOf("\n  }"))
  assert.ok(!/favour\s*=\s*Math\.max\(1, favour - 1\)/.test(body), "the old cheap timeout is back")
  assert.ok(body.includes("favourAfter(verdict, favour)"), "a timeout no longer costs what a wrong answer costs")
})

test("a timeout is never reported to the ladder", () => {
  // The regression: `host.report` reappears unguarded in `expireQuestion`, and
  // a child who was still computing is demoted for it.
  assert.equal(count("host.report("), 2, "a new report call appeared in mount.ts")
  assert.equal(count("reportsToCurriculum("), 2, "a report call is no longer guarded")
  const expire = CODE.slice(CODE.indexOf("function expireQuestion"))
  const body = expire.slice(0, expire.indexOf("\n  }"))
  assert.ok(body.includes("reportsToCurriculum"), "expireQuestion reports without asking")
  assert.ok(body.includes('const verdict: Verdict = "timeout"'))
})

test("the market is hushed for exactly as long as a question is live", () => {
  // The regression: `quiet` gets set from something other than "is there a
  // question up", or the settle stops being called, and the hush either never
  // ends or never costs a refusing child anything.
  assert.ok(CODE.includes("director.quiet = liveQ !== null"), "the hush is no longer the question")
  assert.equal(count("director.settleQuestion()"), 2, "a question settles without ending the hush")
})

test("the read-lock is the one economy.ts quotes the window net of", () => {
  // The regression: the lock is bumped to 600ms for feel, the window is not,
  // and the usable window silently drops below the p90 the tests assert.
  assert.ok(CODE.includes("CANDIDATE_READ_LOCK_MS"), "the read-lock is a bare number again")
  assert.ok(!/bornAt \+ 420/.test(CODE))
})
