import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import type { Snapshot } from "../src/schools/clever/model.js";
import { LmsClient } from "../src/schools/clever/lms-client.js";
import { runLmsConnection } from "../src/schools/clever/lms-worker.js";
import {
  classLms,
  createLmsAssignment,
  deleteLmsAssignment,
  readLmsAssignments,
  republishLmsAssignment,
  requestLmsSync,
  updateLmsAssignment,
} from "../src/schools/clever/lms-store.js";
import { lmsConnectEnabled } from "../src/schools/clever/lms-config.js";
import { runLmsPasses } from "../scripts/clever-lms.js";
import type { LmsType } from "../src/schools/clever/lms-model.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };
const D = "100000000000000000000001",
  S = "200000000000000000000001",
  T = "300000000000000000000009",
  A = "300000000000000000000001",
  B = "300000000000000000000002",
  C = "300000000000000000000003",
  X = "400000000000000000000001",
  TERM = "600000000000000000000001";
const ORIGIN = "https://amp.example";
const assignmentFixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/clever-lms/assignment-created.json", import.meta.url),
    "utf8",
  ),
).data;

const snapshot = (): Snapshot => ({
  district: { id: D, name: "Fixture District" },
  schools: [{ id: S, district: D, name: "Fixture School" }],
  users: [
    {
      id: T,
      district: D,
      name: { first: "Teacher" },
      roles: { teacher: { school: S } },
    },
    ...[A, B, C].map((id, n) => ({
      id,
      district: D,
      name: { first: `Student ${n + 1}` },
      roles: { student: { school: S, grade: "4" } },
    })),
  ],
  sections: [
    {
      id: X,
      district: D,
      school: S,
      name: "Math 4",
      students: [A, B, C],
      teacher: T,
      teachers: [T],
      term_id: TERM,
    },
  ],
  courses: [],
  terms: [
    {
      id: TERM,
      district: D,
      name: "Fall",
      start_date: "2026-08-15",
      end_date: "2026-12-20",
    },
  ],
});

type Submission = { state: string; grade_points?: number };
/** A stateful stand-in for Clever's LMS Connect API. Each create gets its own
 * ID and roster of submissions; submission writes follow each LMS's
 * documented rules, so a wrong transition fails loudly. */
function fakeClever(lmsType: LmsType) {
  const calls: { method: string; path: string; body?: any }[] = [];
  const assignments = new Map<
    string,
    { exists: boolean; body: any; submissions: Map<string, Submission> }
  >();
  const state = {
    district: {
      status: 200,
      lms_state: "success" as string,
      lms_type: lmsType as string | null,
    },
    synced: true,
    assignmentState: "open",
    createStatus: 200,
    failUser: null as null | { user: string; status: number; message: string },
    lastId: null as string | null,
    get lastAssignment() {
      return state.lastId ? assignments.get(state.lastId)!.body : null;
    },
    set assignmentExists(value: boolean) {
      assignments.get(state.lastId!)!.exists = value;
    },
  };
  /** The latest assignment's submissions. */
  const submissions = {
    get: (user: string) =>
      assignments.get(state.lastId!)!.submissions.get(user),
    set: (user: string, row: Submission) =>
      assignments.get(state.lastId!)!.submissions.set(user, row),
  };
  const json = (body: unknown, status = 200) =>
    new Response(body === null ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const fetcher = (async (input: URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    if (url.hostname === "clever.com")
      return json({ data: [{ access_token: "district-token", district: D }] });
    calls.push({ method, path: url.pathname, ...(body ? { body } : {}) });
    const path = url.pathname;
    if (state.district.status !== 200)
      return json(
        { message: "Could not authorize token" },
        state.district.status,
      );
    if (path === `/v3.1/districts/${D}`)
      return json({
        data: { id: D, name: "Fixture District", ...state.district },
      });
    if (path === `/v3.1/sections/${X}`)
      return json({
        data: {
          id: X,
          district: D,
          term_id: TERM,
          lms_status: { synced_in_lms: state.synced },
        },
      });
    const base = `/v3.1/sections/${X}/assignments`;
    if (path === base && method === "POST") {
      if (state.createStatus !== 200)
        return json({ message: "internal" }, state.createStatus);
      const id = randomUUID();
      state.lastId = id;
      assignments.set(id, {
        exists: true,
        body,
        submissions: new Map(
          [A, B, C].map((user) => [user, { state: "created" }]),
        ),
      });
      return json({
        data: {
          ...assignmentFixture,
          ...body,
          id,
          state: state.assignmentState,
        },
      });
    }
    const [, id, , user] = path.slice(base.length).split("/");
    const assignment = id ? assignments.get(id) : undefined;
    if (id && (!assignment || !assignment.exists))
      return json({ message: "Assignment does not exist" }, 404);
    if (assignment && !path.includes("/submissions")) {
      if (method === "GET")
        return json({
          data: { ...assignmentFixture, id, state: state.assignmentState },
        });
      if (method === "PATCH") {
        assignment.body = { ...assignment.body, ...body };
        return json({
          data: {
            ...assignmentFixture,
            ...body,
            id,
            state: state.assignmentState,
          },
        });
      }
      if (method === "DELETE") {
        assignment.exists = false;
        return json(null);
      }
    }
    if (assignment && path.endsWith("/submissions") && method === "GET")
      return json({
        data: [...assignment.submissions].map(([user_id, row]) => ({
          user_id,
          ...row,
        })),
        links: [],
      });
    if (assignment && user && method === "PATCH") {
      if (state.failUser?.user === user)
        return json({ message: state.failUser.message }, state.failUser.status);
      const row = assignment.submissions.get(user);
      if (!row) return json({ message: "User not found" }, 404);
      if (lmsType === "canvas") {
        if (state.assignmentState === "draft")
          return json({ message: "UNSUPPORTED_OPERATION" }, 400);
        if (body.state && body.state !== "submitted")
          throw new Error("canvas state");
        row.state = "submitted";
      } else if (lmsType === "schoology") {
        if ("state" in body) throw new Error("schoology state");
        if (body.grade_points !== undefined) row.state = "returned";
      } else {
        const next = body.state as string | undefined;
        if (next === "created" && row.state !== "created")
          throw new Error("gc back to created");
        if (
          (next === "returned" || next === "reclaimed") &&
          row.state !== "submitted"
        )
          throw new Error(`gc ${next} from ${row.state}`);
        if (!next && row.state === "created")
          throw new Error("gc grade while created");
        if (next) row.state = next;
      }
      if (body.grade_points !== undefined) row.grade_points = body.grade_points;
      return json({ data: { user_id: user, ...row } });
    }
    throw new Error(`unexpected ${method} ${path}`);
  }) as typeof fetch;
  return { fetcher, calls, submissions, state, assignments };
}

async function fixture(
  run: (ctx: {
    db: Pool;
    connectionId: string;
    classId: string;
    people: Record<string, string>;
    learners: Record<string, string>;
    pass: (
      fake: ReturnType<typeof fakeClever>,
      now: Date,
    ) => ReturnType<typeof runLmsConnection>;
  }) => Promise<void>,
) {
  const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
  assertTestDatabaseTarget(url.href);
  const admin = new Pool({ connectionString: url.href, max: 1 });
  const schema = `lms_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  url.searchParams.set("options", `-c search_path=${schema}`);
  let db: Pool | undefined;
  try {
    await migrate(url.href);
    db = new Pool({ connectionString: url.href, max: 4 });
    const repo = new SchoolRepository(db);
    const org = await repo.createOrg(
      {
        kind: "district",
        name: "Fixture district",
        timezone: "America/Chicago",
      },
      { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
    );
    const { id: connectionId } = await registerCleverConnection(db, {
      environment: "sandbox",
      districtId: D,
      tenantId: org.id,
    });
    await syncCleverConnection(
      db,
      connectionId,
      {
        districtToken: async () => "fixture",
        snapshot: async () => snapshot(),
        latestEvent: async () => null,
        events: async () => [],
      },
      { mode: "full", now: new Date("2026-11-01T15:00:00Z") },
    );
    const bindings = (
      await db.query(
        `SELECT b.kind,b.clever_id,b.local_id,p.learner_id FROM amp_clever_bindings b
         LEFT JOIN amp_people p ON p.id=b.local_id AND b.kind='user' WHERE b.connection_id=$1`,
        [connectionId],
      )
    ).rows;
    const classId = bindings.find((row) => row.kind === "section").local_id;
    const people: Record<string, string> = {},
      learners: Record<string, string> = {};
    for (const row of bindings.filter((row) => row.kind === "user")) {
      people[row.clever_id] = row.local_id;
      learners[row.clever_id] = row.learner_id;
    }
    const pool = db;
    await run({
      db,
      connectionId,
      classId,
      people,
      learners,
      pass: (fake, now) =>
        runLmsConnection(pool, connectionId, {
          clever: {
            districtToken: async () => "district-token",
          },
          lms: () =>
            new LmsClient({ fetch: fake.fetcher, sleep: async () => {} }),
          origin: ORIGIN,
          now: () => now,
        }),
    });
  } finally {
    await db?.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  }
}
const minutes = async (db: Pool, learner: string, day: string, value: number) =>
  db.query(
    `INSERT INTO amp_active_days(learner_id,day,surface,skill_id,active_ms) VALUES($1,$2,'practice','',$3)
     ON CONFLICT(learner_id,day,surface,skill_id) DO UPDATE SET active_ms=amp_active_days.active_ms+EXCLUDED.active_ms`,
    [learner, day, value * 60_000],
  );
const at = (iso: string) => new Date(iso);
const practice = {
  kind: "practice",
  title: "Practice this week",
  pointsPossible: 100,
  targetMinutes: 60,
  opensOn: "2026-11-18",
  dueOn: "2026-11-23",
};
const row = async (db: Pool, id: string) =>
  (await db.query("SELECT * FROM amp_lms_assignments WHERE id=$1", [id]))
    .rows[0];
const sent = async (db: Pool, id: string) =>
  Object.fromEntries(
    (
      await db.query(
        "SELECT user_id,lms_state,sent_points::float8 AS points,sent_final,failure_code FROM amp_lms_submissions WHERE assignment_id=$1",
        [id],
      )
    ).rows.map((r) => [r.user_id, r]),
  );

test(
  "Google Classroom: publish, return measured minutes, hand back at the due date, then stop",
  enabled,
  () =>
    fixture(async ({ db, classId, learners, pass }) => {
      const fake = fakeClever("google_classroom");
      const now = at("2026-11-20T18:00:00Z");
      assert.deepEqual(
        { ...(await classLms(db, classId, "sandbox")), connectionId: "x" },
        {
          connectionId: "x",
          sectionId: X,
          lmsType: null,
          lmsState: null,
          failureCode: null,
        },
      );
      assert.equal(await classLms(db, classId, "production"), null);
      const { id } = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      // End of the due day in the school's zone (Chicago, UTC-6 in November).
      assert.equal(
        (await row(db, id)).due_at.toISOString(),
        "2026-11-24T05:59:00.000Z",
      );
      await minutes(db, learners[A]!, "2026-11-18", 20);
      await minutes(db, learners[A]!, "2026-11-19", 10);
      await minutes(db, learners[B]!, "2026-11-19", 90);
      // Before the window: never counted.
      await minutes(db, learners[C]!, "2026-11-10", 300);

      const first = await pass(fake, now);
      assert.equal(first.created, 1);
      assert.deepEqual(fake.state.lastAssignment, {
        title: "Practice this week",
        description:
          "Practice 60 minutes in AMP from 2026-11-18 to 2026-11-23. Points follow the minutes practiced.",
        due_date: "2026-11-24T05:59:00.000Z",
        points_possible: 100,
        grading_type: "points",
        assignee_mode: "all",
        attachments: [{ type: "link", url: `${ORIGIN}/`, title: "Open AMP" }],
      });
      let stored = await row(db, id);
      assert.equal(stored.status, "published");
      assert.equal(stored.clever_assignment_id, fake.state.lastId);
      assert.equal(stored.lms_type, "google_classroom");
      assert.deepEqual(
        (await db.query("SELECT lms_state,lms_type FROM amp_clever_lms")).rows,
        [{ lms_state: "success", lms_type: "google_classroom" }],
      );

      fake.calls.length = 0;
      const second = await pass(fake, now);
      assert.equal(second.graded, 2);
      const patches = fake.calls.filter((call) => call.method === "PATCH");
      assert.deepEqual(
        patches.map((call) => [call.path.split("/").at(-1), call.body]),
        [
          [A, { state: "submitted", grade_points: 50 }],
          [B, { state: "submitted", grade_points: 100 }],
        ],
      );
      assert.equal(fake.submissions.get(C)!.state, "created");
      let rows = await sent(db, id);
      assert.equal(rows[A].points, 50);
      assert.equal(rows[A].lms_state, "submitted");
      assert.equal(rows[C], undefined);

      // Nothing is due again for 15 minutes: no Clever request at all.
      fake.calls.length = 0;
      assert.equal(
        (await pass(fake, at("2026-11-20T18:05:00Z"))).skipped,
        "idle",
      );
      assert.equal(fake.calls.length, 0);

      // More practice moves the grade on the next pass; nothing else is resent.
      await minutes(db, learners[A]!, "2026-11-21", 15);
      fake.calls.length = 0;
      await pass(fake, at("2026-11-21T18:00:00Z"));
      assert.deepEqual(
        fake.calls
          .filter((call) => call.method === "PATCH")
          .map((call) => call.body),
        [{ grade_points: 75 }],
      );

      // Practice after the due date does not count; the final grade is handed back.
      await minutes(db, learners[A]!, "2026-11-24", 60);
      fake.calls.length = 0;
      const final = await pass(fake, at("2026-11-24T06:30:00Z"));
      assert.deepEqual(
        fake.calls
          .filter((call) => call.method === "PATCH")
          .map((call) => [call.path.split("/").at(-1), call.body]),
        [
          [A, { grade_points: 75, state: "returned" }],
          [B, { grade_points: 100, state: "returned" }],
        ],
      );
      assert.equal(final.graded, 2);
      stored = await row(db, id);
      assert.ok(stored.finalized_at);
      rows = await sent(db, id);
      assert.equal(rows[A].sent_final, true);
      assert.equal(rows[A].lms_state, "returned");
      // Finalized: no more requests, hours or days later.
      fake.calls.length = 0;
      await pass(fake, at("2026-11-26T06:30:00Z"));
      assert.deepEqual(
        fake.calls.map((call) => call.method + " " + call.path),
        [`GET /v3.1/districts/${D}`],
      );

      const [view] = await readLmsAssignments(db, classId);
      assert.equal(view!.status, "published");
      assert.equal(view!.graded, 2);
      assert.equal(view!.blocked, 0);
      assert.equal(view!.finalized, true);
      assert.equal(view!.dueOn, "2026-11-23");
    }),
);

test(
  "Schoology needs the section's term and an LTI launch; Canvas needs a published assignment",
  enabled,
  () =>
    fixture(async ({ db, classId, learners, pass }) => {
      const now = at("2026-11-20T18:00:00Z");
      await minutes(db, learners[A]!, "2026-11-19", 30);
      await minutes(db, learners[B]!, "2026-11-19", 30);
      const schoology = fakeClever("schoology");
      const { id } = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await pass(schoology, now);
      assert.equal(schoology.state.lastAssignment.term_id, TERM);
      assert.deepEqual(schoology.state.lastAssignment.attachments, [
        { type: "text", text: `${ORIGIN}/`, title: "Open AMP" },
      ]);
      // A student who never launched AMP from Schoology can't be graded yet.
      schoology.state.failUser = {
        user: A,
        status: 500,
        message: "Error updating submission",
      };
      schoology.calls.length = 0;
      await pass(schoology, now);
      const patchesTo = (user: string) =>
        schoology.calls.filter(
          (call) => call.method === "PATCH" && call.path.endsWith(user),
        );
      assert.equal(
        patchesTo(A).length,
        1,
        "a documented failure is not retried in-request",
      );
      assert.deepEqual(patchesTo(B)[0]!.body, { grade_points: 50 });
      const rows = await sent(db, id);
      assert.equal(rows[A].failure_code, "lms_submission_update_failed");
      assert.equal(rows[B].lms_state, "returned");
      const next = (
        await db.query(
          "SELECT next_attempt_at FROM amp_lms_submissions WHERE user_id=$1",
          [A],
        )
      ).rows[0].next_attempt_at as Date;
      assert.equal(
        next.toISOString(),
        "2026-11-21T00:00:00.000Z",
        "retried six hours later, not every minute",
      );
      // Not final while a student waits…
      await pass(schoology, at("2026-11-24T07:00:00Z"));
      assert.equal((await row(db, id)).finalized_at, null);
      assert.equal(
        (await readLmsAssignments(db, classId))[0]!.blockedBy
          .lms_submission_update_failed,
        1,
      );
      // …and final once they have launched AMP from Schoology and been graded.
      schoology.state.failUser = null;
      await pass(schoology, at("2026-11-24T14:00:00Z"));
      assert.ok((await row(db, id)).finalized_at);
      assert.equal((await sent(db, id))[A].failure_code, null);

      // Canvas: an unpublished assignment takes no submission writes.
      await db.query(
        "TRUNCATE amp_lms_submissions, amp_lms_assignments, amp_clever_lms",
      );
      const canvas = fakeClever("canvas");
      canvas.state.assignmentState = "draft";
      const second = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await pass(canvas, now);
      assert.equal(canvas.state.lastAssignment.max_attempts, 1);
      assert.deepEqual(canvas.state.lastAssignment.submission_types, ["link"]);
      assert.equal("term_id" in canvas.state.lastAssignment, false);
      canvas.calls.length = 0;
      const result = await pass(canvas, now);
      assert.deepEqual(result.failures, { lms_assignment_unpublished: 1 });
      assert.equal(
        canvas.calls.some((call) => call.method === "PATCH"),
        false,
      );
      assert.equal(
        (await row(db, second.id)).failure_code,
        "lms_assignment_unpublished",
      );
      // Published by the teacher in Canvas: grades go through with SpeedGrader's state.
      canvas.state.assignmentState = "open";
      await requestLmsSync(db, { classId, id: second.id });
      canvas.calls.length = 0;
      await pass(canvas, now);
      assert.deepEqual(
        canvas.calls
          .filter((call) => call.method === "PATCH")
          .map((call) => call.body),
        [
          { grade_points: 50, state: "submitted" },
          { grade_points: 50, state: "submitted" },
        ],
      );
    }),
);

test(
  "refused access, an unsynced or unshared section, and a district not yet matched write nothing",
  enabled,
  () =>
    fixture(async ({ db, classId, connectionId, pass }) => {
      const now = at("2026-11-20T18:00:00Z");
      const fake = fakeClever("google_classroom");
      const { id } = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });

      fake.state.district.status = 403;
      const refused = await pass(fake, now);
      assert.deepEqual(refused.failures, { lms_forbidden: 1 });
      const lms = (await db.query("SELECT * FROM amp_clever_lms")).rows[0];
      assert.equal(lms.failure_code, "lms_forbidden");
      assert.ok(lms.next_attempt_at > now);
      assert.equal((await row(db, id)).status, "pending");
      // Backing off: the next minute makes no request at all…
      fake.calls.length = 0;
      assert.equal(
        (await pass(fake, at("2026-11-20T18:00:30Z"))).skipped,
        "backoff",
      );
      assert.equal(fake.calls.length, 0);
      // …unless a teacher asks again.
      await requestLmsSync(db, { classId, id });
      assert.deepEqual(
        (await pass(fake, at("2026-11-20T18:00:40Z"))).failures,
        { lms_forbidden: 1 },
      );

      fake.state.district.status = 200;
      fake.state.district.lms_state = "matching_in_progress";
      await db.query("UPDATE amp_clever_lms SET next_attempt_at=NULL");
      fake.calls.length = 0;
      assert.deepEqual(
        (await pass(fake, at("2026-11-20T19:00:00Z"))).failures,
        { lms_not_ready: 1 },
      );
      assert.equal((await row(db, id)).failure_code, "lms_not_ready");
      assert.deepEqual(
        fake.calls.map((call) => call.method),
        ["GET"],
      );

      fake.state.district.lms_state = "success";
      fake.state.synced = false;
      await requestLmsSync(db, { classId, id });
      assert.deepEqual(
        (await pass(fake, at("2026-11-20T20:00:00Z"))).failures,
        { lms_section_not_synced: 1 },
      );
      assert.equal(
        fake.calls.some((call) => call.method === "POST"),
        false,
      );

      // The district stops sharing the section: no call is made for it.
      fake.state.synced = true;
      await db.query(
        "UPDATE amp_clever_bindings SET archived_at=now() WHERE connection_id=$1 AND kind='section'",
        [connectionId],
      );
      await requestLmsSync(db, { classId, id });
      fake.calls.length = 0;
      assert.deepEqual(
        (await pass(fake, at("2026-11-20T21:00:00Z"))).failures,
        { lms_section_unshared: 1 },
      );
      assert.deepEqual(
        fake.calls.map((call) => call.path),
        [`/v3.1/districts/${D}`],
      );
      assert.equal(await classLms(db, classId, "sandbox"), null);
    }),
);

test(
  "a create without an answer is never repeated on its own; edits, deletes and LMS-side deletes",
  enabled,
  () =>
    fixture(async ({ db, classId, pass }) => {
      const now = at("2026-11-20T18:00:00Z");
      const fake = fakeClever("google_classroom");
      const { id } = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      fake.state.createStatus = 502;
      assert.deepEqual((await pass(fake, now)).failures, {
        lms_create_outcome_unknown: 1,
      });
      assert.equal(
        fake.calls.filter((call) => call.method === "POST").length,
        1,
      );
      assert.equal((await row(db, id)).status, "unknown");
      fake.calls.length = 0;
      await pass(fake, at("2026-11-20T19:30:00Z"));
      assert.equal(
        fake.calls.some((call) => call.method === "POST"),
        false,
      );
      // A killed worker mid-create is treated the same way.
      await db.query(
        "UPDATE amp_lms_assignments SET status='creating' WHERE id=$1",
        [id],
      );
      await pass(fake, at("2026-11-20T19:31:00Z"));
      assert.equal((await row(db, id)).status, "unknown");
      // The teacher checked the LMS and publishes it again.
      fake.state.createStatus = 200;
      await republishLmsAssignment(db, { classId, id });
      await pass(fake, at("2026-11-20T19:32:00Z"));
      assert.equal((await row(db, id)).status, "published");

      // An edit is sent as an update, whole.
      await updateLmsAssignment(db, {
        classId,
        id,
        input: {
          ...practice,
          title: "Practice, two weeks",
          targetMinutes: 120,
          dueOn: "2026-11-30",
        },
        now,
      });
      fake.calls.length = 0;
      const edited = await pass(fake, at("2026-11-20T19:33:00Z"));
      assert.equal(edited.updated, 1);
      const update = fake.calls.find(
        (call) => call.method === "PATCH" && !call.path.includes("submissions"),
      )!;
      assert.equal(update.body.title, "Practice, two weeks");
      assert.equal(update.body.due_date, "2026-12-01T05:59:00.000Z");
      assert.equal("attachments" in update.body, false);
      assert.equal((await row(db, id)).lms_version, 2);

      // Deleted by a teacher in the LMS: AMP notices and stops.
      fake.state.assignmentExists = false;
      await requestLmsSync(db, { classId, id });
      await pass(fake, at("2026-11-20T19:34:00Z"));
      assert.equal((await row(db, id)).status, "missing");
      assert.equal(
        (await readLmsAssignments(db, classId))[0]!.status,
        "missing",
      );

      // Deleted in AMP: deleted in the LMS on the next pass.
      const second = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await pass(fake, at("2026-11-20T19:35:00Z"));
      await deleteLmsAssignment(db, { classId, id: second.id });
      assert.equal((await row(db, second.id)).status, "deleting");
      fake.calls.length = 0;
      assert.equal((await pass(fake, at("2026-11-20T19:36:00Z"))).deleted, 1);
      assert.deepEqual(
        fake.calls
          .filter((call) => call.method === "DELETE")
          .map((call) => call.path),
        [
          `/v3.1/sections/${X}/assignments/${(await row(db, second.id)).clever_assignment_id}`,
        ],
      );
      assert.equal((await row(db, second.id)).status, "deleted");
      assert.equal(
        (await readLmsAssignments(db, classId)).some(
          (view) => view.id === second.id,
        ),
        false,
      );
      // Never published: closed in AMP without a call.
      const third = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await deleteLmsAssignment(db, { classId, id: third.id });
      assert.equal((await row(db, third.id)).status, "deleted");
    }),
);

test(
  "Classroom reclaims work that no longer counts; a term grade sends numeric finals",
  enabled,
  () =>
    fixture(async ({ db, classId, learners, people, pass }) => {
      const now = at("2026-11-20T18:00:00Z");
      const fake = fakeClever("google_classroom");
      await minutes(db, learners[A]!, "2026-11-18", 30);
      const { id } = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await pass(fake, now);
      await pass(fake, now);
      assert.equal(fake.submissions.get(A)!.state, "submitted");
      // The window now starts after A's practice: A's work no longer counts.
      await updateLmsAssignment(db, {
        classId,
        id,
        input: { ...practice, opensOn: "2026-11-19" },
        now,
      });
      fake.calls.length = 0;
      await pass(fake, at("2026-11-20T18:01:00Z"));
      assert.deepEqual(
        fake.calls
          .filter(
            (call) =>
              call.method === "PATCH" && call.path.includes("submissions"),
          )
          .map((call) => call.body),
        [{ state: "reclaimed" }],
      );
      assert.equal((await sent(db, id))[A].points, null);

      // A term grade: the teacher's numeric finals only.
      const term = (
        await db.query("SELECT session_id FROM amp_classes WHERE id=$1", [
          classId,
        ])
      ).rows[0].session_id;
      const termInput = {
        kind: "term_grade",
        title: "Fall grade",
        pointsPossible: 100,
        termId: term,
        dueOn: "2026-12-20",
      };
      const grade = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: termInput,
        personId: null,
        now,
      });
      await assert.rejects(
        createLmsAssignment(db, {
          classId,
          environment: "sandbox",
          input: termInput,
          personId: null,
          now,
        }),
        /lms_term_already_linked/,
      );
      for (const [user, value] of [
        [A, "87"],
        [B, "B+"],
      ] as const)
        await db.query(
          "INSERT INTO amp_term_grades(class_id,session_id,person_id,final_value) VALUES($1,$2,$3,$4)",
          [classId, term, people[user], value],
        );
      fake.submissions.set(A, { state: "created" });
      await pass(fake, now);
      fake.calls.length = 0;
      await pass(fake, now);
      assert.deepEqual(
        fake.calls
          .filter((call) => call.method === "PATCH")
          .map((call) => [call.path.split("/").at(-1), call.body]),
        [
          [A, { state: "submitted", grade_points: 87 }],
          [A, { state: "returned" }],
        ],
      );
      assert.equal(
        fake.state.lastAssignment.description,
        "Fall grade from AMP.",
      );

      // A deleted person's passback record goes with them.
      await db.query("UPDATE amp_people SET deleted_at=now() WHERE id=$1", [
        people[A],
      ]);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_lms_submissions WHERE person_id=$1",
            [people[A]],
          )
        ).rows[0].n,
        0,
      );
      void grade;
    }),
);

test("teacher input is validated before anything is queued", enabled, () =>
  fixture(async ({ db, classId }) => {
    const now = at("2026-11-20T18:00:00Z");
    const create = (input: object) =>
      createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input,
        personId: null,
        now,
      });
    await assert.rejects(
      create({ ...practice, dueOn: "2026-11-19" }),
      /lms_due_before_opens|lms_due_date_past/,
    );
    await assert.rejects(
      create({ ...practice, opensOn: "2026-11-01", dueOn: "2026-11-19" }),
      /lms_due_date_past/,
    );
    await assert.rejects(create({ ...practice, targetMinutes: 0 }));
    await assert.rejects(create({ ...practice, extra: true }));
    await assert.rejects(
      create({
        kind: "term_grade",
        title: "x",
        pointsPossible: 100,
        termId: randomUUID(),
        dueOn: "2026-12-01",
      }),
      /not_found/,
    );
    await assert.rejects(
      createLmsAssignment(db, {
        classId: randomUUID(),
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      }),
      /not_found/,
    );
    assert.equal(
      (await db.query("SELECT count(*)::int AS n FROM amp_lms_assignments"))
        .rows[0].n,
      0,
    );
  }),
);

test(
  "the scheduled command stays off until enabled, and needs API v3.1",
  enabled,
  async () => {
    assert.equal(lmsConnectEnabled({}), false);
    assert.equal(
      lmsConnectEnabled({ AMP_CLEVER_LMS_CONNECT: "enabled" }),
      true,
    );
    assert.throws(() => lmsConnectEnabled({ AMP_CLEVER_LMS_CONNECT: "yes" }));
    assert.throws(
      () =>
        lmsConnectEnabled({
          AMP_CLEVER_LMS_CONNECT: "enabled",
          AMP_CLEVER_API_VERSION: "3.0",
        }),
      /3\.1/,
    );
    await fixture(async ({ db, classId }) => {
      const fake = fakeClever("canvas");
      const now = at("2026-11-20T18:00:00Z");
      await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      const results = await runLmsPasses(
        db,
        {
          AMP_CLEVER_ENVIRONMENT: "sandbox",
          AMP_CLEVER_CLIENT_ID: "client",
          AMP_CLEVER_CLIENT_SECRET: "secret",
          AMP_ACCOUNTS_URL: ORIGIN,
        },
        null,
        { fetch: fake.fetcher, now: () => now },
      );
      assert.equal(results.length, 1);
      assert.equal((results[0] as { created: number }).created, 1);
      assert.equal(JSON.stringify(results).includes("district-token"), false);
    });
  },
);

test(
  "backed-off, waiting and not-ready work stays quiet minute after minute",
  enabled,
  () =>
    fixture(async ({ db, classId, learners, connectionId, pass }) => {
      const now = at("2026-11-20T18:00:00Z");
      const minute = (base: Date, n: number) =>
        new Date(base.getTime() + n * 60_000);
      await minutes(db, learners[A]!, "2026-11-19", 30);

      // A district that never finishes matching: one read, then a 15-minute wait.
      const fake = fakeClever("schoology");
      fake.state.district.lms_state = "matching_in_progress";
      const { id } = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await pass(fake, now);
      fake.calls.length = 0;
      assert.equal((await pass(fake, minute(now, 1))).skipped, "backoff");
      assert.equal((await pass(fake, minute(now, 14))).skipped, "backoff");
      assert.equal(fake.calls.length, 0);

      // A student who can't be graded: after the due date, no assignment
      // calls until their own retry is due.
      fake.state.district.lms_state = "success";
      fake.state.failUser = {
        user: A,
        status: 500,
        message: "Error updating submission",
      };
      await requestLmsSync(db, { classId, id });
      await pass(fake, minute(now, 15));
      await pass(fake, minute(now, 16));
      assert.equal(
        (await sent(db, id))[A].failure_code,
        "lms_submission_update_failed",
      );
      const due = at("2026-11-24T07:00:00Z");
      await pass(fake, due);
      assert.equal((await row(db, id)).finalized_at, null);
      fake.calls.length = 0;
      for (const n of [1, 2, 60, 300]) await pass(fake, minute(due, n));
      assert.ok(fake.calls.length > 0);
      assert.ok(
        fake.calls.every((call) => call.path === `/v3.1/districts/${D}`),
        "only the hourly district check, never the assignment",
      );
      // Six hours later the student's retry is due, and succeeds.
      fake.state.failUser = null;
      await pass(fake, minute(due, 6 * 60 + 1));
      assert.ok((await row(db, id)).finalized_at);

      // A refused token after a teacher's "Send now": one attempt, then backoff.
      const refused = fakeClever("canvas");
      refused.state.district.status = 401;
      await db.query(
        "UPDATE amp_clever_lms SET checked_at=NULL WHERE connection_id=$1",
        [connectionId],
      );
      const second = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await requestLmsSync(db, { classId, id: second.id });
      const later = at("2026-11-21T12:00:00Z");
      assert.deepEqual((await pass(refused, later)).failures, {
        lms_unauthorized: 1,
      });
      refused.calls.length = 0;
      assert.equal(
        (await pass(refused, minute(later, 0.5))).skipped,
        "backoff",
      );
      assert.equal(refused.calls.length, 0);
      // The district answers but the write is refused: the wait still grows.
      refused.state.district.status = 200;
      refused.state.createStatus = 403;
      const failure = async () =>
        (
          await db.query(
            "SELECT failure_code,failure_count FROM amp_clever_lms WHERE connection_id=$1",
            [connectionId],
          )
        ).rows[0];
      assert.deepEqual((await pass(refused, minute(later, 2))).failures, {
        lms_forbidden: 1,
      });
      assert.deepEqual(await failure(), {
        failure_code: "lms_forbidden",
        failure_count: 1,
      });
      assert.deepEqual((await pass(refused, minute(later, 3.5))).failures, {
        lms_forbidden: 1,
      });
      assert.deepEqual(await failure(), {
        failure_code: "lms_forbidden",
        failure_count: 2,
      });
      assert.equal(
        (await pass(refused, minute(later, 4.5))).skipped,
        "backoff",
      );
    }),
);

test(
  "a delete that lands during a create still deletes, and an unshared delete makes no call",
  enabled,
  () =>
    fixture(async ({ db, classId, connectionId, pass }) => {
      const now = at("2026-11-20T18:00:00Z");
      const fake = fakeClever("google_classroom");
      const { id } = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      // While the create is in flight, the row is busy for the teacher…
      const original = fake.fetcher;
      let teacher: Promise<unknown> | null = null;
      const racing = (async (input: URL, init: RequestInit = {}) => {
        if ((init.method ?? "GET") === "POST" && !teacher) {
          teacher = deleteLmsAssignment(db, { classId, id }).catch(
            (error) => error,
          );
          // …and a write that slipped past the guard is still honoured.
          await db.query(
            "UPDATE amp_lms_assignments SET status='deleted' WHERE id=$1",
            [id],
          );
        }
        return original(input, init);
      }) as typeof fetch;
      await runLms(db, connectionId, racing, now);
      assert.match(String(await teacher), /lms_assignment_busy/);
      const stored = await row(db, id);
      assert.equal(stored.status, "deleting");
      assert.ok(stored.clever_assignment_id);
      fake.calls.length = 0;
      await pass(fake, at("2026-11-20T18:01:00Z"));
      assert.equal(
        fake.calls.filter((call) => call.method === "DELETE").length,
        1,
      );
      assert.equal((await row(db, id)).status, "deleted");

      // An unshared section: deleted in AMP without calling Clever.
      const second = await createLmsAssignment(db, {
        classId,
        environment: "sandbox",
        input: practice,
        personId: null,
        now,
      });
      await pass(fake, at("2026-11-20T18:02:00Z"));
      await deleteLmsAssignment(db, { classId, id: second.id });
      await db.query(
        "UPDATE amp_clever_bindings SET archived_at=now() WHERE connection_id=$1 AND kind='section'",
        [connectionId],
      );
      fake.calls.length = 0;
      await pass(fake, at("2026-11-20T18:03:00Z"));
      assert.equal(
        fake.calls.some((call) => call.method === "DELETE"),
        false,
      );
      const gone = await row(db, second.id);
      assert.equal(gone.status, "deleted");
      assert.equal(gone.failure_code, "lms_section_unshared");
    }),
);

/** A pass with a custom fetch, for tests that interpose on one request. */
function runLms(
  db: Pool,
  connectionId: string,
  fetcher: typeof fetch,
  now: Date,
) {
  return runLmsConnection(db, connectionId, {
    clever: { districtToken: async () => "district-token" },
    lms: () => new LmsClient({ fetch: fetcher, sleep: async () => {} }),
    origin: ORIGIN,
    now: () => now,
  });
}
