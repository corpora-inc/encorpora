// Drift — "Catch the Drift". A calm night-water reader that IS a game: each
// story beat auto-narrates (word-sweep highlight) with its native translation
// standing permanently beneath it; then word-LANTERNS drift across the current
// and you CATCH (tap) the one carrying the target word — the word you HEARD
// (sound on) or the word MISSING from the gapped line (always visible, so a
// silenced phone degrades to the exact same solvable game). Catches kindle
// gold, score, streak, and a river-dot strand; a star end-screen ends the run.
// Tapping ANY prose word pays off RICH + INSTANTLY: the phrase's translation
// AND the word's meaning together, with etymology filling in when a word pack
// answers. The NAME is the mechanic: words drift away unless you catch them.
import type { HostApi } from "./sdk/types"
import type { ActivitySpec } from "./sdk/activityContract"
import { composeStory, type ComposedStory } from "./content/compose"
import type { SceneMotif } from "./content/stories"
import { buildChallenges, normalizeWord, type Challenge } from "./challenge"
import {
  layoutLanterns,
  remainingFraction,
  crossingProgress,
  type Lantern,
  type LanternField,
} from "./lantern"
import {
  catchPoints,
  multiplierForStreak,
  starsForAccuracy,
  bestStorageKey,
  parseBest,
  mergeBest,
  starGlyphs,
} from "./score"
import { DriftSession } from "./session"
import { EtymologyResolver } from "./etymology"
import { estimateSpeechDurationMs, waitForEstimatedSpeech } from "./speechTiming"
import { uiString } from "./i18n/strings"

type DriftOptions = {
  hostApi: HostApi
  container: HTMLElement
  spec: ActivitySpec | null
  seed: number
  nativeLocale?: string
}

const MOTIF_GLYPH: Record<SceneMotif, string> = {
  dawn: "◠",
  lantern: "✦",
  snow: "❄",
  tide: "≈",
  door: "❏",
  stars: "✧",
}

/** Cap so a user-instant exit is never blocked by a speech-pacing estimate. */
const SPEECH_WAIT_CAP_MS = 4200
/** Calm read beat used when narration is muted (no TTS to pace against). */
const MUTED_READ_MS = 2000
/** Gentle feedback dwell before the next beat. */
const FEEDBACK_MS = 1300
/** How many runs the first-launch hint chip appears for. */
const HINT_RUNS = 3
/** Auto-exit the end screen after this settle if the player walks away. */
const END_SETTLE_MS = 20000
/** Pill travel overshoot so a lantern fully clears both edges. */
const PILL_OVERSHOOT = 120

/** The active catch window's live state (rAF + pause + pointer). */
type WindowResult = {
  lantern: Lantern | null // null = drifted off (miss)
  el: HTMLElement | null
  remainingFraction: number
  latencyMs: number
  hintsUsed: number
}
type WindowState = {
  field: LanternField
  els: Map<Lantern, HTMLButtonElement>
  startAt: number
  pausedAt: number | null
  pausedTotal: number
  drifted: Set<Lantern>
  resolved: boolean
  rafId: number
  hintsUsed: number
  laneW: number
  tick: () => void
  onActivate: (e: Event) => void
  resolve: (r: WindowResult | null) => void
}

export class Drift {
  private hostApi: HostApi
  private container: HTMLElement
  private spec: ActivitySpec | null
  private seed: number
  private nativeLocale?: string
  private rate = 1

  private root!: HTMLElement
  private stage!: HTMLElement
  private proseEl!: HTMLElement
  private standingEl!: HTMLElement
  private motifLayer!: HTMLElement
  private soundBtn!: HTMLButtonElement
  private laneEl!: HTMLElement
  private hintEl!: HTMLElement
  private barEl!: HTMLElement
  private scoreNumEl!: HTMLElement
  private riverEl!: HTMLElement
  private streakEl!: HTMLElement
  private multEl!: HTMLElement
  private replayBtn!: HTMLButtonElement
  private endEl!: HTMLElement

  private story: ComposedStory | null = null
  private challengesByBeat = new Map<number, Challenge>()
  private session: DriftSession | null = null
  private etymology: EtymologyResolver | null = null
  private cardToken = 0

  private beatEls: HTMLElement[] = []
  private wordEls: HTMLElement[][] = [] // [beatIndex][tokenIndex]

  private muted = false
  private audioUnavailable = false
  private finished = false
  private disposed = false
  private replay = false
  private reduced = false
  private timers: number[] = []
  private sweepTimers: number[] = []

  // ---- run metrics (presentation layer; engine score stays correct/faced) --
  private faced = 0
  private correct = 0
  private streak = 0
  private bestStreak = 0
  private arcadeScore = 0
  private driftOuts = 0
  private firstWindow = true
  private hintActive = false
  private hintDismissed = false

  private windowState: WindowState | null = null

  constructor(opts: DriftOptions) {
    this.hostApi = opts.hostApi
    this.container = opts.container
    this.spec = opts.spec
    this.seed = opts.seed
    this.nativeLocale = opts.nativeLocale
    try {
      this.rate = this.hostApi.getStackConfig().rate || 1
    } catch {
      this.rate = 1
    }
    try {
      this.reduced =
        typeof window !== "undefined" &&
        !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    } catch {
      this.reduced = false
    }
    this.buildShell()
    void this.load()
  }

  private buildShell() {
    const root = document.createElement("div")
    root.className = "drift-root"
    if (this.reduced) root.classList.add("is-reduced")
    const listenLabel = uiString("listen", this.nativeLocale)
    root.innerHTML = `
      <div class="drift-stage">
        <div class="drift-motifs" aria-hidden="true"></div>
        <div class="drift-veil" aria-hidden="true"></div>
        <div class="drift-hud">
          <div class="drift-river" aria-hidden="true"></div>
          <div class="drift-score" role="status" aria-live="off"><span class="drift-score-num">0</span></div>
        </div>
        <div class="drift-scrim">
          <div class="drift-prose" role="article" aria-live="polite"></div>
          <p class="drift-standing" aria-live="polite"></p>
        </div>
        <div class="drift-lanewrap">
          <p class="drift-hint" hidden></p>
          <div class="drift-lane"></div>
          <div class="drift-bar" hidden><span></span></div>
          <div class="drift-window-chrome">
            <span class="drift-streak" hidden>✦ <span class="drift-streak-num">0</span></span>
            <span class="drift-mult" hidden></span>
            <button class="drift-replay" type="button" hidden aria-label="${listenLabel}">↻</button>
          </div>
        </div>
        <div class="drift-controls">
          <button class="drift-btn drift-sound is-on" type="button" aria-pressed="true" aria-label="${listenLabel}">
            <span class="drift-sound-glyph">♪</span>
          </button>
          <button class="drift-btn drift-done" type="button" data-i18n="done">Done</button>
        </div>
        <div class="drift-card" role="dialog" aria-live="polite" hidden>
          <button class="drift-card-close" type="button" aria-label="✕">✕</button>
          <p class="drift-card-word"></p>
          <div class="drift-card-phrase" hidden>
            <p class="drift-card-phrase-label"></p>
            <p class="drift-card-phrase-text"></p>
          </div>
          <p class="drift-card-gloss" hidden></p>
          <div class="drift-card-origin" hidden>
            <p class="drift-card-origin-label"></p>
            <p class="drift-card-origin-text"></p>
          </div>
        </div>
        <div class="drift-end" role="dialog" hidden>
          <div class="drift-end-inner">
            <p class="drift-end-title" data-i18n="score"></p>
            <p class="drift-end-score">0</p>
            <div class="drift-end-stars" aria-hidden="true"><span>☆</span><span>☆</span><span>☆</span></div>
            <p class="drift-end-line"></p>
            <div class="drift-end-review"></div>
            <p class="drift-end-best" hidden></p>
            <div class="drift-end-actions">
              <button class="drift-btn drift-again" type="button"></button>
              <button class="drift-btn drift-end-done" type="button" data-i18n="done">Done</button>
            </div>
          </div>
        </div>
      </div>
    `
    this.root = root
    this.stage = root.querySelector(".drift-stage") as HTMLElement
    this.proseEl = root.querySelector(".drift-prose") as HTMLElement
    this.standingEl = root.querySelector(".drift-standing") as HTMLElement
    this.motifLayer = root.querySelector(".drift-motifs") as HTMLElement
    this.soundBtn = root.querySelector(".drift-sound") as HTMLButtonElement
    this.laneEl = root.querySelector(".drift-lane") as HTMLElement
    this.hintEl = root.querySelector(".drift-hint") as HTMLElement
    this.barEl = root.querySelector(".drift-bar") as HTMLElement
    this.scoreNumEl = root.querySelector(".drift-score-num") as HTMLElement
    this.riverEl = root.querySelector(".drift-river") as HTMLElement
    this.streakEl = root.querySelector(".drift-streak") as HTMLElement
    this.multEl = root.querySelector(".drift-mult") as HTMLElement
    this.replayBtn = root.querySelector(".drift-replay") as HTMLButtonElement
    this.endEl = root.querySelector(".drift-end") as HTMLElement

    this.soundBtn.addEventListener("click", () => this.toggleMute())
    ;(root.querySelector(".drift-done") as HTMLButtonElement).addEventListener("click", () =>
      this.exit(),
    )
    ;(root.querySelector(".drift-end-done") as HTMLButtonElement).addEventListener("click", () =>
      this.exit(),
    )
    ;(root.querySelector(".drift-again") as HTMLButtonElement).addEventListener("click", () =>
      this.restart(),
    )
    // ONE delegated prose listener (robust on mobile webview: survives text
    // swaps, resolves taps on a word's punctuation/child via closest()).
    this.proseEl.addEventListener("click", (e) => this.onProseTap(e))
    ;(root.querySelector(".drift-card-close") as HTMLButtonElement).addEventListener(
      "click",
      () => this.hideCard(),
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
    this.etymology = new EtymologyResolver(this.hostApi, {
      targetLang: this.story.targetLang,
      nativeLang: this.story.nativeLang,
    })
    this.renderStory(this.story)
    this.renderRiver(this.story.beats.length)

    this.challengesByBeat.clear()
    for (const ch of buildChallenges(this.story, this.seed)) {
      this.challengesByBeat.set(ch.beatIndex, ch)
    }
    if (this.spec && this.hostApi.journey?.isActive() && !this.replay) {
      this.session = new DriftSession(this.spec, this.hostApi)
    }

    void this.run()
  }

  private renderEmpty() {
    this.proseEl.innerHTML = `<p class="drift-empty">…</p>`
  }

  private renderStory(story: ComposedStory) {
    this.proseEl.innerHTML = ""
    this.beatEls = []
    this.wordEls = []
    story.beats.forEach((beat, beatIndex) => {
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
        w.dataset.gloss = tok.gloss ?? ""
        w.dataset.word = normalizeWord(tok.text)
        w.dataset.beat = String(beatIndex)
        w.setAttribute("role", "button")
        w.tabIndex = 0
        line.appendChild(w)
        tokenEls.push(w)
      })
      this.proseEl.appendChild(line)
      this.beatEls.push(line)
      this.wordEls.push(tokenEls)
    })
  }

  private renderRiver(n: number) {
    this.riverEl.innerHTML = ""
    for (let i = 0; i < n; i++) {
      const dot = document.createElement("span")
      dot.className = "drift-dot"
      this.riverEl.appendChild(dot)
    }
  }

  // ---- The game loop -------------------------------------------------------
  private async run() {
    if (!this.story) return
    this.maybeShowHint()
    for (let bi = 0; bi < this.story.beats.length; bi++) {
      if (this.disposed || this.finished) return
      const beat = this.story.beats[bi]
      this.highlightBeat(bi)
      this.setStanding(beat.nativeGloss)
      this.revealMotif(bi)
      await this.speakLine(beat.targetText, bi)
      if (this.disposed || this.finished) return

      const challenge = this.challengesByBeat.get(bi)
      if (challenge) {
        const done = await this.runChallenge(challenge, bi)
        if (!done || this.disposed || this.finished) return
      } else {
        await this.pause(500)
      }
      this.fillRiverDot(bi)
    }
    this.clearHighlight()
    this.completeNaturally()
  }

  /** Speak a line, sweep the word highlight across it, pace against it. */
  private async speakLine(text: string, bi: number): Promise<void> {
    const waitMs = this.muted
      ? MUTED_READ_MS
      : Math.min(estimateSpeechDurationMs(text, this.rate), SPEECH_WAIT_CAP_MS)
    this.sweepWords(bi, waitMs)
    if (this.muted) {
      await this.pause(MUTED_READ_MS)
      return
    }
    const startedAt = performance.now()
    try {
      await this.hostApi.speak(this.story?.targetLang ?? "", text)
    } catch {
      this.audioUnavailable = true
    }
    if (this.disposed || this.finished) return
    await waitForEstimatedSpeech(
      startedAt,
      estimateSpeechDurationMs(text, this.rate),
      SPEECH_WAIT_CAP_MS,
    )
  }

  /** Advance the is-reading-word highlight across a beat's tokens over `totalMs`. */
  private sweepWords(bi: number, totalMs: number) {
    this.sweepTimers.forEach((t) => window.clearTimeout(t))
    this.sweepTimers = []
    const els = this.wordEls[bi] ?? []
    if (els.length === 0) return
    const step = Math.max(120, totalMs / els.length)
    els.forEach((el, i) => {
      const t = window.setTimeout(() => {
        els.forEach((e, j) => e.classList.toggle("is-reading-word", j === i))
        if (i === els.length - 1) {
          const c = window.setTimeout(() => el.classList.remove("is-reading-word"), step)
          this.timers.push(c)
        }
      }, i * step)
      this.sweepTimers.push(t)
      this.timers.push(t)
    })
  }

  /**
   * One catch window. ALWAYS opens the cloze gap (both variants — a silenced
   * phone is then structurally the muted game). Sound on additionally speaks the
   * target as the lanterns launch. Resolves true when resolved, false if aborted.
   */
  private async runChallenge(ch: Challenge, bi: number): Promise<boolean> {
    const visual = this.muted || this.audioUnavailable
    this.setHintText(visual)
    const gap = this.openGap(ch)

    const field = layoutLanterns(ch.options, ch.targetWord, this.seed + bi * 97 + 1, {
      guaranteedFirst: this.firstWindow,
      reduced: this.reduced,
    })
    this.firstWindow = false

    this.showReplay(!visual, ch)
    if (!visual) void this.speakWord(ch.targetWord) // concurrent — never gates launch

    const result = await this.openWindow(field)
    this.hideReplay()
    if (result == null) {
      if (gap) this.restoreGap(gap)
      return false // aborted (exit/dispose)
    }

    const correct = !!result.lantern?.isTarget
    if (result.lantern == null) this.driftOuts += 1
    this.faced += 1
    if (correct) {
      this.correct += 1
      this.streak += 1
      this.bestStreak = Math.max(this.bestStreak, this.streak)
      const mult = multiplierForStreak(this.streak)
      const pts = Math.round(catchPoints(result.remainingFraction) * mult)
      this.arcadeScore += pts
      this.updateScore()
      this.floatPlus(pts, result.el)
      this.dismissHint()
    } else {
      this.streak = 0
    }
    this.updateStreak()

    this.session?.noteAnswer(ch.itemRef, correct, result.latencyMs, result.hintsUsed)

    if (gap) this.restoreGap(gap) // reveal the real word back in the line
    await this.pause(FEEDBACK_MS)
    if (this.disposed || this.finished) return false
    this.clearLane()
    return true
  }

  // ---- Catch window: lanterns drift; tap the right one ---------------------
  private openWindow(field: LanternField): Promise<WindowResult | null> {
    return new Promise((resolve) => {
      this.clearLane()
      const laneW = this.laneEl.getBoundingClientRect().width || 320
      const els = new Map<Lantern, HTMLButtonElement>()
      field.lanterns.forEach((lan, idx) => {
        const el = document.createElement("button")
        el.type = "button"
        el.className =
          "drift-lantern" +
          (lan.pulse ? " is-pulse" : "") +
          (lan.isTarget ? " is-target" : "")
        el.textContent = lan.word
        el.dataset.idx = String(idx)
        el.style.setProperty("--lane", String(lan.lane))
        el.style.touchAction = "manipulation"
        if (this.reduced) {
          const cols = Math.max(1, field.lanterns.length)
          const x = (laneW * (idx + 0.5)) / cols - laneW / 2
          el.style.transform = `translate(calc(-50% + ${x}px), 0)`
        } else {
          el.style.opacity = "0"
        }
        this.laneEl.appendChild(el)
        els.set(lan, el)
      })

      const state: WindowState = {
        field,
        els,
        startAt: performance.now(),
        pausedAt: null,
        pausedTotal: 0,
        drifted: new Set(),
        resolved: false,
        rafId: 0,
        hintsUsed: 0,
        laneW,
        tick: () => {},
        onActivate: () => {},
        resolve,
      }
      this.windowState = state
      if (this.reduced) this.showBar(true)

      const clockOf = () => {
        const end = state.pausedAt != null ? state.pausedAt : performance.now()
        return end - state.startAt - state.pausedTotal
      }

      state.onActivate = (e: Event) => {
        if (state.resolved) return
        const hit = (e.target as HTMLElement)?.closest?.(".drift-lantern") as HTMLElement | null
        if (!hit) return
        const lan = field.lanterns[Number(hit.dataset.idx)]
        if (!lan || state.drifted.has(lan)) return
        e.preventDefault()
        const clock = clockOf()
        const elapsed = clock - lan.startDelayMs
        const rf = remainingFraction(elapsed, field.crossMs)
        this.resolveWindow(state, {
          lantern: lan,
          el: hit,
          remainingFraction: rf,
          latencyMs: clock,
          hintsUsed: state.hintsUsed,
        })
      }
      this.laneEl.addEventListener("pointerdown", state.onActivate)
      this.laneEl.addEventListener("click", state.onActivate) // keyboard/AT fallback

      state.tick = () => {
        if (state.resolved || this.disposed) return
        if (state.pausedAt != null) return // paused — resume reschedules
        const clock = clockOf()
        let allDrifted = true
        for (const lan of field.lanterns) {
          const el = els.get(lan)
          if (!el) continue
          const elapsed = clock - lan.startDelayMs
          if (elapsed < 0) {
            allDrifted = false
            continue
          }
          const prog = crossingProgress(elapsed, field.crossMs)
          if (prog >= 1) {
            if (!state.drifted.has(lan)) {
              state.drifted.add(lan)
              el.classList.add("is-gone")
              if (lan.isTarget) el.classList.add("is-taught") // kindle as it drifts (teach-back)
            }
          } else {
            allDrifted = false
            if (!this.reduced) {
              el.style.opacity = "1"
              const x = state.laneW - prog * (state.laneW + PILL_OVERSHOOT)
              el.style.transform = `translateY(-50%) translateX(${x}px)`
            }
          }
        }
        if (this.reduced) this.setBar(1 - Math.min(1, clock / field.crossMs))
        if (allDrifted || clock > field.windowMs + 500) {
          this.resolveWindow(state, {
            lantern: null,
            el: null,
            remainingFraction: 0,
            latencyMs: field.windowMs,
            hintsUsed: state.hintsUsed,
          })
          return
        }
        state.rafId = requestAnimationFrame(state.tick)
      }
      state.rafId = requestAnimationFrame(state.tick)
    })
  }

  private resolveWindow(state: WindowState, result: WindowResult) {
    if (state.resolved) return
    state.resolved = true
    if (state.rafId) cancelAnimationFrame(state.rafId)
    this.laneEl.removeEventListener("pointerdown", state.onActivate)
    this.laneEl.removeEventListener("click", state.onActivate)
    if (this.reduced) this.showBar(false)
    if (this.windowState === state) this.windowState = null

    if (result.lantern) {
      if (result.lantern.isTarget) result.el?.classList.add("is-caught")
      else {
        result.el?.classList.add("is-missed")
        const correct = state.field.lanterns.find((l) => l.isTarget)
        if (correct) state.els.get(correct)?.classList.add("is-taught")
      }
    }
    state.els.forEach((el) => {
      el.disabled = true
    })
    state.resolve(result)
  }

  /** Abort the live window (exit/dispose) so the run loop can unwind. */
  private abortWindow() {
    const s = this.windowState
    if (s && !s.resolved) {
      s.resolved = true
      if (s.rafId) cancelAnimationFrame(s.rafId)
      this.laneEl.removeEventListener("pointerdown", s.onActivate)
      this.laneEl.removeEventListener("click", s.onActivate)
      this.windowState = null
      s.resolve(null)
    }
  }

  private pauseWindow() {
    const s = this.windowState
    if (!s || s.resolved || s.pausedAt != null) return
    s.pausedAt = performance.now()
    s.hintsUsed = 1 // curiosity mid-window is honest FSRS evidence
    if (s.rafId) cancelAnimationFrame(s.rafId)
    this.laneEl.classList.add("is-paused")
  }

  private resumeWindow() {
    const s = this.windowState
    if (!s || s.resolved || s.pausedAt == null) return
    s.pausedTotal += performance.now() - s.pausedAt
    s.pausedAt = null
    this.laneEl.classList.remove("is-paused")
    s.rafId = requestAnimationFrame(s.tick)
  }

  private clearLane() {
    this.laneEl.innerHTML = ""
  }

  private showBar(on: boolean) {
    this.barEl.hidden = !on
    if (on) this.setBar(1)
  }
  private setBar(frac: number) {
    const inner = this.barEl.firstElementChild as HTMLElement | null
    if (inner) inner.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`
  }

  // ---- Cloze gap (always opens; silent-device proof) -----------------------
  private openGap(ch: Challenge): { el: HTMLElement; text: string } | null {
    const slots = this.wordEls[ch.beatIndex] ?? []
    const el = slots.find(
      (w) => normalizeWord(w.textContent ?? "") === normalizeWord(ch.targetWord),
    )
    if (!el) return null
    const text = el.textContent ?? ""
    el.classList.add("drift-word--gap")
    el.textContent = "•••"
    return { el, text }
  }
  private restoreGap(slot: { el: HTMLElement; text: string }) {
    slot.el.textContent = slot.text
    slot.el.classList.remove("drift-word--gap")
    slot.el.classList.add("is-restored")
    const t = window.setTimeout(() => slot.el.classList.remove("is-restored"), 900)
    this.timers.push(t)
  }

  // ---- HUD: score, streak, river, floating +N ------------------------------
  private updateScore() {
    this.scoreNumEl.textContent = String(this.arcadeScore)
    this.scoreNumEl.classList.remove("is-bump")
    void this.scoreNumEl.offsetWidth
    this.scoreNumEl.classList.add("is-bump")
  }
  private updateStreak() {
    const num = this.streakEl.querySelector(".drift-streak-num") as HTMLElement
    if (this.streak >= 2) {
      this.streakEl.hidden = false
      num.textContent = String(this.streak)
    } else {
      this.streakEl.hidden = true
    }
    const mult = multiplierForStreak(this.streak)
    if (mult > 1) {
      this.multEl.hidden = false
      this.multEl.textContent = `×${mult}`
    } else {
      this.multEl.hidden = true
    }
    this.stage.classList.toggle("is-bloom", this.streak >= 6)
  }
  private floatPlus(pts: number, near: HTMLElement | null) {
    const plus = document.createElement("span")
    plus.className = "drift-plus"
    plus.textContent = `+${pts}`
    const host = near ?? this.laneEl
    host.appendChild(plus)
    void plus.offsetWidth
    plus.classList.add("is-on")
    const t = window.setTimeout(() => plus.remove(), 1100)
    this.timers.push(t)
  }
  private fillRiverDot(bi: number) {
    const dot = this.riverEl.children[bi] as HTMLElement | undefined
    dot?.classList.add("is-filled")
  }

  // ---- First-launch hint ---------------------------------------------------
  private maybeShowHint() {
    let runs = 0
    try {
      runs = Number(localStorage.getItem("drift.hintRuns") || "0") || 0
      localStorage.setItem("drift.hintRuns", String(runs + 1))
    } catch {
      /* storage unavailable — just show it */
    }
    this.hintActive = runs < HINT_RUNS
    this.hintDismissed = false
  }
  private setHintText(visual: boolean) {
    this.hintEl.textContent = uiString(visual ? "hintCatchMissing" : "hintCatch", this.nativeLocale)
    this.hintEl.hidden = !(this.hintActive && !this.hintDismissed)
  }
  private dismissHint() {
    if (this.hintDismissed) return
    this.hintDismissed = true
    this.hintEl.hidden = true
  }

  private showReplay(on: boolean, ch: Challenge) {
    this.replayBtn.hidden = !on
    this.replayBtn.onclick = on ? () => void this.speakWord(ch.targetWord) : null
  }
  private hideReplay() {
    this.replayBtn.hidden = true
    this.replayBtn.onclick = null
  }

  private setStanding(gloss: string) {
    this.standingEl.textContent = gloss || ""
    this.standingEl.classList.toggle("is-on", !!gloss)
  }

  // ---- Motifs (the scene rides the same current) ---------------------------
  private revealMotif(beatIndex: number) {
    if (!this.story) return
    const motif = this.story.beats[beatIndex]?.motif
    if (!motif) return
    const el = document.createElement("div")
    el.className = `drift-motif drift-motif--${motif}`
    el.textContent = MOTIF_GLYPH[motif]
    el.style.setProperty("--i", String(beatIndex))
    this.motifLayer.appendChild(el)
    void el.offsetWidth
    el.classList.add("is-on")
  }

  // ---- Word tap → RICH card: phrase translation + meaning + origin ---------
  private onProseTap(e: Event) {
    const target = e.target as HTMLElement | null
    const word = target?.closest?.(".drift-word") as HTMLElement | null
    if (!word) return
    if (word.classList.contains("drift-word--gap")) return // it's a game target now
    this.showWordCard(word)
  }

  private showWordCard(anchor: HTMLElement) {
    const word = anchor.dataset.word || normalizeWord(anchor.textContent ?? "")
    const gloss = anchor.dataset.gloss ?? ""
    const beatIdx = Number(anchor.dataset.beat)
    const phrase = this.story?.beats[beatIdx]?.nativeGloss ?? ""

    // Opening during a live window pauses it (honest hintsUsed) and freezes drift.
    this.pauseWindow()

    this.beatEls.forEach((l) =>
      l.querySelectorAll(".drift-word").forEach((w) => w.classList.remove("is-tapped")),
    )
    anchor.classList.add("is-tapped")

    const card = this.root.querySelector(".drift-card") as HTMLElement
    ;(card.querySelector(".drift-card-word") as HTMLElement).textContent = word

    // PHRASE TRANSLATION — always present (data is on every beat). This is the
    // standing answer to "why doesn't it just show the translation of the phrase".
    const phraseWrap = card.querySelector(".drift-card-phrase") as HTMLElement
    if (phrase) {
      ;(card.querySelector(".drift-card-phrase-label") as HTMLElement).textContent = uiString(
        "phrase",
        this.nativeLocale,
      )
      ;(card.querySelector(".drift-card-phrase-text") as HTMLElement).textContent = phrase
      phraseWrap.hidden = false
    } else {
      phraseWrap.hidden = true
    }

    // WORD MEANING — only when distinct from the phrase gloss (avoid duplication).
    const glossEl = card.querySelector(".drift-card-gloss") as HTMLElement
    const showGloss = !!gloss && gloss !== phrase
    glossEl.textContent = showGloss ? gloss : ""
    glossEl.hidden = !showGloss

    const originWrap = card.querySelector(".drift-card-origin") as HTMLElement
    originWrap.hidden = true
    ;(card.querySelector(".drift-card-origin-text") as HTMLElement).textContent = ""

    card.hidden = false
    void card.offsetWidth
    card.classList.add("is-on")
    const token = ++this.cardToken

    // ORIGIN — async bonus; the card is already rich without it.
    if (this.etymology?.enabled) {
      void this.etymology.lookup(word).then((origin) => {
        if (this.disposed || token !== this.cardToken || !origin) return
        ;(card.querySelector(".drift-card-origin-label") as HTMLElement).textContent = uiString(
          "origin",
          this.nativeLocale,
        )
        ;(card.querySelector(".drift-card-origin-text") as HTMLElement).textContent =
          origin.paragraph
        originWrap.hidden = false
      })
    }
  }

  /** Reopen a word's card from the end-screen review row. */
  private showWordCardByRef(word: string, beatIdx: number, gloss: string) {
    const fake = document.createElement("span")
    fake.dataset.word = word
    fake.dataset.gloss = gloss
    fake.dataset.beat = String(beatIdx)
    fake.textContent = word
    this.showWordCard(fake)
  }

  private hideCard() {
    const card = this.root.querySelector(".drift-card") as HTMLElement
    this.cardToken++
    card.classList.remove("is-on")
    this.beatEls.forEach((l) =>
      l.querySelectorAll(".drift-word").forEach((w) => w.classList.remove("is-tapped")),
    )
    const t = window.setTimeout(() => {
      card.hidden = true
    }, 260)
    this.timers.push(t)
    this.resumeWindow()
  }

  // ---- Narration control ---------------------------------------------------
  private toggleMute() {
    this.muted = !this.muted
    this.soundBtn.setAttribute("aria-pressed", String(!this.muted))
    this.soundBtn.classList.toggle("is-on", !this.muted)
    const glyph = this.soundBtn.querySelector(".drift-sound-glyph") as HTMLElement
    if (glyph) glyph.textContent = this.muted ? "𝄽" : "♪"
    if (this.muted) this.hostApi.stopSpeech?.()
  }

  private async speakWord(word: string): Promise<void> {
    if (this.muted) return
    try {
      await this.hostApi.speak(this.story?.targetLang ?? "", word)
    } catch {
      this.audioUnavailable = true
    }
  }

  private highlightBeat(bi: number) {
    this.beatEls.forEach((l, i) => l.classList.toggle("is-reading", i === bi))
  }
  private clearHighlight() {
    this.beatEls.forEach((l) => {
      l.classList.remove("is-reading")
      l.querySelectorAll(".drift-word").forEach((w) => w.classList.remove("is-reading-word"))
    })
  }

  private pause(ms: number): Promise<void> {
    return new Promise((res) => {
      const t = window.setTimeout(res, ms)
      this.timers.push(t)
    })
  }

  // ---- End screen + completion ---------------------------------------------
  private completeNaturally() {
    if (this.finished) return
    this.finished = true
    this.hostApi.stopSpeech?.()
    const accuracy = this.faced > 0 ? this.correct / this.faced : 0
    const stars = starsForAccuracy(accuracy)
    this.session?.setExtras({
      arcadeScore: this.arcadeScore,
      bestStreak: this.bestStreak,
      driftOuts: this.driftOuts,
      stars,
    })
    this.session?.finish()
    this.showEndScreen(stars)
  }

  private showEndScreen(stars: number) {
    const scoreEl = this.endEl.querySelector(".drift-end-score") as HTMLElement
    scoreEl.textContent = String(this.arcadeScore)
    ;(this.endEl.querySelector(".drift-end-title") as HTMLElement).textContent = uiString(
      "score",
      this.nativeLocale,
    )
    // accuracy + best-streak line
    const line = this.endEl.querySelector(".drift-end-line") as HTMLElement
    line.textContent = `${this.correct}/${this.faced} ${uiString(
      "caught",
      this.nativeLocale,
    )} · ${uiString("bestStreak", this.nativeLocale)} ${this.bestStreak}`

    // review row: each target word as a tappable lantern reopening its rich card
    const review = this.endEl.querySelector(".drift-end-review") as HTMLElement
    review.innerHTML = ""
    for (const ch of this.challengesByBeat.values()) {
      const b = document.createElement("button")
      b.type = "button"
      b.className = "drift-lantern drift-lantern--review"
      b.textContent = ch.targetWord
      b.style.touchAction = "manipulation"
      const gloss = ch.targetGloss
      const beatIdx = ch.beatIndex
      b.addEventListener("click", () => this.showWordCardByRef(ch.targetWord, beatIdx, gloss))
      review.appendChild(b)
    }

    // personal best (per scene)
    this.persistAndShowBest(stars)

    ;(this.endEl.querySelector(".drift-again") as HTMLButtonElement).textContent = uiString(
      "again",
      this.nativeLocale,
    )
    ;(this.endEl.querySelector(".drift-end-done") as HTMLElement).textContent = uiString(
      "done",
      this.nativeLocale,
    )

    this.endEl.hidden = false
    void this.endEl.offsetWidth
    this.endEl.classList.add("is-on")

    // kindle the stars one by one
    const starEls = this.endEl.querySelectorAll<HTMLElement>(".drift-end-stars span")
    starEls.forEach((s, i) => {
      s.textContent = "☆"
      if (i < stars) {
        const t = window.setTimeout(() => {
          s.textContent = "★"
          s.classList.add("is-lit")
        }, 400 + i * 420)
        this.timers.push(t)
      }
    })

    const t = window.setTimeout(() => this.exit(), END_SETTLE_MS)
    this.timers.push(t)
  }

  private persistAndShowBest(stars: number) {
    const el = this.endEl.querySelector(".drift-end-best") as HTMLElement
    const sceneId = this.story?.scene.id ?? "drift"
    const key = bestStorageKey(sceneId)
    let prev = null
    try {
      prev = parseBest(localStorage.getItem(key))
    } catch {
      prev = null
    }
    const merged = mergeBest(prev, { arcadeScore: this.arcadeScore, stars })
    try {
      localStorage.setItem(key, JSON.stringify(merged))
    } catch {
      /* ignore */
    }
    el.textContent = `${starGlyphs(merged.stars)}  ${merged.arcadeScore}`
    el.hidden = false
  }

  /** "Drift again": reseed + remount the run locally (never re-reports). */
  private restart() {
    // tear down the finished run's visuals + timers, keep the shell
    this.abortWindow()
    this.timers.forEach((t) => window.clearTimeout(t))
    this.timers = []
    this.sweepTimers = []
    this.hostApi.stopSpeech?.()
    this.endEl.classList.remove("is-on")
    this.endEl.hidden = true
    this.motifLayer.innerHTML = ""
    this.clearLane()
    this.setStanding("")
    this.hideCard()

    this.faced = 0
    this.correct = 0
    this.streak = 0
    this.bestStreak = 0
    this.arcadeScore = 0
    this.driftOuts = 0
    this.firstWindow = true
    this.scoreNumEl.textContent = "0"
    this.updateStreak()
    this.stage.classList.remove("is-bloom")

    this.finished = false
    this.replay = true // the journey session already reported; a replay must not
    this.session = null
    this.seed += 1
    void this.load()
  }

  /** User-initiated exit (Done). Instant; a mid-run exit is an ABANDON. */
  private exit() {
    const wasFinished = this.finished
    this.finished = true
    this.hostApi.stopSpeech?.()
    this.abortWindow()
    if (!wasFinished) this.session?.abandon("user_exit")
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  }

  dispose() {
    this.disposed = true
    this.hostApi.stopSpeech?.()
    this.abortWindow()
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
  nativeLocale?: string,
): Drift {
  return new Drift({ container, hostApi, spec, seed, nativeLocale })
}
