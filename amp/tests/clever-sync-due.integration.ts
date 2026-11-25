import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { cleverSyncCommand } from "../scripts/clever-sync.js";
import { cleverWorkDue } from "../src/schools/clever/due.js";

/** The every-minute job's idle check: with nothing due it answers from one
 * query and never loads the sync code; with anything due it runs as before. */
test(
  "the scheduled Clever job loads the sync only when a sync or LMS pass is due",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async (t) => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `clever_due_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    let db: Pool | undefined;
    try {
      await migrate(scoped.href);
      db = new Pool({ connectionString: scoped.href, max: 2 });
      const pool = db;
      const env = {
        AMP_DATABASE_URL: scoped.href,
        AMP_CLEVER_ENVIRONMENT: "sandbox",
      } as NodeJS.ProcessEnv;
      let loads = 0;
      // Stands in for the sync code: counts the load, finds no candidates.
      const load = (async () => {
        loads++;
        return {
          CleverClient: class {},
          cleverApiVersion: () => "3.0",
          cleverSyncCandidates: async () => [],
          lmsConnectEnabled: () => false,
          lmsPassFailed: () => false,
          runDueCleverSync: async () => undefined,
          runLmsPasses: async () => [],
          safeSyncError: () => "clever_sync_failed",
          syncCleverConnection: async () => ({}),
        };
      }) as never;
      const run = async (
        args = ["sync", "all", "auto"],
        extra: NodeJS.ProcessEnv = {},
      ) => {
        const before = loads;
        const output = await cleverSyncCommand(
          args,
          { ...env, ...extra },
          load,
        );
        return { output, loaded: loads > before };
      };
      const connection = async (
        environment: "sandbox" | "production",
        columns: string,
      ) => {
        const org = randomUUID(),
          id = randomUUID();
        await pool.query(
          "INSERT INTO amp_orgs(id,kind,path,name,timezone) VALUES($1,'district',ARRAY[$1::uuid],'Fixture District','UTC')",
          [org],
        );
        await pool.query(
          `INSERT INTO amp_clever_connections(id,environment,district_id,tenant_id)
           VALUES($1,$2,$3,$4)`,
          [id, environment, randomUUID().replaceAll("-", "").slice(0, 24), org],
        );
        await pool.query(
          `UPDATE amp_clever_connections SET ${columns} WHERE id=$1`,
          [id],
        );
        return id;
      };
      const set = (id: string, columns: string) =>
        pool.query(`UPDATE amp_clever_connections SET ${columns} WHERE id=$1`, [
          id,
        ]);

      await t.test("no connection: nothing loads, nothing runs", async () => {
        assert.deepEqual(await cleverWorkDue(pool, "sandbox", false), {
          sync: false,
          lms: false,
        });
        assert.deepEqual(await run(), { output: [], loaded: false });
        // Clever credentials are not even read on the idle path.
        assert.equal(env.AMP_CLEVER_CLIENT_ID, undefined);
      });

      // Synced a minute ago with Events: next due in five minutes.
      const id = await connection(
        "sandbox",
        "events_enabled=true,last_sync_at=now()-interval '1 minute'",
      );
      await t.test("a recently synced connection is not due", async () => {
        assert.equal((await run()).loaded, false);
      });
      await t.test(
        "past its interval, asked for, or never synced, it is due",
        async () => {
          await set(id, "last_sync_at=now()-interval '6 minutes'");
          assert.equal((await run()).loaded, true);
          await set(
            id,
            "events_unavailable_at=now(),last_sync_at=now()-interval '6 minutes'",
          );
          assert.equal((await run()).loaded, false, "daily without Events");
          await set(id, "last_sync_at=now()-interval '25 hours'");
          assert.equal((await run()).loaded, true);
          await set(id, "last_sync_at=now(),sync_requested_at=now()");
          assert.equal((await run()).loaded, true, "a request is due at once");
          await set(id, "sync_requested_at=NULL,last_sync_at=NULL");
          assert.equal((await run()).loaded, true, "never synced");
        },
      );
      await t.test(
        "a retry backoff, a pause or a disconnection holds it",
        async () => {
          await set(
            id,
            "last_sync_at=NULL,next_attempt_at=now()+interval '1 minute'",
          );
          assert.equal((await run()).loaded, false);
          await set(id, "next_attempt_at=now()-interval '1 second'");
          assert.equal((await run()).loaded, true);
          await set(id, "sync_paused=true");
          assert.equal((await run()).loaded, false);
          // A paused connection's staging, asked for by the operator.
          await set(id, "sync_requested_at=now()");
          assert.equal((await run()).loaded, true);
          await set(id, "status='disconnected'");
          assert.equal((await run()).loaded, false);
        },
      );
      await t.test(
        "another environment's connection is not this job's",
        async () => {
          await connection("production", "last_sync_at=NULL");
          assert.equal((await run()).loaded, false);
          assert.equal(
            (await run(undefined, { AMP_CLEVER_ENVIRONMENT: "production" }))
              .loaded,
            true,
          );
        },
      );
      await t.test(
        "with LMS Connect configured, any active connection is LMS work",
        async () => {
          await set(
            id,
            "status='active',sync_paused=false,sync_requested_at=NULL,last_sync_at=now(),events_unavailable_at=NULL",
          );
          assert.equal((await run()).loaded, false);
          assert.deepEqual(await cleverWorkDue(pool, "sandbox", true), {
            sync: false,
            lms: true,
          });
          assert.equal(
            (await run(undefined, { AMP_CLEVER_LMS_CONNECT: "enabled" }))
              .loaded,
            true,
          );
        },
      );
      await t.test(
        "an explicit connection or mode always runs, as before",
        async () => {
          assert.equal((await run(["sync", "all", "full"])).loaded, true);
          await assert.rejects(
            run(["sync", id, "auto"]),
            /Clever connection not found/,
          );
          assert.equal(loads > 0, true);
        },
      );
      await t.test("the real sync code loads when work is due", async () => {
        await assert.rejects(
          cleverSyncCommand(["sync", randomUUID(), "auto"], {
            ...env,
            AMP_CLEVER_CLIENT_ID: "fixture",
            AMP_CLEVER_CLIENT_SECRET: "fixture",
          }),
          /Clever connection not found/,
        );
      });
    } finally {
      await db?.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
