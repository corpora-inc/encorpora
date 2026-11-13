import type { PilotState } from "../../../../schools/pilot-contracts";

/** A pilot runs this many days from the day a teacher starts it. */
export const PILOT_DAYS = 30;

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
  // A class no one has started is its teacher's to start, whatever an
  // administrator's own pilot says.
  if (pilot.status === "ready" && students > 0 && !teaches)
    return { kind: "waiting" };
  if (pilot.status === "active" && pilot.endsAt)
    return { kind: "active", until: pilot.endsAt };
  if (pilot.status === "grace" && pilot.graceEndsAt)
    return { kind: "ending", until: pilot.graceEndsAt };
  if (pilot.status === "expired" || !pilot.eligible) return { kind: "ended" };
  if (!students) return { kind: "empty" };
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
