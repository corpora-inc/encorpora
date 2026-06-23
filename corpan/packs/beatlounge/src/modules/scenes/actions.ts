/**
 * beatlounge — Scenes module actions (LLM-callable). Two moves:
 *   - saveScene: save the current state as a named Scene (a side-effecting
 *     persist; no doc command — Scenes live in their own store slice).
 *   - loadScene: load a saved Scene by name into the live doc (returns a
 *     `loadScene` command so it flows through the bus as ONE undoable step).
 *
 * Both close over the live ScenesController so they can resolve the saved list +
 * persist. The save action's IDB write is fire-and-forget (the model has no
 * scene command); the load action returns the snapshot as a real command.
 */

import type { ActionResult, ModuleAction } from "../../contracts/module"
import { findSceneByName } from "../../store/scenesStore"
import type { ScenesController } from "./scenesController"
import { DEMO_SONGS } from "./demos"
import { ct } from "../../i18n/strings"

export const createScenesActions = (
  ctrl: ScenesController
): ReadonlyArray<ModuleAction> => {
  const saveScene: ModuleAction = {
    name: "saveScene",
    describe: ct("scenes.action.saveScene.describe"),
    params: {
      name: {
        type: "string",
        describe: ct("scenes.action.saveScene.nameParam"),
      },
    },
    impact: "tweak",
    run(_ctx, params): ActionResult {
      const name = typeof params.name === "string" ? params.name : undefined
      // Side-effecting persist (Scenes are not a doc field). Fire-and-forget;
      // the controller updates its reactive list when the write resolves.
      void ctrl.save(name)
      return {
        commands: [],
        summary: name ? ct("scenes.savedNamed", { name }) : ct("scenes.savedScene"),
      }
    },
  }

  const loadScene: ModuleAction = {
    name: "loadScene",
    describe: ct("scenes.action.loadScene.describe"),
    params: {
      name: {
        type: "string",
        describe: ct("scenes.action.loadScene.nameParam"),
      },
    },
    impact: "mutate",
    run(_ctx, params): ActionResult {
      const name = typeof params.name === "string" ? params.name.trim() : ""
      const scene = findSceneByName(ctrl.vanilla.getState().scenes, name)
      if (!scene) return { commands: [], summary: ct("scenes.noSceneNamed", { name }) }
      return {
        commands: [{ t: "loadScene", snapshot: scene.snapshot }],
        summary: ct("scenes.loadedNamed", { name: scene.name }),
      }
    },
  }

  // The "start fresh" trio dispatch through the controller (which also resets
  // the loaded-scene context + the off-doc groove), so — like saveScene — they
  // side-effect and return no extra commands. Each is ONE undoable bus step.
  const clearSong: ModuleAction = {
    name: "clearSong",
    describe: ct("scenes.action.clearSong.describe"),
    params: {},
    impact: "mutate",
    run(): ActionResult {
      ctrl.clear()
      return { commands: [], summary: ct("scenes.clearedToast") }
    },
  }

  const randomizeSong: ModuleAction = {
    name: "randomizeSong",
    describe: ct("scenes.action.randomizeSong.describe"),
    params: {},
    stochastic: true,
    impact: "mutate",
    run(): ActionResult {
      ctrl.randomize()
      return { commands: [], summary: ct("scenes.randomizedToast") }
    },
  }

  const loadDemo: ModuleAction = {
    name: "loadDemo",
    describe: ct("scenes.action.loadDemo.describe"),
    params: {
      name: {
        type: "string",
        describe: ct("scenes.action.loadDemo.nameParam"),
      },
    },
    impact: "mutate",
    run(_ctx, params): ActionResult {
      const name = typeof params.name === "string" ? params.name.trim().toLowerCase() : ""
      const demo = DEMO_SONGS.find((d) => d.name.toLowerCase() === name)
      if (!demo || !ctrl.loadDemo(demo.id)) {
        return { commands: [], summary: ct("scenes.noSceneNamed", { name }) }
      }
      return { commands: [], summary: ct("scenes.demoToast", { name: demo.name }) }
    },
  }

  return [saveScene, loadScene, clearSong, randomizeSong, loadDemo]
}
