// What a pack may ask the host for. The whole list.
//
// A pack is third-party code running in a children's product. It does not get
// the native bridge, it does not get the filesystem, it does not get the
// network, and it does not get an escape hatch — it gets the methods below and
// nothing else. The isolation that makes that true is structural (an
// opaque-origin sandboxed frame with its own CSP, see the host's `PackFrame`);
// this table is what the host will answer once a pack is inside it.
//
// Two rules keep it honest:
//
//   1. Every method belongs to exactly one capability. `capabilityOf` is total
//      over `METHODS` and a method with no capability is unreachable, so an
//      added method cannot arrive ungated by omission.
//   2. A capability the manifest does not declare is refused at the bridge,
//      not merely absent from a helper the pack could have skipped.
//
// `session` is not in the list because it is not a grant: settings, progress
// and end are how the frame is a frame at all, and a pack that could not
// report a session ending would leak one.
//
// `session.transition` is in that same set for the same reason, and the reason
// is worth writing down: it is the only place the host can learn that a child
// has *finished something*. Gating it behind a capability would let a pack
// decline to declare it and thereby decline ever to reach a stopping point —
// the day pass would then be enforceable only by a clock, which is the thing
// this product does not do.
//
// ── Native-backed capabilities ───────────────────────────────────────────────
//
// Some rows below are answered by the *device* rather than by the host's own
// TypeScript: a sensor, a speech synthesiser, a model. Three things about them
// are different, and each is a field rather than a convention because a
// convention is what the next five capabilities will forget.
//
//   `native`    This capability's answer comes from outside the WebView. It is
//               therefore allowed to be *absent on a device that the build
//               otherwise supports*, which no other capability is. See
//               `docs/NATIVE_CAPABILITIES.md`; the rule that matters is that
//               absence is a runtime fact reported in `Connect.available`, and
//               is NEVER expressed by dropping the row from the host's
//               `HOST_SUPPORTS` — doing that refuses to *install* a pack on a
//               device that merely lacks a sensor.
//
//   `budgetMs`  How long the host may take to answer, stated in the contract
//               rather than discovered. Every capability that existed before
//               this field answers in microseconds; an on-device model does
//               not, and a pack holding a promise that never settles is the
//               silent failure this repository keeps paying for. The guest
//               client arms a timer from this number and rejects with
//               `timeout` rather than waiting forever.
//
//   Streams     A native answer often arrives over time — samples from a
//               sensor, words from a synthesiser, tokens from a model. Those
//               methods are listed in `STREAM_METHODS`: they answer with a
//               stream handle, and everything after that arrives on the
//               `StreamUpdate` envelope in `protocol.ts`.

/**
 * Methods every pack may call, with no declaration and no grant.
 *
 * `stream.cancel` is here and not behind a capability on purpose. A pack can
 * only cancel a stream it opened — the host's stream table is per-pack, so
 * ownership is structural rather than checked — and a pack that could not stop
 * a stream is a pack that leaves a sensor running after a child has left. The
 * ability to stop is never a privilege.
 */
export const SESSION_METHODS = [
  "session.settings",
  "session.progress",
  "session.end",
  "session.transition",
  "stream.cancel",
] as const

/**
 * The budget for a session method. Small, because every one of them is a
 * store write or a field read in the host's own realm.
 */
export const SESSION_BUDGET_MS = 2_000

export const CAPABILITIES = [
  {
    id: "items",
    methods: ["items.next", "items.answer", "items.skip"],
    /** Shown to a parent, in their language, before the pack is installed. */
    label: "Ask for practice questions and report answers",
    budgetMs: 2_000,
    native: false,
  },
  {
    id: "items.reveal",
    methods: ["items.reveal"],
    label: "Read the answer to the current question before it is answered",
    budgetMs: 2_000,
    native: false,
  },
  {
    id: "learner.read",
    methods: ["learner.summary"],
    label: "Read which topics have been practised",
    budgetMs: 2_000,
    native: false,
  },
  {
    id: "haptics",
    methods: ["feedback.haptic"],
    label: "Vibrate the device",
    budgetMs: 2_000,
    native: false,
  },
  {
    id: "audio",
    methods: ["feedback.sound"],
    label: "Play the app's sounds",
    budgetMs: 2_000,
    native: false,
  },
  {
    id: "milestones",
    methods: ["milestone.reach"],
    label: "Mark that something was finished",
    budgetMs: 2_000,
    native: false,
  },
  {
    id: "storage",
    methods: ["storage.get", "storage.set", "storage.remove", "storage.keys"],
    label: "Save its own progress on this device",
    budgetMs: 2_000,
    native: false,
  },
  {
    /**
     * How the device is being held, as a stream, measured by the HOST.
     *
     * The first native-backed capability, and it is deliberately the smallest
     * one: the pack is granted no sensor. It cannot be. A pack frame is
     * `sandbox="allow-scripts"` with no `allow-same-origin` and `allow=""`, so
     * its origin is opaque and every policy-controlled feature is off —
     * `DeviceOrientationEvent` is unreachable from a pack twice over, and on
     * iOS a third time because `requestPermission()` grants per origin and an
     * opaque origin cannot hold a grant. Handing the frame
     * `allow="gyroscope; accelerometer"` would give motion sensors to every
     * installed pack in order to serve one, which is the boundary the frame
     * exists to hold.
     *
     * So the host reads it and posts it, exactly as it already measures the
     * safe-area insets a pack cannot see. What crosses the port is two numbers
     * in −1..1 and their angles: no raw sensor frame, no magnetometer, no
     * heading, nothing that says which way a child is facing.
     *
     * The budget is ten seconds because starting one may include a permission
     * decision a person has to make. See `docs/NATIVE_CAPABILITIES.md`.
     */
    id: "sensors.orientation",
    methods: ["sensors.orientation.start"],
    label: "Read how the device is being tilted",
    budgetMs: 10_000,
    native: true,
  },
] as const

export type Capability = (typeof CAPABILITIES)[number]["id"]

/**
 * The capabilities answered by the device.
 *
 * Extracted from the table rather than listed, so that a host's availability
 * table is a `Record<NativeCapability, boolean>` and **adding a native
 * capability fails to compile until somebody decides how to detect it**. The
 * alternative is a lookup that returns `undefined`, which degrades to
 * "unavailable forever" — the safe direction, and a silent one.
 */
export type NativeCapability = Extract<(typeof CAPABILITIES)[number], { native: true }>["id"]

export type SessionMethod = (typeof SESSION_METHODS)[number]
export type CapabilityMethod = (typeof CAPABILITIES)[number]["methods"][number]
export type Method = SessionMethod | CapabilityMethod

export const CAPABILITY_IDS: readonly Capability[] = CAPABILITIES.map((entry) => entry.id)

/**
 * The capabilities whose answer comes from the device rather than from the
 * host's own code, and which may therefore be granted and still unavailable.
 */
export const NATIVE_CAPABILITIES: readonly Capability[] = CAPABILITIES.filter(
  (entry) => entry.native,
).map((entry) => entry.id)

/**
 * Methods that answer with a stream handle instead of a value.
 *
 * Listed here rather than inferred from a name so that a generic client — the
 * SDK's own workbench, a future host in another language — can tell the two
 * kinds of call apart without knowing what any of them mean.
 */
export const STREAM_METHODS = ["sensors.orientation.start"] as const

export type StreamMethod = (typeof STREAM_METHODS)[number]

const BY_METHOD = new Map<string, Capability>(
  CAPABILITIES.flatMap((entry) => entry.methods.map((method) => [method as string, entry.id])),
)

const BUDGET_BY_METHOD = new Map<string, number>(
  CAPABILITIES.flatMap((entry) =>
    entry.methods.map((method) => [method as string, entry.budgetMs] as const),
  ),
)

const SESSION = new Set<string>(SESSION_METHODS)

const STREAMS = new Set<string>(STREAM_METHODS)

export const METHODS: readonly Method[] = [
  ...SESSION_METHODS,
  ...CAPABILITIES.flatMap((entry) => entry.methods),
]

export function isMethod(value: unknown): value is Method {
  return typeof value === "string" && (SESSION.has(value) || BY_METHOD.has(value))
}

export function isCapability(value: unknown): value is Capability {
  return typeof value === "string" && CAPABILITY_IDS.includes(value as Capability)
}

/** Whether this method's answer is a stream handle rather than a value. */
export function opensStream(method: Method): boolean {
  return STREAMS.has(method)
}

/** Whether this capability is answered by the device rather than by the host. */
export function isNativeBacked(capability: Capability): boolean {
  return NATIVE_CAPABILITIES.includes(capability)
}

/** The parent-facing label for a capability, for the install sheet. */
export function labelOf(capability: Capability): string {
  return CAPABILITIES.find((entry) => entry.id === capability)?.label ?? capability
}

/**
 * The capability a method needs, or `null` when it needs none.
 *
 * `undefined` is never returned: an unknown method is not a method, and the
 * bridge rejects it before asking. Callers get `null` only for the session
 * methods, which is a different thing from "not gated yet".
 */
export function capabilityOf(method: Method): Capability | null {
  if (SESSION.has(method)) return null
  const capability = BY_METHOD.get(method)
  return capability ?? null
}

/**
 * How long the host may take to answer this method.
 *
 * Total over `METHODS`, and it has to be: the guest arms a timer from it, and a
 * method with no budget would be a method a pack can wait on forever. A value
 * that is not in the table is not a method, and gets the session budget rather
 * than infinity.
 */
export function budgetOf(method: Method): number {
  return BUDGET_BY_METHOD.get(method) ?? SESSION_BUDGET_MS
}

/** Whether `granted` admits `method`. The single enforcement predicate. */
export function permits(granted: Iterable<Capability>, method: Method): boolean {
  const capability = capabilityOf(method)
  if (capability === null) return SESSION.has(method)
  for (const entry of granted) if (entry === capability) return true
  return false
}
