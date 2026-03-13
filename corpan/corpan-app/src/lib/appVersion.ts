import { compareVersions } from "@/contentPacks/catalog"

const COMPILE_TIME_VERSION: string = __APP_VERSION__
let cachedVersion: string | null = null

export async function getAppVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion
  try {
    const { getVersion } = await import("@tauri-apps/api/app")
    cachedVersion = await getVersion()
  } catch {
    cachedVersion = COMPILE_TIME_VERSION
  }
  return cachedVersion
}

export function meetsMinVersion(
  appVersion: string,
  minVersion: string,
): boolean {
  return compareVersions(appVersion, minVersion) >= 0
}
