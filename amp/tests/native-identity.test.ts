import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app.js";
import { ApiError, type Repository } from "../src/server/repository.js";

test("identity binding requires authentication, grants no learning access, and is never cached", async () => {
  let learningCalls = 0;
  const repository = new Proxy({} as Repository, {
    get() {
      return async () => {
        learningCalls++;
        throw Error("Identity must not read child data or grant access");
      };
    },
  });
  const app = buildApp({
    repository,
    authenticate: async (request) => {
      if (request.headers.authorization !== "Bearer fixture")
        throw new ApiError(401, "Sign in");
      return "https://issuer.example.test|parent";
    },
  });
  try {
    const anonymous = await app.inject({ url: "/api/v1/session" });
    assert.equal(anonymous.statusCode, 401);
    const identity = await app.inject({
      url: "/api/v1/session",
      headers: { authorization: "Bearer fixture" },
    });
    assert.equal(identity.statusCode, 200);
    assert.deepEqual(identity.json(), {
      accountId: "https://issuer.example.test|parent",
    });
    assert.equal(identity.headers["cache-control"], "no-store");
    assert.equal(learningCalls, 0);
  } finally {
    await app.close();
  }
});
