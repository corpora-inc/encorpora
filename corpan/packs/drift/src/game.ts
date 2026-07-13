// Drift — a calm micro-story that now plays a light game loop: the beats
// AUTO-NARRATE on entry (with a mute control), and after each spoken beat a
// gentle "which word did you hear?" challenge floats up. Answers are scored and
// reported as a real ActivityResult so the journey engine can grade the phrases
// the drift featured. Self-contained: no shared deps.
import type { HostApi } from "./sdk/types"
import type { ActivitySpec } from "./sdk/activityContract"
import { composeStory, type ComposedStory } from "./content/compose"
import type { SceneMotif } from "./content/stories"
import {
  buildChallenges,
  isCorrectPick,
  type Challenge,
  type ChallengeAnswer,
} from "./challenge"
import { DriftSession } from "./session"
import { estimateSpeechDurationMs, waitForEstimatedSpeech } from "./speechTiming"
import { uiString } from "./i18n/strings"

type DriftOptions = {
  hostApi: HostApi
  container: HTMLElement
  /** The journey spec when launched as an interlude, else null (standalone). */
  spec: ActivitySpec | null
  seed: number
  /** Learner's native locale (languages[0]) for the chrome prompt. */
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
const MUTED_READ_MS = 1500
/** Gentle feedback dwell before the next beat. */
const FEEDBACK_MS = 1300

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
  private motifLayer!: HTMLElement
  private soundBtn!: HTMLButtonElement
  private promptEl!: HTMLElement
  private optionsEl!: HTMLElement

  private story: ComposedStory | null = null
  private challengesByBeat = new Map<number, Challenge>()
  private answers: ChallengeAnswer[] = []
  private session: DriftSession | null = null

  private beatEls: HTMLElement[] = []
  private wordEls: HTMLElement[][] = [] // [beatIndex][tokenIndex]

  private muted = false
  private finished = false
  private disposed = false
  private timers: number[] = []
  /** Resolver for the challenge tap currently awaited (null when none). */
  private pendingPick: ((pick: string | null) => void) | null = null

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
    this.buildShell()
    void this.load()
  }

  private buildShell() {
    const root = document.createElement("div")
    root.className = "drift-root"
    const listenLabel = uiString("listen", this.nativeLocale)
    root.innerHTML = `
      <div class="drift-stage">
        <div class="drift-motifs" aria-hidden="true"></div>
        <div class="drift-veil" aria-hidden="true"></div>
        <div class="drift-scrim">
          <div class="drift-prose" role="article" aria-live="polite"></div>
        </div>
        <div class="drift-challenge" hidden>
          <p class="drift-prompt" data-i18n="heard"></p>
          <div class="drift-options" role="group"></div>
        </div>
        <div class="drift-controls">
          <button class="drift-btn drift-sound is-on" type="button" aria-pressed="true" aria-label="${listenLabel}">
            <span class="drift-sound-glyph">♪</span>
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
    this.promptEl = root.querySelector(".drift-prompt") as HTMLElement
    this.optionsEl = root.querySelector(".drift-options") as HTMLElement
    this.promptEl.textContent = uiString("heard", this.nativeLocale)

    this.soundBtn.addEventListener("click", () => this.toggleMute())
    ;(root.querySelector(".drift-done") as HTMLButtonElement).addEventListener("click", () =>
      this.exit(),
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

    // Build the light challenges + (in a journey launch) the reporting session.
    for (const ch of buildChallenges(this.story, this.seed)) {
      this.challengesByBeat.set(ch.beatIndex, ch)
    }
    if (this.spec && this.hostApi.journey?.isActive()) {
      this.session = new DriftSession(this.spec, this.hostApi)
    }

    void this.run()
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

  // ---- The game loop: narrate a beat, then challenge on it -----------------
  private async run() {
    if (!this.story) return
    for (let bi = 0; bi < this.story.beats.length; bi++) {
      if (this.disposed || this.finished) return
      const beat = this.story.beats[bi]
      this.highlightBeat(bi)
      this.revealMotif(bi)
      await this.speakLine(beat.targetText)
      if (this.disposed || this.finished) return

      // A challenge only makes sense when the learner could actually HEAR the
      // target word — while muted, drift stays a pure calm reader (guessed
      // answers would stream junk pass/fail evidence into the journey engine).
      const challenge = this.challengesByBeat.get(bi)
      if (challenge && !this.muted) {
        const done = await this.runChallenge(challenge)
        if (!done || this.disposed || this.finished) return
      } else {
        await this.pause(600)
      }
    }
    this.clearHighlight()
    this.completeNaturally()
  }

  /** Speak a line and pace against it (mute → a calm silent read beat). */
  private async speakLine(text: string): Promise<void> {
    if (this.muted) {
      await this.pause(MUTED_READ_MS)
      return
    }
    const startedAt = performance.now()
    try {
      await this.hostApi.speak(this.story?.targetLang ?? "", text)
    } catch {
      /* host may reject when globally muted — pacing still holds below */
    }
    if (this.disposed || this.finished) return
    await waitForEstimatedSpeech(
      startedAt,
      estimateSpeechDurationMs(text, this.rate),
      SPEECH_WAIT_CAP_MS,
    )
  }

  /**
   * Present one challenge: speak the target word, float the candidate chips,
   * await a tap. Resolves true when answered, false if aborted (exit/dispose).
   */
  private async runChallenge(ch: Challenge): Promise<boolean> {
    // Speak the target word alone (grounded in the beat just heard).
    if (!this.muted) await this.speakWord(ch.targetWord)
    if (this.disposed || this.finished) return false

    this.renderOptions(ch)
    this.showChallenge(true)

    const presentedAt = performance.now()
    const pick = await this.awaitPick()
    if (pick == null) return false // aborted

    const correct = isCorrectPick(pick, ch.targetWord)
    const latencyMs = performance.now() - presentedAt
    this.answers.push({ challenge: ch, correct, latencyMs })
    this.session?.noteAnswer(ch.itemRef, correct, latencyMs)

    this.markVerdict(pick, ch.targetWord, correct)
    if (ch.targetGloss) this.showGlossText(ch.targetGloss)
    await this.pause(FEEDBACK_MS)
    if (this.disposed || this.finished) return false

    this.showChallenge(false)
    this.optionsEl.innerHTML = ""
    return true
  }

  private renderOptions(ch: Challenge) {
    this.optionsEl.innerHTML = ""
    ch.options.forEach((opt, i) => {
      const chip = document.createElement("button")
      chip.type = "button"
      chip.className = "drift-chip"
      chip.textContent = opt
      chip.style.setProperty("--i", String(i))
      chip.dataset.word = opt
      chip.addEventListener("click", () => {
        if (this.pendingPick) {
          // Lock the group so a second tap can't double-resolve.
          this.optionsEl
            .querySelectorAll<HTMLButtonElement>(".drift-chip")
            .forEach((c) => (c.disabled = true))
          const resolve = this.pendingPick
          this.pendingPick = null
          resolve(opt)
        }
      })
      this.optionsEl.appendChild(chip)
    })
  }

  /** Resolves with the tapped word, or null if the run is aborted meanwhile. */
  private awaitPick(): Promise<string | null> {
    return new Promise((resolve) => {
      this.pendingPick = resolve
    })
  }

  /** Cancel any awaited tap so the run loop can unwind on exit/dispose. */
  private abortPending() {
    if (this.pendingPick) {
      const resolve = this.pendingPick
      this.pendingPick = null
      resolve(null)
    }
  }

  private markVerdict(pick: string, target: string, correct: boolean) {
    this.optionsEl.querySelectorAll<HTMLButtonElement>(".drift-chip").forEach((chip) => {
      const w = chip.dataset.word ?? ""
      if (isCorrectPick(w, target)) chip.classList.add("is-right")
      else if (isCorrectPick(w, pick) && !correct) chip.classList.add("is-wrong")
      else chip.classList.add("is-dim")
    })
  }

  private showChallenge(on: boolean) {
    const panel = this.root.querySelector(".drift-challenge") as HTMLElement
    if (on) {
      panel.hidden = false
      void panel.offsetWidth
      panel.classList.add("is-on")
    } else {
      panel.classList.remove("is-on")
      const t = window.setTimeout(() => {
        panel.hidden = true
      }, 260)
      this.timers.push(t)
    }
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
    void el.offsetWidth
    el.classList.add("is-on")
  }

  // ---- Gloss reveal (tap any word, or challenge feedback) -----------------
  private showGloss(gloss: string, anchor: HTMLElement) {
    if (!gloss) return
    this.beatEls.forEach((l) =>
      l.querySelectorAll(".drift-word").forEach((w) => w.classList.remove("is-tapped")),
    )
    anchor.classList.add("is-tapped")
    this.showGlossText(gloss)
  }

  private showGlossText(gloss: string) {
    const el = this.root.querySelector(".drift-gloss") as HTMLElement
    if (!gloss) return
    el.textContent = gloss
    el.hidden = false
    el.classList.add("is-on")
    const t = window.setTimeout(() => {
      el.classList.remove("is-on")
      const h = window.setTimeout(() => {
        el.hidden = true
      }, 260)
      this.timers.push(h)
    }, 2400)
    this.timers.push(t)
  }

  // ---- Narration control (auto-plays; mute is user-initiated) -------------
  private toggleMute() {
    this.muted = !this.muted
    this.soundBtn.setAttribute("aria-pressed", String(!this.muted))
    this.soundBtn.classList.toggle("is-on", !this.muted)
    const glyph = this.soundBtn.querySelector(".drift-sound-glyph") as HTMLElement
    if (glyph) glyph.textContent = this.muted ? "𝄽" : "♪"
    if (this.muted) this.hostApi.stopSpeech?.()
  }

  private async speakWord(word: string): Promise<void> {
    const startedAt = performance.now()
    try {
      await this.hostApi.speak(this.story?.targetLang ?? "", word)
    } catch {
      /* muted host — the chips are still shown, learner reads them */
    }
    if (this.disposed || this.finished) return
    await waitForEstimatedSpeech(
      startedAt,
      estimateSpeechDurationMs(word, this.rate),
      SPEECH_WAIT_CAP_MS,
    )
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

  // ---- Completion ---------------------------------------------------------
  /** Natural end: report a real terminal result (scored), then exit. */
  private completeNaturally() {
    if (this.finished) return
    this.finished = true
    this.hostApi.stopSpeech?.()
    this.session?.finish()
    // A short calm settle so the last feedback breathes, then scroll on. The
    // Done button remains instant during this window (turbo-scroll principle).
    const t = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("corpan:exit"))
    }, 500)
    this.timers.push(t)
  }

  /** User-initiated exit (Done). Instant; a mid-run exit is an ABANDON. */
  private exit() {
    const wasFinished = this.finished
    this.finished = true
    this.hostApi.stopSpeech?.()
    this.abortPending()
    if (!wasFinished) {
      // Natural completion already reported via completeNaturally(); a Done tap
      // before that is an abandon (host synthesizes from buffered items).
      this.session?.abandon("user_exit")
    }
    window.dispatchEvent(new CustomEvent("corpan:exit"))
  }

  dispose() {
    this.disposed = true
    this.hostApi.stopSpeech?.()
    this.abortPending()
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
