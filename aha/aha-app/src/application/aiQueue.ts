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

/** Next activity in model order; a stretch request takes the most challenging queued activity instead. */
export function takeNext(queue: readonly QueuedActivity[], stretch = false): { next?: QueuedActivity; rest: QueuedActivity[] } {
  if (!queue.length) return { rest: [] };
  let index = 0;
  if (stretch) queue.forEach((q, i) => { if (q.spec.difficulty > queue[index]!.spec.difficulty) index = i; });
  return { next: queue[index], rest: queue.filter((_, i) => i !== index) };
}

/** Drop queued activities that already have evidence or a dispute (for example after a backup restore). */
export function pruneQueue(queue: readonly QueuedActivity[], known: KnownActivities): QueuedActivity[] {
  return queue.filter(q => !known.attempted.has(q.activityId) && !known.disputed.has(q.activityId) && q.activityId !== known.current);
}
