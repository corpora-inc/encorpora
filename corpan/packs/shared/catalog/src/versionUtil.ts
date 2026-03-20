/** Simple semver comparison for narration pack versions.
 *  Handles x.y.z strings — returns positive if a > b, negative if a < b, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (na !== nb) return na - nb
  }
  return 0
}

/** True when the catalog version is strictly newer than the installed version. */
export function hasUpdate(catalogVersion: string, installedVersion: string): boolean {
  return compareVersions(catalogVersion, installedVersion) > 0
}
