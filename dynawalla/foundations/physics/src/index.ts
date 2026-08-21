// @dynawalla/physics — the physics foundation for the Dynawalla Bazaar.
//
// The whole surface a prototype author needs:
//
//   import { createWorld } from "@dynawalla/physics"
//
//   const w = await createWorld({ seed: 7 })       // tier auto-detected
//   w.ground()
//   const scale = w.balanceScale({ at: [0, 0] })
//   scale.put("left", 4); scale.put("right", 5)
//
//   function frame(dtSeconds: number) {
//     w.advance(dtSeconds)      // fixed step + interpolation, handled
//     draw(w.transforms, w.count)   // [x, y, cos, sin] per body
//   }
//
//   scale.compare()   // -1 | 0 | 1 — exact integers, never the beam angle
//
// Read ../README.md before changing a default. Every one of them is a measured
// number, and several of them are the difference between working and silently
// not working.

import { World, initPhysics, pin, type WorldOpts, type Vec2 } from "./world.ts"
import { balanceScale, type BalanceScaleOpts } from "./recipes/balanceScale.ts"
import { chain, gearTrain, lever, type ChainOpts, type GearTrainOpts, type LeverOpts } from "./recipes/mechanisms.ts"
import { ground, stack, dominoes, fallenFraction, type StackOpts, type DominoOpts } from "./recipes/piles.ts"
import { softBlob, liquid, volumeIn, type SoftBlobOpts, type LiquidOpts } from "./recipes/soft.ts"
import { launcher, type LauncherOpts } from "./aim.ts"
import { Recorder, replay, type Tape } from "./replay.ts"

export * from "./world.ts"
export * from "./tiers.ts"
export * from "./rng.ts"
export * from "./aim.ts"
export * from "./replay.ts"
export { fallenFraction, volumeIn }
export type { BalanceScale } from "./recipes/balanceScale.ts"
export type { Chain, GearTrain } from "./recipes/mechanisms.ts"
export type { SoftBlob } from "./recipes/soft.ts"

/** A world with every recipe bound to it, so authors never pass `world` twice. */
export interface Bazaar extends World {
  ground(halfWidth?: number, opts?: { friction?: number }): ReturnType<typeof ground>
  balanceScale(o?: BalanceScaleOpts): ReturnType<typeof balanceScale>
  chain(o: ChainOpts): ReturnType<typeof chain>
  gearTrain(o: GearTrainOpts): ReturnType<typeof gearTrain>
  lever(o: LeverOpts): ReturnType<typeof lever>
  stack(o: StackOpts): ReturnType<typeof stack>
  dominoes(o: DominoOpts): ReturnType<typeof dominoes>
  softBlob(o: SoftBlobOpts): ReturnType<typeof softBlob>
  liquid(o: LiquidOpts): ReturnType<typeof liquid>
  launcher(o: LauncherOpts): ReturnType<typeof launcher>
  pin(
    a: Parameters<typeof pin>[1],
    b: Parameters<typeof pin>[2],
    anchorA: Vec2,
    anchorB: Vec2,
    limit?: readonly [number, number],
  ): ReturnType<typeof pin>
  record(): Recorder
  replay(tape: Tape): Bazaar
}

/**
 * The one-liner. Loads the WASM once per process (idempotent under StrictMode),
 * picks a quality tier, and returns a world with every recipe already bound.
 */
export async function createWorld(opts: WorldOpts = {}): Promise<Bazaar> {
  await initPhysics()
  const w = new World({
    ...opts,
    deviceHints: opts.deviceHints ?? readDeviceHints(),
  }) as Bazaar

  w.ground = (halfWidth, o) => ground(w, halfWidth, o)
  w.balanceScale = (o) => balanceScale(w, o)
  w.chain = (o) => chain(w, o)
  w.gearTrain = (o) => gearTrain(w, o)
  w.lever = (o) => lever(w, o)
  w.stack = (o) => stack(w, o)
  w.dominoes = (o) => dominoes(w, o)
  w.softBlob = (o) => softBlob(w, o)
  w.liquid = (o) => liquid(w, o)
  w.launcher = (o) => launcher(w, o)
  w.pin = (a, b, anchorA, anchorB, limit) => pin(w, a, b, anchorA, anchorB, limit)
  w.record = () => new Recorder(w)
  w.replay = (tape) => replay(w, tape)
  return w
}

function readDeviceHints() {
  if (typeof navigator === "undefined") return {}
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    deviceMemoryGb: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    screenPx:
      typeof screen !== "undefined"
        ? Math.min(screen.width, screen.height) * (globalThis.devicePixelRatio ?? 1)
        : undefined,
  }
}
