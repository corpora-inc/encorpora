import test from "node:test";
import assert from "node:assert/strict";
import { exchangeCleverIdentity } from "../src/schools/clever-auth.js";
import {
  isCleverAdult,
  providerToken,
} from "../src/identity/provider-principals.js";
import type { FastifyRequest } from "fastify";

const config = {
  origin: "https://amp.example",
  environment: "sandbox" as const,
  clientId: "fixture-app",
  clientSecret: "fixture-secret",
};
test("Clever identity uses subject and provider roles without treating email as proof", async () => {
  const calls: string[] = [];
  const transport: typeof fetch = async (input, options) => {
    const url = String(input);
    calls.push(url);
    assert.equal(options?.redirect, "error");
    if (url.endsWith("/tokens")) {
      const body = new URLSearchParams(String(options?.body));
      assert.equal(
        body.get("redirect_uri"),
        "https://amp.example/api/v1/school/sso/clever/callback",
      );
      assert.equal(body.get("code"), "fixture-code");
      return Response.json({
        access_token: "fixture-access",
        token_type: "bearer",
      });
    }
    if (url.endsWith("/me"))
      return Response.json({
        type: "user",
        data: { id: "teacher-1", district: "district-1" },
      });
    return Response.json({
      data: {
        id: "teacher-1",
        district: "district-1",
        email: "parent@example.test",
        roles: {
          teacher: { schools: ["school-1"] },
          staff: { schools: ["school-1", "school-2"] },
        },
      },
    });
  };
  assert.deepEqual(
    await exchangeCleverIdentity(config, "fixture-code", transport),
    {
      environment: "sandbox",
      districtId: "district-1",
      userId: "teacher-1",
      roles: ["teacher", "staff"],
      schools: ["school-1", "school-2"],
    },
  );
  assert.equal(calls.length, 3);
});
test("Clever rejects a mismatched district and impossible student/adult roles", async () => {
  for (const user of [
    { id: "person", district: "other-district", roles: { teacher: {} } },
    { id: "person", district: "district", roles: { teacher: {}, student: {} } },
  ]) {
    const transport: typeof fetch = async (input) =>
      String(input).endsWith("/tokens")
        ? Response.json({ access_token: "fixture" })
        : String(input).endsWith("/me")
          ? Response.json({ data: { id: "person", district: "district" } })
          : Response.json({ data: user });
    await assert.rejects(exchangeCleverIdentity(config, "fixture", transport));
  }
  assert.equal(isCleverAdult(["contact"]), false);
  assert.equal(isCleverAdult(["contact", "teacher"]), false);
  assert.equal(isCleverAdult(["student", "teacher"]), false);
  assert.equal(isCleverAdult(["district_admin"]), true);
});
test("explicit shared-device credentials take precedence over adult provider cookies", () => {
  const token = `ps_${"a".repeat(43)}`;
  const request = (authorization?: string, url = "/api/v1/provider/session") =>
    ({
      url,
      headers: { cookie: `amp.provider-session=${token}`, authorization },
    }) as FastifyRequest;
  assert.equal(providerToken(request()), token);
  assert.equal(
    providerToken(request(undefined, "/api/v1/provider/sign-out")),
    token,
  );
  assert.equal(providerToken(request(undefined, "/api/v1/account")), null);
  assert.equal(
    providerToken(request(`Bearer ${token}`, "/api/v1/account")),
    token,
  );
  assert.equal(providerToken(request(`Bearer st_${"b".repeat(43)}`)), null);
  assert.equal(providerToken(request("Bearer old-parent-token")), null);
  assert.equal(providerToken(request("malformed credential")), null);
  assert.equal(providerToken(request(`bearer ${token}`)), token);
});
