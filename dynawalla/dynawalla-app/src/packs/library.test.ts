// What the front door is allowed to show.
//
// The library is the join between three things that each have their own
// failure: what Rust found on disk, what the manifest schema accepts, and what
// this build of the app can still run. A pack that fails any of them must be
// *reported*, not dropped — it is occupying disk, and a parent who cannot see
// it cannot remove it.

import { test } from "node:test"
import assert from "node:assert/strict"

import { HOST_SUPPORTS, hostProfile, readLibrary } from "./library.ts"
import type { InstalledPackRow, PackNative } from "./native.ts"

const manifest = (over: Record<string, unknown> = {}) => ({
  schema: 1,
  id: "dynawalla.fuse",
  version: "1.0.0",
  name: "FUSE",
  description: "Chips that add to the key number fuse.",
  sdk: "1.0.0",
  host: { min: "0.1.0", max: "1.0.0" },
  entry: "pack.html",
  capabilities: ["items", "items.reveal", "haptics"],
  covers: { skills: ["dw.add.regroup.add-multidigit"], grades: [1, 4] },
  locales: ["en"],
  assets: { files: 3, bytes: 80000 },
  download: { bytes: 70000, sha256: "a".repeat(64) },
  ...over,
})

const rowFor = (raw: unknown, id = "dynawalla.fuse"): InstalledPackRow => ({
  id,
  version: "1.0.0",
  manifest: JSON.stringify(raw),
  bytes: 71878,
})

const nativeWith = (rows: InstalledPackRow[]): PackNative => ({
  list: () => Promise.resolve(rows),
  catalog: () => Promise.resolve("{}"),
  install: () => Promise.reject(new Error("not in this test")),
  remove: () => Promise.resolve(),
  entryUrl: (packId, entry) => Promise.resolve(`dynawalla-pack://localhost/${packId}/${entry}`),
})

test("an installed pack becomes a launchable entry with a grant set", async () => {
  const { entries, problems } = await readLibrary({
    native: nativeWith([rowFor(manifest())]),
    host: hostProfile("0.1.0"),
  })
  assert.deepEqual(problems, [])
  assert.equal(entries.length, 1)
  const entry = entries[0]
  assert.ok(entry)
  assert.equal(entry.name, "FUSE")
  assert.equal(entry.bytes, 71878)
  assert.deepEqual([...entry.granted], ["items", "items.reveal", "haptics"])
})

test("the grant is the intersection, not what the pack asked for", async () => {
  // A build that cannot vibrate must not hand out `haptics`, whatever the
  // manifest says — the pack was installed before the capability was removed
  // and is not allowed to keep it.
  const { entries } = await readLibrary({
    native: nativeWith([rowFor(manifest())]),
    host: { version: "0.1.0", supports: ["items", "items.reveal"] },
  })
  assert.deepEqual([...(entries[0]?.granted ?? [])], ["items", "items.reveal"])
})

test("a pack this build has grown past is refused, with a reason, not hidden", async () => {
  const { entries, problems } = await readLibrary({
    native: nativeWith([rowFor(manifest({ host: { min: "9.0.0" } }))]),
    host: hostProfile("0.1.0"),
  })
  assert.deepEqual(entries, [])
  assert.equal(problems.length, 1)
  assert.equal(problems[0]?.refusal.code, "host_version")
})

test("a damaged pack is reported rather than dropped", async () => {
  const rows = [
    { id: "broken", version: "1.0.0", manifest: "{ not json", bytes: 10 },
    rowFor(manifest()),
  ]
  const { entries, problems } = await readLibrary({
    native: nativeWith(rows),
    host: hostProfile("0.1.0"),
  })
  assert.equal(entries.length, 1, "one bad pack must not hide the others")
  assert.equal(problems.length, 1)
  assert.equal(problems[0]?.id, "broken")
})

test("the localised name is what a child is shown", async () => {
  const { entries } = await readLibrary({
    native: nativeWith([rowFor(manifest({ nameLocalized: { es: "FUSIÓN" } }))]),
    host: hostProfile("0.1.0"),
    locale: "es-MX",
  })
  assert.equal(entries[0]?.name, "FUSIÓN")
})

test("this build supports every capability the SDK defines", () => {
  // A capability in the table that no build honours is a capability a pack can
  // declare, be refused for, and never find out why. If one is ever genuinely
  // unsupported it belongs here as a deliberate omission with a note, not as an
  // oversight.
  assert.deepEqual(
    [...HOST_SUPPORTS].sort(),
    ["audio", "haptics", "items", "items.reveal", "learner.read", "milestones", "storage"],
  )
})
