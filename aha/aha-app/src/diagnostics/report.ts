/** Plain-text problem report for grown-ups to share. Connection state is
 * yes/no only; identities never enter the report. */
import { scrub, type LogEntry } from './log.ts'

declare const __AHA_BUILD__: string | undefined
export const REPORT_LOG_LINES = 50
export const MAX_NOTE = 1000
export interface ReportEnvironment {
  version?: string
  build?: string
  platform?: string
  userAgent?: string
  signedIn: boolean
  aiReady: boolean
}
interface NavigatorLike { userAgent?: string; platform?: string; userAgentData?: { platform?: string } }
interface EnvironmentSources { getVersion: () => Promise<string>; build: string; navigator?: NavigatorLike }

const line = (text: string, max: number) => {
  const flat = scrub(text.slice(0, max * 4).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim())
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}
/** A build number from the release pipeline: digits and dots only, never free text. */
export function releaseBuild(): string {
  const value = typeof __AHA_BUILD__ === 'string' ? __AHA_BUILD__ : ''
  return /^[0-9][0-9.]{0,31}$/.test(value) ? value : ''
}
async function tauriVersion(): Promise<string> {
  const { getVersion } = await import('@tauri-apps/api/app')
  return getVersion()
}

export async function collectEnvironment(state: { signedIn: boolean; aiReady: boolean },
  sources: EnvironmentSources = { getVersion: tauriVersion, build: releaseBuild(), navigator: typeof navigator === 'undefined' ? undefined : navigator as NavigatorLike }): Promise<ReportEnvironment> {
  let version: string | undefined
  try { version = (await sources.getVersion()) || undefined } catch { version = undefined }
  const nav = sources.navigator
  return {
    version,
    build: sources.build || undefined,
    platform: nav?.userAgentData?.platform || nav?.platform || undefined,
    userAgent: nav?.userAgent || undefined,
    signedIn: state.signedIn,
    aiReady: state.aiReady,
  }
}

export function buildReport(env: ReportEnvironment, entries: LogEntry[], note: string, now = new Date()): string {
  const recent = entries.slice(-REPORT_LOG_LINES)
  const noteText = scrub(note.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, MAX_NOTE))
  return [
    '¡AHA! problem report',
    `Created: ${now.toISOString()}`,
    `App version: ${line(env.version ?? '', 40) || 'unknown'} (${env.build ? `build ${line(env.build, 32)}` : 'build not set'})`,
    `Platform: ${line(env.platform ?? '', 80) || 'unknown'}`,
    `User agent: ${line(env.userAgent ?? '', 300) || 'unknown'}`,
    `Signed in: ${env.signedIn ? 'yes' : 'no'}`,
    `AI ready: ${env.aiReady ? 'yes' : 'no'}`,
    '',
    'Note:',
    noteText || '(none)',
    '',
    `Recent log (last ${recent.length} of ${entries.length})`,
    ...(recent.length ? recent.map(e => `${line(e.t, 40)} ${e.level.toUpperCase()} [${line(e.source, 24)}] ${line(e.message, 400)}`) : ['(empty)']),
    '',
  ].join('\n')
}
