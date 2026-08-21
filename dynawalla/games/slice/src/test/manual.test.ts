// The market stops while the rules are up.
//
// "I can hear counterweight playing in the background while I'm reading the
// instructions ... stressing me out even more." MATH NINJA had the same defect
// and worse than most: a child who opened the manual *because they were stuck*
// watched bombs arrive behind the scrim and could lose a lamp while reading
// about bombs.
//
// `wiring.test.ts` reads `mount.ts` as text and says so; this file does not. It
// mounts the real game against a fake surface, drives the real frame loop on a
// virtual clock, reaches the shared how-to-play sheet through its OWN help
// button — the same click a child makes — and watches whether the world moved.
//
// Three independent observables, because one is a flag and a flag can lie:
//
//   1. `draws`  — every call into the 2D context. Zero while frozen.
//   2. `elapsed` — the director's own clock, which is what decides when the next
//      gourd is thrown. This is simulation, not rendering.
//   3. the bodies' positions, straight out of the debug surface.

import assert from "node:assert/strict"
import { test } from "node:test"

import {
  B_BOMB,
  B_MOTE,
  begin,
  closeManual,
  dbg,
  openManual,
  snapshot,
  swipe,
  type Report,
  type Surface,
  type Target,
} from "./harness.ts"

test("THE MARKET STOPS: nothing advances while the manual is up", () => {
  const { s, handle, restore } = begin({ seed: 0xf00d })
  try {
    for (let i = 0; i < 900; i++) s.step(16)
    const before = snapshot(s)
    assert.ok(dbg().targets().length > 0, "nothing was in the air before the manual opened")

    openManual(s)
    // Three minutes of a child reading, at sixty frames a second.
    for (let i = 0; i < 11_250; i++) s.step(16)
    assert.equal(snapshot(s), before, "the market kept running behind the manual")

    closeManual(s)
    for (let i = 0; i < 240; i++) s.step(16)
    assert.notEqual(snapshot(s), before, "the market never came back after the manual closed")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual does not serve the child a question they never saw", () => {
  const { s, handle, restore, nextCount } = begin({ seed: 0xbeef })
  try {
    for (let i = 0; i < 900; i++) s.step(16)
    const before = nextCount()
    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    assert.equal(nextCount(), before, "the game drew questions from the host behind the sheet")
  } finally {
    handle.unmount()
    restore()
  }
})

test("closing the manual does not hand the loop one enormous frame", () => {
  // `last` has to keep tracking the real clock across the read, or the first
  // frame back is `now − last` — three minutes of gravity in a single step. The
  // loop's 64ms clamp catches the worst of it, which is exactly why this needs
  // asserting rather than eyeballing: the bug survives the clamp as a visible
  // four-frame lurch of everything in the air, not as a crash.
  //
  // Measured as how far the gourds actually moved, because the director's clock
  // is only published to a tenth of a second and a frame is well under that.
  const key = (t: Target): string => `${t.kind}:${t.text}:${t.r.toFixed(4)}`
  const travel = (): number => {
    const before = new Map(dbg().targets().map((t) => [key(t), t]))
    s.step(16)
    let most = 0
    for (const t of dbg().targets()) {
      const was = before.get(key(t))
      if (!was) continue
      most = Math.max(most, Math.hypot(t.x - was.x, t.y - was.y))
    }
    return most
  }

  const { s, handle, restore } = begin({ seed: 0xc0ffee })
  try {
    for (let i = 0; i < 900; i++) s.step(16)
    const ordinary = travel()
    assert.ok(ordinary > 0, "nothing was moving before the manual opened, so this measures nothing")

    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)

    const firstBack = travel()
    assert.ok(
      firstBack <= ordinary * 1.6,
      `the first frame back moved the market ${firstBack.toFixed(1)}px against an ordinary ${ordinary.toFixed(1)}px`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

/** Play until a bomb is in reach, cut it, and open the gate. */
function openTheGate(s: Surface): boolean {
  dbg().setIntensity(0.85)
  s.step(16)
  for (let i = 0; i < 20000; i++) {
    const b = dbg()
      .targets()
      .find((t) => t.kind === B_BOMB && t.y > 80 && t.y < 900)
    if (b) {
      swipe(s, b.x, b.y)
      s.step(16)
      if (String(dbg().stats().gate) !== "") return true
    }
    s.step(16)
  }
  return false
}

test("THE READ IS NOT BILLED: the gate survives the manual, and costs nothing", () => {
  // The wall-clock half of the fix. The gate has no timer, so nothing can expire
  // behind the sheet — but the LATENCY handed to the curriculum is a
  // `performance.now()` difference, and three minutes of reading the rules must
  // not be billed to the child as three minutes of thinking.
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x5161, onReport: (r) => reports.push(r) })
  try {
    assert.ok(openTheGate(s), "never met a bomb, so this test proved nothing")
    for (let i = 0; i < 60; i++) s.step(16)
    const gateBefore = String(dbg().stats().gate)
    assert.ok(gateBefore.length > 0, "no question was live after the bomb")
    const motesBefore = dbg().targets().filter((t) => t.kind === B_MOTE).length

    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)

    assert.equal(String(dbg().stats().gate), gateBefore, "the gate changed behind the manual")
    assert.equal(
      dbg().targets().filter((t) => t.kind === B_MOTE).length,
      motesBefore,
      "the lanterns went away while the child was reading",
    )

    const mote = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE)
    assert.ok(mote, "the lanterns vanished across the pause")
    const n = reports.length
    swipe(s, mote.x, mote.y)
    s.step(16)
    assert.equal(reports.length, n + 1, "cutting a lantern after the manual reported nothing")
    const r = reports[reports.length - 1] as Report
    assert.ok(
      r.ms < 60_000,
      `the read was billed to the child: ${r.ms}ms of "thinking" for a question answered at once`,
    )
  } finally {
    handle.unmount()
    restore()
  }
})

test("the read-lock survives the manual — a lantern is not cuttable on the way back", () => {
  // `cuttableAt` is a wall-clock mark and it is the one the manual says out loud:
  // "you get a moment to read them first". Unshifted, three minutes of reading
  // burns the lock, and the stroke a child makes as they close the sheet answers
  // a question they have not looked at yet.
  const reports: Report[] = []
  const { s, handle, restore } = begin({ seed: 0x5161, onReport: (r) => reports.push(r) })
  try {
    assert.ok(openTheGate(s), "never met a bomb, so this test proved nothing")
    let motes: Target[] = dbg().targets().filter((t) => t.kind === B_MOTE)
    assert.ok(motes.length > 0, "the gate hung no lanterns")

    // Straight into the manual, inside the 420ms lock.
    openManual(s)
    for (let i = 0; i < 11_250; i++) s.step(16)
    closeManual(s)

    const n = reports.length
    const mote = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE)
    assert.ok(mote, "the lanterns vanished across the pause")
    swipe(s, mote.x, mote.y)
    s.step(16)
    assert.equal(reports.length, n, "the read-lock was spent on the manual — the first stroke answered")

    // And the lock does still lapse, on the game's own time.
    for (let i = 0; i < 60; i++) s.step(16)
    const m2 = dbg()
      .targets()
      .find((t) => t.kind === B_MOTE)
    assert.ok(m2, "the lanterns fell away before the lock lapsed")
    swipe(s, m2.x, m2.y)
    s.step(16)
    assert.equal(reports.length, n + 1, "the lock never lapsed — the lanterns are permanently uncuttable")
    motes = []
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual only lifts a pause it put on itself", () => {
  // The host puts a sheet over a still-mounted pack — a purchase surface, a
  // parent gate — and the child, behind it, closes the how-to-play they had
  // open. The game must stay stopped: the host is still holding it.
  const { s, handle, restore } = begin({ seed: 0x9001 })
  try {
    for (let i = 0; i < 600; i++) s.step(16)
    handle.setPaused(true)
    const held = snapshot(s)

    openManual(s)
    for (let i = 0; i < 600; i++) s.step(16)
    closeManual(s)
    for (let i = 0; i < 1200; i++) s.step(16)
    assert.equal(snapshot(s), held, "closing the rules handed the game back while the host held it")

    handle.setPaused(false)
    for (let i = 0; i < 240; i++) s.step(16)
    assert.notEqual(snapshot(s), held, "the host could not get its own game back")
  } finally {
    handle.unmount()
    restore()
  }
})

test("pausing twice is one pause, and resuming a running game is nothing", () => {
  const { s, handle, restore } = begin({ seed: 0x1d3a })
  try {
    handle.setPaused(false)
    for (let i = 0; i < 600; i++) s.step(16)
    handle.setPaused(true)
    handle.setPaused(true)
    const held = snapshot(s)
    for (let i = 0; i < 3000; i++) s.step(16)
    assert.equal(snapshot(s), held, "a doubled pause let the market through")
    handle.setPaused(false)
    handle.setPaused(false)
    for (let i = 0; i < 240; i++) s.step(16)
    assert.notEqual(snapshot(s), held, "a doubled resume left the market stopped")
  } finally {
    handle.unmount()
    restore()
  }
})

test("the manual can be opened and closed all run without the game drifting", () => {
  const { s, handle, restore } = begin({ seed: 0x2b2b })
  try {
    for (let i = 0; i < 40; i++) {
      for (let k = 0; k < 30; k++) s.step(16)
      openManual(s)
      for (let k = 0; k < 30; k++) s.step(16)
      closeManual(s)
    }
    const st = dbg().stats()
    assert.ok(Number(st.elapsed) > 0, "forty opens and closes left the game never having run")
    assert.ok(Number(st.lamps) >= 0)
  } finally {
    handle.unmount()
    restore()
  }
})
