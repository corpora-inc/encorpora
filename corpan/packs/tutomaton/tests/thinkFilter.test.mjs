import assert from "node:assert/strict"
import test from "node:test"

import { makeThinkFilter, stripThink } from "../src/thinkFilter.ts"

/** Feed a string token-by-token (1 char each) through a fresh filter. */
function streamChars(s) {
  const f = makeThinkFilter()
  let out = ""
  for (const ch of s) out += f.push(ch)
  return out + f.flush()
}

/** Feed arbitrary token chunks. */
function streamChunks(chunks) {
  const f = makeThinkFilter()
  let out = ""
  for (const c of chunks) out += f.push(c)
  return out + f.flush()
}

test("empty think block (the /no_think case) is dropped, answer kept", () => {
  assert.equal(streamChars("<think>\n\n</think>Hola, ¿qué tal?"), "Hola, ¿qué tal?")
})

test("non-empty reasoning is dropped no matter how it's chunked", () => {
  const reply = "<think>The user greeted me. I should reply warmly.</think>¡Hola!"
  assert.equal(streamChars(reply), "¡Hola!")
  assert.equal(streamChunks(["<think>plan ", "more plan", "</think>", "¡Hola!"]), "¡Hola!")
})

test("open/close tags split across token boundaries", () => {
  assert.equal(streamChunks(["<th", "ink>", "x</thi", "nk>", "Answer"]), "Answer")
  assert.equal(streamChunks(["<", "think", ">", "</", "think", ">", "Réponse"]), "Réponse")
})

test("non-thinking reply (Instruct 4B) passes through unchanged", () => {
  assert.equal(streamChars("Hello there!"), "Hello there!")
  assert.equal(streamChunks(["Hel", "lo ", "there!"]), "Hello there!")
})

test("reply that merely starts with '<' but isn't <think>", () => {
  assert.equal(streamChars("<b> not think"), "<b> not think")
})

test("leading whitespace before <think> is handled; answer leading ws trimmed", () => {
  assert.equal(streamChars("\n  <think>x</think>\n\nDone"), "Done")
})

test("CJK / non-Latin answers survive", () => {
  assert.equal(streamChars("<think></think>你好！很高兴见到你。"), "你好！很高兴见到你。")
})

test("unclosed think block at end-of-stream is dropped entirely", () => {
  assert.equal(streamChars("<think>still thinking when it stopped"), "")
})

test("stripThink one-shot matches the streaming result", () => {
  assert.equal(stripThink("<think>r</think>Bonjour"), "Bonjour")
  assert.equal(stripThink("No think here"), "No think here")
})

test("a literal answer containing 'think' as a word is not affected", () => {
  assert.equal(streamChars("I think you mean café."), "I think you mean café.")
})
