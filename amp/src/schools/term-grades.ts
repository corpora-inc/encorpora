import type { PoolClient } from "pg";
import { skills } from "../curriculum/catalog.js";
import type { GradeBand } from "../curriculum/types.js";
import { gradeNumber } from "../learning/frontier.js";
import { gradeName } from "../learning/level-check.js";
import { answerText } from "../math/selection-response.js";
import { displayAnswer } from "../math/polish.js";
import type { ProblemResponse } from "../math/contracts.js";
import { SchoolError } from "./contracts.js";
import { recordEvent } from "./events.js";
import {
  DEFAULT_GRADE_POLICY,
  rangeLetters,
  suggestGrade,
  weeklyMinutes,
  type GradeActivity,
  type GradeInput,
  type GradePolicy,
  type GradeSuggestion,
  type StudentLevel,
} from "./grade-policy.js";
import type { SchoolRepository } from "./repository.js";
import {
  assertSettingsWritable,
  resolveSettings,
  SettingLockedError,
  type SettingsScope,
} from "./settings.js";
import type {
  ClassSummary,
  CourseResource,
  SuggestionResource,
  TermResource,
  WorkItem,
} from "./teacher-contracts.js";
import { startLevelSql } from "./start-level.js";

type Database = Pick<PoolClient, "query">;
const catalog = new Map(skills.map((skill) => [skill.id, skill]));
/** SQL: a student's name for staff, and how a sentence calls them. */
export const PERSON_NAME = `COALESCE(p.display_name,p.given_name||COALESCE(' '||p.family_name,''))`;
export const PERSON_FIRST = `COALESCE(p.display_name,p.given_name)`;

export type ClassContext = {
  id: string;
  orgId: string;
  path: string[];
  name: string;
  courseBands: string[];
  gradingKind: string;
  sessionId: string;
  orgName: string;
  timezone: string;
  /** Today in the school's timezone. */
  today: string;
  hour: number;
  /** The org's kind: a family's class reads for a family. */
  orgKind: string;
};

/** What a class is and when "today" is, in one read. */
export async function classContext(
  db: Database,
  classId: string,
): Promise<ClassContext> {
  const row = (
    await db.query(
      `SELECT c.id,c.org_id AS "orgId",o.path,c.name,c.course_bands AS "courseBands",
         c.grading_kind AS "gradingKind",c.session_id AS "sessionId",o.name AS "orgName",o.timezone,o.kind AS "orgKind",
         to_char(now() AT TIME ZONE o.timezone,'YYYY-MM-DD') AS today,
         extract(hour FROM now() AT TIME ZONE o.timezone)::int AS hour
       FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id WHERE c.id=$1`,
      [classId],
    )
  ).rows[0];
  if (!row) throw new SchoolError(404, "not_found");
  return row;
}

const isBand = (band: string): band is GradeBand => band in gradeNumber;
/** A class's course on the level axis: Grade 5 runs from 4.5 up to 5.5, and a
 * course over two bands from the low edge of one to the high edge of the other.
 * Null, including for a band this model doesn't know, grades each student
 * against their own grade. */
export function courseBand(bands: readonly string[]): CourseResource | null {
  const levels = bands.filter(isBand).map((band) => gradeNumber[band]);
  if (!levels.length) return null;
  const low = Math.min(...levels),
    high = Math.max(...levels);
  return {
    label:
      low === high ? gradeName(low) : `${gradeName(low)} to ${gradeName(high)}`,
    level: low,
    from: low - 0.5,
    to: high + 0.5,
  };
}
export const classSummaryOf = (context: ClassContext): ClassSummary => ({
  id: context.id,
  orgId: context.orgId,
  name: context.name,
  orgName: context.orgName,
  course: courseBand(context.courseBands),
});

export type Term = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: TermResource["state"];
};
const SESSION = `id,name,kind,starts_on::text AS "startsOn",ends_on::text AS "endsOn"`;
/** The class's grading periods from the session tree, using its `grading_kind`;
 * with none of that kind entered, its own session is the one term. */
export async function termsFor(
  db: Database,
  context: Pick<ClassContext, "id" | "sessionId" | "gradingKind" | "today">,
): Promise<Term[]> {
  const [tree, frozen] = await Promise.all([
    db.query(
      `WITH RECURSIVE tree AS (
         SELECT * FROM amp_academic_sessions WHERE id=$1
         UNION ALL SELECT s.* FROM amp_academic_sessions s JOIN tree ON s.parent_id=tree.id
       ) SELECT ${SESSION} FROM tree ORDER BY starts_on,id`,
      [context.sessionId],
    ),
    db.query(
      "SELECT DISTINCT session_id FROM amp_term_grades WHERE class_id=$1 AND frozen_at IS NOT NULL",
      [context.id],
    ),
  ]);
  const closed = new Set(frozen.rows.map((row) => row.session_id));
  const ofKind = tree.rows.filter((row) => row.kind === context.gradingKind);
  const chosen = ofKind.length
    ? ofKind
    : tree.rows.filter((row) => row.id === context.sessionId);
  return chosen.map(({ id, name, startsOn, endsOn }) => ({
    id,
    name,
    startsOn,
    endsOn,
    state: closed.has(id)
      ? "closed"
      : startsOn > context.today
        ? "upcoming"
        : "open",
  }));
}
/** What a screen opens to: the term today is in, else the last one begun. */
export function currentTerm(terms: readonly Term[], today: string) {
  return (
    terms.find((term) => term.startsOn <= today && term.endsOn >= today) ??
    terms.filter((term) => term.startsOn <= today).at(-1) ??
    terms[0] ??
    null
  );
}
export function termById(terms: readonly Term[], id: string): Term {
  const term = terms.find((entry) => entry.id === id);
  if (!term) throw new SchoolError(404, "not_found");
  return term;
}

/** The school year a class's session sits in. */
export async function yearFor(
  db: Database,
  sessionId: string,
): Promise<{ from: string; to: string }> {
  const row = (
    await db.query(
      `WITH RECURSIVE up AS (
         SELECT * FROM amp_academic_sessions WHERE id=$1
         UNION ALL SELECT s.* FROM amp_academic_sessions s JOIN up ON s.id=up.parent_id
       ) SELECT starts_on::text AS "from",ends_on::text AS "to" FROM up
       ORDER BY (kind='year') DESC,starts_on LIMIT 1`,
      [sessionId],
    )
  ).rows[0];
  if (!row) throw new SchoolError(404, "not_found");
  return row;
}

export type TermStudent = {
  id: string;
  learnerId: string;
  name: string;
  first: string;
  identifier: string | null;
  gradeLevel: number | null;
  /** Enrolled days inside the range. */
  from: string;
  to: string;
  beginOn: string;
  endOn: string | null;
};
const previousDay = (iso: string) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
/** Everyone enrolled at some point in the range, each clipped to their enrolled
 * days: a student added mid-term counts from then, and one who left, up to then.
 * Roster-bound reads take this list, so they can't reach anyone else. */
export async function termRoster(
  db: Database,
  classId: string,
  range: { from: string; to: string },
): Promise<TermStudent[]> {
  if (range.to < range.from) return [];
  const { rows } = await db.query(
    `SELECT p.id,p.learner_id AS "learnerId",${PERSON_NAME} AS name,${PERSON_FIRST} AS first,
       p.identifier,p.grade_level AS "gradeLevel",min(e.begin_on)::text AS "beginOn",
       CASE WHEN bool_or(e.end_on IS NULL) THEN NULL ELSE max(e.end_on)::text END AS "endOn"
     FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
     WHERE e.class_id=$1 AND e.role='student' AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
       AND e.begin_on<=$3::date AND (e.end_on IS NULL OR e.end_on>$2::date)
     GROUP BY p.id ORDER BY lower(${PERSON_NAME}),p.id`,
    [classId, range.from, range.to],
  );
  return rows
    .map((row) => ({
      ...row,
      from: row.beginOn > range.from ? row.beginOn : range.from,
      to:
        row.endOn && previousDay(row.endOn) < range.to
          ? previousDay(row.endOn)
          : range.to,
    }))
    .filter((row) => row.from <= row.to);
}

/* Roster-bound reads, each over its own enrolled days. */
const SPANS = `unnest($1::uuid[],$2::text[],$3::date[],$4::date[]) AS r(person_id,learner_id,day_from,day_to)`;
const spans = (students: readonly TermStudent[]) => [
  students.map((student) => student.id),
  students.map((student) => student.learnerId),
  students.map((student) => student.from),
  students.map((student) => student.to),
];

const emptyActivity: GradeActivity = {
  activeMinutes: 0,
  unmeasuredProblems: 0,
  daysActive: 0,
  review: 0,
  reviewIndependent: 0,
  problems: 0,
  correct: 0,
  independent: 0,
};
export async function activityBySpan(
  db: Database,
  students: readonly TermStudent[],
): Promise<Map<string, GradeActivity>> {
  if (!students.length) return new Map();
  const { rows } = await db.query(
    `WITH days AS (
       SELECT r.person_id,f.day,sum(f.attempts) AS attempts,sum(f.correct) AS correct,sum(f.independent) AS independent,
         sum(f.review) AS review,sum(f.review_independent) AS review_independent,sum(f.active_ms) AS active_ms
       FROM ${SPANS} JOIN LATERAL (
         SELECT day,attempts,correct,independent,review,review_independent,0::bigint AS active_ms
         FROM amp_skill_days s WHERE s.learner_id=r.learner_id AND s.day BETWEEN r.day_from AND r.day_to
         UNION ALL
         SELECT day,0,0,0,0,0,active_ms FROM amp_active_days a WHERE a.learner_id=r.learner_id AND a.day BETWEEN r.day_from AND r.day_to
       ) f ON true
       GROUP BY r.person_id,f.day
     )
     SELECT person_id AS "personId",round(sum(active_ms)/60000.0,1)::float8 AS "activeMinutes",
       COALESCE(sum(attempts) FILTER (WHERE active_ms=0),0)::int AS "unmeasuredProblems",
       count(*)::int AS "daysActive",sum(review)::int AS review,sum(review_independent)::int AS "reviewIndependent",
       sum(attempts)::int AS problems,sum(correct)::int AS correct,sum(independent)::int AS independent
     FROM days GROUP BY person_id`,
    spans(students),
  );
  return new Map(
    rows.map(({ personId, ...activity }) => [personId as string, activity]),
  );
}

/** Each student's level where their span starts, once placement settled
 * (`start-level.ts`), and the latest inside it. */
export async function levelsBySpan(
  db: Database,
  students: readonly TermStudent[],
): Promise<
  Map<string, { start: StudentLevel | null; end: StudentLevel | null }>
> {
  if (!students.length) return new Map();
  const { rows } = await db.query(
    `SELECT r.person_id AS "personId",
       ${startLevelSql({ select: "d.frontier", learner: "r.learner_id", from: "r.day_from", to: "r.day_to" })} AS start,
       (SELECT frontier FROM amp_level_days d WHERE d.learner_id=r.learner_id AND d.day BETWEEN r.day_from AND r.day_to ORDER BY d.day DESC LIMIT 1) AS "end"
     FROM ${SPANS}`,
    spans(students),
  );
  return new Map(
    rows.map(({ personId, start, end }) => [personId, { start, end }]),
  );
}

export type GainedObjective = { skillId: string; day: string };
/** Objectives first demonstrated inside each student's span: the day their own
 * independent successes on that skill reached the policy's count. Direct
 * evidence only, so a downstream answer never credits an ancestor. */
export async function objectivesBySpan(
  db: Database,
  students: readonly TermStudent[],
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): Promise<Map<string, GainedObjective[]>> {
  if (!students.length) return new Map();
  const { rows } = await db.query(
    `SELECT r.person_id AS "personId",o.skill_id AS "skillId",o.day::text AS day
     FROM ${SPANS} JOIN LATERAL (
       SELECT skill_id,min(day) FILTER (WHERE running>=$5) AS day FROM (
         SELECT skill_id,day,sum(independent) OVER (PARTITION BY skill_id ORDER BY day) AS running
         FROM amp_skill_days s WHERE s.learner_id=r.learner_id AND s.day<=r.day_to
       ) w GROUP BY skill_id
     ) o ON o.day BETWEEN r.day_from AND r.day_to
     ORDER BY o.day DESC,o.skill_id`,
    [...spans(students), policy.growth.demonstratedSuccesses],
  );
  const found = new Map<string, GainedObjective[]>();
  for (const { personId, skillId, day } of rows) {
    const list = found.get(personId) ?? [];
    list.push({ skillId, day });
    found.set(personId, list);
  }
  return found;
}

/** The objectives that count as ground gained: a student showing a skill well
 * below where they started is showing what they already held. */
export function countedObjectives(
  objectives: readonly GainedObjective[],
  startLevel: number | null | undefined,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): GainedObjective[] {
  if (startLevel === null || startLevel === undefined) return [...objectives];
  return objectives.filter(({ skillId }) => {
    const band = catalog.get(skillId)?.gradeBand;
    return (
      !band || gradeNumber[band] >= startLevel - policy.growth.objectiveReach
    );
  });
}

export const middleOf = (values: readonly number[]): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[half]!
    : (sorted[half - 1]! + sorted[half]!) / 2;
};

export type WeeklyTarget = { minutes: number | null; locked: boolean };
/** A class's weekly target through the settings chain. */
export async function weeklyTargetFor(
  db: Database,
  context: Pick<ClassContext, "id" | "path">,
): Promise<WeeklyTarget> {
  const { rows } = await db.query(
    `SELECT scope_kind,scope_id,"values",locked FROM amp_scope_settings
     WHERE (scope_kind='org' AND scope_id=ANY($1::uuid[])) OR (scope_kind='class' AND scope_id=$2)`,
    [context.path, context.id],
  );
  const scope = (kind: "org" | "class", id: string): SettingsScope[] => {
    const row = rows.find((r) => r.scope_kind === kind && r.scope_id === id);
    return row ? [{ kind, id, values: row.values, locked: row.locked }] : [];
  };
  const resolved = resolveSettings([
    ...context.path.flatMap((id) => scope("org", id)),
    ...scope("class", context.id),
  ]).weeklyTargetMinutes;
  return {
    minutes: resolved.value ?? null,
    locked: resolved.lockedBy !== null,
  };
}

export type ComputedStudent = {
  student: TermStudent;
  suggestion: GradeSuggestion;
  objectives: GainedObjective[];
};
/** Suggested ranges for a whole class from rollups and level days, in a few
 * statements: no replay, no learner lock. */
export async function computeTerm(
  db: Database,
  context: ClassContext,
  term: Pick<Term, "startsOn" | "endsOn">,
  target: WeeklyTarget,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): Promise<ComputedStudent[]> {
  const range = {
    from: term.startsOn,
    to: term.endsOn < context.today ? term.endsOn : context.today,
  };
  const students = await termRoster(db, context.id, range);
  if (!students.length) return [];
  const [year, activity, level, objectives] = await Promise.all([
    yearFor(db, context.sessionId),
    activityBySpan(db, students),
    levelsBySpan(db, students),
    objectivesBySpan(db, students, policy),
  ]);
  const course = courseBand(context.courseBands);
  const counted = new Map(
    students.map((student) => [
      student.id,
      countedObjectives(
        objectives.get(student.id) ?? [],
        level.get(student.id)?.start?.overall.level,
        policy,
      ),
    ]),
  );
  const inputs = students.map((student): GradeInput => {
    const stored = level.get(student.id);
    return {
      year,
      enrolled: { from: student.from, to: student.to },
      course: course && { from: course.from, to: course.to },
      gradeLevel: student.gradeLevel,
      start: stored?.start ?? null,
      end: stored?.end ?? null,
      objectivesGained: counted.get(student.id)!.length,
      activity: activity.get(student.id) ?? emptyActivity,
      weeklyTargetMinutes: target.minutes,
      classMedianWeeklyMinutes: null,
    };
  });
  const median = middleOf(
    inputs
      .filter((input) => input.activity.daysActive > 0)
      .map((input) => weeklyMinutes(input, policy)),
  );
  return students.map((student, index) => ({
    student,
    suggestion: suggestGrade(
      { ...inputs[index]!, classMedianWeeklyMinutes: median },
      policy,
    ),
    objectives: counted.get(student.id)!,
  }));
}

export const toSuggestionResource = (
  suggestion: GradeSuggestion,
): SuggestionResource => ({
  status: suggestion.status,
  low: suggestion.low,
  high: suggestion.high,
  letters: rangeLetters(suggestion),
  components: suggestion.components.map(({ id, score }) => ({ id, score })),
});

export type GradebookRow = {
  student: Pick<TermStudent, "id" | "name" | "first" | "identifier">;
  suggestion: GradeSuggestion;
  final: string | null;
  /** The enrolled days this counted, when they can be read. */
  learnerId: string | null;
  from: string;
  to: string;
  beginOn: string | null;
  endOn: string | null;
};
/** One row per student for one term. A closed term reads what was frozen, and
 * nothing computed today can change it. An upcoming term has no rows. */
export async function gradebookRows(
  db: Database,
  context: ClassContext,
  term: Term,
  target: WeeklyTarget,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): Promise<GradebookRow[]> {
  if (term.state === "upcoming") return [];
  if (term.state === "closed") {
    const { rows } = await db.query(
      `SELECT p.id,${PERSON_NAME} AS name,${PERSON_FIRST} AS first,p.identifier,p.learner_id AS "learnerId",
         g.suggested,g.final_value AS final
       FROM amp_term_grades g JOIN amp_people p ON p.id=g.person_id
       WHERE g.class_id=$1 AND g.session_id=$2 AND g.frozen_at IS NOT NULL
       ORDER BY lower(${PERSON_NAME}),p.id`,
      [context.id, term.id],
    );
    return rows.map((row) => ({
      student: {
        id: row.id,
        name: row.name,
        first: row.first,
        identifier: row.identifier,
      },
      suggestion: row.suggested,
      final: row.final,
      learnerId: row.learnerId,
      from: row.suggested.inputs.enrolled.from,
      to: row.suggested.inputs.enrolled.to,
      beginOn: null,
      endOn: null,
    }));
  }
  const [computed, finals] = await Promise.all([
    computeTerm(db, context, term, target, policy),
    db.query(
      `SELECT person_id,final_value FROM amp_term_grades
       WHERE class_id=$1 AND session_id=$2 AND final_value IS NOT NULL`,
      [context.id, term.id],
    ),
  ]);
  const final = new Map(
    finals.rows.map((row) => [row.person_id, row.final_value as string]),
  );
  return computed.map(({ student, suggestion }) => ({
    student,
    suggestion,
    final: final.get(student.id) ?? null,
    learnerId: student.learnerId,
    from: student.from,
    to: student.to,
    beginOn: student.beginOn,
    endOn: student.endOn,
  }));
}

/** Saves a final grade, whatever form the school uses, and logs the change. An
 * empty value clears it. */
export async function setFinalGrade(
  repository: SchoolRepository,
  context: ClassContext,
  term: Term,
  personId: string,
  value: string,
  actorPersonId: string | null,
): Promise<{ final: string | null }> {
  if (term.state === "upcoming") throw new SchoolError(404, "not_found");
  if (term.state === "closed") throw new SchoolError(409, "term_closed");
  const students = await termRoster(repository.pool, context.id, {
    from: term.startsOn,
    to: term.endsOn < context.today ? term.endsOn : context.today,
  });
  if (!students.some((student) => student.id === personId))
    throw new SchoolError(404, "not_found");
  return repository.transaction(async (client) => {
    await lockTerm(client, context.id, term.id);
    await assertTermOpen(client, context.id, term.id);
    const before =
      (
        await client.query(
          `SELECT final_value FROM amp_term_grades
           WHERE class_id=$1 AND session_id=$2 AND person_id=$3`,
          [context.id, term.id, personId],
        )
      ).rows[0]?.final_value ?? null;
    const after = value === "" ? null : value;
    if (before === after) return { final: after };
    await client.query(
      `INSERT INTO amp_term_grades(class_id,session_id,person_id,final_value,final_by,final_at)
       VALUES($1,$2,$3,$4,$5,now())
       ON CONFLICT(class_id,session_id,person_id) DO UPDATE
       SET final_value=EXCLUDED.final_value,final_by=EXCLUDED.final_by,final_at=now()`,
      [context.id, term.id, personId, after, actorPersonId],
    );
    await recordEvent(client, {
      orgId: context.orgId,
      actorPersonId,
      action: "grade.final-set",
      targetKind: "person",
      targetId: personId,
      detail: {
        before: { value: before },
        after: { value: after, classId: context.id, sessionId: term.id },
      },
    });
    return { final: after };
  });
}

const lockTerm = (client: PoolClient, classId: string, termId: string) =>
  client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    `school-term:${classId}:${termId}`,
  ]);
async function assertTermOpen(
  client: PoolClient,
  classId: string,
  termId: string,
) {
  const frozen = await client.query(
    `SELECT 1 FROM amp_term_grades WHERE class_id=$1 AND session_id=$2 AND frozen_at IS NOT NULL LIMIT 1`,
    [classId, termId],
  );
  if (frozen.rowCount) throw new SchoolError(409, "term_closed");
}

/** Freezes every student's suggestion with its inputs. New answers never change
 * a closed term, and finals in it can't be edited. */
export async function closeTerm(
  repository: SchoolRepository,
  context: ClassContext,
  term: Term,
  actorPersonId: string | null,
  policy: GradePolicy = DEFAULT_GRADE_POLICY,
): Promise<{ frozen: number }> {
  if (term.state === "upcoming") throw new SchoolError(404, "not_found");
  if (term.state === "closed") throw new SchoolError(409, "term_closed");
  const target = await weeklyTargetFor(repository.pool, context);
  const computed = await computeTerm(
    repository.pool,
    context,
    term,
    target,
    policy,
  );
  if (!computed.length) throw new SchoolError(409, "term_empty");
  return repository.transaction(async (client) => {
    await lockTerm(client, context.id, term.id);
    await assertTermOpen(client, context.id, term.id);
    await client.query(
      `INSERT INTO amp_term_grades(class_id,session_id,person_id,suggested,frozen_at)
       SELECT $1,$2,person_id,suggested,now()
       FROM unnest($3::uuid[],$4::jsonb[]) AS f(person_id,suggested)
       ON CONFLICT(class_id,session_id,person_id) DO UPDATE
       SET suggested=EXCLUDED.suggested,frozen_at=EXCLUDED.frozen_at`,
      [
        context.id,
        term.id,
        computed.map(({ student }) => student.id),
        computed.map(({ suggestion }) => JSON.stringify(suggestion)),
      ],
    );
    await recordEvent(client, {
      orgId: context.orgId,
      actorPersonId,
      action: "term.closed",
      targetKind: "class",
      targetId: context.id,
      detail: {
        after: {
          sessionId: term.id,
          students: computed.length,
          policyVersion: policy.version,
        },
      },
    });
    return { frozen: computed.length };
  });
}

/** The one number a teacher sets. Null clears it, back to the class median. */
export async function setWeeklyTarget(
  repository: SchoolRepository,
  context: ClassContext,
  minutes: number | null,
  actorPersonId: string | null,
): Promise<WeeklyTarget> {
  return repository.transaction(async (client) => {
    const above = await client.query(
      `SELECT scope_kind,scope_id,"values",locked FROM amp_scope_settings
       WHERE scope_kind='org' AND scope_id=ANY($1::uuid[])`,
      [context.path],
    );
    try {
      assertSettingsWritable(
        above.rows.map((row) => ({
          kind: row.scope_kind,
          id: row.scope_id,
          values: row.values,
          locked: row.locked,
        })),
        { weeklyTargetMinutes: minutes ?? undefined },
      );
    } catch (error) {
      if (error instanceof SettingLockedError)
        throw new SchoolError(409, "setting_locked");
      throw error;
    }
    const previous = (
      await client.query(
        `SELECT "values"->'weeklyTargetMinutes' AS minutes FROM amp_scope_settings
         WHERE scope_kind='class' AND scope_id=$1 FOR UPDATE`,
        [context.id],
      )
    ).rows[0]?.minutes;
    await client.query(
      `INSERT INTO amp_scope_settings(scope_kind,scope_id,"values")
       VALUES('class',$1,$2::jsonb)
       ON CONFLICT(scope_kind,scope_id) DO UPDATE
       SET "values"=(amp_scope_settings."values"-'weeklyTargetMinutes')||EXCLUDED."values",updated_at=now()`,
      [
        context.id,
        JSON.stringify(
          minutes === null ? {} : { weeklyTargetMinutes: minutes },
        ),
      ],
    );
    await recordEvent(client, {
      orgId: context.orgId,
      actorPersonId,
      action: "settings.changed",
      targetKind: "class",
      targetId: context.id,
      detail: {
        before: { weeklyTargetMinutes: previous ?? null },
        after: { weeklyTargetMinutes: minutes },
      },
    });
    return { minutes, locked: false };
  });
}

export const skillTitleOf = (id: string) => catalog.get(id)?.title ?? id;
export const skillStrandOf = (id: string) =>
  catalog.get(id)?.strand ?? "number";

function readable(
  response: ProblemResponse | undefined,
  raw: unknown,
  strand: string,
): string | null {
  if (typeof raw !== "string" || !raw || !response) return null;
  try {
    const text = answerText(response, raw);
    return response.kind === "number" || response.kind === "fraction"
      ? strand === "fractions"
        ? text
        : displayAnswer(text)
      : text;
  } catch {
    return null;
  }
}
/** Real problems a student worked: prompt and answer from the immutable instance
 * and attempt, in a single read that never opens a learner transaction. */
export async function workSamples(
  db: Database,
  learnerId: string,
  range: { from: string; to: string },
  timezone: string,
  limit: number,
  offset = 0,
): Promise<WorkItem[]> {
  const { rows } = await db.query(
    `SELECT a.problem_id AS id,a.outcome,i.content->'public' AS problem,
       i.content->'selection'->>'reason' AS reason,
       ((a.outcome->>'createdAt')::timestamptz AT TIME ZONE $4)::date::text AS day
     FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id AND i.learner_id=a.learner_id
     WHERE a.learner_id=$1
       AND ((a.outcome->>'createdAt')::timestamptz AT TIME ZONE $4)::date BETWEEN $2::date AND $3::date
     ORDER BY a.evidence_sequence DESC LIMIT $5 OFFSET $6`,
    [learnerId, range.from, range.to, timezone, limit, offset],
  );
  return rows.map((row) => {
    const { outcome, problem } = row;
    const skillId: string = outcome.skillId ?? problem?.skillId ?? "";
    const strand = skillStrandOf(skillId);
    const paper = (outcome.evidenceWeight ?? 1) < 1;
    const result: WorkItem["result"] = !outcome.correct
      ? "missed"
      : paper
        ? "paper"
        : outcome.assisted
          ? "hint"
          : "independent";
    return {
      id: row.id,
      day: row.day,
      prompt: problem?.prompt ?? "",
      answer: readable(problem?.response, outcome.answer, strand),
      response: readable(problem?.response, outcome.response, strand),
      result,
      review: row.reason === "review",
      skill: skillTitleOf(skillId),
      strand,
    };
  });
}
