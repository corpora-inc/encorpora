/**
 * beatlounge — the UI module contract (FROZEN, extend additively).
 *
 * A `BeatloungeModule` is the universal widget abstraction. It declares an
 * identity, a compact "tile" view for the calm Stage, an immersive
 * full-screen view, and a registry of named ACTIONS (some stochastic) that
 * the LLM command bus indexes across all modules into one tool surface.
 *
 * This is BOTH how the product scales to infinite widgets AND how widgets
 * expose en-masse mutations to natural language. Adding a synth/effect/browser
 * is "register a module + drop a tile" — the shell never changes.
 */

import type { Command } from "../model/command"
import type { CommandBus } from "../model/commandBus"
import type { BeatloungeDoc, Id } from "../model/document"
import type { HostApi } from "../sdk/types"

export type ModuleId = string

export type ModuleKind =
  | "sequencer"
  | "instrument"
  | "effect"
  | "mixer"
  | "browser"
  | "arrangement"
  | "utility"

export type FormFactor = "phone" | "tablet" | "desktop"

export type ImmersiveMode = "full" | "sheet" | "inspector"

// ----------------------------------------------------------- action schema
export interface ParamSchema {
  type: "number" | "int" | "boolean" | "enum" | "string" | "track" | "step"
  min?: number
  max?: number
  step?: number
  default?: unknown
  options?: readonly string[]
  unit?: string
  /** Natural-language hint for the LLM + tooltip. */
  describe: string
}

/** Result of running an action: the commands to apply + a human summary. */
export interface ActionResult {
  /** Commands the bus applies atomically (wrapped in one batch / undo step). */
  commands: Command[]
  /** Human-readable summary for the toast/undo affordance, e.g. "+6 hi-hats". */
  summary: string
}

export interface ActionContext {
  /** Read-only current document. */
  doc: BeatloungeDoc
  /** The module instance this action targets, if any (tile/immersive bound). */
  targetTrackId?: Id
  /** Deterministic RNG seeded by the command bus (reroll = fresh seed). */
  rng: () => number
}

/** A named, LLM-callable mutation a module exposes. */
export interface ModuleAction {
  /** Stable id within the module, e.g. "addHats", "darken", "humanize". */
  name: string
  /** One line the LLM (and tooltip) reads. */
  describe: string
  params: Record<string, ParamSchema>
  /** True ⇒ uses randomness; shell shows reroll + previews before commit. */
  stochastic?: boolean
  /** "tweak" autocommits; "mutate" previews; "destructive" confirms. */
  impact: "tweak" | "mutate" | "destructive"
  /** Pure-ish: returns the commands to apply. MUST be deterministic given
   *  ctx.rng so reroll is reproducible and undo is exact. */
  run(ctx: ActionContext, params: Record<string, unknown>): ActionResult
}

// ----------------------------------------------------------- host surface
/** What a mounted module receives — the shell + engine seams it may use. */
export interface BeatloungeHost {
  /** The Corpán host API (TTS, corpus, LLM, synthesizeToBuffer). */
  readonly hostApi: HostApi
  /** The one write path. */
  readonly bus: CommandBus
  /** The live AudioContext (shared across the pack). */
  audioContext(): AudioContext
  /** Trigger a one-shot preview of a track's instrument (click-to-hear). */
  previewTrack(trackId: Id, velocity?: number): void
  /** Enter immersive for a module; returns a dispose to exit (one owner). */
  enterImmersive(id: ModuleId): () => void
  /** Current form factor (re-evaluated on resize). */
  form(): FormFactor
  /** Surface a transient, dignified message (noisy-not-silent). */
  toast(message: string, opts?: { undo?: () => void }): void
}

// ----------------------------------------------------------- mount
export interface ModuleMount {
  /** Host-accepted node to render into — NEVER document.body. */
  container: HTMLElement
  surface: "tile" | "immersive"
  form: FormFactor
  host: BeatloungeHost
  /** The track this module instance is bound to, if it is track-scoped. */
  trackId?: Id
}

export interface ModuleInstance {
  /** Tear down: remove listeners, free nodes, revoke blob URLs. */
  unmount(): void
  /** Re-render the compact tile (shell calls on doc change). */
  refreshTile?(): void
}

/** The module definition each engineer ships. */
export interface BeatloungeModule {
  id: ModuleId
  kind: ModuleKind
  title: string
  /** Inline-SVG glyph id (no emoji). */
  glyph: string
  immersive: ImmersiveMode
  tileAspect?: "square" | "wide" | "tall"
  mount(mount: ModuleMount): ModuleInstance
  /** LLM-callable action registry; the command bus indexes all of them. */
  actions: ReadonlyArray<ModuleAction>
}

/** A registry the shell + command bus read. */
export interface ModuleRegistry {
  register(module: BeatloungeModule): void
  get(id: ModuleId): BeatloungeModule | undefined
  all(): BeatloungeModule[]
  /** Flatten every module's actions for the LLM tool index. */
  allActions(): { moduleId: ModuleId; action: ModuleAction }[]
}
