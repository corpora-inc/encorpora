import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";

test(
  "workbook previews spend no allowance; issue retries preserve printed work and results",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_workbook_drafts_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    const app = buildApp({
      repository,
      development: true,
      authenticate: async () => "draft-parent",
    });
    const db = new Pool({ connectionString: scoped.href, max: 1 });
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const learner = await repository.create(
        "draft-parent",
        "Sample child",
        2016,
      );
      const base = `/api/v1/learners/${learner.id}/workbooks`;
      const input = {
        date: new Date().toISOString().slice(0, 10),
        paper: "letter",
        minutes: 45,
        requestId: randomUUID(),
      };
      const post = (action: "preview" | "issue", changes = {}) =>
        app.inject({
          method: "POST",
          url: `${base}/${action}`,
          payload: { ...input, ...changes },
        });
      const history = async () =>
        (await app.inject({ url: base })).json().workbooks;
      const allowanceUsed = async () =>
        (
          await db.query(
            "SELECT free_workbooks_used FROM amp_learners WHERE id=$1",
            [learner.id],
          )
        ).rows[0].free_workbooks_used;
      for (const minutes of [45, 30, 60]) {
        const preview = await post("preview", { minutes });
        assert.equal(preview.statusCode, 200, preview.body);
        assert.equal((await history()).length, 0);
        assert.equal(await allowanceUsed(), 0);
      }
      const previews = await Promise.all([
        post("preview"),
        post("preview", { requestId: randomUUID() }),
      ]);
      previews.forEach((response) =>
        assert.equal(response.statusCode, 200, response.body),
      );
      assert.equal((await history()).length, 0);
      const issued = await Promise.all([
        post("issue", { minutes: 60 }),
        post("issue", { minutes: 60 }),
      ]);
      assert.deepEqual(
        issued.map((response) => response.statusCode).sort(),
        [200, 201],
      );
      assert.equal(issued[0]!.json().id, issued[1]!.json().id);
      assert.equal(await allowanceUsed(), 1);
      assert.equal((await history()).length, 1);
      const id = issued[0]!.json().id;
      const marked = await app.inject({
        method: "POST",
        url: `${base}/${id}/results`,
        payload: { entries: [{ n: 1, mark: "right" }] },
      });
      assert.equal(marked.statusCode, 200, marked.body);
      const before = (
        await db.query("SELECT spec, code FROM amp_workbooks WHERE id=$1", [id])
      ).rows[0];
      await post("preview", {
        minutes: 30,
        requestId: randomUUID(),
        choices: { areas: [], lean: "easier", lesson: false },
      });
      assert.equal((await history()).length, 1);
      assert.equal(await allowanceUsed(), 1);
      const after = (
        await db.query("SELECT spec, code FROM amp_workbooks WHERE id=$1", [id])
      ).rows[0];
      assert.deepEqual(after, before);
      const results = await app.inject({ url: `${base}/${id}/results` });
      assert.equal(results.statusCode, 200, results.body);
      assert.equal(results.json().rows[0].recorded.correct, true);
      const retry = await post("issue", { minutes: 60 });
      assert.equal(retry.statusCode, 200, retry.body);
      assert.equal(await allowanceUsed(), 1);
    } finally {
      await app.close();
      await db.end();
      await repository.pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
