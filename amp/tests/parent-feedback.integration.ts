import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { registerParentFeedbackRoutes } from "../src/feedback/parent-routes.js";
import { purgeParentFeedback } from "../src/feedback/parent-retention.js";

test(
  "adult feedback stores once, rejects extra identifiers, limits IP regardless of credentials and expires",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `feedback_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const pool = new Pool({ connectionString: scoped.href, max: 2 });
    const app = Fastify();
    try {
      await admin.query(`CREATE SCHEMA ${schema}`);
      await migrate(scoped.href);
      await app.register(rateLimit);
      await registerParentFeedbackRoutes(app, { pool });
      const payload = {
        requestId: randomUUID(),
        adult: true,
        context: "invoice",
        program: "az-esa",
        message: "  Make the invoice instructions clearer.  ",
      };
      const send = (body: unknown, ip = "127.0.0.1") =>
        app.inject({
          method: "POST",
          url: "/api/v1/parent-feedback",
          payload: body as object,
          remoteAddress: ip,
          headers: { authorization: `Bearer ${randomUUID()}` },
        });
      for (const body of [
        { ...payload, adult: false },
        { ...payload, learnerId: "child" },
        { ...payload, message: " " },
        { ...payload, message: "a".repeat(2001) },
        { ...payload, context: "raw-url" },
      ])
        assert.equal((await send(body, "127.0.0.2")).statusCode, 400);
      const responses = await Promise.all([send(payload), send(payload)]);
      for (const r of responses) {
        assert.equal(r.statusCode, 202);
        assert.deepEqual(r.json(), { accepted: true });
      }
      assert.equal(
        (await send({ ...payload, message: "overwrite" })).statusCode,
        202,
      );
      let rows = (await pool.query("SELECT * FROM amp_parent_feedback")).rows;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].message, payload.message.trim());
      assert.deepEqual(
        Object.keys(rows[0]).sort(),
        ["request_id", "created_at", "context", "program", "message"].sort(),
      );
      assert.equal(
        (await app.inject({ url: "/api/v1/parent-feedback" })).statusCode,
        404,
      );
      for (let i = 0; i < 7; i++)
        assert.equal((await send(payload)).statusCode, 202);
      assert.equal((await send(payload)).statusCode, 429);
      const at = new Date("2027-01-01T00:00:00Z");
      await pool.query(
        "UPDATE amp_parent_feedback SET created_at=$1::timestamptz-interval '90 days'",
        [at],
      );
      await send(
        { ...payload, requestId: randomUUID(), message: "Keep this" },
        "127.0.0.3",
      );
      await pool.query(
        "UPDATE amp_parent_feedback SET created_at=$1::timestamptz-interval '89 days' WHERE message='Keep this'",
        [at],
      );
      assert.equal(await purgeParentFeedback(pool, at), 1);
      rows = (await pool.query("SELECT message FROM amp_parent_feedback")).rows;
      assert.deepEqual(rows, [{ message: "Keep this" }]);
    } finally {
      await app.close();
      await pool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  },
);
