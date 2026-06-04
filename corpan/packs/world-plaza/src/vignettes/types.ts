/**
 * Vignettes — the enterable sub-experience SEAM (the keystone of the v2 roster).
 *
 * A Vignette is a focused, fullscreen, immersive little scene the player ENTERS
 * from the open city (an interior like a café/bank, a vehicle like a taxi/bus, a
 * transit hop like the subway) and EXITS back to the world. The framework is
 * deliberately general: EVERY future arbitrary scene (a real café, a historical
 * bank, a fantasy tavern) implements this SAME seam, so "a new scene" is just
 * "another Vignette" — no new orchestration.
 *
 * The contract is two methods + a result:
 *
 *   interface Vignette { enter(ctx): Promise<VignetteResult>; dispose(): void }
 *
 * A Vignette receives a {@link VignetteContext} that injects the REAL game
 * services (TTS, the Qwen3 NPC runtime, the wallet, challenges, the icon
 * renderer, i18n) as THIN adapters — so a vignette reuses every shipped system
 * WITHOUT importing the orchestrator or any sibling slice's internals. The
 * orchestrator binds those adapters to the live implementations at integration
 * (see `docs/VIGNETTES.md` § Integration). This mirrors the runtime-spine
 * discipline in `contracts/runtime.ts`: functions injected, never imported.
 *
 * NOTHING in this module touches the DOM, the world, or another slice — it is
 * pure TypeScript types + the host factory's surface. The taxi (`taxi.ts`) is
 * the reference implementation that sets the premium bar.
 */

import type { LearnerPair, Scene } from "@world-plaza/contracts"
import type { ChallengeContext, ChallengeResultPlus } from "@world-plaza/contracts"
import type { IconRenderer } from "../contracts/runtime"
import type { ChromeState } from "../shell/chromeVisibility"

/* ================================================================== *
 * Injected SERVICE adapters (thin, adapter-friendly).
 *
 * Each is a minimal FUNCTION surface a vignette codes against — never a
 * concrete store/runtime. The orchestrator binds them to the real
 * implementations (npcRuntime.open, runChallenge, inventory(), iconRenderer,
 * hostApi.speak, the i18n `t`) at integration. Keeping them thin means the
 * adapter glue is a few lines and the whole library still runs standalone
 * against trivial stubs.
 * ================================================================== */

/**
 * A handle to one live NPC conversation mounted INSIDE the vignette's own root
 * (the taxi driver, the bank teller…). It is the small slice of the npcRuntime
 * `NpcDialogueHandle` a vignette needs — send a line, close, dispose — so the
 * vignette never imports the runtime's full type.
 */
export interface VignetteNpcHandle {
  /** Programmatically send a user line (same path as the player typing). */
  send(text: string): void
  /** Close the conversation (fires the runtime's onClose). */
  close(): void
  /** Tear down + cancel any in-flight stream + release the model to the broker. */
  dispose(): void
}

/**
 * How a vignette opens an NPC. The orchestrator adapts this to `npcRuntime.open`
 * (composing role × scene × quest × pair, keeping Qwen3 hot). The vignette
 * supplies the MOUNT element (somewhere inside its own scene framing — e.g. the
 * taxi's lower dialogue tray), a persona seed, the TTS voice hint, and gets back
 * a thin handle. `onClose` lets the vignette react when the player dismisses the
 * chat (it does NOT exit the vignette — the door/Exit affordance does that).
 */
export interface OpenNpcArgs {
  /** The element the dialogue UI mounts INTO (inside the vignette root, NOT body). */
  container: HTMLElement
  /** A stable id for this in-vignette NPC (drives the sticky per-NPC voice). */
  npcId: string
  /** Display name for the dialogue header ("the taxi driver", "Marisol"). */
  npcName: string
  /**
   * The persona seed the orchestrator weaves into the system prompt: a short tone
   * + quirks describing WHO this NPC is and the frame they're in (driving a cab,
   * tending a till). The orchestrator maps it onto a synthetic `NpcRole`.
   */
  persona: { tone: string; quirks: string[] }
  /**
   * Deterministic scripted lines used when no local LLM is installed — the NPC
   * ALWAYS works, just less dynamically (mirrors `NpcRole.scriptedFallback`).
   */
  scriptedFallback: string[]
  /** TTS voice code hint; falls back to the scene/target inside the runtime. */
  voiceCode?: string
  /** Localized opening reply chips shown to the player. */
  starterChips?: string[]
  /** Fired once when the conversation panel closes (X / ESC / end-intent). */
  onClose?: () => void
}

/** Open an NPC conversation; returns a thin handle. */
export type OpenNpcFn = (args: OpenNpcArgs) => VignetteNpcHandle

/**
 * The wallet slice a vignette touches — read a balance and DEBIT a fare (the
 * physical-money model: minor units per currency). Adapted to the live
 * `InventoryStore` (`balance`/`debit`/`defaultCurrency`). `debit` returns false
 * (no-op) when the player can't afford it, so a vignette degrades gracefully
 * (offer a discount, waive the fare) instead of going negative.
 */
export interface VignetteWallet {
  /** The Track's default currency id (what fares are quoted in). */
  defaultCurrency(): string
  /** Balance (minor units) of a currency. */
  balance(currencyId: string): number
  /** Debit a currency; false (no-op) if insufficient. */
  debit(currencyId: string, units: number): boolean
}

/** Read the live wallet adapter. */
export type WalletFn = () => VignetteWallet

/**
 * Grant a reward (xp + currency + items) — the SAME `applyReward` path a
 * challenge win uses. A vignette calls this to pay out arrival rewards; the
 * orchestrator routes it to `inventory().applyReward` (+ badge deposit, + the
 * econ-HUD reward reveal). Returns the granted item ids.
 */
export type GrantFn = (reward: VignetteReward) => string[]

/** A reward a vignette can hand out (mirrors economy `Reward`, slimmed). */
export interface VignetteReward {
  xp?: number
  /** multi-currency grant (minor units), keyed by currency id. */
  currency?: Record<string, number>
  /** legacy scalar coin grant (default currency). */
  coins?: number
  /** item ids to grant (looked up in the bundled catalog). */
  items?: string[]
}

/**
 * Run a challenge centered over the vignette and resolve with its result (score
 * + concrete rewards). Adapted to `runChallenge`; the vignette passes the tool
 * id, a ChallengeContext (its own language pair + optional entry binding), and
 * the element to mount the centered card into (its own root). NEVER rejects — a
 * cancel resolves with score 0 + zero rewards (uniform handoff).
 */
export type RunChallengeFn = (args: {
  /** The challenge tool id (e.g. "say-it-back", "listen-choose-pic"). */
  tool: string
  /** The language/entry context for the drill. */
  ctx: ChallengeContext
  /** The element the centered challenge card mounts into (the vignette root). */
  container: HTMLElement
  /** NPC framing for the encounter card. */
  npc?: { name: string; avatar: string; line?: string }
}) => Promise<ChallengeResultPlus>

/**
 * The localization seam (one key → resolved string with a per-key English
 * fallback). Adapted to the pack's `t` bound to the active Track's UI locale.
 * Vignettes route EVERY visible string through this — no hardcoded copy.
 */
export type VignetteTranslate = (key: string, params?: Record<string, string | number>) => string

/* ================================================================== *
 * The VignetteContext — the bundle injected into `enter`.
 * ================================================================== */

/**
 * Everything a vignette needs to run, injected by the host. It carries the
 * fullscreen MOUNT node (already created inside `.wp-overlay`), the language
 * pair + active scene (for mood/skin), the triggering anchor, and the thin
 * service adapters above. A vignette builds its whole experience from this and
 * NOTHING else — it never reaches into the orchestrator or a sibling slice.
 */
export interface VignetteContext {
  /**
   * The fullscreen node the host created INSIDE `.wp-overlay` (NEVER body — the
   * host clips body-fixed modals; see GAME_DEV_PLAYBOOK §4.2). The vignette owns
   * everything under here; the host disposes it on exit. `position:absolute;
   * inset:0` at the vignette z-band.
   */
  mountRoot: HTMLElement
  /** The active learner pair (target they learn, native they know). */
  learnerPair: LearnerPair
  /** The active Scene skin (palette/mood/place) so the vignette matches the world. */
  scene: Scene
  /** The topology anchor the player entered FROM (a taxi rank, a café door). */
  anchorId: string
  /** Speak `text` via host TTS in `langCode` (the scene's voice / target). */
  speak(langCode: string, text: string): Promise<void>
  /** Open an NPC conversation inside the vignette (reuses the Qwen3 runtime). */
  openNpc: OpenNpcFn
  /** Read the live wallet adapter (fares are debited from it). */
  wallet: WalletFn
  /** Pay out a reward (the same applyReward path a challenge win uses). */
  grant: GrantFn
  /** Run a centered challenge over the vignette; resolves with its result. */
  runChallenge: RunChallengeFn
  /** Resolve a UI string in the active locale (per-key English fallback). */
  t: VignetteTranslate
  /** The shared procedural icon renderer (coins, tokens, items — zero emoji). */
  iconRenderer: IconRenderer
  /** True when prefers-reduced-motion is set (vignettes skip non-essential motion). */
  reducedMotion: boolean
}

/* ================================================================== *
 * The result — what a vignette resolves with on EXIT.
 * ================================================================== */

/**
 * What a vignette hands back when the player exits. ALL fields optional — a pure
 * "I just looked around and left" exit resolves `{}`. A TRANSIT vignette (taxi,
 * bus, subway) sets `travelTo` so the city re-spawns the player at the
 * destination anchor; an interior that pays out sets `rewards`; a quest-advancing
 * beat sets `questStep`.
 */
export interface VignetteResult {
  /** Rewards already GRANTED inside the vignette (echoed so the city can toast). */
  rewards?: VignetteReward
  /** A quest step id the vignette satisfied (the city advances the engine). */
  questStep?: string
  /**
   * For a TRANSIT vignette: the destination topology anchor id the city should
   * re-spawn the player AT (the taxi dropped you at the cathedral). Absent ⇒ the
   * player exits in place (just chatted, no trip).
   */
  travelTo?: string
}

/** An empty result — "entered, looked around, left in place". */
export const NO_TRAVEL: VignetteResult = {}

/* ================================================================== *
 * The Vignette + factory + host surfaces.
 * ================================================================== */

/**
 * One enterable sub-experience. `enter` builds the whole scene into
 * `ctx.mountRoot`, runs until the player exits (door / ESC / Exit affordance /
 * a transit completing), and RESOLVES with the result. `dispose` tears down any
 * residual resources (the host already removes `mountRoot`); idempotent.
 *
 * A vignette must resolve `enter` exactly once. It must NOT remove its own
 * `mountRoot` (the host owns the transition out + removal); it just resolves.
 */
export interface Vignette {
  enter(ctx: VignetteContext): Promise<VignetteResult>
  dispose(): void
}

/** A factory the host registers under an id; one instance is built per entry. */
export type VignetteFactory = () => Vignette

/**
 * The chrome contract the host needs — just the receding setter from
 * `chromeVisibility`, kept thin so the host doesn't import the full owner. The
 * orchestrator passes `{ set: chrome.set }`. The host RECEDES chrome on enter
 * (its own state) and RESTORES the prior state on exit.
 */
export interface VignetteChrome {
  set(state: ChromeState): void
  current(): ChromeState
}

/** Options to build the host. */
export interface VignetteHostOptions {
  /** The game's `.wp-overlay` element — vignette roots mount INSIDE this. */
  overlay: HTMLElement
  /** Halt the sim + free the LLM (orchestrator: setWorldActive(false) + broker.onBackground()). */
  pauseWorld(): void
  /** Restore the sim (orchestrator: setWorldActive(true)). */
  resumeWorld(): void
  /** The injected service adapters every vignette receives (minus mountRoot/anchorId). */
  services: VignetteServices
  /** The chrome receding setter (the host recedes on enter, restores on exit). */
  chrome: VignetteChrome
}

/**
 * The services bundle the host holds and threads into each `VignetteContext`.
 * It is the `VignetteContext` MINUS the per-entry fields the host fills itself
 * (`mountRoot`, `anchorId`, `reducedMotion`). The orchestrator builds this once.
 */
export type VignetteServices = Omit<
  VignetteContext,
  "mountRoot" | "anchorId" | "reducedMotion"
>

/** Where the player entered from (drives anchor-specific framing + re-spawn). */
export interface EnterOptions {
  /** The topology anchor the portal is attached to. */
  anchorId: string
}

/**
 * The host the city's portal anchors call. `register(id, factory)` adds a
 * vignette; `enter(id, {anchorId})` runs the full lifecycle (pause world + free
 * LLM, recede chrome, create the fullscreen node, transition IN, run, transition
 * OUT, dispose, resume world, restore chrome) and resolves the result — or
 * `null` if the id is unknown / an entry is already running (one at a time).
 */
export interface VignetteHost {
  /** Register a vignette factory under an id (idempotent — last wins, warns). */
  register(id: string, factory: VignetteFactory): void
  /** Is a vignette registered under this id? (the city gates portals on this). */
  has(id: string): boolean
  /** Run the vignette lifecycle; resolves its result (or null — see above). */
  enter(id: string, opts: EnterOptions): Promise<VignetteResult | null>
  /** Is a vignette currently running? (the city suppresses portals while true). */
  isActive(): boolean
  /** Force-exit the running vignette (app background / teardown). */
  dispose(): void
}
