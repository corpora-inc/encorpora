import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";

test(
  "0126 adds metadata without rewriting or backfilling the locked learner table",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const db = new Pool({
      connectionString: process.env.AMP_TEST_DATABASE_URL,
    });
    const client = await db.connect();
    const schema = `amp_migration_${randomUUID().replaceAll("-", "")}`;
    try {
      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA ${schema}`);
      await client.query(`SET LOCAL search_path=${schema}`);
      await client.query(`CREATE TABLE amp_learners(id text PRIMARY KEY,adult boolean DEFAULT false,birth_year int,starting_band text);
      CREATE TABLE amp_attempts(learner_id text);
      INSERT INTO amp_learners(id) SELECT n::text FROM generate_series(1,100) n;
      INSERT INTO amp_attempts SELECT id FROM amp_learners;
      CREATE FUNCTION refuse_backfill() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'backfill under DDL lock'; END $$;
      CREATE TRIGGER refuse_backfill BEFORE UPDATE ON amp_learners FOR EACH ROW EXECUTE FUNCTION refuse_backfill()`);
      const before = (
        await client.query(
          "SELECT relfilenode FROM pg_class WHERE oid='amp_learners'::regclass",
        )
      ).rows[0];
      await client.query(
        await readFile(
          new URL("../migrations/0126-course-start.sql", import.meta.url),
          "utf8",
        ),
      );
      assert.deepEqual(
        (
          await client.query(
            "SELECT relfilenode FROM pg_class WHERE oid='amp_learners'::regclass",
          )
        ).rows[0],
        before,
      );
      assert.equal(
        (
          await client.query(
            "SELECT count(*)::int AS n FROM amp_learners WHERE starting_course_level IS NOT NULL",
          )
        ).rows[0].n,
        0,
      );
    } finally {
      await client.query("ROLLBACK");
      client.release();
      await db.end();
    }
  },
);
