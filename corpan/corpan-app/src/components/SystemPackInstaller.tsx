import { useEffect, useRef } from "react"
import { useCatalogStore } from "@/store/catalog"
import { useGamesStore } from "@/store/games"
import { installPack } from "@/contentPacks/install"

/**
 * Silently auto-installs "system packs" (Library, readers) once they appear in
 * the catalog and aren't installed yet. This is what lets us ship Library /
 * reader UX as packs and update them without an app-store release — the user
 * never has to find and tap "Get".
 *
 * Renders nothing. Uses installPack + addGame directly (not the dialog-driven
 * InstallContext) so there's no install UI on launch. Best-effort: failures
 * are logged and retried on the next catalog refresh.
 */
export function SystemPackInstaller() {
  const catalog = useCatalogStore((s) => s.catalog)
  const inFlight = useRef<Set<string>>(new Set())

  useEffect(() => {
    const systemPacks = catalog.filter((p) => p.systemPack && p.manifestUrl)
    if (systemPacks.length === 0) return

    const getGame = useGamesStore.getState().getGame
    const addGame = useGamesStore.getState().addGame

    for (const pack of systemPacks) {
      const installed = getGame(pack.id)
      // Install if missing, or upgrade if the catalog has a newer version.
      const needsInstall = !installed || installed.version !== pack.version
      if (!needsInstall) continue
      if (inFlight.current.has(pack.id)) continue
      inFlight.current.add(pack.id)

      void (async () => {
        try {
          const result = await installPack({
            manifestUrl: pack.manifestUrl!,
            source: "catalog",
            expectedVersion: pack.version,
          })
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
          console.warn(`[system-pack] auto-install failed for ${pack.id}:`, err)
        } finally {
          inFlight.current.delete(pack.id)
        }
      })()
    }
  }, [catalog])

  return null
}
