import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReport, collectEnvironment, REPORT_LOG_LINES } from './report.ts'
import type { LogEntry } from './log.ts'

const entries: LogEntry[] = Array.from({ length: 80 }, (_, i) => ({
  t: new Date(Date.UTC(2026, 9, 4, 0, 0, i)).toISOString(), level: i % 2 ? 'error' : 'info', source: 'action', message: `event ${i}`,
}))
const environment = { version: '0.1.0', build: '42', platform: 'iPad', userAgent: 'Mozilla/5.0 (iPad) AppleWebKit', signedIn: true, aiReady: false }

test('report carries version, build, platform, connection state and the last log lines', () => {
  const report = buildReport(environment, entries, 'The hint button froze.', new Date('2026-10-04T12:00:00Z'))
  assert.match(report, /^¡AHA! problem report\n/)
  assert.match(report, /App version: 0\.1\.0 \(build 42\)/)
  assert.match(report, /Platform: iPad/)
  assert.match(report, /User agent: Mozilla\/5\.0 \(iPad\) AppleWebKit/)
  assert.match(report, /Signed in: yes\nAI ready: no/)
  assert.match(report, /Created: 2026-10-04T12:00:00\.000Z/)
  assert.match(report, /Note:\nThe hint button froze\./)
  assert.match(report, new RegExp(`Recent log \\(last ${REPORT_LOG_LINES} of 80\\)`))
  assert.ok(report.includes('2026-10-04T00:01:19.000Z ERROR [action] event 79'))
  assert.ok(report.includes('event 30') && !report.includes('event 29'), 'only the last 50 lines')
})

test('report never carries identities, even from the note', () => {
  const report = buildReport({ ...environment, userAgent: 'UA token=abc123secret' },
    [{ t: 'now', level: 'error', source: 'x', message: 'for kid@example.com' }], 'reach me at mom@example.com ' + 'y'.repeat(5000))
  assert.ok(!report.includes('mom@example.com') && !report.includes('kid@example.com') && !report.includes('abc123secret'))
  assert.ok(report.length < 5000, 'note is bounded')
})

test('report is honest when nothing is known', () => {
  const report = buildReport({ signedIn: false, aiReady: false }, [], '  ')
  assert.match(report, /App version: unknown \(build not set\)/)
  assert.match(report, /Platform: unknown/)
  assert.match(report, /Note:\n\(none\)/)
  assert.match(report, /Recent log \(last 0 of 0\)\n\(empty\)/)
})

test('environment collection survives a failing version lookup', async () => {
  const env = await collectEnvironment({ signedIn: false, aiReady: true },
    { getVersion: async () => { throw new Error('no ipc') }, build: '', navigator: { userAgent: 'UA', platform: 'Linux' } })
  assert.deepEqual(env, { version: undefined, build: undefined, platform: 'Linux', userAgent: 'UA', signedIn: false, aiReady: true })
  const ok = await collectEnvironment({ signedIn: true, aiReady: true },
    { getVersion: async () => '0.1.0', build: '7', navigator: { userAgent: 'UA', userAgentData: { platform: 'Android' } } })
  assert.equal(ok.version, '0.1.0'); assert.equal(ok.build, '7'); assert.equal(ok.platform, 'Android')
})

test('report includes the per-model stats lines when given, unscrubbed but bounded', () => {
  const stats = ['claude-sonnet-4-5-20250929: 3 sets · kept 11, rejected 1 schema + 0 semantic · 0 flagged · ≈ 4 2Z per set · 80% correct first try (10)']
  const report = buildReport(environment, [], '', new Date('2026-10-04T12:00:00Z'), stats)
  assert.ok(report.includes(`Model stats (this device)\n${stats[0]}\n`), 'long catalogue ids survive (the log scrubber would redact them)')
  assert.ok(!buildReport(environment, [], '').includes('Model stats'), 'absent when not supplied')
  assert.ok(buildReport(environment, [], '', new Date(), []).includes('Model stats (this device)\n(none)'))
  const bounded = buildReport(environment, [], '', new Date(), Array(50).fill('x\u0007'.repeat(400)))
  assert.ok(!bounded.includes('\u0007'))
  assert.equal(bounded.split('\n').filter(l => l.startsWith('x')).length, 20)
})
