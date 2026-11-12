/**
 * A demo class's term, written in bulk. Every practiced day is the production
 * planner and the misspecified learner (`simulate.ts`); the stored level is
 * the production estimator after those answers. Deterministic for a given
 * class and day. Every name is made up.
 */
import type { PoolClient } from "pg";
import { DEFAULT_FRONTIER_POLICY } from "../../learning/frontier-policy.js";
import { DAY, type Persona } from "./personas.js";
import {
  projectSkillEvidence,
  type PracticeObservation,
} from "../../server/evidence.js";
import {
  answerIds,
  type SimActive,
  type SimAnswer,
  type SimHelp,
  type SimJob,
  type Simulation,
} from "./simulate.js";
import { simulateJobs } from "./simulate-pool.js";

export type DemoStudent = {
  personId: string;
  learnerId: string;
  persona: Persona;
  /** Roster grade. Falls back to `gradeLevel` on the call. */
  grade?: number;
};

const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Writes a demo class's term. Roster rows exist already, so the answer
 * triggers build skill days in the school's zone. Week rollups stay deferred
 * for the caller, who sums them once. `simulations`, when given, are the
 * students' terms already computed for these options, in student order. */
export async function seedClassHistory(
  client: Pick<PoolClient, "query">,
  options: {
    students: readonly DemoStudent[];
    timezone: string;
    termStart: string;
    /** Today in the school's zone. */
    today: string;
    gradeLevel: number;
    weekShape: readonly number[];
    /** The clock: today's answers were given in the last sitting. */
    now: number;
    /** The school day has begun in the school's zone. */
    workToday: boolean;
    /** `dose` is a demo class. `persona` is a family or adult fixture. */
    model?: "dose" | "persona";
    simulations?: readonly Simulation[];
    /** Unused. Kept so older callers still type-check. Gaps are not forced. */
    recentDays?: number;
    sharedGap?: { people: readonly string[]; template: string } | null;
    stuck?: { person: string; template: string } | null;
  },
) {
  const simulated =
    options.simulations ?? (await simulateJobs(historyJobs(options)));
  if (simulated.length !== options.students.length)
    throw new Error("One simulated term is needed for each student");
  return writeClassHistory(
    client,
    options.students.map((student) => student.learnerId),
    simulated,
  );
}

/** The simulation jobs for `seedClassHistory`'s students, in their order. */
export function historyJobs(options: {
  students: readonly DemoStudent[];
  termStart: string;
  today: string;
  gradeLevel: number;
  weekShape: readonly number[];
  now: number;
  workToday: boolean;
  model?: "dose" | "persona";
}): SimJob[] {
  const model = options.model ?? "dose";
  return options.students.map((student) => {
    const grade = student.grade ?? options.gradeLevel;
    const name = student.persona.name.join(" ");
    const joined =
      student.persona.joined === undefined
        ? undefined
        : iso(
            Date.parse(`${options.today}T12:00:00Z`) -
              student.persona.joined * DAY,
          );
    return model === "persona"
      ? {
          kind: "persona" as const,
          options: {
            name,
            grade,
            persona: student.persona,
            termStart: options.termStart,
            today: options.today,
            weekShape: options.weekShape,
            now: options.now,
            workToday: options.workToday,
          },
        }
      : {
          kind: "dose" as const,
          options: {
            name,
            grade,
            termStart: options.termStart,
            today: options.today,
            weekShape: options.weekShape,
            now: options.now,
            workToday: options.workToday,
            joined,
          },
        };
  });
}

/** Writes simulated terms for these learners, one term each, in order.
 *
 * A term's problems and outcomes repeat, so each distinct one is sent once and
 * every answer is assembled from it in the database with its own ids. For
 * learners with no answers yet, skill days and skill evidence are written
 * once from the whole set (`amp.bulk_answers`, migration 0113) instead of one
 * answer at a time: the same rows the per-answer triggers write, as
 * `tests/school-demo-terms.integration.ts` checks. */
export async function writeClassHistory(
  client: Pick<PoolClient, "query">,
  learnerIds: readonly string[],
  simulated: readonly Simulation[],
  /** `false` writes one answer at a time through the triggers, as a test of
   * the bulk path does. */
  options: { bulk?: boolean } = {},
) {
  await client.query("SET LOCAL statement_timeout='180s'");
  await client.query("SET LOCAL idle_in_transaction_session_timeout='0'");
  const fresh =
    options.bulk !== false &&
    !(
      await client.query(
        "SELECT 1 FROM amp_attempts WHERE learner_id=ANY($1::text[]) LIMIT 1",
        [learnerIds],
      )
    ).rowCount;
  if (fresh) {
    // The lock the ordering trigger takes for each answer, once a learner.
    await client.query(
      "SELECT 1 FROM amp_learners WHERE id=ANY($1::text[]) ORDER BY id FOR NO KEY UPDATE",
      [learnerIds],
    );
    await client.query("SET LOCAL amp.bulk_answers='deferred'");
  }

  const bodies: string[] = [];
  const bodyIndex = new Map<string, number>();
  const body = (text: string) => {
    let found = bodyIndex.get(text);
    if (found === undefined) {
      found = bodies.length;
      bodies.push(text);
      bodyIndex.set(text, found);
    }
    return found;
  };
  type Row = {
    learnerId: string;
    ids: ReturnType<typeof answerIds>;
    content: number;
    outcome: number;
    answer: SimAnswer;
  };
  const answers: Row[] = [];
  const active: (SimActive & { learnerId: string })[] = [];
  const help: (Omit<SimHelp, "serial"> & {
    learnerId: string;
    problemId: string;
  })[] = [];
  const levels: { learnerId: string; day: string; frontier: string }[] = [];
  for (const [index, term] of simulated.entries()) {
    const learnerId = learnerIds[index]!;
    const ids = new Map<number, ReturnType<typeof answerIds>>();
    for (const answer of term.answers) {
      const own = answerIds(learnerId, answer.serial);
      ids.set(answer.serial, own);
      answers.push({
        learnerId,
        ids: own,
        content: body(answer.content),
        outcome: body(answer.outcome),
        answer,
      });
    }
    for (const row of term.active) active.push({ learnerId, ...row });
    for (const { serial, ...row } of term.help)
      help.push({
        learnerId,
        ...row,
        problemId: (ids.get(serial) ?? answerIds(learnerId, serial)).instanceId,
      });
    for (const row of term.levels) levels.push({ learnerId, ...row });
  }
  answers.sort(
    (a, b) =>
      a.answer.at.localeCompare(b.answer.at) ||
      a.ids.instanceId.localeCompare(b.ids.instanceId),
  );
  await insertChunks(client, active, 5000, (slice) =>
    client.query(
      `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms)
       SELECT l,d::date,s,k,m FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::bigint[]) AS t(l,d,s,k,m)
       ON CONFLICT DO NOTHING`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.day),
        slice.map((row) => row.surface),
        slice.map((row) => row.skillId),
        slice.map((row) => row.ms),
      ],
    ),
  );
  await insertChunks(client, levels, 2000, (slice) =>
    client.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
       SELECT l,d::date,f::jsonb,$4 FROM unnest($1::text[],$2::text[],$3::text[]) AS t(l,d,f)
       ON CONFLICT DO NOTHING`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.day),
        slice.map((row) => row.frontier),
        DEFAULT_FRONTIER_POLICY.version,
      ],
    ),
  );
  await client.query(
    `CREATE TEMP TABLE IF NOT EXISTS amp_demo_body(i int PRIMARY KEY,body jsonb NOT NULL) ON COMMIT DROP;
     TRUNCATE amp_demo_body`,
  );
  await insertChunks(client, bodies, 2000, (slice, from) =>
    client.query(
      `INSERT INTO amp_demo_body(i,body)
       SELECT $2::int+n::int-1,b::jsonb FROM unnest($1::text[]) WITH ORDINALITY AS t(b,n)`,
      [slice, from],
    ),
  );
  // Each problem and outcome as stored for this learner: its own ids and,
  // for the outcome, its time (`identify` does the same to the text).
  await insertChunks(client, answers, 10_000, (slice) =>
    client.query(
      `INSERT INTO amp_instances(id,learner_id,content,created_at)
       SELECT t.i,t.l,jsonb_set(b.body,'{public,id}',to_jsonb(t.i)),t.a::timestamptz-interval '40 seconds'
       FROM unnest($1::text[],$2::text[],$3::int[],$4::text[]) AS t(i,l,c,a)
       JOIN amp_demo_body b ON b.i=t.c`,
      [
        slice.map((row) => row.ids.instanceId),
        slice.map((row) => row.learnerId),
        slice.map((row) => row.content),
        slice.map((row) => row.answer.at),
      ],
    ),
  );
  // In bulk, answers are numbered here in the order the triggers would
  // have numbered them; otherwise the ordering trigger does it.
  const sequences = new Map<string, string>();
  await insertChunks(client, answers, 10_000, async (slice) => {
    const { rows } = await client.query<{ id: string; sequence: string }>(
      `INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at,evidence_sequence)
       SELECT o,l,i,r,body,a::timestamptz,CASE WHEN $7 THEN nextval('amp_attempt_evidence_sequence') ELSE 0 END
       FROM (
         SELECT t.o,t.l,t.i,t.r,b.body||jsonb_build_object('id',t.o,'problemId',t.i,'requestId',t.r,'createdAt',t.a) AS body,t.a
         FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::int[],$6::text[]) WITH ORDINALITY AS t(o,l,i,r,c,a,n)
         JOIN amp_demo_body b ON b.i=t.c
         ORDER BY t.n
       ) ordered
       RETURNING id,evidence_sequence::text AS sequence`,
      [
        slice.map((row) => row.ids.attemptId),
        slice.map((row) => row.learnerId),
        slice.map((row) => row.ids.instanceId),
        slice.map((row) => row.ids.requestId),
        slice.map((row) => row.outcome),
        slice.map((row) => row.answer.at),
        fresh,
      ],
    );
    for (const row of rows) sequences.set(row.id, row.sequence);
  });
  if (fresh) {
    await writeSkillDays(client, answers, bodies);
    await writeSkillEvidence(client, answers, sequences);
    await client.query("RESET amp.bulk_answers");
  }
  await insertChunks(client, help, 5000, (slice) =>
    client.query(
      `INSERT INTO amp_help_events(learner_id,"at",day,kind,source,skill_id,ref,problem_id,step)
       SELECT l,a::timestamptz,d::date,k::amp_help_kind,'practice',s,r,p,t
       FROM unnest($1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::text[],$7::text[],$8::smallint[])
         AS t(l,a,d,k,s,r,p,t)`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.at),
        slice.map((row) => row.day),
        slice.map((row) => row.kind),
        slice.map((row) => row.skillId),
        slice.map((row) => row.ref),
        slice.map((row) => row.problemId),
        slice.map((row) => row.step),
      ],
    ),
  );
  return { answers: answers.length, days: active.length };
}

/** Skill days for these learners' answers, as `amp_update_skill_days`
 * (migration 0111) adds them one at a time: by the learner's day in their
 * roster zone, or an adult's own; a family learner has none. */
async function writeSkillDays(
  client: Pick<PoolClient, "query">,
  answers: readonly { learnerId: string; content: number; outcome: number; answer: SimAnswer }[],
  bodies: readonly string[],
) {
  // What the trigger reads from a stored problem and outcome, once a body.
  const review = new Map<number, boolean>();
  const helped = new Map<number, string[]>();
  const facts = answers.map(({ learnerId, content, outcome, answer }) => {
    if (!review.has(content))
      review.set(
        content,
        JSON.parse(bodies[content]!).selection?.reason === "review",
      );
    if (!helped.has(outcome)) {
      const parsed = JSON.parse(bodies[outcome]!) as {
        help?: unknown;
        evidenceWeight?: number;
      };
      if ((parsed.evidenceWeight ?? 1) < 1)
        throw new Error("A simulated answer is never a paper mark");
      helped.set(
        outcome,
        Array.isArray(parsed.help) ? parsed.help.map(String) : [],
      );
    }
    const help = helped.get(outcome)!;
    return {
      learnerId,
      at: answer.at,
      skillId: answer.skillId,
      correct: answer.correct,
      assisted: answer.assisted,
      review: review.get(content)!,
      help: help.join(","),
    };
  });
  await client.query(
    `WITH zones AS (
       SELECT l.id,CASE WHEN p.learner_id IS NOT NULL THEN p.timezone
         WHEN l.adult THEN COALESCE(l.timezone,'America/New_York') END AS zone
       FROM amp_learners l
       LEFT JOIN LATERAL (SELECT learner_id,timezone FROM amp_people WHERE learner_id=l.id LIMIT 1) p ON true
       WHERE l.id IN (SELECT DISTINCT unnest($1::text[]))
     ),facts AS (
       SELECT t.l AS learner_id,(t.a::timestamptz AT TIME ZONE z.zone)::date AS day,t.s AS skill_id,
         t.c AS correct,t.x AS assisted,t.c AND NOT t.x AS independent,t.v AS review,
         string_to_array(t.h,',') AS help
       FROM unnest($1::text[],$2::text[],$3::text[],$4::bool[],$5::bool[],$6::bool[],$7::text[]) AS t(l,a,s,c,x,v,h)
       JOIN zones z ON z.id=t.l AND z.zone IS NOT NULL
     )
     INSERT INTO amp_skill_days(learner_id,day,skill_id,attempts,correct,independent,assisted,review,review_independent,
       with_hint,with_lesson,with_video,with_example,with_person)
     SELECT learner_id,day,skill_id,count(*),count(*) FILTER (WHERE correct),count(*) FILTER (WHERE independent),
       count(*) FILTER (WHERE assisted),count(*) FILTER (WHERE review),count(*) FILTER (WHERE review AND independent),
       count(*) FILTER (WHERE 'hint'=ANY(help)),count(*) FILTER (WHERE 'lesson'=ANY(help)),
       count(*) FILTER (WHERE 'video'=ANY(help)),count(*) FILTER (WHERE 'example'=ANY(help)),
       count(*) FILTER (WHERE 'person'=ANY(help))
     FROM facts GROUP BY learner_id,day,skill_id
     ON CONFLICT(learner_id,day,skill_id) DO UPDATE SET
       attempts=amp_skill_days.attempts+EXCLUDED.attempts,
       correct=amp_skill_days.correct+EXCLUDED.correct,
       independent=amp_skill_days.independent+EXCLUDED.independent,
       assisted=amp_skill_days.assisted+EXCLUDED.assisted,
       review=amp_skill_days.review+EXCLUDED.review,
       review_independent=amp_skill_days.review_independent+EXCLUDED.review_independent,
       with_hint=amp_skill_days.with_hint+EXCLUDED.with_hint,
       with_lesson=amp_skill_days.with_lesson+EXCLUDED.with_lesson,
       with_video=amp_skill_days.with_video+EXCLUDED.with_video,
       with_example=amp_skill_days.with_example+EXCLUDED.with_example,
       with_person=amp_skill_days.with_person+EXCLUDED.with_person`,
    [
      facts.map((row) => row.learnerId),
      facts.map((row) => row.at),
      facts.map((row) => row.skillId),
      facts.map((row) => row.correct),
      facts.map((row) => row.assisted),
      facts.map((row) => row.review),
      facts.map((row) => row.help),
    ],
  );
}

/** Each learner's skill evidence after all of their answers, in the order the
 * database took them: the same fold as `amp_project_skill_observation`
 * (migration 0079), which `projectSkillEvidence` mirrors. */
async function writeSkillEvidence(
  client: Pick<PoolClient, "query">,
  answers: readonly {
    learnerId: string;
    ids: { attemptId: string };
    answer: SimAnswer;
  }[],
  sequences: ReadonlyMap<string, string>,
) {
  const byLearner = new Map<string, PracticeObservation[]>();
  for (const { learnerId, ids, answer } of answers) {
    const sequence = sequences.get(ids.attemptId);
    if (!sequence) throw new Error("An answer was not stored");
    const list = byLearner.get(learnerId) ?? [];
    list.push({
      id: ids.attemptId,
      skillId: answer.skillId,
      templateId: answer.templateId,
      correct: answer.correct,
      assisted: answer.assisted,
      createdAt: answer.at,
      ingestionSequence: sequence,
    });
    byLearner.set(learnerId, list);
  }
  const rows: { learnerId: string; skillId: string; state: string }[] = [];
  for (const [learnerId, observations] of byLearner) {
    observations.sort((a, b) =>
      Number(BigInt(a.ingestionSequence!) - BigInt(b.ingestionSequence!)),
    );
    for (const state of projectSkillEvidence(observations))
      rows.push({ learnerId, skillId: state.skillId, state: JSON.stringify(state) });
  }
  await insertChunks(client, rows, 5000, (slice) =>
    client.query(
      `INSERT INTO amp_skill_evidence(learner_id,skill_id,state)
       SELECT l,k,s::jsonb FROM unnest($1::text[],$2::text[],$3::text[]) AS t(l,k,s)
       ON CONFLICT(learner_id,skill_id) DO UPDATE SET state=EXCLUDED.state`,
      [
        slice.map((row) => row.learnerId),
        slice.map((row) => row.skillId),
        slice.map((row) => row.state),
      ],
    ),
  );
}

async function insertChunks<T>(
  _client: Pick<PoolClient, "query">,
  rows: readonly T[],
  size: number,
  write: (slice: readonly T[], from: number) => Promise<unknown>,
) {
  for (let index = 0; index < rows.length; index += size)
    await write(rows.slice(index, index + size), index);
}
