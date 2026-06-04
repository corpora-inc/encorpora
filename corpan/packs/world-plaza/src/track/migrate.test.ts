// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { GeneratedIdentity, AvatarSpec, trackId } from "@world-plaza/contracts"
import { createTrackStore } from "../storage/trackStore"
import { migrateLegacyToTracks, economyKey, questKey, manifestKey } from "./migrate"
import { loadRegistry, hasRegistry, REGISTRY_KEY } from "./registry"

/** A valid default identity/avatar fallback for migrations missing the legacy record. */
const FALLBACK = () => ({
  name: GeneratedIdentity.parse({
    playerId: "player-local",
    displayName: "Brave Marigold",
    nameSeed: { adjId: "brave", nounId: "marigold" },
  }),
  avatar: AvatarSpec.parse({ base: "default", layers: [] }),
})

function ctx() {
  return {
    store: createTrackStore({ forceLocalStorage: true }),
    hostNative: "en",
    questPair: { native: "en", target: "es" },
    defaultQuestId: "es-guadalajara-route",
    defaultSceneId: "antigua",
    fallbackIdentity: FALLBACK,
  }
}

describe("migrateLegacyToTracks — idempotent fold of single-state", () => {
  beforeEach(() => localStorage.clear())

  it("brand-new player → writes an empty registry, outcome 'fresh'", async () => {
    const res = await migrateLegacyToTracks(ctx())
    expect(res.outcome).toBe("fresh")
    expect(hasRegistry()).toBe(true)
    expect(loadRegistry().tracks).toEqual([])
  })

  it("existing single-state → folds into a default Track, lossless COPY", async () => {
    // Plant today's legacy global state.
    localStorage.setItem(
      "wp:identity:v1",
      JSON.stringify({
        name: {
          playerId: "player-local",
          displayName: "Calm Heron",
          nameSeed: { adjId: "calm", nounId: "heron" },
        },
        avatar: { base: "default", layers: [] },
      }),
    )
    localStorage.setItem("wp:economy:v1", JSON.stringify({ v: 1, c: 42, x: 99, b: [], e: {} }))
    localStorage.setItem(
      "wp:quest:v1",
      JSON.stringify({ v: 1, q: "es-guadalajara-route", d: { docks: true }, x: 99, c: false }),
    )

    const c = ctx()
    const res = await migrateLegacyToTracks(c)
    const id = trackId("en", "es")

    expect(res.outcome).toBe("migrated")
    expect(res.trackId).toBe(id)

    // Legacy bodies COPIED verbatim under the Track namespace.
    expect(await c.store.read(economyKey(id))).toEqual({ v: 1, c: 42, x: 99, b: [], e: {} })
    expect(await c.store.read(questKey(id))).toEqual({
      v: 1,
      q: "es-guadalajara-route",
      d: { docks: true },
      x: 99,
      c: false,
    })

    // Manifest stamped with the legacy identity + active quest/scene.
    const manifest = (await c.store.read(manifestKey(id))) as Record<string, unknown>
    expect(manifest).toBeTruthy()
    expect((manifest.identity as { displayName: string }).displayName).toBe("Calm Heron")
    expect(manifest.activeQuestId).toBe("es-guadalajara-route")
    expect(manifest.activeSceneId).toBe("antigua")

    // Registry: this Track active + headline with xp glance.
    const reg = loadRegistry()
    expect(reg.activeTrackId).toBe(id)
    expect(reg.tracks).toHaveLength(1)
    expect(reg.tracks[0].headline.xp).toBe(99)
    expect(reg.tracks[0].headline.displayName).toBe("Calm Heron")

    // Legacy keys LEFT IN PLACE (rollback safety net, one release).
    expect(localStorage.getItem("wp:economy:v1")).not.toBeNull()
    expect(localStorage.getItem("wp:identity:v1")).not.toBeNull()
  })

  it("is IDEMPOTENT — running twice yields the same registry (second run is a no-op)", async () => {
    localStorage.setItem("wp:economy:v1", JSON.stringify({ v: 1, c: 5, x: 1, b: [], e: {} }))
    const c = ctx()
    const first = await migrateLegacyToTracks(c)
    const regAfterFirst = localStorage.getItem(REGISTRY_KEY)

    // Mutate legacy AFTER migration — a second run must NOT re-fold it.
    localStorage.setItem("wp:economy:v1", JSON.stringify({ v: 1, c: 999, x: 999, b: [], e: {} }))
    const second = await migrateLegacyToTracks(c)
    const regAfterSecond = localStorage.getItem(REGISTRY_KEY)

    expect(first.outcome).toBe("migrated")
    expect(second.outcome).toBe("skipped")
    expect(regAfterSecond).toBe(regAfterFirst) // registry unchanged
    // The Track's economy still reflects the FIRST migration, not the mutation.
    expect(await c.store.read(economyKey(trackId("en", "es")))).toEqual({
      v: 1,
      c: 5,
      x: 1,
      b: [],
      e: {},
    })
  })

  it("immersion Track (native===target) is forced 'on' in the manifest", async () => {
    localStorage.setItem("wp:economy:v1", JSON.stringify({ v: 1, c: 0, x: 0, b: [], e: {} }))
    const c = { ...ctx(), questPair: { native: "es", target: "es" }, hostNative: "es" }
    const res = await migrateLegacyToTracks(c)
    const id = trackId("es", "es")
    expect(res.trackId).toBe(id)
    const manifest = (await c.store.read(manifestKey(id))) as Record<string, unknown>
    expect(manifest.immersion).toBe("on")
  })

  it("missing legacy identity → stamps a default persona (does not crash)", async () => {
    // Only economy present (no identity record).
    localStorage.setItem("wp:economy:v1", JSON.stringify({ v: 1, c: 3, x: 0, b: [], e: {} }))
    const c = ctx()
    const res = await migrateLegacyToTracks(c)
    expect(res.outcome).toBe("migrated")
    const manifest = (await c.store.read(manifestKey(trackId("en", "es")))) as Record<
      string,
      unknown
    >
    expect((manifest.identity as { displayName: string }).displayName).toBe("Brave Marigold")
  })
})
