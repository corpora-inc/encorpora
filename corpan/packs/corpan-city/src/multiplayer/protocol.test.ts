import { describe, it, expect, vi } from "vitest"
import { MP_MSG, type SafeProfile, type InvitedMessage } from "@corpan-city/contracts"
import type { NetRoom } from "../net"
import { createProtocol, type ProtocolHandlers } from "./protocol"

/**
 * A mock `NetRoom` that records outbound sends and lets a test push inbound
 * server messages. This is the "mock the room" protocol test the brief asks for:
 * it exercises the FULL client wire surface without a real Colyseus connection.
 */
function mockRoom() {
  const sent: Array<{ type: string; payload: unknown }> = []
  const listeners = new Map<string, Set<(p: unknown) => void>>()
  const room: NetRoom = {
    localSessionId: "s-local",
    localPlayerId: "p-local",
    send: (type, payload) => sent.push({ type, payload }),
    onMessage: (type, cb) => {
      const set = listeners.get(type) ?? new Set()
      set.add(cb as (p: unknown) => void)
      listeners.set(type, set)
      return () => set.delete(cb as (p: unknown) => void)
    },
  }
  /** Simulate the server delivering a message to this client. */
  const deliver = (type: string, payload: unknown) => {
    for (const cb of listeners.get(type) ?? []) cb(payload)
  }
  const lastOf = (t: string) => {
    const matches = sent.filter((s) => s.type === t)
    return matches[matches.length - 1]
  }
  return { room, sent, deliver, lastOf }
}

describe("interaction protocol — outbound", () => {
  it("publishes a profile (stack + country)", () => {
    const { room, lastOf } = mockRoom()
    const proto = createProtocol(room, {})
    proto.publishProfile({ stack: { target: "es", native: "en" }, country: "US", continent: "north-america" })
    const msg = lastOf(MP_MSG.profilePublish)
    expect(msg?.payload).toMatchObject({ country: "US", stack: { target: "es" } })
  })

  it("refuses to send a malformed profile (bad country)", () => {
    const { room, sent } = mockRoom()
    const proto = createProtocol(room, {})
    // deliberately invalid country ("usa" is 3 letters) — the runtime Zod guard drops it
    proto.publishProfile({ stack: { target: "es", native: "en" }, country: "usa" })
    expect(sent.filter((s) => s.type === MP_MSG.profilePublish)).toHaveLength(0)
  })

  it("mints a unique inviteId and sends a challenge invite", () => {
    const { room, lastOf } = mockRoom()
    const proto = createProtocol(room, {})
    const id = proto.invite("p-2", {
      kind: "challenge",
      tool: "translate-fast",
      mode: "duel",
      spec: { toolId: "translate-fast", challengeId: "c-1", language: "es", mode: "duel" },
    })
    expect(id).toMatch(/^inv-/)
    expect(lastOf(MP_MSG.invite)?.payload).toMatchObject({ inviteId: id, to: "p-2" })
  })

  it("reports a peer-challenge result", () => {
    const { room, lastOf } = mockRoom()
    const proto = createProtocol(room, {})
    proto.reportPeerResult("inv-9", {
      challengeId: "c-1",
      toolId: "translate-fast",
      playerId: "p-local" as SafeProfile["playerId"],
      score: 0.9,
      detail: {},
      xp: [],
      completedAt: 1,
      offline: true,
    })
    expect(lastOf(MP_MSG.peerResult)?.payload).toMatchObject({ inviteId: "inv-9" })
  })

  it("sends chat lifecycle control without user text", () => {
    const { room, lastOf } = mockRoom()
    const proto = createProtocol(room, {})
    proto.sendChatControl({ to: "p-2" as SafeProfile["playerId"], interactionId: "chat-1", action: "ended" })
    expect(lastOf(MP_MSG.chatControl)?.payload).toEqual({
      to: "p-2",
      interactionId: "chat-1",
      action: "ended",
    })
  })
})

describe("interaction protocol — inbound (server → client, re-validated)", () => {
  it("delivers a valid SafeProfile card", () => {
    const { room, deliver } = mockRoom()
    const onProfileCard = vi.fn()
    createProtocol(room, { onProfileCard })
    const card: SafeProfile = {
      playerId: "p-7" as SafeProfile["playerId"],
      name: "Calm Fox",
      stack: { target: "ja", native: "en" },
      place: { granularity: "continent", continent: "asia" },
    }
    deliver(MP_MSG.profileCard, card)
    expect(onProfileCard).toHaveBeenCalledWith(expect.objectContaining({ name: "Calm Fox" }))
  })

  it("DROPS a malformed inbound message (never reaches the handler)", () => {
    const { room, deliver } = mockRoom()
    const onInvited = vi.fn()
    createProtocol(room, { onInvited })
    deliver(MP_MSG.invited, { inviteId: "x" }) // missing required fields
    expect(onInvited).not.toHaveBeenCalled()
  })

  it("routes invite + result + chat + trade to their handlers", () => {
    const { room, deliver } = mockRoom()
    const h: ProtocolHandlers = {
      onInvited: vi.fn(),
      onInviteResult: vi.fn(),
      onChat: vi.fn(),
      onChatControl: vi.fn(),
      onTrade: vi.fn(),
      onPeerResult: vi.fn(),
    }
    createProtocol(room, h)
    const invited: InvitedMessage = {
      inviteId: "i-1",
      from: "p-2" as InvitedMessage["from"],
      fromName: "Ada",
      offer: { kind: "chat" },
    }
    deliver(MP_MSG.invited, invited)
    deliver(MP_MSG.inviteResult, { inviteId: "i-1", outcome: "accepted" })
    deliver(MP_MSG.chatDeliver, {
      from: "p-2",
      to: "p-local",
      interactionId: "x",
      source: { kind: "text", text: "hola" },
      sourceLanguage: "es",
      targetLanguage: "en",
      mode: "beginner",
    })
    deliver(MP_MSG.chatControl, {
      from: "p-2",
      to: "p-local",
      interactionId: "x",
      action: "partner-left",
    })
    deliver(MP_MSG.tradeUpdate, {
      tradeId: "t-1",
      from: "p-2",
      to: "p-local",
      action: "propose",
      proposal: { id: "t-1" },
    })
    deliver(MP_MSG.peerResultDeliver, {
      inviteId: "i-1",
      result: {
        challengeId: "c",
        toolId: "translate-fast",
        playerId: "p-2",
        score: 0.5,
        detail: {},
        xp: [],
        completedAt: 1,
        offline: true,
      },
    })
    expect(h.onInvited).toHaveBeenCalledOnce()
    expect(h.onInviteResult).toHaveBeenCalledWith(expect.objectContaining({ outcome: "accepted" }))
    expect(h.onChat).toHaveBeenCalledOnce()
    expect(h.onChatControl).toHaveBeenCalledWith(expect.objectContaining({ action: "partner-left" }))
    expect(h.onTrade).toHaveBeenCalledWith(expect.objectContaining({ tradeId: "t-1" }))
    expect(h.onPeerResult).toHaveBeenCalledWith("i-1", expect.objectContaining({ score: 0.5 }))
  })

  it("detaches all listeners on dispose", () => {
    const { room, deliver } = mockRoom()
    const onProfileCard = vi.fn()
    const proto = createProtocol(room, { onProfileCard })
    proto.dispose()
    deliver(MP_MSG.profileCard, {
      playerId: "p",
      name: "X",
      stack: { target: "es", native: "en" },
      place: { granularity: "hidden" },
    })
    expect(onProfileCard).not.toHaveBeenCalled()
  })
})
