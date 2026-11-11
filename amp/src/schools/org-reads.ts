import type { Pool, PoolClient } from "pg";
import type {
  AttentionItem,
  ClassUsage,
  OverviewResponse,
  SchoolUsage,
} from "./org-contracts.js";
import { joinNames, weekStart, dayOfWeek } from "./today.js";
import { PERSON_NAME } from "./term-grades.js";
import { YEAR_IN_USE } from "./years.js";
import { startLevelSql } from "./start-level.js";
import { growthOf, medianInterval } from "./standing-math.js";
import { levelSdSql } from "./student-sd.js";
import { PLACEMENT_ATTEMPTS } from "../learning/placement.js";
import {
  lowPractice,
  lowPracticeFacts,
  lowPracticeRule,
  medianOf,
  practiced,
  practicedSql,
  type ClassWeek,
} from "./practice-rules.js";
import { weeklyTargetsFor } from "./term-grades.js";

type Database = Pick<PoolClient, "query">;
const DAY = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

/** What a head needs flagged, and when. Practice rules are shared with a
 * teacher's Today, in `practice-rules.ts`. */
export const ATTENTION = {
  /** A license this close to its end says so. */
  licenseDays: 45,
  /** The year this close to its end asks for next year. */
  yearDays: 30,
  /** Classes a school's list names one by one; past this, one line says how
   * many more. */
  quietClassesShown: 3,
} as const;

export type OrgScope = {
  id: string;
  name: string;
  kind: "district" | "network" | "school";
  path: string[];
  timezone: string;
  today: string;
  hour: number;
};
/** The org and its "today", in its own timezone, as of `now`: the clock is an
 * input, so a weekday rule can be tested and shown on any day. */
export async function orgScope(
  db: Database,
  orgId: string,
  now: Date = new Date(),
): Promise<OrgScope> {
  return (
    await db.query(
      `SELECT id,name,kind,path,timezone,to_char($2::timestamptz AT TIME ZONE timezone,'YYYY-MM-DD') AS today,
         extract(hour FROM $2::timestamptz AT TIME ZONE timezone)::int AS hour
       FROM amp_orgs WHERE id=$1`,
      [orgId, now.toISOString()],
    )
  ).rows[0];
}

export type Term = { name: string; startsOn: string; endsOn: string };
/** The term a head is in: the division most of the classes here are graded on,
 * else the year, else the last twelve weeks. A district with no calendar of its
 * own reads its schools'. */
export async function termInUse(db: Database, org: OrgScope): Promise<Term> {
  const { rows } = await db.query(
    `SELECT s.name,s.kind,s.starts_on::text AS "startsOn",s.ends_on::text AS "endsOn",
       s.org_id=ANY($1::uuid[]) AS own,
       (SELECT count(*)::int FROM amp_classes c JOIN amp_orgs co ON co.id=c.org_id
         WHERE co.path @> ARRAY[$2]::uuid[] AND c.grading_kind=s.kind AND c.archived_at IS NULL) AS classes
     FROM amp_academic_sessions s JOIN amp_orgs so ON so.id=s.org_id
     WHERE (s.org_id=ANY($1::uuid[]) OR so.path @> ARRAY[$2]::uuid[])
       AND s.starts_on<=$3::date AND s.ends_on>=$3::date`,
    [org.path, org.id, org.today],
  );
  type Row = Term & { kind: string; own: boolean; classes: number };
  const span = (row: Row) => Date.parse(row.endsOn) - Date.parse(row.startsOn);
  const best = (rows as Row[]).sort(
    (a, b) =>
      Number(b.own) - Number(a.own) ||
      Number(b.kind !== "year") - Number(a.kind !== "year") ||
      b.classes - a.classes ||
      span(b) - span(a),
  )[0];
  return best
    ? { name: best.name, startsOn: best.startsOn, endsOn: best.endsOn }
    : {
        name: "Last 12 weeks",
        startsOn: shift(weekStart(org.today), -77),
        endsOn: shift(weekStart(org.today), 6),
      };
}

export type StudentFact = {
  id: string;
  learner: string;
  org: string;
  grade: number | null;
  thisMs: number;
  lastMs: number;
  thisAttempts: number;
  lastAttempts: number;
  level: number | null;
  startLevel: number | null;
  /** Each reading's sd, for growth's interval. */
  levelSd: number | null;
  startSd: number | null;
  seated: boolean;
  signedIn: boolean;
};
export const SQL_ACTIVE_STUDENTS = `
  SELECT DISTINCT ON (p.id) p.id,p.learner_id,p.grade_level,r.org_id
  FROM amp_orgs o
  JOIN amp_org_roles r ON r.org_id=o.id AND r.role='student'
    AND r.begin_on<=(now() AT TIME ZONE o.timezone)::date
    AND (r.end_on IS NULL OR r.end_on>(now() AT TIME ZONE o.timezone)::date)
  JOIN amp_people p ON p.id=r.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
  WHERE o.path @> ARRAY[$1]::uuid[]
  ORDER BY p.id,r.begin_on DESC`;
/** One row per student here today: this week, last week, where they stand and
 * where they stood when the term began, both once placement settled: a level
 * from fewer answers is still the starting guess, so it isn't a standing. Read from the learner's week, and from
 * two stored level days, never from replaying the frontier. */
export async function studentFacts(
  db: Database,
  orgId: string,
  term: Term,
  today: string,
): Promise<StudentFact[]> {
  const thisWeek = weekStart(today);
  const { rows } = await db.query(
    `WITH roster AS MATERIALIZED (${SQL_ACTIVE_STUDENTS})
     SELECT r.id,r.learner_id AS learner,r.org_id AS org,r.grade_level AS grade,
       COALESCE(w."thisMs",0)::float8 AS "thisMs",COALESCE(w."lastMs",0)::float8 AS "lastMs",
       COALESCE(w."thisAttempts",0)::int AS "thisAttempts",COALESCE(w."lastAttempts",0)::int AS "lastAttempts",
       latest.overall_level::float8 AS level,first.overall_level::float8 AS "startLevel",
       latest.sd AS "levelSd",first.sd AS "startSd",
       seat.person_id IS NOT NULL AS seated,
       session.id IS NOT NULL AS "signedIn"
     FROM roster r
     LEFT JOIN (
       SELECT w.learner_id,
         sum(w.active_ms) FILTER (WHERE w.week=$3::date) AS "thisMs",
         sum(w.active_ms) FILTER (WHERE w.week=$4::date) AS "lastMs",
         sum(w.attempts) FILTER (WHERE w.week=$3::date) AS "thisAttempts",
         sum(w.attempts) FILTER (WHERE w.week=$4::date) AS "lastAttempts"
       FROM amp_learner_weeks w JOIN roster s ON s.learner_id=w.learner_id
       WHERE w.week=ANY(ARRAY[$3::date,$4::date])
       GROUP BY w.learner_id
     ) w ON w.learner_id=r.learner_id
     LEFT JOIN LATERAL (
       SELECT d.overall_level,${levelSdSql("d")} AS sd FROM amp_level_days d
       WHERE d.learner_id=r.learner_id AND d.overall_answered>=${PLACEMENT_ATTEMPTS}
       ORDER BY d.day DESC LIMIT 1
     ) latest ON true
     LEFT JOIN LATERAL (
       SELECT ${startLevelSql({ select: "d.overall_level", learner: "r.learner_id", from: "$2::date" })} AS overall_level,
         ${startLevelSql({ select: levelSdSql("d"), learner: "r.learner_id", from: "$2::date" })} AS sd
     ) first ON true
     LEFT JOIN (
       SELECT s.person_id FROM amp_seats s JOIN amp_school_licenses l ON l.id=s.license_id
       WHERE s.released_at IS NULL AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now()
     ) seat ON seat.person_id=r.id
     LEFT JOIN LATERAL (
       SELECT n.id FROM amp_student_sessions n WHERE n.person_id=r.id LIMIT 1
     ) session ON true`,
    [orgId, term.startsOn, thisWeek, shift(thisWeek, -7)],
  );
  return rows;
}

const minutesOf = (ms: number) => ms / 60_000;
/** Practiced this week, by the one rule (`practice-rules.ts`). */
const isActive = (ms: number, attempts: number) =>
  practiced(minutesOf(ms), attempts);
export const middle = (values: number[]): number | null => medianOf(values);
export function usageOf(students: readonly StudentFact[]) {
  let active = 0;
  let minutes = 0;
  const gains: { mu: number; sd: number }[] = [];
  for (const student of students) {
    if (isActive(student.thisMs, student.thisAttempts)) active++;
    minutes += minutesOf(student.thisMs);
    if (student.level !== null && student.startLevel !== null)
      gains.push(
        growthOf(
          { mu: student.startLevel, sd: student.startSd ?? 0 },
          { mu: student.level, sd: student.levelSd ?? 0 },
        ),
      );
  }
  const growth = middle(gains.map((gain) => gain.mu));
  // Where that median sits (95%): students resampled, each drawn from their
  // own growth N(Δμ, σ_start² + σ_end²) (`standing-math.ts`).
  const interval = medianInterval(gains, { mode: "bootstrap" });
  const hundredth = (value: number) => Math.round(value * 100) / 100;
  return {
    students: students.length,
    active,
    minutes: Math.round(minutes),
    growth: growth === null ? null : hundredth(growth),
    growthLow: interval ? hundredth(interval.low) : null,
    growthHigh: interval ? hundredth(interval.high) : null,
    /** How many students the growth median is over. */
    placed: gains.length,
  };
}
/** This week's facts for a class's flag. */
export const classWeekOf = (students: readonly StudentFact[]): ClassWeek => ({
  minutes: students.map((student) => minutesOf(student.thisMs)),
  practiced: students.filter((student) =>
    isActive(student.thisMs, student.thisAttempts),
  ).length,
});

export async function trendOf(
  db: Database,
  students: readonly StudentFact[],
  from: string,
  to: string,
) {
  const first = weekStart(from);
  const last = weekStart(to);
  const { rows } = students.length
    ? await db.query(
        `SELECT week::text AS week,round(sum(active_ms)/60000.0)::int AS minutes,
           count(*) FILTER (WHERE ${practicedSql("active_ms", "attempts")})::int AS students,
           sum(attempts)::int AS problems,sum(assisted)::int AS assisted
         FROM amp_learner_weeks
         WHERE learner_id=ANY($1::text[]) AND week BETWEEN $2::date AND $3::date
         GROUP BY week`,
        [students.map((student) => student.learner), first, last],
      )
    : { rows: [] };
  const byWeek = new Map(rows.map((row) => [row.week as string, row]));
  const weeks: {
    week: string;
    minutes: number;
    students: number;
    problems: number;
    assisted: number;
  }[] = [];
  for (let week = first; week <= last; week = shift(week, 7))
    weeks.push({
      week,
      minutes: byWeek.get(week)?.minutes ?? 0,
      students: byWeek.get(week)?.students ?? 0,
      problems: byWeek.get(week)?.problems ?? 0,
      assisted: byWeek.get(week)?.assisted ?? 0,
    });
  return weeks;
}

/** Classes in the year in use at this org and below, each with its teachers. */
export async function classesHere(db: Database, orgId: string) {
  const { rows } = await db.query(
    `SELECT c.id,c.name,c.org_id AS org,
       ARRAY(SELECT ${PERSON_NAME} FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
         WHERE e.class_id=c.id AND e.role='teacher' AND p.deleted_at IS NULL
           AND e.begin_on<=(now() AT TIME ZONE o.timezone)::date
           AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE o.timezone)::date)
         ORDER BY e.begin_on,p.id) AS teachers
     FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
     JOIN amp_academic_sessions cs ON cs.id=c.session_id
     WHERE o.path @> ARRAY[$1]::uuid[] AND c.archived_at IS NULL AND ${YEAR_IN_USE}
     ORDER BY lower(c.name),c.id`,
    [orgId],
  );
  return rows as {
    id: string;
    name: string;
    org: string;
    teachers: string[];
  }[];
}
async function classMembers(db: Database, classIds: readonly string[]) {
  if (!classIds.length) return [];
  const { rows } = await db.query(
    `SELECT e.class_id AS class,e.person_id AS person
     FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
     WHERE e.class_id=ANY($1::uuid[]) AND e.role='student'
       AND e.begin_on<=(now() AT TIME ZONE o.timezone)::date
       AND (e.end_on IS NULL OR e.end_on>(now() AT TIME ZONE o.timezone)::date)`,
    [classIds],
  );
  return rows as { class: string; person: string }[];
}

/** Seats and dates: this org's licenses, ones held above it, and at a district
 * every school's own. A school drawing on a district pool says so. */
async function seatsHere(db: Database, org: OrgScope, waiting: number) {
  const { rows } = await db.query(
    `SELECT l.seats,l.starts_at,l.ends_at,l.reference,l.org_id,lo.name AS org_name,
       l.starts_at<=now() AND l.ends_at>now() AND l.status='active' AS in_force,
       (SELECT count(*)::int FROM amp_seats s WHERE s.license_id=l.id AND s.released_at IS NULL) AS used
     FROM amp_school_licenses l JOIN amp_orgs lo ON lo.id=l.org_id
     WHERE l.org_id=ANY($1::uuid[]) OR lo.path @> ARRAY[$2]::uuid[]
     ORDER BY l.ends_at DESC,l.id`,
    [org.path, org.id],
  );
  const inForce = rows.filter((row) => row.in_force);
  const shown = inForce[0] ?? rows[0];
  return {
    seats: inForce.reduce((sum, row) => sum + row.seats, 0),
    used: inForce.reduce((sum, row) => sum + row.used, 0),
    waiting,
    startsAt: shown?.starts_at.toISOString() ?? null,
    endsAt: shown?.ends_at.toISOString() ?? null,
    evaluation: shown?.reference === "Evaluation",
    sharedWith:
      shown && shown.org_id !== org.id && org.path.includes(shown.org_id)
        ? (shown.org_name as string)
        : null,
  };
}

/** Names in a line of the attention list, which sits in a narrow column. */
const NAMES_SHOWN = 3;
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

type Rollup = {
  org: OrgScope;
  students: readonly StudentFact[];
  classes: readonly (ClassUsage & {
    org: string;
    /** This week, for the practice flag; a class without it isn't flagged. */
    week?: ClassWeek;
    /** Its weekly target, null for a family that hasn't set one. */
    target?: number | null;
  })[];
  seats: OverviewResponse["seats"];
  /** The nearest agreement isn't accepted, for these schools. */
  unsigned: readonly { id: string; name: string }[];
  year: { name: string; endsOn: string; next: boolean } | null;
  schoolNames: ReadonlyMap<string, string>;
  /** An admin, not a viewer: only what will work for this person is offered. */
  manages: boolean;
};
/** The list a head reads first. Each item is true now, and has one thing to do
 * that will work. In a district each goes to the school with the most of it. */
export function attentionFor({
  org,
  students,
  classes,
  seats,
  unsigned,
  year,
  schoolNames,
  manages,
}: Rollup): AttentionItem[] {
  const items: AttentionItem[] = [];
  const district = org.kind !== "school";
  const worst = <T extends { org: string }>(rows: readonly T[]) => {
    const tally = new Map<string, number>();
    for (const row of rows) tally.set(row.org, (tally.get(row.org) ?? 0) + 1);
    return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? org.id;
  };
  const openLabel = (id: string, fallback: string) =>
    district ? `Open ${schoolNames.get(id) ?? "the school"}` : fallback;
  // Two schools in a district can each have a "Grade 3 Math".
  const classLabel = (row: { name: string; org: string }) =>
    district && schoolNames.has(row.org)
      ? `${row.name} at ${schoolNames.get(row.org)}`
      : row.name;
  if (unsigned.length)
    items.push({
      id: "agreement",
      title: district
        ? `${plural(unsigned.length, "school")} still ${unsigned.length === 1 ? "needs" : "need"} the data agreement`
        : "The data agreement isn’t accepted yet",
      detail: district
        ? `${joinNames(
            unsigned.map((school) => school.name),
            NAMES_SHOWN,
          )}. Students there can’t practice until it’s accepted.`
        : "Students can’t practice until someone authorized here accepts it.",
      action: {
        label: district
          ? openLabel(unsigned[0]!.id, "")
          : manages
            ? "Read and accept"
            : "Read the agreement",
        org: district ? unsigned[0]!.id : org.id,
        path: "privacy",
      },
      rule: "Shown while a school here has no accepted data agreement.",
    });
  const licenseEnd = seats.endsAt?.slice(0, 10) ?? null;
  const daysLeft = licenseEnd
    ? Math.ceil(
        (Date.parse(`${licenseEnd}T00:00:00Z`) -
          Date.parse(`${org.today}T00:00:00Z`)) /
          DAY,
      )
    : null;
  if (daysLeft === null)
    items.push({
      id: "no-license",
      title: "There’s no license here yet",
      detail: "Students can’t practice until there is one with seats.",
      action: { label: "Open the license", org: org.id, path: "license" },
      rule: "Shown while there’s no license here.",
    });
  if (daysLeft !== null && daysLeft <= ATTENTION.licenseDays)
    items.push({
      id: "license-ending",
      title:
        daysLeft <= 0
          ? "The license has ended"
          : `The license ends ${shortDate(licenseEnd!)}`,
      detail:
        daysLeft <= 0
          ? "Practice has stopped until it’s renewed. Student data is kept."
          : "Ask about renewing now, so practice doesn’t stop.",
      action: { label: "Open the license", org: org.id, path: "license" },
      rule: `Shown from ${ATTENTION.licenseDays} days before the license ends.`,
    });
  if (seats.waiting > 0)
    items.push({
      id: "seats",
      title: `${plural(seats.waiting, "student needs", "students need")} a seat`,
      detail: "They’re on the roster, and can’t practice until they have one.",
      action: {
        label: manages ? "Request more seats" : "Open the license",
        org: org.id,
        path: "license",
      },
      rule: "Shown while a student on the roster has no seat.",
    });
  if (year) {
    const days = Math.ceil(
      (Date.parse(`${year.endsOn}T00:00:00Z`) -
        Date.parse(`${org.today}T00:00:00Z`)) /
        DAY,
    );
    if (manages && !year.next && days <= ATTENTION.yearDays)
      items.push({
        id: "next-year",
        title:
          days < 0
            ? `The ${year.name} school year is over`
            : `The ${year.name} school year ends ${shortDate(year.endsOn)}`,
        detail:
          "Set next year’s dates, carry classes over and move students up a grade.",
        action: { label: "Start next year", org: org.id, path: "year" },
        rule: `Shown to admins from ${ATTENTION.yearDays} days before the year ends, until next year’s dates are set.`,
      });
  }
  const untaught = classes.filter((row) => row.teachers.length === 0);
  if (untaught.length)
    items.push({
      id: "no-teacher",
      title: `${plural(untaught.length, "class has", "classes have")} no teacher`,
      detail: `${joinNames(untaught.map(classLabel), NAMES_SHOWN)}.`,
      action: {
        label: openLabel(
          worst(untaught),
          manages ? "Assign teachers" : "See staff",
        ),
        org: district ? worst(untaught) : org.id,
        path: "staff",
      },
      rule: "Shown while a class this year has no teacher.",
    });
  // Little practice, by the rule a teacher's Today uses: each class against
  // its own weekly target, with the facts that flagged it.
  const weekday = dayOfWeek(org.today);
  const quiet = classes
    .flatMap((row) => {
      const flag =
        row.week && lowPractice(row.week, row.target ?? null, weekday);
      return flag ? [{ row, flag }] : [];
    })
    .sort(
      (a, b) =>
        a.flag.practiced / a.flag.students -
          b.flag.practiced / b.flag.students ||
        a.flag.medianMinutes - b.flag.medianMinutes,
    );
  const ruleFor = ({ row }: { row: { target?: number | null } }) =>
    lowPracticeRule(row.target ?? null, weekday);
  const sameTarget = new Set(quiet.map(({ row }) => row.target ?? null));
  const sharedRule =
    sameTarget.size === 1
      ? lowPracticeRule([...sameTarget][0]!, weekday)
      : lowPracticeRule(null, weekday).replace(
          /\.$/,
          ", or its median student has under a quarter of its weekly target for the days so far.",
        );
  if (district && quiet.length)
    items.push({
      id: "little-practice",
      title: `${plural(quiet.length, "class", "classes")} had little practice this week`,
      detail: `${joinNames(
        quiet.map(({ row }) => classLabel(row)),
        NAMES_SHOWN,
      )}.`,
      action: {
        label: openLabel(worst(quiet.map(({ row }) => row)), ""),
        org: worst(quiet.map(({ row }) => row)),
        path: "",
      },
      rule: sharedRule,
    });
  else {
    const shown =
      quiet.length > ATTENTION.quietClassesShown
        ? quiet.slice(0, ATTENTION.quietClassesShown - 1)
        : quiet;
    for (const entry of shown)
      items.push({
        id: `little-practice:${entry.row.id}`,
        title: `${entry.row.name} had little practice this week`,
        detail: `${lowPracticeFacts(entry.flag)}.`,
        action: {
          label: `Open ${entry.row.name}`,
          org: org.id,
          path: `classes/${entry.row.id}/today`,
        },
        rule: ruleFor(entry),
      });
    const rest = quiet.slice(shown.length);
    if (rest.length)
      items.push({
        id: "little-practice",
        title: `${plural(rest.length, "more class", "more classes")} had little practice this week`,
        detail: `${joinNames(
          rest.map(
            ({ row, flag }) => `${row.name} (${lowPracticeFacts(flag)})`,
          ),
          NAMES_SHOWN,
        )}.`,
        action: { label: "See all classes", org: org.id, path: "classes" },
        rule: sharedRule,
      });
  }
  const neverSignedIn = students.filter((student) => !student.signedIn).length;
  if (neverSignedIn > 0)
    items.push({
      id: "never-signed-in",
      title: `${plural(neverSignedIn, "student hasn’t", "students haven’t")} signed in yet`,
      detail:
        "Their cards or class code are waiting. Teachers can print cards from each roster.",
      action: {
        label: "See who",
        org: org.id,
        path: "students",
        search: { status: "never-signed-in" },
      },
      rule: "Shown while a student on the roster has never signed in.",
    });
  return items;
}

/** Which schools here have no accepted agreement at the nearest org up the path. */
async function unsignedSchools(db: Database, orgId: string) {
  const { rows } = await db.query(
    `SELECT o.id,o.name FROM amp_orgs o
     LEFT JOIN LATERAL (
       SELECT a.ended_at FROM amp_data_agreements a WHERE a.org_id=ANY(o.path)
       ORDER BY array_position(o.path,a.org_id) DESC,a.accepted_at DESC,a.id LIMIT 1
     ) nearest ON true
     WHERE o.path @> ARRAY[$1]::uuid[] AND o.kind='school' AND o.setup_pending=false
       AND (nearest.ended_at IS NOT NULL OR NOT EXISTS(
         SELECT 1 FROM amp_data_agreements a WHERE a.org_id=ANY(o.path)))
     ORDER BY lower(o.name),o.id`,
    [orgId],
  );
  return rows as { id: string; name: string }[];
}

/** The year classes here are in, and whether a later one is set up. */
async function yearHere(db: Database, org: OrgScope) {
  const { rows } = await db.query(
    `SELECT y.name,y.starts_on::text AS "startsOn",y.ends_on::text AS "endsOn"
     FROM amp_academic_sessions y JOIN amp_orgs so ON so.id=y.org_id
     WHERE y.kind='year' AND (y.org_id=ANY($1::uuid[]) OR so.path @> ARRAY[$2]::uuid[])
       AND EXISTS(SELECT 1 FROM amp_classes c JOIN amp_academic_sessions cs ON cs.id=c.session_id
         WHERE COALESCE(cs.parent_id,cs.id)=y.id AND c.archived_at IS NULL)
     ORDER BY y.starts_on DESC,y.id`,
    [org.path, org.id],
  );
  const years = rows as { name: string; startsOn: string; endsOn: string }[];
  const running = years.find(
    (year) => year.startsOn <= org.today && year.endsOn >= org.today,
  );
  const shown = running ?? years.find((year) => year.endsOn < org.today);
  if (!shown) return null;
  return {
    name: shown.name,
    endsOn: shown.endsOn,
    next: years.some((year) => year.startsOn > shown.endsOn),
  };
}

/** Rollup per school, from the same per-student facts. */
function schoolRows(
  schools: readonly { id: string; name: string }[],
  students: readonly StudentFact[],
  classes: readonly { org: string }[],
): SchoolUsage[] {
  const byOrg = new Map<string, StudentFact[]>();
  for (const student of students) {
    const list = byOrg.get(student.org);
    if (list) list.push(student);
    else byOrg.set(student.org, [student]);
  }
  const classCounts = new Map<string, number>();
  for (const row of classes)
    classCounts.set(row.org, (classCounts.get(row.org) ?? 0) + 1);
  return schools.map((school) => ({
    id: school.id,
    name: school.name,
    classes: classCounts.get(school.id) ?? 0,
    ...usageOf(byOrg.get(school.id) ?? []),
  }));
}
export async function schoolsBelow(db: Database, orgId: string) {
  const { rows } = await db.query(
    `SELECT id,name FROM amp_orgs WHERE path @> ARRAY[$1]::uuid[] AND kind='school'
     ORDER BY lower(name),id`,
    [orgId],
  );
  return rows as { id: string; name: string }[];
}

const partOfDay = (hour: number): OverviewResponse["partOfDay"] =>
  hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

/** The head's morning read. It reads rollups bound by the org's path and stored
 * level days, never the frontier, so it stays quick at a district's size. */
export async function readOverview(
  pool: Pool,
  orgId: string,
  actorPersonId: string | null,
  manages: boolean,
  now: Date = new Date(),
): Promise<OverviewResponse> {
  const org = await orgScope(pool, orgId, now);
  const term = await termInUse(pool, org);
  const students = await studentFacts(pool, orgId, term, org.today);
  const [trend, classList, schools, unsigned, year, person] = await Promise.all(
    [
      trendOf(pool, students, term.startsOn, term.endsOn),
      classesHere(pool, orgId),
      schoolsBelow(pool, orgId),
      unsignedSchools(pool, orgId),
      yearHere(pool, org),
      actorPersonId
        ? pool
            .query(
              `SELECT ${PERSON_NAME} AS name FROM amp_people p WHERE p.id=$1`,
              [actorPersonId],
            )
            .then((result) => (result.rows[0]?.name as string) ?? null)
        : null,
    ],
  );
  const [members, seatRows, targets] = await Promise.all([
    classMembers(
      pool,
      classList.map((row) => row.id),
    ),
    seatsHere(
      pool,
      org,
      students.reduce((sum, student) => sum + (student.seated ? 0 : 1), 0),
    ),
    weeklyTargetsFor(
      pool,
      classList.map((row) => row.id),
    ),
  ]);
  const byPerson = new Map(students.map((student) => [student.id, student]));
  const enrolled = new Map<string, StudentFact[]>();
  for (const { class: classId, person: personId } of members) {
    const fact = byPerson.get(personId);
    if (!fact) continue;
    const list = enrolled.get(classId);
    if (list) list.push(fact);
    else enrolled.set(classId, [fact]);
  }
  const classes = classList.map((row) => ({
    ...row,
    ...usageOf(enrolled.get(row.id) ?? []),
    week: classWeekOf(enrolled.get(row.id) ?? []),
    target: targets.get(row.id)?.minutes ?? null,
  }));
  const isSchool = org.kind === "school";
  const week = students.reduce(
    (sum, student) => {
      sum.thisMs += student.thisMs;
      sum.lastMs += student.lastMs;
      if (isActive(student.thisMs, student.thisAttempts)) sum.active++;
      if (isActive(student.lastMs, student.lastAttempts)) sum.lastActive++;
      return sum;
    },
    { thisMs: 0, lastMs: 0, active: 0, lastActive: 0 },
  );
  return {
    org: {
      id: org.id,
      name: org.name,
      kind: org.kind,
      timezone: org.timezone,
    },
    today: org.today,
    partOfDay: partOfDay(org.hour),
    personName: person,
    term,
    seats: seatRows,
    week: {
      students: students.length,
      active: week.active,
      minutes: Math.round(minutesOf(week.thisMs)),
      lastActive: week.lastActive,
      lastMinutes: Math.round(minutesOf(week.lastMs)),
    },
    trend,
    classes: isSchool
      ? classes.map(
          ({ org: _org, week: _week, target: _target, ...row }) => row,
        )
      : null,
    schools: isSchool ? null : schoolRows(schools, students, classes),
    attention: attentionFor({
      org,
      students,
      classes,
      seats: seatRows,
      unsigned,
      year,
      schoolNames: new Map(schools.map((school) => [school.id, school.name])),
      manages,
    }),
  };
}

/** A district's schools, with this week's use. */
export async function readSchools(
  pool: Pool,
  orgId: string,
  now: Date = new Date(),
) {
  const org = await orgScope(pool, orgId, now);
  const term = await termInUse(pool, org);
  const [students, schools, classes] = await Promise.all([
    studentFacts(pool, orgId, term, org.today),
    schoolsBelow(pool, orgId),
    classesHere(pool, orgId),
  ]);
  return {
    schools: schoolRows(schools, students, classes),
    timezone: org.timezone,
  };
}
