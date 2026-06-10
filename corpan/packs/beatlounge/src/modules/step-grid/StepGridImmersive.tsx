/**
 * beatlounge — the DRUMS PAGE: a complete, self-contained drum studio.
 *
 * THE STEP GRID is the hero (one row per kit voice, kick → snare → … →
 * percussion). Its lane HEADS are SELECTABLE: tap a head to toggle it, and the
 * selection re-points whatever groove you apply (the "groove targeting"
 * feature — 0 selected = whole kit, 1 = collapse onto that voice, N = spread
 * across them). Selection is local UI state — it never writes the doc.
 *
 * THE WHOLE DRUM-TRACK PIPELINE lives in a single BOTTOM DRAWER that slides up
 * over the grid — no destination-hopping. The drawer is full-width (so Grooves
 * finally has room to breathe) with four tabs:
 *   • Grooves — the shared <GroovesPanel>, driven by the lane selection above.
 *   • Kit     — the <KitPicker> (the drum-kit corpus: 18 kits across families).
 *   • Effects — the drum bus <TrackFxChain> (realtime applyParam wiring intact).
 *   • Mixer   — the drum track's level / pan / mute / solo.
 *
 * The drawer has a drag handle and three states — peek (just the handle + tab
 * bar), open (default working height) and expanded (taller, for the iPad).
 * Drag the handle or tap it to cycle; on a big screen "expanded" simply uses the
 * width + more height. It lives INSIDE this module's container (never
 * document.body), respects the one z-scale + safe-area insets, and honors
 * prefers-reduced-motion. When peeked, the grid gets the full screen.
 *
 * Applying a groove, picking a kit or editing FX only WRITES the doc — playback
 * is never auto-started ("setup, don't play"). Selecting lanes is pure UI.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent } from "react"
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
import { Fader, MuteSolo, StepCell, Transport } from "../../bl-ui"
import { TrackParamKnob } from "../TrackParamKnob"
import { GroovesPanel } from "../grooves/GroovesPanel"
import { TrackFxChain } from "../fx-rack/TrackFxChain"
import { KitPicker } from "../../kits/KitPicker"
import { buildGridView } from "./gridModel"
import { clearAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

type DrawerTab = "grooves" | "kit" | "fx" | "mixer"
/** peek = handle + tabs only (grid full-height); open = working height;
 *  expanded = taller (uses the extra height on a big iPad). */
type DrawerState = "peek" | "open" | "expanded"

const TAB_LABELS: Record<DrawerTab, string> = {
  grooves: "Grooves",
  kit: "Kit",
  fx: "Effects",
  mixer: "Mixer",
}

export const StepGridImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)
  const [playing, setPlaying] = useState(audio.isPlaying())
  const [tab, setTab] = useState<DrawerTab>("grooves")
  const [drawer, setDrawer] = useState<DrawerState>("open")
  // Lane-head selection (kit pitches). Local UI only — drives groove targeting.
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
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

  // The selected pitches + their labels, in grid (musical) order, for targeting.
  const targets = useMemo(() => {
    if (!view) return { pitches: [] as number[], labels: [] as string[] }
    const pitches: number[] = []
    const labels: string[] = []
    for (const lane of view.lanes) {
      if (selected.has(lane.pitch)) {
        pitches.push(lane.pitch)
        labels.push(lane.label)
      }
    }
    return { pitches, labels }
  }, [view, selected])

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

  const toggleLane = (pitch: number) => {
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(pitch)) next.delete(pitch)
      else next.add(pitch)
      return next
    })
  }
  const clearSelection = () => setSelected(new Set())

  // Global transport — drives the whole song (not just this track), surfaced
  // here in the header so you can audition grooves without leaving Drums.
  const toggleTransport = () => {
    if (audio.isPlaying()) {
      audio.stop()
      setPlaying(false)
    } else {
      void audio
        .start()
        .then(() => setPlaying(true))
        .catch((err) => console.warn("[beatlounge/drums] transport start failed:", err))
    }
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

  const openTab = (next: DrawerTab) => {
    setTab(next)
    // Opening a tab from peek brings the drawer up to its working height.
    setDrawer((d) => (d === "peek" ? "open" : d))
  }

  return (
    <div className={`bl-drums bl-drums--${drawer}`}>
      {/* ---- the step grid (primary canvas) ---- */}
      <section
        className="bl-drums-grid bl-grid"
        onPointerUp={endStroke}
        onPointerLeave={endStroke}
      >
        <div className="bl-grid-toolbar" data-bl-nocapture>
          <div className="bl-grid-title">
            <Transport playing={playing} onToggle={toggleTransport} spaceToToggle />
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

        {/* Selection status line — only present while lanes are selected. */}
        {targets.pitches.length > 0 && (
          <div className="bl-drums-selbar" data-bl-nocapture role="status">
            <span className="bl-drums-selbar-text">
              {targets.pitches.length === 1
                ? `Grooves play on ${targets.labels[0]}`
                : `Grooves spread across ${targets.pitches.length}: ${targets.labels.join(", ")}`}
            </span>
            <button
              type="button"
              className="bl-drums-selbar-clear"
              onClick={clearSelection}
            >
              Clear selection
            </button>
          </div>
        )}

        <div
          className="bl-grid-scroll"
          style={{ ["--bl-steps" as string]: String(view.steps) }}
        >
          <div className="bl-grid-body">
            {view.lanes.map((lane) => {
              const isSel = selected.has(lane.pitch)
              return (
                <div className={`bl-lane${isSel ? " is-selected" : ""}`} key={lane.pitch}>
                  <button
                    type="button"
                    className={`bl-lane-head${isSel ? " is-selected" : ""}`}
                    data-bl-nocapture
                    aria-pressed={isSel}
                    title={
                      isSel
                        ? `${lane.label} selected — grooves target this voice`
                        : `Select ${lane.label} to target grooves at it`
                    }
                    onClick={() => toggleLane(lane.pitch)}
                  >
                    <span className="bl-lane-sel" aria-hidden="true">
                      {isSel ? <SelOnGlyph /> : <SelOffGlyph />}
                    </span>
                    <span className="bl-lane-name">{lane.label}</span>
                  </button>
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
              )
            })}
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

      {/* ---- the PIPELINE DRAWER (Grooves / Kit / Effects / Mixer) ---- */}
      <PipelineDrawer
        state={drawer}
        setState={setDrawer}
        tab={tab}
        onTab={openTab}
      >
        {tab === "grooves" && (
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
        )}
        {tab === "kit" && (
          <div className="bl-drums-drawer-pad">
            <KitPicker host={host} store={store} trackId={trackId} />
          </div>
        )}
        {tab === "fx" && <TrackFxChain host={host} store={store} trackId={trackId} />}
        {tab === "mixer" && (
          <DrumMixer host={host} store={store} track={track} anySolo={anySolo} />
        )}
      </PipelineDrawer>
    </div>
  )
}

// ----------------------------------------------------------------- the drawer
/**
 * The bottom drawer: a draggable handle + a tab bar + the active section body.
 * Lives inside the drums container (never document.body). Drag the handle (or
 * tap it) to cycle peek → open → expanded. prefers-reduced-motion is honored by
 * CSS (the transition is dropped; the height still snaps).
 */
const PipelineDrawer = ({
  state,
  setState,
  tab,
  onTab,
  children,
}: {
  state: DrawerState
  setState: (s: DrawerState) => void
  tab: DrawerTab
  onTab: (t: DrawerTab) => void
  children: ReactNode
}) => {
  // Drag the handle vertically to change state. We track total dy and snap on
  // release; a tap (tiny dy) cycles to the next state.
  const dragStart = useRef<number | null>(null)
  const dragMoved = useRef(0)

  const cycle = () => {
    // peek → open → expanded → peek
    setState(state === "peek" ? "open" : state === "open" ? "expanded" : "peek")
  }

  const onHandleDown = (e: PointerEvent) => {
    dragStart.current = e.clientY
    dragMoved.current = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onHandleMove = (e: PointerEvent) => {
    if (dragStart.current == null) return
    dragMoved.current = e.clientY - dragStart.current
  }
  const onHandleUp = (e: PointerEvent) => {
    if (dragStart.current == null) return
    const dy = dragMoved.current
    dragStart.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    const THRESH = 28 // px — beyond this is a drag, not a tap
    if (dy < -THRESH) {
      // dragged UP → grow
      setState(state === "peek" ? "open" : "expanded")
    } else if (dy > THRESH) {
      // dragged DOWN → shrink
      setState(state === "expanded" ? "open" : "peek")
    } else {
      cycle() // a tap cycles
    }
  }

  return (
    <section
      className={`bl-drums-drawer is-${state}`}
      aria-label="Drum track pipeline"
    >
      <div
        className="bl-drums-handle"
        data-bl-nocapture
        role="button"
        tabIndex={0}
        aria-label={
          state === "peek"
            ? "Open drum pipeline drawer"
            : state === "open"
              ? "Expand drum pipeline drawer"
              : "Collapse drum pipeline drawer"
        }
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            cycle()
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setState(state === "peek" ? "open" : "expanded")
          } else if (e.key === "ArrowDown") {
            e.preventDefault()
            setState(state === "expanded" ? "open" : "peek")
          }
        }}
      >
        <span className="bl-drums-handle-grip" aria-hidden="true" />
      </div>

      <div className="bl-drums-drawer-tabs" data-bl-nocapture role="tablist" aria-label="Drum tools">
        {(Object.keys(TAB_LABELS) as DrawerTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`bl-drums-tab${tab === t ? " is-on" : ""}`}
            onClick={() => onTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {state !== "peek" && (
        <div className="bl-drums-drawer-body">{children}</div>
      )}
    </section>
  )
}

// ----------------------------------------------------------------- drum mixer
/**
 * A compact mixer strip for the drum track: level fader (realtime via
 * host.applyParam, persisted on release), pan knob, and mute/solo. Dispatches
 * through the existing commands only.
 */
const DrumMixer = ({
  host,
  store,
  track,
  anySolo,
}: {
  host: BeatloungeHost
  store: BeatloungeStore
  track: InstrumentTrack
  anySolo: boolean
}) => {
  const [liveVol, setLiveVol] = useState<number | null>(null)
  const silent = track.mute || (anySolo && !track.solo)

  return (
    <div className="bl-drums-mixer" data-bl-nocapture>
      <div className={`bl-drums-strip${silent ? " is-silent" : ""}`}>
        <span className="bl-drums-strip-name">
          <span className="bl-dot" style={{ background: track.color }} />
          {track.name}
        </span>
        <Fader
          label="Level"
          value={liveVol ?? track.volume}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
          orientation="vertical"
          length={150}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => {
            setLiveVol(v)
            host.applyParam({ scope: "track", trackId: track.id, param: "volume" }, v)
          }}
          onCommit={(v) => {
            setLiveVol(null)
            store.dispatch({ t: "setTrackProp", trackId: track.id, prop: "volume", value: v })
          }}
        />
        <div className="bl-drums-strip-pan">
          <TrackParamKnob host={host} store={store} trackId={track.id} param="pan" value={track.pan} />
        </div>
        <MuteSolo
          mute={track.mute}
          solo={track.solo}
          onMute={() =>
            store.dispatch({ t: "setTrackProp", trackId: track.id, prop: "mute", value: !track.mute })
          }
          onSolo={() =>
            store.dispatch({ t: "setTrackProp", trackId: track.id, prop: "solo", value: !track.solo })
          }
        />
      </div>
      <p className="bl-drums-mixer-hint">
        The full mixer (all tracks + sends) lives on the Mix page; this controls
        the drum bus right here.
      </p>
    </div>
  )
}

// ----------------------------------------------------------------- glyphs (no emoji)
const SelOnGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" />
    <path
      d="M7 12.5l3 3L17 8.5"
      stroke="var(--bl-bg, #06080d)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)
const SelOffGlyph = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect
      x="3.5"
      y="3.5"
      width="17"
      height="17"
      rx="4.5"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
)

/** Is the (pitch, step) cell currently lit? Uses the reducer's tick mapping. */
const cellOn = (track: InstrumentTrack, pitch: number, step: number): boolean => {
  const tick = tickForStep(step, track.grid)
  return track.notes.some((n) => n.tick === tick && n.pitch === pitch)
}
