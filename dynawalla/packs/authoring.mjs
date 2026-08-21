// `pack.json` (what an author writes) → `manifest.json` (what a device reads).
//
// Extracted out of `build.mjs` for one reason: it is the only part of the
// pipeline that is a pure function, and it is the part where a field goes
// missing. Everything else in that script is filesystem work whose failure is
// loud — a build that does not produce a file stops. A field silently dropped
// here produces twenty-seven perfectly valid manifests that simply do not say
// the thing, and the first sign of it is a catalogue whose small print is
// blank. `packs/sdk/src/fleet.test.ts` covers this function directly.
//
// The rule about what belongs here has not changed: **generated fields are
// facts about built output** (`assets`, `download`), and everything else is
// carried across from what the author wrote. A hand-maintained copy of a fact
// goes stale; a builder-invented judgement is worse, because nobody made it.

/**
 * The fields carried from `pack.json`, in the order the schema documents them.
 *
 * A list, not a spread of the whole source object: `pack.json` also holds
 * `build` — the vite config and output directory — which is instruction to the
 * builder and has no business on a device.
 *
 * `optional: true` means omitted when the author did not write it, never
 * emitted as `null`. The schema distinguishes "unstated" from "stated as
 * nothing", and `minAge` is the field where that distinction is visible to a
 * parent: an unstated age draws as nothing at all rather than as a guess.
 *
 * `minAge` is optional in the SCHEMA — a manifest written before the field
 * existed is on a device today — but required of every pack in THIS
 * repository, which `fleet.test.ts` enforces. It is carried, never defaulted:
 * how hard a game is on a pair of five-year-old hands is the one judgement a
 * builder cannot make, and inventing a number here would put a claim on a card
 * that nobody made.
 */
export const CARRIED = Object.freeze([
  { field: "id" },
  { field: "version" },
  { field: "name" },
  { field: "description" },
  { field: "nameLocalized", optional: true },
  { field: "descriptionLocalized", optional: true },
  { field: "sdk" },
  { field: "host" },
  { field: "entry" },
  { field: "capabilities" },
  { field: "covers" },
  { field: "minAge", optional: true },
  { field: "locales" },
])

/**
 * @param {Record<string, unknown>} source  the parsed `pack.json`
 * @param {{ files: number, bytes: number }} assets  measured, about the built directory
 * @param {{ bytes: number, sha256: string }} download  measured, about the archive
 */
export function manifestFrom(source, assets, download) {
  /** @type {Record<string, unknown>} */
  const manifest = { schema: 1 }
  for (const { field, optional } of CARRIED) {
    if (optional && source[field] === undefined) continue
    manifest[field] = source[field]
  }
  manifest.assets = assets
  manifest.download = download
  return manifest
}
