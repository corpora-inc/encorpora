/**
 * The count the wind is bought with.
 *
 * Small, and load-bearing: it is the only thing standing between a child who has
 * never landed a boulder and a second arithmetic step arriving unannounced. So the
 * read side, the write side and the "storage is not there" side are all driven,
 * rather than the module being trusted because it is twenty lines long.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { felledEver, noteFelled, resetFelledForTest } from './felled.ts'

const SLOT = 'dw.trebuchet.felled' // gitleaks:allow

type Cells = Map<string, string>

/** A real `Storage` shape over a Map, installed where the module looks for it. */
function installStorage(cells: Cells = new Map()): Cells {
  ;(globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => cells.get(k) ?? null,
    setItem: (k: string, v: string) => {
      cells.set(k, String(v))
    },
    removeItem: (k: string) => {
      cells.delete(k)
    },
    clear: () => cells.clear(),
    key: () => null,
    get length() {
      return cells.size
    },
  }
  resetFelledForTest()
  return cells
}

function removeStorage(): void {
  delete (globalThis as unknown as Record<string, unknown>).localStorage
  resetFelledForTest()
}

test('a keep felled in one sitting is still felled in the next', () => {
  // The whole reason this is persisted rather than counted in module memory: a
  // child who has already learnt the one-step game does not get walked through it
  // again on Tuesday, and — the other way round, which matters more — a child who
  // put the tablet down after four keeps does not come back to a wind.
  const cells = installStorage()
  assert.equal(felledEver(), 0, 'a device with nothing on it remembered something')
  for (let i = 1; i <= 7; i++) assert.equal(noteFelled(), i)
  assert.equal(cells.get(SLOT), '7', 'the count never reached storage')

  // A new sitting: same device, same storage, fresh module state.
  resetFelledForTest()
  assert.equal(felledEver(), 7, 'the count did not survive the sitting')
  assert.equal(noteFelled(), 8, 'the next keep did not carry on from seven')
})

test('a storage that is not there costs a child nothing but practice', () => {
  // `localStorage` throws inside a pack frame on an opaque origin. The failure mode
  // has to be the safe one — she meets the still-air game again, which is extra
  // practice at something she is good at — and never a crash and never a wind.
  removeStorage()
  assert.equal(felledEver(), 0)
  assert.equal(noteFelled(), 1, 'the count is still kept in memory for this sitting')
  assert.equal(noteFelled(), 2)
  resetFelledForTest()
  assert.equal(felledEver(), 0, 'without storage the next sitting starts again')

  // And the real failure: on an opaque origin, READING `globalThis.localStorage`
  // is itself what throws — before there is any object to call `getItem` on. A
  // guard placed only around the `getItem` call would not catch that, and the pack
  // would die on its first felled keep.
  const quiet = console.warn
  const warned: string[] = []
  console.warn = (...args: unknown[]) => warned.push(args.map(String).join(' '))
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get(): never {
        throw new Error('SecurityError: the document is sandboxed')
      },
    })
    resetFelledForTest()
    assert.equal(felledEver(), 0, 'an opaque origin handed back a count')
    assert.equal(noteFelled(), 1, 'the sitting could not count its own keeps')
    assert.equal(noteFelled(), 2)
  } finally {
    console.warn = quiet
    delete (globalThis as unknown as Record<string, unknown>).localStorage
  }
  // Noisy, never silent: a pack that cannot remember anything has to say so.
  assert.ok(warned.length > 0, 'an unreachable storage was swallowed in silence')
  assert.match(warned[0], /localStorage is not reachable/)
  removeStorage()
})

test('junk in the slot is not a number of keeps', () => {
  // Anything can be in a storage slot: another pack, a half-written value, a hand
  // in the dev tools. The failure that matters is UPWARD — a value that hands a
  // child a second arithmetic step she has never bought — so every case is pinned
  // to the count it must produce rather than to a predicate that most of them
  // would satisfy at any value.
  const cases: Array<[string, number]> = [
    ['', 0],
    ['lots', 0],
    ['-4', 0], // a negative count is not fewer keeps, it is not a count
    ['NaN', 0],
    ['Infinity', 0], // the one that would otherwise reach the top of the ramp
    ['1e400', 0], // ...and so would this, which parses to Infinity
    ['3.7', 3], // a keep is felled or it is not; the fraction floors away
    ['12', 12], // and a real count survives untouched
  ]
  for (const [junk, want] of cases) {
    installStorage(new Map([[SLOT, junk]]))
    assert.equal(felledEver(), want, `"${junk}" became ${String(felledEver())} keeps`)
  }
  removeStorage()
})
