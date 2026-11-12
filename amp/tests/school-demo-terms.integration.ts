import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { createDemo } from "../src/schools/demo/build.js";
import { writeClassHistory } from "../src/schools/demo/history.js";
import {
  demoDay,
  demoJobs,
  demoRoster,
} from "../src/schools/demo/roster.js";
import { simulateJobs } from "../src/schools/demo/simulate-pool.js";
import {
  demoTerms,
  forgetDemoTerms,
  snapshotKey,
} from "../src/schools/demo/snapshot.js";
import { sumWeeks } from "../src/schools/demo/term.js";
import { generateHandle } from "../src/schools/repository.js";

/* A demo's term is computed once a day and written for every demo made that
   day. Computed in the request, computed ahead, or read back by another pod,
   it is the same term; and the bulk writer leaves the same rows the
   per-answer triggers do. Every name is made up. */
test(
  "Demo terms: cached or not, bulk or one at a time, the same honest data",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_terms_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const db = new Pool({ connectionString: scoped.href, max: 4 });
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });

    // A school day under way in New York.
    const now = Date.parse("2026-11-11T19:30:00Z");
    const day = demoDay(now, "America/New_York");
    assert.deepEqual(
      { today: day.today, workToday: day.workToday },
      { today: "2026-11-11", workToday: true },
    );
    const jobs = demoJobs(demoRoster("class"), day);
    const key = snapshotKey("class", jobs);

    const uncached = await simulateJobs(jobs);
    const computed = await demoTerms(db, "class", day);
    const stored = (
      await db.query("SELECT built_at FROM amp_demo_snapshots WHERE key=$1", [
        key,
      ])
    ).rows[0];
    assert.ok(stored?.built_at, "the term is shared with other pods");
    forgetDemoTerms();
    const read = await demoTerms(db, "class", day);
    assert.deepEqual(
      (
        await db.query("SELECT built_at FROM amp_demo_snapshots WHERE key=$1", [
          key,
        ])
      ).rows[0].built_at,
      stored.built_at,
      "a pod reads the term instead of computing it again",
    );
    assert.deepEqual(computed, uncached, "computed ahead = computed now");
    assert.deepEqual(read, uncached, "read back = computed now");
    // A later hour of the same school day is the same term.
    assert.equal(
      snapshotKey(
        "class",
        demoJobs(demoRoster("class"), demoDay(now + 3 * 3_600_000, day.timezone)),
      ),
      key,
    );

    // A demo written from the cached term, in bulk…
    const demo = await createDemo(
      db,
      { accountId: "amp|terms-owner", kind: "class", timezone: day.timezone },
      undefined,
      now,
    );
    const bulk = (
      await db.query<{ name: string; learner_id: string }>(
        `SELECT given_name||' '||family_name AS name,learner_id FROM amp_people
         WHERE tenant_id=$1 AND learner_id IS NOT NULL`,
        [demo.orgId],
      )
    ).rows;
    assert.equal(bulk.length, jobs.length);
    // …and the same students written from the uncached term, one answer at
    // a time through the triggers.
    const names = jobs.map((job) => job.options.name);
    const single = names.map(() => randomUUID());
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO amp_learners(id,account_id,name,birth_year,created_at)
         SELECT l,'school:'||p,n,2015,$4::date FROM unnest($1::text[],$2::uuid[],$3::text[]) AS t(l,p,n)`,
        [single, single.map(() => randomUUID()), names, day.termStart],
      );
      await client.query(
        `INSERT INTO amp_people(id,tenant_id,given_name,handle,learner_id,timezone)
         SELECT gen_random_uuid(),$1,n,h,l,$4 FROM unnest($2::text[],$3::text[],$5::text[]) AS t(l,n,h)`,
        [
          demo.orgId,
          single,
          names.map((name) => name.split(" ")[0]),
          day.timezone,
          names.map(() => generateHandle()),
        ],
      );
      await client.query("SET LOCAL amp.rollup_weeks='deferred'");
      await writeClassHistory(client, single, uncached, { bulk: false });
      await sumWeeks(client, "SELECT unnest($1::text[])", [single]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const learnerOf = new Map(bulk.map((row) => [row.name, row.learner_id]));
    const rows = async (sql: string, learner: string) =>
      (await db.query(sql, [learner])).rows;
    let answers = 0;
    for (const [index, name] of names.entries()) {
      const pair = [learnerOf.get(name)!, single[index]!];
      const read = async (sql: string) =>
        Promise.all(pair.map((learner) => rows(sql, learner)));

      // Answers: the same problems, responses and times, in the same order.
      const [attemptsA, attemptsB] = await read(
        `SELECT a.id,a.evidence_sequence::text AS sequence,a.created_at,
           a.outcome-'id'-'problemId'-'requestId' AS outcome,
           i.content#-'{public,id}' AS content,i.created_at AS served_at
         FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id
         WHERE a.learner_id=$1 ORDER BY a.evidence_sequence`,
      );
      const strip = (list: typeof attemptsA) =>
        list.map(({ id: _id, sequence: _sequence, ...row }) => row);
      assert.deepEqual(strip(attemptsA), strip(attemptsB), `${name}: answers`);
      answers += attemptsA.length;
      for (const row of attemptsA)
        assert.notEqual(
          String(row.outcome.response),
          "",
          `${name}: a real response`,
        );

      for (const sql of [
        "SELECT day,frontier,policy_version FROM amp_level_days WHERE learner_id=$1 ORDER BY day",
        "SELECT day,surface,skill_id,active_ms FROM amp_active_days WHERE learner_id=$1 ORDER BY 1,2,3",
        `SELECT day,skill_id,attempts,correct,independent,assisted,review,review_independent,
           with_hint,with_lesson,with_video,with_example,with_person
         FROM amp_skill_days WHERE learner_id=$1 ORDER BY 1,2`,
        `SELECT week,active_ms,attempts,assisted,lessons,hints,lesson_ms,hint_ms,with_hint,with_lesson
         FROM amp_learner_weeks WHERE learner_id=$1 ORDER BY 1`,
        `SELECT h."at",h.day,h.kind,h.skill_id,h.ref,h.step,i.content->'public'->>'seed' AS seed
         FROM amp_help_events h JOIN amp_instances i ON i.id=h.problem_id
         WHERE h.learner_id=$1 ORDER BY 1,3`,
      ]) {
        const [a, b] = await read(sql);
        assert.ok(a.length > 0 || /help_events/.test(sql), `${name}: ${sql}`);
        assert.deepEqual(a, b, `${name}: ${sql.slice(0, 60)}`);
      }

      // Skill evidence: the same fold, with each learner's own ids and
      // ingestion numbers.
      const [evidenceA, evidenceB] = await read(
        "SELECT skill_id,state FROM amp_skill_evidence WHERE learner_id=$1 ORDER BY skill_id",
      );
      const normal = (
        evidence: typeof evidenceA,
        attempts: typeof attemptsA,
      ) => {
        const rank = new Map<string, number>();
        for (const [position, row] of attempts.entries()) {
          rank.set(`id:${row.id}`, position);
          rank.set(`seq:${row.sequence}`, position);
        }
        const observation = (value: Record<string, unknown> | null) =>
          value && {
            ...value,
            id: rank.get(`id:${value.id}`),
            ingestionSequence: rank.get(`seq:${value.ingestionSequence}`),
          };
        return evidence.map((row) => ({
          ...row,
          state: {
            ...row.state,
            recentOutcomes: row.state.recentOutcomes.map(observation),
            latestIndependent: observation(row.state.latestIndependent),
          },
        }));
      };
      assert.ok(evidenceA.length > 0);
      assert.deepEqual(
        normal(evidenceA, attemptsA),
        normal(evidenceB, attemptsB),
        `${name}: skill evidence`,
      );
    }
    assert.equal(
      answers,
      uncached.reduce((sum, term) => sum + term.answers.length, 0),
    );
  },
);
