import {
  HOST_CONTROL,
  HOST_MARGIN,
  HOST_PROGRESS_H,
  type Insets,
  type Rect,
} from "../../../../packs/shared/game-chrome/index.ts"
import { RIVAL_NAMES, type World } from "../sim/world.ts"
import { DEPTHS } from "../sim/depths.ts"

const DEPTH_COUNT = DEPTHS.length

/**
 * The chrome. Deliberately almost nothing.
 *
 * There is no tutorial, no objective text, no status narration and no score
 * screen, because the arena states its own rule with a picture and a child
 * reads it in three seconds. What is left is the ladder — which is the reason
 * to keep going — the depth you are in, and, during a Resonance, the question.
 *
 * Nothing here reflows per frame. Text nodes are written only when the value
 * they show actually changes.
 *
 * **The host draws over this.** A back chevron floats in the top-LEFT corner
 * and the how-to-play button in the top-RIGHT, both 44px, both painted by
 * something that is not this game. The depth readout used to start at 14,14 and
 * the ladder at 14 from the right, so the chevron sat on the depth name and the
 * question mark sat on the top of the ladder. Nothing reserves a band — that
 * costs a twelfth of a small phone to hold two buttons — so the readouts drop
 * below the two corners instead and the water still fills the glass.
 */

/**
 * How far below the safe top edge the readouts start.
 *
 * Derived from the host's own numbers rather than typed, so if the host moves
 * its chrome this game follows on the next build instead of drifting.
 */
export const HUD_TOP = HOST_PROGRESS_H + HOST_MARGIN + HOST_CONTROL + 6

/** Gap from the safe left/right edge, for the two readouts. */
export const HUD_EDGE = 14

/** Widest the ladder gets, and the tallest six rows plus their gaps come to. */
export const BOARD_W = 112
export const BOARD_H = 138

/** The depth block: name, RANK line, nine pips. Measured at the largest step. */
export const DEPTH_W = 220
export const DEPTH_H = 62

/** Gap from the safe left/right edge for the Resonance question. */
export const Q_EDGE = 12

/**
 * THE RIBBON — the running equation.
 *
 * The founder's idea and the best one in the batch: "it might be nice to have
 * an animation of the math as we 'eat' numbers it could show the simple
 * equation, maybe fixed to the bottom that replaces as it goes: 10 + 4 = 14 /
 * 14 + 10 = 24 / 24 - 5 = 19". It turns eating numbers into arithmetic that is
 * VISIBLE and reviewable rather than implicit, which is the difference between
 * a growth game with numbers on it and a maths game.
 *
 * Three constraints decide where it goes, and all three are asserted in
 * `layout.test.ts` rather than eyeballed on one phone:
 *
 *   * clear of the host's two 44px corners — it is a thing a child reads;
 *   * clear of the safe-area insets on every edge it touches;
 *   * clear of ARENA's own bottom-left sound button and bottom-right perf
 *     readout, which are 44px and sit exactly where a bottom strip wants to be.
 *
 * `RIBBON_LIFT` is that third clearance: the button row is 44 tall on a 12px
 * bottom margin, so the ribbon's own bottom edge starts above all of it.
 */
export const RIBBON_LIFT = 56
export const RIBBON_H = 40
export const RIBBON_EDGE = 12
export const RIBBON_MAX_W = 460

/**
 * Where the readouts land, in numbers, so a test can assert they clear the
 * host's two corners at every viewport instead of a device finding out.
 *
 * These mirror the CSS below them exactly, because the CSS is built from the
 * same constants. Change one and the other moves with it.
 *
 * The ladder is anchored by its RIGHT edge and shrink-to-fit, so a long rival
 * name grows it leftwards, away from the corner it has to clear. `BOARD_W` is
 * therefore a floor and the rect is still the truthful one to test.
 */
export function hudRects(
  w: number,
  insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 },
  h = 0,
): { depth: Rect; board: Rect; question: Rect; ribbon: Rect } {
  const top = insets.top + HUD_TOP
  const left = Math.max(HUD_EDGE, insets.left)
  const right = Math.max(HUD_EDGE, insets.right)
  const qLeft = Math.max(Q_EDGE, insets.left)
  const qRight = Math.max(Q_EDGE, insets.right)

  // The ribbon is anchored to the BOTTOM, so it is the one readout whose rect
  // needs the viewport height. It is centred inside the safe edges and capped,
  // exactly as the CSS below does it.
  const rLeft = Math.max(RIBBON_EDGE, insets.left)
  const rRight = Math.max(RIBBON_EDGE, insets.right)
  const rAvail = Math.max(0, w - rLeft - rRight)
  const rW = Math.min(RIBBON_MAX_W, rAvail)
  const rBottom = Math.max(RIBBON_EDGE, insets.bottom) + RIBBON_LIFT
  return {
    depth: { x: left, y: top, w: Math.min(DEPTH_W, w - left - right), h: DEPTH_H },
    board: { x: Math.max(0, w - right - BOARD_W), y: top, w: BOARD_W, h: BOARD_H },
    question: { x: qLeft, y: top, w: Math.max(0, w - qLeft - qRight), h: 96 },
    ribbon: { x: rLeft + (rAvail - rW) / 2, y: h - rBottom - RIBBON_H, w: rW, h: RIBBON_H },
  }
}

/**
 * The 44px square ARENA's own sound button occupies, bottom-LEFT.
 *
 * Exported for the same reason `hudRects` is: the ribbon has to clear it, and
 * "has to clear it" is a claim a test should be able to check rather than a
 * claim a comment makes.
 */
export function soundRect(h: number, insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 }): Rect {
  const bottom = Math.max(12, insets.bottom)
  return { x: Math.max(12, insets.left), y: h - bottom - 44, w: 44, h: 44 }
}

const CSS = `
.arena-hud{position:absolute;inset:0;pointer-events:none;font-family:ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#cfefff;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow:hidden}
.arena-hud *{box-sizing:border-box}
.arena-depth{position:absolute;top:calc(env(safe-area-inset-top) + ${HUD_TOP}px);left:max(${HUD_EDGE}px,env(safe-area-inset-left));
  max-width:${DEPTH_W}px;
  font-size:clamp(11px,2.4vw,15px);letter-spacing:.30em;font-weight:800;opacity:.82;
  text-shadow:0 0 18px rgba(80,220,255,.55),0 2px 6px rgba(0,0,0,.9)}
.arena-depth b{display:block;font-size:clamp(9px,1.7vw,11px);letter-spacing:.22em;opacity:.55;font-weight:700;margin-top:3px}
.arena-pips{display:flex;gap:3px;margin-top:6px}
.arena-pip{width:9px;height:3px;border-radius:2px;background:rgba(160,225,255,.20);transition:background .5s,box-shadow .5s}
.arena-pip.on{background:#ffd479;box-shadow:0 0 9px rgba(255,200,110,.85)}
.arena-board{position:absolute;top:calc(env(safe-area-inset-top) + ${HUD_TOP}px);right:max(${HUD_EDGE}px,env(safe-area-inset-right));
  min-width:${BOARD_W}px;display:flex;flex-direction:column;gap:2px;align-items:stretch}
.arena-row{display:flex;justify-content:space-between;gap:10px;font-size:clamp(10px,2.1vw,13px);
  letter-spacing:.12em;font-weight:700;opacity:.5;font-variant-numeric:tabular-nums;
  padding:2px 7px;border-radius:3px;transition:opacity .25s}
.arena-row.me{opacity:1;background:linear-gradient(90deg,rgba(80,230,255,0),rgba(80,230,255,.20));
  box-shadow:inset 0 0 0 1px rgba(140,240,255,.28);color:#eafcff}
.arena-row .n{opacity:.72}
.arena-row .v{font-weight:800}
/* THE RIBBON. Pinned above the button row, centred inside the safe edges, and
   carrying its OWN scrim — a plate and a blur — because the frame behind it can
   legitimately be a white bloom-out and a maths product may not have the one
   line of arithmetic on screen be the thing that disappears. Tabular numerals,
   so a replacing line does not jitter its own digits sideways. */
.arena-eq{position:absolute;left:max(${RIBBON_EDGE}px,env(safe-area-inset-left));right:max(${RIBBON_EDGE}px,env(safe-area-inset-right));
  bottom:calc(max(${RIBBON_EDGE}px,env(safe-area-inset-bottom)) + ${RIBBON_LIFT}px);
  max-width:${RIBBON_MAX_W}px;margin-inline:auto;height:${RIBBON_H}px;
  display:grid;place-items:center;pointer-events:none}
.arena-eq>span{display:inline-block;padding:6px 16px;border-radius:8px;
  background:rgba(2,10,20,.72);box-shadow:inset 0 0 0 1px rgba(140,235,255,.20),0 2px 14px rgba(0,0,0,.55);
  backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  font-size:clamp(15px,4.2vw,26px);font-weight:800;letter-spacing:.06em;font-variant-numeric:tabular-nums;
  color:#eafcff;text-shadow:0 1px 3px rgba(0,0,0,.95);white-space:nowrap;
  opacity:0;transform:translateY(5px) scale(.97);
  transition:opacity .16s,transform .26s cubic-bezier(.16,1.2,.3,1)}
.arena-eq.on>span{opacity:1;transform:none}
/* The maths moment gets the ribbon too, and gets it LOUDER. A right answer is
   the biggest thing that happens in this game and the sum that earned it should
   be the biggest thing in the strip. */
.arena-eq.solved>span{background:rgba(6,26,20,.80);color:#ffffff;
  box-shadow:inset 0 0 0 1px rgba(150,255,220,.55),0 0 30px rgba(120,255,210,.45),0 2px 14px rgba(0,0,0,.6);
  font-size:clamp(19px,5.6vw,34px)}
/* The reveal. A quieter celebration, never a correction: the same plate, a cool
   calm light instead of the green flare, and no red anywhere. */
.arena-eq.reveal>span{background:rgba(4,18,32,.80);color:#eafcff;
  box-shadow:inset 0 0 0 1px rgba(150,220,255,.45),0 0 22px rgba(110,190,255,.28),0 2px 14px rgba(0,0,0,.6);
  font-size:clamp(17px,5vw,30px)}
.arena-combo{position:absolute;left:50%;bottom:calc(max(16px,env(safe-area-inset-bottom)) + ${RIBBON_LIFT + RIBBON_H + 8}px);transform:translate(-50%,0);
  font-size:clamp(14px,4vw,26px);font-weight:900;letter-spacing:.10em;opacity:0;transition:opacity .18s;
  text-shadow:0 0 26px rgba(120,255,220,.7),0 2px 8px rgba(0,0,0,.9);font-variant-numeric:tabular-nums}
.arena-combo.on{opacity:.95}
/* The one frame in the game that asks a direct question, so it is the one that
   may least afford to sit under a notch or under a button. It is pinned to the
   SAFE left and right edges and centred inside them — 94vw was centred on the
   glass, which in landscape put a sixty-pixel numeral half under the sensor
   housing on the notched side. */
.arena-q{position:absolute;left:max(${Q_EDGE}px,env(safe-area-inset-left));right:max(${Q_EDGE}px,env(safe-area-inset-right));
  top:calc(env(safe-area-inset-top) + ${HUD_TOP}px);max-width:760px;margin-inline:auto;transform:translateY(-14px);
  opacity:0;transition:opacity .22s cubic-bezier(.2,.9,.2,1),transform .34s cubic-bezier(.2,.9,.2,1);
  text-align:center;text-wrap:balance}
.arena-q.on{opacity:1;transform:none}
.arena-q .p{font-size:clamp(26px,7.4vw,60px);font-weight:900;letter-spacing:.01em;color:#fff;line-height:1.05;
  text-shadow:0 0 40px rgba(150,235,255,.85),0 0 90px rgba(90,180,255,.45),0 3px 12px rgba(0,0,0,.95)}
/* During a Resonance the question owns the screen. The ladder used to sit
   straight underneath a 60px prompt and the two printed through each other. */
.arena-hud.asking .arena-board,.arena-hud.asking .arena-depth{opacity:.10}
.arena-board,.arena-depth{transition:opacity .22s}
.arena-q .k{font-size:clamp(9px,2.1vw,12px);letter-spacing:.42em;font-weight:800;opacity:.6;margin-bottom:6px}
.arena-verdict{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.86);opacity:0;
  font-size:clamp(22px,7vw,52px);font-weight:900;letter-spacing:.16em;
  transition:opacity .2s,transform .35s cubic-bezier(.16,1.2,.3,1);text-shadow:0 0 40px currentColor,0 2px 10px rgba(0,0,0,.9)}
.arena-verdict.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.arena-btns{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));
  display:flex;gap:8px;pointer-events:auto}
/* 44×44 of hit area around a 34×34 face. The only interactive control in the
   game may not be smaller than a child's fingertip; the plate stays small so
   the chrome stays almost nothing. */
.arena-btn{width:44px;height:44px;padding:5px;border:0;background:none;cursor:pointer;
  display:grid;place-items:center;transition:opacity .2s;opacity:.42}
.arena-btn>i{width:34px;height:34px;border-radius:9px;border:1px solid rgba(140,235,255,.22);
  background:rgba(6,20,34,.55);color:#bfeaff;font-size:13px;font-weight:800;font-style:normal;
  display:grid;place-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
  transition:transform .12s,border-color .2s}
.arena-btn:hover,.arena-btn:focus-visible{opacity:1;outline:none}
.arena-btn:hover>i,.arena-btn:focus-visible>i{border-color:rgba(140,235,255,.6)}
.arena-btn:active>i{transform:scale(.92)}
/* Muted is a STRUCK-THROUGH note, not a dimmer one. Opacity alone is meaning
   carried by nothing a child can name, and this product does not do that. */
.arena-btn.off{opacity:.32}
.arena-btn.off>i{text-decoration:line-through;text-decoration-thickness:2px}
.arena-perf{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));
  font-size:10px;letter-spacing:.14em;opacity:.28;font-variant-numeric:tabular-nums;font-weight:700}
@media (max-width:360px){.arena-board{min-width:92px}}
@media (prefers-reduced-motion:reduce){.arena-q,.arena-verdict,.arena-combo,.arena-btn,.arena-eq>span{transition-duration:.01ms}}
`

const ROWS = 6

export class Hud {
  readonly root: HTMLDivElement
  private depthEl: HTMLDivElement
  private depthSub: HTMLElement
  private rows: { el: HTMLDivElement; name: HTMLSpanElement; val: HTMLSpanElement }[] = []
  private comboEl: HTMLDivElement
  private eqEl: HTMLDivElement
  private eqText: HTMLSpanElement
  private qEl: HTMLDivElement
  private qPrompt: HTMLDivElement
  private verdictEl: HTMLDivElement
  private perfEl: HTMLDivElement
  private muteBtn: HTMLButtonElement
  private pips: HTMLSpanElement[] = []

  private lastDepth = -1
  private lastCombo = -1
  private lastQ = ""
  private lastEarned = -1
  private asking = false
  private lastRank = -1
  private readonly boardIdx = new Int32Array(ROWS)
  private readonly boardMass = new Float32Array(ROWS)
  private readonly lastRowKey: string[] = new Array(ROWS).fill("")
  private boardTimer = 0
  private verdictTimer = 0
  private lastEqSeq = -1
  private eqTimer = 0
  /**
   * Seconds the maths moment's own equation owns the ribbon.
   *
   * While this is running the ordinary mass ledger cannot overwrite it, and it
   * has to be able to: a correct answer clears every mote inside seven player
   * radii, so the frame after "3 + 5 = 8" carries a dozen absorbs that would
   * otherwise wipe the sum off the screen before a child had read it.
   */
  private eqHold = 0

  constructor(container: HTMLElement, onToggleSound: (on: boolean) => boolean) {
    const style = document.createElement("style")
    style.textContent = CSS
    container.appendChild(style)

    this.root = document.createElement("div")
    this.root.className = "arena-hud"

    this.depthEl = document.createElement("div")
    this.depthEl.className = "arena-depth"
    this.depthSub = document.createElement("b")
    this.depthEl.appendChild(document.createTextNode(""))
    this.depthEl.appendChild(this.depthSub)

    // The rungs. Wordless, permanent, and the only thing on screen that only
    // ever goes up — a child can see at a glance that five minutes of play
    // actually went somewhere.
    const pipRow = document.createElement("div")
    pipRow.className = "arena-pips"
    for (let i = 0; i < DEPTH_COUNT; i++) {
      const pip = document.createElement("span")
      pip.className = "arena-pip"
      pipRow.appendChild(pip)
      this.pips.push(pip)
    }
    this.depthEl.appendChild(pipRow)

    const board = document.createElement("div")
    board.className = "arena-board"
    for (let i = 0; i < ROWS; i++) {
      const el = document.createElement("div")
      el.className = "arena-row"
      const name = document.createElement("span")
      name.className = "n"
      const val = document.createElement("span")
      val.className = "v"
      el.appendChild(name)
      el.appendChild(val)
      board.appendChild(el)
      this.rows.push({ el, name, val })
    }

    this.comboEl = document.createElement("div")
    this.comboEl.className = "arena-combo"

    this.eqEl = document.createElement("div")
    this.eqEl.className = "arena-eq"
    this.eqText = document.createElement("span")
    this.eqEl.appendChild(this.eqText)

    this.qEl = document.createElement("div")
    this.qEl.className = "arena-q"
    const k = document.createElement("div")
    k.className = "k"
    k.textContent = "RESONANCE"
    this.qPrompt = document.createElement("div")
    this.qPrompt.className = "p"
    this.qEl.appendChild(k)
    this.qEl.appendChild(this.qPrompt)

    this.verdictEl = document.createElement("div")
    this.verdictEl.className = "arena-verdict"

    const btns = document.createElement("div")
    btns.className = "arena-btns"
    this.muteBtn = document.createElement("button")
    this.muteBtn.className = "arena-btn"
    this.muteBtn.type = "button"
    this.muteBtn.setAttribute("aria-label", "Sound")
    this.muteBtn.setAttribute("aria-pressed", "true")
    const note = document.createElement("i")
    note.textContent = "♪"
    this.muteBtn.appendChild(note)
    this.muteBtn.addEventListener("click", () => {
      const on = onToggleSound(this.muteBtn.classList.contains("off"))
      this.muteBtn.classList.toggle("off", !on)
      this.muteBtn.setAttribute("aria-pressed", String(on))
    })
    btns.appendChild(this.muteBtn)

    this.perfEl = document.createElement("div")
    this.perfEl.className = "arena-perf"

    this.root.append(this.depthEl, board, this.comboEl, this.eqEl, this.qEl, this.verdictEl, btns, this.perfEl)
    container.appendChild(this.root)
  }

  private setRungs(band: number): void {
    if (band === this.lastEarned) return
    this.lastEarned = band
    for (let i = 0; i < this.pips.length; i++) this.pips[i]!.classList.toggle("on", i <= band)
  }

  /**
   * The equation for one piece of arithmetic. Formatting only — the numbers are
   * decided in the simulation, where they are guaranteed consistent.
   *
   * U+2212 MINUS SIGN, not a hyphen: this is a maths product and the glyph a
   * child reads on a worksheet is the one they should read here.
   */
  static line(a: number, d: number, c: number): string {
    return d < 0 ? `${a} − ${-d} = ${c}` : `${a} + ${d} = ${c}`
  }

  /**
   * Put a whole piece of arithmetic in the ribbon and hold it there.
   *
   * `solved` is the celebration; `reveal` is the patient completion after a
   * miss. The reveal is deliberately styled as a quieter version of the
   * celebration rather than as its opposite — no red, no cross, nothing a child
   * could read as being told off. It is the same sum, shown calmly.
   */
  showEquation(text: string, seconds: number, kind: "solved" | "reveal"): void {
    this.eqText.textContent = text
    this.eqEl.classList.remove("solved", "reveal")
    this.eqEl.classList.add("on", kind)
    this.eqTimer = seconds
    this.eqHold = seconds
  }

  showVerdict(text: string, color: string): void {
    this.verdictEl.textContent = text
    this.verdictEl.style.color = color
    this.verdictEl.classList.add("on")
    this.verdictTimer = 1.1
  }

  update(world: World, dt: number, fps: number, tier: string, showPerf: boolean): void {
    if (world.depth.index !== this.lastDepth) {
      this.lastDepth = world.depth.index
      this.depthEl.firstChild!.textContent = world.depth.name
    }
    const rank = world.rank()
    if (rank !== this.lastRank) {
      this.lastRank = rank
      this.depthSub.textContent = `RANK ${rank}`
    }

    this.boardTimer -= dt
    if (this.boardTimer <= 0) {
      this.boardTimer = 0.22
      const n = world.leaderboard(this.boardIdx, this.boardMass)
      for (let i = 0; i < ROWS; i++) {
        const row = this.rows[i]!
        if (i >= n) {
          if (this.lastRowKey[i] !== "") {
            row.el.style.display = "none"
            this.lastRowKey[i] = ""
          }
          continue
        }
        const idx = this.boardIdx[i] as number
        const mass = Math.round(this.boardMass[i] as number)
        const me = idx === -1
        const nm = me ? "YOU" : (RIVAL_NAMES[world.rname[idx] as number] ?? "———")
        const key = `${nm}|${mass}`
        if (this.lastRowKey[i] !== key) {
          this.lastRowKey[i] = key
          row.el.style.display = ""
          row.name.textContent = nm
          row.val.textContent = String(mass)
          row.el.classList.toggle("me", me)
        }
      }
    }

    const c = world.combo
    if (c !== this.lastCombo) {
      this.lastCombo = c
      if (c >= 3) {
        this.comboEl.textContent = `×${c}`
        this.comboEl.classList.add("on")
      } else {
        this.comboEl.classList.remove("on")
      }
    }

    // The ribbon. Every change to the player's own number, replacing as it goes.
    this.eqHold = Math.max(0, this.eqHold - dt)
    if (world.eqSeq !== this.lastEqSeq) {
      this.lastEqSeq = world.eqSeq
      if (this.eqHold <= 0) {
        this.eqText.textContent = Hud.line(world.eqA, world.eqD, world.eqC)
        this.eqEl.classList.add("on")
        this.eqEl.classList.remove("solved", "reveal")
        this.eqTimer = 2.6
      }
    }
    if (this.eqTimer > 0) {
      this.eqTimer -= dt
      if (this.eqTimer <= 0) this.eqEl.classList.remove("on", "solved", "reveal")
    }

    this.setRungs(world.depth.index)

    const res = world.resonance
    const asking = res.active && res.phase >= 1
    if (asking !== this.asking) {
      this.asking = asking
      this.root.classList.toggle("asking", asking)
    }
    const q = asking && res.question ? res.question.prompt : ""
    if (q !== this.lastQ) {
      this.lastQ = q
      if (q) {
        this.qPrompt.textContent = q
        this.qEl.classList.add("on")
      } else {
        this.qEl.classList.remove("on")
      }
    }

    if (this.verdictTimer > 0) {
      this.verdictTimer -= dt
      if (this.verdictTimer <= 0) this.verdictEl.classList.remove("on")
    }

    if (showPerf) {
      this.perfEl.textContent = `${fps.toFixed(0)} FPS · ${tier.toUpperCase()}`
    } else if (this.perfEl.textContent) {
      this.perfEl.textContent = ""
    }
  }

  dispose(): void {
    this.root.remove()
  }
}
