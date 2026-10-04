import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { copyReport, MAX_REPORT_BYTES, shareReport, type ShareInvoke } from './share.ts'

test('sharing sends only the report text to a registered native command', async () => {
  const calls: unknown[] = []
  const invoke: ShareInvoke = async <T>(command: string, args: Record<string, unknown>) => { calls.push({ command, args }); return true as T }
  assert.equal(await shareReport('report body', invoke), true)
  assert.deepEqual(calls, [{ command: 'share_report', args: { report: 'report body' } }])
  const rust = readFileSync(new URL('../../src-tauri/src/lib.rs', import.meta.url), 'utf8')
  const registered = rust.match(/generate_handler!\[([\s\S]*?)\]/)?.[1]?.split(',').map(name => name.trim().split('::').at(-1)) ?? []
  assert.ok(registered.includes('share_report'), 'native handler is missing share_report')
  const native = readFileSync(new URL('../../src-tauri/src/documents.rs', import.meta.url), 'utf8')
  assert.match(native, new RegExp(`MAX_REPORT: usize = ${MAX_REPORT_BYTES / 1024} \\* 1024`), 'native and WebView size limits agree')
})

test('oversized reports are refused before reaching native code', async () => {
  let called = false
  const invoke: ShareInvoke = async <T>() => { called = true; return true as T }
  await assert.rejects(shareReport('x'.repeat(MAX_REPORT_BYTES + 1), invoke), /too large/)
  assert.equal(called, false)
})

test('copy uses the clipboard and fails loudly when there is none', async () => {
  let copied = ''
  await copyReport('text', { writeText: async t => { copied = t } })
  assert.equal(copied, 'text')
  await assert.rejects(copyReport('text', undefined), /isn’t available/)
})
