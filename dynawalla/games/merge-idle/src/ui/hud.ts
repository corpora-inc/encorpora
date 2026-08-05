/**
 * The DOM chrome: the target, the bloom hairline, and two buttons.
 *
 * Text lives in the DOM rather than on the canvas because a numeral rendered by
 * the browser is crisp at every device pixel ratio for free — and the target is
 * the most important numeral in the game, so it gets the crispest surface there
 * is.
 *
 * ## What used to be here
 *
 * A rolling-digit essence odometer, a per-second rate line, a FLOW pill, a
 * twelve-pip magnitude meter, a five-button action rail (UPWELL, AWAKEN, DEEPEN,
 * OVERCHARGE, DISSOLVE) and a full-screen tide gate with four answer chips. The
 * founder's report on the first four was that "none of that even really makes
 * sense or seems to do anything", and the tide gate was the second half of "2
 * games on the same screen instead of a cohesive game". `core/economy.ts` argues
 * each deletion; this file is what is left.
 *
 * Two buttons survive, in the corners the host's chrome does not use: CLEAR,
 * because a crowded shelf must never be a losing position — and because a child
 * who simply does not like the numbers in front of them must be able to say so —
 * and the mute toggle.
 * `ui/chrome.ts` decides where they go — in landscape they both move to the right,
 * because the bottom-left of a landscape stage is shelf.
 */

import { SAFE_VARS } from '../../../../packs/shared/game-chrome/index.ts'
import { faceSizeFor, METER_H, STAGE_BTN, type Chrome } from './chrome.ts'

export const CSS = `
.ab-root{position:absolute;inset:0;overflow:hidden;display:flex;flex-direction:column;
  background:#04060f;color:#eef6ff;user-select:none;-webkit-user-select:none;touch-action:none;
  font-family:"SF Pro Rounded",ui-rounded,"Nunito","Avenir Next",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  -webkit-tap-highlight-color:transparent;}
.ab-root *{box-sizing:border-box;margin:0;padding:0}
.ab-stage{position:relative;flex:1 1 auto;min-height:0}
.ab-stage canvas{position:absolute;inset:0;display:block}

/* The band bleeds edge to edge; its PADDING is written by chrome.ts so the target
   clears the notch and both of the host's 44px corners. */
.ab-top{position:relative;z-index:3;display:flex;flex-direction:column;flex:0 0 auto;
  background:linear-gradient(180deg,rgba(4,7,18,.94),rgba(4,7,18,.45) 70%,rgba(4,7,18,0));}
/* A FIXED line box. Its height is the canvas stage's origin, so a height that
   moved with the target would move every polyp on the shelf every time the
   number changed. chrome.ts sizes the box; faceSizeFor fits the type inside it. */
.ab-face{flex:0 0 auto;display:flex;align-items:center;justify-content:center;
  font-weight:900;line-height:1;letter-spacing:-.01em;white-space:nowrap;
  font-variant-numeric:tabular-nums;
  filter:drop-shadow(0 0 14px var(--ab-face-glow,rgba(120,232,255,.55)));}
.ab-face .op{opacity:.62;font-weight:800}
.ab-face .blank{opacity:.42;font-weight:800}
/* The bloom hairline: how close the reef is to growing. */
.ab-meter{flex:0 0 auto;position:relative;border-radius:999px;overflow:hidden;
  background:rgba(238,246,255,.12)}
.ab-meter i{position:absolute;inset:0 auto 0 0;border-radius:999px;
  background:var(--ab-meter,#78e8ff);box-shadow:0 0 10px var(--ab-meter,#78e8ff);
  transition:width .4s cubic-bezier(.2,.9,.2,1)}
@keyframes ab-grew{0%{filter:brightness(1)}30%{filter:brightness(2.4)}100%{filter:brightness(1)}}
.ab-meter.grew{animation:ab-grew .7s ease-out}

.ab-toasts{--dw-safe-exempt:"inside .ab-stage, which starts below the band that already pays the top inset";position:absolute;left:0;right:0;top:8%;z-index:5;display:flex;flex-direction:column;
  align-items:center;gap:6px;pointer-events:none}
.ab-toast{font-weight:900;font-size:15px;letter-spacing:.06em;padding:7px 16px;border-radius:999px;
  background:rgba(4,7,18,.8);border:1px solid rgba(238,246,255,.22);text-shadow:0 2px 10px #000}
.ab-toast.danger{border-color:rgba(255,78,92,.6);color:#ffd0d4}

/* Both stage buttons. Square, 44px, in the two corners the host does NOT use. */
.ab-sbtn{position:absolute;z-index:6;border-radius:14px;
  border:1px solid rgba(238,246,255,.18);background:rgba(4,7,18,.66);color:#eef6ff;cursor:pointer;
  font-family:inherit;font-weight:900;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1px;line-height:1;
  transition:transform .09s cubic-bezier(.2,1.6,.4,1),opacity .12s}
.ab-sbtn:active{transform:scale(.93)}
.ab-sbtn[disabled]{opacity:.32;cursor:default}
.ab-sbtn .k{font-size:16px}
.ab-sbtn .n{font-size:7px;letter-spacing:.08em;opacity:.72}
.ab-sbtn.urgent{border-color:rgba(255,78,92,.7);box-shadow:0 0 0 1px rgba(255,78,92,.28),0 0 18px rgba(255,78,92,.35);
  animation:ab-urge 1.1s ease-in-out infinite}
@keyframes ab-urge{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}

/* THE FOUNDER'S DEFECT, and the reason this pack was reopened.
   .ab-badge is a child of .ab-stage, which is the flex-grow row: its bottom
   edge IS the bottom of the glass. bottom: 6px therefore put "12 blooms · 40
   joins" six pixels off the panel — entirely inside a 48px three-button
   navigation bar on the founder's phone, and inside the home indicator on every
   notched iPhone.
   Note what it is NOT: there was no env(safe-area-inset-bottom) here to be
   zero. This rule never mentioned the safe area at all, so no search for the
   text found it. That is why the fleet gate now evaluates edge offsets to
   numbers rather than looking for a string. */
.ab-badge{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(6px + ${SAFE_VARS.bottom});z-index:4;font-size:10px;
  font-weight:800;opacity:.4;letter-spacing:.08em;pointer-events:none;font-variant-numeric:tabular-nums}

@media (prefers-reduced-motion:reduce){
  .ab-sbtn,.ab-meter i{transition:none}
  .ab-sbtn.urgent{animation:none;filter:brightness(1.25)}
  .ab-meter.grew{animation:none}
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

export type HudCallbacks = {
  onDissolve(): void
  onMute(muted: boolean): void
}

export class Hud {
  readonly root = document.createElement('div')
  readonly stage = document.createElement('div')
  private top = document.createElement('div')
  private faceEl = document.createElement('div')
  private meterEl = document.createElement('div')
  private meterFill = document.createElement('i')
  private toastEl = document.createElement('div')
  private badge = document.createElement('div')
  private dissolveBtn = document.createElement('button')
  private muteBtn = document.createElement('button')
  private muted = false
  private shownFace = ''
  private facePx = 0
  private chrome: Chrome | null = null

  private cb: HudCallbacks

  constructor(cb: HudCallbacks) {
    this.cb = cb
    installStyle()
    this.root.className = 'ab-root'

    this.top.className = 'ab-top'
    this.faceEl.className = 'ab-face'
    this.meterEl.className = 'ab-meter'
    this.meterEl.appendChild(this.meterFill)
    this.top.append(this.faceEl, this.meterEl)

    this.stage.className = 'ab-stage'
    this.toastEl.className = 'ab-toasts'
    this.badge.className = 'ab-badge'

    this.dissolveBtn.className = 'ab-sbtn'
    this.dissolveBtn.type = 'button'
    // Not "dissolve the smallest polyps" any more, and the label mattered: it was
    // the only place a child was told which polyps CLEAR takes, and it was telling
    // them the thing the founder played and hated. It takes all of them.
    this.dissolveBtn.setAttribute('aria-label', 'Clear the whole reef and start it again')
    const dk = document.createElement('span')
    dk.className = 'k'
    dk.textContent = '✳'
    const dn = document.createElement('span')
    dn.className = 'n'
    dn.textContent = 'CLEAR'
    this.dissolveBtn.append(dk, dn)
    this.dissolveBtn.addEventListener('click', () => this.cb.onDissolve())

    this.muteBtn.className = 'ab-sbtn'
    this.muteBtn.type = 'button'
    this.muteBtn.setAttribute('aria-label', 'Mute sound')
    const mk = document.createElement('span')
    mk.className = 'k'
    mk.textContent = '♪'
    this.muteBtn.append(mk)
    this.muteBtn.addEventListener('click', () => {
      this.muted = !this.muted
      mk.textContent = this.muted ? '⊘' : '♪'
      this.muteBtn.setAttribute('aria-label', this.muted ? 'Unmute sound' : 'Mute sound')
      this.cb.onMute(this.muted)
    })

    this.stage.append(this.toastEl, this.badge, this.dissolveBtn, this.muteBtn)
    this.root.append(this.top, this.stage)
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
   * This is the only place the band's padding, its height and the two buttons'
   * corners are decided, and every number comes from `chromeLayout`. The
   * stylesheet holds exactly ONE safe-area rule of its own — `.ab-badge`, which
   * truth for "where the notch is" is how a HUD ends up half-corrected — and
   * `env(safe-area-inset-*)` reads ZERO inside a pack frame anyway.
   */
  applyChrome(c: Chrome): void {
    this.chrome = c
    const t = this.top.style
    t.paddingTop = `${c.bandPad.top}px`
    t.paddingRight = `${c.bandPad.right}px`
    t.paddingBottom = `${c.bandPad.bottom}px`
    t.paddingLeft = `${c.bandPad.left}px`
    t.height = `${c.band.h}px`

    this.faceEl.style.height = `${c.facePx}px`
    this.meterEl.style.height = `${METER_H}px`
    this.meterEl.style.marginTop = `${c.meter.y - c.face.y - c.face.h}px`

    // Both buttons live in the stage, so their `y` is measured from the band's
    // underside.
    for (const [btn, r] of [
      [this.dissolveBtn, c.dissolve],
      [this.muteBtn, c.mute],
    ] as const) {
      btn.style.width = `${STAGE_BTN}px`
      btn.style.height = `${STAGE_BTN}px`
      btn.style.left = `${r.x}px`
      btn.style.top = `${r.y - c.stage.y}px`
    }

    // Re-fit the type: the box changed, so the size inside it did too.
    const face = this.shownFace
    this.shownFace = ''
    this.facePx = 0
    if (face) this.setFace(face, this.faceEl.style.getPropertyValue('--ab-face-glow'))
  }

  /* ------------------------------------------------------------------ state */

  /**
   * The target, as the child reads it.
   *
   * The blanks and the operator are their own spans so they can be dimmed — a
   * `15 = ▢ ÷ ▢` whose notation is as loud as its number is a `15` that is harder
   * to find.
   */
  setFace(face: string, glow: string): void {
    const c = this.chrome
    const px = c ? faceSizeFor(c, face) : 32
    if (face === this.shownFace && px === this.facePx) {
      if (glow) this.faceEl.style.setProperty('--ab-face-glow', glow)
      return
    }
    this.shownFace = face
    this.facePx = px
    this.faceEl.style.fontSize = `${px}px`
    if (glow) this.faceEl.style.setProperty('--ab-face-glow', glow)
    this.faceEl.textContent = ''
    for (const part of face.split(' ')) {
      const el = document.createElement('span')
      if (part === '▢') el.className = 'blank'
      else if (part === '=' || part === '+' || part === '−' || part === '×' || part === '÷') el.className = 'op'
      el.textContent = part
      this.faceEl.appendChild(el)
      const sp = document.createElement('span')
      sp.textContent = ' '
      this.faceEl.appendChild(sp)
    }
  }

  /** The bloom hairline: `done` of `of` blooms until the shelf grows. */
  setMeter(done: number, of: number, colour: string): void {
    const frac = of <= 0 ? 0 : Math.max(0, Math.min(1, done / of))
    this.meterFill.style.width = `${(frac * 100).toFixed(1)}%`
    this.meterEl.style.setProperty('--ab-meter', colour)
  }

  /** Flash the meter when the shelf actually grows. */
  pulseMeter(): void {
    this.meterEl.classList.remove('grew')
    // Force a reflow so the animation restarts on a second growth.
    void this.meterEl.offsetWidth
    this.meterEl.classList.add('grew')
  }

  setDissolve(enabled: boolean, urgent: boolean): void {
    if (this.dissolveBtn.disabled === enabled) this.dissolveBtn.disabled = !enabled
    this.dissolveBtn.classList.toggle('urgent', urgent)
  }

  setBadge(text: string): void {
    if (this.badge.textContent !== text) this.badge.textContent = text
  }

  toast(text: string, danger = false): void {
    const el = document.createElement('div')
    el.className = danger ? 'ab-toast danger' : 'ab-toast'
    el.textContent = text
    this.toastEl.appendChild(el)
    const start = performance.now()
    const tick = (): void => {
      const t = (performance.now() - start) / 1500
      if (t >= 1) {
        el.remove()
        return
      }
      el.style.opacity = String(t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2)
      el.style.transform = `translateY(${-t * 18}px)`
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }
}
