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
      (await f.studentsOf(classId)).map((s) => s.id).sort(),
      learners.map((l) => l.id).sort(),
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
  // Without a year or chosen start, an adult begins at middle school.
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
          starting_band: "middle-school",
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
    assert.equal(practice.json().learner.start, "middle-school");
    const frontier = await f.repository.transaction(
      adult,
      first.learnerId!,
      (tx) => tx.frontier(),
    );
    assert.equal(frontier.expected, 7);

    const again = await f.started(adult, body);
    assert.deepEqual(again, first);
    assert.equal(await f.count("amp_learners WHERE account_id=$1", [adult]), 1);
  },
);

test(
  // A school-age year seeds it as the old free trial did (`initialLevel`),
  // stored as the adult start nearest it: an adult learner keeps no birth
  // year. Past school age the year says nothing about level: an adult
  // chooses where to begin.
  "learning for myself starts where the birth year puts it, or where an adult chooses",
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
      start: "precalculus",
    });
    const born1985 = await startOf(adult);
    assert.equal(born1985.adult, true);
    assert.equal(born1985.birth_year, null);
    assert.equal(born1985.starting_band, "precalculus");
    // Precalculus is grade 12, the top of the scale.
    assert.equal(born1985.start, 12);
    const practice = await f.get("/api/v1/me/practice", adult);
    assert.equal(practice.json().learner.start, "precalculus");
    // An adult's birth year alone (a screen loaded before the choice) starts
    // mid-scale, not at the top.
    const unchosen = await f.user("Kit Fixture");
    await f.started(unchosen, {
      as: "myself",
      timezone: "America/Denver",
      birthYear: 1985,
    });
    assert.equal((await startOf(unchosen)).starting_band, "middle-school");

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
    await f.db.query(
      "UPDATE amp_learners SET starting_band=NULL,starting_policy=NULL,starting_excluded_strands=NULL WHERE account_id=$1",
      [earlier],
    );
    const before = await startOf(earlier);
    assert.equal(before.starting_band, null);
    assert.equal(
      before.start,
      7,
      "a legacy adult without a start uses middle school",
    );
    const point = await f.get(
      `/api/v1/learners/${before.id}/starting-point`,
      earlier,
    );
    assert.deepEqual(point.json(), { band: "middle-school", policyVersion: 1 });
    const legacy = await f.get("/api/v1/me/practice", earlier);
    assert.equal(legacy.json().learner.start, "middle-school");
    const family = await f.me(earlier);
    assert.equal(
      family.family.learners.find(
        (learner: { id: string }) => learner.id === before.id,
      ).start,
      "middle-school",
    );
    await f.started(earlier, {
      as: "myself",
      timezone: "America/Denver",
      start: "precalculus",
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
  "a family can include an older learner with their exact birth year",
  database,
  async (t) => {
    const f = await fixture(t);
    const parent = await f.user("Family Fixture");
    const result = await f.started(parent, {
      as: "parent",
      children: [{ name: "Morgan", birthYear: 1950 }],
    });
    const learner = (
      await f.db.query(
        "SELECT id,name,birth_year FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL",
        [parent],
      )
    ).rows[0];
    assert.equal(result.learnerId, learner.id);
    assert.equal(learner.name, "Morgan");
    assert.equal(learner.birth_year, 1950);
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
      { as: "parent", children: [{ birthYear: 1899 }] },
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

/* A parent's setup keeps the kids it saved editable until the parent is done:
   a child with nothing yet in their name comes back out of the family. */
test(
  "setup takes a saved child with nothing yet back out of the family",
  database,
  async (t) => {
    const f = await fixture(t);
    const parent = await f.user("Casey Fixture");
    const stranger = await f.user("Robin Fixture");
    const first = await f.started(parent, {
      as: "parent",
      children: [
        { birthYear: year - 9, name: "Sam" },
        { birthYear: year - 7 },
        { birthYear: year - 5 },
      ],
    });
    const [, , classId] = first.home.match(HOME) ?? [];
    const remove = (account: string, learnerId: string) =>
      f.app.inject({
        method: "POST",
        url: `/api/v1/family/learners/${learnerId}/remove`,
        payload: {},
        headers: { authorization: `Bearer ${account}` },
      });
    const kids = async () =>
      (await f.me(parent)).learners as {
        id: string;
        name: string;
        removable?: true;
      }[];
    const [sam, second, third] = await kids();
    // Every fresh child can come out: /me says so, so Remove only shows
    // where it will work.
    assert.deepEqual(
      (await kids()).map((kid) => kid.removable),
      [true, true, true],
    );

    // Another account's child, or a made-up one, is never theirs to remove.
    assert.equal((await remove(stranger, second!.id)).statusCode, 404);
    assert.equal((await remove(parent, "nobody")).statusCode, 404);

    const gone = await remove(parent, second!.id);
    assert.equal(gone.statusCode, 200, gone.body);
    assert.deepEqual(
      (await kids()).map((kid) => kid.id),
      [sam!.id, third!.id],
    );
    // Off the family's roster too: its sign-in list no longer shows them.
    assert.deepEqual(
      (await f.studentsOf(classId!)).map((s) => s.id).sort(),
      [sam!.id, third!.id].sort(),
    );
    assert.deepEqual(await f.signInList(classId!), ["Child 3", "Sam"]);
    // Removing again finds nobody.
    assert.equal((await remove(parent, second!.id)).statusCode, 404);

    // A child already shown a problem has learning in their name: they stay,
    // and /me no longer offers Remove for them.
    await f.db.query(
      "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,'{}'::jsonb)",
      [randomUUID(), sam!.id],
    );
    const started = await remove(parent, sam!.id);
    assert.equal(started.statusCode, 409, started.body);
    assert.match(started.body, /child_has_history/);
    assert.deepEqual(
      (await kids()).map((kid) => [kid.id, kid.removable]),
      [
        [sam!.id, undefined],
        [third!.id, true],
      ],
    );

    // A child with a purchase in their name stays as well.
    const paid = await f.started(parent, {
      as: "parent",
      children: [
        { birthYear: year - 9 },
        { birthYear: year - 5 },
        { birthYear: year - 4 },
      ],
    });
    assert.equal((paid as { added?: number }).added, 1);
    const fourth = (await kids()).at(-1)!;
    await f.db.query(
      "INSERT INTO amp_grants(id,learner_id,channel,external_order_id,status,starts_at,ends_at) VALUES($1,$2,'stripe',$3,'active',now(),now()+interval '1 year')",
      [randomUUID(), fourth.id, randomUUID()],
    );
    assert.equal((await remove(parent, fourth.id)).statusCode, 409);

    // The family keeps one child: the last is edited, never removed.
    assert.equal((await remove(parent, third!.id)).statusCode, 200);
    const alone = await f.user("Alex Fixture");
    const only = await f.started(alone, {
      as: "parent",
      children: [{ birthYear: year - 8 }],
    });
    const last = await remove(alone, only.learnerId!);
    assert.equal(last.statusCode, 409, last.body);
    assert.match(last.body, /last_child/);
    assert.equal(
      await f.count("amp_learners WHERE account_id=$1 AND deleted_at IS NULL", [
        alone,
      ]),
      1,
    );
  },
);

/* First-run progress has one owner (`me.setup`): the answer given and
   whether the first run is done. Saving kids never ends it. */
test(
  "me.setup: the answer can change until the first run is done",
  database,
  async (t) => {
    const f = await fixture(t);
    const as = (account: string) => ({ authorization: `Bearer ${account}` });
    const post = (account: string, url: string, payload: object) =>
      f.app.inject({ method: "POST", url, payload, headers: as(account) });
    const setup = async (account: string) => (await f.me(account)).setup;

    const parent = await f.user("Casey Fixture");
    assert.deepEqual(await setup(parent), { persona: null, done: false });
    assert.equal(
      (await post(parent, "/api/v1/start/choice", { answer: "parent" }))
        .statusCode,
      204,
    );
    assert.deepEqual(await setup(parent), { persona: "parent", done: false });
    // Kids saved at step one: the family exists, and the first run goes on.
    const made = await f.started(parent, {
      as: "parent",
      children: [{ birthYear: year - 9 }, { birthYear: year - 7 }],
    });
    assert.deepEqual(await setup(parent), { persona: "parent", done: false });
    // Back to the question, another answer, and Parent again.
    await post(parent, "/api/v1/start/choice", { answer: "myself" });
    assert.deepEqual(await setup(parent), { persona: "myself", done: false });
    await post(parent, "/api/v1/start/choice", { answer: "parent" });
    // Going to Today from setup ends it; later answers (Add a place) don't
    // change it.
    assert.equal(
      (await post(parent, "/api/v1/start/done", { answer: "parent" }))
        .statusCode,
      204,
    );
    assert.deepEqual(await setup(parent), { persona: "parent", done: true });
    await post(parent, "/api/v1/start/choice", { answer: "myself" });
    assert.deepEqual(await setup(parent), { persona: "parent", done: true });
    assert.equal(
      (await post(parent, "/api/v1/start/done", { answer: "nope" })).statusCode,
      400,
    );

    // A child's first practice here ends a parent's first run.
    const second = await f.user("Robin Fixture");
    await post(second, "/api/v1/start/choice", { answer: "parent" });
    const kids = await f.started(second, {
      as: "parent",
      children: [{ birthYear: year - 8 }],
    });
    const here = await post(
      second,
      `/api/v1/family/learners/${kids.learnerId}/practice-here`,
      {},
    );
    assert.equal(here.statusCode, 201, here.body);
    assert.deepEqual(await setup(second), { persona: "parent", done: true });

    // Their own practice starting ends an adult's.
    const adult = await f.user("Alex Fixture");
    await post(adult, "/api/v1/start/choice", { answer: "myself" });
    await f.started(adult, {
      as: "myself",
      timezone: "America/New_York",
      birthYear: year - 30,
    });
    assert.deepEqual(await setup(adult), { persona: "myself", done: true });

    // An account from before this record that already has a place finished
    // its first run then, and answering again doesn't reopen it.
    const earlier = await f.user("Sam Fixture");
    await f.started(earlier, {
      as: "parent",
      children: [{ birthYear: year - 6 }],
    });
    await f.db.query("DELETE FROM amp_first_runs WHERE account_id=$1", [
      earlier,
    ]);
    assert.deepEqual(await setup(earlier), { persona: null, done: true });
    await post(earlier, "/api/v1/start/choice", { answer: "myself" });
    assert.deepEqual(await setup(earlier), { persona: "myself", done: true });
    assert.ok(made.home);
  },
);
