#!/usr/bin/env node
/**
 * topologies.mjs — TOPOLOGY GENERATOR proof + variant emitter (Slice 4c).
 *
 * Transpiles the REAL TS (src/world/topologyGen.ts + the frozen contracts) with
 * esbuild and runs them in Node, so this validates the ACTUAL generator, not a
 * copy. For every archetype it:
 *   1. generates a topology from a seed,
 *   2. parses it against the FROZEN `RoomTopology` Zod schema (fail loud),
 *   3. runs the generator's own `checkWalkability` (flood-fill reachability +
 *      bounds/overlap integrity),
 *   4. asserts typed-anchor coverage (every generated anchor carries a `kind`),
 *   5. for the route archetypes, asserts a `docks` / `city_gate` anchor exists.
 *
 * With `--write` it emits a curated set of variant topologies into
 * content/topologies/ (a harbor with docks, a walled-town with a city gate, and
 * a couple of showcase variants) for the QA mounts + game.ts to load.
 *
 * Usage:
 *   node qa/topologies.mjs            # validate all archetypes, print a table
 *   node qa/topologies.mjs --write    # also write the curated variant JSONs
 * Exit 0 = all green, 1 = any failure.
 */
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { build } from "esbuild"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, "..")
const WRITE = process.argv.includes("--write")

let failures = 0
const fail = (m) => {
  failures++
  console.log("  x " + m)
}
const ok = (m) => console.log("  ✓ " + m)

/* ---- transpile + import the REAL contracts + generator ---- */
async function loadModule(entry) {
  const out = await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
    alias: { "@world-plaza/contracts": resolve(ROOT, "contracts/src/index.ts") },
  })
  const tmp = mkdtempSync(join(tmpdir(), "wp-topo-"))
  const file = join(tmp, "mod.mjs")
  writeFileSync(file, out.outputFiles[0].text)
  return import(pathToFileURL(file).href)
}

async function main() {
  const contracts = await loadModule(resolve(ROOT, "contracts/src/index.ts"))
  const gen = await loadModule(resolve(ROOT, "src/world/topologyGen.ts"))
  const { RoomTopology } = contracts
  const { generateTopology, checkWalkability, ALL_ARCHETYPES } = gen

  console.log("=== topology generator — archetype validation ===\n")
  const SEED = 4242
  const rows = []
  for (const archetype of ALL_ARCHETYPES) {
    const r = generateTopology({ archetype, seed: SEED })
    const t = r.topology

    // 1. frozen Zod schema
    const parsed = RoomTopology.safeParse(t)
    if (!parsed.success) {
      fail(`${archetype}: RoomTopology schema REJECTED — ${parsed.error.issues[0]?.message}`)
      continue
    }

    // 2. walkability + integrity
    const reach = checkWalkability(t)
    if (!reach.ok) {
      fail(
        `${archetype}: walkability FAILED — unreachable=[${reach.unreachableAnchors.join(
          ",",
        )}] oob=[${reach.outOfBounds.join(",")}]`,
      )
    }

    // 3. typed-anchor coverage: every anchor carries a kind.
    const untyped = t.anchors.filter((a) => !a.kind)
    if (untyped.length) fail(`${archetype}: ${untyped.length} anchors missing typed kind`)

    // 4. balance sanity: a few buildings, a fountain, spawns.
    if (r.stats.buildings < 4) fail(`${archetype}: only ${r.stats.buildings} buildings (too sparse)`)
    if (!t.anchors.some((a) => a.kind === "fountain")) fail(`${archetype}: no fountain anchor`)
    if (t.spawns.length < 1) fail(`${archetype}: no spawns`)

    rows.push({
      archetype,
      blockers: t.blockers.length,
      anchors: t.anchors.length,
      buildings: r.stats.buildings,
      reach: `${reach.reachableCells}/${reach.openCells}`,
      kinds: Object.keys(r.stats.anchorsByKind).length,
    })
  }

  // 5. route-anchor coverage on the dedicated archetypes.
  const harbor = generateTopology({ archetype: "harbor", seed: SEED })
  if (!harbor.topology.anchors.some((a) => a.kind === "docks"))
    fail("harbor: missing a `docks` anchor (route quest needs it)")
  else ok("harbor emits a typed `docks` anchor (es-guadalajara-route step `docks`)")

  const walled = generateTopology({ archetype: "walled-town", seed: SEED })
  if (!walled.topology.anchors.some((a) => a.kind === "city_gate"))
    fail("walled-town: missing a `city_gate` anchor")
  else ok("walled-town emits a typed `city_gate` anchor (route step `gate`)")

  // determinism: same seed → identical JSON.
  const a1 = JSON.stringify(generateTopology({ archetype: "grand-plaza", seed: 7 }).topology)
  const a2 = JSON.stringify(generateTopology({ archetype: "grand-plaza", seed: 7 }).topology)
  if (a1 !== a2) fail("determinism: same seed produced different topology")
  else ok("deterministic: same seed → byte-identical topology")
  // distinctness: different seed → different JSON.
  const b1 = JSON.stringify(generateTopology({ archetype: "grand-plaza", seed: 8 }).topology)
  if (a1 === b1) fail("distinctness: different seed produced identical topology")
  else ok("distinct: different seed → visibly different topology")

  console.log("\narchetype            blk  anc  bld  reach(cells)   kinds")
  for (const r of rows) {
    console.log(
      `  ${r.archetype.padEnd(18)} ${String(r.blockers).padStart(3)} ${String(r.anchors).padStart(
        4,
      )} ${String(r.buildings).padStart(4)}  ${r.reach.padEnd(13)} ${String(r.kinds).padStart(2)}`,
    )
  }

  /* ---- write curated variant topologies ---- */
  if (WRITE) {
    const outDir = resolve(ROOT, "content/topologies")
    mkdirSync(outDir, { recursive: true })
    const variants = [
      // route-ready waterfront with a real DOCKS quay.
      { archetype: "harbor", seed: 1770, id: "plaza-harbor" },
      // route-ready walled town with a CITY_GATE.
      { archetype: "walled-town", seed: 1770, id: "plaza-walled" },
      // showcase variety.
      { archetype: "market-square", seed: 1770, id: "plaza-market" },
      { archetype: "garden-court", seed: 1770, id: "plaza-garden" },
    ]
    console.log("\nwriting variants:")
    for (const v of variants) {
      const r = generateTopology(v)
      const reach = checkWalkability(r.topology)
      const parsed = RoomTopology.safeParse(r.topology)
      if (!parsed.success || !reach.ok) {
        fail(`variant ${v.id} failed validation — NOT written`)
        continue
      }
      const p = join(outDir, `${v.id}.json`)
      writeFileSync(p, JSON.stringify(r.topology, null, 2) + "\n")
      console.log(`  wrote ${p}  (${r.stats.buildings} buildings, ${r.topology.anchors.length} anchors)`)
    }
  }

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL GREEN ✔")
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
