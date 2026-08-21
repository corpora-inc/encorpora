import assert from "node:assert/strict"
import { test } from "node:test"

import { correctionFor, digitCellWidth, layout } from "./glyphs.ts"

/** A stand-in for the canvas: a proportional face where `1` is narrow. */
const face = {
  measureText(text: string): { width: number } {
    let w = 0
    for (const ch of text) {
      if (ch === "1") w += 5
      else if (ch >= "0" && ch <= "9") w += 11
      else if (ch === " ") w += 6
      else w += 13
    }
    return { width: w }
  },
}

test("the digit cell is the widest numeral in the face", () => {
  assert.equal(digitCellWidth(face), 11)
})

test("two statements with the same shape occupy the same grid", () => {
  const cell = digitCellWidth(face)
  const a = layout(face, "4003 − 87 = 3916", cell)
  const b = layout(face, "1111 − 11 = 1100", cell)
  assert.equal(a.width, b.width, "a 1 must not reflow the line")
  assert.deepEqual(
    a.cells.map((c) => c.x),
    b.cells.map((c) => c.x),
  )
})

test("a digit takes the cell and everything else takes its own width", () => {
  const l = layout(face, "1 + 1", digitCellWidth(face))
  assert.equal(l.cells[0]?.w, 11)
  assert.equal(l.cells[0]?.digit, true)
  assert.equal(l.cells[1]?.w, 6)
  assert.equal(l.cells[1]?.digit, false)
})

test("a same-width correction rolls only the columns that changed", () => {
  const l = layout(face, "47 + 25 = 62", digitCellWidth(face))
  const correction = correctionFor(l, "62", "72")
  assert.equal(correction.canRoll, true)
  assert.equal(correction.rolls.length, 1)
  assert.equal(correction.rolls[0]?.from, "6")
  assert.equal(correction.rolls[0]?.to, "7")
  assert.equal(correction.rolls[0]?.index, l.cells.length - 2)
})

test("two columns can roll at once", () => {
  const l = layout(face, "503 − 87 = 426", digitCellWidth(face))
  const correction = correctionFor(l, "426", "416")
  assert.deepEqual(
    correction.rolls.map((r) => [r.from, r.to]),
    [["2", "1"]],
  )
})

test("a correction that changes the digit count cannot roll", () => {
  const l = layout(face, "95 + 5 = 90", digitCellWidth(face))
  const correction = correctionFor(l, "90", "100")
  assert.equal(correction.canRoll, false)
  assert.equal(correction.rolls.length, 0)
  assert.equal(correction.start, l.cells.length - 2)
})
