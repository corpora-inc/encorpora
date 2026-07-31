// The settings, and what they actually change.
//
// Five of these are device facts, not preferences about the host's own screens
// — the host draws almost nothing. They are read by whatever is mounted in the
// pack runtime, through `packs/host.ts`, which is why they are a store and not
// five booleans threaded through props. A pack that ignores them is a pack with
// a bug; a host that never carried them would be a host with a missing feature
// nobody could see.
//
// Two of them also act on this document immediately, so they are verifiable
// without a pack: `reduceMotion` collapses the motion tokens and `textSize`
// scales the root type. Both are applied at module load by a subscription, the
// same way the theme is (ADR-0005) — an effect runs after the first paint,
// which is a visible jump at every launch.
//
// Device scoped, not per learner: a tablet with a text-size setting has it
// because of the person holding it and the light in the room, and a child
// should not have to set it again because they tapped a different name.

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { deviceKey } from "../app/profile.ts"
import { durable } from "../app/persist.ts"

export type TextSize = "normal" | "large" | "largest"
export type Quality = "full" | "plain"

export interface Settings {
  readonly sound: boolean
  /**
   * Whether the app hands a pack the generative key it is in.
   *
   * A second switch rather than a second meaning for `sound`, because they are
   * different questions a parent can reasonably answer differently: `sound` is
   * "may this tablet make noise at all" and is total — it closes the gate after
   * the ceiling in every pack's safety bus, so off means silent. This is "may
   * the noise be music", and off means a pack falls back to the fixed cues it
   * shipped with. **Off is not quiet.** A host too old to send a soundscape
   * publishes `undefined` and that already means "keep your own sounds"; this
   * switch reuses that path exactly rather than inventing a quieter one.
   */
  readonly music: boolean
  readonly haptics: boolean
  readonly reduceMotion: boolean
  readonly textSize: TextSize
  readonly quality: Quality
  /** Unlocks the diagnostics rows in the parent area. Off on a child's tablet. */
  readonly developer: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  haptics: true,
  reduceMotion: false,
  textSize: "normal",
  quality: "full",
  developer: false,
}

export interface SettingsState extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const TEXT_SIZES: readonly TextSize[] = ["normal", "large", "largest"]
export const QUALITIES: readonly Quality[] = ["full", "plain"]

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
    }),
    {
      name: deviceKey("settings"),
      version: 1,
      storage: durable,
      partialize: ({ sound, music, haptics, reduceMotion, textSize, quality, developer }) => ({
        sound,
        music,
        haptics,
        reduceMotion,
        textSize,
        quality,
        developer,
      }),
      // An unknown `textSize` from a future build selects no scale at all and
      // the type stays at 100% with the control showing nothing chosen — a
      // dead-looking screen from a value that is merely newer than this code.
      merge: (persisted, current) => {
        const stored = persisted as Partial<Settings> | undefined
        const flag = (value: unknown, fallback: boolean) =>
          typeof value === "boolean" ? value : fallback
        return {
          ...current,
          sound: flag(stored?.sound, DEFAULT_SETTINGS.sound),
          // A tablet that was set up before this switch existed has no stored
          // value, and the default is on: the soundscape is the feature, and a
          // parent who wants the old fixed cues can say so.
          music: flag(stored?.music, DEFAULT_SETTINGS.music),
          haptics: flag(stored?.haptics, DEFAULT_SETTINGS.haptics),
          reduceMotion: flag(stored?.reduceMotion, DEFAULT_SETTINGS.reduceMotion),
          developer: flag(stored?.developer, DEFAULT_SETTINGS.developer),
          textSize: TEXT_SIZES.find((size) => size === stored?.textSize) ?? "normal",
          quality: QUALITIES.find((tier) => tier === stored?.quality) ?? "full",
        }
      },
    },
  ),
)

/** What the document is told. Pure, so the test does not need a DOM. */
export function documentFlags(settings: Settings): { textSize: string; motion: string | null } {
  return {
    textSize: settings.textSize,
    // `null` removes the attribute rather than writing "full": the OS-level
    // `prefers-reduced-motion` still applies underneath, and an attribute
    // saying "motion is fine" would be a second, contradicting, source of it.
    motion: settings.reduceMotion ? "reduced" : null,
  }
}

if (typeof document !== "undefined") {
  const root = document.documentElement

  const apply = () => {
    const { textSize, motion } = documentFlags(useSettings.getState())
    root.dataset["text"] = textSize
    if (motion === null) delete root.dataset["motion"]
    else root.dataset["motion"] = motion
  }

  apply()
  useSettings.subscribe(apply)
}
