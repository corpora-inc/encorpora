/**
 * The DOM chrome: the essence odometer, the rate, the magnitude pips, the
 * action rail and the tide gate.
 *
 * Text lives in the DOM rather than on the canvas because a numeral rendered by
 * the browser is crisp at every device pixel ratio for free, and because the
 * odometer — the single most important animation in a merge-and-idle game — is
 * four transform updates a frame here and would be a per-digit re-rasterise on
 * a canvas.
 */

import { fmtCompact } from '../core/ladder.ts'
import type { Chrome } from './chrome.ts'

export type Action = {
  id: string
  label: string
  cost: number
  hint: string
  enabled: boolean
  visible: boolean
  urgent?: boolean
}

const CSS = `
.ab-root{position:absolute;inset:0;overflow:hidden;display:flex;flex-direction:column;
  background:#04060f;color:#eef6ff;user-select:none;-webkit-user-select:none;touch-action:none;
  font-family:"SF Pro Rounded",ui-rounded,"Nunito","Avenir Next",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-tap-highlight-color:transparent;}
.ab-root *{box-sizing:border-box;margin:0;padding:0}
.ab-stage{position:relative;flex:1 1 auto;min-height:0}
.ab-stage canvas{position:absolute;inset:0;display:block}

/* The band bleeds edge to edge; its PADDING is written by chrome.ts so the
   readout clears the notch and both of the host's 44px corners. */
.ab-top{position:relative;z-index:3;display:flex;align-items:flex-end;gap:10px;
  padding:8px 12px 6px;flex:0 0 auto;
  background:linear-gradient(180deg,rgba(4,7,18,.94),rgba(4,7,18,.45) 70%,rgba(4,7,18,0));}
.ab-essence{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto}
/* Fixed line boxes: the band's height is the canvas stage's origin, and an
   origin that drifts with a platform font metric is an origin that is wrong. */
.ab-cap{font-size:9px;line-height:11px;height:11px;flex:0 0 auto;letter-spacing:.24em;font-weight:800;opacity:.5;text-transform:uppercase}
.ab-odo{display:flex;align-items:baseline;flex:0 0 auto;font-weight:900;line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:-.02em;
  filter:drop-shadow(0 0 12px var(--ab-odo-glow,rgba(120,232,255,.5)));}
.ab-dig{position:relative;overflow:hidden;display:inline-block}
.ab-dig>span{display:block;text-align:center}
.ab-sep{display:inline-block;opacity:.55}
.ab-rate{font-size:11px;line-height:14px;height:14px;flex:0 0 auto;font-weight:800;opacity:.72;letter-spacing:.04em;display:flex;gap:8px;align-items:center}
.ab-flow{font-weight:900;font-size:10px;line-height:12px;padding:1px 7px;border-radius:999px;
  background:rgba(255,209,46,.16);color:#ffd12e;border:1px solid rgba(255,209,46,.34)}
.ab-pips{display:flex;gap:3px;align-items:center;flex:0 0 auto;max-width:44%;flex-wrap:wrap;justify-content:flex-end}
.ab-pip{width:7px;height:7px;border-radius:2px;background:rgba(238,246,255,.14);transition:background .3s,box-shadow .3s}
.ab-pip.on{background:var(--ab-pip,#78e8ff);box-shadow:0 0 8px var(--ab-pip,#78e8ff)}

.ab-rail{position:relative;z-index:3;flex:0 0 auto;display:grid;gap:6px;padding:6px 10px 10px;
  grid-template-columns:repeat(2,1fr);
  background:linear-gradient(0deg,rgba(4,7,18,.96),rgba(4,7,18,.55));}
@media (min-width:620px){.ab-rail{grid-template-columns:repeat(4,1fr)}}
.ab-btn{appearance:none;border:1px solid rgba(238,246,255,.16);border-radius:12px;
  background:linear-gradient(180deg,rgba(30,44,80,.85),rgba(10,16,36,.9));
  color:#eef6ff;padding:7px 8px;display:flex;flex-direction:column;align-items:center;gap:1px;
  font-family:inherit;cursor:pointer;transition:transform .09s cubic-bezier(.2,1.6,.4,1),filter .12s,opacity .12s;
  min-height:46px;justify-content:center}
.ab-btn:active{transform:scale(.94)}
.ab-btn[disabled]{opacity:.34;cursor:default}
.ab-btn[hidden]{display:none}
.ab-btn .n{font-size:11px;font-weight:900;letter-spacing:.1em}
.ab-btn .c{font-size:11px;font-weight:800;opacity:.78;font-variant-numeric:tabular-nums}
.ab-btn.urgent{border-color:rgba(255,78,92,.7);box-shadow:0 0 0 1px rgba(255,78,92,.28),0 0 18px rgba(255,78,92,.35);
  animation:ab-urge 1.1s ease-in-out infinite}
@keyframes ab-urge{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}

.ab-toasts{position:absolute;left:0;right:0;top:52%;z-index:5;display:flex;flex-direction:column;
  align-items:center;gap:6px;pointer-events:none}
.ab-toast{font-weight:900;font-size:15px;letter-spacing:.06em;padding:7px 16px;border-radius:999px;
  background:rgba(4,7,18,.8);border:1px solid rgba(238,246,255,.22);text-shadow:0 2px 10px #000}
.ab-toast.danger{border-color:rgba(255,78,92,.6);color:#ffd0d4}

.ab-gate{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(2,4,12,.82);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
.ab-gate[hidden]{display:none}
.ab-card{width:min(460px,100%);max-height:100%;overflow:auto;border-radius:20px;padding:18px 16px 16px;
  background:radial-gradient(120% 100% at 50% 0%,rgba(60,40,120,.62),rgba(8,12,30,.96));
  border:1px solid rgba(238,246,255,.2);box-shadow:0 30px 80px rgba(0,0,0,.7);text-align:center}
.ab-gate-kicker{font-size:10px;letter-spacing:.3em;font-weight:800;opacity:.62;text-transform:uppercase}
.ab-gate-haul{font-size:clamp(34px,11vw,56px);font-weight:900;line-height:1.05;margin:4px 0 2px;
  font-variant-numeric:tabular-nums;color:#78e8ff;filter:drop-shadow(0 0 18px rgba(120,232,255,.55))}
.ab-gate-sub{font-size:12px;font-weight:700;opacity:.72;margin-bottom:12px}
.ab-gate-prompt{font-size:clamp(26px,8.5vw,40px);font-weight:900;letter-spacing:.01em;margin:8px 0 12px}
.ab-chips{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.ab-chip{appearance:none;font-family:inherit;font-weight:900;font-size:clamp(18px,5.5vw,24px);
  padding:13px 6px;border-radius:14px;color:#eef6ff;cursor:pointer;font-variant-numeric:tabular-nums;
  border:1px solid rgba(238,246,255,.24);background:linear-gradient(180deg,rgba(40,58,104,.9),rgba(12,18,40,.94));
  transition:transform .09s cubic-bezier(.2,1.6,.4,1),opacity .2s,filter .2s}
.ab-chip:active{transform:scale(.95)}
.ab-chip.wrong{opacity:.28;filter:grayscale(1)}
.ab-chip.right{border-color:#7cf5a0;box-shadow:0 0 0 2px rgba(124,245,160,.4),0 0 26px rgba(124,245,160,.5)}
.ab-gate-mult{margin-top:11px;font-size:12px;font-weight:800;letter-spacing:.1em;opacity:.8}

.ab-badge{position:absolute;right:8px;bottom:8px;z-index:4;font-size:10px;font-weight:800;
  opacity:.45;letter-spacing:.08em;pointer-events:none;font-variant-numeric:tabular-nums}
.ab-mute{position:absolute;right:8px;top:8px;z-index:6;width:30px;height:30px;border-radius:10px;
  border:1px solid rgba(238,246,255,.18);background:rgba(4,7,18,.6);color:#eef6ff;cursor:pointer;
  font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;font-family:inherit}

@media (prefers-reduced-motion:reduce){
  .ab-btn,.ab-chip{transition:none}
  .ab-btn.urgent{animation:none;filter:brightness(1.25)}
}
`

let styleInstalled = false
function installStyle(): void {
  if (styleInstalled) return
  const s = document.createElement('style')
  s.dataset.abyssalBloom = '1'
  s.textContent = CSS
  document.head.appendChild(s)
  styleInstalled = true
}

/** A rolling-digit odometer. Rebuilt only when the digit count changes. */
class Odometer {
  readonly el = document.createElement('div')
  private cols: HTMLElement[] = []
  private chars = ''
  /** Zero until the frame is laid out, so the first `setSize` always applies. */
  private sizePx = 0

  constructor() {
    this.el.className = 'ab-odo'
  }

  setSize(px: number): void {
    if (px === this.sizePx) return
    this.sizePx = px
    this.el.style.fontSize = `${px}px`
    // Explicit, because the row is baseline-aligned: a comma's descender would
    // otherwise stretch the flex line past the digits and push the band taller
    // than `chrome.ts` computed — and the band's height is the stage's origin.
    this.el.style.height = `${px}px`
    for (const c of this.cols) {
      if (c.classList.contains('ab-dig')) {
        c.style.height = `${px}px`
        c.style.width = `${px * 0.63}px`
        const stack = c.firstElementChild as HTMLElement | null
        if (stack) stack.style.height = `${px * 10}px`
      }
    }
  }

  set(text: string): void {
    if (text.length !== this.chars.length) this.rebuild(text)
    for (let i = 0; i < text.length; i++) {
      const ch = text[i] ?? ''
      const col = this.cols[i]
      if (!col) continue
      if (col.classList.contains('ab-dig')) {
        const d = ch >= '0' && ch <= '9' ? Number(ch) : 0
        const stack = col.firstElementChild as HTMLElement | null
        if (stack) stack.style.transform = `translateY(${-d * this.sizePx}px)`
      } else if (col.textContent !== ch) {
        col.textContent = ch
      }
    }
    this.chars = text
  }

  private rebuild(text: string): void {
    this.el.textContent = ''
    this.cols = []
    for (const ch of text) {
      if (ch >= '0' && ch <= '9') {
        const col = document.createElement('span')
        col.className = 'ab-dig'
        col.style.height = `${this.sizePx}px`
        col.style.width = `${this.sizePx * 0.63}px`
        const stack = document.createElement('span')
        stack.style.height = `${this.sizePx * 10}px`
        stack.style.transition = 'transform .34s cubic-bezier(.2,.9,.2,1)'
        for (let d = 0; d <= 9; d++) {
          const s = document.createElement('span')
          s.textContent = String(d)
          s.style.height = `${this.sizePx}px`
          s.style.lineHeight = `${this.sizePx}px`
          stack.appendChild(s)
        }
        col.appendChild(stack)
        this.el.appendChild(col)
        this.cols.push(col)
      } else {
        const sep = document.createElement('span')
        sep.className = 'ab-sep'
        sep.textContent = ch
        this.el.appendChild(sep)
        this.cols.push(sep)
      }
    }
  }
}

export type HudCallbacks = {
  onAction(id: string): void
  onChip(index: number): void
  onMute(muted: boolean): void
}

export class Hud {
  readonly root = document.createElement('div')
  readonly stage = document.createElement('div')
  private top = document.createElement('div')
  private odo = new Odometer()
  private rateEl = document.createElement('span')
  private flowEl = document.createElement('span')
  private pipsEl = document.createElement('div')
  private railEl = document.createElement('div')
  private toastEl = document.createElement('div')
  private badge = document.createElement('div')
  private muteBtn = document.createElement('button')
  private gate = document.createElement('div')
  private gateKicker = document.createElement('div')
  private gateHaul = document.createElement('div')
  private gateSub = document.createElement('div')
  private gatePrompt = document.createElement('div')
  private gateChips = document.createElement('div')
  private gateMult = document.createElement('div')
  private buttons = new Map<string, HTMLButtonElement>()
  private pips: HTMLElement[] = []
  private muted = false

  private cb: HudCallbacks

  constructor(cb: HudCallbacks) {
    this.cb = cb
    installStyle()
    this.root.className = 'ab-root'

    const top = this.top
    top.className = 'ab-top'
    const ess = document.createElement('div')
    ess.className = 'ab-essence'
    const cap = document.createElement('div')
    cap.className = 'ab-cap'
    cap.textContent = 'Essence'
    const rate = document.createElement('div')
    rate.className = 'ab-rate'
    this.rateEl.textContent = '0 / sec'
    this.flowEl.className = 'ab-flow'
    this.flowEl.hidden = true
    rate.append(this.rateEl, this.flowEl)
    ess.append(cap, this.odo.el, rate)
    this.pipsEl.className = 'ab-pips'
    top.append(ess, this.pipsEl)

    this.stage.className = 'ab-stage'
    this.railEl.className = 'ab-rail'
    this.toastEl.className = 'ab-toasts'
    this.badge.className = 'ab-badge'
    this.muteBtn.className = 'ab-mute'
    this.muteBtn.type = 'button'
    this.muteBtn.textContent = '♪'
    this.muteBtn.setAttribute('aria-label', 'Mute sound')
    this.muteBtn.addEventListener('click', () => {
      this.muted = !this.muted
      this.muteBtn.textContent = this.muted ? '⊘' : '♪'
      this.muteBtn.setAttribute('aria-label', this.muted ? 'Unmute sound' : 'Mute sound')
      this.cb.onMute(this.muted)
    })

    this.buildGate()
    this.stage.append(this.toastEl, this.badge, this.muteBtn, this.gate)
    this.root.append(top, this.stage, this.railEl)

    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div')
      p.className = 'ab-pip'
      this.pips.push(p)
      this.pipsEl.appendChild(p)
    }
  }

  private buildGate(): void {
    this.gate.className = 'ab-gate'
    this.gate.hidden = true
    const card = document.createElement('div')
    card.className = 'ab-card'
    this.gateKicker.className = 'ab-gate-kicker'
    this.gateHaul.className = 'ab-gate-haul'
    this.gateSub.className = 'ab-gate-sub'
    this.gatePrompt.className = 'ab-gate-prompt'
    this.gateChips.className = 'ab-chips'
    this.gateMult.className = 'ab-gate-mult'
    card.append(
      this.gateKicker,
      this.gateHaul,
      this.gateSub,
      this.gatePrompt,
      this.gateChips,
      this.gateMult,
    )
    this.gate.appendChild(card)
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root)
  }

  destroy(): void {
    this.root.remove()
  }

  /**
   * Put the DOM where `chrome.ts` says it goes.
   *
   * This is the only place the band's padding, the band's height and the mute
   * button's corner are decided, and every number comes from `chromeLayout`.
   * The stylesheet deliberately holds no safe-area rule of its own: two sources
   * of truth for "where the notch is" is how a HUD ends up half-corrected.
   */
  applyChrome(c: Chrome): void {
    const t = this.top.style
    t.paddingTop = `${c.bandPad.top}px`
    t.paddingRight = `${c.bandPad.right}px`
    t.paddingBottom = `${c.bandPad.bottom}px`
    t.paddingLeft = `${c.bandPad.left}px`
    t.height = `${c.band.h}px`
    this.odo.setSize(c.odoPx)

    const r = this.railEl.style
    r.paddingTop = `${c.railPad.top}px`
    r.paddingRight = `${c.railPad.right}px`
    r.paddingBottom = `${c.railPad.bottom}px`
    r.paddingLeft = `${c.railPad.left}px`

    // The mute button lives in the stage, so its top is measured from the band's
    // underside — which is already below the host's corners.
    this.muteBtn.style.top = `${c.mute.y - c.stage.y}px`
    this.muteBtn.style.right = `${c.w - c.mute.x - c.mute.w}px`
  }

  /* ------------------------------------------------------------------ state */

  setEssence(shown: number, glowColour: string): void {
    this.odo.set(fmtCompact(shown))
    this.odo.el.style.setProperty('--ab-odo-glow', glowColour)
  }

  setRate(perSec: number): void {
    const t = `▲ ${fmtCompact(Math.round(perSec))} / sec`
    if (this.rateEl.textContent !== t) this.rateEl.textContent = t
  }

  setFlow(flow: number): void {
    const on = flow > 1.01
    this.flowEl.hidden = !on
    if (on) {
      const t = `×${(Math.round(flow * 10) / 10).toFixed(1)} FLOW`
      if (this.flowEl.textContent !== t) this.flowEl.textContent = t
    }
  }

  setMagnitude(m: number, colour: string): void {
    for (let i = 0; i < this.pips.length; i++) {
      const p = this.pips[i]
      if (!p) continue
      const on = i < m
      if (p.classList.contains('on') !== on) p.classList.toggle('on', on)
      if (on) p.style.setProperty('--ab-pip', colour)
    }
  }

  setBadge(text: string): void {
    if (this.badge.textContent !== text) this.badge.textContent = text
  }

  setActions(actions: Action[]): void {
    for (const a of actions) {
      let btn = this.buttons.get(a.id)
      if (!btn) {
        btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'ab-btn'
        const n = document.createElement('span')
        n.className = 'n'
        const c = document.createElement('span')
        c.className = 'c'
        btn.append(n, c)
        btn.addEventListener('click', () => this.cb.onAction(a.id))
        this.buttons.set(a.id, btn)
        this.railEl.appendChild(btn)
      }
      const n = btn.firstElementChild as HTMLElement
      const c = btn.lastElementChild as HTMLElement
      if (n.textContent !== a.label) n.textContent = a.label
      if (c.textContent !== a.hint) c.textContent = a.hint
      if (btn.disabled === a.enabled) btn.disabled = !a.enabled
      if (btn.hidden === a.visible) btn.hidden = !a.visible
      btn.classList.toggle('urgent', !!a.urgent)
    }
  }

  toast(text: string, danger = false): void {
    const el = document.createElement('div')
    el.className = danger ? 'ab-toast danger' : 'ab-toast'
    el.textContent = text
    this.toastEl.appendChild(el)
    let alpha = 1
    const start = performance.now()
    const tick = (): void => {
      const t = (performance.now() - start) / 1500
      if (t >= 1) {
        el.remove()
        return
      }
      alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2
      el.style.opacity = String(alpha)
      el.style.transform = `translateY(${-t * 18}px)`
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  /* ------------------------------------------------------------------- gate */

  showGate(o: {
    kicker: string
    haul: string
    sub: string
    prompt: string
    chips: string[]
    mult: string
  }): void {
    this.gateKicker.textContent = o.kicker
    this.gateHaul.textContent = o.haul
    this.gateSub.textContent = o.sub
    this.gatePrompt.textContent = o.prompt
    this.gateMult.textContent = o.mult
    this.gateChips.textContent = ''
    o.chips.forEach((text, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'ab-chip'
      b.textContent = text
      b.addEventListener('click', () => this.cb.onChip(i))
      this.gateChips.appendChild(b)
    })
    this.gate.hidden = false
  }

  markChip(index: number, right: boolean): void {
    const el = this.gateChips.children[index] as HTMLElement | undefined
    if (!el) return
    el.classList.add(right ? 'right' : 'wrong')
  }

  setGateMult(text: string): void {
    this.gateMult.textContent = text
  }

  hideGate(): void {
    this.gate.hidden = true
  }

  get gateOpen(): boolean {
    return !this.gate.hidden
  }
}
