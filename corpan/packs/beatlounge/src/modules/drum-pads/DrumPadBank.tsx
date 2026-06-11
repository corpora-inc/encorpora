/**
 * beatlounge — the reusable DRUM PAD BANK surface.
 *
 * A velocity pad bank over the drum track's lanes (4×4, phone 4×2). Tapping a
 * pad auditions the track (host.previewTrack) for live performance; when
 * STEP-RECORD is armed the tap instead writes the pad's lane note at the live
 * playhead step via `toggleStep` (silently — we're setting up the grid, not
 * playing). Vertical drag on a pad sets its velocity. Pads glow on the beat.
 *
 * Extracted from DrumPadsImmersive so the Drums page can host the pad surface as
 * a tab WITHOUT duplicating the surface. It renders ONLY the pad bank (+ a Record
 * arm row) — no title/transport; the host page chrome owns those.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
import { useDrag } from "../../bl-ui/useDrag"
import { buildPadView, recordStep, visiblePadCount } from "./padModel"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

const clamp01 = (v: number) => Math.max(0.05, Math.min(1, v))

export const DrumPadBank = ({ host, store, audio, trackId }: Props) => {
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
    // Auditioning a pad is live performance — but when STEP-RECORD is armed
    // we're setting up the grid, not playing, so stay silent and just write.
    if (!record) host.previewTrack(trackId, velocity, pitch)
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
    <div className="bl-padbank">
      <div className="bl-padbank-arm" data-bl-nocapture>
        <button
          type="button"
          className={`bl-chip${record ? " is-armed" : ""}`}
          aria-pressed={record}
          onClick={() => setRecord((r) => !r)}
        >
          {record ? "Recording" : "Record"}
        </button>
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
