/**
 * beatlounge — the drum-pads IMMERSIVE view: a velocity pad bank.
 *
 * A 4×4 (phone: 4×2) bank over the drum track's lanes. Tapping a pad auditions
 * the track (host.previewTrack) for live performance; when STEP-RECORD is armed
 * the tap instead writes the pad's lane note at the live playhead step via
 * `toggleStep` (silently — we're setting up the grid, not playing), so the
 * running scheduler plays it on the loop. Vertical drag on a pad sets its velocity (DAW
 * "soft↔hard" feel), shown as a fill. Pads glow on the beat from the playhead.
 *
 * Header wires the registry action (randomPattern) plus a Clear, and the
 * step-record arm. A velocity Knob + the track Volume/Pan sit in the foot.
 */

import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { ClearButton } from "../_shared/ClearButton"
import { DrumPadBank } from "./DrumPadBank"
import { randomPatternAction } from "./actions"
import { runAction } from "../runAction"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

export const DrumPadsImmersive = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)

  if (!track || !isInstrumentTrack(track)) {
    return <div className="bl-grid-empty">No drum track.</div>
  }

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
            className="bl-chip"
            onClick={() => {
              const r = runAction(store, randomPatternAction, { doc, targetTrackId: trackId })
              host.toast(r.summary, undefined)
            }}
          >
            Randomize
          </button>
          <ClearButton
            onClear={() => {
              const before = store.vanilla.getState().doc
              if (isInstrumentTrack(track) && track.notes.length === 0) return
              store.dispatch({ t: "clearTrack", trackId })
              host.toast("Cleared pattern", {
                undo: () => store.vanilla.getState().doc !== before && store.undo(),
              })
            }}
          />
        </div>
      </div>

      <DrumPadBank host={host} store={store} audio={audio} trackId={trackId} />
    </div>
  )
}
