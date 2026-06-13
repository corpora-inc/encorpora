/**
 * beatlounge — the INSTRUMENT RIBBON: the reusable performance surface.
 *
 * A wide ribbon: the HORIZONTAL axis is pitch across a configurable window
 * (octave-shiftable); the VERTICAL axis is expression (brightness). Drag your
 * finger(s) to PLAY:
 *   • In key  — snaps to the nearest pitch of the SONG's active harmony as you
 *     cross it, locked to the key + mode/chords so every note is right; frets
 *     shimmer on the active degrees.
 *   • Free glide — continuous chromatic glide (portamento), theremin scoops.
 *
 * The surface plays the BOUND TRACK's REAL instrument: each finger opens a live
 * voice via `host.playLiveVoice` (POLYPHONIC, through the track's FX + mixer) so
 * the ribbon sounds exactly like the track. Vertical expression drives the
 * instrument's cutoff via `host.applyParam` (analog/synth only — wrapped so it's
 * a harmless no-op for sampler/soundfont voices). When the engine can't open a
 * live voice (no `.live` pool) we fall back to a stepped `host.previewTrack` per
 * note crossing — gated, never thrown.
 *
 * When RECORD is armed, live play is captured into the bound track as NoteEvents
 * (snapped to the nearest semitone, optionally quantized to the grid at the live
 * playhead). Arming Record never starts the transport.
 *
 * 60fps: only transform/opacity animate; the comet trail + active glow are
 * positioned via CSS custom properties written in the pointer handler.
 *
 * Shared by the standalone Ribbon module (quick-perform) and the Instruments
 * page (the playable headline). Props let the page LIFT the Record arm up.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { ct } from "../../i18n/strings"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade, LiveVoiceHandle } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
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
import { clearAction } from "../ribbon/actions"
import { runAction } from "../runAction"
import { placeRecordedNote } from "./recordPlacement"
import { useRtl } from "../_shared/useRtl"
import "./instrument-surface.css"
// The shared chrome (.bl-seg / .bl-icon-btn / .bl-select / .bl-ribbon-field) and
// the "Following" field still live in the ribbon module's stylesheet.
import "../ribbon/styles.css"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  /** The melodic track the ribbon plays + records into. */
  trackId: Id
  /** When supplied, the parent OWNS the Record arm (the page lifts it up). When
   *  undefined the surface owns its own internal Record toggle + chip. */
  record?: boolean
  /** Quantize recorded notes to the track grid (true, default) or place at the
   *  raw playhead tick (false). */
  quantizeRecord?: boolean
  /** Show the surface's own Record/Clear toolbar (default true). The page hides
   *  it and drives `record` from its own track-bar chip instead. */
  showRecord?: boolean
  /** Optional node placed on the control strip's first row, right of Lock/Free
   *  (the Instruments page slots its Record arm here so the chrome stays compact). */
  headerSlot?: React.ReactNode
}

/** Octave-window presets: how many octaves the ribbon spans. */
const SPAN_OCTAVES = [3, 5, 8] as const

/** Vertical expression → instrument cutoff (Hz). Darker low, brighter high. The
 *  same mapping the old self-contained voice used, now driven into the REAL
 *  instrument (no-op for engines without a cutoff param). */
const exprToCutoff = (expr: number): number => 420 + clamp01(expr) * 7200

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** One live finger on the ribbon. */
interface Touch {
  /** The bound track's live voice (undefined when the engine can't open one). */
  handle: LiveVoiceHandle | undefined
  /** The last RESOLVED (possibly snapped) pitch this finger sounded. */
  midi: number
  /** The last grid step this finger recorded into (per-pointer dedupe). */
  lastRecordedStep: number
  /** The finger's current x (0..1) — drives its own lit marker. */
  x: number
}

/** How many simultaneous lit markers the surface can show (one per finger). A
 *  fixed pool so we never allocate / re-render per frame; 10 covers every hand. */
const MARKER_POOL = 10

export const InstrumentRibbon = ({
  host,
  store,
  audio,
  trackId,
  record: recordProp,
  quantizeRecord = true,
  showRecord = true,
  headerSlot,
}: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  // RTL flips the ribbon so HIGH pitch reads on the LEFT, LOW on the right. The
  // pointer math mirrors (a touch's pitch is read from the start edge) and the
  // frets paint from the opposite side; the live comet/markers ride the finger
  // (rawX) so they need no mirroring.
  const rtl = useRtl()

  // "In key" snaps/frets to the GLOBAL active pitch set (doc.harmony via the
  // resolver). Free glide = a free chromatic glide (opt-out). Either way the
  // player can't stray out of the song.
  const [fretted, setFretted] = useState(true)
  const [spanOct, setSpanOct] = useState<number>(5)
  const [lowMidi, setLowMidi] = useState(36) // C2 — a comfy default left edge
  // Internal Record arm — used only when the parent doesn't own it.
  const [recordLocal, setRecordLocal] = useState(false)
  const record = recordProp ?? recordLocal
  const [playing, setPlaying] = useState(false)
  const [liveLabel, setLiveLabel] = useState<string>("")
  const [playStep, setPlayStep] = useState(-1)

  const harmony = docHarmony(doc)
  const tonicPc = ((harmony.tonic % 12) + 12) % 12
  // A short label of what the ribbon is following (the mode name, or "chords").
  const harmonyLabel =
    harmony.mode === "chordal"
      ? ct("instrumentSurface.chordCount", { n: String(harmony.progression.length) })
      : harmony.scale.id.split(".").pop()?.replace(/([a-z])([A-Z])/g, "$1 $2") ?? ct("instrumentSurface.scaleFallback")

  const surfaceRef = useRef<HTMLDivElement | null>(null)
  // The fixed pool of per-finger lit markers (positioned directly via the DOM,
  // never via React state, so multitouch lighting stays 60fps).
  const markerRefs = useRef<(HTMLSpanElement | null)[]>([])
  // Per-finger note labels (one per marker) — EACH finger reads its OWN note, so a
  // two-finger chord shows both names and a release clears only that finger's label
  // (no single shared readout that strands the last note under another finger).
  const markerLabelRefs = useRef<(HTMLSpanElement | null)[]>([])
  // Per-pointer live voices — POLYPHONY (ported from PlaySurface's touch map).
  const touches = useRef<Map<number, Touch>>(new Map())
  // Latest control values for the pointer closures (avoid stale captures @60fps).
  const live = useRef({ fretted, lowMidi, spanOct, record, quantizeRecord })
  // Live playhead step, mirrored for the (closure-bound) record path.
  const playStepRef = useRef(playStep)
  // Live RAW playhead tick (for non-quantized record placement).
  const playTickRef = useRef(-1)

  const win: RibbonWindow = useMemo(
    () => ({ lowMidi, spanSemis: spanOct * 12 }),
    [lowMidi, spanOct]
  )

  // Frets = the global harmony's active pitches across the window. Change the
  // song's mode/chords and the frets re-lay-out instantly.
  const frets: Fret[] = useMemo(() => {
    const notes = activeMidiInRange(doc, 0, win.lowMidi, win.lowMidi + win.spanSemis)
    return notes.map((midi) => ({
      midi,
      x: midiToX(midi, win),
      tonic: pitchClass(midi) === tonicPc,
      label: noteLabel(midi),
    }))
  }, [doc, win, tonicPc])

  // Release every in-flight voice on unmount / track change (no dangling notes).
  useEffect(() => {
    const map = touches.current
    return () => {
      for (const t of map.values()) t.handle?.release()
      map.clear()
      for (const node of markerRefs.current) if (node) node.style.opacity = "0"
      for (const label of markerLabelRefs.current) if (label) label.textContent = ""
    }
  }, [trackId])

  // Mirror the latest control values for the pointer handlers.
  useEffect(() => {
    live.current = { fretted, lowMidi, spanOct, record, quantizeRecord }
  }, [fretted, lowMidi, spanOct, record, quantizeRecord])

  // Live playhead → current step on this track's grid (for record placement).
  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      playTickRef.current = tick
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])
  useEffect(() => {
    playStepRef.current = playStep
  }, [playStep])

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

  /** Paint the PRIMARY comet + beam via CSS vars (no React re-render per frame).
   *  The primary finger keeps the rich comet/glow; every finger ALSO gets its own
   *  lit marker via `paintMarkers`. */
  const paint = (x: number, expr: number) => {
    const el = surfaceRef.current
    if (!el) return
    el.style.setProperty("--bl-ribbon-x", `${x * 100}%`)
    el.style.setProperty("--bl-ribbon-y", `${(1 - expr) * 100}%`)
    el.style.setProperty("--bl-ribbon-on", "1")
  }

  /** Light EVERY currently-held note: one marker + its OWN note label per active
   *  pointer, positioned straight on the DOM pool node (no React churn). Each
   *  finger reads its own note; unused pool slots (lifted fingers) hide + clear. */
  const paintMarkers = () => {
    const list = [...touches.current.values()]
    for (let i = 0; i < MARKER_POOL; i++) {
      const node = markerRefs.current[i]
      const label = markerLabelRefs.current[i]
      if (!node) continue
      if (i < list.length) {
        const t = list[i]
        node.style.left = `${t.x * 100}%`
        node.style.opacity = "1"
        if (label) label.textContent = noteLabel(t.midi)
      } else if (node.style.opacity !== "0") {
        node.style.opacity = "0"
        if (label) label.textContent = ""
      }
    }
  }

  /** Drive the bound instrument's brightness from vertical expression. Only
   *  meaningful for analog/synth (cutoff); wrapped so sampler/soundfont no-op. */
  const applyExpression = (expr: number) => {
    try {
      host.applyParam(
        { scope: "instrument", trackId, param: "cutoff" },
        exprToCutoff(expr)
      )
    } catch {
      /* engines without a cutoff param: harmless no-op */
    }
  }

  const resolveMidi = (x: number): number => {
    const st = live.current
    const w: RibbonWindow = { lowMidi: st.lowMidi, spanSemis: st.spanOct * 12 }
    // RTL: the left edge is HIGH pitch, so read the pitch fraction from the start
    // (right) edge. Visuals still ride rawX (they sit under the finger).
    const raw = xToMidi(rtl ? 1 - x : x, w)
    // In key = snap to the nearest pitch of the SONG's active harmony (resolver,
    // read live so chord/mode changes apply immediately). Free glide = raw.
    return st.fretted
      ? quantizeToHarmony(raw, store.vanilla.getState().doc, 0)
      : raw
  }

  /** Record a (resolved) pitch into the bound track for ONE finger. Per-pointer
   *  step dedupe so two fingers can both lay notes without clobbering. The
   *  placement rules (dedupe + quantize on/off + duplicate-cell) are pure. */
  const recordIntoTrack = (t: Touch, midi: number) => {
    const st = live.current
    if (!st.record) return
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur)) return
    const result = placeRecordedNote({
      trackId,
      notes: cur.notes,
      grid: cur.grid,
      playStep: playStepRef.current,
      playTick: playTickRef.current,
      lastRecordedStep: t.lastRecordedStep,
      quantizeRecord: st.quantizeRecord,
      midi,
    })
    t.lastRecordedStep = result.lastRecordedStep
    if (result.command) store.dispatch(result.command)
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
    // Open a live voice on the BOUND TRACK's real instrument (polyphonic).
    const handle = host.playLiveVoice(trackId, midi, 0.9)
    // Soundfont/sampler fallback: no live pool → a stepped one-shot per crossing.
    if (!handle) host.previewTrack(trackId, 0.9, Math.round(midi))
    applyExpression(expr)
    const t: Touch = { handle, midi, lastRecordedStep: -1, x }
    touches.current.set(e.pointerId, t)
    paint(x, expr)
    paintMarkers()
    setPlaying(true)
    setLiveLabel(noteLabel(midi))
    recordIntoTrack(t, midi)
    e.preventDefault()
  }

  const onMove = (e: React.PointerEvent) => {
    const t = touches.current.get(e.pointerId)
    if (!t) return
    const x = xFromEvent(e.clientX)
    const expr = exprFromEvent(e.clientY)
    const midi = resolveMidi(x)
    applyExpression(expr)
    t.x = x
    // Only act when the resolved pitch actually moved (in-key snapping resolves
    // many micro-moves to the same note → no needless bends / previews).
    if (midi !== t.midi) {
      const crossed = Math.round(midi) !== Math.round(t.midi)
      t.midi = midi
      if (t.handle) t.handle.bend(midi)
      else if (crossed) host.previewTrack(trackId, 0.9, Math.round(midi)) // stepped fallback
      setLiveLabel(noteLabel(midi))
      if (crossed) recordIntoTrack(t, midi)
    }
    paint(x, expr)
    paintMarkers()
  }

  const endPointer = (e: React.PointerEvent) => {
    const t = touches.current.get(e.pointerId)
    if (!t) return
    t.handle?.release()
    touches.current.delete(e.pointerId)
    paintMarkers()
    if (touches.current.size === 0) {
      setPlaying(false)
      setLiveLabel("") // no fingers → drop the aria value (no stale note)
      const el = surfaceRef.current
      if (el) el.style.setProperty("--bl-ribbon-on", "0")
    } else {
      // Aria reflects a finger that's still down (not the one just lifted).
      const last = [...touches.current.values()].pop()
      if (last) setLiveLabel(noteLabel(last.midi))
    }
    try {
      surfaceRef.current?.releasePointerCapture(e.pointerId)
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
      {showRecord && (
        <div className="bl-grid-toolbar" data-bl-nocapture>
          <div className="bl-grid-title">
            <span className="bl-dot" style={{ background: track?.color }} />
          </div>
          <div className="bl-grid-actions">
            <button
              type="button"
              className={`bl-chip${record ? " is-armed" : ""}`}
              aria-pressed={record}
              onClick={() => setRecordLocal((r) => !r)}
            >
              {record ? ct("instrumentSurface.recording") : ct("instrumentSurface.record")}
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
              {ct("instrumentSurface.clear")}
            </button>
          </div>
        </div>
      )}

      {/* ---- control strip: two tidy rows ----
           Row 1 — Lock/Free (+ an optional slot, e.g. the page's Record arm).
           Row 2 — the octave window: ◀ low … 3|5|8 span … high ▶ (the span sits
           centred between the shift edges, the range read at each edge). The
           song's key/mode is shown once (the Harmony summary), never duplicated. */}
      <div className="bl-ribbon-controls" data-bl-nocapture>
        <div className="bl-ribbon-ctl-row">
          <div className="bl-seg" role="group" aria-label={ct("instrumentSurface.pitchLock")}>
            <button
              type="button"
              className={`bl-seg-btn${fretted ? " is-on" : ""}`}
              aria-pressed={fretted}
              onClick={() => setFretted(true)}
            >
              {ct("instrumentSurface.lock")}
            </button>
            <button
              type="button"
              className={`bl-seg-btn${!fretted ? " is-on" : ""}`}
              aria-pressed={!fretted}
              onClick={() => setFretted(false)}
            >
              {ct("instrumentSurface.free")}
            </button>
          </div>
          {headerSlot && <div className="bl-ribbon-ctl-slot">{headerSlot}</div>}
        </div>

        <div className="bl-ribbon-ctl-row bl-ribbon-octrow">
          <div className="bl-ribbon-oct-edge">
            <button
              type="button"
              className="bl-icon-btn"
              aria-label={ct("instrumentSurface.shiftDownOctave")}
              onClick={() => shiftOctave(-1)}
            >
              {rtl ? "▶" : "◀"}
            </button>
            <span className="bl-ribbon-oct-label" aria-hidden="true">
              {noteLabel(lowMidi)}
            </span>
          </div>

          <div className="bl-seg" role="group" aria-label={ct("instrumentSurface.octaveSpan")}>
            {SPAN_OCTAVES.map((o) => (
              <button
                key={o}
                type="button"
                className={`bl-seg-btn${spanOct === o ? " is-on" : ""}`}
                aria-pressed={spanOct === o}
                aria-label={ct("instrumentSurface.octaves", { n: String(o) })}
                onClick={() => setSpanOct(o)}
              >
                {o}
              </button>
            ))}
          </div>

          <div className="bl-ribbon-oct-edge">
            <span className="bl-ribbon-oct-label" aria-hidden="true">
              {noteLabel(lowMidi + spanOct * 12)}
            </span>
            <button
              type="button"
              className="bl-icon-btn"
              aria-label={ct("instrumentSurface.shiftUpOctave")}
              onClick={() => shiftOctave(1)}
            >
              {rtl ? "◀" : "▶"}
            </button>
          </div>
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
        aria-label={ct("instrumentSurface.ribbonAria", {
          key: KEY_NAMES[tonicPc],
          harmony: harmonyLabel,
          lock: fretted ? ct("instrumentSurface.lock") : ct("instrumentSurface.free"),
        })}
        aria-valuetext={liveLabel || `${KEY_NAMES[tonicPc]} ${harmonyLabel}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        {/* fret lines on in-scale degrees */}
        <div className="bl-ribbon-frets" aria-hidden="true">
          {frets.map((f) => (
            <span
              key={f.midi}
              className={`bl-fret${f.tonic ? " is-tonic" : ""}`}
              style={{ left: `${(rtl ? 1 - f.x : f.x) * 100}%` }}
            >
              {f.tonic && <span className="bl-fret-label">{f.label}</span>}
            </span>
          ))}
        </div>
        {/* finger comet + active column glow (the PRIMARY finger) */}
        <span className="bl-ribbon-comet" aria-hidden="true" />
        <span className="bl-ribbon-beam" aria-hidden="true" />
        {/* one lit marker + its OWN note label per active pointer — multitouch
            lights ALL held notes and each finger reads its independent note */}
        <div className="bl-ribbon-marks" aria-hidden="true">
          {Array.from({ length: MARKER_POOL }, (_, i) => (
            <span
              key={i}
              ref={(n) => {
                markerRefs.current[i] = n
              }}
              className="bl-ribbon-mark"
              style={{ opacity: 0 }}
            >
              <span
                ref={(n) => {
                  markerLabelRefs.current[i] = n
                }}
                className="bl-ribbon-mark-label"
              />
            </span>
          ))}
        </div>
        {!playing && (
          <span className="bl-ribbon-hint" aria-hidden="true">
            {ct("instrumentSurface.slideToPlay")}
          </span>
        )}
      </div>
    </div>
  )
}
