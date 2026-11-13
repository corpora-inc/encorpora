import test from "node:test";
import assert from "node:assert/strict";
import { CleverClient, CleverHttpError } from "../src/schools/clever/client.js";
import { schoolSchema, userSchema } from "../src/schools/clever/model.js";
import { cleverConfiguration } from "../src/server/clever.js";

const district = "100000000000000000000001",
  school = "200000000000000000000001",
  user = "300000000000000000000001";
const options = {
  clientId: "fixture-app",
  clientSecret: "fixture-secret",
  sleep: async () => {},
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

test("Clever API version is explicit deployment configuration", () => {
  const env = {
    AMP_CLEVER_CLIENT_ID: options.clientId,
    AMP_CLEVER_CLIENT_SECRET: options.clientSecret,
    AMP_CLEVER_ENVIRONMENT: "sandbox",
  };
  const account = { baseURL: "https://amp.example.test", production: true };
  assert.equal(cleverConfiguration(env, account)?.apiVersion, "3.1");
  for (const version of ["3.0", "3.1"])
    assert.equal(
      cleverConfiguration({ ...env, AMP_CLEVER_API_VERSION: version }, account)
        ?.apiVersion,
      version,
    );
  for (const version of ["", "3", "2.1", " 3.0", "3.0/../../oauth"])
    assert.throws(
      () =>
        cleverConfiguration(
          { ...env, AMP_CLEVER_API_VERSION: version },
          account,
        ),
      /clever_api_version_invalid/,
    );
});

for (const apiVersion of ["3.0", "3.1"] as const)
  test(`Clever ${apiVersion} uses one version for roster, identity reads and events`, async () => {
    const requested: string[] = [];
    const client = new CleverClient({
      ...options,
      apiVersion,
      fetch: async (input) => {
        const url = new URL(String(input));
        requested.push(url.pathname);
        assert.ok(url.pathname.startsWith(`/v${apiVersion}/`));
        const collection = url.pathname.split("/")[2];
        if (collection === "districts")
          return json({ data: { id: district, name: "District" } });
        if (url.pathname.endsWith(user))
          return json({
            data: {
              id: user,
              district,
              name: { first: "Teacher" },
              roles: { teacher: { school } },
            },
          });
        return json({ data: [], links: [] });
      },
    });
    assert.equal(
      (await client.snapshot(district, "fixture-token")).district.id,
      district,
    );
    assert.equal(
      (await client.get(`/users/${user}`, "fixture-token", userSchema)).id,
      user,
    );
    assert.equal(await client.latestEvent("fixture-token"), null);
    assert.deepEqual(await client.events("fixture-token", user), []);
    assert.deepEqual(
      new Set(requested.map((p) => p.split("/")[2])),
      new Set([
        "districts",
        "schools",
        "users",
        "courses",
        "terms",
        "sections",
        "events",
      ]),
    );
  });

test("Clever pagination stays on its configured API version and never downgrades 403", async () => {
  let requests = 0;
  const client = new CleverClient({
    ...options,
    apiVersion: "3.0",
    fetch: async (input) => {
      requests++;
      const url = new URL(String(input));
      if (!url.searchParams.has("starting_after"))
        return json({
          data: [{ data: { id: school, district, name: "School" } }],
          links: [{ rel: "next", uri: "/v3.0/schools?starting_after=x" }],
        });
      return json({
        data: [],
        links: [{ rel: "next", uri: "/v3.1/schools?starting_after=y" }],
      });
    },
  });
  await assert.rejects(
    client.list("/schools", "fixture-token", schoolSchema),
    /clever_unsafe_pagination_link/,
  );
  assert.equal(requests, 2);
  requests = 0;
  const forbidden = new CleverClient({
    ...options,
    apiVersion: "3.1",
    fetch: async () => {
      requests++;
      return json({}, 403);
    },
  });
  await assert.rejects(
    forbidden.list("/schools", "fixture-token", schoolSchema),
    (e) => e instanceof CleverHttpError && e.status === 403,
  );
  assert.equal(requests, 1);
});
