// Install, upgrade, remove — the decisions, with the IO behind a port.
//
// Nothing in this module downloads anything. `PackNative` is an interface and
// the Tauri implementation of it lives in `native.ts`, which is what lets every
// path here — a refused downgrade, a declined confirmation, a corrupt archive,
// a pack that is not what the catalogue said it was — be a Node test rather
// than a device session nobody will run twice.
//
// Two rules that are not negotiable, both learned elsewhere in this repository:
//
//   * **Nothing downloads without being asked.** `confirm` is a required
//     argument, not an option with a default, so a caller cannot forget it. It
//     is handed the size and the capability list, because those are the two
//     facts a parent needs and the two a silent install hides.
//   * **A version mismatch is a failure, not a footnote.** If the artefact does
//     not declare exactly what the catalogue promised, the install failed. It
//     is not recorded, the installed copy is not touched, and the update banner
//     keeps offering — which is correct, because the update genuinely has not
//     happened.

import type { Capability, PackManifest } from "../../../packs/sdk/src/index.ts"
import { localizedName, parseManifest } from "../../../packs/sdk/src/index.ts"
import type { InstallProgress, InstalledPackRow, PackNative } from "./native.ts"
import type { HostProfile, Refusal, RefusalCode } from "./gate.ts"
import { gateInstall } from "./gate.ts"

export type InstalledPack = {
  readonly manifest: PackManifest
  readonly bytes: number
}

export type FailureCode =
  | RefusalCode
  /** The parent said no. Not an error; nothing is retried and nothing is logged. */
  | "declined"
  /** The download did not finish, or the origin refused. */
  | "network"
  /** The archive is not the one the manifest describes. */
  | "integrity"
  /** The archive is a pack, but not this pack. */
  | "identity"
  /** Nothing to install: the catalogue entry has no artefact. */
  | "unavailable"

export type InstallFailure = {
  readonly code: FailureCode
  readonly message: string
  readonly problems?: readonly string[]
}

export type InstallOutcome =
  | { readonly ok: true; readonly pack: InstalledPack; readonly action: "install" | "upgrade" }
  | { readonly ok: false; readonly failure: InstallFailure }

/** What the parent is shown before a byte moves. */
export type Consent = {
  readonly name: string
  readonly version: string
  readonly action: "install" | "upgrade"
  /** Compressed bytes to fetch. */
  readonly downloadBytes: number
  /** Bytes the pack will occupy once installed. */
  readonly installedBytes: number
  readonly capabilities: readonly Capability[]
}

export type InstallDeps = {
  readonly native: PackNative
  readonly host: HostProfile
  /** Resolves false to abandon the install. Required — see the module note. */
  readonly confirm: (consent: Consent) => Promise<boolean>
  readonly onProgress?: (progress: InstallProgress) => void
  /** Display locale, for the name in the consent sheet. */
  readonly locale?: string
}

const fail = (code: FailureCode, message: string, problems?: readonly string[]): InstallOutcome =>
  problems
    ? { ok: false, failure: { code, message, problems } }
    : { ok: false, failure: { code, message } }

const refusalToFailure = (refusal: Refusal): InstallOutcome =>
  refusal.problems
    ? { ok: false, failure: { code: refusal.code, message: refusal.message, problems: refusal.problems } }
    : { ok: false, failure: { code: refusal.code, message: refusal.message } }

/**
 * Install or upgrade one pack from a catalogue manifest.
 *
 * `raw` is the manifest as it came out of the catalogue — unvalidated on
 * purpose, because validating it is the first thing that happens and a caller
 * holding a `PackManifest` it parsed somewhere else has already made the
 * decision this function exists to make.
 */
export async function installPack(
  raw: unknown,
  installed: readonly InstalledPack[],
  deps: InstallDeps,
): Promise<InstallOutcome> {
  const current = installed.find(
    (entry) => typeof raw === "object" && raw !== null && entry.manifest.id === (raw as { id?: unknown }).id,
  )

  const verdict = gateInstall(
    current
      ? { raw, host: deps.host, installedVersion: current.manifest.version }
      : { raw, host: deps.host },
  )
  if (!verdict.ok) return refusalToFailure(verdict.refusal)

  const manifest = verdict.manifest
  const url = manifest.download.url
  if (url === undefined) {
    return fail("unavailable", `${manifest.name} has no download for this device.`)
  }

  const consented = await deps.confirm({
    name: localizedName(manifest, deps.locale ?? "en"),
    version: manifest.version,
    action: verdict.action,
    downloadBytes: manifest.download.bytes,
    installedBytes: manifest.assets.bytes,
    capabilities: manifest.capabilities,
  })
  if (!consented) return fail("declined", "")

  let row: InstalledPackRow
  try {
    row = await deps.native.install(
      {
        packId: manifest.id,
        version: manifest.version,
        url,
        sha256: manifest.download.sha256,
        bytes: manifest.download.bytes,
      },
      deps.onProgress ?? (() => {}),
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // The native side distinguishes these; the wording it produces is the only
    // place they differ, so the classification is done once, here.
    const code: FailureCode = /integrity/i.test(message)
      ? "integrity"
      : /declares|promised/i.test(message)
        ? "identity"
        : "network"
    return fail(code, message)
  }

  // Defence in depth. Rust refuses a mismatched archive already; this catches
  // the case where it did not, which is the case where it matters.
  if (row.id !== manifest.id || row.version !== manifest.version) {
    return fail(
      "identity",
      `Installed ${row.id}@${row.version} but the catalogue promised ${manifest.id}@${manifest.version}.`,
    )
  }

  return { ok: true, pack: { manifest, bytes: row.bytes }, action: verdict.action }
}

export type ReadResult = {
  readonly packs: readonly InstalledPack[]
  /** Directories that are on disk but are not usable, with the reason. */
  readonly damaged: readonly { readonly id: string; readonly problems: readonly string[] }[]
}

/**
 * Everything installed, validated.
 *
 * A pack whose manifest no longer parses is reported as damaged rather than
 * dropped: it is occupying disk and the parent needs to be able to remove it,
 * which they cannot do if the app pretends it is not there.
 */
export async function readInstalled(native: PackNative): Promise<ReadResult> {
  const rows = await native.list()
  const packs: InstalledPack[] = []
  const damaged: { id: string; problems: readonly string[] }[] = []

  for (const row of rows) {
    let raw: unknown
    try {
      raw = JSON.parse(row.manifest)
    } catch {
      damaged.push({ id: row.id, problems: ["manifest.json is not JSON"] })
      continue
    }
    const parsed = parseManifest(raw)
    if (!parsed.ok) {
      damaged.push({ id: row.id, problems: parsed.problems })
      continue
    }
    if (parsed.manifest.id !== row.id) {
      damaged.push({ id: row.id, problems: [`manifest claims to be ${parsed.manifest.id}`] })
      continue
    }
    packs.push({ manifest: parsed.manifest, bytes: row.bytes })
  }

  return { packs, damaged }
}

/**
 * Remove a pack.
 *
 * Thin on purpose — the interesting part is that it exists, is exported, and is
 * wired to a command the backend actually registers.
 */
export async function removePack(native: PackNative, packId: string): Promise<void> {
  await native.remove(packId)
}

export type UpdateOffer = {
  readonly manifest: PackManifest
  readonly from: string
  readonly to: string
  readonly downloadBytes: number
}

/**
 * What the catalogue has that the device does not.
 *
 * Only upgrades: a catalogue entry that is older than what is installed is a
 * broken catalogue, and `gateInstall` refuses it individually. This never
 * offers a pack that would fail the gate, so a parent is not shown an update
 * they cannot apply.
 */
export function planUpdates(
  catalog: readonly PackManifest[],
  installed: readonly InstalledPack[],
  host: HostProfile,
): readonly UpdateOffer[] {
  const offers: UpdateOffer[] = []
  for (const entry of installed) {
    const candidate = catalog.find((manifest) => manifest.id === entry.manifest.id)
    if (!candidate) continue
    const verdict = gateInstall({
      raw: candidate,
      host,
      installedVersion: entry.manifest.version,
    })
    if (!verdict.ok || verdict.action !== "upgrade") continue
    offers.push({
      manifest: candidate,
      from: entry.manifest.version,
      to: candidate.version,
      downloadBytes: candidate.download.bytes,
    })
  }
  return offers
}
