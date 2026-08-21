// The registry, and the one message a pack can send the host.
//
// The boundary is small enough to test exhaustively, and it is worth testing
// exhaustively for exactly that reason: it is the contract every pack will be
// built against, and it is the expensive thing to change once one is installed
// on a child's tablet.

import { test } from "node:test"
import assert from "node:assert/strict"

import { recordFor, worldFor } from "../app/stores.ts"
import { useProfiles } from "../profiles/store.ts"
import { useSettings } from "../settings/store.ts"
import { formatBytes, packBytes, usePacks, type InstalledPack } from "./registry.ts"
import { packHost, report } from "./host.ts"

const pack = (id: string, bytes: number): InstalledPack => ({
  id,
  name: id,
  version: "1.0.0",
  bytes,
  sha256: "",
  installedAt: 0,
})

test("bytes are counted, and read the way a parent reads them", () => {
  assert.equal(formatBytes(0), "0 B")
  assert.equal(formatBytes(512), "512 B")
  assert.equal(formatBytes(1024), "1.0 kB")
  assert.equal(formatBytes(1_572_864), "1.5 MB")
  assert.equal(formatBytes(20 * 1024 * 1024), "20 MB")
  // Never a negative and never a fraction of a byte, whatever the caller has.
  assert.equal(formatBytes(-1), "0 B")
  assert.equal(packBytes([pack("a", 100), pack("b", -50)]), 100)
})

test("installing and updating a pack are the same write", () => {
  const registry = usePacks.getState()
  registry.record(pack("inc.corpora.pack.a", 10))
  registry.record(pack("inc.corpora.pack.b", 20))
  assert.equal(usePacks.getState().installed.length, 2)

  // An update is not a second copy of the pack.
  usePacks.getState().record({ ...pack("inc.corpora.pack.a", 30), version: "2.0.0" })
  const installed = usePacks.getState().installed
  assert.equal(installed.length, 2)
  assert.equal(installed.find((entry) => entry.id === "inc.corpora.pack.a")?.version, "2.0.0")
  assert.equal(packBytes(installed), 50)

  usePacks.getState().forget("inc.corpora.pack.a")
  assert.deepEqual(
    usePacks.getState().installed.map((entry) => entry.id),
    ["inc.corpora.pack.b"],
  )
})

test("a pack is handed the settings it must honour, and nothing about the child", () => {
  useSettings.getState().set({ sound: false, haptics: true, quality: "plain" })
  useProfiles.getState().select(useProfiles.getState().currentId)

  const host = packHost()
  assert.equal(host.settings.sound, false)
  assert.equal(host.settings.quality, "plain")
  assert.equal(host.profileId, useProfiles.getState().currentId)

  // The whole surface, enumerated. A pack that can reach further than this is
  // a pack that can reach a child's name, another pack's storage, or the app's
  // own navigation — none of which it is given a way to name.
  assert.deepEqual(Object.keys(host).sort(), ["profileId", "report", "settings"])
  assert.deepEqual(Object.keys(host.settings).sort(), [
    "haptics",
    "quality",
    "reduceMotion",
    "sound",
    "textSize",
  ])
})

test("a correct answer cuts one aperture; a wrong one cuts none and costs none", () => {
  const { currentId } = useProfiles.getState()
  const before = {
    answered: recordFor(currentId).getState().answered,
    correct: recordFor(currentId).getState().correct,
    placed: worldFor(currentId).getState().placed,
  }

  report({ packId: "inc.corpora.pack.a", correct: true })
  report({ packId: "inc.corpora.pack.a", correct: false })

  const after = {
    answered: recordFor(currentId).getState().answered,
    correct: recordFor(currentId).getState().correct,
    placed: worldFor(currentId).getState().placed,
  }

  assert.equal(after.answered, before.answered + 2)
  assert.equal(after.correct, before.correct + 1)
  // Construction never regresses, and a wrong answer is not a punishment: the
  // second report moved the count of what was answered and nothing else.
  assert.equal(after.placed, before.placed + 1)
})

test("an outcome lands on the learner the app is currently for", () => {
  useProfiles.getState().add("")
  const second = useProfiles.getState().currentId
  const first = useProfiles.getState().profiles[0]?.id ?? "p1"
  assert.notEqual(first, second)

  const firstBefore = recordFor(first).getState().answered
  report({ packId: "inc.corpora.pack.a", correct: true })

  assert.equal(recordFor(second).getState().answered, 1)
  assert.equal(recordFor(first).getState().answered, firstBefore)
})
