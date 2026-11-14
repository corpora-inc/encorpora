import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { Pool } from "pg";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { ApiError } from "../src/server/repository.js";

/* A child's code lookup from the private preview host, which sign-in trusts,
   once came back 403 request_origin_invalid before the handler ran. The
   guard is the route's onRequest hook, so no database is needed to see it. */
test("the code lookup is not refused from a trusted page origin", async (t) => {
  const AMP = "https://amp.example.test";
  const PREVIEW = "https://preview.example.test:8443";
  const pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => {
      throw new Error("no database in this test");
    },
  } as unknown as Pool;
  const app = Fastify();
  await registerSchoolRoutes(app, {
    pool,
    authenticate: async () => {
      throw new ApiError(401, "Sign in to continue");
    },
    services: { secret: "f".repeat(64), origin: AMP, origins: [AMP, PREVIEW] },
  });
  await app.ready();
  t.after(() => app.close());
  const lookup = (origin: string) =>
    app.inject({
      method: "POST",
      url: "/api/v1/school/join/lookup",
      headers: { origin, "content-type": "application/json" },
      payload: { code: "275XKT" },
    });
  for (const origin of [AMP, PREVIEW]) {
    const answer = await lookup(origin);
    assert.notEqual(answer.json().error, "request_origin_invalid", origin);
  }
  const forged = await lookup("https://evil.example.test");
  assert.equal(forged.statusCode, 403);
  assert.equal(forged.json().error, "request_origin_invalid");
});
