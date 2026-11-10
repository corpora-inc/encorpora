import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";

/* Children's names (docs/parent-consent.md#childrens-names): a parent names
   their own child with no consent step and the basis is recorded; a tutor
   gives only a nickname; blank goes by the number; picture names are gone.
   Every name here is made up. */
const database = { skip: !process.env.AMP_TEST_DATABASE_URL };
const year = new Date().getUTCFullYear();

async function scopedSchema(t: TestContext, prefix: string) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `${prefix}_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  t.after(async () => {
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  return scoped.href;
}

async function fixture(t: TestContext) {
  const url = await scopedSchema(t, "amp_names");
  await migrate(url);
  const repository = new PostgresRepository(url);
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
  await app.ready();
  t.after(async () => {
    await app.close();
    await repository.close();
  });
  const user = async () => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
       VALUES($1,'Casey Fixture',$2,true,now(),now())`,
      [id, `${id}@names.example`],
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
  const me = async (account: string) =>
    (
      await app.inject({
        url: "/api/v1/me",
        headers: { authorization: `Bearer ${account}` },
      })
    ).json();
  const row = async (id: string) =>
    (
      await db.query(
        `SELECT name,name_pending,label_number,name_basis,name_basis_version,
           name_basis_at IS NOT NULL AS basis_timed
         FROM amp_learners WHERE id=$1`,
        [id],
      )
    ).rows[0];
  return { db, user, post, me, row };
}

test(
  "a parent names their own child with no consent step, and the basis is recorded",
  database,
  async (t) => {
    const f = await fixture(t);
    const parent = await f.user();
    const named = await f.post(parent, "/api/v1/learners", {
      name: "  Maya  ",
      birthYear: year - 8,
    });
    assert.equal(named.statusCode, 201, named.body);
    const blank = await f.post(parent, "/api/v1/learners", {
      name: "",
      birthYear: year - 6,
    });
    assert.equal(blank.statusCode, 201, blank.body);
    // No consent: both learn on the restricted basis; the name is the
    // parent's, with its basis, and blank is the number.
    assert.deepEqual(await f.row(named.json().id), {
      name: "Maya",
      name_pending: true,
      label_number: 1,
      name_basis: "parent_entry",
      name_basis_version: "2026-11-10",
      basis_timed: true,
    });
    assert.deepEqual(await f.row(blank.json().id), {
      name: "Child 2",
      name_pending: true,
      label_number: 2,
      name_basis: null,
      name_basis_version: null,
      basis_timed: false,
    });
    const listed = (await f.me(parent)).learners;
    assert.deepEqual(
      listed.map((l: { name: string; defaultName?: true }) => [
        l.name,
        l.defaultName ?? false,
      ]),
      [
        ["Maya", false],
        ["Child 2", true],
      ],
    );

    // Renaming needs no consent either; blank returns the same number.
    const rename = (id: string, name: string) =>
      f.post(parent, `/api/v1/family/learners/${id}/rename`, { name });
    const renamed = await rename(blank.json().id, "Ana");
    assert.equal(renamed.statusCode, 200, renamed.body);
    assert.deepEqual(await f.row(blank.json().id), {
      name: "Ana",
      name_pending: true,
      label_number: 2,
      name_basis: "parent_entry",
      name_basis_version: "2026-11-10",
      basis_timed: true,
    });
    assert.equal((await rename(blank.json().id, "")).statusCode, 200);
    assert.deepEqual(await f.row(blank.json().id), {
      name: "Child 2",
      name_pending: true,
      label_number: 2,
      name_basis: null,
      name_basis_version: null,
      basis_timed: false,
    });
    // The class's sign-in list follows the learner's name.
    assert.deepEqual(
      (
        await f.db.query(
          "SELECT given_name FROM amp_people WHERE learner_id=$1",
          [named.json().id],
        )
      ).rows,
      [{ given_name: "Maya" }],
    );
  },
);

test(
  "a name that looks like an email address or a phone number is refused everywhere a parent names",
  database,
  async (t) => {
    const f = await fixture(t);
    const parent = await f.user();
    const child = (
      await f.post(parent, "/api/v1/learners", { birthYear: year - 8 })
    ).json();
    for (const name of [
      "kid@example.com",
      "555-123-4567",
      "(555) 123 4567",
      "x".repeat(31),
    ]) {
      const made = await f.post(parent, "/api/v1/learners", {
        name,
        birthYear: year - 8,
      });
      assert.equal(made.statusCode, 400, name);
      const renamed = await f.post(
        parent,
        `/api/v1/family/learners/${child.id}/rename`,
        { name },
      );
      assert.equal(renamed.statusCode, 400, name);
      const started = await f.post(parent, "/api/v1/start", {
        as: "parent",
        children: [{ birthYear: year - 8, name }],
      });
      assert.equal(started.statusCode, 400, name);
    }
    assert.equal((await f.row(child.id)).name, "Child 1");
    assert.equal(
      (
        await f.db.query(
          "SELECT count(*)::int AS n FROM amp_learners WHERE account_id=$1",
          [parent],
        )
      ).rows[0].n,
      1,
    );
  },
);

test(
  "a tutor gives a nickname only; the student's parent names them",
  database,
  async (t) => {
    const f = await fixture(t);
    const tutor = await f.user();
    for (const nickname of ["x".repeat(21), "kj@example.com"]) {
      const refused = await f.post(tutor, "/api/v1/start", {
        as: "tutor",
        students: [{ birthYear: year - 9, nickname }],
      });
      assert.equal(refused.statusCode, 400, nickname);
    }
    const started = await f.post(tutor, "/api/v1/start", {
      as: "tutor",
      students: [{ birthYear: year - 9, nickname: "KJ" }, { birthYear: year - 9 }],
    });
    assert.equal(started.statusCode, 200, started.body);
    const students = (
      await f.db.query(
        `SELECT l.id,l.account_id,l.name,l.name_pending,l.name_basis,p.given_name FROM amp_learners l
         JOIN amp_people p ON p.learner_id=l.id WHERE l.account_id LIKE 'school:%' ORDER BY l.label_number`,
      )
    ).rows;
    assert.deepEqual(
      students.map(({ id: _, account_id: __, ...s }) => s),
      [
        { name: "KJ", name_pending: true, name_basis: null, given_name: "KJ" },
        {
          name: "Student 2",
          name_pending: true,
          name_basis: null,
          given_name: "Student 2",
        },
      ],
    );
    // A tutor isn't the parent: the parent's rename is not theirs to use.
    const renamed = await f.post(
      tutor,
      `/api/v1/family/learners/${students[0].id}/rename`,
      { name: "Kai Jones" },
    );
    assert.equal(renamed.statusCode, 404, renamed.body);
    // The roster still refuses a real name for a student without consent.
    await assert.rejects(
      f.db.query("UPDATE amp_people SET family_name='Jones' WHERE learner_id=$1", [
        students[0].id,
      ]),
      /cannot have identifying roster fields/,
    );
  },
);

test(
  "existing picture-named learners go by their number after migration 0109",
  database,
  async (t) => {
    const url = await scopedSchema(t, "amp_names_migration");
    const pool = new Pool({ connectionString: url, max: 1 });
    t.after(() => pool.end());
    const directory = new URL("../migrations/", import.meta.url);
    const files = (await readdir(directory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    const apply = async (name: string) =>
      pool.query(await readFile(new URL(name, directory), "utf8"));
    for (const name of files.filter((name) => name < "0109"))
      await apply(name);

    const family = "amp|fixture-family";
    const other = "amp|fixture-other";
    const insert = (
      id: string,
      account: string,
      name: string,
      picture: string,
      number: number,
      scope: string,
      created: string,
    ) =>
      pool.query(
        `INSERT INTO amp_learners(id,account_id,name,birth_year,name_pending,picture_identity,picture_number,identity_scope,created_at)
         VALUES($1,$2,$3,$4,true,$5,$6,$7,$8)`,
        [id, account, name, year - 8, picture, number, scope, created],
      );
    const ids = {
      moon: randomUUID(),
      fox: randomUUID(),
      owl: randomUUID(),
      student: randomUUID(),
      named: randomUUID(),
    };
    // Added Fox first, then Moon 2: numbered in the order they were added.
    await insert(ids.moon, family, "Moon 2", "moon", 2, `family:${family}`, "2026-11-09T12:00:00Z");
    await insert(ids.fox, family, "Fox", "fox", 1, `family:${family}`, "2026-11-08T12:00:00Z");
    await insert(ids.owl, other, "Owl", "owl", 1, `family:${other}`, "2026-11-09T12:00:00Z");
    await insert(ids.student, "school:fixture-person", "Fox", "fox", 1, "school:fixture-org", "2026-11-09T12:00:00Z");
    await pool.query(
      "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Rowan',$3)",
      [ids.named, family, year - 10],
    );

    await apply(files.find((name) => name.startsWith("0109"))!);
    const rows = Object.fromEntries(
      (
        await pool.query(
          "SELECT id,name,name_pending,label_number,picture_identity,picture_number FROM amp_learners",
        )
      ).rows.map(({ id, ...row }) => [id, row]),
    );
    const numbered = (name: string, label: number) => ({
      name,
      name_pending: true,
      label_number: label,
      picture_identity: null,
      picture_number: null,
    });
    assert.deepEqual(rows[ids.fox], numbered("Child 1", 1));
    assert.deepEqual(rows[ids.moon], numbered("Child 2", 2));
    assert.deepEqual(rows[ids.owl], numbered("Child 1", 1));
    assert.deepEqual(rows[ids.student], numbered("Student 1", 1));
    // A named child is left as they are.
    assert.deepEqual(rows[ids.named], {
      name: "Rowan",
      name_pending: false,
      label_number: null,
      picture_identity: null,
      picture_number: null,
    });
  },
);
