import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { accountSummary } from "../src/account/repository.js";
import { FamilyRepository } from "../src/family/repository.js";
import { absorbLiveTrial } from "../src/server/absorb-trial.js";
import { PostgresRepository } from "../src/server/repository.js";
import { schoolAccountId } from "../src/schools/principal.js";

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

test(
  "a live trial becomes an unnamed learner in its owner's family",
  enabled,
  async (t) => {
    const f = await fixture(t);

    await t.test(
      "a live trial moves intact, and a second call changes nothing",
      async () => {
        const account = await parent(f.db);
        const trial = await f.repository.createTrial(2016, account);
        await seedHistory(f.db, trial.learnerId);
        const before = await counts(f.db, trial.learnerId);
        const attemptIds = await ids(
          f.db,
          "SELECT id FROM amp_attempts WHERE learner_id=$1 ORDER BY id",
          trial.learnerId,
        );
        assert.deepEqual(before, {
          attempts: 7,
          instances: 8,
          evidence: 1,
          workbooks: 1,
          frontier: 1,
        });
        assert.equal(
          (
            await f.db.query(
              "SELECT free_online_used,free_workbooks_used FROM amp_learners WHERE id=$1",
              [trial.learnerId],
            )
          ).rows[0].free_online_used,
          7,
          "six in-app answers plus one skip; the paper answer is not free usage",
        );

        const me = await accountSummary(
          f.db,
          new FamilyRepository(f.db),
          account,
        );
        const learner = me.learners.find((row) => row.id === trial.learnerId);
        assert.ok(learner, "the moved learner is on /me at once");
        assert.equal(learner.name, "Fox");
        assert.equal(learner.namePending, true);
        assert.equal(learner.pictureIdentity, "fox");
        assert.equal(learner.freeAllowance?.problems.used, 7);
        assert.equal(learner.freeAllowance?.workbooks.made, 1);
        assert.equal(me.trial, undefined);
        assert.equal(await f.repository.currentTrial(account), null);

        const row = await learnerRow(f.db, trial.learnerId);
        assert.deepEqual(row, {
          account_id: account,
          name: "Fox",
          name_pending: true,
          picture_identity: "fox",
          picture_number: 1,
          identity_scope: `family:${account}`,
          free_online_used: 7,
          free_workbooks_used: 1,
        });
        assert.equal(
          (
            await f.db.query(
              "SELECT adopted_by, adopted_at IS NOT NULL AS adopted FROM amp_trials WHERE learner_id=$1",
              [trial.learnerId],
            )
          ).rows[0].adopted_by,
          account,
        );
        assert.equal(await enrolled(f.db, trial.learnerId, account), 1);
        assert.deepEqual(await counts(f.db, trial.learnerId), before);
        assert.deepEqual(
          await ids(
            f.db,
            "SELECT id FROM amp_attempts WHERE learner_id=$1 ORDER BY id",
            trial.learnerId,
          ),
          attemptIds,
        );
        assert.equal(
          (
            await f.db.query(
              "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1 AND outcome->>'evidenceSource'='paper'",
              [trial.learnerId],
            )
          ).rows[0].n,
          1,
        );

        const adoptedAt = (
          await f.db.query(
            "SELECT adopted_at FROM amp_trials WHERE learner_id=$1",
            [trial.learnerId],
          )
        ).rows[0].adopted_at as Date;
        const client = await f.db.connect();
        try {
          assert.equal(await absorbLiveTrial(client, account), 0);
        } finally {
          client.release();
        }
        const again = await accountSummary(
          f.db,
          new FamilyRepository(f.db),
          account,
        );
        assert.equal(
          again.learners.find((item) => item.id === trial.learnerId)?.name,
          "Fox",
        );
        assert.deepEqual(await learnerRow(f.db, trial.learnerId), row);
        assert.deepEqual(await counts(f.db, trial.learnerId), before);
        assert.equal(await enrolled(f.db, trial.learnerId, account), 1);
        assert.equal(
          (
            await f.db.query(
              "SELECT adopted_at FROM amp_trials WHERE learner_id=$1",
              [trial.learnerId],
            )
          ).rows[0].adopted_at.getTime(),
          adoptedAt.getTime(),
        );
      },
    );

    await t.test(
      "an expired, ownerless, already adopted, or birth-year-less trial stays where it is",
      async () => {
        const expiredOwner = await parent(f.db);
        const expired = await f.repository.createTrial(2016, expiredOwner);
        await f.db.query(
          "UPDATE amp_trials SET expires_at=now()-interval '1 minute' WHERE learner_id=$1",
          [expired.learnerId],
        );

        const ownerless = await f.repository.createTrial(2015);

        const adoptedOwner = await parent(f.db);
        const adopted = await f.repository.createTrial(2014, adoptedOwner);
        await f.db.query(
          "UPDATE amp_trials SET adopted_at=now(),adopted_by=$2 WHERE learner_id=$1",
          [adopted.learnerId, adoptedOwner],
        );
        const adoptedAt = (
          await f.db.query(
            "SELECT adopted_at FROM amp_trials WHERE learner_id=$1",
            [adopted.learnerId],
          )
        ).rows[0].adopted_at as Date;

        const unnamedOwner = await parent(f.db);
        const noYear = await f.repository.createTrial(2013, unnamedOwner);
        await f.db.query(
          "UPDATE amp_learners SET birth_year=NULL WHERE id=$1",
          [noYear.learnerId],
        );

        for (const account of [expiredOwner, adoptedOwner, unnamedOwner]) {
          const client = await f.db.connect();
          try {
            assert.equal(await absorbLiveTrial(client, account), 0);
          } finally {
            client.release();
          }
        }
        const bystander = await parent(f.db);
        const client = await f.db.connect();
        try {
          assert.equal(await absorbLiveTrial(client, bystander), 0);
        } finally {
          client.release();
        }

        for (const learnerId of [
          expired.learnerId,
          ownerless.learnerId,
          adopted.learnerId,
          noYear.learnerId,
        ]) {
          const row = (
            await f.db.query(
              "SELECT account_id,name,name_pending,birth_year FROM amp_learners WHERE id=$1",
              [learnerId],
            )
          ).rows[0];
          assert.equal(row.name, "Trial");
          assert.equal(row.name_pending, false);
          assert.match(row.account_id, /^trial:/);
        }
        assert.equal(
          (
            await f.db.query(
              "SELECT owner_account_id,adopted_at FROM amp_trials WHERE learner_id=$1",
              [ownerless.learnerId],
            )
          ).rows[0].owner_account_id,
          null,
        );
        assert.equal(
          (
            await f.db.query(
              "SELECT adopted_at FROM amp_trials WHERE learner_id=$1",
              [expired.learnerId],
            )
          ).rows[0].adopted_at,
          null,
        );
        assert.equal(
          (
            await f.db.query(
              "SELECT adopted_at FROM amp_trials WHERE learner_id=$1",
              [noYear.learnerId],
            )
          ).rows[0].adopted_at,
          null,
        );
        assert.equal(
          (
            await f.db.query(
              "SELECT adopted_by,adopted_at FROM amp_trials WHERE learner_id=$1",
              [adopted.learnerId],
            )
          ).rows[0].adopted_at.getTime(),
          adoptedAt.getTime(),
        );
      },
    );

    await t.test(
      "a family that already has a child keeps its children, and the trial stays",
      async () => {
        const account = await parent(f.db);
        const fox = await f.repository.create(account, undefined, 2016);
        assert.equal(fox.name, "Fox");
        const trial = await f.repository.createTrial(2015, account);
        await f.db.query(
          "UPDATE amp_learners SET free_online_used=1 WHERE id=$1",
          [trial.learnerId],
        );
        const emptyOwner = await parent(f.db);
        const empty = await f.repository.createTrial(2014, emptyOwner);
        const client = await f.db.connect();
        try {
          assert.equal(await absorbLiveTrial(client, account), 0);
          // A trial nobody practised in carries nothing to keep.
          assert.equal(await absorbLiveTrial(client, emptyOwner), 0);
        } finally {
          client.release();
        }
        assert.ok(
          (await learnerRow(f.db, trial.learnerId)).account_id.startsWith(
            "trial:",
          ),
        );
        assert.ok(
          (await learnerRow(f.db, empty.learnerId)).account_id.startsWith(
            "trial:",
          ),
        );
      },
    );

    await t.test(
      "an adult's trial becomes the account holder's own learner, unless they have one",
      async () => {
        const account = await parent(f.db);
        const adultYear = new Date().getUTCFullYear() - 25;
        const trial = await f.repository.createTrial(adultYear, account);
        await seedHistory(f.db, trial.learnerId);
        const before = await counts(f.db, trial.learnerId);
        const client = await f.db.connect();
        try {
          assert.equal(await absorbLiveTrial(client, account), 1);
        } finally {
          client.release();
        }
        const moved = (
          await f.db.query(
            "SELECT account_id,name,adult,birth_year,name_pending,picture_identity FROM amp_learners WHERE id=$1",
            [trial.learnerId],
          )
        ).rows[0];
        assert.deepEqual(moved, {
          account_id: account,
          name: "Casey Fixture",
          adult: true,
          birth_year: null,
          name_pending: false,
          picture_identity: null,
        });
        assert.deepEqual(await counts(f.db, trial.learnerId), before);
        assert.equal(
          (
            await f.db.query(
              "SELECT adopted_by FROM amp_trials WHERE learner_id=$1",
              [trial.learnerId],
            )
          ).rows[0].adopted_by,
          account,
        );
        // A second adult trial has nowhere to go: the account's one adult
        // learner exists, so it stays live until it expires.
        const second = await f.repository.createTrial(adultYear, account);
        await f.db.query(
          "UPDATE amp_learners SET free_online_used=1 WHERE id=$1",
          [second.learnerId],
        );
        const again = await f.db.connect();
        try {
          assert.equal(await absorbLiveTrial(again, account), 0);
        } finally {
          again.release();
        }
        assert.equal(
          (await learnerRow(f.db, second.learnerId)).account_id.startsWith(
            "trial:",
          ),
          true,
        );
      },
    );

    await t.test(
      "two concurrent calls move the trial exactly once",
      async () => {
        const account = await parent(f.db);
        const trial = await f.repository.createTrial(2016, account);
        await f.db.query(
          "UPDATE amp_learners SET free_online_used=1 WHERE id=$1",
          [trial.learnerId],
        );
        const [first, second] = await Promise.all([
          f.db.connect(),
          f.db.connect(),
        ]);
        try {
          const moved = await Promise.all([
            absorbLiveTrial(first, account),
            absorbLiveTrial(second, account),
          ]);
          assert.equal(
            moved.reduce((sum, count) => sum + count, 0),
            1,
          );
        } finally {
          first.release();
          second.release();
        }
        const row = await learnerRow(f.db, trial.learnerId);
        assert.equal(row.account_id, account);
        assert.equal(row.name, "Fox");
        assert.equal(row.name_pending, true);
        assert.equal(await enrolled(f.db, trial.learnerId, account), 1);
        assert.equal(
          (
            await f.db.query(
              "SELECT count(*)::int AS n FROM amp_trials WHERE learner_id=$1 AND adopted_at IS NOT NULL",
              [trial.learnerId],
            )
          ).rows[0].n,
          1,
        );
      },
    );

    await t.test(
      "a family at the 1000-learner limit keeps its trial",
      async () => {
        const account = await parent(f.db);
        const trial = await f.repository.createTrial(2016, account);
        await f.db.query(
          "UPDATE amp_learners SET free_online_used=1 WHERE id=$1",
          [trial.learnerId],
        );
        const nonce = randomUUID();
        await f.db.query(
          `INSERT INTO amp_learners(id,account_id,name,birth_year)
         SELECT 'limit-'||$2||'-'||i,$1,'Rowan Fixture',2016 FROM generate_series(1,1000) i`,
          [account, nonce],
        );
        const client = await f.db.connect();
        try {
          assert.equal(await absorbLiveTrial(client, account), 0);
        } finally {
          client.release();
        }
        const row = (
          await f.db.query(
            "SELECT l.account_id,t.adopted_at FROM amp_learners l JOIN amp_trials t ON t.learner_id=l.id WHERE l.id=$1",
            [trial.learnerId],
          )
        ).rows[0];
        assert.match(row.account_id, /^trial:/);
        assert.equal(row.adopted_at, null);
        assert.equal(
          (
            await f.db.query(
              "SELECT count(*)::int AS n FROM amp_families WHERE account_id=$1",
              [account],
            )
          ).rows[0].n,
          0,
        );
      },
    );

    await t.test("a school account is left alone", async () => {
      const school = schoolAccountId(randomUUID());
      const trial = await f.repository.createTrial(2016, school);
      await f.db.query(
        "UPDATE amp_learners SET free_online_used=1 WHERE id=$1",
        [trial.learnerId],
      );
      const client = await f.db.connect();
      try {
        assert.equal(await absorbLiveTrial(client, school), 0);
      } finally {
        client.release();
      }
      await accountSummary(f.db, new FamilyRepository(f.db), school);
      const row = (
        await f.db.query(
          "SELECT l.account_id,l.name_pending,t.adopted_at FROM amp_learners l JOIN amp_trials t ON t.learner_id=l.id WHERE l.id=$1",
          [trial.learnerId],
        )
      ).rows[0];
      assert.match(row.account_id, /^trial:/);
      assert.equal(row.name_pending, false);
      assert.equal(row.adopted_at, null);
    });
  },
);

async function fixture(t: TestContext) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const schema = `amp_absorb_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: url, max: 1 });
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  await migrate(scoped.href);
  const repository = new PostgresRepository(scoped.href);
  const db = repository.pool;
  t.after(async () => {
    await repository.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  return { repository, db };
}

async function parent(db: Pool) {
  const userId = randomUUID();
  const account = `amp|${userId}`;
  await db.query(
    `INSERT INTO amp_auth_users(id,name,email,"emailVerified","createdAt","updatedAt")
     VALUES($1,'Casey Fixture',$2,true,now(),now())`,
    [userId, `${userId}@absorb-trial.example`],
  );
  return account;
}

/** Seven answers (one from paper), one skip, one workbook, and a frontier. */
async function seedHistory(db: Pool, learnerId: string) {
  const at = new Date().toISOString();
  for (let index = 0; index < 7; index++) {
    const id = randomUUID();
    await db.query(
      "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
      [id, learnerId, { public: { id } }],
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
          skillId: "add-within-20",
          templateId: "add-within-20",
          correct: true,
          assisted: false,
          createdAt: at,
          ...(index === 0 ? { evidenceSource: "paper" } : {}),
        },
      ],
    );
  }
  await db.query(
    "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3)",
    [randomUUID(), learnerId, { skipped: true, skippedAt: at }],
  );
  await db.query(
    `INSERT INTO amp_workbooks(id,learner_id,workbook_date,number,minutes,paper,spec,code)
     VALUES($1,$2,current_date,1,30,'letter','{}','ABCD-1234')`,
    [randomUUID(), learnerId],
  );
  await db.query(
    "INSERT INTO amp_frontier_states(learner_id,state) VALUES($1,'kept')",
    [learnerId],
  );
  await db.query(
    `UPDATE amp_learners SET
       free_online_used=(
         (SELECT count(*)::int FROM amp_attempts a WHERE a.learner_id=$1
            AND a.outcome->>'evidenceSource' IS DISTINCT FROM 'paper')
         +(SELECT count(*)::int FROM amp_instances i WHERE i.learner_id=$1
            AND i.content->>'skipped'='true')),
       free_workbooks_used=(SELECT count(*)::int FROM amp_workbooks w WHERE w.learner_id=$1)
     WHERE id=$1`,
    [learnerId],
  );
}

async function counts(db: Pool, learnerId: string) {
  const n = async (sql: string) =>
    (await db.query(sql, [learnerId])).rows[0].n as number;
  return {
    attempts: await n(
      "SELECT count(*)::int AS n FROM amp_attempts WHERE learner_id=$1",
    ),
    instances: await n(
      "SELECT count(*)::int AS n FROM amp_instances WHERE learner_id=$1",
    ),
    evidence: await n(
      "SELECT count(*)::int AS n FROM amp_skill_evidence WHERE learner_id=$1",
    ),
    workbooks: await n(
      "SELECT count(*)::int AS n FROM amp_workbooks WHERE learner_id=$1",
    ),
    frontier: await n(
      "SELECT count(*)::int AS n FROM amp_frontier_states WHERE learner_id=$1",
    ),
  };
}

async function ids(db: Pool, sql: string, learnerId: string) {
  return (await db.query(sql, [learnerId])).rows.map((row) => row.id as string);
}

async function learnerRow(db: Pool, learnerId: string) {
  const row = (
    await db.query(
      `SELECT account_id,name,name_pending,picture_identity,picture_number,identity_scope,
              free_online_used,free_workbooks_used
       FROM amp_learners WHERE id=$1`,
      [learnerId],
    )
  ).rows[0];
  return row as {
    account_id: string;
    name: string;
    name_pending: boolean;
    picture_identity: string | null;
    picture_number: number | null;
    identity_scope: string | null;
    free_online_used: number;
    free_workbooks_used: number;
  };
}

async function enrolled(db: Pool, learnerId: string, accountId: string) {
  return (
    await db.query(
      `SELECT count(*)::int AS n FROM amp_enrollments e
       JOIN amp_people p ON p.id=e.person_id
       JOIN amp_families f ON f.class_id=e.class_id
       WHERE p.learner_id=$1 AND f.account_id=$2 AND e.role='student' AND e.end_on IS NULL`,
      [learnerId, accountId],
    )
  ).rows[0].n as number;
}
