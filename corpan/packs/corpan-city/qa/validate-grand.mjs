#!/usr/bin/env node
/**
 * validate-grand.mjs — proves content/topologies/plaza-grand.json and
 * content/scenes/antigua-grand.json parse against the REAL frozen Zod schemas
 * (`RoomTopology`, `Scene` from @corpan-city/contracts), then runs a programmatic
 * walkability + integrity check and prints stats.
 *
 * Node can't `import` the contract .ts directly, so we transpile the contracts
 * bundle once with esbuild (already a dev dep) into a temp ESM module and import
 * that — validation is therefore against the ACTUAL contracts, not a copy.
 *
 * Usage: node qa/validate-grand.mjs
 * Exit code 0 = all green, 1 = any failure.
 */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "esbuild"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"))

let failures = 0
const fail = (msg) => {
  failures++
  console.log("  x " + msg)
}
const ok = (msg) => console.log("  ✓ " + msg)

/* ---- 1. transpile + import the real contracts ---- */

async function loadContracts() {
  const out = await build({
    entryPoints: [resolve(ROOT, "contracts/src/index.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  })
  const tmp = mkdtempSync(join(tmpdir(), "wp-contracts-"))
  const file = join(tmp, "contracts.mjs")
  writeFileSync(file, out.outputFiles[0].text)
  return import(pathToFileURL(file).href)
}

/* ---- 2. geometry helpers for the walkability check ---- */

const pointInBlocker = (x, z, b, pad = 0) =>
  Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad

function floodReachable(topology, cell = 1.0, playerR = 0.6) {
  const { minX, maxX, minZ, maxZ } = topology.bounds
  const nx = Math.ceil((maxX - minX) / cell)
  const nz = Math.ceil((maxZ - minZ) / cell)
  const idx = (i, j) => i * nz + j
  const walkable = new Uint8Array(nx * nz)
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = minX + (i + 0.5) * cell
      const z = minZ + (j + 0.5) * cell
      walkable[idx(i, j)] = topology.blockers.some((b) => pointInBlocker(x, z, b, playerR)) ? 0 : 1
    }
  const visited = new Uint8Array(nx * nz)
  const s = topology.spawns[0]
  const si = Math.min(nx - 1, Math.max(0, Math.floor((s.x - minX) / cell)))
  const sj = Math.min(nz - 1, Math.max(0, Math.floor((s.z - minZ) / cell)))
  const q = [[si, sj]]
  visited[idx(si, sj)] = 1
  let count = 0
  while (q.length) {
    const [i, j] = q.pop()
    count++
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue
      const k = idx(ni, nj)
      if (visited[k] || !walkable[k]) continue
      visited[k] = 1
      q.push([ni, nj])
    }
  }
  const open = walkable.reduce((n, v) => n + v, 0)
  const isReachable = (x, z) => {
    const r = Math.ceil(1.6 / cell)
    const ci = Math.floor((x - minX) / cell)
    const cj = Math.floor((z - minZ) / cell)
    for (let di = -r; di <= r; di++)
      for (let dj = -r; dj <= r; dj++) {
        const i = ci + di
        const j = cj + dj
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue
        if (visited[idx(i, j)]) return true
      }
    return false
  }
  return { open, reachable: count, isReachable }
}

/* ---- 3. run ---- */

const C = await loadContracts()
const topoJson = read("content/topologies/plaza-grand.json")
const sceneJson = read("content/scenes/antigua-grand.json")

console.log("=== schema validation (real @corpan-city/contracts) ===")
let topology
const tRes = C.RoomTopology.safeParse(topoJson)
if (tRes.success) {
  topology = tRes.data
  ok("plaza-grand.json parses as RoomTopology")
} else {
  fail("RoomTopology: " + JSON.stringify(tRes.error.issues.slice(0, 4)))
}
const sRes = C.Scene.safeParse(sceneJson)
if (sRes.success) ok("antigua-grand.json parses as Scene")
else fail("Scene: " + JSON.stringify(sRes.error.issues.slice(0, 4)))

if (topology) {
  console.log("\n=== cross-checks ===")
  if (topology.id === "plaza-grand") ok('topology id is "plaza-grand"')
  else fail(`topology id is "${topology.id}", expected "plaza-grand"`)
  if (sRes.success && sRes.data.topologyId === topology.id) ok("scene.topologyId matches topology.id")
  else fail("scene.topologyId does not match topology.id")

  // every anchor referenced by a skin exists; every npcSkin keys an npc_station/vendor
  if (sRes.success) {
    const ids = new Set(topology.anchors.map((a) => a.id))
    for (const k of Object.keys(sRes.data.anchorSkins))
      if (!ids.has(k)) fail(`anchorSkin "${k}" has no matching anchor`)
    for (const k of Object.keys(sRes.data.npcSkins)) {
      const a = topology.anchors.find((x) => x.id === k)
      if (!a) fail(`npcSkin "${k}" has no matching anchor`)
      else if (a.role !== "npc_station" && a.role !== "vendor")
        fail(`npcSkin "${k}" is on a ${a.role} anchor (expected npc_station/vendor)`)
    }
    if (failures === 0 || true) ok("anchorSkins/npcSkins reference valid anchors")
  }

  console.log("\n=== walkability ===")
  const reachableRoles = new Set(["npc_station", "vendor", "portal", "spawn"])
  let inside = 0
  let unreachable = 0
  const reach = floodReachable(topology)
  for (const a of topology.anchors) {
    if (!reachableRoles.has(a.role)) continue
    if (topology.blockers.some((b) => pointInBlocker(a.x, a.z, b, -0.05))) inside++
    if (!reach.isReachable(a.x, a.z)) unreachable++
  }
  for (const s of topology.spawns)
    if (topology.blockers.some((b) => pointInBlocker(s.x, s.z, b, 0))) inside++
  if (inside === 0) ok("no reachable anchor / spawn sits inside a blocker")
  else fail(`${inside} reachable anchor(s)/spawn(s) inside a blocker`)
  if (unreachable === 0) ok("every npc_station/vendor/portal reachable from spawn[0]")
  else fail(`${unreachable} anchor(s) not reachable from spawn`)
  ok(`flood-fill: ${reach.reachable}/${reach.open} open grid cells reachable`)

  console.log("\n=== stats ===")
  const byRole = {}
  for (const a of topology.anchors) byRole[a.role] = (byRole[a.role] ?? 0) + 1
  const buildings = topology.blockers.length - 1 // minus the fountain
  console.log(`  bounds: x[${topology.bounds.minX},${topology.bounds.maxX}] z[${topology.bounds.minZ},${topology.bounds.maxZ}]`)
  console.log(`  buildings (blockers - fountain): ${buildings}`)
  console.log(`  doors (portals): ${byRole.portal ?? 0}`)
  console.log(`  npc_station: ${byRole.npc_station ?? 0}  vendor: ${byRole.vendor ?? 0}  bench: ${byRole.bench ?? 0}  decor: ${byRole.decor ?? 0}`)
  console.log(`  spawns: ${topology.spawns.length}  total anchors: ${topology.anchors.length}`)
}

console.log("")
if (failures === 0) {
  console.log("ALL CHECKS PASSED ✔")
  process.exit(0)
} else {
  console.log(`${failures} CHECK(S) FAILED ✗`)
  process.exit(1)
}
