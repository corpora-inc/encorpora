// The pack manifest, and the validator that is the only way to get one.
//
// A manifest arrives from a catalog over the network and from a ZIP on disk,
// and the two are compared against each other, so this parser treats its input
// as hostile in both directions. It reports **every** problem rather than the
// first: a pack author fixing one field at a time across a build-publish cycle
// is how a schema gets a reputation, and the same list is what a support reply
// needs.
//
// Fields exist here for one of three reasons and no others:
//
//   * the host cannot install without it (id, version, integrity, sizes),
//   * the host cannot decide whether to run it (host range, sdk, capabilities),
//   * a parent or the router has to choose between packs (name, covers,
//     locales).
//
// There is no field for anything a pack could put in its own files.

import type { Capability } from "./capabilities.ts"
import { CAPABILITY_IDS } from "./capabilities.ts"
import { isSemver } from "./semver.ts"

/** Bumped only for a change that an older host would misread. */
export const MANIFEST_SCHEMA = 1

/** Lower-case dotted segments. Stable forever: it is the on-disk directory. */
export const PACK_ID_PATTERN = /^[a-z][a-z0-9]*(?:[-.][a-z0-9]+)*$/

/** SHA-256, lower-case hex. The only integrity algorithm this schema admits. */
export const INTEGRITY_PATTERN = /^[0-9a-f]{64}$/

/**
 * 512 MB installed. Large enough for a 3D world with audio, small enough that
 * the number is a decision rather than an accident, and it bounds what a
 * malicious archive can do to a device before the extractor gives up.
 */
export const MAX_INSTALLED_BYTES = 512 * 1024 * 1024

/** 256 MB compressed. */
export const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024

export const MAX_FILES = 20_000

export type PackManifest = {
  readonly schema: number
  readonly id: string
  readonly version: string
  /** English fallback. `nameLocalized[locale]` is preferred when present. */
  readonly name: string
  readonly nameLocalized?: Readonly<Record<string, string>>
  readonly description: string
  readonly descriptionLocalized?: Readonly<Record<string, string>>
  /** The SDK version the pack was built against. */
  readonly sdk: string
  /** Host app versions this pack runs on: `min` inclusive, `max` exclusive. */
  readonly host: { readonly min: string; readonly max?: string }
  /** Relative path to the document the host frames. Always an HTML file. */
  readonly entry: string
  readonly capabilities: readonly Capability[]
  /** What the pack can teach, so the router can hand it a skill. */
  readonly covers: {
    readonly skills: readonly string[]
    /** Inclusive school-grade band. `[1, 3]` is grades one to three. */
    readonly grades: readonly [number, number]
  }
  /** BCP-47 tags the pack renders. `en` is required. */
  readonly locales: readonly string[]
  readonly assets: { readonly files: number; readonly bytes: number }
  readonly download: {
    /** Absent for a pack that ships with the app or is side-loaded in dev. */
    readonly url?: string
    readonly bytes: number
    readonly sha256: string
  }
}

export type ManifestResult =
  | { readonly ok: true; readonly manifest: PackManifest }
  | { readonly ok: false; readonly problems: readonly string[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const stringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") return null
    out.push(entry)
  }
  return out
}

const localizedMap = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value)) return null
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") return null
    out[key] = entry
  }
  return out
}

/**
 * An entry path that cannot leave the pack directory and cannot be mistaken for
 * an absolute or a UNC path on any platform the app ships to.
 *
 * The Rust side re-checks this against a canonicalised root — a path rule
 * enforced only in TypeScript is a comment — but rejecting it here means a
 * malformed pack fails at validation with a readable reason instead of at a
 * 404 the user has to interpret.
 */
export function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.length > 512) return false
  if (value.startsWith("/") || value.startsWith("\\")) return false
  if (/^[a-zA-Z]:/.test(value)) return false
  if (value.includes("\\")) return false
  if (value.includes("\0")) return false
  for (const segment of value.split("/")) {
    if (segment === "" || segment === "." || segment === "..") return false
  }
  return true
}

/** Parse and validate. The only constructor of a `PackManifest`. */
export function parseManifest(input: unknown): ManifestResult {
  const problems: string[] = []
  const fail = (message: string) => problems.push(message)

  if (!isRecord(input)) {
    return { ok: false, problems: ["manifest is not an object"] }
  }

  const schema = input["schema"]
  if (schema !== MANIFEST_SCHEMA) {
    fail(`schema must be ${MANIFEST_SCHEMA}, got ${JSON.stringify(schema)}`)
  }

  const id = input["id"]
  if (typeof id !== "string" || !PACK_ID_PATTERN.test(id) || id.length > 64) {
    fail(`id must match ${PACK_ID_PATTERN.source} and be at most 64 characters`)
  }

  const version = input["version"]
  if (typeof version !== "string" || !isSemver(version)) {
    fail("version must be a semantic version")
  }

  const name = input["name"]
  if (typeof name !== "string" || name.trim().length === 0 || name.length > 64) {
    fail("name must be a non-empty string of at most 64 characters")
  }

  const description = input["description"]
  if (typeof description !== "string" || description.length > 280) {
    fail("description must be a string of at most 280 characters")
  }

  const nameLocalized = input["nameLocalized"]
  if (nameLocalized !== undefined && localizedMap(nameLocalized) === null) {
    fail("nameLocalized must map locale tags to strings")
  }
  const descriptionLocalized = input["descriptionLocalized"]
  if (descriptionLocalized !== undefined && localizedMap(descriptionLocalized) === null) {
    fail("descriptionLocalized must map locale tags to strings")
  }

  const sdk = input["sdk"]
  if (typeof sdk !== "string" || !isSemver(sdk)) {
    fail("sdk must be the semantic version of the SDK the pack was built against")
  }

  const host = input["host"]
  if (!isRecord(host)) {
    fail("host must be { min, max? }")
  } else {
    const min = host["min"]
    const max = host["max"]
    if (typeof min !== "string" || !isSemver(min)) fail("host.min must be a semantic version")
    if (max !== undefined && (typeof max !== "string" || !isSemver(max))) {
      fail("host.max must be a semantic version when present")
    }
  }

  const entry = input["entry"]
  if (typeof entry !== "string" || !isSafeRelativePath(entry)) {
    fail("entry must be a relative path inside the pack")
  } else if (!entry.endsWith(".html")) {
    // The document IS the isolation boundary: the host frames it, it does not
    // evaluate it. A script entry would put pack code in the host's realm,
    // which is the one thing this design exists to prevent.
    fail("entry must be an .html document — a pack is framed, never evaluated")
  }

  const capabilities = stringArray(input["capabilities"])
  if (capabilities === null) {
    fail("capabilities must be an array of strings")
  } else {
    for (const capability of capabilities) {
      if (!CAPABILITY_IDS.includes(capability as Capability)) {
        fail(`unknown capability: ${capability}`)
      }
    }
    if (new Set(capabilities).size !== capabilities.length) {
      fail("capabilities contains a duplicate")
    }
  }

  const covers = input["covers"]
  if (!isRecord(covers)) {
    fail("covers must be { skills, grades }")
  } else {
    const skills = stringArray(covers["skills"])
    if (skills === null || skills.length === 0) {
      fail("covers.skills must be a non-empty array of skill ids")
    } else if (skills.length > 512) {
      fail("covers.skills is capped at 512 entries")
    }
    const grades = covers["grades"]
    if (
      !Array.isArray(grades) ||
      grades.length !== 2 ||
      typeof grades[0] !== "number" ||
      typeof grades[1] !== "number" ||
      !Number.isInteger(grades[0]) ||
      !Number.isInteger(grades[1]) ||
      grades[0] < 0 ||
      grades[1] > 12 ||
      grades[0] > grades[1]
    ) {
      fail("covers.grades must be an inclusive [low, high] band within 0–12")
    }
  }

  const locales = stringArray(input["locales"])
  if (locales === null || locales.length === 0) {
    fail("locales must be a non-empty array of BCP-47 tags")
  } else if (!locales.includes("en")) {
    // Not chauvinism: `name` and `description` above are the English fallback,
    // and a pack whose only locale is one the device does not have would render
    // nothing at all.
    fail("locales must include en, which is the fallback for name and description")
  }

  const assets = input["assets"]
  if (!isRecord(assets)) {
    fail("assets must be { files, bytes }")
  } else {
    const files = assets["files"]
    const bytes = assets["bytes"]
    if (typeof files !== "number" || !Number.isInteger(files) || files <= 0 || files > MAX_FILES) {
      fail(`assets.files must be an integer in 1–${MAX_FILES}`)
    }
    if (
      typeof bytes !== "number" ||
      !Number.isInteger(bytes) ||
      bytes <= 0 ||
      bytes > MAX_INSTALLED_BYTES
    ) {
      fail(`assets.bytes must be an integer in 1–${MAX_INSTALLED_BYTES}`)
    }
  }

  const download = input["download"]
  if (!isRecord(download)) {
    fail("download must be { url?, bytes, sha256 }")
  } else {
    const url = download["url"]
    if (url !== undefined && typeof url !== "string") {
      fail("download.url must be a string when present")
    } else if (typeof url === "string" && !url.startsWith("https://")) {
      // The host fetches this natively, not from the WebView, and it will
      // refuse a non-pinned origin as well — but a manifest that states
      // `http://` should never reach a device in the first place.
      fail("download.url must be https")
    }
    const bytes = download["bytes"]
    if (
      typeof bytes !== "number" ||
      !Number.isInteger(bytes) ||
      bytes <= 0 ||
      bytes > MAX_DOWNLOAD_BYTES
    ) {
      fail(`download.bytes must be an integer in 1–${MAX_DOWNLOAD_BYTES}`)
    }
    const sha256 = download["sha256"]
    if (typeof sha256 !== "string" || !INTEGRITY_PATTERN.test(sha256)) {
      fail("download.sha256 must be 64 lower-case hex characters")
    }
  }

  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, manifest: input as unknown as PackManifest }
}

/** The display name for a locale, falling back the way the schema promises. */
export function localizedName(manifest: PackManifest, locale: string): string {
  const map = manifest.nameLocalized
  if (!map) return manifest.name
  return map[locale] ?? map[locale.split("-")[0] ?? ""] ?? manifest.name
}

export function localizedDescription(manifest: PackManifest, locale: string): string {
  const map = manifest.descriptionLocalized
  if (!map) return manifest.description
  return map[locale] ?? map[locale.split("-")[0] ?? ""] ?? manifest.description
}
