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
import type { BeatloungeDoc, Id, ParamTarget } from "../model/document"
import type { LiveVoiceHandle } from "./audioFacade"
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
  previewTrack(trackId: Id, velocity?: number, pitch?: number): void
  /** Open a CONTINUOUS live-performance voice on a track's instrument (one
   *  finger of a multitouch instrument surface). `midi` is fractional. Returns
   *  a handle to glide pitch + release, or undefined if the engine can't play
   *  live. Live performance — never writes the document. */
  playLiveVoice(trackId: Id, midi: number, velocity?: number): LiveVoiceHandle | undefined
  /** Drive a param in REAL TIME (no document write) for live performance —
   *  ribbons / XY pads. e.g. applyParam({scope:"instrument",trackId,
   *  param:"pitchOffset"}, semis) bends a phrase track as the finger moves. */
  applyParam(target: ParamTarget, value: number): void
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
  tileAspect?: "square" | "wide" | "tall" | "full"
  /**
   * When true the Stage tile is a LIVE, interactive widget (a mini control
   * surface) rather than a tap-to-open summary. The shell renders it in a plain
   * container — NOT wrapped in the tap-to-open `<button>` — so the widget's own
   * controls work without a nested button or a tap bubbling to enterImmersive.
   * The shell still provides a small, consistent corner "expand" control that
   * opens the module's full page (`host.enterImmersive(id)`). Omitted/false ⇒
   * today's behaviour exactly (button-wrapped, whole-tile tap opens immersive).
   */
  tileInteractive?: boolean
  /**
   * For an interactive tile: the module the shell's corner "expand" control
   * opens, when it is NOT this module's own immersive page. e.g. the Ribbon home
   * widget expands to the Instruments page (where its voice is managed), not a
   * standalone ribbon page. Omitted ⇒ expand opens this module (`id`).
   */
  tileExpandTo?: ModuleId
  /**
   * For an interactive tile that fully OWNS its open affordance (e.g. the
   * Harmony widget, whose control opens a home POPOVER rather than the immersive
   * page): suppress the shell's corner expand control. Default (omitted/false) ⇒
   * the shell adds its consistent expand. Has no effect on non-interactive tiles.
   */
  tileOwnsExpand?: boolean
  /**
   * When true the module is NOT laid out as a Stage tile — it stays fully
   * registered (its `actions` are indexed by the command bus / LLM, and it can
   * be opened with `host.enterImmersive(id)`) but has no home-screen presence.
   * For modules whose ENTRY lives in the nav / command surface rather than on
   * the Stage (e.g. Scenes, reached from the Dock-Rail). Omitted/false ⇒ today's
   * behaviour (the module gets a Stage tile).
   */
  hideOnStage?: boolean
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
