import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { registerSchoolRoutes } from "../src/schools/routes.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* Adding to a family's class after setup: a parent adds their own child by
   the family endpoint, a tutor adds a student from another family by theirs,
   and the school roster endpoint is not a family's. Every name is made up. */
const database = { skip: !process.env.AMP_TEST_DATABASE_URL };
const year = new Date().getUTCFullYear();

async function fixture(t: TestContext) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_family_add_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
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
      secret: randomBytes(32).toString("hex"),
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
  const user = async () => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Casey Fixture',$2,true,now(),now())`,
      [id, `${id}@add.example`],
    );
    accounts.add(`amp|${id}`);
    return `amp|${id}`;
  };
  const post = (account: string, url: string, payload: object) =>
    app.inject({
      method: "POST",
      url,
      payload,
      headers: { authorization: `Bearer ${account}` },
    });
  /** The class's students as its sign-in list names them. */
  const classNames = async (classId: string) =>
    (
      await db.query(
        `SELECT p.given_name FROM amp_enrollments e JOIN amp_people p ON p.id=e.person_id
         WHERE e.class_id=$1 AND e.role='student' AND e.end_on IS NULL AND p.deleted_at IS NULL
         ORDER BY p.given_name`,
        [classId],
      )
    ).rows.map((row) => row.given_name as string);
  const familyOf = async (account: string) =>
    (
      await db.query(
        "SELECT org_id,class_id FROM amp_families WHERE account_id=$1",
        [account],
      )
    ).rows[0] as { org_id: string; class_id: string };
  return { db, user, post, classNames, familyOf };
}

test(
  "a parent adds their own child to the family class by the family endpoint",
  database,
  async (t) => {
    const f = await fixture(t);
    const parent = await f.user();
    const started = await f.post(parent, "/api/v1/start", {
      as: "parent",
      children: [{ birthYear: year - 9, name: "Sam" }],
    });
    assert.equal(started.statusCode, 200, started.body);
    const family = await f.familyOf(parent);
    const added = await f.post(parent, "/api/v1/learners", {
      name: "Ivy",
      birthYear: year - 6,
    });
    assert.equal(added.statusCode, 201, added.body);
    // In the class at once: Today, the map and the sign-in list read it.
    assert.deepEqual(await f.classNames(family.class_id), ["Ivy", "Sam"]);
    // The school roster form's endpoint is not a family's: the screens never
    // offer it there.
    const school = await f.post(
      parent,
      `/api/v1/school/orgs/${family.org_id}/students`,
      { givenName: "Ivy", classId: family.class_id },
    );
    assert.equal(school.statusCode, 404, school.body);
  },
);

test(
  "a tutor adds a student from another family with a nickname or a number",
  database,
  async (t) => {
    const f = await fixture(t);
    const tutor = await f.user();
    const started = await f.post(tutor, "/api/v1/start", {
      as: "tutor",
      students: [],
    });
    assert.equal(started.statusCode, 200, started.body);
    const family = await f.familyOf(tutor);
    const add = (payload: object) =>
      f.post(tutor, "/api/v1/family/class/students", payload);
    const named = await add({ nickname: "KJ", birthYear: year - 10 });
    assert.equal(named.statusCode, 201, named.body);
    assert.equal(named.json().name, "KJ");
    const blank = await add({ nickname: "", birthYear: year - 11 });
    assert.equal(blank.statusCode, 201, blank.body);
    assert.equal(blank.json().name, "Student 2");
    for (const refused of [
      { nickname: "x".repeat(21), birthYear: year - 10 },
      { nickname: "kj@example.com", birthYear: year - 10 },
      { name: "Kai Jones", birthYear: year - 10 },
      { nickname: "KJ" },
    ])
      assert.equal((await add(refused)).statusCode, 400, JSON.stringify(refused));
    assert.deepEqual(await f.classNames(family.class_id), ["KJ", "Student 2"]);
    // School-owned, on the restricted basis, until their parent approves.
    assert.deepEqual(
      (
        await f.db.query(
          "SELECT name_pending,name_basis,account_id LIKE 'school:%' AS school FROM amp_learners WHERE id=$1",
          [named.json().learnerId],
        )
      ).rows,
      [{ name_pending: true, name_basis: null, school: true }],
    );
    // Without a class of their own, there is nothing to add to.
    const other = await f.user();
    const none = await f.post(other, "/api/v1/family/class/students", {
      birthYear: year - 10,
    });
    assert.equal(none.statusCode, 409, none.body);
  },
);
