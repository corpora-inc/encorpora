import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { failureShape } from "../src/server/failure-shape.js";
import {
  registerDatabaseHealth,
  watchRuntimeHealth,
} from "../src/server/runtime-health.js";
import { logSlowRequests } from "../src/server/slow-requests.js";

test("the database health check says yes or no and nothing else", async () => {
  const healthy = Fastify();
  registerDatabaseHealth(healthy, {
    query: async () => ({ rows: [] }),
  } as never);
  const ok = await healthy.inject({ url: "/api/v1/health/database" });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json(), { ok: true });

  const down = Fastify();
  registerDatabaseHealth(down, {
    query: async () => {
      throw new Error("connect failed: postgres://secret@host");
    },
  } as never);
  const failed = await down.inject({ url: "/api/v1/health/database" });
  assert.equal(failed.statusCode, 503);
  assert.deepEqual(failed.json(), { ok: false });
});

test("a slow request logs its route pattern, not its URL", async () => {
  const lines: Record<string, unknown>[] = [];
  const app = Fastify({
    logger: {
      level: "warn",
      stream: { write: (line: string) => void lines.push(JSON.parse(line)) },
    },
  });
  logSlowRequests(app);
  app.get("/learners/:id/slow", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1050));
    return {};
  });
  app.get("/fast", async () => ({}));
  await app.inject({ url: "/fast" });
  assert.equal(lines.length, 0);
  await app.inject({ url: "/learners/private-learner-id/slow?token=secret" });
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.route, "/learners/:id/slow");
  assert.ok(!JSON.stringify(lines[0]).includes("private-learner-id"));
  assert.ok(!JSON.stringify(lines[0]).includes("secret"));
});

test("a frozen event loop is reported", async () => {
  const warnings: unknown[][] = [];
  const stop = watchRuntimeHealth(
    { warn: ((...args: unknown[]) => void warnings.push(args)) as never },
    900,
  );
  // The monitor measures between its own samples, so let it start first.
  await new Promise((resolve) => setTimeout(resolve, 100));
  const until = Date.now() + 700;
  while (Date.now() < until);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  stop();
  const stalled = warnings.find((args) => args[1] === "event loop stalled");
  assert.ok(stalled, "the stall was logged");
  assert.ok((stalled[0] as { ms: number }).ms >= 500);
});

test("a job failure shows what failed but never its message", () => {
  const error = Object.assign(new TypeError("token=secret payload"), {
    code: "ECONNRESET",
    status: 503,
  });
  const shape = failureShape(error);
  assert.deepEqual(JSON.parse(shape), {
    name: "TypeError",
    code: "ECONNRESET",
    status: 503,
  });
  assert.ok(!shape.includes("secret"));
  assert.equal(failureShape(null), "{}");
  assert.deepEqual(
    JSON.parse(failureShape({ code: "has spaces and secret" })),
    {},
  );
});
