import { touchDemoOfPersonSql } from "./demo/sql.js";
import type { Pool } from "pg";
import { z } from "zod";
import { ACTIVE_STUDENT, activeToday, hashStudentToken } from "./principal.js";
import {
  helpEventSchema,
  helpEventsCte,
  helpRows,
  isKnownSkill,
  MAX_HELP_EVENTS,
} from "./help-events.js";

/** Evidence read model: rollups written by the `amp_attempts` trigger, level
 * days written by `/batches`, and the student heartbeat. Every read takes a
 * roster, so a caller can't ask about a learner it hasn't authorized. */
export type RosterMember = { personId: string; learnerId: string };
export type DateRange = { from: string; to: string };

export const activitySurfaces = [
  "practice",
  "lesson",
  "feedback",
  "map",
  "other",
  // Help showing over the route: its time is its own (migration 0111).
  "hint",
  "video",
  "example",
] as const;
/** Longest time one heartbeat can claim, and the slack over wall time. */
export const HEARTBEAT_MAX_MS = 90_000;
export const HEARTBEAT_SLACK_MS = 5_000;
/** Ten deltas and twenty help events, with room. */
export const HEARTBEAT_BODY_LIMIT = 8192;

export const heartbeatSchema = z.strictObject({
  deltas: z
    .array(
      z.strictObject({
        surface: z.enum(activitySurfaces),
        problemId: z.string().min(1).max(160).optional(),
        /** The lesson's skill when no problem is showing; a skill the
         * catalog doesn't know counts with none. */
        skillId: z.string().min(1).max(100).optional(),
        activeMs: z.number().int().min(0).max(HEARTBEAT_MAX_MS),
      }),
    )
    .max(10),
  /** Help opened since the last heartbeat (`help-events.ts`). */
  events: z.array(helpEventSchema).max(MAX_HELP_EVENTS).optional(),
});
/** The deltas as SQL reads them: a skill only when the catalog knows it. */
export const heartbeatDeltas = (
  deltas: z.infer<typeof heartbeatSchema>["deltas"],
) =>
  JSON.stringify(
    deltas.map(({ skillId, ...delta }) =>
      skillId && isKnownSkill(skillId) ? { ...delta, skillId } : delta,
    ),
  );
/** The deltas' skill: the problem's when it is the learner's, else the one
 * the delta names. Shared by the student and adult heartbeats. */
export const CREDITED_SKILL =
  "COALESCE(i.content->'public'->>'skillId',raw.skill_id,'')";

/** Credits a student's heartbeat in one statement, outside the learner lock.
 * The deltas' total is scaled down to the time since the session was last
 * seen plus five seconds, and to 90 seconds at most. A problem that isn't this
 * learner's counts toward its surface with no skill. Returns false when the
 * token isn't a live student's. */
export async function recordHeartbeat(
  pool: Pool,
  token: string,
  body: unknown,
): Promise<boolean> {
  const { deltas, events } = heartbeatSchema.parse(body);
  if (!/^st_[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const { rows } = await pool.query(
    `WITH live AS (
       SELECT s.id,s.person_id,s.last_seen_at AS previous,p.learner_id,p.timezone
       FROM amp_student_sessions s
       JOIN amp_people p ON p.id=s.person_id
       JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL
       WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
         AND p.deleted_at IS NULL AND ${ACTIVE_STUDENT}
       FOR UPDATE OF s
     ), room AS (
       SELECT LEAST($3::bigint,
         floor(GREATEST(0,extract(epoch FROM now()-previous))*1000)::bigint+$4::bigint) AS ms FROM live
     ), raw AS (
       SELECT d->>'surface' AS surface,d->>'problemId' AS problem_id,d->>'skillId' AS skill_id,(d->>'activeMs')::bigint AS ms
       FROM jsonb_array_elements($2::jsonb) d
     ), scale AS (
       SELECT LEAST(1,room.ms::numeric/NULLIF((SELECT sum(ms) FROM raw),0)) AS factor FROM room
     ), credited AS (
       SELECT raw.surface,${CREDITED_SKILL} AS skill_id,
         floor(raw.ms*COALESCE(scale.factor,1))::bigint AS ms
       FROM raw CROSS JOIN scale CROSS JOIN live
       LEFT JOIN amp_instances i ON i.id=raw.problem_id AND i.learner_id=live.learner_id
     ), written AS (
       INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT live.learner_id,(now() AT TIME ZONE live.timezone)::date,c.surface,c.skill_id,sum(c.ms)
       FROM credited c CROSS JOIN live WHERE c.ms>0 GROUP BY live.learner_id,live.timezone,c.surface,c.skill_id
       ON CONFLICT(learner_id,day,surface,skill_id) DO UPDATE SET active_ms=amp_active_days.active_ms+EXCLUDED.active_ms
     ), touched AS (
       UPDATE amp_student_sessions s SET last_seen_at=now() FROM live WHERE s.id=live.id
     ), demo_seen AS (
       ${touchDemoOfPersonSql("(SELECT person_id FROM live)")}
     ), ${helpEventsCte(5)}
     SELECT count(*)::int AS live FROM live`,
    [
      hashStudentToken(token),
      heartbeatDeltas(deltas),
      HEARTBEAT_MAX_MS,
      HEARTBEAT_SLACK_MS,
      helpRows(events),
    ],
  );
  return rows[0].live === 1;
}

export const dateSchema = z.iso.date();
export const rangeSchema = z
  .strictObject({ from: dateSchema, to: dateSchema })
  .refine(
    ({ from, to }) =>
      from <= to && Date.parse(to) - Date.parse(from) <= 400 * 86_400_000,
    "range",
  );
export const levelsQuerySchema = z.strictObject({ on: dateSchema.optional() });

/** Active students enrolled in a class today who still have a learner. */
export async function classRoster(
  pool: Pool,
  classId: string,
): Promise<RosterMember[]> {
  return (
    await pool.query(
      `SELECT p.id AS "personId",p.learner_id AS "learnerId"
       FROM amp_enrollments e
       JOIN amp_classes c ON c.id=e.class_id JOIN amp_orgs o ON o.id=c.org_id
       JOIN amp_people p ON p.id=e.person_id AND p.deleted_at IS NULL AND p.learner_id IS NOT NULL
       WHERE e.class_id=$1 AND e.role='student' AND ${activeToday("e", "o")}
       ORDER BY p.id`,
      [classId],
    )
  ).rows;
}
export async function studentRoster(
  pool: Pool,
  personId: string,
): Promise<RosterMember[]> {
  return (
    await pool.query(
      `SELECT id AS "personId",learner_id AS "learnerId" FROM amp_people
       WHERE id=$1 AND deleted_at IS NULL AND learner_id IS NOT NULL`,
      [personId],
    )
  ).rows;
}

/** Skill rollup rows and active-time rows as one stream of facts. */
const FACTS = `(
  SELECT learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent,0::bigint AS active_ms
  FROM amp_skill_days WHERE learner_id=ANY($1::text[]) AND day BETWEEN $2::date AND $3::date
  UNION ALL
  SELECT learner_id,day,skill_id,0,0,0,0,0,0,active_ms
  FROM amp_active_days WHERE learner_id=ANY($1::text[]) AND day BETWEEN $2::date AND $3::date
) f`;
const SUMS = `sum(f.attempts)::int AS problems,sum(f.correct)::int AS correct,sum(f.independent)::int AS independent,
  sum(f.assisted)::int AS assisted,sum(f.review)::int AS review,sum(f.review_independent)::int AS "reviewIndependent",
  round(sum(f.active_ms)/60000.0,1)::float8 AS "activeMinutes"`;
const ROSTER = "unnest($4::uuid[],$1::text[]) AS r(person_id,learner_id)";
const args = (roster: RosterMember[], { from, to }: DateRange) => [
  roster.map((m) => m.learnerId),
  from,
  to,
  roster.map((m) => m.personId),
];

export type ActivityTotals = {
  personId: string;
  problems: number;
  correct: number;
  independent: number;
  assisted: number;
  review: number;
  reviewIndependent: number;
  activeMinutes: number;
  daysActive: number;
  lastActive: string | null;
};
/** Per-student totals over the range; students with no activity read zero.
 * `lastActive` is the latest day with any activity, in or out of the range. */
export async function totals(
  pool: Pool,
  roster: RosterMember[],
  range: DateRange,
): Promise<ActivityTotals[]> {
  if (!roster.length) return [];
  return (
    await pool.query(
      `WITH sums AS (
         SELECT f.learner_id,${SUMS},count(DISTINCT f.day)::int AS days
         FROM ${FACTS} GROUP BY f.learner_id
       ), last AS (
         SELECT learner_id,max(day)::text AS last_day FROM (
           SELECT learner_id,day FROM amp_skill_days WHERE learner_id=ANY($1::text[])
           UNION ALL SELECT learner_id,day FROM amp_active_days WHERE learner_id=ANY($1::text[])
         ) d GROUP BY learner_id
       )
       SELECT r.person_id AS "personId",COALESCE(s.problems,0) AS problems,COALESCE(s.correct,0) AS correct,
         COALESCE(s.independent,0) AS independent,COALESCE(s.assisted,0) AS assisted,COALESCE(s.review,0) AS review,
         COALESCE(s."reviewIndependent",0) AS "reviewIndependent",COALESCE(s."activeMinutes",0) AS "activeMinutes",
         COALESCE(s.days,0) AS "daysActive",last.last_day AS "lastActive"
       FROM ${ROSTER}
       LEFT JOIN sums s ON s.learner_id=r.learner_id LEFT JOIN last ON last.learner_id=r.learner_id
       ORDER BY r.person_id`,
      args(roster, range),
    )
  ).rows;
}

export type ActivityDay = Omit<ActivityTotals, "daysActive" | "lastActive"> & {
  day: string;
};
export async function perDay(
  pool: Pool,
  roster: RosterMember[],
  range: DateRange,
): Promise<ActivityDay[]> {
  if (!roster.length) return [];
  return (
    await pool.query(
      `SELECT r.person_id AS "personId",f.day::text AS day,${SUMS}
       FROM ${FACTS} JOIN ${ROSTER} ON r.learner_id=f.learner_id
       GROUP BY r.person_id,f.day ORDER BY r.person_id,f.day`,
      args(roster, range),
    )
  ).rows;
}

export type ActivitySkill = Omit<ActivityDay, "day"> & { skillId: string };
/** Active time with no skill (maps, lessons) reads under skill `""`. */
export async function perSkill(
  pool: Pool,
  roster: RosterMember[],
  range: DateRange,
): Promise<ActivitySkill[]> {
  if (!roster.length) return [];
  return (
    await pool.query(
      `SELECT r.person_id AS "personId",f.skill_id AS "skillId",${SUMS}
       FROM ${FACTS} JOIN ${ROSTER} ON r.learner_id=f.learner_id
       GROUP BY r.person_id,f.skill_id ORDER BY r.person_id,f.skill_id`,
      args(roster, range),
    )
  ).rows;
}

export type LevelEstimate = {
  level: number;
  sd: number;
  answered: number;
  independent: number;
};
export type LevelDay = {
  personId: string;
  day: string;
  policyVersion: string;
  overall: LevelEstimate;
  strands: Record<string, LevelEstimate>;
};
/** Each rostered student's level on the latest day at or before `on`, or the
 * latest stored when `on` is omitted. Students with none stored are absent. */
export async function levels(
  pool: Pool,
  roster: RosterMember[],
  on?: string,
): Promise<LevelDay[]> {
  if (!roster.length) return [];
  const rows = (
    await pool.query(
      `SELECT r.person_id AS "personId",d.day::text AS day,
         d.policy_version AS "policyVersion",d.frontier
       FROM unnest($3::uuid[],$1::text[]) AS r(person_id,learner_id)
       CROSS JOIN LATERAL (SELECT day,policy_version,frontier FROM amp_level_days
         WHERE learner_id=r.learner_id AND ($2::date IS NULL OR day<=$2::date)
         ORDER BY day DESC LIMIT 1) d
       ORDER BY r.person_id`,
      [
        roster.map((m) => m.learnerId),
        on ?? null,
        roster.map((m) => m.personId),
      ],
    )
  ).rows;
  return rows.map(({ frontier, ...rest }) => ({
    ...rest,
    overall: frontier.overall,
    strands: frontier.strands,
  }));
}
