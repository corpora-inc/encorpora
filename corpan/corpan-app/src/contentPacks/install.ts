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
    if (!import.meta.env.DEV) {
      return resolved.toString()
    }
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

const isTauriRuntime = () =>
  typeof window !== "undefined" && "__TAURI__" in window

const fetchManifestText = async (url: string) => {
  if (!import.meta.env.DEV && isTauriRuntime()) {
    const { fetchContentPackText } = await import("./native")
    return fetchContentPackText(url)
  }
  const res = await fetch(proxyUrlIfNeeded(url), { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Manifest not found (${res.status})`)
  }
  return res.text()
}

export const installPack = async (
  request: InstallRequest
): Promise<InstallResult> => {
  const trimmed = request.manifestUrl.trim()

  // Detect .zip URLs and handle as download install
  if (trimmed.endsWith('.zip')) {
    // Extract pack ID from filename (remove .zip extension)
    const url = new URL(trimmed, window.location.href)
    const pathname = url.pathname
    const filename = pathname.split('/').pop() || ''
    const packId = filename.replace(/\.zip$/, '')

    if (!packId) {
      throw new Error("Could not determine pack ID from ZIP filename")
    }

    return installPackFromDownload({
      packId,
      downloadUrl: trimmed,
      expectedSha256: request.expectedHash,
      source: request.source,
    })
  }

  // Handle manifest.json URLs
  const normalized = normalizeManifestUrl(request.manifestUrl)
  if (!normalized) {
    throw new Error("Missing manifest URL")
  }
  const resolved = new URL(normalized, window.location.href).toString()
  const text = await fetchManifestText(resolved)
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
