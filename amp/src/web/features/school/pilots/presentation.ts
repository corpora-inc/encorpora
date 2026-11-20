import type { PilotState } from "../../../../schools/pilot-contracts";

/** A pilot runs this many days from the teacher's first class, then this
 * many days of grace (`src/schools/pilots.ts`). */
export const PILOT_DAYS = 30;
export const GRACE_DAYS = 14;

/** Where a school class stands on practice, as the screens show it. */
export type AccessView =
  /** Not a school class, or nothing known yet. */
  | { kind: "none" }
  /** No students yet: adding them comes first. */
  | { kind: "empty" }
  /** Ready to start, until the date it would run to. `joining` adds the
   * class to the teacher's running pilot, on its dates. */
  | { kind: "start"; until: string; joining: boolean }
  /** Ready, and only the class's teacher can start it. */
  | { kind: "waiting" }
  | { kind: "active"; until: string }
  /** The pilot is over and practice continues until `until`. */
  | { kind: "ending"; until: string }
  | { kind: "ended" }
  /** Some students retain access from another license or class pilot. */
  | { kind: "partial"; covered: number; students: number }
  /** Another class pilot covers the whole roster. */
  | { kind: "covered" }
  /** Every student has a paid seat. */
  | { kind: "paid" };

export function accessView(
  pilot: PilotState,
  teaches: boolean,
  now = new Date(),
): AccessView {
  const students = pilot.coverage?.students ?? 0;
  if (students > 0 && (pilot.coverage?.paid ?? 0) >= students)
    return { kind: "paid" };
  if (!students) return { kind: "empty" };
  // A class no one has started is its teacher's to start, whatever an
  // administrator's own pilot says.
  if (pilot.status === "ready" && students > 0 && !teaches)
    return { kind: "waiting" };
  if (pilot.status === "active" && pilot.endsAt)
    return { kind: "active", until: pilot.endsAt };
  if (pilot.status === "grace" && pilot.graceEndsAt)
    return { kind: "ending", until: pilot.graceEndsAt };
  if (pilot.status === "expired" || !pilot.eligible) {
    const covered = pilot.coverage?.covered ?? 0;
    if (covered >= students) return { kind: "covered" };
    if (covered > 0) return { kind: "partial", covered, students };
    return { kind: "ended" };
  }
  if (pilot.startedAt && pilot.endsAt)
    return {
      kind: "start",
      joining: true,
      until:
        new Date(pilot.endsAt) < now && pilot.graceEndsAt
          ? pilot.graceEndsAt
          : pilot.endsAt,
    };
  const until = new Date(now);
  until.setDate(until.getDate() + PILOT_DAYS);
  return { kind: "start", joining: false, until: until.toISOString() };
}

/** Where a class stands for a reader who can't read its pilot (a viewer,
 * an aide), from the server's practice state alone. A waiting class whose
 * pilot runs waits only for its students; "waiting for the teacher" is
 * left for a class with no pilot and no license. */
export function practiceView(
  practice: "open" | "waiting" | "ended" | "unknown",
  wait: "students" | "start" | null,
): AccessView {
  if (practice === "ended") return { kind: "ended" };
  if (practice === "waiting")
    return wait === "students" ? { kind: "empty" } : { kind: "waiting" };
  return { kind: "none" };
}

const short = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});
const long = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
/** "Dec 13", with the year only when it isn't this one. */
export function practiceDate(iso: string, now = new Date()) {
  const date = new Date(iso);
  return (date.getFullYear() === now.getFullYear() ? short : long).format(date);
}

/** An institution's pilot (a Clever district's) as the class screens show
 * a running pilot: active through `endsAt`, then its grace. */
export function institutionPilotView(
  pilot: { endsAt: string; graceEndsAt: string },
  now = new Date(),
): Extract<AccessView, { kind: "active" | "ending" }> {
  return Date.parse(pilot.endsAt) > now.getTime()
    ? { kind: "active", until: pilot.endsAt }
    : { kind: "ending", until: pilot.graceEndsAt };
}

/** The class header's quiet line while a pilot or its grace runs: "Free
 * pilot · 23 days left". Null otherwise. Whole days, rounded up: the last
 * day reads "1 day left", never 0. */
export function pilotLeft(view: AccessView, now = new Date()): string | null {
  if (view.kind !== "active" && view.kind !== "ending") return null;
  const days = Math.max(
    1,
    Math.ceil((Date.parse(view.until) - now.getTime()) / 86_400_000),
  );
  const left = `${days} ${days === 1 ? "day" : "days"} left`;
  return view.kind === "active"
    ? `Free pilot · ${left}`
    : `Grace period · ${left}`;
}
