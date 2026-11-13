import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { removeOrgTree } from "../src/schools/org-delete.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { syncCleverConnection } from "../src/schools/clever/sync.js";
import { schoolAccountId } from "../src/schools/principal.js";
import type { Snapshot } from "../src/schools/clever/model.js";

for (const phase of ["download", "apply"] as const)
  test(
    `institution purge ${phase === "apply" ? "waits for database apply before learner locks" : "completes during provider download and rejects late apply"}`,
    { skip: !process.env.AMP_TEST_DATABASE_URL },
    async () => {
      const url = process.env.AMP_TEST_DATABASE_URL!;
      assertTestDatabaseTarget(url);
      const schema = `clever_purge_${randomUUID().replaceAll("-", "")}`,
        admin = new Pool({ connectionString: url, max: 1 }),
        scoped = new URL(url);
      scoped.searchParams.set("options", `-c search_path=${schema}`);
      await admin.query(`CREATE SCHEMA ${schema}`);
      const db = new Pool({ connectionString: scoped.href, max: 6 });
      try {
        await migrate(scoped.href);
        const repo = new SchoolRepository(db),
          org = await repo.createOrg(
            { kind: "district", name: "Fixture district", timezone: "UTC" },
            {
              version: "fixture",
              signerName: "Fixture",
              signerTitle: "Administrator",
            },
          );
        const district = "100000000000000000000001",
          school = "200000000000000000000001",
          user = "300000000000000000000001";
        const source: Snapshot = {
          district: { id: district, name: "Fixture district" },
          schools: [{ id: school, district, name: "Fixture school" }],
          users: [
            {
              id: user,
              district,
              name: { first: "Before" },
              roles: { student: { school, grade: "4" } },
            },
          ],
          sections: [
            {
              id: "400000000000000000000001",
              district,
              school,
              name: "Fixture class",
              students: [user],
              teachers: [],
            },
          ],
          courses: [],
          terms: [],
        };
        const connection = await registerCleverConnection(db, {
          environment: "sandbox",
          districtId: district,
          tenantId: org.id,
        });
        const client = {
          districtToken: async () => "fixture",
          snapshot: async () => source,
          latestEvent: async () => null,
          events: async () => [],
        };
        await syncCleverConnection(db, connection.id, client);
        const person = (
          await db.query(
            "SELECT id,learner_id FROM amp_people WHERE tenant_id=$1 AND learner_id IS NOT NULL",
            [org.id],
          )
        ).rows[0];
        source.users[0]!.name.first = "After";
        let fetching!: () => void,
          continueFetch!: () => void,
          lockRequested!: () => void;
        const fetchEntered = new Promise<void>((resolve) => {
            fetching = resolve;
          }),
          fetchGate = new Promise<void>((resolve) => {
            continueFetch = resolve;
          }),
          waiting = new Promise<void>((resolve) => {
            lockRequested = resolve;
          });
        const importer = await db.connect(),
          importerQuery = importer.query;
        importer.query = (async (...args: unknown[]) => {
          if (
            phase === "apply" &&
            String(args[0]).includes("SELECT status,sync_paused")
          ) {
            fetching();
            await fetchGate;
          }
          return Reflect.apply(importerQuery, importer, args);
        }) as PoolClient["query"];
        const importing = syncCleverConnection(
          db,
          connection.id,
          {
            ...client,
            snapshot: async () => {
              if (phase === "download") {
                fetching();
                await fetchGate;
              }
              return source;
            },
          },
          { db: importer },
        ).catch((error) => error as Error);
        await fetchEntered;
        const purge = await db.connect(),
          original = purge.query;
        purge.query = ((...args: unknown[]) => {
          if (
            String(args[0]).includes("pg_advisory_xact_lock") &&
            JSON.stringify(args[1]).includes(`clever-sync:${connection.id}`)
          )
            lockRequested();
          return Reflect.apply(original, purge, args);
        }) as PoolClient["query"];
        let finished = false;
        const purging = (async () => {
          await purge.query("BEGIN");
          try {
            const result = await removeOrgTree(purge, {
              orgId: org.id,
              confirm: "Fixture district",
              commit: true,
              allowLicensed: true,
            });
            await purge.query("COMMIT");
            finished = true;
            return result;
          } catch (error) {
            await purge.query("ROLLBACK");
            throw error;
          }
        })();
        try {
          if (phase === "apply") {
            await Promise.race([
              waiting,
              purging.then(() => {
                throw new Error(
                  "Purge must wait for the import connection lock",
                );
              }),
            ]);
            const probe = await db.connect();
            try {
              await probe.query("BEGIN");
              assert.equal(
                (
                  await probe.query(
                    "SELECT pg_try_advisory_xact_lock_shared(hashtextextended($1,0)) AS available",
                    [schoolAccountId(person.id)],
                  )
                ).rows[0].available,
                true,
                "purge cannot hold the learner account while waiting for the importer",
              );
            } finally {
              await probe.query("ROLLBACK");
              probe.release();
            }
            assert.equal(finished, false);
            continueFetch();
            const result = await importing;
            assert.ok(!(result instanceof Error), String(result));
            await purging;
          } else {
            await purging;
            assert.equal(finished, true);
            continueFetch();
            const result = await importing;
            assert.ok(result instanceof Error);
            assert.match(result.message, /clever_connection_inactive/);
          }
          assert.equal(
            (await db.query("SELECT 1 FROM amp_orgs WHERE id=$1", [org.id]))
              .rowCount,
            0,
          );
          assert.equal(
            (
              await db.query("SELECT 1 FROM amp_learners WHERE id=$1", [
                person.learner_id,
              ])
            ).rowCount,
            0,
          );
          assert.equal(
            (
              await db.query(
                "SELECT 1 FROM amp_clever_connections WHERE id=$1",
                [connection.id],
              )
            ).rowCount,
            0,
          );
        } finally {
          continueFetch();
          await Promise.allSettled([importing, purging]);
          purge.query = original;
          purge.release();
          importer.query = importerQuery;
          importer.release();
        }
      } finally {
        await db.end();
        await admin.query(`DROP SCHEMA ${schema} CASCADE`);
        await admin.end();
      }
    },
  );
