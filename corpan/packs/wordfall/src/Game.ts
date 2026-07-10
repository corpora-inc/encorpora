/**
 * Game.ts — the Wordfall canvas game.
 *
 * Loop: a prompt (the meaning) sits at the top; target-language word tiles rain
 * down. The learner taps the tile whose meaning matches the prompt before it
 * hits the floor. Catch clean → combo builds, tile is spoken, next round.
 * Wrong tap or a floored correct tile → the item fails; the round advances.
 *
 * Two run shapes, ONE code path:
 *   - JOURNEY (interlude): a WordfallSession is supplied. Content is the spec's
 *     itemRefs (resolved to entries by the mount), distractors from the same
 *     host sampler. Each resolve calls session.noteResolved (→ reportItem), and
 *     the run ends after `session.rounds` with exactly one session.finish()
 *     (→ reportResult) followed by `corpan:exit`. No menus, no "play again".
 *   - STANDALONE: no session. Entries sampled from hostApi.getRandomEntries; a
 *     start card and an endless "play again" card frame the run. Never reports.
 *
 * Squared-off premium dark visuals, violet accent; overlay HUD never reflows.
 */

import type { EntryOut, HostApi } from "./sdk/types"
import type { ActivitySpec } from "./sdk/activityContract"
import { resolveRound, buildDistractors, type RoundContent } from "./content"
import { WordfallSession, type CatchOutcome } from "./journey/session"
import { Sfx } from "./audio"

type Tile = {
  text: string
  isTarget: boolean
  x: number // center px
  y: number // top px
  w: number
  h: number
  vy: number // px/sec
  wobble: number
  state: "falling" | "caught" | "shattered"
  anim: number // 0..1 resolve animation progress
}

type PreparedRound = {
  content: RoundContent
  distractors: string[]
}

const TILE_H = 52
const FLOOR_MARGIN = 24
const PROMPT_SAFE_TOP = 92 // px reserved for the prompt overlay
const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

export type GameOptions = {
  /** Present ⇒ interlude mode: content + reporting come from the session. */
  session?: WordfallSession | null
  /** Journey spec (interlude only) — supplies target/native langs + entries. */
  spec?: ActivitySpec | null
  /** Entries resolved from spec.itemRefs, in order (interlude only). */
  pinnedEntries?: EntryOut[]
}

export class Game {
  private container: HTMLElement
  private hostApi: HostApi
  private opts: GameOptions

  private root!: HTMLDivElement
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private promptWordEl!: HTMLDivElement
  private pipsEl!: HTMLDivElement
  private comboEl!: HTMLDivElement
  private cardEl: HTMLDivElement | null = null

  private sfx = new Sfx()
  private raf = 0
  private lastTs = 0
  private disposed = false
  private dpr = 1
  private width = 0
  private height = 0

  // Run state
  private started = false
  private roundIndex = 0
  private roundsTotal = 1
  private combo = 0
  private bestCombo = 0
  private caught = 0
  private facedRounds = 0
  private intensity = 0.15

  // Current round
  private tiles: Tile[] = []
  private activeRound: PreparedRound | null = null
  private roundResolved = false
  private spawnedTargetAt = 0

  // standalone sampling buffer
  private sampleBuffer: EntryOut[] = []

  constructor(container: HTMLElement, hostApi: HostApi, opts: GameOptions = {}) {
    this.container = container
    this.hostApi = hostApi
    this.opts = opts

    const cfg = safeStackConfig(hostApi)
    this.sfx.enabled = true

    if (opts.session) {
      this.roundsTotal = opts.session.rounds
      this.intensity = opts.session.initialIntensity
    } else {
      this.roundsTotal = Infinity // standalone: endless escalating run
    }

    this.buildDom()
    this.resize()
    window.addEventListener("resize", this.onResize)

    if (opts.session) {
      // Interlude: no menu — start straight into the first round.
      this.started = true
      this.sfx.unlock()
      void this.beginNextRound(cfg.languages)
      this.loop(performance.now())
    } else {
      this.showStartCard()
    }
  }

  // ---------------------------------------------------------------- DOM setup

  private buildDom() {
    const root = document.createElement("div")
    root.className = "wf-root"

    const canvas = document.createElement("canvas")
    canvas.className = "wf-canvas"
    root.appendChild(canvas)

    const prompt = document.createElement("div")
    prompt.className = "wf-prompt"
    const label = document.createElement("div")
    label.className = "wf-prompt-label"
    label.textContent = "catch the meaning"
    const word = document.createElement("div")
    word.className = "wf-prompt-word"
    prompt.appendChild(label)
    prompt.appendChild(word)
    root.appendChild(prompt)

    const pips = document.createElement("div")
    pips.className = "wf-pips"
    root.appendChild(pips)

    const combo = document.createElement("div")
    combo.className = "wf-combo"
    root.appendChild(combo)

    const sound = document.createElement("button")
    sound.className = "wf-sound"
    sound.type = "button"
    sound.setAttribute("aria-label", "toggle sound")
    sound.textContent = "\u{1F50A}"
    sound.addEventListener("click", (e) => {
      e.stopPropagation()
      this.sfx.enabled = !this.sfx.enabled
      sound.textContent = this.sfx.enabled ? "\u{1F50A}" : "\u{1F507}"
      if (this.sfx.enabled) this.sfx.unlock()
    })
    root.appendChild(sound)

    canvas.addEventListener("pointerdown", this.onPointerDown)

    this.container.appendChild(root)
    this.root = root
    this.canvas = canvas
    this.ctx = canvas.getContext("2d")!
    this.promptWordEl = word
    this.pipsEl = pips
    this.comboEl = combo
    this.renderPips()
  }

  private renderPips() {
    if (!Number.isFinite(this.roundsTotal)) {
      this.pipsEl.style.display = "none"
      return
    }
    this.pipsEl.innerHTML = ""
    for (let i = 0; i < this.roundsTotal; i++) {
      const pip = document.createElement("div")
      pip.className = "wf-pip" + (i < this.roundIndex ? " is-done" : "")
      this.pipsEl.appendChild(pip)
    }
  }

  private renderCombo() {
    if (this.combo >= 2) {
      this.comboEl.classList.add("is-live")
      this.comboEl.textContent = `${this.combo}×`
    } else {
      this.comboEl.classList.remove("is-live")
    }
  }

  // ---------------------------------------------------------------- sizing

  private onResize = () => this.resize()

  private resize() {
    const rect = this.container.getBoundingClientRect()
    this.width = rect.width || this.container.clientWidth || 360
    this.height = rect.height || this.container.clientHeight || 640
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.floor(this.width * this.dpr)
    this.canvas.height = Math.floor(this.height * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  // ------------------------------------------------------------- content

  private async nextEntry(cfg: { languages: string[] }): Promise<PreparedRound | null> {
    const spec = this.opts.spec ?? null
    const specTarget = spec?.targetLang
    const specNative = spec?.nativeLang

    // Interlude: walk the pinned spec entries in order.
    if (this.opts.session && this.opts.pinnedEntries?.length) {
      const entry = this.opts.pinnedEntries[this.roundIndex % this.opts.pinnedEntries.length]
      const content = resolveRound(entry, cfg, specTarget, specNative)
      if (!content) return null
      const pool = await this.getDistractorPool(6)
      return {
        content,
        distractors: buildDistractors(pool, content, content.targetLang, 3),
      }
    }

    // Standalone: sample fresh entries from the host.
    const entry = await this.takeSampled()
    if (!entry) return null
    const content = resolveRound(entry, cfg, specTarget, specNative)
    if (!content) {
      // Skip entries with no usable target translation; try once more.
      const retry = await this.takeSampled()
      if (!retry) return null
      const c2 = resolveRound(retry, cfg, specTarget, specNative)
      if (!c2) return null
      const pool2 = await this.getDistractorPool(6)
      return { content: c2, distractors: buildDistractors(pool2, c2, c2.targetLang, 3) }
    }
    const pool = await this.getDistractorPool(6)
    return {
      content,
      distractors: buildDistractors(pool, content, content.targetLang, 3),
    }
  }

  private async takeSampled(): Promise<EntryOut | null> {
    if (this.sampleBuffer.length === 0) {
      const entries = (await this.hostApi.getRandomEntries?.(8)) ?? []
      this.sampleBuffer = entries.filter((e) => e && e.translations.length)
    }
    return this.sampleBuffer.shift() ?? null
  }

  private async getDistractorPool(count: number): Promise<EntryOut[]> {
    try {
      return (await this.hostApi.getRandomEntries?.(count)) ?? []
    } catch {
      return []
    }
  }

  // ------------------------------------------------------------- round flow

  private async beginNextRound(languages: string[]) {
    if (this.disposed) return
    const round = await this.nextEntry({ languages })
    if (this.disposed) return
    if (!round) {
      // Nothing playable — end gracefully.
      this.endRun()
      return
    }
    this.activeRound = round
    this.roundResolved = false
    this.promptWordEl.textContent = round.content.promptText
    this.spawnTiles(round)
  }

  private spawnTiles(round: PreparedRound) {
    this.tiles = []
    this.ctx.font = tileFont()
    const labels: Array<{ text: string; isTarget: boolean }> = [
      { text: round.content.targetText, isTarget: true },
      ...round.distractors.map((d) => ({ text: d, isTarget: false })),
    ]
    shuffle(labels)

    // Fall speed escalates with round progress + configured intensity.
    const ramp = Number.isFinite(this.roundsTotal)
      ? this.roundIndex / Math.max(1, this.roundsTotal)
      : Math.min(1, this.roundIndex / 12)
    const baseSpeed = 70 + this.intensity * 120 + ramp * 130 // px/sec
    const floorY = this.height - FLOOR_MARGIN

    // Stagger tiles across columns + a small vertical spread so several are in
    // the air at once (the catch-vs-avoid tension) but all reach the floor
    // within the ~4–7s round budget.
    const cols = Math.max(2, Math.min(labels.length, 3))
    labels.forEach((lab, i) => {
      this.ctx.font = tileFont()
      const w = Math.min(
        this.width - 28,
        Math.max(96, this.ctx.measureText(lab.text).width + 40)
      )
      const col = i % cols
      const laneW = this.width / cols
      const x = laneW * col + laneW / 2
      const jitter = (Math.random() - 0.5) * (laneW - w) * 0.5
      const startY = PROMPT_SAFE_TOP - TILE_H - i * (TILE_H + 46) - Math.random() * 40
      this.tiles.push({
        text: lab.text,
        isTarget: lab.isTarget,
        x: clamp(x + jitter, w / 2 + 8, this.width - w / 2 - 8),
        y: startY,
        w,
        h: TILE_H,
        vy: baseSpeed * (0.9 + Math.random() * 0.25),
        wobble: Math.random() * Math.PI * 2,
        state: "falling",
        anim: 0,
      })
      if (lab.isTarget) this.spawnedTargetAt = performance.now()
    })
    void floorY
  }

  // ------------------------------------------------------------- input

  private onPointerDown = (ev: PointerEvent) => {
    if (!this.started || this.roundResolved) {
      this.sfx.unlock()
      return
    }
    this.sfx.unlock()
    const rect = this.canvas.getBoundingClientRect()
    const px = ev.clientX - rect.left
    const py = ev.clientY - rect.top
    // Hit-test topmost tile (later tiles drawn on top → iterate reversed).
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const t = this.tiles[i]
      if (t.state !== "falling") continue
      if (
        px >= t.x - t.w / 2 &&
        px <= t.x + t.w / 2 &&
        py >= t.y &&
        py <= t.y + t.h
      ) {
        this.hitTile(t)
        return
      }
    }
  }

  private hitTile(t: Tile) {
    if (this.roundResolved || !this.activeRound) return
    const latency = performance.now() - this.spawnedTargetAt
    if (t.isTarget) {
      t.state = "caught"
      this.combo += 1
      this.caught += 1
      this.bestCombo = Math.max(this.bestCombo, this.combo)
      this.sfx.catchGood(this.combo)
      // Speak the caught target (honors host TTS + this pack's sound toggle).
      if (this.sfx.enabled) {
        try {
          this.hostApi.speak(
            this.activeRound.content.targetLang,
            this.activeRound.content.targetText
          )
        } catch {
          /* speak is best-effort */
        }
      }
      this.resolveRound("caught", latency)
    } else {
      t.state = "shattered"
      this.combo = 0
      this.sfx.miss()
      this.resolveRound("wrong", latency)
    }
    this.renderCombo()
  }

  /** The correct tile hit the floor untouched. */
  private onTargetFloored() {
    if (this.roundResolved) return
    this.combo = 0
    this.sfx.miss()
    this.renderCombo()
    this.resolveRound("missed", performance.now() - this.spawnedTargetAt)
  }

  private resolveRound(outcome: CatchOutcome, latency: number) {
    if (this.roundResolved) return
    this.roundResolved = true
    this.facedRounds += 1
    const entryId = this.activeRound?.content.entryId ?? -1
    this.opts.session?.noteResolved(entryId, outcome, latency, this.combo)

    const cfg = safeStackConfig(this.hostApi)
    // Brief SAVOR beat, then advance (or end the run).
    const delay = REDUCED_MOTION ? 120 : 380
    window.setTimeout(() => {
      if (this.disposed) return
      this.roundIndex += 1
      this.renderPips()
      if (this.roundIndex >= this.roundsTotal) {
        this.endRun()
      } else {
        void this.beginNextRound(cfg.languages)
      }
    }, delay)
  }

  // ------------------------------------------------------------- run end

  private endRun() {
    if (this.opts.session) {
      // Interlude: report terminal result ONCE, then ask the host to exit.
      this.sfx.finish()
      this.opts.session.finish()
      window.dispatchEvent(new CustomEvent("corpan:exit"))
      return
    }
    // Standalone: show a "play again" card (endless).
    this.sfx.finish()
    this.showDoneCard()
  }

  // ------------------------------------------------------------- render loop

  private loop = (ts: number) => {
    if (this.disposed) return
    const dt = Math.min(0.05, (ts - (this.lastTs || ts)) / 1000)
    this.lastTs = ts
    if (this.started) this.step(dt)
    this.draw()
    this.raf = requestAnimationFrame(this.loop)
  }

  private step(dt: number) {
    if (this.roundResolved) {
      // Freeze the board briefly while resolving; still animate resolve fx.
      for (const t of this.tiles) {
        if (t.state !== "falling") t.anim = Math.min(1, t.anim + dt * 3)
      }
      return
    }
    const floorY = this.height - FLOOR_MARGIN
    for (const t of this.tiles) {
      if (t.state !== "falling") {
        t.anim = Math.min(1, t.anim + dt * 3)
        continue
      }
      t.y += t.vy * dt
      t.wobble += dt * 2
      if (t.y + t.h >= floorY) {
        if (t.isTarget) {
          this.onTargetFloored()
          return
        }
        // A distractor safely reaching the floor is the correct "let it fall".
        t.state = "falling"
        t.y = floorY - t.h
        t.vy = 0
      }
    }
  }

  private draw() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)

    // floor line
    const floorY = this.height - FLOOR_MARGIN
    ctx.strokeStyle = "rgba(124,92,255,0.25)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, floorY)
    ctx.lineTo(this.width, floorY)
    ctx.stroke()

    ctx.font = tileFont()
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    for (const t of this.tiles) {
      const cx = t.x
      const cy = t.y + t.h / 2
      let alpha = 1
      let scale = 1
      let fill = "#181234"
      let stroke = "rgba(124,92,255,0.5)"
      if (t.state === "caught") {
        scale = 1 + t.anim * 0.12
        alpha = 1 - t.anim * 0.85
        fill = "#123a2c"
        stroke = "#37d29b"
      } else if (t.state === "shattered") {
        scale = 1 - t.anim * 0.2
        alpha = 1 - t.anim
        fill = "#3a1220"
        stroke = "#ff5d7a"
      }
      const wob = t.state === "falling" && !REDUCED_MOTION ? Math.sin(t.wobble) * 2 : 0
      ctx.save()
      ctx.globalAlpha = Math.max(0, alpha)
      ctx.translate(cx + wob, cy)
      ctx.scale(scale, scale)
      const w = t.w
      const h = t.h
      roundRect(ctx, -w / 2, -h / 2, w, h, 8)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = stroke
      ctx.stroke()
      ctx.fillStyle = "#eef0ff"
      ctx.fillText(t.text, 0, 1)
      ctx.restore()
    }
  }

  // ------------------------------------------------------------- cards (standalone)

  private showStartCard() {
    const card = document.createElement("div")
    card.className = "wf-card"
    const title = document.createElement("div")
    title.className = "wf-card-title"
    title.textContent = "Wordfall"
    const sub = document.createElement("div")
    sub.className = "wf-card-sub"
    sub.textContent = "Tap the falling word that matches the meaning up top. Let the rest fall."
    const btn = document.createElement("button")
    btn.className = "wf-btn"
    btn.textContent = "Play"
    btn.addEventListener("click", () => {
      this.dismissCard()
      this.sfx.unlock()
      this.roundIndex = 0
      this.combo = 0
      this.caught = 0
      this.facedRounds = 0
      this.started = true
      this.renderPips()
      void this.beginNextRound(safeStackConfig(this.hostApi).languages)
      if (!this.raf) this.loop(performance.now())
    })
    card.appendChild(title)
    card.appendChild(sub)
    card.appendChild(btn)
    this.root.appendChild(card)
    this.cardEl = card
    // Keep the render loop alive under the card so it draws behind it.
    if (!this.raf) this.loop(performance.now())
  }

  private showDoneCard() {
    this.started = false
    const card = document.createElement("div")
    card.className = "wf-card"
    const title = document.createElement("div")
    title.className = "wf-card-title"
    title.textContent = this.bestCombo >= 5 ? "On fire" : "Nice run"
    const stat = document.createElement("div")
    stat.className = "wf-stat"
    stat.textContent = `${this.caught} caught · best combo ${this.bestCombo}×`
    const btn = document.createElement("button")
    btn.className = "wf-btn"
    btn.textContent = "Play again"
    btn.addEventListener("click", () => {
      this.dismissCard()
      this.roundIndex = 0
      this.combo = 0
      this.caught = 0
      this.facedRounds = 0
      this.bestCombo = 0
      this.started = true
      this.renderPips()
      this.renderCombo()
      void this.beginNextRound(safeStackConfig(this.hostApi).languages)
    })
    card.appendChild(title)
    card.appendChild(stat)
    card.appendChild(btn)
    this.root.appendChild(card)
    this.cardEl = card
  }

  private dismissCard() {
    if (this.cardEl) {
      this.cardEl.remove()
      this.cardEl = null
    }
  }

  // ------------------------------------------------------------- lifecycle

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.raf = 0
    window.removeEventListener("resize", this.onResize)
    try {
      this.hostApi.stopSpeech?.()
    } catch {
      /* best effort */
    }
    this.root.remove()
  }
}

// ------------------------------------------------------------- helpers

function safeStackConfig(hostApi: HostApi): { languages: string[] } {
  try {
    const cfg = hostApi.getStackConfig()
    return { languages: (cfg.languages || []).filter(Boolean) }
  } catch {
    return { languages: [] }
  }
}

function tileFont(): string {
  return "700 20px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
