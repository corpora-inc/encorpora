// Install, upgrade, refuse, remove — every path, with the native side faked.
//
// The fake is deliberately dumb: it records what it was asked to do and answers
// with whatever the test wants. All the behaviour under test is in `install.ts`,
// which is the point of having a port at all — the interesting cases here
// (a declined consent, a corrupt archive, a pack that is not what the catalogue
// said) are ones nobody would reproduce on a device twice.

import { test } from "node:test"
import assert from "node:assert/strict"

import { installPack, planUpdates, readInstalled, removePack } from "./install.ts"
import type { Consent, InstallDeps, InstalledPack } from "./install.ts"
import type { InstallArgs, InstalledPackRow, PackNative } from "./native.ts"
import type { HostProfile } from "./gate.ts"
import { parseManifest, SDK_VERSION } from "../../../packs/sdk/src/index.ts"
import type { PackManifest } from "../../../packs/sdk/src/index.ts"

const host: HostProfile = {
  version: "0.4.0",
  supports: ["items", "items.reveal", "learner.read", "haptics", "audio", "milestones", "storage"],
}

const raw = (overrides: Record<string, unknown> = {}) => ({
  schema: 1,
  id: "abacus.tower",
  version: "1.2.0",
  name: "Abacus Tower",
  description: "Carry beads up the tower.",
  sdk: SDK_VERSION,
  host: { min: "0.3.0", max: "1.0.0" },
  entry: "index.html",
  capabilities: ["items", "haptics"],
  covers: { skills: ["add.2digit.regroup"] },
  locales: ["en"],
  assets: { files: 12, bytes: 400_000 },
  download: {
    url: "https://encorpora.io/dynawalla/packs/abacus-tower-1.2.0.zip",
    bytes: 90_000,
    sha256: "a".repeat(64),
  },
  ...overrides,
})

const asManifest = (value: unknown): PackManifest => {
  const parsed = parseManifest(value)
  assert.equal(parsed.ok, true, parsed.ok ? "" : parsed.problems.join("; "))
  if (!parsed.ok) throw new Error("unreachable")
  return parsed.manifest
}

type Recorder = {
  native: PackNative
  installs: InstallArgs[]
  removals: string[]
}

function fakeNative(options: {
  rows?: InstalledPackRow[]
  onInstall?: (args: InstallArgs) => InstalledPackRow | Error
  catalog?: string
} = {}): Recorder {
  const installs: InstallArgs[] = []
  const removals: string[] = []
  return {
    installs,
    removals,
    native: {
      list: async () => options.rows ?? [],
      catalog: async () => options.catalog ?? "{}",
      install: async (args) => {
        installs.push(args)
        const result =
          options.onInstall?.(args) ??
          ({ id: args.packId, version: args.version, manifest: "{}", bytes: 400_000 } as InstalledPackRow)
        if (result instanceof Error) throw result
        return result
      },
      remove: async (packId) => {
        removals.push(packId)
      },
      entryUrl: async (packId, entry) => `dynawalla-pack://localhost/${packId}/${entry}`,
    },
  }
}

const deps = (recorder: Recorder, confirm: InstallDeps["confirm"]): InstallDeps => ({
  native: recorder.native,
  host,
  confirm,
})

const yes = async () => true
const no = async () => false

test("a fresh install asks first, then downloads exactly what the manifest declared", async () => {
  const recorder = fakeNative()
  const seen: Consent[] = []
  const outcome = await installPack(
    raw(),
    [],
    deps(recorder, async (consent) => {
      seen.push(consent)
      return true
    }),
  )

  assert.equal(outcome.ok, true)
  if (!outcome.ok) return
  assert.equal(outcome.action, "install")

  // The consent sheet carries the two facts a silent install hides.
  assert.equal(seen.length, 1)
  assert.equal(seen[0]?.downloadBytes, 90_000)
  assert.equal(seen[0]?.installedBytes, 400_000)
  assert.deepEqual(seen[0]?.capabilities, ["items", "haptics"])
  assert.equal(seen[0]?.name, "Abacus Tower")

  assert.deepEqual(recorder.installs, [
    {
      packId: "abacus.tower",
      version: "1.2.0",
      url: "https://encorpora.io/dynawalla/packs/abacus-tower-1.2.0.zip",
      sha256: "a".repeat(64),
      bytes: 90_000,
    },
  ])
})

test("declining downloads nothing at all", async () => {
  const recorder = fakeNative()
  const outcome = await installPack(raw(), [], deps(recorder, no))
  assert.equal(outcome.ok, false)
  if (!outcome.ok) assert.equal(outcome.failure.code, "declined")
  assert.deepEqual(recorder.installs, [], "a declined install still downloaded")
})

test("the consent sheet is shown before the download, not after", async () => {
  const order: string[] = []
  const recorder = fakeNative({
    onInstall: (args) => {
      order.push("download")
      return { id: args.packId, version: args.version, manifest: "{}", bytes: 1 }
    },
  })
  await installPack(
    raw(),
    [],
    deps(recorder, async () => {
      order.push("ask")
      return true
    }),
  )
  assert.deepEqual(order, ["ask", "download"])
})

test("an upgrade is offered as an upgrade and refused when it is a downgrade", async () => {
  const installed: InstalledPack[] = [{ manifest: asManifest(raw({ version: "1.1.0" })), bytes: 1 }]
  const upgrade = await installPack(raw(), installed, deps(fakeNative(), yes))
  assert.equal(upgrade.ok, true)
  if (upgrade.ok) assert.equal(upgrade.action, "upgrade")

  const ahead: InstalledPack[] = [{ manifest: asManifest(raw({ version: "1.4.0" })), bytes: 1 }]
  const recorder = fakeNative()
  const backwards = await installPack(raw(), ahead, deps(recorder, yes))
  assert.equal(backwards.ok, false)
  if (!backwards.ok) assert.equal(backwards.failure.code, "downgrade")
  assert.deepEqual(recorder.installs, [], "a downgrade was downloaded")
})

test("a failed integrity check is an integrity failure and installs nothing", async () => {
  const recorder = fakeNative({
    onInstall: () => new Error("integrity check failed: expected aaa…, got bbb…"),
  })
  const outcome = await installPack(raw(), [], deps(recorder, yes))
  assert.equal(outcome.ok, false)
  if (!outcome.ok) assert.equal(outcome.failure.code, "integrity")
})

test("an archive that is not what the catalogue promised is not a successful install", async () => {
  // The version-drift case: recording it as installed would both lie about
  // success and leave the update offer re-offering forever, because the
  // installed version would never converge on the catalogue's.
  const recorder = fakeNative({
    onInstall: (args) => ({ id: args.packId, version: "0.9.0", manifest: "{}", bytes: 1 }),
  })
  const outcome = await installPack(raw(), [], deps(recorder, yes))
  assert.equal(outcome.ok, false)
  if (!outcome.ok) {
    assert.equal(outcome.failure.code, "identity")
    assert.match(outcome.failure.message, /0\.9\.0/)
  }
})

test("a download that never arrives is a network failure, not a silent nothing", async () => {
  const recorder = fakeNative({ onInstall: () => new Error("download interrupted: reset") })
  const outcome = await installPack(raw(), [], deps(recorder, yes))
  assert.equal(outcome.ok, false)
  if (!outcome.ok) assert.equal(outcome.failure.code, "network")
})

test("a catalogue entry with no artefact is refused before the parent is asked", async () => {
  const recorder = fakeNative()
  let asked = false
  const outcome = await installPack(
    raw({ download: { bytes: 90_000, sha256: "a".repeat(64) } }),
    [],
    deps(recorder, async () => {
      asked = true
      return true
    }),
  )
  assert.equal(outcome.ok, false)
  if (!outcome.ok) assert.equal(outcome.failure.code, "unavailable")
  assert.equal(asked, false)
})

test("a manifest that does not validate never reaches the native side", async () => {
  const recorder = fakeNative()
  const outcome = await installPack({ schema: 1, id: "x" }, [], deps(recorder, yes))
  assert.equal(outcome.ok, false)
  if (!outcome.ok) assert.equal(outcome.failure.code, "manifest")
  assert.deepEqual(recorder.installs, [])
})

test("reading what is installed separates the usable from the damaged", async () => {
  const good = JSON.stringify(raw())
  const recorder = fakeNative({
    rows: [
      { id: "abacus.tower", version: "1.2.0", manifest: good, bytes: 400_000 },
      { id: "broken.one", version: "1.0.0", manifest: "{not json", bytes: 10 },
      { id: "wrong.schema", version: "1.0.0", manifest: '{"schema":1,"id":"wrong.schema"}', bytes: 10 },
      // A directory whose manifest claims to be a different pack: the id is the
      // directory name and the two must agree, or `dynawalla-pack://a/…` and
      // `dynawalla-pack://b/…` could serve the same files.
      {
        id: "imposter",
        version: "1.2.0",
        manifest: good,
        bytes: 10,
      },
    ],
  })

  const result = await readInstalled(recorder.native)
  assert.deepEqual(
    result.packs.map((pack) => pack.manifest.id),
    ["abacus.tower"],
  )
  assert.deepEqual(
    result.damaged.map((entry) => entry.id).sort(),
    ["broken.one", "imposter", "wrong.schema"],
  )
  // Damaged packs are reported rather than hidden: they are occupying disk and
  // the parent has to be able to remove them.
  assert.ok(result.damaged.every((entry) => entry.problems.length > 0))
})

test("removal goes through", async () => {
  const recorder = fakeNative()
  await removePack(recorder.native, "abacus.tower")
  assert.deepEqual(recorder.removals, ["abacus.tower"])
})

test("update planning offers only what would actually install", async () => {
  const installed: InstalledPack[] = [
    { manifest: asManifest(raw({ version: "1.1.0" })), bytes: 1 },
    { manifest: asManifest(raw({ id: "other.pack", version: "2.0.0" })), bytes: 1 },
    { manifest: asManifest(raw({ id: "orphan.pack", version: "1.0.0" })), bytes: 1 },
  ]
  const catalog = [
    asManifest(raw()), // 1.2.0 — a real upgrade
    asManifest(raw({ id: "other.pack", version: "1.0.0" })), // older than installed
    // A newer version of an installed pack that this app is too old to run.
    // Never offered: a parent must not be shown an update that would be refused.
    asManifest(raw({ id: "orphan.pack", version: "9.0.0", host: { min: "5.0.0" } })),
  ]

  const offers = planUpdates(catalog, installed, host)
  assert.deepEqual(
    offers.map((offer) => [offer.manifest.id, offer.from, offer.to]),
    [["abacus.tower", "1.1.0", "1.2.0"]],
  )
  assert.equal(offers[0]?.downloadBytes, 90_000)
})

test("a pack the catalogue has dropped entirely is left alone, not chased", () => {
  // **The retirement path.** A game can leave the fleet — THE GRAPPLE FOUNDRY
  // and THE GAVEL were withdrawn before the first production release — and when
  // it does, its id simply stops appearing in the catalogue. There is no
  // tombstone entry, no `download.url` set to null, no "unlisted" flag: the row
  // is gone.
  //
  // What this pins, in the terms it was measured in: an installed pack with no
  // catalogue row produces NO offer, throws nothing, and does not take the
  // offers of the packs beside it down with it. So a device holding a retired
  // game is never shown an update it has no artefact for.
  //
  // It survives two independent guards, which is worth writing down because it
  // means neither can be removed on the assumption that the other is load
  // bearing. `planUpdates` iterates the INSTALLED side and skips an id the
  // catalogue does not answer for; and deleting that skip does not change this
  // test's result, because `gateInstall` then refuses the `undefined` it is
  // handed. Checked by mutating the skip away and re-running.
  const installed: InstalledPack[] = [
    { manifest: asManifest(raw({ version: "1.1.0" })), bytes: 1 },
    { manifest: asManifest(raw({ id: "dynawalla.gavel", version: "1.0.0" })), bytes: 1 },
    { manifest: asManifest(raw({ id: "dynawalla.foundry", version: "1.0.0" })), bytes: 1 },
  ]
  // The catalogue this build publishes: the retired pair are not in it at all.
  const catalog = [asManifest(raw())]

  const offers = planUpdates(catalog, installed, host)
  assert.deepEqual(
    offers.map((offer) => offer.manifest.id),
    ["abacus.tower"],
    "a retired pack was offered an update it has no artefact for",
  )

  // An empty catalogue is the same answer, not a special case: it is what a
  // device sees if the catalogue fetch returns a build that ships no packs.
  assert.deepEqual(planUpdates([], installed, host), [])
})
