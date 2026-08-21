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

/* ─── tilt ──────────────────────────────────────────────────────────────────
 *
 * A pack that declares `sensors.orientation` gets a real stream here, because
 * otherwise there is no way to develop tilt steering at all: the capability is
 * host-pushed by design, so a pack cannot fake it from inside itself.
 *
 * The reading comes from `deviceorientation` where there is one, and from the
 * POINTER otherwise — drag anywhere over the workbench and the pack is steered.
 * That is synthetic and is said out loud in the log, because a control that felt
 * right against a mouse and wrong against a wrist is the mistake this is for.
 *
 * The angles match the contract: full deflection at ±25°, dead zone 2°, and a
 * sample says which way a marble on the screen would roll.
 */
const FULL_TILT_DEG = 25
const DEADZONE_DEG = 2
/** Open tilt streams, handle → the last `seq` sent on it. */
const streams = new Map()

/** The same curve `orientation.ts` uses: the dead zone is subtracted, not clipped. */
const shape = (degrees) => {
  const magnitude = Math.abs(degrees)
  if (magnitude <= DEADZONE_DEG) return 0
  const span = FULL_TILT_DEG - DEADZONE_DEG
  return Math.sign(degrees) * Math.min(1, (magnitude - DEADZONE_DEG) / span)
}

function feedTilt(port, degX, degY) {
  if (streams.size === 0) return
  const sample = {
    x: shape(degX),
    y: shape(degY),
    degrees: { x: Math.round(degX), y: Math.round(degY) },
  }
  for (const [stream, seq] of [...streams]) {
    streams.set(stream, seq + 1)
    port.postMessage({ stream, seq: seq + 1, data: sample })
  }
}

function wireTilt(port) {
  let neutral = null
  addEventListener("deviceorientation", (event) => {
    if (event.beta === null || event.gamma === null) return
    neutral ??= { beta: event.beta, gamma: event.gamma }
    feedTilt(port, event.gamma - neutral.gamma, -(event.beta - neutral.beta))
  })

  // The pointer fallback. Dragging from the centre of the window to an edge is
  // full deflection, which is the only mapping a mouse can honestly offer.
  let dragging = false
  const fromPointer = (event) => {
    const x = ((event.clientX / innerWidth) * 2 - 1) * FULL_TILT_DEG
    const y = -((event.clientY / innerHeight) * 2 - 1) * FULL_TILT_DEG
    feedTilt(port, x, y)
  }
  addEventListener("pointerdown", (event) => {
    dragging = true
    fromPointer(event)
  })
  addEventListener("pointermove", (event) => {
    if (dragging) fromPointer(event)
  })
  addEventListener("pointerup", () => {
    dragging = false
    feedTilt(port, 0, 0)
  })
}

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
    if (method === "sensors.orientation.start") {
      streams.set(id, 0)
      write("in", `tilt stream ${id} opened — drag over the workbench to steer (synthetic)`)
      channel.port1.postMessage({ id, ok: true, result: { stream: id } })
      return
    }
    if (method === "stream.cancel") {
      const stream = params.stream
      if (streams.delete(stream)) {
        write("out", `stream ${stream} cancelled`)
        channel.port1.postMessage({ stream, done: true, reason: "cancelled" })
      }
      channel.port1.postMessage({ id, ok: true, result: null })
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
  wireTilt(channel.port1)

  frame.contentWindow.postMessage(
    {
      event: "connect",
      protocol: surface.protocol,
      sdk: surface.sdk,
      host: "0.0.0-workbench",
      packId: surface.packId,
      // Everything granted is available in the workbench: this is a desktop
      // browser and the point of it is to exercise the capability, not to
      // simulate a tablet that lacks it. A pack's absent path is exercised by
      // REMOVING the capability from its manifest, which is one line and is what
      // an author should do before shipping.
      available: surface.granted,
      granted: surface.granted,
      settings,
    },
    "*",
    [channel.port2],
  )
  write("out", `connected ${surface.packId} — granted: ${surface.granted.join(", ") || "session only"}`)
})

frame.src = `/${surface.entry}`
