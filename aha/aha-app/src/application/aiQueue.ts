/**
 * Prefetch-queue policy for AI-authored activities. Pure and dependency-free so it lives in the
 * startup bundle; parsing, validation and grading load lazily from ./aiActivities.
 *
 * One paid call returns a batch of 3–5 activities. Validated activities wait in a queue that is
 * saved with the presentation session, so a restart never buys the same activities again. The next
 * batch is requested while the learner works on the last queued activity, which hides latency.
 */
import type { ActivitySpec } from '../activity/spec';

/** A validated activity waiting to be shown (or currently shown). */
export interface QueuedActivity {
  /** `${operationId}:${index}`: stable across a restart or a recovered batch, so it deduplicates. */
  activityId: string;
  /** The billing operation that paid for it. */
  operationId: string;
  spec: ActivitySpec;
  /**
   * Assistance already spent on this activity before the learner skipped ahead to something harder
   * (#877). Restored when it is shown again, so a skipped, hinted activity never counts as independent.
   */
  hintsUsed?: number;
}

/** Request the next batch when this many or fewer activities remain queued. */
export const PREFETCH_AT = 1;
/** Never hold more than this many unseen activities (bounds the session record and wasted spend). */
export const MAX_QUEUE = 10;

export const activityIdFor = (operationId: string, index: number): string => `${operationId}:${index}`;

export interface PrefetchState {
  queueLength: number;
  /** A batch request is already in flight. */
  inFlight: boolean;
  /** Signed in with a provider for this account and a readable journal. */
  signedIn: boolean;
  /** AI is not in a fallback backoff or a service Retry-After window. */
  aiDue: boolean;
}
/** Single flight, only when signed in and AI is due, and only when the queue is running low. */
export function shouldPrefetch(s: PrefetchState): boolean {
  return s.signedIn && s.aiDue && !s.inFlight && s.queueLength <= PREFETCH_AT;
}

export interface KnownActivities {
  /** Activity ids that already have recorded evidence. */
  attempted: ReadonlySet<string>;
  /** Activity ids set aside by a dispute. */
  disputed: ReadonlySet<string>;
  /** The activity on screen now, if any. */
  current?: string;
}
/**
 * Append a delivered batch without duplicates. A batch delivered twice (a restart between saving
 * the queue and acknowledging the reply, or a same-key recovery) adds nothing the second time.
 */
export function mergeBatch(queue: readonly QueuedActivity[], items: readonly QueuedActivity[], known: KnownActivities): { queue: QueuedActivity[]; added: number } {
  const seen = new Set([...queue.map(q => q.activityId), ...known.attempted, ...known.disputed, ...(known.current ? [known.current] : [])]);
  const next = [...queue];
  let added = 0;
  for (const item of items) {
    if (seen.has(item.activityId) || next.length >= MAX_QUEUE) continue;
    seen.add(item.activityId);
    next.push(item);
    added++;
  }
  return { queue: next, added };
}

/**
 * Next activity in model order; a stretch request takes the most challenging queued activity instead.
 * With `above`, a stretch takes only an activity harder than that difficulty (the one on screen), and
 * returns nothing when the queue holds none, so an easier one is never offered as "harder".
 */
export function takeNext(queue: readonly QueuedActivity[], stretch = false, above?: number): { next?: QueuedActivity; rest: QueuedActivity[] } {
  const eligible = stretch && above !== undefined ? queue.filter(q => q.spec.difficulty > above) : queue;
  if (!eligible.length) return { rest: [...queue] };
  let pick = eligible[0]!;
  if (stretch) for (const q of eligible) if (q.spec.difficulty > pick.spec.difficulty) pick = q;
  return { next: pick, rest: queue.filter(q => q !== pick) };
}

/** Drop queued activities that already have evidence or a dispute (for example after a backup restore). */
export function pruneQueue(queue: readonly QueuedActivity[], known: KnownActivities): QueuedActivity[] {
  return queue.filter(q => !known.attempted.has(q.activityId) && !known.disputed.has(q.activityId) && q.activityId !== known.current);
}

/**
 * The single owner of the in-memory queue. A background batch delivery and the foreground
 * (showing the next activity) interleave across awaits, so every change is a functional update
 * of the *current* queue: nothing assigns a copy captured before an await.
 */
export class AiQueueBox {
  private queue: QueuedActivity[];
  /** In-flight durable saves per billing operation, so a duplicate delivery waits for the first. */
  readonly deliveries = new Map<string, Promise<void>>();
  constructor(items: readonly QueuedActivity[] = []) { this.queue = [...items]; }
  get items(): readonly QueuedActivity[] { return this.queue; }
  get length(): number { return this.queue.length; }
  replace(items: readonly QueuedActivity[]): void { this.queue = [...items]; this.deliveries.clear(); }
  /** Returns the ids actually added (duplicates, answered, disputed and current items are skipped). */
  merge(items: readonly QueuedActivity[], known: KnownActivities): string[] {
    const before = new Set(this.queue.map(q => q.activityId));
    this.queue = mergeBatch(this.queue, items, known).queue;
    return this.queue.filter(q => !before.has(q.activityId)).map(q => q.activityId);
  }
  /** Put an unanswered activity back at the front of the queue (no duplicate if it is already queued). */
  requeueFront(item: QueuedActivity): void { this.queue = [item, ...this.queue.filter(q => q.activityId !== item.activityId)]; }
  remove(activityId: string): void { this.queue = this.queue.filter(q => q.activityId !== activityId); }
  /** Undo one delivery's additions without disturbing anything that happened meanwhile. */
  unmerge(activityIds: readonly string[]): void { const ids = new Set(activityIds); this.queue = this.queue.filter(q => !ids.has(q.activityId)); }
  without(activityId: string): QueuedActivity[] { return this.queue.filter(q => q.activityId !== activityId); }
}

/**
 * Show `item`: `write` persists the presentation, reading the remaining queue *when it runs*
 * (`rest()`); only after it succeeds is the item removed from the live queue.
 */
export async function presentFromQueue(box: AiQueueBox, item: QueuedActivity,
  write: (rest: () => QueuedActivity[], commit: () => void) => Promise<void>): Promise<void> {
  // `commit` lets the writer dequeue inside its serialized write chain, before any later write builds.
  let committed = false;
  await write(() => box.without(item.activityId), () => { box.remove(item.activityId); committed = true; });
  if (!committed) box.remove(item.activityId);
}

export interface BatchDelivery {
  operationId: string;
  /** Validated activities from the reply (fresh or recovered, parsed identically). */
  items: readonly QueuedActivity[];
  /** Evidence and disputes for the reply's learner. */
  known: () => Promise<KnownActivities>;
  /** Still the same account, provider and learner that the reply belongs to. */
  isCurrent: () => boolean;
  /** Durably save the presentation session (queue included). */
  save: () => Promise<void>;
  /** Mark the billing reply consumed. Called only after the queue is durable. */
  acknowledge: () => Promise<void>;
}
/**
 * Queue a batch durably, then acknowledge it. A stale delivery (learner or account changed during
 * an await) touches nothing and leaves the reply saved for its own learner. A failed save removes
 * only this delivery's additions. A duplicate delivery of the same operation waits for the first
 * one's save, so the reply is never acknowledged before its activities are durable.
 */
export async function deliverBatch(box: AiQueueBox, d: BatchDelivery): Promise<'delivered' | 'stale'> {
  const known = await d.known();
  const inflight = box.deliveries.get(d.operationId);
  if (inflight) await inflight;
  if (!d.isCurrent()) return 'stale';
  const added = box.merge(d.items, known);
  if (added.length) {
    const saving = d.save();
    box.deliveries.set(d.operationId, saving);
    try { await saving; }
    catch (error) { box.unmerge(added); throw error; }
    finally { if (box.deliveries.get(d.operationId) === saving) box.deliveries.delete(d.operationId); }
  }
  if (!d.isCurrent()) return 'stale';
  await d.acknowledge();
  return 'delivered';
}
