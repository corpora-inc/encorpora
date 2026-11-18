import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { schoolAdmin } from "../scripts/school-admin.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { workbookProblems } from "../src/workbook/compose.js";

/* Two doses a study counts (migration 0145): a video's playback, and an
   adult checking in on a learner, recorded by role and nothing more. Every
   name is made up. */
test(
  "learning doses: video playback, adult check-ins and who changed practice",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `amp_doses_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const schools = new SchoolRepository(db);
    const accounts = new Set<string>();
    const authenticate = async (request: {
      headers: { authorization?: string };
    }) => {
      const signedIn = request.headers.authorization?.replace(/^Bearer /, "");
      if (!signedIn || !accounts.has(signedIn))
        throw new ApiError(401, "Sign in to continue");
      return signedIn;
    };
    const app = buildApp({ repository: learning, authenticate });
    const secret = randomBytes(32).toString("hex");
    const renderer = { render: async () => Buffer.from("%PDF-1.7 fixture") };
    await registerFamilyRoutes(app, {
      pool: db,
      authenticate,
      renderer,
      approvals: { secret, origin: "https://amp.example" },
    });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: {
        secret,
        origin: "https://amp.example",
        learning,
        renderer,
      },
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const as = (account: string) => ({ authorization: `Bearer ${account}` });
    const get = (path: string, account: string) =>
      app.inject({ url: path, headers: as(account) });
    const post = (path: string, account: string, payload: object = {}) =>
      app.inject({ method: "POST", url: path, headers: as(account), payload });
    const signUp = async () => {
      const id = randomUUID();
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
         VALUES($1,'Fixture Adult',$2,true,now(),now())`,
        [id, `${id}@doses.example`],
      );
      accounts.add(`amp|${id}`);
      return `amp|${id}`;
    };
    const checkins = async (learnerId: string) =>
      (
        await db.query(
          'SELECT role::text,kind::text FROM amp_adult_checkins WHERE learner_id=$1 ORDER BY "at",role,kind',
          [learnerId],
        )
      ).rows.map((r) => `${r.role}:${r.kind}`);

    // A parent with one child, in the family's class from the start.
    const parent = await signUp();
    await db.query(
      "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','fixture')",
      [parent],
    );
    const created = await post("/api/v1/learners", parent, {
      birthYear: new Date().getUTCFullYear() - 9,
    });
    assert.equal(created.statusCode, 201, created.body);
    const child = created.json().id as string;
    const { org_id: family, class_id: familyClass } = (
      await db.query(
        "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
        [parent],
      )
    ).rows[0];
    const { id: childPerson } = (
      await db.query("SELECT id FROM amp_people WHERE learner_id=$1", [child])
    ).rows[0];

    await t.test(
      "a video's play and its end ride on the heartbeat",
      async () => {
        const beat = await post(`/api/v1/learners/${child}/activity`, parent, {
          deltas: [{ surface: "video", activeMs: 20_000 }],
          events: [
            {
              kind: "video",
              source: "lessons",
              ref: "add-within-20",
              ageMs: 0,
            },
            {
              kind: "video_play",
              source: "lessons",
              ref: "add-within-20",
              ageMs: 0,
            },
            {
              kind: "video_complete",
              source: "lessons",
              ref: "add-within-20",
              ageMs: 0,
            },
          ],
        });
        assert.equal(beat.statusCode, 204, beat.body);
        const days = (
          await db.query(
            "SELECT kind::text,sum(opened)::int AS n FROM amp_help_days WHERE learner_id=$1 GROUP BY 1 ORDER BY 1",
            [child],
          )
        ).rows;
        assert.deepEqual(days, [
          { kind: "video", n: 1 },
          { kind: "video_complete", n: 1 },
          { kind: "video_play", n: 1 },
        ]);
        const [week] = (
          await db.query(
            "SELECT videos,video_plays,video_completes,video_ms::int FROM amp_learner_weeks WHERE learner_id=$1",
            [child],
          )
        ).rows;
        assert.deepEqual(week, {
          videos: 1,
          video_plays: 1,
          video_completes: 1,
          video_ms: 20_000,
        });
      },
    );

    await t.test(
      "a parent reading, assigning and scoring checks in",
      async () => {
        assert.deepEqual(await checkins(child), []);
        const read = await get(
          `/api/v1/families/${family}/children/${child}/progress`,
          parent,
        );
        assert.equal(read.statusCode, 200, read.body);
        const time = await get(
          `/api/v1/families/${family}/children/${child}/time`,
          parent,
        );
        assert.equal(time.statusCode, 200, time.body);
        const base = `/api/v1/learners/${child}`;
        const date = new Date().toISOString().slice(0, 10);
        const made = await post(`${base}/workbooks`, parent, {
          date,
          number: 1,
          paper: "letter",
          minutes: 30,
        });
        assert.equal(made.statusCode, 201, made.body);
        // Opening the same workbook again assigns nothing new.
        const again = await post(`${base}/workbooks`, parent, {
          date,
          number: 1,
          paper: "letter",
          minutes: 30,
        });
        assert.equal(again.statusCode, 200, again.body);
        const workbookId = made.json().id as string;
        const view = await get(
          `${base}/workbooks/${workbookId}/results`,
          parent,
        );
        assert.equal(view.statusCode, 200, view.body);
        const row = view.json().rows[0];
        const spec = (
          await db.query("SELECT spec FROM amp_workbooks WHERE id=$1", [
            workbookId,
          ])
        ).rows[0].spec;
        const entry =
          row.entry === "number"
            ? { n: row.n, answer: workbookProblems(spec)[row.n - 1]!.answer }
            : { n: row.n, mark: "right" };
        const scored = await post(
          `${base}/workbooks/${workbookId}/results`,
          parent,
          { entries: [entry] },
        );
        assert.equal(scored.statusCode, 200, scored.body);
        // The record and its time, read together, are one look.
        assert.deepEqual(await checkins(child), [
          "parent:view",
          "parent:assign",
          "parent:score",
        ]);
        // As the family's teacher, through the class: still a parent, and
        // within the half hour still the same look.
        const record = await get(
          `/api/v1/school/students/${childPerson}/record`,
          parent,
        );
        assert.equal(record.statusCode, 200, record.body);
        assert.equal((await checkins(child)).length, 3);
        // A look after the half hour is another.
        await db.query(
          `UPDATE amp_adult_checkins SET "at"="at"-interval '31 minutes' WHERE learner_id=$1`,
          [child],
        );
        const later = await get(
          `/api/v1/school/students/${childPerson}/record`,
          parent,
        );
        assert.equal(later.statusCode, 200, later.body);
        assert.deepEqual((await checkins(child)).slice(-1), ["parent:view"]);
        assert.equal((await checkins(child)).length, 4);
        // A row says role, kind, learner and time, and nothing more.
        const columns = (
          await db.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='amp_adult_checkins' ORDER BY ordinal_position",
          )
        ).rows.map((r) => r.column_name);
        assert.deepEqual(columns, ["learner_id", "at", "role", "kind"]);
      },
    );

    await t.test(
      "a teacher, a school's staff and a parent link check in",
      async () => {
        const org = (await schoolAdmin(schools, "create-org", {
          kind: "school",
          name: "Fixture Dose School",
          timezone: "America/New_York",
          agreement: {
            version: "fixture-1",
            signerName: "Fixture Signer",
            signerTitle: "Head of School",
          },
        })) as { id: string };
        await schoolAdmin(schools, "issue-license", {
          orgId: org.id,
          seats: 5,
          endsAt: new Date(Date.now() + 200 * 86_400_000).toISOString(),
        });
        const klass = (await schools.createClass(org.id, {
          name: "Period 3",
        })) as { id: string };
        const student = await schools.provisionStudent(org.id, {
          givenName: "Fixture",
          gradeLevel: 4,
          classId: klass.id,
        });
        const teacher = await signUp();
        await schools.addStaff({
          orgId: org.id,
          role: "teacher",
          givenName: "Fixture",
          accountId: teacher,
          classId: klass.id,
        });
        const head = await signUp();
        await schools.addStaff({
          orgId: org.id,
          role: "admin",
          givenName: "Fixture",
          accountId: head,
        });
        const path = `/api/v1/school/students/${student.personId}/record`;
        assert.equal((await get(path, teacher)).statusCode, 200);
        assert.equal((await get(path, head)).statusCode, 200);
        const link = await post(
          `/api/v1/school/students/${student.personId}/share`,
          teacher,
        );
        assert.equal(link.statusCode, 200, link.body);
        const viewed = await app.inject({
          method: "POST",
          url: "/api/v1/school/share/view",
          payload: { token: (link.json().link.url as string).split("#")[1] },
        });
        assert.equal(viewed.statusCode, 200, viewed.body);
        // Marking a student's paper in class is scoring it.
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/New_York",
        }).format(new Date());
        const base = `/api/v1/school/classes/${klass.id}/students/${student.personId}/workbooks`;
        const made = await post(base, teacher, {
          date,
          minutes: 30,
          paper: "letter",
          number: 1,
        });
        assert.equal(made.statusCode, 201, made.body);
        const marks = await post(`${base}/${made.json().id}/marks`, teacher, {
          entries: [{ n: 1, mark: "right" }],
        });
        assert.equal(marks.statusCode, 200, marks.body);
        assert.deepEqual(await checkins(student.learnerId), [
          "teacher:view",
          "school_staff:view",
          "parent:view",
          "teacher:assign",
          "teacher:score",
        ]);
      },
    );

    await t.test("an adult's own practice is never a check-in", async () => {
      const started = await post("/api/v1/me/practice", parent, {
        start: "algebra-1",
        timezone: "America/Chicago",
      });
      assert.equal(started.statusCode, 201, started.body);
      const own = started.json().learnerId as string;
      const made = await post(`/api/v1/learners/${own}/workbooks`, parent, {
        date: new Date().toISOString().slice(0, 10),
        number: 1,
        paper: "letter",
        minutes: 30,
      });
      assert.equal(made.statusCode, 201, made.body);
      assert.deepEqual(await checkins(own), []);
    });

    await t.test("a practice change says whose sign-in made it", async () => {
      const path = `/api/v1/learners/${child}/practice-state`;
      const state = await get(path, parent);
      assert.equal(state.statusCode, 200, state.body);
      const changed = await post(path, parent, {
        requestId: randomUUID(),
        revision: state.json().revision,
        kind: "gradeLevel",
        shown: false,
      });
      assert.equal(changed.statusCode, 200, changed.body);
      const sources = (
        await db.query(
          "SELECT made_in FROM amp_practice_changes WHERE learner_id=$1",
          [child],
        )
      ).rows.map((r) => r.made_in);
      assert.deepEqual(sources, ["account"]);
    });

    await t.test(
      "check-ins travel with the family's export and go with the learner",
      async () => {
        const lines: { type: string; value?: unknown }[] = [];
        const { FamilyRepository } =
          await import("../src/family/repository.js");
        const families = new FamilyRepository(db);
        for await (const line of families.export(parent))
          lines.push(JSON.parse(line));
        assert.equal(
          lines.filter((l) => l.type === "adult-checkin").length,
          (await checkins(child)).length,
        );
        await families.deleteLearning(parent, child);
        assert.deepEqual(await checkins(child), []);
      },
    );
  },
);
