// Drift — a calm, reactive micro-story reader. Self-contained: no shared deps.
import type { HostApi } from "./sdk/types"
import type { ActivitySpec, ActivityResult } from "./sdk/activityContract"
import { composeStory, type ComposedStory, type Beat } from "./content/compose"
import type { SceneMotif } from "./content/stories"

type DriftOptions = {
  hostApi: HostApi
  container: HTMLElement
  /** The journey spec when launched as an interlude, else null (standalone). */
  spec: ActivitySpec | null
  seed: number
}

const MOTIF_GLYPH: Record<SceneMotif, string> = {
  dawn: "◠",
  lantern: "✦",
  snow: "❄",
  tide: "≈",
  door: "❏",
  stars: "✧",
}

export class Drift {
  private hostApi: HostApi
  private container: HTMLElement
  private spec: ActivitySpec | null
  private seed: number

  private root!: HTMLElement
  private stage!: HTMLElement
  private proseEl!: HTMLElement
  private motifLayer!: HTMLElement
  private soundBtn!: HTMLButtonElement

  private story: ComposedStory | null = null
  private beatEls: HTMLElement[] = []
  private wordEls: HTMLElement[][] = [] // [beatIndex][tokenIndex]

  private soundOn = false
  private started = performance.now()
  private finished = false
  private currentSpeak: number | null = null
  private timers: number[] = []
  private disposed = false

  constructor(opts: DriftOptions) {
    this.hostApi = opts.hostApi
    this.container = opts.container
    this.spec = opts.spec
    this.seed = opts.seed
    this.buildShell()
    void this.load()
  }

  private buildShell() {
    const root = document.createElement("div")
    root.className = "drift-root"
    root.innerHTML = `
      <div class="drift-stage">
        <div class="drift-motifs" aria-hidden="true"></div>
        <div class="drift-veil" aria-hidden="true"></div>
        <div class="drift-scrim">
          <div class="drift-prose" role="article" aria-live="polite"></div>
        </div>
        <div class="drift-controls">
          <button class="drift-btn drift-sound" type="button" aria-pressed="false">
            <span class="drift-sound-glyph">♪</span>
            <span class="drift-sound-label" data-i18n="listen">Listen</span>
          </button>
          <button class="drift-btn drift-done" type="button" data-i18n="done">Done</button>
        </div>
        <div class="drift-gloss" role="status" aria-live="polite" hidden></div>
      </div>
    `
    this.root = root
    this.stage = root.querySelector(".drift-stage") as HTMLElement
    this.proseEl = root.querySelector(".drift-prose") as HTMLElement
    this.motifLayer = root.querySelector(".drift-motifs") as HTMLElement
    this.soundBtn = root.querySelector(".drift-sound") as HTMLButtonElement

    this.soundBtn.addEventListener("click", () => this.toggleSound())
    ;(root.querySelector(".drift-done") as HTMLButtonElement).addEventListener("click", () =>
      this.finish(),
    )
    this.container.appendChild(root)
  }

  private async load() {
    try {
      this.story = await composeStory(this.hostApi, this.spec, this.seed)
    } catch (err) {
      console.warn("[drift] compose failed", err)
    }
    if (this.disposed) return
    if (!this.story || this.story.beats.length === 0) {
      this.renderEmpty()
      return
    }
    this.stage.style.setProperty("--drift-hue", String(this.story.scene.hue))
    this.renderStory(this.story)
    // Reveal the first motif immediately (arrive); the rest resolve as beats
    // are read (or on a gentle timer when narration is off).
    this.revealMotif(0)
    if (this.story.beats.length > 1) this.scheduleQuietReveals()
  }

  private renderEmpty() {
    this.proseEl.innerHTML = `<p class="drift-empty" data-i18n="quiet">…</p>`
  }

  private renderStory(story: ComposedStory) {
    this.proseEl.innerHTML = ""
    this.beatEls = []
    this.wordEls = []
    story.beats.forEach((beat) => {
      const line = document.createElement("p")
      line.className = "drift-line"
      const tokenEls: HTMLElement[] = []
      beat.tokens.forEach((tok) => {
        if (!tok.glossable) {
          line.appendChild(document.createTextNode(tok.text))
          return
        }
        const w = document.createElement("span")
        w.className = "drift-word"
        w.textContent = tok.text
        if (tok.gloss) {
          w.addEventListener("click", () => this.showGloss(tok.gloss as string, w))
        }
        line.appendChild(w)
        tokenEls.push(w)
      })
      this.proseEl.appendChild(line)
      this.beatEls.push(line)
      this.wordEls.push(tokenEls)
    })
  }

  // ---- Motifs (the scene reacts to the narration) -------------------------
  private revealMotif(beatIndex: number) {
    if (!this.story) return
    const motif = this.story.beats[beatIndex]?.motif
    if (!motif) return
    const el = document.createElement("div")
    el.className = `drift-motif drift-motif--${motif}`
    el.textContent = MOTIF_GLYPH[motif]
    el.style.setProperty("--i", String(beatIndex))
    this.motifLayer.appendChild(el)
    // force reflow → transition in
    void el.offsetWidth
    el.classList.add("is-on")
  }

  /** When narration is off, gently resolve motifs on a calm timer so the
   *  scene still breathes (the comedown), never jolting. */
  private scheduleQuietReveals() {
    if (!this.story) return
    for (let i = 1; i < this.story.beats.length; i++) {
      const t = window.setTimeout(() => {
        if (!this.soundOn) this.revealMotif(i)
      }, 2600 * i)
      this.timers.push(t)
    }
  }

  // ---- Gloss reveal (tap any word) ----------------------------------------
  private showGloss(gloss: string, anchor: HTMLElement) {
    const el = this.root.querySelector(".drift-gloss") as HTMLElement
    if (!gloss) return
    el.textContent = gloss
    el.hidden = false
    el.classList.add("is-on")
    this.beatEls.forEach((l) => l.querySelectorAll(".drift-word").forEach((w) => w.classList.remove("is-tapped")))
    anchor.classList.add("is-tapped")
    window.clearTimeout(this.currentSpeak ?? undefined)
    const t = window.setTimeout(() => {
      el.classList.remove("is-on")
      const h = window.setTimeout(() => { el.hidden = true }, 260)
      this.timers.push(h)
    }, 2400)
    this.timers.push(t)
  }

  // ---- Narration (honors sound-off: OFF by default, user-initiated) -------
  private toggleSound() {
    this.soundOn = !this.soundOn
    this.soundBtn.setAttribute("aria-pressed", String(this.soundOn))
    this.soundBtn.classList.toggle("is-on", this.soundOn)
    if (this.soundOn) void this.narrate()
    else this.hostApi.stopSpeech?.()
  }

  private async narrate() {
    if (!this.story) return
    const target = this.story.targetLang
    for (let bi = 0; bi < this.story.beats.length; bi++) {
      if (!this.soundOn || this.disposed) return
      const beat = this.story.beats[bi]
      this.highlightBeat(bi)
      this.revealMotif(bi)
      try {
        await this.hostApi.speak(target, beat.targetText)
      } catch {
        /* host may reject when muted — fall through, timing approximated */
      }
      // Pace: if speak resolved instantly (muted host), give a calm read beat.
      await this.pause(this.approxReadMs(beat))
    }
    this.clearHighlight()
  }

  private approxReadMs(beat: Beat): number {
    const words = beat.tokens.filter((t) => t.glossable).length
    return Math.max(1400, Math.min(6000, words * 420))
  }

  private highlightBeat(bi: number) {
    this.beatEls.forEach((l, i) => l.classList.toggle("is-reading", i === bi))
  }
  private clearHighlight() {
    this.beatEls.forEach((l) => l.classList.remove("is-reading"))
  }

  private pause(ms: number): Promise<void> {
    return new Promise((res) => {
      const t = window.setTimeout(res, ms)
      this.timers.push(t)
    })
  }

  // ---- Completion (interlude-conformant) ----------------------------------
  /** A reader is UNSCORED: on finish we report a completion (score 1, no
   *  per-item verdicts) so the engine folds a graceful completion, then exit. */
  finish() {
    if (this.finished) return
    this.finished = true
    this.hostApi.stopSpeech?.()
    const journey = this.hostApi.journey
    if (this.spec && journey?.isActive()) {
      const result: ActivityResult = {
        specId: this.spec.specId,
        score: 1,
        perItem: [],
        durationMs: Math.round(performance.now() - this.started),
      }
      try {
        journey.reportResult(result)
      } catch (err) {
        console.warn("[drift] reportResult failed", err)
      }
    }
    // Standalone OR interlude: ask the host to dismiss the pack.
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  }

  dispose() {
    this.disposed = true
    this.hostApi.stopSpeech?.()
    this.timers.forEach((t) => window.clearTimeout(t))
    this.timers = []
    if (this.root.parentNode) this.root.parentNode.removeChild(this.root)
  }
}

export function createDrift(
  container: HTMLElement,
  hostApi: HostApi,
  spec: ActivitySpec | null,
  seed: number,
): Drift {
  return new Drift({ container, hostApi, spec, seed })
}
