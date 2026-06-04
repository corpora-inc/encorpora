import type { GroundedCutout } from "../render/cutout"
import type { CharacterSpec, Expression } from "./characterSpec"
import { characterDraw, moodToEmotion, type Pose } from "./characterArt"

/**
 * animator — cheap, state-driven cutout animation channels.
 *
 * Two kinds of motion, kept strictly separate so grounding never breaks:
 *   • GEOMETRY (3D, every frame, free): idle breathe, walk bob, turn squash,
 *     emote hop — driven on the GroundedCutout's `hop`/`squash`/`setScale`. The
 *     contact point (feet) never moves; only the body node bobs. The owned
 *     shadow reacts to hop height inside the primitive.
 *   • TEXTURE (2D, repaint only on change): mouth (talk), arm raise (wave),
 *     blink, head tilt — repainted via `cutout.redraw(characterDraw(spec,pose))`.
 *     Repaints are THROTTLED + dirty-checked so a still NPC costs zero canvas
 *     work and the whole crowd never repaints on the same frame.
 *
 * State machine: idle | walk | talk | wave | turn. `setState` + `setSpeed`
 * drive it; `update(dt)` advances. One animator per character.
 */

export type AnimState = "idle" | "walk" | "talk" | "wave"

export interface Animator {
  setState: (s: AnimState) => void
  /** 0..1 locomotion speed (drives walk bob amplitude/cadence). */
  setSpeed: (v: number) => void
  /** trigger a one-shot wave emote (returns to prior state after). */
  wave: () => void
  /**
   * Turn the talking mouth on/off. Sugar over `setState("talk"|"idle")` that
   * also resets the procedural cadence so a fresh utterance starts cleanly.
   * While active and NO real amplitude is being fed, the mouth runs a believable
   * procedural speech cadence (see below).
   */
  talk: (active: boolean) => void
  /**
   * REAL-AUDIO SEAM. Feed an instantaneous mouth-open level 0..1 (e.g. RMS of an
   * AnalyserNode) to drive the mouth from actual speech. Each call refreshes a
   * short freshness window; while amplitude is fresh, the mouth follows it and
   * the procedural cadence is suppressed. When the stream stops calling this, the
   * animator falls back to the procedural cadence after the window lapses.
   *
   * ── How game.ts / npcRuntime later feeds REAL amplitude ──
   * Native TTS (the default NPC voice path) plays OUTSIDE WebAudio, so there is
   * no AnalyserNode to tap → default = procedural cadence here (optionally make
   * it tighter by calling `talk(true/false)` on TTS start/end, or pulsing
   * `setMouthAmplitude` from token-stream timing for a "speaking rhythm" hint).
   * When a real signal IS available — the player's MIC during a speaking
   * challenge (getUserMedia → AnalyserNode → getByteTimeDomainData → RMS), or a
   * future WebAudio-based TTS — wire it like:
   *
   *     const analyser = audioCtx.createAnalyser(); micSource.connect(analyser)
   *     const buf = new Uint8Array(analyser.fftSize)
   *     function frame() {
   *       analyser.getByteTimeDomainData(buf)
   *       let sum = 0
   *       for (const v of buf) { const x = (v - 128) / 128; sum += x * x }
   *       const rms = Math.sqrt(sum / buf.length)        // 0..~0.5
   *       anim.setMouthAmplitude(Math.min(1, rms * 3.5)) // map to 0..1
   *       requestAnimationFrame(frame)
   *     }
   *
   * It is purely additive: callers that never touch it keep the procedural mouth.
   */
  setMouthAmplitude: (level: number) => void
  /**
   * TRANSIENT EMOTION CHANNEL — push a momentary face emotion tied to the NPC's
   * MOOD beat. Accepts either a raw `Expression` or a mood-beat STRING (the 8
   * `MOOD_BEATS` from npc/promptProgram.ts), mapped via `moodToEmotion`. The face
   * blends from its resting expression → the emotion and (when cleared) eases
   * back — identity is never changed, only momentarily coloured.
   *
   *   anim.setEmotion("delighted to see them — beaming") // a mood beat → grin
   *   anim.setEmotion("surprised")                       // a bare Expression
   *   anim.setEmotion(null)                              // ease back to resting
   *
   * `strength` (0..1, default 1) caps the blend. Reduced-motion-safe: when the
   * user prefers reduced motion the blend SNAPS (no ~400ms ease) but the face
   * still reads the emotion — accessibility never costs the warmth.
   */
  setEmotion: (moodOrExpr: Expression | string | null, strength?: number) => void
  update: (dt: number) => void
  state: () => AnimState
}

// Quantize the talk-mouth so we only repaint on a real visual change (≈5 steps).
const quant = (v: number, steps: number) => Math.round(v * steps) / steps

export function createAnimator(cutout: GroundedCutout, spec: CharacterSpec): Animator {
  let state: AnimState = "idle"
  let speed = 0
  let bobPhase = Math.random() * Math.PI * 2 // desync the crowd
  let breathePhase = Math.random() * Math.PI * 2
  let blinkTimer = 1 + Math.random() * 4
  let blinkT = 0 // >0 = mid-blink
  let waveT = 0 // >0 = mid-wave one-shot

  // --- talk-mouth channels ---
  // Procedural cadence: a couple of detuned oscillators + a slow "syllable gate"
  // so the mouth opens in believable speech beats (not a metronome) with brief
  // closes between words. Desynced per character so a chatty crowd never lip-syncs.
  let talkPhase = Math.random() * Math.PI * 2
  let sylPhase = Math.random() * Math.PI * 2
  let smoothMouth = 0 // low-passed open amount we actually paint
  // Real-audio seam: last fed amplitude + a freshness timer. While fresh, the
  // mouth follows real audio and the procedural cadence is suppressed.
  let realAmp = 0
  let realFresh = 0 // seconds remaining where realAmp is considered live

  // --- transient emotion channel (mood-linked) ---
  // `emotion` is the target face emotion; `emotionAmt` is the eased blend (0..1)
  // we actually paint; `emotionTarget` is where it's heading. Cleared → eases to 0.
  let emotion: Expression | null = null
  let emotionAmt = 0
  let emotionTarget = 0
  // Reduced-motion: snap the blend instead of easing (still reads the emotion).
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  /** Procedural mouth-open 0..1 at the current phase (speech-like envelope). */
  const proceduralMouth = (): number => {
    // base flap (fast) modulated by a slower syllable gate that dips to ~0 between
    // words → the mouth briefly closes, reading as articulation.
    const flap = 0.5 + 0.5 * Math.sin(talkPhase)
    const gate = Math.max(0, Math.sin(sylPhase)) ** 0.6 // 0 between syllables
    const jitter = 0.12 * Math.sin(talkPhase * 2.7 + 1.3)
    return Math.max(0, Math.min(1, (0.18 + flap * 0.7) * (0.35 + gate * 0.8) + jitter))
  }

  // Current painted pose — we only redraw when the quantized pose changes.
  const pose: Pose = {}
  let lastKey = ""
  let repaintAccum = 0

  const repaintIfDirty = () => {
    // Build a cheap key from the visible (quantized) channels.
    const key =
      `${quant(pose.mouth ?? 0, 4)}|${quant(pose.rightArm ?? 0, 6)}|` +
      `${pose.blink && pose.blink > 0.6 ? 1 : 0}|${quant(pose.headTilt ?? 0, 8)}|` +
      `${pose.emotion ?? ""}:${quant(pose.emotionAmt ?? 0, 5)}`
    if (key === lastKey) return
    lastKey = key
    cutout.redraw(characterDraw(spec, pose))
  }

  const setState: Animator["setState"] = (s) => {
    if (s === state) return
    state = s
    if (s !== "wave") waveT = 0
    if (s !== "talk") {
      // let the mouth ease shut in update(); just reset cadence phases
      talkPhase = Math.random() * Math.PI * 2
      sylPhase = Math.random() * Math.PI * 2
      realFresh = 0
    }
  }

  const wave: Animator["wave"] = () => {
    waveT = 1.1 // seconds of wave
  }

  const update: Animator["update"] = (dt) => {
    // ---- GEOMETRY channels (every frame, cheap, grounded) ----
    if (state === "walk" && speed > 0.02) {
      bobPhase += dt * (7 + speed * 4) * Math.max(speed, 0.4)
      const hop = Math.abs(Math.sin(bobPhase)) * 0.13 * Math.min(1, speed + 0.3)
      cutout.hop(hop)
      // gentle stride squash at footfalls
      const sq = 1 + Math.sin(bobPhase * 2) * 0.02 * speed
      cutout.squash(1 / Math.sqrt(sq), sq)
      pose.stride = Math.sin(bobPhase) * speed
    } else {
      // idle breathe — tiny vertical scale, no hop (feet planted)
      breathePhase += dt * 1.6
      const breathe = 1 + Math.sin(breathePhase) * 0.012
      cutout.hop(0)
      cutout.squash(1 / Math.sqrt(breathe), breathe)
      pose.stride = 0
    }

    // ---- TEXTURE channels (repaint only on change) ----
    // blink
    if (blinkT > 0) {
      blinkT -= dt
      pose.blink = blinkT > 0 ? 1 : 0
      if (blinkT <= 0) pose.blink = 0
    } else {
      blinkTimer -= dt
      if (blinkTimer <= 0) {
        blinkT = 0.12
        blinkTimer = 2.5 + Math.random() * 4
        pose.blink = 1
      }
    }

    // talk mouth — real audio if fresh, else a believable procedural cadence.
    if (realFresh > 0) realFresh -= dt
    if (state === "talk") {
      talkPhase += dt * 12 // fast flap (~2 Hz visible after the gate)
      sylPhase += dt * 5.5 // ~0.9 Hz syllable gate
      const target = realFresh > 0 ? realAmp : proceduralMouth()
      // low-pass so the mouth eases between frames (no flicker) and quantizes well
      smoothMouth += (target - smoothMouth) * Math.min(1, dt * 22)
      pose.mouth = smoothMouth
      pose.headTilt = Math.sin(talkPhase * 0.33) * 0.04
    } else {
      // ease the mouth shut when talk stops
      smoothMouth += (0 - smoothMouth) * Math.min(1, dt * 18)
      pose.mouth = smoothMouth < 0.02 ? 0 : smoothMouth
      pose.headTilt = 0
    }

    // transient emotion blend — ease toward the target over ~400ms (or snap when
    // reduced-motion). Writes the pose channels the face renderer reads.
    if (emotionAmt !== emotionTarget) {
      if (reducedMotion) emotionAmt = emotionTarget
      else emotionAmt += (emotionTarget - emotionAmt) * Math.min(1, dt * 6) // ~400ms ease
      if (Math.abs(emotionAmt - emotionTarget) < 0.01) emotionAmt = emotionTarget
    }
    if (emotion && emotionAmt > 0.001) {
      pose.emotion = emotion
      pose.emotionAmt = emotionAmt
    } else {
      pose.emotion = undefined
      pose.emotionAmt = 0
      if (emotionAmt <= 0.001) emotion = null // fully eased out → drop it
    }

    // wave one-shot (raise right arm in a sine)
    if (waveT > 0) {
      waveT -= dt
      const k = Math.sin((1.1 - waveT) * 9)
      pose.rightArm = 0.7 + k * 0.3
      if (waveT <= 0) pose.rightArm = 0
    } else if (state !== "talk") {
      pose.rightArm = 0
    }

    // Throttle canvas repaints to ~24fps max per character; dirty-checked so a
    // resting NPC never repaints. Crowd stays well within budget.
    repaintAccum += dt
    if (repaintAccum >= 0.04) {
      repaintAccum = 0
      repaintIfDirty()
    }
  }

  // initial paint
  cutout.redraw(characterDraw(spec, pose))

  return {
    setState,
    setSpeed: (v) => {
      speed = Math.max(0, Math.min(1, v))
    },
    wave,
    talk: (active) => setState(active ? "talk" : "idle"),
    setMouthAmplitude: (level) => {
      realAmp = Math.max(0, Math.min(1, level))
      realFresh = 0.18 // ~180ms freshness; lapses → procedural fallback
    },
    setEmotion: (moodOrExpr, strength = 1) => {
      if (moodOrExpr == null) {
        emotionTarget = 0 // ease back to the resting face (emotion drops at ~0)
        return
      }
      emotion = moodToEmotion(moodOrExpr)
      emotionTarget = Math.max(0, Math.min(1, strength))
      if (reducedMotion) emotionAmt = emotionTarget // snap on (accessibility)
    },
    update,
    state: () => state,
  }
}
