/**
 * Standalone MULTIPLAYER harness — builds the engine + static world + the LOCAL
 * grounded player + the NET CLIENT, exactly as game.ts will wire them. Each
 * browser window that loads this is ONE real player in the shared plaza; the net
 * client renders every OTHER window's player as an interpolated grounded cutout.
 *
 * Loaded by qa/mp.html, exercised by qa/mp-presence.mjs (two webkit windows that
 * must see each other move). Independent of the in-flight game.ts.
 *
 * Config via URL query (so two windows get distinct identities):
 *   ?name=Ada&server=ws://localhost:2567&hat=%23e0c060&start=-6,0
 */

import { RoomTopology, Scene as WorldSceneSchema } from "@corpan-city/contracts"
import topologyJson from "../content/topologies/plaza-grand.json"
import sceneJson from "../content/scenes/antigua-grand.json"
import { createWorldEngine } from "../src/world/engine"
import { applyAtmosphere } from "../src/world/atmosphere"
import { renderScene } from "../src/scene/sceneRenderer"
import { createInput } from "../src/movement/input"
import { createPlayerController } from "../src/movement/controller"
import { ANTIGUA_1770 } from "../src/character/characterGen"
import { createNetClient } from "../src/net"

const q = new URLSearchParams(location.search)
const name = q.get("name") ?? "Traveler"
const serverUrl = q.get("server") ?? "ws://localhost:2567"
const hat = q.get("hat") ?? "#e0c060"
const top = q.get("top") ?? "#3f7fae"

const topology = RoomTopology.parse(topologyJson)
const scene = WorldSceneSchema.parse(sceneJson)

// A distinct dressed avatar per window so two players are visibly different.
const avatar = {
  base: "paper-doll-a",
  layers: [
    { slot: "face" as const, itemId: "face-base", tint: "#e3ad79" },
    { slot: "top" as const, itemId: "top-tunic", tint: top },
    { slot: "hat" as const, itemId: "hat-tricorn", tint: hat },
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

// THE NET CLIENT — best-effort presence. No server → world runs solo.
const net = createNetClient({
  url: serverUrl,
  room: "plaza",
  identity: {
    playerId: `${name}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    avatar,
    sceneId: scene.id,
    questId: "es-cafe",
  },
  topology,
  scene: world.scene,
  theme: ANTIGUA_1770,
  getLocalPos: () => player.getPos(),
  onStatus: (s) => console.log(`[mp] net status: ${s}`),
  onRemoteAdd: (id) => console.log(`[mp] remote joined: ${id}`),
  onRemoteRemove: (id) => console.log(`[mp] remote left: ${id}`),
})

world.onFrame((dt) => {
  player.update(dt)
  net.update(dt)
})
world.start()
world.setPerfHudVisible(true)

// ---- test hooks (pure observability for the Playwright harness) ----
;(window as unknown as { __wpMp?: unknown }).__wpMp = {
  status: () => net.status(),
  remoteCount: () => net.remoteCount(),
  remotePositions: () => net.remotePositions(),
  playerPos: () => player.getPos(),
}
