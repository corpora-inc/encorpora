import { useEffect, useRef } from "react"
import { useCatalogStore } from "@/store/catalog"
import { useGamesStore } from "@/store/games"
import { installPack, PackVersionMismatchError } from "@/contentPacks/install"
import { compareVersions } from "@/contentPacks/catalog"
import {
  needsSystemPackInstall,
  shouldReplaceInstalledPack,
  systemPackFailKey,
} from "@/contentPacks/systemPackInstallPlan"

/**
 * Silently auto-installs "system packs" (Library, readers) once they appear in
 * the catalog and aren't installed yet. This is what lets us ship Library /
 * reader UX as packs and update them without an app-store release — the user
 * never has to find and tap "Get".
 *
 * Renders nothing. Uses installPack + addGame directly (not the dialog-driven
 * InstallContext) so there's no install UI on launch. Best-effort: failures
 * are logged and retried on the next catalog refresh — EXCEPT a version that
 * already failed this session (see `failedRef` below), which is the loop
 * guard for the "catalog advertises a version the origin doesn't actually
 * serve" bug: without it, every catalog refresh re-triggers the same
 * install, which fails/mismatches the same way, forever, with no user-visible
 * signal (this component renders nothing). A NEW catalog version for the pack
 * gets a fresh attempt; a human can still force a retry via the manual
 * Update button (PackActions → InstallContext), which doesn't consult this
 * guard at all.
 */
export function SystemPackInstaller() {
  const catalog = useCatalogStore((s) => s.catalog)
  const inFlight = useRef<Set<string>>(new Set())
  const failedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const systemPacks = catalog.filter((p) => p.systemPack && p.manifestUrl)
    if (systemPacks.length === 0) return

    const getGame = useGamesStore.getState().getGame
    const addGame = useGamesStore.getState().addGame

    for (const pack of systemPacks) {
      const installed = getGame(pack.id)
      const shouldAttempt = needsSystemPackInstall({
        installedVersion: installed?.version,
        catalogVersion: pack.version,
        packId: pack.id,
        failedKeys: failedRef.current,
        inFlightIds: inFlight.current,
      })
      if (!shouldAttempt) continue
      const key = systemPackFailKey(pack.id, pack.version)
      inFlight.current.add(pack.id)

      void (async () => {
        try {
          const result = await installPack({
            manifestUrl: pack.manifestUrl!,
            source: "catalog",
            expectedVersion: pack.version,
          })
          // Defensive: never let a downloaded copy replace an installed one
          // that's already the same version or newer. In the normal case
          // `installPack` already threw on any version mismatch above, so
          // this only guards a catalog itself regressing (or a race between
          // two catalog refreshes) rather than a stale origin.
          if (!shouldReplaceInstalledPack(installed?.version, result.version, compareVersions)) {
            console.warn(
              `[system-pack] downloaded ${pack.id} v${result.version} is not newer ` +
                `than installed v${installed?.version}; not replacing`
            )
            failedRef.current.add(key)
            return
          }
          addGame({
            id: result.packId,
            name: result.name ?? pack.name,
            manifestUrl: result.manifestUrl,
            version: result.version,
            description: result.description ?? pack.description,
            imageUrl: pack.imageUrl,
            source: result.source,
          })
          console.log(`[system-pack] auto-installed ${pack.id} v${result.version}`)
        } catch (err) {
          if (err instanceof PackVersionMismatchError) {
            console.warn(
              `[system-pack] auto-install version mismatch for ${pack.id}: ` +
                `catalog expected ${err.expectedVersion}, got ${err.actualVersion}. ` +
                `Backing off for this session; will retry if the catalog advertises a new version.`
            )
          } else {
            console.warn(`[system-pack] auto-install failed for ${pack.id}:`, err)
          }
          failedRef.current.add(key)
        } finally {
          inFlight.current.delete(pack.id)
        }
      })()
    }
  }, [catalog])

  return null
}
