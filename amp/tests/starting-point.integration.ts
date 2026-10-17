import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/test-database.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { templates, generateProblem } from "../src/math/engine.js";

test(
  "owned starting preferences persist without modifying immutable questions or evidence",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_starting_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async (request) =>
        String(request.headers["x-test-account"] ?? "starting-parent"),
    });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const learner = await repository.create("starting-parent", "Explorer");
      const base = `/api/v1/learners/${learner.id}`;
      const get = () =>
        app.inject({ method: "GET", url: `${base}/starting-point` });
      const set = (band: string, headers = {}) =>
        app.inject({
          method: "POST",
          url: `${base}/starting-point`,
          payload: { band },
          headers,
        });
      assert.deepEqual((await get()).json(), {
        band: null,
        policyVersion: null,
      });
      assert.equal(
        (await set("9–12", { "x-test-account": "foreign" })).statusCode,
        404,
      );
      assert.equal(
        (
          await app.inject({
            method: "GET",
            url: `${base}/starting-point`,
            headers: { "x-test-account": "foreign" },
          })
        ).statusCode,
        404,
      );
      for (const band of ["12", "college", "9-12", ""])
        assert.equal((await set(band)).statusCode, 400);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${base}/starting-point`,
            payload: { band: "9–12", mastery: true },
          })
        ).statusCode,
        400,
      );
      assert.deepEqual((await set("9–12")).json(), {
        band: "9–12",
        policyVersion: 1,
      });
      const reopened = new PostgresRepository(scoped.href, {
        development: true,
      });
      try {
        assert.deepEqual(
          await reopened.transaction("starting-parent", learner.id, (tx) =>
            tx.startingPoint(),
          ),
          { band: "9–12", policyVersion: 1, excludedStrands: [] },
        );
      } finally {
        await reopened.close();
      }
      const batch = await app.inject({
        method: "POST",
        url: `${base}/batches`,
        payload: { count: 3, responseCapabilities: ["single-choice-v1"] },
      });
      assert.equal(batch.statusCode, 200);
      const problems = batch.json().problems;
      assert.ok(
        problems.every(
          (problem: { templateId: string }) =>
            templates.find((template) => template.id === problem.templateId)!
              .gradeBand !== "K–2",
        ),
      );
      assert.equal(
        new Set(
          batch
            .json()
            .selection.map((entry: { strand: string }) => entry.strand),
        ).size,
        3,
      );
      const saved = (
        await repository.pool.query(
          "SELECT content FROM amp_instances ORDER BY id",
        )
      ).rows;
      assert.equal((await set("K–2")).statusCode, 200);
      assert.deepEqual(
        (
          await repository.pool.query(
            "SELECT content FROM amp_instances ORDER BY id",
          )
        ).rows,
        saved,
      );
      assert.equal(
        (await repository.pool.query("SELECT count(*) FROM amp_attempts"))
          .rows[0].count,
        "0",
      );
      assert.equal(
        (await repository.pool.query("SELECT count(*) FROM amp_skill_evidence"))
          .rows[0].count,
        "0",
      );
      const problem = problems[0];
      const attempt = await app.inject({
        method: "POST",
        url: `${base}/attempts`,
        payload: {
          problemId: problem.id,
          requestId: randomUUID(),
          response: generateProblem(problem.templateId, problem.seed).answer,
        },
      });
      assert.equal(attempt.statusCode, 200);
      assert.equal(attempt.json().correct, true);
      const evidence = (
        await repository.pool.query("SELECT state FROM amp_skill_evidence")
      ).rows;
      await set("6–8");
      assert.deepEqual(
        (await repository.pool.query("SELECT state FROM amp_skill_evidence"))
          .rows,
        evidence,
      );
      const legacy = await repository.create(
        "starting-parent",
        "Existing explorer",
      );
      const legacyPath = `/api/v1/learners/${legacy.id}`;
      async function observed(templateId: string) {
        const batch = await app.inject({
          method: "POST",
          url: `${legacyPath}/batches`,
          payload: { templateId, count: 1 },
        });
        assert.equal(batch.statusCode, 200);
        const problem = batch.json().problems[0];
        assert.equal(
          (
            await app.inject({
              method: "POST",
              url: `${legacyPath}/attempts`,
              payload: {
                problemId: problem.id,
                requestId: randomUUID(),
                response: "-999",
              },
            })
          ).statusCode,
          200,
        );
      }
      await observed("multiply-facts");
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${legacyPath}/starting-point`,
            payload: { band: "9–12" },
          })
        ).statusCode,
        200,
      );
      assert.deepEqual(
        (
          await repository.transaction("starting-parent", legacy.id, (tx) =>
            tx.startingPoint(),
          )
        ).excludedStrands,
        ["operations"],
      );
      await observed("line-slope");
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `${legacyPath}/starting-point`,
            payload: { band: "3–5" },
          })
        ).statusCode,
        200,
      );
      assert.deepEqual(
        (
          await repository.transaction("starting-parent", legacy.id, (tx) =>
            tx.startingPoint(),
          )
        ).excludedStrands,
        ["operations"],
      );
      await repository.pool.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference,withdrawn_at) VALUES('starting-parent','fixture','verified','synthetic',now())",
      );
      assert.equal((await get()).statusCode, 403);
      assert.equal((await set("3–5")).statusCode, 403);
    } finally {
      await app.close();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
