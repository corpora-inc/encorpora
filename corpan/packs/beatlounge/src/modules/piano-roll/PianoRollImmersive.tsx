/**
 * beatlounge — the piano-roll IMMERSIVE view: a full melodic note editor.
 *
 * One row per MIDI pitch across a two-octave window (scale-highlighted, C-major
 * by default; accidentals are dimmer but always reachable). Columns are the
 * steps of `stepsInLoop(loopLengthTicks, track.grid)`. A single pointer stroke
 * paints / erases notes (the stroke's first cell sets add-vs-erase, exactly
 * like the step grid). The live playhead column lights from `audio.onPlayhead`.
 *
 * Velocity: long-press a lit cell opens a row velocity control; while a note is
 * selected the foot exposes a velocity Knob that edits it live. The window can
 * be shifted by an octave to reach the whole keyboard.
 *
 * Header wires the registry actions (clear / arpeggiate / transpose).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import {
  findTrack,
  isInstrumentTrack,
  type Id,
  type InstrumentTrack,
} from "../../model/document"
import { stepForTick, tickForStep } from "../../model/timing"
import { Knob } from "../../bl-ui"
import {
  autoWindow,
  buildRollView,
  ROW_SPAN,
  pitchLabel,
  type RollCell,
} from "./pitchModel"
import { arpeggiateAction, clearAction, transposeAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

const LONG_PRESS_MS = 360

export const PianoRollImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)
  // The bottom pitch of the visible window; framed on the melody initially.
  const [low, setLow] = useState<number | null>(null)
  // The currently-selected note (for the velocity control), by id.
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const paintMode = useRef<null | "add" | "remove">(null)
  const touched = useRef(new Set<string>())
  const longTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Frame the window on the existing melody the first time we see the track.
  useEffect(() => {
    if (low != null) return
    const t = findTrack(store.vanilla.getState().doc, trackId)
    if (t && isInstrumentTrack(t)) setLow(autoWindow(t))
  }, [low, store, trackId])

  // Live playhead → current step on this track's grid.
  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  useEffect(
    () => () => {
      if (longTimer.current) clearTimeout(longTimer.current)
    },
    []
  )

  const view = useMemo(
    () =>
      track && isInstrumentTrack(track) && low != null
        ? buildRollView(doc, track, { low, span: ROW_SPAN })
        : null,
    [doc, track, low]
  )

  if (!track || !isInstrumentTrack(track) || view == null || low == null) {
    return <div className="bl-grid-empty">No melodic track.</div>
  }

  const cellOf = (pitch: number, step: number): RollCell | null => {
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur)) return null
    const tick = tickForStep(step, cur.grid)
    const note = cur.notes.find((n) => n.tick === tick && n.pitch === pitch)
    return note
      ? { on: true, velocity: note.velocity, noteId: note.id }
      : { on: false, velocity: 0.7 }
  }

  const setCell = (pitch: number, step: number, on: boolean) => {
    const cur = cellOf(pitch, step)
    if (!cur || cur.on === on) return // already in target state — no churn
    store.dispatch({ t: "toggleStep", trackId, step, pitch, velocity: 0.78 })
  }

  const clearLongTimer = () => {
    if (longTimer.current) {
      clearTimeout(longTimer.current)
      longTimer.current = null
    }
  }

  const onCellDown = (pitch: number, step: number) => {
    const cur = cellOf(pitch, step)
    const isOn = !!cur?.on
    paintMode.current = isOn ? "remove" : "add"
    touched.current = new Set([`${pitch}:${step}`])
    setCell(pitch, step, !isOn)
    host.previewTrack(trackId, 0.85)

    // Long-press an existing note ⇒ select it for velocity editing instead of
    // toggling it off. We pre-armed "remove"; if the long-press fires we undo
    // the (not-yet-applied) erase by re-adding and selecting.
    if (isOn && cur?.noteId) {
      const noteId = cur.noteId
      clearLongTimer()
      longTimer.current = setTimeout(() => {
        paintMode.current = null
        // Re-light the note we just removed and select it.
        const exists = findTrack(store.vanilla.getState().doc, trackId)
        if (exists && isInstrumentTrack(exists)) {
          const tick = tickForStep(step, exists.grid)
          if (!exists.notes.some((n) => n.tick === tick && n.pitch === pitch)) {
            store.dispatch({ t: "toggleStep", trackId, step, pitch, velocity: cur.velocity })
          }
        }
        const reAdded = findTrack(store.vanilla.getState().doc, trackId)
        const tick = tickForStep(step, exists?.grid ?? track.grid)
        const note =
          reAdded && isInstrumentTrack(reAdded)
            ? reAdded.notes.find((n) => n.tick === tick && n.pitch === pitch)
            : undefined
        setSelectedNoteId(note?.id ?? noteId)
        host.toast(`${pitchLabel(pitch)} selected`, undefined)
      }, LONG_PRESS_MS)
    }
  }

  const onCellEnter = (pitch: number, step: number) => {
    if (!paintMode.current) return
    clearLongTimer()
    const key = `${pitch}:${step}`
    if (touched.current.has(key)) return
    touched.current.add(key)
    setCell(pitch, step, paintMode.current === "add")
  }

  const endStroke = () => {
    clearLongTimer()
    paintMode.current = null
    touched.current.clear()
  }

  const stepsPerBeat = view.stepsPerBeat
  const anySolo = doc.tracks.some((t) => t.solo)
  const silent = track.mute || (anySolo && !track.solo)

  const shiftWindow = (delta: number) => {
    setLow((prev) => {
      const base = prev ?? low
      return Math.max(0, Math.min(127 - (ROW_SPAN - 1), base + delta))
    })
  }

  const selectedNote =
    selectedNoteId != null ? track.notes.find((n) => n.id === selectedNoteId) : undefined

  return (
    <div className="bl-roll" onPointerUp={endStroke} onPointerLeave={endStroke}>
      <div className="bl-grid-toolbar" data-bl-nocapture>
        <div className="bl-grid-title">
          <span className="bl-dot" style={{ background: track.color }} />
          {track.name}
        </div>
        <div className="bl-grid-actions">
          <button
            type="button"
            className="bl-chip"
            onClick={() => {
              const r = runAction(store, arpeggiateAction, { doc, targetTrackId: trackId })
              host.toast(r.summary, undefined)
            }}
          >
            Arpeggiate
          </button>
          <button
            type="button"
            className="bl-chip"
            onClick={() => {
              const before = store.vanilla.getState().doc
              const r = runAction(store, transposeAction, {
                doc,
                targetTrackId: trackId,
              })
              if (r.commands.length)
                host.toast(r.summary, {
                  undo: () => store.vanilla.getState().doc !== before && store.undo(),
                })
            }}
          >
            Octave Up
          </button>
          <button
            type="button"
            className="bl-chip is-danger"
            onClick={() => {
              const before = store.vanilla.getState().doc
              const r = runAction(store, clearAction, { doc, targetTrackId: trackId })
              if (r.commands.length) {
                setSelectedNoteId(null)
                host.toast(r.summary, {
                  undo: () => store.vanilla.getState().doc !== before && store.undo(),
                })
              }
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="bl-roll-frame">
        <div className="bl-roll-octave" data-bl-nocapture>
          <button
            type="button"
            className="bl-icon-btn"
            aria-label="Shift window up an octave"
            onClick={() => shiftWindow(12)}
          >
            ▲
          </button>
          <button
            type="button"
            className="bl-icon-btn"
            aria-label="Shift window down an octave"
            onClick={() => shiftWindow(-12)}
          >
            ▼
          </button>
        </div>

        <div
          className={`bl-roll-grid${silent ? " is-silent" : ""}`}
          style={{ ["--bl-steps" as string]: String(view.steps) }}
        >
          {view.rows.map((row, r) => (
            <div
              className={
                "bl-roll-row" +
                (row.inScale ? " is-scale" : "") +
                (row.accidental ? " is-accidental" : "") +
                (row.tonic ? " is-tonic" : "")
              }
              key={row.pitch}
              role="row"
            >
              <span className="bl-roll-key" data-bl-nocapture aria-hidden="true">
                {row.tonic ? row.label : ""}
              </span>
              <div className="bl-roll-cells">
                {view.cells[r].map((cell, s) => (
                  <button
                    key={s}
                    type="button"
                    role="gridcell"
                    aria-pressed={cell.on}
                    aria-label={`${row.label} step ${s + 1}`}
                    className={
                      "bl-roll-cell" +
                      (cell.on ? " is-on" : "") +
                      (s === playStep ? " is-active" : "") +
                      (s % stepsPerBeat === 0 ? " is-beat" : "") +
                      (cell.noteId === selectedNoteId && cell.on ? " is-selected" : "")
                    }
                    data-bl-nocapture
                    style={
                      cell.on
                        ? ({ "--bl-cell-vel": String(0.4 + cell.velocity * 0.6) } as React.CSSProperties)
                        : undefined
                    }
                    onPointerDown={(e) => {
                      if (e.button != null && e.button > 0) return
                      onCellDown(row.pitch, s)
                    }}
                    onPointerEnter={(e) => {
                      if (e.buttons & 1) onCellEnter(row.pitch, s)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bl-grid-foot" data-bl-nocapture>
        {selectedNote ? (
          <Knob
            label="Velocity"
            value={selectedNote.velocity}
            min={0.05}
            max={1}
            step={0.01}
            defaultValue={0.78}
            format={(v) => `${Math.round(v * 100)}`}
            onChange={(v) =>
              store.dispatch({
                t: "editNote",
                trackId,
                noteId: selectedNote.id,
                patch: { velocity: v },
              })
            }
          />
        ) : (
          <span className="bl-roll-hint">Long-press a note to set velocity</span>
        )}
        <Knob
          label="Volume"
          value={track.volume}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.7}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) =>
            store.dispatch({ t: "setTrackProp", trackId, prop: "volume", value: v })
          }
        />
        <Knob
          label="Pan"
          value={track.pan}
          min={-1}
          max={1}
          step={0.02}
          defaultValue={0}
          format={(v) => (v === 0 ? "C" : `${v > 0 ? "R" : "L"}${Math.round(Math.abs(v) * 100)}`)}
          onChange={(v) =>
            store.dispatch({ t: "setTrackProp", trackId, prop: "pan", value: v })
          }
        />
      </div>
    </div>
  )
}

/** Read whether the (pitch, step) cell is lit — used by tests/inspection. */
export const rollCellOn = (track: InstrumentTrack, pitch: number, step: number): boolean => {
  const tick = tickForStep(step, track.grid)
  return track.notes.some((n) => n.tick === tick && n.pitch === pitch)
}
