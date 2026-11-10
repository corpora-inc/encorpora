import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app.js";
import { ANONYMOUS_RATE_LIMIT } from "../src/server/rate-limits.js";
import type { Repository } from "../src/server/repository.js";

// Only the health route is reached; no repository method is used.
const repository = {} as unknown as Repository;
const authenticate = async () => "amp|synthetic-parent";
const lb = "35.191.10.20";
const ingress = "34.120.0.1";

/** Anonymous requests are limited per client address. */
async function visits(
  app: ReturnType<typeof buildApp>,
  forwardedFor: string,
  times: number,
) {
  const codes: number[] = [];
  for (let i = 0; i < times; i++)
    codes.push(
      (
        await app.inject({
          url: "/api/v1/health",
          remoteAddress: lb,
          headers: { "x-forwarded-for": forwardedFor },
        })
      ).statusCode,
    );
  return codes;
}
const allowed = Array(ANONYMOUS_RATE_LIMIT).fill(200);

test("behind trusted load balancers, anonymous limits apply per visitor", async () => {
  const app = buildApp({
    repository,
    authenticate,
    trustedProxies: ["35.191.0.0/16", "130.211.0.0/22", `${ingress}/32`],
  });
  try {
    const first = await visits(
      app,
      `198.51.100.7, ${ingress}`,
      ANONYMOUS_RATE_LIMIT + 1,
    );
    assert.deepEqual(first.slice(0, ANONYMOUS_RATE_LIMIT), allowed);
    assert.equal(first[ANONYMOUS_RATE_LIMIT], 429);
    // Another visitor through the same load balancer is unaffected.
    assert.deepEqual(await visits(app, `203.0.113.9, ${ingress}`, 1), [200]);
    // A forged leading address does not escape the visitor's own limit.
    assert.deepEqual(
      await visits(app, `192.0.2.1, 198.51.100.7, ${ingress}`, 1),
      [429],
    );
  } finally {
    await app.close();
  }
});

test("without trusted proxies, forwarded headers are ignored", async () => {
  const app = buildApp({ repository, authenticate });
  try {
    const codes = await visits(app, "198.51.100.8", ANONYMOUS_RATE_LIMIT);
    assert.deepEqual(codes, allowed);
    // A different claimed address is still the same peer.
    assert.deepEqual(await visits(app, "203.0.113.10", 1), [429]);
  } finally {
    await app.close();
  }
});

test("the global limit applies to routes defined by the app", async () => {
  const app = buildApp({ repository, authenticate });
  try {
    let last = 0;
    for (let i = 0; i <= ANONYMOUS_RATE_LIMIT; i++)
      last = (await app.inject({ url: "/api/v1/health" })).statusCode;
    assert.equal(last, 429);
    // A signed-in client at the same address has its own allowance.
    const signedIn = await app.inject({
      url: "/api/v1/health",
      headers: { authorization: "Bearer someone" },
    });
    assert.equal(signedIn.statusCode, 200);
  } finally {
    await app.close();
  }
});
