import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LmsClient } from "../src/schools/clever/lms-client.js";
import {
  LmsError,
  lmsDistrictSchema,
  lmsReady,
  lmsSectionSchema,
  submissionSchema,
} from "../src/schools/clever/lms-model.js";
import {
  assignmentCreateBody,
  assignmentUpdateBody,
  finalGradePoints,
  planSubmission,
  practicePoints,
  submissionsOpen,
  turnsIn,
  type AssignmentDraft,
} from "../src/schools/clever/lms-payloads.js";

/** Bodies copied from Clever's LMS Connect API reference and error table. */
const fixture = (name: string) =>
  readFileSync(
    new URL(`./fixtures/clever-lms/${name}`, import.meta.url),
    "utf8",
  );
const json = (name: string) => JSON.parse(fixture(name));
const section = "657b35c16a1a3e5c217dcd72";
const assignment = "c8f5eced-1ae1-45d9-97ce-0d4f6c0157d5";
const student = "657b35c16a1a3e5c217dcd2e";
const token = "district-token";

type Call = { method: string; url: string; body: unknown; auth: string | null };
function fake(
  responses: (Response | Error | ((call: Call) => Response))[],
  options: { now?: () => number; budget?: number } = {},
) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  const client = new LmsClient({
    fetch: (async (input: URL, init: RequestInit) => {
      const call = {
        method: init.method ?? "GET",
        url: String(input),
        body: init.body ? JSON.parse(String(init.body)) : undefined,
        auth: new Headers(init.headers).get("authorization"),
      };
      calls.push(call);
      const next = responses.shift();
      if (!next) throw new Error("unexpected request");
      if (next instanceof Error) throw next;
      return typeof next === "function" ? next(call) : next;
    }) as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...options,
  });
  return { client, calls, sleeps };
}
const ok = (body: string | object = "") =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const status = (
  code: number,
  body = "",
  headers: Record<string, string> = {},
) => new Response(body, { status: code, headers });

const draft = (over: Partial<AssignmentDraft> = {}): AssignmentDraft => ({
  title: "Practice: 60 minutes",
  description: "Practise 60 minutes in AMP by Friday.",
  dueAt: new Date("2026-12-04T05:59:00.000Z"),
  pointsPossible: 100,
  link: "https://amp.example/",
  termId: "6532b9a1f1c2b30059b3bbf0",
  ...over,
});
const now = new Date("2026-11-20T12:00:00.000Z");

test("documented district, section, assignment and submission bodies parse", async () => {
  const district = lmsDistrictSchema.parse(json("district.json").data);
  assert.equal(district.lms_state, "success");
  assert.equal(district.lms_type, null);
  assert.equal(lmsReady(district), true);
  const schoology = lmsDistrictSchema.parse(
    json("district-schoology.json").data,
  );
  assert.equal(schoology.lms_type, "schoology");
  assert.equal(
    lmsDistrictSchema.parse({ id: district.id, lms_state: "rebooting" })
      .lms_state,
    "unknown",
  );
  assert.equal(lmsReady({ lms_state: "matching_in_progress" }), false);
  assert.equal(lmsReady({ lms_state: null }), false);

  const synced = lmsSectionSchema.parse(json("section.json").data);
  assert.equal(synced.synced, true);
  assert.equal(synced.term_id, "6532b9a1f1c2b30059b3bbf0");
  // The quickstart's bare field, and an absent status, both read correctly.
  const bare = { id: section, district: district.id };
  assert.equal(
    lmsSectionSchema.parse({ ...bare, synced_in_lms: true }).synced,
    true,
  );
  assert.equal(lmsSectionSchema.parse(bare).synced, false);
  assert.equal(
    lmsSectionSchema.parse({ ...bare, lms_status: { synced_in_lms: false } })
      .synced,
    false,
  );
  // Section students and names are not kept by the LMS section read.
  assert.equal("students" in synced, false);

  const { client, calls } = fake([
    ok(fixture("assignment-created.json")),
    ok(fixture("submissions.json")),
    ok(fixture("submission-updated.json")),
  ]);
  const created = await client.createAssignment(
    token,
    section,
    assignmentCreateBody("canvas", draft(), now),
  );
  assert.equal(created.id, assignment);
  assert.equal(created.state, "open");
  const rows = await client.submissions(token, section, assignment);
  assert.deepEqual(
    rows.map((row) => [row.user_id, row.state]),
    [
      [student, "created"],
      ["657b35c16a1a3e5c217dcd31", "created"],
    ],
  );
  const updated = await client.updateSubmission(
    token,
    section,
    assignment,
    student,
    {
      grade_points: 80,
      state: "submitted",
    },
  );
  assert.equal(updated.grade_points, 80);
  assert.deepEqual(
    calls.map((call) => [
      call.method,
      new URL(call.url).pathname + new URL(call.url).search,
    ]),
    [
      ["POST", `/v3.1/sections/${section}/assignments`],
      [
        "GET",
        `/v3.1/sections/${section}/assignments/${assignment}/submissions?limit=100`,
      ],
      [
        "PATCH",
        `/v3.1/sections/${section}/assignments/${assignment}/submissions/${student}`,
      ],
    ],
  );
  assert.ok(calls.every((call) => call.auth === `Bearer ${token}`));
  // A Google Classroom submission for an unmatched user omits user_id.
  assert.equal(submissionSchema.parse({ state: "created" }).user_id, undefined);
});

test("every documented error maps to a safe code; 401/403 are capability failures", async () => {
  for (const row of json("errors.json") as {
    status: number;
    body: string;
    code: string;
  }[]) {
    const { client, calls } = fake(
      Array.from({ length: 4 }, () => status(row.status, row.body)),
    );
    await assert.rejects(
      client.updateSubmission(token, section, assignment, student, {
        grade_points: 1,
      }),
      (error: unknown) => {
        assert.ok(error instanceof LmsError);
        assert.equal(error.lmsCode, row.code, row.body);
        assert.equal(
          error.capability,
          row.status === 401 || row.status === 403,
        );
        // The raw provider message never becomes the error text.
        assert.equal(error.message, row.code);
        return true;
      },
    );
    // Only a generic outage is retried; a documented failure is final.
    assert.equal(calls.length, 1, row.body);
  }
});

test("reads, PATCH and DELETE retry outages; a POST never repeats blindly", async () => {
  const patch = fake([
    status(503),
    status(502),
    ok(fixture("submission-updated.json")),
  ]);
  await patch.client.updateSubmission(token, section, assignment, student, {
    grade_points: 80,
  });
  assert.equal(patch.calls.length, 3);
  assert.deepEqual(patch.sleeps, [1000, 2000]);

  const read = fake([new TypeError("socket"), ok(fixture("submission.json"))]);
  assert.equal(
    (await read.client.submission(token, section, assignment, student)).state,
    "created",
  );

  for (const failure of [status(500), status(503), new TypeError("socket")]) {
    const post = fake([failure, ok(fixture("assignment-created.json"))]);
    await assert.rejects(
      post.client.createAssignment(
        token,
        section,
        assignmentCreateBody("canvas", draft(), now),
      ),
      (error: unknown) =>
        error instanceof LmsError &&
        error.lmsCode === "lms_create_outcome_unknown",
    );
    assert.equal(post.calls.length, 1);
  }

  // 429 was not processed: retried after the reset Clever names, POST included.
  const limited = fake(
    [
      status(429, "", {
        "x-ratelimit-reset": String(Date.parse("2026-11-20T12:00:05Z") / 1000),
      }),
      ok(fixture("assignment-created.json")),
    ],
    { now: () => Date.parse("2026-11-20T12:00:00Z") },
  );
  await limited.client.createAssignment(
    token,
    section,
    assignmentCreateBody("canvas", draft(), now),
  );
  assert.deepEqual(limited.sleeps, [5000]);
  assert.equal(limited.calls.length, 2);

  const exhausted = fake(Array.from({ length: 4 }, () => status(503)));
  await assert.rejects(
    exhausted.client.getAssignment(token, section, assignment),
    (error: unknown) =>
      error instanceof LmsError && error.lmsCode === "lms_unavailable",
  );
  assert.equal(exhausted.calls.length, 4);
});

test("delete treats an assignment already gone as deleted", async () => {
  const { client, calls } = fake([
    ok(""),
    status(404, '{"message":"Assignment does not exist"}'),
  ]);
  assert.equal(
    await client.deleteAssignment(token, section, assignment),
    "deleted",
  );
  assert.equal(
    await client.deleteAssignment(token, section, assignment),
    "missing",
  );
  assert.deepEqual(
    calls.map((call) => call.method),
    ["DELETE", "DELETE"],
  );
  await assert.rejects(client.deleteAssignment(token, section, "../../users"));
});

test("submission pages follow next links within two hours and only under the assignment", async () => {
  const path = `/v3.1/sections/${section}/assignments/${assignment}/submissions`;
  const page = (rows: string[], next?: string) => ({
    data: rows.map((user_id) => ({
      user_id,
      state: "submitted",
      grade_points: 3,
    })),
    links: next ? [{ rel: "next", uri: next }] : [],
  });
  let clock = 0;
  const paged = fake(
    [
      ok(page([student], `${path}?cursor=abc&limit=100`)),
      ok(page(["657b35c16a1a3e5c217dcd31"])),
    ],
    { now: () => clock },
  );
  assert.equal(
    (await paged.client.submissions(token, section, assignment)).length,
    2,
  );
  assert.equal(new URL(paged.calls[1]!.url).search, "?cursor=abc&limit=100");

  const foreign = fake([ok(page([student], "/v3.1/users?limit=100"))]);
  await assert.rejects(foreign.client.submissions(token, section, assignment));

  const slow = fake(
    [
      (() => {
        clock = 0;
        return ok(page([student], `${path}?cursor=abc`));
      })(),
    ],
    {
      now: () => {
        clock += 60 * 60_000;
        return clock;
      },
    },
  );
  await assert.rejects(
    slow.client.submissions(token, section, assignment),
    (error: unknown) =>
      error instanceof LmsError && error.lmsCode === "lms_pagination_expired",
  );
});

test("a pass stops at its request budget instead of nearing Clever's rate limit", async () => {
  const { client } = fake([ok(fixture("submission.json"))], { budget: 1 });
  await client.submission(token, section, assignment, student);
  await assert.rejects(
    client.submission(token, section, assignment, student),
    (error: unknown) =>
      error instanceof LmsError && error.lmsCode === "lms_budget_exhausted",
  );
});

test("assignment bodies follow each LMS's documented fields", () => {
  const canvas = assignmentCreateBody("canvas", draft(), now);
  assert.deepEqual(canvas, {
    title: "Practice: 60 minutes",
    description: "Practise 60 minutes in AMP by Friday.",
    due_date: "2026-12-04T05:59:00.000Z",
    points_possible: 100,
    grading_type: "points",
    assignee_mode: "all",
    attachments: [
      { type: "link", url: "https://amp.example/", title: "Open AMP" },
    ],
    submission_types: ["link"],
    max_attempts: 1,
  });
  const classroom = assignmentCreateBody("google_classroom", draft(), now);
  for (const field of [
    "submission_types",
    "max_attempts",
    "term_id",
    "state",
    "start_date",
  ])
    assert.equal(field in classroom, false, field);
  assert.deepEqual(classroom.attachments, canvas.attachments);
  const schoology = assignmentCreateBody("schoology", draft(), now);
  assert.equal(schoology.term_id, "6532b9a1f1c2b30059b3bbf0");
  assert.deepEqual(schoology.attachments, [
    { type: "text", text: "https://amp.example/", title: "Open AMP" },
  ]);
  for (const field of ["max_attempts", "submission_types", "start_date"])
    assert.equal(field in schoology, false, field);

  assert.throws(
    () => assignmentCreateBody("schoology", draft({ termId: null }), now),
    (error: unknown) =>
      error instanceof LmsError && error.lmsCode === "lms_term_required",
  );
  // Canvas and Google Classroom have no term requirement.
  assignmentCreateBody("canvas", draft({ termId: null }), now);
  assert.throws(
    () => assignmentCreateBody("canvas", draft({ dueAt: now }), now),
    (error: unknown) =>
      error instanceof LmsError && error.lmsCode === "lms_due_date_past",
  );

  // Updates: Google Classroom can't change attachments; Schoology loses them
  // unless the full set is resent.
  assert.equal(
    "attachments" in assignmentUpdateBody("google_classroom", draft(), now),
    false,
  );
  assert.equal(
    "attachments" in assignmentUpdateBody("canvas", draft(), now),
    false,
  );
  const update = assignmentUpdateBody(
    "schoology",
    draft({ pointsPossible: 50 }),
    now,
  );
  assert.deepEqual(update.attachments, schoology.attachments);
  assert.equal(update.points_possible, 50);
  assert.equal(update.term_id, schoology.term_id);
  assert.equal(update.due_date, "2026-12-04T05:59:00.000Z");
  // After the due date an update still renames or rescales, without a date.
  const late = assignmentUpdateBody(
    "canvas",
    draft({ title: "Renamed" }),
    new Date("2026-12-05T00:00:00Z"),
  );
  assert.equal("due_date" in late, false);
  assert.equal(late.title, "Renamed");
});

test("submissions open by LMS assignment state", () => {
  assert.equal(submissionsOpen("google_classroom", "open"), true);
  assert.equal(submissionsOpen("google_classroom", "scheduled"), false);
  assert.equal(submissionsOpen("google_classroom", "draft"), false);
  assert.equal(submissionsOpen("canvas", "draft"), false);
  assert.equal(submissionsOpen("canvas", "locked"), true);
  assert.equal(submissionsOpen("schoology", "draft"), true);
});

test("the submission plan uses only transitions each LMS supports", () => {
  const progress = { points: 40, final: false };
  const final = { points: 40, final: true };
  const none = { points: null, final: false };
  const created = { state: "created" as const, points: null };
  const submitted = { state: "submitted" as const, points: 40 };
  const returned = { state: "returned" as const, points: 40 };
  const ampTurnedIn = { points: 40, turnedIn: true };

  for (const lms of ["canvas", "schoology", "google_classroom"] as const) {
    // No work: nothing is ever written, before or after the due date.
    assert.deepEqual(planSubmission(lms, created, none, null), {
      kind: "none",
    });
    assert.deepEqual(
      planSubmission(lms, created, { points: null, final: true }, null),
      { kind: "none" },
    );
    // No submission listed: nothing to write to (no 404 every pass).
    assert.deepEqual(planSubmission(lms, null, final, null), { kind: "none" });
  }
  // Google Classroom: explicit state out of created; returned only from submitted.
  assert.deepEqual(
    planSubmission("google_classroom", created, progress, null),
    {
      kind: "write",
      bodies: [{ state: "submitted", grade_points: 40 }],
    },
  );
  assert.deepEqual(
    planSubmission("google_classroom", submitted, progress, ampTurnedIn),
    { kind: "none" },
  );
  assert.deepEqual(
    planSubmission(
      "google_classroom",
      submitted,
      { points: 55.555, final: false },
      null,
    ),
    { kind: "write", bodies: [{ grade_points: 55.56 }] },
  );
  assert.deepEqual(planSubmission("google_classroom", submitted, final, null), {
    kind: "write",
    bodies: [{ grade_points: 40, state: "returned" }],
  });
  assert.deepEqual(planSubmission("google_classroom", created, final, null), {
    kind: "write",
    bodies: [{ state: "submitted", grade_points: 40 }, { state: "returned" }],
  });
  assert.deepEqual(planSubmission("google_classroom", returned, final, null), {
    kind: "none",
  });
  assert.deepEqual(
    planSubmission(
      "google_classroom",
      { state: "reclaimed", points: null },
      progress,
      null,
    ),
    { kind: "write", bodies: [{ state: "submitted", grade_points: 40 }] },
  );
  // A later regrade in the LMS is overwritten only when AMP's grade differs.
  assert.deepEqual(
    planSubmission(
      "google_classroom",
      { state: "returned", points: 10 },
      final,
      null,
    ),
    { kind: "write", bodies: [{ grade_points: 40 }] },
  );
  // Work AMP turned in that no longer counts is reclaimed; a student's own
  // turn-in is not, and nothing goes back to created.
  assert.deepEqual(
    planSubmission("google_classroom", submitted, none, ampTurnedIn),
    {
      kind: "write",
      bodies: [{ state: "reclaimed" }],
    },
  );
  assert.deepEqual(
    planSubmission("google_classroom", submitted, none, {
      points: 40,
      turnedIn: false,
    }),
    { kind: "none" },
  );
  assert.deepEqual(
    planSubmission("google_classroom", returned, none, ampTurnedIn),
    {
      kind: "unsupported",
      code: "lms_reclaim_unsupported",
    },
  );
  assert.equal(
    turnsIn(planSubmission("google_classroom", created, progress, null)),
    true,
  );
  assert.equal(
    turnsIn(planSubmission("google_classroom", submitted, final, null)),
    false,
  );

  // Canvas: grade_points with state for SpeedGrader; converges on points even
  // though Canvas keeps its own state.
  assert.deepEqual(planSubmission("canvas", created, final, null), {
    kind: "write",
    bodies: [{ grade_points: 40, state: "submitted" }],
  });
  assert.deepEqual(
    planSubmission("canvas", { state: "created", points: 40 }, final, null),
    {
      kind: "none",
    },
  );
  assert.deepEqual(planSubmission("canvas", submitted, none, ampTurnedIn), {
    kind: "unsupported",
    code: "lms_reclaim_unsupported",
  });

  // Schoology: state is never sent; a grade returns it.
  assert.deepEqual(planSubmission("schoology", created, progress, null), {
    kind: "write",
    bodies: [{ grade_points: 40 }],
  });
  assert.deepEqual(planSubmission("schoology", returned, final, null), {
    kind: "none",
  });
  assert.deepEqual(planSubmission("schoology", submitted, none, ampTurnedIn), {
    kind: "unsupported",
    code: "lms_reclaim_unsupported",
  });
});

test("an answer to a create that AMP can't use still means it exists", async () => {
  const body = assignmentCreateBody("canvas", draft(), now);
  const cases: (Response | Error)[] = [
    new Response('{"data":{"id":"c8f5', { status: 201 }),
    new Response(
      JSON.stringify({ data: { id: assignment, state: "published" } }),
      { status: 201 },
    ),
    new Response(JSON.stringify({ data: { id: "../../users" } }), {
      status: 200,
    }),
    status(502, "<html>unpublished</html>"),
  ];
  for (const answer of cases) {
    const { client, calls } = fake([
      answer,
      ok(fixture("assignment-created.json")),
    ]);
    await assert.rejects(
      client.createAssignment(token, section, body),
      (error: unknown) =>
        error instanceof LmsError &&
        error.lmsCode === "lms_create_outcome_unknown",
    );
    assert.equal(calls.length, 1);
  }
  // A dropped body stream after a 2xx.
  const broken = new Response(
    new ReadableStream({
      start(controller) {
        controller.error(new Error("reset"));
      },
    }),
    { status: 200 },
  );
  const { client } = fake([broken]);
  await assert.rejects(
    client.createAssignment(token, section, body),
    (error: unknown) =>
      error instanceof LmsError &&
      error.lmsCode === "lms_create_outcome_unknown",
  );
});

test("a submission write that moves state is not repeated after an outage", async () => {
  const moving = fake([status(502), ok(fixture("submission-updated.json"))]);
  await assert.rejects(
    moving.client.updateSubmission(token, section, assignment, student, {
      state: "submitted",
      grade_points: 80,
    }),
    (error: unknown) =>
      error instanceof LmsError && error.lmsCode === "lms_unavailable",
  );
  assert.equal(moving.calls.length, 1);
  const network = fake([new TypeError("socket")]);
  await assert.rejects(
    network.client.updateSubmission(token, section, assignment, student, {
      state: "returned",
    }),
    (error: unknown) =>
      error instanceof LmsError && error.lmsCode === "lms_network_failed",
  );
  assert.equal(network.calls.length, 1);
});

test("an assignment link is HTTPS, or plain HTTP on loopback only", () => {
  for (const link of [
    "javascript://127.0.0.1/%0aalert(1)",
    "http://amp.example/",
    "ftp://127.0.0.1/",
  ])
    assert.throws(
      () => assignmentCreateBody("canvas", draft({ link }), now),
      link,
    );
  assignmentCreateBody(
    "canvas",
    draft({ link: "http://127.0.0.1:4310/" }),
    now,
  );
});

test("practice points are measured minutes against the target; finals must be numeric", () => {
  assert.equal(practicePoints(0, 60, 100), null);
  assert.equal(practicePoints(30, 60, 100), 50);
  assert.equal(practicePoints(90, 60, 100), 100);
  assert.equal(practicePoints(20, 60, 10), 3.33);
  assert.equal(practicePoints(20, 0, 10), null);
  assert.equal(finalGradePoints("87", 100), 87);
  assert.equal(finalGradePoints(" 87.5 ", 50), 43.75);
  assert.equal(finalGradePoints("B+", 100), null);
  assert.equal(finalGradePoints("Pass", 100), null);
  assert.equal(finalGradePoints("105", 100), null);
  assert.equal(finalGradePoints(null, 100), null);
});
