import type { Pool, PoolClient } from "pg";
import { levels } from "../evidence.js";
import { STUDENT_LABEL } from "../sign-in.js";
import { studentInClassSql } from "../principal.js";
import { skillStrandOf, skillTitleOf } from "../term-grades.js";
import {
  SIGNAL_OPEN_MS,
  type LiveRow,
  type LiveSignal,
  type SkillRef,
} from "./contracts.js";
import { LIVE_RULES } from "./status.js";

type Database = Pick<PoolClient, "query">;

/* The live read. Every number is computed on read from the evidence that
   already exists, inside one session's window: answers from `amp_attempts`
   (over `amp_attempts_recent_idx`), help from `amp_help_events` (over
   `amp_help_events_learner_idx`), presence from the session's presence
   events, raised hands and the student's own sign-in. The snapshot, the
   stream hub and Stop all read through `readLiveRows`, so the cockpit, the
   stream and the stored report can't disagree.

   Only what is the student's own counts. An adult's sign-in is the adult:
   it writes no child's time or help (`recordLearnerActivity`), and the
   account's clock (`amp_learner_activity`) is never read here. "Last seen"
   is the student's own sign-in, which a hand-over also is. */

export type LiveWindow = {
  classId: string;
  sessionId: string;
  /** The session's start. */
  from: Date | string;
  /** Its end: when it stopped, or `endsAt` while it runs. */
  to: Date | string;
};

/** A live row with what the stored report adds: the learner it belongs to and
 * every skill answered (read only when asked). */
export type LiveRowFull = LiveRow & { learnerId: string; skills: SkillRef[] };

export const skillRef = (id: string): SkillRef => ({
  id,
  title: skillTitleOf(id),
  strand: skillStrandOf(id),
});
const iso = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();

/** SQL: an attempt `x` of roster member `r` inside the window ($2, $3), not a
 * paper mark. */
const IN_WINDOW = `x.learner_id=r.learner_id AND x.created_at>=$2::timestamptz AND x.created_at<$3::timestamptz
  AND x.outcome->>'evidenceSource' IS DISTINCT FROM 'paper'`;
const CORRECT = "COALESCE((x.outcome->>'correct')::boolean,false)";
const ASSISTED = "COALESCE((x.outcome->>'assisted')::boolean,false)";

/** SQL: the class's students today ($1), labelled over the whole class so a
 * subset reads the same names. A function: `STUDENT_LABEL` is read at call
 * time, never while modules are still loading. */
const ROSTER = () => `roster AS (
  SELECT p.id AS person_id,p.learner_id,${STUDENT_LABEL} AS name
  FROM amp_classes c JOIN amp_orgs o ON o.id=c.org_id
  JOIN amp_enrollments e ON e.class_id=c.id
  JOIN amp_people p ON p.id=e.person_id
  WHERE c.id=$1 AND ${studentInClassSql("e", "p", "c", "o")}
)`;

/** SQL: roster member `r`'s own sign-in, last seen before `end` (a session
 * judged after it ended doesn't count who arrived later), as `seen.last_seen`.
 * A sighting from before an open "I forgot my picture" is not one: they are
 * at the sign-in screen, signed out of the device it was on. Class `$1`. */
const SEEN = (end: string) => `CROSS JOIN LATERAL (
       SELECT max(s.last_seen_at) AS last_seen FROM amp_student_sessions s
       WHERE s.person_id=r.person_id AND s.revoked_at IS NULL AND s.last_seen_at<${end}
         AND NOT EXISTS (SELECT 1 FROM amp_class_signals f
           WHERE f.class_id=$1 AND f.person_id=r.person_id AND f.kind='forgot_picture'
             AND f.resolved_at IS NULL AND f.created_at>s.last_seen_at)
     ) seen`;

/** What `isHere` reads from a row when no session runs: nothing in a
 * session, and the student's own sign-in as last seen. */
export type SeenRow = Pick<
  LiveRow,
  | "personId"
  | "problems"
  | "hints"
  | "lessons"
  | "examples"
  | "videos"
  | "recent"
  | "firstSeenAt"
  | "lastAnswerAt"
  | "lastHelpAt"
  | "lastSeenAt"
>;

/** Each student on the class's roster today with their own sign-in as last
 * seen, the same sighting the live read takes, for a class with no session
 * running (`here.ts`). One statement. */
export async function readSeen(
  db: Database,
  classId: string,
): Promise<SeenRow[]> {
  const { rows } = await db.query(
    `WITH ${ROSTER()}
     SELECT r.person_id AS "personId",seen.last_seen FROM roster r
     ${SEEN("'infinity'::timestamptz")}`,
    [classId],
  );
  return rows.map((row) => ({
    personId: row.personId,
    problems: 0,
    hints: 0,
    lessons: 0,
    examples: 0,
    videos: 0,
    recent: [],
    firstSeenAt: null,
    lastAnswerAt: null,
    lastHelpAt: null,
    lastSeenAt: iso(row.last_seen),
  }));
}

/**
 * Each student on the class's roster today, or only `personIds`, with their
 * work inside the window. Students who never answered read zero. Sorted by
 * name, then person, so a list read twice comes back in the same order.
 * Two statements on one connection, never held between them.
 */
export async function readLiveRows(
  db: Database,
  window: LiveWindow,
  personIds?: readonly string[],
  options: {
    /** Every skill answered, which the stored report keeps (`skills`);
     * empty otherwise, to keep the per-second read light. */
    skills?: boolean;
  } = {},
): Promise<LiveRowFull[]> {
  const { rows } = await db.query(
    `WITH ${ROSTER()}
     SELECT r.person_id AS "personId",r.learner_id AS "learnerId",r.name,
       a.problems,a.correct,a.independent,a.assisted,
       h.hints,h.lessons,h.examples,h.videos,
       a.first_answer,a.last_answer,h.first_help,h.last_help,
       recent.outcomes,recent.skill_id,a.skills,
       seen.last_seen,pres.first_presence
     FROM roster r
     CROSS JOIN LATERAL (
       SELECT count(*)::int AS problems,
         count(*) FILTER (WHERE ${CORRECT})::int AS correct,
         count(*) FILTER (WHERE ${CORRECT} AND NOT ${ASSISTED}
           AND COALESCE((x.outcome->>'evidenceWeight')::numeric,1)>=1)::int AS independent,
         count(*) FILTER (WHERE ${ASSISTED})::int AS assisted,
         min(x.created_at) AS first_answer,max(x.created_at) AS last_answer,
         CASE WHEN $7 THEN COALESCE((SELECT array_agg(f.skill ORDER BY f.first,f.skill) FROM (
           SELECT y.outcome->>'skillId' AS skill,min(y.created_at) AS first FROM amp_attempts y
           WHERE y.learner_id=r.learner_id AND y.created_at>=$2::timestamptz AND y.created_at<$3::timestamptz
             AND y.outcome->>'evidenceSource' IS DISTINCT FROM 'paper' AND y.outcome->>'skillId' IS NOT NULL
           GROUP BY 1) f),'{}') ELSE '{}' END AS skills
       FROM amp_attempts x WHERE ${IN_WINDOW}
     ) a
     CROSS JOIN LATERAL (
       SELECT COALESCE(jsonb_agg(jsonb_build_object('correct',t.correct,'assisted',t.assisted)
           ORDER BY t.created_at,t.id),'[]'::jsonb) AS outcomes,
         (array_agg(t.skill ORDER BY t.created_at DESC,t.id DESC))[1] AS skill_id
       FROM (SELECT x.id,x.created_at,${CORRECT} AS correct,${ASSISTED} AS assisted,x.outcome->>'skillId' AS skill
         FROM amp_attempts x WHERE ${IN_WINDOW}
         ORDER BY x.created_at DESC,x.id DESC LIMIT $6) t
     ) recent
     CROSS JOIN LATERAL (
       SELECT count(*) FILTER (WHERE h.kind='hint')::int AS hints,
         count(*) FILTER (WHERE h.kind='lesson')::int AS lessons,
         count(*) FILTER (WHERE h.kind='example')::int AS examples,
         count(*) FILTER (WHERE h.kind='video')::int AS videos,
         min(h."at") FILTER (WHERE h.kind<>'print') AS first_help,
         max(h."at") FILTER (WHERE h.kind<>'print') AS last_help
       FROM amp_help_events h
       WHERE h.learner_id=r.learner_id AND h."at">=$2::timestamptz AND h."at"<$3::timestamptz
     ) h
     ${SEEN("$3::timestamptz")}
     -- Showed up in the session: signed in, or first active on their own sign-in (the presence
     -- events), or raised a hand. "I forgot my picture" is not signed in.
     CROSS JOIN LATERAL (
       SELECT LEAST(
         (SELECT min(v.created_at) FROM amp_class_events v
           WHERE v.session_id=$5 AND v.person_id=r.person_id AND v.kind='presence'),
         (SELECT min(g.created_at) FROM amp_class_signals g
           WHERE g.class_id=$1 AND g.person_id=r.person_id AND g.kind='hand'
             AND g.created_at>=$2::timestamptz AND g.created_at<$3::timestamptz)) AS first_presence
     ) pres
     WHERE $4::uuid[] IS NULL OR r.person_id=ANY($4::uuid[])
     ORDER BY lower(r.name),r.person_id`,
    [
      window.classId,
      iso(window.from),
      iso(window.to),
      personIds ? [...personIds] : null,
      window.sessionId,
      LIVE_RULES.recent,
      options.skills ?? false,
    ],
  );
  if (!rows.length) return [];
  // The level as stored, on the same connection (`levels` reads a pool's
  // `query` only).
  const level = new Map(
    (
      await levels(
        db as Pool,
        rows.map((row) => ({
          personId: row.personId,
          learnerId: row.learnerId,
        })),
      )
    ).map((day) => [day.personId, day.overall?.level ?? null]),
  );
  return rows.map((row) => {
    const firsts = [row.first_presence, row.first_answer, row.first_help]
      .filter((value): value is Date => value !== null)
      .map((value) => value.getTime());
    return {
      personId: row.personId,
      learnerId: row.learnerId,
      name: row.name,
      problems: row.problems,
      correct: row.correct,
      independent: row.independent,
      assisted: row.assisted,
      hints: row.hints,
      lessons: row.lessons,
      examples: row.examples,
      videos: row.videos,
      skill: row.skill_id ? skillRef(row.skill_id) : null,
      skills: (row.skills as string[]).map(skillRef),
      level: level.get(row.personId) ?? null,
      recent: row.outcomes,
      firstSeenAt: firsts.length
        ? new Date(Math.min(...firsts)).toISOString()
        : null,
      firstAnswerAt: iso(row.first_answer),
      lastAnswerAt: iso(row.last_answer),
      lastHelpAt: iso(row.last_help),
      lastSeenAt: iso(row.last_seen),
    };
  });
}

/** The live row as the contract sends it. */
export const toLiveRow = ({
  learnerId: _learner,
  skills: _skills,
  ...row
}: LiveRowFull): LiveRow => row;

/** The class's open signals, oldest first: raised, unresolved, and younger
 * than `SIGNAL_OPEN_MS`. Read with or without a session. */
export async function readOpenSignals(
  db: Database,
  classId: string,
): Promise<LiveSignal[]> {
  const { rows } = await db.query(
    `WITH ${ROSTER()}
     SELECT g.id,g.person_id AS "personId",r.name,g.kind,g.created_at AS "createdAt"
     FROM amp_class_signals g JOIN roster r ON r.person_id=g.person_id
     WHERE g.class_id=$1 AND g.resolved_at IS NULL
       AND g.created_at>now()-make_interval(secs=>$2/1000.0)
     ORDER BY g.created_at,g.id`,
    [classId, SIGNAL_OPEN_MS],
  );
  return rows.map((row) => ({
    ...row,
    createdAt: (row.createdAt as Date).toISOString(),
  }));
}
