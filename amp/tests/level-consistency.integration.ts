import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import {
  applyRefresh,
  refreshedDays,
  staleLatestDays,
} from "../scripts/refresh-level-days.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* One level, everywhere it is shown or stored (grade-frontier-v5): the
   learner's own readout, the stored day, the trend's latest point, the class
   map and the teacher's record of the learner, before any answer and after
   answers that stop without asking for more. Every name here is made up. */
test(
  "a learner's level reads the same in every view and in storage",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_level_same_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in to continue");
    });
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, { pool: db, authenticate });
    await registerSchoolRoutes(app, { pool: db, authenticate });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const as = (credential: string) => ({
      authorization: `Bearer ${credential}`,
    });
    const get = async (path: string, credential: string) => {
      const response = await app.inject({
        method: "GET",
        url: path,
        headers: as(credential),
      });
      assert.equal(response.statusCode, 200, `${path}: ${response.body}`);
      return response.json();
    };
    const post = async (path: string, credential: string, payload: object) => {
      const response = await app.inject({
        method: "POST",
        url: path,
        headers: as(credential),
        payload,
      });
      assert.equal(
        response.statusCode < 300,
        true,
        `${path}: ${response.body}`,
      );
      return response.json();
    };

    const parentId = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Imani Fixture',$2,true,now(),now())`,
      [parentId, `${parentId}@family.example`],
    );
    const parent = `amp|${parentId}`;
    await db.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'policy','verified','fixture-proof')",
      [parent],
    );
    // A ten-year-old: the start comes from her birth year.
    const tala = (
      await post("/api/v1/learners", parent, {
        name: "Tala",
        birthYear: new Date().getUTCFullYear() - 10,
      })
    ).id as string;
    await db.query(
      `INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at)
       VALUES($1,$2,'stripe',$1,'active',now()-interval '1 day',now()+interval '300 days')`,
      [`fixture:${tala}`, tala],
    );
    const family = (
      await db.query(
        `SELECT f.class_id AS "classId",p.id AS "personId" FROM amp_families f
         JOIN amp_people p ON p.learner_id=$2 WHERE f.account_id=$1`,
        [parent, tala],
      )
    ).rows[0] as { classId: string; personId: string };
    const CLASS = `/api/v1/school/classes/${family.classId}`;
    const pick = (estimate: { level: number; sd: number }) => ({
      level: estimate.level,
      sd: estimate.sd,
    });
    const views = async () => {
      const live = await get(`/api/v1/learners/${tala}/frontier`, parent);
      const map = await get(`${CLASS}/map`, parent);
      const row = map.students.find(
        (s: { id: string }) => s.id === family.personId,
      );
      const record = await get(
        `/api/v1/school/students/${family.personId}/record`,
        parent,
      );
      const trend = (await get(`/api/v1/learners/${tala}/level-trend`, parent))
        .trend as { answered: number; level: number; sd: number }[];
      const stored = (
        await db.query(
          "SELECT frontier FROM amp_level_days WHERE learner_id=$1 ORDER BY day DESC LIMIT 1",
          [tala],
        )
      ).rows[0]?.frontier;
      return { live, row, record, trend, stored };
    };

    await t.test("before any answer: one starting estimate", async () => {
      const { live, row, trend, stored } = await views();
      assert.equal(stored, undefined);
      assert.equal(row.level, null);
      assert.deepEqual(row.start, pick(live.overall));
      assert.deepEqual(pick(trend.at(-1)!), pick(live.overall));
    });

    await t.test(
      "after answers that stop without asking for more: one level",
      async () => {
        const served = await post(`/api/v1/learners/${tala}/batches`, parent, {
          count: 3,
        });
        for (const problem of served.problems as { id: string }[])
          await post(`/api/v1/learners/${tala}/attempts`, parent, {
            problemId: problem.id,
            requestId: randomUUID(),
            response: "1",
          });
        const { live, row, record, trend, stored } = await views();
        assert.equal(live.overall.answered, 3);
        // The stored day was written by the last answer, not a later batch.
        assert.equal(stored.overall.answered, 3);
        const overall = pick(live.overall);
        assert.deepEqual(pick(stored.overall), overall);
        assert.deepEqual(row.level.overall, overall);
        const recordLevel = record.progress?.level ?? record.level;
        assert.deepEqual(recordLevel.overall, overall);
        assert.equal(trend.at(-1)!.answered, 3);
        assert.deepEqual(pick(trend.at(-1)!), overall);
        for (const [area, estimate] of Object.entries(
          live.strands as Record<string, { level: number; sd: number }>,
        )) {
          assert.deepEqual(pick(stored.strands[area]), pick(estimate), area);
          assert.deepEqual(row.level.strands[area], pick(estimate), area);
          assert.deepEqual(recordLevel.strands[area], pick(estimate), area);
        }
      },
    );

    await t.test(
      "a day stored by an older estimator is refreshed to the current one",
      async () => {
        await db.query(
          `UPDATE amp_level_days SET policy_version='grade-frontier-v4-evidence-anchored-climb',
             frontier=jsonb_set(frontier,'{overall,level}','5.97'::jsonb)
           WHERE learner_id=$1`,
          [tala],
        );
        const stale = await staleLatestDays(db);
        assert.deepEqual(
          stale.map((row) => row.learnerId),
          [tala],
        );
        assert.equal((await views()).row.level.overall.level, 5.97);
        assert.equal(await applyRefresh(db, await refreshedDays(db, stale)), 1);
        assert.deepEqual(await staleLatestDays(db), []);
        const { live, row, stored } = await views();
        assert.deepEqual(pick(stored.overall), pick(live.overall));
        assert.deepEqual(row.level.overall, pick(live.overall));
      },
    );
  },
);
