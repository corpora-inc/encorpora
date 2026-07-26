// Replay: record what the player did, not what the physics produced.
//
// This is the part of determinism that actually matters for a maths product.
// "Rapier is deterministic" is a claim about one binary on one machine; it is
// NOT a promise that a Galaxy Tab and an iPad will produce identical floats,
// and treating it as one is how a product ends up with replays that desync.
//
// What is safe to rely on, and what this module is built on:
//
//   SAME BUILD + SAME PLATFORM + SAME INPUTS + SAME ORDER => same result.
//
// Measured, in this repo: 20 engine x scene cells run three times each in one
// V8 process are bit-identical every time (`bench/run-node.mjs --repeat 3`), and
// the same scenes are bit-identical between Node/V8 and Chrome/V8. Rapier also
// publishes `@dimforge/rapier2d-deterministic`, whose only difference is that
// its transcendental functions come from a portable libm instead of the
// platform's, which is what makes CROSS-platform determinism possible at all.
//
// What a tape stores is therefore COMMANDS, never positions. A tape is tiny, it
// survives an engine upgrade with a version bump rather than a corruption, and
// replaying it re-derives the physics rather than trusting a recorded float.
//
// The one hard rule: every command must be addressed by STEP INDEX, never by
// wall-clock time. Wall clock is exactly the non-determinism we removed by
// fixing the timestep.

import type { World } from "./world.ts"

export interface Command {
  /** The fixed step this command takes effect on. */
  step: number
  op: string
  args: readonly (number | string | boolean)[]
}

export interface Tape {
  version: 1
  seed: number
  /** The engine build this was recorded against. A mismatch is a warning. */
  engine: string
  commands: Command[]
  /** Quantised state hash at `steps`, so a replay can assert it landed. */
  finalHash?: string
  steps: number
}

export type CommandHandler = (w: World, args: Command["args"]) => void

const handlers = new Map<string, CommandHandler>()

/** Register a replayable command. The op name is part of the tape format. */
export function defineCommand(op: string, fn: CommandHandler): void {
  handlers.set(op, fn)
}

export class Recorder {
  private commands: Command[] = []
  private startStep: number
  private w: World

  // Not a `private w: World` parameter property: Node's `--experimental-strip-types`
  // is strip-ONLY, so any TypeScript syntax that has to EMIT code — parameter
  // properties, enums, namespaces, decorators — is a hard error at load. The
  // whole repo runs tests that way, so the constraint applies to every file
  // here, not just this one.
  constructor(w: World) {
    this.w = w
    this.startStep = w.stepIndex
  }

  /**
   * Record a command AND apply it. Recording and applying must be the same call
   * — a codebase where they are two calls is a codebase where one of them gets
   * forgotten, and the tape silently diverges from the session it claims to be.
   */
  do(op: string, ...args: Command["args"]): void {
    const fn = handlers.get(op)
    if (!fn) throw new Error(`replay: unknown command "${op}" — call defineCommand first`)
    this.commands.push({ step: this.w.stepIndex - this.startStep, op, args })
    fn(this.w, args)
  }

  stop(): Tape {
    return {
      version: 1,
      seed: this.w.rng.seed,
      engine: ENGINE_ID,
      commands: this.commands,
      steps: this.w.stepIndex - this.startStep,
      finalHash: this.w.hash(),
    }
  }
}

export const ENGINE_ID = "rapier2d-compat@0.19.3"

/**
 * Replay a tape into a fresh world. The world must have been built with the
 * tape's seed and the same scene construction; `createWorld({ seed: tape.seed })`
 * plus the same recipe calls is the contract.
 */
export function replay<W extends World>(w: W, tape: Tape): W {
  if (tape.engine !== ENGINE_ID) {
    // Not fatal. A tape from another build is still worth replaying — it just
    // cannot be asserted bit-for-bit, so the caller is told rather than blocked.
    console.warn(`replay: tape recorded against ${tape.engine}, replaying on ${ENGINE_ID}`)
  }
  const byStep = new Map<number, Command[]>()
  for (const c of tape.commands) {
    const list = byStep.get(c.step) ?? []
    list.push(c)
    byStep.set(c.step, list)
  }
  for (let s = 0; s <= tape.steps; s++) {
    for (const c of byStep.get(s) ?? []) {
      handlers.get(c.op)?.(w, c.args)
    }
    if (s < tape.steps) w.stepExact(1)
  }
  return w
}

/** True if a replay landed where the tape says it should have. */
export function verify(w: World, tape: Tape): boolean {
  return tape.finalHash === undefined || w.hash() === tape.finalHash
}
