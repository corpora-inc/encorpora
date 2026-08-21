// How the device is being held, turned into something a game can steer with.
//
// ── Why this is the host's job and not a pack's ──────────────────────────────
//
// A pack cannot read a sensor and must not be able to. It is mounted in an
// iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, so its
// origin is opaque, and with `allow=""`, which switches off every
// policy-controlled feature by name. `DeviceOrientationEvent` sits behind the
// `gyroscope` and `accelerometer` features whose default allowlist is `self`, so
// it is unreachable from a pack twice over — and on iOS a third time, because
// `DeviceOrientationEvent.requestPermission()` grants **per origin** and an
// opaque origin is not something a grant can be remembered against.
//
// The fix is not to widen the frame. `allow="gyroscope; accelerometer"` would
// hand motion sensors to all twenty-eight installed packs in order to serve the
// one that asked, and `frame.ts` says out loud what that line protects. So the
// host reads it, resolves it, and posts it — exactly as it already measures the
// safe-area insets a pack cannot see.
//
// ── What crosses the boundary ───────────────────────────────────────────────
//
// Two numbers in −1..1 and their angles. No compass heading, no magnetometer,
// no rotation rate, no acceleration, nothing that could be turned into a claim
// about where a child is or which way they are facing.
//
// ── The sign convention, and the one part that is not verified ──────────────
//
// A sample says **which way a marble sitting on the screen would roll**: `x` is
// +1 when it would roll toward the right-hand edge of the screen, `y` is +1 when
// it would roll toward the top. That is a physical statement rather than an axis
// name, so it survives being read by somebody who has never seen
// `DeviceOrientationEvent`.
//
// Getting there needs two facts. The first is settled: with the device flat and
// face up, positive `gamma` puts the right-hand edge down and positive `beta`
// lifts the top edge, so the downhill direction in the *device's* frame is
// `(gamma, −beta)`. The second is `SCREEN_ROTATION` below, which maps the
// device's frame onto the screen's, and it is read off the Screen Orientation
// specification rather than measured: **nobody here can run this on a phone.**
// It is therefore one table with four rows, each one a sentence, so that a
// correction from a device is a one-line change with a failing test to point at
// rather than an archaeology exercise. Portrait — `angle` 0 — is the row every
// claim in this file's tests rests on.

import type { Orientation } from "../../../packs/sdk/src/index.ts"
import {
  ORIENTATION_DEADZONE_DEG,
  ORIENTATION_FULL_TILT_DEG,
  ORIENTATION_MAX_HZ,
} from "../../../packs/sdk/src/index.ts"

/**
 * `-0` collapsed to `0`.
 *
 * Negation and `Math.round` both produce negative zero, and it leaks: it is not
 * `deepEqual` to zero, `1 / -0` is `-Infinity`, and a game normalising a
 * direction vector at rest gets a sign nobody wrote. Nothing negative-zero
 * leaves this module.
 */
const zeroed = (value: number): number => (value === 0 ? 0 : value)

/** One reading as the platform gives it. `null` is what a device with no sensor sends. */
export type RawOrientation = {
  /** Front-back tilt in degrees. Positive lifts the top edge. */
  readonly beta: number | null
  /** Left-right tilt in degrees. Positive puts the right-hand edge down. */
  readonly gamma: number | null
}

/**
 * Device frame → screen frame, by the screen's rotation from its natural one.
 *
 * `angle` is the screen's rotation from natural, and this table reads it as the
 * device having been turned **counter-clockwise** by that much — so at 90 the
 * device's top edge points to the viewer's left, the device's right-hand edge is
 * what the viewer now sees as up, and a vector `(u, v)` in device axes is
 * `(−v, u)` in screen axes.
 *
 * Anything that is not one of the four is treated as 0 rather than refused: a
 * platform reporting 45 is a platform whose orientation this host cannot
 * resolve, and a game that steers as though the device were upright is far
 * better than a game that stops steering.
 */
export const SCREEN_ROTATION: Readonly<
  Record<number, (u: number, v: number) => { x: number; y: number }>
> = {
  /** Natural. The device's axes and the screen's are the same axes. */
  0: (u, v) => ({ x: zeroed(u), y: zeroed(v) }),
  /** Turned a quarter counter-clockwise: the device's right edge is screen-up. */
  90: (u, v) => ({ x: zeroed(-v), y: zeroed(u) }),
  /** Upside down: both axes reverse. */
  180: (u, v) => ({ x: zeroed(-u), y: zeroed(-v) }),
  /** Turned a quarter clockwise: the device's left edge is screen-up. */
  270: (u, v) => ({ x: zeroed(v), y: zeroed(-u) }),
}

export type SamplerLimits = {
  /** Degrees from neutral that read as full deflection. */
  readonly fullTiltDeg: number
  /** Degrees from neutral that read as exactly zero. */
  readonly deadzoneDeg: number
  /** The shortest gap between two posted samples, in milliseconds. */
  readonly minIntervalMs: number
  /**
   * The smallest change in `x` or `y` worth a message.
   *
   * A five-thousandth of full deflection. Below it a device lying still on a
   * table would post at the throttle rate forever because a sensor's last digit
   * never settles, and every one of those messages is a structured clone and a
   * task in the pack's event loop.
   */
  readonly quantum: number
}

export const SAMPLER_LIMITS: SamplerLimits = {
  fullTiltDeg: ORIENTATION_FULL_TILT_DEG,
  deadzoneDeg: ORIENTATION_DEADZONE_DEG,
  minIntervalMs: Math.round(1000 / ORIENTATION_MAX_HZ),
  quantum: 0.005,
}

/**
 * Shortest signed difference between two angles, in degrees.
 *
 * `beta` runs −180..180 and wraps. Without this, a device held at 179° that
 * rocks two degrees reads as a 358° swing — full deflection the wrong way, once
 * per pass, which is the class of bug that only ever shows up in somebody's
 * hands.
 */
export function angleDelta(from: number, to: number): number {
  const difference = ((to - from + 540) % 360) - 180
  return difference
}

/**
 * Degrees of tilt → a steering value in −1..1.
 *
 * The dead zone is *subtracted* rather than skipped: at exactly the edge of it
 * the result is 0 and it grows continuously from there. A dead zone that clipped
 * instead would jump from 0 to 0.08 the instant a hand moved, which reads as the
 * control catching rather than as a control.
 */
export function shape(degrees: number, limits: SamplerLimits = SAMPLER_LIMITS): number {
  const magnitude = Math.abs(degrees)
  if (magnitude <= limits.deadzoneDeg) return 0
  const span = limits.fullTiltDeg - limits.deadzoneDeg
  if (span <= 0) return Math.sign(degrees)
  return Math.sign(degrees) * Math.min(1, (magnitude - limits.deadzoneDeg) / span)
}

export type Sampler = {
  /**
   * Fold one platform reading in. Returns the sample to post, or `null` when
   * there is nothing worth posting.
   */
  push(raw: RawOrientation, screenAngle: number, nowMs: number): Orientation | null
  /** Whether any usable reading has ever arrived. See the warm-up in the source. */
  readonly everRead: boolean
}

/**
 * The whole decision, as a pure function of readings.
 *
 * Pure so that the parts that are actually hard — the neutral pose, the wrap at
 * ±180, the re-zero when a tablet is turned, the throttle — are a Node test
 * rather than a person holding hardware. What is left for hardware is the sign
 * table above and whether the events arrive at all.
 */
export function createSampler(limits: SamplerLimits = SAMPLER_LIMITS): Sampler {
  /**
   * The pose the device was in when the stream opened, in the device's own
   * frame.
   *
   * Nobody plays with a tablet flat on a table. A child holds it at thirty or
   * forty degrees, so an absolute reading is pinned at full deflection before
   * the game starts. Held in the *device's* frame rather than the screen's, so
   * that the neutral is a physical pose and not a pair of numbers that means
   * something different after a rotation.
   */
  let neutral: { beta: number; gamma: number } | null = null
  let angle = 0
  let lastEmitMs = Number.NEGATIVE_INFINITY
  let lastX = 0
  let lastY = 0
  let lastDegrees = { x: 0, y: 0 }
  let emitted = false
  let everRead = false

  return {
    get everRead() {
      return everRead
    },
    push: (raw, screenAngle, nowMs) => {
      // A device with no sensor still fires the event, with nulls in it. That is
      // the single most likely way this capability is absent, and it is not an
      // error: it is why the source below has a warm-up rather than trusting
      // `typeof DeviceOrientationEvent`.
      if (raw.beta === null || raw.gamma === null) return null
      if (!Number.isFinite(raw.beta) || !Number.isFinite(raw.gamma)) return null
      everRead = true

      // Turning the tablet re-zeroes. The old neutral described "the top edge
      // raised forty degrees", and after a quarter turn that same physical pose
      // is forty degrees of roll — so keeping it would peg the steering the
      // moment a child rotated the device.
      if (screenAngle !== angle) {
        angle = screenAngle
        neutral = null
      }

      if (neutral === null) {
        neutral = { beta: raw.beta, gamma: raw.gamma }
      }

      const deltaGamma = angleDelta(neutral.gamma, raw.gamma)
      const deltaBeta = angleDelta(neutral.beta, raw.beta)
      // Downhill, in the device's frame: positive gamma puts the right edge
      // down, positive beta lifts the top edge.
      const rotate = SCREEN_ROTATION[angle] ?? SCREEN_ROTATION[0]
      // `?? SCREEN_ROTATION[0]` cannot actually be reached — 0 is a key of the
      // literal — but `noUncheckedIndexedAccess` is on and a non-null assertion
      // here would be the one place in this file that says "trust me".
      const screen = rotate ? rotate(deltaGamma, -deltaBeta) : { x: deltaGamma, y: -deltaBeta }

      const degrees = { x: zeroed(Math.round(screen.x)), y: zeroed(Math.round(screen.y)) }
      const x = zeroed(shape(screen.x, limits))
      const y = zeroed(shape(screen.y, limits))

      // The throttle. A sensor fires faster than any game can use and every
      // message is a structured clone and a task in the pack's event loop.
      if (emitted && nowMs - lastEmitMs < limits.minIntervalMs) return null
      // And a device held still posts nothing at all: the pack keeps the last
      // value it was given, which is what `seq` gaps in the contract are for.
      //
      // `degrees` is part of the comparison and not only the steering values,
      // because a game may be drawing a gauge rather than steering: inside the
      // dead zone x and y are both pinned at zero while the angle a child is
      // being asked to hold is still moving, and a gauge that froze there would
      // be the one surface where this reads as broken.
      const still =
        Math.abs(x - lastX) < limits.quantum &&
        Math.abs(y - lastY) < limits.quantum &&
        degrees.x === lastDegrees.x &&
        degrees.y === lastDegrees.y
      if (emitted && still) return null

      lastEmitMs = nowMs
      lastX = x
      lastY = y
      lastDegrees = degrees
      emitted = true
      return { x, y, degrees }
    },
  }
}

/* ─── the platform side ────────────────────────────────────────────────────── */

/**
 * The ways this build can reach an orientation reading, as a port.
 *
 * A port rather than a direct `addEventListener`, for the same reason
 * `haptics.ts` has one: every decision above and below it is then testable in
 * Node with no WebView, no device and no Tauri, and the day a native plugin
 * lands it is a second implementation of this interface rather than a rewrite of
 * the logic that uses it.
 *
 * **There is no native implementation yet, and that is the point of the shape.**
 * `platform.ts` builds the web one. A `tauri-plugin-orientation` reading
 * CoreMotion and Android's `SensorManager` plugs in here and changes nothing
 * else — see `docs/NATIVE_CAPABILITIES.md`.
 */
export type OrientationPorts = {
  /**
   * Whether this platform exposes a source at all.
   *
   * Deliberately weak: it is true in every desktop browser, including ones with
   * no sensor anywhere near them. It is the *static* answer that goes into
   * `Connect.available`, and the warm-up below is what settles the real one.
   */
  readonly present: boolean
  /**
   * Ask for permission, or `null` where none is needed.
   *
   * `null` on Android and on the desktop. A function on iOS, where
   * `DeviceOrientationEvent.requestPermission()` exists and must be called from
   * a real user gesture — which is why it is called from the launch tap in the
   * *host's* document and never from a pack. A pack has no user activation to
   * lend and no origin to hold the grant.
   */
  readonly requestPermission: (() => Promise<boolean>) | null
  /** Subscribe to raw readings. Returns the unsubscribe. */
  readonly subscribe: (onRaw: (raw: RawOrientation) => void) => () => void
  /** The screen's rotation from natural, in degrees. */
  readonly screenAngle: () => number
}

/** Injected in tests so a suite does not wait out the warm-up. */
export type SourceLimits = {
  /**
   * How long a started stream has to produce one usable reading.
   *
   * This is the real absence check. `typeof DeviceOrientationEvent !== "undefined"`
   * is true in every desktop browser and in WebViews with no sensor behind them;
   * what separates a device that can do this from one that cannot is whether a
   * reading with numbers in it ever turns up. A second and a half is far longer
   * than any sensor takes to produce its first sample and short enough that a
   * game asking at startup is not left waiting.
   */
  readonly warmupMs: number
}

export const SOURCE_LIMITS: SourceLimits = { warmupMs: 1_500 }

export type OrientationSource = {
  /** The static answer, for `Connect.available`. */
  readonly available: boolean
  /**
   * Start reading.
   *
   * Resolves to a stop function, or to `null` when this device cannot — a
   * missing source, or a permission somebody declined. `lost` is called at most
   * once, later, if the stream was started and then turned out to be feeding
   * nothing; the caller ends the stream `unavailable` on it.
   */
  start(input: {
    emit: (sample: Orientation) => void
    lost: () => void
  }): Promise<(() => void) | null>
}

export function createOrientationSource(
  ports: OrientationPorts,
  limits: SourceLimits = SOURCE_LIMITS,
  sampler: SamplerLimits = SAMPLER_LIMITS,
): OrientationSource {
  return {
    available: ports.present,
    start: async ({ emit, lost }) => {
      if (!ports.present) return null
      if (ports.requestPermission) {
        // A rejected prompt is a refusal, not a crash: on a platform where the
        // call throws because there was no user activation, the answer is the
        // same as "no" and the game plays without it.
        const granted = await ports.requestPermission().catch(() => false)
        if (!granted) return null
      }

      const fold = createSampler(sampler)
      let stopped = false
      let warmup: ReturnType<typeof setTimeout> | null = null

      const unsubscribe = ports.subscribe((raw) => {
        if (stopped) return
        const sample = fold.push(raw, ports.screenAngle(), Date.now())
        if (fold.everRead && warmup !== null) {
          clearTimeout(warmup)
          warmup = null
        }
        if (sample !== null) emit(sample)
      })

      const stop = () => {
        if (stopped) return
        stopped = true
        if (warmup !== null) {
          clearTimeout(warmup)
          warmup = null
        }
        unsubscribe()
      }

      warmup = setTimeout(() => {
        warmup = null
        if (stopped || fold.everRead) return
        // Started, subscribed, and nothing usable ever arrived. Stop the
        // subscription and say so: the caller ends the stream `unavailable`,
        // the pack's SDK writes one loud line for whoever is building it, and
        // the child sees a game that simply has no tilt control.
        stop()
        lost()
      }, limits.warmupMs)

      return stop
    },
  }
}
