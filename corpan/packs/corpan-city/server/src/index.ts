import { createServer } from "node:http"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { Server } from "@colyseus/core"
import { WebSocketTransport } from "@colyseus/ws-transport"
import { RoomTopology } from "@corpan-city/contracts"
import { PlazaRoom } from "./PlazaRoom.js"
import { createMemoryOutbox } from "./outbox.js"

/**
 * Corpan City presence server boot.
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

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" })
    res.end("ok")
    return
  }
  res.writeHead(404)
  res.end()
})

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
})

// The Teletron living-link window: a penpal stays reachable (and their buffered
// messages survive) for 24h of inactivity, then the link drifts away.
const TELETRON_LINK_TTL_MS = 24 * 60 * 60 * 1000

// The ONLY server-side message state: a bounded, self-expiring store-and-forward
// buffer for messages to momentarily-offline penpals. One shared instance so a
// returning player is reachable no matter which Teletron room they land in. No
// conversation history, no social graph — those live on each device.
const teletronOutbox = createMemoryOutbox()
const sweepTimer = setInterval(() => teletronOutbox.sweep(Date.now()), 60_000)
sweepTimer.unref?.()

gameServer
  .define("plaza", PlazaRoom, {
    topology,
    reconnectionSeconds: 90,
    replaceDuplicatePlayerId: true,
  })
  // Fill rooms before opening new ones: matchmaking prefers the most-occupied
  // room with free slots, so a freshly-joined pair shares a plaza until it's
  // full, then a sibling spins for the next cohort.
  .sortBy({ clients: -1 })
  .enableRealtimeListing()

// Teletron reuses the exact same privacy + invite + mediated-chat protocol, but
// its waiting room needs to see everyone rather than nearby city avatars. A
// huge AOI cell keeps the full lobby in one view without introducing a second
// server implementation or another paid service. Country reveal is still an
// explicit client toggle, but Teletron shows it directly instead of using the
// plaza's k-anonymity gate.
gameServer
  .define("teletron", PlazaRoom, {
    topology,
    roomLabel: "teletron",
    maxClients: 100,
    // Hold the seat across a brief background/flaky-network drop so a quick
    // return reconnects in place and the partner never sees you leave.
    reconnectionSeconds: 90,
    replaceDuplicatePlayerId: true,
    placeReveal: "country",
    aoi: { cellSize: 10000, radius: 1 },
    // Async penpal support: 24h living link + buffered delivery to offline peers.
    outbox: teletronOutbox,
    acceptedPairTtlMs: TELETRON_LINK_TTL_MS,
  })
  .sortBy({ clients: -1 })
  .enableRealtimeListing()

gameServer
  .listen(PORT)
  .then(() =>
    console.log(
      `[presence] server listening on :${PORT} (rooms plaza, teletron; topology ${topology.id})`,
    ),
  )
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
