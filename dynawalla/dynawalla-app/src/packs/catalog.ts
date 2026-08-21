// The catalogue: a list of manifests, and nothing else.
//
// There is no second schema for "the catalogue's idea of a pack" — the entries
// ARE manifests, validated by the same parser the installed copy goes through.
// Corpán learned the alternative the expensive way: a catalogue that carries
// its own version field next to the artefact's produces drift between what was
// advertised and what was downloaded, and every consumer then has to decide
// which one it believes.
//
// Fetching is native (`packs_catalog`), because the WebView's `connect-src` is
// closed and the origin is pinned in Rust. This module only ever sees text.

import type { PackManifest } from "../../../packs/sdk/src/index.ts"
import { parseManifest } from "../../../packs/sdk/src/index.ts"

export const CATALOG_SCHEMA = 1

export type CatalogResult =
  | {
      readonly ok: true
      readonly packs: readonly PackManifest[]
      /**
       * Entries that did not validate, with their reasons.
       *
       * A bad entry does not fail the catalogue: one malformed pack must not
       * hide the other forty from a child. It is reported so it is visible in
       * a log rather than silently absent.
       */
      readonly rejected: readonly { readonly index: number; readonly problems: readonly string[] }[]
    }
  | { readonly ok: false; readonly problem: string }

export function parseCatalog(text: string): CatalogResult {
  let document: unknown
  try {
    document = JSON.parse(text)
  } catch {
    return { ok: false, problem: "the catalogue is not JSON" }
  }
  if (typeof document !== "object" || document === null || Array.isArray(document)) {
    return { ok: false, problem: "the catalogue is not an object" }
  }
  const record = document as Record<string, unknown>
  if (record["schema"] !== CATALOG_SCHEMA) {
    return { ok: false, problem: `the catalogue is schema ${String(record["schema"])}, not ${CATALOG_SCHEMA}` }
  }
  const entries = record["packs"]
  if (!Array.isArray(entries)) {
    return { ok: false, problem: "the catalogue has no packs array" }
  }

  const packs: PackManifest[] = []
  const rejected: { index: number; problems: readonly string[] }[] = []
  const seen = new Set<string>()
  entries.forEach((entry, index) => {
    const parsed = parseManifest(entry)
    if (!parsed.ok) {
      rejected.push({ index, problems: parsed.problems })
      return
    }
    if (seen.has(parsed.manifest.id)) {
      // Two entries for one id means the catalogue cannot say which artefact an
      // id refers to, which is the one thing an id is for.
      rejected.push({ index, problems: [`duplicate pack id: ${parsed.manifest.id}`] })
      return
    }
    seen.add(parsed.manifest.id)
    packs.push(parsed.manifest)
  })

  return { ok: true, packs, rejected }
}
