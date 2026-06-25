/**
 * beatlounge — the HARMONY BAR body, EXTRACTED so it mounts in two places with
 * identical behavior: the standalone "Harmony" tile (`ComposerImmersive` is now a
 * thin wrapper) AND the TOP of the Instruments page (`InstrumentsBrowser`, where
 * harmony governs every voice and so leads the page).
 *
 * "Both in one Harmony bar": a tonic + EITHER a mode OR a chord progression,
 * both feeding the one resolver every melodic module reads. There is NO chord
 * TEXT input — chords are placed on a visual grid across the loop's beats, or
 * dropped in from the 994-progression browser. Every edit dispatches ONE command
 * (undo-friendly). Changing anything here makes the piano-roll + ribbon follow.
 *
 * NEW: changing the mode/scale/progression SNAPS the WHOLE SONG into the new
 * key. Every harmony-changing dispatch routes through `applyHarmony`, which
 * dispatches the harmony command and THEN — against the resulting doc —
 * dispatches `snapAllMelodicTracksToHarmony(doc)` so EVERY melodic track follows
 * (closest in-key, drums skipped) in ONE undo step. Setup-don't-play: the snap
 * only writes notes; it never starts the transport. When `snap` is false the
 * panel behaves exactly as before (no snap) — so old call sites are unchanged.
 */

import { useMemo, useState } from "react"
import { ct } from "../../i18n/strings"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import {
  docHarmony,
  type HarmonyScaleFamily,
  type MaqamSchool,
  type Id,
} from "../../model/document"
import type { Command } from "../../model/command"
import { snapAllMelodicTracksToHarmony } from "../instruments/snapHarmony"
import { CORPUS, listByFamily, FAMILIES, type CorpusProgression } from "../../music/chords"
import {
  HARMONY_FAMILIES,
  PALETTE_QUALITY_OPTIONS,
  TONIC_NAMES,
  beatsPerBar,
  buildChordGrid,
  corpusProgressionToHarmony,
  displayChord,
  modeById,
  noteRow,
  paletteRoots,
  scaleIsMicrotonal,
  scalesForFamily,
} from "./harmonyView"

export interface HarmonyPanelProps {
  host: BeatloungeHost
  store: BeatloungeStore
  /**
   * Presence ⇒ a harmony change snaps the WHOLE SONG (every melodic track) into
   * the new key. Omit ⇒ no snap (legacy parity). The id itself is no longer used
   * to pick a single track — the snap is song-wide — but the prop is kept so the
   * Instruments page and the standalone tile opt in exactly as before.
   */
  snapTrackId?: Id
}

export const HarmonyPanel = ({ host, store, snapTrackId }: HarmonyPanelProps) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const h = docHarmony(doc)

  // The beat-slot currently being edited (the chord palette opens for it).
  const [editSlotTick, setEditSlotTick] = useState<number | null>(null)
  // Whether the 994-progression browser is open.
  const [browseOpen, setBrowseOpen] = useState(false)

  const row = useMemo(() => noteRow(doc), [doc])
  const grid = useMemo(() => buildChordGrid(doc), [doc])
  const mode = modeById(h.scale.family, h.scale.id)
  const micro = scaleIsMicrotonal(mode)

  /**
   * Dispatch a harmony-changing command and THEN snap the WHOLE SONG (every
   * melodic track) into the resulting key — one extra undo step, only when notes
   * actually move. The snap reads the POST-change doc (`store.vanilla`) so it
   * quantizes against the new harmony. No `snapTrackId` ⇒ plain dispatch (legacy
   * parity).
   */
  const applyHarmony = (command: Command): void => {
    store.dispatch(command)
    if (!snapTrackId) return
    const snap = snapAllMelodicTracksToHarmony(store.vanilla.getState().doc)
    if (snap) store.dispatch(snap)
  }

  return (
    <div className="bl-hb">
      {/* ---- tonic + Mode⇄Progression toggle ---- */}
      <div className="bl-hb-bar" data-bl-nocapture>
        <label className="bl-hb-tonic">
          <span className="bl-hb-cap">{ct("harmony.tonic")}</span>
          <select
            className="bl-hb-select"
            value={h.tonic}
            onChange={(e) => applyHarmony({ t: "setTonic", pc: Number(e.target.value) })}
          >
            {TONIC_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="bl-seg bl-hb-mode" role="group" aria-label={ct("harmony.source")}>
          <button
            type="button"
            className={`bl-seg-btn${h.mode === "modal" ? " is-on" : ""}`}
            aria-pressed={h.mode === "modal"}
            onClick={() => applyHarmony({ t: "setHarmonyMode", mode: "modal" })}
          >
            Mode
          </button>
          <button
            type="button"
            className={`bl-seg-btn${h.mode === "chordal" ? " is-on" : ""}`}
            aria-pressed={h.mode === "chordal"}
            onClick={() => applyHarmony({ t: "setHarmonyMode", mode: "chordal" })}
          >
            Progression
          </button>
        </div>
      </div>

      {h.mode === "modal" ? (
        <ModePanel
          onChange={applyHarmony}
          family={h.scale.family}
          scaleId={h.scale.id}
          school={h.scale.school ?? "grid"}
          micro={micro}
        />
      ) : (
        <ProgressionPanel
          grid={grid}
          beatsPerBar={beatsPerBar(doc)}
          editSlotTick={editSlotTick}
          onEditSlot={setEditSlotTick}
          onBrowse={() => setBrowseOpen(true)}
        />
      )}

      {/* ---- the resulting note row (the resolver's active set) ---- */}
      <div className="bl-hb-row" data-bl-nocapture aria-label={ct("harmony.notesInHarmony")}>
        {row.length === 0 ? (
          <span className="bl-hb-rowempty">{ct("harmony.tapBeatToPlaceChord")}</span>
        ) : (
          row.map((c, i) => (
            <span key={i} className={`bl-hb-note${c.tonic ? " is-tonic" : ""}`}>
              <span className="bl-hb-note-name">{c.label}</span>
              {c.degree && <span className="bl-hb-note-deg">{c.degree}</span>}
            </span>
          ))
        )}
      </div>

      {/* ---- chord palette sheet (opens for a tapped slot) ---- */}
      {editSlotTick != null && h.mode === "chordal" && (
        <ChordPalette
          doc={doc}
          existing={grid.find((s) => s.tick === editSlotTick)?.symbol ?? null}
          onPick={(symbol) => {
            applyHarmony({ t: "setChordAt", tick: editSlotTick, symbol })
            setEditSlotTick(null)
          }}
          onClear={() => {
            const chord = docHarmony(store.vanilla.getState().doc).progression.find(
              (c) => c.tick === editSlotTick
            )
            if (chord) applyHarmony({ t: "removeChord", chordId: chord.id })
            setEditSlotTick(null)
          }}
          onClose={() => setEditSlotTick(null)}
        />
      )}

      {/* ---- 994-progression browser ---- */}
      {browseOpen && (
        <ProgressionBrowser
          onPick={(prog) => {
            const { chords, loopTicks } = corpusProgressionToHarmony(prog, h.tonic)
            applyHarmony({
              t: "batch",
              label: "Drop progression",
              commands: [
                { t: "setHarmonyMode", mode: "chordal" },
                { t: "setLoopLength", ticks: loopTicks },
                { t: "setProgression", chords },
              ],
            })
            setBrowseOpen(false)
            host.toast(ct("harmony.chordsPlaced", { n: String(chords.length) }))
          }}
          onClose={() => setBrowseOpen(false)}
        />
      )}
    </div>
  )
}

// ============================================================== Mode panel
interface ModePanelProps {
  onChange: (command: Command) => void
  family: HarmonyScaleFamily
  scaleId: string
  school: MaqamSchool
  micro: boolean
}

/** Maqam regional intonation schools (label via i18n; ids mirror the model). */
const SCHOOL_IDS: MaqamSchool[] = ["grid", "just", "egyptian", "syrian"]
const schoolLabel = (id: MaqamSchool): string => {
  switch (id) {
    case "grid":
      return ct("harmony.schoolGrid")
    case "just":
      return ct("harmony.schoolJust")
    case "egyptian":
      return ct("harmony.schoolEgyptian")
    case "syrian":
      return ct("harmony.schoolSyrian")
  }
}

const ModePanel = ({ onChange, family, scaleId, school, micro }: ModePanelProps) => {
  const scales = useMemo(() => scalesForFamily(family), [family])
  return (
    <div className="bl-hb-mode-panel" data-bl-nocapture>
      <div className="bl-seg bl-hb-fam" role="group" aria-label={ct("harmony.scaleFamily")}>
        {HARMONY_FAMILIES.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`bl-seg-btn${family === f.id ? " is-on" : ""}`}
            aria-pressed={family === f.id}
            onClick={() => {
              // Switch family → pick its first scale (a valid id always exists).
              const first = scalesForFamily(f.id)[0]
              if (first) onChange({ t: "setScale", family: f.id, id: first.id })
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="bl-hb-scale">
        <span className="bl-hb-cap">{ct("harmony.scale")}</span>
        <select
          className="bl-hb-select"
          value={scaleId}
          onChange={(e) => onChange({ t: "setScale", family, id: e.target.value })}
        >
          {scales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {family === "maqam" && (
        <label className="bl-hb-scale">
          <span className="bl-hb-cap">{ct("harmony.school")}</span>
          <select
            className="bl-hb-select"
            value={school}
            onChange={(e) => onChange({ t: "setSchool", school: e.target.value as MaqamSchool })}
          >
            {SCHOOL_IDS.map((id) => (
              <option key={id} value={id}>
                {schoolLabel(id)}
              </option>
            ))}
          </select>
        </label>
      )}
      {micro && (
        <span className="bl-hb-micro" aria-hidden="true">
          microtonal
        </span>
      )}
    </div>
  )
}

// ============================================================== Progression grid
interface ProgressionPanelProps {
  grid: ReturnType<typeof buildChordGrid>
  beatsPerBar: number
  editSlotTick: number | null
  onEditSlot: (tick: number) => void
  onBrowse: () => void
}

const ProgressionPanel = ({
  grid,
  beatsPerBar,
  editSlotTick,
  onEditSlot,
  onBrowse,
}: ProgressionPanelProps) => (
  <div className="bl-hb-prog" data-bl-nocapture>
    <div className="bl-hb-grid" role="group" aria-label={ct("harmony.chordsOverLoop")}>
      {grid.map((slot) => (
        <button
          key={slot.tick}
          type="button"
          className={
            "bl-hb-slot" +
            (slot.symbol ? " is-chord" : "") +
            (slot.sustained ? " is-sustained" : "") +
            (slot.beatInBar === 0 ? " is-downbeat" : "") +
            (editSlotTick === slot.tick ? " is-editing" : "")
          }
          aria-label={
            slot.symbol
              ? ct("harmony.beatChord", { n: String(slot.index + 1), chord: displayChord(slot.symbol) })
              : ct("harmony.beatEmpty", { n: String(slot.index + 1) })
          }
          onClick={() => onEditSlot(slot.tick)}
        >
          {slot.symbol ? (
            <span className="bl-hb-slot-name">{displayChord(slot.symbol)}</span>
          ) : slot.sustained ? (
            <span className="bl-hb-slot-tie" aria-hidden="true" />
          ) : (
            <span className="bl-hb-slot-add" aria-hidden="true">
              +
            </span>
          )}
          {slot.beatInBar === 0 && (
            <span className="bl-hb-slot-bar" aria-hidden="true">
              {Math.floor(slot.index / beatsPerBar) + 1}
            </span>
          )}
        </button>
      ))}
    </div>
    <button type="button" className="bl-chip bl-hb-browse" onClick={onBrowse}>
      {ct("harmony.browseProgressions")}
    </button>
  </div>
)

// ============================================================== Chord palette
interface ChordPaletteProps {
  doc: Parameters<typeof paletteRoots>[0]
  existing: string | null
  onPick: (symbol: string) => void
  onClear: () => void
  onClose: () => void
}

const ChordPalette = ({ doc, existing, onPick, onClear, onClose }: ChordPaletteProps) => {
  const roots = useMemo(() => paletteRoots(doc), [doc])
  const [root, setRoot] = useState<string>(() => roots[0] ?? "C")
  return (
    <div className="bl-hb-sheet" role="dialog" aria-label={ct("harmony.chooseChord")}>
      <div className="bl-hb-sheet-head">
        <span className="bl-hb-sheet-title">Chord</span>
        <button type="button" className="bl-icon-btn" aria-label={ct("harmony.close")} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="bl-hb-roots" role="group" aria-label="Root">
        {roots.map((r) => (
          <button
            key={r}
            type="button"
            className={`bl-hb-root${root === r ? " is-on" : ""}`}
            aria-pressed={root === r}
            onClick={() => setRoot(r)}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="bl-hb-quals" role="group" aria-label="Quality">
        {PALETTE_QUALITY_OPTIONS.map((q) => {
          const symbol = `${root}${q.suffix}`
          return (
            <button
              key={q.label}
              type="button"
              className={`bl-hb-qual${existing === symbol ? " is-on" : ""}`}
              onClick={() => onPick(symbol)}
            >
              {`${root}${q.suffix || ""}`}
            </button>
          )
        })}
      </div>
      {existing && (
        <button type="button" className="bl-chip is-danger bl-hb-sheet-clear" onClick={onClear}>
          {ct("harmony.clearBeat")}
        </button>
      )}
    </div>
  )
}

// ============================================================== 994 browser
interface ProgressionBrowserProps {
  onPick: (prog: CorpusProgression) => void
  onClose: () => void
}

const ProgressionBrowser = ({ onPick, onClose }: ProgressionBrowserProps) => {
  const [family, setFamily] = useState<(typeof FAMILIES)[number]>("pop-loop")
  const items = useMemo(() => listByFamily(family).slice(0, 60), [family])
  return (
    <div className="bl-hb-sheet bl-hb-browser" role="dialog" aria-label={ct("harmony.browseProgressions")}>
      <div className="bl-hb-sheet-head">
        <span className="bl-hb-sheet-title">Progressions</span>
        <span className="bl-hb-sheet-count">{CORPUS.length}</span>
        <button type="button" className="bl-icon-btn" aria-label={ct("harmony.close")} onClick={onClose}>
          ✕
        </button>
      </div>
      <select
        className="bl-hb-select bl-hb-browser-fam"
        value={family}
        aria-label="Family"
        onChange={(e) => setFamily(e.target.value as (typeof FAMILIES)[number])}
      >
        {FAMILIES.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <div className="bl-hb-browser-list">
        {items.map((p) => (
          <button key={p.id} type="button" className="bl-hb-browser-item" onClick={() => onPick(p)}>
            <span className="bl-hb-browser-name">{p.id.split(":").pop()}</span>
            <span className="bl-hb-browser-tags">{p.tags.slice(0, 2).join(" · ")}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
