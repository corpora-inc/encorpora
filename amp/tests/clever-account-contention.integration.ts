import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { assertTestDatabaseTarget } from "../scripts/test-database-preflight.js";
import {
  establishProviderPrincipal,
  resolveProviderSession,
} from "../src/identity/provider-principals.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { resolveCleverPerson } from "../src/schools/clever/identity.js";

test(
  "returning login and session attachment defer during a worker account lock",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = new URL(process.env.AMP_TEST_DATABASE_URL!);
    assertTestDatabaseTarget(url.href);
    const schema = `account_busy_${randomUUID().replaceAll("-", "")}`;
    const admin = new Pool({ connectionString: url.href });
    await admin.query(`CREATE SCHEMA ${schema}`);
    url.searchParams.set("options", `-c search_path=${schema}`);
    const db = new Pool({ connectionString: url.href, max: 3 });
    const locker = await db.connect();
    try {
      await migrate(url.href);
      const repo = new SchoolRepository(db);
      const org = await repo.createOrg(
        { kind: "district", name: "Fixture", timezone: "UTC" },
        { version: "fixture", signerName: "Fixture", signerTitle: "Admin" },
      );
      const claims = {
        environment: "sandbox" as const,
        districtId: "1".repeat(24),
        userId: "2".repeat(24),
        roles: ["teacher"],
        schools: [],
      };
      const connection = await registerCleverConnection(db, {
        environment: "sandbox",
        districtId: claims.districtId,
        tenantId: org.id,
      });
      const original = await establishProviderPrincipal(db, claims, null);
      const teacher = await repo.addStaff({
        orgId: org.id,
        role: "teacher",
        givenName: "Fixture",
      });
      const runId = randomUUID();
      await db.query(
        "INSERT INTO amp_clever_sync_runs(id,connection_id,mode,status) VALUES($1,$2,'full','succeeded')",
        [runId, connection.id],
      );
      await db.query(
        "INSERT INTO amp_clever_bindings(connection_id,kind,clever_id,local_id,record,metadata,last_seen_run_id) VALUES($1,'user',$2,$3,$4,$5,$6)",
        [
          connection.id,
          claims.userId,
          teacher.personId,
          { id: claims.userId, district: claims.districtId },
          { roles: ["teacher"] },
          runId,
        ],
      );
      await locker.query("BEGIN");
      // The roster's changed-person phase holds this shared privacy lock.
      await locker.query(
        "SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))",
        [original.accountId],
      );
      const started = performance.now();
      const returning = await establishProviderPrincipal(db, claims, null);
      assert.equal(returning.accountId, original.accountId);
      const request = {
        url: "/api/v1/provider/session",
        headers: { authorization: `Bearer ${returning.token}` },
      } as FastifyRequest;
      const resolver = (identity: Parameters<typeof resolveCleverPerson>[1]) =>
        resolveCleverPerson(db, identity);
      const deferred = await resolveProviderSession(db, request, resolver);
      assert.ok(deferred);
      assert.equal(deferred.personId, null);
      assert.ok(
        performance.now() - started < 750,
        "worker contention must not consume the lock timeout",
      );
      assert.equal(
        (
          await db.query("SELECT account_id FROM amp_people WHERE id=$1", [
            teacher.personId,
          ])
        ).rows[0].account_id,
        null,
      );
      await locker.query("ROLLBACK");
      assert.equal(
        (await resolveProviderSession(db, request, resolver))?.personId,
        teacher.personId,
      );

      // Account erasure owns an exclusive lock. Login must not bypass it.
      await locker.query("BEGIN");
      await locker.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [original.accountId],
      );
      const count = (
        await db.query("SELECT count(*)::int AS n FROM amp_provider_sessions")
      ).rows[0].n;
      await assert.rejects(
        establishProviderPrincipal(db, claims, null),
        (error: unknown) =>
          (error as { statusCode?: number; message?: string }).statusCode ===
            503 && (error as Error).message === "clever_sign_in_busy",
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM amp_provider_sessions"))
          .rows[0].n,
        count,
      );
    } finally {
      await locker.query("ROLLBACK");
      locker.release();
      await db.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  },
);
