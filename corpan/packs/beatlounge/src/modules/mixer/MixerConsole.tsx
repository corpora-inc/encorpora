/**
 * beatlounge — the mixer IMMERSIVE CONSOLE, the HOME for the whole mix.
 *
 * Each track is a channel strip — meter + level + pan + Mute/Solo + name — with
 * two killer affordances:
 *   • FX   — pulls up THAT track's full effects chain (the shared <TrackFxChain>,
 *            the SAME rack Drums/Instruments/Phrase use) inline, no parallel UI.
 *   • Open — deeplinks to the track's dedicated detail page (Drums step-grid /
 *            Instruments bound to that synth / Phrase Jam) via host.enterImmersive
 *            + the selected-instrument slice.
 * Below the strips: a Master strip and the global PLAYERS section (the renamed
 * autonomous-modulation surface, folded in here so it is no longer its own tile).
 *
 * MOBILE-FIRST: at phone width every strip is a self-contained CARD that stacks
 * vertically (name row · meter+level · pan + mute/solo · FX/Open), thumb-reachable
 * and never clipped. It promotes to side-by-side console columns on the iPad via
 * CSS (no JS branch). Faders/pan drive the audio in REAL TIME while dragging via
 * host.applyParam and persist ONE setTrackProp / setMasterVolume on release.
 */

import { useMemo, useState } from "react"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { type Track } from "../../model/document"
import { setSelectedInstrumentTrackId } from "../../store/selectedInstrument"
import { Fader, Meter, MuteSolo, Glyph } from "../../bl-ui"
import { TrackNameEdit } from "../TrackNameEdit"
import { TrackFxChain } from "../fx-rack/TrackFxChain"
import { PlayersPanel } from "../tweakers/PlayersPanel"
import { useMeterPulse } from "./useMeterPulse"
import { resolveTrackDeeplink, deeplinkLabel } from "./trackDeeplink"

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
  // Which strip has its inline FX chain open (one at a time — keeps the page
  // calm and the phone scroll short). null = none.
  const [openFx, setOpenFx] = useState<string | null>(null)
  // Phone gets a COMPACT strip (horizontal level fader + meter) so 4–5 channels
  // fit on a phone; tablet/desktop get the iconic tall vertical fader. Driven by
  // the host form factor (re-evaluated on resize) so the JS layout and the CSS
  // breakpoint agree. The `bl-mixer--phone` class flips the CSS to match.
  const phone = host.form() === "phone"

  return (
    <div className={`bl-mixer${phone ? " bl-mixer--phone" : ""}`}>
      <div className="bl-mixer-strips">
        {doc.tracks.map((track) => (
          <ChannelStrip
            key={track.id}
            store={store}
            host={host}
            track={track}
            level={levels[track.id] ?? 0}
            phone={phone}
            fxOpen={openFx === track.id}
            onToggleFx={() =>
              setOpenFx((cur) => (cur === track.id ? null : track.id))
            }
          />
        ))}

        <div className="bl-mixstrip bl-mixstrip--master" data-bl-nocapture>
          <div className="bl-mixstrip-head">
            <span className="bl-mixstrip-name">Master</span>
          </div>
          <div className="bl-mixstrip-controls">
            <div className="bl-mixstrip-body">
              <Meter
                level={Math.max(...Object.values(levels), 0)}
                segments={14}
                orientation={phone ? "horizontal" : "vertical"}
              />
              <LiveFader
                label="Master volume"
                value={doc.masterVolume}
                min={0}
                max={1}
                step={0.01}
                defaultValue={0.8}
                orientation={phone ? "horizontal" : "vertical"}
                length={phone ? 180 : 150}
                format={(v) => `${Math.round(v * 100)}`}
                onLive={(v) => host.applyParam({ scope: "master", param: "volume" }, v)}
                onCommit={(v) => store.dispatch({ t: "setMasterVolume", v })}
              />
            </div>
          </div>
        </div>
      </div>

      <section className="bl-mixer-players" aria-label="Players">
        <PlayersPanel host={host} store={store} embedded />
      </section>
    </div>
  )
}

// ----------------------------------------------------------- channel strip
const ChannelStrip = ({
  store,
  host,
  track,
  level,
  phone,
  fxOpen,
  onToggleFx,
}: {
  store: BeatloungeStore
  host: BeatloungeHost
  track: Track
  level: number
  phone: boolean
  fxOpen: boolean
  onToggleFx: () => void
}) => {
  const set = (prop: "volume" | "pan" | "mute" | "solo", value: unknown) =>
    store.dispatch({ t: "setTrackProp", trackId: track.id, prop, value })

  // The strip's killer deeplink: open this track's dedicated detail page. Pure
  // resolution → set the instrument selection for melodic tracks → enter.
  const target = resolveTrackDeeplink(track)
  const openDetail = () => {
    if (target.selectInstrumentTrackId) {
      setSelectedInstrumentTrackId(
        store.vanilla.getState().doc.id,
        target.selectInstrumentTrackId
      )
    }
    host.enterImmersive(target.moduleId)
  }

  const fxCount = track.inserts.length

  return (
    <div className={`bl-mixstrip${fxOpen ? " is-fxopen" : ""}`} data-bl-nocapture>
      <div className="bl-mixstrip-head">
        <TrackNameEdit
          store={store}
          trackId={track.id}
          name={track.name}
          color={track.color ?? "var(--bl-accent)"}
          className="bl-mixstrip-name"
        />
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

      <div className="bl-mixstrip-controls">
        <div className="bl-mixstrip-body">
          <Meter
            level={level}
            segments={14}
            orientation={phone ? "horizontal" : "vertical"}
          />
          <LiveFader
            label={`${track.name} volume`}
            value={track.volume}
            min={0}
            max={1}
            step={0.01}
            defaultValue={0.8}
            orientation={phone ? "horizontal" : "vertical"}
            length={phone ? 180 : 150}
            format={(v) => `${Math.round(v * 100)}`}
            onLive={(v) => host.applyParam({ scope: "track", trackId: track.id, param: "volume" }, v)}
            onCommit={(v) => set("volume", v)}
          />
        </div>

        <div className="bl-mixstrip-side">
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
          <MuteSolo
            compact
            mute={track.mute}
            solo={track.solo}
            onMute={() => set("mute", !track.mute)}
            onSolo={() => set("solo", !track.solo)}
          />
        </div>
      </div>

      <div className="bl-mixstrip-actions" data-bl-nocapture>
        <button
          type="button"
          className={`bl-mixstrip-act${fxOpen ? " is-on" : ""}`}
          aria-pressed={fxOpen}
          aria-expanded={fxOpen}
          onClick={onToggleFx}
        >
          <Glyph name="sliders" size={15} />
          <span>FX{fxCount > 0 ? ` ${fxCount}` : ""}</span>
        </button>
        <button
          type="button"
          className="bl-mixstrip-act bl-mixstrip-open"
          onClick={openDetail}
          aria-label={`Open ${deeplinkLabel(target.moduleId)} for ${track.name}`}
        >
          <Glyph name="grid" size={15} />
          <span>Open</span>
        </button>
      </div>

      {fxOpen && (
        <div className="bl-mixstrip-fx">
          <TrackFxChain host={host} store={store} trackId={track.id} showSends={false} />
        </div>
      )}
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
