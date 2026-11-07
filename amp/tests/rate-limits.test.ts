import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/server/app";
import Fastify from "fastify";
import {
  ANONYMOUS_RATE_LIMIT,
  fixedWindow,
  GLOBAL_RATE_LIMIT,
  limitEachAddress,
  passwordAttemptsExhausted,
  recordWrongPassword,
} from "../src/server/rate-limits";

const app = buildApp({
  repository: {} as never,
  development: true,
  logger: false,
  authenticate: async () => "parent",
} as never);
const remaining = async (
  headers: Record<string, string> = {},
  ip = "203.0.113.9",
) => {
  const response = await app.inject({
    method: "GET",
    url: "/api/v1/catalog",
    remoteAddress: ip,
    headers,
  });
  assert.equal(response.statusCode, 200);
  return {
    limit: Number(response.headers["x-ratelimit-limit"]),
    remaining: Number(response.headers["x-ratelimit-remaining"]),
  };
};

test("students on one school address are limited separately", async () => {
  const cookie = (name: string) => ({
    cookie: `other=1; __Secure-amp.session_token=${name}.signature`,
  });
  const first = await remaining(cookie("student-a"));
  assert.equal(first.limit, GLOBAL_RATE_LIMIT);
  assert.equal(first.remaining, GLOBAL_RATE_LIMIT - 1);
  assert.equal(
    (await remaining(cookie("student-b"))).remaining,
    GLOBAL_RATE_LIMIT - 1,
  );
  assert.equal(
    (await remaining(cookie("student-a"))).remaining,
    GLOBAL_RATE_LIMIT - 2,
  );
});

test("a local-development session cookie name counts as a session too", async () => {
  const { limit } = await remaining(
    { cookie: "amp.session_token=abc" },
    "203.0.113.10",
  );
  assert.equal(limit, GLOBAL_RATE_LIMIT);
});

test("requests with no credential share their address's larger limit", async () => {
  const first = await remaining({}, "203.0.113.11");
  assert.equal(first.limit, ANONYMOUS_RATE_LIMIT);
  assert.equal(first.remaining, ANONYMOUS_RATE_LIMIT - 1);
  assert.equal(
    (await remaining({}, "203.0.113.11")).remaining,
    ANONYMOUS_RATE_LIMIT - 2,
  );
  assert.equal(
    (await remaining({ cookie: "other=1" }, "203.0.113.11")).remaining,
    ANONYMOUS_RATE_LIMIT - 3,
  );
});

test("made-up credentials can't escape the limit on an address", async () => {
  const small = Fastify();
  limitEachAddress(small, 3);
  small.get("/", async () => "ok");
  const statuses = [];
  for (let i = 0; i < 5; i++)
    statuses.push(
      (
        await small.inject({
          url: "/",
          remoteAddress: "203.0.113.12",
          headers: { cookie: `amp.session_token=made-up-${i}` },
        })
      ).statusCode,
    );
  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  const elsewhere = await small.inject({
    url: "/",
    remoteAddress: "203.0.113.13",
  });
  assert.equal(elsewhere.statusCode, 200);
  await small.close();
});

test("a window ends, and counts per key", () => {
  const window = fixedWindow(1000);
  assert.ok(window.consume("a", 2, 0));
  assert.ok(window.consume("a", 2, 10));
  assert.ok(!window.consume("a", 2, 20));
  assert.equal(window.count("a", 20), 3);
  assert.ok(window.consume("b", 2, 20));
  assert.ok(window.consume("a", 2, 1000));
  assert.equal(window.count("a", 1000), 1);
});

test("wrong passwords are limited per account, not per address", () => {
  const body = (email: string) => Buffer.from(JSON.stringify({ email }));
  const target = body("Target@Example.test");
  const here = "198.51.100.1";
  for (let i = 0; i < 10; i++) {
    assert.ok(!passwordAttemptsExhausted(target, here), `attempt ${i}`);
    recordWrongPassword(target, here);
  }
  assert.ok(passwordAttemptsExhausted(target, here));
  assert.ok(
    passwordAttemptsExhausted(body(" target@example.test "), here),
    "the same account however it's typed",
  );
  assert.ok(!passwordAttemptsExhausted(body("other@example.test"), here));
  assert.ok(
    !passwordAttemptsExhausted(target, "198.51.100.2"),
    "the real person, elsewhere",
  );
  assert.ok(!passwordAttemptsExhausted(Buffer.from("{not json"), here));
  assert.ok(!passwordAttemptsExhausted(undefined, here));
});
