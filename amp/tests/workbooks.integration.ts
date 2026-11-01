import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { PostgresRepository } from "../src/server/repository.js";
import { buildApp } from "../src/server/app.js";
import { FamilyRepository } from "../src/family/repository.js";
import { generateProblem } from "../src/math/engine.js";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { localRenderer } from "../src/workbook/pdf.js";
import { purgeWorkbookPdfs } from "../src/workbook/retention.js";

test(
  "workbooks persist once per date, number and length, follow the learner's evidence, render and cache PDFs, export, and are deleted with learning data",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_workbooks_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const repository = new PostgresRepository(scoped.href, {
      development: true,
    });
    // In-process Chromium when installed, as development runs; otherwise a
    // stand-in, so storage and deletion are still covered.
    const renderer = existsSync(chromium.executablePath())
      ? localRenderer()
      : {
          render: async () => Buffer.from("%PDF-1.7 stand-in"),
          close: async () => undefined,
        };
    const app = buildApp({
      repository,
      development: true,
      workbookRenderer: renderer,
      authenticate: async (request) =>
        String(request.headers["x-test-account"] ?? "workbook-parent"),
    });
    const pool = new Pool({ connectionString: scoped.href, max: 2 });
    const family = new FamilyRepository(pool, true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      const learner = await repository.create(
        "workbook-parent",
        "Paper learner",
        2016,
      );
      const base = `/api/v1/learners/${learner.id}`;
      const make = (payload: Record<string, unknown>, headers = {}) =>
        app.inject({
          method: "POST",
          url: `${base}/workbooks`,
          payload: { date: today, minutes: 45, paper: "letter", ...payload },
          headers,
        });

      // Day one: the starting estimate alone composes a workbook.
      const first = await make({ number: 1 });
      assert.equal(first.statusCode, 201, first.body);
      const again = await make({ number: 1 });
      assert.equal(again.statusCode, 200);
      assert.equal(again.json().id, first.json().id);
      assert.equal(again.json().code, first.json().code);

      // Practice moves the evidence; the stored workbook does not change,
      // and the next workbook is composed from the new evidence.
      for (let i = 0; i < 6; i++) {
        const batch = await app.inject({
          method: "POST",
          url: `${base}/batches`,
          payload: { count: 1 },
        });
        assert.equal(batch.statusCode, 200, batch.body);
        const problem = batch.json().problems[0];
        const solution = generateProblem(problem.templateId, problem.seed);
        const answered = await app.inject({
          method: "POST",
          url: `${base}/attempts`,
          payload: {
            problemId: problem.id,
            requestId: randomUUID(),
            response: solution.answer,
          },
        });
        assert.equal(answered.statusCode, 200, answered.body);
      }
      assert.equal((await make({ number: 1 })).json().code, first.json().code);
      const another = await make({});
      assert.equal(another.statusCode, 201);
      assert.equal(another.json().number, 2);

      // Concurrent "another one" requests get distinct numbers.
      const racing = await Promise.all([make({}), make({})]);
      assert.deepEqual(racing.map((r) => r.statusCode).sort(), [201, 201]);
      assert.deepEqual(racing.map((r) => r.json().number).sort(), [3, 4]);

      const stored = await pool.query(
        "SELECT to_char(workbook_date,'YYYY-MM-DD') AS date,number,minutes,paper,code,spec->>'version' AS version FROM amp_workbooks WHERE learner_id=$1 ORDER BY number",
        [learner.id],
      );
      assert.deepEqual(
        stored.rows.map((r) => [r.date, r.number, r.minutes, r.paper]),
        [1, 2, 3, 4].map((n) => [today, n, 45, "letter"]),
      );
      assert.equal(stored.rows[0].code, first.json().code);
      assert.equal(stored.rows[0].version, "1");

      const history = await app.inject({ url: `${base}/workbooks` });
      assert.deepEqual(
        history.json().workbooks.map((w: { number: number }) => w.number),
        [4, 3, 2, 1],
      );
      const pdfUrl = `${base}/workbooks/${first.json().id}/pdf`;
      const pdf = await app.inject({ url: pdfUrl });
      assert.equal(pdf.statusCode, 200, pdf.body);
      assert.equal(pdf.rawPayload.subarray(0, 5).toString(), "%PDF-");
      const cached = await pool.query(
        "SELECT format,octet_length(pdf) AS bytes FROM amp_workbook_pdfs WHERE workbook_id=$1",
        [first.json().id],
      );
      assert.deepEqual(
        cached.rows.map((r) => r.format),
        ["Letter"],
      );
      assert.equal(cached.rows[0].bytes, pdf.rawPayload.length);
      // Served from the cache: byte-identical.
      const fromCache = await app.inject({ url: pdfUrl });
      assert.ok(fromCache.rawPayload.equals(pdf.rawPayload));
      assert.equal(
        (await app.inject({ url: `${pdfUrl}?format=A4` })).statusCode,
        200,
      );
      // An expired copy is not served and is purged by the next render.
      await pool.query(
        "UPDATE amp_workbook_pdfs SET created_at=now()-interval '25 hours' WHERE format='A4'",
      );
      assert.equal(await purgeWorkbookPdfs(pool), 1);

      // Another household cannot see or make this learner's workbooks.
      const foreign = { "x-test-account": "someone-else" };
      assert.equal((await make({}, foreign)).statusCode, 404);
      assert.equal(
        (await app.inject({ url: `${base}/workbooks`, headers: foreign }))
          .statusCode,
        404,
      );
      assert.equal(
        (
          await app.inject({
            url: `${base}/workbooks/${first.json().id}/pdf`,
            headers: foreign,
          })
        ).statusCode,
        404,
      );

      const exported = [];
      for await (const line of family.export("workbook-parent"))
        exported.push(JSON.parse(line));
      assert.equal(
        exported.filter((line) => line.type === "workbook").length,
        4,
      );

      await family.deleteLearning("workbook-parent", learner.id);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_workbook_pdfs"))
          .rows[0].n,
        0,
        "rendered PDFs go with the learning data",
      );
      assert.equal(
        (
          await pool.query(
            "SELECT count(*)::int AS n FROM amp_workbooks WHERE learner_id=$1",
            [learner.id],
          )
        ).rows[0].n,
        0,
      );

      // A hard-deleted learner takes its workbooks with it.
      const second = await repository.create("workbook-parent", "Second", 2014);
      assert.equal(
        (
          await app.inject({
            method: "POST",
            url: `/api/v1/learners/${second.id}/workbooks`,
            payload: { date: today, minutes: 30, paper: "a4" },
          })
        ).statusCode,
        201,
      );
      await pool.query("DELETE FROM amp_learners WHERE id=$1", [second.id]);
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM amp_workbooks"))
          .rows[0].n,
        0,
      );
    } finally {
      await app.close();
      await renderer.close();
      await pool.end();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
