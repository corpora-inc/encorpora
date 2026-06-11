/**
 * beatlounge — the ribbon performance controller (IMMERSIVE).
 *
 * A wide ribbon: the HORIZONTAL axis is pitch across a configurable window
 * (default ~8 octaves, octave-shiftable); the VERTICAL axis is expression
 * (brightness + level). Drag your finger to PLAY:
 *   • Fretless — continuous glide (portamento), theremin/siren scoops.
 *   • Fretted  — snaps to the nearest in-scale note as you cross it, locked to a
 *     key + mode so every note is right; frets shimmer on scale degrees.
 *
 * The widget owns its OWN Tone voice (ribbonVoice) on the shared AudioContext —
 * independent of the track's instrument. When RECORD is armed, live play is
 * captured into the bound melodic track as NoteEvents (snapped to the nearest
 * semitone + quantized to the track grid at the live playhead).
 *
 * 60fps: only transform/opacity animate; the comet trail + active glow are
 * positioned via CSS custom properties written in the pointer handler.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { gridTicks, stepForTick, tickForStep } from "../../model/timing"
import {
  KEY_NAMES,
  midiToX,
  noteLabel,
  pitchClass,
  xToMidi,
  type Fret,
  type RibbonWindow,
} from "../../music/ribbonScales"
import { docHarmony } from "../../model/document"
import { activeMidiInRange, quantizeToHarmony } from "../../music/resolver"
import { createRibbonVoice, type RibbonVoice, type RibbonWave } from "./ribbonVoice"
import { clearAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  /** The melodic track the ribbon records into. */
  trackId: Id
}

const WAVES: RibbonWave[] = ["sine", "sawtooth", "triangle", "square"]
const WAVE_LABEL: Record<RibbonWave, string> = {
  sine: "Sine",
  sawtooth: "Saw",
  triangle: "Tri",
  square: "Sqr",
}

/** Octave-window presets: how many octaves the ribbon spans. */
const SPAN_OCTAVES = [3, 5, 8] as const
const GLIDE_FRETLESS = 0.085 // seconds of portamento for the glide
const GLIDE_FRETTED = 0.0 // instant — snapped notes don't slur

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const RibbonImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)

  const [wave, setWave] = useState<RibbonWave>("sawtooth")
  // "fretted" now means "follow the song's harmony" — the ribbon snaps/frets to
  // the GLOBAL active pitch set (doc.harmony via the resolver). Fretless = a free
  // chromatic glide (opt-out). Either way the player can't stray out of the song.
  const [fretted, setFretted] = useState(true)
  const [spanOct, setSpanOct] = useState<number>(5)
  const [lowMidi, setLowMidi] = useState(36) // C2 — a comfy default left edge
  const [record, setRecord] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [liveLabel, setLiveLabel] = useState<string>("")
  const [playStep, setPlayStep] = useState(-1)

  const harmony = docHarmony(doc)
  const tonicPc = ((harmony.tonic % 12) + 12) % 12
  // A short label of what the ribbon is following (the mode name, or "chords").
  const harmonyLabel =
    harmony.mode === "chordal"
      ? `${harmony.progression.length} chords`
      : harmony.scale.id.split(".").pop()?.replace(/([a-z])([A-Z])/g, "$1 $2") ?? "scale"

  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const voiceRef = useRef<RibbonVoice | null>(null)
  // Latest values for the pointer closures (avoid stale captures at 60fps).
  const live = useRef({ fretted, lowMidi, spanOct, record })
  const lastRecordedStep = useRef<number>(-1)
  const lastMidi = useRef<number>(-1)
  // Live playhead step, mirrored for the (closure-bound) record path.
  const playStepRef = useRef(playStep)

  const win: RibbonWindow = useMemo(
    () => ({ lowMidi, spanSemis: spanOct * 12 }),
    [lowMidi, spanOct]
  )
  // Frets = the global harmony's active pitches across the window. Change the
  // song's mode/chords and the frets re-lay-out instantly (the founder's
  // "change the chords, the player follows").
  const frets: Fret[] = useMemo(() => {
    const notes = activeMidiInRange(doc, 0, win.lowMidi, win.lowMidi + win.spanSemis)
    return notes.map((midi) => ({
      midi,
      x: midiToX(midi, win),
      tonic: pitchClass(midi) === tonicPc,
      label: noteLabel(midi),
    }))
  }, [doc, win, tonicPc])

  // Build the voice once (per AudioContext) and dispose on unmount.
  useEffect(() => {
    const voice = createRibbonVoice(audio.context(), wave, GLIDE_FRETLESS)
    voiceRef.current = voice
    return () => {
      voice.noteOff()
      voice.dispose()
      voiceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio])

  // Keep the voice's waveform + glide in sync with the controls.
  useEffect(() => {
    voiceRef.current?.setWave(wave)
  }, [wave])
  useEffect(() => {
    voiceRef.current?.setGlide(fretted ? GLIDE_FRETTED : GLIDE_FRETLESS)
  }, [fretted])

  // Mirror the latest control values for the pointer handlers.
  useEffect(() => {
    live.current = { fretted, lowMidi, spanOct, record }
  }, [fretted, lowMidi, spanOct, record])

  // Live playhead → current step on this track's grid (for record placement).
  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  // ---- pointer → pitch -----------------------------------------------------
  const xFromEvent = (clientX: number): number => {
    const el = surfaceRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return clamp01((clientX - r.left) / Math.max(1, r.width))
  }
  const exprFromEvent = (clientY: number): number => {
    const el = surfaceRef.current
    if (!el) return 0.6
    const r = el.getBoundingClientRect()
    // Up = brighter: invert so the top of the ribbon is the bright end.
    return clamp01(1 - (clientY - r.top) / Math.max(1, r.height))
  }

  /** Paint the comet + active glow via CSS vars (no React re-render per frame). */
  const paint = (x: number, expr: number) => {
    const el = surfaceRef.current
    if (!el) return
    el.style.setProperty("--bl-ribbon-x", `${x * 100}%`)
    el.style.setProperty("--bl-ribbon-y", `${(1 - expr) * 100}%`)
    el.style.setProperty("--bl-ribbon-on", "1")
  }

  const recordIntoTrack = (midi: number) => {
    const st = live.current
    if (!st.record) return
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur)) return
    // Place at the live playhead step; if stopped, lay it at step 0.
    const ph = playStepRef.current
    const step = ph >= 0 ? ph : 0
    // One note per (step) crossing — don't spam the same step while gliding.
    if (step === lastRecordedStep.current) return
    lastRecordedStep.current = step
    const tick = tickForStep(step, cur.grid)
    // Avoid duplicate identical notes on the same cell.
    const exists = cur.notes.some((n) => n.tick === tick && n.pitch === midi)
    if (exists) return
    store.dispatch({
      t: "addNote",
      trackId,
      note: {
        tick,
        duration: gridTicks(cur.grid),
        pitch: Math.max(0, Math.min(127, Math.round(midi))),
        velocity: 0.8,
      },
    })
  }

  // Keep the playhead ref current for the record path.
  useEffect(() => {
    playStepRef.current = playStep
  }, [playStep])

  const resolveMidi = (x: number): number => {
    const st = live.current
    const w: RibbonWindow = { lowMidi: st.lowMidi, spanSemis: st.spanOct * 12 }
    const raw = xToMidi(x, w)
    // Fretted = snap to the nearest pitch of the SONG's active harmony (resolver,
    // read live so chord/mode changes apply immediately). Fretless = free glide.
    return st.fretted
      ? quantizeToHarmony(raw, store.vanilla.getState().doc, 0)
      : raw
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button > 0) return
    const el = surfaceRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* capture may fail in tests */
    }
    const x = xFromEvent(e.clientX)
    const expr = exprFromEvent(e.clientY)
    const midi = resolveMidi(x)
    lastMidi.current = Math.round(midi)
    lastRecordedStep.current = -1
    voiceRef.current?.noteOn(midi, expr)
    paint(x, expr)
    setPlaying(true)
    setLiveLabel(noteLabel(midi))
    recordIntoTrack(midi)
    e.preventDefault()
  }

  const onMove = (e: React.PointerEvent) => {
    if (!playing && !(e.buttons & 1)) return
    if (voiceRef.current == null) return
    const x = xFromEvent(e.clientX)
    const expr = exprFromEvent(e.clientY)
    const midi = resolveMidi(x)
    const st = live.current
    voiceRef.current.setExpression(expr)
    if (st.fretted) {
      const r = Math.round(midi)
      if (r !== lastMidi.current) {
        lastMidi.current = r
        voiceRef.current.setPitch(midi)
        setLiveLabel(noteLabel(midi))
        recordIntoTrack(midi)
      }
    } else {
      voiceRef.current.glide(midi)
      const r = Math.round(midi)
      if (r !== lastMidi.current) {
        lastMidi.current = r
        setLiveLabel(noteLabel(midi))
      }
    }
    paint(x, expr)
  }

  const onUp = (e: React.PointerEvent) => {
    voiceRef.current?.noteOff()
    setPlaying(false)
    lastRecordedStep.current = -1
    const el = surfaceRef.current
    if (el) el.style.setProperty("--bl-ribbon-on", "0")
    try {
      el?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const shiftOctave = (delta: number) => {
    setLowMidi((p) => {
      const span = spanOct * 12
      return Math.max(0, Math.min(127 - span, p + delta * 12))
    })
  }

  const anySolo = doc.tracks.some((t) => t.solo)
  const silent = !!track && (track.mute || (anySolo && !track.solo))

  return (
    <div className="bl-ribbon">
      <div className="bl-grid-toolbar" data-bl-nocapture>
        <div className="bl-grid-title">
          {/* Title + transport live once, globally, in the immersive header. */}
          <span className="bl-dot" style={{ background: track?.color }} />
        </div>
        <div className="bl-grid-actions">
          <button
            type="button"
            className={`bl-chip${record ? " is-armed" : ""}`}
            aria-pressed={record}
            onClick={() => setRecord((r) => !r)}
          >
            {record ? "Recording" : "Record"}
          </button>
          <button
            type="button"
            className="bl-chip is-danger"
            onClick={() => {
              const before = store.vanilla.getState().doc
              const r = runAction(store, clearAction, { doc, targetTrackId: trackId })
              if (r.commands.length)
                host.toast(r.summary, {
                  undo: () => store.vanilla.getState().doc !== before && store.undo(),
                })
              else host.toast(r.summary)
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ---- control strip ---- */}
      <div className="bl-ribbon-controls" data-bl-nocapture>
        {/* Harmony is the SONG's — set in the Harmony module; the ribbon follows. */}
        <span className="bl-ribbon-follow" aria-label={`Following ${KEY_NAMES[tonicPc]} ${harmonyLabel}`}>
          Following {KEY_NAMES[tonicPc]} {harmonyLabel}
        </span>

        <div className="bl-seg" role="group" aria-label="Fret mode">
          <button
            type="button"
            className={`bl-seg-btn${fretted ? " is-on" : ""}`}
            aria-pressed={fretted}
            onClick={() => setFretted(true)}
          >
            In key
          </button>
          <button
            type="button"
            className={`bl-seg-btn${!fretted ? " is-on" : ""}`}
            aria-pressed={!fretted}
            onClick={() => setFretted(false)}
          >
            Free glide
          </button>
        </div>

        <div className="bl-seg" role="group" aria-label="Voice">
          {WAVES.map((w) => (
            <button
              key={w}
              type="button"
              className={`bl-seg-btn${wave === w ? " is-on" : ""}`}
              aria-pressed={wave === w}
              onClick={() => setWave(w)}
            >
              {WAVE_LABEL[w]}
            </button>
          ))}
        </div>

        <div className="bl-seg" role="group" aria-label="Octave span">
          {SPAN_OCTAVES.map((o) => (
            <button
              key={o}
              type="button"
              className={`bl-seg-btn${spanOct === o ? " is-on" : ""}`}
              aria-pressed={spanOct === o}
              onClick={() => setSpanOct(o)}
            >
              {o} oct
            </button>
          ))}
        </div>

        <div className="bl-ribbon-octave">
          <button
            type="button"
            className="bl-icon-btn"
            aria-label="Shift window down an octave"
            onClick={() => shiftOctave(-1)}
          >
            ◀
          </button>
          <span className="bl-ribbon-range" aria-hidden="true">
            {noteLabel(lowMidi)}–{noteLabel(lowMidi + spanOct * 12)}
          </span>
          <button
            type="button"
            className="bl-icon-btn"
            aria-label="Shift window up an octave"
            onClick={() => shiftOctave(1)}
          >
            ▶
          </button>
        </div>
      </div>

      {/* ---- the ribbon surface ---- */}
      <div
        ref={surfaceRef}
        className={
          "bl-ribbon-surface" +
          (fretted ? " is-fretted" : " is-fretless") +
          (playing ? " is-playing" : "") +
          (silent ? " is-silent" : "")
        }
        role="slider"
        aria-label={`Ribbon · ${KEY_NAMES[tonicPc]} ${harmonyLabel} · ${fretted ? "in key" : "free glide"}`}
        aria-valuetext={liveLabel || `${KEY_NAMES[tonicPc]} ${harmonyLabel}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* fret lines on in-scale degrees */}
        <div className="bl-ribbon-frets" aria-hidden="true">
          {frets.map((f) => (
            <span
              key={f.midi}
              className={`bl-fret${f.tonic ? " is-tonic" : ""}`}
              style={{ left: `${f.x * 100}%` }}
            >
              {f.tonic && <span className="bl-fret-label">{f.label}</span>}
            </span>
          ))}
        </div>
        {/* finger comet + active column glow */}
        <span className="bl-ribbon-comet" aria-hidden="true" />
        <span className="bl-ribbon-beam" aria-hidden="true" />
        {liveLabel && playing && (
          <span className="bl-ribbon-readout" aria-hidden="true">
            {liveLabel}
          </span>
        )}
        {!playing && (
          <span className="bl-ribbon-hint" aria-hidden="true">
            Slide to play · {fretted ? "always in key" : "glide freely"}
          </span>
        )}
      </div>

      <div className="bl-ribbon-foot" data-bl-nocapture>
        <span className="bl-ribbon-status">
          {KEY_NAMES[tonicPc]} {harmonyLabel} · {WAVE_LABEL[wave]} ·{" "}
          {fretted ? "in key" : "free glide"}
          {record ? " · armed" : ""}
        </span>
      </div>
    </div>
  )
}
