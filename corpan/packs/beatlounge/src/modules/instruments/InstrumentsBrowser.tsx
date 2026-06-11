/**
 * beatlounge — instruments IMMERSIVE: a PLAYABLE software-instrument page.
 *
 *  • Track switcher bar (chips) so one view re-voices any melodic track, with
 *    inline rename (TrackNameEdit) + a per-chip remove (guarded so you can't
 *    delete the last melodic track), an Add affordance for new synth voices, and
 *    a Record arm LIFTED to the page (passed into the ribbon).
 *  • The headline: the reusable <InstrumentRibbon> — a polyphonic performance
 *    surface that plays the bound track's REAL instrument (through its FX +
 *    mixer) and records into it.
 *  • A voice-type segment — Analog · Preset · Osc — derived from the bound
 *    track's instrument.kind; switching voices the track to that type's default.
 *  • A bottom <TrackDrawer> (Voice / Effects / Mixer / Score), copying the Drums
 *    page pattern: Voice edits the active voice type, Effects + Mixer reuse the
 *    shared track-studio panels, Score reserves the step-editor seam (WS-F).
 *
 * The store is the only write path; drum tracks are excluded (their own kit
 * editor lives on the Drums page). No emoji; --bl-* tokens only.
 */

import { useEffect, useMemo, useState } from "react"
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
import {
  FAMILY_LABEL,
  familyOfPreset,
  instantiatePreset,
  matchPreset,
  presetsByFamily,
  type PresetFamily,
} from "../../instruments/presets"
import {
  OSC_WAVES,
  VOICE_TYPES,
  VOICE_TYPE_LABEL,
  configForVoiceType,
  voiceTypeOf,
  type OscWave,
  type VoiceType,
} from "../../instruments/voiceTypes"
import { AnalogPanel } from "../../instruments/AnalogPanel"
import { Glyph } from "../../bl-ui"
import { TrackNameEdit } from "../TrackNameEdit"
import { InstrumentRibbon } from "../instrument-surface/InstrumentRibbon"
import { ScorePlaceholder } from "../instrument-surface/ScorePlaceholder"
import { TrackFxChain } from "../fx-rack/TrackFxChain"
import { TrackMixer } from "../track-studio/TrackMixer"
import {
  TrackDrawer,
  type DrawerState,
  type DrawerTabDef,
} from "../track-studio/TrackDrawer"
import "../track-studio/track-studio.css"
import { newInstrumentTrackInit } from "./addTrack"
import {
  canRemoveTrack,
  isMelodicTrack,
  rebindTrackId,
  trackIdAfterRemoval,
} from "./trackBinding"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

const OSC_LABEL: Record<OscWave, string> = {
  sine: "Sine",
  sawtooth: "Saw",
  triangle: "Tri",
  square: "Sqr",
}

export const InstrumentsBrowser = ({
  host,
  store,
  audio,
  trackId: initialTrackId,
}: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const [trackId, setTrackId] = useState<Id>(initialTrackId)
  const [tab, setTab] = useState<string>("voice")
  const [drawer, setDrawer] = useState<DrawerState>("open")
  const [record, setRecord] = useState(false)
  const [openFamily, setOpenFamily] = useState<PresetFamily | null>(null)
  const [oscWave, setOscWave] = useState<OscWave>("triangle")

  const instrumentTracks = useMemo(
    () => doc.tracks.filter((t): t is InstrumentTrack => isMelodicTrack(t)),
    [doc.tracks]
  )

  // Keep the bound track valid as the doc changes (re-bind on a vanished track).
  useEffect(() => {
    const next = rebindTrackId(doc.tracks, trackId)
    if (next && next !== trackId) setTrackId(next)
  }, [doc.tracks, trackId])

  const track = findTrack(doc, trackId)
  const config = track && isInstrumentTrack(track) ? track.instrument : undefined
  const activeVoiceType: VoiceType = config ? voiceTypeOf(config) : "preset"
  const activePreset = config ? matchPreset(config) : undefined

  const groups = useMemo(() => presetsByFamily(), [])
  // The open preset family follows the active preset (else the first family).
  const family =
    groups.find(
      (g) => g.family === (openFamily ?? (activePreset && familyOfPreset(activePreset.id)))
    ) ?? groups[0]

  const addInstrumentTrack = () => {
    const init = newInstrumentTrackInit(doc.tracks.map((t) => t.name))
    store.dispatch({ t: "addTrack", track: init })
    if (init.id) setTrackId(init.id)
  }

  const removeTrack = (id: Id) => {
    // Guard: never delete the last melodic track (the page needs one to play).
    if (!canRemoveTrack(doc.tracks, id)) return
    const next = trackIdAfterRemoval(doc.tracks, trackId, id)
    if (next && next !== trackId) setTrackId(next)
    store.dispatch({ t: "removeTrack", trackId: id })
  }

  // Switch the bound track to a voice type's default config (one undo step). The
  // Voice drawer tab then edits the new kind. No-op if already that type.
  const chooseVoiceType = (type: VoiceType) => {
    if (!track || !isInstrumentTrack(track) || type === activeVoiceType) return
    store.dispatch({
      t: "setInstrument",
      trackId: track.id,
      config: configForVoiceType(type, oscWave),
    })
    setTab("voice")
    setDrawer((d) => (d === "peek" ? "open" : d))
  }

  const choosePreset = (presetId: string) => {
    const cfg = instantiatePreset(presetId)
    if (!cfg || !track || !isInstrumentTrack(track)) return
    store.dispatch({ t: "setInstrument", trackId: track.id, config: cfg })
  }

  const chooseOsc = (wave: OscWave) => {
    setOscWave(wave)
    if (!track || !isInstrumentTrack(track)) return
    store.dispatch({
      t: "setInstrument",
      trackId: track.id,
      config: configForVoiceType("osc", wave),
    })
  }

  const openTab = (next: string) => {
    setTab(next)
    setDrawer((d) => (d === "peek" ? "open" : d))
  }

  const anySolo = doc.tracks.some((t) => t.solo)

  if (!track || !isInstrumentTrack(track)) {
    return (
      <div className="bl-instr bl-trackpage">
        <div className="bl-grid-empty">Add an instrument track to start.</div>
      </div>
    )
  }
  const itrack = track

  // ---- the Voice drawer tab: the active voice type's editor ----------------
  const renderVoice = () => {
    if (activeVoiceType === "analog") {
      return <AnalogPanel host={host} store={store} trackId={itrack.id} />
    }
    if (activeVoiceType === "osc") {
      const curWave = itrack.instrument.kind === "synth" ? itrack.instrument.osc : oscWave
      return (
        <div className="bl-instr-osc">
          <div className="bl-seg" role="group" aria-label="Oscillator">
            {OSC_WAVES.map((w) => (
              <button
                key={w}
                type="button"
                className={`bl-seg-btn${curWave === w ? " is-on" : ""}`}
                aria-pressed={curWave === w}
                onClick={() => chooseOsc(w)}
              >
                {OSC_LABEL[w]}
              </button>
            ))}
          </div>
        </div>
      )
    }
    // preset = the GM family browser
    return (
      <div className="bl-instr-browser">
        <div className="bl-instr-families" role="tablist" aria-label="Instrument families">
          {groups.map((g) => (
            <button
              key={g.family}
              type="button"
              role="tab"
              aria-selected={g.family === family.family}
              className={`bl-chip${g.family === family.family ? " is-on" : ""}`}
              onClick={() => setOpenFamily(g.family)}
            >
              {FAMILY_LABEL[g.family]}
            </button>
          ))}
        </div>
        <div
          className="bl-instr-programs"
          role="listbox"
          aria-label={`${FAMILY_LABEL[family.family]} instruments`}
        >
          {family.presets.map((p) => {
            const selected = activePreset?.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                className={`bl-instr-prog${selected ? " is-on" : ""}`}
                onClick={() => choosePreset(p.id)}
              >
                <span className="bl-instr-prog-text">
                  <span className="bl-instr-prog-name">{p.name}</span>
                  <span className="bl-instr-prog-desc">{p.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const tabs: DrawerTabDef[] = [
    { id: "voice", label: "Voice", render: renderVoice },
    {
      id: "fx",
      label: "Effects",
      render: () => <TrackFxChain host={host} store={store} trackId={itrack.id} />,
    },
    {
      id: "mixer",
      label: "Mixer",
      render: () => (
        <TrackMixer
          host={host}
          store={store}
          track={itrack}
          anySolo={anySolo}
          hint="The full mixer (all tracks + sends) lives on the Mix page; this controls this voice right here."
        />
      ),
    },
    {
      id: "score",
      label: "Score",
      render: () => <ScorePlaceholder host={host} store={store} trackId={itrack.id} audio={audio} />,
    },
  ]

  return (
    <div className={`bl-instr bl-trackpage bl-instr--${drawer}`}>
      <section className="bl-instr-stage bl-trackpage-grid bl-grid">
        {/* ---- track switcher + Record arm ---- */}
        <div className="bl-instr-bar" data-bl-nocapture>
          <div className="bl-instr-tracks">
            {instrumentTracks.map((t) => (
              <div
                key={t.id}
                className={`bl-instr-track${t.id === trackId ? " is-on" : ""}`}
              >
                <button
                  type="button"
                  className="bl-instr-track-pick"
                  aria-pressed={t.id === trackId}
                  aria-label={`Select ${t.name}`}
                  onClick={() => setTrackId(t.id)}
                >
                  <span
                    className="bl-dot"
                    style={{ background: t.color ?? "var(--bl-accent)" }}
                  />
                </button>
                <TrackNameEdit
                  store={store}
                  trackId={t.id}
                  name={t.name}
                  className="bl-instr-track-name"
                />
                {instrumentTracks.length > 1 && (
                  <button
                    type="button"
                    className="bl-instr-track-remove"
                    aria-label={`Remove ${t.name}`}
                    title="Remove track"
                    onClick={() => removeTrack(t.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="bl-instr-add"
              onClick={addInstrumentTrack}
              aria-label="Add instrument track"
              title="Add instrument track"
            >
              <Glyph name="wave" size={14} />
              <span>Add</span>
            </button>
          </div>
          <button
            type="button"
            className={`bl-chip${record ? " is-armed" : ""}`}
            aria-pressed={record}
            onClick={() => setRecord((r) => !r)}
          >
            {record ? "Recording" : "Record"}
          </button>
        </div>

        {/* ---- the playable ribbon (headline) ---- */}
        <div className="bl-instr-ribbon">
          <InstrumentRibbon
            host={host}
            store={store}
            audio={audio}
            trackId={itrack.id}
            record={record}
            showRecord={false}
          />
        </div>

        {/* ---- voice-type segment ---- */}
        <div className="bl-instr-voicetype" data-bl-nocapture>
          <div className="bl-seg" role="group" aria-label="Voice type">
            {VOICE_TYPES.map((vt) => (
              <button
                key={vt}
                type="button"
                className={`bl-seg-btn${vt === activeVoiceType ? " is-on" : ""}`}
                aria-pressed={vt === activeVoiceType}
                onClick={() => chooseVoiceType(vt)}
              >
                {VOICE_TYPE_LABEL[vt]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---- the PIPELINE DRAWER (Voice / Effects / Mixer / Score) ---- */}
      <TrackDrawer
        label="Instrument track pipeline"
        tabsLabel="Instrument tools"
        tabs={tabs}
        activeTab={tab}
        onTab={openTab}
        state={drawer}
        setState={setDrawer}
      />
    </div>
  )
}
