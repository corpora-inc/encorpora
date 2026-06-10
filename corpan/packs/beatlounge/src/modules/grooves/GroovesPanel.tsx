/**
 * beatlounge — the reusable GROOVES PANEL: the single source of truth for the
 * world-rhythm browser + Apply / Layer / Vary / Evolve / Randomize actions.
 *
 * It is embedded in TWO places:
 *   • the standalone Grooves module (GroovesImmersive renders it full-bleed), and
 *   • the Drums page (StepGridImmersive embeds it as an in-screen panel so you
 *     browse styles and watch the live grid update without leaving the screen).
 *
 *   • STYLE PICKER — families as sections; each rhythm a tappable card with a
 *     mini-pattern thumbnail. Search filters by name/origin/tag.
 *   • DETAIL — the selected rhythm's blurb, time signature, lane preview, and an
 *     approx-voice footnote when the kit substitutes a percussion role.
 *   • ACTIONS — Apply (replace), Layer (stack additively), Vary (small change),
 *     Evolve (drift), Randomize (re-roll). Each dispatches ONE undo batch.
 *   • OPTIONS — an Intensity slider + a "Lay phrases on the groove" toggle
 *     (DISABLED with a visible hint when no phrase track / empty bank).
 *
 * Applying only WRITES the grid; it never starts playback ("setup, don't play").
 * Failures surface via host.toast; everything is noisy-not-silent.
 */

import { useMemo, useState } from "react"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { isFragmentTrack } from "../../model/document"
import { groupedByFamily, FAMILY_META, getRhythm, type Rhythm } from "../../rhythm"
import { resolveRole } from "../../rhythm"
import { bankSnippets } from "../../phrase/bank"
import { runAction } from "../runAction"
import {
  applyAction,
  layerAction,
  varyAction,
  evolveAction,
  randomizeAction,
} from "./actions"
import { buildPreview } from "./preview"
import { GrooveMark } from "./GrooveMark"

interface Props {
  store: BeatloungeStore
  host: BeatloungeHost
  /**
   * "standalone" = the full module screen (its own toolbar/header);
   * "embedded" = inside the Drums page (compact, no big title — the host
   * panel chrome owns the heading). Default "standalone".
   */
  variant?: "standalone" | "embedded"
}

const FAMILY_LABEL = new Map(FAMILY_META.map((f) => [f.family, f.label]))

export const GroovesPanel = ({ store, host, variant = "standalone" }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const bankCount = useMemo(() => bankSnippets(doc).length, [doc])
  const hasPhraseTrack = useMemo(() => doc.tracks.some(isFragmentTrack), [doc])
  const phrasesPossible = hasPhraseTrack && bankCount > 0

  const groups = useMemo(() => groupedByFamily(), [])
  const allRhythms = useMemo(() => groups.flatMap((g) => g.rhythms), [groups])

  const [selectedId, setSelectedId] = useState<string>(allRhythms[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [intensity, setIntensity] = useState(1)
  const [withPhrases, setWithPhrases] = useState(false)

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
    const before = store.vanilla.getState().doc
    const rng = () => Math.random()
    const result = action.run(
      { doc: store.vanilla.getState().doc, rng },
      {
        rhythmId: selected?.id,
        intensity,
        withPhrases: withPhrases && phrasesPossible,
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

  // Randomize jumps the selection to whatever it rolled so the detail follows.
  const onRandomize = () => {
    const before = store.vanilla.getState().doc
    const result = runAction(store, randomizeAction, {
      doc: store.vanilla.getState().doc,
    })
    if (result.commands.length === 0) {
      host.toast(result.summary || "Couldn't randomize")
      return
    }
    host.toast(result.summary, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

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

            <label
              className={`bl-grooves-toggle${phrasesPossible ? "" : " is-disabled"}`}
            >
              <input
                type="checkbox"
                checked={withPhrases && phrasesPossible}
                disabled={!phrasesPossible}
                onChange={(e) => setWithPhrases(e.target.checked)}
              />
              <span>Lay phrases on the groove</span>
            </label>
            {!phrasesPossible && (
              <p className="bl-grooves-hint" role="note">
                {hasPhraseTrack
                  ? "Save some phrases (Phrase Sampler) to lay them on a groove."
                  : "Add a phrase track and save phrases to lay them on a groove."}
              </p>
            )}
          </div>

          <div className="bl-grooves-actions" data-bl-nocapture>
            <button
              type="button"
              className="bl-grooves-btn is-primary"
              onClick={() => runGroove(applyAction)}
              title="Replace the drum pattern with this groove"
            >
              Apply
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={() => runGroove(layerAction)}
              title="Stack this groove OVER the current pattern (don't replace)"
            >
              Layer
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={() => runGroove(varyAction, { amount: 0.25 })}
              title="Keep the flavor, make small changes"
            >
              Vary
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={() => runGroove(evolveAction, { generations: 4, amount: 0.2 })}
              title="Drift the groove further across several generations"
            >
              Evolve
            </button>
            <button
              type="button"
              className="bl-grooves-btn"
              onClick={onRandomize}
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
