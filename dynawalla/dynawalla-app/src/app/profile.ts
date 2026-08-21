// Profile-namespaced storage, and the whole of what this app writes to a disk.
//
// ADR-0018: all storage is namespaced by `profileId`, and the *switcher* is
// real (`src/profiles/`) rather than deferred — retrofitting a profile
// dimension onto keys that already hold a real child's record means migrating
// them on a family's tablet with no way to test the migration first.
//
// Two namespaces, and the difference is a product decision, not a convenience:
//
//   `dynawalla.<profileId>.<name>`  belongs to one learner. Removing that
//                                   learner erases every one of these keys.
//   `dynawalla.<name>`              belongs to the device — the theme, the
//                                   accessibility settings, the installed
//                                   packs. Which materials the screen is cut
//                                   from is a property of the tablet in the
//                                   room, not of the child holding it.
//
// Everything here is `localStorage`, which is synchronous at module load and
// therefore has no loading state to render. It is also absent under
// `node --test` and switchable off in a WebView, so every caller degrades to
// process lifetime rather than throwing at a child; `deviceStorage()` is the
// one place that decides which it is.

/** The profile every install starts with. Not special: a value in the namespace. */
export const DEFAULT_PROFILE_ID = "p1"

const PREFIX = "dynawalla"
const SEPARATOR = "."

/** A profile id safe to put in a storage key: no separator, non-empty. */
export function isProfileId(value: string): boolean {
  return value.length > 0 && !value.includes(SEPARATOR)
}

/**
 * `dynawalla.<profileId>.<name>`.
 *
 * The separator is banned inside a profile id, which is what stops `a.b` + `c`
 * and `a` + `b.c` from colliding on one key — the failure mode that would
 * silently merge two children's records and only show up on a family's tablet.
 */
export function storageKey(profileId: string, name: string): string {
  if (!isProfileId(profileId)) {
    throw new RangeError(`storageKey: bad profile id ${JSON.stringify(profileId)}`)
  }
  if (!isProfileId(name)) throw new RangeError(`storageKey: bad name ${JSON.stringify(name)}`)
  return [PREFIX, profileId, name].join(SEPARATOR)
}

/** `dynawalla.<name>` — one setting for the whole device. */
export function deviceKey(name: string): string {
  if (!isProfileId(name)) throw new RangeError(`deviceKey: bad name ${JSON.stringify(name)}`)
  return [PREFIX, name].join(SEPARATOR)
}

/**
 * Web storage, when there is any.
 *
 * A getter rather than a captured reference: Safari throws on the *property
 * access* in some private modes, and a module-level `const store = localStorage`
 * would take the whole app down at import time on a device that has never been
 * tested.
 */
function deviceStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/** Every key this app owns, in insertion order. */
export function ownedKeys(): string[] {
  const store = deviceStorage()
  if (!store) return []
  const out: string[] = []
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i)
    if (key !== null && key.startsWith(`${PREFIX}${SEPARATOR}`)) out.push(key)
  }
  return out
}

/**
 * How many bytes one key holds — UTF-16 code units, the unit browsers actually
 * charge against the quota, not the character count.
 */
function bytesOf(store: Storage, key: string): number {
  const value = store.getItem(key)
  return value === null ? 0 : (key.length + value.length) * 2
}

/** What this app is using on this device, in bytes. Real, not estimated. */
export function storageBytes(): number {
  const store = deviceStorage()
  if (!store) return 0
  return ownedKeys().reduce((total, key) => total + bytesOf(store, key), 0)
}

/** The same, per key, for the developer surface. */
export function storageBreakdown(): { key: string; bytes: number }[] {
  const store = deviceStorage()
  if (!store) return []
  return ownedKeys().map((key) => ({ key, bytes: bytesOf(store, key) }))
}

/**
 * Erase one learner: every key in their namespace, and nothing outside it.
 *
 * COPPA §312.10 is a retention-and-deletion obligation. It is cheap to honour
 * while everything stays on the device, and it is honoured *here* rather than
 * in the store that happens to be mounted, because a store the app has not
 * instantiated yet still has keys on disk.
 */
export function forgetProfile(profileId: string): void {
  const store = deviceStorage()
  if (!store) return
  const namespace = `${PREFIX}${SEPARATOR}${profileId}${SEPARATOR}`
  for (const key of ownedKeys()) {
    if (key.startsWith(namespace)) store.removeItem(key)
  }
}

/** Erase everything this app has ever written. The parent's own control. */
export function forgetEverything(): void {
  const store = deviceStorage()
  if (!store) return
  for (const key of ownedKeys()) store.removeItem(key)
}
