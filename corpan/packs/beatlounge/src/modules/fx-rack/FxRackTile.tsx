/**
 * beatlounge — the fx-rack TILE: a calm, glanceable summary of the project's
 * effects across every track — the count of active inserts and, for the tracks
 * that actually carry effects, a per-track mini chain of effect-kind pills
 * (dimmed when bypassed). Tapping enters the immersive rack (shell wires the
 * activation). Read-only.
 *
 * The selector returns PRIMITIVES (a count) and we read the track list from the
 * stable `doc` reference — never a fresh object literal, which would make
 * zustand v5's snapshot change every render and spin an infinite re-render loop.
 */

import type { BeatloungeStore } from "../../store/store"
import { useBeatloungeStore } from "../../store/store"
import { Glyph } from "../../bl-ui"
import { EFFECT_SPECS } from "../../effects/params"
import { ct } from "../../i18n/strings"

interface Props {
  store: BeatloungeStore
  /** The track the immersive rack opens on (kept for the activation binding). */
  trackId: string
}

const MAX_TRACK_ROWS = 3
const MAX_PILLS = 4

export const FxRackTile = ({ store }: Props) => {
  // Stable `doc` reference (not a derived object) — safe for useSyncExternalStore.
  const doc = useBeatloungeStore(store, (s) => s.doc)
  const active = useBeatloungeStore(store, (s) =>
    s.doc.tracks.reduce(
      (n, t) => n + t.inserts.filter((fx) => fx.enabled).length,
      0
    )
  )

  const withFx = doc.tracks.filter((t) => t.inserts.length > 0)
  const rows = withFx.slice(0, MAX_TRACK_ROWS)
  const moreTracks = withFx.length - rows.length

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="sliders" size={16} />
        </span>
        <span className="bl-tile-title">{ct("fx.title")}</span>
        <span className="bl-tile-meta">{ct("fx.activeCount", { n: String(active) })}</span>
      </div>
      <div className="bl-fxtile-tracks" aria-hidden="true">
        {withFx.length === 0 ? (
          <span className="bl-fxtile-empty">{ct("fx.tileEmpty")}</span>
        ) : (
          <>
            {rows.map((t) => {
              const pills = t.inserts.slice(0, MAX_PILLS)
              const extra = t.inserts.length - pills.length
              return (
                <div key={t.id} className="bl-fxtile-row">
                  <span className="bl-fxtile-track">{t.name}</span>
                  <span className="bl-fxtile-chain">
                    {pills.map((fx) => (
                      <span
                        key={fx.id}
                        className={`bl-fxtile-pill${fx.enabled ? "" : " is-off"}`}
                      >
                        {EFFECT_SPECS[fx.kind].label}
                      </span>
                    ))}
                    {extra > 0 && <span className="bl-fxtile-pill is-more">+{extra}</span>}
                  </span>
                </div>
              )
            })}
            {moreTracks > 0 && (
              <div className="bl-fxtile-sends">
                {ct("fx.moreTracks", { n: String(moreTracks) })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
