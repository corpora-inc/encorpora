import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { Server } from "@colyseus/core"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { RoomTopology } from "@world-plaza/contracts"
import { PlazaRoom } from "./PlazaRoom.js"

/**
 * World Plaza presence server boot.
 *
 *   • Loads the active room topology (plaza-grand) ONCE and hands it to every
 *     PlazaRoom for authoritative bounds/spawn validation.
 *   • Defines a single logical room type, "plaza". Matchmaking fills one room to
 *     ~30 (PlazaRoom.maxClients) then transparently spins a sibling — so "join
 *     plaza" always lands you in a room with headroom, and two windows joining
 *     at once share the SAME room (the M1 wow).
 *
 * Port is configurable via PORT (default 2567).
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 2567)

// The topology lives in the pack content; the server reuses the SAME file the
// client renders, so bounds/spawns are guaranteed identical (one source).
const topologyPath = resolve(__dirname, "../../content/topologies/plaza-grand.json")
const topology = RoomTopology.parse(JSON.parse(readFileSync(topologyPath, "utf8")))

const gameServer = new Server({
  transport: new WebSocketTransport({ server: createServer() }),
})

gameServer
  .define("plaza", PlazaRoom, { topology })
  // Fill rooms before opening new ones: matchmaking prefers the most-occupied
  // room with free slots, so a freshly-joined pair shares a plaza until it's
  // full, then a sibling spins for the next cohort.
  .sortBy({ clients: -1 })
  .enableRealtimeListing()

gameServer
  .listen(PORT)
  .then(() => console.log(`[plaza] presence server listening on :${PORT} (topology ${topology.id})`))
  .catch((err) => {
    console.error("[plaza] failed to start:", err)
    process.exit(1)
  })

// Clean shutdown so dev restarts don't leak the port.
const shutdown = () => {
  console.log("[plaza] shutting down…")
  gameServer.gracefullyShutdown().then(() => process.exit(0))
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
