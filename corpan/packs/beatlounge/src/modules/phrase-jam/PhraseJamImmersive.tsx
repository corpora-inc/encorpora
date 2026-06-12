/**
 * beatlounge — the PHRASE JAM page: a complete phrase-snippet studio that
 * MIRRORS the Drums page. Same shape, different content (spoken phrases, not
 * drum voices) — so the two pages can't drift.
 *
 *   • HEADER — global transport (play/stop) + a tiny Clear (vol/pan/mute/solo
 *     live in the Mixer drawer now), exactly
 *     like Drums. (No Scramble, no Grooves toggle — Scatter lives in the drawer.)
 *   • TOP RIBBON — a continuous FREE SLIDE above the grid that bends the WHOLE
 *     phrase track's pitch live while you play (via host.applyParam pitchOffset).
 *     No scales, no keys, no semitone/cents readout — just low → high. It snaps
 *     back to centre on release and writes NOTHING to the doc.
 *   • GRID — the shared <LaneGrid>: one SELECTABLE row per saved bank snippet
 *     (doc.fragmentLibrary). Tap a cell to place / clear that snippet on the
 *     beat; tap a lane head to target it for groove scatter. No per-snippet pitch
 *     — phrases are spoken sounds, not notes.
 *   • DRAWER — the shared <TrackDrawer>: Grooves (the shared <GroovesPanel>
 *     scattering the bank onto a rhythm) · Effects (<TrackFxChain>) · Mixer (the
 *     shared <TrackMixer>). No Kit tab — phrases have no drum kit.
 *
 * Placing / scattering only WRITES the grid; it never auto-plays. The ribbon
 * bends only during live playback ("setup, don't play").
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import {
  findTrack,
  isFragmentTrack,
  type FragmentTrack,
  type Id,
} from "../../model/document"
import { stepForTick, tickForStep } from "../../model/timing"
import { bankSnippets } from "../../phrase/bank"
import type { AudioSource } from "../../phrase/audioSource"
import { Glyph } from "../../bl-ui"
import { useTransport } from "../../store/transport"
import { ClearButton } from "../_shared/ClearButton"
import {
  HeaderStatusLine,
  useHeaderStatus,
  withHeaderToast,
} from "../_shared/HeaderStatus"
import { GroovesPanel } from "../grooves/GroovesPanel"
import { TrackFxChain } from "../fx-rack/TrackFxChain"
import { LaneGrid, type LaneGridLane } from "../track-studio/LaneGrid"
import { TrackDrawer, type DrawerState, type DrawerTabDef } from "../track-studio/TrackDrawer"
import { TrackMixer } from "../track-studio/TrackMixer"
import "../track-studio/track-studio.css"
import { buildJamView, cellEventAt } from "./jamModel"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  audioSource: AudioSource
  trackId: Id
}

/** The free-slide ribbon spans this many semitones either side of centre — a
 *  ±1.5-octave bend (halved from ±3): the extreme top/bottom were rarely useful
 *  and ate the precision in the middle, so the range is shaved aggressively to
 *  give far more control around the natural pitch. NEVER surfaces in the UI; the
 *  ribbon shows only a smooth low → high slide. The engine clamps internally. */
const RIBBON_SPAN = 18
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const PhraseJamImmersive = ({
  host,
  store,
  audio,
  audioSource: _audioSource,
  trackId,
}: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const bank = bankSnippets(doc)

  const [playStep, setPlayStep] = useState(-1)
  // Read the ONE global transport flag for the ribbon hint copy — no local copy.
  const { isPlaying: playing } = useTransport(audio)
  const [tab, setTab] = useState<string>("grooves")
  const [drawer, setDrawer] = useState<DrawerState>("open")

  // Inline streaming status — toasts type out in the header by the track light
  // instead of floating over the controls. `localHost` routes every child toast.
  const status = useHeaderStatus()
  const localHost = useMemo(
    () => withHeaderToast(host, status.notify),
    [host, status.notify]
  )
  // Lane-head selection (snippet ids). Local UI only — drives groove targeting.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  // Ribbon drag state.
  const ribbonRef = useRef<HTMLDivElement | null>(null)
  const dragging = useRef(false)

  // Live playhead → step on this track's grid.
  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  const view = useMemo(
    () =>
      track && isFragmentTrack(track) ? buildJamView(doc, track, bank) : null,
    [doc, track, bank]
  )

  const anySolo = doc.tracks.some((t) => t.solo)

  // ---- live free-slide ribbon (declared before any early return so hooks are
  //      unconditional; the handlers no-op until the ribbon is mounted) --------
  const applyBend = (semis: number) => {
    host.applyParam({ scope: "instrument", trackId, param: "pitchOffset" }, semis)
  }
  // Safety: drop the bend if we unmount mid-drag so the track doesn't stay bent.
  useEffect(() => {
    return () => {
      if (dragging.current) applyBend(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!track || !isFragmentTrack(track)) {
    return <div className="bl-grid-empty">No phrase track.</div>
  }
  const ftrack: FragmentTrack = track
  const silent = ftrack.mute || (anySolo && !ftrack.solo)

  // Empty bank → calm pointer to the Phrases (discovery) screen.
  if (!view || view.lanes.length === 0) {
    return (
      <div className="bl-jam bl-trackpage">
        <div className="bl-grid-toolbar" data-bl-nocapture>
          <div className="bl-grid-title">
            <span className="bl-dot" style={{ background: ftrack.color }} />
          </div>
        </div>
        <div className="bl-jam-empty">
          <Glyph name="wave" size={28} />
          <p className="bl-jam-empty-title">No snippets yet</p>
          <p className="bl-jam-empty-sub">
            Open <strong>Phrases</strong> to save some.
          </p>
        </div>
      </div>
    )
  }

  // ---- the shared LaneGrid's lane shape (snippets keyed by snippet id) -------
  const lanes: LaneGridLane[] = view.lanes.map((lane) => ({
    key: lane.ref.id,
    selectKey: lane.ref.id,
    label: lane.label,
    title: lane.ref.text ?? undefined,
    badge: lane.langTag ? (
      <span className="bl-lane-badge">{lane.langTag}</span>
    ) : undefined,
    cells: lane.cells.map((c) => ({ on: c.on, velocity: c.gain })),
  }))

  // ---- grid cell place / clear (default pitch 0 — no per-snippet pitch) ------
  const isCellOn = (laneIndex: number, step: number): boolean =>
    view.lanes[laneIndex]?.cells[step]?.on ?? false

  const setCell = (laneIndex: number, step: number, on: boolean) => {
    const lane = view.lanes[laneIndex]
    if (!lane) return
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isFragmentTrack(cur)) return
    const existing = cellEventAt(cur, lane.ref.id, step)
    if (on && !existing) {
      store.dispatch({
        t: "placeFragment",
        trackId,
        frag: {
          tick: tickForStep(step, cur.grid),
          fragmentId: lane.ref.id,
          gain: 0.9,
          pitchSemis: 0, // phrases are spoken sounds, not notes — always centre
        },
      })
    } else if (!on && existing) {
      store.dispatch({ t: "removeFragment", trackId, fragId: existing.id })
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

  // ---- the free-slide ribbon: x → a continuous bend, no scale, no snapping ---
  const semisFromX = (clientX: number): number => {
    const el = ribbonRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const x = clamp01((clientX - r.left) / Math.max(1, r.width))
    // Continuous: 0 at left → +SPAN at right, centre = 0. No rounding to a
    // semitone, no scale degrees — a smooth bend the engine reads as a number.
    return (x - 0.5) * 2 * RIBBON_SPAN
  }
  const paintRibbon = (semis: number) => {
    const el = ribbonRef.current
    if (!el) return
    el.style.setProperty("--bl-jam-bend", `${((semis / RIBBON_SPAN) * 50 + 50).toFixed(2)}%`)
    el.style.setProperty("--bl-jam-bend-on", "1")
  }

  const onRibbonDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button > 0) return
    const el = ribbonRef.current
    if (!el) return
    try { el.setPointerCapture(e.pointerId) } catch { /* ignore (tests) */ }
    dragging.current = true
    el.classList.add("is-dragging")
    const semis = semisFromX(e.clientX)
    paintRibbon(semis)
    applyBend(semis)
    e.preventDefault()
  }
  const onRibbonMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const semis = semisFromX(e.clientX)
    paintRibbon(semis)
    applyBend(semis)
  }
  const onRibbonUp = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    const el = ribbonRef.current
    try { el?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    if (el) {
      el.classList.remove("is-dragging")
      // Ease back to centre — a premium snap-to-zero on release.
      el.style.setProperty("--bl-jam-bend", "50%")
      el.style.setProperty("--bl-jam-bend-on", "0")
    }
    applyBend(0)
  }

  const onClear = () => {
    const before = store.vanilla.getState().doc
    if (ftrack.fragments.length === 0) return
    // Lane heads selected → clear ONLY those snippet rows; none → clear all (just
    // like the Drums page).
    if (selected.size > 0) {
      const toRemove = ftrack.fragments.filter((f) => selected.has(f.fragmentId))
      if (toRemove.length === 0) {
        localHost.toast("Those rows are empty")
        return
      }
      store.dispatch({
        t: "batch",
        commands: toRemove.map((f) => ({ t: "removeFragment", trackId, fragId: f.id })),
        label: "Clear rows",
      })
      localHost.toast(`Cleared ${selected.size} row${selected.size === 1 ? "" : "s"}`, {
        undo: () => store.vanilla.getState().doc !== before && store.undo(),
      })
      return
    }
    store.dispatch({ t: "clearTrack", trackId })
    localHost.toast("Cleared the jam", {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
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
          host={localHost}
          variant="embedded"
          target={{ kind: "phrases", trackId, selectedSnippetIds: [...selected] }}
        />
      ),
    },
    {
      id: "fx",
      label: "Effects",
      render: () => <TrackFxChain host={localHost} store={store} trackId={trackId} />,
    },
    {
      id: "mixer",
      label: "Mixer",
      render: () => (
        <TrackMixer
          host={localHost}
          store={store}
          track={ftrack}
          anySolo={anySolo}
        />
      ),
    },
  ]

  return (
    <div className={`bl-jam bl-trackpage bl-jam--${drawer}`}>
      <section className="bl-jam-grid-region bl-trackpage-grid bl-grid">
        {/* ---- header (consistent with Drums) ---- */}
        <div className="bl-grid-toolbar" data-bl-nocapture>
          <div className="bl-grid-title">
            {/* Transport lives once, globally; toasts stream inline by the light. */}
            <span className="bl-dot" style={{ background: ftrack.color }} />
            <HeaderStatusLine ctl={status} />
          </div>
          <div className="bl-grid-actions">
            {/* Volume/Pan/Mute/Solo live in the Mixer drawer — header keeps a tiny Clear. */}
            <ClearButton
              onClear={onClear}
              label={selected.size ? "Clear selected rows" : "Clear"}
            />
          </div>
        </div>

        {/* ---- the free-slide pitch ribbon — at the TOP, above the grid ---- */}
        <div
          ref={ribbonRef}
          className={`bl-jam-ribbon${silent ? " is-silent" : ""}`}
          role="slider"
          aria-label="Pitch bend"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
          aria-valuetext="centre"
          onPointerDown={onRibbonDown}
          onPointerMove={onRibbonMove}
          onPointerUp={onRibbonUp}
          onPointerCancel={onRibbonUp}
        >
          <span className="bl-jam-ribbon-center" aria-hidden="true" />
          <span className="bl-jam-ribbon-thumb" aria-hidden="true" />
          <span className="bl-jam-ribbon-hint" aria-hidden="true">
            {playing ? "Slide to bend the whole phrase" : "Press play, then slide to bend"}
          </span>
        </div>

        {/* ---- the snippet step grid (shared LaneGrid) ---- */}
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
      </section>

      {/* ---- the PIPELINE DRAWER (Grooves / Effects / Mixer) ---- */}
      <TrackDrawer
        label="Phrase track pipeline"
        tabsLabel="Phrase tools"
        tabs={tabs}
        activeTab={tab}
        onTab={openTab}
        state={drawer}
        setState={setDrawer}
      />
    </div>
  )
}
