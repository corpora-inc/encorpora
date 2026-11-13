import test from "node:test";
import assert from "node:assert/strict";
import type { FastifyRequest } from "fastify";
import type { Pool } from "pg";
import {
  providerToken,
  withProviderSessions,
} from "../src/identity/provider-principals.js";
const token = `ps_${"a".repeat(43)}`;
const request = (url: string) =>
  ({
    url,
    headers: { cookie: `amp.provider-session=${token}` },
  }) as FastifyRequest;
test("L1: provider cookie is exchanged only at the session and sign-out endpoints", async () => {
  for (const url of ["/api/v1/provider/session", "/api/v1/provider/sign-out"])
    assert.equal(providerToken(request(url)), token);
  for (const url of [
    "/api/v1/account",
    "/api/v1/account/delete",
    "/api/v1/school/adoptions/options",
    "/api/v1/billing/checkout",
  ]) {
    assert.equal(providerToken(request(url)), null);
    const authenticate = withProviderSessions(
      {
        query: async () => {
          throw new Error("must not inspect provider sessions");
        },
      } as unknown as Pool,
      async () => "fallback",
    );
    assert.equal(await authenticate(request(url)), "fallback");
  }
});
