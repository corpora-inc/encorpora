/**
 * beatlounge — the HARMONY BAR (immersive). The top-level pitch world.
 *
 * "Both in one Harmony bar": a tonic + EITHER a mode OR a chord progression,
 * both feeding the one resolver every melodic module reads. There is NO chord
 * TEXT input — chords are placed on a visual grid across the loop's beats, or
 * dropped in from the 994-progression browser. Every edit dispatches ONE command
 * (undo-friendly). Changing anything here makes the piano-roll + ribbon follow.
 */

import { useMemo, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { AudioFacade } from "../../contracts/audioFacade"
import { useBeatloungeStore } from "../../store/store"
import {
  docHarmony,
  findTrack,
  isInstrumentTrack,
  type HarmonyScaleFamily,
  type Id,
} from "../../model/document"
import { Knob } from "../../bl-ui"
import { CORPUS, listByFamily, FAMILIES, type CorpusProgression } from "../../music/chords"
import {
  COMPOSER_FEELS,
  composeFromHarmony,
  defaultComposerSettings,
  nextEvolveSeed,
  rollSeed,
  type ComposerSettings,
} from "./composerState"
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

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

export const ComposerImmersive = ({ host, store, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const h = docHarmony(doc)
  const track = findTrack(doc, trackId)

  const [settings, setSettings] = useState<ComposerSettings>(defaultComposerSettings)
  // The beat-slot currently being edited (the chord palette opens for it).
  const [editSlotTick, setEditSlotTick] = useState<number | null>(null)
  // Whether the 994-progression browser is open.
  const [browseOpen, setBrowseOpen] = useState(false)

  const row = useMemo(() => noteRow(doc), [doc])
  const grid = useMemo(() => buildChordGrid(doc), [doc])
  const mode = modeById(h.scale.family, h.scale.id)
  const micro = scaleIsMicrotonal(mode)

  // ---- jam onto the synth (performance, not harmony) -----------------------
  const compose = (seed: number, label: string) => {
    const next = { ...settings, seed }
    setSettings(next)
    const { commands, noteCount, chordCount } = composeFromHarmony(
      store.vanilla.getState().doc,
      next,
      trackId
    )
    if (!commands.length) {
      host.toast("Set a mode or some chords first")
      return
    }
    const before = store.vanilla.getState().doc
    store.dispatch({ t: "batch", label, commands })
    host.toast(`${label}: ${noteCount} notes over ${chordCount} chords`, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }
  const onJam = () => compose(settings.seed || rollSeed(), "Jam")
  const onReroll = () => compose(rollSeed(), "Re-roll")
  const onEvolve = () => compose(nextEvolveSeed(settings.seed || 1), "Evolve")

  if (!track || !isInstrumentTrack(track)) {
    return <div className="bl-grid-empty">No synth track to compose onto.</div>
  }

  return (
    <div className="bl-hb">
      <div className="bl-hb-head" data-bl-nocapture>
        <span className="bl-hb-title">Harmony</span>
        <span className="bl-hb-sub">{track.name}</span>
      </div>

      {/* ---- tonic + Mode⇄Progression toggle ---- */}
      <div className="bl-hb-bar" data-bl-nocapture>
        <label className="bl-hb-tonic">
          <span className="bl-hb-cap">Tonic</span>
          <select
            className="bl-hb-select"
            value={h.tonic}
            onChange={(e) => store.dispatch({ t: "setTonic", pc: Number(e.target.value) })}
          >
            {TONIC_NAMES.map((n, i) => (
              <option key={n} value={i}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <div className="bl-seg bl-hb-mode" role="group" aria-label="Harmony source">
          <button
            type="button"
            className={`bl-seg-btn${h.mode === "modal" ? " is-on" : ""}`}
            aria-pressed={h.mode === "modal"}
            onClick={() => store.dispatch({ t: "setHarmonyMode", mode: "modal" })}
          >
            Mode
          </button>
          <button
            type="button"
            className={`bl-seg-btn${h.mode === "chordal" ? " is-on" : ""}`}
            aria-pressed={h.mode === "chordal"}
            onClick={() => store.dispatch({ t: "setHarmonyMode", mode: "chordal" })}
          >
            Progression
          </button>
        </div>
      </div>

      {h.mode === "modal" ? (
        <ModePanel store={store} family={h.scale.family} scaleId={h.scale.id} micro={micro} />
      ) : (
        <ProgressionPanel
          store={store}
          grid={grid}
          beatsPerBar={beatsPerBar(doc)}
          editSlotTick={editSlotTick}
          onEditSlot={setEditSlotTick}
          onBrowse={() => setBrowseOpen(true)}
        />
      )}

      {/* ---- the resulting note row (the resolver's active set) ---- */}
      <div className="bl-hb-row" data-bl-nocapture aria-label="Notes in the current harmony">
        {row.length === 0 ? (
          <span className="bl-hb-rowempty">Tap a beat to place a chord.</span>
        ) : (
          row.map((c, i) => (
            <span key={i} className={`bl-hb-note${c.tonic ? " is-tonic" : ""}`}>
              <span className="bl-hb-note-name">{c.label}</span>
              {c.degree && <span className="bl-hb-note-deg">{c.degree}</span>}
            </span>
          ))
        )}
      </div>

      {/* ---- jam onto the synth ---- */}
      <div className="bl-hb-jam" data-bl-nocapture>
        <Knob
          label="Density"
          value={settings.density}
          min={0}
          max={1}
          step={0.01}
          defaultValue={0.55}
          format={(v) => `${Math.round(v * 100)}`}
          onChange={(v) => setSettings((s) => ({ ...s, density: v }))}
        />
        <select
          className="bl-hb-select bl-hb-feel"
          value={settings.feel}
          aria-label="Feel"
          onChange={(e) => setSettings((s) => ({ ...s, feel: e.target.value as ComposerSettings["feel"] }))}
        >
          {COMPOSER_FEELS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className="bl-hb-jam-btns">
          <button type="button" className="bl-chip is-primary" onClick={onJam}>
            Jam
          </button>
          <button type="button" className="bl-chip" onClick={onReroll}>
            Re-roll
          </button>
          <button type="button" className="bl-chip" onClick={onEvolve}>
            Evolve
          </button>
        </div>
      </div>

      {/* ---- chord palette sheet (opens for a tapped slot) ---- */}
      {editSlotTick != null && h.mode === "chordal" && (
        <ChordPalette
          doc={doc}
          existing={grid.find((s) => s.tick === editSlotTick)?.symbol ?? null}
          onPick={(symbol) => {
            store.dispatch({ t: "setChordAt", tick: editSlotTick, symbol })
            setEditSlotTick(null)
          }}
          onClear={() => {
            const slot = grid.find((s) => s.tick === editSlotTick)
            const chord = docHarmony(store.vanilla.getState().doc).progression.find(
              (c) => c.tick === editSlotTick
            )
            if (chord) store.dispatch({ t: "removeChord", chordId: chord.id })
            void slot
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
            store.dispatch({
              t: "batch",
              label: "Drop progression",
              commands: [
                { t: "setHarmonyMode", mode: "chordal" },
                { t: "setLoopLength", ticks: loopTicks },
                { t: "setProgression", chords },
              ],
            })
            setBrowseOpen(false)
            host.toast(`${chords.length} chords placed`)
          }}
          onClose={() => setBrowseOpen(false)}
        />
      )}
    </div>
  )
}

// ============================================================== Mode panel
interface ModePanelProps {
  store: BeatloungeStore
  family: HarmonyScaleFamily
  scaleId: string
  micro: boolean
}

const ModePanel = ({ store, family, scaleId, micro }: ModePanelProps) => {
  const scales = useMemo(() => scalesForFamily(family), [family])
  return (
    <div className="bl-hb-mode-panel" data-bl-nocapture>
      <div className="bl-seg bl-hb-fam" role="group" aria-label="Scale family">
        {HARMONY_FAMILIES.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`bl-seg-btn${family === f.id ? " is-on" : ""}`}
            aria-pressed={family === f.id}
            onClick={() => {
              // Switch family → pick its first scale (a valid id always exists).
              const first = scalesForFamily(f.id)[0]
              if (first) store.dispatch({ t: "setScale", family: f.id, id: first.id })
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="bl-hb-scale">
        <span className="bl-hb-cap">Scale</span>
        <select
          className="bl-hb-select"
          value={scaleId}
          onChange={(e) => store.dispatch({ t: "setScale", family, id: e.target.value })}
        >
          {scales.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
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
  store: BeatloungeStore
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
    <div className="bl-hb-grid" role="group" aria-label="Chords over the loop">
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
              ? `Beat ${slot.index + 1}: ${displayChord(slot.symbol)}`
              : `Beat ${slot.index + 1}: empty`
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
      Browse progressions
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
    <div className="bl-hb-sheet" role="dialog" aria-label="Choose a chord">
      <div className="bl-hb-sheet-head">
        <span className="bl-hb-sheet-title">Chord</span>
        <button type="button" className="bl-icon-btn" aria-label="Close" onClick={onClose}>
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
          Clear beat
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
    <div className="bl-hb-sheet bl-hb-browser" role="dialog" aria-label="Browse progressions">
      <div className="bl-hb-sheet-head">
        <span className="bl-hb-sheet-title">Progressions</span>
        <span className="bl-hb-sheet-count">{CORPUS.length}</span>
        <button type="button" className="bl-icon-btn" aria-label="Close" onClick={onClose}>
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
