import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { purgeTrialRecords } from "../src/privacy/retention.js";

test(
  "migration preserves known trial usage and never guesses paid usage after retention",
  {
    skip: !process.env.AMP_TEST_DATABASE_URL,
  },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const schema = `amp_free_migration_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 1 });
    t.after(async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    });
    // Exercise the actual upgrade from the schema immediately before this change.
    const directory = new URL("../migrations/", import.meta.url);
    await db.query(
      "CREATE TABLE amp_migrations(name text PRIMARY KEY, checksum text NOT NULL)",
    );
    for (const name of (await readdir(directory))
      .filter((name) => name.endsWith(".sql") && name < "0101-")
      .sort()) {
      const sql = await readFile(new URL(name, directory), "utf8");
      await db.query(sql);
      await db.query("INSERT INTO amp_migrations VALUES($1,$2)", [
        name,
        createHash("sha256").update(sql).digest("hex"),
      ]);
    }
    const before = "2026-10-30T00:00:00Z";
    const boundary = "2026-11-01T00:00:00Z";
    const after = "2026-11-02T00:00:00Z";
    const active = randomUUID(),
      adopted = randomUUID(),
      purged = randomUUID(),
      ordinary = randomUUID();
    for (const [id, isAdopted] of [
      [active, false],
      [adopted, true],
      [purged, true],
    ] as const) {
      const trialId = randomUUID();
      const account = isAdopted ? `fixture:${id}` : `trial:${trialId}`;
      await db.query(
        "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,'Fox')",
        [id, account],
      );
      await db.query(
        `INSERT INTO amp_trials(id,token_hash,learner_id,created_at,expires_at,adopted_at,adopted_by)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          trialId,
          createHash("sha256").update(trialId).digest("hex"),
          id,
          id === purged ? "2026-01-01T00:00:00Z" : before,
          after,
          isAdopted ? boundary : null,
          isAdopted ? account : null,
        ],
      );
    }
    await db.query(
      "INSERT INTO amp_learners(id,account_id,name) VALUES($1,'fixture:ordinary','Rowan Fixture')",
      [ordinary],
    );
    const answer = async (learnerId: string, at: string, paper = false) => {
      const id = randomUUID();
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content,created_at) VALUES($1,$2,'{}',$3)",
        [id, learnerId, before],
      );
      await db.query(
        "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome,created_at) VALUES($1,$2,$1,$1,$3,$4)",
        [
          id,
          learnerId,
          {
            skillId: "add-within-20",
            createdAt: at,
            correct: true,
            ...(paper ? { evidenceSource: "paper" } : {}),
          },
          at,
        ],
      );
    };
    const skip = async (learnerId: string, at: string | null) => {
      await db.query(
        "INSERT INTO amp_instances(id,learner_id,content,created_at) VALUES($1,$2,$3,$4)",
        [
          randomUUID(),
          learnerId,
          { skipped: true, ...(at ? { skippedAt: at } : {}) },
          before,
        ],
      );
    };
    const book = async (learnerId: string, number: number, at: string) => {
      await db.query(
        `INSERT INTO amp_workbooks(id,learner_id,workbook_date,number,minutes,paper,spec,code,created_at)
      VALUES($1,$2,'2026-10-30',$3,30,'letter','{}','ABCD-1234',$4)`,
        [randomUUID(), learnerId, number, at],
      );
    };
    for (const learnerId of [adopted, purged, ordinary]) {
      await answer(learnerId, before);
      await answer(learnerId, before, true);
      await answer(learnerId, after);
      await skip(learnerId, before);
      await skip(learnerId, null); // Older records have no skippedAt.
      await skip(learnerId, after); // Instance was made before adoption, skipped after.
      await book(learnerId, 1, before);
      await book(learnerId, 2, after);
    }
    for (let index = 0; index < 101; index++) await answer(active, before);
    for (let number = 1; number <= 6; number++)
      await book(active, number, before);
    assert.equal(
      (await purgeTrialRecords(db, new Date("2026-11-03T00:00:00Z")))
        .expiredTrialRecords,
      1,
    );
    assert.equal(
      (
        await db.query(
          "SELECT count(*)::int AS n FROM amp_learners WHERE id=$1",
          [purged],
        )
      ).rows[0].n,
      1,
    );
    await migrate(scoped.href);
    const usage = async (id: string) =>
      (
        await db.query(
          "SELECT free_online_used,free_workbooks_used FROM amp_learners WHERE id=$1",
          [id],
        )
      ).rows[0];
    assert.deepEqual(await usage(active), {
      free_online_used: 100,
      free_workbooks_used: 5,
    });
    assert.deepEqual(await usage(adopted), {
      free_online_used: 3,
      free_workbooks_used: 1,
    });
    assert.deepEqual(await usage(purged), {
      free_online_used: 0,
      free_workbooks_used: 0,
    });
    assert.deepEqual(await usage(ordinary), {
      free_online_used: 0,
      free_workbooks_used: 0,
    });
    await db.query(
      "UPDATE amp_learners SET free_online_used=4,free_workbooks_used=2 WHERE id=$1",
      [adopted],
    );
    await migrate(scoped.href);
    assert.deepEqual(
      await usage(adopted),
      { free_online_used: 4, free_workbooks_used: 2 },
      "restarting the server does not reset usage",
    );
  },
);
