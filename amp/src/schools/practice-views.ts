import type { Pool, PoolClient } from "pg";
import type { PracticeCell, PracticeResponse } from "./org-contracts.js";
import { SETTLED_SD, termGrowth, type GrowthDay } from "./growth.js";
import { levelSdSql } from "./student-sd.js";
import {
  classesHere,
  classMembers,
  orgScope,
  schoolsBelow,
  shift,
  studentFacts,
  termInUse,
  type StudentFact,
} from "./org-reads.js";
import {
  DEFAULT_WEEKLY_TARGET_MINUTES,
  practiced,
} from "./practice-rules.js";
import {
  FIT_MINIMUM,
  fitLine,
  quartiles,
  summarize,
  type Point,
} from "./practice-stats.js";
import { orgWeeklyTargets, weeklyTargetsFor } from "./term-grades.js";
import { weekStart } from "./today.js";

type Database = Pick<PoolClient, "query">;
const DAY = 86_400_000;
const dayAt = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** A class point needs this many placed students behind its means. */
const GROUP_STUDENTS = 3;

type Week = { minutes: number; problems: number };
/** Each learner's weeks this term, straight off the (week, learner) index. */
async function learnerWeeks(
  db: Database,
  learners: readonly string[],
  first: string,
  last: string,
) {
  const weeks = new Map<string, Map<string, Week>>();
  if (!learners.length) return weeks;
  const { rows } = await db.query(
    `SELECT learner_id AS learner,week::text AS week,active_ms::float8 AS ms,attempts
     FROM amp_learner_weeks
     WHERE week BETWEEN $2::date AND $3::date AND learner_id=ANY($1::text[])`,
    [learners, first, last],
  );
  for (const row of rows as {
    learner: string;
    week: string;
    ms: number;
    attempts: number;
  }[]) {
    const byWeek = weeks.get(row.learner) ?? new Map<string, Week>();
    byWeek.set(row.week, { minutes: row.ms / 60_000, problems: row.attempts });
    weeks.set(row.learner, byWeek);
  }
  return weeks;
}

/** Settled level days in the window, day 0 being `from`. */
async function settledDays(
  db: Database,
  learners: readonly string[],
  from: string,
  to: string,
) {
  const days = new Map<string, GrowthDay[]>();
  if (!learners.length) return days;
  const { rows } = await db.query(
    `SELECT d.learner_id AS learner,(d.day-$2::date)::int AS day,
       d.overall_level::float8 AS level,${levelSdSql("d")} AS sd
     FROM amp_level_days d
     WHERE d.learner_id=ANY($1::text[]) AND d.day BETWEEN $2::date AND $3::date
       AND ${levelSdSql("d")} > 0 AND ${levelSdSql("d")} <= ${SETTLED_SD}
     ORDER BY d.learner_id,d.day`,
    [learners, from, to],
  );
  for (const row of rows as {
    learner: string;
    day: number;
    level: number;
    sd: number;
  }[]) {
    const list = days.get(row.learner) ?? [];
    list.push({ day: row.day, level: row.level, sd: Number(row.sd) });
    days.set(row.learner, list);
  }
  return days;
}

const statOf = (values: readonly number[]) => {
  const summary = summarize(values)!;
  return {
    mean: round(summary.mean, 2),
    median: round(summary.median, 2),
    sd: round(summary.sd, 2),
  };
};
const round = (value: number, places: number) =>
  Math.round(value * 10 ** places) / 10 ** places;

type Member = { student: StudentFact; since: string };
/** One row's week: every member on the roster by its Sunday, zero when they
 * did nothing. Null before anyone was. */
function cellOf(
  members: readonly Member[],
  week: string,
  weeks: Map<string, Map<string, Week>>,
): PracticeCell | null {
  const sunday = shift(week, 6);
  const counted = members.filter((member) => member.since <= sunday);
  if (!counted.length) return null;
  const facts = counted.map(
    (member) =>
      weeks.get(member.student.learner)?.get(week) ?? {
        minutes: 0,
        problems: 0,
      },
  );
  return {
    n: counted.length,
    minutes: statOf(facts.map((fact) => fact.minutes)),
    problems: statOf(facts.map((fact) => fact.problems)),
    practiced: facts.filter((fact) => practiced(fact.minutes, fact.problems))
      .length,
  };
}

/**
 * A head's practice views over the term in use: a heat map of classes (or a
 * district's schools) by week, and whether students who practiced more grew
 * more. Reads the weekly rollup and stored level days through their indexes,
 * never the frontier, for 10,000 students in a few queries.
 */
export async function readPractice(
  pool: Pool,
  orgId: string,
  now: Date = new Date(),
): Promise<PracticeResponse> {
  const org = await orgScope(pool, orgId, now);
  const term = await termInUse(pool, org);
  const students = await studentFacts(pool, orgId, term, org.today);
  const first = weekStart(term.startsOn);
  const current = weekStart(org.today);
  const weeks: string[] = [];
  for (let week = first; week <= weekStart(term.endsOn); week = shift(week, 7))
    weeks.push(week);
  const learners = students.map((student) => student.learner);
  const lastDay = term.endsOn < org.today ? term.endsOn : org.today;
  const school = org.kind === "school";

  const [byWeek, levels, groups] = await Promise.all([
    learnerWeeks(pool, learners, first, current),
    settledDays(pool, learners, term.startsOn, lastDay),
    school ? classGroups(pool, orgId, students) : schoolGroups(pool, orgId, students),
  ]);

  const shown = weeks.filter((week) => week <= current);
  const rows = groups.map((group) => ({
    id: group.id,
    name: group.name,
    target: group.target,
    students: group.members.length,
    cells: weeks.map((week) =>
      week <= current ? cellOf(group.members, week, byWeek) : null,
    ),
  }));

  // Problems have no target of their own: their midpoint is the median
  // student-week with any problems, over the weeks that are finished.
  const finished = shown.filter((week) => week < current);
  const problemWeeks: number[] = [];
  for (const student of students)
    for (const week of finished.length ? finished : shown) {
      const problems = byWeek.get(student.learner)?.get(week)?.problems ?? 0;
      if (problems > 0) problemWeeks.push(problems);
    }
  const problemsMidpoint = problemWeeks.length
    ? Math.max(1, Math.round(summarize(problemWeeks)!.median))
    : null;

  // Dose-response: active minutes a week since the term began, or since the
  // week the student joined the roster here, against growth this term.
  const startOf = (since: string) => {
    const joined = weekStart(since);
    return joined > term.startsOn ? joined : term.startsOn;
  };
  const perWeek = new Map<string, number>();
  for (const student of students) {
    const start = startOf(student.since);
    const from = weekStart(start);
    let minutes = 0;
    for (const [week, facts] of byWeek.get(student.learner) ?? [])
      if (week >= from) minutes += facts.minutes;
    const weeksIn = Math.max(1, (dayAt(lastDay) - dayAt(start) + DAY) / (7 * DAY));
    perWeek.set(student.id, minutes / weeksIn);
  }
  const placed = students.filter(
    (student) => student.growthMu !== null && student.growthSd !== null,
  );
  const growthOf = (student: StudentFact) => student.growthMu!;
  const points: Point[] = placed.map((student) => [
    round(perWeek.get(student.id)!, 1),
    round(growthOf(student), 2),
  ]);
  const groupPoints = groups.flatMap((group) => {
    const inGroup = group.members
      .map((member) => member.student)
      .filter((student) => student.growthMu !== null);
    if (inGroup.length < GROUP_STUDENTS) return [];
    return [
      {
        id: group.id,
        name: group.name,
        n: inGroup.length,
        minutes: round(
          summarize(inGroup.map((student) => perWeek.get(student.id)!))!.mean,
          1,
        ),
        growth: round(summarize(inGroup.map(growthOf))!.mean, 2),
      },
    ];
  });

  const quarters =
    placed.length >= FIT_MINIMUM.students
      ? quartiles(placed, (student) => perWeek.get(student.id)!).map(
          (group) => ({
            n: group.items.length,
            from: round(group.from, 1),
            to: round(group.to, 1),
            weeks: weeks.map((week) => {
              if (week > current) return null;
              const growths = group.items.flatMap((student) => {
                const window =
                  student.since > term.startsOn ? student.since : term.startsOn;
                const end = shift(week, 6) < lastDay ? shift(week, 6) : lastDay;
                if (end < window) return [];
                const origin = Math.round(
                  (dayAt(window) - dayAt(term.startsOn)) / DAY,
                );
                const elapsed = Math.round(
                  (dayAt(end) - dayAt(window)) / DAY,
                );
                const days = (levels.get(student.learner) ?? [])
                  .filter((point) => point.day >= origin && point.day <= origin + elapsed)
                  .map((point) => ({ ...point, day: point.day - origin }));
                const figure = termGrowth(days, elapsed);
                return figure ? [figure.mu] : [];
              });
              if (!growths.length) return null;
              return { n: growths.length, ...statOf(growths) };
            }),
          }),
        )
      : null;

  const studentFit = fitLine(points, FIT_MINIMUM.students);
  const groupFit = fitLine(
    groupPoints.map((group) => [group.minutes, group.growth] as const),
    FIT_MINIMUM.groups,
  );
  return {
    term,
    today: org.today,
    weeks,
    current,
    rowKind: school ? "class" : "school",
    rows,
    problemsMidpoint,
    dose: {
      placed: placed.length,
      students: points.map(([x, y]) => [x, y] as [number, number]),
      studentFit: studentFit && roundFit(studentFit),
      groups: groupPoints,
      groupFit: groupFit && roundFit(groupFit),
      quartiles: quarters,
      minimum: { students: FIT_MINIMUM.students, groups: FIT_MINIMUM.groups },
    },
  };
}

const roundFit = (fit: NonNullable<ReturnType<typeof fitLine>>) => ({
  ...fit,
  band: fit.band.map((row) => ({
    x: round(row.x, 2),
    fit: round(row.fit, 3),
    low: round(row.low, 3),
    high: round(row.high, 3),
  })),
});

type Group = {
  id: string;
  name: string;
  target: number;
  members: Member[];
};
async function classGroups(
  db: Database,
  orgId: string,
  students: readonly StudentFact[],
): Promise<Group[]> {
  const classes = await classesHere(db, orgId);
  const ids = classes.map((row) => row.id);
  const [members, targets] = await Promise.all([
    classMembers(db, ids),
    weeklyTargetsFor(db, ids),
  ]);
  const byPerson = new Map(students.map((student) => [student.id, student]));
  const enrolled = new Map<string, Member[]>();
  for (const row of members) {
    const student = byPerson.get(row.person);
    if (!student) continue;
    const list = enrolled.get(row.class) ?? [];
    list.push({ student, since: row.since });
    enrolled.set(row.class, list);
  }
  return classes.map((row) => ({
    id: row.id,
    name: row.name,
    target: targets.get(row.id)?.minutes ?? DEFAULT_WEEKLY_TARGET_MINUTES,
    members: enrolled.get(row.id) ?? [],
  }));
}
async function schoolGroups(
  db: Database,
  orgId: string,
  students: readonly StudentFact[],
): Promise<Group[]> {
  const schools = await schoolsBelow(db, orgId);
  const paths = (
    await db.query(`SELECT id,path FROM amp_orgs WHERE id=ANY($1::uuid[])`, [
      schools.map((row) => row.id),
    ])
  ).rows as { id: string; path: string[] }[];
  const targets = await orgWeeklyTargets(db, paths);
  return schools.map((row) => ({
    id: row.id,
    name: row.name,
    target: targets.get(row.id) ?? DEFAULT_WEEKLY_TARGET_MINUTES,
    members: students
      .filter((student) => student.org === row.id)
      .map((student) => ({ student, since: student.since })),
  }));
}
