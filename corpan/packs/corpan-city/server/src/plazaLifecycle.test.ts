import { describe, expect, it } from "vitest"
import { MP_MSG } from "@corpan-city/contracts"
import { PlazaRoom } from "./PlazaRoom.js"

type SentMessage = { type: string; payload: unknown }
type MockClient = { send: (type: string, payload: unknown) => void }
type LifecycleRoom = {
  state: { players: Map<string, { playerId: string; name: string }> }
  byPlayerId: Map<string, string>
  clientsBySession: Map<string, MockClient>
  acceptedPairs: Map<string, { a: string; b: string; kind: "chat"; expiresAt: number }>
  notifyJoinedPlayerAboutAcceptedChats: (playerId: string) => void
}

function roomWithAcceptedChat() {
  const sentA: SentMessage[] = []
  const sentB: SentMessage[] = []
  const room = Object.create(PlazaRoom.prototype) as LifecycleRoom
  room.state = {
    players: new Map([
      ["s-a", { playerId: "p-a", name: "Ada" }],
      ["s-b", { playerId: "p-b", name: "Ben" }],
    ]),
  }
  room.byPlayerId = new Map([
    ["p-a", "s-a"],
    ["p-b", "s-b"],
  ])
  room.clientsBySession = new Map([
    ["s-a", { send: (type, payload) => sentA.push({ type, payload }) }],
    ["s-b", { send: (type, payload) => sentB.push({ type, payload }) }],
  ])
  room.acceptedPairs = new Map([
    ["chat:p-a:p-b", { a: "p-a", b: "p-b", kind: "chat", expiresAt: Date.now() + 60_000 }],
  ])
  return { room, sentA, sentB }
}

describe("PlazaRoom chat lifecycle", () => {
  it("tells a rejoining player which accepted chat partner is still online", () => {
    const { room, sentA } = roomWithAcceptedChat()

    room.notifyJoinedPlayerAboutAcceptedChats("p-a")

    expect(sentA).toHaveLength(1)
    expect(sentA[0]).toEqual({
      type: MP_MSG.chatControl,
      payload: expect.objectContaining({
        action: "partner-returned",
        from: "p-b",
        fromName: "Ben",
        to: "p-a",
      }),
    })
  })
})
