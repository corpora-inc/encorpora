import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";

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

// Run the real migration runner and exact 0127 file against small evidence
// tables. Earlier migrations are recorded as applied, isolating this upgrade.
async function historyFixture() {
  const url = process.env.AMP_TEST_DATABASE_URL!;
  const admin = new Pool({ connectionString: url });
  const schema = `amp_history_${randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  scoped.searchParams.set("application_name", schema);
  const db = new Pool({ connectionString: scoped.href });
  await db.query(`CREATE TABLE amp_migrations(name text PRIMARY KEY,checksum text NOT NULL);
    CREATE TABLE amp_grants(id text,learner_id text,starts_at timestamptz);
    CREATE TABLE amp_skill_days(learner_id text,day date,attempts int);
    CREATE TABLE amp_active_days(learner_id text,day date,active_ms int);
    CREATE TABLE amp_family_approvals(id text,class_id text,created_at timestamptz)`);
  const directory = new URL("../migrations/", import.meta.url);
  const name = "0127-family-history-indexes.sql";
  for (const file of (await readdir(directory)).filter(
    (f) => f.endsWith(".sql") && f !== name,
  )) {
    const sql = await readFile(new URL(file, directory), "utf8");
    await db.query("INSERT INTO amp_migrations VALUES($1,$2)", [
      file,
      createHash("sha256").update(sql).digest("hex"),
    ]);
  }
  return {
    db,
    schema,
    url: scoped.href,
    name,
    close: async () => {
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    },
  };
}

test(
  "0127 permits evidence writes while an index build waits for an existing writer",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const fixture = await historyFixture();
    const { db, schema } = fixture;
    const blocker = await db.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query("BEGIN");
      await blocker.query("LOCK TABLE amp_grants IN ROW EXCLUSIVE MODE");
      // Catch immediately so test assertion failures never leave an unhandled rejection.
      pending = migrate(fixture.url).then(
        () => null,
        (error: unknown) => error,
      );
      let waiting = false;
      for (let attempt = 0; attempt < 200; attempt++) {
        const { rows } = await db.query(
          `SELECT 1 FROM pg_stat_activity WHERE application_name=$1
        AND query ILIKE '%CREATE INDEX%' AND wait_event_type='Lock'`,
          [schema],
        );
        if (rows.length) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(waiting, "the runner reached the live index build");
      // Bound the repro even on the broken runner; a queued ShareLock blocks this INSERT.
      await db.query("SET statement_timeout='500ms'");
      await db.query("INSERT INTO amp_grants VALUES('grant','child',now())");
      await db.query(
        "INSERT INTO amp_skill_days VALUES('child',current_date,1)",
      );
      await db.query(
        "INSERT INTO amp_active_days VALUES('child',current_date,1)",
      );
      await db.query(
        "INSERT INTO amp_family_approvals VALUES('approval','class',now())",
      );
      assert.equal(
        (
          await db.query("SELECT 1 FROM amp_migrations WHERE name=$1", [
            fixture.name,
          ])
        ).rowCount,
        0,
      );
      await blocker.query("COMMIT");
      assert.equal(await pending, null);
      assert.equal(
        (
          await db.query("SELECT 1 FROM amp_migrations WHERE name=$1", [
            fixture.name,
          ])
        ).rowCount,
        1,
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int AS n FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      WHERE c.relnamespace=$1::regnamespace AND c.relname<>'amp_migrations_pkey' AND i.indisvalid`,
            [schema],
          )
        ).rows[0].n,
        4,
      );
    } finally {
      await blocker.query("ROLLBACK");
      await pending;
      blocker.release();
      await fixture.close();
    }
  },
);

test(
  "0127 resumes a partial build, replaces an invalid index and preserves checksums",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const fixture = await historyFixture();
    const { db } = fixture;
    try {
      await db.query(
        "CREATE INDEX CONCURRENTLY amp_grants_family_history_idx ON amp_grants(learner_id,starts_at DESC,id DESC)",
      );
      const before = (
        await db.query(
          "SELECT 'amp_grants_family_history_idx'::regclass::oid AS oid",
        )
      ).rows[0].oid;
      await db.query(
        "INSERT INTO amp_skill_days VALUES('child',current_date,0)",
      );
      await assert.rejects(
        db.query(
          "CREATE INDEX CONCURRENTLY amp_skill_days_latest_idx ON amp_skill_days((1/attempts))",
        ),
        { code: "22012" },
      );
      assert.equal(
        (
          await db.query(
            "SELECT indisvalid FROM pg_index WHERE indexrelid='amp_skill_days_latest_idx'::regclass",
          )
        ).rows[0].indisvalid,
        false,
      );
      // Fail after the first two builds: no receipt may be recorded for a
      // partial migration, and rerunning must retain the completed prefix.
      await db.query("ALTER TABLE amp_active_days RENAME TO held_active_days");
      await assert.rejects(migrate(fixture.url), { code: "42P01" });
      assert.equal(
        (
          await db.query("SELECT 1 FROM amp_migrations WHERE name=$1", [
            fixture.name,
          ])
        ).rowCount,
        0,
      );
      await db.query("ALTER TABLE held_active_days RENAME TO amp_active_days");
      await migrate(fixture.url);
      assert.equal(
        (
          await db.query(
            "SELECT 'amp_grants_family_history_idx'::regclass::oid AS oid",
          )
        ).rows[0].oid,
        before,
      );
      assert.equal(
        (
          await db.query(
            "SELECT indisvalid FROM pg_index WHERE indexrelid='amp_skill_days_latest_idx'::regclass",
          )
        ).rows[0].indisvalid,
        true,
      );
      assert.match(
        (
          await db.query(
            "SELECT pg_get_indexdef('amp_skill_days_latest_idx'::regclass) AS definition",
          )
        ).rows[0].definition,
        /learner_id, day DESC/,
      );
      await migrate(fixture.url);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM amp_migrations WHERE name=$1",
            [fixture.name],
          )
        ).rows[0].n,
        1,
      );
      await db.query(
        "UPDATE amp_migrations SET checksum='changed' WHERE name=$1",
        [fixture.name],
      );
      await assert.rejects(
        migrate(fixture.url),
        /Applied migration changed: 0127/,
      );
    } finally {
      await fixture.close();
    }
  },
);
