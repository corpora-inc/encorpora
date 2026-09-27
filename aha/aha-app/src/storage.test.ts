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
