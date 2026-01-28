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
  description?: string
  imageUrl?: string
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

export const isTauriRuntime = () => {
  if (typeof window === "undefined") return false
  // Check for Tauri-specific APIs
  return (
    "__TAURI__" in window ||
    "__TAURI_INTERNALS__" in window ||
    (window as any).__TAURI_IPC__ !== undefined
  )
}

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
    // Extract pack ID from filename (remove .zip extension and normalize)
    const url = new URL(trimmed, window.location.href)
    const pathname = url.pathname
    const filename = pathname.split('/').pop() || ''
    // Remove .zip and convert hyphens to underscores to match manifest convention
    const packId = filename.replace(/\.zip$/, '').replace(/-/g, '_')

    if (!packId) {
      throw new Error("Could not determine pack ID from ZIP filename")
    }

    const result = await installPackFromDownload({
      packId,
      downloadUrl: trimmed,
      expectedSha256: request.expectedHash,
      source: request.source,
    })
    return {
      ...result,
      version: result.version ?? request.expectedVersion,
    }
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
    description?: string
  }
  if (!manifest.id) {
    throw new Error("Manifest missing id")
  }
  return {
    packId: manifest.id,
    name: manifest.name,
    manifestUrl: resolved,
    version: manifest.version ?? request.expectedVersion,
    description: manifest.description,
    installedAt: Date.now(),
    source: request.source,
  }
}

export const installPackFromDownload = async (
  request: DownloadInstallRequest
): Promise<InstallResult> => {
  console.log("[install] Attempting to install pack:", request.packId)
  console.log("[install] Tauri runtime detected:", isTauriRuntime())
  console.log("[install] Window.__TAURI__:", (window as any).__TAURI__)

  try {
    const { installContentPackFromUrl } = await import("./native")
    console.log("[install] Native module imported successfully")

    const result = await installContentPackFromUrl({
      packId: request.packId,
      downloadUrl: request.downloadUrl,
      expectedSha256: request.expectedSha256,
    })
    console.log("[install] Install successful:", result)

    return {
      packId: result.pack.id,
      name: result.pack.name,
      manifestUrl: result.pack.manifest_url,
      version: result.pack.version,
      installedAt: result.pack.installed_at,
      source: request.source,
    }
  } catch (err) {
    console.error("[install] Install failed:", err)
    const message = err instanceof Error ? err.message : String(err)

    // If the error suggests Tauri is not available, provide helpful message
    if (message.includes("__TAURI__") || message.includes("invoke")) {
      throw new Error("Pack downloads require the Corpán app. This feature is not available in the browser.")
    }

    throw new Error(`Pack download install failed: ${message}`)
  }
}
