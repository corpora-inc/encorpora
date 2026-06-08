import { describe, expect, it, vi } from "vitest"
import type { Room } from "colyseus.js"
import { createResilientRoom, type RoomTransport } from "./resilientRoom.js"

/**
 * A minimal stand-in for a colyseus.js Room exposing only the lifecycle surface
 * resilientRoom touches. `drop(code)` simulates the server/socket closing.
 */
function fakeRoom(token: string) {
  let leaveCb: ((code: number) => void) | null = null
  const room = {
    reconnectionToken: token,
    onError: vi.fn(),
    onLeave: (cb: (code: number) => void) => {
      leaveCb = cb
    },
    leave: vi.fn(async () => {}),
  }
  return {
    room: room as unknown as Room,
    drop: (code: number) => leaveCb?.(code),
  }
}

/** A controllable timer + clock harness so backoff/rejoin windows are deterministic. */
function harness() {
  let clock = 1_000_000
  let nextId = 1
  const pending = new Map<number, () => void>()
  return {
    now: () => clock,
    advance: (ms: number) => {
      clock += ms
    },
    scheduleTimer: (fn: () => void) => {
      const id = nextId++
      pending.set(id, fn)
      return id as unknown as ReturnType<typeof setTimeout>
    },
    clearTimer: (h: ReturnType<typeof setTimeout>) => {
      pending.delete(h as unknown as number)
    },
    /** run every scheduled timer once (mirrors backoff firing). */
    flush: () => {
      const fns = [...pending.values()]
      pending.clear()
      for (const fn of fns) fn()
    },
    pendingCount: () => pending.size,
  }
}

describe("resilientRoom", () => {
  it("joins and reports online, handing the room to onRoom", async () => {
    const h = harness()
    const { room } = fakeRoom("tok-1")
    const transport: RoomTransport = {
      join: vi.fn(async () => room),
      reconnect: vi.fn(async () => room),
    }
    const onRoom = vi.fn()
    const statuses: string[] = []
    createResilientRoom({
      transport,
      onRoom,
      onStatus: (s) => statuses.push(s),
      now: h.now,
      scheduleTimer: h.scheduleTimer,
      clearTimer: h.clearTimer,
      bindWindowWakers: false,
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(transport.join).toHaveBeenCalledTimes(1)
    expect(onRoom).toHaveBeenCalledWith(room)
    expect(statuses).toContain("connecting")
    expect(statuses.at(-1)).toBe("online")
  })

  it("reconnects with the saved token after a non-clean drop", async () => {
    const h = harness()
    const first = fakeRoom("tok-1")
    const second = fakeRoom("tok-2")
    const transport: RoomTransport = {
      join: vi.fn(async () => first.room),
      reconnect: vi.fn(async () => second.room),
    }
    const onRoom = vi.fn()
    const onRoomLost = vi.fn()
    const conn = createResilientRoom({
      transport,
      onRoom,
      onRoomLost,
      now: h.now,
      scheduleTimer: h.scheduleTimer,
      clearTimer: h.clearTimer,
      bindWindowWakers: false,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(conn.status()).toBe("online")

    // socket drops (not a clean 1000)
    first.drop(1006)
    expect(onRoomLost).toHaveBeenCalledTimes(1)
    expect(conn.status()).toBe("reconnecting")

    // backoff fires → reconnect with token
    h.flush()
    await Promise.resolve()
    await Promise.resolve()

    expect(transport.reconnect).toHaveBeenCalledWith("tok-1")
    expect(onRoom).toHaveBeenCalledTimes(2)
    expect(onRoom).toHaveBeenLastCalledWith(second.room)
    expect(conn.status()).toBe("online")
  })

  it("fresh-joins (no token) once the rejoin window has passed", async () => {
    const h = harness()
    const first = fakeRoom("tok-1")
    const fresh = fakeRoom("tok-9")
    const transport: RoomTransport = {
      join: vi.fn(async () => (transport.join as ReturnType<typeof vi.fn>).mock.calls.length === 1 ? first.room : fresh.room),
      reconnect: vi.fn(async () => {
        throw new Error("seat reservation expired")
      }),
    }
    const conn = createResilientRoom({
      transport,
      onRoom: vi.fn(),
      now: h.now,
      scheduleTimer: h.scheduleTimer,
      clearTimer: h.clearTimer,
      rejoinWindowMs: 95_000,
      bindWindowWakers: false,
    })
    await Promise.resolve()
    await Promise.resolve()

    first.drop(1006)
    h.advance(200_000) // well past the rejoin window
    h.flush()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    // reconnect was attempted, failed, then a fresh join happened
    expect(transport.reconnect).toHaveBeenCalled()
    expect((transport.join as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2)
    expect(conn.status()).toBe("online")
  })

  it("does not reconnect after a clean (consented) close", async () => {
    const h = harness()
    const first = fakeRoom("tok-1")
    const transport: RoomTransport = {
      join: vi.fn(async () => first.room),
      reconnect: vi.fn(async () => first.room),
    }
    const conn = createResilientRoom({
      transport,
      onRoom: vi.fn(),
      now: h.now,
      scheduleTimer: h.scheduleTimer,
      clearTimer: h.clearTimer,
      bindWindowWakers: false,
    })
    await Promise.resolve()
    await Promise.resolve()

    first.drop(1000) // clean close
    expect(conn.status()).toBe("offline")
    expect(h.pendingCount()).toBe(0) // no reconnect scheduled
  })

  it("stops reconnecting after dispose", async () => {
    const h = harness()
    const first = fakeRoom("tok-1")
    const transport: RoomTransport = {
      join: vi.fn(async () => first.room),
      reconnect: vi.fn(async () => first.room),
    }
    const conn = createResilientRoom({
      transport,
      onRoom: vi.fn(),
      now: h.now,
      scheduleTimer: h.scheduleTimer,
      clearTimer: h.clearTimer,
      bindWindowWakers: false,
    })
    await Promise.resolve()
    await Promise.resolve()

    conn.dispose()
    expect(first.room.leave).toHaveBeenCalled()
    first.drop(1006)
    h.flush()
    await Promise.resolve()
    expect(transport.reconnect).not.toHaveBeenCalled()
  })
})
