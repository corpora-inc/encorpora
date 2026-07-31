// What the front door is allowed to show.
//
// The library is the join between three things that each have their own
// failure: what Rust found on disk, what the manifest schema accepts, and what
// this build of the app can still run. A pack that fails any of them must be
// *reported*, not dropped — it is occupying disk, and a parent who cannot see
// it cannot remove it.

import { test } from "node:test"
import assert from "node:assert/strict"

import { CAPABILITY_IDS } from "../../../packs/sdk/src/index.ts"
import { HOST_SUPPORTS, cardFacts, hostProfile, readLibrary } from "./library.ts"
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
  covers: { skills: ["dw.add.regroup.add-multidigit"] },
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

test("a retired pack — installed, gone from the catalogue — is still a launchable card", async () => {
  // **What happens to a child who already has a game that got retired.**
  //
  // Games leave the fleet: THE GRAPPLE FOUNDRY and THE GAVEL were withdrawn
  // before the first production release. The fear that has to be answered is a
  // front door that lists a withdrawn pack, tries to fetch it, and draws a
  // broken tile or a 404 on a device where the pack is sitting on disk, whole.
  //
  // It cannot happen, and this is why: the library is read from the pack root
  // and *nothing else*. `readLibrary` never asks for the catalogue, so a pack's
  // absence from it is not an input to whether the card appears. The native
  // `catalog` here throws to prove that — the test fails the moment the front
  // door starts consulting a remote list to decide what a child may open.
  const native: PackNative = {
    ...nativeWith([rowFor(manifest({ id: "dynawalla.gavel" }), "dynawalla.gavel")]),
    catalog: () => Promise.reject(new Error("the front door asked for the catalogue")),
  }
  const { entries, problems } = await readLibrary({ native, host: hostProfile("0.1.0") })

  assert.deepEqual(problems, [])
  assert.equal(entries.length, 1, "a pack the catalogue no longer lists vanished from the device")
  const entry = entries[0]
  assert.ok(entry)
  // Launchable, not merely listed: it holds a grant and an entry document, which
  // is everything `PackFrame` needs to open it off the local pack scheme.
  assert.deepEqual([...entry.granted], ["items", "items.reveal", "haptics"])
  assert.equal(entry.manifest.entry, "pack.html")
  assert.equal(await native.entryUrl(entry.manifest.id, entry.manifest.entry), "dynawalla-pack://localhost/dynawalla.gavel/pack.html")
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
  // unsupported it belongs in `DELIBERATELY_UNSUPPORTED` with a sentence saying
  // which build it is missing from and why, not as an oversight.
  //
  // Compared against the SDK's own table rather than a frozen literal, which is
  // what makes this the invariant its name claims: a hard-coded list passes by
  // being edited, and the edit is exactly the moment somebody would have had to
  // notice the omission.
  //
  // In particular a NATIVE-backed capability belongs here as soon as the build
  // implements it, whatever the device in somebody's hand can do. This list
  // feeds `gateInstall`, which refuses the *install* of a pack asking for
  // something missing from it, so removing one to describe a tablet with no
  // gyroscope would stop that tablet installing the pack rather than letting the
  // pack run without tilt. Device-level absence is `HostServices.available()`.
  const DELIBERATELY_UNSUPPORTED: readonly string[] = []
  const expected = CAPABILITY_IDS.filter((id) => !DELIBERATELY_UNSUPPORTED.includes(id))
  assert.deepEqual([...HOST_SUPPORTS].sort(), [...expected].sort())
})

test("the card's facts are description and skills — no grade band, no age", async () => {
  // `libraryStore` persists this projection and `useHost` lays it back over the
  // stored record. It is one function precisely so those two cannot disagree.
  //
  // This used to carry `grades` and `minAge` too, for the card to print as
  // "Grades 1–4" and "8+". Both were removed by founder instruction: a band
  // names a top, and this product does not have one. So the assertion is now an
  // exact key set rather than a subset check — a subset check is what would let
  // a band quietly reappear in the persisted record and reach a card again.
  const stated = await readLibrary({
    native: nativeWith([rowFor(manifest({ minAge: 8 }))]),
    host: hostProfile("0.1.0"),
  })
  const withAge = stated.entries[0]
  assert.ok(withAge)
  // The manifest still states a minimum age — it is an editorial claim about
  // motor demand that store age declarations rest on, and `fleet.test.ts` still
  // requires one. What changed is that nothing projects it onto a card.
  assert.equal(withAge.manifest.minAge, 8, "the manifest lost its stated age")
  assert.deepEqual(cardFacts(withAge), {
    description: "Chips that add to the key number fuse.",
    skills: ["dw.add.regroup.add-multidigit"],
  })

  const silent = await readLibrary({
    native: nativeWith([rowFor(manifest())]),
    host: hostProfile("0.1.0"),
  })
  const withoutAge = silent.entries[0]
  assert.ok(withoutAge)
  const facts = cardFacts(withoutAge)
  assert.equal("minAge" in facts, false, "an age reached the card again")
  assert.equal("grades" in facts, false, "a grade band reached the card again")
  assert.deepEqual(Object.keys(facts).sort(), ["description", "skills"])
})
