import assert from "node:assert/strict"
import test from "node:test"

import { scrubForSpeech, scrubOutput, stripMarkdown } from "../src/textScrub.ts"

test("stripMarkdown removes emphasis, headings, links, and bullets", () => {
  assert.equal(stripMarkdown("**Hola**"), "Hola")
  assert.equal(stripMarkdown("*énfasis*"), "énfasis")
  assert.equal(stripMarkdown("__negrita__"), "negrita")
  assert.equal(stripMarkdown("~~tachado~~"), "tachado")
  assert.equal(stripMarkdown("`code`"), "code")
  assert.equal(stripMarkdown("### Título\nTexto"), "Título\nTexto")
  assert.equal(stripMarkdown("[Corpán](https://x.y)"), "Corpán")
  assert.equal(stripMarkdown("- uno\n- dos"), "uno\ndos")
  assert.equal(stripMarkdown("* uno\n+ dos"), "uno\ndos")
})

test("display scrub keeps legitimate prose punctuation including semicolons", () => {
  assert.equal(scrubOutput("Vamos; luego comemos."), "Vamos; luego comemos.")
  // A lone '#' that is part of a word (e.g. C#) survives display scrubbing.
  assert.equal(scrubOutput("Me gusta C# y Python."), "Me gusta C# y Python.")
})

test("display scrub strips the theme-list markdown that produced literal **", () => {
  assert.equal(
    scrubOutput("- **palabra** — word"),
    "palabra — word"
  )
})

test("speech scrub turns the semicolon into a pause, never the word", () => {
  const spoken = scrubForSpeech("Primero esto; después aquello.", "es-ES")
  assert.ok(!spoken.includes(";"), "semicolon must not survive for speech")
  assert.equal(spoken, "Primero esto, después aquello.")
})

test("speech scrub keeps the Greek question mark (ASCII ';')", () => {
  // In Greek ';' is the question mark — it must not be flattened to a comma.
  const spoken = scrubForSpeech("Τι κάνεις;", "el-GR")
  assert.ok(spoken.includes(";"), "Greek ';' is the question mark and must stay")
})

test("speech scrub removes symbols a synthesizer would name aloud", () => {
  const spoken = scrubForSpeech("Mira *esto* y `eso` ~aprox~ #1 | fin", "es")
  for (const sym of ["*", "`", "~", "#", "|", "_"]) {
    assert.ok(!spoken.includes(sym), `symbol ${sym} must not survive for speech`)
  }
})

test("speech scrub converts separator dashes to pauses", () => {
  assert.equal(scrubForSpeech("palabra — word", "es"), "palabra, word")
  assert.equal(scrubForSpeech("palabra - word", "es"), "palabra, word")
})

test("speech scrub leaves a clean sentence untouched", () => {
  assert.equal(scrubForSpeech("¿Cómo estás hoy?", "es"), "¿Cómo estás hoy?")
})
