/**
 * beatlounge — the reusable GROOVE-BRAIN PANEL: the single source of truth for
 * the world-rhythm browser + the SCATTER actions.
 *
 * It is GRID-AGNOSTIC. The HOST tells it what it's driving via the typed
 * `target` prop — the same browse + actions apply the same corpus + engine to
 * EITHER grid; only the write target differs:
 *   • the standalone Grooves module + the Drums page → `target.kind === "drums"`
 *     (write the rhythm onto the drum track; the drum-lane selection re-points
 *     it 0/1/N), and
 *   • the Phrase Jam page → `target.kind === "phrases"` (distribute saved bank
 *     snippets onto the rhythm's onsets on the phrase track).
 *
 *   • STYLE PICKER — families as sections; each rhythm a tappable card with a
 *     mini-pattern thumbnail. Search filters by name/origin/tag.
 *   • DETAIL — the selected rhythm's blurb, time signature, lane preview, and an
 *     approx-voice footnote when the kit substitutes a percussion role.
 *   • ACTIONS — just TWO, the primary at the TOP (no scroll): SCATTER (spread the
 *     groove probabilistically across the selected rows, LEAVING existing notes —
 *     each press re-rolls a fresh seed so it's different + surprising) and CLEAR +
 *     SCATTER (wipe the targeted rows first). Each dispatches ONE undo batch.
 *   • OPTIONS — an Intensity slider; a drums-context "scattering across…" hint;
 *     a phrases-context hint that DISABLES the actions when the bank is empty.
 *
 * Applying only WRITES the grid; it never starts playback ("setup, don't play").
 * Failures surface via host.toast; everything is noisy-not-silent.
 */

import { useMemo, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import type { Midi } from "../../model/document"
import { useBeatloungeStore } from "../../store/store"
import { isFragmentTrack } from "../../model/document"
import { groupedByFamily, FAMILY_META, getRhythm, type Rhythm } from "../../rhythm"
import { resolveRole } from "../../rhythm"
import { bankSnippets } from "../../phrase/bank"
import { denserAction, sparserAction, generateAction } from "./actions"
import { MAX_DENSITY_LEVEL } from "./grooveModel"
import { buildPreview } from "./preview"
import { GrooveMark } from "./GrooveMark"
import { useSelectedGroove } from "../../store/selectedGroove"

/**
 * What this panel is driving. The host knows; the panel never guesses. Drums
 * carries the lane-head selection for 0/1/N re-pointing; phrases just names the
 * fragment track to distribute the bank onto.
 */
export type GroovesPanelTarget =
  | { kind: "drums"; trackId?: string; selectedPitches?: Midi[]; laneLabels?: string[] }
  | { kind: "phrases"; trackId?: string; selectedSnippetIds?: string[] }

interface Props {
  store: BeatloungeStore
  host: BeatloungeHost
  /**
   * "standalone" = the full module screen (its own toolbar/header);
   * "embedded" = inside a host page (compact, no big title — the host panel
   * chrome owns the heading). Default "standalone".
   */
  variant?: "standalone" | "embedded"
  /**
   * The GRID this panel drives. The host supplies it (drums vs phrases). Default
   * is a bare drums target (resolve/create the drum track) so the standalone
   * module keeps today's behaviour.
   */
  target?: GroovesPanelTarget
}

const FAMILY_LABEL = new Map(FAMILY_META.map((f) => [f.family, f.label]))

export const GroovesPanel = ({
  store,
  host,
  variant = "standalone",
  target = { kind: "drums" },
}: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const bankCount = useMemo(() => bankSnippets(doc).length, [doc])
  const hasPhraseTrack = useMemo(() => doc.tracks.some(isFragmentTrack), [doc])

  // For a phrases target, Apply needs a fragment track AND a non-empty bank.
  const phrasesReady = target.kind === "phrases" && hasPhraseTrack && bankCount > 0
  const applyDisabled = target.kind === "phrases" && !phrasesReady

  const groups = useMemo(() => groupedByFamily(), [])
  const allRhythms = useMemo(() => groups.flatMap((g) => g.rhythms), [groups])

  // The SHARED selected groove — same id the home Drums widget + the Drums pane
  // use, so picking a groove here reflects everywhere (and vice-versa).
  const { rhythmId: selectedId, select: setSelectedId } = useSelectedGroove()
  // Intensity (velocity spread) is fixed at full now — the slider was cut as
  // clutter; the +/- density dial is the one knob.
  const intensity = 1
  // Generator density level for the DRUMS dial (each + raises it; − lowers, to 0).
  const [level, setLevel] = useState(0)

  const selected = getRhythm(selectedId) ?? allRhythms[0]

  // ---- run an action through the store as one undo step --------------------
  const runGroove = (
    action: typeof denserAction,
    extra: Record<string, unknown> = {}
  ) => {
    if (applyDisabled) {
      host.toast(
        hasPhraseTrack
          ? "Save some phrases to lay on a groove."
          : "Add a phrase track and save phrases first."
      )
      return
    }
    const before = store.vanilla.getState().doc
    // FRESH per-press seed → every press re-rolls a genuinely different scatter.
    // The engine logic stays pure/seeded (it consumes this); only the seed varies.
    const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0
    const rng = () => Math.random()
    const result = action.run(
      { doc: store.vanilla.getState().doc, rng },
      {
        rhythmId: selected?.id,
        intensity,
        seed,
        // The host-chosen grid (drums vs phrases) + drum-lane re-pointing.
        target,
        ...extra,
      }
    )
    if (result.commands.length === 0) {
      console.warn(
        "[beatlounge/grooves] action produced no commands:",
        action.name,
        result.summary
      )
      host.toast(result.summary || "Nothing to apply")
      return
    }
    // Apply atomically (single undo step).
    store.dispatch({ t: "batch", commands: result.commands, label: action.name })
    host.toast(result.summary, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  // The +/− dial. DRUMS use the GENERATOR (regenerate a fresh beat across the kit
  // at a density level — + raises, − lowers, to empty). PHRASES keep the additive
  // denser / pure sparser behaviour (each + lays a few more words, − peels back).
  const onDenser = () => {
    if (target.kind === "drums") {
      const next = Math.min(MAX_DENSITY_LEVEL, level + 1)
      setLevel(next)
      runGroove(generateAction, { level: next })
    } else {
      runGroove(denserAction)
    }
  }
  const onSparser = () => {
    if (target.kind === "drums") {
      const next = Math.max(0, level - 1)
      setLevel(next)
      runGroove(generateAction, { level: next })
    } else {
      runGroove(sparserAction)
    }
  }

  if (!selected) {
    return <div className="bl-grid-empty">No rhythms available.</div>
  }

  return (
    <div className={`bl-grooves-panel bl-grooves-panel--${variant}`}>
      {variant === "standalone" && (
        <div className="bl-grooves-toolbar" data-bl-nocapture>
          <div className="bl-grooves-title">
            <span className="bl-grooves-title-mark">
              <GrooveMark size={18} />
            </span>
            Grooves
          </div>
        </div>
      )}

      <div className="bl-grooves-body">
        {/* ---- the browsable picker (only ~70 rhythms — no search needed) ---- */}
        <div className="bl-grooves-picker" role="listbox" aria-label="World rhythms">
          {groups.map((group) => (
            <section className="bl-grooves-family" key={group.family}>
              <h3 className="bl-grooves-family-label">
                {FAMILY_LABEL.get(group.family) ?? group.family}
              </h3>
              <div className="bl-grooves-cards">
                {group.rhythms.map((r) => (
                  <RhythmCard
                    key={r.id}
                    rhythm={r}
                    selected={r.id === selected.id}
                    onSelect={() => setSelectedId(r.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* ---- a slim density bar pinned to the bottom: just the small +/− ----
            "−" thins the targeted rows (down to nothing), "+" lays a fuller
            probabilistic beat. No label, no intensity, no explainer copy — small
            buttons, by themselves, so the picker above gets the scroll room. The
            rhythm detail returns on iPad (the extras block). */}
        <aside className="bl-grooves-detail" aria-live="polite">
          <div
            className="bl-grooves-dial"
            data-bl-nocapture
            role="group"
            aria-label={
              target.kind === "phrases"
                ? "Phrase density — sparser or denser"
                : "Groove density — sparser or denser"
            }
          >
            <button
              type="button"
              className="bl-grooves-dial-btn"
              onClick={onSparser}
              disabled={applyDisabled}
              aria-disabled={applyDisabled}
              aria-label="Sparser"
            >
              <MinusGlyph />
            </button>
            <button
              type="button"
              className="bl-grooves-dial-btn is-primary"
              onClick={onDenser}
              disabled={applyDisabled}
              aria-disabled={applyDisabled}
              aria-label="Denser"
            >
              <PlusGlyph />
            </button>
          </div>

          {/* Secondary — collapses on mobile (the dial is enough there), returns on
              iPad. Phrases keep their readiness note (it gates Apply). */}
          <div className="bl-grooves-extras">
            {target.kind === "phrases" && (
              <PhraseTargetHint
                ready={phrasesReady}
                hasPhraseTrack={hasPhraseTrack}
                bankCount={bankCount}
              />
            )}
            <RhythmDetail rhythm={selected} />
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- glyphs
/** "−" — sparser (a single minus bar). */
const MinusGlyph = () => (
  <svg className="bl-grooves-dial-glyph" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

/** "+" — denser (a plus). */
const PlusGlyph = () => (
  <svg className="bl-grooves-dial-glyph" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
    <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <line x1="10" y1="5" x2="10" y2="15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

// ---------------------------------------------------------------- sub-views
/**
 * PHRASES context — the hint tells the user the groove will lay their SAVED bank
 * snippets onto its onsets, and (when the bank/track isn't ready) why Apply is
 * disabled. Never a silent no-op.
 */
const PhraseTargetHint = ({
  ready,
  hasPhraseTrack,
  bankCount,
}: {
  ready: boolean
  hasPhraseTrack: boolean
  bankCount: number
}) => {
  if (ready) {
    return (
      <p className="bl-grooves-target is-on" role="note">
        Lays your <strong>{bankCount}</strong> saved phrase
        {bankCount === 1 ? "" : "s"} onto this groove's onsets.
      </p>
    )
  }
  return (
    <p className="bl-grooves-target" role="note">
      {hasPhraseTrack ? (
        <>
          Save some phrases in <strong>Phrases</strong> to lay them on a groove.
        </>
      ) : (
        <>Add a phrase track and save phrases to lay them on a groove.</>
      )}
    </p>
  )
}

const RhythmCard = ({
  rhythm,
  selected,
  onSelect,
}: {
  rhythm: Rhythm
  selected: boolean
  onSelect: () => void
}) => {
  const preview = useMemo(() => buildPreview(rhythm, 3), [rhythm])
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`bl-grooves-card${selected ? " is-selected" : ""}`}
      onClick={onSelect}
    >
      <span className="bl-grooves-card-name">{rhythm.name}</span>
      <span className="bl-grooves-card-origin">{rhythm.origin}</span>
      <span
        className="bl-grooves-card-grid"
        style={{ ["--bl-grooves-cells" as string]: String(preview.cells) }}
        aria-hidden="true"
      >
        {preview.lanes.map((lane, li) => (
          <span className="bl-grooves-prow" key={li}>
            {lane.cells.map((cell, ci) => (
              <span
                key={ci}
                className={
                  "bl-grooves-pcell" +
                  (cell.on ? " is-on" : "") +
                  (cell.accent ? " is-accent" : "") +
                  (cell.ghost ? " is-ghost" : "") +
                  (lane.signature ? " is-sig" : "")
                }
              />
            ))}
          </span>
        ))}
      </span>
    </button>
  )
}

const RhythmDetail = ({ rhythm }: { rhythm: Rhythm }) => {
  const preview = useMemo(() => buildPreview(rhythm, 6), [rhythm])
  // Approx-voice footnotes: roles the kit substitutes.
  const approx = useMemo(() => {
    const seen = new Set<string>()
    const notes: string[] = []
    for (const lane of rhythm.lanes) {
      const m = resolveRole(lane.role)
      if (m.approx && m.note && !seen.has(lane.role)) {
        seen.add(lane.role)
        notes.push(m.note)
      }
    }
    return notes
  }, [rhythm])

  return (
    <div className="bl-grooves-detail-inner">
      <header className="bl-grooves-detail-head">
        <h2 className="bl-grooves-detail-name">{rhythm.name}</h2>
        <span className="bl-grooves-detail-tag">{rhythm.timeSig}</span>
        {rhythm.bpm != null && (
          <span className="bl-grooves-detail-tag">{rhythm.bpm} BPM</span>
        )}
      </header>
      <p className="bl-grooves-detail-blurb">{rhythm.blurb}</p>

      <div
        className="bl-grooves-detail-grid"
        style={{ ["--bl-grooves-cells" as string]: String(preview.cells) }}
        aria-hidden="true"
      >
        {preview.lanes.map((lane, li) => (
          <div className="bl-grooves-drow" key={li}>
            <span className={`bl-grooves-drow-label${lane.signature ? " is-sig" : ""}`}>
              {lane.role}
            </span>
            <span className="bl-grooves-drow-cells">
              {lane.cells.map((cell, ci) => (
                <span
                  key={ci}
                  className={
                    "bl-grooves-dcell" +
                    (cell.on ? " is-on" : "") +
                    (cell.accent ? " is-accent" : "") +
                    (cell.ghost ? " is-ghost" : "") +
                    (lane.signature ? " is-sig" : "") +
                    (ci % preview.stepsPerBeat === 0 ? " is-beat" : "")
                  }
                />
              ))}
            </span>
          </div>
        ))}
      </div>

      {approx.length > 0 && (
        <details className="bl-grooves-approx">
          <summary>Kit voice notes ({approx.length})</summary>
          <ul>
            {approx.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
