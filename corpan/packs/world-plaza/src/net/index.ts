/**
 * src/net — World Plaza realtime presence (Colyseus client).
 *
 * `createNetClient(...)` is the one entry point game.ts wires. It owns the
 * connection, broadcasts local movement, and renders interpolated remote
 * players as grounded cutouts. Best-effort: no server → world runs solo.
 */
export { createNetClient } from "./netClient"
export type {
  NetClient,
  NetClientOptions,
  NetIdentity,
  NetStatus,
  NetRoom,
} from "./netClient"
export { createRemoteAvatar } from "./remoteAvatar"
export type { RemoteAvatar, RemoteAvatarOptions } from "./remoteAvatar"
