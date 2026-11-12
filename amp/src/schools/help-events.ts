import type { Pool } from "pg";
import { lessons } from "../content/lessons.js";
import { templates } from "../math/engine.js";
import {
  MAX_HELP_AGE_MS,
  MAX_HELP_EVENTS,
  type HelpEvent,
  type HelpWeek,
} from "./help-contracts.js";
export * from "./help-contracts.js";

/** Help a learner reaches for, recorded beside their active time: a lesson
 * opened, a hint revealed (by step), a worked explanation opened, a video
 * opened, a lesson PDF printed. The client sends what it opened with the
 * heartbeat it already sends, so recording costs no request of its own; time
 * on each is the heartbeat's own active time under the help's surface. Rows
 * are append-only and roll up on write (migration 0111); reports read the
 * rollups. */
const skillOfTemplate = new Map(templates.map((t) => [t.id, t.skillId]));
const skillOfLesson = new Map(
  lessons.flatMap((lesson) => {
    const skill = lesson.templateIds
      .map((id) => skillOfTemplate.get(id))
      .find(Boolean);
    return skill ? [[lesson.id, skill] as const] : [];
  }),
);
/** The skill a template or lesson teaches, or "" when it isn't one. */
export const skillOfRef = (id: string | undefined) =>
  (id && (skillOfTemplate.get(id) ?? skillOfLesson.get(id))) || "";
/** True for a skill a delta may name when it has no problem. */
const knownSkills = new Set(templates.map((t) => t.skillId));
export const isKnownSkill = (id: string) => knownSkills.has(id);

/** The rows a heartbeat's events become, as one JSON parameter: the skill from
 * the problem when it is the learner's (resolved in SQL), else from the ref. */
export function helpRows(events: readonly HelpEvent[] | undefined) {
  return JSON.stringify(
    (events ?? []).slice(0, MAX_HELP_EVENTS).map((event) => ({
      kind: event.kind,
      source: event.source,
      ref: event.ref ?? "",
      problem_id: event.problemId ?? null,
      step: event.kind === "hint" ? (event.step ?? 1) : null,
      age_ms: Math.min(event.ageMs, MAX_HELP_AGE_MS),
      skill_id: skillOfRef(event.ref),
    })),
  );
}

/** A CTE that writes the events in `$<param>` for the `live` CTE's learner
 * (`learner_id`, `timezone`), inside the heartbeat's own statement. */
export const helpEventsCte = (param: number) => `helped AS (
  INSERT INTO amp_help_events(learner_id,"at",day,kind,source,skill_id,ref,problem_id,step)
  SELECT live.learner_id,t.at,(t.at AT TIME ZONE live.timezone)::date,e.kind::amp_help_kind,e.source::amp_help_source,
    COALESCE(i.content->'public'->>'skillId',e.skill_id,''),e.ref,
    CASE WHEN i.id IS NULL THEN NULL ELSE e.problem_id END,e.step
  FROM jsonb_to_recordset($${param}::jsonb) AS e(kind text,source text,ref text,problem_id text,step smallint,age_ms bigint,skill_id text)
  CROSS JOIN live
  CROSS JOIN LATERAL (SELECT now()-make_interval(secs=>e.age_ms/1000.0) AS at) t
  LEFT JOIN amp_instances i ON i.id=e.problem_id AND i.learner_id=live.learner_id
)`;

/** A lesson PDF sent to a learner whose practice rolls up: one on a roster
 * (a school's or a family's class) or an adult practicing as themselves, as
 * the answer rollup (`amp_update_skill_days`) decides. */
export async function recordPrint(
  pool: Pick<Pool, "query">,
  learnerId: string,
  lessonId: string,
  kind: string,
) {
  await pool.query(
    `WITH live AS (
       SELECT l.id AS learner_id,COALESCE(p.timezone,l.timezone,'America/New_York') AS timezone
       FROM amp_learners l LEFT JOIN amp_people p ON p.learner_id=l.id AND p.deleted_at IS NULL
       WHERE l.id=$1 AND l.deleted_at IS NULL AND (p.id IS NOT NULL OR l.adult)
       LIMIT 1
     ), ${helpEventsCte(2)}
     SELECT 1`,
    [
      learnerId,
      JSON.stringify([
        {
          kind: "print",
          source: "lessons",
          ref: `${lessonId}:${kind}`.slice(0, 100),
          problem_id: null,
          step: null,
          age_ms: 0,
          skill_id: skillOfRef(lessonId),
        },
      ]),
    ],
  );
}

/** Who a weekly read covers: a learner, and the days of theirs that count
 * (a student who joined or left inside the range). */
export type HelpMember = { learnerId: string; from: string; to: string };

/** Help per week summed over `members`, one entry for every Monday in
 * `weeks`, read from the week rollup only. */
export async function helpWeeks(
  pool: Pick<Pool, "query">,
  members: readonly HelpMember[],
  weeks: readonly string[],
): Promise<HelpWeek[]> {
  const rows = members.length
    ? (
        await pool.query(
          `SELECT w.week::text AS week,sum(w.lessons)::int AS lessons,sum(w.hints)::int AS hints,
             sum(w.videos)::int AS videos,sum(w.examples)::int AS examples,sum(w.prints)::int AS prints,
             sum(w.lesson_ms)::float8 AS lesson_ms,sum(w.hint_ms)::float8 AS hint_ms,
             sum(w.video_ms)::float8 AS video_ms,sum(w.example_ms)::float8 AS example_ms,
             sum(w.attempts)::int AS answers,sum(w.assisted)::int AS assisted,sum(w.with_hint)::int AS with_hint,sum(w.with_lesson)::int AS with_lesson,
             sum(w.with_video)::int AS with_video,sum(w.with_example)::int AS with_example,sum(w.with_person)::int AS with_person
           FROM unnest($1::text[],$2::date[],$3::date[]) AS m(learner_id,from_day,to_day)
           JOIN amp_learner_weeks w ON w.learner_id=m.learner_id
             AND w.week BETWEEN date_trunc('week',m.from_day)::date AND m.to_day
             AND w.week=ANY($4::date[])
           GROUP BY w.week`,
          [
            members.map((m) => m.learnerId),
            members.map((m) => m.from),
            members.map((m) => m.to),
            weeks,
          ],
        )
      ).rows
    : [];
  const byWeek = new Map(rows.map((row) => [row.week as string, row]));
  const minutes = (ms: number | undefined) =>
    Math.round(((ms ?? 0) / 60_000) * 10) / 10;
  return weeks.map((week) => {
    const row = byWeek.get(week);
    return {
      week,
      lessons: { count: row?.lessons ?? 0, minutes: minutes(row?.lesson_ms) },
      hints: { count: row?.hints ?? 0, minutes: minutes(row?.hint_ms) },
      videos: { count: row?.videos ?? 0, minutes: minutes(row?.video_ms) },
      examples: {
        count: row?.examples ?? 0,
        minutes: minutes(row?.example_ms),
      },
      prints: row?.prints ?? 0,
      answers: row?.answers ?? 0,
      assisted: row?.assisted ?? 0,
      answersWith: {
        hint: row?.with_hint ?? 0,
        lesson: row?.with_lesson ?? 0,
        video: row?.with_video ?? 0,
        example: row?.with_example ?? 0,
        person: row?.with_person ?? 0,
      },
    };
  });
}
