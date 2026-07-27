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
 */

const CSS = `
.arena-hud{position:absolute;inset:0;pointer-events:none;font-family:ui-rounded,"SF Pro Rounded",system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#cfefff;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;overflow:hidden}
.arena-hud *{box-sizing:border-box}
.arena-depth{position:absolute;top:max(14px,env(safe-area-inset-top));left:max(14px,env(safe-area-inset-left));
  font-size:clamp(11px,2.4vw,15px);letter-spacing:.30em;font-weight:800;opacity:.82;
  text-shadow:0 0 18px rgba(80,220,255,.55),0 2px 6px rgba(0,0,0,.9)}
.arena-depth b{display:block;font-size:clamp(9px,1.7vw,11px);letter-spacing:.22em;opacity:.55;font-weight:700;margin-top:3px}
.arena-pips{display:flex;gap:3px;margin-top:6px}
.arena-pip{width:9px;height:3px;border-radius:2px;background:rgba(160,225,255,.20);transition:background .5s,box-shadow .5s}
.arena-pip.on{background:#ffd479;box-shadow:0 0 9px rgba(255,200,110,.85)}
.arena-board{position:absolute;top:max(14px,env(safe-area-inset-top));right:max(14px,env(safe-area-inset-right));
  min-width:112px;display:flex;flex-direction:column;gap:2px;align-items:stretch}
.arena-row{display:flex;justify-content:space-between;gap:10px;font-size:clamp(10px,2.1vw,13px);
  letter-spacing:.12em;font-weight:700;opacity:.5;font-variant-numeric:tabular-nums;
  padding:2px 7px;border-radius:3px;transition:opacity .25s}
.arena-row.me{opacity:1;background:linear-gradient(90deg,rgba(80,230,255,0),rgba(80,230,255,.20));
  box-shadow:inset 0 0 0 1px rgba(140,240,255,.28);color:#eafcff}
.arena-row .n{opacity:.72}
.arena-row .v{font-weight:800}
.arena-combo{position:absolute;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translate(-50%,0);
  font-size:clamp(14px,4vw,26px);font-weight:900;letter-spacing:.10em;opacity:0;transition:opacity .18s;
  text-shadow:0 0 26px rgba(120,255,220,.7),0 2px 8px rgba(0,0,0,.9);font-variant-numeric:tabular-nums}
.arena-combo.on{opacity:.95}
.arena-q{position:absolute;left:50%;top:max(52px,calc(env(safe-area-inset-top) + 42px));transform:translate(-50%,-14px);
  opacity:0;transition:opacity .22s cubic-bezier(.2,.9,.2,1),transform .34s cubic-bezier(.2,.9,.2,1);
  text-align:center;width:min(94vw,760px);text-wrap:balance}
.arena-q.on{opacity:1;transform:translate(-50%,0)}
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
@media (prefers-reduced-motion:reduce){.arena-q,.arena-verdict,.arena-combo,.arena-btn{transition-duration:.01ms}}
`

const ROWS = 6

export class Hud {
  readonly root: HTMLDivElement
  private depthEl: HTMLDivElement
  private depthSub: HTMLElement
  private rows: { el: HTMLDivElement; name: HTMLSpanElement; val: HTMLSpanElement }[] = []
  private comboEl: HTMLDivElement
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

    this.root.append(this.depthEl, board, this.comboEl, this.qEl, this.verdictEl, btns, this.perfEl)
    container.appendChild(this.root)
  }

  private setRungs(band: number): void {
    if (band === this.lastEarned) return
    this.lastEarned = band
    for (let i = 0; i < this.pips.length; i++) this.pips[i]!.classList.toggle("on", i <= band)
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
