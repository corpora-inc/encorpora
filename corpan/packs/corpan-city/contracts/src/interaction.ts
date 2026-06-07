import { z } from "zod"
import { PlayerId } from "./ids"
import { ChallengeToolId } from "./challengeTool"
import { ChallengeSpec } from "./challenge"

/**
 * All cross-player communication is a TYPED handshake — never a raw socket of
 * arbitrary text/audio. Interactions are server-routed (no P2P).
 */

export const InteractionRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("emote"), from: PlayerId, emote: z.string().min(1) }),
  z.object({
    kind: z.literal("challenge"),
    from: PlayerId,
    to: PlayerId,
    tool: ChallengeToolId,
    spec: ChallengeSpec,
  }),
  z.object({ kind: z.literal("chatOpen"), from: PlayerId, to: PlayerId }),
])
export type InteractionRequest = z.infer<typeof InteractionRequest>

export const InteractionResponse = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("accept"), requestId: z.string().min(1) }),
  z.object({
    kind: z.literal("decline"),
    requestId: z.string().min(1),
    reason: z.enum(["busy", "no"]).optional(),
  }),
])
export type InteractionResponse = z.infer<typeof InteractionResponse>
