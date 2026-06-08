import { afterEach, describe, expect, it } from "vitest"
import { IDBFactory } from "fake-indexeddb"
import {
  createMemoryTranscriptStore,
  openTranscripts,
  type StoredMessage,
  type TranscriptStore,
} from "./transcripts.js"

const msg = (id: string, ts: number, side: StoredMessage["side"] = "self"): StoredMessage => ({
  id,
  side,
  text: `m-${id}`,
  ts,
})

// Run the same suite against both backends so the IDB path and the fallback
// stay behaviorally identical.
function suite(name: string, make: () => Promise<TranscriptStore> | TranscriptStore) {
  describe(name, () => {
    let store: TranscriptStore
    afterEach(() => store?.close())

    it("appends and returns a thread in timestamp order", async () => {
      store = await make()
      await store.append("p1", msg("b", 200))
      await store.append("p1", msg("a", 100))
      const thread = await store.thread("p1")
      expect(thread.map((m) => m.id)).toEqual(["a", "b"])
    })

    it("dedupes by message id (idempotent re-sync)", async () => {
      store = await make()
      expect(await store.append("p1", msg("x", 100))).toBe(true)
      expect(await store.append("p1", msg("x", 100))).toBe(false)
      expect(await store.thread("p1")).toHaveLength(1)
    })

    it("keeps threads isolated per penpal", async () => {
      store = await make()
      await store.append("p1", msg("a", 1))
      await store.append("p2", msg("a", 1))
      expect(await store.thread("p1")).toHaveLength(1)
      expect(await store.thread("p2")).toHaveLength(1)
    })

    it("stores and lists link metadata, newest-active first", async () => {
      store = await make()
      await store.setMeta({ partnerId: "p1", partnerName: "Ada", lastActivityAt: 100 })
      await store.setMeta({ partnerId: "p2", partnerName: "Ben", lastActivityAt: 200 })
      const links = await store.links()
      expect(links.map((l) => l.partnerId)).toEqual(["p2", "p1"])
      expect((await store.meta("p1"))?.partnerName).toBe("Ada")
    })

    it("preserves a lapsed transcript as a keepsake", async () => {
      store = await make()
      await store.append("p1", msg("a", 1, "peer"))
      await store.setMeta({ partnerId: "p1", partnerName: "Ada", lastActivityAt: 1, lapsedAt: 5 })
      expect((await store.meta("p1"))?.lapsedAt).toBe(5)
      expect(await store.thread("p1")).toHaveLength(1) // messages survive lapse
    })

    it("removes a penpal entirely (block)", async () => {
      store = await make()
      await store.append("p1", msg("a", 1))
      await store.setMeta({ partnerId: "p1", partnerName: "Ada", lastActivityAt: 1 })
      await store.remove("p1")
      expect(await store.thread("p1")).toHaveLength(0)
      expect(await store.meta("p1")).toBeNull()
    })
  })
}

suite("memory transcript store", () => createMemoryTranscriptStore())
// Each IDB suite run gets a fresh database so cases don't bleed into each other.
suite("indexeddb transcript store", () => openTranscripts(new IDBFactory()))
