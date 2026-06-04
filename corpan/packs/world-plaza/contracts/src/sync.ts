import { z } from "zod"
import { XpEvent, EconomyTransaction, InventoryState } from "./economy"
import { ChallengeResult } from "./challenge"
import { QuestState } from "./quest"
import { LevelState } from "./curriculum"

/**
 * Offline-first: progress events are signed and queued locally, then pushed to
 * the server which reconciles them (rejecting implausible ones) and returns the
 * authoritative inventory + level state.
 */

export const OfflineProgressEvent = z.object({
  id: z.string().min(1),
  t: z.number(),
  payload: z.union([XpEvent, ChallengeResult, EconomyTransaction, QuestState]),
  sig: z.string().min(1),
})
export type OfflineProgressEvent = z.infer<typeof OfflineProgressEvent>

export const SyncEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pushProgress"), events: z.array(OfflineProgressEvent) }),
  z.object({ kind: z.literal("pullState"), since: z.number() }),
  z.object({
    kind: z.literal("reconciled"),
    inventory: InventoryState,
    levelState: z.array(LevelState),
    rejected: z.array(z.string()),
  }),
])
export type SyncEvent = z.infer<typeof SyncEvent>
