/**
 * beatlounge — the reusable GROOVE-BRAIN PANEL: the single source of truth for
 * the world-rhythm browser + Apply / Layer / Vary / Evolve / Randomize actions.
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
 *   • ACTIONS — Apply (replace), Layer (stack additively), Vary (small change),
 *     Evolve (drift), Randomize (re-roll). Each dispatches ONE undo batch.
 *   • OPTIONS — an Intensity slider; a drums-context "applying to…" hint (0/1/N
 *     lanes); a phrases-context hint that DISABLES Apply when the bank is empty.
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
import {
  applyAction,
  layerAction,
  varyAction,
  evolveAction,
  randomizeAction,
} from "./actions"
import { buildPreview } from "./preview"
import { GrooveMark } from "./GrooveMark"

/**
 * What this panel is driving. The host knows; the panel never guesses. Drums
 * carries the lane-head selection for 0/1/N re-pointing; phrases just names the
 * fragment track to distribute the bank onto.
 */
export type GroovesPanelTarget =
  | { kind: "drums"; trackId?: string; selectedPitches?: Midi[]; laneLabels?: string[] }
  | { kind: "phrases"; trackId?: string }

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

  const [selectedId, setSelectedId] = useState<string>(allRhythms[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [intensity, setIntensity] = useState(1)

  const selected = getRhythm(selectedId) ?? allRhythms[0]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        rhythms: g.rhythms.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.origin.toLowerCase().includes(q) ||
            (r.tags ?? []).some((t) => t.includes(q))
        ),
      }))
      .filter((g) => g.rhythms.length > 0)
  }, [groups, query])

  // ---- run an action through the store as one undo step --------------------
  const runGroove = (
    action: typeof applyAction,
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
    const rng = () => Math.random()
    const result = action.run(
      { doc: store.vanilla.getState().doc, rng },
      {
        rhythmId: selected?.id,
        intensity,
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

  // Randomize re-rolls onto the SAME target grid (drums or phrases).
  const onRandomize = () => runGroove(randomizeAction)

  if (!selected) {
    return <div className="bl-grid-empty">No rhythms available.</div>
  }

  return (
    <div className={`bl-grooves-panel bl-grooves-panel--${variant}`}>
      {/* ---- search ---- */}
      <div className="bl-grooves-toolbar" data-bl-nocapture>
        {variant === "standalone" && (
          <div className="bl-grooves-title">
            <span className="bl-grooves-title-mark">
              <GrooveMark size={18} />
            </span>
            Grooves
          </div>
        )}
        <input
          type="search"
          className="bl-grooves-search"
          placeholder="Search rhythms…"
          value={query}
          aria-label="Search rhythms"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="bl-grooves-body">
        {/* ---- the browsable picker ---- */}
        <div className="bl-grooves-picker" role="listbox" aria-label="World rhythms">
          {filtered.map((group) => (
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
          {filtered.length === 0 && (
            <div className="bl-grooves-empty">No rhythms match “{query}”.</div>
          )}
        </div>

        {/* ---- the selected-rhythm detail + actions ---- */}
        <aside className="bl-grooves-detail" aria-live="polite">
          <RhythmDetail rhythm={selected} />

          <div className="bl-grooves-options" data-bl-nocapture>
            <label className="bl-grooves-opt">
              <span className="bl-grooves-opt-label">Intensity</span>
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={intensity}
                aria-label="Intensity"
                onChange={(e) => setIntensity(Number(e.target.value))}
              />
              <span className="bl-grooves-opt-val">{Math.round(intensity * 100)}%</span>
            </label>
          </div>

          {/* Context-appropriate "applying to…" hint — drums: 0/1/N lanes;
              phrases: the bank/track readiness. */}
          {target.kind === "drums" ? (
            <DrumTargetHint
              pitches={target.selectedPitches}
              labels={target.laneLabels}
            />
          ) : (
            <PhraseTargetHint
              ready={phrasesReady}
              hasPhraseTrack={hasPhraseTrack}
              bankCount={bankCount}
            />
          )}

          <div className="bl-grooves-actions" data-bl-nocapture>
            <button
              type="button"
              className="bl-grooves-btn is-primary"
              onClick={() => runGroove(applyAction)}
              disabled={applyDisabled}
              aria-disabled={applyDisabled}
              title={
                target.kind === "phrases"
                  ? "Distribute your saved phrases onto this groove"
                  : "Replace the drum pattern with this groove"
              }
            >
              Apply
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={() => runGroove(layerAction)}
              disabled={applyDisabled}
              aria-disabled={applyDisabled}
              title={
                target.kind === "phrases"
                  ? "Add phrases on this groove without clearing the current ones"
                  : "Stack this groove OVER the current pattern (don't replace)"
              }
            >
              Layer
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={() => runGroove(varyAction, { amount: 0.25 })}
              disabled={applyDisabled}
              aria-disabled={applyDisabled}
              title="Keep the flavor, make small changes"
            >
              Vary
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={() => runGroove(evolveAction, { generations: 4, amount: 0.2 })}
              disabled={applyDisabled}
              aria-disabled={applyDisabled}
              title="Drift the groove further across several generations"
            >
              Evolve
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={onRandomize}
              disabled={applyDisabled}
              aria-disabled={applyDisabled}
              title="Re-roll a fresh groove from the whole world"
            >
              Randomize
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- sub-views
/**
 * DRUMS context — the "applying to…" hint above the action buttons surfaces the
 * live drum-lane selection so the user knows the 0/1/N targeting mode before
 * they Apply. (Only the drums context renders this.)
 */
const DrumTargetHint = ({
  pitches,
  labels,
}: {
  pitches?: number[]
  labels?: string[]
}) => {
  const n = pitches?.length ?? 0
  if (n === 0) {
    // No selection → the default kit-voice mapping. Only shown when the host
    // passes lane labels (the drum page); the standalone module passes none.
    if (labels === undefined) return null
    return (
      <p className="bl-grooves-target is-none" role="note">
        Applies to the <strong>whole kit</strong> (each voice in its place).
        Select drum lanes to re-point this rhythm.
      </p>
    )
  }
  const names = (labels ?? []).join(", ")
  return (
    <p className="bl-grooves-target is-on" role="note">
      {n === 1 ? (
        <>
          Plays the <strong>whole rhythm</strong> on <strong>{names}</strong>.
        </>
      ) : (
        <>
          Spreads the rhythm across <strong>{n}</strong> voices: {names}.
        </>
      )}
    </p>
  )
}

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
