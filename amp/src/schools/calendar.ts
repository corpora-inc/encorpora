/** Pure calendar arithmetic, shared by the server and the setup screens: both
 * must agree on what "Semesters" means for a pair of dates. */
export const divisionKinds = ["semester", "trimester", "quarter"] as const;
export type DivisionKind = (typeof divisionKinds)[number];
export const divisionLabels: Record<
  DivisionKind,
  { plural: string; one: string; parts: number }
> = {
  semester: { plural: "Semesters", one: "Semester", parts: 2 },
  trimester: { plural: "Trimesters", one: "Trimester", parts: 3 },
  quarter: { plural: "Quarters", one: "Quarter", parts: 4 },
};

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (time: number) => new Date(time).toISOString().slice(0, 10);
export const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(toTime(value)) &&
  toIso(toTime(value)) === value;

export type SplitSession = { name: string; startsOn: string; endsOn: string };

/** Equal parts of the year, in whole days, with no gap or overlap. */
export function splitYear(
  startsOn: string,
  endsOn: string,
  kind: DivisionKind,
): SplitSession[] {
  const { one, parts } = divisionLabels[kind];
  const start = toTime(startsOn);
  const days = Math.round((toTime(endsOn) - start) / DAY) + 1;
  return Array.from({ length: parts }, (_, index) => ({
    name: `${one} ${index + 1}`,
    startsOn: toIso(start + Math.floor((days * index) / parts) * DAY),
    endsOn: toIso(start + (Math.floor((days * (index + 1)) / parts) - 1) * DAY),
  }));
}

/** The name a year goes by: 2026–27. */
export function yearName(startsOn: string, endsOn: string) {
  const first = startsOn.slice(0, 4);
  const last = endsOn.slice(0, 4);
  return first === last ? first : `${first}–${last.slice(2)}`;
}

/** Where a typical U.S. school year falls for someone setting up on `today`:
 * mid-August to mid-June, this school year until the summer ends. */
export function suggestedYear(today: string): {
  startsOn: string;
  endsOn: string;
} {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const start = month >= 7 ? year : year - 1;
  return { startsOn: `${start}-08-15`, endsOn: `${start + 1}-06-15` };
}

/** "Aug 15, 2026", without a timezone that could move the day. */
export function formatDay(iso: string, withYear = true) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
