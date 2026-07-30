// The sum finishes on screen, and the child is the one who takes it down.
//
// "There is no reason to be like WRONG and then just rush past the
// lesson/content .. let the kid marinate on it and dismiss it or answer or move
// on in their own time."
//
// THE SPLIT had the right idea and none of the follow-through. A wrong lantern
// completed the equation — in the sigil's colour, no red numeral, no cross — and
// then took it away after 1.4 s, over a red screen flash, a damage vignette and a
// `failure` haptic. A timeout did the same in 1.2 s. Both are the same defect the
// founder is describing: the thing worth reading was on screen for less time than
// the scolding around it.
//
// So: the sum is held, at full opacity, for as long as the market's own pace says
// a child at that pace wants it; the child's next stroke takes it down in the
// frame it lands; a new sigil clears it outright so it can never be read across a
// live question; and it is never inside an answering window, because the question
// is settled before it is raised.
//
// Everything here mounts the real game and drives the real frame loop.

import assert from "node:assert/strict"
import { test } from "node:test"

import { B_MOTE, B_SIGIL, begin, dbg, snapshot, swipe, type Report, type Surface } from "./harness.ts"
import {
  CANDIDATE_READ_LOCK_MS,
  FAVOUR_MAX,
  REVEAL_FADE_SECONDS,
  REVEAL_MIN_SECONDS,
  revealDwellSeconds,
  revealIntensity,
} from "../sim/economy.ts"

/** What the completed sum used to be given, kept only to measure against. */
const SHIPPED_WRONG_SECONDS = 1.4
const SHIPPED_TIMEOUT_SECONDS = 1.2

type Live = { reveal: string; revealLeft: number; revealFade: number; liveQ: string }

function live(): Live {
  const st = dbg().stats()
  return {
    reveal: String(st.reveal),
    revealLeft: Number(st.revealLeft),
    revealFade: Number(st.revealFade),
    liveQ: String(st.liveQ),
  }
}

/** Step until a sigil is in the air, then cut it open. Returns the live prompt. */
function openASigil(s: Surface): string {
  for (let i = 0; i < 6000; i++) {
    s.step(16)
    const sigil = dbg()
      .targets()
      .find((t) => t.kind === B_SIGIL)
    if (!sigil) continue
    swipe(s, sigil.x, sigil.y)
    s.step(16)
    if (dbg().targets().some((t) => t.kind === B_MOTE)) break
  }
  const prompt = String(dbg().stats().liveQ)
  assert.notEqual(prompt, "", "never managed to open a sigil, so this test proved nothing")
  // Let the read-lock lapse, so a candidate is cuttable at all.
  for (let i = 0; i < Math.ceil(CANDIDATE_READ_LOCK_MS / 16) + 4; i++) s.step(16)
  return prompt
}

/** Cut the wrong lantern on purpose. */
function answerWrong(s: Surface): void {
  const wrong = dbg()
    .targets()
    .find((t) => t.kind === B_MOTE && !t.correct)
  assert.ok(wrong, "the lanterns never arrived, so nothing was answered")
  swipe(s, wrong.x, wrong.y)
  s.step(16)
}

/** Let the window close with nobody touching the screen. */
function letItExpire(s: Surface): void {
  for (let i = 0; i < 6000 && String(dbg().stats().liveQ) !== ""; i++) s.step(16)
  assert.equal(String(dbg().stats().liveQ), "", "the window never closed")
  s.step(16)
}

test("A TIMEOUT COMPLETES THE SUM, AND LEAVES IT UP", () => {
  const { s, handle, restore } = begin({ seed: 0x5111 })
  try {
    const prompt = openASigil(s)
    letItExpire(s)

    const up = live()
    assert.ok(up.reveal.startsWith(`${prompt} = `), `the sum was not completed: "${up.reveal}"`)
    assert.equal(up.liveQ, "", "the sum went up while a question was still live")
    assert.ok(
      up.revealLeft > SHIPPED_TIMEOUT_SECONDS,
      `only ${up.revealLeft.toFixed(2)}s to read it, against the ${SHIPPED_TIMEOUT_SECONDS}s it shipped with`,
    )

    // Held, at full opacity, without shrinking or fading, for the whole dwell.
    const frames = Math.floor((up.revealLeft * 1000) / 16) - 2
    for (let i = 0; i < frames; i++) s.step(16)
    const still = live()
    assert.equal(still.reveal, up.reveal, "the sum changed while it was being read")
    assert.ok(still.revealLeft > 0, "the sum started leaving before its own beat was up")
    assert.equal(still.revealFade, REVEAL_FADE_SECONDS, "the sum was fading while it was being read")

    // …and then it leaves by itself, on a screen nobody has touched.
    for (let i = 0; i < Math.ceil(((REVEAL_FADE_SECONDS + 0.2) * 1000) / 16) + 4; i++) s.step(16)
    assert.equal(live().reveal, "", "the sum never came down at all")
  } finally {
    handle.unmount()
    restore()
  }
})

test("A WRONG LANTERN COMPLETES THE SUM TOO, AND FOR LONGER THAN IT SHIPPED WITH", () => {
  const { s, handle, restore } = begin({ seed: 0x5222 })
  try {
    const prompt = openASigil(s)
    answerWrong(s)
    const up = live()
    assert.ok(up.reveal.startsWith(`${prompt} = `), `the sum was not completed: "${up.reveal}"`)
    assert.equal(up.liveQ, "", "the sum went up while the question was still live")
    assert.ok(
      up.revealLeft > SHIPPED_WRONG_SECONDS,
      `only ${up.revealLeft.toFixed(2)}s to read it, against the ${SHIPPED_WRONG_SECONDS}s it shipped with`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("A FAST PLAYER IS NEVER HELD: one stroke takes the sum down", () => {
  const { s, handle, restore } = begin({ seed: 0x5333 })
  try {
    openASigil(s)
    answerWrong(s)
    const up = live()
    assert.ok(up.revealLeft > 1, "there was nothing to dismiss")

    // The market is already running: this is not a hold, so the world moves
    // through the whole reveal and the stroke that ends it is an ordinary stroke.
    const world = snapshot(s)
    s.step(16)
    assert.notEqual(snapshot(s), world, "the market was frozen while the sum was up")

    swipe(s, 200, 500)
    const after = live()
    assert.equal(after.revealLeft, 0, "a stroke did not take the sum down")
    // Gone within the fade, not held for the rest of the dwell.
    for (let i = 0; i < Math.ceil(((REVEAL_FADE_SECONDS + 0.1) * 1000) / 16) + 2; i++) s.step(16)
    assert.equal(live().reveal, "", "the sum outlasted the stroke that dismissed it")
  } finally {
    handle.unmount()
    restore()
  }
})

test("a child is never reading two equations at once", () => {
  // Six rounds of real play, every frame checked. The table is printed rather
  // than asserted on: the patient dwell is 4.20 s plus a 0.46 s fade and the
  // market's own cadence brings the next sigil at 4.6–6.2 s, so the two genuinely
  // overlap sometimes and the margin is not a property worth pinning. What IS a
  // property is that a child is never given two equations to read, and the thing
  // that guarantees it whichever way the cadence falls is the clear in
  // `openSigil` — held structurally by `wiring.test.ts`.
  const { s, handle, restore } = begin({ seed: 0x5444 })
  try {
    const rows: Array<Record<string, string>> = []
    let sawReveal = 0
    let sawLive = 0
    for (let round = 0; round < 6; round++) {
      openASigil(s)
      sawLive++
      answerWrong(s)
      const dwell = live().revealLeft
      assert.ok(dwell > 0, "the sum was not raised at all")
      sawReveal++

      // Play on to the next question, checking every single frame.
      let frames = 0
      let downAt = -1
      for (; frames < 1200; frames++) {
        const l = live()
        assert.ok(
          l.liveQ === "" || l.reveal === "",
          `"${l.reveal}" was on screen while "${l.liveQ}" was live`,
        )
        if (l.reveal === "" && downAt < 0) downAt = frames
        const sigil = dbg()
          .targets()
          .find((t) => t.kind === B_SIGIL)
        if (sigil && downAt >= 0) break
        s.step(16)
      }
      rows.push({
        round: String(round),
        "sum held (s)": dwell.toFixed(2),
        "gone after (s)": ((downAt * 16) / 1000).toFixed(2),
        "next sigil at (s)": ((frames * 16) / 1000).toFixed(2),
      })
      assert.ok(downAt >= 0, "the sum never came down")
    }
    console.table(rows)
    assert.ok(sawReveal >= 6 && sawLive >= 6, "the rounds did not actually happen")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the dwell is patient at the calm end and brief at the top", () => {
  // The shared pacing curve, spent backwards: `revealCalmMs × (1 − intensity)²`,
  // floored so mastery gets a brief beat rather than none at all. Both ends beat
  // what the game shipped with, which is the point — 1.2 s was not "brief", it was
  // the answer going past.
  //
  // The rung is the child's own favour, not the clock. `Director.heat` was the
  // first thing this rode and it was wrong: it reaches half its range about
  // twenty-five seconds into a run, so anybody still struggling in minute five got
  // the floor. Favour says something about the child.
  const rows = [1, 2, 3, 4].map((favour) => ({
    favour,
    intensity: revealIntensity(favour).toFixed(2),
    "sum held (s)": revealDwellSeconds(revealIntensity(favour)).toFixed(2),
  }))
  console.table(rows)
  assert.equal(revealIntensity(1), 0, "a child with no favour is not at the calm end")
  assert.equal(revealIntensity(FAVOUR_MAX), 1, "four in a row is not the top")
  assert.equal(revealIntensity(0), 0)
  assert.equal(revealIntensity(99), 1)
  assert.ok(
    revealDwellSeconds(revealIntensity(1)) > 3,
    `a child with no favour is held for only ${revealDwellSeconds(revealIntensity(1)).toFixed(2)}s`,
  )
  assert.ok(
    revealDwellSeconds(0) > SHIPPED_WRONG_SECONDS * 2,
    `the calm market gives ${revealDwellSeconds(0).toFixed(2)}s against the ${SHIPPED_WRONG_SECONDS}s it shipped with`,
  )
  assert.ok(revealDwellSeconds(0) > revealDwellSeconds(1), "the dwell is not adaptive at all")
  let previous = Infinity
  for (let heat = 0; heat <= 1.0001; heat += 0.01) {
    const v = revealDwellSeconds(heat)
    assert.ok(v <= previous + 1e-9, `the sum was held LONGER at heat ${heat.toFixed(2)}`)
    assert.ok(v >= REVEAL_MIN_SECONDS - 1e-9, `heat ${heat.toFixed(2)} would tear the sum down`)
    previous = v
  }
  // Patience is spent at the bottom rather than smeared across the range.
  assert.ok(revealDwellSeconds(0.15) > revealDwellSeconds(0) * 0.6)
  assert.ok(revealDwellSeconds(0.6) < revealDwellSeconds(0) * 0.3)
  assert.ok(Number.isFinite(revealDwellSeconds(Number.NaN)))
})

test("a wrong lantern is completed, never corrected", () => {
  // The tone rule, on the four channels BEAM deleted and this game still had: a
  // red screen flash, a damage vignette, a `failure` haptic and a red burst. A
  // wrong lantern costs the whole favour economy and it has never cost a lamp;
  // what it may not do is tell a child off.
  const haptics: string[] = []
  const reports: Report[] = []
  const { s, handle, restore } = begin({
    seed: 0x5555,
    onReport: (r) => reports.push(r),
    onHaptic: (k) => haptics.push(k),
  })
  try {
    openASigil(s)
    // The anti-vacuity half: this harness really does see haptics, so "no
    // `failure` cue" is a claim about the game and not about a silent spy.
    assert.ok(haptics.length > 0, "no haptic ever reached the host, so nothing below is measured")
    haptics.length = 0

    const before = reports.length
    answerWrong(s)
    assert.equal(reports.length, before + 1, "the wrong lantern was never reported")
    assert.equal(reports[reports.length - 1]?.correct, false)
    assert.ok(
      !haptics.includes("failure"),
      `a wrong sum was answered with ${haptics.join(",")} — a wrong answer is not a failure`,
    )
    assert.ok(haptics.length > 0, "a wrong lantern gave no feedback at all")
    // A lamp is the one thing a wrong answer may never cost.
    assert.equal(Number(dbg().stats().lamps), 3, "a wrong lantern put a lamp out")
    assert.notEqual(live().reveal, "", "the sum was not completed")

    // And a timeout is quieter still: nothing at all is fired at the child for
    // having run out of time.
    haptics.length = 0
    openASigil(s)
    haptics.length = 0
    letItExpire(s)
    assert.ok(
      !haptics.includes("failure"),
      `a timeout was answered with ${haptics.join(",")}`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})
