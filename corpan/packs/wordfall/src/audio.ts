/**
 * audio.ts — tiny, warm SFX for Wordfall. A struck-felt palette, not an arcade.
 * WebAudio only (no assets); silence is the safe default. Every call is gated by
 * an `enabled` flag the game owns (sound-off is first-class). The spoken target
 * word is delegated to hostApi.speak() by the caller — this module is SFX only.
 */

export class Sfx {
  private ctx: AudioContext | null = null
  enabled = true
  private disposed = false
  /** Pending `setTimeout` handles (e.g. finish()'s second note) — cancelled on
   *  dispose() so a scheduled blip never fires after the game is torn down. */
  private pendingTimers = new Set<ReturnType<typeof setTimeout>>()

  private ac(): AudioContext | null {
    if (this.disposed) return null
    if (!this.enabled) return null
    if (typeof window === "undefined") return null
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    if (!this.ctx) this.ctx = new Ctor()
    if (this.ctx.state === "suspended") void this.ctx.resume()
    return this.ctx
  }

  /** Call on first user gesture so mobile unlocks the context. */
  unlock(): void {
    this.ac()
  }

  private blip(freq: number, durMs: number, gain: number, type: OscillatorType) {
    const ctx = this.ac()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    const now = ctx.currentTime
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(gain, now + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, now + durMs / 1000)
    osc.connect(g).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + durMs / 1000 + 0.02)
  }

  /** setTimeout that self-unregisters and is a no-op if dispose() already ran
   *  (or runs before it fires). */
  private schedule(fn: () => void, delayMs: number): void {
    const id = setTimeout(() => {
      this.pendingTimers.delete(id)
      if (this.disposed) return
      fn()
    }, delayMs)
    this.pendingTimers.add(id)
  }

  /** Clean catch — pitch rises a little with combo depth. */
  catchGood(comboDepth = 0): void {
    const base = 523 // C5
    const freq = base * Math.pow(2, Math.min(comboDepth, 8) / 12)
    this.blip(freq, 150, 0.14, "triangle")
  }

  /** Wrong tile caught, or correct tile missed — a soft low thud. */
  miss(): void {
    this.blip(150, 180, 0.12, "sine")
  }

  /** Run complete — a brief two-note resolve. */
  finish(): void {
    this.blip(659, 140, 0.12, "triangle")
    this.schedule(() => this.blip(880, 220, 0.12, "triangle"), 120)
  }

  /**
   * Tear down: cancel any pending scheduled note (finish()'s second blip is
   * the one that outlives a fast return-to-journey — Game.dispose() used to
   * never call this, so the note fired ~120ms later into a torn-down game, an
   * orphaned glitch on the next card) and close the AudioContext. Idempotent;
   * safe to call even if the context was never created.
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const id of this.pendingTimers) clearTimeout(id)
    this.pendingTimers.clear()
    const ctx = this.ctx
    this.ctx = null
    if (ctx && ctx.state !== "closed") {
      try {
        void ctx.close()
      } catch {
        /* already closing/closed, or unsupported — ignore */
      }
    }
  }
}
