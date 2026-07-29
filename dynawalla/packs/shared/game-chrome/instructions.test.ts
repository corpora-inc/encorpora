// The manual, asserted rather than described.
//
// This file exists because the module it tests had four defects in production
// and every single one was found by a game adopting it, never by this module:
//
//   #636  the sheet rendered OVER the game from the moment it mounted, in all
//         27 games, because a UA `[hidden]{display:none}` is origin-weaker than
//         an author `display:flex`
//   #640  `safeInsets()` returned zeros inside the pack frame
//   #641  the manual could not be scrolled with a finger
//   #645  Escape closed the manual straight into the game, and the focus trap
//         had been unreachable since the day the key swallow was added
//
// There was no test file at all, and `insets.test.ts` beside it is not run by
// CI. So: a hand-rolled DOM, no dependencies, in the same shape as
// `games/guilty/src/game/input.test.ts`.
//
// What this CAN'T see is real layout — whether the footer is genuinely pinned,
// whether the body genuinely scrolls. Those need a browser. What it CAN see is
// every invariant that is arithmetic or behaviour, which is where all four
// defects actually lived.

import assert from "node:assert/strict"
import { test } from "node:test"

import { createInstructions, sheetTop, type InstructionsSpec } from "./instructions.ts"
import { forgetAudioContexts } from "./audioHold.ts"
import { setHostInsets, type Insets } from "./insets.ts"
import { exitRect, helpRect, HOST_CONTROL } from "./hostChrome.ts"

// --- the fake DOM -----------------------------------------------------------

type Listener = (event: unknown) => void

class El {
  tagName: string
  children: El[] = []
  parent: El | null = null
  attrs = new Map<string, string>()
  listeners = new Map<string, Listener[]>()
  className = ""
  textContent = ""
  type = ""
  tabIndex = 0
  hidden = false
  scrollTop = 0
  offsetHeight = 600
  focused = false
  // Deliberately a bag of named fields with NO `setProperty`, matching the
  // fake DOMs four games already ship. The module must stay inside that
  // vocabulary: when it reached for `style.setProperty`, BEAM, COUNTERWEIGHT,
  // FOUNDRY and LATTICE all stopped rendering at every viewport.
  style: Record<string, string> = {}
  // No `classList`, deliberately — see the note on `style` above. The games'
  // harnesses do not have one, and when this rig was richer than theirs the
  // module reached for `classList.remove` and broke FOUNDRY and LATTICE while
  // these tests stayed green. A test double that is MORE capable than the real
  // callers is not a safety net, it is a blindfold.

  constructor(tagName: string) {
    this.tagName = tagName
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, v)
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null
  }
  appendChild(c: El): void {
    c.parent = this
    this.children.push(c)
  }
  append(...cs: El[]): void {
    cs.forEach((c) => this.appendChild(c))
  }
  remove(): void {
    if (!this.parent) return
    this.parent.children = this.parent.children.filter((c) => c !== this)
    this.parent = null
  }
  addEventListener(t: string, fn: Listener): void {
    this.listeners.set(t, [...(this.listeners.get(t) ?? []), fn])
  }
  removeEventListener(t: string, fn: Listener): void {
    this.listeners.set(t, (this.listeners.get(t) ?? []).filter((f) => f !== fn))
  }
  focus(): void {
    doc.activeElement = this
    this.focused = true
  }
  setPointerCapture(): void {}
  releasePointerCapture(): void {}
  /** Deliver an event to this element's own listeners. */
  fire(type: string, event: Record<string, unknown> = {}): void {
    const e = { type, target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...event }
    for (const fn of [...(this.listeners.get(type) ?? [])]) fn(e)
  }
  /** Find one descendant by class name. */
  find(cls: string): El {
    if (this.className.split(" ").includes(cls)) return this
    for (const c of this.children) {
      try {
        return c.find(cls)
      } catch {
        /* keep looking */
      }
    }
    throw new Error(`no .${cls} in the tree`)
  }
  has(cls: string): boolean {
    try {
      this.find(cls)
      return true
    } catch {
      return false
    }
  }
}

// `safeInsets()` measures a hidden probe through `getComputedStyle`, so the
// fake document has to offer the three things that path touches. It resolves to
// zeros here, which is exactly what a device with no notch reports — the tests
// that care about a real notch push one in with `setHostInsets()`.
const doc = {
  activeElement: null as El | null,
  createElement: (t: string) => new El(t),
  getElementById: () => null,
  body: new El("body"),
}

/**
 * A game's `AudioContext`, with only the three methods this module touches.
 *
 * State flips when the promise settles, not when the call is made, because that
 * is what a real context does — and a test whose fake flips synchronously would
 * pass with a `suspend()` that is never awaited by anything.
 */
class FakeAudioContext {
  state: "running" | "suspended" | "closed" = "running"
  resumed = 0
  suspended = 0
  async resume(): Promise<void> {
    this.resumed += 1
    await Promise.resolve()
    if (this.state !== "closed") this.state = "running"
  }
  async suspend(): Promise<void> {
    this.suspended += 1
    await Promise.resolve()
    if (this.state !== "closed") this.state = "suspended"
  }
  async close(): Promise<void> {
    this.state = "closed"
  }
}

/** Let every queued suspend/resume settle. The hold serialises them per context. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

/** Key listeners registered on `globalThis`, and the games that share them. */
type Rig = {
  root: El
  ui: ReturnType<typeof createInstructions>
  /** Dispatch a key the way a browser would: capture listeners, then the game. */
  key(type: "keydown" | "keyup", key: string): { reachedGame: boolean; defaultPrevented: boolean }
  /** The same, for a pointer. `target` is what the browser would hit. */
  pointer(type: string, target: El): { reachedGame: boolean }
  /** A context the GAME made, through whatever `globalThis.AudioContext` is now. */
  gameAudio(): FakeAudioContext
  gameSawKeys: string[]
  gameSawPointers: string[]
  restore(): void
}

function rig(spec?: Partial<InstructionsSpec>): Rig {
  // Keyed BY TYPE, deliberately. A single bucket dispatched to every listener
  // regardless of type, which made the swallow reachable through its `keyup`
  // registration even when the `keydown` one was deleted — so the test that
  // proves keys never reach the game passed with the whole guard removed.
  // Mutation testing caught it; nothing else would have.
  const capture = new Map<string, Listener[]>()
  const gameSawKeys: string[] = []
  const gameSawPointers: string[] = []

  const prevDoc = (globalThis as { document?: unknown }).document
  const prevCS = (globalThis as { getComputedStyle?: unknown }).getComputedStyle
  const prevAC = (globalThis as { AudioContext?: unknown }).AudioContext
  ;(globalThis as { AudioContext?: unknown }).AudioContext = FakeAudioContext
  ;(globalThis as { document?: unknown }).document = doc
  ;(globalThis as { getComputedStyle?: unknown }).getComputedStyle = () => ({
    paddingTop: "0px",
    paddingRight: "0px",
    paddingBottom: "0px",
    paddingLeft: "0px",
  })
  doc.activeElement = null

  const realAdd = globalThis.addEventListener
  const realRemove = globalThis.removeEventListener
  ;(globalThis as { addEventListener: unknown }).addEventListener = (
    t: string,
    fn: Listener,
    useCapture?: boolean,
  ) => {
    if (useCapture === true) capture.set(t, [...(capture.get(t) ?? []), fn])
  }
  ;(globalThis as { removeEventListener: unknown }).removeEventListener = (
    t: string,
    fn: Listener,
    useCapture?: boolean,
  ) => {
    if (useCapture === true) {
      capture.set(t, (capture.get(t) ?? []).filter((f) => f !== fn))
    }
  }

  const root = new El("div")
  const ui = createInstructions(root as unknown as HTMLElement, {
    title: "ABYSSAL BLOOM",
    summary: ["Two polyps with the same number join into one."],
    sections: [{ heading: "JOINING POLYPS", lines: ["Drag a polyp onto another."] }],
    ...spec,
  })

  return {
    root,
    ui,
    gameSawKeys,
    gameSawPointers,
    gameAudio() {
      const Ctor = (globalThis as unknown as { AudioContext?: new () => FakeAudioContext })
        .AudioContext
      if (!Ctor) throw new Error("no AudioContext on globalThis")
      return new Ctor()
    },
    pointer(type, target) {
      let stopped = false
      const e = {
        type,
        target,
        currentTarget: null,
        preventDefault() {},
        stopPropagation() {
          stopped = true
        },
      }
      for (const fn of [...(capture.get(type) ?? [])]) fn(e)
      // Every game binds its own pointer handlers — on its canvas, its root or
      // `globalThis`. A capture listener on `globalThis` runs before all three,
      // so stopping there is what does or does not reach the game.
      if (!stopped) gameSawPointers.push(type)
      return { reachedGame: !stopped }
    },
    key(type, key) {
      let stopped = false
      let defaultPrevented = false
      const e = {
        type,
        key,
        preventDefault() {
          defaultPrevented = true
        },
        stopPropagation() {
          stopped = true
        },
      }
      for (const fn of [...(capture.get(type) ?? [])]) fn(e)
      // The game's own listener. In every real game it is on `globalThis` too,
      // so it only runs if the capture handler did not stop the event.
      if (!stopped) gameSawKeys.push(key)
      return { reachedGame: !stopped, defaultPrevented }
    },
    restore() {
      ;(globalThis as { addEventListener: unknown }).addEventListener = realAdd
      ;(globalThis as { removeEventListener: unknown }).removeEventListener = realRemove
      ;(globalThis as { document?: unknown }).document = prevDoc
      ;(globalThis as { getComputedStyle?: unknown }).getComputedStyle = prevCS
      ;(globalThis as { AudioContext?: unknown }).AudioContext = prevAC
      forgetAudioContexts()
    },
  }
}

/** Every inset profile that ships: no notch, portrait notch, landscape notch. */
const PROFILES: readonly Insets[] = [
  { top: 0, right: 0, bottom: 0, left: 0 },
  { top: 47, right: 0, bottom: 34, left: 0 },
  { top: 59, right: 0, bottom: 34, left: 0 },
  { top: 0, right: 47, bottom: 21, left: 47 },
]

// --- the clearance the whole shape exists for -------------------------------

test("the sheet's ceiling clears both host corners, at every inset profile", () => {
  // This is the defect in the founder's screenshot: a centred card at 82vh put
  // its top edge at ~73px on a notched phone while the exit chevron occupied
  // 60..104px, so the chevron sat on top of the title and ate two letters of
  // it. No z-index could fix it — the chevron is in the HOST document, above
  // the iframe.
  for (const i of PROFILES) {
    const top = sheetTop(i)
    const exit = exitRect(i)
    const help = helpRect(390, i)
    assert.ok(
      top >= exit.y + exit.h,
      `sheet ceiling ${top} is inside the exit control (${exit.y}..${exit.y + exit.h}) at top inset ${i.top}`,
    )
    assert.ok(
      top >= help.y + help.h,
      `sheet ceiling ${top} is inside the help control at top inset ${i.top}`,
    )
  }
})

test("the ceiling grows with the notch rather than being a fixed guess", () => {
  const flat = sheetTop({ top: 0, right: 0, bottom: 0, left: 0 })
  const notched = sheetTop({ top: 59, right: 0, bottom: 34, left: 0 })
  assert.equal(notched - flat, 59, "the ceiling ignored the notch")
  assert.ok(flat >= HOST_CONTROL, "the ceiling does not even clear one control")
})

// --- the four production defects, each pinned -------------------------------

test("the sheet is hidden at mount — it does not cover the game on launch", () => {
  // #636. The scrim shipped `display:flex` and `hidden=true` at once, and a UA
  // stylesheet's [hidden] loses to an author display. Every game, every launch.
  const r = rig()
  const scrim = r.root.find("dwc-scrim")
  assert.equal(scrim.hidden, true)
  assert.equal(r.ui.isOpen, false)
  // And the rule that makes `hidden` win must precede the block that would
  // otherwise beat it on source order.
  const css = r.root.children.find((c) => c.tagName === "style")?.textContent ?? ""
  const hiddenAt = css.indexOf(".dwc-scrim[hidden]")
  const displayAt = css.indexOf(".dwc-scrim{")
  assert.ok(hiddenAt >= 0 && displayAt > hiddenAt, "the [hidden] rule must come first")
  r.ui.destroy()
  r.restore()
})

test("the body may be scrolled with a finger", () => {
  // #641. Games set `touch-action:none` on their root so a stray drag cannot
  // pan the page; that also forbids the one gesture the manual needs.
  const r = rig()
  const css = r.root.children.find((c) => c.tagName === "style")?.textContent ?? ""
  const body = css.slice(css.indexOf(".dwc-body{"), css.indexOf(".dwc-sum"))
  assert.match(body, /touch-action:pan-y/, "the manual cannot be scrolled by touch")
  assert.match(body, /overflow-y:auto/)
  r.ui.destroy()
  r.restore()
})

test("Escape closes the manual and the game never sees it", () => {
  // #645. Letting Escape through so a bubble handler could close the sheet
  // meant the game saw it too. GUILTY starts a fresh run on ANY key, so a child
  // who died, opened the rules and pressed Escape lost the wave, the lives, the
  // score and the best combo to the act of reading.
  const r = rig()
  r.ui.open()
  const out = r.key("keydown", "Escape")
  assert.equal(r.ui.isOpen, false, "Escape did not close the manual")
  assert.equal(out.reachedGame, false, "the game saw Escape")
  assert.deepEqual(r.gameSawKeys, [])
  r.ui.destroy()
  r.restore()
})

test("every other key is swallowed while the manual is open", () => {
  const r = rig()
  r.ui.open()
  for (const k of [" ", "Enter", "a", "ArrowLeft", "p"]) r.key("keydown", k)
  assert.deepEqual(r.gameSawKeys, [], `the game saw ${r.gameSawKeys.join(",")} behind the manual`)
  r.ui.destroy()
  r.restore()
})

test("and NOTHING is swallowed once it is closed — a gate stuck shut is the same bug", () => {
  const r = rig()
  r.ui.open()
  r.ui.close()
  for (const k of [" ", "Escape", "a"]) r.key("keydown", k)
  assert.deepEqual(r.gameSawKeys, [" ", "Escape", "a"], "the game was starved after the manual closed")
  r.ui.destroy()
  r.restore()
})

// --- the drawer itself ------------------------------------------------------

test("a drag past the threshold dismisses the sheet", () => {
  const r = rig()
  r.ui.open()
  const grab = r.root.find("dwc-grab")
  grab.fire("pointerdown", { button: 0, clientY: 400, pointerId: 1, timeStamp: 0 })
  grab.fire("pointermove", { clientY: 520, pointerId: 1, timeStamp: 400 })
  grab.fire("pointerup", { clientY: 520, pointerId: 1, timeStamp: 400 })
  assert.equal(r.ui.isOpen, false, "a 120px drag did not dismiss the sheet")
  r.ui.destroy()
  r.restore()
})

test("a short slow drag springs back instead of dismissing", () => {
  // A sheet that flies away on a 20px twitch is a sheet a child cannot read.
  const r = rig()
  r.ui.open()
  const grab = r.root.find("dwc-grab")
  grab.fire("pointerdown", { button: 0, clientY: 400, pointerId: 1, timeStamp: 0 })
  grab.fire("pointermove", { clientY: 420, pointerId: 1, timeStamp: 500 })
  grab.fire("pointerup", { clientY: 420, pointerId: 1, timeStamp: 500 })
  assert.equal(r.ui.isOpen, true, "a 20px drag dismissed the sheet")
  const sheet = r.root.find("dwc-sheet")
  assert.equal(sheet.style.transform, "", "the sheet was left displaced")
  assert.match(sheet.className, /\bdwc-settle\b/, "the sheet snapped back without animating")
  r.ui.destroy()
  r.restore()
})

test("a fast flick dismisses even when it is short", () => {
  const r = rig()
  r.ui.open()
  const grab = r.root.find("dwc-grab")
  grab.fire("pointerdown", { button: 0, clientY: 400, pointerId: 1, timeStamp: 0 })
  grab.fire("pointermove", { clientY: 460, pointerId: 1, timeStamp: 40 })
  grab.fire("pointerup", { clientY: 460, pointerId: 1, timeStamp: 40 })
  assert.equal(r.ui.isOpen, false, "a 60px flick in 40ms did not dismiss")
  r.ui.destroy()
  r.restore()
})

test("dragging upward never lifts the sheet into the host chrome", () => {
  const r = rig()
  r.ui.open()
  const grab = r.root.find("dwc-grab")
  const sheet = r.root.find("dwc-sheet")
  grab.fire("pointerdown", { button: 0, clientY: 400, pointerId: 1, timeStamp: 0 })
  grab.fire("pointermove", { clientY: 120, pointerId: 1, timeStamp: 100 })
  assert.equal(sheet.style.transform, "translateY(0px)", "the sheet moved up into the chrome")
  grab.fire("pointerup", { clientY: 120, pointerId: 1, timeStamp: 100 })
  assert.equal(r.ui.isOpen, true)
  r.ui.destroy()
  r.restore()
})

test("the way out is pinned, not buried at the end of the manual", () => {
  // In the centred card the PLAY button was the last child of the scrolling
  // content, so a game with five sections made a child scroll the entire manual
  // to leave it.
  const r = rig()
  const sheet = r.root.find("dwc-sheet")
  const kinds = sheet.children.map((c) => c.className)
  assert.deepEqual(kinds, ["dwc-grab", "dwc-head", "dwc-body", "dwc-foot"])
  const foot = r.root.find("dwc-foot")
  assert.ok(foot.has("dwc-close"), "PLAY is not in the pinned footer")
  const body = r.root.find("dwc-body")
  assert.equal(body.has("dwc-close"), false, "PLAY is inside the scrolling body")
  r.ui.destroy()
  r.restore()
})

test("the grab handle is a 44px target and announces itself", () => {
  // Standing rule: a 44px wrapper hit zone around the pill, never a bare pill.
  const r = rig()
  const grab = r.root.find("dwc-grab")
  assert.equal(grab.getAttribute("role"), "button")
  assert.ok((grab.getAttribute("aria-label") ?? "").length > 0)
  assert.equal(grab.tabIndex, 0, "the handle cannot be reached by keyboard")
  const css = r.root.children.find((c) => c.tagName === "style")?.textContent ?? ""
  assert.match(css.slice(css.indexOf(".dwc-grab{")), /^\.dwc-grab\{[^}]*height:44px/)
  r.ui.destroy()
  r.restore()
})

test("the sheet is capped from the measured insets, not from a vh guess", () => {
  const notch: Insets = { top: 59, right: 0, bottom: 34, left: 0 }
  setHostInsets(notch)
  const r = rig()
  r.ui.open()
  const sheet = r.root.find("dwc-sheet")
  const foot = r.root.find("dwc-foot")
  assert.equal(sheet.style.maxHeight, `calc(100% - ${sheetTop(notch)}px)`)
  assert.equal(foot.style.paddingBottom, "calc(.7rem + 34px)", "the footer sits under the home indicator")
  r.ui.destroy()
  r.restore()
  setHostInsets(null)
})

test("the help control sits exactly where hostChrome says it does", () => {
  // Games assert their HUD clears `helpRect()`. A button three pixels off that
  // rect makes every one of those tests a near-miss rather than a proof.
  setHostInsets({ top: 47, right: 0, bottom: 34, left: 0 })
  const r = rig()
  const help = r.root.find("dwc-help")
  const want = helpRect(390, { top: 47, right: 0, bottom: 34, left: 0 })
  assert.equal(help.style.top, `${want.y}px`)
  r.ui.destroy()
  r.restore()
  setHostInsets(null)
})

test("close fires onClose so the game can resume, and open/close are idempotent", () => {
  let closes = 0
  const r = rig({ onClose: () => (closes += 1) })
  r.ui.open()
  r.ui.open()
  r.ui.close()
  r.ui.close()
  assert.equal(closes, 1, "onClose fired for a close that did not happen")
  r.ui.destroy()
  r.restore()
})

// --- the game must not be playing behind the manual -------------------------
//
// The report, verbatim: "All games should pause while reading the instructions
// .. I can hear counterweight playing in the background while I'm reading the
// instructions ... stressing me out even more .. it's so stressful I don't even
// want to QA it."
//
// A child opens the rules BECAUSE they are overwhelmed. Getting shouted at by
// the game while they read is the worst moment in the product to be loud.
//
// This had been fixed per game — #642 for VOLTA and MOSAIC, then trebuchet,
// coil, foundry and guilty one at a time. Eleven of the twenty-seven had no
// gating at all, and the twenty-eighth pack would have shipped without it too.
// So it is fixed HERE, where a game cannot forget it.

test("the game's sound stops while the manual is open", async () => {
  const r = rig()
  const ctx = r.gameAudio()
  assert.equal(ctx.state, "running")
  r.ui.open()
  await settle()
  assert.equal(ctx.state, "suspended", "the game is still making noise behind the manual")
  r.ui.destroy()
  r.restore()
})

test("and starts again when the manual closes", async () => {
  const r = rig()
  const ctx = r.gameAudio()
  r.ui.open()
  await settle()
  r.ui.close()
  await settle()
  assert.equal(ctx.state, "running", "the game came back silent")
  r.ui.destroy()
  r.restore()
})

test("a game that was ALREADY silent is not switched on by closing the manual", async () => {
  // A game paused on its own — its own pause screen, a phone call, the host
  // putting a sheet over the frame — must come back exactly as it was. Closing
  // the manual is not permission to make noise.
  const r = rig()
  const ctx = r.gameAudio()
  await ctx.suspend()
  assert.equal(ctx.state, "suspended")
  r.ui.open()
  await settle()
  r.ui.close()
  await settle()
  assert.equal(ctx.state, "suspended", "closing the manual restarted a game that was paused")
  r.ui.destroy()
  r.restore()
})

test("the game cannot resume its own sound from behind the manual", async () => {
  // Every game calls `audio.resume()` on any gesture, because Web Audio needs
  // one. A tap on the scrim still reaches those handlers in some games, and a
  // one-shot suspend would be undone by the first such tap. The hold has to
  // OUTLAST the open sheet, not fire once at the start of it.
  const r = rig()
  const ctx = r.gameAudio()
  r.ui.open()
  await settle()
  void ctx.resume()
  await settle()
  assert.equal(ctx.state, "suspended", "the game resumed itself while the manual was up")
  // ...and the intent is not thrown away: it wanted sound, so it gets sound.
  r.ui.close()
  await settle()
  assert.equal(ctx.state, "running", "the game's own resume was swallowed for good")
  r.ui.destroy()
  r.restore()
})

test("a context the game creates DURING the read is born silent", async () => {
  // Nothing says the context exists before the sheet does. A child who opens
  // the rules before ever touching the game leaves the first gesture — and so
  // the first `new AudioContext()` — until after the sheet is up.
  const r = rig()
  r.ui.open()
  await settle()
  const ctx = r.gameAudio()
  await settle()
  assert.equal(ctx.state, "suspended", "a context made behind the manual started playing")
  r.ui.close()
  await settle()
  assert.equal(ctx.state, "running")
  r.ui.destroy()
  r.restore()
})

test("unmounting while the manual is open does not leave the hold on", async () => {
  const r = rig()
  const ctx = r.gameAudio()
  r.ui.open()
  await settle()
  r.ui.destroy()
  await settle()
  assert.equal(ctx.state, "running", "the pack was torn down with its audio still held")
  r.restore()
})

test("the game sees no taps while the manual is open", async () => {
  // The scrim covers the game visually, but a pointer event on the scrim still
  // bubbles to whatever the game bound on its root or on `globalThis`. So the
  // sheet only LOOKED modal: tapping the background to dismiss it also fired a
  // shot, a shear or a swipe underneath. This is the same hole the key swallow
  // was written for, on the other input.
  const r = rig()
  r.ui.open()
  // The scrim is `inset:0`, so a tap "on the game" IS a tap on the scrim. The
  // canvas stands in for the rarer case of a game node that outranks it.
  const scrim = r.root.find("dwc-scrim")
  const canvas = new El("canvas")
  for (const t of ["pointermove", "pointerup", "touchstart", "mousedown", "wheel"]) {
    r.pointer(t, scrim)
    r.pointer(t, canvas)
  }
  assert.deepEqual(
    r.gameSawPointers,
    [],
    `the game saw ${r.gameSawPointers.join(",")} behind the manual`,
  )
  assert.equal(r.ui.isOpen, true, "the manual dismissed itself on a move")
  r.ui.destroy()
  r.restore()
})

test("a tap on the background closes the manual — and the game does not feel it", () => {
  // Both halves matter. Tap-to-dismiss is how most children close a sheet, and
  // it used to fire a shot on the way out.
  const r = rig()
  r.ui.open()
  const scrim = r.root.find("dwc-scrim")
  assert.equal(r.pointer("pointerdown", scrim).reachedGame, false, "the dismissing tap hit the game")
  assert.equal(r.ui.isOpen, false, "a tap on the background did not close the manual")
  r.ui.destroy()
  r.restore()
})

test("a tap INSIDE the sheet does not dismiss it", () => {
  // A child reading the manual touches it. Being thrown out of the rules
  // mid-read is worse than having to find the button.
  const r = rig()
  r.ui.open()
  r.pointer("pointerdown", r.root.find("dwc-body"))
  assert.equal(r.ui.isOpen, true, "touching the manual closed it")
  r.ui.destroy()
  r.restore()
})

test("but the sheet's own pointers still get through — it must stay draggable", async () => {
  // A swallow that ate the sheet's own gestures would take the drag dismissal,
  // the PLAY button and tap-to-close with it.
  const r = rig()
  r.ui.open()
  const grab = r.root.find("dwc-grab")
  const close = r.root.find("dwc-close")
  assert.equal(r.pointer("pointerdown", grab).reachedGame, true, "the grab handle was deafened")
  assert.equal(r.pointer("pointerup", close).reachedGame, true, "PLAY was deafened")
  r.ui.destroy()
  r.restore()
})

test("and nothing is swallowed once the manual is closed", async () => {
  // A gate stuck shut is the same bug as a gate stuck open. A game whose taps
  // stopped working after one read is worse than one that was noisy for ten
  // seconds.
  const r = rig()
  const scrim = r.root.find("dwc-scrim")
  r.ui.open()
  r.ui.close()
  for (const t of ["pointerdown", "pointerup", "touchstart"]) r.pointer(t, scrim)
  assert.deepEqual(
    r.gameSawPointers,
    ["pointerdown", "pointerup", "touchstart"],
    "the game was starved of input after the manual closed",
  )
  r.ui.destroy()
  r.restore()
})

test("the tap that OPENS the manual does not also fire the game underneath", async () => {
  // The help control is a pack element sitting over the playfield. Its tap
  // bubbled straight into the game, so opening the rules cost a move.
  const r = rig()
  const help = r.root.find("dwc-help")
  assert.equal(r.pointer("pointerdown", help).reachedGame, false, "opening the rules fired the game")
  r.ui.destroy()
  r.restore()
})

test("onOpen fires so a game can freeze its loop, exactly once per open", () => {
  // Sound is stopped for every game by construction. A game's SIMULATION cannot
  // be — the module has no idea what a game's loop is — so `onOpen` is the pair
  // to `onClose` for games that need to stop the clock as well as the noise.
  let opens = 0
  let closes = 0
  const r = rig({ onOpen: () => (opens += 1), onClose: () => (closes += 1) })
  r.ui.open()
  r.ui.open()
  assert.equal(opens, 1, "onOpen fired for an open that did not happen")
  assert.equal(closes, 0, "onClose fired before anything closed")
  r.ui.close()
  r.ui.close()
  assert.equal(closes, 1)
  r.ui.open()
  assert.equal(opens, 2, "the second read never told the game")
  r.ui.destroy()
  r.restore()
})

test("destroy takes every listener with it", () => {
  const r = rig()
  r.ui.open()
  r.ui.destroy()
  // The game must get its keyboard back the moment the pack unmounts.
  r.key("keydown", "Escape")
  assert.deepEqual(r.gameSawKeys, ["Escape"], "a key listener outlived the manual")
  assert.equal(r.root.has("dwc-scrim"), false, "the sheet outlived the manual")
  assert.equal(r.root.has("dwc-help"), false, "the help control outlived the manual")
  r.restore()
})
