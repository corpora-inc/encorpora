// The workbench's mock host.
//
// It answers the protocol so a pack can be developed and played. It does NOT
// enforce it: capability denial, rate limiting and parameter validation are the
// real host's job and are tested there. Two things it does take seriously,
// because a pack built against a sloppy version of either would be wrong on a
// device:
//
//   * **Arithmetic is exact.** Every operand and every answer is a string, and
//     the comparison is `BigInt`. There is no point at which a `number` holds a
//     value the child is asked about.
//   * **The answer is not in the item.** `items.next` returns no canonical
//     value; `items.answer` records the attempt and only then returns one. A
//     pack that works here therefore cannot be written to peek, which is the
//     property the real host guarantees.

const surface = globalThis.__DW_SURFACE

const log = document.getElementById("log")
const write = (kind, text) => {
  const line = document.createElement("div")
  line.className = kind
  line.textContent = text
  log.append(line)
  log.scrollTop = log.scrollHeight
}

/** Deterministic: the same seed gives the same session, every run. */
let seed = 0x9e3779b9
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (low, high) => low + Math.floor(random() * (high - low + 1))

/** Live items, by id. An item is answerable once. */
const served = new Map()
let counter = 0

function makeItem() {
  // Four-digit subtraction with a zero in the minuend: the case whose classic
  // error is taking the smaller digit from the larger instead of borrowing.
  const minuend = BigInt(between(5, 9) * 1000 + between(0, 0) * 100 + between(0, 9) * 10 + between(0, 9))
  const subtrahend = BigInt(between(1, 4) * 1000 + between(0, 9) * 100 + between(0, 9) * 10 + between(0, 9))
  const id = `dev-${(counter += 1)}`
  const item = {
    id,
    skillId: "sub.4digit.zero",
    level: 3,
    form: "binary-op",
    operator: "−",
    operands: [String(minuend), String(subtrahend)],
    prompt: `${minuend} minus ${subtrahend}`,
    answerKind: "integer",
    digits: 4,
  }
  served.set(id, { minuend, subtrahend, canonical: String(minuend - subtrahend) })
  return item
}

/** The one mal-rule the workbench knows: column-wise |a−b|, no borrowing. */
function smallerFromLarger(minuend, subtrahend) {
  const left = String(minuend).padStart(4, "0")
  const right = String(subtrahend).padStart(4, "0")
  let out = ""
  for (let index = 0; index < 4; index += 1) {
    out += String(Math.abs(Number(left[index]) - Number(right[index])))
  }
  return String(BigInt(out))
}

const settings = {
  locale: "en",
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  quality: "high",
  textScale: 1,
  colorScheme: "dark",
  sound: true,
  haptics: true,
}

const storage = new Map()

async function answer(method, params) {
  switch (method) {
    case "session.settings":
      return settings
    case "session.progress":
      return null
    case "session.end":
      write("in", `session.end (${params.reason})`)
      return null

    case "items.next":
      return { item: makeItem() }

    case "items.answer": {
      const record = served.get(params.itemId)
      if (!record) return { correct: false, canonical: "", advance: false }
      served.delete(params.itemId)
      const correct = BigInt(params.response || "0") === BigInt(record.canonical)
      const diagnosis =
        !correct && params.response === smallerFromLarger(record.minuend, record.subtrahend)
          ? "smaller-from-larger"
          : undefined
      write("in", `answered ${params.response} → ${correct ? "correct" : record.canonical}${diagnosis ? ` (${diagnosis})` : ""}`)
      return { correct, canonical: record.canonical, diagnosis, advance: true }
    }

    case "items.skip":
      served.delete(params.itemId)
      return null

    case "items.reveal": {
      const record = served.get(params.itemId)
      return { canonical: record ? record.canonical : "" }
    }

    case "learner.summary":
      return { skills: [{ id: "sub.4digit.zero", level: "practiced" }] }

    case "feedback.haptic":
    case "feedback.sound":
      write("in", `${method} ${params.cue}`)
      return null

    case "milestone.reach":
      write("in", `milestone ${params.name}`)
      return null

    case "storage.get":
      return { value: storage.get(params.key) ?? null }
    case "storage.set":
      storage.set(params.key, params.value)
      return null
    case "storage.remove":
      storage.delete(params.key)
      return null
    case "storage.keys":
      return { keys: [...storage.keys()] }

    default:
      return undefined
  }
}

const frame = document.getElementById("pack")

addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow) return
  if (!event.data || event.data.event !== "ready") return

  const channel = new MessageChannel()
  channel.port1.onmessage = async (message) => {
    const { id, method, params = {} } = message.data ?? {}
    if (!surface.methods.includes(method)) {
      write("no", `unknown method ${method}`)
      channel.port1.postMessage({ id, ok: false, error: { code: "unknown_method", message: String(method) } })
      return
    }
    try {
      const result = await answer(method, params)
      channel.port1.postMessage({ id, ok: true, result: result ?? null })
    } catch (error) {
      write("no", `${method} threw: ${error.message}`)
      channel.port1.postMessage({ id, ok: false, error: { code: "internal", message: "" } })
    }
  }
  channel.port1.start()

  frame.contentWindow.postMessage(
    {
      event: "connect",
      protocol: surface.protocol,
      sdk: surface.sdk,
      host: "0.0.0-workbench",
      packId: surface.packId,
      granted: surface.granted,
      settings,
    },
    "*",
    [channel.port2],
  )
  write("out", `connected ${surface.packId} — granted: ${surface.granted.join(", ") || "session only"}`)
})

frame.src = `/${surface.entry}`
