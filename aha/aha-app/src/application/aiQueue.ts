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
  /** It was shown before, so its immutable activity record is already saved. */
  shown?: true;
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
/**
 * Why a low queue is NOT being refilled right now, for the diagnostics log; `undefined` when it is (or when it is not
 * low, a batch is already in flight, or nobody is signed in). AI must never stop silently while signed in.
 */
export function prefetchBlocked(s: PrefetchState, blockedBy?: string): string | undefined {
  if (s.queueLength > PREFETCH_AT || s.inFlight || !s.signedIn || s.aiDue) return undefined;
  return blockedBy ?? 'AI is not due yet';
}

/**
 * How long the next task waits for a batch that is already on its way when the queue is empty. Within this bound the
 * learner gets the AI activity; past it, one local task is served and the batch fills the queue for the task after.
 */
export const BATCH_WAIT_MS = 6000;
/**
 * The learner's Stop for one batch their own tap started. The batch outlives the tap (it may land after the bounded
 * wait), so it carries its own token instead of reading whichever action is current: a later action can never re-arm it.
 */
export interface StopToken { readonly stopped: boolean; stop(): void; readonly signal: Promise<void> }
export function stopToken(): StopToken {
  let stopped = false, resolve!: () => void;
  const signal = new Promise<void>(r => { resolve = r; });
  return { get stopped() { return stopped; }, stop() { stopped = true; resolve(); }, signal };
}
/** True when `work` settles (either way) within `ms`; never rejects, and never cancels `work`. */
export async function settlesWithin(work: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), ms); });
  try { return await Promise.race([work.then(() => true, () => true), timeout]); }
  finally { clearTimeout(timer); }
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

/**
 * "Try something harder" on an unanswered AI activity always moves on (#899): a queued activity harder than the one
 * on screen if there is one, otherwise the next queued activity of any difficulty. Nothing when the queue is empty
 * (the caller then waits boundedly or serves a local task). Never returns the skipped activity itself.
 */
export function takeForSkip(queue: readonly QueuedActivity[], onScreen: QueuedActivity): { next?: QueuedActivity; rest: QueuedActivity[] } {
  const others = queue.filter(q => q.activityId !== onScreen.activityId);
  const harder = takeNext(others, true, onScreen.spec.difficulty);
  if (harder.next) return harder;
  return takeNext(others);
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
  /** Put a skipped activity at the back (no duplicate); paid content waits its turn and is never discarded. */
  requeueBack(item: QueuedActivity): void { this.queue = [...this.queue.filter(q => q.activityId !== item.activityId), item]; }
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
