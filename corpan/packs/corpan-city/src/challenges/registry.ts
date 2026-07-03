/**
 * The challenge registry + the `runChallenge` entry point the game calls when an
 * NPC emits a `callTool` intent (or a player duel is launched).
 *
 * Flow:
 *   NpcIntent.callTool { tool, spec } → runChallenge(tool, ctx, host, ui)
 *     → tool.buildSpec(ctx) (merged with the NPC's partial spec)
 *     → mountChallengeOverlay(centered RPG card)
 *     → tool.run(overlay, spec, runtimeHost)
 *     → overlay.complete(score, reward) → resolves ChallengeResultPlus
 *   The game hands `.rewards` to the economy/inventory agent.
 */

import {
  ChallengeToolId,
  type ChallengeContext,
  type ChallengeResultPlus,
  type ChallengeSpec,
  type ChallengeReward,
} from "@corpan-city/contracts"
import type { ChallengeRuntimeHost } from "./host"
import { mountChallengeOverlay, type OverlayPretext } from "./overlay"
import type { ToolImpl } from "./tools/_shared"
import { choiceToolList } from "./tools/choiceTools"
import { textToolList } from "./tools/textTools"
import { gridToolList } from "./tools/gridTools"
import { sttToolList } from "./tools/sttTools"
import pretexts from "../../content/challenges/prompts.json"

/* ------------------------------------------------------------------ *
 * Build the registry. The 20 implemented tools, plus aliases mapping the
 * 6 legacy contract ids onto their nearest new tool so existing NPC
 * prompt-programs keep working.
 * ------------------------------------------------------------------ */

const IMPLEMENTED: ToolImpl[] = [
  ...choiceToolList,
  ...textToolList,
  ...gridToolList,
  ...sttToolList,
]

const REGISTRY = new Map<ChallengeToolId, ToolImpl>()
for (const tool of IMPLEMENTED) REGISTRY.set(tool.id, tool)

/** Legacy id → new tool that fulfils the same intent. */
const LEGACY_ALIAS: Partial<Record<ChallengeToolId, ChallengeToolId>> = {
  "pronunciation-duel": "read-aloud",
  "speed-drill": "fast-translate",
  "listen-choose": "listen-choose-pic",
  "translate-fast": "fast-translate",
  "fill-blank": "fill-the-blank",
  "repeat-after": "say-it-back",
}

function resolveTool(id: ChallengeToolId): ToolImpl | undefined {
  return REGISTRY.get(id) ?? (LEGACY_ALIAS[id] ? REGISTRY.get(LEGACY_ALIAS[id]!) : undefined)
}

/**
 * Does this tool inherently need BOTH languages (so the native side must survive
 * immersion)? — #27/#57. Reads the tool's OWN declared `isCrossLanguage` property
 * (resolving legacy aliases first), NOT a hand-maintained whitelist: a tool whose
 * prompt + correct answer are in different languages CANNOT silently tautologize
 * unless its author explicitly mis-flags it, and adding a tool forces the decision.
 * The orchestrator uses this to keep `ChallengeContext.nativeLanguage` set for
 * these tools regardless of immersion, and to exclude them from a single-language
 * Track's offer.
 */
export function isCrossLanguageTool(id: ChallengeToolId): boolean {
  return resolveTool(id)?.isCrossLanguage === true
}

/** All tool ids that can actually be run (implemented + aliased legacy). */
export function availableToolIds(): ChallengeToolId[] {
  const ids = new Set<ChallengeToolId>(REGISTRY.keys())
  for (const k of Object.keys(LEGACY_ALIAS) as ChallengeToolId[]) ids.add(k)
  return [...ids]
}

export function getTool(id: ChallengeToolId): ToolImpl | undefined {
  return resolveTool(id)
}

/* ------------------------------------------------------------------ *
 * Pretext lines (NPC framing). Localizable; falls back to en.
 * ------------------------------------------------------------------ */

type PretextBlock = Record<string, string>
const PRETEXTS = (pretexts as { pretexts: Record<string, PretextBlock> }).pretexts

function pretextLine(toolId: ChallengeToolId, uiLang?: string): string {
  const lang = uiLang?.split("-")[0] ?? "en"
  const real = LEGACY_ALIAS[toolId] ?? toolId
  const block = PRETEXTS[lang] ?? PRETEXTS.en
  return block?.[real] ?? PRETEXTS.en?.[real] ?? "Help me with a quick word game?"
}

/* ------------------------------------------------------------------ *
 * runChallenge — the single call the game wires to NpcIntent.callTool.
 * ------------------------------------------------------------------ */

export interface RunChallengeOptions {
  /** The overlay layer to mount into (the game's `.wp-overlay`). */
  container: HTMLElement
  /** NPC framing for the encounter card. */
  npc?: { name: string; avatar: string; line?: string }
  /** Partial spec emitted by the NPC's tool-call (merged over buildSpec). */
  partialSpec?: Partial<ChallengeSpec> & Record<string, unknown>
  /** Language for the NPC pretext line (defaults to ctx.nativeLanguage). */
  uiLanguage?: string
  /** Scene accent color (e.g. `scene.palette.accent`) to tint chrome (close button). */
  accent?: string
}

/**
 * Run a challenge by id and resolve with a {@link ChallengeResultPlus}
 * (normalized result + concrete rewards). Never rejects — a cancel resolves
 * with score 0 and zero rewards; an unknown tool resolves the same so the
 * caller's economy handoff is uniform.
 */
export function runChallenge(
  toolId: ChallengeToolId,
  ctx: ChallengeContext,
  host: ChallengeRuntimeHost,
  opts: RunChallengeOptions,
): Promise<ChallengeResultPlus> {
  return new Promise((resolve) => {
    const tool = resolveTool(toolId)
    if (!tool) {
      console.error(`[wp-challenge] unknown tool id: ${toolId}`)
      resolve(emptyResult(toolId))
      return
    }

    const npcName = opts.npc?.name ?? "Stranger"
    const avatar = opts.npc?.avatar ?? "🧑"
    const line = opts.npc?.line ?? pretextLine(toolId, opts.uiLanguage ?? ctx.nativeLanguage)
    const pretext: OverlayPretext = { npcName, avatar, line, accent: opts.accent }

    let settled = false
    const finishOnce = (r: ChallengeResultPlus) => {
      if (settled) return
      settled = true
      resolve(r)
    }

    void (async () => {
      let spec: ChallengeSpec
      try {
        spec = await tool.buildSpec(ctx)
        // Merge the NPC's partial spec (entryIds/params/level overrides).
        if (opts.partialSpec) {
          const p = opts.partialSpec
          if (Array.isArray(p.entryIds)) spec.entryIds = p.entryIds as number[]
          if (typeof p.level === "string") spec.level = p.level
          if (p.params && typeof p.params === "object")
            spec.params = { ...spec.params, ...(p.params as Record<string, unknown>) }
          // Journey launches pin the correlation key: the ActivitySpec's specId
          // becomes the internal challengeId so the result round-trips
          // (activity-contract §6.3). NPC tool-calls never set this — additive.
          if (typeof p.challengeId === "string" && p.challengeId.length > 0)
            spec.challengeId = p.challengeId
        }
      } catch (err) {
        console.error(`[wp-challenge] buildSpec failed for ${toolId}:`, err)
        finishOnce(emptyResult(toolId))
        return
      }

      const handle = mountChallengeOverlay(opts.container, pretext, {
        speak: (text: string) => host.speak(spec.language, text),
        onComplete: (score01, reward) => {
          finishOnce(makeResult(spec, score01, reward))
        },
        onCancel: () => {
          finishOnce(emptyResult(toolId))
        },
      })

      try {
        tool.run(handle.api, spec, host)
      } catch (err) {
        console.error(`[wp-challenge] tool.run threw for ${toolId}:`, err)
        handle.unmount()
        finishOnce(emptyResult(toolId))
      }
    })()
  })
}

/* ------------------------------------------------------------------ *
 * Result builders.
 * ------------------------------------------------------------------ */

function playerIdOf(): ChallengeResultPlus["playerId"] {
  // ChallengeContext carries no playerId; the local player is implied. The
  // result's playerId is a branded string; the game can re-stamp before
  // reconciliation. We mint the conventional local id.
  return "player-local" as ChallengeResultPlus["playerId"]
}

function makeResult(
  spec: ChallengeSpec,
  score01: number,
  reward: ChallengeReward,
): ChallengeResultPlus {
  const score = Math.max(0, Math.min(1, score01))
  return {
    challengeId: spec.challengeId,
    toolId: spec.toolId,
    playerId: playerIdOf(),
    score,
    detail: { score, xp: reward.xp, coins: reward.coins, items: reward.items.length },
    xp: [{ kind: "challenge", toolId: spec.toolId, amount: reward.xp }],
    completedAt: Date.now(),
    offline: true,
    rewards: reward,
    outcome: "completed",
  }
}

function emptyResult(toolId: ChallengeToolId): ChallengeResultPlus {
  return {
    challengeId: `${toolId}-aborted-${Date.now().toString(36)}`,
    toolId,
    playerId: playerIdOf(),
    score: 0,
    detail: { score: 0, xp: 0, coins: 0, items: 0 },
    xp: [],
    completedAt: Date.now(),
    offline: true,
    rewards: { xp: 0, coins: 0, items: [] },
    outcome: "aborted",
  }
}

/* Re-exports so the game imports one module. */
export { mockChallengeHost, createChallengeHost } from "./host"
export type { ChallengeRuntimeHost, CorpanChallengeHostApi } from "./host"
