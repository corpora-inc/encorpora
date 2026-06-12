/**
 * beatlounge — TrackMixer: the compact mixer strip shared by the track-studio
 * pages (Drums and Phrase Jam). Level fader (realtime via host.applyParam,
 * persisted on release), pan knob, and mute/solo. Dispatches through the
 * existing commands only — the store is the only write path.
 */

import { useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { Track } from "../../model/document"
import { Fader, MuteSolo } from "../../bl-ui"
import { TrackParamKnob } from "../TrackParamKnob"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  track: Track
  /** Is any track soloed (so a non-soloed track reads as silent)? */
  anySolo: boolean
}

export const TrackMixer = ({ host, store, track, anySolo }: Props) => {
  const [liveVol, setLiveVol] = useState<number | null>(null)
  const silent = track.mute || (anySolo && !track.solo)
  // Phone gets the wide HORIZONTAL level fader (thumb-friendly, fills the drawer)
  // — matching the mixer console's phone layout; the tall vertical fader is only
  // worth the height on the iPad. Driven by the host form factor (re-evaluated on
  // resize) so the JS layout and the CSS breakpoint agree.
  const phone = host.form() === "phone"

  return (
    <div className={`bl-trackmixer${phone ? " bl-trackmixer--h" : ""}`} data-bl-nocapture>
      <div className={`bl-trackmixer-strip${silent ? " is-silent" : ""}`}>
        <span className="bl-trackmixer-name">
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
          orientation={phone ? "horizontal" : "vertical"}
          length={phone ? 200 : 150}
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
        <div className="bl-trackmixer-side">
          <div className="bl-trackmixer-pan">
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
      </div>
    </div>
  )
}
