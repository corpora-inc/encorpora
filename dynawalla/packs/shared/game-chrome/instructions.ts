/**
 * How to play, in one place, the same shape in every game.
 *
 * **Why this is shared.** Twenty-seven games each invented their own onboarding
 * or skipped it. SKY LEDGER shipped with a stats panel and the words "THE WATCH
 * IS WRITTEN DOWN" and nothing anywhere telling a child that they name a
 * coordinate on an astrolabe. Nobody can play a game they have not been taught,
 * and a child will not hunt for the rules — they will decide the game is broken
 * and leave.
 *
 * Twenty-seven bespoke panels would be twenty-seven slightly different
 * dismissals, twenty-seven type scales and twenty-seven bugs. So the *shape* is
 * here and the *content* is the game's, because "keep your side heavier" and
 * "draw only if the statement is true" are different lessons and cannot be
 * shared.
 *
 * **The two surfaces**, because one size does not fit:
 *   - `summary` — one or two lines, the splash. Enough to make the first move.
 *   - `sections` — the manual, behind a button. For games whose rules do not
 *     fit on a splash, which is most of the good ones.
 *
 * The manual stays reachable *during* play, not only before it. A child who
 * needs the rules needs them at the moment they are stuck, which is never the
 * title screen.
 *
 * **Why a bottom sheet and not a centred card.** The first version centred a
 * card at `max-height:82vh`. On a notched phone that puts its top edge around
 * 73px — and the host's exit chevron occupies 60px to 104px. They collided, and
 * the chevron ate the first two letters of the title in every game with a long
 * manual. That is not a z-index bug and no stacking order can fix it: the exit
 * control lives in the HOST document, above the iframe, so a pack cannot draw
 * over it and must instead lay out clear of it.
 *
 * A sheet rises from the bottom and is capped so its top edge can never reach
 * the host's corners. The clearance is arithmetic, not judgement, and
 * `sheetTop()` exposes it so a test can assert it at any viewport.
 *
 * **The game stops while the sheet is up, and it is not the game's job to
 * remember.** "I can hear counterweight playing in the background while I'm
 * reading the instructions ... it's so stressful I don't even want to QA it."
 * Pausing had been fixed per game five times by then and eleven of the
 * twenty-seven still had none, so it is fixed here instead, on all three of the
 * ways a game keeps running behind a scrim:
 *
 *   - **sound** — `audioHold` suspends every `AudioContext` the pack owns and
 *     holds it suspended. No import, no callback, no line in the game.
 *   - **keys** — the capture-phase swallow, below. Already here.
 *   - **taps** — the same swallow, for pointers. A scrim covers the game to the
 *     eye but a pointer event on it still bubbles to whatever the game bound on
 *     its root or on `globalThis`, so the sheet only LOOKED modal.
 *
 * What cannot be done from here is a game's own simulation clock: this module
 * has no idea what a game's loop is. That is what `onOpen`/`onClose` are for,
 * and they are the only part of pausing a game still has to opt into.
 */

import { safeInsets, onInsetsChange, type Insets } from "./insets.ts"
import { HOST_CONTROL, HOST_MARGIN, HOST_PROGRESS_H } from "./hostChrome.ts"
import { installAudioHold, holdAudio, releaseAudio } from "./audioHold.ts"

export type Section = { heading: string; lines: readonly string[] }

export type InstructionsSpec = {
  /** The game's name, as the child sees it. */
  readonly title: string
  /** One or two lines. The whole point of the game, in plain words. */
  readonly summary: readonly string[]
  /** The manual. Omit for a game whose summary really is the whole rule set. */
  readonly sections?: readonly Section[]
  /**
   * Called when the panel opens, so a game can stop its clock.
   *
   * Sound, keys and taps are already held for you and need nothing here — this
   * is only for a simulation that would otherwise keep advancing behind the
   * scrim: a wall that keeps rising, a runner that keeps running, a timer that
   * keeps counting down while a child reads why they lost.
   *
   * Opt-in, and opt-in is how the noise defect happened, so it is deliberately
   * NOT the mechanism for anything that could be done without it.
   */
  readonly onOpen?: () => void
  /** Called when the panel closes, so a game can resume. The pair to `onOpen`. */
  readonly onClose?: () => void
  /** Skip the entrance transition. Pass `host.prefersReducedMotion()`. */
  readonly reducedMotion?: boolean
}

export type Instructions = {
  /** Open the manual. Safe to call when already open. */
  open(): void
  /** Close it. Safe to call when already closed. */
  close(): void
  readonly isOpen: boolean
  /** Remove every node and listener. Call from `unmount`. */
  destroy(): void
}

const FONT = "system-ui,-apple-system,'Segoe UI',sans-serif"

/**
 * The highest the sheet's top edge may ever go, in CSS pixels from the top.
 *
 * Everything above this line belongs to the host: the progress hairline, the
 * exit chevron top-left and the how-to-play control top-right. The sheet stops
 * one margin below them, so the two never share a pixel however long the
 * manual is.
 *
 * Exported because "it clears the chrome" is a claim, and a claim in a
 * children's product should be assertable at every viewport rather than
 * eyeballed on one phone.
 */
export function sheetTop(insets: Insets = safeInsets()): number {
  return insets.top + HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + HOST_MARGIN
}

/** Drag further than this, or flick faster, and the sheet goes away. */
const DISMISS_PX = 96
const DISMISS_VELOCITY = 0.5

function styleSheet(reduced: boolean): string {
  // Motion is a branch, not a degradation: reduced motion still gets a
  // cross-fade so the sheet does not appear without explanation, it just does
  // not travel. `EXPERIENCE_DESIGN.md` is explicit that switching animation off
  // entirely is the wrong reading.
  const rise = reduced
    ? "dwc-fade 160ms ease-out both"
    : // The iOS sheet curve. It leaves fast and lands slowly, which is what
      // makes a panel feel thrown rather than dragged along by the machine.
      "dwc-rise 380ms cubic-bezier(.32,.72,0,1) both"
  return `
/* The hidden attribute must win. A UA stylesheet's [hidden]{display:none} is
   origin-weaker than any author display, so without this rule the scrim below
   renders the manual OVER the game from the moment it mounts — in every
   adopting game, on every launch. Specificity is not the issue; author beats
   UA. This rule must also come BEFORE the .dwc-scrim block, or the later
   display:flex wins on source order. */
.dwc-scrim[hidden]{display:none}
.dwc-scrim{position:absolute;inset:0;z-index:40;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(4,6,12,.66);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  font-family:${FONT};color:#f2eee4;overscroll-behavior:contain;
  animation:dwc-fade 240ms ease-out both}

.dwc-sheet{position:relative;display:flex;flex-direction:column;
  width:min(46rem,100%);
  /* max-height is written from JS on open and on every inset change: it is the
     height that keeps the sheet's top edge below the host's two corner
     controls; see sheetTop(). The 82% here is only what a sheet gets before the
     first measurement. */
  max-height:82%;
  border-radius:26px 26px 0 0;
  border:1px solid rgba(255,255,255,.13);border-bottom:0;
  background:linear-gradient(#161d2b,#0c1017);
  box-shadow:0 -18px 60px rgba(0,0,0,.6);
  animation:${rise};
  will-change:transform}
/* Suppressed while a finger is down, so the drag tracks 1:1 instead of easing
   towards where the finger was a frame ago. */
.dwc-sheet.dwc-drag{animation:none;transition:none}
.dwc-sheet.dwc-settle{animation:none;transition:transform 260ms cubic-bezier(.32,.72,0,1)}

/* The grab area is 44px of hit zone around a 40x5 pill. A bare pill is a 5px
   target, which no child hits and no adult enjoys missing. */
.dwc-grab{flex:none;height:44px;display:flex;align-items:center;justify-content:center;
  cursor:grab;touch-action:none;-webkit-tap-highlight-color:transparent}
.dwc-grab:active{cursor:grabbing}
.dwc-pill{width:40px;height:5px;border-radius:3px;background:rgba(255,255,255,.3)}
.dwc-grab:focus-visible{outline:3px solid #f3d089;outline-offset:-6px;border-radius:26px 26px 0 0}

.dwc-head{flex:none;padding:0 clamp(20px,5vw,32px) .55rem;touch-action:none}
.dwc-title{margin:0;font-size:clamp(1.3rem,4.2vw,1.85rem);font-weight:800;letter-spacing:-.02em}

.dwc-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  /* Every game sets touch-action:none on its root so a stray drag cannot pan
     the page. That also forbids the finger drag this body needs: overflow-y
     was live but unusable, and on a 320x568 phone about a third of the manual
     sat below the fold with no way to reach it. pan-y re-permits exactly the
     one gesture, and nothing else. */
  touch-action:pan-y;-webkit-overflow-scrolling:touch;
  padding:0 clamp(20px,5vw,32px);
  padding-bottom:.5rem}
.dwc-sum{margin:0 0 1.1rem;font-size:clamp(1rem,2.9vw,1.12rem);line-height:1.55;color:#dbe4f2}
.dwc-sum p{margin:.32rem 0}
.dwc-sec{margin:1.1rem 0 0}
.dwc-h{margin:0 0 .35rem;font-size:.76rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8fa3c4}
.dwc-l{margin:0;padding-left:1.1rem;line-height:1.6;font-size:clamp(.95rem,2.6vw,1.04rem)}
.dwc-l li{margin:.3rem 0}

/* The button is pinned, not appended. In the centred card it lived at the foot
   of the content, so in a game with five sections a child had to read or scroll
   the whole manual to find the way out of it. */
.dwc-foot{flex:none;position:relative;padding:.7rem clamp(20px,5vw,32px)}
/* Fades the text under the footer rather than guillotining it, so it stays
   visible that the manual continues. */
.dwc-foot::before{content:"";position:absolute;left:0;right:0;bottom:100%;height:28px;pointer-events:none;
  background:linear-gradient(rgba(12,16,23,0),#0c1017)}
.dwc-close{width:100%;min-height:52px;border:0;border-radius:14px;cursor:pointer;
  font:800 1rem/1 ${FONT};letter-spacing:.03em;color:#0b1020;background:#f3d089;
  -webkit-tap-highlight-color:transparent}
.dwc-close:focus-visible{outline:3px solid #f3d089;outline-offset:3px}

.dwc-help{position:absolute;z-index:30;min-width:${HOST_CONTROL}px;min-height:${HOST_CONTROL}px;border-radius:50%;
  border:1px solid rgba(255,255,255,.2);background:rgba(10,14,22,.62);color:#f2eee4;
  font:800 1.05rem/1 ${FONT};cursor:pointer;display:flex;align-items:center;justify-content:center}
.dwc-help:focus-visible{outline:3px solid #f3d089;outline-offset:2px}

@keyframes dwc-rise{from{transform:translateY(100%)}to{transform:none}}
@keyframes dwc-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.dwc-sheet{animation:dwc-fade 160ms ease-out both}}
`
}

/**
 * Mount the instructions surface into `root`.
 *
 * Adds a persistent help button positioned inside the safe area, and a sheet it
 * opens. The button is `HOST_CONTROL` in both axes — the smallest target a
 * child reliably hits, and the platform floor.
 */
export function createInstructions(root: HTMLElement, spec: InstructionsSpec): Instructions {
  // Mounting the manual is what arms the audio hold. It is idempotent and it
  // runs at import too; doing it here as well is what covers a bundle that
  // evaluated a game's audio module before this one.
  installAudioHold()

  // Identity, not DOM traversal. The pointer swallow has to answer "is this
  // event ours?" and the twenty-seven games mount against hand-rolled fake
  // elements with no `contains`, no `closest` and no `parentNode` — the same
  // trap that `style.setProperty` and `classList` fell into. A Set of the nodes
  // this module made needs nothing from the DOM at all.
  const ours = new Set<unknown>()
  const mine = <T>(el: T): T => {
    ours.add(el)
    return el
  }

  const reduced = spec.reducedMotion === true
  const style = document.createElement("style")
  style.textContent = styleSheet(reduced)
  root.appendChild(style)

  const help = mine(document.createElement("button"))
  help.type = "button"
  help.className = "dwc-help"
  help.textContent = "?"
  help.setAttribute("aria-label", `How to play ${spec.title}`)

  const scrim = mine(document.createElement("div"))
  scrim.className = "dwc-scrim"
  scrim.hidden = true

  const sheet = mine(document.createElement("div"))
  sheet.className = "dwc-sheet"
  // State goes on `className`, never `classList`. The 27 games mount against
  // hand-rolled fake elements that expose `className` and nothing else, so a
  // `classList.remove` here is a TypeError in FOUNDRY and LATTICE the moment a
  // child opens the manual. The module must speak only the vocabulary its
  // adopters implement — every defect this module has shipped came from
  // assuming a richer environment than the one it actually runs in.
  const sheetClass = (mod?: "dwc-drag" | "dwc-settle"): void => {
    sheet.className = mod ? `dwc-sheet ${mod}` : "dwc-sheet"
  }
  sheet.setAttribute("role", "dialog")
  sheet.setAttribute("aria-modal", "true")
  sheet.setAttribute("aria-label", `How to play ${spec.title}`)
  sheet.tabIndex = -1

  const grab = mine(document.createElement("div"))
  grab.className = "dwc-grab"
  // It is a control: it dismisses the sheet by drag. Announce it as one rather
  // than leaving a silent div a screen reader walks straight past.
  grab.setAttribute("role", "button")
  grab.setAttribute("aria-label", "Close how to play")
  grab.tabIndex = 0
  const pill = mine(document.createElement("div"))
  pill.className = "dwc-pill"
  grab.appendChild(pill)

  const head = mine(document.createElement("div"))
  head.className = "dwc-head"
  const h = mine(document.createElement("h2"))
  h.className = "dwc-title"
  h.textContent = spec.title
  head.appendChild(h)

  const body = mine(document.createElement("div"))
  body.className = "dwc-body"

  const sum = mine(document.createElement("div"))
  sum.className = "dwc-sum"
  for (const line of spec.summary) {
    const p = mine(document.createElement("p"))
    p.textContent = line
    sum.appendChild(p)
  }
  body.appendChild(sum)

  for (const sec of spec.sections ?? []) {
    const wrap = mine(document.createElement("section"))
    wrap.className = "dwc-sec"
    const sh = mine(document.createElement("h3"))
    sh.className = "dwc-h"
    sh.textContent = sec.heading
    const ul = mine(document.createElement("ul"))
    ul.className = "dwc-l"
    for (const line of sec.lines) {
      const li = mine(document.createElement("li"))
      li.textContent = line
      ul.appendChild(li)
    }
    wrap.append(sh, ul)
    body.appendChild(wrap)
  }

  const foot = mine(document.createElement("div"))
  foot.className = "dwc-foot"
  const close = mine(document.createElement("button"))
  close.type = "button"
  close.className = "dwc-close"
  close.textContent = "PLAY"
  foot.appendChild(close)

  sheet.append(grab, head, body, foot)
  scrim.appendChild(sheet)
  root.append(help, scrim)

  // The help button sits at exactly the rect `hostChrome.helpRect()` reports —
  // games lay out against that rect, so a button three pixels off it makes
  // every one of those clearance tests a near-miss.
  // Plain property assignment, not `style.setProperty` and a CSS custom
  // property. The indirection bought nothing and cost four games: their
  // mount-level test harnesses fake `style` as an object with named fields, so
  // `setProperty` threw and BEAM, COUNTERWEIGHT, FOUNDRY and LATTICE all failed
  // to render at every viewport. `help.style.top` was already the idiom that
  // works in all 27 harnesses; there was no reason to invent a second one.
  const place = (): void => {
    const i = safeInsets()
    help.style.top = `${i.top + HOST_PROGRESS_H + HOST_MARGIN}px`
    help.style.right = `${i.right + HOST_MARGIN}px`
    sheet.style.maxHeight = `calc(100% - ${sheetTop(i)}px)`
    foot.style.paddingBottom = `calc(.7rem + ${i.bottom}px)`
  }
  place()
  const stopInsets = onInsetsChange(place)

  let open = false
  let restore: HTMLElement | null = null
  let dragging = false
  let startY = 0
  let startAt = 0
  let dy = 0

  const doOpen = (): void => {
    if (open) return
    open = true
    // Before anything is drawn. The sheet takes 380ms to arrive and a child
    // should not hear the game for those 380ms.
    holdAudio()
    restore = (document.activeElement as HTMLElement) ?? null
    place()
    sheetClass()
    sheet.style.transform = ""
    scrim.style.opacity = ""
    scrim.hidden = false
    help.setAttribute("aria-expanded", "true")
    body.scrollTop = 0
    sheet.focus()
    spec.onOpen?.()
  }

  const doClose = (): void => {
    if (!open) return
    open = false
    dragging = false
    sheetClass()
    sheet.style.transform = ""
    scrim.style.opacity = ""
    scrim.hidden = true
    help.setAttribute("aria-expanded", "false")
    restore?.focus?.()
    restore = null
    releaseAudio()
    spec.onClose?.()
  }

  // ---- drag to dismiss -----------------------------------------------------
  // Only from the grab area and the title row. Dragging from the body would
  // fight the scroll it needs, and a manual that sometimes scrolls and
  // sometimes flies away is worse than one that only scrolls.
  const onDown = (e: PointerEvent): void => {
    if (!open || e.button !== 0) return
    dragging = true
    startY = e.clientY
    startAt = e.timeStamp
    dy = 0
    sheetClass("dwc-drag")
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return
    // Down only. An upward drag would otherwise lift the sheet into the host
    // chrome — the exact collision this shape exists to prevent.
    dy = Math.max(0, e.clientY - startY)
    sheet.style.transform = `translateY(${dy}px)`
    const h = sheet.offsetHeight || 1
    scrim.style.opacity = String(Math.max(0.15, 1 - dy / h))
  }

  const onUp = (e: PointerEvent): void => {
    if (!dragging) return
    dragging = false
    ;(e.currentTarget as Element).releasePointerCapture?.(e.pointerId)
    const ms = Math.max(1, e.timeStamp - startAt)
    sheetClass()
    if (dy > DISMISS_PX || dy / ms > DISMISS_VELOCITY) {
      doClose()
      return
    }
    // Not far enough: put it back, visibly, so the gesture reads as refused
    // rather than ignored.
    sheetClass("dwc-settle")
    sheet.style.transform = ""
    scrim.style.opacity = ""
  }

  // While the sheet is up, the game must not see a key. The sheet's own div is
  // `tabIndex=-1` and consumes nothing, so a Space or Enter meant to dismiss the
  // manual fell straight through to whatever the game bound on `globalThis` —
  // in one game that fired a shear, reported a wrong answer and cost the child
  // lane cells, all behind the scrim where they could not see it. Capture phase,
  // so it runs before any listener the game registered.
  const swallow = (e: KeyboardEvent): void => {
    if (!open) return
    // Escape is handled HERE, in capture, and stopped like every other key.
    // Letting it through so a bubble handler could close the sheet meant the
    // game saw it too: one game starts a fresh run on any key, so a child who
    // opened the rules after dying and pressed Escape to close them lost their
    // score, combo and best combo to the act of reading. preventDefault was
    // never enough — it stops the browser's default, not another listener.
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      if (e.type === "keydown") doClose()
      return
    }
    // The grab handle is focusable and announces itself as a button, so it must
    // answer a keyboard the way it answers a finger.
    if ((e.key === "Enter" || e.key === " ") && document.activeElement === grab) {
      e.preventDefault()
      e.stopPropagation()
      if (e.type === "keydown") doClose()
      return
    }
    // Keep focus in the dialog while it is modal. This lives in the same
    // capture handler as everything else: a bubble-phase listener would never
    // run, because the stopPropagation below is what keeps keys off the game.
    if (e.key === "Tab" && e.type === "keydown") {
      e.preventDefault()
      close.focus()
    }
    e.stopPropagation()
  }
  globalThis.addEventListener("keydown", swallow, true)
  globalThis.addEventListener("keyup", swallow, true)

  // The same swallow, for the other input.
  //
  // The scrim covers the game to the eye, but a pointer event that lands on it
  // still travels to whatever the game bound on its canvas, its root or
  // `globalThis` — so the sheet only LOOKED modal. Tapping the background to
  // dismiss the manual also fired a shot, a shear or a swipe underneath it, and
  // in the eleven games with no gating of their own that is the whole of what
  // "the game keeps playing while I read" means for touch.
  //
  // Ours pass and everything else stops. `stopPropagation` in capture prevents
  // an event reaching its own target's listeners too, so stopping one of our
  // nodes would take the drag dismissal, PLAY and tap-to-close with it.
  //
  // `pointerup` is swallowed along with the rest, which means a game holding a
  // drag when the sheet opens does not get the release that ends it. That is the
  // same trade the key swallow already makes with `keyup`, and it is the right
  // way round: letting "up" through would fire every game that acts on release,
  // which is most of them, and the drag can only have been started by a finger
  // that is about to be lifted anyway.
  const POINTERS = [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "mousedown",
    "mousemove",
    "mouseup",
    "touchstart",
    "touchmove",
    "touchend",
    "touchcancel",
    "wheel",
    "contextmenu",
    "click",
    "dblclick",
  ] as const

  const swallowPointer = (e: Event): void => {
    // The tap that OPENS the manual is a tap on one of ours, so the rule below
    // would let it through to the game as well — and opening the rules cost a
    // move. The help control is handled in both directions: its gestures never
    // reach the game, and its `click`, which is what actually opens the sheet,
    // is left alone whether the sheet is up or not.
    if (e.target === help) {
      if (e.type !== "click" && e.type !== "dblclick") e.stopPropagation()
      return
    }
    // The scrim IS the background. It is `inset:0`, so a tap "on the game" is a
    // tap on the scrim, and letting our own elements through unconditionally
    // would have let every one of those reach the game — which is the whole
    // defect, not an edge of it.
    //
    // So closing on a background tap is done HERE, in capture, for the same
    // reason Escape is: a bubble listener on the scrim could only run if the
    // event were allowed to travel, and allowing it to travel is what feeds the
    // game. Children tap the background constantly, and a tap inside the sheet
    // must still not dismiss it — being thrown out of the rules mid-read is
    // worse than having to find the button.
    if (e.target === scrim) {
      if (!open) return
      e.stopPropagation()
      if (e.type === "pointerdown") doClose()
      return
    }
    if (ours.has(e.target)) return
    if (open) e.stopPropagation()
    // Closed, and not one of ours: the game is being played and must hear every
    // one of them. A gate stuck shut is the same bug as a gate stuck open.
  }

  for (const t of POINTERS) globalThis.addEventListener(t, swallowPointer, true)

  const draggers = [grab, head]
  help.addEventListener("click", doOpen)
  close.addEventListener("click", doClose)
  for (const el of draggers) {
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointercancel", onUp)
  }

  return {
    open: doOpen,
    close: doClose,
    get isOpen(): boolean {
      return open
    },
    destroy(): void {
      // A pack torn down mid-read must not leave the sound held: the hold is
      // process-wide and nothing would ever come back to lift it.
      if (open) {
        open = false
        releaseAudio()
      }
      stopInsets()
      globalThis.removeEventListener("keydown", swallow, true)
      globalThis.removeEventListener("keyup", swallow, true)
      for (const t of POINTERS) globalThis.removeEventListener(t, swallowPointer, true)
      help.removeEventListener("click", doOpen)
      close.removeEventListener("click", doClose)
      for (const el of draggers) {
        el.removeEventListener("pointerdown", onDown)
        el.removeEventListener("pointermove", onMove)
        el.removeEventListener("pointerup", onUp)
        el.removeEventListener("pointercancel", onUp)
      }
      help.remove()
      scrim.remove()
      style.remove()
    },
  }
}
