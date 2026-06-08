/**
 * outbox — the ONLY server-side message state, and it is deliberately minimal.
 *
 * We never store conversation history server-side. When a chat message is sent
 * to a penpal who is momentarily offline, we hold the ALREADY-SANITIZED relay
 * envelope here just long enough for them to come back and fetch it, then delete
 * it on delivery. Anything undelivered self-expires after a TTL (the living-link
 * window). The server therefore holds, at most, a small bounded buffer of opaque
 * "in-flight" envelopes — never a graph, never history.
 *
 * Properties:
 *   - delete-on-delivery: `drain` removes what it returns,
 *   - TTL: `sweep` drops anything past `expiresAt`,
 *   - bounded: at most `maxPerRecipient` envelopes per recipient (oldest dropped,
 *     loudly), so a flood can't exhaust memory,
 *   - shared across room instances: a returning player may land in a different
 *     room than the one the message was sent from, so one instance is shared by
 *     every room (see index.ts).
 */

export interface OutboxEnvelope {
  /** recipient playerId. */
  to: string
  /** sender playerId. */
  from: string
  /** the sanitized MediatedChatInput to deliver verbatim (opaque here). */
  payload: unknown
  /** when it was buffered. */
  ts: number
  /** drop after this (the living-link window). */
  expiresAt: number
}

export interface Outbox {
  /** buffer a message for an offline recipient. */
  enqueue: (env: OutboxEnvelope) => void
  /** remove and return all non-expired envelopes addressed to `to`. */
  drain: (to: string, now: number) => OutboxEnvelope[]
  /** drop expired envelopes everywhere; returns how many were dropped. */
  sweep: (now: number) => number
  /** forget every envelope between a pair (link lapse, block, explicit end). */
  removeForPair: (a: string, b: string) => void
  /** forget every envelope to OR from a player (e.g. a block). */
  removeForPlayer: (playerId: string) => void
  /** total buffered envelopes (observability/tests). */
  size: () => number
}

const DEFAULT_MAX_PER_RECIPIENT = 200

export function createMemoryOutbox(opts: { maxPerRecipient?: number } = {}): Outbox {
  const maxPerRecipient = opts.maxPerRecipient ?? DEFAULT_MAX_PER_RECIPIENT
  const byRecipient = new Map<string, OutboxEnvelope[]>()

  return {
    enqueue(env) {
      const list = byRecipient.get(env.to) ?? []
      list.push(env)
      if (list.length > maxPerRecipient) {
        const dropped = list.splice(0, list.length - maxPerRecipient)
        console.warn(
          `[outbox] recipient ${env.to} over ${maxPerRecipient} buffered; dropped ${dropped.length} oldest`,
        )
      }
      byRecipient.set(env.to, list)
    },
    drain(to, now) {
      const list = byRecipient.get(to)
      if (!list) return []
      byRecipient.delete(to)
      // Deliver only the still-fresh ones; expired ones are simply dropped.
      return list.filter((env) => env.expiresAt > now)
    },
    sweep(now) {
      let dropped = 0
      for (const [to, list] of byRecipient) {
        const fresh = list.filter((env) => env.expiresAt > now)
        dropped += list.length - fresh.length
        if (fresh.length === 0) byRecipient.delete(to)
        else if (fresh.length !== list.length) byRecipient.set(to, fresh)
      }
      return dropped
    },
    removeForPair(a, b) {
      for (const id of [a, b]) {
        const list = byRecipient.get(id)
        if (!list) continue
        const kept = list.filter((env) => env.from !== a && env.from !== b)
        if (kept.length === 0) byRecipient.delete(id)
        else byRecipient.set(id, kept)
      }
    },
    removeForPlayer(playerId) {
      byRecipient.delete(playerId)
      for (const [to, list] of byRecipient) {
        const kept = list.filter((env) => env.from !== playerId)
        if (kept.length === 0) byRecipient.delete(to)
        else if (kept.length !== list.length) byRecipient.set(to, kept)
      }
    },
    size() {
      let n = 0
      for (const list of byRecipient.values()) n += list.length
      return n
    },
  }
}
