// `HostServices`, implemented. The other end of every method a pack can call.
//
// `bridge.ts` validates, gates and rate-limits; this is what it dispatches to
// once a message has earned the right to be dispatched. The split is the point:
// the boundary knows nothing about mathematics, and this knows nothing about
// message shapes.
//
// Everything is built per launch, from the stores, and holds no store: a
// session is a session, and a pack that is mounted twice gets two ledgers, two
// ladders and two sets of counters rather than one that remembers the last
// child who played.

import type {
  HapticCue,
  Item,
  Settings,
  SoundCue,
  TransitionKind,
} from "../../../packs/sdk/src/index.ts"
import type { HostServices } from "./bridge.ts"
import { createItemService, type ItemService } from "./items.ts"
import { report } from "./host.ts"
import { packStorageFor } from "./storage.ts"
import { resolveTheme, type ThemeMode } from "../app/theme.ts"
import type { Quality, Settings as HostSettings, TextSize } from "../settings/store.ts"

/** The type scale a pack multiplies its own base size by. */
const TEXT_SCALE: Readonly<Record<TextSize, number>> = {
  normal: 1,
  large: 1.15,
  largest: 1.3,
}

/**
 * The renderer tier.
 *
 * Set from the device's declared setting, never guessed from a frame rate: a
 * pack that measures its own fps and drops quality mid-run is a pack whose
 * appearance changes while a child is looking at it.
 */
const QUALITY: Readonly<Record<Quality, Settings["quality"]>> = {
  full: "high",
  plain: "low",
}

export type SettingsInput = {
  readonly settings: HostSettings
  readonly theme: ThemeMode
  readonly systemPrefersDark: boolean
  /** BCP-47. One locale until the i18n runtime lands; a pack must not guess. */
  readonly locale?: string
}

/** The device facts a pack is handed. No name, no birthday, no identifier. */
export function packSettings(input: SettingsInput): Settings {
  const { settings } = input
  return {
    locale: input.locale ?? "en",
    reducedMotion: settings.reduceMotion,
    quality: QUALITY[settings.quality],
    textScale: TEXT_SCALE[settings.textSize],
    colorScheme: resolveTheme(input.theme, input.systemPrefersDark),
    sound: settings.sound,
    haptics: settings.haptics,
  }
}

/**
 * The named haptics, as durations.
 *
 * Named rather than parameterised so a pack cannot invent a waveform: four
 * cues, four patterns, and a device with no vibration motor simply does
 * nothing. `navigator.vibrate` is a no-op on iOS Safari and on desktop, which
 * is correct — a missing motor is not an error a child should hear about.
 */
const HAPTIC_PATTERN: Readonly<Record<HapticCue, number | readonly number[]>> = {
  tick: 8,
  seat: 18,
  settle: [12, 40, 12],
  refuse: [40, 30, 60],
}

/** Frequency and length for each named cue. The host owns the palette. */
const SOUND_CUE: Readonly<Record<SoundCue, { hz: number; ms: number }>> = {
  tick: { hz: 880, ms: 40 },
  seat: { hz: 520, ms: 70 },
  settle: { hz: 660, ms: 140 },
  refuse: { hz: 180, ms: 160 },
  arrive: { hz: 990, ms: 200 },
}

type Audio = { context: AudioContext | null }

/**
 * One short tone.
 *
 * The context is made on the first cue, not at launch: a WebView will not start
 * one before a gesture, and a suspended context created at mount is a context
 * that never plays anything. Every failure is swallowed *loudly* — a device
 * that refuses audio must not take a game down with it.
 */
function playCue(audio: Audio, cue: SoundCue): void {
  try {
    const Ctor: typeof AudioContext | undefined =
      typeof AudioContext === "function" ? AudioContext : undefined
    if (!Ctor) return
    audio.context ??= new Ctor()
    const context = audio.context
    if (context.state === "suspended") void context.resume()
    const { hz, ms } = SOUND_CUE[cue]
    const now = context.currentTime
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.type = "triangle"
    osc.frequency.value = hz
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
    osc.connect(gain).connect(context.destination)
    osc.start(now)
    osc.stop(now + ms / 1000 + 0.02)
  } catch (error) {
    console.error("[packs] a sound cue failed", error)
  }
}

export type ServicesDeps = {
  readonly profileId: string
  /** The device facts at launch. `push` replaces them without a remount. */
  readonly settings: Settings
  readonly onProgress?: (fraction: number) => void
  readonly onEnd?: (reason: "finished" | "quit") => void
  readonly onMilestone?: (name: string) => void
  /**
   * The pack reached a natural stopping point. What happens next is the day
   * pass's business and is decided by the stage, not here: this module knows
   * nothing about entitlement, and the pack learns nothing about the answer.
   */
  readonly onTransition?: (kind: TransitionKind, label?: string) => void
}

export type LaunchServices = {
  readonly services: HostServices
  readonly items: ItemService
  /**
   * Replace the settings a running pack is told about.
   *
   * The mutation lives here rather than in the component because a session is
   * a ledger and a ladder: rebuilding the services to change a text size would
   * restart a child's run to change a colour.
   */
  push: (settings: Settings) => void
}

/**
 * Everything a mounted pack can reach, for one launch.
 *
 * Async because the interface is: the bridge awaits every dispatch. Nothing
 * here actually waits for anything, which is deliberate — a question a child is
 * waiting for must not be behind a promise chain that can stall.
 */
export function createServices(deps: ServicesDeps): LaunchServices {
  const items = createItemService({ profileId: deps.profileId, record: report })
  const store = packStorageFor(deps.profileId)
  const audio: Audio = { context: null }
  let current = deps.settings

  const keysOf = (packId: string): string[] =>
    Object.keys(store.getState().packs[packId] ?? {}).sort()

  const services: HostServices = {
    nextItem: (input) =>
      Promise.resolve(
        items.next(input.skillId === undefined ? { packId: input.packId } : input) as Item | null,
      ),
    judge: (input) => Promise.resolve(items.judge(input)),
    skip: (input) => {
      items.skip(input.itemId)
      return Promise.resolve()
    },
    reveal: (input) => Promise.resolve(items.reveal(input.itemId)),
    learnerSummary: () => Promise.resolve(items.summary()),

    haptic: (input) => {
      if (current.haptics && typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate(HAPTIC_PATTERN[input.cue] as number | number[])
        } catch (error) {
          console.error("[packs] a haptic cue failed", error)
        }
      }
      return Promise.resolve()
    },
    sound: (input) => {
      if (current.sound) playCue(audio, input.cue)
      return Promise.resolve()
    },
    milestone: (input) => {
      deps.onMilestone?.(input.name)
      return Promise.resolve()
    },

    storage: {
      get: (input) => Promise.resolve(store.getState().packs[input.packId]?.[input.key] ?? null),
      set: (input) => {
        store.getState().set(input.packId, input.key, input.value)
        return Promise.resolve()
      },
      remove: (input) => {
        store.getState().remove(input.packId, input.key)
        return Promise.resolve()
      },
      keys: (input) => Promise.resolve(keysOf(input.packId)),
    },

    progress: (input) => deps.onProgress?.(input.fraction),
    end: (input) => deps.onEnd?.(input.reason),
    transition: (input) => deps.onTransition?.(input.kind, input.label),
    settings: () => current,
  }

  return {
    services,
    items,
    push: (settings) => {
      current = settings
    },
  }
}
