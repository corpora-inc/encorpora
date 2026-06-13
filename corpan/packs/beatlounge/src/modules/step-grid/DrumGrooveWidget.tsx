/**
 * beatlounge — the Drums HOME WIDGET (live tile): a compact groove surface that
 * EDITS the drum grid right on the Stage, setup-don't-play.
 *
 *   • A glanceable mini-grid of the drum track (the same read-only view the old
 *     summary tile showed) with the live playhead column.
 *   • The +/− DENSITY DIAL — the exact `sparserAction` / `denserAction` from the
 *     Grooves brain, bound to THIS drum track (same engine as the full page). −
 *     thins, + lays one more probabilistic layer; each + re-rolls a fresh seed.
 *   • SHUFFLE — pick a random world rhythm and clear-scatter it onto the kit
 *     (clearScatter), so one tap gives an infinitely-variable, satisfying groove.
 *
 * Every edit dispatches ONE undo batch through the store and NEVER starts the
 * transport. The shell owns the corner "expand" control (opens the full Drums
 * page), so this widget renders only its body.
 */

import { useEffect, useMemo, useState } from "react"
import { ct } from "../../i18n/strings"
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
import { Glyph } from "../../bl-ui"
import { buildMiniView } from "./gridModel"
import { generateAction, sparserAction } from "../grooves/actions"
import { MAX_DENSITY_LEVEL } from "../grooves/grooveModel"
import { getRhythm } from "../../rhythm"
import { pickRandomRhythmId } from "../grooves/randomRhythm"
import { useSelectedGroove } from "../../store/selectedGroove"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
  audio: AudioFacade
  trackId: Id
}

export const DrumGrooveWidget = ({ host, store, audio, trackId }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const track = findTrack(doc, trackId)
  const [playStep, setPlayStep] = useState(-1)
  // The SHARED selected groove — same id the Drums pane + Grooves panel use, so
  // picking a groove anywhere reflects here. Defaults to a random groove (never
  // "the first"), persisted across reloads.
  const { rhythmId, select: selectGroove } = useSelectedGroove()
  // The dial's density LEVEL: each "+" raises it (denser, all-new beat), each "−"
  // lowers it (sparser, down to 0 = empty). Tracked on this surface.
  const [level, setLevel] = useState(0)

  useEffect(() => {
    return audio.onPlayhead((tick) => {
      const t = findTrack(store.vanilla.getState().doc, trackId)
      setPlayStep(tick < 0 || !t ? -1 : stepForTick(tick, t.grid))
    })
  }, [audio, store, trackId])

  const view = useMemo(
    () => (track && isInstrumentTrack(track) ? buildMiniView(doc, track) : null),
    [doc, track]
  )

  /** GENERATE a fresh stochastic beat across the WHOLE kit on THIS drum track at
   *  density `lvl`, as one undo step. No selectedPitches ⇒ ALL drum rows. A fresh
   *  per-press seed → every press is a genuinely new beat (never a stock pattern).
   *  Uses the SHARED selected groove (or `extra.rhythmId` for a shuffle). */
  const generate = (lvl: number, extra: Record<string, unknown> = {}) => {
    const before = store.vanilla.getState().doc
    const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0
    const useRhythmId = (extra.rhythmId as string | undefined) ?? rhythmId
    const result = generateAction.run(
      { doc: store.vanilla.getState().doc, rng: () => Math.random() },
      {
        rhythmId: useRhythmId,
        intensity: 1,
        level: lvl,
        seed,
        // No selectedPitches ⇒ ALL drum rows (the dial/shuffle affect the whole kit).
        target: { kind: "drums", trackId },
        ...extra,
      }
    )
    if (result.commands.length === 0) {
      host.toast(result.summary || ct("grooves.nothingToApply"))
      return
    }
    store.dispatch({ t: "batch", commands: result.commands, label: generateAction.name })
    host.toast(result.summary, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  /** "+" — denser: raise the level and regenerate a brand-new beat across the kit. */
  const denser = () => {
    const next = Math.min(MAX_DENSITY_LEVEL, level + 1)
    setLevel(next)
    generate(next)
  }

  /** "−" — sparser: REMOVE a fraction of the kit's current hits (off-beat / quiet
   *  first, probabilistically — surprising but the downbeat backbone survives
   *  longest), down to nothing. The `generate` op is purely ADDITIVE, so "−" must
   *  run the dedicated `remove` action (`sparserAction`) — decrementing the level
   *  and regenerating would lay MORE hits on top, never fewer. One undo batch. */
  const sparser = () => {
    const before = store.vanilla.getState().doc
    const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0
    const result = sparserAction.run(
      { doc: store.vanilla.getState().doc, rng: () => Math.random() },
      {
        rhythmId,
        intensity: 1,
        seed,
        // No selectedPitches ⇒ thin the WHOLE kit (mirrors the kit-wide "+").
        target: { kind: "drums", trackId },
      }
    )
    if (result.commands.length === 0) {
      host.toast(result.summary || ct("grooves.nothingToApply"))
      return
    }
    // Only drop the density level once we know hits were actually removed —
    // decrementing on an empty/non-removable kit would drift the UI level
    // away from the document.
    setLevel((lvl) => Math.max(0, lvl - 1))
    store.dispatch({ t: "batch", commands: result.commands, label: sparserAction.name })
    host.toast(result.summary, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  /** SHUFFLE — pick a fresh world rhythm (never the current one), share it across
   *  every surface, and generate a satisfying mid-density beat on the whole kit.
   *  One undo, grid-only, never starts transport. */
  const shuffle = () => {
    const id = pickRandomRhythmId(Math.random, rhythmId)
    selectGroove(id)
    const next = Math.max(2, level || 2)
    setLevel(next)
    generate(next, { rhythmId: id })
  }

  const openDrums = () => host.enterImmersive("step-grid")

  if (!track || !isInstrumentTrack(track) || !view) return null

  const grooveName = getRhythm(rhythmId)?.name

  return (
    <div className="bl-tile-grid bl-drumwidget">
      {/* The head + mini-grid ARE the "open Drums" affordance — tapping the tile
          body (anywhere but the controls below) enters the immersive Drums page.
          The live dial + shuffle are rendered OUTSIDE this button (siblings, not
          children), so they act in place and never open the page. */}
      <button
        type="button"
        className="bl-drumwidget-open"
        onClick={openDrums}
        aria-label={ct("drums.openDrums")}
        title={ct("drums.openDrums")}
      >
        <span className="bl-tile-head">
          <span className="bl-tile-glyph">
            <Glyph name="grid" size={16} />
          </span>
          <span className="bl-tile-title">{ct("drums.title")}</span>
          {grooveName && (
            <span className="bl-drumwidget-groove" title={grooveName}>
              {grooveName}
            </span>
          )}
        </span>

        <span
          className="bl-mini bl-drumwidget-mini"
          style={{ ["--bl-steps" as string]: String(view.steps) }}
          aria-hidden="true"
        >
          {view.lanes.map((lane) => (
            <span className="bl-mini-row" key={lane.pitch}>
              {lane.cells.map((c, s) => (
                <span
                  key={s}
                  className={
                    "bl-mini-cell" +
                    (c.on ? " is-on" : "") +
                    (s === playStep ? " is-active" : "")
                  }
                />
              ))}
            </span>
          ))}
        </span>
      </button>

      {/* ---- the live dial + shuffle (setup, never play). These are SIBLINGS of
          the open-button above (not nested in it), so adjusting density /
          shuffling acts in place and never opens the Drums page ---- */}
      <div className="bl-drumwidget-controls" data-bl-nocapture>
        <div
          className="bl-drumwidget-dial"
          role="group"
          aria-label={ct("grooves.densityGroup")}
        >
          <button
            type="button"
            className="bl-drumwidget-btn"
            onClick={sparser}
            aria-label={ct("grooves.sparser")}
            title={ct("drums.sparserHint")}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="bl-drumwidget-btn is-primary"
            onClick={denser}
            aria-label={ct("grooves.denser")}
            title={ct("drums.denserHint")}
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="10" y1="5" x2="10" y2="15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="bl-drumwidget-btn bl-drumwidget-shuffle"
          onClick={shuffle}
          aria-label={ct("drums.shuffle")}
          title={ct("drums.shuffleHint")}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              d="M3 6h3.5l7 8H17M3 14h3.5l3-3.4M13.5 6H17m0 0l-2-2m2 2l-2 2M17 14l-2-2m2 2l-2 2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
