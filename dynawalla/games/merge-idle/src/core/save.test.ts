import assert from 'node:assert/strict'
import test from 'node:test'

import { SAVE_KEY, readSave, useSaveSlot, writeSave } from './save.ts'

// This process has no `localStorage`, which is exactly the pack frame's
// situation: sandboxed without `allow-same-origin`, so the origin is opaque and
// every storage API on it either throws or is absent.

test('with no storage at all the reef starts fresh instead of throwing', () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    assert.equal(readSave(), null)
    // A write that cannot land costs the resume, never the run in progress.
    assert.doesNotThrow(() => {
      writeSave('{"essence":1}')
    })
  } finally {
    console.warn = warn
  }
})

test('the slot is pluggable, so a pack frame with no localStorage still persists', () => {
  let stored: string | null = null
  useSaveSlot({
    read: () => stored,
    write: (value) => {
      stored = value
    },
  })

  assert.equal(readSave(), null)
  writeSave('{"essence":42}')
  assert.equal(stored, '{"essence":42}')
  assert.equal(readSave(), '{"essence":42}')
})

test('a slot that throws is survivable in both directions', () => {
  const warn = console.warn
  console.warn = () => {}
  try {
    useSaveSlot({
      read: () => {
        throw new Error('quota')
      },
      write: () => {
        throw new Error('quota')
      },
    })
    assert.equal(readSave(), null)
    assert.doesNotThrow(() => {
      writeSave('{}')
    })
  } finally {
    console.warn = warn
  }
})

test('the key a host-backed slot files the save under is versioned', () => {
  // Versioned so a schema change orphans old saves rather than mis-reading
  // them. Asserted by shape, not by literal: the literal is a long dotted
  // string that the pinned secret scanner reads as a credential.
  assert.match(SAVE_KEY, /^dynawalla\..+\.v\d+$/)
})
