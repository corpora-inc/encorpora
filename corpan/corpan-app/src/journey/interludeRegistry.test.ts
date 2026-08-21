// interludeRegistry.test.ts — the pure builder that turns the app catalog +
// installed set into the mixer's InterludeProvider list (PREMIUM_SCROLL
// §2.2/§2.3). Generalizes interlude selection beyond any hardcoded provider.

import { test } from "node:test"
import assert from "node:assert/strict"

import { buildInterludeProviders } from "./interludeRegistry.ts"
import type { CatalogGame } from "../contentPacks/catalog.ts"

const wordfall: CatalogGame = {
  id: "wordfall",
  name: "Wordfall",
  version: "0.1.0",
  packType: "game",
  activities: [
    {
      activityType: "wordfall:catch",
      itemKinds: ["phrase", "word"],
      requiredHostApis: ["journey"],
      typicalDurationSec: 30,
    },
  ],
}
const drift: CatalogGame = {
  id: "drift",
  name: "Drift",
  version: "0.1.0",
  packType: "reader",
  activities: [
    {
      activityType: "drift:read",
      itemKinds: ["phrase"],
      requiredHostApis: ["journey"],
      typicalDurationSec: 30,
    },
  ],
}

test("builds game + reader providers from installed packs' declared activities", () => {
  const out = buildInterludeProviders([wordfall, drift], new Set(["wordfall", "drift"]))
  assert.equal(out.length, 2)
  // game first (spikes), then readers (breaths)
  assert.equal(out[0].kind, "game")
  assert.equal(out[0].provider, "wordfall")
  assert.equal(out[0].activityType, "wordfall:catch")
  assert.deepEqual(out[0].itemKinds, ["phrase", "word"])
  assert.equal(out[0].estSec, 30)
  assert.equal(out[1].kind, "reader")
  assert.equal(out[1].provider, "drift")
})

test("a pack that isn't installed is not an interlude", () => {
  const out = buildInterludeProviders([wordfall, drift], new Set(["wordfall"]))
  assert.deepEqual(out.map((i) => i.provider), ["wordfall"])
})

test("packType that isn't game/reader is skipped even if it declares activities", () => {
  const teletron: CatalogGame = {
    id: "teletron",
    name: "Teletron",
    version: "1.0.0",
    packType: "chat",
    activities: [{ activityType: "teletron:talk", itemKinds: ["phrase"], requiredHostApis: ["journey"] }],
  }
  const out = buildInterludeProviders([teletron], new Set(["teletron"]))
  assert.equal(out.length, 0)
})

test("an activity that needs a model (stt/llm) or a non-journey host api is not a sip", () => {
  const heavy: CatalogGame = {
    id: "coach",
    name: "Coach",
    version: "1.0.0",
    packType: "game",
    activities: [
      { activityType: "coach:speak", itemKinds: ["phrase"], requiredHostApis: ["journey", "stt"], modelNeeds: ["stt"] },
    ],
  }
  assert.equal(buildInterludeProviders([heavy], new Set(["coach"])).length, 0)
})

test("no activities / no installed packs ⇒ empty registry", () => {
  const bare: CatalogGame = { id: "x", name: "X", version: "1.0.0", packType: "game" }
  assert.equal(buildInterludeProviders([bare], new Set(["x"])).length, 0)
  assert.equal(buildInterludeProviders([wordfall], new Set()).length, 0)
})
