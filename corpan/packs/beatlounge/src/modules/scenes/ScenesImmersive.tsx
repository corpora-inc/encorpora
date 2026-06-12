/**
 * beatlounge — Scenes IMMERSIVE: save, name, and switch between complete states
 * of the song. A Scene is a named snapshot of the whole musical state; load one
 * and the live song becomes that snapshot (undoable). This is NOT undo/redo —
 * these are explicit checkpoints you curate (A → B → C, then jump A ↔ B ↔ C).
 *
 * Layout: a prominent "Save current as Scene" action up top (with an unsaved
 * indicator when the live doc has drifted from the loaded scene), then the list
 * of saved scenes, newest first. Each row: tap-the-name to LOAD, the saved
 * datetime, Rename, Delete. The currently-loaded scene is highlighted.
 */

import type { BeatloungeHost } from "../../contracts/module"
import { Glyph } from "../../bl-ui"
import type { Scene } from "../../store/scenesStore"
import type { ScenesController } from "./scenesController"
import { useScenes } from "./scenesController"
import { SceneNameEdit } from "./SceneNameEdit"

interface Props {
  ctrl: ScenesController
  host?: BeatloungeHost
}

/** Format a saved timestamp as "Jun 11, 14:32" (local, no year clutter). */
const formatWhen = (ms: number): string => {
  const d = new Date(ms)
  const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return `${date} · ${time}`
}

export const ScenesImmersive = ({ ctrl, host }: Props) => {
  const scenes = useScenes(ctrl, (s) => s.scenes)
  const hydrated = useScenes(ctrl, (s) => s.hydrated)
  const activeId = useScenes(ctrl, (s) => s.activeSceneId)
  const dirty = useScenes(ctrl, (s) => s.dirty)

  const toast = (msg: string) => host?.toast(msg)

  const onSave = async () => {
    const scene = await ctrl.save()
    toast(`Saved "${scene.name}"`)
  }

  const onLoad = (scene: Scene) => {
    if (scene.id === activeId && !dirty) return
    ctrl.load(scene.id)
    toast(`Loaded "${scene.name}"`)
  }

  const onDelete = async (scene: Scene) => {
    await ctrl.remove(scene.id)
    toast(`Deleted "${scene.name}"`)
  }

  return (
    <div className="bl-scenes">
      <div className="bl-scenes-bar">
        <button type="button" className="bl-scenes-save" onClick={onSave}>
          <span className="bl-scenes-save-glyph" aria-hidden="true">
            <Glyph name="drawer" size={18} />
          </span>
          <span className="bl-scenes-save-label">Save current as Scene</span>
          {dirty && (
            <span className="bl-scenes-save-dirty" title="Live state has changed since the last scene" />
          )}
        </button>
      </div>

      {scenes.length === 0 ? (
        <div className="bl-scenes-empty">
          {hydrated
            ? "Save the current state to start a collection. Evolve the loop, save again, and switch between states freely."
            : "…"}
        </div>
      ) : (
        <ul className="bl-scenes-list">
          {scenes.map((scene) => {
            const isActive = scene.id === activeId
            return (
              <li
                key={scene.id}
                className={"bl-scenes-row" + (isActive ? " is-active" : "")}
              >
                <span className="bl-scenes-rowmain">
                  <SceneNameEdit
                    name={scene.name}
                    onRename={(n) => ctrl.rename(scene.id, n)}
                    onActivate={() => onLoad(scene)}
                  />
                  <span className="bl-scenes-when">{formatWhen(scene.createdAt)}</span>
                </span>
                <span className="bl-scenes-rowend">
                  {isActive && dirty && (
                    <span className="bl-scenes-dot" title="Unsaved changes" />
                  )}
                  {isActive && (
                    <span className="bl-scenes-loaded" aria-label="Loaded">
                      Loaded
                    </span>
                  )}
                  <button
                    type="button"
                    className="bl-chip is-danger bl-scenes-del"
                    title={`Delete "${scene.name}"`}
                    aria-label={`Delete ${scene.name}`}
                    onClick={() => onDelete(scene)}
                  >
                    <Glyph name="trash" size={14} />
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
