/**
 * beatlounge — the DRUMS PAGE: a complete, self-contained drum studio.
 *
 * THE STEP GRID is the hero (one row per kit voice, kick → snare → … →
 * percussion). Its lane HEADS are SELECTABLE: tap a head to toggle it, and the
 * selection re-points whatever groove you apply (0 selected = whole kit, 1 =
 * collapse onto that voice, N = spread across them). Selection is local UI state
 * — it never writes the doc. The grid is the shared <LaneGrid>.
 *
 * THE WHOLE DRUM-TRACK PIPELINE lives in a single BOTTOM <TrackDrawer> that
 * slides up over the grid — full-width, four tabs:
 *   • Grooves — the shared <GroovesPanel>, driven by the lane selection above.
 *   • Kit     — the <KitPicker> (the drum-kit corpus).
 *   • Effects — the drum bus <TrackFxChain> (realtime applyParam wiring intact).
 *   • Mixer   — the shared <TrackMixer> (level / pan / mute / solo).
 *
 * Applying a groove, picking a kit or editing FX only WRITES the doc — playback
 * is never auto-started ("setup, don't play"). Selecting lanes is pure UI.
 */

import { useEffect, useMemo, useState } from "react"
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
import { MuteSolo } from "../../bl-ui"
import { TrackParamKnob } from "../TrackParamKnob"
import { GroovesPanel } from "../grooves/GroovesPanel"
import { TrackFxChain } from "../fx-rack/TrackFxChain"
import { KitPicker } from "../../kits/KitPicker"
import { LaneGrid, type LaneGridLane } from "../track-studio/LaneGrid"
import { TrackDrawer, type DrawerState, type DrawerTabDef } from "../track-studio/TrackDrawer"
import { TrackMixer } from "../track-studio/TrackMixer"
import "../track-studio/track-studio.css"
import { buildGridView } from "./gridModel"
import { clearAction } from "./actions"
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
  const [tab, setTab] = useState<string>("grooves")
  const [drawer, setDrawer] = useState<DrawerState>("open")
  // Lane-head selection (kit pitches). Local UI only — drives groove targeting.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

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

  const anySolo = doc.tracks.some((t) => t.solo)
  const silent = !!track && (track.mute || (anySolo && !track.solo))

  // The selected pitches + their labels, in grid (musical) order, for targeting.
  const targets = useMemo(() => {
    if (!view) return { pitches: [] as number[], labels: [] as string[] }
    const pitches: number[] = []
    const labels: string[] = []
    for (const lane of view.lanes) {
      if (selected.has(String(lane.pitch))) {
        pitches.push(lane.pitch)
        labels.push(lane.label)
      }
    }
    return { pitches, labels }
  }, [view, selected])

  // The shared LaneGrid's lane shape (drum pitches keyed by their MIDI number).
  const lanes: LaneGridLane[] = useMemo(
    () =>
      view
        ? view.lanes.map((lane) => ({
            key: String(lane.pitch),
            selectKey: String(lane.pitch),
            label: lane.label,
            cells: lane.cells.map((c) => ({ on: c.on, velocity: c.velocity })),
          }))
        : [],
    [view]
  )

  if (!track || !isInstrumentTrack(track) || !view) {
    return <div className="bl-grid-empty">No drum track.</div>
  }
  const itrack = track

  const isCellOn = (laneIndex: number, step: number): boolean => {
    const lane = view.lanes[laneIndex]
    if (!lane) return false
    return cellOn(itrack, lane.pitch, step)
  }

  const setCell = (laneIndex: number, step: number, on: boolean) => {
    const lane = view.lanes[laneIndex]
    if (!lane) return
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isInstrumentTrack(cur)) return
    const isOn = cellOn(cur, lane.pitch, step)
    if (on === isOn) return // already in target state — no churn
    store.dispatch({ t: "toggleStep", trackId, step, pitch: lane.pitch, velocity: 0.9 })
  }

  const toggleLane = (selectKey: string) => {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(selectKey)) next.delete(selectKey)
      else next.add(selectKey)
      return next
    })
  }

  const clearGrid = () => {
    const before = store.vanilla.getState().doc
    const r = runAction(store, clearAction, { doc, targetTrackId: trackId })
    if (r.commands.length) {
      host.toast(r.summary, {
        undo: () => store.vanilla.getState().doc !== before && store.undo(),
      })
    }
  }

  const openTab = (next: string) => {
    setTab(next)
    setDrawer((d) => (d === "peek" ? "open" : d))
  }

  const tabs: DrawerTabDef[] = [
    {
      id: "grooves",
      label: "Grooves",
      render: () => (
        <GroovesPanel
          store={store}
          host={host}
          variant="embedded"
          target={{
            kind: "drums",
            trackId,
            selectedPitches: targets.pitches,
            laneLabels: targets.labels,
          }}
        />
      ),
    },
    {
      id: "kit",
      label: "Kit",
      render: () => (
        <div className="bl-trackdrawer-pad">
          <KitPicker host={host} store={store} trackId={trackId} />
        </div>
      ),
    },
    {
      id: "fx",
      label: "Effects",
      render: () => <TrackFxChain host={host} store={store} trackId={trackId} />,
    },
    {
      id: "mixer",
      label: "Mixer",
      render: () => (
        <TrackMixer
          host={host}
          store={store}
          track={itrack}
          anySolo={anySolo}
          hint="The full mixer (all tracks + sends) lives on the Mix page; this controls the drum bus right here."
        />
      ),
    },
  ]

  return (
    <div className={`bl-drums bl-trackpage bl-drums--${drawer}`}>
      {/* ---- the step grid (primary canvas) ---- */}
      <section className="bl-drums-grid bl-trackpage-grid bl-grid">
        <div className="bl-grid-toolbar" data-bl-nocapture>
          <div className="bl-grid-title">
            {/* Transport lives once, globally, in the immersive header / Dock-Rail. */}
            <span className="bl-dot" style={{ background: track.color }} />
          </div>
          <div className="bl-grid-actions">
            <TrackParamKnob host={host} store={store} trackId={trackId} param="volume" value={track.volume} />
            <TrackParamKnob host={host} store={store} trackId={trackId} param="pan" value={track.pan} />
            <button type="button" className="bl-chip is-danger" onClick={clearGrid}>
              Clear
            </button>
          </div>
        </div>

        <div className="bl-grid-scroll">
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

      {/* ---- the PIPELINE DRAWER (Grooves / Kit / Effects / Mixer) ---- */}
      <TrackDrawer
        label="Drum track pipeline"
        tabsLabel="Drum tools"
        tabs={tabs}
        activeTab={tab}
        onTab={openTab}
        state={drawer}
        setState={setDrawer}
      />
    </div>
  )
}

/** Is the (pitch, step) cell currently lit? Uses the reducer's tick mapping. */
const cellOn = (track: InstrumentTrack, pitch: number, step: number): boolean => {
  const tick = tickForStep(step, track.grid)
  return track.notes.some((n) => n.tick === tick && n.pitch === pitch)
}
