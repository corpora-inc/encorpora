/**
 * beatlounge — the SCORE editor: the melody-creation centerpiece. It edits the
 * BOUND track's `notes` two ways without tapping every note:
 *
 *   • ROWS = SCALE DEGREES across ~2 octaves, resolved IN KEY via the resolver
 *     (`scoreModel.degreeRows`). The shared <LaneGrid> renders them (one head +
 *     a row of step cells you can still paint by hand). The head SELECTION (a
 *     range or individual rows) targets the +/− layer dial, exactly like the
 *     drum grid's lane selection targets a groove.
 *
 *   • THE +/− "LAYER" DIAL — the heart, mirroring the Grooves density dial:
 *       − (sparser) thins the current melody (lowest-weight / off-beat first),
 *       + (layer)   lays one more probabilistic melodic pass into the selected
 *                   rows from the melody corpus (metric profile + transition
 *                   table), additive, re-rolled each tap. Each tap is ONE undo
 *                   step and only WRITES the grid (never auto-starts transport).
 *
 *   • ENDLESS auto-play (optional) — when ON and the global transport is playing,
 *     re-generate a continuous, non-repeating melodic line filling the loop on
 *     each loop wrap. Reuses the global transport (no second play button); OFF by
 *     default. No LLM.
 *
 * Every placed note resolves through `degreeToPitch` against live harmony, so
 * changing the song's mode/chords keeps the score in key.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { Id } from "../../model/document"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack } from "../../model/document"
import { stepForTick, tickForStep } from "../../model/timing"
import {
  METRIC_PROFILES,
  TRANSITION_TABLES,
  type MetricProfile,
  type TransitionTable,
} from "../../music/melody"
import { LaneGrid, type LaneGridLane } from "../track-studio/LaneGrid"
import {
  buildScoreView,
  fillScoreCells,
  buildScoreCommands,
  buildAutoPlayNotes,
  type ScoreView,
} from "./scoreModel"
import "./score.css"

export interface ScoreProps {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
  /** The shared transport/playhead facade — supplied by the Instruments page so
   *  auto-play can ride the GLOBAL transport. Optional: without it the editor
   *  still layers + paints; only auto-play is unavailable. */
  audio?: AudioFacade
}

/** ~2 octaves around the working tonic — singable, mostly-ascending register. */
const OCTAVES = 2

export const Score = ({ host, store, trackId, audio }: ScoreProps) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)

  // Local UI: the head selection (degree-row keys) + corpus picks + auto-play.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [metricId, setMetricId] = useState<string>(METRIC_PROFILES[0]?.id ?? "")
  const [tableId, setTableId] = useState<string>(TRANSITION_TABLES[0]?.id ?? "")
  const [auto, setAuto] = useState(false)
  const [playStep, setPlayStep] = useState(-1)

  const metric: MetricProfile =
    METRIC_PROFILES.find((m) => m.id === metricId) ?? METRIC_PROFILES[0]
  const table: TransitionTable =
    TRANSITION_TABLES.find((t) => t.id === tableId) ?? TRANSITION_TABLES[0]

  // The grid view (rows = degrees, columns = steps), cells filled from the track.
  const view: ScoreView | null = useMemo(() => {
    if (!track || !isInstrumentTrack(track)) return null
    const base = buildScoreView(doc, track.grid, { octaves: OCTAVES })
    return fillScoreCells(base, track.notes, track.grid)
  }, [doc, track])

  // Live playhead → current step on this track's grid; also drives auto-play.
  const lastTick = useRef(-1)
  useEffect(() => {
    if (!audio) return
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
      lastTick.current = tick
    })
  }, [audio, store, trackId])

  // Endless auto-play: on each loop WRAP (tick decreased) regenerate a fresh,
  // non-repeating line into the bound track. Rides the GLOBAL transport (we only
  // fill while it's actually playing). One write per wrap; OFF by default.
  const prevWrapTick = useRef(-1)
  const autoRef = useRef(auto)
  useEffect(() => {
    autoRef.current = auto
  }, [auto])
  useEffect(() => {
    if (!audio || !auto) return
    // Seed a first fill immediately so turning it ON does something audible.
    fillAuto()
    const off = audio.onPlayhead((tick) => {
      if (!autoRef.current || !audio.isPlaying()) {
        prevWrapTick.current = tick
        return
      }
      // Loop wrap = the playhead jumped backwards.
      if (prevWrapTick.current >= 0 && tick < prevWrapTick.current) fillAuto()
      prevWrapTick.current = tick
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio, auto, metricId, tableId])

  const fillAuto = () => {
    const cur = store.vanilla.getState().doc
    const t = findTrack(cur, trackId)
    if (!t || !isInstrumentTrack(t)) return
    const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0
    // Pass the track grid so auto-play notes snap to the visible cells too (no
    // off-grid phantoms), matching the +/- layer path.
    const notes = buildAutoPlayNotes(cur, { metric, table, octaves: OCTAVES, seed, grid: t.grid })
    store.dispatch({ t: "setNotes", trackId, notes })
  }

  if (!track || !isInstrumentTrack(track) || !view) {
    return <div className="bl-grid-empty">No melodic track.</div>
  }
  const itrack = track

  const anySolo = doc.tracks.some((t) => t.solo)
  const silent = itrack.mute || (anySolo && !itrack.solo)

  // ---- the shared LaneGrid's lane shape (degree rows keyed by degree index) --
  const lanes: LaneGridLane[] = view.rows.map((r) => ({
    key: r.key,
    selectKey: r.key,
    label: r.label,
    cells: r.cells.map((c) => ({ on: c.on, velocity: c.velocity })),
  }))

  const isCellOn = (rowIndex: number, step: number): boolean => {
    const row = view.rows[rowIndex]
    if (!row) return false
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur)) return false
    const tick = tickForStep(step, cur.grid)
    return cur.notes.some((n) => n.tick === tick && n.pitch === row.midi)
  }

  const setCell = (rowIndex: number, step: number, on: boolean) => {
    const row = view.rows[rowIndex]
    if (!row) return
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur)) return
    const tick = tickForStep(step, cur.grid)
    const existing = cur.notes.find((n) => n.tick === tick && n.pitch === row.midi)
    if (on && !existing) {
      store.dispatch({
        t: "addNote",
        trackId,
        note: { tick, duration: gridStepTicks(cur.grid), pitch: row.midi, velocity: 0.85 },
      })
    } else if (!on && existing) {
      store.dispatch({ t: "removeNote", trackId, noteId: existing.id })
    }
  }

  const toggleLane = (selectKey: string) => {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(selectKey)) next.delete(selectKey)
      else next.add(selectKey)
      return next
    })
  }

  // ---- the +/− layer dial — one undo batch per tap --------------------------
  const runDial = (op: "add" | "remove") => {
    const before = store.vanilla.getState().doc
    const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0
    const result = buildScoreCommands(store.vanilla.getState().doc, {
      trackId,
      op,
      selectedRows: selected,
      metric,
      table,
      octaves: OCTAVES,
      seed,
    })
    if (result.commands.length === 0) {
      host.toast(result.summary || "Nothing to apply")
      return
    }
    store.dispatch({ t: "batch", commands: result.commands, label: `score-${op}` })
    host.toast(result.summary, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  const selCount = selected.size

  return (
    <div className="bl-score">
      {/* ---- the +/− layer dial (primary) ---- */}
      <div className="bl-score-bar" data-bl-nocapture>
        <div
          className="bl-score-dial"
          role="group"
          aria-label="Melody layer — sparser or denser"
        >
          <button
            type="button"
            className="bl-score-dial-btn"
            onClick={() => runDial("remove")}
            aria-label="Sparser"
            title="Sparser — peel a few notes back (off-beat first), down to nothing"
          >
            <MinusGlyph />
          </button>
          <span className="bl-score-dial-label" aria-hidden="true">
            Layer
          </span>
          <button
            type="button"
            className="bl-score-dial-btn is-primary"
            onClick={() => runDial("add")}
            aria-label="Denser"
            title={
              selCount > 0
                ? "Denser — lay one more melodic layer on the selected rows"
                : "Denser — lay one more melodic layer across the whole range"
            }
          >
            <PlusGlyph />
          </button>
        </div>

        {/* corpus picks — feel (metric) + motion (transition). Icon-light. */}
        <div className="bl-score-picks" data-bl-nocapture>
          <select
            className="bl-select"
            aria-label="Melodic feel"
            value={metricId}
            onChange={(e) => setMetricId(e.target.value)}
          >
            {METRIC_PROFILES.map((m) => (
              <option key={m.id} value={m.id}>
                {shortName(m.id)}
              </option>
            ))}
          </select>
          <select
            className="bl-select"
            aria-label="Melodic motion"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
          >
            {TRANSITION_TABLES.map((t) => (
              <option key={t.id} value={t.id}>
                {shortName(t.id)}
              </option>
            ))}
          </select>
          {audio && (
            <button
              type="button"
              className={`bl-chip${auto ? " is-armed" : ""}`}
              aria-pressed={auto}
              onClick={() => setAuto((a) => !a)}
              title="Endless auto-play — re-generate a flowing line each loop (rides the global transport)"
            >
              Auto
            </button>
          )}
        </div>
      </div>

      {/* ---- the degree grid (rows = scale degrees, in key) ---- */}
      <div className="bl-grid-scroll bl-score-scroll">
        <LaneGrid
          lanes={lanes}
          steps={view.steps}
          stepsPerBeat={view.stepsPerBeat}
          playStep={playStep}
          silent={silent}
          selected={selected}
          onToggleLane={toggleLane}
          setCell={setCell}
          isCellOn={isCellOn}
        />
      </div>
    </div>
  )
}

/** One grid cell's ticks (note duration when painting a cell by hand). */
const gridStepTicks = (grid: Parameters<typeof tickForStep>[1]): number =>
  tickForStep(1, grid)

/** Strip the "metric:" / "transition:" prefix for a compact, humane option. */
const shortName = (id: string): string => {
  const tail = id.split(":").pop() ?? id
  return tail.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------- glyphs
const MinusGlyph = () => (
  <svg className="bl-score-dial-glyph" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)
const PlusGlyph = () => (
  <svg className="bl-score-dial-glyph" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="10" y1="5" x2="10" y2="15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)
