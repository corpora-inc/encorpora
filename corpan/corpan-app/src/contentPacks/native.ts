import { invoke } from "@tauri-apps/api/core"

export type InstalledContentPack = {
  id: string
  name?: string
  version?: string
  manifest_url: string
  installed_at: number
}

export type InstallContentPackRequest = {
  packId: string
  downloadUrl: string
  expectedSha256?: string
}

export type InstallContentPackResult = {
  pack: InstalledContentPack
}

export const installContentPackFromUrl = async (
  request: InstallContentPackRequest
): Promise<InstallContentPackResult> => {
  return invoke("content_packs_install_from_url", {
    packId: request.packId,
    downloadUrl: request.downloadUrl,
    expectedSha256: request.expectedSha256,
  })
}

export const listInstalledContentPacks = async (): Promise<
  InstalledContentPack[]
> => {
  return invoke("content_packs_list_installed")
}

export const getInstalledManifestUrl = async (
  packId: string
): Promise<string> => {
  return invoke("content_packs_get_manifest_url", { packId })
}
