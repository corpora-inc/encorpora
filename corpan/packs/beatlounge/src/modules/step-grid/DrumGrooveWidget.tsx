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
import type { AudioFacade } from "../../contracts/audioFacade"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { findTrack, isInstrumentTrack, type Id } from "../../model/document"
import { stepForTick } from "../../model/timing"
import { Glyph } from "../../bl-ui"
import { buildMiniView } from "./gridModel"
import { denserAction, sparserAction, clearScatterAction } from "../grooves/actions"
import { getRhythm } from "../../rhythm"
import { pickRandomRhythmId } from "../grooves/randomRhythm"

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
  // The last shuffled rhythm — so a re-shuffle always lands somewhere new and
  // the dial knows which groove to densify/thin.
  const [rhythmId, setRhythmId] = useState<string | undefined>(undefined)

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

  /** Run a grooves action on THIS drum track as one undo step. Fresh per-press
   *  seed → each + / shuffle re-rolls a genuinely different scatter. */
  const runGroove = (
    action: typeof denserAction,
    extra: Record<string, unknown> = {}
  ) => {
    const before = store.vanilla.getState().doc
    const seed = (Math.floor(Math.random() * 0x7fffffff) ^ Date.now()) >>> 0
    const result = action.run(
      { doc: store.vanilla.getState().doc, rng: () => Math.random() },
      {
        rhythmId: rhythmId ?? extra.rhythmId,
        intensity: 1,
        seed,
        target: { kind: "drums", trackId },
        ...extra,
      }
    )
    if (result.commands.length === 0) {
      host.toast(result.summary || "Nothing to apply")
      return
    }
    store.dispatch({ t: "batch", commands: result.commands, label: action.name })
    host.toast(result.summary, {
      undo: () => store.vanilla.getState().doc !== before && store.undo(),
    })
  }

  const shuffle = () => {
    const id = pickRandomRhythmId(Math.random, rhythmId)
    setRhythmId(id)
    runGroove(clearScatterAction, { rhythmId: id })
  }

  if (!track || !isInstrumentTrack(track) || !view) return null

  const grooveName = rhythmId ? getRhythm(rhythmId)?.name : undefined

  return (
    <div className="bl-tile-grid bl-drumwidget">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="grid" size={16} />
        </span>
        <span className="bl-tile-title">Drums</span>
        {grooveName && (
          <span className="bl-drumwidget-groove" title={grooveName}>
            {grooveName}
          </span>
        )}
      </div>

      <div
        className="bl-mini bl-drumwidget-mini"
        style={{ ["--bl-steps" as string]: String(view.steps) }}
        aria-hidden="true"
      >
        {view.lanes.map((lane) => (
          <div className="bl-mini-row" key={lane.pitch}>
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
          </div>
        ))}
      </div>

      {/* ---- the live dial + shuffle (setup, never play) ---- */}
      <div className="bl-drumwidget-controls" data-bl-nocapture>
        <div
          className="bl-drumwidget-dial"
          role="group"
          aria-label="Groove density — sparser or denser"
        >
          <button
            type="button"
            className="bl-drumwidget-btn"
            onClick={() => runGroove(sparserAction)}
            aria-label="Sparser"
            title="Sparser — peel a few hits back"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="bl-drumwidget-btn is-primary"
            onClick={() => runGroove(denserAction)}
            aria-label="Denser"
            title="Denser — lay one more layer of the groove"
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
          aria-label="Shuffle a world groove"
          title="Shuffle — a fresh world rhythm onto the kit"
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
