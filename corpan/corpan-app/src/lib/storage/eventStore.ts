// src/lib/storage/eventStore.ts (re-homed from src/util/storage — Journey W1)
//
// Local-first, on-device analytics event log — IndexedDB-backed, append-only,
// ring-buffer-capped. This is the durable substrate the app's analytics layer
// writes to. It does NOT do networking itself; uploading is a separate "sync
// seam" (drainForUpload / acknowledge) so the network path can be swapped or
// disabled without touching capture.
//
// Why a dedicated store and not the shared module's localStorage spillover:
//   - The shared module spills overflow into ONE ~5 MB-shared localStorage key
//     (`corpan-analytics-queue`). Under "almost full analytics" (sessions,
//     screens, pack opens, challenge completions, errors) that key alone can
//     blow the budget and corrupt other saves. IndexedDB gives us headroom +
//     a real ring buffer with per-record eviction.
//   - Privacy is unchanged: events live ON DEVICE, keyed by an in-memory
//     session id, no persistent identifier. Upload is opt-out-gated upstream.
//
// Capacity model: a hard cap of MAX_EVENTS records. When `record()` pushes the
// log past the cap, the OLDEST events are evicted (true ring buffer). Each
// record carries a monotonic `seq` so ordering survives reload and the
// upload seam can ack a contiguous prefix.

import { storage } from "./index"

/** A locally-recorded analytics event. Mirrors the shape the cloud `/v1/events`
 *  endpoint accepts, plus a local `seq` for ordering/ack. */
export type LocalEvent = {
  /** Monotonic local sequence number (drives ordering + upload ack). */
  seq: number
  /** Event name, e.g. "screen_view", "pack_open", "challenge_complete". */
  event: string
  /** Epoch ms when recorded. */
  ts: number
  /** Free-form props (string | number | boolean values only). */
  props?: Record<string, string | number | boolean>
}

/** Hard ring-buffer cap. ~5k small events ≈ a few hundred KB in IndexedDB —
 *  generous for on-device retention, trivial against the IDB quota. */
export const MAX_EVENTS = 5000
/** Drain batch size for uploads. */
export const UPLOAD_BATCH = 50

const NS = "analytics-events"
const META_NS = "analytics-meta"
const SEQ_KEY = "seq"

// Events themselves go in the LARGE tier under the analytics-events namespace,
// one record per event keyed by a zero-padded seq so key order === time order.
const events = storage.namespace(NS, { tier: "large", volatile: false })
// The seq counter is tiny + critical (must survive even if events are evicted)
// → tiny tier.
const meta = storage.namespace(META_NS, { tier: "tiny" })

let seqCounter: number | null = null
let seqLoad: Promise<number> | null = null

function padSeq(n: number): string {
  return n.toString().padStart(12, "0")
}

async function loadSeq(): Promise<number> {
  if (seqCounter !== null) return seqCounter
  if (seqLoad) return seqLoad
  seqLoad = (async () => {
    const stored = await meta.getJSON<number>(SEQ_KEY)
    seqCounter = typeof stored === "number" && Number.isFinite(stored) ? stored : 0
    return seqCounter
  })()
  return seqLoad
}

async function nextSeq(): Promise<number> {
  const cur = await loadSeq()
  const next = cur + 1
  seqCounter = next
  // Persist the counter; tiny-tier write is quota-guarded and won't throw.
  void meta.setJSON(SEQ_KEY, next)
  return next
}

/** Append an event. Never throws. Enforces the ring-buffer cap. */
export async function record(
  event: string,
  props?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    if (!event || typeof event !== "string") return
    const seq = await nextSeq()
    const ev: LocalEvent = { seq, event, ts: Date.now(), props }
    // Key by padded seq → lexical key order matches chronological order.
    await events.setJSON(padSeq(seq), ev, { volatile: false })
    await enforceCap()
  } catch (err) {
    // Capture must never break the app.
    console.error("[eventStore] record failed:", err)
  }
}

/** Evict oldest events when over the cap (ring buffer). */
async function enforceCap(): Promise<void> {
  const keys = await events.keys()
  if (keys.length <= MAX_EVENTS) return
  // Keys are zero-padded seqs; ascending lexical sort === oldest-first.
  keys.sort()
  const overflow = keys.length - MAX_EVENTS
  const victims = keys.slice(0, overflow)
  for (const k of victims) {
    await events.del(k)
  }
  console.warn(`[eventStore] ring-buffer cap hit — evicted ${victims.length} oldest event(s)`)
}

/** Current number of stored events. */
export async function count(): Promise<number> {
  return (await events.keys()).length
}

/** Read the oldest pending events (up to `limit`) for upload, in order.
 *  Does NOT remove them — the caller acks after a successful upload via
 *  `acknowledge()`, so a failed upload simply retries next drain. */
export async function drainForUpload(limit = UPLOAD_BATCH): Promise<LocalEvent[]> {
  const keys = (await events.keys()).sort().slice(0, limit)
  const out: LocalEvent[] = []
  for (const k of keys) {
    const ev = await events.getJSON<LocalEvent>(k)
    if (ev) out.push(ev)
  }
  return out
}

/** Remove events that were successfully uploaded, by seq. Idempotent. */
export async function acknowledge(uploadedSeqs: number[]): Promise<void> {
  for (const seq of uploadedSeqs) {
    await events.del(padSeq(seq))
  }
}

/** Test/debug: wipe the whole local event log + seq counter. */
export async function clearAll(): Promise<void> {
  const keys = await events.keys()
  for (const k of keys) await events.del(k)
  await meta.del(SEQ_KEY)
  seqCounter = null
  seqLoad = null
}

/** Test-only: drop the in-memory seq cache so a simulated reload re-reads it. */
export function __resetSeqCacheForTests(): void {
  seqCounter = null
  seqLoad = null
}
