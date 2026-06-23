import { describe, expect, it } from "vitest"
import { MP_MSG } from "@corpan-city/contracts"
import { PlazaRoom } from "./PlazaRoom.js"
import { createMemoryOutbox, type Outbox } from "./outbox.js"

type SentMessage = { type: string; payload: unknown }

/** A PlazaRoom stub exposing just the fields the outbox glue touches. */
type OutboxRoom = {
  outbox: Outbox
  roomLabel: string
  acceptedPairs: Map<string, { a: string; b: string; kind: "chat"; expiresAt: number }>
  flushOutbox: (playerId: string, client: { send: (t: string, p: unknown) => void }) => void
  // private; reached via prototype for the test
  forgetAcceptedPair: (a: string, b: string, kind: "chat") => void
}

function roomWithOutbox(outbox: Outbox): OutboxRoom {
  const room = Object.create(PlazaRoom.prototype) as OutboxRoom
  room.outbox = outbox
  room.roomLabel = "teletron"
  room.acceptedPairs = new Map()
  return room
}

describe("PlazaRoom outbox integration", () => {
  it("flushes buffered messages to a returning player, then forgets them", () => {
    const outbox = createMemoryOutbox()
    // flushOutbox drains against real Date.now(), so keep these well in-window.
    const expiresAt = Date.now() + 60_000
    outbox.enqueue({ to: "p-b", from: "p-a", payload: { hello: 1 }, ts: Date.now(), expiresAt })
    outbox.enqueue({ to: "p-b", from: "p-a", payload: { hello: 2 }, ts: Date.now(), expiresAt })

    const room = roomWithOutbox(outbox)
    const sent: SentMessage[] = []
    room.flushOutbox("p-b", { send: (type, payload) => sent.push({ type, payload }) })

    expect(sent).toHaveLength(2)
    expect(sent.every((m) => m.type === MP_MSG.chatDeliver)).toBe(true)
    expect(sent.map((m) => m.payload)).toEqual([{ hello: 1 }, { hello: 2 }])
    // delete-on-delivery: a second flush delivers nothing
    const again: SentMessage[] = []
    room.flushOutbox("p-b", { send: (type, payload) => again.push({ type, payload }) })
    expect(again).toHaveLength(0)
  })

  it("clears buffered messages when an accepted chat link is forgotten", () => {
    const outbox = createMemoryOutbox()
    outbox.enqueue({ to: "p-b", from: "p-a", payload: {}, ts: 1, expiresAt: 1_000_000 })
    const room = roomWithOutbox(outbox)
    room.acceptedPairs.set("chat:p-a:p-b", { a: "p-a", b: "p-b", kind: "chat", expiresAt: 1_000_000 })

    room.forgetAcceptedPair("p-a", "p-b", "chat")

    expect(room.acceptedPairs.has("chat:p-a:p-b")).toBe(false)
    expect(outbox.size()).toBe(0) // the pair's buffered message is dropped
  })
})
