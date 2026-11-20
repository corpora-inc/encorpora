import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { probeCleverLms } from "../scripts/clever-lms-probe.js";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/clever-lms/${name}`, import.meta.url),
      "utf8",
    ),
  );
const district = "5800eb48a6d68b0223000001";
const env = {
  AMP_CLEVER_ENVIRONMENT: "sandbox",
  AMP_CLEVER_TEST_DISTRICT_ID: district,
  AMP_CLEVER_CLIENT_ID: "probe-client",
  AMP_CLEVER_CLIENT_SECRET: "probe-secret",
};
const json = (body: unknown, status = 200) =>
  new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/** A sandbox stand-in for Clever, answering with the documented bodies. */
function sandbox(options: { forbidden?: boolean; lmsType?: string } = {}) {
  const calls: string[] = [];
  let deleted = false;
  const section = fixture("section.json").data;
  const fetcher = (async (input: URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push(`${method} ${url.pathname}`);
    if (url.hostname === "clever.com")
      return json({ data: [{ access_token: "secret-token", district }] });
    if (options.forbidden)
      return json({ message: "Could not authorize token" }, 403);
    const path = url.pathname;
    if (path === `/v3.1/districts/${district}`)
      return json({
        data: {
          ...fixture("district.json").data,
          lms_type: options.lmsType ?? "google_classroom",
        },
      });
    if (path === "/v3.1/sections")
      return json({
        data: [
          { data: section },
          {
            data: {
              ...section,
              id: "657b35c16a1a3e5c217dcd73",
              lms_status: { synced_in_lms: false },
            },
          },
        ],
        links: [],
      });
    const base = `/v3.1/sections/${section.id}/assignments`;
    const id = fixture("assignment-created.json").data.id;
    if (path === base && method === "POST")
      return json(fixture("assignment-created.json"));
    if (path === `${base}/${id}` && method === "GET")
      return deleted
        ? json({ message: "Assignment does not exist" }, 404)
        : json(fixture("assignment-created.json"));
    if (path === `${base}/${id}` && method === "PATCH")
      return json({
        data: {
          ...fixture("assignment-created.json").data,
          points_possible: 5,
        },
      });
    if (path === `${base}/${id}` && method === "DELETE") {
      deleted = true;
      return json(null);
    }
    if (path === `${base}/${id}/submissions`)
      return json(fixture("submissions.json"));
    if (path.startsWith(`${base}/${id}/submissions/`) && method === "PATCH") {
      const body = JSON.parse(String(init.body));
      return json({
        data: {
          ...fixture("submission.json").data,
          ...body,
          grade_points: body.grade_points ?? 1,
        },
      });
    }
    throw new Error(`unexpected ${method} ${path}`);
  }) as typeof fetch;
  return { fetcher, calls };
}
const leaks = (output: unknown) => {
  const text = JSON.stringify(output);
  return [
    /[a-f0-9]{24}/,
    /[0-9a-f]{8}-[0-9a-f]{4}-/,
    /secret/,
    /probe-client/,
    /Demo District/,
    /AMP LMS Connect probe/,
  ]
    .filter((pattern) => pattern.test(text))
    .map(String);
};

test("the LMS probe reads capability and counts without identifiers", async () => {
  const { fetcher, calls } = sandbox();
  const result = await probeCleverLms(env, {}, { fetch: fetcher });
  assert.deepEqual(result, {
    districtToken: { status: "available" },
    district: {
      status: "available",
      lmsState: "success",
      lmsType: "google_classroom",
      lastLmsSync: "absent",
    },
    sections: { status: "available", count: 2, synced: 1 },
  });
  assert.equal(
    calls.some((call) => !call.startsWith("GET")),
    false,
  );
  assert.deepEqual(leaks(result), []);
});

test("the write probe creates, updates, grades and deletes, then confirms deletion", async () => {
  const { fetcher, calls } = sandbox();
  const result = await probeCleverLms(
    env,
    { write: true, submission: true },
    {
      fetch: fetcher,
      now: () => new Date("2026-11-20T12:00:00Z"),
    },
  );
  assert.deepEqual(result.assignmentCreate, {
    status: "available",
    state: "open",
  });
  assert.deepEqual(result.assignmentUpdate, {
    status: "available",
    pointsApplied: true,
  });
  assert.deepEqual(result.submissions, {
    status: "available",
    count: 2,
    unmatched: 0,
    states: { created: 2 },
  });
  // Google Classroom: created → submitted with the grade, then returned.
  assert.deepEqual(result.submissionUpdate, {
    status: "available",
    writes: 2,
    state: "returned",
    graded: true,
  });
  assert.deepEqual(result.assignmentDelete, {
    status: "available",
    result: "deleted",
  });
  assert.deepEqual(result.deletedRead, {
    status: "available",
    result: "missing",
  });
  assert.equal(calls.filter((call) => call.startsWith("DELETE")).length, 1);
  assert.deepEqual(leaks(result), []);
});

test("a refused token is reported as a capability failure, and writes are skipped", async () => {
  const { fetcher, calls } = sandbox({ forbidden: true });
  const result = await probeCleverLms(env, { write: true }, { fetch: fetcher });
  assert.deepEqual(result.district, {
    status: "unavailable",
    code: "lms_forbidden",
    capability: true,
  });
  assert.deepEqual(result.sections, {
    status: "unavailable",
    code: "lms_forbidden",
    capability: true,
  });
  assert.deepEqual(result.assignment, {
    status: "skipped",
    reason: "lms_not_ready",
  });
  assert.equal(
    calls.some((call) => call.startsWith("POST")),
    false,
  );
});

test("the probe refuses production and an unpaired submission flag", async () => {
  await assert.rejects(
    probeCleverLms({ ...env, AMP_CLEVER_ENVIRONMENT: "production" }),
    /sandbox_environment_required/,
  );
  await assert.rejects(
    probeCleverLms(env, { submission: true }),
    /submission_requires_write/,
  );
});
