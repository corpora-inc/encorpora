/**
 * beatlounge — the tweakers TILE: a calm glance at how alive the loop is.
 *
 * Shows "N live" (the count of enabled modulators) plus a tiny, deterministic
 * sparkline of the modulators' shapes so the tile feels like it's breathing.
 * Read-only; tapping enters the immersive Tweakers panel (shell wires activate).
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { Glyph } from "../../bl-ui"
import { shapeValue } from "../../modulation/shapes"
import type { Modulator } from "../../model/document"

interface Props {
  store: BeatloungeStore
}

/** A static sample of a shape across one cycle → an SVG polyline path. */
const sparkPath = (mod: Modulator, w: number, h: number): string => {
  const n = 28
  const pts: string[] = []
  for (let i = 0; i <= n; i++) {
    const p = i / n
    const s = shapeValue(mod.shape, p, 0, mod.seed ?? 0) // -1..1
    const x = (i / n) * w
    const y = h / 2 - (s * (h / 2 - 2))
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return pts.join(" ")
}

export const TweakersTile = ({ store }: Props) => {
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const mods = doc.modulators ?? []
  const live = mods.filter((m) => m.enabled)
  const w = 120
  const h = 30

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="wave" size={16} />
        </span>
        <span className="bl-tile-title">Tweakers</span>
        <span className="bl-tile-meta">{live.length}</span>
      </div>
      <div className="bl-twk-tile-body" aria-hidden="true">
        {live.length === 0 ? (
          <span className="bl-twk-tile-empty">Idle — tap to bring it alive</span>
        ) : (
          <>
            <svg
              className="bl-twk-spark"
              width="100%"
              viewBox={`0 0 ${w} ${h}`}
              preserveAspectRatio="none"
            >
              {live.slice(0, 4).map((m, i) => (
                <polyline
                  key={m.id}
                  className="bl-twk-spark-line"
                  points={sparkPath(m, w, h)}
                  style={{ opacity: 0.85 - i * 0.18 }}
                  fill="none"
                />
              ))}
            </svg>
            <span className="bl-twk-tile-count">
              {live.length} live tweaker{live.length === 1 ? "" : "s"}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
