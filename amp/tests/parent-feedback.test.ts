import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { registerParentFeedbackRoutes } from "../src/feedback/parent-routes.js";
test("feedback failures reveal no submitted text and release concurrency slots for retry", async () => {
  const privateText = "synthetic-private-message";
  const app = Fastify();
  let calls = 0;
  await registerParentFeedbackRoutes(app, {
    pool: {
      query: async () => {
        if (++calls === 1) throw new Error(privateText);
      },
    } as unknown as Pool,
  });
  try {
    const payload = {
      requestId: randomUUID(),
      adult: true,
      context: "general",
      message: privateText,
    };
    const failed = await app.inject({
      method: "POST",
      url: "/api/v1/parent-feedback",
      payload,
    });
    assert.equal(failed.statusCode, 503);
    assert.ok(!failed.body.includes(privateText));
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/parent-feedback",
          payload,
        })
      ).statusCode,
      202,
    );
  } finally {
    await app.close();
  }
});
