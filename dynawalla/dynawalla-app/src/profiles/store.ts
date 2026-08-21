// Who the app is for right now.
//
// ADR-0018 designed multi-child profiles in from M2 and deferred the switcher
// to M9. The switcher is here instead, because the host has to have a screen
// that is *real*: a destination that renders the shape of a feature nobody can
// use is the empty recess with extra steps.
//
// It is device state, not learner state — the list of learners cannot live
// inside one learner's namespace — so it persists under `dynawalla.profiles`.
// Everything a learner does lives under `dynawalla.<id>.*` and is erased with
// them (`forgetProfile`).

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { DEFAULT_PROFILE_ID, deviceKey, forgetProfile, isProfileId } from "../app/profile.ts"
import { durable } from "../app/persist.ts"

export interface Profile {
  readonly id: string
  readonly name: string
}

export interface ProfilesState {
  readonly profiles: readonly Profile[]
  readonly currentId: string
  /** Adds an unnamed learner and switches to them. Naming is inline, after. */
  add: (name: string) => void
  select: (id: string) => void
  rename: (id: string, name: string) => void
  /** Erases the learner and everything in their namespace. Never the last one. */
  remove: (id: string) => void
}

/**
 * The next free `pN`.
 *
 * Derived from the ids in use rather than from the list length: removing the
 * second of three learners and adding one would otherwise mint an id that is
 * already on disk, and the new child would inherit the removed one's record.
 */
export function nextProfileId(taken: readonly Profile[]): string {
  let highest = 0
  for (const { id } of taken) {
    const n = /^p(\d+)$/.exec(id)
    if (n?.[1] !== undefined) highest = Math.max(highest, Number(n[1]))
  }
  return `p${String(highest + 1)}`
}

/** A stored name that is safe to draw: trimmed, bounded, never blank. */
export function cleanName(value: string, fallback: string): string {
  const trimmed = value.trim().slice(0, 40)
  return trimmed.length > 0 ? trimmed : fallback
}

const INITIAL: readonly Profile[] = [{ id: DEFAULT_PROFILE_ID, name: "" }]

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: INITIAL,
      currentId: DEFAULT_PROFILE_ID,

      add: (name) => {
        const id = nextProfileId(get().profiles)
        set((state) => ({
          profiles: [...state.profiles, { id, name }],
          currentId: id,
        }))
      },

      select: (id) => {
        if (get().profiles.some((profile) => profile.id === id)) set({ currentId: id })
      },

      rename: (id, name) =>
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === id ? { id, name: name.slice(0, 40) } : profile,
          ),
        })),

      remove: (id) => {
        const { profiles, currentId } = get()
        // The last learner is not removable. There is no state of this app with
        // nobody in it, and "erase everything" is the parent's control for that.
        if (profiles.length < 2 || !profiles.some((profile) => profile.id === id)) return
        forgetProfile(id)
        const left = profiles.filter((profile) => profile.id !== id)
        const first = left[0]
        set({
          profiles: left,
          currentId: currentId === id ? (first?.id ?? DEFAULT_PROFILE_ID) : currentId,
        })
      },
    }),
    {
      name: deviceKey("profiles"),
      version: 1,
      storage: durable,
      partialize: (state) => ({ profiles: state.profiles, currentId: state.currentId }),
      // A record written by an older build, a half-written JSON blob or a
      // hand-edited devtools session is untrusted input, and this is the one
      // key that decides which namespace every other store reads. A bad id
      // here does not lose a setting; it silently points a child at another
      // child's record, or at a key that throws in `storageKey`.
      merge: (persisted, current) => {
        const stored = persisted as Partial<ProfilesState> | undefined
        const profiles = (Array.isArray(stored?.profiles) ? stored.profiles : [])
          .filter(
            (profile): profile is Profile =>
              typeof profile?.id === "string" &&
              isProfileId(profile.id) &&
              typeof profile.name === "string",
          )
          .filter(
            (profile, index, all) => all.findIndex((other) => other.id === profile.id) === index,
          )
        const kept = profiles.length > 0 ? profiles : INITIAL
        const currentId =
          typeof stored?.currentId === "string" &&
          kept.some((profile) => profile.id === stored.currentId)
            ? stored.currentId
            : (kept[0]?.id ?? DEFAULT_PROFILE_ID)
        return { ...current, profiles: kept, currentId }
      },
    },
  ),
)
