/**
 * beatlounge — the drum-pads IMMERSIVE view: a velocity pad bank.
 *
 * A 4×4 (phone: 4×2) bank over the drum track's lanes. Tapping a pad auditions
 * the track (host.previewTrack) and — when STEP-RECORD is armed — writes the
 * pad's lane note at the live playhead step via `toggleStep`, so the running
 * scheduler plays it on the loop. Vertical drag on a pad sets its velocity (DAW
 * "soft↔hard" feel), shown as a fill. Pads glow on the beat from the playhead.
 *
 * Header wires the registry action (randomPattern) plus a Clear, and the
 * step-record arm. A velocity Knob + the track Volume/Pan sit in the foot.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
import { Knob } from "../../bl-ui"
import { useDrag } from "../../bl-ui/useDrag"
import { buildPadView, recordStep, visiblePadCount } from "./padModel"
import { randomPatternAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

const clamp01 = (v: number) => Math.max(0.05, Math.min(1, v))

export const DrumPadsImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)
  const [record, setRecord] = useState(false)
  // Per-pad velocity the next hit/record uses, by pitch (0.05..1).
  const [velocities, setVelocities] = useState<Record<number, number>>({})

  const form = host.form()

  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  const view = useMemo(
    () =>
      track && isInstrumentTrack(track)
        ? buildPadView(doc, track, playStep)
        : null,
    [doc, track, playStep]
  )

  if (!track || !isInstrumentTrack(track) || view == null) {
    return <div className="bl-grid-empty">No drum track.</div>
  }

  const count = visiblePadCount(form)
  const pads = view.pads.slice(0, count)
  const cols = 4
  const velOf = (pitch: number) => velocities[pitch] ?? 0.85

  const hitPad = (pitch: number) => {
    const velocity = velOf(pitch)
    host.previewTrack(trackId, velocity)
    if (record) {
      const step = recordStep(playStep, view.steps)
      const cur = findTrack(store.vanilla.getState().doc, trackId)
      if (cur && isInstrumentTrack(cur)) {
        // Only ADD (never toggle off) while recording a live performance.
        const exists = cur.notes.some(
          (n) => stepForTick(n.tick, cur.grid) === step && n.pitch === pitch
        )
        if (!exists) {
          store.dispatch({ t: "toggleStep", trackId, step, pitch, velocity })
        }
      }
    }
  }

  const anySolo = doc.tracks.some((t) => t.solo)
  const silent = track.mute || (anySolo && !track.solo)

  return (
    <div className="bl-pads">
      <div className="bl-grid-toolbar" data-bl-nocapture>
        <div className="bl-grid-title">
          <span className="bl-dot" style={{ background: track.color }} />
          {track.name}
        </div>
        <div className="bl-grid-actions">
          <button
            type="button"
            className={`bl-chip${record ? " is-armed" : ""}`}
            aria-pressed={record}
            onClick={() => setRecord((r) => !r)}
          >
            {record ? "Recording" : "Record"}
          </button>
          <button
            type="button"
            className="bl-chip"
            onClick={() => {
              const r = runAction(store, randomPatternAction, { doc, targetTrackId: trackId })
              host.toast(r.summary, undefined)
            }}
          >
            Randomize
          </button>
          <button
            type="button"
            className="bl-chip is-danger"
            onClick={() => {
              const before = store.vanilla.getState().doc
              if (isInstrumentTrack(track) && track.notes.length === 0) return
              store.dispatch({ t: "clearTrack", trackId })
              host.toast("Cleared pattern", {
                undo: () => store.vanilla.getState().doc !== before && store.undo(),
              })
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        className={`bl-pad-bank${silent ? " is-silent" : ""}`}
        style={{ ["--bl-pad-cols" as string]: String(cols) }}
      >
        {pads.map((pad) => (
          <Pad
            key={pad.pitch}
            label={pad.label}
            count={pad.count}
            live={pad.liveHit && playStep >= 0}
            velocity={velOf(pad.pitch)}
            onHit={() => hitPad(pad.pitch)}
            onVelocity={(v) =>
              setVelocities((prev) => ({ ...prev, [pad.pitch]: clamp01(v) }))
            }
          />
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

interface PadProps {
  label: string
  count: number
  live: boolean
  velocity: number
  onHit: () => void
  onVelocity: (v: number) => void
}

/**
 * One velocity pad. A clean tap triggers; a vertical drag (up = harder) sets the
 * pad's velocity without triggering. The fill height reflects velocity.
 */
const Pad = ({ label, count, live, velocity, onHit, onVelocity }: PadProps) => {
  const startVel = useRef(velocity)
  const drag = useDrag({
    onStart: () => {
      startVel.current = velocity
    },
    onMove: ({ dy }) => {
      // 120px of travel sweeps the full velocity range; up = harder.
      onVelocity(startVel.current - dy / 120)
    },
    onEnd: (moved) => {
      // A clean tap (no drag) triggers the pad.
      if (!moved) onHit()
    },
  })

  return (
    <button
      type="button"
      className={`bl-pad${live ? " is-live" : ""}${count > 0 ? " has-hits" : ""}`}
      aria-label={`${label}, velocity ${Math.round(velocity * 100)}`}
      data-bl-nocapture
      onPointerDown={drag.onPointerDown}
    >
      <span className="bl-pad-fill" style={{ height: `${velocity * 100}%` }} />
      <span className="bl-pad-label">{label}</span>
      {count > 0 && <span className="bl-pad-count">{count}</span>}
    </button>
  )
}
