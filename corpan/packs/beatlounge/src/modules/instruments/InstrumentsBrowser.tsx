/**
 * beatlounge — instruments IMMERSIVE: the General-MIDI instrument browser.
 *
 *  • Track switcher (chips) so one browser re-voices any instrument track.
 *  • Current voice header — what the track plays right now.
 *  • Browse by FAMILY (Piano, Organ, Strings, Bass, ...) → pick a PROGRAM.
 *  • Picking a program dispatches ONE `setInstrument` (a soundfont voice at the
 *    right GM program) — a single undo step — and auditions it via
 *    host.previewTrack so you hear the instrument the moment you choose it.
 *
 * The store is the only write path; drum tracks are excluded (they have their
 * own kit editor). No emoji; reuses the frozen bl-ui chips/dots + --bl-* tokens.
 */

import { useEffect, useMemo, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { GM_FAMILIES } from "../../instruments/gmPrograms"
import { GM_SOUNDFONT_ID } from "../../instruments/gmSoundbank"
import { instrumentSummary } from "./instrumentSummary"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  trackId: Id
}

/** A pitch in the middle of the keyboard so auditions are representative. */
const PREVIEW_PITCH = 60

export const InstrumentsBrowser = ({ host, store, trackId: initialTrackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const [trackId, setTrackId] = useState<Id>(initialTrackId)

  // Only non-drum instrument tracks are re-voiceable here.
  const instrumentTracks = useMemo(
    () =>
      doc.tracks.filter(
        (t) => isInstrumentTrack(t) && t.instrument.kind !== "drumSampler"
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
  const currentProgram =
    config && config.kind === "soundfont" && config.bank !== 128 ? config.program : -1

  // Open the family that owns the current program, else the first.
  const [openFamily, setOpenFamily] = useState<string>(() => {
    const fam = GM_FAMILIES.find(
      (f) => currentProgram >= f.programs[0].program && currentProgram <= f.programs[7].program
    )
    return fam?.id ?? GM_FAMILIES[0].id
  })

  if (!track || !isInstrumentTrack(track)) {
    return <div className="bl-grid-empty">No instrument track to voice.</div>
  }

  const chooseProgram = (program: number) => {
    store.dispatch({
      t: "setInstrument",
      trackId: track.id,
      config: { kind: "soundfont", soundfontId: GM_SOUNDFONT_ID, program, bank: 0 },
    })
    // Audition the freshly-set voice (host resumes audio on first gesture).
    host.previewTrack(track.id, 0.9, PREVIEW_PITCH)
  }

  const family = GM_FAMILIES.find((f) => f.id === openFamily) ?? GM_FAMILIES[0]

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
                className={`bl-chip${t.id === track.id ? " is-on" : ""}`}
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
        </div>
      </div>

      <div className="bl-instr-now">
        <span className="bl-instr-now-label">Now playing</span>
        <span className="bl-instr-now-name">
          {config ? instrumentSummary(config) : "—"}
        </span>
      </div>

      <div className="bl-instr-browser">
        <div className="bl-instr-families" role="tablist" aria-label="Instrument families">
          {GM_FAMILIES.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === openFamily}
              className={`bl-chip${f.id === openFamily ? " is-on" : ""}`}
              onClick={() => setOpenFamily(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="bl-instr-programs" role="listbox" aria-label={`${family.label} instruments`}>
          {family.programs.map((p) => {
            const selected = p.program === currentProgram
            return (
              <button
                key={p.program}
                type="button"
                role="option"
                aria-selected={selected}
                className={`bl-instr-prog${selected ? " is-on" : ""}`}
                onClick={() => chooseProgram(p.program)}
              >
                <span className="bl-instr-prog-name">{p.name}</span>
                <span className="bl-instr-prog-num">{p.program}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bl-instr-foot" data-bl-nocapture>
        <button
          type="button"
          className="bl-chip"
          onClick={() => host.previewTrack(track.id, 0.9, PREVIEW_PITCH)}
        >
          Audition
        </button>
        <span className="bl-instr-foot-hint">General MIDI</span>
      </div>
    </div>
  )
}
