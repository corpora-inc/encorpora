import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate, supersededChecksums } from "../scripts/migrate.js";

/* The migration runner against a real database: level practice's lock
   profile, receipts of rewritten files, concurrent index builds that wait
   for older transactions, and a connection lost mid-run. */

const enabled = { skip: !process.env.AMP_TEST_DATABASE_URL };

async function schema(run: (url: string, db: Pool) => Promise<void>) {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const admin = new Pool({ connectionString: url, max: 1 });
  const name = `amp_runner_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${name}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${name}`);
  const db = new Pool({ connectionString: scoped.href, max: 4 });
  db.on("error", () => undefined);
  try {
    await migrate(scoped.href);
    await run(scoped.href, db);
  } finally {
    await db.end();
    await admin.query(`DROP SCHEMA ${name} CASCADE`);
    await admin.end();
  }
}

/** Forget the level practice index, as if 0137 had not run yet. */
async function withoutLevelIndex(db: Pool) {
  await db.query("DROP INDEX amp_learners_one_level_practice_idx");
  await db.query(
    "DELETE FROM amp_migrations WHERE name='0137-level-practice-index.sql'",
  );
}
const levelIndex = async (db: Pool) =>
  (
    await db.query<{ indisvalid: boolean; indisunique: boolean }>(
      "SELECT indisvalid,indisunique FROM pg_index WHERE indexrelid=to_regclass('amp_learners_one_level_practice_idx')",
    )
  ).rows[0];

test(
  "level practice adds its check without validating under the exclusive lock, then validates it and builds a unique index concurrently",
  enabled,
  async () => {
    const files = await Promise.all(
      [
        "0135-level-practice.sql",
        "0136-level-practice-validate.sql",
        "0137-level-practice-index.sql",
      ].map((name) =>
        readFile(new URL(`../migrations/${name}`, import.meta.url), "utf8"),
      ),
    );
    assert.match(
      files[0]!,
      /CHECK \(level_practice IS NULL OR simulation\) NOT VALID;/,
    );
    assert.doesNotMatch(files[0]!, /CREATE (UNIQUE )?INDEX/);
    assert.match(
      files[1]!,
      /VALIDATE CONSTRAINT amp_learners_level_practice_simulation/,
    );
    assert.match(files[2]!, /^-- migrate:concurrent-indexes\n/);
    await schema(async (_url, db) => {
      assert.equal(
        (
          await db.query(
            "SELECT convalidated FROM pg_constraint WHERE conname='amp_learners_level_practice_simulation'",
          )
        ).rows[0]?.convalidated,
        true,
      );
      assert.deepEqual(await levelIndex(db), {
        indisvalid: true,
        indisunique: true,
      });
      await db.query(
        `INSERT INTO amp_learners(id,account_id,name,adult,simulation,level_practice)
         VALUES('level-a','amp|level','Level',true,true,'{"grade":4}')`,
      );
      await assert.rejects(
        db.query(
          `INSERT INTO amp_learners(id,account_id,name,adult,simulation,level_practice)
           VALUES('level-b','amp|level','Level',true,true,'{"grade":5}')`,
        ),
        /amp_learners_one_level_practice_idx/,
      );
      await assert.rejects(
        db.query(
          `INSERT INTO amp_learners(id,account_id,name,adult,simulation,level_practice)
           VALUES('level-c','amp|other','Real',true,false,'{"grade":5}')`,
        ),
        /amp_learners_level_practice_simulation/,
      );
    });
  },
);

test(
  "a database that applied the earlier level practice file keeps its schema and takes the new receipt",
  enabled,
  () =>
    schema(async (url, db) => {
      const receipt = async () =>
        (
          await db.query(
            "SELECT checksum FROM amp_migrations WHERE name='0135-level-practice.sql'",
          )
        ).rows[0]?.checksum;
      const current = await receipt();
      // Its receipt, under the oldest of its earlier names.
      await db.query(
        "UPDATE amp_migrations SET name='0132-level-practice.sql',checksum=$1 WHERE name='0135-level-practice.sql'",
        [supersededChecksums["0135-level-practice.sql"]![0]],
      );
      await migrate(url);
      assert.equal(await receipt(), current);
      assert.deepEqual(await levelIndex(db), {
        indisvalid: true,
        indisunique: true,
      });
      // Any other content is still refused.
      await db.query(
        "UPDATE amp_migrations SET checksum='changed' WHERE name='0135-level-practice.sql'",
      );
      await assert.rejects(
        migrate(url),
        /Applied migration changed: 0135-level-practice.sql/,
      );
    }),
);

test(
  "a concurrent index build waits for an older writer beyond the lock timeout",
  enabled,
  () =>
    schema(async (url, db) => {
      await withoutLevelIndex(db);
      const writer = await db.connect();
      try {
        await writer.query("BEGIN");
        await writer.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES('writer','amp|writer','Writer')",
        );
        // Ends well after every retry of a 100 ms lock timeout gave up.
        const commit = new Promise((resolve) => setTimeout(resolve, 2500)).then(
          () => writer.query("COMMIT"),
        );
        await migrate(url, { lockTimeoutMs: 100 });
        await commit;
      } finally {
        writer.release();
      }
      assert.deepEqual(await levelIndex(db), {
        indisvalid: true,
        indisunique: true,
      });
    }),
);

test(
  "a connection lost mid-run reports its own error and releases the pool",
  enabled,
  () =>
    schema(async (url, db) => {
      await withoutLevelIndex(db);
      const writer = await db.connect();
      try {
        await writer.query("BEGIN");
        await writer.query(
          "INSERT INTO amp_learners(id,account_id,name) VALUES('writer','amp|writer','Writer')",
        );
        const run = migrate(url);
        // The runner is waiting for the writer: end its connection.
        let terminated = 0;
        for (let i = 0; i < 100 && !terminated; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          terminated = (
            await db.query(
              `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
               WHERE query LIKE 'CREATE UNIQUE INDEX CONCURRENTLY amp_learners_one_level_practice_idx%'
                 AND pid<>pg_backend_pid()`,
            )
          ).rowCount!;
        }
        assert.equal(terminated, 1);
        await assert.rejects(run, (error: { code?: string }) => {
          assert.equal(error.code, "57P01");
          return true;
        });
        await writer.query("ROLLBACK");
      } finally {
        writer.release();
      }
      // The lost session's lock went with it: the next run completes.
      await migrate(url);
      assert.deepEqual(await levelIndex(db), {
        indisvalid: true,
        indisunique: true,
      });
    }),
);

test(
  "runners started together on a fresh database all finish: a waiting runner never blocks the concurrent index builds of the one migrating",
  enabled,
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    const admin = new Pool({ connectionString: url, max: 1 });
    const name = `amp_runner_${randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE SCHEMA ${name}`);
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${name}`);
    try {
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => migrate(scoped.href)),
      );
      const failed = results.filter((r) => r.status === "rejected");
      assert.deepEqual(
        failed.map((r) => String((r as PromiseRejectedResult).reason)),
        [],
      );
      const db = new Pool({ connectionString: scoped.href, max: 1 });
      try {
        assert.equal((await levelIndex(db))?.indisvalid, true);
      } finally {
        await db.end();
      }
    } finally {
      await admin.query(`DROP SCHEMA ${name} CASCADE`);
      await admin.end();
    }
  },
);
