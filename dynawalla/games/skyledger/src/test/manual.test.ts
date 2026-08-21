// FROZEN BEHIND THE MANUAL.
//
// "All games should pause while reading the instructions .. I can hear
// counterweight playing in the background while I'm reading the instructions ...
// stressing me out even more."
//
// `pause.test.ts` next door proves the *rules* stop when `Game.pause` is called.
// It cannot prove that anything ever calls it, and the one surface that must —
// the game's own how-to-play sheet, which a child raises precisely when they are
// losing — is opt-in and was not wired. So this file is the wiring's gate: it
// mounts the whole shell against a headless surface, reaches the shared module's
// real help button the way a finger does, and watches the sky.
//
// **The observable is the host, not the canvas.** This game keeps DRAWING a
// frozen frame while paused, on purpose, so a count of context calls would be
// meaningless. What is unambiguously simulation is that a falling star pulls a
// ledger line from the host when it is released and buzzes the motor when it
// lands. Neither can happen if the sky is not moving.
//
// The fake elements below carry a listener map EACH, which is not tidiness: the
// help button and the PLAY button both register a `"click"`, so one shared map
// keyed by type silently drops the first and this test opens nothing.

import assert from "node:assert/strict"
import { test } from "node:test"

import { LOGGED_PAST_CALM } from "../game/opening.ts"
import { noteLogged, resetLoggedForTest } from "../game/seen.ts"
import { mountSkyLedger } from "../mount.ts"
import { createStubHost } from "../stubHost.ts"
import { makeSurface } from "./surface.ts"

type Rig = {
  surface: ReturnType<typeof makeSurface>
  handle: ReturnType<typeof mountSkyLedger>
  /** Ledger lines pulled from the host. Only a released star pulls one. */
  served: () => number
  haptics: string[]
  reports: Array<{ ms: number }>
  stop(): void
}

function rig(seed = 0x5c7ed6): Rig {
  const surface = makeSurface()
  const restore = surface.install()
  // A practised child. This file is about the MANUAL, not about the opening: it
  // needs stars that land inside its twenty-four seconds, which is the shipped
  // descent and not the calm one. Seeded AFTER `install`, so the count lands in
  // this rig's own storage and not in the one the last rig took away with it.
  resetLoggedForTest()
  for (let i = 0; i < LOGGED_PAST_CALM; i++) noteLogged()
  const haptics: string[] = []
  const reports: Array<{ ms: number }> = []
  let served = 0
  const stub = createStubHost({
    seed,
    reducedMotion: false,
    onHaptic: (k) => haptics.push(k),
    onReport: (r) => reports.push(r),
  })
  const host = {
    ...stub,
    next: (o?: { domain?: string; difficulty?: number }) => {
      served++
      return stub.next(o)
    },
  }
  const handle = mountSkyLedger(surface.root as unknown as HTMLElement, host)
  return {
    surface,
    handle,
    served: () => served,
    haptics,
    reports,
    stop(): void {
      handle.unmount()
      restore()
    },
  }
}

function openManual(surface: ReturnType<typeof makeSurface>): void {
  const help = surface.help()
  assert.ok(help, "the shared how-to-play button was never mounted")
  help.fire("click", { target: help, type: "click" })
}

function closeManual(surface: ReturnType<typeof makeSurface>): void {
  const button = surface.closeButton()
  assert.ok(button, "the sheet has no PLAY button")
  button.fire("click", { target: button, type: "click" })
}

test("the sky does not fall while the rules are up", () => {
  const r = rig()
  try {
    // Twenty-four seconds of watch. Stars are released, fall, and land.
    for (let i = 0; i < 1500; i++) r.surface.step(16)
    const servedBefore = r.served()
    const hapticsBefore = r.haptics.length
    assert.ok(servedBefore > 1, `the sky never released a star (${servedBefore} served)`)
    assert.ok(hapticsBefore > 0, "nothing ever landed, so there is nothing to freeze")

    openManual(r.surface)
    // Three minutes behind the sheet. A child reading the manual after a bad
    // watch should not come back to a dark observatory.
    for (let i = 0; i < 11_250; i++) r.surface.step(16)
    assert.equal(r.served(), servedBefore, "the sky pulled a ledger line behind the manual")
    assert.equal(r.haptics.length, hapticsBefore, "a star landed behind the manual")

    closeManual(r.surface)
    // And it does not teleport. The frame after the sheet is one frame, not
    // three minutes: a burst of releases here would mean the sky dumped a whole
    // read's worth of stars into the ground at once.
    r.surface.step(16)
    assert.ok(
      r.served() - servedBefore <= 1,
      `${r.served() - servedBefore} ledger lines were pulled in the first frame after the sheet`,
    )

    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the sky never started falling again")
    assert.ok(r.haptics.length > hapticsBefore, "the watch did not come back")
  } finally {
    r.stop()
  }
})

test("a watch the HOST already stopped is not restarted by closing the rules", () => {
  // The host puts a sheet over a still-mounted pack — a stopping-point card, a
  // parent gate, a day-pass offer — and this game raises one itself at the end
  // of every watch. If the child then opens the manual on top of it and closes
  // it, the observatory must not start running underneath the host's sheet.
  const r = rig(0x40b)
  try {
    for (let i = 0; i < 1500; i++) r.surface.step(16)
    assert.ok(r.served() > 1)

    r.handle.pause()
    const servedBefore = r.served()
    const hapticsBefore = r.haptics.length

    openManual(r.surface)
    for (let i = 0; i < 1200; i++) r.surface.step(16)
    closeManual(r.surface)
    for (let i = 0; i < 6000; i++) r.surface.step(16)

    assert.equal(r.served(), servedBefore, "closing the manual lifted the host's own pause")
    assert.equal(r.haptics.length, hapticsBefore, "a star fell out from under the host's sheet")

    // The host's pause is still the host's to lift, and lifting it works.
    r.handle.resume()
    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the host could not restart its own watch")
  } finally {
    r.stop()
  }
})

test("the host lifting its own sheet does not start the sky behind the manual", () => {
  // The other order, and the one that reintroduces the whole defect: the host
  // pauses, the child opens the rules, and then the host takes ITS sheet down
  // while the manual is still up. The sky must wait for the rules.
  const r = rig(0x7e57)
  try {
    for (let i = 0; i < 1500; i++) r.surface.step(16)
    assert.ok(r.served() > 1)

    r.handle.pause()
    openManual(r.surface)
    const servedBefore = r.served()
    const hapticsBefore = r.haptics.length

    r.handle.resume()
    for (let i = 0; i < 6000; i++) r.surface.step(16)
    assert.equal(r.served(), servedBefore, "the sky fell behind the manual")
    assert.equal(r.haptics.length, hapticsBefore, "a star landed behind the manual")

    // And closing the rules is what hands it back, because by then the manual
    // is the only thing still holding it.
    closeManual(r.surface)
    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the watch never came back when the rules went down")
  } finally {
    r.stop()
  }
})

test("opening and closing the rules repeatedly is not a stack of pauses", () => {
  const r = rig(0x1de)
  try {
    for (let i = 0; i < 1200; i++) r.surface.step(16)
    for (let i = 0; i < 6; i++) {
      openManual(r.surface)
      for (let n = 0; n < 30; n++) r.surface.step(16)
      closeManual(r.surface)
      for (let n = 0; n < 30; n++) r.surface.step(16)
    }
    const servedBefore = r.served()
    for (let i = 0; i < 1800; i++) r.surface.step(16)
    assert.ok(r.served() > servedBefore, "the watch never came back after six reads")
    // Nothing was billed to the child for the reading.
    for (const report of r.reports) {
      assert.ok(report.ms < 60_000, `a report carried ${report.ms}ms — the sheet leaked into it`)
    }
  } finally {
    r.stop()
  }
})
