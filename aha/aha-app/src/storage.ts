/** Native SQLite is the sole authority. Browser demos must inject an explicit
 * repository fixture; this adapter never falls back to browser storage. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export interface Profile { id: string; name: string; grade: number; createdAt: string }
export interface StoredSession { id: string; updatedAt: string; data: Json }
export interface ActivityRecord { id: string; sessionId: string; createdAt: string; data: Json }
export interface AttemptRecord { id: string; activityId: string; sessionId: string; createdAt: string; data: Json }
export interface AttemptResult { inserted: boolean; snapshot: Json }
export interface LocalRepository {
  listProfiles(): Promise<Profile[]>
  saveProfile(profile: Profile): Promise<void>
  deleteProfile(profileId: string): Promise<void>
  loadSession(profileId: string): Promise<StoredSession | null>
  saveSession(profileId: string, session: StoredSession): Promise<void>
  saveActivity(profileId: string, activity: ActivityRecord): Promise<void>
  listActivities(profileId: string): Promise<ActivityRecord[]>
  recordAttempt(profileId: string, attempt: AttemptRecord, snapshot: Json): Promise<AttemptResult>
  listAttempts(profileId: string): Promise<AttemptRecord[]>
  loadSnapshot(profileId: string): Promise<Json>
  getJournal(key: string): Promise<Json>
  putJournal(key: string, data: Json): Promise<void>
  deleteJournal(key: string): Promise<void>
  exportBackup(): Promise<string>
  restoreBackup(backup: string): Promise<void>
  deleteAccount(): Promise<void>
}
export type NativeInvoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>
async function invokeNative<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}
export class NativeRepository implements LocalRepository {
  readonly accountId: string
  private readonly invoke: NativeInvoke
  constructor(accountId: string, invoke: NativeInvoke = invokeNative) {
    this.accountId = accountId
    this.invoke = invoke
    if (!accountId.trim()) throw new Error('An authenticated account ID is required')
  }
  private call<T>(operation: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.invoke<T>('local_repository', { request: { accountId: this.accountId, operation, ...args } })
  }
  listProfiles(): Promise<Profile[]> { return this.call('listProfiles') }
  saveProfile(profile: Profile): Promise<void> { return this.call('saveProfile', { profileId: profile.id, data: profile }) }
  deleteProfile(profileId: string): Promise<void> { return this.call('deleteProfile', { profileId }) }
  loadSession(profileId: string): Promise<StoredSession | null> { return this.call('loadSession', { profileId }) }
  saveSession(profileId: string, session: StoredSession): Promise<void> { return this.call('saveSession', { profileId, data: session }) }
  saveActivity(profileId: string, activity: ActivityRecord): Promise<void> { return this.call('saveActivity', { profileId, key: activity.id, data: activity }) }
  listActivities(profileId: string): Promise<ActivityRecord[]> { return this.call('listActivities', { profileId }) }
  recordAttempt(profileId: string, attempt: AttemptRecord, snapshot: Json): Promise<AttemptResult> { return this.call('recordAttempt', { profileId, key: attempt.id, data: attempt, snapshot }) }
  listAttempts(profileId: string): Promise<AttemptRecord[]> { return this.call('listAttempts', { profileId }) }
  loadSnapshot(profileId: string): Promise<Json> { return this.call('loadSnapshot', { profileId }) }
  getJournal(key: string): Promise<Json> { return this.call('getJournal', { key }) }
  putJournal(key: string, data: Json): Promise<void> { return this.call('putJournal', { key, data }) }
  deleteJournal(key: string): Promise<void> { return this.call('deleteJournal', { key }) }
  exportBackup(): Promise<string> { return this.call('exportBackup') }
  restoreBackup(backup: string): Promise<void> { return this.call('restoreBackup', { data: backup }) }
  deleteAccount(): Promise<void> { return this.call('deleteAccount') }
}
