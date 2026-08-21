// Pure decision logic behind `SystemPackInstaller` (components/SystemPackInstaller.tsx).
// Extracted so the loop-guard fix — don't keep auto-retrying a system-pack
// install that already failed this session for the SAME catalog version — is
// directly unit-testable without React/DOM. The component itself is a thin
// wrapper: it owns the `useRef` state and calls these pure functions per
// catalog pack.
//
// Background: SystemPackInstaller silently (no UI) reinstalls whenever
// `installed.version !== catalog.version`. Before the loop-guard fix, a
// catalog entry whose `manifestUrl`/`zipUrl` served a version that never
// actually matched (a stale CDN origin) caused an install attempt on EVERY
// catalog refresh, forever, entirely invisibly (nothing renders here). The
// `installPack()` version-mismatch check (install.ts `assertVersionMatches` /
// `PackVersionMismatchError`) stops the LYING (no more false "success"); this
// module stops the LOOPING.

/** `packId@version` — the unit a failed auto-install attempt is remembered
 *  by. Keying on version (not just packId) means a NEW catalog version for
 *  the same pack always gets a fresh attempt — only a repeat of the exact
 *  version that already failed is suppressed. */
export function systemPackFailKey(packId: string, version: string): string {
  return `${packId}@${version}`
}

/**
 * Should `SystemPackInstaller` attempt an auto-install for this pack right
 * now? Encapsulates every independent gate the component applies per pack
 * per catalog refresh:
 *   - version drift (nothing to do if already installed at the catalog's version)
 *   - the per-session failure backoff (the loop-guard fix)
 *   - in-flight dedup (an install for this pack is already running)
 *
 * Pure — callers own the `failedKeys` / `inFlightIds` sets across renders
 * (a `useRef` in the component).
 */
export function needsSystemPackInstall(args: {
  installedVersion: string | undefined
  catalogVersion: string
  packId: string
  failedKeys: ReadonlySet<string>
  inFlightIds: ReadonlySet<string>
}): boolean {
  const { installedVersion, catalogVersion, packId, failedKeys, inFlightIds } = args
  if (installedVersion === catalogVersion) return false
  if (failedKeys.has(systemPackFailKey(packId, catalogVersion))) return false
  if (inFlightIds.has(packId)) return false
  return true
}

/**
 * Defensive downgrade guard applied AFTER a successful download, before
 * `addGame` persists it: should the just-downloaded version actually replace
 * what's on disk? `installPack()` already rejects any download whose version
 * doesn't match what the catalog promised (`PackVersionMismatchError`), so in
 * the normal case this is redundant with that check by construction. It's a
 * second, independent line of defense against the specific harm the CTO hit —
 * an installed copy getting silently replaced by something that isn't
 * actually newer — for edge cases the version-match check doesn't cover
 * (e.g. the catalog itself briefly regresses, or two catalog refreshes race).
 */
export function shouldReplaceInstalledPack(
  installedVersion: string | undefined,
  downloadedVersion: string | undefined,
  compareVersions: (a: string, b: string) => number,
): boolean {
  if (!installedVersion || !downloadedVersion) return true
  return compareVersions(downloadedVersion, installedVersion) > 0
}
