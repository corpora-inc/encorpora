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
  // The regression: the mount starts deciding for itself what a verdict costs.
  // Which cost it picks is `economy.ts`'s business and `economy.test.ts` plays
  // bots against it; what this file holds is that the mount still asks.
  assert.equal(count("favourAfter(verdict, favour)"), 3, "a favour update bypassed favourAfter")
  assert.ok(!/favour\s*=\s*Math\.min\(FAVOUR_MAX/.test(CODE), "the old inline favour climb is back")
  const expire = CODE.slice(CODE.indexOf("function expireQuestion"))
  const body = expire.slice(0, expire.indexOf("\n  }"))
  assert.ok(!/favour\s*=\s*Math\.max\(1, favour - 1\)/.test(body), "a timeout sets favour behind economy.ts's back")
  assert.ok(!/favour\s*=\s*1/.test(body), "a timeout sets favour behind economy.ts's back")
  assert.ok(body.includes("favourAfter(verdict, favour)"), "a timeout no longer asks what it costs")
  // **A timeout must not zero the favour timer either.** `favourLeft = 0` parks
  // the multiplier where it stands rather than letting it decay on its own clock,
  // and it was how the mount took back what `favourAfter` had just left alone.
  assert.ok(
    !/favourLeft\s*=\s*0/.test(body),
    "expireQuestion stops the favour clock — being slow is charged again",
  )
})

test("a wrong lantern is completed, not scolded", () => {
  // The regression: the four channels BEAM deleted creep back into the wrong-answer
  // branch — a red screen flash, a damage vignette, a `failure` haptic and a red
  // burst. A wrong lantern costs the whole favour economy, which is the reason a
  // guess is not free; it may not also tell a child off.
  const at = CODE.indexOf("function onMoteCut")
  const fn = CODE.slice(at, CODE.indexOf("\n  function ", at + 10))
  const branch = fn.slice(fn.lastIndexOf("} else {"))
  assert.ok(branch.length > 200, "the wrong-answer branch of onMoteCut moved — this scan is stale")
  assert.ok(!branch.includes("requestFlash"), "the red screen flash on a wrong answer is back")
  assert.ok(!/vignette\s*=\s*1/.test(branch), "the damage vignette on a wrong answer is back")
  assert.ok(!branch.includes('haptic("failure")'), "the failure haptic on a wrong answer is back")
  assert.ok(!/burst\([^)]*WRONG/.test(branch), "the red burst on a wrong answer is back")
  assert.ok(branch.includes("showReveal("), "a wrong lantern stopped completing the sum")
  // The vignette is damage, and damage is a bomb. Exactly one place may raise it.
  assert.equal(count("vignette = 1"), 1, "something other than a bomb is drawing damage")
})

test("the completed sum is held, dismissed and cleared by the three things that may", () => {
  // The regression: the reveal goes back to a `showBanner` with a hard-coded
  // length, or the dismissal is dropped and a fast player is held again, or the
  // clear-on-new-question goes and a child reads an old answer across a live sum.
  assert.ok(
    CODE.includes("revealDwellSeconds(revealIntensity(carried))"),
    "the dwell is a constant in the mount again",
  )
  // …and it is the favour the child was CARRYING, not the one the wrong lantern
  // left them with: `favourAfter` sets it to one, so a reveal read after that
  // would be the patient version for everybody, at every rung, for ever.
  const cut = CODE.slice(CODE.indexOf("function onMoteCut"))
  const wrongBranch = cut.slice(0, cut.indexOf("\n  }"))
  const branch = wrongBranch.slice(wrongBranch.lastIndexOf("} else {"))
  assert.ok(
    branch.indexOf("const carried = favour") < branch.indexOf("favour = favourAfter"),
    "the reveal now reads the favour the wrong answer left, which is always one",
  )
  assert.ok(branch.includes("showReveal(liveQ.prompt, liveQ.answer, carried)"))
  // Three each: the declaration, and the two places a question can settle /
  // the two things that may take the sum down.
  assert.equal(count("showReveal("), 3, "the reveal is raised or declared somewhere new")
  assert.equal(count("dismissReveal("), 3, "the reveal is dismissed somewhere new")
  const down = CODE.slice(CODE.indexOf("function onDown"))
  assert.ok(
    down.slice(0, down.indexOf("\n  }")).includes("dismissReveal()"),
    "a stroke no longer takes the completed sum down — a fast player is held again",
  )
  const open = CODE.slice(CODE.indexOf("function openSigil"))
  assert.ok(
    open.slice(0, open.indexOf("\n  }")).includes("dismissReveal(true)"),
    "a new question no longer clears the old sum",
  )
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
