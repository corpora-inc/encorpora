/**
 * Standalone "people" harness — builds the engine + static world + the NEW
 * crowd + grounded player + dynamic focus, EXACTLY as the orchestrator will
 * wire them in game.ts. Loaded by qa/people.html, exercised by qa/people.mjs.
 *
 * This proves the Wave-2 foundations (grounded cutout, character system,
 * animator, autonomous crowd, migrated player) render at 60fps with distinct
 * wandering people and planted, non-drifting shadows — independent of the
 * in-flight game.ts rewrite.
 */

import { RoomTopology, Scene as WorldSceneSchema, NpcRole, Quest } from "@corpan-city/contracts"
import topologyJson from "../content/topologies/plaza-grand.json"
import sceneJson from "../content/scenes/antigua-grand.json"
import rolesJson from "../content/npc/roles.json"
import questJson from "../content/quests/es-cafe.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { renderScene } from "../src/scene/sceneRenderer"
import { createInput } from "../src/movement/input"
import { createPlayerController } from "../src/movement/controller"
import { createNpcFocus } from "../src/world/npcFocus"
import { createCrowd } from "../src/world/crowd"
import { ANTIGUA_1770 } from "../src/character/characterGen"

const topology = RoomTopology.parse(topologyJson)
const scene = WorldSceneSchema.parse(sceneJson)
const roles = NpcRole.array().parse(rolesJson)
Quest.parse(questJson)

// avatar: a dressed player so we exercise avatar→CharacterSpec
const avatar = {
  base: "paper-doll-a",
  layers: [
    { slot: "face" as const, itemId: "face-base", tint: "#e3ad79" },
    { slot: "top" as const, itemId: "top-tunic", tint: "#3f7fae" },
    { slot: "hat" as const, itemId: "hat-tricorn", tint: "#e0c060" },
  ],
  palette: { skin: "#e3ad79", hair: "#3a2a1c" },
}

const root = document.createElement("div")
root.className = "wp-root"
const canvas = document.createElement("canvas")
canvas.className = "wp-canvas"
const overlay = document.createElement("div")
overlay.className = "wp-overlay"
root.appendChild(canvas)
root.appendChild(overlay)
document.body.appendChild(root)

const world = createWorldEngine(canvas, overlay, { skyColor: scene.palette?.sky })
applyAtmosphere(world.scene, scene.palette, world.onFrame)
renderScene(world.scene, topology, scene, world.onFrame)
const input = createInput(overlay)
const player = createPlayerController(world, topology, input, avatar)

const crowd = createCrowd(world.scene, topology, {
  count: 34,
  theme: ANTIGUA_1770,
  roles,
  seed: "antigua",
})

const focus = createNpcFocus(world, overlay, crowd.focusables, (it) => {
  ;(window as unknown as { __wpEngaged?: string }).__wpEngaged = it.anchorId
  console.log("[people] engaged:", it.anchorId)
})

world.onFrame((dt) => {
  player.update(dt)
  const p = player.getPos()
  crowd.update(dt, p)
  focus.update(dt, p, input.consumeTap())
})
world.start()
world.setPerfHudVisible(true)

// test hooks
;(window as unknown as { __wpPeople?: unknown }).__wpPeople = {
  playerPos: () => player.getPos(),
  agentPositions: () =>
    crowd.focusables.map((f) => ({
      id: f.anchorId,
      x: f.billboard.root.position.x,
      z: f.billboard.root.position.z,
    })),
}
