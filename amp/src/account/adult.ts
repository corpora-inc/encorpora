import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { refreshAdultAccess } from "./adult-access.js";
import {
  familyHasLearnerRoom,
  FREE_ONLINE_PROBLEMS,
} from "../learning/free-allowance.js";
import { FamilyError } from "../family/contracts.js";
import {
  HEARTBEAT_MAX_MS,
  HEARTBEAT_SLACK_MS,
  heartbeatSchema,
  perDay,
  perSkill,
} from "../schools/evidence.js";
import { readProgress, shiftDay } from "../schools/teacher-reads.js";
import { skillStrandOf, skillTitleOf } from "../schools/term-grades.js";
import { timezone } from "../schools/contracts.js";
import { adultStarts } from "../learning/starting-point.js";
import type { FamilyRepository } from "../family/repository.js";
import type { OwnPractice } from "./adult-contracts.js";

export const startPracticeSchema = z.strictObject({
  /** Where they begin. Without one (the starter's "I'm learning for myself"),
   * practice begins at its default level and adapts from the first answer. */
  start: z.enum(adultStarts).optional(),
  timezone,
});

/** An adult's own learner carries the account's name, or "Me" without one. */
export async function adultLearnerName(
  client: Pick<PoolClient, "query">,
  accountId: string,
): Promise<string> {
  const named =
    accountId.startsWith("amp|") &&
    (await client.query("SELECT to_regclass('amp_auth_users') AS relation"))
      .rows[0].relation
      ? (
          await client.query<{ name: string | null }>(
            "SELECT name FROM amp_auth_users WHERE id=$1",
            [accountId.slice(4)],
          )
        ).rows[0]?.name
      : null;
  return (
    named
      ?.replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 60) || "Me"
  );
}

/** Makes the account's adult learner with their free allowance and any access
 * supplied by their children or school. A second start returns the same learner. */
export async function startAdultPractice(
  families: FamilyRepository,
  accountId: string,
  input: z.infer<typeof startPracticeSchema>,
): Promise<{ learnerId: string }> {
  return families.transaction(accountId, async (client) => {
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM amp_learners WHERE account_id=$1 AND adult AND NOT simulation AND deleted_at IS NULL",
      [accountId],
    );
    if (existing.rows[0]) {
      await refreshAdultAccess(client, accountId, existing.rows[0].id);
      return { learnerId: existing.rows[0].id };
    }
    const name = await adultLearnerName(client, accountId);
    if (!(await familyHasLearnerRoom(client, accountId)))
      throw new FamilyError(403, "too_many_learners");
    const learnerId = randomUUID();
    await client.query(
      `INSERT INTO amp_learners(id,account_id,name,adult,timezone,starting_band,starting_policy,starting_excluded_strands)
       VALUES($1,$2,$3,true,$4,$5,$6,$7::text[])`,
      // A starting point is all three or none (amp_starting_point_valid).
      [
        learnerId,
        accountId,
        name,
        input.timezone,
        input.start ?? null,
        input.start ? 1 : null,
        input.start ? [] : null,
      ],
    );
    await client.query(
      "INSERT INTO amp_adult_activity(learner_id,seen_at) VALUES($1,now())",
      [learnerId],
    );
    await refreshAdultAccess(client, accountId, learnerId);
    return { learnerId };
  });
}

/** The adult's own record: the student record a teacher reads, pointed at
 * themselves, with their days and skills. Null without an adult learner. */
export async function readOwnPractice(
  families: FamilyRepository,
  accountId: string,
): Promise<OwnPractice | null> {
  const pool = families.pool;
  const learner = await families.transaction(accountId, async (client) => {
    const own = (
      await client.query<{ id: string }>(
        "SELECT id FROM amp_learners WHERE account_id=$1 AND adult AND NOT simulation AND deleted_at IS NULL",
        [accountId],
      )
    ).rows[0];
    if (!own) return null;
    await refreshAdultAccess(client, accountId, own.id);
    return (
      await client.query(
        `SELECT l.id,l.name,l.free_online_used,l.starting_band AS start,COALESCE(l.timezone,'America/New_York') AS timezone,
         to_char(l.created_at AT TIME ZONE COALESCE(l.timezone,'America/New_York'),'YYYY-MM-DD') AS began,
         to_char(now() AT TIME ZONE COALESCE(l.timezone,'America/New_York'),'YYYY-MM-DD') AS today,
         (SELECT max(g.ends_at) FROM amp_grants g WHERE g.learner_id=l.id AND g.status='active'
            AND g.starts_at<=now() AND g.ends_at>now()) AS "endsAt"
       FROM amp_learners l WHERE l.account_id=$1 AND l.adult AND NOT l.simulation AND l.deleted_at IS NULL`,
        [accountId],
      )
    ).rows[0];
  });
  if (!learner) return null;
  const member = { personId: learner.id, learnerId: learner.id };
  const from = [shiftDay(learner.today, -41), learner.began].sort().at(-1)!;
  const range = { from, to: learner.today as string };
  const [record, days, skills] = await Promise.all([
    readProgress(
      pool,
      { ...member, gradeLevel: null },
      learner.timezone,
      learner.today,
      null,
      "all",
    ),
    perDay(pool, [member], range),
    perSkill(pool, [member], range),
  ]);
  const first = (learner.name as string).split(/\s+/)[0] || learner.name;
  return {
    learner: {
      id: learner.id,
      name: learner.name,
      first,
      start: adultStarts.find((start) => start === learner.start) ?? null,
      active:
        !!learner.endsAt || learner.free_online_used < FREE_ONLINE_PROBLEMS,
      endsAt: learner.endsAt?.toISOString() ?? null,
    },
    record,
    time: {
      range,
      days: days.map((row) => ({
        day: row.day,
        minutes: row.activeMinutes,
        problems: row.problems,
      })),
      skills: skills
        .filter((row) => row.skillId)
        .sort(
          (a, b) =>
            b.activeMinutes - a.activeMinutes || b.problems - a.problems,
        )
        .slice(0, 8)
        .map((row) => ({
          skillId: row.skillId,
          title: skillTitleOf(row.skillId),
          strand: skillStrandOf(row.skillId),
          // A tenth of a minute: a skill worked for twenty seconds still
          // shows where the time went.
          minutes: Math.round(row.activeMinutes * 10) / 10,
          problems: row.problems,
        })),
    },
  };
}

/** Credits an adult's active time in one statement, outside the learner lock,
 * as a student's heartbeat is: the total is scaled to the time since the last
 * one plus five seconds, and to 90 seconds at most. False when this account
 * has no live adult learner. */
export async function recordAdultActivity(
  pool: Pool,
  accountId: string,
  body: unknown,
): Promise<boolean> {
  const { deltas } = heartbeatSchema.parse(body);
  const { rows } = await pool.query(
    `WITH live AS (
       SELECT l.id AS learner_id,COALESCE(l.timezone,'America/New_York') AS timezone,a.seen_at AS previous
       FROM amp_learners l JOIN amp_adult_activity a ON a.learner_id=l.id
       WHERE l.account_id=$4 AND l.adult AND NOT l.simulation AND l.deleted_at IS NULL
       FOR UPDATE OF a
     ), room AS (
       SELECT LEAST($2::bigint,
         floor(GREATEST(0,extract(epoch FROM now()-previous))*1000)::bigint+$3::bigint) AS ms FROM live
     ), raw AS (
       SELECT d->>'surface' AS surface,d->>'problemId' AS problem_id,(d->>'activeMs')::bigint AS ms
       FROM jsonb_array_elements($1::jsonb) d
     ), scale AS (
       SELECT LEAST(1,room.ms::numeric/NULLIF((SELECT sum(ms) FROM raw),0)) AS factor FROM room
     ), credited AS (
       SELECT raw.surface,COALESCE(i.content->'public'->>'skillId','') AS skill_id,
         floor(raw.ms*COALESCE(scale.factor,1))::bigint AS ms
       FROM raw CROSS JOIN scale CROSS JOIN live
       LEFT JOIN amp_instances i ON i.id=raw.problem_id AND i.learner_id=live.learner_id
     ), written AS (
       INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT live.learner_id,(now() AT TIME ZONE live.timezone)::date,c.surface,c.skill_id,sum(c.ms)
       FROM credited c CROSS JOIN live WHERE c.ms>0 GROUP BY live.learner_id,live.timezone,c.surface,c.skill_id
       ON CONFLICT(learner_id,day,surface,skill_id) DO UPDATE SET active_ms=amp_active_days.active_ms+EXCLUDED.active_ms
     ), touched AS (
       UPDATE amp_adult_activity a SET seen_at=now() FROM live WHERE a.learner_id=live.learner_id
     )
     SELECT count(*)::int AS live FROM live`,
    [JSON.stringify(deltas), HEARTBEAT_MAX_MS, HEARTBEAT_SLACK_MS, accountId],
  );
  return rows[0].live === 1;
}
