// src/util/imagePack.ts
//
// Concept-picture pack (`imagepan`) access for the Journey picture-choice
// upgrade (research/images.md; runtime.ts `maybeImageChoice`).
//
// imagepan is a DATA-ONLY content pack: it ships a SQLite index
// (`concept(key, word, sense_gloss, cefr, domain, file, distractors_json)`,
// db name "main" → data/index.sqlite3) plus loose WebP files under images/. It
// has no launchable experience. The host queries it via the same
// `content_packs_*` surface everything else uses (contentPacks/native.ts) and
// the `corpan-pack://` scheme handler (tauri-plugin-game-packs) serves the WebP
// files directly to <img>.
//
// The resolver's picture path is language-neutral, so there is exactly ONE
// pack id — no pair/target keying (contrast util/wordPack.ts). This module is
// the single place the id, install, disk-probe, and lazy auto-install live so
// Journey and any future surface resolve the same canonical pack.
//
// CONSENT-FIRST, NOT SILENT: imagepan is NEVER auto-downloaded. The owner's
// standing rule is to ask before pulling any pack down (and the pack grows to
// thousands of images). `ensureImagePackRegistered` only recognizes a pack
// that is ALREADY on disk (register the in-memory mirror so the resolver's sync
// gate lights up); the DOWNLOAD is offered to the learner by the inline
// ImagePackOfferBanner (mirrors the wordpan offer). See imagePackProvision.ts.
//
// GRACEFUL DEGRADE is load-bearing: `ensureImagePackRegistered` NEVER throws
// and returns false on every failure path. A false result means imagepan stays
// unregistered → the resolver's `findInstalledPack("imagepan")` gate is false →
// Journey emits normal text cards, exactly as before the pack existed.

import { invoke } from "@tauri-apps/api/core"

import { useDataPacksStore } from "../store/dataPacks"

/** The one canonical imagepan pack id. */
export const IMAGE_PACK_ID = "imagepan"

/**
 * Dev-only fallback download URL. In production imagepan installs from the
 * resolved `zipUrl` on its own S3/CloudFront index — never the main catalog.
 * This helper only exists for `npm run dev`, where the vite `/packs`
 * middleware serves an in-repo zip. Kept parallel to journeyPack /wordPack; the
 * dev zip is not required for the feature to ship (absent ⇒ clean no-op).
 */
export function devDownloadUrlForImagePack(): string {
  return `/packs/imagepan/${IMAGE_PACK_ID}.zip`
}

/** True when imagepan is installed on disk (manifest resolvable). */
export async function isImagePackInstalled(packId = IMAGE_PACK_ID): Promise<boolean> {
  try {
    await invoke("content_packs_get_manifest_url", { packId })
    return true
  } catch {
    return false
  }
}

/**
 * Install imagepan. `zipUrl` comes from the image-pack index; when omitted
 * (dev-server path) we fall back to the vite-served in-repo zip. An EXPLICIT
 * `packId` is passed so the installer never derives an id from a
 * version-suffixed filename (`imagepan-0.1.0.zip` would mis-derive
 * `imagepan_0_1_0` — the wordpan/journey bug-avoidance).
 */
export async function installImagePack(
  zipUrl?: string,
  expectedSha256?: string | null,
): Promise<void> {
  const downloadUrl =
    zipUrl ?? (import.meta.env.DEV ? devDownloadUrlForImagePack() : "")
  if (!downloadUrl) {
    throw new Error(
      `[imagePack] no download URL for ${IMAGE_PACK_ID} — the image-pack index must provide a zipUrl`,
    )
  }
  await invoke("content_packs_install_from_url", {
    packId: IMAGE_PACK_ID,
    downloadUrl,
    expectedSha256: expectedSha256 ?? null,
  })
}

/**
 * Recognize an ALREADY-INSTALLED imagepan (no download, no consent needed).
 * Called when a Journey session opens. Resolution order, each step failing SOFT
 * to the next (and the whole function failing soft to `false`):
 *
 *   1. Already registered in this session's in-memory store → true.
 *   2. On disk (survived a previous install / app restart) → register + true.
 *   3. Anything else (never installed, probe hiccup) → false.
 *
 * This function DELIBERATELY does not touch the catalog and NEVER downloads —
 * the download is a one-tap consent offer (imagePackProvision.ts +
 * ImagePackOfferBanner). NEVER throws. A `false` result is the graceful-degrade
 * path: the resolver's `findInstalledPack("imagepan")` gate stays false and
 * Journey ships inert until the learner accepts the offer.
 *
 * Returns whether imagepan is installed-and-registered after the call.
 */
export async function ensureImagePackRegistered(): Promise<boolean> {
  const store = useDataPacksStore.getState()

  // 1. Fast path: already registered this session.
  if (store.has(IMAGE_PACK_ID)) return true

  // 2. On-disk probe (offline-friendly). Register the in-memory mirror so the
  //    resolver's SYNC gate lights up immediately — an already-installed pack
  //    enriches from the first card with no network and no re-consent.
  try {
    if (await isImagePackInstalled()) {
      registerFromDisk(await readImagePackVersion())
      return true
    }
  } catch {
    // A probe hiccup just means "not confirmed on disk" — ship inert.
  }
  return false
}

/**
 * Consent seam for the inline offer: after a user-approved install completes,
 * register the in-memory mirror so the resolver's `findInstalledPack("imagepan")`
 * gate lights up this session (the runtime also invalidates the resolver).
 */
export function registerInstalledImagePack(version: string): void {
  useDataPacksStore.getState().register({
    id: IMAGE_PACK_ID,
    version,
    installedAt: new Date().toISOString(),
    source: "catalog",
  })
}

/** Read the installed pack version from pack_meta; null when unreadable. */
async function readImagePackVersion(): Promise<string | null> {
  try {
    const result = await invoke<{ rows: Array<Record<string, unknown>> }>(
      "content_packs_query_db",
      {
        packId: IMAGE_PACK_ID,
        dbName: "main",
        sql: "SELECT value FROM pack_meta WHERE key = 'version' LIMIT 1",
        params: [],
        maxRows: 1,
      },
    )
    const v = result?.rows?.[0]?.value
    return typeof v === "string" ? v : null
  } catch {
    return null
  }
}

function registerFromDisk(version: string | null): void {
  useDataPacksStore.getState().register({
    id: IMAGE_PACK_ID,
    version: version ?? "0.0.0",
    installedAt: new Date().toISOString(),
    source: "manual",
  })
}
