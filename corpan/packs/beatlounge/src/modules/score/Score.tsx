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
import { useAutoConfig, type AutoVariation } from "../../store/autoMelody"
import { ct } from "../../i18n/strings"
import { LaneGrid, type LaneGridLane } from "../track-studio/LaneGrid"
import {
  buildScoreView,
  fillScoreCells,
  buildScoreCommands,
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

/** The register the +/- generator works in (singable, mostly-ascending). The
 *  VIEW shows far more than this — see SCORE_RANGE. */
const OCTAVES = 2

/** The score VIEW shows the full instrument range (88-key piano, A0–C8),
 *  scrollable — so notes can be seen and placed anywhere, not just ~3 octaves. */
const SCORE_RANGE = { loMidi: 21, hiMidi: 108 } as const

/** The Variation seed-policy values + their short, translatable labels. */
const VARIATIONS: readonly AutoVariation[] = ["lock", "evolve", "new"]
const variationLabel = (v: AutoVariation): string =>
  v === "lock" ? ct("score.lock") : v === "evolve" ? ct("score.evolve") : ct("score.new")

/** Density step per +/- tap (clamped 0..1 by the store). */
const DENSITY_STEP = 0.15

export const Score = ({ host, store, trackId, audio }: ScoreProps) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)

  // Local UI: the head selection (degree-row keys) + the live playhead step.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [playStep, setPlayStep] = useState(-1)
  // Note-level selection (#331): a "Select" mode where the grid stroke selects
  // lit notes instead of painting them. Selected cells are keyed "rowIndex:step".
  const [selectMode, setSelectMode] = useState(false)
  const [selectedCells, setSelectedCells] = useState<ReadonlySet<string>>(new Set())

  // Per-track Auto config (Feel/Motion/Density/Variation + the arm flag) lives in
  // the persisted store — so the line keeps regenerating after you leave this
  // screen, and the rig-level conductor (not this component) drives generation.
  const auto = useAutoConfig(trackId)
  const metricId = auto.metricId
  const tableId = auto.tableId
  const armed = auto.on

  const metric: MetricProfile =
    METRIC_PROFILES.find((m) => m.id === metricId) ?? METRIC_PROFILES[0]
  const table: TransitionTable =
    TRANSITION_TABLES.find((t) => t.id === tableId) ?? TRANSITION_TABLES[0]

  // The grid view (rows = degrees, columns = steps), cells filled from the track.
  // Full instrument range (scrollable) so notes can be placed anywhere (#394).
  const view: ScoreView | null = useMemo(() => {
    if (!track || !isInstrumentTrack(track)) return null
    const base = buildScoreView(doc, track.grid, { range: SCORE_RANGE })
    return fillScoreCells(base, track.notes, track.grid)
  }, [doc, track])

  // Open scrolled to ~middle C so the user starts in a useful register (the full
  // range is tall; row 0 is the highest pitch). Center ONCE PER TRACK — re-center
  // when you switch tracks, but never on note edits (which would yank the scroll
  // back mid-placement). Keyed by trackId, not the view.
  const scrollRef = useRef<HTMLDivElement>(null)
  const centeredFor = useRef<string | null>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !view || view.rows.length === 0) return
    if (centeredFor.current === trackId) return
    const frac = (SCORE_RANGE.hiMidi - 60) / (SCORE_RANGE.hiMidi - SCORE_RANGE.loMidi)
    el.scrollTop = Math.max(0, frac * el.scrollHeight - el.clientHeight / 2)
    centeredFor.current = trackId
  }, [view, trackId])

  // Live playhead → current step on this track's grid. (Auto generation now runs
  // in the rig-level AutoConductor, not here, so it survives leaving the screen.)
  const lastTick = useRef(-1)
  useEffect(() => {
    if (!audio) return
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
      lastTick.current = tick
    })
  }, [audio, store, trackId])

  if (!track || !isInstrumentTrack(track) || !view) {
    return <div className="bl-grid-empty">{ct("score.noTrack")}</div>
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
    // A hand edit on an armed track wins: disarm first so the conductor doesn't
    // overwrite the manual touch next wrap. The last previewed line stays put;
    // this edit lands on top as a normal, undoable dispatch.
    if (auto.on) auto.arm(false)
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

  // ---- note selection (#331) ------------------------------------------------
  const setCellSelected = (rowIndex: number, step: number, sel: boolean) => {
    const key = `${rowIndex}:${step}`
    setSelectedCells((cur) => {
      if (cur.has(key) === sel) return cur
      const next = new Set(cur)
      if (sel) next.add(key)
      else next.delete(key)
      return next
    })
  }
  const toggleSelectMode = () => {
    setSelectMode((on) => {
      if (on) setSelectedCells(new Set()) // leaving select mode clears the set
      return !on
    })
  }
  // A fresh track starts with no note-selection (rows/notes differ per track).
  useEffect(() => {
    setSelectMode(false)
    setSelectedCells(new Set())
  }, [trackId])

  // The selected cells resolved to real note ids — what downstream actions
  // (#395 +/− on selection, #332 evolve selection) operate on.
  const selectedNoteIds = useMemo(() => {
    const ids = new Set<string>()
    if (!track || !isInstrumentTrack(track) || !view) return ids
    for (const key of selectedCells) {
      const [ri, s] = key.split(":").map(Number)
      const row = view.rows[ri]
      if (!row) continue
      const tick = tickForStep(s, track.grid)
      const note = track.notes.find((n) => n.tick === tick && n.pitch === row.midi)
      if (note) ids.add(note.id)
    }
    return ids
  }, [selectedCells, track, view])

  // The degree-row keys of the selected notes — so "+" can spread a layer across
  // exactly the rows the user selected (#395). `row.key` is the degree string.
  const selectedDegreeKeys = useMemo(() => {
    const keys = new Set<string>()
    if (!view) return keys
    for (const cell of selectedCells) {
      const row = view.rows[Number(cell.split(":")[0])]
      if (row) keys.add(row.key)
    }
    return keys
  }, [selectedCells, view])

  // ---- the +/− layer dial — one undo batch per tap --------------------------
  const runDial = (op: "add" | "remove") => {
    // A manual layer tap on an armed track wins: disarm so the conductor stops
    // overwriting it. The +/- batch below stays a single undoable edit + toast.
    if (auto.on) auto.arm(false)
    const before = store.vanilla.getState().doc
    const finishToast = (summary: string) =>
      host.toast(summary, { undo: () => store.vanilla.getState().doc !== before && store.undo() })

    // ---- #395: when a NOTE selection exists, the dial acts ON the selection ----
    if (selectedNoteIds.size > 0) {
      if (op === "remove") {
        // "−" removes exactly the selected notes (one undo step).
        const cmds = [...selectedNoteIds].map(
          (noteId) => ({ t: "removeNote" as const, trackId, noteId })
        )
        const n = cmds.length
        store.dispatch({ t: "batch", commands: cmds, label: "score-remove-selected" })
        setSelectedCells(new Set())
        finishToast(n === 1 ? ct("score.removedNoteOne", { n: "1" }) : ct("score.removedNotes", { n: String(n) }))
        return
      }
      // "+" spreads a fresh layer across the SELECTED notes' rows (all of them).
      const seedSel = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0
      const selResult = buildScoreCommands(store.vanilla.getState().doc, {
        trackId, op, selectedRows: selectedDegreeKeys, metric, table, octaves: OCTAVES, seed: seedSel,
      })
      if (selResult.commands.length === 0) {
        host.toast(selResult.summary || ct("score.nothingToApply"))
        return
      }
      store.dispatch({ t: "batch", commands: selResult.commands, label: `score-${op}` })
      finishToast(selResult.summary)
      return
    }

    // ---- no note selection: today's behaviour (row-head selection / global) ----
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
      host.toast(result.summary || ct("score.nothingToApply"))
      return
    }
    store.dispatch({ t: "batch", commands: result.commands, label: `score-${op}` })
    finishToast(result.summary)
  }

  // ---- #332: Evolve the selected notes — vary them IN KEY (transpose a coherent
  // amount, or mirror the contour). Each selected note carries its degree (its
  // row), so we shift the degree and resolve the new pitch from the range rows. --
  const evolveSelection = () => {
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur) || selectedCells.size === 0 || !view) return
    if (auto.on) auto.arm(false)
    const before = store.vanilla.getState().doc

    const sel: { degree: number; tick: number; id: string; duration: number; velocity: number }[] = []
    for (const cellKey of selectedCells) {
      const [ri, s] = cellKey.split(":").map(Number)
      const row = view.rows[ri]
      if (!row) continue
      const tick = tickForStep(s, cur.grid)
      const note = cur.notes.find((n) => n.tick === tick && n.pitch === row.midi)
      if (note) sel.push({ degree: row.degree, tick, id: note.id, duration: note.duration, velocity: note.velocity })
    }
    if (sel.length === 0) return

    // One transform for the whole selection: mostly a coherent in-scale transpose,
    // sometimes a contour inversion around the selection's mean degree.
    const mean = sel.reduce((a, n) => a + n.degree, 0) / sel.length
    const mapDeg =
      Math.random() < 0.3
        ? (d: number) => Math.round(2 * mean - d) // invert contour
        : ((off) => (d: number) => d + off)([-2, -1, 1, 2][Math.floor(Math.random() * 4)]) // transpose

    const midiForDegree = (deg: number): number | null =>
      view.rows.find((r) => r.degree === deg)?.midi ?? null

    const newNotes = sel
      .map((n) => {
        const midi = midiForDegree(mapDeg(n.degree))
        return midi == null ? null : { tick: n.tick, duration: n.duration, pitch: midi, velocity: n.velocity }
      })
      .filter((n): n is NonNullable<typeof n> => n !== null)
    if (newNotes.length === 0) {
      host.toast(ct("score.nothingToApply"))
      return
    }
    const cmds = [
      ...sel.map((n) => ({ t: "removeNote" as const, trackId, noteId: n.id })),
      ...newNotes.map((note) => ({ t: "addNote" as const, trackId, note })),
    ]
    store.dispatch({ t: "batch", commands: cmds, label: "score-evolve" })
    setSelectedCells(new Set()) // note ids changed
    host.toast(ct("score.evolvedToast", { n: String(newNotes.length) }), {
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
          aria-label={ct("score.layerDial")}
        >
          <button
            type="button"
            className="bl-score-dial-btn"
            onClick={() => runDial("remove")}
            aria-label={ct("score.sparser")}
            title={ct("score.sparserHint")}
          >
            <MinusGlyph />
          </button>
          <span className="bl-score-dial-label" aria-hidden="true">
            {ct("score.layer")}
          </span>
          <button
            type="button"
            className="bl-score-dial-btn is-primary"
            onClick={() => runDial("add")}
            aria-label={ct("score.denser")}
            title={
              selCount > 0
                ? ct("score.denserSelectedHint")
                : ct("score.denserAllHint")
            }
          >
            <PlusGlyph />
          </button>
        </div>

        {/* corpus picks — feel (metric) + motion (transition). Icon-light. */}
        <div className="bl-score-picks" data-bl-nocapture>
          <select
            className="bl-select"
            aria-label={ct("score.feel")}
            value={metricId}
            onChange={(e) => auto.setOption({ metricId: e.target.value })}
          >
            {METRIC_PROFILES.map((m) => (
              <option key={m.id} value={m.id}>
                {shortName(m.id)}
              </option>
            ))}
          </select>
          <select
            className="bl-select"
            aria-label={ct("score.motion")}
            value={tableId}
            onChange={(e) => auto.setOption({ tableId: e.target.value })}
          >
            {TRANSITION_TABLES.map((t) => (
              <option key={t.id} value={t.id}>
                {shortName(t.id)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`bl-chip${selectMode ? " is-armed" : ""}`}
            aria-pressed={selectMode}
            onClick={toggleSelectMode}
            title={ct("score.selectHint")}
          >
            {selectMode && selectedNoteIds.size > 0
              ? ct("score.selectCount", { n: String(selectedNoteIds.size) })
              : ct("score.select")}
          </button>
          {selectMode && selectedNoteIds.size > 0 && (
            <button
              type="button"
              className="bl-chip"
              onClick={evolveSelection}
              title={ct("score.evolveSelHint")}
            >
              {ct("score.evolveSel")}
            </button>
          )}
          {audio && (
            <button
              type="button"
              className={`bl-chip${armed ? " is-armed" : ""}`}
              aria-pressed={armed}
              onClick={() => auto.arm(!armed)}
              title={ct("score.autoHint")}
            >
              {ct("score.auto")}
            </button>
          )}

          {/* Armed-only: the headline Variation policy + a Density stepper. Shown
              only when it matters; no transient/status text that reflows the grid. */}
          {audio && armed && (
            <>
              <div
                className="bl-seg"
                role="group"
                aria-label={ct("score.variation")}
                data-bl-nocapture
              >
                {VARIATIONS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={`bl-seg-btn${auto.variation === v ? " is-on" : ""}`}
                    aria-pressed={auto.variation === v}
                    onClick={() => auto.setOption({ variation: v })}
                  >
                    {variationLabel(v)}
                  </button>
                ))}
              </div>
              <div
                className="bl-score-dial"
                role="group"
                aria-label={ct("score.density")}
                data-bl-nocapture
              >
                <button
                  type="button"
                  className="bl-score-dial-btn"
                  aria-label={ct("score.sparser")}
                  onClick={() => auto.setOption({ density: auto.density - DENSITY_STEP })}
                >
                  <MinusGlyph />
                </button>
                <button
                  type="button"
                  className="bl-score-dial-btn is-primary"
                  aria-label={ct("score.busier")}
                  onClick={() => auto.setOption({ density: auto.density + DENSITY_STEP })}
                >
                  <PlusGlyph />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- the degree grid (rows = scale degrees, in key) ---- */}
      <div ref={scrollRef} className="bl-grid-scroll bl-score-scroll">
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
          selectMode={selectMode}
          selectedCells={selectedCells}
          setCellSelected={setCellSelected}
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
