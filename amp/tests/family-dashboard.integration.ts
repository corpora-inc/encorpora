import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { practiceCatalog } from "../src/family/dashboard.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { templates } from "../src/math/engine.js";
import { formatJoinCode } from "../src/schools/contracts.js";
import { classPracticeGate } from "../src/schools/pilot-access.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { weekStart } from "../src/schools/today.js";
import { buildApp } from "../src/server/app.js";
import { refuseStudentTokens } from "../src/server/auth.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { schoolDay } from "./helpers/school-day.js";

test(
  "family dashboard: parents only, own children only, a fixed query count, the mix and the checks from stored evidence",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_dashboard_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    await migrate(scoped.href);
    const learning = new PostgresRepository(scoped.href);
    const db = learning.pool;
    const authenticate = refuseStudentTokens(async (request) => {
      const header = request.headers.authorization;
      if (header?.startsWith("Bearer amp|")) return header.slice(7);
      throw new ApiError(401, "Sign in");
    });
    const keys = {
      secret: "fixture-secret-for-dashboard-tests-only",
      origin: "https://amp.example.test",
    };
    const renderer = { render: async () => Buffer.from("%PDF-fixture") };
    const app = buildApp({ repository: learning, authenticate });
    await registerFamilyRoutes(app, {
      pool: db,
      authenticate,
      approvals: keys,
      renderer,
    });
    await registerSchoolRoutes(app, {
      pool: db,
      authenticate,
      services: { ...keys, learning, renderer },
    });
    await app.ready();
    t.after(async () => {
      await app.close();
      await learning.close();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    const get = (path: string, account: string) =>
      app.inject({
        method: "GET",
        url: path,
        headers: { authorization: `Bearer ${account}` },
      });
    const post = (path: string, account: string, payload: object = {}) =>
      app.inject({
        method: "POST",
        url: path,
        headers: { authorization: `Bearer ${account}` },
        payload,
      });
    const ok = async (pending: ReturnType<typeof get>, status = 200) => {
      const response = await pending;
      assert.equal(response.statusCode, status, response.body);
      return response.json();
    };
    const user = async (name: string) => {
      const id = randomUUID();
      const email = `${id}@example.test`;
      await db.query(
        `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,now(),now())`,
        [id, name, email],
      );
      return { account: `amp|${id}`, email };
    };
    const consent = (account: string) =>
      db.query(
        "INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference) VALUES($1,'fixture','verified','fixture')",
        [account],
      );
    const fragment = (link: string) => ({
      token: new URL(link).hash.slice(1).split(".")[0],
    });

    const parent = await user("Holder");
    const other = await user("Other Holder");
    const co = await user("Co Teacher");
    const outsider = await user("Outsider");
    for (const person of [parent, other]) await consent(person.account);
    const first = await ok(
      post("/api/v1/learners", parent.account, {
        name: "First Child",
        birthYear: 2016,
      }),
      201,
    );
    const elsewhere = await ok(
      post("/api/v1/learners", other.account, {
        name: "Other Child",
        birthYear: 2016,
      }),
      201,
    );
    const home = (
      await db.query(
        "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
        [parent.account],
      )
    ).rows[0] as { org_id: string; class_id: string };
    const otherHome = (
      await db.query("SELECT org_id FROM amp_families WHERE account_id=$1", [
        other.account,
      ])
    ).rows[0] as { org_id: string };
    // A child the family hosts in its class but does not own.
    const hosted = await ok(
      post("/api/v1/family/class/students", parent.account, {
        nickname: "Hosted",
        birthYear: 2017,
      }),
      201,
    );
    // A co-teacher of the family's class.
    await ok(
      post(`/api/v1/school/orgs/${home.org_id}/staff/invites`, parent.account, {
        email: co.email,
        role: "teacher",
        classIds: [home.class_id],
      }),
      201,
    );
    const staff = await ok(
      get(`/api/v1/school/orgs/${home.org_id}/staff`, parent.account),
    );
    const invitation = (Array.isArray(staff) ? staff : staff.staff).find(
      (row: { email: string }) => row.email === co.email,
    );
    await ok(
      post(
        "/api/v1/school/invites/accept",
        co.account,
        fragment(invitation.inviteUrl),
      ),
    );

    // The first child's evidence. Grades 3 and 4 sit just below the number
    // level (4.6 rounds to 5); every other area falls back to the overall
    // 5.2, also grades 3 and 4.
    const below = practiceCatalog.filter(
      (skill) => skill.area === "number" && skill.grade === 4,
    );
    const [strong, earned, tried] = below;
    assert.ok(tried, "the catalog has three grade 4 number skills");
    const above = practiceCatalog.filter((skill) => skill.grade >= 6);
    const [p, q, r, s] = above;
    assert.ok(s, "the catalog has skills above grade 5");
    const templateOf = (skillId: string) =>
      templates.find((template) => template.skillId === skillId)!.id;
    const start = Date.now() - 60 * 60_000;
    let tick = 0;
    const answer = async (
      learnerId: string,
      skillId: string,
      correct: boolean,
      selection: object | null,
    ) => {
      const id = randomUUID();
      const at = new Date(start + tick++ * 1000).toISOString();
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
        [
          id,
          learnerId,
          {
            public: { id, skillId, templateId: templateOf(skillId) },
            ...(selection ? { selection } : {}),
          },
        ],
      );
      await db.query(
        "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$1,$1,$3)",
        [
          id,
          learnerId,
          {
            id,
            problemId: id,
            requestId: id,
            skillId,
            templateId: templateOf(skillId),
            correct,
            assisted: false,
            createdAt: at,
          },
        ],
      );
    };
    // Strong: five right without help. Earned: one miss, one right. Tried:
    // one miss. None carries a reason; all fall outside the last twenty.
    for (let i = 0; i < 5; i++) await answer(first.id, strong!.id, true, null);
    await answer(first.id, earned!.id, false, null);
    await answer(first.id, earned!.id, true, null);
    await answer(first.id, tried!.id, false, null);
    // Five older "explore" answers, then the last twenty in a known mix.
    const why = (reason: string, extra: object = {}) => ({
      reason,
      strand: "number",
      trace: { mode: "adaptive", ...extra },
      focusSkillId: null,
    });
    for (let i = 0; i < 5; i++)
      await answer(first.id, s!.id, true, why("explore"));
    const lastTwenty: [string, object][] = [
      ...Array.from({ length: 4 }, (): [string, object] => [
        p!.id,
        why("prerequisite"),
      ]),
      ...Array.from({ length: 2 }, (): [string, object] => [
        q!.id,
        why("revisit"),
      ]),
      ...Array.from({ length: 3 }, (): [string, object] => [
        r!.id,
        why("review"),
      ]),
      ...Array.from({ length: 3 }, (): [string, object] => [
        r!.id,
        why("frontier", { purpose: "foundation" }),
      ]),
      ...Array.from({ length: 5 }, (): [string, object] => [
        p!.id,
        why("frontier", { purpose: "working" }),
      ]),
      ...Array.from({ length: 2 }, (): [string, object] => [
        q!.id,
        why("explore"),
      ]),
      [s!.id, { reason: "focus", strand: "number" }],
    ];
    for (const [skillId, selection] of lastTwenty)
      await answer(first.id, skillId, true, selection);
    await db.query(
      "INSERT INTO amp_active_days(learner_id,day,surface,active_ms) VALUES($1,$2,'practice',$3)",
      [first.id, schoolDay(), 12.5 * 60_000],
    );
    await db.query(
      "INSERT INTO amp_level_days(learner_id,day,frontier,policy_version) VALUES($1,$2,$3,'fixture')",
      [
        first.id,
        schoolDay(),
        {
          overall: {
            level: 5.2,
            sd: 0.4,
            answered: 33,
            independent: 31,
            low: 4.7,
            high: 5.8,
          },
          strands: {
            number: {
              level: 4.6,
              sd: 0.5,
              answered: 20,
              independent: 18,
              low: 4,
              high: 5.2,
            },
          },
        },
      ],
    );
    await db.query(
      "INSERT INTO amp_practice_settings(learner_id,state) VALUES($1,$2)",
      [first.id, { gradeLevelShown: false }],
    );

    const dashboard = (family: string, account: string) =>
      get(`/api/v1/families/${family}/dashboard`, account);

    await t.test(
      "a co-teacher is refused; an unrelated account finds nothing",
      async () => {
        const coRead = await dashboard(home.org_id, co.account);
        assert.equal(coRead.statusCode, 403, coRead.body);
        assert.deepEqual(coRead.json(), { error: "family_parent_only" });
        for (const account of [outsider.account, other.account]) {
          const read = await dashboard(home.org_id, account);
          assert.equal(read.statusCode, 404, read.body);
          assert.deepEqual(read.json(), { error: "family_not_found" });
        }
        assert.equal(
          (await get(`/api/v1/families/${home.org_id}/dashboard`, ""))
            .statusCode,
          401,
        );
      },
    );

    await t.test(
      "own children only, never a hosted or another family's child",
      async () => {
        const body = await ok(dashboard(home.org_id, parent.account));
        assert.deepEqual(
          body.children.map((child: { id: string }) => child.id),
          [first.id],
        );
        const text = JSON.stringify(body);
        assert.ok(!text.includes(hosted.learnerId));
        assert.ok(!text.includes(elsewhere.id));
        const theirs = await ok(dashboard(otherHome.org_id, other.account));
        assert.deepEqual(
          theirs.children.map((child: { id: string }) => child.id),
          [elsewhere.id],
        );
      },
    );

    await t.test("the week, its days, levels and the switch", async () => {
      const body = await ok(dashboard(home.org_id, parent.account));
      const today = schoolDay();
      assert.equal(body.today, today);
      assert.deepEqual(body.week, { from: weekStart(today), to: today });
      const child = body.children[0];
      assert.equal(child.gradeLevelShown, false);
      // 8 evidence answers (6 right) and 25 right since.
      assert.deepEqual(child.week, {
        days: 1,
        minutes: 12.5,
        problems: 33,
        correct: 31,
        independent: 31,
        lastPracticed: today,
      });
      assert.equal(
        child.daily.length,
        (Date.parse(today) - Date.parse(weekStart(today))) / 86_400_000 + 1,
      );
      assert.equal(child.daily.at(-1).day, today);
      assert.deepEqual(child.daily.at(-1), {
        day: today,
        minutes: 12.5,
        problems: 33,
      });
      for (const day of child.daily.slice(0, -1))
        assert.deepEqual([day.minutes, day.problems], [0, 0]);
      assert.deepEqual(child.level, {
        level: 5.2,
        low: 4.7,
        high: 5.8,
        answered: 33,
      });
      assert.deepEqual(
        child.areas.map((row: { area: string }) => row.area),
        ["number", "algebra", "geometry", "measurement", "data"],
      );
      assert.deepEqual(child.areas[0].level, {
        level: 4.6,
        low: 4,
        high: 5.2,
        answered: 20,
      });
      for (const row of child.areas.slice(1)) assert.equal(row.level, null);
      // A child with no answers: no level, no checks, an empty mix.
      const theirs = (await ok(dashboard(otherHome.org_id, other.account)))
        .children[0];
      assert.equal(theirs.gradeLevelShown, true);
      assert.equal(theirs.level, null);
      assert.ok(
        theirs.areas.every((row: { checked: unknown }) => row.checked === null),
      );
      assert.deepEqual(theirs.focus, { answered: 0, mix: [] });
      assert.equal(theirs.week.problems, 0);
      assert.equal(theirs.week.lastPracticed, null);
    });

    await t.test(
      "stored reasons give the mix; stored evidence gives the buckets",
      async () => {
        const child = (await ok(dashboard(home.org_id, parent.account)))
          .children[0];
        const ref = (skill: { id: string; title: string }) => ({
          id: skill.id,
          title: skill.title,
        });
        assert.deepEqual(child.focus, {
          answered: 20,
          mix: [
            { key: "catching-up", count: 6, skills: [ref(p!), ref(q!)] },
            { key: "reviewing", count: 3, skills: [ref(r!)] },
            { key: "checking-earlier", count: 3, skills: [ref(r!)] },
            // Five frontier answers on p, two explore on q; the older five
            // explore answers are outside the window.
            { key: "new-ground", count: 7, skills: [ref(p!), ref(q!)] },
            { key: "chosen", count: 1, skills: [ref(s!)] },
          ],
        });
        const number = child.areas[0].checked;
        const window = practiceCatalog.filter(
          (skill) =>
            skill.area === "number" && skill.grade >= 3 && skill.grade <= 4,
        );
        assert.equal(number.from, 3);
        assert.equal(number.to, 4);
        assert.equal(number.skills, window.length);
        assert.equal(number.strong, 1);
        assert.equal(number.earned, 1);
        assert.equal(number.tried, 1);
        assert.equal(number.notAsked, window.length - 3);
        const asked = new Set([strong!.id, earned!.id, tried!.id]);
        const nearest = number.nearestNotAsked.map(
          (skill: { id: string }) => skill.id,
        );
        assert.ok(nearest.length > 0 && nearest.length <= 10);
        assert.ok(nearest.every((id: string) => !asked.has(id)));
        // Nearest the level first: grade 4 before grade 3.
        const gradeOf = new Map(
          practiceCatalog.map((skill) => [skill.id, skill.grade]),
        );
        const grades = nearest.map((id: string) => gradeOf.get(id));
        assert.deepEqual(
          grades,
          [...grades].sort((a, b) => b! - a!),
        );
        assert.equal(grades[0], 4);
        // Titles come with the ids.
        for (const skill of number.nearestNotAsked)
          assert.equal(
            skill.title,
            practiceCatalog.find((c) => c.id === skill.id)!.title,
          );
        // Areas without a level of their own check below the overall level.
        const geometry = child.areas[2].checked;
        assert.deepEqual([geometry.from, geometry.to], [3, 4]);
        assert.equal(geometry.notAsked, geometry.skills);
      },
    );

    await t.test(
      "the code reaches a reader who may manage devices",
      async () => {
        const body = await ok(dashboard(home.org_id, parent.account));
        const code = (
          await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [
            home.class_id,
          ])
        ).rows[0].join_code as string;
        // A family's own class is open: its code shows.
        assert.equal(await classPracticeGate(db, home.class_id), null);
        assert.deepEqual(body.join, {
          code: formatJoinCode(code),
          path: `/join/${formatJoinCode(code)}`,
        });
        // A family with no class of its own has no code to give.
        const bare = await user("No Class Yet");
        await consent(bare.account);
        await db.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,'Legacy child')",
          [randomUUID(), bare.account],
        );
        const families = (await ok(get("/api/v1/families", bare.account)))
          .families;
        const legacy = await ok(dashboard(families[0].familyId, bare.account));
        assert.equal(legacy.join, null);
        assert.equal(legacy.children.length, 1);
      },
    );

    await t.test(
      "the query count is the same for one child and four",
      async () => {
        const measure = async () => {
          let count = 0;
          const original = db.query;
          (db as unknown as { query: unknown }).query = function (
            this: Pool,
            ...args: unknown[]
          ) {
            count++;
            return (original as (...a: unknown[]) => unknown).apply(this, args);
          };
          try {
            await ok(dashboard(home.org_id, parent.account));
          } finally {
            db.query = original;
          }
          return count;
        };
        const one = await measure();
        for (let i = 0; i < 3; i++) {
          const child = await ok(
            post("/api/v1/learners", parent.account, {
              name: `Count ${i}`,
              birthYear: 2015,
            }),
            201,
          );
          await answer(child.id, p!.id, true, why("frontier"));
        }
        const four = await measure();
        const body = await ok(dashboard(home.org_id, parent.account));
        assert.equal(body.children.length, 4);
        assert.equal(four, one, `one child: ${one} queries, four: ${four}`);
        console.log("dashboard queries", { one, four });
        assert.ok(one <= 14, `${one} queries`);
      },
    );
  },
);
