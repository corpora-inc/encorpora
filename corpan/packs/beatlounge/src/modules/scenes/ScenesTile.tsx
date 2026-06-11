/**
 * beatlounge — Scenes TILE: a glanceable summary of saved states. Shows the
 * active scene's name (or a count when none is loaded) and an unsaved-changes
 * dot when the live doc has drifted. Tapping enters the full Scenes surface.
 * Read-only — no save/load here (that's the immersive view).
 */

import { Glyph } from "../../bl-ui"
import type { ScenesController } from "./scenesController"
import { useScenes } from "./scenesController"

interface Props {
  ctrl: ScenesController
}

export const ScenesTile = ({ ctrl }: Props) => {
  const scenes = useScenes(ctrl, (s) => s.scenes)
  const activeId = useScenes(ctrl, (s) => s.activeSceneId)
  const dirty = useScenes(ctrl, (s) => s.dirty)
  const active = scenes.find((s) => s.id === activeId)

  return (
    <div className="bl-tile-grid">
      <div className="bl-tile-head">
        <span className="bl-tile-glyph">
          <Glyph name="drawer" size={16} />
        </span>
        <span className="bl-tile-title">Scenes</span>
        <span className="bl-tile-meta">{scenes.length || "—"}</span>
      </div>

      <div className="bl-scenes-tilebody">
        {active ? (
          <div className="bl-scenes-tileactive">
            <span className="bl-scenes-tilename" title={active.name}>
              {active.name}
            </span>
            {dirty && <span className="bl-scenes-dot" title="Unsaved changes" />}
          </div>
        ) : (
          <div className="bl-scenes-tilehint">
            {scenes.length
              ? `${scenes.length} saved`
              : "No scenes yet"}
          </div>
        )}
      </div>
    </div>
  )
}
