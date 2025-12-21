import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useGamesStore, type InstalledGame } from "@/store/games"
import {
  listPlatformPacks,
  resolvePlatformPackManifestUrl,
  type PlatformPack,
} from "@/contentPacks/platformPacks"

const normalizeManifestUrl = (input: string) => {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (trimmed.endsWith("/manifest.json")) return trimmed
  if (trimmed.endsWith("manifest.json")) return trimmed
  return `${trimmed.replace(/\/$/, "")}/manifest.json`
}

const proxyUrlIfNeeded = (rawUrl: string) => {
  try {
    const resolved = new URL(rawUrl, window.location.href)
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return resolved.toString()
    }
    if (
      resolved.hostname.endsWith(".localhost") &&
      resolved.hostname.startsWith("corpan-pack")
    ) {
      return resolved.toString()
    }
    if (resolved.origin === window.location.origin) {
      return resolved.toString()
    }
    return `/game-proxy?url=${encodeURIComponent(resolved.toString())}`
  } catch {
    return rawUrl
  }
}

export function GamesPanel({
  onLaunchGame,
}: {
  onLaunchGame?: (game: InstalledGame) => void
}) {
  const gamesMap = useGamesStore((s) => s.games)
  const games = useMemo(() => {
    return Object.values(gamesMap).sort((a, b) => a.name.localeCompare(b.name))
  }, [gamesMap])
  const addGame = useGamesStore((s) => s.addGame)
  const removeGame = useGamesStore((s) => s.removeGame)

  const [manifestUrl, setManifestUrl] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [platformPacks, setPlatformPacks] = useState<PlatformPack[]>([])
  const [platformError, setPlatformError] = useState<string | null>(null)
  const [platformLoading, setPlatformLoading] = useState(false)

  const handleInstall = async () => {
    const normalized = normalizeManifestUrl(manifestUrl)
    if (!normalized) {
      setError("Enter a manifest URL.")
      return
    }
    setInstalling(true)
    setError(null)
    try {
      const resolved = new URL(normalized, window.location.href).toString()
      const res = await fetch(proxyUrlIfNeeded(resolved), { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Manifest not found (${res.status})`)
      }
      const manifest = (await res.json()) as {
        id?: string
        name?: string
        version?: string
      }
      if (!manifest.id) {
        throw new Error("Manifest missing id")
      }
      addGame({
        id: manifest.id,
        name: manifest.name ?? manifest.id,
        manifestUrl: resolved,
        version: manifest.version,
      })
      setManifestUrl("")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Install failed"
      setError(message)
    } finally {
      setInstalling(false)
    }
  }

  const refreshPlatformPacks = useCallback(async () => {
    setPlatformLoading(true)
    setPlatformError(null)
    const packs = await listPlatformPacks()
    setPlatformPacks(packs)
    setPlatformLoading(false)
  }, [])

  useEffect(() => {
    void refreshPlatformPacks()
  }, [refreshPlatformPacks])

  const handleLaunchPlatform = async (pack: PlatformPack) => {
    const manifest = await resolvePlatformPackManifestUrl(pack.id)
    if (!manifest) {
      setPlatformError("Unable to resolve manifest for this pack.")
      return
    }
    onLaunchGame?.({
      id: pack.id,
      name: pack.name,
      manifestUrl: manifest,
      version: pack.version,
      installedAt: Date.now(),
    })
  }

  return (
    <div className="mt-6">
      <Separator className="my-5" />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Games</h3>
        <p className="text-sm text-muted-foreground">
          Install a game from a manifest URL, then launch it in full-screen.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          placeholder="https://example.com/corpan-game/manifest.json"
          value={manifestUrl}
          onChange={(event) => setManifestUrl(event.target.value)}
        />
        <Button
          variant="outline"
          onClick={handleInstall}
          disabled={installing}
        >
          {installing ? "Installing..." : "Install game"}
        </Button>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="mt-6 space-y-3">
        {games.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No games installed yet.
          </div>
        ) : (
          games.map((game) => (
            <div
              key={game.id}
              className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white/80 p-4"
            >
              <div>
                <div className="text-base font-medium">{game.name}</div>
                <div className="text-xs text-muted-foreground">
                  {game.id}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onLaunchGame?.(game)}
                >
                  Launch
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeGame(game.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold">Purchased packs</h4>
          <Button
            size="sm"
            variant="ghost"
            onClick={refreshPlatformPacks}
            disabled={platformLoading}
          >
            {platformLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          iOS/Android purchases will appear here when running on device.
        </p>
        {platformError ? (
          <div className="text-sm text-red-600">{platformError}</div>
        ) : null}
        {platformPacks.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No platform packs detected.
          </div>
        ) : (
          platformPacks.map((pack) => (
            <div
              key={pack.id}
              className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white/80 p-4"
            >
              <div>
                <div className="text-base font-medium">{pack.name}</div>
                <div className="text-xs text-muted-foreground">{pack.id}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleLaunchPlatform(pack)}>
                  Launch
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
