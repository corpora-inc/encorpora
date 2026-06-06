import { describe, it, expect, vi } from "vitest"
import type { TradeUpdateMessage } from "@world-plaza/contracts"
import type { TradeProposal } from "../economy/trade"
import type { InteractionProtocol } from "./protocol"
import { ColyseusTradeTransport } from "./tradeTransport"

/** A stub InteractionProtocol that records trade sends. */
function stubProto(localPlayerId = "p-local") {
  const sentTrades: unknown[] = []
  const proto = {
    localPlayerId,
    sendTrade: (env: unknown) => sentTrades.push(env),
  } as unknown as InteractionProtocol
  return { proto, sentTrades }
}

function proposal(id: string, from: string, to: string): TradeProposal {
  const now = Date.now()
  return {
    id,
    fromPlayerId: from,
    toPlayerId: to,
    offer: { items: [], coins: 5 },
    request: { items: [], coins: 0 },
    status: "proposed",
    createdAt: now,
    updatedAt: now,
  }
}

describe("ColyseusTradeTransport", () => {
  it("sends a propose envelope addressed to the partner", async () => {
    const { proto, sentTrades } = stubProto()
    const tt = new ColyseusTradeTransport(proto, (p) => p.toPlayerId)
    await tt.propose(proposal("t-1", "p-local", "p-2"))
    expect(sentTrades).toHaveLength(1)
    expect(sentTrades[0]).toMatchObject({ tradeId: "t-1", to: "p-2", action: "propose" })
  })

  it("surfaces inbound updates for known trades to onUpdate listeners", () => {
    const { proto } = stubProto()
    const tt = new ColyseusTradeTransport(proto, (p) => p.toPlayerId)
    const seen = vi.fn()
    tt.onUpdate(seen)
    const update: TradeUpdateMessage = {
      tradeId: "t-9",
      from: "p-2" as TradeUpdateMessage["from"],
      to: "p-local" as TradeUpdateMessage["to"],
      action: "propose",
      proposal: proposal("t-9", "p-2", "p-local") as unknown as Record<string, unknown>,
    }
    tt.onInbound(update)
    expect(seen).toHaveBeenCalledWith(expect.objectContaining({ id: "t-9" }))
  })

  it("ANTI-GRIEF: ignores updates for a trade we never started (no propose)", () => {
    const { proto } = stubProto()
    const tt = new ColyseusTradeTransport(proto, (p) => p.toPlayerId)
    const seen = vi.fn()
    tt.onUpdate(seen)
    tt.onInbound({
      tradeId: "ghost",
      from: "p-2" as TradeUpdateMessage["from"],
      to: "p-local" as TradeUpdateMessage["to"],
      action: "accept", // an accept for a trade we have no record of
      proposal: proposal("ghost", "p-2", "p-local") as unknown as Record<string, unknown>,
    })
    expect(seen).not.toHaveBeenCalled()
  })

  it("drops an update whose body id mismatches the envelope id", () => {
    const { proto } = stubProto()
    const tt = new ColyseusTradeTransport(proto, (p) => p.toPlayerId)
    const seen = vi.fn()
    tt.onUpdate(seen)
    tt.onInbound({
      tradeId: "t-5",
      from: "p-2" as TradeUpdateMessage["from"],
      to: "p-local" as TradeUpdateMessage["to"],
      action: "propose",
      proposal: proposal("DIFFERENT", "p-2", "p-local") as unknown as Record<string, unknown>,
    })
    expect(seen).not.toHaveBeenCalled()
  })
})
