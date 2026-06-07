/**
 * src/multiplayer — player-to-player INTERACTION (presence is in src/net).
 *
 * `initMultiplayer(...)` is the ONE entry point game.ts wires. It layers safe
 * profile reveal, LLM-mediated cross-language chat, peer challenges, and a trade
 * transport on top of presence — all additive + feature-detected, so the
 * single-player game runs untouched with no server.
 *
 * The economy agent consumes `MultiplayerHandle.tradeTransport()` (a
 * Colyseus-backed `TradeTransport`) and drives the trade UI/rules themselves.
 */
export { initMultiplayer, resolveServerUrl } from "./initMultiplayer"
export type { MultiplayerOptions, MultiplayerHandle } from "./initMultiplayer"
export { createProtocol, mintId } from "./protocol"
export type { InteractionProtocol, ProtocolHandlers } from "./protocol"
export { createChatMediator } from "./mediatedChat"
export type { ChatMediator, PrepareOutboundArgs } from "./mediatedChat"
export { runPeerChallenge } from "./peerChallenge"
export type { PeerChallengeOutcome, PeerChallengeHooks } from "./peerChallenge"
export { ColyseusTradeTransport } from "./tradeTransport"
export { detectCountry, continentOf } from "./geo"
