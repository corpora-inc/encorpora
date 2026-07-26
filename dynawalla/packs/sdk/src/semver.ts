// Semantic versions, compared exactly.
//
// A pack declares the host versions it runs on and the SDK it was built
// against, and the host refuses to load one that does not fit. That refusal is
// the only thing standing between a two-year-old installed pack and a host that
// has since changed the contract under it, so the comparison has to be right
// rather than approximately right — `"0.10.0" < "0.9.0"` is what a string
// compare says, and it is the exact case that will happen first.
//
// Ranges are deliberately not npm ranges. A pack states a minimum host
// (inclusive) and an optional exclusive ceiling. There is no `^`, no `~`, no
// union, no `||`: every one of those is a small parser with its own edge cases,
// and none of them expresses anything this system needs.

export type Semver = {
  readonly major: number
  readonly minor: number
  readonly patch: number
  /** Dot-separated identifiers after `-`. Numeric ones compare as numbers. */
  readonly prerelease: readonly (string | number)[]
}

/** `major.minor.patch` with an optional `-prerelease` and an ignored `+build`. */
const PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:[0-9a-zA-Z-]+)(?:\.[0-9a-zA-Z-]+)*))?(?:\+[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*)?$/

/** `null` rather than a throw: every caller here is validating input. */
export function parseSemver(input: string): Semver | null {
  const match = PATTERN.exec(input)
  if (!match) return null
  const prerelease = (match[4] ?? "")
    .split(".")
    .filter((part) => part.length > 0)
    .map((part) => (/^(0|[1-9]\d*)$/.test(part) ? Number(part) : part))
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease,
  }
}

export function isSemver(input: string): boolean {
  return PATTERN.test(input)
}

const sign = (a: number, b: number): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0)

/** SemVer §11 precedence. A prerelease sorts BELOW its own release. */
export function compareSemver(a: Semver, b: Semver): -1 | 0 | 1 {
  if (a.major !== b.major) return sign(a.major, b.major)
  if (a.minor !== b.minor) return sign(a.minor, b.minor)
  if (a.patch !== b.patch) return sign(a.patch, b.patch)

  // 1.0.0-alpha < 1.0.0, and no prerelease on either side is equality.
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0
  if (a.prerelease.length === 0) return 1
  if (b.prerelease.length === 0) return -1

  const length = Math.max(a.prerelease.length, b.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    const left = a.prerelease[index]
    const right = b.prerelease[index]
    // A shorter set of identifiers sorts lower when all preceding ones match.
    if (left === undefined) return -1
    if (right === undefined) return 1
    if (left === right) continue
    const leftNumeric = typeof left === "number"
    const rightNumeric = typeof right === "number"
    if (leftNumeric && rightNumeric) return sign(left, right)
    // Numeric identifiers always have lower precedence than alphanumeric ones.
    if (leftNumeric) return -1
    if (rightNumeric) return 1
    return String(left) < String(right) ? -1 : 1
  }
  return 0
}

/** `-1 | 0 | 1`, or `null` if either side is not a version. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const left = parseSemver(a)
  const right = parseSemver(b)
  if (!left || !right) return null
  return compareSemver(left, right)
}

/** `min` inclusive, `max` exclusive — the only range shape a manifest may state. */
export type HostRange = { readonly min: string; readonly max?: string }

/**
 * Whether `version` sits inside `range`.
 *
 * Unparseable input is outside every range. A pack that cannot say what it
 * needs does not get to run; that is the safe direction, and it is checked by
 * the manifest validator long before this is reached.
 */
export function satisfies(version: string, range: HostRange): boolean {
  const value = parseSemver(version)
  const min = parseSemver(range.min)
  if (!value || !min) return false
  if (compareSemver(value, min) < 0) return false
  if (range.max === undefined) return true
  const max = parseSemver(range.max)
  if (!max) return false
  return compareSemver(value, max) < 0
}

/**
 * Whether a pack built against SDK `built` may talk to a host implementing
 * SDK `host`.
 *
 * Same major, and the host's minor is not behind the pack's: a pack built
 * against 1.3 uses methods 1.3 added, which a 1.2 host does not answer. The
 * reverse — a 1.1 pack on a 1.4 host — is exactly what additive minor versions
 * are for and is allowed. Major 0 is treated as strictly as any other major
 * rather than as "anything goes", because this contract ships to devices and
 * an installed pack outlives the release that built it.
 */
export function sdkCompatible(built: string, host: string): boolean {
  const packSdk = parseSemver(built)
  const hostSdk = parseSemver(host)
  if (!packSdk || !hostSdk) return false
  if (packSdk.major !== hostSdk.major) return false
  if (packSdk.minor > hostSdk.minor) return false
  return true
}
