import type { FamilyChild } from "./api";

/* A child's access in words: its end, and one line for a family that
   shares it. Pure, so the date basis is tested (tests/family-space.test.ts). */

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
/** The latest active grant's end, when the child has access. */
export function accessUntil(child: FamilyChild): string | null {
  const ends = child.access.grants
    .filter((grant) => grant.status === "active")
    .map((grant) => grant.endsAt)
    .sort();
  const last = ends.at(-1);
  return last ? DATE.format(new Date(last)) : null;
}

const SOON_MS = 30 * 86_400_000;
/** One access line for the whole family when every child has the same
 * access, ending the same day and not soon; otherwise each row says its
 * own (a different date, ending soon, or free problems left). */
export function sharedAccessOf(
  children: readonly FamilyChild[],
  now = Date.now(),
) {
  if (children.length < 2) return null;
  const ends = children.map((child) =>
    child.access.hasAccess
      ? child.access.grants
          .filter((grant) => grant.status === "active")
          .map((grant) => grant.endsAt)
          .sort()
          .at(-1)
      : undefined,
  );
  // One basis for grouping and for the words: the reader's own calendar
  // day, as every access date in the family is printed.
  const days = ends.map((end) => (end ? DATE.format(new Date(end)) : null));
  if (!days[0] || days.some((day) => day !== days[0])) return null;
  // Ending soon for any child: each row says its own.
  if (ends.some((end) => Date.parse(end!) - now < SOON_MS)) return null;
  return days[0];
}
