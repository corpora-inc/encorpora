// Tests for the offline-safe CSS background helper (D12 — the reader-side
// twin of <OfflineImage>). Runs with the bare node:test runner, zero deps:
//   node --experimental-strip-types --test \
//     corpan/packs/shared/catalog/src/narratorImage.test.ts
// The element surface is duck-typed (ImageBackgroundTarget), so no DOM shim
// is needed — a stub object stands in for the div.

import { test } from "node:test"
import assert from "node:assert/strict"

import { applyImageBackground, cssUrl, type ImageBackgroundTarget } from "./narratorImage.ts"

function makeEl(): ImageBackgroundTarget {
  return { className: "", textContent: null, style: { backgroundImage: "" } }
}

const IMAGE_CLASS = "catalog-cover-thumb"
const PLACEHOLDER_CLASS = "catalog-cover-thumb catalog-cover-thumb--placeholder"

test("no url: placeholder class + initials, no background", async () => {
  const el = makeEl()
  await applyImageBackground(el, {
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    placeholderText: "AB",
  })
  assert.equal(el.className, PLACEHOLDER_CLASS)
  assert.equal(el.textContent, "AB")
  assert.equal(el.style.backgroundImage, "")
})

test("verified image: swaps placeholder for the background (initials cleared)", async () => {
  const el = makeEl()
  await applyImageBackground(el, {
    url: "https://cdn.test/cover.png",
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    placeholderText: "AB",
    loadImage: async () => true,
  })
  assert.equal(el.className, IMAGE_CLASS)
  assert.equal(el.textContent, "")
  assert.equal(el.style.backgroundImage, 'url("https://cdn.test/cover.png")')
})

test("placeholder renders IMMEDIATELY (before the async resolution settles)", async () => {
  const el = makeEl()
  let release: (ok: boolean) => void = () => {}
  const gate = new Promise<boolean>((r) => {
    release = r
  })
  const pending = applyImageBackground(el, {
    url: "https://cdn.test/cover.png",
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    placeholderText: "AB",
    loadImage: () => gate,
  })
  // Synchronous state, mid-flight: the placeholder is already visible.
  assert.equal(el.className, PLACEHOLDER_CLASS)
  assert.equal(el.textContent, "AB")
  release(true)
  await pending
  assert.equal(el.className, IMAGE_CLASS)
})

test("offline miss through the resolver (undefined): placeholder stays", async () => {
  const el = makeEl()
  await applyImageBackground(el, {
    url: "https://cdn.test/cover.png",
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    placeholderText: "AB",
    resolveImageUrl: async () => undefined, // hostApi.offlineCache: offline, uncached
    loadImage: async () => true,
  })
  assert.equal(el.className, PLACEHOLDER_CLASS)
  assert.equal(el.textContent, "AB")
  assert.equal(el.style.backgroundImage, "", "no unverifiable background set")
})

test("resolver returns the LOCAL cached URL: background uses it, not the remote", async () => {
  const el = makeEl()
  const local = "corpan-pack://localhost/.offline-cache/img/abc123.png"
  const probed: string[] = []
  await applyImageBackground(el, {
    url: "https://cdn.test/cover.png",
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    resolveImageUrl: async () => local,
    loadImage: async (u) => {
      probed.push(u)
      return true
    },
  })
  assert.deepEqual(probed, [local], "the cached copy is what gets verified")
  assert.equal(el.style.backgroundImage, `url(${cssUrl(local)})`)
})

test("unreachable pixels (preload fails): placeholder stays — never a blank box", async () => {
  const el = makeEl()
  await applyImageBackground(el, {
    url: "https://cdn.test/cover.png",
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    placeholderText: "AB",
    loadImage: async () => false,
  })
  assert.equal(el.className, PLACEHOLDER_CLASS)
  assert.equal(el.textContent, "AB")
  assert.equal(el.style.backgroundImage, "")
})

test("a throwing resolver degrades to the placeholder (never throws out)", async () => {
  const el = makeEl()
  await applyImageBackground(el, {
    url: "https://cdn.test/cover.png",
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    resolveImageUrl: async () => {
      throw new Error("host seam exploded")
    },
  })
  assert.equal(el.className, PLACEHOLDER_CLASS)
})

test("late resolve after the element left the document: no-op (stale write guard)", async () => {
  const el = makeEl()
  el.isConnected = false // render() re-ran; this node is detached
  await applyImageBackground(el, {
    url: "https://cdn.test/cover.png",
    imageClass: IMAGE_CLASS,
    placeholderClass: PLACEHOLDER_CLASS,
    loadImage: async () => true,
  })
  assert.equal(el.className, PLACEHOLDER_CLASS, "detached element keeps placeholder state")
  assert.equal(el.style.backgroundImage, "")
})

test("cssUrl escapes quotes (defensive against hostile CDN paths)", () => {
  assert.equal(cssUrl('https://x/a"b.png'), '"https://x/a\\"b.png"')
})
