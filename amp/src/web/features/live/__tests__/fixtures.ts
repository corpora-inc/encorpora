import type {
  LiveRow,
  LiveSession,
  LiveSignal,
} from "../../../../schools/live/contracts";

export const START = Date.parse("2026-11-30T14:00:00.000Z");
export const iso = (ms: number) => new Date(START + ms).toISOString();

let next = 1;
export const id = () =>
  `00000000-0000-4000-8000-${(next++).toString(16).padStart(12, "0")}`;

/** A student signed in at the start and answering, unless overridden. */
export function row(name: string, patch: Partial<LiveRow> = {}): LiveRow {
  return {
    personId: id(),
    name,
    problems: 0,
    correct: 0,
    independent: 0,
    assisted: 0,
    hints: 0,
    lessons: 0,
    examples: 0,
    videos: 0,
    skill: null,
    level: 5,
    recent: [],
    firstSeenAt: iso(0),
    firstAnswerAt: null,
    lastAnswerAt: null,
    lastHelpAt: null,
    lastSeenAt: iso(0),
    ...patch,
  };
}

export const right = { correct: true, assisted: false };
export const wrong = { correct: false, assisted: false };
export const helped = { correct: true, assisted: true };

export function session(patch: Partial<LiveSession> = {}): LiveSession {
  return {
    id: id(),
    classId: id(),
    startedAt: iso(0),
    plannedEndAt: null,
    endsAt: iso(4 * 3_600_000),
    endedAt: null,
    endReason: null,
    startedBy: null,
    endedBy: null,
    rulesVersion: 1,
    ...patch,
  };
}

export function signal(
  student: LiveRow,
  kind: LiveSignal["kind"],
  agoMs: number,
  now: number,
): LiveSignal {
  return {
    id: id(),
    personId: student.personId,
    name: student.name,
    kind,
    createdAt: new Date(now - agoMs).toISOString(),
  };
}
