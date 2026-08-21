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

/**
 * Thrown when a catalog-driven install/update is bitten by drift between the
 * catalog's advertised version and what the manifest at `manifestUrl`/`zipUrl`
 * actually serves (e.g. a stale CDN origin, an unpublished bump). Surfaced
 * this way — rather than being silently absorbed into a "successful" install
 * that records whatever version showed up — because a mismatch here means the
 * download is NOT the update the user was promised: recording it as installed
 * would both lie about success and leave the update banner re-offering
 * forever (the pack's version would never converge on the catalog's).
 *
 * Callers MUST NOT treat a thrown `PackVersionMismatchError` as a completed
 * install: don't persist the result (no `addGame`) and don't touch whatever
 * copy is already on disk/in the store.
 */
export class PackVersionMismatchError extends Error {
  readonly code = "version_mismatch" as const
  readonly packId: string
  readonly expectedVersion: string
  readonly actualVersion: string

  constructor(packId: string, expectedVersion: string, actualVersion: string) {
    super(
      `Pack version mismatch for ${packId}: catalog expected ${expectedVersion}, ` +
        `downloaded manifest reports ${actualVersion}`
    )
    this.name = "PackVersionMismatchError"
    this.packId = packId
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }
}

/**
 * When the install/update was driven by a catalog entry carrying an expected
 * version, fail loudly on any drift instead of silently recording whatever
 * version the download declares. Logs expected-vs-got before throwing so a
 * stale-origin incident (catalog says 0.3.0, origin still serves 0.1.0) shows
 * up in logs instead of masquerading as a green checkmark.
 *
 * No-ops when there's nothing to compare (no expectedVersion requested, or
 * the downloaded artifact didn't declare a version at all) — existing callers
 * that don't drive installs from a versioned catalog entry are unaffected.
 *
 * Exported (in addition to being wired into both `installPack` branches
 * below) so it's directly unit-testable without the `window`/`fetch`/Tauri
 * dependencies the rest of this module carries.
 */
export const assertVersionMatches = (
  packId: string,
  expectedVersion: string | undefined,
  actualVersion: string | undefined
) => {
  if (!expectedVersion || !actualVersion) return
  if (actualVersion === expectedVersion) return
  console.error(
    `[install] version mismatch for ${packId}: catalog expected ${expectedVersion}, ` +
      `downloaded manifest reports ${actualVersion}`
  )
  throw new PackVersionMismatchError(packId, expectedVersion, actualVersion)
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

const MANIFEST_FETCH_TIMEOUT_MS = 15_000

const fetchManifestText = async (url: string) => {
  if (!import.meta.env.DEV && isTauriRuntime()) {
    const { fetchContentPackText } = await import("./native")
    return fetchContentPackText(url)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), MANIFEST_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(proxyUrlIfNeeded(url), {
      cache: "no-store",
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Manifest not found (${res.status})`)
    }
    return await res.text()
  } catch (err) {
    if (
      controller.signal.aborted ||
      (err instanceof DOMException && err.name === "AbortError")
    ) {
      throw new Error(
        `Manifest fetch timed out after ${MANIFEST_FETCH_TIMEOUT_MS / 1000}s — check your connection.`,
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const installPack = async (
  request: InstallRequest
): Promise<InstallResult> => {
  const trimmed = request.manifestUrl.trim()

  // Detect .zip URLs and handle as download install
  if (trimmed.endsWith('.zip')) {
    // Extract pack ID from filename. Strip `.zip` and a trailing `-<version>`
    // so e.g. `phrase-botany-basics-0.1.0.zip` becomes `phrase-botany-basics`.
    // We keep hyphens — phrase-pack ids are kebab-case and never have
    // underscores (game-pack ids historically used underscores and we
    // preserve that for backward compat below).
    const url = new URL(trimmed, window.location.href)
    const pathname = url.pathname
    const filename = pathname.split('/').pop() || ''
    const stripped = filename.replace(/\.zip$/, '')
    const packId = stripped.startsWith('phrase-')
      ? stripped.replace(/-\d+(\.\d+){1,2}([-+][0-9A-Za-z.-]+)?$/, '')
      : stripped.replace(/-/g, '_')

    if (!packId) {
      throw new Error("Could not determine pack ID from ZIP filename")
    }

    const result = await installPackFromDownload({
      packId,
      downloadUrl: trimmed,
      expectedSha256: request.expectedHash,
      source: request.source,
    })
    // Fail (don't record success) if the catalog promised a specific version
    // and the artifact we just downloaded/extracted declares a different one.
    // Checked BEFORE phrase-pack registration so a mismatched pack is never
    // registered as active either.
    assertVersionMatches(result.packId, request.expectedVersion, result.version)
    // If this was a phrase pack, register it now. Other pack types are
    // ignored by the helper.
    try {
      const { registerPhrasePackIfApplicable } = await import("./phrasePackRegister")
      await registerPhrasePackIfApplicable(
        result.packId,
        request.source === "manual" ? "manual" : "catalog",
      )
    } catch (err) {
      console.warn("[install] phrase-pack registration failed:", err)
    }
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
  // Fail (don't record success) if the catalog promised a specific version
  // and the fetched manifest declares a different one — the mechanism behind
  // the "stale origin serves an old version forever" bug.
  assertVersionMatches(manifest.id, request.expectedVersion, manifest.version)
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
