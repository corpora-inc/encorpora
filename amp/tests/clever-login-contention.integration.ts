// Staff sign-in and deferred attachment must complete while roster apply is locked.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import type { FastifyRequest } from "fastify";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";
import {
  establishProviderPrincipal,
  resolveProviderSession,
} from "../src/identity/provider-principals.js";

test(
  "H4: staff sign-in completes while the sync apply lock is busy",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
    assertTestDatabaseTarget(url);
    const schema = `repro_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url, max: 1 });
    const scoped = new URL(url);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = new Pool({ connectionString: scoped.href, max: 3 });
    const syncer = await db.connect();
    try {
      await migrate(scoped.href);
      const repo = new SchoolRepository(db);
      const district = await repo.createOrg(
        { kind: "district", name: "D", timezone: "America/New_York" },
        { version: "fixture", signerName: "A", signerTitle: "Admin" },
      );
      const districtId = "a".repeat(24);
      const { id } = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId,
        tenantId: district.id,
      });
      // Hold the database-apply lock as a busy worker would.
      await syncer.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0))",
        [`clever-sync:${id}`],
      );
      const login = establishProviderPrincipal(
        db,
        {
          environment: "sandbox",
          districtId,
          userId: "b".repeat(24),
          roles: ["teacher"],
          schools: [],
        },
        null,
      );
      const outcome = await Promise.race([
        login.then(() => "signed-in"),
        new Promise((r) => setTimeout(() => r("still-waiting"), 750)),
      ]);

      await syncer.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
        `clever-sync:${id}`,
      ]);
      const signedIn = await login;
      assert.equal(outcome, "signed-in");
      const teacher = await repo.addStaff({
        orgId: district.id,
        role: "teacher",
        givenName: "Fixture",
      });
      const runId = randomUUID();
      await db.query(
        "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status,started_at,finished_at) VALUES($1,$2,'full','succeeded',now(),now())",
        [runId, id],
      );
      await db.query(
        "INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,metadata,last_seen_run_id) VALUES($1,'user',$2,$3,$4,$5,$6)",
        [
          id,
          "b".repeat(24),
          teacher.personId,
          JSON.stringify({ id: "b".repeat(24), district: districtId }),
          JSON.stringify({ roles: ["teacher"] }),
          runId,
        ],
      );
      const request = {
        url: "/api/v1/provider/session",
        headers: { authorization: `Bearer ${signedIn.token}` },
      } as FastifyRequest;
      const resolver = (claims: Parameters<typeof resolveCleverPerson>[1]) =>
        resolveCleverPerson(db, claims);
      await syncer.query("SELECT pg_advisory_lock(hashtextextended($1,0))", [
        `clever-sync:${id}`,
      ]);
      const read = resolveProviderSession(db, request, resolver);
      const readOutcome = await Promise.race([
        read.then((value) => ({ value })),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 750)),
      ]);
      await syncer.query("SELECT pg_advisory_unlock(hashtextextended($1,0))", [
        `clever-sync:${id}`,
      ]);
      await read;
      assert.ok(
        readOutcome,
        "session read must defer attachment without waiting",
      );
      assert.equal(readOutcome.value?.personId, null);
      assert.equal(
        (await resolveProviderSession(db, request, resolver))?.personId,
        teacher.personId,
      );
    } finally {
      syncer.release();
      await db.end();
      await admin.end(); // schema left for the scratch-database drop script
    }
  },
);
