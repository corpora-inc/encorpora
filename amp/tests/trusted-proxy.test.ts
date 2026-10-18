import test from "node:test";
import assert from "node:assert/strict";
import { buildApp, GLOBAL_RATE_LIMIT } from "../src/server/app.js";
import type { Repository } from "../src/server/repository.js";

// Only trial creation is reached; every other repository method is unused.
const repository = {
  createTrial: async () => ({ token: "t".repeat(43), learnerId: "trial" }),
} as unknown as Repository;
const authenticate = async () => {
  throw Object.assign(new Error("unused"), { statusCode: 401 });
};
const lb = "35.191.10.20";
const ingress = "34.120.0.1";

async function trials(
  app: ReturnType<typeof buildApp>,
  forwardedFor: string,
  times: number,
) {
  const codes: number[] = [];
  for (let i = 0; i < times; i++)
    codes.push(
      (
        await app.inject({
          method: "POST",
          url: "/api/v1/trials",
          remoteAddress: lb,
          headers: { "x-forwarded-for": forwardedFor },
          payload: { birthYear: 2016 },
        })
      ).statusCode,
    );
  return codes;
}

test("behind trusted load balancers, trial limits apply per visitor", async () => {
  const app = buildApp({
    repository,
    authenticate,
    trustedProxies: ["35.191.0.0/16", "130.211.0.0/22", `${ingress}/32`],
  });
  try {
    const first = await trials(app, `198.51.100.7, ${ingress}`, 21);
    assert.deepEqual(first.slice(0, 20), Array(20).fill(201));
    assert.equal(first[20], 429);
    // Another visitor through the same load balancer is unaffected.
    assert.deepEqual(await trials(app, `203.0.113.9, ${ingress}`, 1), [201]);
    // A forged leading address does not escape the visitor's own limit.
    assert.deepEqual(
      await trials(app, `192.0.2.1, 198.51.100.7, ${ingress}`, 1),
      [429],
    );
  } finally {
    await app.close();
  }
});

test("without trusted proxies, forwarded headers are ignored", async () => {
  const app = buildApp({ repository, authenticate });
  try {
    const codes = await trials(app, "198.51.100.8", 20);
    assert.deepEqual(codes, Array(20).fill(201));
    // A different claimed address is still the same peer.
    assert.deepEqual(await trials(app, "203.0.113.10", 1), [429]);
  } finally {
    await app.close();
  }
});

test("the global limit applies to routes defined by the app", async () => {
  const app = buildApp({ repository, authenticate });
  try {
    let last = 0;
    for (let i = 0; i <= GLOBAL_RATE_LIMIT; i++)
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
