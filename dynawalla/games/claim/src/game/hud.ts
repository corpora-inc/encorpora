// The HUD is DOM, deliberately.
//
// The meter is not a progress bar with a fraction written on it — it IS the
// fraction bar. It is cut into exactly `denominator` parts and you are filling
// `numerator` of them. Cross 2700 of 7200 and it says 3/8 by itself. That is
// the whole pedagogy, and it needs real type at real weights, which is DOM.

import { cleanFraction, percentTenths } from "./exact.ts"
import { hudFrame } from "./layout.ts"
import { css, type LevelInk } from "./palette.ts"
import type { Insets } from "../../../../packs/shared/game-chrome/index.ts"

export class Hud {
  root: HTMLDivElement
  private lvl: HTMLDivElement
  private goalNum: HTMLDivElement
  private goalDen: HTMLDivElement
  private goalCells: HTMLDivElement
  private score: HTMLDivElement
  private lives: HTMLDivElement
  private ticks: HTMLDivElement
  private fill: HTMLDivElement
  private band: HTMLDivElement
  private danger: HTMLDivElement
  private marker: HTMLDivElement
  private readout: HTMLDivElement
  private toasts: HTMLDivElement
  private card: HTMLDivElement
  private shownScore = 0

  constructor(parent: HTMLElement) {
    const root = document.createElement("div")
    root.className = "cl-hud"
    root.innerHTML = `
      <div class="cl-top">
        <div class="cl-lvl"></div>
        <div class="cl-goal">
          <div class="cl-frac"><span class="cl-n"></span><i></i><span class="cl-d"></span></div>
          <div class="cl-cells"></div>
        </div>
        <div class="cl-right">
          <div class="cl-score">0</div>
          <div class="cl-lives"></div>
        </div>
      </div>
      <div class="cl-meter">
        <div class="cl-ticks"></div>
        <div class="cl-danger"></div>
        <div class="cl-band"></div>
        <div class="cl-fill"></div>
        <div class="cl-marker"></div>
      </div>
      <div class="cl-readout"></div>`
    parent.appendChild(root)
    const q = <T extends HTMLElement>(s: string): T => root.querySelector(s) as T
    this.root = root
    this.lvl = q(".cl-lvl")
    this.goalNum = q(".cl-n")
    this.goalDen = q(".cl-d")
    this.goalCells = q(".cl-cells")
    this.score = q(".cl-score")
    this.lives = q(".cl-lives")
    this.ticks = q(".cl-ticks")
    this.fill = q(".cl-fill")
    this.band = q(".cl-band")
    this.danger = q(".cl-danger")
    this.marker = q(".cl-marker")
    this.readout = q(".cl-readout")

    this.toasts = document.createElement("div")
    this.toasts.className = "cl-toasts"
    parent.appendChild(this.toasts)

    this.card = document.createElement("div")
    this.card.className = "cl-card"
    parent.appendChild(this.card)
  }

  /**
   * Publish the frame as custom properties the stylesheet consumes.
   *
   * The stylesheet keeps `env()` fallbacks on every one of these, so a HUD that
   * never gets laid out is still inside the notch — but the values under test
   * are these, and these win.
   */
  layout(w: number, h: number, insets: Insets): void {
    const f = hudFrame(w, h, insets)
    const s = this.root.style
    s.setProperty("--cl-pt", `${f.padTop}px`)
    s.setProperty("--cl-pl", `${f.padLeft}px`)
    s.setProperty("--cl-pr", `${f.padRight}px`)
    s.setProperty("--cl-gl", `${f.gutterLeft}px`)
    s.setProperty("--cl-gr", `${f.gutterRight}px`)
    s.setProperty("--cl-toph", `${f.topMinH}px`)
    s.setProperty("--cl-cluster", `${f.clusterW}px`)
  }

  setLevel(level: number, ink: LevelInk, goal: { n: number; d: number; target: number }): void {
    this.lvl.textContent = `LVL ${level}`
    this.goalNum.textContent = String(goal.n)
    this.goalDen.textContent = String(goal.d)
    this.goalCells.textContent = String(goal.target)
    this.root.style.setProperty("--ink", css(ink.a))
    this.root.style.setProperty("--ink2", css(ink.b))
    // The bar is cut into `d` parts whenever a child could count them.
    this.ticks.style.background =
      goal.d <= 20
        ? `repeating-linear-gradient(90deg, transparent 0, transparent calc(100%/${goal.d} - 2px), rgba(255,255,255,0.34) calc(100%/${goal.d} - 2px), rgba(255,255,255,0.34) calc(100%/${goal.d}))`
        : "none"
  }

  setBand(lo: number, hi: number, total: number): void {
    const l = (lo * 100) / total
    const h = (hi * 100) / total
    this.band.style.left = `${l}%`
    this.band.style.width = `${Math.max(0.4, h - l)}%`
    this.danger.style.left = `${h}%`
    this.danger.style.width = `${Math.max(0, 100 - h)}%`
  }

  setProgress(claimed: number, total: number, ghost: number | null): void {
    this.fill.style.width = `${(claimed * 100) / total}%`
    if (ghost === null) {
      this.marker.style.opacity = "0"
    } else {
      this.marker.style.opacity = "1"
      this.marker.style.left = `${Math.min(100, (ghost * 100) / total)}%`
    }
  }

  setReadout(claimed: number, total: number, showNumbers: boolean): void {
    if (!showNumbers) {
      this.readout.textContent = ""
      return
    }
    const clean = cleanFraction(claimed, total)
    const frac = clean ? ` · ${clean.n}/${clean.d}` : ""
    this.readout.textContent = `${claimed} / ${total} · ${percentTenths(claimed, total)}%${frac}`
  }

  setScore(v: number): void {
    // Roll rather than snap. A number that counts up is worth the four lines.
    this.shownScore = v
    this.score.textContent = String(v)
  }

  tickScore(target: number): void {
    if (this.shownScore === target) return
    const d = target - this.shownScore
    this.shownScore += Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * 0.22))
    if ((d > 0 && this.shownScore > target) || (d < 0 && this.shownScore < target)) {
      this.shownScore = target
    }
    this.score.textContent = String(this.shownScore)
  }

  setLives(n: number): void {
    this.lives.innerHTML = ""
    for (let i = 0; i < Math.max(0, n); i++) {
      const d = document.createElement("i")
      this.lives.appendChild(d)
    }
  }

  punch(): void {
    this.root.classList.remove("cl-punch")
    void this.root.offsetWidth
    this.root.classList.add("cl-punch")
  }

  toast(text: string, kind: "big" | "good" | "bad" | "clean" = "good", x?: number, y?: number): void {
    const el = document.createElement("div")
    el.className = `cl-toast cl-${kind}`
    el.textContent = text
    if (x !== undefined && y !== undefined) {
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.transform = "translate(-50%,-50%)"
      el.classList.add("cl-at")
    }
    this.toasts.appendChild(el)
    el.addEventListener("animationend", () => el.remove())
  }

  showCard(html: string, cls = ""): void {
    this.card.className = `cl-card cl-on ${cls}`
    this.card.innerHTML = html
  }

  hideCard(): void {
    this.card.className = "cl-card"
    this.card.innerHTML = ""
  }

  destroy(): void {
    this.root.remove()
    this.toasts.remove()
    this.card.remove()
  }
}
