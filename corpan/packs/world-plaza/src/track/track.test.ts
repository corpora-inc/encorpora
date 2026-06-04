// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { GeneratedIdentity, AvatarSpec, trackId, type TrackState } from "@world-plaza/contracts"
import type {
  InventoryStore,
  QuestEngine,
  TrackStoreBinding,
} from "../contracts/runtime"
import { createTrackStore } from "../storage/trackStore"
import { createTrackManager, type TrackFactories, type CreateTrackInput } from "./track"
import { loadRegistry } from "./registry"

/**
 * TrackManager: create / switch / list. We inject LIGHTWEIGHT fake factories that
 * (a) record the binding namespace they receive (proving the manager threads the
 * right `{namespace, store}` per Track) and (b) persist a trivial body under that
 * namespace (proving switch isolation + lossless save→load). The REAL
 * inventory/quest factories opt into the identical binding param at integration.
 */

const ID = () =>
  GeneratedIdentity.parse({
    playerId: "player-local",
    displayName: "Brave Marigold",
    nameSeed: { adjId: "brave", nounId: "marigold" },
  })
const AV = () => AvatarSpec.parse({ base: "default", layers: [] })

function input(over: Partial<CreateTrackInput> = {}): CreateTrackInput {
  return { identity: ID(), avatar: AV(), activeSceneId: "antigua", ...over }
}

/** A fake inventory whose coins persist under the Track's namespace via the store. */
function fakeInventory(binding: TrackStoreBinding): InventoryStore & { _ns: string } {
  let coins = 0
  // Eager-load from the store synchronously is impossible (async); the fake just
  // records the namespace + supports add/spend so switch isolation is observable
  // through the manager's flush() of separate namespaces.
  const inv = {
    _ns: binding.namespace,
    getState: () => ({ coins, xp: 0, bag: [], equipped: {} }),
    coins: () => coins,
    xp: () => 0,
    qtyOf: () => 0,
    has: () => false,
    hasAll: () => false,
    bagWithDefs: () => [],
    equippedLayers: () => [],
    applyReward: () => [],
    addCoins: (d: number) => {
      coins += d
      void binding.store.write(`${binding.namespace}:economy`, { coins })
    },
    spendCoins: () => false,
    addXp: () => {},
    grant: () => {},
    consume: () => false,
    equip: () => false,
    unequip: () => {},
    subscribe: () => () => {},
    reset: () => {
      coins = 0
    },
  }
  return inv as unknown as InventoryStore & { _ns: string }
}

let lastXp = 0
function fakeQuest(_b: TrackStoreBinding, state: TrackState): QuestEngine & { _id: string } {
  return {
    _id: state.id,
    state: () => ({
      questId: "q",
      playerId: "player-local" as never,
      stepDone: {},
      xp: lastXp,
      complete: false,
    }),
    quest: () => ({}) as never,
    currentStep: () => null,
    stepState: () => "done",
    currentStepState: () => "done",
    isStepSatisfied: () => true,
    advance: () => false,
    getQuestMarkers: () => [],
    subscribe: () => () => {},
    reset: () => {},
  } as unknown as QuestEngine & { _id: string }
}

function factories(): TrackFactories {
  return {
    buildInventory: (binding) => fakeInventory(binding),
    buildQuestEngine: (binding, state) => fakeQuest(binding, state),
  }
}

function manager() {
  return createTrackManager({
    store: createTrackStore({ forceLocalStorage: true }),
    factories: factories(),
    playerId: "player-local",
    hostNative: "en",
    defaultSceneId: "antigua",
    defaultQuestId: "es-guadalajara-route",
  })
}

describe("TrackManager — create / switch / list", () => {
  beforeEach(() => {
    localStorage.clear()
    lastXp = 0
  })

  it("createTrack threads the per-Track namespace into the inventory binding", async () => {
    const mgr = manager()
    const es = await mgr.createTrack("en", "es", input())
    expect((es.inventory as unknown as { _ns: string })._ns).toBe("wp:track:en:es")
    expect(es.id).toBe(trackId("en", "es"))
    expect(mgr.active().id).toBe(es.id)
  })

  it("two Tracks keep separate state; switching is lossless", async () => {
    const mgr = manager()
    const es = await mgr.createTrack("en", "es", input())
    es.inventory.addCoins(100)
    expect(es.inventory.coins()).toBe(100)

    const fr = await mgr.createTrack("en", "fr", input())
    expect((fr.inventory as unknown as { _ns: string })._ns).toBe("wp:track:en:fr")
    fr.inventory.addCoins(7)
    expect(fr.inventory.coins()).toBe(7)
    expect(mgr.active().id).toBe(trackId("en", "fr"))

    // Switch back to es → its namespace's persisted body is intact in the store.
    const back = await mgr.switchTo(trackId("en", "es"))
    expect(back.id).toBe(trackId("en", "es"))
    const esStore = createTrackStore({ forceLocalStorage: true })
    expect(await esStore.read("wp:track:en:es:economy")).toEqual({ coins: 100 })
    expect(await esStore.read("wp:track:en:fr:economy")).toEqual({ coins: 7 })
  })

  it("flush + switch refresh the denormalized registry headlines (xp glance)", async () => {
    const mgr = manager()
    await mgr.createTrack("en", "es", input())
    await mgr.createTrack("en", "fr", input())

    lastXp = 250
    await mgr.switchTo(trackId("en", "es")) // flushes fr with the current xp glance

    const reg = loadRegistry()
    const ids = reg.tracks.map((t) => t.id).sort()
    expect(ids).toEqual([trackId("en", "es"), trackId("en", "fr")])
    const fr = reg.tracks.find((t) => t.id === trackId("en", "fr"))!
    expect(fr.headline.xp).toBe(250)
    expect(reg.activeTrackId).toBe(trackId("en", "es"))
  })

  it("list() reads denormalized headlines (no heavy load), sorted by lastPlayedAt desc", async () => {
    const mgr = manager()
    await mgr.createTrack("en", "es", input())
    await mgr.createTrack("en", "fr", input())
    const list = mgr.list()
    expect(list).toHaveLength(2)
    expect(list.every((h) => h.headline.displayName === "Brave Marigold")).toBe(true)
    expect(list.map((h) => h.id).sort()).toEqual([trackId("en", "es"), trackId("en", "fr")])
    // Sorted by lastPlayedAt descending (non-increasing).
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].lastPlayedAt).toBeGreaterThanOrEqual(list[i].lastPlayedAt)
    }
  })

  it("immersion Track (native===target) is forced 'on'", async () => {
    const mgr = manager()
    const t = await mgr.createTrack("es", "es", input({ immersion: "off" }))
    expect(t.state.immersion).toBe("on")
  })

  it("switchTo is a no-op when the target is already active", async () => {
    const mgr = manager()
    const es = await mgr.createTrack("en", "es", input())
    const again = await mgr.switchTo(trackId("en", "es"))
    expect(again).toBe(es)
  })

  it("archive compacts the heavy bodies and keeps the registry headline", async () => {
    const mgr = manager()
    const es = await mgr.createTrack("en", "es", input())
    es.inventory.addCoins(50)
    await mgr.archive(trackId("en", "es"))
    const store = createTrackStore({ forceLocalStorage: true })
    // Live economy gone; an :archived blob holds it.
    expect(await store.read("wp:track:en:es:economy")).toBeNull()
    const blob = (await store.read("wp:track:en:es:archived")) as Record<string, unknown>
    expect(blob["wp:track:en:es:economy"]).toEqual({ coins: 50 })
    // Registry headline survives for one-tap restore.
    expect(loadRegistry().tracks.find((t) => t.id === trackId("en", "es"))).toBeTruthy()
  })
})
