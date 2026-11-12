import type {
  HelpEvent,
  HelpSource,
} from "../../schools/help-contracts";

/** Help a learner opens: a lesson, a hint, a worked explanation or a video.
 * Each one is queued here and rides on the next active-time heartbeat
 * (`student-activity.ts`); nothing here sends a request of its own. The same
 * note also remembers, per problem, which help came before its answer, so
 * the answer can say so. */
export type HelpNote = {
  kind: HelpEvent["kind"];
  source: HelpSource;
  /** The problem type (template id), or a reference lesson's id. */
  ref?: string;
  problemId?: string;
  /** A hint's step, from 1. */
  step?: number;
};
type Queued = HelpNote & { at: number };
/** The most a queue holds while nothing sends it; older notes give way. */
export const MAX_QUEUED_HELP = 200;
/** As many as one heartbeat carries (`MAX_HELP_EVENTS`). */
export const HELP_PER_SEND = 20;

const listeners = new Set<(note: HelpNote, at: number) => void>();
/** Which kinds of help each unanswered problem had, newest problems last. */
const usedBefore = new Map<string, Set<"hint" | "lesson" | "video" | "example">>();
const REMEMBERED_PROBLEMS = 50;
/** One hint step counts once per problem, however often it is reopened. */
const hintsSeen = new Set<string>();

/** Records that help was opened, now. */
export function noteHelp(note: HelpNote, at = performance.now()) {
  if (note.kind === "hint" && note.problemId) {
    const key = `${note.problemId}:${note.step ?? 1}`;
    if (hintsSeen.has(key)) return;
    hintsSeen.add(key);
    if (hintsSeen.size > REMEMBERED_PROBLEMS * 4)
      hintsSeen.delete(hintsSeen.values().next().value!);
  }
  if (note.problemId) {
    const used = usedBefore.get(note.problemId) ?? new Set();
    used.add(note.kind);
    usedBefore.delete(note.problemId);
    usedBefore.set(note.problemId, used);
    if (usedBefore.size > REMEMBERED_PROBLEMS)
      usedBefore.delete(usedBefore.keys().next().value!);
  }
  for (const listen of listeners) listen(note, at);
}

/** The help a problem had so far, for its answer. */
export function helpUsedBefore(problemId: string) {
  return [...(usedBefore.get(problemId) ?? [])].sort();
}
/** Once answered, later help is about the result, not the answer. */
export function forgetHelp(problemId: string) {
  usedBefore.delete(problemId);
}

/** Receives every note while subscribed. */
export function onHelp(listen: (note: HelpNote, at: number) => void) {
  listeners.add(listen);
  return () => void listeners.delete(listen);
}

/** A heartbeat's queue of help: bounded, oldest first, sent as ages. */
export class HelpQueue {
  private items: Queued[] = [];
  get size() {
    return this.items.length;
  }
  push(note: HelpNote, at: number) {
    this.items.push({ ...note, at });
    if (this.items.length > MAX_QUEUED_HELP) this.items.shift();
  }
  /** Up to one heartbeat's worth, as the server reads them. */
  take(now: number): HelpEvent[] {
    return this.items.splice(0, HELP_PER_SEND).map(({ at, ...note }) => ({
      ...note,
      ageMs: Math.max(0, Math.min(86_400_000, Math.round(now - at))),
    }));
  }
  /** Puts unsent events back at the front, ages turned back into times;
   * `now` is the time they were taken at. */
  restore(events: readonly HelpEvent[], now: number) {
    this.items.unshift(
      ...events.map(({ ageMs, ...note }) => ({ ...note, at: now - ageMs })),
    );
    if (this.items.length > MAX_QUEUED_HELP)
      this.items.splice(0, this.items.length - MAX_QUEUED_HELP);
  }
  clear() {
    this.items.length = 0;
  }
}

/** For tests. */
export function resetHelpForTests() {
  usedBefore.clear();
  hintsSeen.clear();
}
