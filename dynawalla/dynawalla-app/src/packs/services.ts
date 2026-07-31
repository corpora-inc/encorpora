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
  Capability,
  Item,
  NativeCapability,
  Settings,
  SoundCue,
  TransitionKind,
} from "../../../packs/sdk/src/index.ts"
import { CAPABILITY_IDS, isNativeBacked } from "../../../packs/sdk/src/index.ts"
import {
  createSafetyBus,
  type BusContext,
  type SafetyBus,
} from "../../../packs/shared/game-audio/index.ts"
import type { Soundscape } from "../app/soundscape.ts"
import type { HostServices } from "./bridge.ts"
import { fireHaptic, type HapticPorts } from "./haptics.ts"
import type { OrientationSource } from "./orientation.ts"
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
  readonly locale?: string  /** Override for tests; production measures the live tokens. */
  readonly safeArea?: { top: number; right: number; bottom: number; left: number }
  /**
   * The key the app is in, drawn at the doorway this pack was opened through.
   *
   * Required rather than optional-with-a-default, and required for the reason
   * `haptics` above is: a defaulted one would let "nobody pinned a soundscape"
   * compile, run, and sound exactly like a host that has none — which is the
   * state this change exists to leave. It also forces the value to be *pinned*
   * by the caller. `packSettings` runs again on every settings change, and if
   * it drew its own the app would change key when a parent moved the text size
   * slider, mid-question, under a child. See `app/soundscape.ts`.
   */
  readonly soundscape: Soundscape
}

/** The device facts a pack is handed. No name, no birthday, no identifier. */
/**
 * The device's safe-area insets, measured HERE because a pack cannot measure
 * them itself: it lives in an iframe sandboxed `allow-scripts` with no
 * `allow-same-origin`, and `env(safe-area-inset-*)` belongs to the top-level
 * browsing context, so a cross-origin child reads all four as 0.
 *
 * `env()` is not readable from JavaScript either, so this measures the tokens
 * the app already defines (`--safe-top` and friends in `design/tokens.css`) off
 * the document element.
 */
export function readSafeArea(): { top: number; right: number; bottom: number; left: number } {
  const zero = { top: 0, right: 0, bottom: 0, left: 0 }
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return zero
  const cs = getComputedStyle(document.documentElement)
  const px = (name: string): number => {
    const n = Number.parseFloat(cs.getPropertyValue(name))
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return {
    top: px("--safe-top"),
    right: px("--safe-right"),
    bottom: px("--safe-bottom"),
    left: px("--safe-left"),
  }
}

export function packSettings(input: SettingsInput): Settings {
  const { settings } = input
  // Two switches, and both have to be on. `sound` is the total one — a pack's
  // safety bus closes its gate after the ceiling, so off is silent rather than
  // quiet — and `music` chooses between the app's generative key and the fixed
  // cues a pack shipped with.
  //
  // The field is OMITTED rather than sent as `undefined`, which `exactOptional
  // PropertyTypes` insists on and which is also the honest wire: absent is what
  // a host too old to know about soundscapes sends, and `game-soundscape`
  // already reads absent as "keep your own sounds" and never as "go quiet".
  const music = settings.sound && settings.music
  return {
    locale: input.locale ?? "en",
    reducedMotion: settings.reduceMotion,
    quality: QUALITY[settings.quality],
    textScale: TEXT_SCALE[settings.textSize],
    colorScheme: resolveTheme(input.theme, input.systemPrefersDark),
    sound: settings.sound,
    haptics: settings.haptics,
    safeArea: input.safeArea ?? readSafeArea(),
    ...(music ? { soundscape: input.soundscape } : {}),
  }
}

/** Frequency and length for each named cue. The host owns the palette. */
const SOUND_CUE: Readonly<Record<SoundCue, { hz: number; ms: number }>> = {
  tick: { hz: 880, ms: 40 },
  seat: { hz: 520, ms: 70 },
  settle: { hz: 660, ms: 140 },
  refuse: { hz: 180, ms: 160 },
  arrive: { hz: 990, ms: 200 },
}

/**
 * The peak of a cue's envelope, linear.
 *
 * Named because a `GainNode`'s `gain` defaults to **1**, not to 0 — so the
 * three scheduling calls below are not decoration, they are the only thing
 * standing between a cue and full scale, and a test can now say which number
 * it expects to measure rather than reading the ramp back.
 */
export const CUE_PEAK = 0.12

/**
 * The slice of `AudioContext` the host's own cues touch.
 *
 * `BusContext` is what the shared safety bus needs; the oscillator and the two
 * resume members are what a cue needs on top of it. Written as a structural
 * type rather than `AudioContext` so the graph this builds can be rendered in a
 * test, which is the only way to *measure* the ceiling instead of asserting
 * that a line of code exists.
 */
export type CueContext = BusContext & {
  readonly state?: string
  resume?: () => unknown
  createOscillator: () => OscillatorNode
}

/** The one context and the one bus a session's cues share. */
export type CueAudio = { context: CueContext | null; bus: SafetyBus | null }

/** How a cue reaches a device. Production opens a real context; a test hands one in. */
export type CueOpener = () => CueContext | null

const openAudioContext: CueOpener = () => {
  const Ctor: typeof AudioContext | undefined =
    typeof AudioContext === "function" ? AudioContext : undefined
  if (!Ctor) return null
  return new Ctor()
}

/**
 * One short tone.
 *
 * The context is made on the first cue, not at launch: a WebView will not start
 * one before a gesture, and a suspended context created at mount is a context
 * that never plays anything. Every failure is swallowed *loudly* — a device
 * that refuses audio must not take a game down with it.
 *
 * ── The ceiling ─────────────────────────────────────────────────────────────
 *
 * This used to end `.connect(context.destination)`, which made the host the one
 * audio source in the whole product with no ceiling over it. Every pack's
 * output passes `createSafetyBus` — a limiter, then a `WaveShaperNode` whose
 * curve is flat at −1 dBFS, then the mute gate — and `game-audio/routing.test.ts`
 * fails any game that skips it. The host was exempt only because nobody had
 * written the rule down for it.
 *
 * Five short triangle tones at 0.12 were never going to hurt anybody, which is
 * why it went unnoticed. It stops being harmless the moment the host owns the
 * continuous ambient bed the soundscape design gives it (stage 3): a bed and a
 * cue summing on an output path that nothing limits is the MOSAIC incident with
 * the roles swapped, and a bed is by definition always playing.
 *
 * One bus per session, built on the first cue and reused. A bus per cue would
 * be five nodes and a `sound.ts` subscription leaked on every tap.
 */
export function playCue(audio: CueAudio, cue: SoundCue, open: CueOpener = openAudioContext): void {
  try {
    audio.context ??= open()
    const context = audio.context
    if (!context) return
    if (context.state === "suspended") void context.resume?.()
    audio.bus ??= createSafetyBus(context)
    const { hz, ms } = SOUND_CUE[cue]
    const now = context.currentTime
    const osc = context.createOscillator()
    const gain = context.createGain()
    osc.type = "triangle"
    osc.frequency.value = hz
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(CUE_PEAK, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + ms / 1000)
    // The bus, never `context.destination`. This is the line the comment above
    // is about, and `cues.test.ts` renders the graph it produces.
    osc.connect(gain).connect(audio.bus.input)
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
  /**
   * Where a haptic cue goes: the device's real back-ends in production
   * (`app/platform.ts`), a recorder in a test.
   *
   * Required rather than optional-with-a-default, deliberately. A defaulted
   * port would make "nobody wired the haptics" compile, run, and feel exactly
   * like a device with no motor — which is the bug this whole change exists to
   * fix, reintroduced one layer up. The compiler asks instead.
   */
  readonly haptics: HapticPorts
  /**
   * Where a tilt reading comes from.
   *
   * Required for the same reason `haptics` is: a defaulted source would make
   * "nobody wired the sensor" compile, run, and look exactly like a device that
   * has none. The compiler asks instead.
   */
  readonly orientation: OrientationSource
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
  const audio: CueAudio = { context: null, bus: null }
  const haptics = deps.haptics
  let current = deps.settings

  const keysOf = (packId: string): string[] =>
    Object.keys(store.getState().packs[packId] ?? {}).sort()

  const services: HostServices = {
    nextItem: (input) => Promise.resolve(items.next(input) as Item | null),
    judge: (input) => Promise.resolve(items.judge(input)),
    skip: (input) => {
      items.skip(input.itemId)
      return Promise.resolve()
    },
    reveal: (input) => Promise.resolve(items.reveal(input.itemId)),
    learnerSummary: () => Promise.resolve(items.summary()),

    /**
     * The settings toggle is enforced HERE, on `current`, and nowhere else.
     *
     * `current` rather than `deps.settings` because `push` replaces the
     * settings of a *running* pack without remounting it: a parent who turns
     * haptics off mid-game has turned them off, and reading the launch-time
     * value would keep buzzing until the child quit. There is no second gate
     * further down — `fireHaptic` has no opinion about settings, so this line
     * is the only thing standing between a cue and the motor, on either
     * platform, and it is what `services.test.ts` attacks.
     */
    haptic: (input) => {
      if (current.haptics) fireHaptic(input.cue, haptics)
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

    /**
     * The native-backed surface. One entry so far, and the shape is the point.
     *
     * Nothing here is gated on a setting: `settings.haptics` exists because a
     * buzz is something the app *does to* a child, and how a tablet is being
     * held is something the app reads at a game's request. There is a real
     * consent question here and it is answered one layer down — the permission
     * is asked for by the host on a user gesture, and a device that says no is
     * simply unavailable.
     */
    sensors: {
      orientation: (input) => deps.orientation.start({ emit: input.emit, lost: input.lost }),
    },

    /**
     * What this device can do, as opposed to what this build supports.
     *
     * A `Record` over `NativeCapability` rather than a list, so that adding a
     * native capability to the SDK's table **fails to compile here** until
     * somebody has decided how to detect it. A missing entry would otherwise
     * mean "unavailable forever", which degrades correctly and says nothing.
     */
    available: () => {
      const native: Readonly<Record<NativeCapability, boolean>> = {
        "sensors.orientation": deps.orientation.available,
      }
      const list: Capability[] = []
      for (const capability of CAPABILITY_IDS) {
        // Everything the host answers itself is available by definition: it is
        // this code, and this code is running.
        if (!isNativeBacked(capability)) {
          list.push(capability)
          continue
        }
        if (native[capability as NativeCapability]) list.push(capability)
      }
      return list
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
