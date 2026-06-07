import {
  MP_MSG,
  ProfilePublish,
  ProfileRequest,
  SafeProfile,
  InviteMessage,
  InvitedMessage,
  InviteRespond,
  InviteResult,
  MediatedChatInput,
  PeerChallengeResult,
  TradeEnvelope,
  TradeUpdateMessage,
  type InviteOffer,
  type ChallengeResult,
} from "@corpan-city/contracts"
import type { NetRoom } from "../net"

/**
 * protocol.ts — the typed CLIENT side of the player-to-player interaction wire.
 *
 * Wraps the tiny `NetRoom` messaging façade (from `src/net/netClient`) so the
 * rest of `src/multiplayer` never touches raw message names or unvalidated
 * payloads. Outbound: build + send a contract-validated message. Inbound:
 * every server message is re-validated with the SAME Zod schema before a
 * listener sees it (the client trusts the server no more than the server trusts
 * the client) — a malformed payload is logged + dropped, never rendered.
 *
 * This module is pure transport: no UI, no LLM, no game state. It is the single
 * seam the chat engine, trade transport, peer-challenge, and profile card all
 * sit on, so swapping the underlying connection changes nothing above it.
 */

export type ProtocolHandlers = {
  /** A SafeProfile card we requested arrived (already k-anon-coarsened). */
  onProfileCard?: (card: SafeProfile) => void
  /** Someone invited us to chat / challenge / trade. */
  onInvited?: (msg: InvitedMessage) => void
  /** The outcome of an invite WE sent. */
  onInviteResult?: (msg: InviteResult) => void
  /** A mediated chat input from a partner (we lessonify it locally). */
  onChat?: (msg: MediatedChatInput) => void
  /** A trade lifecycle update from a partner. */
  onTrade?: (msg: TradeUpdateMessage) => void
  /** A peer-challenge partner reported their result (keyed by inviteId). */
  onPeerResult?: (inviteId: string, result: ChallengeResult) => void
}

export interface InteractionProtocol {
  readonly localPlayerId: string
  /** Publish my safe stack + (private) country for the k-anon histogram. */
  publishProfile: (p: ProfilePublish) => void
  /** Ask the server for another player's coarsened profile card. */
  requestProfile: (targetPlayerId: string) => void
  /** Invite `to` into `offer`. Returns the minted inviteId for correlation. */
  invite: (to: string, offer: InviteOffer) => string
  /** Accept/decline an invite by id. */
  respondInvite: (inviteId: string, action: "accept" | "decline") => void
  /** Send a locally-cleaned mediated chat input to a partner. */
  sendChat: (input: MediatedChatInput) => void
  /** Send a trade lifecycle envelope to a partner. */
  sendTrade: (env: TradeEnvelope) => void
  /** Report my finished peer-challenge result (routed to my partner). */
  reportPeerResult: (inviteId: string, result: ChallengeResult) => void
  /** Detach all listeners (room lost / teardown). */
  dispose: () => void
}

let _seq = 0
/** Mint a process-unique correlation id (invites, etc.). */
export function mintId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${(_seq++).toString(36)}`
}

/**
 * Bind the typed protocol to a live `NetRoom`. Created fresh each time the room
 * (re)connects; `dispose()` detaches when the room is lost.
 */
export function createProtocol(room: NetRoom, handlers: ProtocolHandlers): InteractionProtocol {
  const unsubs: Array<() => void> = []

  /** Subscribe to a server message, validating its payload with `schema`. */
  const listen = <T>(
    type: string,
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
    cb: ((data: T) => void) | undefined,
  ): void => {
    if (!cb) return
    const off = room.onMessage(type, (payload) => {
      const parsed = schema.safeParse(payload)
      if (!parsed.success) {
        console.warn(`[mp] dropped malformed "${type}" from server`)
        return
      }
      try {
        cb(parsed.data)
      } catch (e) {
        console.error(`[mp] handler for "${type}" threw:`, e)
      }
    })
    unsubs.push(off)
  }

  listen(MP_MSG.profileCard, SafeProfile, handlers.onProfileCard)
  listen(MP_MSG.invited, InvitedMessage, handlers.onInvited)
  listen(MP_MSG.inviteResult, InviteResult, handlers.onInviteResult)
  listen(MP_MSG.chatDeliver, MediatedChatInput, handlers.onChat)
  listen(MP_MSG.tradeUpdate, TradeUpdateMessage, handlers.onTrade)
  if (handlers.onPeerResult) {
    const off = room.onMessage(MP_MSG.peerResultDeliver, (payload) => {
      const parsed = PeerChallengeResult.safeParse(payload)
      if (!parsed.success) {
        console.warn("[mp] dropped malformed peer-result")
        return
      }
      try {
        handlers.onPeerResult!(parsed.data.inviteId, parsed.data.result)
      } catch (e) {
        console.error("[mp] onPeerResult handler threw:", e)
      }
    })
    unsubs.push(off)
  }

  return {
    localPlayerId: room.localPlayerId,

    publishProfile(p) {
      const parsed = ProfilePublish.safeParse(p)
      if (!parsed.success) {
        console.error("[mp] refusing to publish malformed profile:", parsed)
        return
      }
      room.send(MP_MSG.profilePublish, parsed.data)
    },

    requestProfile(targetPlayerId) {
      const req = { target: targetPlayerId }
      if (!ProfileRequest.safeParse(req).success) return
      room.send(MP_MSG.profileRequest, req)
    },

    invite(to, offer) {
      const inviteId = mintId("inv")
      const msg = { inviteId, to, offer }
      if (!InviteMessage.safeParse(msg).success) {
        console.error("[mp] refusing to send malformed invite")
        return inviteId
      }
      room.send(MP_MSG.invite, msg)
      return inviteId
    },

    respondInvite(inviteId, action) {
      const msg = { inviteId, action }
      if (!InviteRespond.safeParse(msg).success) return
      room.send(MP_MSG.inviteRespond, msg)
    },

    sendChat(input) {
      const parsed = MediatedChatInput.safeParse(input)
      if (!parsed.success) {
        console.error("[mp] refusing to send malformed chat input")
        return
      }
      room.send(MP_MSG.chatSend, parsed.data)
    },

    sendTrade(env) {
      const parsed = TradeEnvelope.safeParse(env)
      if (!parsed.success) {
        console.error("[mp] refusing to send malformed trade envelope")
        return
      }
      room.send(MP_MSG.trade, parsed.data)
    },

    reportPeerResult(inviteId, result) {
      const msg = { inviteId, result }
      if (!PeerChallengeResult.safeParse(msg).success) {
        console.error("[mp] refusing to send malformed peer result")
        return
      }
      room.send(MP_MSG.peerResult, msg)
    },

    dispose() {
      for (const off of unsubs.splice(0)) {
        try {
          off()
        } catch (e) {
          console.error("[mp] unsubscribe threw:", e)
        }
      }
    },
  }
}
