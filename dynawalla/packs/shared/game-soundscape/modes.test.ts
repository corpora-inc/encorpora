import assert from "node:assert/strict"
import { test } from "node:test"

import { MODES, MODE_IDS, modeById } from "./modes.ts"
import { CENTS_PER_OCTAVE } from "./pitch.ts"

test("every mode starts on its tonic and stays inside one octave", () => {
  for (const mode of MODES) {
    assert.equal(mode.degrees[0], 0, `${mode.id} does not start at 0 cents`)
    for (const cents of mode.degrees) {
      assert.ok(
        cents >= 0 && cents < CENTS_PER_OCTAVE,
        `${mode.id} has a degree at ${cents}, outside [0, 1200)`,
      )
    }
  }
})

test("every mode is strictly ascending", () => {
  for (const mode of MODES) {
    for (let i = 1; i < mode.degrees.length; i++) {
      const prev = mode.degrees[i - 1] ?? 0
      const here = mode.degrees[i] ?? 0
      assert.ok(here > prev, `${mode.id} degree ${i} (${here}) does not rise above ${prev}`)
    }
  }
})

test("every mode can be rested on and coloured, and the indices exist", () => {
  for (const mode of MODES) {
    assert.ok(mode.rest.length >= 2, `${mode.id} has fewer than two resting degrees`)
    assert.equal(mode.rest[0], 0, `${mode.id} cannot rest on its own tonic`)
    for (const index of mode.rest) {
      assert.ok(
        index >= 0 && index < mode.degrees.length,
        `${mode.id} rests on degree ${index}, which it does not have`,
      )
    }
    assert.ok(
      mode.colour >= 0 && mode.colour < mode.degrees.length,
      `${mode.id} is coloured by degree ${mode.colour}, which it does not have`,
    )
  }
})

test("ids are unique and looked up", () => {
  assert.equal(new Set(MODE_IDS).size, MODE_IDS.length)
  for (const id of MODE_IDS) assert.equal(modeById(id)?.id, id)
  assert.equal(modeById("western.nope"), null)
})

test("the corpus is broad enough not to repeat itself in a month", () => {
  // 38 modes x 8 roots is 304 distinct soundscapes, which is what "we need a
  // lot of variety" costs. If this ever shrinks it is because somebody deleted
  // data, and that should be a decision rather than an accident.
  assert.ok(MODES.length >= 38, `only ${MODES.length} modes`)
  const families = new Set(MODES.map((m) => m.family))
  assert.deepEqual([...families].sort(), ["maqam", "thaat", "western"])
})

test("the maqamat keep their neutral degrees", () => {
  // The whole reason the corpus is in cents. Rast's third is a three-quarter
  // tone; rounded to a semitone it is Ionian and the maqam is gone.
  const rast = modeById("maqam.rast")
  assert.ok(rast)
  assert.equal(rast.degrees[2], 350)
  const bayati = modeById("maqam.bayati")
  assert.ok(bayati)
  assert.equal(bayati.degrees[1], 150)
  // And at least one degree in the family is genuinely off the semitone grid.
  const offGrid = MODES.filter((m) => m.family === "maqam").flatMap((m) =>
    m.degrees.filter((c) => c % 100 !== 0),
  )
  assert.ok(offGrid.length > 0, "no maqam degree is off the 12-TET grid")
})

test("the western modes are on the semitone grid", () => {
  for (const mode of MODES.filter((m) => m.family === "western")) {
    for (const cents of mode.degrees) {
      assert.equal(cents % 100, 0, `${mode.id} has a non-semitone degree ${cents}`)
    }
  }
})
