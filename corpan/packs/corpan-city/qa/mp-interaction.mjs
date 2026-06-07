/**
 * Multiplayer INTERACTION smoke test — server handlers end-to-end over a real
 * Colyseus connection (no browser). Boots the presence server, connects two
 * clients, and asserts:
 *   • profile publish + request → a k-anon-coarsened SafeProfile card,
 *   • the k-anonymity gate (a lone country reveals "hidden", not the country),
 *   • an invite round-trip (invited → accept → invite-result accepted),
 *   • chat routes to the intended player with trusted sender/recipient framing,
 *   • a peer-result relay to the other party,
 *   • a trade envelope relays to the partner.
 *
 * Run:  node qa/mp-interaction.mjs   (after `npm run server:install`)
 */
import { Client } from "colyseus.js"
import { spawn } from "node:child_process"
import { setTimeout as sleep } from "node:timers/promises"
import net from "node:net"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const packDir = resolve(__dirname, "..")
const PORT = Number(process.env.WP_MP_PORT ?? 2571)
const WS = `ws://localhost:${PORT}`

const procs = []
const portOpen = (port) =>
  new Promise((res) => {
    const s = net.connect(port, "127.0.0.1")
    s.once("connect", () => { s.destroy(); res(true) })
    s.once("error", () => res(false))
  })
async function waitPort(port, label, tries = 60) {
  for (let i = 0; i < tries; i++) { if (await portOpen(port)) return; await sleep(250) }
  throw new Error(`${label} never came up on :${port}`)
}
function cleanup() { for (const p of procs) { try { process.kill(-p.pid, "SIGTERM") } catch {} } }

let failures = 0
const check = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { console.error(`  ✗ ${msg}`); failures++ } }
/** Wait for a message of `type`, or null after `ms`. */
function waitMsg(room, type, ms = 3000) {
  return new Promise((res) => {
    const t = setTimeout(() => res(null), ms)
    room.onMessage(type, (m) => { clearTimeout(t); res(m) })
  })
}

async function main() {
  const reuse = process.env.WP_MP_REUSE === "1"
  if (!reuse) {
    const server = spawn("npm", ["run", "server"], {
      cwd: packDir, stdio: "pipe", detached: true,
      env: { ...process.env, PORT: String(PORT) },
    })
    server.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`))
    server.stderr.on("data", (d) => process.stderr.write(`[srv] ${d}`))
    procs.push(server)
  }
  await waitPort(PORT, "colyseus server")
  await sleep(400)

  const ca = new Client(WS)
  const cb = new Client(WS)
  const a = await ca.joinOrCreate("plaza", { playerId: "pA", name: "Ada", avatar: { base: "paper-doll-a", layers: [] } })
  const b = await cb.joinOrCreate("plaza", { playerId: "pB", name: "Ben", avatar: { base: "paper-doll-a", layers: [] } })
  check(a.sessionId !== b.sessionId, "two clients in one plaza")

  // 1) k-anonymity: a lone JP player → A requests B's card → place hidden.
  b.send("profile-publish", { stack: { target: "ja", native: "en" }, country: "JP", continent: "asia" })
  a.send("profile-publish", { stack: { target: "es", native: "en" }, country: "US", continent: "north-america" })
  await sleep(200)
  a.send("profile-request", { target: "pB" })
  const card = await waitMsg(a, "profile-card")
  check(!!card, "A received a profile-card for B")
  check(card?.name === "Ben", "card carries B's safe name")
  check(card?.stack?.target === "ja", "card reveals B's stack (learning ja)")
  check(card?.place?.granularity === "hidden", "k-anon: lone JP player's place is HIDDEN (not 'JP')")

  // A third connection cannot steal B's routing id.
  const cc = new Client(WS)
  const c = await cc.joinOrCreate("plaza", { playerId: "pB", name: "Eve", avatar: { base: "paper-doll-a", layers: [] } })
  const cardAfterCollisionP = waitMsg(a, "profile-card")
  a.send("profile-request", { target: "pB" })
  const cardAfterCollision = await cardAfterCollisionP
  check(cardAfterCollision?.name === "Ben", "duplicate playerId cannot overwrite B's routing entry")

  // 2) invite round-trip: A invites B to chat; B accepts; A gets 'accepted'.
  const inviteId = "inv-test-1"
  const invitedP = waitMsg(b, "invited")
  a.send("invite", { inviteId, to: "pB", offer: { kind: "chat" } })
  const invited = await invitedP
  check(invited?.inviteId === inviteId, "B received the invite")
  check(invited?.from === "pA" && invited?.fromName === "Ada", "invite carries A's trusted id + name")
  const resultP = waitMsg(a, "invite-result")
  b.send("invite-respond", { inviteId, action: "accept" })
  const result = await resultP
  check(result?.outcome === "accepted", "A learned the invite was accepted")

  // 3) chat relay: server stamps the trusted sender and B's learning target.
  const chatP = waitMsg(b, "chat-deliver")
  a.send("chat-send", {
    from: "pB", // forged; server must replace it with pA
    to: "pB",
    interactionId: "chat-1",
    source: { kind: "text", text: "cleaned safe intent" },
    sourceLanguage: "fr",
    targetLanguage: "fr",
    mode: "beginner",
  })
  const chat = await chatP
  check(chat?.from === "pA" && chat?.to === "pB", "chat routed with trusted sender + recipient ids")
  check(chat?.targetLanguage === "ja", "chat framed for B's learning language")
  check(chat?.source?.text === "cleaned safe intent", "only the locally-cleaned intent was relayed")

  // 4) peer-result relay: B reports a result on the accepted invite → A receives it.
  const peerP = waitMsg(a, "peer-result-deliver")
  b.send("peer-result", {
    inviteId,
    result: { challengeId: "c", toolId: "translate-fast", playerId: "pB", score: 0.7, detail: {}, xp: [], completedAt: Date.now(), offline: true },
  })
  const peer = await peerP
  check(peer?.result?.score === 0.7, "peer challenge result relayed to the other party")

  // 5) trade relay: A sends a trade envelope → B receives it with A stamped.
  const tradeP = waitMsg(b, "trade-update")
  a.send("trade", { tradeId: "t-1", to: "pB", action: "propose", proposal: { id: "t-1" } })
  const tu = await tradeP
  check(tu?.tradeId === "t-1" && tu?.from === "pA", "trade envelope relayed with trusted sender")

  await a.leave(); await b.leave(); await c.leave()
  console.log(failures === 0 ? "\nALL INTERACTION CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`)
}

main()
  .catch((e) => { console.error("harness error:", e); failures++ })
  .finally(async () => { await sleep(200); cleanup(); process.exit(failures === 0 ? 0 : 1) })
