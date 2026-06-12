/**
 * beatlounge — the Harmony HOME WIDGET (live tile): a compact harmony summary
 * (tonic + scale/chords) that opens a PREMIUM POPOVER containing the full
 * `HarmonyPanel` right on the Stage — never the immersive page.
 *
 * Because `HarmonyPanel` already wires the harmony→score snap, changing the
 * mode/progression in the popover snaps the bound melody (the persisted selected
 * synth, via `useSelectedInstrument`) into the new key — so the score follows.
 *
 * The popover is scrim-dismissed and resize-clean (its own scroll region). The
 * widget owns its open affordance (`tileOwnsExpand` suppresses the shell expand).
 * Setup-don't-play: harmony edits + the snap only WRITE the doc.
 */

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { BeatloungeHost } from "../../contracts/module"
import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { useSelectedInstrument } from "../../store/selectedInstrument"
import { harmonySummary } from "../instruments/harmonySummary"
import { Glyph } from "../../bl-ui"
import { HarmonyPanel } from "./HarmonyPanel"

interface Props {
  host: BeatloungeHost
  store: BeatloungeStore
}

export const HarmonyWidget = ({ host, store }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const { trackId } = useSelectedInstrument(doc)
  const summary = harmonySummary(doc)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // The popover must escape the Stage TILE: a tile has `backdrop-filter`, which
  // makes it the containing block for `position:fixed` — so an in-tile fixed
  // modal would be trapped + clipped INSIDE the little tile. Portal it to the
  // pack root (`.bl-root`, no filter/transform) so it's a true full-screen sheet.
  const overlayRoot =
    rootRef.current?.closest<HTMLElement>(".bl-root") ??
    rootRef.current?.ownerDocument.body ??
    null

  return (
    <div className="bl-tile-grid bl-harmonywidget" ref={rootRef}>
      <button
        type="button"
        className="bl-harmonywidget-open"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Open harmony"
      >
        <span className="bl-tile-head">
          <span className="bl-tile-glyph">
            <Glyph name="wave" size={16} />
          </span>
          <span className="bl-tile-title">Harmony</span>
        </span>
        <span className="bl-harmonywidget-summary">
          <span className="bl-harmonywidget-tonic">{summary.tonic}</span>
          <span className="bl-harmonywidget-detail">{summary.detail}</span>
        </span>
      </button>

      {open &&
        overlayRoot &&
        createPortal(
          <div
            className="bl-harmonywidget-scrim"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setOpen(false)
            }}
          >
          <div
            className="bl-harmonywidget-pop"
            role="dialog"
            aria-label="Harmony"
            aria-modal="true"
          >
            <div className="bl-harmonywidget-pophead">
              <span className="bl-harmonywidget-poptitle">Harmony</span>
              <button
                type="button"
                className="bl-icon-btn"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="bl-harmonywidget-popbody">
              <HarmonyPanel host={host} store={store} snapTrackId={trackId} />
            </div>
          </div>
          </div>,
          overlayRoot
        )}
    </div>
  )
}
