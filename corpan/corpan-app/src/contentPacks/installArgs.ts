// Pure helper for turning a catalog-ish entry into the args `installPack()`
// needs. Centralized so every catalog-driven install call site forwards the
// SAME fields the same way — the phrase-pack batch-install path forwarded
// `expectedVersion` but silently dropped `sha256` until this was extracted
// (see InstallContext.tsx `installPackBatch`), which meant phrase packs
// downloaded via "Install all" / the batch drawer never got the native
// sha256 hard-fail-on-mismatch check that a single-pack install already got
// via `expectedHash`. Journey packs (`runtimeWiring.ts`) already thread
// `entry.sha256` through by hand; this gives the same guarantee to anything
// that routes through here.
//
// Deliberately generic over the entry shape (structural typing) so it works
// for `PhrasePackCatalogEntry`, `JourneyPackCatalogEntry`, etc. `CatalogGame`
// (catalog-v3 game/reader packs) has NO `sha256` field today — the
// catalog-v3 schema (`contentPacks/catalog.ts`) and its publisher
// (`web/pages/build.js`) never emit one, so `entry.sha256` is simply
// `undefined` for those and `expectedHash` comes back undefined too. That's
// a real pipeline gap (game/reader packs get no on-device hash enforcement),
// not something this helper can paper over — it only forwards what the
// catalog actually carries.

export type InstallableCatalogEntry = {
  manifestUrl?: string
  zipUrl?: string
  version?: string
  sha256?: string
}

export type CatalogInstallArgs = {
  manifestUrl: string
  expectedVersion?: string
  expectedHash?: string
}

/**
 * Builds the `{ manifestUrl, expectedVersion, expectedHash }` triple
 * `installPack()` needs from a catalog entry. Prefers `zipUrl` over
 * `manifestUrl` when both are present (zip installs are the only path that
 * can carry + enforce a sha256). Returns `null` when the entry has no
 * installable URL at all — callers should treat that as a "missing zipUrl"
 * style failure rather than calling `installPack()` with an empty string.
 */
export function buildCatalogInstallArgs(
  entry: InstallableCatalogEntry,
): CatalogInstallArgs | null {
  const manifestUrl = entry.zipUrl ?? entry.manifestUrl
  if (!manifestUrl) return null
  return {
    manifestUrl,
    expectedVersion: entry.version,
    expectedHash: entry.sha256,
  }
}
