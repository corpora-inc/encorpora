/**
 * beatlounge — the step-grid IMMERSIVE view: a full interactive drum sequencer.
 *
 * One row per drum pitch lane (kick / snare / hat / clap). Tap-to-toggle cells
 * dispatch `toggleStep`; a single pointer stroke paints/erases across cells
 * (the stroke's first cell sets the paint mode). The live playhead column is
 * highlighted from `audio.onPlayhead`. Per-row mute / solo + volume act on the
 * track (drum lanes share one track, so row controls map to the track; the
 * per-lane affordance is reserved for when lanes become sub-tracks). The two
 * registry actions (clear / fill) are wired to header buttons.
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
import { Knob, MuteSolo, StepCell } from "../../bl-ui"
import { buildGridView } from "./gridModel"
import { clearAction, fillEveryOtherAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

export const StepGridImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)
  // Paint stroke state: "add" | "remove" | null, plus the touched-cell guard.
  const paintMode = useRef<null | "add" | "remove">(null)
  const touched = useRef(new Set<string>())

  // Live playhead → current step on this track's grid.
  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      if (tick < 0 || !t) {
        setPlayStep(-1)
        return
      }
      setPlayStep(stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  const view = useMemo(
    () => (track && isInstrumentTrack(track) ? buildGridView(doc, track) : null),
    [doc, track]
  )

  if (!track || !isInstrumentTrack(track) || !view) {
    return <div className="bl-grid-empty">No drum track.</div>
  }

  const setStep = (pitch: number, step: number, on: boolean) => {
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur)) return
    const isOn = cellOn(cur, pitch, step)
    if (on === isOn) return // already in target state — no churn
    store.dispatch({ t: "toggleStep", trackId, step, pitch, velocity: 0.9 })
  }

  const onCellDown = (pitch: number, step: number) => {
    const isOn = cellOn(track, pitch, step)
    paintMode.current = isOn ? "remove" : "add"
    touched.current = new Set([`${pitch}:${step}`])
    setStep(pitch, step, !isOn)
  }

  const onCellEnter = (pitch: number, step: number) => {
    if (!paintMode.current) return
    const key = `${pitch}:${step}`
    if (touched.current.has(key)) return
    touched.current.add(key)
    setStep(pitch, step, paintMode.current === "add")
  }

  const endStroke = () => {
    paintMode.current = null
    touched.current.clear()
  }

  const stepsPerBeat = view.stepsPerBeat
  const anySolo = doc.tracks.some((t) => t.solo)

  return (
    <div className="bl-grid" onPointerUp={endStroke} onPointerLeave={endStroke}>
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
              const r = runAction(store, fillEveryOtherAction, { doc, targetTrackId: trackId })
              host.toast(r.summary, undefined)
            }}
          >
            {fillEveryOtherAction.describe.replace(/\.$/, "")}
          </button>
          <button
            type="button"
            className="bl-chip is-danger"
            onClick={() => {
              const before = store.vanilla.getState().doc
              const r = runAction(store, clearAction, { doc, targetTrackId: trackId })
              if (r.commands.length) {
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

      <div
        className="bl-grid-body"
        style={{ ["--bl-steps" as string]: String(view.steps) }}
      >
        {view.lanes.map((lane) => (
          <div className="bl-lane" key={lane.pitch}>
            <div className="bl-lane-head" data-bl-nocapture>
              <span className="bl-lane-name">{lane.label}</span>
              <MuteSolo
                compact
                mute={track.mute}
                solo={track.solo}
                onMute={() =>
                  store.dispatch({
                    t: "setTrackProp",
                    trackId,
                    prop: "mute",
                    value: !track.mute,
                  })
                }
                onSolo={() =>
                  store.dispatch({
                    t: "setTrackProp",
                    trackId,
                    prop: "solo",
                    value: !track.solo,
                  })
                }
              />
            </div>
            <div
              className={`bl-lane-cells${
                (track.mute || (anySolo && !track.solo)) ? " is-silent" : ""
              }`}
              role="row"
            >
              {lane.cells.map((cell, s) => (
                <StepCell
                  key={s}
                  on={cell.on}
                  velocity={cell.velocity}
                  active={s === playStep}
                  beat={s % stepsPerBeat === 0}
                  label={`${lane.label} step ${s + 1}`}
                  onCellDown={() => onCellDown(lane.pitch, s)}
                  onCellEnter={() => onCellEnter(lane.pitch, s)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bl-grid-foot" data-bl-nocapture>
        <Knob
          label="Volume"
          value={track.volume}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
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

/** Is the (pitch, step) cell currently lit? Uses the reducer's tick mapping. */
const cellOn = (track: InstrumentTrack, pitch: number, step: number): boolean => {
  const tick = tickForStep(step, track.grid)
  return track.notes.some((n) => n.tick === tick && n.pitch === pitch)
}
