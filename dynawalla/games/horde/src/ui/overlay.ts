/**
 * Everything that is text lives in the DOM: crisp at any density, selectable
 * by a screen reader, and free. The canvas keeps the swarm.
 */
import type { Card } from "../game/loadout.ts"
import type { Question } from "../contract.ts"
import { applyChromeVars } from "./layout.ts"

const h = <K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

const rgb = (c: [number, number, number]) =>
  `rgb(${Math.round(Math.min(1, c[0]) * 255)},${Math.round(Math.min(1, c[1]) * 255)},${Math.round(Math.min(1, c[2]) * 255)})`

export type SealedResult = { correct: boolean; ms: number; answered: string }

export class Overlay {
  readonly root: HTMLElement
  private xpFill: HTMLElement
  private clock: HTMLElement
  private lvl: HTMLElement
  private kills: HTMLElement
  private lifeFill: HTMLElement
  private lifeText: HTMLElement
  private weps: HTMLElement
  private banner: HTMLElement
  private subBanner: HTMLElement
  private fps: HTMLElement

  private cardModal: HTMLElement
  private cardRow: HTMLElement
  private cardTitle: HTMLElement

  private riftModal: HTMLElement
  private riftCharges: HTMLElement
  private riftPrompt: HTMLElement
  private riftAnswers: HTMLElement
  private riftClock: HTMLElement
  private riftNote: HTMLElement

  private overModal: HTMLElement
  private overStats: HTMLElement
  private overTitle: HTMLElement

  private titleModal: HTMLElement

  private soundBtn: HTMLButtonElement
  private pauseBtn: HTMLButtonElement

  onPickCard: (i: number) => void = () => {}
  onSealed: (r: SealedResult) => void = () => {}
  onRiftAnswer: (r: SealedResult) => void = () => {}
  onStart: () => void = () => {}
  onRestart: () => void = () => {}
  onToggleSound: () => void = () => {}
  onTogglePause: () => void = () => {}

  constructor(root: HTMLElement) {
    this.root = root

    // The stylesheet is a static file and cannot be asserted about, so the
    // numbers that keep this HUD out of the host's two corners live in
    // `layout.ts` and are handed to the CSS here. One source, and the tests
    // read the same one.
    applyChromeVars(root)

    const hud = h("div", "hz-hud")
    const xp = h("div", "hz-xpbar")
    this.xpFill = h("i", "hz-xpfill")
    xp.appendChild(this.xpFill)

    const top = h("div", "hz-top")
    this.lvl = h("div", "hz-chip hz-lvl")
    this.lvl.innerHTML = "LV <b>1</b>"
    this.clock = h("div", "hz-clock", "0:00")
    this.kills = h("div", "hz-chip")
    this.kills.innerHTML = "<b>0</b> SLAIN"
    top.append(this.lvl, this.clock, this.kills)

    const life = h("div", "hz-life")
    this.lifeFill = h("i", "hz-lifefill")
    this.lifeText = h("div", "hz-lifetext", "100 / 100")
    life.append(this.lifeFill, this.lifeText)

    this.weps = h("div", "hz-weps")
    this.banner = h("div", "hz-banner")
    this.subBanner = h("div", "hz-sub")
    this.fps = h("div", "hz-fps")

    const corner = h("div", "hz-corner")
    this.soundBtn = h("button", "hz-icon")
    this.soundBtn.type = "button"
    this.soundBtn.textContent = "♪"
    this.soundBtn.setAttribute("aria-label", "Sound")
    this.soundBtn.setAttribute("aria-pressed", "true")
    this.soundBtn.onclick = (e) => { e.stopPropagation(); this.onToggleSound() }
    this.pauseBtn = h("button", "hz-icon")
    this.pauseBtn.type = "button"
    this.pauseBtn.textContent = "II"
    this.pauseBtn.setAttribute("aria-label", "Pause")
    this.pauseBtn.onclick = (e) => { e.stopPropagation(); this.onTogglePause() }
    corner.append(this.soundBtn, this.pauseBtn)

    hud.append(xp, top, life, this.weps, this.banner, this.subBanner, this.fps, corner)

    /* ---- level-up ---- */
    this.cardModal = h("div", "hz-modal")
    this.cardTitle = h("div", "hz-title", "CHOOSE")
    this.cardRow = h("div", "hz-cards")
    this.cardModal.append(this.cardTitle, this.cardRow)

    /* ---- rift ---- */
    this.riftModal = h("div", "hz-modal hz-rift")
    const riftBox = h("div", "hz-riftbox")
    const riftTitle = h("div", "hz-title", "THE RIFT")
    this.riftCharges = h("div", "hz-charges")
    this.riftPrompt = h("div", "hz-prompt", "")
    this.riftAnswers = h("div", "hz-answers")
    this.riftClock = h("div", "hz-riftclock")
    this.riftClock.appendChild(h("i"))
    this.riftNote = h("div", "hz-riftnote", "CHARGE THE RIFT TO COME BACK")
    riftBox.append(riftTitle, this.riftCharges, this.riftPrompt, this.riftAnswers, this.riftClock, this.riftNote)
    this.riftModal.appendChild(riftBox)

    /* ---- over ---- */
    this.overModal = h("div", "hz-modal")
    this.overTitle = h("div", "hz-big", "THE DARK TOOK YOU")
    this.overStats = h("div", "hz-stats")
    const again = h("button", "hz-btn", "DIVE AGAIN")
    again.type = "button"
    again.onclick = () => this.onRestart()
    this.overModal.append(this.overTitle, this.overStats, again)

    /* ---- title ---- */
    this.titleModal = h("div", "hz-modal hz-open")
    const big = h("div", "hz-big", "DEEPSWARM")
    const tag = h("div", "hz-tagline", "THE LIGHT IS YOURS. THE DARK IS EVERYTHING ELSE.")
    const go = h("button", "hz-btn", "DIVE")
    go.type = "button"
    go.onclick = () => this.onStart()
    const hint = h("div", "hz-hint")
    hint.innerHTML =
      "<b>DRAG</b> anywhere to swim &nbsp;·&nbsp; <b>WASD</b> or <b>ARROWS</b> on a keyboard<br>" +
      "Your weapons fire themselves. All you do is move.<br>" +
      "Swim into a golden <b>CORE</b> — time slows, and the number you touch decides what happens next."
    this.titleModal.append(big, tag, go, hint)

    root.append(hud, this.cardModal, this.riftModal, this.overModal, this.titleModal)
  }

  /* ------------------------------------------------------------------ hud */

  setClock(seconds: number): void {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    this.clock.textContent = `${m}:${s < 10 ? "0" : ""}${s}`
  }

  setXp(frac: number): void {
    this.xpFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`
  }

  setLevel(n: number): void {
    this.lvl.innerHTML = `LV <b>${n}</b>`
  }

  setKills(n: number): void {
    this.kills.innerHTML = `<b>${n}</b> SLAIN`
  }

  setLife(hp: number, max: number): void {
    const f = Math.max(0, Math.min(1, hp / max))
    this.lifeFill.style.width = `${f * 100}%`
    this.lifeText.textContent = `${Math.max(0, Math.ceil(hp))} / ${max}`
  }

  setWeapons(rows: string[]): void {
    // Rebuilt only when the build changes, not per frame.
    this.weps.textContent = ""
    for (const r of rows) {
      const d = h("div", "hz-wep")
      d.innerHTML = r
      this.weps.appendChild(d)
    }
  }

  setFps(text: string): void {
    this.fps.textContent = text
  }

  say(text: string, sub: string, colour: string): void {
    this.banner.textContent = text
    this.banner.style.color = colour
    this.banner.classList.remove("hz-on")
    void this.banner.offsetWidth
    this.banner.classList.add("hz-on")
    this.subBanner.textContent = sub
    this.subBanner.classList.remove("hz-on")
    void this.subBanner.offsetWidth
    if (sub) this.subBanner.classList.add("hz-on")
  }

  setSound(on: boolean): void {
    this.soundBtn.setAttribute("aria-pressed", String(on))
    this.soundBtn.textContent = on ? "♪" : "✕"
  }

  setPaused(on: boolean): void {
    this.pauseBtn.textContent = on ? "▶" : "II"
  }

  /* --------------------------------------------------------------- cards */

  showCards(cards: Card[], sealed: Question | null, level: number): void {
    this.cardTitle.textContent = `LEVEL ${level}`
    this.cardRow.textContent = ""

    cards.forEach((c, i) => {
      const el = h("button", `hz-card hz-card-r${c.rarity}`)
      el.type = "button"
      el.style.setProperty("--hue", rgb(c.hue))
      el.appendChild(h("div", "hz-card-rarity", c.rarity === 2 ? "RARE" : "GOOD"))
      el.appendChild(h("div", "hz-card-title", c.title))
      el.appendChild(h("div", "hz-card-tag", c.tag))
      const head = h("div", "hz-card-head")
      head.innerHTML = `<b>${c.head}</b><span>${c.sub}</span>`
      el.appendChild(head)
      const math = h("div", "hz-card-math")
      math.innerHTML = `<span class="hz-was">${c.before}</span> → <span class="hz-now">${c.after}</span>`
      el.appendChild(math)
      el.onclick = () => this.onPickCard(i)
      this.cardRow.appendChild(el)
    })

    if (sealed) this.cardRow.appendChild(this.buildSealed(sealed))
    this.cardModal.classList.add("hz-open")
    const first = this.cardRow.querySelector("button")
    if (first) (first as HTMLElement).focus({ preventScroll: true })
  }

  private buildSealed(q: Question): HTMLElement {
    const el = h("div", "hz-card hz-sealed hz-card-r2")
    el.appendChild(h("div", "hz-card-rarity", "SEALED"))
    el.appendChild(h("div", "hz-card-title", "SEALED CACHE"))
    el.appendChild(h("div", "hz-seal-prompt", q.prompt))
    const orbs = h("div", "hz-seal-orbs")
    const options = shuffleWithAnswer(q)
    const t0 = performance.now()
    let done = false
    for (const opt of options) {
      const b = h("button", "hz-orb", opt)
      b.type = "button"
      b.onclick = () => {
        if (done) return
        done = true
        const correct = opt === q.answer
        b.classList.add(correct ? "hz-ok" : "hz-no")
        if (!correct) {
          // Show where the light actually was. No red X, no lecture.
          for (const o of Array.from(orbs.children) as HTMLElement[]) {
            if (o.textContent === q.answer) o.classList.add("hz-ok")
          }
        }
        this.onSealed({ correct, ms: performance.now() - t0, answered: opt })
      }
      orbs.appendChild(b)
    }
    el.appendChild(orbs)
    el.appendChild(h("div", "hz-seal-note", "OPEN IT, OR IGNORE IT"))
    return el
  }

  hideCards(): void {
    this.cardModal.classList.remove("hz-open")
  }

  /* ---------------------------------------------------------------- rift */

  showRift(q: Question, charges: number, needed: number): void {
    this.riftCharges.textContent = ""
    for (let i = 0; i < needed; i++) {
      const c = h("div", `hz-charge${i < charges ? " hz-lit" : ""}`)
      this.riftCharges.appendChild(c)
    }
    this.riftPrompt.textContent = q.prompt
    this.riftAnswers.textContent = ""
    const options = shuffleWithAnswer(q)
    const t0 = performance.now()
    let done = false
    for (const opt of options) {
      const b = h("button", "hz-answer", opt)
      b.type = "button"
      b.onclick = () => {
        if (done) return
        done = true
        const correct = opt === q.answer
        b.classList.add(correct ? "hz-ok" : "hz-no")
        if (!correct) {
          for (const o of Array.from(this.riftAnswers.children) as HTMLElement[]) {
            if (o.textContent === q.answer) o.classList.add("hz-ok")
          }
        }
        this.onRiftAnswer({ correct, ms: performance.now() - t0, answered: opt })
      }
      this.riftAnswers.appendChild(b)
    }
    this.riftNote.textContent =
      needed === 1 ? "ONE ANSWER AND YOU ARE BACK" : `${needed} ANSWERS AND YOU ARE BACK`
    this.riftModal.classList.add("hz-open")
    const first = this.riftAnswers.querySelector("button")
    if (first) (first as HTMLElement).focus({ preventScroll: true })
  }

  setRiftClock(frac: number): void {
    const i = this.riftClock.firstElementChild as HTMLElement
    i.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`
  }

  hideRift(): void {
    this.riftModal.classList.remove("hz-open")
  }

  /* ---------------------------------------------------------------- over */

  showOver(stats: { label: string; value: string }[], title: string): void {
    this.overTitle.textContent = title
    this.overStats.textContent = ""
    for (const s of stats) {
      const d = h("div", "hz-stat")
      d.innerHTML = `<b>${s.value}</b><span>${s.label}</span>`
      this.overStats.appendChild(d)
    }
    this.overModal.classList.add("hz-open")
  }

  hideOver(): void {
    this.overModal.classList.remove("hz-open")
  }

  hideTitle(): void {
    this.titleModal.classList.remove("hz-open")
  }

  destroy(): void {
    this.root.textContent = ""
  }
}

/** Deterministic-enough shuffle of answer + distractors. */
function shuffleWithAnswer(q: Question): string[] {
  const opts = [q.answer, ...q.distractors.slice(0, 3)]
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = opts[i]
    opts[i] = opts[j]
    opts[j] = t
  }
  return opts
}
