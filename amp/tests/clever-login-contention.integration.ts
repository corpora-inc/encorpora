// Throwaway repro (not committed): a running Clever sync holds the session
// advisory lock `clever-sync:<id>` while it downloads the district snapshot.
// Every Clever staff sign-in for that district (establishProviderPrincipal ->
// attachProvedCleverStaffIn) waits on that lock with no lock_timeout, holding a
// pooled connection inside an open transaction.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { migrate } from "../scripts/migrate.js";
import { SchoolRepository } from "../src/schools/repository.js";
import { registerCleverConnection } from "../src/schools/clever/connection.js";
import { establishProviderPrincipal } from "../src/identity/provider-principals.js";

test(
  "H4: staff sign-in completes while the sync apply lock is busy",
  { skip: !process.env.AMP_TEST_DATABASE_URL },
  async () => {
    const url = process.env.AMP_TEST_DATABASE_URL!;
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
      // Simulate syncCleverConnection: session lock held while fetching from Clever.
      await syncer.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0))",
        [`clever-sync:${id}`],
      );
      const started = Date.now();
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
      await login;
      assert.equal(outcome, "signed-in");
    } finally {
      syncer.release();
      await db.end();
      await admin.end(); // schema left for the scratch-database drop script
    }
  },
);
