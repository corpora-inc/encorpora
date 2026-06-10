/**
 * beatlounge — the mixer IMMERSIVE CONSOLE: a channel strip per track (meter +
 * fader + pan + Mute/Solo + name) and a master strip. Faders/pan dispatch
 * setTrackProp; the master fader dispatches setMasterVolume. Meters are fed by
 * the synthetic playhead pulse (swap to real RMS later, same contract).
 */

import { useMemo } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { type Track } from "../../model/document"
import { Fader, Meter, MuteSolo } from "../../bl-ui"
import { useMeterPulse } from "./useMeterPulse"

interface Props {
  store: BeatloungeStore
  audio: AudioFacade
}

const panLabel = (v: number): string =>
  v === 0 ? "C" : `${v > 0 ? "R" : "L"}${Math.round(Math.abs(v) * 100)}`

export const MixerConsole = ({ store, audio }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const ids = useMemo(() => doc.tracks.map((t) => t.id), [doc.tracks])
  const levels = useMeterPulse(store, audio, ids)

  return (
    <div className="bl-mixer">
      <div className="bl-mixer-strips">
        {doc.tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            store={store}
            track={track}
            level={levels[track.id] ?? 0}
          />
        ))}
      </div>

      <div className="bl-mixer-master" data-bl-nocapture>
        <span className="bl-mixstrip-name">Master</span>
        <div className="bl-mixstrip-body">
          <Meter level={Math.max(...Object.values(levels), 0)} segments={14} />
          <Fader
            label="Master volume"
            value={doc.masterVolume}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.8}
            length={150}
            format={(v) => `${Math.round(v * 100)}`}
            onChange={(v) => store.dispatch({ t: "setMasterVolume", v })}
          />
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------- channel strip
const ChannelStrip = ({
  store,
  track,
  level,
}: {
  store: BeatloungeStore
  track: Track
  level: number
}) => {
  const set = (prop: "volume" | "pan" | "mute" | "solo", value: unknown) =>
    store.dispatch({ t: "setTrackProp", trackId: track.id, prop, value })

  return (
    <div className="bl-mixstrip" data-bl-nocapture>
      <div className="bl-mixstrip-head">
        <span className="bl-mixstrip-name" title={track.name}>
          <span className="bl-dot" style={{ background: track.color ?? "var(--bl-accent)" }} />
          {track.name}
        </span>
        <button
          type="button"
          className="bl-mixstrip-remove"
          aria-label={`Remove ${track.name}`}
          title="Remove track"
          onClick={() => store.dispatch({ t: "removeTrack", trackId: track.id })}
        >
          ×
        </button>
      </div>
      <PanSlider value={track.pan} onChange={(v) => set("pan", v)} />
      <div className="bl-mixstrip-body">
        <Meter level={level} segments={14} />
        <Fader
          label={`${track.name} volume`}
          value={track.volume}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
          length={150}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => set("volume", v)}
        />
      </div>
      <MuteSolo
        compact
        mute={track.mute}
        solo={track.solo}
        onMute={() => set("mute", !track.mute)}
        onSolo={() => set("solo", !track.solo)}
      />
    </div>
  )
}

const PanSlider = ({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) => (
  <div className="bl-mixstrip-pan">
    <Fader
      label="Pan"
      orientation="horizontal"
      value={value}
      min={-1}
      max={1}
      step={0.02}
      defaultValue={0}
      length={72}
      format={panLabel}
      onChange={onChange}
    />
  </div>
)
