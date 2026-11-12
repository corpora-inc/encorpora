import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { buildApp } from "../src/server/app.js";
import { ApiError, PostgresRepository } from "../src/server/repository.js";
import { completedGrade } from "../src/learning/starting-point.js";

/* Birth years can be corrected (Q-56, Q-57): a parent fixes a child's year in
   Family, and an adult corrects where their own practice starts. Neither
   touches the answers. Every name here is made up. */
const database = { skip: !process.env.AMP_TEST_DATABASE_URL };
const year = new Date().getUTCFullYear();
const gradeOf = (birthYear: number) =>
  Math.min(13, Math.max(0, completedGrade(birthYear) + 1));

async function fixture(t: TestContext) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_birthyear_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  const repository = new PostgresRepository(scoped.href, { development: true });
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
  await registerFamilyRoutes(app, {
    pool: db,
    authenticate,
    development: true,
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
      [id, name, `${id}@birth-year.example`],
    );
    accounts.add(`amp|${id}`);
    return `amp|${id}`;
  };
  const as = (account: string) => ({ authorization: `Bearer ${account}` });
  const get = (url: string, account: string) =>
    app.inject({ url, headers: as(account) });
  const post = (url: string, account: string, payload: object) =>
    app.inject({ method: "POST", url, headers: as(account), payload });
  const ok = async (
    response: Promise<{ statusCode: number; body: string; json(): any }>,
  ) => {
    const done = await response;
    assert.ok([200, 201].includes(done.statusCode), done.body);
    return done.json();
  };
  const me = (account: string) => ok(get("/api/v1/me", account));
  /** A parent's family from the starter: children in the order given. */
  const family = async (children: { name: string; birthYear: number }[]) => {
    const account = await user("Robin Fixture");
    await ok(post("/api/v1/start", account, { as: "parent", children }));
    const { learners } = await me(account);
    return {
      account,
      ids: learners.map((learner: { id: string }) => learner.id) as string[],
    };
  };
  const rosterGrade = async (learnerId: string) =>
    (
      await db.query("SELECT grade_level FROM amp_people WHERE learner_id=$1", [
        learnerId,
      ])
    ).rows[0]?.grade_level as number | null | undefined;
  return { app, db, user, get, post, ok, me, family, rosterGrade };
}

test("birth years can be corrected", database, async (t) => {
  const f = await fixture(t);

  await t.test(
    "a parent corrects a child's year: the year, the class grade and the start follow; the answers stay",
    async () => {
      // Two children stored with each other's years (Q-56).
      const { account, ids } = await f.family([
        { name: "Ada", birthYear: 2016 },
        { name: "Ben", birthYear: 2011 },
      ]);
      const [ada] = ids;
      assert.equal(await f.rosterGrade(ada!), gradeOf(2016));
      const before = await f.ok(
        f.get(`/api/v1/learners/${ada}/frontier`, account),
      );
      assert.equal(before.expected, gradeOf(2016));
      // Practice to keep: one answered problem.
      const served = await f.ok(
        f.post(`/api/v1/learners/${ada}/batches`, account, { count: 1 }),
      );
      await f.ok(
        f.post(`/api/v1/learners/${ada}/attempts`, account, {
          problemId: served.problems[0].id,
          requestId: randomUUID(),
          response: "1",
        }),
      );
      const attempts = async () =>
        (
          await f.db.query(
            "SELECT id FROM amp_attempts WHERE learner_id=$1 ORDER BY id",
            [ada],
          )
        ).rows.map((row) => row.id as string);
      const answered = await attempts();
      assert.equal(answered.length, 1);

      const saved = await f.ok(
        f.post(`/api/v1/family/learners/${ada}/birth-year`, account, {
          birthYear: 2011,
        }),
      );
      assert.deepEqual(saved, { birthYear: 2011 });
      // One store: /me, the family's class roster and the level all agree.
      const after = await f.me(account);
      assert.equal(
        after.learners.find((l: { id: string }) => l.id === ada).birthYear,
        2011,
      );
      assert.equal(await f.rosterGrade(ada!), gradeOf(2011));
      const level = await f.ok(
        f.get(`/api/v1/learners/${ada}/frontier`, account),
      );
      assert.equal(level.expected, gradeOf(2011));
      assert.equal(level.overall.answered, 1, "the answer is still counted");
      assert.deepEqual(await attempts(), answered);
      // Recorded beside renames.
      assert.equal(
        (
          await f.db.query(
            "SELECT count(*)::int AS n FROM amp_privacy_events WHERE account_id=$1 AND learner_id=$2 AND action='learner.birth-year-changed'",
            [account, ada],
          )
        ).rows[0].n,
        1,
      );
      // Saving the same year again records nothing new.
      await f.ok(
        f.post(`/api/v1/family/learners/${ada}/birth-year`, account, {
          birthYear: 2011,
        }),
      );
      assert.equal(
        (
          await f.db.query(
            "SELECT count(*)::int AS n FROM amp_privacy_events WHERE learner_id=$1 AND action='learner.birth-year-changed'",
            [ada],
          )
        ).rows[0].n,
        1,
      );
    },
  );

  await t.test(
    "only the account's own children, and only a school-age year",
    async () => {
      const { account, ids } = await f.family([
        { name: "Cleo", birthYear: 2015 },
      ]);
      const [cleo] = ids;
      const stranger = await f.user("Sam Fixture");
      const refused = await f.post(
        `/api/v1/family/learners/${cleo}/birth-year`,
        stranger,
        { birthYear: 2014 },
      );
      assert.equal(refused.statusCode, 404, refused.body);
      for (const birthYear of [year - 30, year, 2016.5])
        assert.equal(
          (
            await f.post(
              `/api/v1/family/learners/${cleo}/birth-year`,
              account,
              {
                birthYear,
              },
            )
          ).statusCode,
          400,
          String(birthYear),
        );
      assert.equal(
        (await f.me(account)).learners[0].birthYear,
        2015,
        "nothing changed",
      );
      // The adult's own learner has no birth year to correct.
      const own = await f.ok(
        f.post("/api/v1/me/practice", account, {
          birthYear: year - 40,
          timezone: "America/Chicago",
        }),
      );
      const adult = await f.post(
        `/api/v1/family/learners/${own.learnerId}/birth-year`,
        account,
        { birthYear: 2012 },
      );
      assert.equal(adult.statusCode, 409, adult.body);
      assert.equal(adult.json().error, "adult_has_no_birth_year");
    },
  );

  await t.test(
    "the Overview's older birth-year route keeps the class grade in step",
    async () => {
      const { account, ids } = await f.family([
        { name: "Dev", birthYear: 2017 },
      ]);
      const [dev] = ids;
      await f.ok(
        f.post(`/api/v1/learners/${dev}/birth-year`, account, {
          birthYear: 2014,
        }),
      );
      assert.equal(await f.rosterGrade(dev!), gradeOf(2014));
    },
  );

  await t.test(
    "an adult corrects where their own practice starts, from their year",
    async () => {
      const account = await f.user("Avery Fixture");
      const begun = await f.ok(
        f.post("/api/v1/me/practice", account, {
          birthYear: year - 35,
          timezone: "America/Chicago",
        }),
      );
      const own = async () =>
        (await f.me(account)).family.learners.find(
          (l: { adult?: true; simulation?: true }) => l.adult && !l.simulation,
        );
      // An adult's starts mid-scale, and the account's one store says so.
      assert.equal((await own()).start, "middle-school");
      assert.equal((await own()).birthYear, null);
      // Starting again never changed a chosen start: the year picked by
      // mistake stayed. The correction does change it.
      await f.ok(
        f.post("/api/v1/me/practice", account, {
          birthYear: year - 15,
          timezone: "America/Chicago",
        }),
      );
      assert.equal((await own()).start, "middle-school");
      const corrected = await f.ok(
        f.post("/api/v1/me/practice/birth-year", account, {
          birthYear: year - 15,
        }),
      );
      assert.notEqual(corrected.start, "middle-school");
      assert.equal((await own()).start, corrected.start);
      assert.equal((await own()).birthYear, null, "still no birth year");
      const level = await f.ok(
        f.get(`/api/v1/learners/${begun.learnerId}/frontier`, account),
      );
      assert.ok(level.expected > 6, "the start moved up with the year");
      // Back to an adult's year: mid-scale again.
      assert.equal(
        (
          await f.ok(
            f.post("/api/v1/me/practice/birth-year", account, {
              birthYear: year - 50,
            }),
          )
        ).start,
        "middle-school",
      );
      // Under 13 a parent sets AMP up; nothing changes.
      const young = await f.post("/api/v1/me/practice/birth-year", account, {
        birthYear: year - 9,
      });
      assert.equal(young.statusCode, 403, young.body);
      assert.equal((await own()).start, "middle-school");
      // Without their own practice there is nothing to correct.
      const none = await f.user("Quinn Fixture");
      assert.equal(
        (
          await f.post("/api/v1/me/practice/birth-year", none, {
            birthYear: year - 30,
          })
        ).statusCode,
        404,
      );
    },
  );
});
