// What is on this device, read from disk, gated, and made launchable.
//
// `registry.ts` is the persisted *record* — a list a parent can read with no
// native runtime present. This is the live truth: `packs_list` walks the pack
// root, every manifest goes through `gateRun` (which is re-asked every launch,
// because the app is what changes underneath an installed pack), and what
// survives is a pack that can be framed right now.
//
// Everything here is pure over its dependencies, so the whole decision — a
// damaged manifest, a pack this build has grown past, a capability that was
// removed underneath one — is a Node test. `libraryStore.ts` is the thin part
// that wires it to Tauri and to React.

import type { Capability, PackManifest } from "../../../packs/sdk/src/index.ts"
import { localizedDescription, localizedName } from "../../../packs/sdk/src/index.ts"
import { gateRun, type HostProfile, type Refusal } from "./gate.ts"
import { readInstalled } from "./install.ts"
import type { PackNative } from "./native.ts"

/**
 * Everything this build can honour. A pack asking for more is refused.
 *
 * **A native-backed capability belongs here as soon as the build implements it,
 * and must never be removed to express a device that cannot do it.** This list
 * feeds `gateInstall`, which *refuses the install* of a pack that asks for
 * something missing from it — so dropping `sensors.orientation` for a tablet
 * with no gyroscope would stop that tablet installing the pack at all instead of
 * letting the pack run without tilt. Which capabilities a *device* can actually
 * do is a separate, runtime answer: `HostServices.available()`, sent to the pack
 * as `Connect.available`. See `docs/NATIVE_CAPABILITIES.md`.
 */
export const HOST_SUPPORTS: readonly Capability[] = [
  "items",
  "items.reveal",
  "learner.read",
  "haptics",
  "audio",
  "milestones",
  "storage",
  "sensors.orientation",
]

/**
 * This build, as a pack sees it.
 *
 * The version is passed in rather than read from `platform.ts`: that module
 * evaluates a Vite-defined constant at import, which does not exist under
 * `node --test`, and this file has to stay reachable from a Node test with no
 * DOM and no bundler. `libraryStore.ts` is what supplies the real one.
 */
export function hostProfile(version: string): HostProfile {
  return { version, supports: HOST_SUPPORTS }
}

/** One pack, ready to launch. */
export type LibraryEntry = {
  readonly manifest: PackManifest
  readonly bytes: number
  /** The intersection of what it declared and what this build can do. */
  readonly granted: readonly Capability[]
  readonly name: string
  readonly description: string
}

export type LibraryProblem = {
  readonly id: string
  readonly refusal: Refusal
}

export type LibraryDeps = {
  readonly native: PackNative
  readonly host: HostProfile
  readonly locale?: string
}

/**
 * Everything the front door needs to draw a card, lifted off one manifest.
 *
 * One function with two callers, and the duplication it replaces is why it
 * exists: `libraryStore` copies these onto the persisted record and `useHost`
 * copies them back over it, and the two lists have to agree field for field
 * forever. They were two hand-written object literals, so the failure mode of
 * adding a field was a card that drew it after a fresh install and lost it on
 * the next launch — or the reverse — with every type still correct.
 */
export type PackCardFacts = {
  readonly description: string
  readonly skills: readonly string[]
}

export function cardFacts(entry: LibraryEntry): PackCardFacts {
  return {
    description: entry.description,
    skills: entry.manifest.covers.skills,
  }
}

/**
 * Read the pack root and decide what may run.
 *
 * Pure over its dependencies so the whole decision — a damaged manifest, a pack
 * this build has grown past, a capability that was removed — is a Node test.
 */
export async function readLibrary(
  deps: LibraryDeps,
): Promise<{ entries: LibraryEntry[]; problems: LibraryProblem[] }> {
  const { packs, damaged } = await readInstalled(deps.native)
  const entries: LibraryEntry[] = []
  const problems: LibraryProblem[] = damaged.map((entry) => ({
    id: entry.id,
    refusal: { code: "manifest", message: "This pack is damaged.", problems: entry.problems },
  }))

  for (const installed of packs) {
    const verdict = gateRun({ raw: installed.manifest, host: deps.host })
    if (!verdict.ok) {
      problems.push({ id: installed.manifest.id, refusal: verdict.refusal })
      continue
    }
    const locale = deps.locale ?? "en"
    entries.push({
      manifest: verdict.manifest,
      bytes: installed.bytes,
      granted: verdict.granted,
      name: localizedName(verdict.manifest, locale),
      description: localizedDescription(verdict.manifest, locale),
    })
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))
  return { entries, problems }
}
