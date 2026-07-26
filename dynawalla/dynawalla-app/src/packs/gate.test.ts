import { test } from "node:test"
import assert from "node:assert/strict"

import { gateInstall, gateRun } from "./gate.ts"
import type { HostProfile } from "./gate.ts"
import { SDK_VERSION } from "../../../packs/sdk/src/index.ts"

const host: HostProfile = {
  version: "0.4.0",
  supports: ["items", "items.reveal", "learner.read", "haptics", "audio", "milestones", "storage"],
}

const manifest = (overrides: Record<string, unknown> = {}) => ({
  schema: 1,
  id: "abacus.tower",
  version: "1.2.0",
  name: "Abacus Tower",
  description: "Carry beads up the tower.",
  sdk: SDK_VERSION,
  host: { min: "0.3.0", max: "1.0.0" },
  entry: "index.html",
  capabilities: ["items", "haptics"],
  covers: { skills: ["add.2digit.regroup"], grades: [1, 3] },
  locales: ["en"],
  assets: { files: 12, bytes: 400_000 },
  download: { url: "https://encorpora.io/dynawalla/packs/a.zip", bytes: 90_000, sha256: "a".repeat(64) },
  ...overrides,
})

test("a fresh pack that fits installs", () => {
  const verdict = gateInstall({ raw: manifest(), host })
  assert.equal(verdict.ok, true)
  if (!verdict.ok) return
  assert.equal(verdict.action, "install")
})

test("a newer version of an installed pack is an upgrade", () => {
  const verdict = gateInstall({ raw: manifest(), host, installedVersion: "1.1.9" })
  assert.equal(verdict.ok, true)
  if (!verdict.ok) return
  assert.equal(verdict.action, "upgrade")
})

test("the same version is not an upgrade, and an older one is refused outright", () => {
  const same = gateInstall({ raw: manifest(), host, installedVersion: "1.2.0" })
  assert.equal(same.ok, false)
  if (!same.ok) assert.equal(same.refusal.code, "already_current")

  // A published artefact is immutable, so an older version arriving from the
  // catalogue means the catalogue is wrong — not that the device is ahead.
  const older = gateInstall({ raw: manifest(), host, installedVersion: "1.3.0" })
  assert.equal(older.ok, false)
  if (!older.ok) assert.equal(older.refusal.code, "downgrade")
})

test("0.10.0 is newer than 0.9.0 here too", () => {
  const verdict = gateInstall({
    raw: manifest({ version: "0.10.0", host: { min: "0.3.0" } }),
    host,
    installedVersion: "0.9.0",
  })
  assert.equal(verdict.ok, true)
  if (verdict.ok) assert.equal(verdict.action, "upgrade")
})

test("a host outside the declared range is refused with both bounds named", () => {
  const tooOld = gateInstall({ raw: manifest(), host: { ...host, version: "0.2.0" } })
  assert.equal(tooOld.ok, false)
  if (!tooOld.ok) {
    assert.equal(tooOld.refusal.code, "host_version")
    assert.match(tooOld.refusal.message, /0\.3\.0/)
    assert.match(tooOld.refusal.message, /1\.0\.0/)
    assert.match(tooOld.refusal.message, /0\.2\.0/)
  }

  const tooNew = gateInstall({ raw: manifest(), host: { ...host, version: "1.0.0" } })
  assert.equal(tooNew.ok, false, "host.max is exclusive")
})

test("a pack built against a newer SDK than this host implements is refused", () => {
  const verdict = gateInstall({ raw: manifest({ sdk: "1.9.0" }), host })
  assert.equal(verdict.ok, false)
  if (!verdict.ok) assert.equal(verdict.refusal.code, "sdk_version")
})

test("a capability this build cannot honour is refused by name", () => {
  const verdict = gateInstall({
    raw: manifest({ capabilities: ["items", "audio"] }),
    host: { ...host, supports: ["items"] },
  })
  assert.equal(verdict.ok, false)
  if (!verdict.ok) {
    assert.equal(verdict.refusal.code, "capability")
    assert.match(verdict.refusal.message, /audio/)
  }
})

test("a manifest that is not a manifest carries every reason with it", () => {
  const verdict = gateInstall({ raw: { schema: 1, id: "X" }, host })
  assert.equal(verdict.ok, false)
  if (!verdict.ok) {
    assert.equal(verdict.refusal.code, "manifest")
    assert.ok((verdict.refusal.problems ?? []).length > 3)
  }
})

test("the gate is asked again at launch, because the app is what changes", () => {
  // Installed under 0.4.0, still fine. Then the app grows past the ceiling and
  // the same bytes on disk must stop launching rather than fail inside a game.
  const raw = manifest()
  assert.equal(gateRun({ raw, host }).ok, true)

  const later = gateRun({ raw, host: { ...host, version: "1.4.0" } })
  assert.equal(later.ok, false)
  if (!later.ok) {
    assert.equal(later.refusal.code, "host_version")
    assert.match(later.refusal.message, /update/i, "a refusal should say what can be done")
  }
})

test("the grant set is the intersection, so a pack cannot outlive a capability", () => {
  // Installed while this build supported haptics; the build no longer does.
  // The pack still runs, with `haptics` simply absent from its grants.
  const verdict = gateRun({ raw: manifest(), host: { ...host, supports: ["items"] } })
  assert.equal(verdict.ok, true)
  if (!verdict.ok) return
  assert.deepEqual(verdict.granted, ["items"])
})

test("a damaged installed manifest does not launch", () => {
  const verdict = gateRun({ raw: { schema: 1 }, host })
  assert.equal(verdict.ok, false)
  if (!verdict.ok) assert.equal(verdict.refusal.code, "manifest")
})
