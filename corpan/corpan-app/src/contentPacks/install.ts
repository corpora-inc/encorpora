export type InstallSource = "catalog" | "manual" | "platform" | "download"

export type InstallRequest = {
  manifestUrl: string
  source: InstallSource
  expectedHash?: string
  expectedVersion?: string
}

export type DownloadInstallRequest = {
  packId: string
  downloadUrl: string
  expectedSha256?: string
  source: InstallSource
}

export type InstallResult = {
  packId: string
  name?: string
  manifestUrl: string
  version?: string
  installedAt: number
  source: InstallSource
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

const normalizeManifestUrl = (input: string) => {
  const trimmed = input.trim()
  if (!trimmed) return ""
  if (trimmed.endsWith("/manifest.json")) return trimmed
  if (trimmed.endsWith("manifest.json")) return trimmed
  return `${trimmed.replace(/\/$/, "")}/manifest.json`
}

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")

const hashManifest = async (text: string) => {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return toHex(digest)
}

export const installPack = async (
  request: InstallRequest
): Promise<InstallResult> => {
  const normalized = normalizeManifestUrl(request.manifestUrl)
  if (!normalized) {
    throw new Error("Missing manifest URL")
  }
  const resolved = new URL(normalized, window.location.href).toString()
  const res = await fetch(proxyUrlIfNeeded(resolved), { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Manifest not found (${res.status})`)
  }
  const text = await res.text()
  if (request.expectedHash) {
    const hash = await hashManifest(text)
    if (hash !== request.expectedHash) {
      throw new Error("Manifest hash mismatch")
    }
  }
  const manifest = JSON.parse(text) as {
    id?: string
    name?: string
    version?: string
  }
  if (!manifest.id) {
    throw new Error("Manifest missing id")
  }
  return {
    packId: manifest.id,
    name: manifest.name,
    manifestUrl: resolved,
    version: manifest.version ?? request.expectedVersion,
    installedAt: Date.now(),
    source: request.source,
  }
}

export const installPackFromDownload = async (
  request: DownloadInstallRequest
): Promise<InstallResult> => {
  const { installContentPackFromUrl } = await import("./native")
  const result = await installContentPackFromUrl({
    packId: request.packId,
    downloadUrl: request.downloadUrl,
    expectedSha256: request.expectedSha256,
  })
  return {
    packId: result.pack.id,
    name: result.pack.name,
    manifestUrl: result.pack.manifest_url,
    version: result.pack.version,
    installedAt: result.pack.installed_at,
    source: request.source,
  }
}
