// Profile-namespaced storage keys.
//
// ADR-0018: all storage is namespaced by `profileId` from M2, in the same PR that
// first persists anything — which is this one. The profile *switcher* is M9; the
// data model has to be right now, because retrofitting a profile dimension onto
// keys that already hold a real child's progress means migrating them on a device
// with no way to test the migration first.
//
// One profile exists today. It is `DEFAULT_PROFILE_ID` and it is written into
// every key, so the second profile costs a UI and nothing else.
//
// It lives in `src/app/` rather than beside the work surface because two
// surfaces now persist under it — the ladder position and the construction —
// and `Q-05` forbids `src/world/` from importing anything in `src/work/`. The
// alternative was a second copy of the key convention, on the keys that hold a
// real child's progress, which is precisely the collision this file exists to
// make impossible.

/** The one profile M2 creates. Not special: it is a value in the namespace. */
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
 * and `a` + `b.c` from colliding on one key — the failure mode that would silently
 * merge two children's progress and only show up on a family's tablet.
 */
export function storageKey(profileId: string, name: string): string {
  if (!isProfileId(profileId)) throw new RangeError(`storageKey: bad profile id ${JSON.stringify(profileId)}`)
  if (!isProfileId(name)) throw new RangeError(`storageKey: bad name ${JSON.stringify(name)}`)
  return [PREFIX, profileId, name].join(SEPARATOR)
}
