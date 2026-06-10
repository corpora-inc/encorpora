/**
 * beatlounge — the mixer IMMERSIVE CONSOLE: a channel strip per track (meter +
 * fader + pan + Mute/Solo + name) and a master strip.
 *
 * Faders/pan drive the audio in REAL TIME while dragging via host.applyParam
 * (volume/pan/master gain nodes ramp under the finger — no document write, no
 * undo spam) and persist ONE setTrackProp / setMasterVolume on release (one
 * clean undo step). Local `live` state in each Fader wrapper keeps the cap
 * tracking the finger before the doc write lands. Meters are fed by the
 * synthetic playhead pulse (swap to real RMS later, same contract).
 */

import { useMemo, useState } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { type Track } from "../../model/document"
import { Fader, Meter, MuteSolo } from "../../bl-ui"
import { useMeterPulse } from "./useMeterPulse"

interface Props {
  store: BeatloungeStore
  audio: AudioFacade
  host: BeatloungeHost
}

const panLabel = (v: number): string =>
  v === 0 ? "C" : `${v > 0 ? "R" : "L"}${Math.round(Math.abs(v) * 100)}`

export const MixerConsole = ({ store, audio, host }: Props) => {
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
            host={host}
            track={track}
            level={levels[track.id] ?? 0}
          />
        ))}
      </div>

      <div className="bl-mixer-master" data-bl-nocapture>
        <span className="bl-mixstrip-name">Master</span>
        <div className="bl-mixstrip-body">
          <Meter level={Math.max(...Object.values(levels), 0)} segments={14} />
          <LiveFader
            label="Master volume"
            value={doc.masterVolume}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.8}
            length={150}
            format={(v) => `${Math.round(v * 100)}`}
            onLive={(v) => host.applyParam({ scope: "master", param: "volume" }, v)}
            onCommit={(v) => store.dispatch({ t: "setMasterVolume", v })}
          />
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------- channel strip
const ChannelStrip = ({
  store,
  host,
  track,
  level,
}: {
  store: BeatloungeStore
  host: BeatloungeHost
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
      <div className="bl-mixstrip-pan">
        <LiveFader
          label="Pan"
          orientation="horizontal"
          value={track.pan}
          min={-1}
          max={1}
          step={0.02}
          defaultValue={0}
          length={72}
          format={panLabel}
          onLive={(v) => host.applyParam({ scope: "track", trackId: track.id, param: "pan" }, v)}
          onCommit={(v) => set("pan", v)}
        />
      </div>
      <div className="bl-mixstrip-body">
        <Meter level={level} segments={14} />
        <LiveFader
          label={`${track.name} volume`}
          value={track.volume}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.8}
          length={150}
          format={(v) => `${Math.round(v * 100)}`}
          onLive={(v) => host.applyParam({ scope: "track", trackId: track.id, param: "volume" }, v)}
          onCommit={(v) => set("volume", v)}
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

/**
 * A Fader that drives the audio live as the finger moves (`onLive` →
 * host.applyParam) and persists ONE undo step on release (`onCommit`). Local
 * `live` state keeps the cap tracking the finger before the doc write lands.
 */
const LiveFader = ({
  value,
  min,
  max,
  step,
  defaultValue,
  label,
  orientation,
  length,
  format,
  onLive,
  onCommit,
}: {
  value: number
  min: number
  max: number
  step: number
  defaultValue: number
  label: string
  orientation?: "vertical" | "horizontal"
  length: number
  format: (v: number) => string
  onLive: (v: number) => void
  onCommit: (v: number) => void
}) => {
  const [live, setLive] = useState<number | null>(null)
  return (
    <Fader
      label={label}
      orientation={orientation}
      value={live ?? value}
      min={min}
      max={max}
      step={step}
      defaultValue={defaultValue}
      length={length}
      format={format}
      onChange={(v) => {
        setLive(v)
        onLive(v)
      }}
      onCommit={(v) => {
        setLive(null)
        onCommit(v)
      }}
    />
  )
}
