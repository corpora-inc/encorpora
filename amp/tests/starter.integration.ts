import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import {
  createApproval,
  mailedApprovalUrl,
  openApproval,
} from "../src/family/approvals.js";

const fixtureSecret = randomBytes(32).toString("hex");

/* "What brings you to AMP?" (POST /api/v1/start): each answer makes the place
   it needs, once, and says where it opens. Every name here is made up. */
const database = { skip: !process.env.AMP_TEST_DATABASE_URL };
const year = new Date().getUTCFullYear();
const HOME = /^school\/([0-9a-f-]{36})\/classes\/([0-9a-f-]{36})\/today$/;

async function fixture(t: TestContext) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_starter_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  const repository = new PostgresRepository(scoped.href);
  const db = repository.pool;
  const accounts = new Set<string>();
  const authenticate = async (request: {
    headers: { authorization?: string };
  }) => {
    const signedIn = request.headers.authorization?.replace(/^Bearer /, "");
    if (!signedIn || !accounts.has(signedIn))
      throw new ApiError(401, "Sign in to continue");
    return signedIn;
  };
  const app = buildApp({ repository, authenticate });
  await registerFamilyRoutes(app, { pool: db, authenticate });
  await registerSchoolRoutes(app, {
    pool: db,
    authenticate,
    services: {
      secret: fixtureSecret,
      origin: "https://amp.example",
      learning: repository,
      renderer: { render: async () => Buffer.from("%PDF-1.7 fixture") },
    },
  });
  await app.ready();
  t.after(async () => {
    await app.close();
    await repository.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const user = async (name: string) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,$2,$3,true,now(),now())`,
      [id, name, `${id}@starter.example`],
    );
    accounts.add(`amp|${id}`);
    return `amp|${id}`;
  };
  const as = (account: string) => ({ authorization: `Bearer ${account}` });
  const start = (account: string, payload: object) =>
    app.inject({
      method: "POST",
      url: "/api/v1/start",
      payload,
      headers: as(account),
    });
  const started = async (account: string, payload: object) => {
    const response = await start(account, payload);
    assert.equal(response.statusCode, 200, response.body);
    return response.json() as { home: string; learnerId?: string };
  };
  const me = async (account: string) => {
    const response = await app.inject({
      url: "/api/v1/me",
      headers: as(account),
    });
    assert.equal(response.statusCode, 200, response.body);
    return response.json();
  };
  const get = (url: string, account: string) =>
    app.inject({ url, headers: as(account) });
  /** The names a class's sign-in list shows, by its join code. */
  const signInList = async (classId: string) => {
    const { join_code } = (
      await db.query("SELECT join_code FROM amp_classes WHERE id=$1", [classId])
    ).rows[0];
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/school/join/lookup",
      payload: { code: join_code },
    });
    assert.equal(response.statusCode, 200, response.body);
    return response
      .json()
      .students.map((s: { name: string }) => s.name)
      .sort() as string[];
  };
  const count = async (sql: string, params: unknown[]) =>
    (await db.query(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0]
      .n as number;
  /** The live students of a class, with their learners. */
  const studentsOf = async (classId: string) =>
    (
      await db.query(
        `SELECT p.id AS person_id,l.id,l.account_id,l.name,l.birth_year,l.name_pending,l.label_number,l.name_basis
         FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id JOIN amp_learners l ON l.id=p.learner_id
         WHERE e.class_id=$1 AND e.role='student' AND e.end_on IS NULL AND l.deleted_at IS NULL
         ORDER BY l.name`,
        [classId],
      )
    ).rows;
  accounts.add("school:" + randomUUID());
  accounts.add("trial:" + randomUUID());
  return {
    app,
    db,
    repository,
    accounts,
    user,
    start,
    started,
    me,
    get,
    signInList,
    count,
    studentsOf,
  };
}

test(
  "a parent's two children, named or not, get the family class, once",
  database,
  async (t) => {
    const f = await fixture(t);
    const parent = await f.user("Casey Fixture");
    assert.equal((await f.me(parent)).next, "start");

    const body = {
      as: "parent",
      children: [{ birthYear: year - 9, name: "Sam" }, { birthYear: year - 7 }],
    };
    const first = await f.started(parent, body);
    const [, orgId, classId] = first.home.match(HOME) ?? [];
    assert.ok(orgId && classId, first.home);

    const learners = (
      await f.db.query(
        "SELECT id,name,birth_year,name_pending,label_number,name_basis,adult FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL ORDER BY created_at",
        [parent],
      )
    ).rows;
    assert.deepEqual(
      learners.map(({ id: _, ...l }) => l),
      [
        // The parent's name, with its basis; blank goes by the number.
        {
          name: "Sam",
          birth_year: year - 9,
          name_pending: true,
          label_number: 1,
          name_basis: "parent_entry",
          adult: false,
        },
        {
          name: "Child 2",
          birth_year: year - 7,
          name_pending: true,
          label_number: 2,
          name_basis: null,
          adult: false,
        },
      ],
    );
    // The first child named in the answer practices first.
    assert.equal(first.learnerId, learners[0].id);
    assert.deepEqual(
      (
        await f.db.query(
          "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
          [parent],
        )
      ).rows,
      [{ org_id: orgId, class_id: classId }],
    );
    assert.deepEqual(
      (await f.studentsOf(classId)).map((s) => s.id),
      learners.map((l) => l.id),
    );

    const after = await f.me(parent);
    assert.equal(after.next, "practice");
    assert.equal(after.familyClass?.orgId, orgId);
    assert.equal(after.familyClass?.classId, classId);
    assert.equal(after.learners.length, 2);

    // A retry opens the same place and makes nothing.
    const again = await f.started(parent, body);
    assert.equal(again.home, first.home);
    assert.equal((again as { added?: number }).added, 0);
    assert.equal(
      await f.count("amp_learners WHERE account_id=$1", [parent]),
      2,
    );
    assert.equal(
      await f.count("amp_families WHERE account_id=$1", [parent]),
      1,
    );
    assert.equal((await f.studentsOf(classId)).length, 2);

    assert.deepEqual(await f.signInList(classId), ["Child 2", "Sam"]);

    // "I'm a parent" again (Add a place) with three: the third is added to
    // the same class, with the birth year given for it.
    const more = await f.started(parent, {
      as: "parent",
      children: [...body.children, { birthYear: year - 5 }],
    });
    assert.equal(more.home, first.home);
    assert.equal((more as { added?: number }).added, 1);
    assert.deepEqual(
      (await f.studentsOf(classId)).map((s) => s.birth_year).sort(),
      [year - 9, year - 7, year - 5].sort(),
    );
  },
);

test(
  // Children made together share a transaction: the first child is the one
  // named first, on the first call and on every retry.
  "a retried parent start returns the same first learner it returned before",
  database,
  async (t) => {
    const f = await fixture(t);
    const mismatched: string[] = [];
    for (let i = 0; i < 8; i++) {
      const parent = await f.user("Casey Fixture");
      const body = {
        as: "parent",
        children: [{ birthYear: year - 9 }, { birthYear: year - 7 }],
      };
      const first = await f.started(parent, body);
      const again = await f.started(parent, body);
      if (again.learnerId !== first.learnerId) mismatched.push(parent);
    }
    assert.deepEqual(mismatched, [], "retry changed the first learner");
  },
);

test(
  "a tutor's class holds school-owned unnamed students and no learner of the tutor's",
  database,
  async (t) => {
    const f = await fixture(t);
    const tutor = await f.user("Morgan Fixture");
    const body = {
      as: "tutor",
      students: [
        { birthYear: year - 10, nickname: "KJ" },
        { birthYear: year - 10 },
        { birthYear: year - 12 },
      ],
    };
    const first = await f.started(tutor, body);
    assert.equal(first.learnerId, undefined);
    const [, orgId, classId] = first.home.match(HOME) ?? [];
    assert.ok(orgId && classId, first.home);
    assert.deepEqual(
      (
        await f.db.query(
          "SELECT f.org_id,f.class_id,o.kind FROM amp_families f JOIN amp_orgs o ON o.id=f.org_id WHERE f.account_id=$1",
          [tutor],
        )
      ).rows,
      [{ org_id: orgId, class_id: classId, kind: "family" }],
    );
    assert.equal(await f.count("amp_learners WHERE account_id=$1", [tutor]), 0);

    const students = await f.studentsOf(classId);
    assert.equal(students.length, 3);
    for (const student of students) {
      assert.equal(student.account_id, `school:${student.person_id}`);
      // A tutor isn't the parent: no name, no basis, until the parent's
      // approval.
      assert.equal(student.name_pending, true);
      assert.equal(student.name_basis, null);
    }
    assert.deepEqual(students.map((s) => s.name).sort(), [
      "KJ",
      "Student 2",
      "Student 3",
    ]);
    assert.deepEqual(students.map((s) => s.birth_year).sort(), [
      year - 12,
      year - 10,
      year - 10,
    ]);
    assert.deepEqual(
      await f.signInList(classId),
      students.map((s) => s.name).sort(),
    );

    const after = await f.me(tutor);
    assert.equal(after.next, "practice");
    assert.equal(after.familyClass?.classId, classId);
    assert.deepEqual(after.learners, []);
    assert.equal(after.staffOf, undefined);

    const again = await f.started(tutor, body);
    assert.equal(again.home, first.home);
    assert.equal((await f.studentsOf(classId)).length, 3);

    // No students yet still makes the class.
    const empty = await f.user("Robin Fixture");
    const made = await f.started(empty, { as: "tutor", students: [] });
    const [, , emptyClass] = made.home.match(HOME) ?? [];
    assert.ok(emptyClass, made.home);
    assert.equal((await f.me(empty)).familyClass?.classId, emptyClass);
    assert.equal((await f.me(empty)).next, "practice");
    // Coming back with three adds them to the same class; the same answer
    // again adds none.
    const filled = await f.started(empty, body);
    assert.equal(filled.home, made.home);
    assert.equal((filled as { added?: number }).added, 3);
    assert.equal((await f.studentsOf(emptyClass)).length, 3);
    const retried = await f.started(empty, body);
    assert.equal((retried as { added?: number }).added, 0);
    assert.equal((await f.studentsOf(emptyClass)).length, 3);
    assert.equal(await f.count("amp_families WHERE account_id=$1", [empty]), 1);
  },
);

test(
  // Without a chosen start, the starting point is empty as a whole
  // (`amp_starting_point_valid`): practice begins at its default level.
  "learning for myself makes the account's adult learner, once",
  database,
  async (t) => {
    const f = await fixture(t);
    const adult = await f.user("Quinn Fixture");
    const body = { as: "myself", timezone: "America/Denver" };
    const first = await f.started(adult, body);
    assert.equal(first.home, "me");
    assert.ok(first.learnerId);
    assert.deepEqual(
      (
        await f.db.query(
          "SELECT id,adult,starting_band,timezone,name_pending FROM amp_learners WHERE account_id=$1",
          [adult],
        )
      ).rows,
      [
        {
          id: first.learnerId,
          adult: true,
          starting_band: null,
          timezone: "America/Denver",
          name_pending: false,
        },
      ],
    );
    const after = await f.me(adult);
    assert.equal(after.next, "practice");
    assert.equal(after.adultPractice?.learner?.id, first.learnerId);
    const practice = await f.get("/api/v1/me/practice", adult);
    assert.equal(practice.statusCode, 200, practice.body);
    assert.equal(practice.json().learner.id, first.learnerId);
    assert.equal(practice.json().learner.start, null);

    const again = await f.started(adult, body);
    assert.deepEqual(again, first);
    assert.equal(await f.count("amp_learners WHERE account_id=$1", [adult]), 1);
  },
);

test(
  // The old free trial's seeding (`initialLevel`), stored as the adult start
  // nearest it: an adult learner keeps no birth year.
  "learning for myself starts where the birth year puts it",
  database,
  async (t) => {
    const f = await fixture(t);
    const startOf = async (account: string) => {
      const row = (
        await f.db.query(
          "SELECT id,adult,birth_year,starting_band FROM amp_learners WHERE account_id=$1",
          [account],
        )
      ).rows[0];
      const frontier = await f.repository.transaction(account, row.id, (tx) =>
        tx.frontier(),
      );
      return {
        ...row,
        start: frontier.expected,
        level: frontier.overall.level,
      };
    };

    const adult = await f.user("Robin Fixture");
    await f.started(adult, {
      as: "myself",
      timezone: "America/Denver",
      birthYear: 1985,
    });
    const born1985 = await startOf(adult);
    assert.equal(born1985.adult, true);
    assert.equal(born1985.birth_year, null);
    assert.equal(born1985.starting_band, "precalculus");
    // Precalculus is grade 12, the top of the scale.
    assert.equal(born1985.start, 12);
    const practice = await f.get("/api/v1/me/practice", adult);
    assert.equal(practice.json().learner.start, "precalculus");

    // A teenager starts at the course nearest their grade: 15 → Algebra.
    const teen = await f.user("Sam Fixture");
    await f.started(teen, {
      as: "myself",
      timezone: "America/Denver",
      birthYear: year - 15,
    });
    const fifteen = await startOf(teen);
    assert.ok(
      ["algebra-1", "geometry"].includes(fifteen.starting_band),
      fifteen.starting_band,
    );
    assert.ok(fifteen.start >= 9 && fifteen.start < 12, `${fifteen.start}`);
    assert.ok(fifteen.level < born1985.level);

    // Under 13, a parent sets AMP up; nothing is made.
    const young = await f.user("Ari Fixture");
    for (const birthYear of [year - 10, year - 13]) {
      const refused = await f.start(young, {
        as: "myself",
        timezone: "America/Denver",
        birthYear,
      });
      assert.equal(refused.statusCode, 403, refused.body);
      assert.equal(refused.json().error, "own_practice_too_young");
    }
    assert.equal(await f.count("amp_learners WHERE account_id=$1", [young]), 0);

    // Begun before the question was asked: the year sets the start once,
    // and a start already set stays.
    const earlier = await f.user("Lee Fixture");
    await f.started(earlier, { as: "myself", timezone: "America/Denver" });
    const before = await startOf(earlier);
    assert.equal(before.starting_band, null);
    assert.equal(before.start, 2, "the default the founder met: grade 2");
    assert.ok(before.level < born1985.level - 6, `${before.level}`);
    await f.started(earlier, {
      as: "myself",
      timezone: "America/Denver",
      birthYear: 1990,
    });
    const after = await startOf(earlier);
    assert.equal(after.starting_band, "precalculus");
    assert.equal(after.start, 12);
    await f.started(earlier, {
      as: "myself",
      timezone: "America/Denver",
      birthYear: year - 14,
    });
    assert.equal((await startOf(earlier)).starting_band, "precalculus");
  },
);

test(
  "refusals: invalid answers, withdrawn consent, and student or trial accounts",
  database,
  async (t) => {
    const f = await fixture(t);
    const account = await f.user("Casey Fixture");
    for (const body of [
      {
        as: "parent",
        children: Array.from({ length: 7 }, () => ({ birthYear: year - 8 })),
      },
      { as: "parent", children: [{ birthYear: 1950 }] },
      { as: "parent", children: [] },
      { as: "tutor", students: [{ birthYear: year - 8, name: "Kai" }] },
      // A teacher or a school starts with a demo, not with the starter.
      { as: "teacher", timezone: "America/New_York" },
      { as: "myself" },
      { as: "myself", timezone: "America/New_York", birthYear: year + 1 },
      { as: "someone" },
    ]) {
      const refused = await f.start(account, body);
      assert.equal(refused.statusCode, 400, JSON.stringify(body));
      assert.equal(refused.json().error, "invalid_family_request");
    }
    assert.equal(
      await f.count("amp_learners WHERE account_id=$1", [account]),
      0,
    );
    assert.equal((await f.me(account)).next, "start");

    const withdrawn = await f.user("Taylor Fixture");
    await f.db.query(
      `INSERT INTO amp_parent_consents(account_id,policy_version,verification_method,evidence_reference,withdrawn_at)
       VALUES($1,'fixture-policy','verified','fixture-parent-verification',now())`,
      [withdrawn],
    );
    const refused = await f.start(withdrawn, {
      as: "parent",
      children: [{ birthYear: year - 8 }],
    });
    assert.equal(refused.statusCode, 403, refused.body);
    assert.equal(refused.json().error, "consent_withdrawn");
    assert.equal(
      await f.count("amp_learners WHERE account_id=$1", [withdrawn]),
      0,
    );
    assert.equal(
      await f.count("amp_families WHERE account_id=$1", [withdrawn]),
      0,
    );

    for (const other of f.accounts)
      if (!other.startsWith("amp|")) {
        const response = await f.start(other, {
          as: "myself",
          timezone: "America/New_York",
        });
        assert.equal(response.statusCode, 403, response.body);
        assert.equal(response.json().error, "starter_unavailable");
      }
  },
);

test(
  "another family's approval link is not a place: the parent opens it before anything else",
  database,
  async (t) => {
    const f = await fixture(t);
    const keys = {
      secret: fixtureSecret,
      origin: "https://amp.example",
    };
    const teacher = await f.user("Avery Fixture");
    await f.started(teacher, {
      as: "parent",
      children: [{ birthYear: year - 9 }],
    });
    const parent = await f.user("Jordan Fixture");
    const sent = await createApproval(f.db, keys, teacher, {
      parentEmail: "jordan@parent.example",
    });
    const [token, proof] = new URL(mailedApprovalUrl(keys, sent.id)).hash
      .slice(1)
      .split(".");
    await openApproval(f.db, keys, parent, { token, proof });
    const opened = await f.me(parent);
    assert.equal(opened.familyApproval?.id, sent.id);
    // No learner, class or practice of their own yet: the starter's `next`,
    // which the first run sends to the approval page instead of looping.
    assert.equal(opened.next, "start");
    assert.deepEqual(opened.learners, []);
  },
);
