/**
 * beatlounge — the DRUMS PAGE: a complete, self-contained drum studio.
 *
 * THREE things live here, no destination-hopping:
 *   1. The FULL-KIT step sequencer (primary canvas) — one row per kit voice
 *      (kick → snare → rim → clap → hats → cymbals → toms → percussion), so
 *      every voice a groove can populate is visible + editable. The lane stack
 *      scrolls vertically inside a fixed-height region; the playhead column,
 *      cell hit-testing and the paint-stroke all keep working while it scrolls.
 *   2. GROOVES — the shared <GroovesPanel>: browse world rhythms by family and
 *      Apply / Layer / Vary / Evolve / Randomize them while WATCHING the live
 *      grid update (no leaving the screen).
 *   3. EFFECTS — the shared <TrackFxChain> for the drum bus: add/remove/tweak
 *      the drum track's insert chain (with the realtime param wiring intact).
 *
 * RESPONSIVE IA (no clip, ~300px → big iPad/desktop):
 *   • phone / narrow: the grid is the top region (its own scroll); a segmented
 *     control (Grooves · Effects) reveals an in-screen panel BELOW it that the
 *     user can collapse — the grid stays in view so groove changes are visible.
 *   • tablet / desktop: the grid is the main column and Grooves/Effects sit in
 *     a side panel (tabbed) using the extra width — two columns, both scroll
 *     within fixed heights (`overflow: hidden auto`), nothing clips.
 *
 * Applying a groove or editing FX only WRITES the doc — playback is never
 * auto-started ("setup, don't play").
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
import { MuteSolo, StepCell } from "../../bl-ui"
import { TrackParamKnob } from "../TrackParamKnob"
import { GroovesPanel } from "../grooves/GroovesPanel"
import { TrackFxChain } from "../fx-rack/TrackFxChain"
import { buildGridView } from "./gridModel"
import { clearAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

type PanelTab = "grooves" | "fx"

export const StepGridImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)
  const [panel, setPanel] = useState<PanelTab>("grooves")
  // Phone: the panel below the grid can be collapsed so the grid is full-height.
  const [panelOpen, setPanelOpen] = useState(true)
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

  const clearGrid = () => {
    const before = store.vanilla.getState().doc
    const r = runAction(store, clearAction, { doc, targetTrackId: trackId })
    if (r.commands.length) {
      host.toast(r.summary, {
        undo: () => store.vanilla.getState().doc !== before && store.undo(),
      })
    }
  }

  return (
    <div className="bl-drums">
      {/* ---- the step grid (primary canvas) ---- */}
      <section
        className="bl-drums-grid bl-grid"
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
      >
        <div className="bl-grid-toolbar" data-bl-nocapture>
          <div className="bl-grid-title">
            <span className="bl-dot" style={{ background: track.color }} />
            {track.name}
          </div>
          <div className="bl-grid-actions">
            <TrackParamKnob host={host} store={store} trackId={trackId} param="volume" value={track.volume} />
            <TrackParamKnob host={host} store={store} trackId={trackId} param="pan" value={track.pan} />
            <button type="button" className="bl-chip is-danger" onClick={clearGrid}>
              Clear
            </button>
          </div>
        </div>

        <div
          className="bl-grid-scroll"
          style={{ ["--bl-steps" as string]: String(view.steps) }}
        >
          <div className="bl-grid-body">
            {view.lanes.map((lane) => (
              <div className="bl-lane" key={lane.pitch}>
                <div className="bl-lane-head" data-bl-nocapture>
                  <span className="bl-lane-name">{lane.label}</span>
                </div>
                <div
                  className={`bl-lane-cells${
                    track.mute || (anySolo && !track.solo) ? " is-silent" : ""
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
        </div>

        <div className="bl-grid-foot" data-bl-nocapture>
          <MuteSolo
            mute={track.mute}
            solo={track.solo}
            onMute={() =>
              store.dispatch({ t: "setTrackProp", trackId, prop: "mute", value: !track.mute })
            }
            onSolo={() =>
              store.dispatch({ t: "setTrackProp", trackId, prop: "solo", value: !track.solo })
            }
          />
        </div>
      </section>

      {/* ---- Grooves / Effects, in-screen (side panel on wide, sheet on phone) ---- */}
      <section className={`bl-drums-panel${panelOpen ? " is-open" : ""}`}>
        <div className="bl-drums-tabs" data-bl-nocapture role="tablist" aria-label="Drum tools">
          <button
            type="button"
            role="tab"
            aria-selected={panel === "grooves"}
            className={`bl-drums-tab${panel === "grooves" ? " is-on" : ""}`}
            onClick={() => {
              setPanel("grooves")
              setPanelOpen(true)
            }}
          >
            Grooves
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={panel === "fx"}
            className={`bl-drums-tab${panel === "fx" ? " is-on" : ""}`}
            onClick={() => {
              setPanel("fx")
              setPanelOpen(true)
            }}
          >
            Effects
          </button>
          {/* Phone-only collapse toggle so the grid can take the full screen. */}
          <button
            type="button"
            className="bl-drums-collapse"
            aria-expanded={panelOpen}
            aria-label={panelOpen ? "Collapse panel" : "Expand panel"}
            onClick={() => setPanelOpen((v) => !v)}
          >
            {panelOpen ? "Hide" : "Show"}
          </button>
        </div>

        <div className="bl-drums-panel-body">
          {panel === "grooves" ? (
            <GroovesPanel store={store} host={host} variant="embedded" />
          ) : (
            <TrackFxChain host={host} store={store} trackId={trackId} />
          )}
        </div>
      </section>
    </div>
  )
}

/** Is the (pitch, step) cell currently lit? Uses the reducer's tick mapping. */
const cellOn = (track: InstrumentTrack, pitch: number, step: number): boolean => {
  const tick = tickForStep(step, track.grid)
  return track.notes.some((n) => n.tick === tick && n.pitch === pitch)
}
