import assert from 'node:assert/strict'
import test from 'node:test'
import { NativeRepository, type NativeInvoke } from './storage.ts'

test('repository pins every request to one account and atomically sends attempt plus snapshot', async () => {
  const calls: unknown[] = []
  const invoke: NativeInvoke = async <T>(command: string, args: Record<string, unknown>) => {
    calls.push({ command, args }); return { inserted: true, snapshot: { mastered: false } } as T
  }
  const repository = new NativeRepository('account-a', invoke)
  const attempt = { id: 'attempt-a', activityId: 'activity-a', sessionId: 'session-a', createdAt: '2026-09-27T00:00:00Z', data: { correct: true } }
  await repository.recordAttempt('learner-a', attempt, { mastered: false })
  assert.deepEqual(calls, [{ command: 'local_repository', args: { request: { accountId: 'account-a', operation: 'recordAttempt', profileId: 'learner-a', key: 'attempt-a', data: attempt, snapshot: { mastered: false } } } }])
})
test('native failures propagate without a silent in-memory success', async () => {
  const invoke: NativeInvoke = async () => { throw new Error('disk full') }
  await assert.rejects(new NativeRepository('a', invoke).saveSession('p', { id: 's', updatedAt: 'now', data: null }), /disk full/)
  assert.throws(() => new NativeRepository(''), /account ID/)
})

test('backup dialogs expose only account identity and leave restore explicit', async () => {
  const calls: Array<{ command: string; args: Record<string, unknown> }> = []
  const invoke: NativeInvoke = async <T>(command: string, args: Record<string, unknown>) => {
    calls.push({ command, args }); return null as T
  }
  const repository = new NativeRepository('owner', invoke)
  await repository.pickBackup()
  await repository.shareBackup()
  assert.deepEqual(calls, [
    { command: 'pick_backup', args: { accountId: 'owner' } },
    { command: 'share_backup', args: { accountId: 'owner' } },
  ])
})

test('native shell registers every command used by the repository bridge', async () => {
  const { readFileSync } = await import('node:fs')
  const called = new Set<string>()
  const invoke: NativeInvoke = async <T>(command: string) => { called.add(command); return null as T }
  const repository = new NativeRepository('owner', invoke)
  await repository.listProfiles()
  await repository.pickBackup()
  await repository.shareBackup()
  const rust = readFileSync(new URL('../src-tauri/src/lib.rs', import.meta.url), 'utf8')
  const registered = rust.match(/generate_handler!\[([\s\S]*?)\]/)?.[1]?.split(',').map(name => name.trim().split('::').at(-1)) ?? []
  for (const command of called) assert.ok(registered.includes(command), `Native handler is missing ${command}`)
})
