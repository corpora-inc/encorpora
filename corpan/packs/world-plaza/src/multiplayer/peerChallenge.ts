import type {
  ChallengeSpec,
  ChallengeContext,
  ChallengeResult,
  PlayerId,
} from "@world-plaza/contracts"
import { runChallenge, type ChallengeRuntimeHost } from "../challenges/registry"

/**
 * peerChallenge.ts — launch a SHARED minigame between two real players using the
 * EXISTING challenge system, and reconcile both scores.
 *
 * We deliberately do NOT reimplement the microgames. An invite carries a fully
 * built `ChallengeSpec` (the inviter's device built it), so BOTH players run the
 * identical spec locally through the public `runChallenge` overlay. When a side
 * finishes it reports its `ChallengeResult` over the invite channel; once both
 * are in we can show "you / them" and the caller rewards both. If the partner
 * never reports (they bailed / dropped), a timeout resolves the duel as a solo
 * completion — your own result still counts, so a peer challenge can never trap
 * you (graceful degradation, same spirit as the rest of the pack).
 *
 * `mode`:
 *   • "coop" — both win/lose together; the pair's combined score is celebrated.
 *   • "duel" — head-to-head; higher score wins, but BOTH still earn (a duel is
 *     practice, never a punishment — no dark patterns).
 */

export interface PeerChallengeContext extends ChallengeContext {
  /** the local player's durable id (stamped onto the reported result). */
  localPlayerId: PlayerId
}

export interface PeerChallengeOutcome {
  /** the local player's normalized result. */
  self: ChallengeResult
  /** the partner's result, if it arrived before the timeout. */
  peer?: ChallengeResult
  mode: "coop" | "duel"
  /** "win" | "lose" | "tie" | "solo" (partner never reported). */
  verdict: "win" | "lose" | "tie" | "solo"
}

export interface PeerChallengeHooks {
  /** send our finished result to the partner over the invite channel. */
  reportResult: (result: ChallengeResult) => void
  /** subscribe to the partner's result; returns an unsubscribe. */
  onPeerResult: (cb: (result: ChallengeResult) => void) => () => void
  /** how long to wait for the partner after we finish (ms). Default 30s. */
  peerWaitMs?: number
}

/**
 * Run one shared challenge to completion and reconcile both sides. Resolves once
 * BOTH results are in (or the peer-wait elapses). Never rejects.
 */
export async function runPeerChallenge(
  container: HTMLElement,
  spec: ChallengeSpec,
  ctx: PeerChallengeContext,
  host: ChallengeRuntimeHost,
  mode: "coop" | "duel",
  hooks: PeerChallengeHooks,
  npc?: { name: string; avatar: string; line?: string },
): Promise<PeerChallengeOutcome> {
  // Subscribe to the partner's result BEFORE we start, so a fast partner can't
  // beat our listener.
  let peer: ChallengeResult | undefined
  let onPeer: ((r: ChallengeResult) => void) | null = null
  const off = hooks.onPeerResult((r) => {
    peer = r
    onPeer?.(r)
  })

  // Run OUR side via the public overlay (the same path NPC challenges use).
  const plus = await runChallenge(spec.toolId, ctx, host, {
    container,
    npc,
    partialSpec: spec as unknown as Partial<ChallengeSpec> & Record<string, unknown>,
  })

  const self: ChallengeResult = {
    challengeId: plus.challengeId,
    toolId: plus.toolId,
    playerId: ctx.localPlayerId,
    score: plus.score,
    detail: plus.detail,
    xp: plus.xp,
    completedAt: plus.completedAt,
    offline: plus.offline,
  }

  // Tell the partner how we did.
  try {
    hooks.reportResult(self)
  } catch (e) {
    console.error("[mp/peer] reportResult threw:", e)
  }

  // Wait (bounded) for the partner's result, then reconcile.
  if (!peer) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        onPeer = null
        resolve()
      }, hooks.peerWaitMs ?? 30000)
      onPeer = () => {
        clearTimeout(t)
        onPeer = null
        resolve()
      }
    })
  }
  off()

  return { self, peer, mode, verdict: verdictOf(self, peer, mode) }
}

function verdictOf(
  self: ChallengeResult,
  peer: ChallengeResult | undefined,
  mode: "coop" | "duel",
): PeerChallengeOutcome["verdict"] {
  if (!peer) return "solo"
  if (mode === "coop") {
    // Cooperative: a shared bar — both "win" if the pair clears a soft 0.6 mean.
    return (self.score + peer.score) / 2 >= 0.6 ? "win" : "lose"
  }
  if (self.score > peer.score) return "win"
  if (self.score < peer.score) return "lose"
  return "tie"
}
