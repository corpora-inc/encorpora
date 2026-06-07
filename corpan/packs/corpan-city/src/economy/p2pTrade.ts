import type { InventoryStore } from "./inventory"
import {
  draftProposal,
  validateProposal,
  applyTradeLocally,
  LocalTradeTransport,
  type TradeTransport,
  type TradeProposal,
  type TradeOffer,
} from "./trade"

/**
 * p2pTrade — the seam where the ECONOMY (items, value, anti-cheat) meets the
 * MULTIPLAYER TRANSPORT (the net agent's job).
 *
 * OWNERSHIP SPLIT (per the build contract): I own what a trade IS — the proposal
 * shape, the item value, and the authoritative validation/apply (so neither side
 * can cheat). The multiplayer agent owns HOW two devices exchange it (the
 * Colyseus room messages). Those meet HERE through one interface
 * (`TradeTransport`, defined in `trade.ts`) and one provider seam.
 *
 * FEATURE DETECTION (works solo without the net): the orchestrator registers a
 * `TradeTransportProvider` when (and only when) the net client is online and the
 * partner is present. With NO provider registered, `getTradeTransport()` returns
 * a `LocalTradeTransport` so the whole trade UI + the apply path run solo (the
 * "partner" auto-accepts in-process) — the feature degrades gracefully to a
 * single-player demo instead of disappearing.
 *
 * ANTI-CHEAT: every proposal is `validateProposal`'d against the LIVE store both
 * before send AND at apply time (state may change between). The same predicate is
 * the server's authoritative gate; the local check is the first line. We NEVER
 * apply the partner's side to our bag — only OUR side (consume what we gave, add
 * what we received), so a malicious partner can't make us grant them items.
 */

/**
 * A factory the net layer registers: given the local + partner player ids, return
 * a live `TradeTransport` to that partner, or null when no real partner is
 * reachable (→ caller falls back to the local stub).
 */
export type TradeTransportProvider = (
  fromPlayerId: string,
  toPlayerId: string,
) => TradeTransport | null

let _provider: TradeTransportProvider | null = null

/**
 * Register the real (net-backed) transport provider. The net agent calls this
 * once its room is online; passing `null` unregisters (back to solo). Idempotent.
 */
export function setTradeTransportProvider(provider: TradeTransportProvider | null): void {
  _provider = provider
}

/** Is a real (net-backed) P2P transport available right now? */
export function hasP2pTrade(): boolean {
  return _provider != null
}

/**
 * Resolve a transport to a partner. Returns the registered net transport when one
 * exists for this pair, else a `LocalTradeTransport` (solo demo). Never null — the
 * caller always gets a working transport.
 */
export function getTradeTransport(
  fromPlayerId: string,
  toPlayerId: string,
  localBehavior: "accept" | "decline" = "accept",
): { transport: TradeTransport; live: boolean } {
  if (_provider) {
    try {
      const real = _provider(fromPlayerId, toPlayerId)
      if (real) return { transport: real, live: true }
    } catch (err) {
      console.error("[wp/p2pTrade] transport provider threw; falling back to local:", err)
    }
  }
  return { transport: new LocalTradeTransport(localBehavior), live: false }
}

export interface TradeRunResult {
  status: "applied" | "declined" | "invalid" | "failed"
  /** machine-readable validation reasons when status==="invalid". */
  reasons?: string[]
  /** true when the trade rode a REAL net transport (vs the solo stub). */
  live: boolean
}

/**
 * Run one full trade from this player to a partner: build the proposal from MENU
 * choices (offer ⇄ request, never UGC), validate it locally (anti-cheat), send it
 * over the resolved transport, and on the partner's accept apply OUR side to the
 * live store. Resolves with the outcome. Works solo (local stub) or live (net).
 *
 * The UI builds the `offer`/`request` from owned items + currency steppers and
 * passes them here; this module owns the value/validation/apply so the transport
 * stays a dumb pipe.
 */
export async function runTrade(args: {
  store: InventoryStore
  fromPlayerId: string
  toPlayerId: string
  offer: TradeOffer
  request: TradeOffer
  note?: TradeProposal["note"]
  /** override the solo stub's behavior (tests). Ignored when a real transport is live. */
  localBehavior?: "accept" | "decline"
}): Promise<TradeRunResult> {
  const { store, fromPlayerId, toPlayerId } = args
  const proposal: TradeProposal = {
    ...draftProposal(fromPlayerId, toPlayerId),
    offer: args.offer,
    request: args.request,
    note: args.note,
    status: "proposed",
  }

  // Anti-cheat line 1: validate against the live store before sending.
  const check = validateProposal(store, proposal)
  if (!check.ok) {
    console.warn("[wp/p2pTrade] proposal rejected locally:", check.reasons)
    return { status: "invalid", reasons: check.reasons, live: false }
  }

  const { transport, live } = getTradeTransport(fromPlayerId, toPlayerId, args.localBehavior)

  return await new Promise<TradeRunResult>((resolve) => {
    let done = false
    const settle = (r: TradeRunResult) => {
      if (done) return
      done = true
      off()
      resolve(r)
    }
    const off = transport.onUpdate((p) => {
      if (p.status === "accepted") {
        // Anti-cheat line 2: re-validate ownership at apply time, apply OUR side only.
        if (applyTradeLocally(store, p, "from")) settle({ status: "applied", live })
        else settle({ status: "failed", live })
      } else if (p.status === "declined" || p.status === "cancelled") {
        settle({ status: "declined", live })
      }
    })
    transport.propose(proposal).catch((err) => {
      console.error("[wp/p2pTrade] propose failed:", err)
      settle({ status: "failed", live })
    })
  })
}
