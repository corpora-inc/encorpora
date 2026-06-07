/**
 * sfx.ts — tiny, fully-synthesized one-shot sound effects. NO assets: every
 * sound is a few oscillators + an envelope rendered live through WebAudio. They
 * are deliberately SOFT and short; they coordinate conceptually with the visual
 * juice (`src/juice/juice.ts`): `pop` (NPC greet) pairs with `tap`/`engage`,
 * `ring` (confirm/win) pairs with `correct`, the reward smorgasbord pairs with
 * `reward`.
 *
 * Each builder takes the live `AudioContext` + a destination `GainNode` (the
 * master bus, already volume/mute-scaled) and schedules itself relative to
 * `ctx.currentTime`. Pure scheduling — no global state — so the soundscape can
 * call them freely.
 */

export type SfxName = "tap" | "engage" | "correct" | "reward" | "error"

/** A short pure tone with an exponential pluck envelope. */
function tone(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    freq: number
    type?: OscillatorType
    start?: number // seconds from now
    dur?: number
    gain?: number
    glideTo?: number // optional pitch glide target
  },
): void {
  const t0 = ctx.currentTime + (opts.start ?? 0)
  const dur = opts.dur ?? 0.18
  const peak = opts.gain ?? 0.2
  const osc = ctx.createOscillator()
  osc.type = opts.type ?? "sine"
  osc.frequency.setValueAtTime(opts.freq, t0)
  if (opts.glideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.glideTo), t0 + dur)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(dest)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** A soft filtered-noise transient — used for the tap and the footstep. */
export function noiseTap(
  ctx: AudioContext,
  dest: AudioNode,
  opts: { dur?: number; gain?: number; cutoff?: number; start?: number; q?: number } = {},
): void {
  const t0 = ctx.currentTime + (opts.start ?? 0)
  const dur = opts.dur ?? 0.07
  const frames = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // White noise with a quick built-in decay so the source is self-tapering.
    const decay = 1 - i / frames
    data[i] = (Math.random() * 2 - 1) * decay * decay
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const lp = ctx.createBiquadFilter()
  lp.type = "lowpass"
  lp.frequency.value = opts.cutoff ?? 1100
  lp.Q.value = opts.q ?? 0.7
  const g = ctx.createGain()
  const peak = opts.gain ?? 0.18
  g.gain.setValueAtTime(peak, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(lp).connect(g).connect(dest)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

/**
 * Play a named SFX into `dest`. All sounds are intentionally quiet relative to
 * the master bus and short (< 0.6s) so nothing steps on speech or the ambient
 * bed.
 */
export function playSfxInto(ctx: AudioContext, dest: AudioNode, name: SfxName): void {
  switch (name) {
    case "tap":
      // A soft, warm tap — confirms a touch without a click-y "UI beep".
      noiseTap(ctx, dest, { cutoff: 900, gain: 0.12, dur: 0.06 })
      break
    case "engage":
      // Greeting an NPC: a gentle two-note rise — friendly, not a fanfare.
      tone(ctx, dest, { freq: 523.25, type: "sine", gain: 0.13, dur: 0.16 }) // C5
      tone(ctx, dest, { freq: 659.25, type: "sine", gain: 0.12, dur: 0.2, start: 0.09 }) // E5
      break
    case "correct": {
      // A small bright sparkle (a quick ascending triad) — pairs with juice.ring.
      const notes = [659.25, 783.99, 987.77] // E5 G5 B5
      notes.forEach((f, i) =>
        tone(ctx, dest, { freq: f, type: "triangle", gain: 0.12, dur: 0.22, start: i * 0.07 }),
      )
      break
    }
    case "reward": {
      // A warmer, fuller flourish for a quest/challenge win — a rising major
      // arpeggio with a soft shimmer tail. Still restrained.
      const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
      notes.forEach((f, i) =>
        tone(ctx, dest, { freq: f, type: "triangle", gain: 0.14, dur: 0.3, start: i * 0.085 }),
      )
      // a soft low body underneath, so it lands rather than tinkles
      tone(ctx, dest, { freq: 261.63, type: "sine", gain: 0.1, dur: 0.5 }) // C4
      break
    }
    case "error":
      // A gentle, non-punishing low double-blip (NOT a buzzer — no dark patterns).
      tone(ctx, dest, { freq: 220, type: "sine", gain: 0.12, dur: 0.14 })
      tone(ctx, dest, { freq: 196, type: "sine", gain: 0.11, dur: 0.18, start: 0.12 })
      break
  }
}
