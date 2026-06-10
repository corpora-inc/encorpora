/**
 * beatlounge — the phrase-JAM IMMERSIVE view: the drum sequencer for SAVED
 * PHRASE SNIPPETS, plus a live pitch RIBBON to perform with.
 *
 *   • GRID — one row per bank snippet (`doc.fragmentLibrary`), columns = the
 *     phrase track's loop steps. Tap a cell to place / clear a snippet on that
 *     beat (`placeFragment` / `removeFragment`), exactly like the drum step grid
 *     (same `tickForStep` mapping, same paint-stroke + playhead column).
 *   • PER-LANE PITCH — a small −12..+12 stepper per row re-pitches that lane's
 *     placed events (`editFragment`) AND sets the default pitch for new cells:
 *     the same word climbing the bar IS the riff.
 *   • LIVE RIBBON — drag horizontally to bend the WHOLE phrase track's pitch in
 *     real time via `host.applyParam({scope:"instrument",trackId,
 *     param:"pitchOffset"}, semis)` — NO document write. Snaps back to 0 on
 *     release. This is the "perform live" headline.
 *   • SCRAMBLE — the registry action, for happy accidents (one undo step).
 *
 * The ribbon uses pointer-capture and OWNS the drag only when the pointer starts
 * on the ribbon surface itself (chrome carries `data-bl-nocapture` and the
 * ribbon never lives under it), so it never steals taps from the grid/controls.
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
import { auditionPhrase } from "../../phrase/audition"
import type { AudioSource } from "../../phrase/audioSource"
import { Glyph, Transport } from "../../bl-ui"
import { buildJamView, cellEventAt, clampPitch } from "./jamModel"
import { scrambleAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  audioSource: AudioSource
  trackId: Id
}

/** The live ribbon spans this many semitones either side of centre. */
const RIBBON_SPAN = 12
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const PhraseJamImmersive = ({
  host,
  store,
  audio,
  audioSource,
  trackId,
}: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const bank = bankSnippets(doc)

  const [playStep, setPlayStep] = useState(-1)
  const [playing, setPlaying] = useState(audio.isPlaying())
  const [bend, setBend] = useState(0) // live ribbon bend, semitones (display)
  const [snapScale, setSnapScale] = useState(false)

  // Paint stroke state for the grid (mirrors step-grid).
  const paintMode = useRef<null | "add" | "remove">(null)
  const touched = useRef(new Set<string>())
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

  if (!track || !isFragmentTrack(track)) {
    return <div className="bl-grid-empty">No phrase track.</div>
  }
  const ftrack: FragmentTrack = track

  // Empty bank → calm pointer to the Phrases (discovery) screen.
  if (!view || view.lanes.length === 0) {
    return (
      <div className="bl-jam">
        <div className="bl-grid-toolbar" data-bl-nocapture>
          <div className="bl-grid-title">
            <span className="bl-dot" style={{ background: ftrack.color }} />
            Phrase Jam
          </div>
        </div>
        <div className="bl-jam-empty">
          <Glyph name="wave" size={28} />
          <p className="bl-jam-empty-title">Your snippet bank is empty</p>
          <p className="bl-jam-empty-sub">
            Open <strong>Phrases</strong> to audition words and save them to the
            bank. Saved snippets appear here as lanes you can place on the beat.
          </p>
        </div>
      </div>
    )
  }

  const stepsPerBeat = view.stepsPerBeat

  // ---- grid cell place / clear --------------------------------------------
  const setCell = (laneIndex: number, step: number, on: boolean) => {
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isFragmentTrack(cur)) return
    const lane = view.lanes[laneIndex]
    if (!lane) return
    const existing = cellEventAt(cur, lane.ref.id, step)
    if (on && !existing) {
      store.dispatch({
        t: "placeFragment",
        trackId,
        frag: {
          tick: tickForStep(step, cur.grid),
          fragmentId: lane.ref.id,
          gain: 0.9,
          pitchSemis: clampPitch(lane.pitchSemis),
        },
      })
    } else if (!on && existing) {
      store.dispatch({ t: "removeFragment", trackId, fragId: existing.id })
    }
  }

  const onCellDown = (laneIndex: number, step: number) => {
    const lane = view.lanes[laneIndex]
    if (!lane) return
    const isOn = lane.cells[step]?.on ?? false
    paintMode.current = isOn ? "remove" : "add"
    touched.current = new Set([`${laneIndex}:${step}`])
    setCell(laneIndex, step, !isOn)
    if (!isOn) void preview(laneIndex)
  }

  const onCellEnter = (laneIndex: number, step: number) => {
    if (!paintMode.current) return
    const key = `${laneIndex}:${step}`
    if (touched.current.has(key)) return
    touched.current.add(key)
    setCell(laneIndex, step, paintMode.current === "add")
  }

  const endStroke = () => {
    paintMode.current = null
    touched.current.clear()
  }

  // ---- audition one lane (preview without the transport) -------------------
  const preview = async (laneIndex: number) => {
    const lane = view.lanes[laneIndex]
    if (!lane?.ref.text || !lane.ref.language) return
    try {
      await auditionPhrase(
        host.audioContext(),
        audioSource,
        lane.ref.text,
        lane.ref.language,
        { voiceId: lane.ref.voiceId, pitchSemis: clampPitch(lane.pitchSemis) }
      )
    } catch (err) {
      console.warn("[beatlounge/phrase-jam] audition failed:", err)
    }
  }

  // ---- per-lane pitch ------------------------------------------------------
  const setLanePitch = (laneIndex: number, next: number) => {
    const cur = findTrack(store.vanilla.getState().doc, trackId)
    if (!cur || !isFragmentTrack(cur)) return
    const lane = view.lanes[laneIndex]
    if (!lane) return
    const semis = clampPitch(next)
    const edits = cur.fragments.filter((e) => e.fragmentId === lane.ref.id)
    if (edits.length === 0) {
      // Nothing placed yet — re-pitching the empty lane only changes the default
      // for the next placement, which we surface by auditioning the new pitch.
      void auditionLaneAt(lane.ref, semis)
      // Force a re-render so the stepper shows the new value: place+immediately
      // not desired; instead keep the value in a tiny per-lane override map.
      laneOverride.current.set(lane.ref.id, semis)
      bump((n) => n + 1)
      return
    }
    laneOverride.current.delete(lane.ref.id)
    if (edits.length === 1) {
      store.dispatch({ t: "editFragment", trackId, fragId: edits[0].id, patch: { pitchSemis: semis } })
    } else {
      store.dispatch({
        t: "batch",
        label: "Re-pitch lane",
        commands: edits.map((e) => ({
          t: "editFragment" as const,
          trackId,
          fragId: e.id,
          patch: { pitchSemis: semis },
        })),
      })
    }
    void auditionLaneAt(lane.ref, semis)
  }

  const auditionLaneAt = async (
    ref: { text?: string; language?: string; voiceId?: string },
    semis: number
  ) => {
    if (!ref.text || !ref.language) return
    try {
      await auditionPhrase(host.audioContext(), audioSource, ref.text, ref.language, {
        voiceId: ref.voiceId,
        pitchSemis: semis,
      })
    } catch (err) {
      console.warn("[beatlounge/phrase-jam] audition failed:", err)
    }
  }

  // Empty-lane pitch overrides (the default for the NEXT placement) + a tiny
  // re-render bump so the stepper reflects them before any event exists.
  const laneOverride = useRef(new Map<Id, number>())
  const [, bump] = useState(0)
  const lanePitch = (laneIndex: number): number => {
    const lane = view.lanes[laneIndex]
    if (!lane) return 0
    return laneOverride.current.get(lane.ref.id) ?? lane.pitchSemis
  }

  // ---- live ribbon ---------------------------------------------------------
  const semisFromX = (clientX: number): number => {
    const el = ribbonRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const x = clamp01((clientX - r.left) / Math.max(1, r.width))
    let semis = (x - 0.5) * 2 * RIBBON_SPAN
    if (snapScale) semis = Math.round(semis) // semitone-locked when scale-lock on
    return Math.max(-RIBBON_SPAN, Math.min(RIBBON_SPAN, semis))
  }

  const paintRibbon = (semis: number) => {
    const el = ribbonRef.current
    if (!el) return
    el.style.setProperty("--bl-jam-bend", `${((semis / RIBBON_SPAN) * 50 + 50).toFixed(2)}%`)
    el.style.setProperty("--bl-jam-bend-on", "1")
  }

  const applyBend = (semis: number) => {
    host.applyParam({ scope: "instrument", trackId, param: "pitchOffset" }, semis)
  }

  const onRibbonDown = (e: React.PointerEvent) => {
    // Only own the drag when the pointer starts on the ribbon surface itself.
    if (e.currentTarget !== e.target && !(e.target as HTMLElement).closest(".bl-jam-ribbon")) return
    if (e.button != null && e.button > 0) return
    const el = ribbonRef.current
    if (!el) return
    try { el.setPointerCapture(e.pointerId) } catch { /* ignore (tests) */ }
    dragging.current = true
    const semis = semisFromX(e.clientX)
    setBend(semis)
    paintRibbon(semis)
    applyBend(semis)
    e.preventDefault()
  }

  const onRibbonMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const semis = semisFromX(e.clientX)
    setBend(semis)
    paintRibbon(semis)
    applyBend(semis)
  }

  const onRibbonUp = (e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    const el = ribbonRef.current
    try { el?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
    // Ease back to centre — a quick snap-to-zero on release (premium touch).
    setBend(0)
    if (el) el.style.setProperty("--bl-jam-bend-on", "0")
    applyBend(0)
  }

  // Safety: drop the bend if we unmount mid-drag so the track doesn't stay bent.
  useEffect(() => {
    return () => {
      if (dragging.current) applyBend(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- transport -----------------------------------------------------------
  const toggleTransport = () => {
    if (audio.isPlaying()) {
      audio.stop()
      setPlaying(false)
    } else {
      void audio.start().then(() => setPlaying(true)).catch((err) => {
        console.warn("[beatlounge/phrase-jam] transport start failed:", err)
        host.toast("Couldn't start playback")
      })
    }
  }

  const anySolo = doc.tracks.some((t) => t.solo)
  const silent = ftrack.mute || (anySolo && !ftrack.solo)

  const onScramble = () => {
    const before = store.vanilla.getState().doc
    const r = runAction(store, scrambleAction, { doc, targetTrackId: trackId })
    if (r.commands.length)
      host.toast(r.summary, {
        undo: () => store.vanilla.getState().doc !== before && store.undo(),
      })
    else host.toast(r.summary)
  }

  return (
    <div className="bl-jam" onPointerUp={endStroke} onPointerLeave={endStroke}>
      <div className="bl-grid-toolbar" data-bl-nocapture>
        <div className="bl-grid-title">
          <span className="bl-dot" style={{ background: ftrack.color }} />
          Phrase Jam
        </div>
        <div className="bl-grid-actions">
          <Transport playing={playing} onToggle={toggleTransport} spaceToToggle={false} />
          <button type="button" className="bl-chip" onClick={onScramble}>
            Scramble
          </button>
        </div>
      </div>

      {/* ---- the snippet step grid ---- */}
      <div
        className={`bl-jam-grid${silent ? " is-silent" : ""}`}
        style={{ ["--bl-steps" as string]: String(view.steps) }}
      >
        {view.lanes.map((lane, laneIndex) => (
          <div className="bl-jam-lane" key={lane.ref.id}>
            <div className="bl-jam-lane-head" data-bl-nocapture>
              <div className="bl-jam-lane-id">
                <span className="bl-jam-lane-name" title={lane.ref.text ?? ""}>
                  {lane.label}
                </span>
                {lane.langTag && <span className="bl-jam-lane-lang">{lane.langTag}</span>}
              </div>
              <div className="bl-jam-pitch" role="group" aria-label={`${lane.label} pitch`}>
                <button
                  type="button"
                  className="bl-jam-pitch-btn"
                  aria-label="Pitch down"
                  onClick={() => setLanePitch(laneIndex, lanePitch(laneIndex) - 1)}
                >
                  −
                </button>
                <span className="bl-jam-pitch-val" aria-live="off">
                  {fmtSemis(lanePitch(laneIndex))}
                </span>
                <button
                  type="button"
                  className="bl-jam-pitch-btn"
                  aria-label="Pitch up"
                  onClick={() => setLanePitch(laneIndex, lanePitch(laneIndex) + 1)}
                >
                  +
                </button>
                <button
                  type="button"
                  className="bl-jam-audition"
                  aria-label={`Audition ${lane.label}`}
                  onClick={() => void preview(laneIndex)}
                >
                  <Glyph name="play" size={14} />
                </button>
              </div>
            </div>
            <div className="bl-jam-cells" role="row">
              {lane.cells.map((cell, s) => (
                <button
                  key={s}
                  type="button"
                  role="gridcell"
                  aria-pressed={cell.on}
                  aria-label={`${lane.label} step ${s + 1}`}
                  className={
                    "bl-cell" +
                    (cell.on ? " is-on" : "") +
                    (s === playStep ? " is-active" : "") +
                    (s % stepsPerBeat === 0 ? " is-beat" : "")
                  }
                  data-bl-nocapture
                  style={
                    cell.on
                      ? ({ "--bl-cell-vel": String(0.45 + cell.gain * 0.55) } as React.CSSProperties)
                      : undefined
                  }
                  onPointerDown={(e) => {
                    if (e.button != null && e.button > 0) return
                    onCellDown(laneIndex, s)
                  }}
                  onPointerEnter={(e) => {
                    if (e.buttons & 1) onCellEnter(laneIndex, s)
                  }}
                >
                  <span className="bl-cell-core" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ---- the live pitch ribbon ---- */}
      <div className="bl-jam-perform">
        <div className="bl-jam-perform-head" data-bl-nocapture>
          <span className="bl-jam-perform-title">Pitch ribbon</span>
          <span className="bl-jam-bend-readout" aria-live="off">
            {fmtSemis(Math.round(bend * 10) / 10)}
          </span>
          <button
            type="button"
            className={`bl-chip bl-jam-snap${snapScale ? " is-on" : ""}`}
            aria-pressed={snapScale}
            onClick={() => setSnapScale((v) => !v)}
          >
            Scale lock
          </button>
        </div>
        <div
          ref={ribbonRef}
          className={`bl-jam-ribbon${silent ? " is-silent" : ""}`}
          role="slider"
          aria-label="Live pitch bend (semitones)"
          aria-valuemin={-RIBBON_SPAN}
          aria-valuemax={RIBBON_SPAN}
          aria-valuenow={Math.round(bend)}
          aria-valuetext={`${fmtSemis(Math.round(bend))} semitones`}
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
      </div>
    </div>
  )
}

/** Format a signed semitone value, e.g. "+3", "0", "−5". */
const fmtSemis = (n: number): string => {
  if (n === 0) return "0"
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}
