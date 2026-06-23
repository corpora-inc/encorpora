import { beforeEach, describe, expect, it } from "vitest"
import { StateView } from "@colyseus/schema"
import { MP_MSG, RoomTopology } from "@corpan-city/contracts"
import { PlazaRoom, type PlazaJoinOptions } from "./PlazaRoom.js"
import { createMemoryOutbox, type Outbox } from "./outbox.js"

/**
 * End-to-end interaction test for the Teletron async-penpal transport. Drives
 * the REAL PlazaRoom handlers (no stubs) with fake clients so we exercise the
 * actual id routing, accepted-pair auth, live delivery, and the offline→online
 * outbox drain — the three things that were broken in production.
 *
 * A fake client mimics just enough of the Colyseus Client surface: a sessionId,
 * a real StateView (so view.add/remove are no-ops on a headless schema), and a
 * `send` spy capturing every server→client message.
 */

type Sent = { type: string; payload: unknown }

interface FakeClient {
  sessionId: string
  view: StateView
  send: (type: string, payload: unknown) => void
  leave: (code?: number, reason?: string) => void
  sent: Sent[]
}

const TOPOLOGY = RoomTopology.parse({
  id: "plaza-grand",
  bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
  spawns: [
    { x: 0, z: 0 },
    { x: 5, z: 0 },
    { x: -5, z: 0 },
  ],
  blockers: [],
  anchors: [],
}) satisfies RoomTopology

let nextSession = 0

function makeClient(): FakeClient {
  const sent: Sent[] = []
  const client: FakeClient = {
    sessionId: `s${++nextSession}`,
    view: new StateView(),
    send: (type, payload) => sent.push({ type, payload }),
    leave: () => {},
    sent,
  }
  return client
}

/** Construct a live room with the teletron config (outbox + 24h TTL). */
function makeRoom(outbox: Outbox): PlazaRoom {
  const room = new PlazaRoom()
  // onCreate registers all handlers + sets state. We pass the teletron options.
  room.onCreate({
    topology: TOPOLOGY,
    roomLabel: "teletron",
    maxClients: 100,
    reconnectionSeconds: 0, // no reconnect grace in tests → leave removes immediately
    replaceDuplicatePlayerId: true,
    placeReveal: "country",
    aoi: { cellSize: 10000, radius: 1 },
    outbox,
    acceptedPairTtlMs: 24 * 60 * 60 * 1000,
  })
  return room
}

interface RoomInternals {
  onMessageHandlers: Record<string, { callback: (client: unknown, message: unknown) => void }>
  onJoin: (client: unknown, options: PlazaJoinOptions) => void
  onLeave: (client: unknown, consented?: boolean) => Promise<void>
}

const internals = (room: PlazaRoom): RoomInternals => room as unknown as RoomInternals

/** Dispatch a typed client→server message through the real handler. */
function dispatch(room: PlazaRoom, client: FakeClient, type: string, payload: unknown): void {
  const handler = internals(room).onMessageHandlers[type]
  if (!handler) throw new Error(`no handler for ${type}`)
  handler.callback(client, payload)
}

function join(room: PlazaRoom, client: FakeClient, opts: PlazaJoinOptions): void {
  internals(room).onJoin(client, opts)
}

/** Publish a minimal profile so the server records the language stack + flushes. */
function publish(room: PlazaRoom, client: FakeClient, native = "en", target = "es"): void {
  dispatch(room, client, MP_MSG.profilePublish, {
    stack: { native, target, alsoLearning: [] },
    revealStack: true,
  })
}

/** Drive the accept handshake: A invites B (chat), B accepts. */
function acceptChat(
  room: PlazaRoom,
  a: FakeClient,
  aId: string,
  b: FakeClient,
  bId: string,
): void {
  const inviteId = `inv-${aId}-${bId}`
  dispatch(room, a, MP_MSG.invite, { inviteId, to: bId, offer: { kind: "chat" } })
  dispatch(room, b, MP_MSG.inviteRespond, { inviteId, action: "accept" })
}

function chatInput(from: string, to: string, text: string) {
  return {
    from,
    to,
    interactionId: `chat-${text}`,
    source: { kind: "text", text },
    sourceLanguage: "en",
    targetLanguage: "es",
    mode: "beginner",
  }
}

function delivered(client: FakeClient) {
  return client.sent.filter((m) => m.type === MP_MSG.chatDeliver)
}

beforeEach(() => {
  nextSession = 0
})

describe("Teletron live + async penpal transport (real PlazaRoom)", () => {
  it("delivers a message live when both peers are online and paired", () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)
    acceptChat(room, a, "p-a", b, "p-b")

    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "hello"))

    const got = delivered(b)
    expect(got).toHaveLength(1)
    expect((got[0].payload as { source: { text: string } }).source.text).toBe("hello")
    // Live delivery must NOT go through the outbox.
    expect(outbox.size()).toBe(0)
  })

  it("delivers in BOTH directions over the same accepted pair", () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)
    acceptChat(room, a, "p-a", b, "p-b")

    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "from-a"))
    dispatch(room, b, MP_MSG.chatSend, chatInput("p-b", "p-a", "from-b"))

    expect(delivered(b)).toHaveLength(1)
    expect(delivered(a)).toHaveLength(1)
  })

  it("buffers a message for an offline peer and drains it on their return (publish)", async () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)
    acceptChat(room, a, "p-a", b, "p-b")

    // B leaves (consented, no reconnect grace → removed immediately).
    await internals(room).onLeave(b, true)

    // A sends while B is offline → must buffer, not drop.
    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "while-away"))
    expect(outbox.size()).toBe(1)

    // B returns: new session, SAME playerId. Re-binds handlers, then publishes.
    const b2 = makeClient()
    join(room, b2, { playerId: "p-b", name: "Ben" })
    publish(room, b2)

    const got = delivered(b2)
    expect(got).toHaveLength(1)
    expect((got[0].payload as { source: { text: string } }).source.text).toBe("while-away")
    expect(outbox.size()).toBe(0) // delete-on-delivery
  })

  it("lets a partner leave and REJOIN, then keeps delivering live", async () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)
    acceptChat(room, a, "p-a", b, "p-b")

    // B steps away and comes back on a fresh session (the "rejoin" case).
    await internals(room).onLeave(b, true)
    const b2 = makeClient()
    join(room, b2, { playerId: "p-b", name: "Ben" })
    publish(room, b2)

    // The accepted pair must survive the rejoin so a LIVE send still routes.
    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "after-rejoin"))
    const got = delivered(b2)
    expect(got).toHaveLength(1)
    expect((got[0].payload as { source: { text: string } }).source.text).toBe("after-rejoin")
  })

  it("survives a duplicate-playerId replace (two tabs) without losing the live channel", () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)
    acceptChat(room, a, "p-a", b, "p-b")

    // B opens a second tab with the SAME playerId → server replaces the old
    // session. The newest session must own the live channel.
    const b2 = makeClient()
    join(room, b2, { playerId: "p-b", name: "Ben" })
    publish(room, b2)

    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "to-newest-tab"))
    expect(delivered(b2)).toHaveLength(1)
    expect(delivered(b)).toHaveLength(0) // the replaced tab gets nothing
  })

  it("signals link-stale (not silent drop) when the server forgot the pair", () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    // Both fresh-join a fresh server (post-restart): no accepted pair exists,
    // even though they were penpals before (durable transcripts are on-device).
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)

    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "are-you-there"))

    // The message is NOT delivered and NOT silently dropped — A is told the link
    // is stale so the client can re-establish it.
    expect(delivered(b)).toHaveLength(0)
    expect(outbox.size()).toBe(0)
    const controls = a.sent.filter((m) => m.type === MP_MSG.chatControl)
    expect(controls).toHaveLength(1)
    expect(controls[0].payload).toMatchObject({ action: "link-stale", from: "p-b", to: "p-a" })
    // The reply MUST echo the rejected message's interactionId so the client can
    // requeue that exact message instead of losing it (the confirmed-locally /
    // stale-on-server case).
    expect(controls[0].payload.interactionId).toBe("chat-are-you-there")
  })

  it("re-establishes a forgotten pair via a fresh invite/accept, then delivers", () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)

    // No pair yet → A's send is refused with link-stale.
    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "first-try"))
    expect(delivered(b)).toHaveLength(0)

    // The client re-establishes the link (its silent resume invite); B is an
    // established penpal so the client auto-accepts → the server forms the pair.
    acceptChat(room, a, "p-a", b, "p-b")
    // A flushes the queued message.
    dispatch(room, a, MP_MSG.chatSend, chatInput("p-a", "p-b", "first-try"))

    const got = delivered(b)
    expect(got).toHaveLength(1)
    expect((got[0].payload as { source: { text: string } }).source.text).toBe("first-try")
  })

  it("idempotent re-invite when the pair still exists returns accepted immediately", () => {
    const outbox = createMemoryOutbox()
    const room = makeRoom(outbox)
    const a = makeClient()
    const b = makeClient()
    join(room, a, { playerId: "p-a", name: "Ada" })
    join(room, b, { playerId: "p-b", name: "Ben" })
    publish(room, a)
    publish(room, b)
    acceptChat(room, a, "p-a", b, "p-b")

    // A "resume" invite while the pair is already live → server short-circuits to
    // accepted without bothering B with a fresh invite prompt.
    a.sent.length = 0
    b.sent.length = 0
    dispatch(room, a, MP_MSG.invite, { inviteId: "resume-1", to: "p-b", offer: { kind: "chat" } })
    const results = a.sent.filter((m) => m.type === MP_MSG.inviteResult)
    expect(results).toHaveLength(1)
    expect(results[0].payload).toMatchObject({ inviteId: "resume-1", outcome: "accepted" })
    // B was NOT re-prompted with an `invited`.
    expect(b.sent.filter((m) => m.type === MP_MSG.invited)).toHaveLength(0)
  })
})
