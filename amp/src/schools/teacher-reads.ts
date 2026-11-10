import type { Pool } from "pg";
import { hasProblemLesson } from "../content/problem-lessons.js";
import { templates } from "../math/engine.js";
import {
  classRoster,
  levels,
  perDay,
  perSkill,
  totals,
  type RosterMember,
} from "./evidence.js";
import {
  componentSentence,
  DEFAULT_GRADE_POLICY,
  rangeLetters,
  type GradeComponentId,
} from "./grade-policy.js";
import {
  classContext,
  classSummaryOf,
  countedObjectives,
  courseBand,
  currentTerm,
  gradebookRows,
  objectivesBySpan,
  PERSON_FIRST,
  PERSON_NAME,
  skillStrandOf,
  skillTitleOf,
  termById,
  termRoster,
  termsFor,
  toSuggestionResource,
  weeklyTargetFor,
  workSamples,
  type ClassContext,
  type GainedObjective,
  type Term,
  type TermStudent,
} from "./term-grades.js";
import type {
  EvidenceResponse,
  GradebookResponse,
  MapResponse,
  ProgressRecord,
  ReportCardsResponse,
  StudentRecordResponse,
  StudentTimeResponse,
  TimePeriod,
  TimeResponse,
  TodayResponse,
  WorkItem,
} from "./teacher-contracts.js";
import { shownTeachers } from "./teacher-line.js";
import {
  todayTodos,
  weekStart,
  type RecentOutcome,
  type TodayStudent,
} from "./today.js";

const DAY = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);

type Named = {
  id: string;
  learnerId: string;
  name: string;
  first: string;
  gradeLevel: number | null;
  identifier: string | null;
};
/** Who is in a class today, with what a screen calls them. */
export async function namedRoster(
  pool: Pool,
  classId: string,
): Promise<Named[]> {
  const roster = await classRoster(pool, classId);
  if (!roster.length) return [];
  const { rows } = await pool.query(
    `SELECT p.id,p.learner_id AS "learnerId",${PERSON_NAME} AS name,${PERSON_FIRST} AS first,
       p.grade_level AS "gradeLevel",p.identifier
     FROM amp_people p WHERE p.id=ANY($1::uuid[]) ORDER BY lower(${PERSON_NAME}),p.id`,
    [roster.map((member) => member.personId)],
  );
  return rows;
}
const members = (named: readonly Named[]): RosterMember[] =>
  named.map(({ id, learnerId }) => ({ personId: id, learnerId }));

const teacherOf = async (pool: Pool, personId: string | null) =>
  personId
    ? ((
        await pool.query(
          `SELECT ${PERSON_NAME} AS name FROM amp_people p WHERE p.id=$1`,
          [personId],
        )
      ).rows[0]?.name ?? null)
    : null;

const partOfDay = (hour: number): TodayResponse["partOfDay"] =>
  hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

/** The lesson for what a group keeps missing: their most-missed problem type
 * that has one, else any lesson for the skill. */
function lessonFor(skillId: string, missed: readonly string[]): string | null {
  const counts = new Map<string, number>();
  for (const id of missed) counts.set(id, (counts.get(id) ?? 0) + 1);
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
  return (
    ranked.find(hasProblemLesson) ??
    templates.find(
      (template) =>
        template.skillId === skillId && hasProblemLesson(template.id),
    )?.id ??
    null
  );
}

/** Today for one class: to-dos, the week's facts, from rollups and skill
 * evidence for the roster. No learner locks, no replay. */
export async function readToday(
  pool: Pool,
  context: ClassContext,
  actorPersonId: string | null,
): Promise<Omit<TodayResponse, "canPrint">> {
  const named = await namedRoster(pool, context.id);
  const roster = members(named);
  const policy = DEFAULT_GRADE_POLICY;
  const today = context.today;
  const from = weekStart(today);
  const horizon = shift(today, -policy.today.recentDays);
  const lookback = shift(from, -28);
  const [
    week,
    month,
    day,
    level,
    target,
    teacherName,
    evidence,
    objectives,
    skillsThisWeek,
  ] = await Promise.all([
    totals(pool, roster, { from, to: today }),
    totals(pool, roster, { from: lookback, to: today }),
    totals(pool, roster, { from: today, to: today }),
    levels(pool, roster),
    weeklyTargetFor(pool, context),
    teacherOf(pool, actorPersonId),
    pool
      .query(
        `SELECT learner_id,skill_id,state->'recentOutcomes' AS recent FROM amp_skill_evidence
           WHERE learner_id=ANY($1::text[]) AND (state->'recentOutcomes'->-1->>'createdAt')::timestamptz>=$2::date`,
        [roster.map((member) => member.learnerId), horizon],
      )
      .then(
        (result) =>
          result.rows as {
            learner_id: string;
            skill_id: string;
            recent: RecentOutcome[];
          }[],
      ),
    objectivesBySpan(
      pool,
      named.map((student): TermStudent => ({
        ...student,
        from,
        to: today,
        beginOn: from,
        endOn: null,
      })),
      policy,
    ),
    perSkill(pool, roster, { from, to: today }),
  ]);
  const byPerson = <T extends { personId: string }>(rows: readonly T[]) =>
    new Map(rows.map((row) => [row.personId, row]));
  const weekRows = byPerson(week);
  const monthRows = byPerson(month);
  const dayRows = byPerson(day);
  const levelRows = byPerson(level);
  const learnerToPerson = new Map(
    named.map((student) => [student.learnerId, student.id]),
  );
  const students = named.map((student): TodayStudent => {
    const thisWeek = weekRows.get(student.id);
    const lately = monthRows.get(student.id);
    const stored = levelRows.get(student.id);
    const earlierMinutes =
      (lately?.activeMinutes ?? 0) - (thisWeek?.activeMinutes ?? 0);
    return {
      id: student.id,
      name: student.name,
      first: student.first,
      gradeLevel: student.gradeLevel,
      level: stored
        ? { overall: stored.overall, strands: stored.strands }
        : null,
      weekMinutes: thisWeek?.activeMinutes ?? 0,
      weekProblems: thisWeek?.problems ?? 0,
      workedToday:
        (dayRows.get(student.id)?.problems ?? 0) > 0 ||
        (dayRows.get(student.id)?.activeMinutes ?? 0) > 0,
      todayMinutes: dayRows.get(student.id)?.activeMinutes ?? 0,
      usualWeeklyMinutes: earlierMinutes > 0 ? earlierMinutes / 4 : null,
      lastActive: lately?.lastActive ?? null,
      review: lately?.review ?? 0,
      reviewIndependent: lately?.reviewIndependent ?? 0,
      objectivesThisWeek: countedObjectives(
        objectives.get(student.id) ?? [],
        stored?.overall.level,
        policy,
      ).length,
    };
  });
  const course = courseBand(context.courseBands);
  const todos = todayTodos(
    {
      today,
      students,
      skills: evidence.map((row) => ({
        studentId: learnerToPerson.get(row.learner_id)!,
        skillId: row.skill_id,
        recent: row.recent,
      })),
      course,
      weeklyTargetMinutes: target.minutes,
      skillTitle: skillTitleOf,
      lessonFor,
    },
    policy,
  );
  return {
    class: classSummaryOf(context),
    teacherName,
    today,
    partOfDay: partOfDay(context.hour),
    todos,
    week: {
      from,
      minutes: Math.round(
        week.reduce((sum, row) => sum + row.activeMinutes, 0),
      ),
      problems: week.reduce((sum, row) => sum + row.problems, 0),
      skills: new Set(
        skillsThisWeek.filter((row) => row.skillId).map((row) => row.skillId),
      ).size,
      objectives: students.reduce(
        (sum, student) => sum + student.objectivesThisWeek,
        0,
      ),
      working: week.filter((row) => row.problems > 0 || row.activeMinutes > 0)
        .length,
      students: named.length,
    },
  };
}

const STRAND_LABELS: Record<string, string> = {
  number: "Numbers",
  operations: "Operations",
  fractions: "Fractions",
  decimals: "Decimals",
  ratio: "Ratios",
  algebra: "Algebra",
  functions: "Functions",
  geometry: "Geometry",
  measurement: "Measurement",
  data: "Data",
  probability: "Probability",
  modeling: "Modeling",
  reasoning: "Reasoning",
  trigonometry: "Trigonometry",
};
export const strandLabel = (id: string) =>
  STRAND_LABELS[id] ?? id[0]!.toUpperCase() + id.slice(1);

/** Fewer answers than this and a level is mostly its starting guess. */
const PROVISIONAL_ANSWERS = 20;
type StoredLevel = Awaited<ReturnType<typeof levels>>[number];
const mapLevel = (row: StoredLevel | undefined) => ({
  provisional: !row || row.overall.answered < PROVISIONAL_ANSWERS,
  level: row
    ? {
        overall: { level: row.overall.level, sd: row.overall.sd },
        strands: Object.fromEntries(
          Object.entries(row.strands).map(([id, { level, sd }]) => [
            id,
            { level, sd },
          ]),
        ),
      }
    : null,
});
/** Every student's stored level, on the ground they're graded against, and
 * each teacher who practices and shows here as a line of their own. The
 * strands are the students': a teacher's work never adds a column.
 * `readerAccountId` marks the reader's own line. */
export async function readMap(
  pool: Pool,
  context: ClassContext,
  readerAccountId: string | null = null,
): Promise<MapResponse> {
  const [named, teachers] = await Promise.all([
    namedRoster(pool, context.id),
    shownTeachers(pool, context.id),
  ]);
  const stored = new Map(
    (await levels(pool, [...members(named), ...teachers])).map((row) => [
      row.personId,
      row,
    ]),
  );
  const course = courseBand(context.courseBands);
  const evidence = new Map<string, number>();
  for (const student of named)
    for (const [id, estimate] of Object.entries(
      stored.get(student.id)?.strands ?? {},
    ))
      evidence.set(id, (evidence.get(id) ?? 0) + estimate.answered);
  return {
    class: classSummaryOf(context),
    strands: [...evidence.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => ({ id, label: strandLabel(id) })),
    students: named.map((student) => ({
      id: student.id,
      name: student.name,
      first: student.first,
      gradeLevel: student.gradeLevel,
      ...mapLevel(stored.get(student.id)),
      reference: course
        ? { from: course.from, to: course.to }
        : student.gradeLevel === null
          ? null
          : { from: student.gradeLevel - 0.5, to: student.gradeLevel + 0.5 },
    })),
    teachers: teachers.map((teacher) => ({
      id: teacher.personId,
      name: teacher.name,
      first: teacher.first,
      you: teacher.accountId === readerAccountId,
      ...mapLevel(stored.get(teacher.personId)),
      reference: course ? { from: course.from, to: course.to } : null,
    })),
  };
}

export async function readGradebook(
  pool: Pool,
  context: ClassContext,
  requestedTerm: string | undefined,
  canEdit: boolean,
): Promise<GradebookResponse> {
  const terms = await termsFor(pool, context);
  const term = requestedTerm
    ? termById(terms, requestedTerm)
    : currentTerm(terms, context.today);
  const target = await weeklyTargetFor(pool, context);
  const rows = term ? await gradebookRows(pool, context, term, target) : [];
  return {
    class: classSummaryOf(context),
    terms,
    term,
    weeklyTargetMinutes: target.minutes,
    targetLocked: target.locked,
    canEdit,
    students: rows.map(({ student, suggestion, final }) => ({
      id: student.id,
      name: student.name,
      first: student.first,
      identifier: student.identifier,
      suggestion: toSuggestionResource(suggestion),
      final,
    })),
  };
}

const COMPONENT_LABELS: Record<GradeComponentId, string> = {
  course: "Course progress",
  growth: "Growth",
  practice: "Practice",
  retention: "Retention",
};
const WORK_PAGE = 12;
/** "Why a B?", or "Why B to A−?" when the range spans letters. */
function whyQuestion(letters: string | null): string {
  if (!letters) return "Why no range yet?";
  if (letters.includes(" to ")) return `Why ${letters}?`;
  return `Why ${/^[AF]/.test(letters) ? "an" : "a"} ${letters}?`;
}

/** Why a student's grade reads as it does: each component in one sentence with
 * its number, objectives with their dates, and the actual problems. */
export async function readEvidence(
  pool: Pool,
  context: ClassContext,
  termId: string,
  personId: string,
  offset: number,
  canEdit: boolean,
): Promise<EvidenceResponse | null> {
  const terms = await termsFor(pool, context);
  const term = termById(terms, termId);
  const target = await weeklyTargetFor(pool, context);
  const rows = await gradebookRows(pool, context, term, target);
  const row = rows.find((entry) => entry.student.id === personId);
  if (!row) return null;
  const span = { from: row.from, to: row.to };
  // A removed student's frozen grade stands; their learning data has gone.
  const learner = row.learnerId;
  const [objectives, work]: [GainedObjective[], WorkItem[]] = learner
    ? await Promise.all([
        objectivesBySpan(pool, [
          {
            ...row.student,
            learnerId: learner,
            gradeLevel: null,
            ...span,
            beginOn: span.from,
            endOn: null,
          },
        ]).then((found) => found.get(row.student.id) ?? []),
        workSamples(
          pool,
          learner,
          span,
          context.timezone,
          WORK_PAGE + 1,
          offset,
        ),
      ])
    : [[], []];
  const resource = toSuggestionResource(row.suggestion);
  return {
    student: {
      id: row.student.id,
      name: row.student.name,
      first: row.student.first,
    },
    class: classSummaryOf(context),
    term,
    canEdit: canEdit && term.state === "open",
    final: row.final,
    suggestion: resource,
    question: whyQuestion(rangeLetters(row.suggestion)),
    lines: row.suggestion.components.map((component) => ({
      id: component.id,
      label: COMPONENT_LABELS[component.id],
      weight: component.weight,
      score: component.score,
      sentence: componentSentence(component),
    })),
    joined: row.beginOn && row.beginOn > term.startsOn ? row.beginOn : null,
    left:
      row.endOn && row.endOn <= term.endsOn && row.endOn <= context.today
        ? row.endOn
        : null,
    objectives: countedObjectives(
      objectives,
      row.suggestion.inputs.startLevel?.level,
    ).map(({ skillId, day }) => ({
      skillId,
      day,
      title: skillTitleOf(skillId),
      strand: skillStrandOf(skillId),
    })),
    work: work.slice(0, WORK_PAGE),
    nextOffset: work.length > WORK_PAGE ? offset + WORK_PAGE : null,
  };
}

/** The dates a report covers, in the school's timezone. */
export async function periodRange(
  pool: Pool,
  context: ClassContext,
  period: TimePeriod,
): Promise<{ from: string; to: string }> {
  const today = context.today;
  if (period === "week") return { from: weekStart(today), to: today };
  if (period === "month")
    return { from: shift(weekStart(today), -21), to: today };
  const term = currentTerm(await termsFor(pool, context), today);
  return term && term.startsOn <= today
    ? {
        from: term.startsOn,
        to: term.endsOn < today ? term.endsOn : today,
      }
    : { from: shift(weekStart(today), -21), to: today };
}

function mondays({ from, to }: { from: string; to: string }): string[] {
  const weeks: string[] = [];
  for (let week = weekStart(from); week <= to; week = shift(week, 7))
    weeks.push(week);
  return weeks;
}
const asMembers = (students: readonly TermStudent[]): RosterMember[] =>
  students.map(({ id, learnerId }) => ({ personId: id, learnerId }));

export async function readTime(
  pool: Pool,
  context: ClassContext,
  period: TimePeriod,
): Promise<TimeResponse> {
  const range = await periodRange(pool, context, period);
  const students = await termRoster(pool, context.id, range);
  const roster = asMembers(students);
  const [days, skills, target] = await Promise.all([
    perDay(pool, roster, range),
    perSkill(pool, roster, range),
    weeklyTargetFor(pool, context),
  ]);
  const spanOf = new Map(students.map((student) => [student.id, student]));
  const enrolled = days.filter((row) => {
    const span = spanOf.get(row.personId)!;
    return row.day >= span.from && row.day <= span.to;
  });
  const skillTotals = new Map<string, { minutes: number; problems: number }>();
  for (const row of skills) {
    if (!row.skillId) continue;
    const entry = skillTotals.get(row.skillId) ?? { minutes: 0, problems: 0 };
    entry.minutes += row.activeMinutes;
    entry.problems += row.problems;
    skillTotals.set(row.skillId, entry);
  }
  return {
    class: classSummaryOf(context),
    period,
    range,
    weeks: mondays(range),
    weeklyTargetMinutes: target.minutes,
    students: students.map((student) => {
      const rows = enrolled.filter((row) => row.personId === student.id);
      return {
        id: student.id,
        name: student.name,
        first: student.first,
        minutes: Math.round(
          rows.reduce((sum, row) => sum + row.activeMinutes, 0),
        ),
        problems: rows.reduce((sum, row) => sum + row.problems, 0),
        days: rows.map((row) => ({ day: row.day, minutes: row.activeMinutes })),
      };
    }),
    skills: [...skillTotals.entries()]
      .sort(
        (a, b) => b[1].minutes - a[1].minutes || b[1].problems - a[1].problems,
      )
      .slice(0, 12)
      .map(([skillId, entry]) => ({
        skillId,
        title: skillTitleOf(skillId),
        strand: skillStrandOf(skillId),
        minutes: Math.round(entry.minutes),
        problems: entry.problems,
      })),
  };
}

/** One student's days and skills, bound to this class's roster. */
export async function readStudentTime(
  pool: Pool,
  context: ClassContext,
  period: TimePeriod,
  personId: string,
): Promise<StudentTimeResponse | null> {
  const range = await periodRange(pool, context, period);
  const student = (await termRoster(pool, context.id, range)).find(
    (entry) => entry.id === personId,
  );
  if (!student) return null;
  const span = { from: student.from, to: student.to };
  const roster = asMembers([student]);
  const [days, skills] = await Promise.all([
    perDay(pool, roster, span),
    perSkill(pool, roster, span),
  ]);
  return {
    student: { id: student.id, name: student.name, first: student.first },
    range: span,
    days: days.map((row) => ({
      day: row.day,
      minutes: row.activeMinutes,
      problems: row.problems,
    })),
    skills: skills
      .filter((row) => row.skillId)
      .sort(
        (a, b) => b.activeMinutes - a.activeMinutes || b.problems - a.problems,
      )
      .slice(0, 8)
      .map((row) => ({
        skillId: row.skillId,
        title: skillTitleOf(row.skillId),
        strand: skillStrandOf(row.skillId),
        minutes: Math.round(row.activeMinutes),
        problems: row.problems,
      })),
  };
}

export async function teachersOf(pool: Pool, context: ClassContext) {
  const { rows } = await pool.query(
    `SELECT ${PERSON_NAME} AS name FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='teacher' AND p.deleted_at IS NULL
       AND e.begin_on<=$2::date AND (e.end_on IS NULL OR e.end_on>$2::date)
     ORDER BY e.begin_on,p.id`,
    [context.id, context.today],
  );
  return rows.map((row) => row.name as string);
}

export async function readReportCards(
  pool: Pool,
  context: ClassContext,
  termId: string,
): Promise<ReportCardsResponse> {
  const terms = await termsFor(pool, context);
  const term = termById(terms, termId);
  const target = await weeklyTargetFor(pool, context);
  const [rows, teachers] = await Promise.all([
    gradebookRows(pool, context, term, target),
    teachersOf(pool, context),
  ]);
  const course = courseBand(context.courseBands);
  return {
    school: context.orgName,
    class: { name: context.name, course: course?.label ?? context.name },
    term,
    teachers,
    students: rows.map(({ student, suggestion, final }) => {
      const end = suggestion.inputs.endLevel;
      return {
        id: student.id,
        name: student.name,
        identifier: student.identifier,
        final,
        minutes: Math.round(suggestion.inputs.activeMinutes),
        objectivesGained: suggestion.inputs.objectivesGained,
        levelFrom: end ? Math.max(0, end.level - 1.64 * end.sd) : null,
        levelTo: end ? Math.min(13, end.level + 1.64 * end.sd) : null,
      };
    }),
  };
}

/** One learner's own progress as a record shows it: levels on every strand,
 * the last 12 weeks of time, objectives gained over the last year and recent
 * work. A teacher's student record and an adult's own record both read this,
 * from the same rollups. `member.personId` keys the rollup reads; an adult
 * learner, who has no person row, passes its learner id. */
export async function readProgress(
  pool: Pool,
  member: RosterMember & { gradeLevel: number | null },
  timezone: string,
  today: string,
  reference: { from: number; to: number } | null,
  /** "counted": objectives as a grade counts them (above the student's
   * working level less the reach). "all": every one gained, for the
   * learner's own record, where something earned never disappears. */
  objectiveList: "counted" | "all" = "counted",
): Promise<ProgressRecord> {
  const roster: RosterMember[] = [
    { personId: member.personId, learnerId: member.learnerId },
  ];
  const firstWeek = shift(weekStart(today), -7 * 11);
  const lastTerm = shift(today, -365);
  const [stored, days, objectives, work] = await Promise.all([
    levels(pool, roster),
    perDay(pool, roster, { from: firstWeek, to: today }),
    objectivesBySpan(pool, [
      {
        id: member.personId,
        learnerId: member.learnerId,
        name: "",
        first: "",
        identifier: null,
        gradeLevel: member.gradeLevel,
        from: lastTerm,
        to: today,
        beginOn: lastTerm,
        endOn: null,
      },
    ]),
    workSamples(
      pool,
      member.learnerId,
      { from: lastTerm, to: today },
      timezone,
      8,
    ),
  ]);
  const level = stored[0] ?? null;
  const weekly = new Map<string, number>();
  for (const row of days) {
    const week = weekStart(row.day);
    weekly.set(week, (weekly.get(week) ?? 0) + row.activeMinutes);
  }
  return {
    level: level
      ? {
          overall: { level: level.overall.level, sd: level.overall.sd },
          strands: Object.fromEntries(
            Object.entries(level.strands).map(([id, { level: at, sd }]) => [
              id,
              { level: at, sd },
            ]),
          ),
        }
      : null,
    reference,
    strands: level
      ? Object.entries(level.strands)
          .sort(
            (a, b) => b[1].answered - a[1].answered || a[0].localeCompare(b[0]),
          )
          .map(([id]) => ({ id, label: strandLabel(id) }))
      : [],
    weeks: mondays({ from: firstWeek, to: today }).map((week) => ({
      week,
      minutes: Math.round(weekly.get(week) ?? 0),
    })),
    objectives: countedObjectives(
      objectives.get(member.personId) ?? [],
      level && objectiveList === "counted" ? level.overall.level - 1 : null,
    )
      .slice(0, 10)
      .map(({ skillId, day }) => ({
        skillId,
        day,
        title: skillTitleOf(skillId),
        strand: skillStrandOf(skillId),
      })),
    work,
  };
}
export const shiftDay = shift;

type VisibleClass = { id: string; orgId: string; path: string[] };
/** Everything about one student the actor may see: levels and time are the
 * student's; grades are read only for classes in `classes`. */
export async function readStudentRecord(
  pool: Pool,
  personId: string,
  classes: readonly VisibleClass[],
  grades: (classId: string) => boolean,
): Promise<StudentRecordResponse | null> {
  const person = (
    await pool.query(
      `SELECT p.id,p.learner_id AS "learnerId",${PERSON_NAME} AS name,${PERSON_FIRST} AS first,
         p.grade_level AS "gradeLevel",p.identifier,p.timezone,
         (SELECT o.name FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
          WHERE r.person_id=p.id AND r.role='student' ORDER BY r.begin_on DESC,o.id LIMIT 1) AS "orgName"
       FROM amp_people p WHERE p.id=$1 AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL`,
      [personId],
    )
  ).rows[0];
  if (!person) return null;
  const today = (
    await pool.query(
      "SELECT to_char(now() AT TIME ZONE $1,'YYYY-MM-DD') AS today",
      [person.timezone],
    )
  ).rows[0].today as string;
  const contexts = await Promise.all(
    classes.map((entry) => classContext(pool, entry.id)),
  );
  const course =
    contexts.map((context) => courseBand(context.courseBands)).find(Boolean) ??
    null;
  const [progress, signIn, gradeRows] = await Promise.all([
    readProgress(
      pool,
      {
        personId: person.id,
        learnerId: person.learnerId,
        gradeLevel: person.gradeLevel,
      },
      person.timezone,
      today,
      course
        ? { from: course.from, to: course.to }
        : person.gradeLevel === null
          ? null
          : { from: person.gradeLevel - 0.5, to: person.gradeLevel + 0.5 },
    ),
    pool.query(
      `SELECT
         (SELECT max(k.created_at) FROM amp_person_credentials k
          WHERE k.person_id=$1 AND k.kind='card' AND k.revoked_at IS NULL AND (k.expires_at IS NULL OR k.expires_at>now())) AS "cardIssuedAt",
         EXISTS(SELECT 1 FROM amp_person_credentials k WHERE k.person_id=$1 AND k.kind='picture' AND k.revoked_at IS NULL) AS "picturesSet",
         EXISTS(SELECT 1 FROM amp_person_credentials k WHERE k.person_id=$1 AND k.kind='picture' AND k.revoked_at IS NULL AND k.locked_until>now()) AS locked,
         (SELECT count(*)::int FROM amp_student_sessions s WHERE s.person_id=$1 AND s.revoked_at IS NULL AND s.expires_at>now()) AS "activeSessions",
         (SELECT max(s.last_seen_at) FROM amp_student_sessions s WHERE s.person_id=$1) AS "lastSeenAt"`,
      [personId],
    ),
    Promise.all(
      contexts
        .filter((context) => grades(context.id))
        .map(async (context) => {
          const target = await weeklyTargetFor(pool, context);
          const terms = (await termsFor(pool, context)).filter(
            (term): term is Term & { state: "open" | "closed" } =>
              term.state !== "upcoming",
          );
          return Promise.all(
            terms.map(async (term) => {
              const row = (
                await gradebookRows(pool, context, term, target)
              ).find((entry) => entry.student.id === personId);
              return row
                ? [
                    {
                      classId: context.id,
                      className: context.name,
                      termId: term.id,
                      termName: term.name,
                      state: term.state,
                      suggestion: toSuggestionResource(row.suggestion),
                      final: row.final,
                    },
                  ]
                : [];
            }),
          );
        }),
    ),
  ]);
  const flags = signIn.rows[0];
  return {
    student: {
      id: person.id,
      name: person.name,
      first: person.first,
      gradeLevel: person.gradeLevel,
      identifier: person.identifier,
    },
    orgName: person.orgName ?? "",
    classes: contexts.map((context) => ({
      id: context.id,
      name: context.name,
      course: courseBand(context.courseBands),
    })),
    ...progress,
    grades: gradeRows.flat(2),
    signIn: {
      cardIssuedAt: flags.cardIssuedAt?.toISOString() ?? null,
      picturesSet: flags.picturesSet,
      locked: flags.locked,
      activeSessions: flags.activeSessions,
      lastSeenAt: flags.lastSeenAt?.toISOString() ?? null,
    },
  };
}
