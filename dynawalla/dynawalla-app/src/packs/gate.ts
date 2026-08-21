// Whether a pack may be installed, and whether an installed pack may run.
//
// Two questions, asked at two different times, and the second is the one that
// is easy to forget: a pack passes the install gate once, and then the host is
// upgraded twenty times underneath it. A pack whose `host.max` the app has
// grown past must stop running — quietly refusing to launch with a reason the
// parent can act on, rather than mounting and failing somewhere inside a game.
//
// Nothing here does IO, so all of it is decided in a Node test.

import type { Capability, PackManifest } from "../../../packs/sdk/src/index.ts"
import {
  compareVersions,
  parseManifest,
  satisfies,
  sdkCompatible,
  SDK_VERSION,
} from "../../../packs/sdk/src/index.ts"

export type RefusalCode =
  /** The manifest is not a manifest. */
  | "manifest"
  /** This app is older or newer than the pack supports. */
  | "host_version"
  /** The pack was built against an SDK this host does not implement. */
  | "sdk_version"
  /** The pack asks for something this build cannot do at all. */
  | "capability"
  /** The catalogue is offering what is already installed. */
  | "already_current"
  /** The catalogue is offering something older than what is installed. */
  | "downgrade"

export type Refusal = {
  readonly code: RefusalCode
  /** One sentence. Not shown raw to a child; the shell decides the wording. */
  readonly message: string
  /** Every schema problem, when the code is `manifest`. */
  readonly problems?: readonly string[]
}

export type InstallVerdict =
  | { readonly ok: true; readonly manifest: PackManifest; readonly action: "install" | "upgrade" }
  | { readonly ok: false; readonly refusal: Refusal }

export type HostProfile = {
  /** The app's own version, from `package.json` via `__APP_VERSION__`. */
  readonly version: string
  /** The SDK version this host implements. Defaults to the SDK's own. */
  readonly sdk?: string
  /**
   * Capabilities this build can honour at all.
   *
   * Not the same as what a pack is granted: a capability missing from here is a
   * thing the app cannot do on any device (no audio subsystem compiled in), and
   * a pack that requires it is refused rather than mounted and disappointed.
   */
  readonly supports: readonly Capability[]
}

const refuse = (code: RefusalCode, message: string, problems?: readonly string[]): InstallVerdict =>
  problems ? { ok: false, refusal: { code, message, problems } } : { ok: false, refusal: { code, message } }

/**
 * The whole install decision, from an untrusted manifest to a verdict.
 *
 * Order matters and is the order a parent would ask the questions in: is this a
 * manifest at all, does it run here, does it want anything we cannot give, and
 * only then is it worth downloading.
 */
export function gateInstall(input: {
  readonly raw: unknown
  readonly host: HostProfile
  /** The version already on disk, if any. */
  readonly installedVersion?: string
}): InstallVerdict {
  const parsed = parseManifest(input.raw)
  if (!parsed.ok) {
    return refuse("manifest", "This pack's manifest is not valid.", parsed.problems)
  }
  const manifest = parsed.manifest

  if (!satisfies(input.host.version, manifest.host)) {
    const ceiling = manifest.host.max ? ` and below ${manifest.host.max}` : ""
    return refuse(
      "host_version",
      `This pack needs Dynawalla ${manifest.host.min}${ceiling}; this is ${input.host.version}.`,
    )
  }

  const hostSdk = input.host.sdk ?? SDK_VERSION
  if (!sdkCompatible(manifest.sdk, hostSdk)) {
    return refuse(
      "sdk_version",
      `This pack was built for pack SDK ${manifest.sdk}; this app implements ${hostSdk}.`,
    )
  }

  const missing = manifest.capabilities.filter(
    (capability) => !input.host.supports.includes(capability),
  )
  if (missing.length > 0) {
    return refuse("capability", `This pack needs something this app cannot do: ${missing.join(", ")}.`)
  }

  if (input.installedVersion !== undefined) {
    const order = compareVersions(manifest.version, input.installedVersion)
    if (order === null) {
      return refuse("manifest", "The installed version is unreadable.")
    }
    if (order === 0) {
      return refuse("already_current", `Version ${manifest.version} is already installed.`)
    }
    if (order < 0) {
      // Never automatic. A published artefact is immutable, so an older version
      // arriving from the catalogue means the catalogue is wrong, not that the
      // device is ahead.
      return refuse(
        "downgrade",
        `The catalogue offers ${manifest.version}, which is older than the installed ${input.installedVersion}.`,
      )
    }
    return { ok: true, manifest, action: "upgrade" }
  }

  return { ok: true, manifest, action: "install" }
}

export type RunVerdict =
  | { readonly ok: true; readonly manifest: PackManifest; readonly granted: readonly Capability[] }
  | { readonly ok: false; readonly refusal: Refusal }

/**
 * Whether an already-installed pack may be launched now.
 *
 * Re-asked every launch rather than cached at install: the app is what changes.
 * The grant set returned is the intersection of what the pack declared and what
 * this build supports, so a pack cannot widen its reach by being installed
 * before a capability was removed.
 */
export function gateRun(input: {
  readonly raw: unknown
  readonly host: HostProfile
}): RunVerdict {
  const parsed = parseManifest(input.raw)
  if (!parsed.ok) {
    return { ok: false, refusal: { code: "manifest", message: "This pack is damaged.", problems: parsed.problems } }
  }
  const manifest = parsed.manifest

  if (!satisfies(input.host.version, manifest.host)) {
    return {
      ok: false,
      refusal: {
        code: "host_version",
        message: `This pack does not run on Dynawalla ${input.host.version}. There may be an update for it.`,
      },
    }
  }

  const hostSdk = input.host.sdk ?? SDK_VERSION
  if (!sdkCompatible(manifest.sdk, hostSdk)) {
    return {
      ok: false,
      refusal: {
        code: "sdk_version",
        message: `This pack was built for pack SDK ${manifest.sdk}. There may be an update for it.`,
      },
    }
  }

  const granted = manifest.capabilities.filter((capability) =>
    input.host.supports.includes(capability),
  )
  return { ok: true, manifest, granted }
}
