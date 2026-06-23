import assert from "node:assert/strict"
import test from "node:test"

import { OrderedSpeechQueue, StreamingSentenceBuffer } from "../src/streamingTts.ts"

test("waits for confirmed English sentence boundaries and flushes the remainder", () => {
  const stream = new StreamingSentenceBuffer("en-US")
  assert.deepEqual(stream.push("Hello wor"), [])
  assert.deepEqual(stream.push("ld. How are"), ["Hello world."])
  assert.deepEqual(stream.push(" you? Fine"), ["How are you?"])
  assert.deepEqual(stream.finish(), ["Fine"])
})

test("suppresses common abbreviations, initials, and numbered-list markers", () => {
  const stream = new StreamingSentenceBuffer("en")
  assert.deepEqual(stream.push("Dr. Smith met A. Jones. 1. First item. Next"), [
    "Dr. Smith met A. Jones.",
    "1. First item.",
  ])
  assert.deepEqual(stream.finish(), ["Next"])
})

test("suppresses mixed-locale titles and unknown abbreviations before lowercase text", () => {
  const stream = new StreamingSentenceBuffer("zh-Hant")
  assert.deepEqual(stream.push("Dr. Smith說：abbr. example. 下一句。再來"), [
    "Dr. Smith說：abbr. example.",
    "下一句。",
  ])
  assert.deepEqual(stream.finish(), ["再來"])
})

test("streams CJK sentences without requiring spaces", () => {
  const stream = new StreamingSentenceBuffer("zh-Hant")
  assert.deepEqual(stream.push("你好。下一"), ["你好。"])
  assert.deepEqual(stream.push("句！最後"), ["下一句！"])
  assert.deepEqual(stream.finish(), ["最後"])
})

test("applies the locale-tailored Greek question mark", () => {
  const stream = new StreamingSentenceBuffer("el")
  assert.deepEqual(stream.push("Τι κάνεις; Καλά."), ["Τι κάνεις;"])
  assert.deepEqual(stream.finish(), ["Καλά."])
})

test("recognizes Unicode sentence terminals used by Arabic and Indic scripts", () => {
  const stream = new StreamingSentenceBuffer("hi")
  assert.deepEqual(stream.push("पहला वाक्य। दूसरा"), ["पहला वाक्य।"])
  assert.deepEqual(stream.push(" वाक्य؟ तीसरा"), ["दूसरा वाक्य؟"])
  assert.deepEqual(stream.finish(), ["तीसरा"])
})

test("keeps speech calls ordered and invalidates queued work on cancel", async () => {
  const spoken = []
  const stops = []
  let releaseFirst
  const firstQueued = new Promise((resolve) => {
    releaseFirst = resolve
  })
  const queue = new OrderedSpeechQueue(
    async (_locale, text) => {
      spoken.push(text)
      if (text === "first") await firstQueued
    },
    async () => {
      stops.push("stop")
    }
  )

  queue.enqueue("en", "first")
  queue.enqueue("en", "stale")
  await Promise.resolve()
  queue.cancel()
  queue.enqueue("en", "new")
  releaseFirst()
  await queue.idle()

  assert.deepEqual(spoken, ["first", "new"])
  assert.ok(stops.length >= 2)
})
