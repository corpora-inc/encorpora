/**
 * Production multiplayer smoke: matchmaking plus the actual WebSocket upgrade.
 *
 * Usage:
 *   WP_MP_SERVER=wss://example npm run qa:mp-live
 */
import { Client } from "colyseus.js"

const endpoint = process.env.WP_MP_SERVER
if (!endpoint) {
  console.error("WP_MP_SERVER is required")
  process.exit(2)
}

const timeoutMs = Number(process.env.WP_MP_TIMEOUT_MS ?? 20_000)
const client = new Client(endpoint)
const timeout = new Promise((_, reject) => {
  setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
})

try {
  const room = await Promise.race([
    client.joinOrCreate("plaza", {
      playerId: `release-probe-${Date.now()}`,
      name: "Release Probe",
      avatar: { base: "paper-doll-a", layers: [] },
    }),
    timeout,
  ])
  console.log(`PASS: joined ${room.roomId} via ${endpoint}`)
  await room.leave()
} catch (error) {
  console.error(`FAIL: could not join ${endpoint}`)
  console.error(error)
  process.exitCode = 1
}
