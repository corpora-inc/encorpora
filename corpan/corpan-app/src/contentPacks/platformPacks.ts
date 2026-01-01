import { invoke } from "@tauri-apps/api/core"

export type PlatformPack = {
  id: string
  name: string
  version?: string
}

const toStringValue = (value: unknown) => {
  if (typeof value === "string") return value
  return ""
}

const toOptionalString = (value: unknown) => {
  if (typeof value === "string") return value
  return undefined
}

export const listPlatformPacks = async (): Promise<PlatformPack[]> => {
  try {
    const result = await invoke<unknown>("plugin:game_packs|list_game_packs")
    if (!Array.isArray(result)) return []
    const packs: PlatformPack[] = []
    for (const item of result) {
      if (!item || typeof item !== "object") continue
      const record = item as Record<string, unknown>
      const id = toStringValue(record.id)
      if (!id) continue
      packs.push({
        id,
        name: toStringValue(record.name) || id,
        version: toOptionalString(record.version),
      })
    }
    return packs
  } catch {
    return []
  }
}

export const resolvePlatformPackManifestUrl = async (
  packId: string
): Promise<string | null> => {
  try {
    const result = await invoke<unknown>(
      "plugin:game_packs|get_game_pack_manifest_url",
      {
        packId,
      }
    )
    if (typeof result === "string" && result.length > 0) {
      return result
    }
    return null
  } catch {
    return null
  }
}
