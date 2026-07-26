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

/** Methods every pack may call, with no declaration and no grant. */
export const SESSION_METHODS = ["session.settings", "session.progress", "session.end"] as const

export const CAPABILITIES = [
  {
    id: "items",
    methods: ["items.next", "items.answer", "items.skip"],
    /** Shown to a parent, in their language, before the pack is installed. */
    label: "Ask for practice questions and report answers",
  },
  {
    id: "items.reveal",
    methods: ["items.reveal"],
    label: "Read the answer to the current question before it is answered",
  },
  {
    id: "learner.read",
    methods: ["learner.summary"],
    label: "Read which topics have been practised",
  },
  {
    id: "haptics",
    methods: ["feedback.haptic"],
    label: "Vibrate the device",
  },
  {
    id: "audio",
    methods: ["feedback.sound"],
    label: "Play the app's sounds",
  },
  {
    id: "milestones",
    methods: ["milestone.reach"],
    label: "Mark that something was finished",
  },
  {
    id: "storage",
    methods: ["storage.get", "storage.set", "storage.remove", "storage.keys"],
    label: "Save its own progress on this device",
  },
] as const

export type Capability = (typeof CAPABILITIES)[number]["id"]

export type SessionMethod = (typeof SESSION_METHODS)[number]
export type CapabilityMethod = (typeof CAPABILITIES)[number]["methods"][number]
export type Method = SessionMethod | CapabilityMethod

export const CAPABILITY_IDS: readonly Capability[] = CAPABILITIES.map((entry) => entry.id)

const BY_METHOD = new Map<string, Capability>(
  CAPABILITIES.flatMap((entry) => entry.methods.map((method) => [method as string, entry.id])),
)

const SESSION = new Set<string>(SESSION_METHODS)

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

/** Whether `granted` admits `method`. The single enforcement predicate. */
export function permits(granted: Iterable<Capability>, method: Method): boolean {
  const capability = capabilityOf(method)
  if (capability === null) return SESSION.has(method)
  for (const entry of granted) if (entry === capability) return true
  return false
}
