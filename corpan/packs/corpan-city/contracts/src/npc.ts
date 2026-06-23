import { z } from "zod"
import { ChallengeToolId } from "./challengeTool"

/**
 * An NPC at runtime is composed: NpcRole (abstract, anchored, shared position +
 * scripted fallback) × Scene skin (appearance/voice) × Quest promptProgram
 * (what + how it teaches). So the same baker anchor is a Tokyo barista or an
 * Antigua café owner visually, teaching different language pairs by data.
 */

export const ScriptedLine = z.object({
  text: z.string().min(1),
})
export type ScriptedLine = z.infer<typeof ScriptedLine>

export const NpcRole = z.object({
  id: z.string().min(1),
  anchorId: z.string().min(1),
  basePersona: z.object({
    tone: z.string(),
    quirks: z.array(z.string()),
  }),
  /** Runs when no local LLM is installed — NPCs always work, just less dynamically. */
  scriptedFallback: z.array(ScriptedLine),
})
export type NpcRole = z.infer<typeof NpcRole>

/**
 * Parsed JS-side from the model's output (the corpan-llm plugin is text-only,
 * no native tool-calling — NPCs emit a structured block we parse via stop
 * sequences). Discriminated on `kind`.
 */
export const NpcIntent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("say"), text: z.string() }),
  z.object({
    kind: z.literal("callTool"),
    tool: ChallengeToolId,
    spec: z.record(z.string(), z.unknown()), // Partial<ChallengeSpec>, validated by the tool
  }),
  z.object({ kind: z.literal("reward"), xp: z.number(), coins: z.number().optional() }),
  z.object({ kind: z.literal("questStep"), stepId: z.string().min(1) }),
  z.object({ kind: z.literal("end") }),
])
export type NpcIntent = z.infer<typeof NpcIntent>
