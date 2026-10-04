import assert from 'node:assert/strict'
import test from 'node:test'
import { DiagnosticsLog, installGlobalHandlers, scrub, type StorageLike } from './log.ts'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v) } }
}
const clock = () => { let t = Date.parse('2026-10-04T00:00:00Z'); return () => new Date(t++) }

test('keeps only the newest entries up to capacity', () => {
  const log = new DiagnosticsLog({ capacity: 3, storage: null, now: clock() })
  for (let i = 0; i < 5; i++) log.add('info', 'test', `event ${i}`)
  assert.deepEqual(log.entries().map(e => e.message), ['event 2', 'event 3', 'event 4'])
  assert.deepEqual(log.entries(2).map(e => e.message), ['event 3', 'event 4'])
})

test('scrubs emails, tokens, keys, ids and URL queries', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl'
  const text = scrub(`user ana@example.com sent ${jwt} with Bearer abc.def key=sk-ant-1234 ` +
    `account 0b8f3c2e-1d4a-4b6f-9c7e-2a1b3c4d5e6f receipt: R-99 hash 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b ` +
    `at https://free2z.com/cb?code=secret123&state=x`)
  for (const leaked of ['ana@example.com', jwt, 'abc.def', 'sk-ant-1234', '0b8f3c2e', 'R-99', '9f86d081', 'secret123'])
    assert.ok(!text.includes(leaked), `${leaked} leaked: ${text}`)
  assert.match(text, /\[email\]/)
  assert.match(text, /https:\/\/free2z\.com\/cb\?\[redacted\]/)
  assert.equal(scrub('Free2Z is temporarily unavailable. Try again in 30 seconds.'),
    'Free2Z is temporarily unavailable. Try again in 30 seconds.')
})

test('logError records a scrubbed, bounded message, source tag and error code', () => {
  const log = new DiagnosticsLog({ storage: null, now: clock(), echo: false })
  const error = Object.assign(new Error(`rate limited for bob@example.org ${'x'.repeat(2000)}`), { code: 'rate_limited' })
  log.error('Free2Z Call!', error)
  log.error('native', 'disk full')
  log.error('odd', { weird: true })
  const [first, second, third] = log.entries()
  assert.equal(first.level, 'error')
  assert.equal(first.source, 'free2z-call')
  assert.match(first.message, /^Error \[rate_limited\]: rate limited for \[email\]/)
  assert.ok(first.message.length <= 400)
  assert.equal(second.message, 'disk full')
  assert.equal(third.message, 'Unknown error')
})

test('persists across restart and validates what it reloads', () => {
  const storage = memoryStorage()
  const log = new DiagnosticsLog({ capacity: 2, storage, now: clock(), echo: false })
  log.add('warn', 'a', 'first'); log.add('error', 'b', 'second'); log.add('info', 'c', 'third')
  const reloaded = new DiagnosticsLog({ capacity: 2, storage, now: clock() })
  assert.deepEqual(reloaded.entries().map(e => e.message), ['second', 'third'])
  assert.equal(reloaded.persistent, true)
  storage.data.set('aha-diagnostics-log', JSON.stringify([{ t: 'x', level: 'nope', source: 1, message: 'bad' },
    { t: '2026-10-04T00:00:00.000Z', level: 'info', source: 'ok', message: 'mail me at a@b.co' }, 'junk']))
  assert.deepEqual(new DiagnosticsLog({ storage }).entries().map(e => e.message), ['mail me at [email]'])
  storage.data.set('aha-diagnostics-log', '{not json')
  assert.deepEqual(new DiagnosticsLog({ storage }).entries(), [])
})

test('falls back to memory when storage is unavailable', () => {
  const broken: StorageLike = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
  const log = new DiagnosticsLog({ storage: broken, now: clock() })
  log.add('info', 'app', 'still recorded')
  assert.equal(log.persistent, false)
  assert.deepEqual(log.entries().map(e => e.message), ['still recorded'])
  const throwsOnAccess = new DiagnosticsLog({ storage: () => { throw new Error('SecurityError') } })
  throwsOnAccess.add('info', 'app', 'ok')
  assert.equal(throwsOnAccess.entries().length, 1)
})

test('global handlers record uncaught errors and unhandled rejections', () => {
  const log = new DiagnosticsLog({ storage: null, now: clock(), echo: false })
  const target = new EventTarget()
  installGlobalHandlers(log, target)
  target.dispatchEvent(Object.assign(new Event('error'), { error: new TypeError('x is undefined'), message: 'ignored' }))
  target.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('lost promise') }))
  assert.deepEqual(log.entries().map(e => [e.source, e.message]), [
    ['window', 'TypeError: x is undefined'], ['promise', 'Error: lost promise']])
})
