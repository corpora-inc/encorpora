/**
 * beatlounge — instruments IMMERSIVE: a PLAYABLE software-instrument surface.
 *
 *  • Track switcher (chips) so one view re-voices any instrument track, with an
 *    "Add" affordance to spawn a NEW melodic track (multiple synth voices).
 *  • The headline: a multitouch PLAY surface (continuous-pitch string field,
 *    fretless / chromatic / scale modes) playing the bound track's voice live.
 *  • Browse presets grouped by FAMILY (Keys, Bass, Leads, Pads, …) → pick to
 *    re-voice. Picking dispatches ONE `setInstrument` (a single undo step); you
 *    then HEAR it by playing the surface — there is no separate audition button.
 *
 * The store is the only write path; drum tracks are excluded (they have their
 * own kit editor). No emoji; reuses the frozen bl-ui chips/dots + --bl-* tokens.
 * Pure synthesis presets are the working instrument content.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import {
  findTrack,
  isInstrumentTrack,
  type Id,
  type InstrumentTrack,
} from "../../model/document"
import { activePitches, quantizeToHarmony } from "../../music/resolver"
import {
  FAMILY_LABEL,
  familyOfPreset,
  instantiatePreset,
  matchPreset,
  presetsByFamily,
  type PresetFamily,
} from "../../instruments/presets"
import { Glyph } from "../../bl-ui"
import { PlaySurface } from "./PlaySurface"
import { newInstrumentTrackInit } from "./addTrack"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
}

export const InstrumentsBrowser = ({ host, store, trackId: initialTrackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const [trackId, setTrackId] = useState<Id>(initialTrackId)

  // Only non-drum instrument tracks are re-voiceable here.
  const instrumentTracks = useMemo(
    () =>
      doc.tracks.filter(
        (t): t is InstrumentTrack =>
          isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
      ),
    [doc.tracks]
  )

  // Keep the bound track valid as the doc changes.
  useEffect(() => {
    if (!instrumentTracks.some((t) => t.id === trackId) && instrumentTracks[0]) {
      setTrackId(instrumentTracks[0].id)
    }
  }, [instrumentTracks, trackId])

  const track = findTrack(doc, trackId)
  const config = track && isInstrumentTrack(track) ? track.instrument : undefined
  const activePreset = config ? matchPreset(config) : undefined

  const groups = useMemo(() => presetsByFamily(), [])

  // Wire the play surface's Scale mode to the GLOBAL harmony: the in-key pitch
  // classes (for markers) + a snap fn, both following the song's mode/chords live.
  const scalePitches = useMemo(() => activePitches(doc, 0).pcs, [doc])
  const quantizeToScale = useCallback(
    (midi: number) => quantizeToHarmony(midi, doc, 0),
    [doc]
  )

  // Open the family that owns the active preset, else the first.
  const [openFamily, setOpenFamily] = useState<PresetFamily>(
    () => (activePreset && familyOfPreset(activePreset.id)) ?? groups[0].family
  )
  // Track the family of the active preset as the bound track changes.
  useEffect(() => {
    const fam = activePreset && familyOfPreset(activePreset.id)
    if (fam) setOpenFamily(fam)
  }, [activePreset])

  const choosePreset = (presetId: string) => {
    const cfg = instantiatePreset(presetId)
    if (!cfg || !track || !isInstrumentTrack(track)) {
      console.warn("[instruments] cannot voice preset", presetId)
      return
    }
    // Re-voice the bound track (one undo step). You HEAR it by playing the
    // surface — the surface is the audition.
    store.dispatch({ t: "setInstrument", trackId: track.id, config: cfg })
  }

  const addInstrumentTrack = () => {
    // Pass the existing track NAMES so the new one gets a unique "Synth N"
    // (never a duplicate of a surviving strip after a delete).
    const init = newInstrumentTrackInit(doc.tracks.map((t) => t.name))
    store.dispatch({ t: "addTrack", track: init })
    // The reducer assigns the id; bind to the new track once it lands.
    if (init.id) setTrackId(init.id)
  }

  const family = groups.find((g) => g.family === openFamily) ?? groups[0]

  return (
    <div className="bl-instr">
      <div className="bl-instr-bar" data-bl-nocapture>
        <div className="bl-instr-tracks">
          {instrumentTracks.length === 0 ? (
            <span className="bl-instr-empty">No melodic tracks.</span>
          ) : (
            instrumentTracks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`bl-chip${t.id === trackId ? " is-on" : ""}`}
                onClick={() => setTrackId(t.id)}
              >
                <span
                  className="bl-dot"
                  style={{ background: t.color ?? "var(--bl-accent)" }}
                />
                {t.name}
              </button>
            ))
          )}
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
      </div>

      {!track || !isInstrumentTrack(track) ? (
        <div className="bl-grid-empty">Add an instrument track to start.</div>
      ) : (
        <>
          <PlaySurface
            host={host}
            trackId={track.id}
            scalePitches={scalePitches}
            quantizeToScale={quantizeToScale}
          />

          <div className="bl-instr-browser">
            <div
              className="bl-instr-families"
              role="tablist"
              aria-label="Instrument families"
            >
              {groups.map((g) => (
                <button
                  key={g.family}
                  type="button"
                  role="tab"
                  aria-selected={g.family === openFamily}
                  className={`bl-chip${g.family === openFamily ? " is-on" : ""}`}
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
        </>
      )}
    </div>
  )
}
