import assert from 'node:assert/strict'
import test from 'node:test'

import { completedSum, hasBlank } from './reveal.ts'

test('an expression gets its answer, because it has nowhere else to put it', () => {
  // The shape TREBUCHET is served today. A blank-only implementation would
  // return this unchanged and the child would see the question again.
  assert.equal(completedSum('7 × 8', '56'), '7 × 8 = 56')
  assert.equal(completedSum('47 + 25', '72'), '47 + 25 = 72')
})

test('a statement with a blank gets the answer IN the blank', () => {
  assert.equal(completedSum('47 + □ = 68', '21'), '47 + 21 = 68')
  assert.equal(completedSum('? = 42', '42'), '42 = 42')
  assert.equal(completedSum('9 _ = 81', '×'), '9 × = 81')
})

test('only the first blank is filled', () => {
  assert.equal(completedSum('□ + □ = 9', '4'), '4 + □ = 9')
})

test('an answer with a dollar in it is not mangled by String.replace', () => {
  // `$&` inside a string replacement means "the whole match". Through a
  // replacer function it means a dollar and an ampersand.
  assert.equal(completedSum('□ pounds', '$&'), '$& pounds')
})

test('nothing empty ever produces a dangling equals sign', () => {
  assert.equal(completedSum('7 × 8', ''), '7 × 8')
  assert.equal(completedSum('', '56'), '56')
  assert.equal(completedSum('  7 × 8  ', ' 56 '), '7 × 8 = 56')
})

test('hasBlank knows the three spellings and nothing else', () => {
  assert.equal(hasBlank('47 + □ = 68'), true)
  assert.equal(hasBlank('47 + ? = 68'), true)
  assert.equal(hasBlank('47 + _ = 68'), true)
  assert.equal(hasBlank('47 + 21'), false)
})
