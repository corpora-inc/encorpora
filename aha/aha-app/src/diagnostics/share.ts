/** Hands a finished report to the native share sheet (iOS) or save dialog
 * (desktop/Android) as a .txt. The WebView supplies text only, never a path. */
export const MAX_REPORT_BYTES = 64 * 1024
export type ShareInvoke = <T>(command: string, args: Record<string, unknown>) => Promise<T>
async function invokeNative<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}
/** true means the sheet or dialog was presented and accepted, not that anything was sent. */
export function shareReport(report: string, invoke: ShareInvoke = invokeNative): Promise<boolean> {
  if (new TextEncoder().encode(report).length > MAX_REPORT_BYTES) return Promise.reject(new Error('The report is too large to share.'))
  return invoke<boolean>('share_report', { report })
}
export async function copyReport(report: string, clipboard: Pick<Clipboard, 'writeText'> | undefined =
  typeof navigator === 'undefined' ? undefined : navigator.clipboard): Promise<void> {
  if (!clipboard) throw new Error('Copying isn’t available here.')
  await clipboard.writeText(report)
}
