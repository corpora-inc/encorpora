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
 *  • The UNIFIED Voice tab in the bottom drawer (see VOICES.md): ONE browser of
 *    families (with a leading "Raw" bank that folds the bare oscillators in as
 *    ordinary pickable voices) → presets; picking a preset re-voices and STAYS
 *    PUT (no jump). When the active voice is an analog patch, an on-demand "Shape
 *    this voice" disclosure reveals the analog knobs IN PLACE — never an auto
 *    jump just because a preset is analog under the hood.
 *  • A bottom <TrackDrawer> (Voice / Effects / Mixer / Score), copying the Drums
 *    page pattern: Effects + Mixer reuse the shared track-studio panels, Score
 *    reserves the step-editor seam (WS-F).
 *
 * The store is the only write path; drum tracks are excluded (their own kit
 * editor lives on the Drums page). No emoji; --bl-* tokens only.
 */

import { useMemo, useRef, useState } from "react"
import { ct } from "../../i18n/strings"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import { useRecordArm } from "../../store/recordArm"
import {
  findTrack,
  isInstrumentTrack,
  type Id,
  type InstrumentTrack,
} from "../../model/document"
import {
  getStoredInstrumentTrackId,
  seedSelectionOnMount,
  useSelectedInstrument,
} from "../../store/selectedInstrument"
import { HarmonyPanel } from "../composer/HarmonyPanel"
import { harmonySummary } from "./harmonySummary"
import "../composer/styles.css"
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
  // The bound melodic track is a GLOBAL, doc-keyed selection (survives leaving
  // the page / going Home). The PERSISTED selection always WINS on mount; the
  // mount's trackId is only a fallback when there is NO stored selection yet.
  //
  // (Bug fixed: the mount passes `mount.trackId` resolved to the FIRST melodic
  // track, so unconditionally seeding from it on first render clobbered a
  // persisted pick — re-entering Instruments snapped back to track 1. Now we
  // only seed when nothing is stored.)
  const { trackId: selectedTrackId, select } = useSelectedInstrument(doc)
  const seededRef = useRef(false)
  if (!seededRef.current) {
    seededRef.current = true
    const seed = seedSelectionOnMount(
      doc,
      getStoredInstrumentTrackId(doc.id),
      initialTrackId
    )
    if (seed) select(seed)
  }
  const trackId = selectedTrackId
  const setTrackId = select

  const [tab, setTab] = useState<string>("voice")
  // Start with the drawer DOWN (peek) so the header (harmony + switcher + Record)
  // and the full ribbon are both visible; raise it to work the FX/Mixer/Score.
  const [drawer, setDrawer] = useState<DrawerState>("peek")
  // Record arm is PER-TRACK + persisted (never a shared transient flag): each
  // voice remembers its own arm, default OFF, and turning it off sticks.
  const { armed: record, setArmed: setRecord } = useRecordArm(selectedTrackId)
  // The open browser bank: a preset family, or "raw" (the bare-oscillator bank).
  const [openBank, setOpenBank] = useState<PresetFamily | "raw" | null>(null)
  const [oscWave, setOscWave] = useState<OscWave>("triangle")
  // The analog "Shape this voice" disclosure (on-demand, never auto-jumps).
  const [tweakOpen, setTweakOpen] = useState(false)
  // The harmony bar leads the page as a compact row that expands to a popover.
  const [harmonyOpen, setHarmonyOpen] = useState(false)
  // The voice switcher collapses into a compact dropdown (switch / rename / remove
  // / add) so it never eats a wrapping chip-row of vertical space.
  const [voiceOpen, setVoiceOpen] = useState(false)

  const instrumentTracks = useMemo(
    () => doc.tracks.filter((t): t is InstrumentTrack => isMelodicTrack(t)),
    [doc.tracks]
  )

  const summary = useMemo(() => harmonySummary(doc), [doc])

  const track = trackId ? findTrack(doc, trackId) : undefined
  const config = track && isInstrumentTrack(track) ? track.instrument : undefined
  const activeVoiceType: VoiceType = config ? voiceTypeOf(config) : "preset"
  const activePreset = config ? matchPreset(config) : undefined

  const groups = useMemo(() => presetsByFamily(), [])
  // The active bank: an explicit pick, else follow the current voice — "raw" when
  // the voice is a bare oscillator, else the active preset's family, else first.
  const activeBank: PresetFamily | "raw" =
    openBank ??
    (activeVoiceType === "osc"
      ? "raw"
      : (activePreset && familyOfPreset(activePreset.id)) ?? groups[0].family)
  // The open preset family group (undefined while the Raw bank is open).
  const family = groups.find((g) => g.family === activeBank)

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

  // Re-voice the bound track to a preset; STAY PUT (no jump). One undo step.
  const choosePreset = (presetId: string) => {
    const cfg = instantiatePreset(presetId)
    if (!cfg || !track || !isInstrumentTrack(track)) return
    setTweakOpen(false) // a fresh preset starts un-tweaked
    store.dispatch({ t: "setInstrument", trackId: track.id, config: cfg })
  }

  // Pick a bare oscillator from the Raw bank (the simplest "preset"). One undo.
  const chooseOsc = (wave: OscWave) => {
    setOscWave(wave)
    setTweakOpen(false)
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
        <div className="bl-grid-empty">{ct("instruments.addTrackToStart")}</div>
      </div>
    )
  }
  const itrack = track

  // The bare oscillator currently in play (highlights its card in the Raw bank).
  const curOscWave: OscWave =
    itrack.instrument.kind === "synth" ? (itrack.instrument.osc as OscWave) : oscWave

  // ---- the unified Voice drawer tab: families (incl. Raw) → presets --------
  const renderVoice = () => (
    <div className="bl-instr-browser">
      {/* families rail — a leading "Raw" bank folds in the bare oscillators */}
      <div className="bl-instr-families" role="tablist" aria-label={ct("instruments.voiceBanks")}>
        <button
          type="button"
          role="tab"
          aria-selected={activeBank === "raw"}
          className={`bl-chip${activeBank === "raw" ? " is-on" : ""}`}
          onClick={() => setOpenBank("raw")}
        >
          {ct("instruments.raw")}
        </button>
        {groups.map((g) => (
          <button
            key={g.family}
            type="button"
            role="tab"
            aria-selected={g.family === activeBank}
            className={`bl-chip${g.family === activeBank ? " is-on" : ""}`}
            onClick={() => setOpenBank(g.family)}
          >
            {FAMILY_LABEL[g.family]}
          </button>
        ))}
      </div>

      {/* grid: the Raw bank's oscillators, OR the open family's presets */}
      {activeBank === "raw" ? (
        <div className="bl-instr-programs" role="listbox" aria-label={ct("instruments.rawOscillators")}>
          {OSC_WAVES.map((w) => {
            const selected = activeVoiceType === "osc" && curOscWave === w
            return (
              <button
                key={w}
                type="button"
                role="option"
                aria-selected={selected}
                className={`bl-instr-prog${selected ? " is-on" : ""}`}
                onClick={() => chooseOsc(w)}
              >
                <span className="bl-instr-prog-text">
                  <span className="bl-instr-prog-name">{OSC_LABEL[w]}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        family && (
          <div
            className="bl-instr-programs"
            role="listbox"
            aria-label={ct("instruments.familyInstruments", { family: FAMILY_LABEL[family.family] })}
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
        )
      )}

      {/* on-demand analog tweak — only for analog patches, never an auto jump */}
      {activeVoiceType === "analog" && (
        <div className="bl-instr-tweak">
          <button
            type="button"
            className={`bl-chip bl-instr-tweak-toggle${tweakOpen ? " is-on" : ""}`}
            aria-expanded={tweakOpen}
            onClick={() => setTweakOpen((o) => !o)}
          >
            {ct("instruments.shapeThisVoice")}
            <span className="bl-instr-tweak-caret" aria-hidden="true">
              {tweakOpen ? "▴" : "▾"}
            </span>
          </button>
          {tweakOpen && <AnalogPanel host={host} store={store} trackId={itrack.id} />}
        </div>
      )}
    </div>
  )

  const tabs: DrawerTabDef[] = [
    { id: "voice", label: ct("instruments.tabVoice"), render: renderVoice },
    {
      id: "fx",
      label: ct("instruments.tabEffects"),
      render: () => <TrackFxChain host={host} store={store} trackId={itrack.id} />,
    },
    {
      id: "mixer",
      label: ct("instruments.tabMixer"),
      render: () => (
        <TrackMixer
          host={host}
          store={store}
          track={itrack}
          anySolo={anySolo}
        />
      ),
    },
    {
      id: "score",
      label: ct("instruments.tabScore"),
      render: () => <ScorePlaceholder host={host} store={store} trackId={itrack.id} audio={audio} />,
    },
  ]

  return (
    <div className={`bl-instr bl-trackpage bl-instr--${drawer}`}>
      <section className="bl-instr-stage bl-trackpage-grid bl-grid">
        {/* ---- header (shown only when the drawer is DOWN): the harmony summary
             and the voice dropdown share ONE compact row. Lock/Free + Record and
             the octave window live in the ribbon's own control strip below, so the
             whole chrome is 3 tidy rows. All of it hides as the drawer rises so the
             ribbon takes the space. ---- */}
        <div className="bl-instr-head" data-bl-nocapture>
          <div className="bl-instr-harmony">
            <button
              type="button"
              className={`bl-instr-harmony-row${harmonyOpen ? " is-open" : ""}`}
              aria-expanded={harmonyOpen}
              aria-label={ct("harmony.title")}
              onClick={() => setHarmonyOpen((o) => !o)}
            >
              <Glyph name="wave" size={14} />
              <span className="bl-instr-harmony-tonic">{summary.tonic}</span>
              <span className="bl-instr-harmony-detail">{summary.detail}</span>
              <span className="bl-instr-harmony-caret" aria-hidden="true">
                {harmonyOpen ? "▴" : "▾"}
              </span>
            </button>
            {harmonyOpen && (
              <>
                <button
                  type="button"
                  className="bl-instr-harmony-scrim"
                  aria-label={ct("instruments.closeHarmony")}
                  onClick={() => setHarmonyOpen(false)}
                />
                <div className="bl-instr-harmony-pop" role="dialog" aria-label={ct("harmony.title")}>
                  <HarmonyPanel host={host} store={store} snapTrackId={itrack.id} />
                </div>
              </>
            )}
          </div>

          {/* the voice switcher, collapsed into a compact dropdown (switch /
              rename / remove / add) so it never eats a wrapping chip-row */}
          <div className="bl-instr-voicepick">
            <button
              type="button"
              className={`bl-instr-voicebtn${voiceOpen ? " is-open" : ""}`}
              aria-expanded={voiceOpen}
              aria-haspopup="menu"
              aria-label={ct("instruments.tabVoice")}
              onClick={() => setVoiceOpen((o) => !o)}
            >
              <span
                className="bl-dot"
                style={{ background: itrack.color ?? "var(--bl-accent)" }}
              />
              <span className="bl-instr-voicebtn-name">{itrack.name}</span>
              <span className="bl-instr-voicebtn-caret" aria-hidden="true">
                {voiceOpen ? "▴" : "▾"}
              </span>
            </button>
            {voiceOpen && (
              <>
                <button
                  type="button"
                  className="bl-instr-harmony-scrim"
                  aria-label={ct("instruments.closeVoices")}
                  onClick={() => setVoiceOpen(false)}
                />
                <div className="bl-instr-voice-menu" role="menu" aria-label={ct("instruments.voices")}>
                  {instrumentTracks.map((t) => (
                    <div
                      key={t.id}
                      className={`bl-instr-voice-item${t.id === trackId ? " is-on" : ""}`}
                    >
                      {/* TrackNameEdit draws its OWN colour dot — no extra one here.
                          tap ⇒ switch + close; long-press the name ⇒ rename */}
                      <TrackNameEdit
                        store={store}
                        trackId={t.id}
                        name={t.name}
                        color={t.color ?? "var(--bl-accent)"}
                        className="bl-instr-voice-name"
                        onTap={() => {
                          setTrackId(t.id)
                          setVoiceOpen(false)
                        }}
                      />
                      {instrumentTracks.length > 1 && (
                        <button
                          type="button"
                          className="bl-instr-voice-remove"
                          aria-label={ct("instruments.removeNamed", { name: t.name })}
                          title={ct("instruments.removeTrack")}
                          onClick={() => removeTrack(t.id)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="bl-instr-voice-add"
                    onClick={() => {
                      addInstrumentTrack()
                      setVoiceOpen(false)
                    }}
                  >
                    <Glyph name="wave" size={14} />
                    <span>{ct("instruments.addVoice")}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- the playable ribbon (headline). Record rides in the ribbon's own
             control strip (next to Lock/Free) via headerSlot. ---- */}
        <div className="bl-instr-ribbon">
          <InstrumentRibbon
            host={host}
            store={store}
            audio={audio}
            trackId={itrack.id}
            showRecord={false}
            headerSlot={
              <button
                type="button"
                className={`bl-chip bl-instr-record${record ? " is-armed" : ""}`}
                aria-pressed={record}
                onClick={() => setRecord(!record)}
              >
                {record ? ct("instrumentSurface.recording") : ct("instrumentSurface.record")}
              </button>
            }
          />
        </div>

      </section>

      {/* ---- the PIPELINE DRAWER (Voice / Effects / Mixer / Score) ---- */}
      <TrackDrawer
        label={ct("instruments.pipeline")}
        tabsLabel={ct("instruments.tools")}
        tabs={tabs}
        activeTab={tab}
        onTab={openTab}
        state={drawer}
        setState={setDrawer}
      />
    </div>
  )
}
