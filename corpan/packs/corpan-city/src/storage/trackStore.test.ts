// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest"
import { trackNamespace } from "@corpan-city/contracts"
import { createTrackStore, bindingFor } from "./trackStore"

/**
 * TrackStore namespacing isolation: two Tracks keying under their own
 * `wp:track:{id}` namespace must NEVER read each other's records.
 *
 * happy-dom has no IndexedDB, so these run against the localStorage fallback —
 * the same surface contract. The IndexedDB path is verified in the real WebKit
 * app (reported separately).
 */

describe("TrackStore — per-Track namespacing isolation", () => {
  beforeEach(() => localStorage.clear())

  it("two Tracks under their own namespace do not collide", async () => {
    const store = createTrackStore({ forceLocalStorage: true })
    const es = bindingFor("en:es", store)
    const fr = bindingFor("en:fr", store)

    expect(es.namespace).toBe("wp:track:en:es")
    expect(fr.namespace).toBe("wp:track:en:fr")
    expect(es.namespace).not.toBe(fr.namespace)

    await store.write(`${es.namespace}:economy`, { coins: 100 })
    await store.write(`${fr.namespace}:economy`, { coins: 7 })

    expect(await store.read(`${es.namespace}:economy`)).toEqual({ coins: 100 })
    expect(await store.read(`${fr.namespace}:economy`)).toEqual({ coins: 7 })

    // Mutating one Track must not touch the other.
    await store.write(`${es.namespace}:economy`, { coins: 250 })
    expect(await store.read(`${es.namespace}:economy`)).toEqual({ coins: 250 })
    expect(await store.read(`${fr.namespace}:economy`)).toEqual({ coins: 7 })
  })

  it("keys(prefix) lists only the matching Track's records", async () => {
    const store = createTrackStore({ forceLocalStorage: true })
    await store.write("wp:track:en:es:economy", { a: 1 })
    await store.write("wp:track:en:es:quest", { b: 2 })
    await store.write("wp:track:en:fr:economy", { c: 3 })

    const esKeys = (await store.keys("wp:track:en:es:")).sort()
    expect(esKeys).toEqual(["wp:track:en:es:economy", "wp:track:en:es:quest"])

    const frKeys = await store.keys("wp:track:en:fr:")
    expect(frKeys).toEqual(["wp:track:en:fr:economy"])
  })

  it("read returns null on absent + corrupt records (noisy, never throws)", async () => {
    const store = createTrackStore({ forceLocalStorage: true })
    expect(await store.read("wp:track:en:es:missing")).toBeNull()
    // Plant a corrupt record directly.
    localStorage.setItem("wp:track:en:es:bad", "{not json")
    expect(await store.read("wp:track:en:es:bad")).toBeNull()
  })

  it("remove deletes a single key without touching siblings", async () => {
    const store = createTrackStore({ forceLocalStorage: true })
    await store.write("wp:track:en:es:economy", { a: 1 })
    await store.write("wp:track:en:es:quest", { b: 2 })
    await store.remove("wp:track:en:es:economy")
    expect(await store.read("wp:track:en:es:economy")).toBeNull()
    expect(await store.read("wp:track:en:es:quest")).toEqual({ b: 2 })
  })

  it("bindingFor namespace matches trackNamespace()", () => {
    expect(bindingFor("es:es").namespace).toBe(trackNamespace("es:es"))
  })
})
