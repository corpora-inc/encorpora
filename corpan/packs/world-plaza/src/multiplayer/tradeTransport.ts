import type { TradeEnvelope, TradeUpdateMessage } from "@world-plaza/contracts"
import type { TradeProposal, TradeTransport } from "../economy/trade"
import type { InteractionProtocol } from "./protocol"

/**
 * tradeTransport.ts — the Colyseus-backed implementation of the economy layer's
 * `TradeTransport` seam (`src/economy/trade.ts`).
 *
 * OWNERSHIP SPLIT (by design): the economy agent owns the ITEMS, the rich
 * `TradeProposal` shape, validation, fairness rules, and the atomic apply. WE
 * own only the TRANSPORT — getting a proposal/response to the partner over the
 * room, sequencing it, and routing partner updates back. The proposal body is
 * carried opaquely in a `TradeEnvelope.proposal` field, so the economy agent can
 * evolve `TradeProposal` freely without touching us or the contract.
 *
 * Anti-grief: the server rate-limits + size-bounds envelopes; here we additionally
 * drop self-addressed proposals and updates for trades we never started, and we
 * never auto-apply — apply is the economy layer's decision on a mutual accept.
 *
 * Graceful degradation: when there is no room (offline / no server), the game
 * uses the economy layer's `LocalTradeTransport` stub instead — this class is
 * only constructed when a real `InteractionProtocol` exists.
 */
export class ColyseusTradeTransport implements TradeTransport {
  private listeners = new Set<(p: TradeProposal) => void>()
  /** trade ids WE are a party to, so we ignore stray/forged updates. */
  private known = new Set<string>()

  constructor(
    private proto: InteractionProtocol,
    /** resolve the partner's PlayerId for a proposal (proposer's `toPlayerId`). */
    private partnerOf: (p: TradeProposal) => string,
  ) {}

  /** Wire the protocol's inbound trade updates into our listener fan-out. */
  attach(): () => void {
    // The protocol is created with handlers; we expose a method the init wiring
    // calls to forward inbound updates. See `onInbound`.
    return () => this.listeners.clear()
  }

  /** Called by the init wiring when a `trade-update` arrives from a partner. */
  onInbound(msg: TradeUpdateMessage): void {
    const body = msg.proposal as unknown as TradeProposal
    if (!body || typeof body !== "object" || body.id !== msg.tradeId) {
      console.warn("[mp/trade] dropping update with mismatched/absent proposal body")
      return
    }
    // Only surface updates for trades we're a party to (we proposed, or this is a
    // fresh proposal addressed to us).
    if (msg.action === "propose") this.known.add(msg.tradeId)
    if (!this.known.has(msg.tradeId)) {
      console.warn(`[mp/trade] ignoring update for unknown trade ${msg.tradeId}`)
      return
    }
    this.emit(body)
  }

  async propose(p: TradeProposal): Promise<void> {
    this.known.add(p.id)
    this.send(p, "propose")
  }

  async respond(
    proposalId: string,
    action: "accept" | "decline",
    counter?: TradeProposal,
  ): Promise<void> {
    if (counter) {
      this.known.add(counter.id)
      this.send(counter, "counter")
      return
    }
    // Respond carries the proposal id only; reflect the action with the latest
    // proposal status the economy layer set on it. We send a minimal envelope.
    this.sendRaw({
      tradeId: proposalId,
      to: this.toPlayerIdFor(proposalId),
      action,
      proposal: { id: proposalId, status: action === "accept" ? "accepted" : "declined" },
    })
  }

  onUpdate(fn: (p: TradeProposal) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /* ----------------------------------------------------------- internals */

  private send(p: TradeProposal, action: TradeEnvelope["action"]): void {
    this.sendRaw({
      tradeId: p.id,
      to: this.partnerOf(p),
      action,
      proposal: p as unknown as Record<string, unknown>,
    })
  }

  /** Send a trade envelope. `to` is a plain string (the economy proposal's
   *  party id); branded as PlayerId at the wire boundary (`sendTrade` revalidates). */
  private sendRaw(env: Omit<TradeEnvelope, "to"> & { to: string }): void {
    this.proto.sendTrade(env as TradeEnvelope)
  }

  /** Best-effort partner lookup for a bare proposalId (we only know parties we
   *  proposed to — fall back to empty, the server drops an unroutable envelope). */
  private toPlayerIdFor(_proposalId: string): string {
    return this.lastPartner ?? ""
  }
  private lastPartner: string | undefined

  private emit(p: TradeProposal): void {
    this.lastPartner = p.fromPlayerId === this.proto.localPlayerId ? p.toPlayerId : p.fromPlayerId
    for (const fn of this.listeners) {
      try {
        fn(p)
      } catch (e) {
        console.error("[mp/trade] listener threw:", e)
      }
    }
  }
}
