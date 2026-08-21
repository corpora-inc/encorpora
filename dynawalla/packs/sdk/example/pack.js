// The smallest thing that is a pack.
//
// It is plain JavaScript with no build step, so the handshake is written out by
// hand. A real pack bundles the SDK and writes:
//
//     import { connect } from "@dynawalla/pack-sdk"
//     const host = await connect()
//     const item = await host.nextItem()
//
// which is the same three messages with types on them. Everything below the
// `connect` function here is what any pack does: draw the item, collect a
// response, hand it to the host, draw what the host said.
//
// Note what is NOT here. There is no arithmetic. The pack does not know what
// 5001 − 2798 is and never computes it — it sends the child's response to the
// host and is told. That is the rule the whole contract exists to enforce: a
// game cannot be beaten by fiddling with the game, because the thing that
// decides whether the child was right is not in it.

function connect() {
  return new Promise((resolve, reject) => {
    if (window.parent === window) {
      reject(new Error("not framed by a host"))
      return
    }
    const timer = setTimeout(() => reject(new Error("no host")), 15000)
    addEventListener("message", function onMessage(event) {
      if (!event.data || event.data.event !== "connect") return
      const port = event.ports[0]
      if (!port) return
      clearTimeout(timer)
      removeEventListener("message", onMessage)

      const pending = new Map()
      let nextId = 1
      port.onmessage = (message) => {
        const { id, ok, result, error } = message.data ?? {}
        const entry = pending.get(id)
        if (!entry) return
        pending.delete(id)
        if (ok) entry.resolve(result)
        else entry.reject(new Error(error?.code ?? "failed"))
      }
      port.start()

      const call = (method, params = {}) =>
        new Promise((ok2, no) => {
          const id = nextId++
          pending.set(id, { resolve: ok2, reject: no })
          port.postMessage({ id, method, params })
        })

      resolve({ granted: event.data.granted, settings: event.data.settings, call })
    })
    window.parent.postMessage({ event: "ready", protocol: 1 }, "*")
  })
}

const problem = document.getElementById("problem")
const entry = document.getElementById("entry")
const keys = document.getElementById("keys")

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"]

async function main() {
  const host = await connect()
  const canHaptic = host.granted.includes("haptics")

  let item = null
  let typed = ""
  let shownAt = 0

  const draw = () => {
    problem.textContent = item ? `${item.operands[0]} ${item.operator} ${item.operands[1]}` : ""
    entry.textContent = typed
  }

  const serve = async () => {
    typed = ""
    item = await host.call("items.next")
    item = item.item
    shownAt = performance.now()
    draw()
  }

  const submit = async () => {
    if (!item || typed === "") return
    const judgement = await host.call("items.answer", {
      itemId: item.id,
      response: typed,
      latencyMs: Math.round(performance.now() - shownAt),
      revisions: 0,
    })
    // The canonical value arrives only now, after the attempt is on record.
    entry.textContent = judgement.correct ? typed : `${typed} → ${judgement.canonical}`
    if (canHaptic) await host.call("feedback.haptic", { cue: judgement.correct ? "seat" : "refuse" })
    if (judgement.advance) setTimeout(serve, 900)
  }

  for (const label of KEYS) {
    const key = document.createElement("button")
    key.type = "button"
    key.textContent = label
    key.addEventListener("click", () => {
      if (label === "⌫") typed = typed.slice(0, -1)
      else if (label === "✓") return void submit()
      else if (typed.length < 6) typed += label
      draw()
    })
    keys.append(key)
  }

  await serve()
}

main().catch((error) => {
  // A pack that cannot reach a host says so on its own surface rather than
  // showing a frozen loading state forever.
  problem.textContent = "No host."
  entry.textContent = error.message
})
